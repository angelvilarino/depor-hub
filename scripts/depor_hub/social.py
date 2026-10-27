"""Perfiles y publicaciones curadas de redes sociales (ADR 0016).

No se scrapea ninguna red: `data/manual/social_pins.yml` solo contiene URLs oficiales
verificadas y, si las hay, publicaciones concretas revisadas a mano. El JSON público se
genera desde ese fichero para que la app no tenga que interpretar YAML.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from depor_hub import models as m

from .news.normalize import content_hash

PLATFORMS = {
    "x",
    "instagram",
    "youtube",
    "tiktok",
    "facebook",
    "whatsapp",
    "twitch",
    "bluesky",
    "threads",
}


class SocialConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profiles: list[m.SocialProfile] = Field(default_factory=list)
    pins: list[m.SocialPin] = Field(default_factory=list)

    @field_validator("profiles", "pins")
    @classmethod
    def _unique_ids(cls, value: list) -> list:
        ids = [item.id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("hay ids duplicados en social_pins.yml")
        return value

    @field_validator("profiles", "pins")
    @classmethod
    def _http_urls(cls, value: list) -> list:
        for item in value:
            parsed = urlparse(item.url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"{item.id}: la URL debe ser http(s)")
            if item.platform not in PLATFORMS:
                raise ValueError(f"{item.id}: plataforma desconocida")
        return value


def load_social(path: Path | str) -> SocialConfig:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: se esperaba un objeto con `profiles` y `pins`")
    return SocialConfig.model_validate(raw)


def build_social(config: SocialConfig, now: str) -> m.SocialFeed:
    profiles = sorted(config.profiles, key=lambda item: (item.platform, item.name.casefold()))
    pins = sorted(
        config.pins,
        key=lambda item: (item.published_at or "", item.id),
        reverse=True,
    )
    payload = {
        "updatedAt": now,
        "profiles": [item.model_dump(mode="json", by_alias=True) for item in profiles],
        "pins": [item.model_dump(mode="json", by_alias=True) for item in pins],
    }
    return m.SocialFeed(
        updated_at=now,
        data_hash=content_hash(payload),
        profiles=profiles,
        pins=pins,
    )


def write_social(out_dir: Path | str, social: m.SocialFeed, force: bool = False) -> bool:
    target = Path(out_dir) / "social.json"
    previous: m.SocialFeed | None = None
    if target.exists():
        try:
            previous = m.SocialFeed.model_validate_json(target.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            previous = None
    if not force and previous is not None and previous.data_hash == social.data_hash:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        social.model_dump_json(by_alias=True, indent=2) + "\n",
        encoding="utf-8",
    )
    m.SocialFeed.model_validate_json(target.read_text(encoding="utf-8"))
    return True
