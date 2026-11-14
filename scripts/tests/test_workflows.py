from pathlib import Path

import yaml

WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"

WRITERS = ("data-refresh.yml", "news-refresh.yml", "rivals-refresh.yml", "club-refresh.yml")


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


def step(workflow: dict, job: str, step_id: str) -> dict:
    return next(item for item in steps(workflow, job) if item.get("id") == step_id)


def test_every_writer_shares_one_lock_and_one_reusable_deploy():
    for name in WRITERS:
        workflow = load(name)
        assert workflow["concurrency"]["group"] == "main-write"
        assert workflow["concurrency"]["cancel-in-progress"] is False
        deploy = workflow["jobs"]["deploy"]
        assert deploy["needs"] == "refresh"
        assert deploy["if"] == "needs.refresh.outputs.changed == 'true'"
        assert deploy["uses"] == "./.github/workflows/publish.yml"
        assert "runs-on" not in deploy
        assert "steps" not in deploy


def test_publish_is_the_single_definition_of_the_pages_deploy():
    workflow = load("publish.yml")
    assert "workflow_call" in workflow["on"]
    assert workflow["permissions"]["pages"] == "write"
    assert workflow["permissions"]["id-token"] == "write"
    assert workflow["concurrency"]["group"] == "pages-deploy"
    assert workflow["concurrency"]["cancel-in-progress"] is False
    deploy = workflow["jobs"]["deploy"]["steps"]
    checkout = next(item for item in deploy if str(item.get("uses", "")).startswith("actions/checkout"))
    assert checkout["with"]["ref"] == "main"
    upload = next(
        item
        for item in deploy
        if str(item.get("uses", "")).startswith("actions/upload-pages-artifact")
    )
    assert upload["with"]["path"] == "data/public"
    assert any(str(item.get("uses", "")).startswith("actions/deploy-pages") for item in deploy)


def test_all_writers_rebase_before_push_and_validate_before_commit():
    for name in WRITERS:
        workflow = load(name)
        body = runs(workflow, "refresh")
        assert "git pull --rebase" in body
        assert "git rebase --abort" in body
        assert "git push origin HEAD:main" in body
        assert "attempt in 1 2 3 4 5" in body
        assert "cli validate --data data/public/v1" in body
        assert workflow["jobs"]["refresh"]["timeout-minutes"] > 0


def test_data_refresh_uses_the_hybrid_cadence_and_skips_noop_steps():
    workflow = load("data-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert crons == ["0 * * * *", "*/10 12-23 * * 6,0"]
    body = runs(workflow, "refresh")
    assert "ingest --if-due" in body

    # PIPE-11: snapshots y fichas de partido solo cuando la ingesta ha hecho una
    # pasada real. Si `--if-due` sale pronto, no hay nada nuevo que congelar.
    snapshots = next(item for item in steps(workflow, "refresh") if "snapshots" in str(item.get("run", "")))
    assert snapshots["if"] == "steps.ingest.outputs.refreshed == 'true'"
    details = step(workflow, "refresh", "match-details")
    assert details["if"] == "steps.ingest.outputs.refreshed == 'true'"

    # La validación completa solo si hay algo que publicar; CI valida siempre.
    validate = next(
        item
        for item in steps(workflow, "refresh")
        if "cli validate" in str(item.get("run", ""))
    )
    assert validate["if"] == "steps.dirty.outputs.changed == 'true'"

    # PIPE-08: el club vive en su propio workflow semanal.
    assert "cli club" not in body
    assert "club-images" not in body


def test_data_refresh_makes_a_bdfutbol_failure_visible_without_blocking_publish():
    workflow = load("data-refresh.yml")
    details = step(workflow, "refresh", "match-details")
    assert details["continue-on-error"] is True
    assert "match-details --strict" in str(details["run"])
    assert workflow["jobs"]["refresh"]["outputs"]["bdfutbol"] == "${{ steps.match-details.outcome }}"
    alert = workflow["jobs"]["bdfutbol-alert"]
    assert alert["needs"] == "refresh"
    assert "failure" in alert["if"]
    # El deploy solo depende de refresh: el rojo de BDFutbol no impide publicar.
    assert workflow["jobs"]["deploy"]["needs"] == "refresh"


def test_club_refresh_is_weekly_and_keeps_generated_yaml_out_of_main():
    workflow = load("club-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert crons == ["0 7 * * 1"]

    titles = step(workflow, "refresh", "titles")
    assert "club titles" in str(titles["run"])
    assert "--proposal data/raw/titles.proposed.yml" in str(titles["run"])
    assert titles["continue-on-error"] is True

    rivalries = step(workflow, "refresh", "rivalries")
    assert "club rivalries" in str(rivalries["run"])
    assert rivalries["continue-on-error"] is True

    images = step(workflow, "refresh", "images")
    assert "club-images" in str(images["run"])
    assert images["continue-on-error"] is True

    body = runs(workflow, "refresh")
    assert "cli club " in body
    paths = [
        item["with"]["path"]
        for item in steps(workflow, "refresh")
        if str(item.get("uses", "")).startswith("actions/cache")
    ]
    assert any("data/raw/enrich" in str(path) for path in paths)

    # PIPE-07: el fallo de BDFutbol deja el run en rojo, pero después de publicar.
    outputs = workflow["jobs"]["refresh"]["outputs"]
    assert outputs["titles"] == "${{ steps.titles.outcome }}"
    alert = workflow["jobs"]["club-alert"]
    assert alert["needs"] == "refresh"
    assert "titles == 'failure'" in alert["if"]


def test_health_runs_every_four_hours_and_fails_when_the_light_is_red():
    workflow = load("health.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert crons == ["0 */4 * * *"]
    assert workflow["concurrency"]["group"] == "status-publish"
    assert workflow["permissions"]["contents"] == "write"
    assert workflow["permissions"]["actions"] == "read"
    body = runs(workflow, "status")
    assert "cli status" in body
    assert "--soft" in body
    assert "--runs-dir" in body
    assert "actions/workflows/" in body
    assert "per_page=20" in body
    assert "club-refresh.yml" in body
    assert "HEAD:status" in body
    assert "deploy-pages" not in body
    # Publica primero y después refleja el rojo en el propio run (PIPE-12).
    assert '"$ok" != "true"' in body
    assert "::error::" in body
    assert "exit 1" in body


def test_smoke_runs_after_a_successful_publish_of_any_writer():
    workflow = load("smoke.yml")
    assert workflow["on"]["workflow_run"]["types"] == ["completed"]
    assert set(workflow["on"]["workflow_run"]["workflows"]) == {
        "Data refresh",
        "News refresh",
        "Rivals refresh",
        "Club refresh",
    }
    body = runs(workflow, "smoke")
    assert "cli smoke" in body
    assert "angelvilarino.github.io/depor-hub" in body


def test_news_runs_every_thirty_minutes_and_caches_the_feeds():
    workflow = load("news-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert "*/30 * * * *" in crons
    body = runs(workflow, "refresh")
    assert "cli news" in body
    assert "force" in workflow["on"]["workflow_dispatch"]["inputs"]
    paths = [
        item["with"]["path"]
        for item in steps(workflow, "refresh")
        if str(item.get("uses", "")).startswith("actions/cache")
    ]
    assert "data/raw/news" in paths


def test_rivals_refresh_runs_daily_and_caches_bdfutbol():
    workflow = load("rivals-refresh.yml")
    crons = [entry["cron"] for entry in workflow["on"]["schedule"]]
    assert "17 6 * * *" in crons
    body = runs(workflow, "refresh")
    assert "cli rivals" in body
    paths = [
        item["with"]["path"]
        for item in steps(workflow, "refresh")
        if str(item.get("uses", "")).startswith("actions/cache")
    ]
    assert "data/raw/enrich/h2h" in paths
