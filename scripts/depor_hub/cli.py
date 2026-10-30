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

from . import models as m
from . import rivals as rivals_ctx
from . import source_models as s
from . import transform as t
from .cadence import is_due, load_fixtures, read_last_refresh, write_last_refresh
from .client import Client
from .enrich import bdfutbol, crests, official, proposal, wikidata, wikipedia
from .enrich import coach as coach_enrich
from .enrich.http import PoliteClient, SourceError, contact_from_env
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
    squad = apply_extras(squad, extras)
    squad = apply_coach(squad, load_coach(Path(args.coach)))
    for pid in unknown_ids(squad, extras):
        print(
            f"AVISO: {args.extras} menciona el id {pid}, que no está en la plantilla",
            file=sys.stderr,
        )
    meta = t.build_meta(comp, team, season, now)

    if len(standings.table) != 20:
        print(
            f"AVISO: la clasificación tiene {len(standings.table)} filas (se esperaban 20)",
            file=sys.stderr,
        )
    if not squad.players:
        print("AVISO: plantilla vacía; se publica con players=[]", file=sys.stderr)

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


def _bdfutbol_ids(path: Path) -> dict[int, str]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    teams = raw.get("teams") or {}
    return {int(team_id): str(bdf_id) for team_id, bdf_id in teams.items()}


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
    scorers_raw = s.FDScorers.model_validate(
        client.get(f"/competitions/{COMPETITION}/scorers", params={"limit": 100})
    )

    http = PoliteClient(
        cache_dir=Path(args.raw) / "enrich" / "h2h",
        contact=contact_from_env(),
        interval=args.interval,
        offline=args.offline,
    )
    heads: dict[int, m.HeadToHead | None] = {}
    try:
        for opponent in rivals_ctx.opponents(fixtures, meta.team.id):
            bdf_id = bdf_ids.get(opponent.id)
            if not bdf_id:
                print(f"AVISO: sin id de BDFutbol para {opponent.name}", file=sys.stderr)
                heads[opponent.id] = None
                continue
            try:
                heads[opponent.id] = rivals_ctx.fetch_head_to_head(http, bdf_id)
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
        scorers_raw.scorers,
        bdf_ids,
        heads,
        now,
    )
    digest = t.content_hash({"rivals.json": t.dump(data)})
    changed = write_optional(out_dir, "rivals.json", t.dump(data), m.Rivals, force=args.force)
    with_history = sum(1 for rival in data.rivals if rival.head_to_head)
    print(
        f"rivals={len(data.rivals)} con_historico={with_history} "
        f"changed={'true' if changed else 'false'} hash={digest}"
    )
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


def cmd_schemas(args: argparse.Namespace) -> int:
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, model in {**m.FILES, **m.NEWS_FILES, **m.EXTRA_FILES}.items():
        schema = model.model_json_schema(by_alias=True)
        target = out / name.replace(".json", ".schema.json")
        target.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("Esquemas escritos en", out)
    return 0


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
    for name in m.FILES:
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
    sp = sub.add_parser("schemas")
    sp.add_argument("--out", default="packages/schemas")
    sp.set_defaults(fn=cmd_schemas)
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

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
