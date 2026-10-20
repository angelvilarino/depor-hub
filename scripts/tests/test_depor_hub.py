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


def test_hash_ignores_timestamps_but_not_content():
    base = {"a.json": {"updatedAt": "x", "v": 1}, "meta.json": {"dataHash": "h", "updatedAt": "x"}}
    other = {"a.json": {"updatedAt": "y", "v": 1}, "meta.json": {"dataHash": "z", "updatedAt": "y"}}
    changed = {"a.json": {"updatedAt": "x", "v": 2}, "meta.json": {"dataHash": "h", "updatedAt": "x"}}
    assert t.content_hash(base) == t.content_hash(other)
    assert t.content_hash(base) != t.content_hash(changed)


@pytest.mark.parametrize("name", list(m.FILES))
def test_examples_validate(name):
    m.FILES[name].model_validate_json((EXAMPLES / name).read_text(encoding="utf-8"))


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
