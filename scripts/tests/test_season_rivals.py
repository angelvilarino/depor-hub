from __future__ import annotations

import pytest

from depor_hub import models as m
from depor_hub import rivals as r
from depor_hub import source_models as s
from depor_hub import transform as t
from depor_hub.enrich.http import SourceError

NOW = "2026-10-25T22:00:00Z"

TEAM_A = {"id": 1, "name": "Deportivo", "shortName": "Depor", "tla": "DEP", "crestUrl": None}
TEAM_B = {"id": 2, "name": "Rival", "shortName": "Rival", "tla": "RIV", "crestUrl": None}


def team_ref(team: dict) -> m.TeamRef:
    return m.TeamRef(**team)


def standing(position, team, points, gd=0, gf=0, played=10):
    return m.StandingRow(
        position=position,
        team=team_ref(team),
        played=played,
        won=2,
        draw=5,
        lost=3,
        points=points,
        goals_for=gf,
        goals_against=gf - gd,
        goal_difference=gd,
        form=None,
    )


def raw_match(id_, matchday, home, away, home_goals, away_goals, status="FINISHED"):
    return s.FDMatch.model_validate(
        {
            "id": id_,
            "utcDate": f"2026-08-{matchday + 10:02d}T19:00:00Z",
            "status": status,
            "matchday": matchday,
            "homeTeam": home,
            "awayTeam": away,
            "score": {
                "winner": None,
                "fullTime": {"home": home_goals, "away": away_goals},
                "halfTime": {},
            },
        }
    )


def test_parse_head_to_head_reads_totals_and_last_five():
    html = """
    <div id='valorpj'>80</div><div id='valorpg'>38</div><div id='valorpp'>28</div>
    <div id='valorpe'>14</div><div id='valorgf'>133</div><div id='valorgc'>105</div>
    <tr class="local" data-codi1="13" data-codi2="27">
      <td>16/12/2021</td><td>Copa del Rey</td><td>Ronda 2</td>
      <td>Deportivo de La Coruña</td><td></td>
      <td><div class='resultat-gols '>1</div><div class='resultat-gols'>2</div></td>
      <td></td><td>Osasuna</td>
    </tr>
    <tr data-codi1="27" data-codi2="13">
      <td>13/04/2019</td><td>Segunda División</td><td>Jornada 34</td>
      <td>Osasuna</td><td></td>
      <td><div class='resultat-gols '>2</div><div class='resultat-gols'>1</div></td>
      <td></td><td>Deportivo de La Coruña</td>
    </tr>
    """
    parsed = r.parse_head_to_head(html, "https://example.test/vs")
    assert (parsed.played, parsed.won, parsed.drawn, parsed.lost) == (80, 38, 14, 28)
    assert (parsed.goals_for, parsed.goals_against) == (133, 105)
    assert [meeting.depor_result for meeting in parsed.meetings] == ["L", "L"]
    assert parsed.meetings[0].date == "2021-12-16"
    assert parsed.meetings[0].round_ == "Ronda 2"


def test_parse_head_to_head_without_totals_raises():
    with pytest.raises(SourceError):
        r.parse_head_to_head("<html></html>", "https://example.test/vs")


def test_build_season_evolution_and_summary():
    raw = s.FDMatches.model_validate(
        {
            "matches": [
                raw_match(1, 1, TEAM_A, TEAM_B, 2, 0),
                raw_match(2, 2, TEAM_B, TEAM_A, 1, 1),
            ]
        }
    )
    fixtures = m.Fixtures(
        updated_at=NOW,
        season="2026-27",
        matches=[
            m.Match(
                id=1,
                utc_date="2026-08-11T19:00:00Z",
                status="FINISHED",
                matchday=1,
                stage="REGULAR_SEASON",
                home=team_ref(TEAM_A),
                away=team_ref(TEAM_B),
                score=m.Score(home=2, away=0),
                depor_is_home=True,
                venue=None,
                referee=None,
            ),
            m.Match(
                id=3,
                utc_date="2026-09-01T19:00:00Z",
                status="TIMED",
                matchday=3,
                stage="REGULAR_SEASON",
                home=team_ref(TEAM_A),
                away=team_ref(TEAM_B),
                score=m.Score(),
                depor_is_home=True,
                venue=None,
                referee=None,
            ),
        ],
    )
    standings = m.Standings(
        updated_at=NOW,
        season="2026-27",
        matchday=2,
        table=[
            standing(1, TEAM_B, 12, gd=4, gf=15),
            standing(2, TEAM_A, 11, gd=0, gf=13),
            standing(3, {**TEAM_B, "id": 3, "name": "Tercero"}, 11, gd=-2, gf=8),
        ],
    )
    season = t.build_season(raw, fixtures, standings, 1, "2026-27", NOW)
    assert season.summary.position == 2
    assert [p.matchday for p in season.position_evolution] == [1, 2]
    assert season.form[0].result == "W"
    assert season.summary.points == 11
    assert not hasattr(season, "what_is_at_stake")


def test_season_compatibility_strips_retired_field_but_stays_strict():
    legacy = {
        "updatedAt": NOW,
        "season": "2026-27",
        "team": TEAM_A,
        "summary": {
            "position": 2,
            "points": 11,
            "played": 10,
            "won": 2,
            "drawn": 5,
            "lost": 3,
            "goalsFor": 13,
            "goalsAgainst": 13,
            "goalDifference": 0,
        },
        "whatIsAtStake": {"position": 2, "points": 11, "scenarios": []},
    }
    season = m.Season.model_validate(legacy)
    assert "whatIsAtStake" not in season.model_dump(by_alias=True)
    with pytest.raises(ValueError):
        m.Season.model_validate({**legacy, "unexpected": True})


def test_build_rivals_uses_only_real_data():
    fixtures = m.Fixtures(
        updated_at=NOW,
        season="2026-27",
        matches=[
            m.Match(
                id=1,
                utc_date="2026-08-11T19:00:00Z",
                status="TIMED",
                matchday=1,
                stage="REGULAR_SEASON",
                home=team_ref(TEAM_A),
                away=team_ref(TEAM_B),
                score=m.Score(),
                depor_is_home=True,
                venue=None,
                referee=None,
            )
        ],
    )
    teams = [
        s.FDTeam.model_validate(
            {
                **TEAM_B,
                "coach": {"name": "Entrenador Real", "nationality": "Spain"},
                "squad": [],
            }
        )
    ]
    head = m.HeadToHead(
        source_url="https://www.bdfutbol.com/es/p/vs.php?e1=13&e2=27",
        played=80,
        won=38,
        drawn=14,
        lost=28,
        goals_for=133,
        goals_against=105,
        meetings=[],
    )
    data = r.build_rivals(
        "2026-27",
        1,
        fixtures,
        None,
        teams,
        {2: "27"},
        {2: head},
        NOW,
    )
    assert len(data.rivals) == 1
    rival = data.rivals[0]
    assert rival.coach == "Entrenador Real"
    assert rival.bdfutbol_id == "27"
    assert rival.key_players == []
    assert rival.head_to_head is head


def test_build_rivals_without_sources_keeps_nulls():
    fixtures = m.Fixtures(
        updated_at=NOW,
        season="2026-27",
        matches=[
            m.Match(
                id=1,
                utc_date="2026-08-11T19:00:00Z",
                status="TIMED",
                matchday=1,
                stage="REGULAR_SEASON",
                home=team_ref(TEAM_A),
                away=team_ref(TEAM_B),
                score=m.Score(),
                depor_is_home=True,
                venue=None,
                referee=None,
            )
        ],
    )
    data = r.build_rivals("2026-27", 1, fixtures, None, [], {}, {}, NOW)
    rival = data.rivals[0]
    assert rival.coach is None
    assert rival.key_players == []
    assert rival.head_to_head is None
    assert rival.bdfutbol_id is None
