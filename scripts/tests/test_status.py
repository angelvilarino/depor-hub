from __future__ import annotations

import argparse
import json

from depor_hub import cli
from depor_hub import models as m

NOW = "2026-11-04T10:00:00Z"
REQUIRED = ("meta.json", "standings.json", "fixtures.json", "squad.json", "season.json")


def make_data(tmp_path, **extra):
    for name in REQUIRED:
        (tmp_path / name).write_text(json.dumps({"updatedAt": NOW}), encoding="utf-8")
    (tmp_path / "news.json").write_text(
        json.dumps({"updatedAt": NOW, "stories": [1, 2], "sources": [1]}), encoding="utf-8"
    )
    (tmp_path / "rivals.json").write_text(
        json.dumps(
            {
                "updatedAt": NOW,
                "rivals": [
                    {"team": {"id": 1, "name": "A"}, "headToHead": {"played": 1}},
                    {"team": {"id": 2, "name": "B"}, "headToHead": None},
                ],
            }
        ),
        encoding="utf-8",
    )
    for name, body in extra.items():
        (tmp_path / name).write_text(json.dumps(body), encoding="utf-8")
    return tmp_path


def make_runs(tmp_path, conclusions=("success", "success", "success")):
    workflows = ("data-refresh.yml", "news-refresh.yml", "rivals-refresh.yml")
    body = {
        "workflow_runs": [
            {
                "path": f".github/workflows/{name}",
                "conclusion": conclusion,
                "updated_at": NOW,
                "html_url": f"https://example.test/{name}",
            }
            for name, conclusion in zip(workflows, conclusions, strict=True)
        ]
    }
    path = tmp_path / "runs.json"
    path.write_text(json.dumps(body), encoding="utf-8")
    return path


def run_status(tmp_path, data, runs, soft=False):
    out = tmp_path / "status.json"
    args = argparse.Namespace(
        data=str(data),
        runs=str(runs),
        runs_dir=None,
        out=str(out),
        now=NOW,
        commit="abc1234",
        soft=soft,
    )
    code = cli.cmd_status(args)
    return code, m.Status.model_validate_json(out.read_text(encoding="utf-8"))


def test_status_summarizes_files_and_workflows(tmp_path):
    data = make_data(tmp_path)
    runs = make_runs(tmp_path)

    code, status = run_status(tmp_path, data, runs)

    assert code == 0
    assert status.ok is True
    assert status.commit == "abc1234"
    assert [workflow.conclusion for workflow in status.workflows] == ["success"] * 3
    news = next(file for file in status.files if file.name == "news.json")
    assert news.present is True
    assert news.detail == "2 historias · 1 fuentes"
    rivals = next(file for file in status.files if file.name == "rivals.json")
    assert rivals.detail == "2 rivales · 1 con histórico"
    assert all(file.age_minutes is not None for file in status.files if file.present)


def test_status_uses_only_the_latest_completed_run(tmp_path):
    data = make_data(tmp_path)
    runs = make_runs(tmp_path)
    body = json.loads(runs.read_text(encoding="utf-8"))
    body["workflow_runs"].append(
        {
            "path": ".github/workflows/data-refresh.yml",
            "conclusion": "failure",
            "updated_at": "2026-11-04T09:00:00Z",
            "html_url": "https://example.test/failed",
        }
    )
    body["workflow_runs"].append(
        {
            "path": ".github/workflows/data-refresh.yml",
            "conclusion": "success",
            "updated_at": "2026-11-04T10:01:00Z",
            "html_url": "https://example.test/ok",
        }
    )
    runs.write_text(json.dumps(body), encoding="utf-8")

    _, status = run_status(tmp_path, data, runs)
    data_workflow = next(workflow for workflow in status.workflows if workflow.file == "data-refresh.yml")

    assert data_workflow.conclusion == "success"
    assert data_workflow.url == "https://example.test/ok"


def test_status_is_red_when_a_required_file_or_workflow_fails(tmp_path):
    data = make_data(tmp_path)
    runs = make_runs(tmp_path, ("failure", "success", "success"))

    code, status = run_status(tmp_path, data, runs)
    assert code == 1
    assert status.ok is False

    soft_code, soft_status = run_status(tmp_path, data, runs, soft=True)
    assert soft_code == 0
    assert soft_status.ok is False

    (data / "meta.json").unlink()
    code, status = run_status(tmp_path, data, make_runs(tmp_path))
    assert code == 1
    assert status.ok is False
    meta = next(file for file in status.files if file.name == "meta.json")
    assert meta.present is False
    assert meta.detail == "falta un fichero requerido"


def test_status_marks_a_workflow_stale_from_its_last_success(tmp_path):
    data = make_data(tmp_path)
    runs = make_runs(tmp_path)
    body = json.loads(runs.read_text(encoding="utf-8"))
    body["workflow_runs"][0]["updated_at"] = "2026-10-01T00:00:00Z"
    runs.write_text(json.dumps(body), encoding="utf-8")

    code, status = run_status(tmp_path, data, runs)

    assert code == 1
    data_workflow = next(item for item in status.workflows if item.file == "data-refresh.yml")
    assert data_workflow.last_success_at == "2026-10-01T00:00:00Z"
    assert data_workflow.expected_within_hours == 36
    assert data_workflow.stale is True
    assert status.ok is False


def test_status_reads_one_window_per_workflow_from_a_directory(tmp_path):
    data = make_data(tmp_path)
    runs_dir = tmp_path / "runs"
    runs_dir.mkdir()
    for filename in ("data-refresh.yml", "rivals-refresh.yml"):
        (runs_dir / f"{filename}.json").write_text(
            json.dumps(
                {
                    "workflow_runs": [
                        {
                            "path": f".github/workflows/{filename}",
                            "conclusion": "success",
                            "updated_at": NOW,
                            "html_url": f"https://example.test/{filename}",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
    out = tmp_path / "status.json"
    args = argparse.Namespace(
        data=str(data),
        runs=None,
        runs_dir=str(runs_dir),
        out=str(out),
        now=NOW,
        commit="abc1234",
        soft=False,
    )

    code = cli.cmd_status(args)
    status = m.Status.model_validate_json(out.read_text(encoding="utf-8"))

    assert code == 0
    assert {item.file for item in status.workflows} == {
        "data-refresh.yml",
        "rivals-refresh.yml",
    }
    assert all(item.stale is False for item in status.workflows)


def test_status_ignores_missing_optional_files_and_unreadable_updated_at(tmp_path):
    data = make_data(tmp_path)
    (data / "club.json").unlink(missing_ok=True)
    (data / "social.json").unlink(missing_ok=True)
    (data / "standings.json").write_text(json.dumps({"foo": "bar"}), encoding="utf-8")

    code, status = run_status(tmp_path, data, make_runs(tmp_path))

    assert code == 0
    assert status.ok is True
    club = next(file for file in status.files if file.name == "club.json")
    assert club.present is False
    standings = next(file for file in status.files if file.name == "standings.json")
    assert standings.detail == "sin updatedAt"
    assert standings.updated_at is None


def test_status_does_not_feed_its_own_health_failure_back_into_the_light(tmp_path):
    """PIPE-12: Health falla cuando ok=false; su run rojo no debe ser la causa."""
    data = make_data(tmp_path)
    runs = make_runs(tmp_path)
    body = json.loads(runs.read_text(encoding="utf-8"))
    body["workflow_runs"].append(
        {
            "path": ".github/workflows/health.yml",
            "conclusion": "success",
            "updated_at": "2026-11-04T06:00:00Z",
            "html_url": "https://example.test/health",
        }
    )
    body["workflow_runs"].append(
        {
            "path": ".github/workflows/health.yml",
            "conclusion": "failure",
            "updated_at": "2026-11-04T10:00:00Z",
            "html_url": "https://example.test/health-red",
        }
    )
    runs.write_text(json.dumps(body), encoding="utf-8")

    code, status = run_status(tmp_path, data, runs)
    health = next(item for item in status.workflows if item.file == "health.yml")

    assert health.conclusion == "failure"
    assert health.stale is False
    assert status.ok is True
    assert code == 0


def test_status_tracks_the_weekly_club_refresh(tmp_path):
    data = make_data(tmp_path)
    runs = make_runs(tmp_path)
    body = json.loads(runs.read_text(encoding="utf-8"))
    body["workflow_runs"].append(
        {
            "path": ".github/workflows/club-refresh.yml",
            "conclusion": "success",
            "updated_at": NOW,
            "html_url": "https://example.test/club",
        }
    )
    runs.write_text(json.dumps(body), encoding="utf-8")

    _, status = run_status(tmp_path, data, runs)
    club = next(item for item in status.workflows if item.file == "club-refresh.yml")

    assert club.expected_within_hours == 240
    assert club.stale is False
