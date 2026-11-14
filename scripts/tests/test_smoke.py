import json
from pathlib import Path

from depor_hub import smoke

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "public" / "v1"


def test_published_contract_passes_the_smoke_test():
    payloads = smoke.load_local(DATA)

    assert smoke.check_payloads(payloads) == []


def test_missing_document_is_reported():
    payloads = smoke.load_local(DATA)
    payloads.pop("titles.json")

    failures = smoke.check_payloads(payloads)

    assert any("titles.json: no publicado" in failure for failure in failures)


def test_data_hash_mismatch_is_reported():
    payloads = smoke.load_local(DATA)
    meta = json.loads(payloads["meta.json"])
    meta["dataHash"] = "0000000000000000"
    payloads["meta.json"] = json.dumps(meta).encode("utf-8")

    failures = smoke.check_payloads(payloads)

    assert any("dataHash" in failure for failure in failures)
