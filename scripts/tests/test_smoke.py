import json
from pathlib import Path

from depor_hub import smoke

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "public" / "v1"


def test_published_contract_passes_the_smoke_test():
    payloads = smoke.load_local(DATA)

    assert smoke.check_payloads(payloads) == []


def test_missing_required_document_is_reported():
    payloads = smoke.load_local(DATA)
    payloads.pop("fixtures.json")

    failures = smoke.check_payloads(payloads)

    assert any("fixtures.json: no publicado" in failure for failure in failures)


def test_missing_optional_document_is_not_a_failure():
    payloads = smoke.load_local(DATA)
    payloads.pop("news-home.json")

    assert smoke.check_payloads(payloads) == []


def test_data_hash_mismatch_is_reported():
    payloads = smoke.load_local(DATA)
    meta = json.loads(payloads["meta.json"])
    meta["dataHash"] = "0000000000000000"
    payloads["meta.json"] = json.dumps(meta).encode("utf-8")

    failures = smoke.check_payloads(payloads)

    assert any("dataHash" in failure for failure in failures)


def test_missing_player_detail_is_reported():
    payloads = smoke.load_local(DATA)
    payloads.pop("players/114100.json", None)

    failures = smoke.check_payloads(payloads)

    assert any("players/114100.json: no publicado" in failure for failure in failures)


def test_invalid_player_detail_is_reported():
    payloads = smoke.load_local(DATA)
    payloads["players/114100.json"] = b'{"id": "not-an-int"}'

    failures = smoke.check_payloads(payloads)

    assert any("players/114100.json: no valida" in failure for failure in failures)
