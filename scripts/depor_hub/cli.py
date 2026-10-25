"""CLI: `python -m depor_hub.cli {ingest|probe|schemas}`."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from . import models as m
from . import source_models as s
from . import transform as t
from .client import Client
from .enrich import bdfutbol, official, proposal, wikidata, wikipedia
from .enrich.http import PoliteClient, SourceError, contact_from_env
from .extras import PlayerExtra, apply_extras, load_extras, reset_enriched, unknown_ids
from .publish import write_if_changed

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


def cmd_ingest(args: argparse.Namespace) -> int:
    client = _client(Path(args.raw))
    comp = s.FDCompetition.model_validate(client.get(f"/competitions/{COMPETITION}"))
    if not comp.currentSeason:
        raise SystemExit("La API no informa de temporada actual")
    season = t.season_label(datetime.fromisoformat(comp.currentSeason.startDate).date())
    standings_raw = s.FDStandings.model_validate(client.get(f"/competitions/{COMPETITION}/standings"))
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
    for pid in unknown_ids(squad, extras):
        print(f"AVISO: {args.extras} menciona el id {pid}, que no está en la plantilla", file=sys.stderr)
    meta = t.build_meta(comp, team, season, now)

    if len(standings.table) != 20:
        print(f"AVISO: la clasificación tiene {len(standings.table)} filas (se esperaban 20)", file=sys.stderr)
    if not squad.players:
        print("AVISO: plantilla vacía; se publica con players=[]", file=sys.stderr)

    files = {
        "standings.json": t.dump(standings),
        "fixtures.json": t.dump(fixtures),
        "squad.json": t.dump(squad),
        "meta.json": t.dump(meta),
    }
    digest = t.content_hash(files)
    files["meta.json"]["dataHash"] = digest

    changed = write_if_changed(Path(args.out), files, digest, force=args.force)
    print(f"changed={'true' if changed else 'false'} hash={digest}")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"changed={'true' if changed else 'false'}\n")
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
    print(f"\n== {comp.name} ==\nTemporada actual: {cs.startDate if cs else None} -> {cs.endDate if cs else None}")
    print(f"Jornada actual: {cs.currentMatchday if cs else None}")

    st = s.FDStandings.model_validate(client.get(f"/competitions/{COMPETITION}/standings"))
    table = st.standings[0].table if st.standings else []
    print(f"Filas de clasificación: {len(table)}")

    ms = s.FDMatches.model_validate(client.get(f"/competitions/{COMPETITION}/matches"))
    teams = s.FDTeams.model_validate(client.get(f"/competitions/{COMPETITION}/teams"))
    print(f"Partidos totales de la competición: {len(ms.matches)}; equipos: {len(teams.teams)}")
    print(f"Equipos con escudo (crest): {sum(1 for x in teams.teams if x.crest)}/{len(teams.teams)}")
    print(f"Equipos con estadio (venue): {sum(1 for x in teams.teams if x.venue)}/{len(teams.teams)}")
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


def cmd_schemas(args: argparse.Namespace) -> int:
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name, model in m.FILES.items():
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
            writer.writerow({
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
            })
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
                print(f"AVISO: el CSV menciona el id {pid}, que no está en la plantilla", file=sys.stderr)
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


def _apply_to_public(squad_path: Path, extras_path: Path, out_dir: Path) -> bool:
    squad = m.Squad.model_validate_json(squad_path.read_text(encoding="utf-8"))
    extras = load_extras(extras_path)
    updated = apply_extras(reset_enriched(squad), extras)
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
    try:
        bdf = None if args.no_bdfutbol else bdfutbol.BDFutbolClient(http)
        wd = None if args.no_wikidata else wikidata.WikidataClient(http)
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
        )
    finally:
        http.close()

    data = proposal.proposal_data(result, args.min_confidence)
    coverage = data["coverage"]
    print(
        f"\nJugadores: {coverage['players']} · con datos: {coverage['withData']} · "
        f"conflictos: {coverage['conflicts']} · errores: {coverage['withErrors']}"
    )
    for field, count in coverage["fields"].items():
        print(f"  {field}: {count}/{coverage['players']}")

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
        _apply_to_public(squad_path, Path(args.extras), Path(args.out))
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
            sp.add_argument("--force", action="store_true")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser("schemas")
    sp.add_argument("--out", default="packages/schemas")
    sp.set_defaults(fn=cmd_schemas)
    sp = sub.add_parser("enrich", help="Propone o aplica datos de BDFutbol/Wikidata/Wikipedia")
    sp.add_argument("--squad", default="data/public/v1/squad.json")
    sp.add_argument("--out", default="data/public/v1")
    sp.add_argument("--extras", default="data/manual/squad_extras.yml")
    sp.add_argument("--overrides", default="data/manual/squad_overrides.yml")
    sp.add_argument("--proposal", default="data/manual/squad_enrich.proposed.yml")
    sp.add_argument("--raw", default="data/raw")
    sp.add_argument("--min-confidence", choices=list(proposal.CONFIDENCE_ORDER), default="single_source")
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
    sp.add_argument("--export-template", default=None)
    sp.add_argument("--import-csv", default=None)
    sp.set_defaults(fn=cmd_enrich)
    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
