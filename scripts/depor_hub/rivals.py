"""Rivales del Depor: histórico completo en BDFutbol, entrenador y goleadores.

- BDFutbol (`/es/p/vs.php?e1=13&e2=<id>`) da el balance histórico y los últimos cruces.
- football-data.org da el entrenador y los goleadores de la temporada publicada.
- Si una fuente falla, el bloque queda en `null`/`[]`: nunca se rellena a mano.
"""

from __future__ import annotations

import re
from typing import Iterable

from . import models as m
from . import source_models as s
from .enrich.bdfutbol import BASE as BDFUTBOL_BASE
from .enrich.htmlutil import normalize_space, strip_tags
from .enrich.http import PoliteClient, SourceError

DEPOR_BDF_ID = "13"
DONE_STATUSES = {"FINISHED", "AWARDED"}

_TOTALS = {
    "played": re.compile(r"id='valorpj'>\s*(\d+)"),
    "won": re.compile(r"id='valorpg'>\s*(\d+)"),
    "lost": re.compile(r"id='valorpp'>\s*(\d+)"),
    "drawn": re.compile(r"id='valorpe'>\s*(\d+)"),
    "goals_for": re.compile(r"id='valorgf'>\s*(\d+)"),
    "goals_against": re.compile(r"id='valorgc'>\s*(\d+)"),
}
_ROW = re.compile(
    r"<tr[^>]*data-codi1=\"(\d+)\" data-codi2=\"(\d+)\"[^>]*>(.*?)</tr>", re.S
)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_GOALS = re.compile(r"resultat-gols[^>]*>\s*(\d+)")
_DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")


def head_to_head_url(rival_bdf_id: str | int, depor_bdf_id: str = DEPOR_BDF_ID) -> str:
    return f"{BDFUTBOL_BASE}/es/p/vs.php?e1={depor_bdf_id}&e2={rival_bdf_id}"


def parse_head_to_head(
    html: str,
    source_url: str,
    depor_bdf_id: str = DEPOR_BDF_ID,
    limit: int = 5,
) -> m.HeadToHead:
    totals: dict[str, int] = {}
    for name, pattern in _TOTALS.items():
        found = pattern.search(html)
        if not found:
            raise SourceError("BDFutbol no publicó el balance histórico")
        totals[name] = int(found.group(1))

    meetings: list[m.HeadToHeadMeeting] = []
    for home_id, _away_id, body in _ROW.findall(html):
        cells = _TD.findall(body)
        if len(cells) < 8:
            continue
        date_match = _DATE.search(normalize_space(strip_tags(cells[0])))
        goals = _GOALS.findall(cells[5])
        if not date_match or len(goals) != 2:
            continue
        day, month, year = date_match.groups()
        home_goals, away_goals = int(goals[0]), int(goals[1])
        depor_home = home_id == depor_bdf_id
        mine = home_goals if depor_home else away_goals
        theirs = away_goals if depor_home else home_goals
        meetings.append(
            m.HeadToHeadMeeting(
                date=f"{year}-{month}-{day}",
                competition=normalize_space(strip_tags(cells[1])),
                round_=normalize_space(strip_tags(cells[2])) or None,
                home=normalize_space(strip_tags(cells[3])),
                away=normalize_space(strip_tags(cells[7])),
                home_goals=home_goals,
                away_goals=away_goals,
                depor_result="W" if mine > theirs else "L" if mine < theirs else "D",
            )
        )
        if len(meetings) >= limit:
            break

    return m.HeadToHead(
        source_url=source_url,
        played=totals["played"],
        won=totals["won"],
        drawn=totals["drawn"],
        lost=totals["lost"],
        goals_for=totals["goals_for"],
        goals_against=totals["goals_against"],
        meetings=meetings,
    )


def fetch_head_to_head(
    http: PoliteClient, rival_bdf_id: str | int, depor_bdf_id: str = DEPOR_BDF_ID
) -> m.HeadToHead:
    url = head_to_head_url(rival_bdf_id, depor_bdf_id)
    return parse_head_to_head(http.get(url).text, url, depor_bdf_id)


def opponents(fixtures: m.Fixtures, team_id: int) -> list[m.TeamRef]:
    seen: dict[int, m.TeamRef] = {}
    for match in fixtures.matches:
        other = match.away if match.depor_is_home else match.home
        if other.id != team_id:
            seen.setdefault(other.id, other)
    return list(seen.values())


def _key_players(scorers: Iterable[s.FDScorer], team_id: int, limit: int = 3) -> list[m.KeyPlayer]:
    rows = [
        row
        for row in scorers
        if row.team.id == team_id and row.goals is not None and row.goals > 0
    ]
    rows.sort(key=lambda row: (-(row.goals or 0), row.player.name))
    return [
        m.KeyPlayer(
            id=row.player.id,
            name=row.player.name,
            goals=row.goals or 0,
            assists=row.assists,
            played_matches=row.playedMatches,
        )
        for row in rows[:limit]
    ]


def build_rivals(
    season: str,
    team_id: int,
    fixtures: m.Fixtures,
    standings: m.Standings | None,
    teams: Iterable[s.FDTeam],
    scorers: Iterable[s.FDScorer],
    bdf_ids: dict[int, str],
    heads: dict[int, m.HeadToHead | None],
    updated_at: str,
) -> m.Rivals:
    by_id = {team.id: team for team in teams}
    position = {
        row.team.id: row.position for row in standings.table
    } if standings else {}
    rivals: list[m.Rival] = []
    for team_ref in opponents(fixtures, team_id):
        team = by_id.get(team_ref.id)
        rivals.append(
            m.Rival(
                team=team_ref,
                bdfutbol_id=bdf_ids.get(team_ref.id),
                coach=team.coach.name if team and team.coach else None,
                key_players=_key_players(scorers, team_ref.id),
                head_to_head=heads.get(team_ref.id),
            )
        )
    rivals.sort(key=lambda r: (position.get(r.team.id, 99), r.team.name))
    return m.Rivals(updated_at=updated_at, season=season, rivals=rivals)
