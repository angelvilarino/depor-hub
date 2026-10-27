"""Catálogo de feeds de noticias y utilidades de identidad de medio (ADR 0016)."""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

NewsSourceKind = Literal["club", "local", "nacional", "radio", "agregador", "video"]

_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")


class FeedConfig(BaseModel):
    """Un feed declarado en data/manual/news_feeds.yml."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    kind: NewsSourceKind
    url: str
    media_url: str | None = None
    language: str = "es"
    weight: int = Field(default=0, ge=0, le=1000)
    keyword_filter: bool = True
    enabled: bool = True
    note: str | None = None

    @field_validator("id")
    @classmethod
    def _id_format(cls, value: str) -> str:
        if not _ID.fullmatch(value):
            raise ValueError("id debe ser minúsculas, números y guiones")
        return value

    @field_validator("url", "media_url")
    @classmethod
    def _http_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
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
    """Reescribe el catálogo sin perder el orden ni los campos opcionales.

    PyYAML no conserva comentarios; el encabezado se vuelve a poner para que el fichero
    siga siendo legible. La auditoría solo lo reescribe con `--write-docs`.
    """

    header = (
        "# Catálogo de feeds de noticias (H6, ADR 0016).\n"
        "# Generado/actualizado por `python -m depor_hub.cli news audit --write-docs`.\n"
        "# `enabled: false` documenta una fuente descartada; el motivo está en `note`.\n"
    )
    payload = {"feeds": [feed.model_dump(mode="json", exclude_none=True) for feed in feeds]}
    text = header + yaml.safe_dump(payload, allow_unicode=True, sort_keys=False)
    Path(path).write_text(text, encoding="utf-8")


def _slug(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    ascii_text = "".join(c for c in decomposed if not unicodedata.combining(c))
    ascii_text = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return ascii_text[:64] or "medio"


# Nombres que Google News devuelve en <source> y que no siempre coinciden con el nombre
# comercial. Solo se normaliza la identidad; no se inventan URLs ni se resuelven redirecciones.
_KNOWN_MEDIA: dict[str, tuple[str, str, NewsSourceKind]] = {
    "as": ("as", "Diario AS", "nacional"),
    "diario as": ("as", "Diario AS", "nacional"),
    "marca": ("marca", "Marca", "nacional"),
    "mundo deportivo": ("mundo-deportivo", "Mundo Deportivo", "nacional"),
    "sport": ("sport", "Sport", "nacional"),
    "el espanol": ("el-espanol", "El Español", "nacional"),
    "el español": ("el-espanol", "El Español", "nacional"),
    "cope": ("cope", "COPE", "radio"),
    "cadena ser": ("cadena-ser", "Cadena SER", "radio"),
    "radio coruna": ("radio-coruna", "Radio Coruña", "radio"),
    "radio coruña": ("radio-coruna", "Radio Coruña", "radio"),
    "la voz de galicia": ("la-voz", "La Voz de Galicia", "local"),
    "galiciapress": ("galiciapress", "Galiciapress", "local"),
    "el ideal gallego": ("ideal-gallego", "El Ideal Gallego", "local"),
    "diario de ferrol": ("diario-de-ferrol", "Diario de Ferrol", "local"),
    "faro de vigo": ("faro-de-vigo", "Faro de Vigo", "local"),
    "la opinion a coruna": ("la-opinion", "La Opinión A Coruña", "local"),
    "la opinión a coruña": ("la-opinion", "La Opinión A Coruña", "local"),
    "superdeporte": ("superdeporte", "Superdeporte", "local"),
    "defensa central": ("defensa-central", "Defensa Central", "nacional"),
    "rc deportivo": ("club", "RC Deportivo", "club"),
    "real club deportivo de la coruna": ("club", "RC Deportivo", "club"),
    "real club deportivo de la coruña": ("club", "RC Deportivo", "club"),
    "deportivo de la coruna": ("club", "RC Deportivo", "club"),
    "deportivo de la coruña": ("club", "RC Deportivo", "club"),
    "relevo": ("relevo", "Relevo", "nacional"),
    "el desmarque": ("el-desmarque", "El Desmarque", "nacional"),
    "la opinion de zamora": ("la-opinion-zamora", "La Opinión de Zamora", "local"),
}


def is_google_news(feed: FeedConfig) -> bool:
    return (urlparse(feed.url).netloc or "").lower() == "news.google.com"


def media_identity(
    source_name: str | None, feed: FeedConfig, source_url: str | None = None
) -> tuple[str, str, str | None, NewsSourceKind]:
    """Devuelve (id, nombre, url, tipo) del medio real.

    Para un feed directo manda la configuración. Para Google News se usa el nombre que
    publica el propio RSS; si no se reconoce, se crea un id estable a partir del nombre.
    """

    if not is_google_news(feed):
        return feed.id, feed.name, feed.media_url, feed.kind
    name = (source_name or "").strip()
    if not name:
        return feed.id, feed.name, feed.media_url, feed.kind
    known = _KNOWN_MEDIA.get(name.casefold())
    if known:
        media_id, canonical_name, kind = known
        return media_id, canonical_name, source_url or feed.media_url, kind
    return _slug(name), name, source_url or feed.media_url, feed.kind
