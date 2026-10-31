import json
from pathlib import Path

import pytest

from depor_hub import models as m
from depor_hub.social import build_social, load_social, write_social

NOW = "2026-10-27T15:00:00Z"
ROOT = Path(__file__).resolve().parents[2]


def config(tmp_path: Path, text: str):
    path = tmp_path / "social.yml"
    path.write_text(text, encoding="utf-8")
    return load_social(path)


def test_load_real_catalog_only_has_verified_profiles():
    social = load_social(ROOT / "data" / "manual" / "social_pins.yml")
    urls = {profile.url for profile in social.profiles}
    assert "https://x.com/RCDeportivo" in urls
    assert "https://www.instagram.com/rcdeportivo/" in urls
    assert "https://www.youtube.com/@rcdeportivo" in urls
    assert social.pins == []


def test_load_rejects_duplicate_ids(tmp_path: Path):
    with pytest.raises(ValueError, match="duplicados"):
        config(
            tmp_path,
            "profiles:\n"
            "  - {id: uno, platform: x, name: Uno, url: 'https://x.com/uno'}\n"
            "  - {id: uno, platform: x, name: Dos, url: 'https://x.com/dos'}\n"
            "pins: []\n",
        )


def test_load_rejects_unknown_platform_and_non_http_url(tmp_path: Path):
    with pytest.raises(ValueError):
        config(
            tmp_path,
            "profiles:\n  - {id: uno, platform: myspace, name: Uno, url: 'https://x.com/uno'}\n",
        )
    with pytest.raises(ValueError, match="http"):
        config(
            tmp_path,
            "profiles:\n  - {id: uno, platform: x, name: Uno, url: 'ftp://x.com/uno'}\n",
        )


def test_build_social_sorts_and_hashes_without_timestamps(tmp_path: Path):
    cfg = config(
        tmp_path,
        "profiles:\n"
        "  - {id: b, platform: youtube, name: B, url: 'https://youtube.com/b'}\n"
        "  - {id: a, platform: x, name: A, url: 'https://x.com/a'}\n"
        "pins:\n"
        "  - {id: p1, platform: x, url: 'https://x.com/a/1', title: Uno}\n"
        "  - {id: p2, platform: x, url: 'https://x.com/a/2', title: Dos, published_at: '2026-10-27T10:00:00Z'}\n",
    )
    first = build_social(cfg, NOW)
    second = build_social(cfg, "2026-10-28T10:00:00Z")
    assert [profile.id for profile in first.profiles] == ["a", "b"]
    assert [pin.id for pin in first.pins] == ["p2", "p1"]
    assert first.data_hash == second.data_hash


def test_write_social_is_idempotent_and_validates(tmp_path: Path):
    cfg = config(
        tmp_path,
        "profiles:\n  - {id: a, platform: x, name: A, url: 'https://x.com/a'}\n",
    )
    social = build_social(cfg, NOW)
    assert write_social(tmp_path, social) is True
    assert write_social(tmp_path, social) is False
    assert write_social(tmp_path, social, force=True) is True
    payload = json.loads((tmp_path / "social.json").read_text(encoding="utf-8"))
    assert payload["profiles"][0]["id"] == "a"
    m.SocialFeed.model_validate_json((tmp_path / "social.json").read_text(encoding="utf-8"))
