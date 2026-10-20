"""CLI: `python -m depor_hub.cli {ingest|probe|schemas}`."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from . import models as m
from . import source_models as s
from . import transform as t
from .client import Client
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
    standings = t.build_standings(standings_raw, season, comp.currentSeason.currentMatchday, now)
    fixtures = t.build_fixtures(matches_raw, team.id, season, now)
    squad = t.build_squad(team, now)
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


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="depor_hub")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("ingest", cmd_ingest), ("probe", cmd_probe)):
        sp = sub.add_parser(name)
        sp.add_argument("--raw", default="data/raw")
        if name == "ingest":
            sp.add_argument("--out", default="data/public/v1")
            sp.add_argument("--force", action="store_true")
        sp.set_defaults(fn=fn)
    sp = sub.add_parser("schemas")
    sp.add_argument("--out", default="packages/schemas")
    sp.set_defaults(fn=cmd_schemas)
    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
