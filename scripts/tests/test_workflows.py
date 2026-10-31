from pathlib import Path

import yaml

WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"


def load(name: str) -> dict:
    data = yaml.safe_load((WORKFLOWS / name).read_text(encoding="utf-8"))
    # PyYAML interpreta `on` como booleano (YAML 1.1); GitHub lo trata como clave.
    if True in data and "on" not in data:
        data["on"] = data.pop(True)
    return data


def steps(workflow: dict, job: str) -> list[dict]:
    return workflow["jobs"][job]["steps"]


def runs(workflow: dict, job: str) -> str:
    return "\n".join(str(step.get("run", "")) for step in steps(workflow, job))


def test_all_data_workflows_share_the_publish_lock():
    for name in ("data-refresh.yml", "news-refresh.yml", "rivals-refresh.yml"):
        workflow = load(name)
        assert workflow["concurrency"]["group"] == "data-publish"
        assert workflow["concurrency"]["cancel-in-progress"] is False
        assert workflow["jobs"]["refresh"]["timeout-minutes"] == (15 if name == "news-refresh.yml" else 10)


def test_all_workflows_rebase_before_push_and_deploy_from_a_fresh_checkout():
    for name in ("data-refresh.yml", "news-refresh.yml", "rivals-refresh.yml"):
        workflow = load(name)
        body = runs(workflow, "refresh")
        assert "git pull --rebase" in body
        assert "git push origin HEAD:main" in body
        assert "attempt in 1 2 3" in body
        assert "cli validate --data data/public/v1" in body
        deploy = workflow["jobs"]["deploy"]
        assert deploy["needs"] == "refresh"
        checkout = next(
            step for step in deploy["steps"] if str(step.get("uses", "")).startswith("actions/checkout")
        )
        assert checkout["with"]["ref"] == "main"
        upload = next(
            step
            for step in deploy["steps"]
            if str(step.get("uses", "")).startswith("actions/upload-pages-artifact")
        )
        assert upload["with"]["path"] == "data/public"
        assert any(
            str(step.get("uses", "")).startswith("actions/deploy-pages")
            for step in deploy["steps"]
        )


def test_news_runs_every_thirty_minutes_and_caches_the_feeds():
    workflow = load("news-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert "*/30 * * * *" in crons
    body = runs(workflow, "refresh")
    assert "cli news" in body
    assert "force" in workflow["on"]["workflow_dispatch"]["inputs"]
    assert workflow["jobs"]["refresh"]["timeout-minutes"] > 0
    paths = [
        step["with"]["path"]
        for step in steps(workflow, "refresh")
        if str(step.get("uses", "")).startswith("actions/cache")
    ]
    assert "data/raw/news" in paths


def test_data_refresh_keeps_its_adaptive_cadence():
    workflow = load("data-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert "*/10 * * * *" in crons
    assert "ingest --if-due" in runs(workflow, "refresh")


def test_rivals_refresh_runs_daily_and_caches_bdfutbol():
    workflow = load("rivals-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert "17 6 * * *" in crons
    body = runs(workflow, "refresh")
    assert "cli rivals" in body
    paths = [
        step["with"]["path"]
        for step in steps(workflow, "refresh")
        if str(step.get("uses", "")).startswith("actions/cache")
    ]
    assert "data/raw/enrich/h2h" in paths
