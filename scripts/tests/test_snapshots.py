from __future__ import annotations

import argparse
import json

from depor_hub import cli
from depor_hub import models as m
from depor_hub import transform as t

NOW = "2026-11-04T10:00:00Z"
TEAM_A = {"id": 560, "name": "Deportivo", "shortName": "Depor", "tla": "DEP", "crestUrl": None}
TEAM_B = {"id": 78, "name": "Atleti", "shortName": "Atleti", "tla": "ATL", "crestUrl": None}


def match(id_, status, score):
    return m.Match(
        id=id_,
        utc_date="2026-11-02T20:00:00Z",
        status=status,
        matchday=11,
        stage="REGULAR_SEASON",
        home=m.TeamRef(**TEAM_A),
        away=m.TeamRef(**TEAM_B),
        score=m.Score(home=score[0], away=score[1], winner="HOME_TEAM" if score[0] else None),
        depor_is_home=True,
        venue="Riazor",
        referee=None,
    )


def write_fixtures(path, matches):
    body = m.Fixtures(updated_at=NOW, season="2026-27", matches=matches)
    path.write_text(json.dumps(t.dump(body), ensure_ascii=False), encoding="utf-8")


def run(tmp_path, force=False):
    args = argparse.Namespace(
        fixtures=str(tmp_path / "fixtures.json"),
        out=str(tmp_path / "snapshots"),
        force=force,
    )
    assert cli.cmd_snapshots(args) == 0


def test_snapshots_only_freeze_finished_matches_with_score(tmp_path):
    write_fixtures(
        tmp_path / "fixtures.json",
        [
            match(1, "FINISHED", (2, 1)),
            match(2, "TIMED", (None, None)),
            match(3, "FINISHED", (None, None)),
        ],
    )

    run(tmp_path)

    files = sorted(path.name for path in (tmp_path / "snapshots" / "2026-27").iterdir())
    assert files == ["1.json"]
    snapshot = m.MatchSnapshot.model_validate_json(
        (tmp_path / "snapshots" / "2026-27" / "1.json").read_text(encoding="utf-8")
    )
    assert snapshot.match_id == 1
    assert snapshot.score.home == 2
    assert snapshot.status == "FINISHED"


def test_snapshots_are_frozen_unless_forced(tmp_path):
    write_fixtures(tmp_path / "fixtures.json", [match(1, "FINISHED", (2, 1))])
    run(tmp_path)

    write_fixtures(tmp_path / "fixtures.json", [match(1, "FINISHED", (0, 3))])
    run(tmp_path)
    path = tmp_path / "snapshots" / "2026-27" / "1.json"
    assert m.MatchSnapshot.model_validate_json(path.read_text(encoding="utf-8")).score.home == 2

    run(tmp_path, force=True)
    assert m.MatchSnapshot.model_validate_json(path.read_text(encoding="utf-8")).score.home == 0
