"""CLI: `python -m depor_hub.cli {ingest|probe|schemas}`."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import yaml

from . import club as club_data
from . import club_extra
from . import models as m
from . import rivals as rivals_ctx
from . import source_models as s
from . import transform as t
from .cadence import is_due, load_fixtures, plan_matchday, read_last_refresh, write_last_refresh
from .client import Client
from .enrich import bdfutbol, crests, official, proposal, wikidata, wikipedia
from .enrich import coach as coach_enrich
from .enrich.http import PoliteClient, SourceBlocked, SourceError, contact_from_env
from .extras import (
    PlayerExtra,
    apply_coach,
    apply_extras,
    load_coach,
    load_extras,
    reset_coach,
    reset_enriched,
    unknown_ids,
)
from .news import audit as news_audit
from .news import ingest as news_ingest
from .news.feeds import load_feeds
from .news.http import NewsHttp
from .news.relevance import build_index
from .publish import write_if_changed, write_optional
from .social import build_social, load_social, write_social

COMPETITION = "PD"


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _client(raw_dir: Path | None) -> Client:
    return Client(
        os.environ.get("FOOTBALL_DATA_TOKEN", ""),
        os.environ.get("CONTACT_EMAIL", "contacto-no-configurado"),
        raw_dir,
    )


def _validate_ingest_integrity(standings: m.Standings, squad: m.Squad) -> None:
    if len(standings.table) != 20:
        raise SystemExit(
            f"ERROR: clasificación incompleta ({len(standings.table)} filas; se esperaban 20); "
            "no se publicaron datos"
        )
    if not squad.players:
        raise SystemExit("ERROR: plantilla vacía; se conserva la publicación anterior")


def _team_id() -> int | None:
    value = os.environ.get("DEPOR_TEAM_ID", "").strip()
    return int(value) if value else None


def _gh_output(**values: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        for key, value in values.items():
            fh.write(f"{key}={value}\n")


def cmd_ingest(args: argparse.Namespace) -> int:
    # `--if-due` sale antes de tocar la red. `--force` salta la comprobación.
    if args.if_due and not args.force:
        now = datetime.now(UTC)
        fixtures = load_fixtures(Path(args.fixtures))
        last = read_last_refresh(Path(args.state))
        if not is_due(fixtures, now, last):
            print("changed=false due=false")
            _gh_output(changed="false", refreshed="false")
            return 0

    client = _client(Path(args.raw))
    comp = s.FDCompetition.model_validate(client.get(f"/competitions/{COMPETITION}"))
    if not comp.currentSeason:
        raise SystemExit("La API no informa de temporada actual")
    season = t.season_label(datetime.fromisoformat(comp.currentSeason.startDate).date())
    standings_raw = s.FDStandings.model_validate(
        client.get(f"/competitions/{COMPETITION}/standings")
    )
    matches_raw = s.FDMatches.model_validate(client.get(f"/competitions/{COMPETITION}/matches"))
    teams_raw = s.FDTeams.model_validate(client.get(f"/competitions/{COMPETITION}/teams"))

    team = t.find_team(teams_raw.teams, _team_id())
    if not team.squad:  # algunas respuestas de lista no traen plantilla
        team = s.FDTeam.model_validate(client.get(f"/teams/{team.id}"))

    now = _now()
    venues = {x.id: x.venue for x in teams_raw.teams}  # sede de los partidos fuera de casa
    standings = t.build_standings(standings_raw, season, comp.currentSeason.currentMatchday, now)
    fixtures = t.build_fixtures(matches_raw, team.id, season, now, venues)
    squad = t.build_squad(team, now)
    # Datos manuales con fuente (dorsal, contrato, altura): solo rellenan huecos de la API (ADR 0007).
    extras = load_extras(Path(args.extras))
    override_path = Path(args.overrides)
    if override_path.exists():
        overrides = proposal.load_manual(override_path)
        # Manual overrides win over generated enrichments; football-data still wins
        # because apply_extras only fills fields missing from the API model.
        generated = proposal.load_manual(Path(args.extras))
        merged = proposal.merge_extras(overrides, generated)
        extras = {pid: PlayerExtra.model_validate(value) for pid, value in merged.items()}
    squad = apply_extras(squad, extras)
    squad = apply_coach(squad, load_coach(Path(args.coach)))
    for pid in unknown_ids(squad, extras):
        print(
            f"AVISO: {args.extras} menciona el id {pid}, que no está en la plantilla",
            file=sys.stderr,
        )
    meta = t.build_meta(comp, team, season, now)

    _validate_ingest_integrity(standings, squad)

    files = {
        "standings.json": t.dump(standings),
        "fixtures.json": t.dump(fixtures),
        "squad.json": t.dump(squad),
        "meta.json": t.dump(meta),
        "season.json": t.dump(
            t.build_season(matches_raw, fixtures, standings, team.id, season, now)
        ),
    }
    digest = t.content_hash(files)
    files["meta.json"]["dataHash"] = digest

    changed = write_if_changed(Path(args.out), files, digest, force=args.force)
    print(f"changed={'true' if changed else 'false'} hash={digest}")
    if args.if_due:
        # Solo se actualiza el estado cuando se ha hecho una pasada real (aunque no cambie el contenido).
        write_last_refresh(Path(args.state), datetime.now(UTC))
        _gh_output(changed="true" if changed else "false", refreshed="true")
    else:
        _gh_output(changed="true" if changed else "false")
    return 0


def cmd_matchday_plan(args: argparse.Namespace) -> int:
    """Ventana del supervisor de día de partido: refresco cada 10 min."""
    fixtures = m.Fixtures.model_validate_json(
        Path(args.fixtures).read_text(encoding="utf-8")
    )
    now = datetime.now(UTC)
    if getattr(args, "now", None):
        now = datetime.fromisoformat(str(args.now).replace("Z", "+00:00"))
        if now.tzinfo is None:
            now = now.replace(tzinfo=UTC)
    plan = plan_matchday(fixtures, now)
    if not plan.active:
        print("active=false")
        _gh_output(active="false", start="", until="")
        return 0
    if plan.start is None or plan.until is None:
        raise SystemExit("plan_matchday activo sin ventana")
    start = int(plan.start.timestamp())
    until = int(plan.until.timestamp())
    print(f"active=true start={start} until={until}")
    _gh_output(active="true", start=str(start), until=str(until))
    return 0


def _bdfutbol_ids(path: Path) -> dict[int, str]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    teams = raw.get("teams") or {}
    return {int(team_id): str(bdf_id) for team_id, bdf_id in teams.items()}


def _keep_previous_rivals(out_dir: Path, with_history: int) -> bool:
    """Evita publicar un rivals.json sin histórico encima de uno que sí lo tenía.

    BDFutbol puede cambiar el HTML o bloquear una pasada: publicar 19 rivales con
    `headToHead=null` borraría datos verificados. En ese caso se conserva el fichero
    anterior y el comando termina con error para que el workflow lo señale.
    """
    if with_history > 0:
        return False
    path = out_dir / "rivals.json"
    if not path.exists():
        return False
    try:
        previous = m.Rivals.model_validate_json(path.read_text(encoding="utf-8"))
    except ValueError:
        return False
    return any(rival.head_to_head is not None for rival in previous.rivals)


def _rivals_guard(
    *, with_history: int, previous: bool, blocked: int, attempts: int
) -> str:
    """Decide qué hacer cuando la pasada no trae histórico.

    - ``publish``: hay histórico o no había publicación previa que proteger.
    - ``keep-blocked``: BDFutbol bloqueó **todas** las consultas (403/429): no es
      una degradación del HTML, así que se conserva lo anterior sin run rojo.
    - ``keep-degraded``: la fuente respondió y aun así no hay cruces: eso sí es
      una degradación y el run debe verse en rojo (PIPE-07).
    """
    if with_history or not previous:
        return "publish"
    if attempts > 0 and blocked == attempts:
        return "keep-blocked"
    return "keep-degraded"


def cmd_rivals(args: argparse.Namespace) -> int:
    """Publica rivals.json: histórico BDFutbol, entrenador y goleadores por rival."""
    out_dir = Path(args.out)
    fixtures = m.Fixtures.model_validate_json(Path(args.fixtures).read_text(encoding="utf-8"))
    standings = (
        m.Standings.model_validate_json(Path(args.standings).read_text(encoding="utf-8"))
        if Path(args.standings).exists()
        else None
    )
    meta = m.Meta.model_validate_json(Path(args.meta).read_text(encoding="utf-8"))
    bdf_ids = _bdfutbol_ids(Path(args.bdfutbol_teams))

    client = _client(Path(args.raw))
    teams_raw = s.FDTeams.model_validate(client.get(f"/competitions/{COMPETITION}/teams"))

    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich" / "h2h",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    heads: dict[int, m.HeadToHead | None] = {}
    attempts = blocked = 0
    try:
        for opponent in rivals_ctx.opponents(fixtures, meta.team.id):
            bdf_id = bdf_ids.get(opponent.id)
            if not bdf_id:
                print(f"AVISO: sin id de BDFutbol para {opponent.name}", file=sys.stderr)
                heads[opponent.id] = None
                continue
            attempts += 1
            try:
                heads[opponent.id] = rivals_ctx.fetch_head_to_head(http, bdf_id)
            except SourceBlocked as exc:
                blocked += 1
                print(f"AVISO: sin histórico para {opponent.name}: {exc}", file=sys.stderr)
                heads[opponent.id] = None
            except SourceError as exc:
                print(f"AVISO: sin histórico para {opponent.name}: {exc}", file=sys.stderr)
                heads[opponent.id] = None
    finally:
        http.close()

    now = _now()
    data = rivals_ctx.build_rivals(
        meta.season,
        meta.team.id,
        fixtures,
        standings,
        teams_raw.teams,
        bdf_ids,
        heads,
        now,
    )
    digest = t.content_hash({"rivals.json": t.dump(data)})
    with_history = sum(1 for rival in data.rivals if rival.head_to_head)
    previous = _keep_previous_rivals(out_dir, with_history)
    if previous and not args.force:
        outcome = _rivals_guard(
            with_history=with_history,
            previous=previous,
            blocked=blocked,
            attempts=attempts,
        )
        if outcome == "keep-blocked":
            print(
                f"::warning::BDFutbol bloqueó las {attempts} consultas (403/429); "
                "se conserva rivals.json.",
                file=sys.stderr,
            )
            return 0
        print(
            f"ERROR: rivals.json tendría 0/{len(data.rivals)} con histórico; "
            "se conserva la publicación anterior. Usa --force para sobrescribir.",
            file=sys.stderr,
        )
        return 2
    changed = write_optional(out_dir, "rivals.json", t.dump(data), m.Rivals, force=args.force)
    print(
        f"rivals={len(data.rivals)} con_historico={with_history} "
        f"changed={'true' if changed else 'false'} hash={digest}"
    )
    return 0


def cmd_snapshots(args: argparse.Namespace) -> int:
    """Congela una foto por partido terminado; nunca la reescribe sin `--force`."""
    fixtures = m.Fixtures.model_validate_json(Path(args.fixtures).read_text(encoding="utf-8"))
    out_dir = Path(args.out) / fixtures.season.replace("/", "-")
    created = skipped = 0
    for match in fixtures.matches:
        if match.status not in {"FINISHED", "AWARDED"}:
            continue
        if match.score.home is None or match.score.away is None:
            continue
        target = out_dir / f"{match.id}.json"
        if target.exists() and not args.force:
            skipped += 1
            continue
        snapshot = m.MatchSnapshot(
            match_id=match.id,
            season=fixtures.season,
            captured_at=_now(),
            status=match.status,
            utc_date=match.utc_date,
            matchday=match.matchday,
            stage=match.stage,
            home=match.home,
            away=match.away,
            score=match.score,
            depor_is_home=match.depor_is_home,
            venue=match.venue,
            referee=match.referee,
        )
        if write_optional(out_dir, target.name, t.dump(snapshot), m.MatchSnapshot, force=args.force):
            created += 1
    print(
        f"season={fixtures.season} created={created} skipped={skipped} "
        f"out={out_dir}"
    )
    return 0


def _detail_player(player: bdfutbol.LineupPlayer) -> m.MatchDetailPlayer:
    return m.MatchDetailPlayer(
        name=player.name,
        shirt_number=player.shirt_number,
        bdfutbol_id=int(player.bdfutbol_id) if player.bdfutbol_id else None,
    )


def _detail_lineup(lineup: bdfutbol.LineupData) -> m.MatchDetailLineup:
    return m.MatchDetailLineup(
        coach=lineup.coach,
        starters=[_detail_player(player) for player in lineup.starters],
        substitutes=[_detail_player(player) for player in lineup.substitutes],
    )


def _detail_score(data: bdfutbol.MatchDetailData) -> m.Score:
    winner = None
    if data.score_home is not None and data.score_away is not None:
        winner = (
            "HOME_TEAM"
            if data.score_home > data.score_away
            else "AWAY_TEAM"
            if data.score_away > data.score_home
            else "DRAW"
        )
    return m.Score(
        home=data.score_home,
        away=data.score_away,
        half_time_home=None,
        half_time_away=None,
        winner=winner,
    )


def _build_match_detail(
    match: m.Match, season: str, data: bdfutbol.MatchDetailData
) -> m.MatchDetail:
    return m.MatchDetail(
        match_id=match.id,
        season=season,
        source_url=data.url,
        bdfutbol_id=int(data.bdfutbol_id),
        captured_at=_now(),
        competition=data.competition,
        matchday=data.matchday,
        date=data.date or match.utc_date[:10],
        venue=data.venue,
        referee=data.referee,
        home=m.MatchDetailTeam(
            name=data.home_name,
            bdfutbol_id=int(data.home_bdf_id) if data.home_bdf_id else None,
        ),
        away=m.MatchDetailTeam(
            name=data.away_name,
            bdfutbol_id=int(data.away_bdf_id) if data.away_bdf_id else None,
        ),
        depor_is_home=match.depor_is_home,
        score=_detail_score(data),
        lineups=m.MatchDetailLineups(
            home=_detail_lineup(data.home_lineup),
            away=_detail_lineup(data.away_lineup),
        ),
        goals=[
            m.MatchDetailGoal(
                minute=goal.minute,
                minute_label=goal.minute_label,
                team=goal.team,  # type: ignore[arg-type]
                player=goal.player,
                own_goal=goal.own_goal,
                penalty=goal.penalty,
                score_after=(
                    m.MatchDetailScoreAfter(home=goal.score_home, away=goal.score_away)
                    if goal.score_home is not None and goal.score_away is not None
                    else None
                ),
            )
            for goal in data.goals
        ],
        cards=[
            m.MatchDetailCard(
                minute=card.minute,
                minute_label=card.minute_label,
                team=card.team,  # type: ignore[arg-type]
                player=card.player,
                kind=card.kind,  # type: ignore[arg-type]
            )
            for card in data.cards
        ],
        substitutions=[
            m.MatchDetailSubstitution(
                minute=sub.minute,
                minute_label=sub.minute_label,
                team=sub.team,  # type: ignore[arg-type]
                player_out=sub.player_out,
                player_in=sub.player_in,
            )
            for sub in data.substitutions
        ],
    )


def cmd_match_details(args: argparse.Namespace) -> int:
    """Publica alineaciones y eventos de los partidos terminados (ADR 0031)."""
    fixtures = m.Fixtures.model_validate_json(Path(args.fixtures).read_text(encoding="utf-8"))
    season = fixtures.season.replace("/", "-")
    out_dir = Path(args.out) / season
    pending: list[tuple[m.Match, Path]] = []
    skipped = 0
    for match in fixtures.matches:
        if match.status not in {"FINISHED", "AWARDED"}:
            continue
        target = out_dir / f"{match.id}.json"
        if target.exists() and not args.force:
            skipped += 1
            continue
        pending.append((match, target))

    if not pending:
        print(f"season={season} created=0 skipped={skipped} unresolved=0 out={out_dir}")
        return 0

    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich" / "match-details",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    created = unresolved = 0
    # PIPE-04: distinguir «no había partido pendiente» de «había partido y la
    # fuente falló». Lo segundo se anota en el run; con --strict, además, el
    # comando sale en rojo. El workflow usa continue-on-error para que el rojo
    # sea visible sin bloquear fixtures, snapshots, club ni la publicación.
    strict = bool(getattr(args, "strict", False))
    try:
        client = bdfutbol.BDFutbolClient(http)
        try:
            schedule = client.schedule(season)
        except SourceError as exc:
            print(
                f"::error::BDFutbol no devolvió el calendario {season}: {exc}",
                file=sys.stderr,
            )
            print(f"AVISO: no se pudo leer el calendario de BDFutbol: {exc}", file=sys.stderr)
            return 2 if strict else 0
        for match, target in pending:
            row = bdfutbol.find_schedule_match(
                schedule, match.home.name, match.away.name, match.utc_date[:10]
            )
            if row is None or row.bdf_id is None:
                unresolved += 1
                print(
                    f"::error::sin partido de BDFutbol para {match.id} "
                    f"({match.home.name} - {match.away.name}, {match.utc_date[:10]})",
                    file=sys.stderr,
                )
                continue
            try:
                data = client.match_detail(row.bdf_id)
            except SourceError as exc:
                unresolved += 1
                print(
                    f"::error::no se pudo leer el partido {row.bdf_id}: {exc}",
                    file=sys.stderr,
                )
                continue
            if not (
                data.home_lineup.starters
                or data.away_lineup.starters
                or data.goals
                or data.cards
                or data.substitutions
            ):
                unresolved += 1
                print(
                    f"::error::la ficha {row.bdf_id} no contiene alineaciones ni eventos; "
                    "no se publica un detalle vacío",
                    file=sys.stderr,
                )
                continue
            if (
                data.score_home is not None
                and data.score_away is not None
                and match.score.home is not None
                and match.score.away is not None
                and (data.score_home, data.score_away) != (match.score.home, match.score.away)
            ):
                unresolved += 1
                print(
                    f"::error::el marcador de BDFutbol ({data.score_home}-{data.score_away}) "
                    f"no coincide con el publicado ({match.score.home}-{match.score.away}) "
                    f"para {match.id}; no se publica detalle",
                    file=sys.stderr,
                )
                continue
            detail = _build_match_detail(match, fixtures.season, data)
            if write_optional(out_dir, target.name, t.dump(detail), m.MatchDetail, force=args.force):
                created += 1
    finally:
        http.close()

    print(
        f"season={season} created={created} skipped={skipped} "
        f"unresolved={unresolved} out={out_dir}"
    )
    # El detalle es opcional: no debe impedir que se publiquen fixtures, snapshots
    # o el club si BDFutbol no tiene todavía la ficha de un partido (ADR 0031).
    # Pero un fallo con partidos pendientes no puede quedar en verde silencioso
    # (PIPE-04): --strict devuelve 2 y el workflow lo muestra con continue-on-error.
    if unresolved and strict:
        return 2
    return 0


def cmd_smoke(args: argparse.Namespace) -> int:
    """Comprueba el contrato publicado en Pages o en un directorio local (D1-01)."""
    from . import smoke

    if args.data:
        payloads = smoke.load_local(Path(args.data))
        target = str(args.data)
    else:
        payloads = smoke.fetch_published(args.base_url, timeout=args.timeout)
        target = args.base_url
    failures = smoke.check_payloads(payloads)
    if failures:
        print(f"smoke falló contra {target}:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"smoke ok: {len(smoke.DOCUMENTS)} documentos válidos contra {target}")
    return 0


def cmd_probe(args: argparse.Namespace) -> int:
    """Informe de cobertura con TU token. No escribe datos públicos."""
    client = _client(Path(args.raw))
    print("== Competiciones accesibles con este token ==")
    comps = client.get("/competitions").get("competitions", [])
    print(", ".join(f"{c.get('code')}" for c in comps) or "(ninguna)")
    codes = {c.get("code") for c in comps}
    print(f"Copa del Rey (CDR) accesible: {'CDR' in codes}")

    comp = s.FDCompetition.model_validate(client.get(f"/competitions/{COMPETITION}"))
    cs = comp.currentSeason
    print(
        f"\n== {comp.name} ==\nTemporada actual: {cs.startDate if cs else None} -> {cs.endDate if cs else None}"
    )
    print(f"Jornada actual: {cs.currentMatchday if cs else None}")

    st = s.FDStandings.model_validate(client.get(f"/competitions/{COMPETITION}/standings"))
    table = st.standings[0].table if st.standings else []
    print(f"Filas de clasificación: {len(table)}")

    ms = s.FDMatches.model_validate(client.get(f"/competitions/{COMPETITION}/matches"))
    teams = s.FDTeams.model_validate(client.get(f"/competitions/{COMPETITION}/teams"))
    print(f"Partidos totales de la competición: {len(ms.matches)}; equipos: {len(teams.teams)}")
    print(
        f"Equipos con escudo (crest): {sum(1 for x in teams.teams if x.crest)}/{len(teams.teams)}"
    )
    print(
        f"Equipos con estadio (venue): {sum(1 for x in teams.teams if x.venue)}/{len(teams.teams)}"
    )
    print(f"Partidos con sede propia: {sum(1 for x in ms.matches if x.venue)}/{len(ms.matches)}")
    print(f"Partidos con árbitro: {sum(1 for x in ms.matches if x.referees)}/{len(ms.matches)}")
    try:
        team = t.find_team(teams.teams, _team_id())
    except LookupError as exc:
        print(f"NO se encontró el Depor: {exc}")
        print("Equipos:", ", ".join(f"{x.id}:{x.name}" for x in teams.teams))
        return 1
    print(f"\nDepor: id={team.id} nombre='{team.name}' tla={team.tla} estadio={team.venue}")
    full = team if team.squad else s.FDTeam.model_validate(client.get(f"/teams/{team.id}"))
    sq = full.squad
    print(f"Plantilla: {len(sq)} jugadores (entrenador: {full.coach.name if full.coach else None})")
    for label, getter in [
        ("position", lambda p: p.position),
        ("dateOfBirth", lambda p: p.dateOfBirth),
        ("nationality", lambda p: p.nationality),
        ("shirtNumber", lambda p: p.shirtNumber),
        ("contract", lambda p: p.contract),
    ]:
        print(f"  con {label}: {sum(1 for p in sq if getter(p) is not None)}/{len(sq)}")
    mine = [x for x in ms.matches if team.id in (x.homeTeam.id, x.awayTeam.id)]
    done = [x for x in mine if x.status == "FINISHED"]
    print(f"\nPartidos del Depor en la respuesta: {len(mine)} (terminados: {len(done)})")
    if mine:
        print(f"Primero: {min(x.utcDate for x in mine)}  Último: {max(x.utcDate for x in mine)}")
    print("\nCrudos guardados en", args.raw)
    return 0


def _load_model(path: Path, model: type) -> object | None:
    if not path.exists():
        return None
    return model.model_validate_json(path.read_text(encoding="utf-8"))


def _news_index(squad: m.Squad | None, coach_name: str | None, fixtures: m.Fixtures | None):
    opponents: list[str] = []
    for match in fixtures.matches if fixtures else []:
        opponents.extend([match.home.name, match.away.name])
    return build_index(squad, coach_name=coach_name, opponents=opponents)


def _coach_name(coach_path: Path, squad: m.Squad | None) -> str | None:
    if coach_path.exists():
        try:
            data = yaml.safe_load(coach_path.read_text(encoding="utf-8")) or {}
            name = (data.get("coach") or {}).get("name")
            if name:
                return str(name)
        except (OSError, yaml.YAMLError):
            pass
    return squad.coach.name if squad and squad.coach else None


def cmd_news_audit(args: argparse.Namespace) -> int:
    feeds = load_feeds(Path(args.feeds))
    squad = _load_model(Path(args.squad), m.Squad)
    fixtures = _load_model(Path(args.fixtures), m.Fixtures)
    coach_name = _coach_name(Path(args.coach), squad)
    index = _news_index(squad, coach_name, fixtures)
    http = NewsHttp(
        cache_dir=Path(args.raw) / "news",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    try:
        rows = news_audit.audit_feeds(feeds, http, include_disabled=args.all, index=index)
    finally:
        http.close()
    print(news_audit.format_table(rows))
    if args.write_docs:
        if news_audit.update_catalog(Path(args.feeds), feeds, rows):
            print(f"Catálogo actualizado: {args.feeds}")
        news_audit.update_docs(Path(args.docs), rows)
        print(f"Auditoría escrita en {args.docs}")
    errors = sum(1 for row in rows if row.status == "error")
    print(f"\nFeeds auditados: {len(rows)} · con error: {errors}")
    return 0


def cmd_news(args: argparse.Namespace) -> int:
    feeds = load_feeds(Path(args.feeds))
    squad = _load_model(Path(args.squad), m.Squad)
    fixtures = _load_model(Path(args.fixtures), m.Fixtures)
    coach_name = _coach_name(Path(args.coach), squad)
    out_dir = Path(args.out)
    existing = news_ingest.load_existing(out_dir / "news.json")
    http = NewsHttp(
        cache_dir=Path(args.raw) / "news",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    try:
        result = news_ingest.run_ingest(
            feeds=feeds,
            http=http,
            squad=squad,
            coach_name=coach_name,
            opponents=[
                name
                for match in (fixtures.matches if fixtures else [])
                for name in (match.home.name, match.away.name)
            ],
            existing=existing,
            now=datetime.now(UTC),
            threshold=args.threshold,
            dedupe_threshold=args.dedupe_threshold,
            force=args.force,
        )
    except news_ingest.AllFeedsFailed as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        _gh_output(changed="false", failed="true")
        return 1
    finally:
        http.close()

    if args.report:
        print(result.report.render())

    if not args.dry_run and len(result.news.stories) < args.min_stories:
        print(
            f"ERROR: solo {len(result.news.stories)} historias; mínimo requerido "
            f"{args.min_stories}. Se conserva news.json anterior.",
            file=sys.stderr,
        )
        _gh_output(changed="false", failed="true")
        return 1

    changed = False
    if not args.dry_run:
        changed = news_ingest.write_news(out_dir, result, force=args.force)
        if args.social:
            social_config = load_social(Path(args.social))
            social = build_social(
                social_config,
                datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            changed = write_social(out_dir, social, force=args.force) or changed
    print(
        f"changed={'true' if changed else 'false'} stories={len(result.news.stories)} "
        f"sources={len(result.news.sources)} errors={len(result.errors)}"
    )
    for error in result.errors:
        print(f"AVISO: {error}", file=sys.stderr)
    _gh_output(changed="true" if changed else "false", failed="false")
    return 0


def cmd_social(args: argparse.Namespace) -> int:
    config = load_social(Path(args.source))
    social = build_social(config, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
    changed = False
    if not args.dry_run:
        changed = write_social(Path(args.out), social, force=args.force)
    print(
        f"changed={'true' if changed else 'false'} profiles={len(social.profiles)} "
        f"pins={len(social.pins)} hash={social.data_hash}"
    )
    _gh_output(changed="true" if changed else "false")
    return 0


def cmd_club(args: argparse.Namespace) -> int:
    """Publica club.json desde el YAML curado y las letras de los himnos."""
    changed, club = club_data.publish_club(
        Path(args.config),
        Path(args.anthems),
        Path(args.out),
        manual_dir=Path(args.manual),
        force=args.force,
        titles_path=Path(args.titles),
        rivalries_path=Path(args.rivalries),
    )
    coverage = Path(args.coverage)
    coverage.parent.mkdir(parents=True, exist_ok=True)
    coverage.write_text(club_data.kits_coverage(club), encoding="utf-8")
    with_lyrics = sum(1 for anthem in club.anthems if anthem.lyrics)
    print(
        f"changed={'true' if changed else 'false'} anthems={len(club.anthems)} "
        f"lyrics={with_lyrics} crests={len(club.crests)} "
        f"seasons={len(club.kits)} updatedAt={club.updated_at}"
    )
    print(f"Cobertura de equipaciones: {coverage}")
    _gh_output(changed="true" if changed else "false")
    return 0


def cmd_club_images(args: argparse.Namespace) -> int:
    stats = club_data.download_images(
        Path(args.sources),
        Path(args.out),
        interval=args.interval,
        force=args.force,
        offline=args.offline,
    )
    size = club_data.images_size_mb(Path(args.out))
    print(
        f"images={stats['total']} written={stats['written']} unchanged={stats['unchanged']} "
        f"missing={stats['missing']} failed={stats['failed']} total={size:.2f}MB"
    )
    _gh_output(changed="true" if stats["written"] else "false", images_mb=f"{size:.2f}")
    return 0


def cmd_club_titles(args: argparse.Namespace) -> int:
    """Publica titles.json y escribe una propuesta desde BDFutbol (sin aplicarla)."""
    changed, titles = club_extra.publish_titles(
        Path(args.titles), Path(args.out), force=args.force
    )
    conflicts = only_in_source = only_in_curated = details_count = 0
    if not args.no_proposal:
        http = PoliteClient(
            cache_dir=Path(args.raw) / "enrich" / "titles",
            contact=contact_from_env(),
            interval=args.interval,
            offline=args.offline,
        )
        try:
            html = http.get(args.bdfutbol).text
            proposed = club_extra.parse_bdfutbol_titles(html, args.bdfutbol)
            details = None
            if args.details:
                details = club_extra.build_title_details(
                    titles,
                    http,
                    args.bdfutbol,
                    max_editions=args.max_editions,
                    wikipedia=not args.no_wikipedia,
                )
                details_count = len(details)
            proposal = club_extra.write_titles_proposal(
                Path(args.proposal), titles, proposed, args.bdfutbol, details=details
            )
            conflicts = len(proposal["conflicts"])
            only_in_source = len(proposal["only_in_source"])
            only_in_curated = len(proposal["only_in_curated"])
        except SourceError as exc:
            print(f"AVISO: no se pudo comparar con BDFutbol: {exc}", file=sys.stderr)
        finally:
            http.close()
    print(
        f"changed={'true' if changed else 'false'} editions={len(titles.editions)} "
        f"conflicts={conflicts} onlyInSource={only_in_source} "
        f"onlyInCurated={only_in_curated} details={details_count}"
    )
    _gh_output(changed="true" if changed else "false")
    return 0


def cmd_club_rivalries(args: argparse.Namespace) -> int:
    """Publica rivalries.json rellenando el balance histórico desde BDFutbol."""
    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich" / "club-rivalries",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    try:
        changed, rivalries = club_extra.publish_rivalries(
            Path(args.rivalries), Path(args.out), http, force=args.force
        )
    finally:
        http.close()
    with_history = sum(1 for item in rivalries.rivalries if item.head_to_head)
    print(
        f"changed={'true' if changed else 'false'} rivalries={len(rivalries.rivalries)} "
        f"withHistory={with_history}"
    )
    _gh_output(changed="true" if changed else "false")
    return 0


def cmd_club_probe_media(args: argparse.Namespace) -> int:
    """Sondea todos los medios del club sin tocar los YAML ni los JSON."""
    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich" / "club-media",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    try:
        result = club_extra.probe_club_media(
            club_path=Path(args.club),
            http=http,
            titles_path=Path(args.titles),
            rivalries_path=Path(args.rivalries),
            club_images_path=Path(args.club_images),
            manual_media_path=Path(args.sources),
            public_root=Path(args.out),
        )
    finally:
        http.close()
    club_extra.write_media_proposal(Path(args.proposal), result)
    if not args.no_docs:
        club_extra.write_media_report(Path(args.docs), result)
    counts = result["counts"]
    print(
        f"media={len(result['items'])} ok={counts.get('ok', 0)} "
        f"local={counts.get('local', 0)} broken={counts.get('broken', 0)} "
        f"blocked={counts.get('blocked', 0)} missing={counts.get('missing', 0)} "
        f"proposal={args.proposal}"
    )
    _gh_output(changed="true" if counts.get("ok") or counts.get("local") else "false")
    return 0


def cmd_schemas(args: argparse.Namespace) -> int:
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    models = {
        **m.FILES,
        **m.NEWS_FILES,
        **m.EXTRA_FILES,
        **m.STATUS_FILES,
        **m.SNAPSHOT_FILES,
        **m.MATCH_DETAIL_FILES,
    }
    for name, model in models.items():
        schema = model.model_json_schema(by_alias=True)
        target = out / name.replace(".json", ".schema.json")
        target.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("Esquemas escritos en", out)
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    directory = Path(args.data)
    models = {**m.FILES, **m.NEWS_FILES, **m.EXTRA_FILES}
    missing = [
        name
        for name in models
        if name not in m.OPTIONAL_FILES and not (directory / name).is_file()
    ]
    if missing:
        raise SystemExit(f"Faltan JSON públicos requeridos: {', '.join(missing)}")
    validated = 0
    for name, model in models.items():
        target = directory / name
        if not target.is_file():
            continue  # opcional ausente: la app lo trata como 404
        model.model_validate_json(target.read_text(encoding="utf-8"))
        validated += 1
    print(f"Validación Pydantic correcta: {validated} JSON en {directory}")
    extras = 0
    for folder, model in (
        ("snapshots", m.MatchSnapshot),
        ("match-details", m.MatchDetail),
    ):
        for target in sorted((directory / folder).glob("*/*.json")):
            model.model_validate_json(target.read_text(encoding="utf-8"))
            extras += 1
    if extras:
        print(f"Además, {extras} snapshots/detalles de partido válidos")
    return 0


# Orden e importancia de los ficheros que resume status.json. Los opcionales
# pueden faltar sin marcar el pipeline como roto (la app ya tolera su 404).
_STATUS_DATA_FILES: tuple[tuple[str, bool], ...] = (
    ("meta.json", True),
    ("standings.json", True),
    ("fixtures.json", True),
    ("squad.json", True),
    ("season.json", True),
    ("club.json", False),
    ("news.json", False),
    ("rivals.json", False),
    ("social.json", False),
    ("titles.json", False),
    ("rivalries.json", False),
)

_STATUS_WORKFLOWS: tuple[tuple[str, str, int | None], ...] = (
    ("Data refresh", "data-refresh.yml", 36),
    ("News refresh", "news-refresh.yml", 6),
    ("Rivals refresh", "rivals-refresh.yml", 24 * 8),
    ("Health", "health.yml", 30),
    # CI solo corre con pushes: su ausencia no implica un pipeline roto.
    ("CI", "ci.yml", None),
)

_STATUS_BAD_CONCLUSIONS = frozenset(
    {"failure", "timed_out", "action_required", "startup_failure"}
)


def _age_minutes(value: object, now: datetime) -> int | None:
    if not isinstance(value, str):
        return None
    try:
        captured = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if captured.tzinfo is None:
        captured = captured.replace(tzinfo=UTC)
    return max(0, int((now - captured).total_seconds() // 60))


def _status_file(path: Path, name: str, required: bool, now: datetime) -> m.StatusFile:
    if not path.is_file():
        return m.StatusFile(
            name=name,
            present=False,
            detail="no publicado" if not required else "falta un fichero requerido",
        )
    try:
        body = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return m.StatusFile(name=name, present=True, detail="JSON ilegible")
    if not isinstance(body, dict):
        return m.StatusFile(name=name, present=True, detail="JSON inesperado")
    detail = None
    updated_at = body.get("updatedAt")
    if not isinstance(updated_at, str):
        detail = "sin updatedAt"
        updated_at = None
    elif _age_minutes(updated_at, now) is None:
        detail = "updatedAt inválido"
        updated_at = None
    if name == "news.json":
        stories = body.get("stories")
        sources = body.get("sources")
        if isinstance(stories, list) and isinstance(sources, list):
            detail = f"{len(stories)} historias · {len(sources)} fuentes"
    if name == "fixtures.json":
        matches = body.get("matches")
        if isinstance(matches, list):
            detail = f"{len(matches)} partidos"
    if name == "rivals.json":
        rivals = body.get("rivals")
        if isinstance(rivals, list):
            with_history = sum(
                1 for rival in rivals if isinstance(rival, dict) and rival.get("headToHead")
            )
            detail = f"{len(rivals)} rivales · {with_history} con histórico"
    if name == "titles.json":
        editions = body.get("editions")
        if isinstance(editions, list):
            detail = f"{len(editions)} ediciones"
    if name == "rivalries.json":
        rivalries = body.get("rivalries")
        if isinstance(rivalries, list):
            with_history = sum(
                1
                for rivalry in rivalries
                if isinstance(rivalry, dict) and rivalry.get("headToHead")
            )
            detail = f"{len(rivalries)} rivalidades · {with_history} con histórico"
    return m.StatusFile(
        name=name,
        present=True,
        updated_at=updated_at,
        age_minutes=_age_minutes(updated_at, now),
        detail=detail,
    )


def _age_hours(value: object, now: datetime) -> float | None:
    if not isinstance(value, str):
        return None
    try:
        captured = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if captured.tzinfo is None:
        captured = captured.replace(tzinfo=UTC)
    return max(0.0, (now - captured).total_seconds() / 3600)


def _status_workflows(
    runs: list[dict[str, object]], now: datetime
) -> list[m.StatusWorkflow]:
    """Última pasada y último éxito de cada workflow, con su propia ventana.

    Se calcula sobre los runs que haya para ese workflow; no sobre una ventana
    global de 50 runs donde Rivals (semanal) desaparece (PIPE-05).
    """
    out: list[m.StatusWorkflow] = []
    for name, filename, expected_hours in _STATUS_WORKFLOWS:
        candidates = [
            run
            for run in runs
            if str(run.get("path", "")).endswith(f"/{filename}")
            and run.get("conclusion") is not None
        ]
        if not candidates:
            continue
        latest = max(candidates, key=lambda run: str(run.get("updated_at", "")), default=None)
        successes = [run for run in candidates if run.get("conclusion") == "success"]
        last_success = max(
            successes, key=lambda run: str(run.get("updated_at", "")), default=None
        )
        last_success_at = (
            str(last_success["updated_at"])
            if last_success and last_success.get("updated_at")
            else None
        )
        stale = None
        if expected_hours is not None:
            age = _age_hours(last_success_at, now)
            stale = age is None or age > expected_hours
        out.append(
            m.StatusWorkflow(
                name=name,
                file=filename,
                conclusion=str(latest["conclusion"]) if latest else None,
                updated_at=str(latest["updated_at"]) if latest and latest.get("updated_at") else None,
                last_success_at=last_success_at,
                expected_within_hours=expected_hours,
                stale=stale,
                url=str(latest["html_url"]) if latest and latest.get("html_url") else None,
            )
        )
    return out


def _workflow_ok(workflow: m.StatusWorkflow) -> bool:
    """Un workflow cuenta para `ok` salvo Health, que se evalúa por frescura.

    Health falla a propósito cuando publica `ok=false` (PIPE-12). Si su propio
    run contara como rojo, el siguiente Health volvería a verlo y no se saldría
    del bucle ni después de arreglar los datos. Su antigüedad sí delata que ha
    dejado de ejecutarse con éxito.
    """
    if workflow.file == "health.yml":
        return not workflow.stale
    return workflow.conclusion not in _STATUS_BAD_CONCLUSIONS and not workflow.stale


def cmd_status(args: argparse.Namespace) -> int:
    """Resume el estado publicado y la última pasada de cada workflow (ADR 0027)."""
    now = datetime.now(UTC)
    if getattr(args, "now", None):
        now = datetime.fromisoformat(str(args.now).replace("Z", "+00:00"))
        if now.tzinfo is None:
            now = now.replace(tzinfo=UTC)
    data_dir = Path(args.data)
    files = [
        _status_file(data_dir / name, name, required, now)
        for name, required in _STATUS_DATA_FILES
    ]
    runs: list[dict[str, object]] = []
    if getattr(args, "runs_dir", None):
        for path in sorted(Path(args.runs_dir).glob("*.json")):
            raw = json.loads(path.read_text(encoding="utf-8"))
            value = raw.get("workflow_runs") if isinstance(raw, dict) else raw
            if isinstance(value, list):
                runs.extend(run for run in value if isinstance(run, dict))
    elif args.runs:
        raw = json.loads(Path(args.runs).read_text(encoding="utf-8"))
        value = raw.get("workflow_runs") if isinstance(raw, dict) else raw
        if isinstance(value, list):
            runs = [run for run in value if isinstance(run, dict)]
    workflows = _status_workflows(runs, now) if runs else []

    # Un fichero opcional ausente no rompe la app; los requeridos sí.
    required_missing = any(
        not file.present
        and name
        not in {
            "club.json",
            "news.json",
            "rivals.json",
            "social.json",
            "titles.json",
            "rivalries.json",
        }
        for file, (name, _) in zip(files, _STATUS_DATA_FILES, strict=True)
    )
    workflows_ok = not workflows or all(_workflow_ok(workflow) for workflow in workflows)
    status = m.Status(
        updated_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        commit=args.commit or None,
        ok=not required_missing and workflows_ok,
        files=files,
        workflows=workflows,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = out.with_name(f".{out.name}.tmp")
    temp.write_text(
        json.dumps(t.dump(status), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    m.Status.model_validate_json(temp.read_text(encoding="utf-8"))
    os.replace(temp, out)
    print(
        f"status ok={'true' if status.ok else 'false'} "
        f"files={len(files)} workflows={len(workflows)} out={out}"
    )
    return 0 if status.ok or args.soft else 1



CSV_FIELDS = [
    "id",
    "name",
    "shirt_number",
    "contract_until",
    "height_cm",
    "weight_kg",
    "birth_place",
    "preferred_foot",
    "loan_from",
    "market_value_eur",
    "source",
    "confidence",
    "captured_at",
]


def _write_template(path: Path, squad: m.Squad) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for player in squad.players:
            writer.writerow(
                {
                    "id": player.id,
                    "name": player.name,
                    "shirt_number": player.shirt_number or "",
                    "contract_until": player.contract_until or "",
                    "height_cm": player.height_cm or "",
                    "weight_kg": player.weight_kg or "",
                    "birth_place": player.birth_place or "",
                    "preferred_foot": player.preferred_foot or "",
                    "loan_from": player.loan_from or "",
                    "market_value_eur": player.market_value_eur or "",
                    "source": "",
                    "confidence": "single_source",
                    "captured_at": "",
                }
            )
    print(f"Plantilla CSV escrita en {path} ({len(squad.players)} jugadores)")


def _clean_csv_row(row: dict[str, str]) -> dict[str, object]:
    out: dict[str, object] = {}
    for key in (
        "shirt_number",
        "height_cm",
        "weight_kg",
        "market_value_eur",
    ):
        value = (row.get(key) or "").strip()
        if value:
            out[key] = int(value)
    for key in ("contract_until", "birth_place", "preferred_foot", "loan_from"):
        value = (row.get(key) or "").strip()
        if value:
            out[key] = value
    for key in ("source", "confidence", "captured_at"):
        value = (row.get(key) or "").strip()
        if value:
            out[key] = value
    return out


def _import_csv(path: Path, extras_path: Path, squad: m.Squad) -> int:
    ids = {p.id for p in squad.players}
    manual = proposal.load_manual(extras_path)
    imported = 0
    with path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            raw_id = (row.get("id") or "").strip()
            if not raw_id:
                continue
            pid = int(raw_id)
            if pid not in ids:
                print(
                    f"AVISO: el CSV menciona el id {pid}, que no está en la plantilla",
                    file=sys.stderr,
                )
                continue
            data = _clean_csv_row(row)
            if not data:
                continue
            # Valida con el mismo contrato que el YAML manual (source obligatoria si hay datos).
            PlayerExtra.model_validate(data)
            manual[pid] = data
            imported += 1
    proposal.write_extras(extras_path, manual)
    print(f"Importados {imported} jugadores desde {path} en {extras_path}")
    return 0


def _apply_to_public(
    squad_path: Path, extras_path: Path, out_dir: Path, coach_path: Path | None = None
) -> bool:
    squad = m.Squad.model_validate_json(squad_path.read_text(encoding="utf-8"))
    extras = load_extras(extras_path)
    updated = apply_extras(reset_enriched(squad), extras)
    if coach_path is not None:
        updated = apply_coach(reset_coach(updated), load_coach(coach_path))
    files: dict[str, dict] = {}
    for name in m.SPORTS_FILES:
        candidate = out_dir / name
        if candidate.exists():
            files[name] = json.loads(candidate.read_text(encoding="utf-8"))
    files["squad.json"] = t.dump(updated)
    files["squad.json"]["updatedAt"] = _now()
    if "meta.json" not in files:
        print("AVISO: no hay meta.json; no se puede recalcular dataHash", file=sys.stderr)
        return False
    digest = t.content_hash(files)
    files["meta.json"]["dataHash"] = digest
    changed = write_if_changed(out_dir, files, digest)
    print(f"changed={'true' if changed else 'false'} hash={digest}")
    return changed


def cmd_enrich(args: argparse.Namespace) -> int:
    squad_path = Path(args.squad)
    squad = m.Squad.model_validate_json(squad_path.read_text(encoding="utf-8"))

    if args.export_template:
        _write_template(Path(args.export_template), squad)
        return 0
    if args.import_csv:
        return _import_csv(Path(args.import_csv), Path(args.extras), squad)

    if args.dry_run and args.apply:
        raise SystemExit("--dry-run y --apply son incompatibles")

    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    crest_resolver: crests.CrestResolver | None = None
    try:
        bdf = None if args.no_bdfutbol else bdfutbol.BDFutbolClient(http)
        wd = None if args.no_wikidata else wikidata.WikidataClient(http)
        if not args.no_crests:
            crest_resolver = crests.CrestResolver(
                http=http,
                wikidata=wd,
                fixtures_path=Path(args.fixtures),
                overrides_path=Path(args.club_crests),
                cache_path=Path(args.raw) / "enrich" / "crests.json",
                use_wikidata=not args.no_wikidata,
            )
        wiki_players: list[wikipedia.WikiPlayer] = []
        wiki_client: wikipedia.WikipediaClient | None = None
        if not args.no_wikipedia:
            wiki_client = wikipedia.WikipediaClient(http)
            try:
                wiki_players, _ = wiki_client.squad()
            except SourceError as exc:
                print(f"AVISO Wikipedia: {exc}", file=sys.stderr)
        official_profiles: list[official.OfficialProfile] = []
        if not args.no_official:
            team_urls = () if args.no_fabril else (official.FABRIL_URL,)
            try:
                official_profiles, _ = official.OfficialClient(http).profiles(
                    team_url=args.official_team, team_urls=team_urls
                )
            except SourceError as exc:
                print(f"AVISO web oficial: {exc}", file=sys.stderr)
        official_players: list[official.OfficialPlayer] = []
        if args.official_url:
            try:
                official_players, _ = official.OfficialClient(http, args.official_url).squad()
            except SourceError as exc:
                print(f"AVISO web oficial (dorsales): {exc}", file=sys.stderr)
        result = proposal.build_proposals(
            squad,
            bdf,
            wd,
            wiki_players,
            official_profiles,
            official_players,
            limit=args.limit,
            log=print,
            wiki_client=wiki_client,
            with_photos=not args.no_photos,
            crest_resolver=crest_resolver,
        )
    finally:
        if crest_resolver is not None:
            crest_resolver.save()
        http.close()

    data = proposal.proposal_data(result, args.min_confidence)
    coverage = data["coverage"]
    print(
        f"\nJugadores: {coverage['players']} · con datos: {coverage['withData']} · "
        f"conflictos: {coverage['conflicts']} · errores: {coverage['withErrors']}"
    )
    for field, count in coverage["fields"].items():
        print(f"  {field}: {count}/{coverage['players']}")
    crest_coverage = coverage.get("crests") or {}
    for label, key in (("carrera", "career"), ("partidos", "matches")):
        values = crest_coverage.get(key) or {}
        print(f"  escudos {label}: {values.get('resolved', 0)}/{values.get('total', 0)}")

    if args.dry_run:
        return 0

    proposal.write_proposal(Path(args.proposal), data)
    print(f"Informe: {args.proposal}")

    if args.apply:
        generated = result.generated_extras(args.min_confidence)
        overrides_path = Path(args.overrides)
        manual = proposal.load_manual(overrides_path) if overrides_path.exists() else {}
        if manual:
            print(f"Overrides manuales: {overrides_path} ({len(manual)} jugadores)")
        merged = proposal.merge_extras(manual, generated)
        proposal.write_extras(Path(args.extras), merged)
        print(f"Datos aplicados: {args.extras} ({len(generated)} jugadores)")
        _apply_to_public(squad_path, Path(args.extras), Path(args.out), Path(args.coach))
    return 0


def cmd_coach(args: argparse.Namespace) -> int:
    """Descarga/actualiza la ficha del entrenador y el cuerpo técnico (ADR 0014)."""
    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    try:
        data = coach_enrich.fetch_coach(
            http,
            qid=args.qid,
            wiki_lang=args.wiki_lang,
            wiki_title=args.wiki_title,
            official_team_url=args.official_team,
            official_profile_url=args.official_profile,
        )
        if not args.no_crests:
            resolver = crests.CrestResolver(
                http=http,
                fixtures_path=Path(args.fixtures),
                overrides_path=Path(args.club_crests),
                cache_path=Path(args.raw) / "enrich" / "crests.json",
            )
            try:
                for entry in data.get("career") or []:
                    entry["crest_url"] = resolver.resolve(entry["club"])
            finally:
                resolver.save()
    finally:
        http.close()

    captured = datetime.now(UTC).strftime("%Y-%m-%d")
    provenance = {
        "birthDate": {
            "source": f"Wikidata {args.qid} + Wikipedia ({args.wiki_lang})",
            "confidence": "cross_checked",
            "captured_at": captured,
        },
        "birthPlace": {
            "source": f"Wikidata {args.qid} + Wikipedia ({args.wiki_lang})",
            "confidence": "cross_checked",
            "captured_at": captured,
        },
        "photoUrl": {
            "source": "Web oficial del RC Deportivo",
            "confidence": "verified",
            "captured_at": captured,
        },
        "career": {
            "source": f"Wikipedia ({args.wiki_lang})",
            "confidence": "single_source",
            "captured_at": captured,
        },
        "staff": {
            "source": "Web oficial del RC Deportivo",
            "confidence": "verified",
            "captured_at": captured,
        },
    }
    payload = {"coach": {**data, "provenance": provenance}}
    text = yaml.safe_dump(payload, allow_unicode=True, sort_keys=False)
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    changed = not target.exists() or target.read_text(encoding="utf-8") != text
    if changed:
        target.write_text(text, encoding="utf-8")
    print(
        f"Entrenador: {data.get('name')} · carrera: {len(data.get('career') or [])} · "
        f"staff: {len(data.get('staff') or [])} · changed={'true' if changed else 'false'}"
    )
    print(f"Ficha escrita en {target}")
    if args.apply:
        _apply_to_public(Path(args.squad), Path(args.extras), Path(args.out_dir), target)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="depor_hub")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("ingest", cmd_ingest), ("probe", cmd_probe)):
        sp = sub.add_parser(name)
        sp.add_argument("--raw", default="data/raw")
        if name == "ingest":
            sp.add_argument("--out", default="data/public/v1")
            sp.add_argument("--extras", default="data/manual/squad_extras.yml")
            sp.add_argument("--overrides", default="data/manual/squad_overrides.yml")
            sp.add_argument("--coach", default="data/manual/coach.yml")
            sp.add_argument("--force", action="store_true")
            sp.add_argument(
                "--if-due",
                action="store_true",
                help="Refresca solo si toca según la ventana de partido y el último refresco",
            )
            sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
            sp.add_argument("--state", default="data/raw/ingest_state.json")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser(
        "matchday-plan",
        help="Decide si el supervisor debe refrescar cada 10 min en un día de partido",
    )
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--now", default=None, help="Instante ISO para pruebas deterministas")
    sp.set_defaults(fn=cmd_matchday_plan)
    sp = sub.add_parser("schemas")
    sp.add_argument("--out", default="packages/schemas")
    sp.set_defaults(fn=cmd_schemas)
    sp = sub.add_parser("validate", help="Valida todos los JSON públicos con Pydantic")
    sp.add_argument("--data", default="data/public/v1")
    sp.set_defaults(fn=cmd_validate)
    sp = sub.add_parser("smoke", help="Comprueba el contrato publicado (D1-01)")
    sp.add_argument(
        "--base-url",
        default="https://angelvilarino.github.io/depor-hub",
        help="Base pública; se añade /v1/<documento>",
    )
    sp.add_argument(
        "--data",
        default=None,
        help="Directorio local; si se indica, no se hace ninguna petición",
    )
    sp.add_argument("--timeout", type=float, default=20.0)
    sp.set_defaults(fn=cmd_smoke)
    sp = sub.add_parser("status", help="Genera status.json para la rama status (ADR 0027)")
    sp.add_argument("--data", default="data/public/v1")
    sp.add_argument("--runs", default=None, help="JSON de /actions/runs con workflow_runs")
    sp.add_argument(
        "--runs-dir",
        default=None,
        help="Directorio con un JSON de runs por workflow (ventana propia, PIPE-05)",
    )
    sp.add_argument("--out", default="status.json")
    sp.add_argument("--now", default=None, help="Instante ISO para pruebas deterministas")
    sp.add_argument("--commit", default=os.environ.get("GITHUB_SHA", ""))
    sp.add_argument(
        "--soft",
        action="store_true",
        help="Sale con 0 aunque el estado sea rojo (lo usa health.yml para publicarlo)",
    )
    sp.set_defaults(fn=cmd_status)
    sp = sub.add_parser("snapshots", help="Congela un snapshot por partido terminado (ADR 0028)")
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--out", default="data/public/v1/snapshots")
    sp.add_argument("--force", action="store_true", help="Reescribe snapshots existentes")
    sp.set_defaults(fn=cmd_snapshots)
    sp = sub.add_parser(
        "match-details",
        help="Publica alineaciones y eventos de los partidos terminados (ADR 0031)",
    )
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--out", default="data/public/v1/match-details")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument("--interval", type=float, default=1.0)
    sp.add_argument("--offline", action="store_true")
    sp.add_argument("--force", action="store_true", help="Reescribe detalles existentes")
    sp.add_argument(
        "--strict",
        action="store_true",
        help="Sale 2 si había partidos pendientes y BDFutbol falló o no emparejó (PIPE-04)",
    )
    sp.set_defaults(fn=cmd_match_details)
    sp = sub.add_parser("rivals", help="Publica el histórico y el contexto de los 19 rivales")
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--standings", default="data/public/v1/standings.json")
    sp.add_argument("--meta", default="data/public/v1/meta.json")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument("--bdfutbol-teams", default="data/manual/bdfutbol_teams.yml")
    sp.add_argument("--interval", type=float, default=1.0)
    sp.add_argument("--offline", action="store_true")
    sp.add_argument("--force", action="store_true")
    sp.set_defaults(fn=cmd_rivals)
    sp = sub.add_parser("enrich", help="Propone o aplica datos de BDFutbol/Wikidata/Wikipedia")
    sp.add_argument("--squad", default="data/public/v1/squad.json")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--extras", default="data/manual/squad_extras.yml")
    sp.add_argument("--coach", default="data/manual/coach.yml")
    sp.add_argument("--overrides", default="data/manual/squad_overrides.yml")
    sp.add_argument("--proposal", default="data/manual/squad_enrich.proposed.yml")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument(
        "--min-confidence", choices=list(proposal.CONFIDENCE_ORDER), default="single_source"
    )
    sp.add_argument("--dry-run", action="store_true")
    sp.add_argument("--apply", action="store_true")
    sp.add_argument("--limit", type=int, default=None)
    sp.add_argument("--interval", type=float, default=1.0)
    sp.add_argument("--offline", action="store_true")
    sp.add_argument("--official-url", default=None)
    sp.add_argument("--official-team", default=official.TEAM_URL)
    sp.add_argument("--no-official", action="store_true")
    sp.add_argument("--no-fabril", action="store_true")
    sp.add_argument("--no-bdfutbol", action="store_true")
    sp.add_argument("--no-wikidata", action="store_true")
    sp.add_argument("--no-wikipedia", action="store_true")
    sp.add_argument("--no-photos", action="store_true")
    sp.add_argument("--no-crests", action="store_true")
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--club-crests", default="data/manual/club_crests.yml")
    sp.add_argument("--export-template", default=None)
    sp.add_argument("--import-csv", default=None)
    sp.set_defaults(fn=cmd_enrich)
    sp = sub.add_parser("coach", help="Actualiza la ficha del entrenador y el cuerpo técnico")
    sp.add_argument("--out", default="data/manual/coach.yml")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument("--offline", action="store_true")
    sp.add_argument("--interval", type=float, default=1.0)
    sp.add_argument("--qid", default=coach_enrich.WIKIDATA_QID)
    sp.add_argument("--wiki-lang", default=coach_enrich.WIKI_LANG)
    sp.add_argument("--wiki-title", default=coach_enrich.WIKI_TITLE)
    sp.add_argument("--official-team", default=official.TEAM_URL)
    sp.add_argument(
        "--official-profile",
        default="https://www.rcdeportivo.es/es/jugadores/depor/antonio-hidalgo",
    )
    sp.add_argument("--no-crests", action="store_true")
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--club-crests", default="data/manual/club_crests.yml")
    sp.add_argument("--apply", action="store_true")
    sp.add_argument("--squad", default="data/public/v1/squad.json")
    sp.add_argument("--extras", default="data/manual/squad_extras.yml")
    sp.add_argument("--out-dir", default="data/public/v1")
    sp.set_defaults(fn=cmd_coach)

    sp = sub.add_parser("news", help="Ingiere feeds y publica news.json (ADR 0018)")
    sp.add_argument("--feeds", default="data/manual/news_feeds.yml")
    sp.add_argument("--squad", default="data/public/v1/squad.json")
    sp.add_argument("--coach", default="data/manual/coach.yml")
    sp.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument("--interval", type=float, default=1.0)
    sp.add_argument("--threshold", type=int, default=None, help="Umbral de relevancia")
    sp.add_argument("--dedupe-threshold", type=float, default=0.52)
    sp.add_argument("--min-stories", type=int, default=5)
    sp.add_argument("--social", default="data/manual/social_pins.yml")
    sp.add_argument("--offline", action="store_true", help="Usa solo la caché local")
    sp.add_argument("--force", action="store_true")
    sp.add_argument("--dry-run", action="store_true")
    sp.add_argument("--report", action="store_true", help="Imprime el informe de calibración")
    sp.set_defaults(fn=cmd_news)
    nsub = sp.add_subparsers(dest="news_cmd")
    audit = nsub.add_parser("audit", help="Prueba los feeds y actualiza docs/sources.md")
    audit.add_argument("--feeds", default="data/manual/news_feeds.yml")
    audit.add_argument("--squad", default="data/public/v1/squad.json")
    audit.add_argument("--coach", default="data/manual/coach.yml")
    audit.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    audit.add_argument("--raw", default="data/raw")
    audit.add_argument("--docs", default="docs/sources.md")
    audit.add_argument("--interval", type=float, default=1.0)
    audit.add_argument("--offline", action="store_true")
    audit.add_argument("--all", action="store_true", help="Incluye feeds deshabilitados")
    audit.add_argument("--write-docs", action="store_true")
    audit.set_defaults(fn=cmd_news_audit)

    news_ing = nsub.add_parser("ingest", help="Alias de `news` (compatibilidad)")
    news_ing.add_argument("--feeds", default="data/manual/news_feeds.yml")
    news_ing.add_argument("--squad", default="data/public/v1/squad.json")
    news_ing.add_argument("--coach", default="data/manual/coach.yml")
    news_ing.add_argument("--fixtures", default="data/public/v1/fixtures.json")
    news_ing.add_argument("--out", default="data/public/v1")
    news_ing.add_argument("--raw", default="data/raw")
    news_ing.add_argument("--interval", type=float, default=1.0)
    news_ing.add_argument("--threshold", type=int, default=None)
    news_ing.add_argument("--dedupe-threshold", type=float, default=0.52)
    news_ing.add_argument("--min-stories", type=int, default=5)
    news_ing.add_argument("--social", default="data/manual/social_pins.yml")
    news_ing.add_argument("--offline", action="store_true")
    news_ing.add_argument("--force", action="store_true")
    news_ing.add_argument("--dry-run", action="store_true")
    news_ing.add_argument("--report", action="store_true")
    news_ing.set_defaults(fn=cmd_news)

    sp = sub.add_parser("social", help="Publica los perfiles y pins curados de redes")
    sp.add_argument("--source", default="data/manual/social_pins.yml")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--force", action="store_true")
    sp.add_argument("--dry-run", action="store_true")
    sp.set_defaults(fn=cmd_social)

    sp = sub.add_parser("club", help="Publica la ficha completa del club (ADR 0025)")
    sp.add_argument("--config", default="data/manual/club.yml")
    sp.add_argument("--anthems", default="data/manual/himnos")
    sp.add_argument("--manual", default="data/manual")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--coverage", default="docs/kits_coverage.md")
    sp.add_argument(
        "--titles",
        default="data/public/v1/titles.json",
        help="Documento canónico para el resumen de títulos de club.json (D1-09)",
    )
    sp.add_argument(
        "--rivalries",
        default="data/public/v1/rivalries.json",
        help="Documento canónico para el resumen de rivalidades de club.json (D1-09)",
    )
    sp.add_argument("--force", action="store_true")
    sp.set_defaults(fn=cmd_club)
    club_sub = sp.add_subparsers(dest="club_command")

    titles = club_sub.add_parser("titles", help="Publica titles.json y propone desde BDFutbol")
    titles.add_argument("--titles", default="data/manual/titles.yml")
    titles.add_argument("--out", default="data/public/v1")
    titles.add_argument("--proposal", default="data/manual/titles.proposed.yml")
    titles.add_argument("--bdfutbol", default="https://www.bdfutbol.com/es/e/e13.html")
    titles.add_argument("--raw", default="data/raw")
    titles.add_argument("--interval", type=float, default=1.0)
    titles.add_argument("--force", action="store_true")
    titles.add_argument("--offline", action="store_true")
    titles.add_argument("--no-proposal", action="store_true")
    titles.add_argument(
        "--details",
        action="store_true",
        help="Enriquece finales, goleadores y plantillas (más peticiones)",
    )
    titles.add_argument(
        "--max-editions",
        type=int,
        default=0,
        help="Limita las ediciones enriquecidas con --details (0 = todas)",
    )
    titles.add_argument(
        "--no-wikipedia",
        action="store_true",
        help="No contrasta la final con Wikipedia",
    )
    titles.set_defaults(fn=cmd_club_titles)

    rivalries = club_sub.add_parser(
        "rivalries", help="Publica rivalries.json con el balance de BDFutbol"
    )
    rivalries.add_argument("--rivalries", default="data/manual/rivalries.yml")
    rivalries.add_argument("--out", default="data/public/v1")
    rivalries.add_argument("--raw", default="data/raw")
    rivalries.add_argument("--interval", type=float, default=1.0)
    rivalries.add_argument("--force", action="store_true")
    rivalries.add_argument("--offline", action="store_true")
    rivalries.set_defaults(fn=cmd_club_rivalries)

    probe_media = club_sub.add_parser(
        "probe-media",
        help="Sondea todos los medios del club y registra los fallos en docs/sources.md",
    )
    probe_media.add_argument("--club", default="data/manual/club.yml")
    probe_media.add_argument("--titles", default="data/manual/titles.yml")
    probe_media.add_argument("--rivalries", default="data/manual/rivalries.yml")
    probe_media.add_argument("--club-images", default="data/manual/club_images.yml")
    probe_media.add_argument("--sources", default="data/manual/club_media.yml")
    probe_media.add_argument("--out", default="data/public/v1")
    probe_media.add_argument(
        "--proposal", default="data/manual/club_media.proposed.yml"
    )
    probe_media.add_argument("--docs", default="docs/sources.md")
    probe_media.add_argument("--no-docs", action="store_true")
    probe_media.add_argument("--raw", default="data/raw")
    probe_media.add_argument("--interval", type=float, default=1.0)
    probe_media.add_argument("--offline", action="store_true")
    probe_media.set_defaults(fn=cmd_club_probe_media)

    sp = sub.add_parser("club-images", help="Descarga y normaliza las imágenes del club")
    sp.add_argument("--sources", default="data/manual/club_images.yml")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--interval", type=float, default=0.6)
    sp.add_argument("--force", action="store_true")
    sp.add_argument("--offline", action="store_true")
    sp.set_defaults(fn=cmd_club_images)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
