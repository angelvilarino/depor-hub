"""De la respuesta cruda a los modelos públicos. Sin red: pura y testeable."""

from __future__ import annotations

import hashlib
import json
import unicodedata
from datetime import date
from typing import Any

from . import models as m
from . import source_models as s

SOURCE = m.Source(
    name="football-data.org",
    url="https://www.football-data.org",
    note="Datos de terceros; consulta sus términos. Proyecto de aficionados no oficial.",
)


def season_label(start: date) -> str:
    return f"{start.year}-{(start.year + 1) % 100:02d}"


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def find_team(teams: list[s.FDTeam], team_id: int | None = None) -> s.FDTeam:
    if team_id is not None:
        for t in teams:
            if t.id == team_id:
                return t
        raise LookupError(f"No hay ningún equipo con id {team_id} en la competición")
    found = {
        t.id: t
        for t in teams
        if t.tla == "DEP" or ("deportivo" in _norm(t.name) and "coru" in _norm(t.name))
    }
    if len(found) != 1:
        raise LookupError(
            f"Se esperaba 1 candidato para el Depor y hay {len(found)}. "
            "Fija DEPOR_TEAM_ID en el entorno."
        )
    return next(iter(found.values()))


def _ref(t: s.FDTeamRef) -> m.TeamRef:
    return m.TeamRef(
        id=t.id, name=t.name, short_name=t.shortName, tla=t.tla, crest_url=t.crest or None
    )


def build_standings(
    raw: s.FDStandings, season: str, matchday: int | None, updated_at: str
) -> m.Standings:
    groups = [g for g in raw.standings if g.type in (None, "TOTAL")] or raw.standings
    if not groups or not groups[0].table:
        raise ValueError("Clasificación vacía")
    rows = [
        m.StandingRow(
            position=r.position,
            team=_ref(r.team),
            played=r.playedGames,
            won=r.won,
            draw=r.draw,
            lost=r.lost,
            points=r.points,
            goals_for=r.goalsFor,
            goals_against=r.goalsAgainst,
            goal_difference=r.goalDifference,
            form=r.form,
        )
        for r in groups[0].table
    ]
    return m.Standings(updated_at=updated_at, season=season, matchday=matchday, table=rows)


def _referee(refs: list[s.FDReferee]) -> str | None:
    """Árbitro principal si la API lo informa; si no, None (nunca se inventa)."""
    named = [r for r in refs if r.name]
    main = [r for r in named if (r.type or "").upper() == "REFEREE"]
    chosen = main or named
    return chosen[0].name if chosen else None


def build_fixtures(
    raw: s.FDMatches,
    team_id: int,
    season: str,
    updated_at: str,
    venues: dict[int, str | None] | None = None,
) -> m.Fixtures:
    """`venues`: id de equipo -> estadio. Si el partido no trae sede, se usa la del local."""
    venues = venues or {}
    mine = [x for x in raw.matches if team_id in (x.homeTeam.id, x.awayTeam.id)]
    if not mine:
        raise ValueError("No hay partidos del equipo en la respuesta")
    mine.sort(key=lambda x: x.utcDate)
    out = [
        m.Match(
            id=x.id,
            utc_date=x.utcDate,
            status=x.status,
            matchday=x.matchday,
            stage=x.stage,
            home=_ref(x.homeTeam),
            away=_ref(x.awayTeam),
            score=m.Score(
                home=x.score.fullTime.home,
                away=x.score.fullTime.away,
                half_time_home=x.score.halfTime.home,
                half_time_away=x.score.halfTime.away,
                winner=x.score.winner,
            ),
            depor_is_home=x.homeTeam.id == team_id,
            venue=x.venue or venues.get(x.homeTeam.id) or None,
            referee=_referee(x.referees),
        )
        for x in mine
    ]
    return m.Fixtures(updated_at=updated_at, season=season, matches=out)


def _contract_until(p: s.FDPerson) -> str | None:
    if not p.contract:
        return None
    until = p.contract.get("until")
    return str(until) if until else None


def build_squad(team: s.FDTeam, updated_at: str) -> m.Squad:
    coach = None
    if team.coach and (team.coach.name or team.coach.nationality):
        coach = m.Coach(name=team.coach.name, nationality=team.coach.nationality)
    players = [
        m.Player(
            id=p.id,
            name=p.name,
            position=p.position,
            date_of_birth=p.dateOfBirth,
            nationality=p.nationality,
            shirt_number=p.shirtNumber,
            contract_until=_contract_until(p),
        )
        for p in team.squad
    ]
    return m.Squad(updated_at=updated_at, coach=coach, players=players)


def build_meta(
    comp: s.FDCompetition, team: s.FDTeam, season: str, updated_at: str
) -> m.Meta:
    return m.Meta(
        schema_version=m.SCHEMA_VERSION,
        season=season,
        competition_code=comp.code,
        competition_name=comp.name,
        team=m.TeamInfo(
            id=team.id,
            name=team.name,
            short_name=team.shortName,
            tla=team.tla,
            crest_url=team.crest or None,
            venue=team.venue,
        ),
        updated_at=updated_at,
        data_hash="",
        source=SOURCE,
    )


def dump(model: m.Public) -> dict[str, Any]:
    return model.model_dump(mode="json", by_alias=True)


def content_hash(files: dict[str, dict[str, Any]]) -> str:
    """Hash del contenido ignorando marcas de tiempo, para publicar solo si hay cambios reales."""
    ignored = {"updatedAt", "dataHash"}
    canon = {
        name: {k: v for k, v in body.items() if k not in ignored}
        for name, body in sorted(files.items())
    }
    blob = json.dumps(canon, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]
