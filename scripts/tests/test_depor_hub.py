import json
from datetime import date
from pathlib import Path

import httpx
import pytest

from depor_hub import models as m
from depor_hub import source_models as s
from depor_hub import transform as t
from depor_hub.client import Client, FootballDataError
from depor_hub.publish import write_if_changed

EXAMPLES = Path(__file__).resolve().parents[2] / "packages" / "schemas" / "examples"
NOW = "2026-10-20T10:00:00Z"


def team(id_, name, tla=None):
    return {"id": id_, "name": name, "shortName": name, "tla": tla}


def raw_match(id_, utc, home, away, status="SCHEDULED", ft=(None, None)):
    return {
        "id": id_, "utcDate": utc, "status": status, "matchday": 1,
        "homeTeam": home, "awayTeam": away,
        "score": {"winner": None, "fullTime": {"home": ft[0], "away": ft[1]}, "halfTime": {}},
    }


def test_season_label():
    assert t.season_label(date(2026, 8, 1)) == "2026-27"
    assert t.season_label(date(1999, 8, 1)) == "1999-00"


def test_find_team_by_name_with_accents_and_tla():
    teams = [
        s.FDTeam.model_validate(team(1, "Deportivo Alavés", "ALA")),
        s.FDTeam.model_validate(team(2, "RC Deportivo de La Coruña")),
    ]
    assert t.find_team(teams).id == 2
    assert t.find_team(teams, 1).id == 1
    with pytest.raises(LookupError):
        t.find_team(teams[:1])


def test_fixtures_filter_sort_and_home_flag():
    a, b, c = team(1, "A"), team(2, "B"), team(3, "C")
    raw = s.FDMatches.model_validate({"matches": [
        raw_match(2, "2026-09-01T18:00:00Z", b, a),
        raw_match(1, "2026-08-16T18:00:00Z", a, b, "FINISHED", (2, 0)),
        raw_match(3, "2026-08-20T18:00:00Z", b, c),
    ]})
    out = t.build_fixtures(raw, 1, "2026-27", NOW)
    assert [x.id for x in out.matches] == [1, 2]
    assert out.matches[0].depor_is_home and not out.matches[1].depor_is_home
    assert out.matches[0].score.home == 2
    assert out.matches[1].score.home is None


def test_fixtures_crest_venue_and_referee():
    a = {**team(1, "A"), "crest": "https://c.example/a.svg"}
    b = team(2, "B")
    away = raw_match(1, "2026-08-16T18:00:00Z", b, a)  # el equipo 1 juega fuera
    away["referees"] = [{"id": 9, "name": "Árbitro Uno", "type": "ASSISTANT_REFEREE_N1"},
                        {"id": 8, "name": "Árbitro Dos", "type": "REFEREE"}]
    own_venue = raw_match(2, "2026-08-23T18:00:00Z", a, b)
    own_venue["venue"] = "Estadio Propio"
    nothing = raw_match(3, "2026-08-30T18:00:00Z", b, a)
    raw = s.FDMatches.model_validate({"matches": [away, own_venue, nothing]})

    out = t.build_fixtures(raw, 1, "2026-27", NOW, {2: "Campo de B", 3: "No se usa"})
    x1, x2, x3 = out.matches
    assert x1.venue == "Campo de B"  # sede del local
    assert x1.referee == "Árbitro Dos"  # prioriza tipo REFEREE
    assert x1.away.crest_url == "https://c.example/a.svg" and x1.home.crest_url is None
    assert x2.venue == "Estadio Propio"  # la del partido manda
    assert x2.referee is None  # sin dato: null, no se inventa
    assert x3.venue == "Campo de B"
    assert t.dump(out)["matches"][0]["away"]["crestUrl"] == "https://c.example/a.svg"


def test_hash_ignores_timestamps_but_not_content():
    base = {"a.json": {"updatedAt": "x", "v": 1}, "meta.json": {"dataHash": "h", "updatedAt": "x"}}
    other = {"a.json": {"updatedAt": "y", "v": 1}, "meta.json": {"dataHash": "z", "updatedAt": "y"}}
    changed = {"a.json": {"updatedAt": "x", "v": 2}, "meta.json": {"dataHash": "h", "updatedAt": "x"}}
    assert t.content_hash(base) == t.content_hash(other)
    assert t.content_hash(base) != t.content_hash(changed)


@pytest.mark.parametrize("name", list(m.FILES))
def test_examples_validate(name):
    m.FILES[name].model_validate_json((EXAMPLES / name).read_text(encoding="utf-8"))


def test_old_squad_json_without_crest_fields_validates_as_null():
    """Compatibilidad ADR 0012: un JSON anterior no trae crestUrl ni opponentCrestUrl."""
    old = {
        "updatedAt": NOW,
        "coach": None,
        "players": [
            {
                "id": 1,
                "name": "Jugador Antiguo",
                "position": "Midfield",
                "dateOfBirth": "2000-01-31",
                "nationality": "Spain",
                "shirtNumber": None,
                "contractUntil": None,
                "heightCm": None,
                "career": [
                    {
                        "club": "Club Antiguo",
                        "from": "2014",
                        "to": "2017",
                        "appearances": 10,
                        "goals": 1,
                        "assists": None,
                        "minutes": 900,
                        "yellowCards": 1,
                        "redCards": 0,
                        "seasons": [],
                    }
                ],
                "deporMatches": [
                    {
                        "date": "2026-05-24",
                        "opponent": "Valladolid",
                        "competition": "LaLiga",
                        "home": True,
                        "teamGoals": 2,
                        "opponentGoals": 0,
                        "result": "W",
                        "started": True,
                        "minutes": 90,
                        "goals": 0,
                        "assists": None,
                        "yellowCards": 0,
                        "redCards": 0,
                    }
                ],
            }
        ],
    }
    squad = m.Squad.model_validate(old)
    assert squad.players[0].career[0].crest_url is None
    assert squad.players[0].depor_matches[0].opponent_crest_url is None


def test_write_if_changed(tmp_path):
    files = {n: json.loads((EXAMPLES / n).read_text(encoding="utf-8")) for n in m.FILES}
    assert write_if_changed(tmp_path, files, "0000000000000000") is True
    assert write_if_changed(tmp_path, files, "0000000000000000") is False
    assert write_if_changed(tmp_path, files, "0000000000000000", force=True) is True


def make_client(handler, sleeps):
    return Client("tok", "test@example.com", transport=httpx.MockTransport(handler), sleep=sleeps.append)


def test_client_retries_on_429():
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "1"}, json={"message": "slow"})
        return httpx.Response(200, json={"ok": True})

    sleeps = []
    assert make_client(handler, sleeps).get("/x") == {"ok": True}
    assert 1.0 in sleeps
    assert calls[0].headers["X-Auth-Token"] == "tok"
    assert "contact: test@example.com" in calls[0].headers["User-Agent"]


def test_client_raises_on_403():
    client = make_client(lambda r: httpx.Response(403, json={"message": "plan"}), [])
    with pytest.raises(FootballDataError, match="403"):
        client.get("/competitions/PD")
