"""Wikimedia Commons: metadatos de una imagen (URL, licencia y atribución).

Solo se guardan URLs y metadatos; las imágenes no se copian al repositorio.

ADR 0009: las fotos de jugador son únicamente las de la ficha oficial del club, así que
este cliente no participa en el pipeline de plantilla. Se mantiene como utilidad para
otros usos del proyecto (por ejemplo, imágenes del club o del estadio).
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .htmlutil import strip_tags
from .http import PoliteClient, SourceError

API = "https://commons.wikimedia.org/w/api.php"


@dataclass
class CommonsImage:
    file: str
    url: str
    description_url: str
    width: int | None
    height: int | None
    license: str | None
    license_url: str | None
    author: str | None
    credit: str | None


def _value(meta: dict, key: str) -> str | None:
    raw = (meta.get(key) or {}).get("value")
    if raw is None:
        return None
    text = strip_tags(str(raw))
    return text or None


def parse_imageinfo(payload: dict, file: str) -> CommonsImage | None:
    pages = payload.get("query", {}).get("pages", [])
    if isinstance(pages, dict):  # API antigua
        pages = list(pages.values())
    if not pages:
        return None
    page = pages[0]
    if page.get("missing") is not None or "imageinfo" not in page:
        return None
    info = (page.get("imageinfo") or [{}])[0]
    meta = info.get("extmetadata") or {}
    return CommonsImage(
        file=file,
        url=info.get("thumburl") or info.get("url") or "",
        description_url=info.get("descriptionurl") or "",
        width=info.get("thumbwidth") or info.get("width"),
        height=info.get("thumbheight") or info.get("height"),
        license=_value(meta, "LicenseShortName"),
        license_url=_value(meta, "LicenseUrl"),
        author=_value(meta, "Artist"),
        credit=_value(meta, "Credit"),
    )


class CommonsClient:
    def __init__(self, http: PoliteClient) -> None:
        self.http = http

    def image(self, file: str, width: int = 900) -> CommonsImage | None:
        if not file:
            return None
        title = file if file.lower().startswith("file:") else f"File:{file}"
        url = API + "?" + urlencode({
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": width,
            "format": "json",
            "formatversion": "2",
        })
        try:
            payload = self.http.get_json(url)
        except SourceError:
            return None
        return parse_imageinfo(payload, file)


__all__ = ["CommonsClient", "CommonsImage", "parse_imageinfo"]
