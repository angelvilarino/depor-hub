"""Catálogo curado de feeds de noticias (ADR 0018)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

NewsGroup = Literal["club", "galicia", "nacional"]
NewsKind = Literal["article", "video"]

GROUP_ORDER: dict[str, int] = {"club": 0, "galicia": 1, "nacional": 2}


class FeedConfig(BaseModel):
    """Un feed declarado en data/manual/news_feeds.yml.

    `priority`: menor = más prioritaria para ser representante de un clúster.
    `depor_specific`: el feed ya está filtrado por el medio; se le exige menos señal,
    pero se sigue validando que no sea una noticia de otro club.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True, alias_generator=to_camel)

    id: str
    name: str
    group: NewsGroup
    priority: int = Field(default=50, ge=0, le=1000)
    feed_url: str = Field(alias="feedUrl")
    homepage: str
    kind: NewsKind = "article"
    enabled: bool = True
    depor_specific: bool = False
    note: str | None = None

    @field_validator("id")
    @classmethod
    def _id_format(cls, value: str) -> str:
        if not value or value != value.lower() or " " in value:
            raise ValueError("id debe ser minúsculas, sin espacios")
        return value

    @field_validator("feed_url", "homepage")
    @classmethod
    def _http_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("la URL debe ser http(s)")
        return value


def load_feeds(path: Path | str) -> list[FeedConfig]:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict) or not isinstance(raw.get("feeds"), list):
        raise ValueError(f"{path}: se esperaba una lista `feeds`")
    feeds = [FeedConfig.model_validate(item) for item in raw["feeds"]]
    ids = [feed.id for feed in feeds]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{path}: hay ids de feed duplicados")
    return feeds


def dump_feeds(path: Path | str, feeds: list[FeedConfig]) -> None:
    """Reescribe el catálogo conservando el orden y los campos opcionales."""

    header = (
        "# Catálogo curado de noticias (ADR 0018).\n"
        "# Generado/actualizado por `python -m depor_hub.cli news audit --write-docs`.\n"
        "# `enabled: false` documenta una fuente descartada; el motivo está en `note`.\n"
    )
    payload = {
        "feeds": [feed.model_dump(mode="json", by_alias=True, exclude_none=True) for feed in feeds]
    }
    text = header + yaml.safe_dump(payload, allow_unicode=True, sort_keys=False)
    Path(path).write_text(text, encoding="utf-8")
