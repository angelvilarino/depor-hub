import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from depor_hub import models as m
from depor_hub.cadence import (
    in_match_window,
    is_due,
    load_fixtures,
    read_last_refresh,
    write_last_refresh,
)
from depor_hub.cli import main

NOW = datetime(2026, 11, 2, 19, 30, tzinfo=UTC)  # 30 min antes del Depor-Osasuna


def team(id_: int, name: str) -> m.TeamRef:
    return m.TeamRef(id=id_, name=name, short_name=name, tla=None)


def match(
    id_: int,
    utc: str,
    status: str = "TIMED",
    home: m.TeamRef | None = None,
    away: m.TeamRef | None = None,
) -> m.Match:
    return m.Match(
        id=id_,
        utc_date=utc,
        status=status,
        matchday=11,
        stage="REGULAR_SEASON",
        home=home or team(560, "Deportivo"),
        away=away or team(79, "Osasuna"),
        score=m.Score(),
        depor_is_home=True,
        venue="Estadio Abanca-Riazor",
        referee=None,
    )


def fixtures(*matches: m.Match) -> m.Fixtures:
    return m.Fixtures(updated_at="2026-11-02T19:00:00Z", season="2026-27", matches=list(matches))


def test_in_window_is_true_around_kickoff():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    assert in_match_window(f, NOW)
    assert in_match_window(f, datetime(2026, 11, 2, 22, 30, tzinfo=UTC))  # +150 min


def test_outside_window_is_false():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    assert not in_match_window(f, datetime(2026, 11, 2, 18, 0, tzinfo=UTC))  # -2 h
    assert not in_match_window(f, datetime(2026, 11, 2, 22, 31, tzinfo=UTC))  # +151 min


def test_scheduled_match_without_confirmed_kickoff_does_not_open_window():
    f = fixtures(match(1, "2026-11-02T20:00:00Z", status="SCHEDULED"))
    assert not in_match_window(f, datetime(2026, 11, 2, 18, 0, tzinfo=UTC))
    assert not in_match_window(f, datetime(2026, 11, 2, 20, 0, tzinfo=UTC))


def test_due_in_window_every_ten_minutes():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    assert is_due(f, NOW, NOW - timedelta(minutes=10))
    assert not is_due(f, NOW, NOW - timedelta(minutes=9))


def test_due_outside_window_every_sixty_minutes():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    outside = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    assert is_due(f, outside, outside - timedelta(minutes=60))
    assert not is_due(f, outside, outside - timedelta(minutes=59))


def test_no_fixtures_or_no_state_is_due():
    assert is_due(None, NOW, NOW)
    assert is_due(fixtures(), NOW, None)


def test_empty_fixtures_uses_outside_interval():
    assert is_due(fixtures(), NOW, NOW - timedelta(minutes=60))
    assert not is_due(fixtures(), NOW, NOW - timedelta(minutes=30))


def test_paused_match_is_still_in_window():
    f = fixtures(match(1, "2026-11-02T20:00:00Z", status="PAUSED"))
    assert in_match_window(f, NOW)


def test_state_roundtrip(tmp_path: Path):
    state = tmp_path / "state.json"
    assert read_last_refresh(state) is None
    write_last_refresh(state, NOW)
    assert read_last_refresh(state) == NOW
    assert json.loads(state.read_text(encoding="utf-8"))["lastRefreshAt"] == "2026-11-02T19:30:00Z"


def test_load_fixtures_invalid_is_none(tmp_path: Path):
    path = tmp_path / "fixtures.json"
    assert load_fixtures(path) is None
    path.write_text("{}", encoding="utf-8")
    assert load_fixtures(path) is None


def test_cli_if_due_skips_without_network(tmp_path: Path, capsys):
    fixtures_path = tmp_path / "fixtures.json"
    fixtures_path.write_text(
        fixtures(match(1, "2030-01-01T20:00:00Z")).model_dump_json(by_alias=True),
        encoding="utf-8",
    )
    state = tmp_path / "state.json"
    write_last_refresh(state, datetime.now(UTC))

    code = main(
        [
            "ingest",
            "--if-due",
            "--fixtures",
            str(fixtures_path),
            "--state",
            str(state),
            "--raw",
            str(tmp_path / "raw"),
        ]
    )

    assert code == 0
    assert "changed=false due=false" in capsys.readouterr().out
