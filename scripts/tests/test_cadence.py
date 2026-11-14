import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from depor_hub import models as m
from depor_hub import transform as t
from depor_hub.cadence import (
    in_match_window,
    is_due,
    load_fixtures,
    plan_matchday,
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


def test_due_outside_window_every_55_minutes():
    # 55 y no 60: el cron horario puede dispararse a los 59 min de la pasada
    # anterior. El objetivo operativo sigue siendo «una vez por hora».
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    outside = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    assert is_due(f, outside, outside - timedelta(minutes=55))
    assert not is_due(f, outside, outside - timedelta(minutes=54))


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


def test_matchday_plan_opens_the_lead_window_and_ends_after_the_match():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))

    plan = plan_matchday(f, datetime(2026, 11, 2, 17, 0, tzinfo=UTC))

    assert plan.active is True
    assert plan.start == datetime(2026, 11, 2, 19, 30, tzinfo=UTC)
    assert plan.until == datetime(2026, 11, 2, 22, 30, tzinfo=UTC)


def test_matchday_plan_is_inactive_before_the_lead_and_after_the_window():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))

    assert plan_matchday(f, datetime(2026, 11, 2, 16, 59, tzinfo=UTC)).active is False
    assert plan_matchday(f, datetime(2026, 11, 2, 22, 31, tzinfo=UTC)).active is False


def test_matchday_plan_inside_the_window_starts_right_away():
    f = fixtures(match(1, "2026-11-02T20:00:00Z"))
    now = datetime(2026, 11, 2, 20, 15, tzinfo=UTC)

    plan = plan_matchday(f, now)

    assert plan.active is True
    assert plan.start == now
    assert plan.until == datetime(2026, 11, 2, 22, 30, tzinfo=UTC)


def test_matchday_plan_ignores_scheduled_matches_without_a_confirmed_kickoff():
    f = fixtures(match(1, "2026-11-02T20:00:00Z", status="SCHEDULED"))

    assert plan_matchday(f, NOW).active is False


def test_matchday_plan_cli_writes_github_outputs(tmp_path, monkeypatch):
    path = tmp_path / "fixtures.json"
    path.write_text(json.dumps(t.dump(fixtures(match(1, "2026-11-02T20:00:00Z")))), encoding="utf-8")
    output = tmp_path / "github-output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))

    code = main(
        [
            "matchday-plan",
            "--fixtures",
            str(path),
            "--now",
            "2026-11-02T17:00:00Z",
        ]
    )

    assert code == 0
    body = output.read_text(encoding="utf-8")
    assert "active=true" in body
    assert "start=1793647800" in body
    assert "until=1793658600" in body
