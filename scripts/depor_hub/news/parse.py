"""Parseo de RSS 2.0, RSS 1.0/RDF, Atom y YouTube con la biblioteca estándar (ADR 0018).

No se usa `feedparser`: así el parseo es determinista, testeable sin red y no acepta
DOCTYPE/entidades externas. Solo se leen los campos que el feed entrega; nunca se
descarga el cuerpo del artículo.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Iterable
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

from .feeds import FeedConfig
from .normalize import clean_html, clean_title, parse_date, strip_source_suffix

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rss": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "media": "http://search.yahoo.com/mrss/",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}
_IMAGE_EXT = re.compile(r"\.(?:jpe?g|png|webp|gif|avif)(?:\?|$)", re.I)
_DURATION = re.compile(r"^\d+(?::\d+)*$")


@dataclass(frozen=True)
class ParsedEntry:
    feed: FeedConfig
    title: str
    url: str
    published_at: datetime | None
    summary: str | None
    thumbnail_url: str | None
    video_id: str | None = None
    duration_seconds: int | None = None

    @property
    def feed_id(self) -> str:
        return self.feed.id


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _find_text(element: ET.Element, names: Iterable[str]) -> str | None:
    wanted = set(names)
    for child in element.iter():
        if _local_name(child.tag) in wanted and (child.text or "").strip():
            return child.text.strip()
    return None


def _child_text(element: ET.Element, names: Iterable[str]) -> str | None:
    wanted = set(names)
    for child in list(element):
        if _local_name(child.tag) in wanted and (child.text or "").strip():
            return child.text.strip()
    return None


def _http_url(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value
    return None


def _link(element: ET.Element) -> str | None:
    candidates: list[str] = []
    for child in list(element):
        name = _local_name(child.tag)
        if name != "link":
            continue
        href = _http_url(child.attrib.get("href"))
        rel = (child.attrib.get("rel") or "alternate").lower()
        if href and rel in {"alternate", ""}:
            candidates.append(href)
        text = _http_url((child.text or "").strip())
        if text:
            candidates.append(text)
    return candidates[0] if candidates else None


def _thumbnail(element: ET.Element) -> str | None:
    for child in element.iter():
        name = _local_name(child.tag)
        if name == "thumbnail":
            url = _http_url(child.attrib.get("url"))
            if url:
                return url
        if name in {"content", "enclosure", "link"}:
            url = _http_url(child.attrib.get("url") or child.attrib.get("href"))
            if not url:
                continue
            medium = (child.attrib.get("medium") or "").lower()
            mime = (child.attrib.get("type") or "").lower()
            relation = (child.attrib.get("rel") or "").lower()
            if (
                medium == "image"
                or mime.startswith("image/")
                or relation == "enclosure"
                or _IMAGE_EXT.search(url)
            ):
                return url
    return None


def _duration(element: ET.Element) -> int | None:
    for child in element.iter():
        if _local_name(child.tag) not in {"duration"}:
            continue
        value = (child.text or child.attrib.get("duration") or "").strip()
        if not value or not _DURATION.fullmatch(value):
            continue
        seconds = 0
        for part in value.split(":"):
            seconds = seconds * 60 + int(part)
        return seconds
    return None


def _video_id(element: ET.Element, url: str) -> str | None:
    for child in element.iter():
        if _local_name(child.tag) == "videoid" and (child.text or "").strip():
            return child.text.strip()
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc:
        for part in parsed.query.split("&"):
            if part.startswith("v="):
                return part[2:]
    if "youtu.be" in parsed.netloc:
        return parsed.path.strip("/") or None
    return None


def _entry_date(element: ET.Element) -> datetime | None:
    # `published` es la fecha de publicación; `updated` solo es el respaldo.
    for wanted in ("pubdate", "published", "date", "created", "updated"):
        for child in element.iter():
            if _local_name(child.tag) != wanted:
                continue
            parsed = parse_date((child.text or "").strip())
            if parsed:
                return parsed
    return None


def _entry_summary(element: ET.Element) -> str | None:
    for child in element.iter():
        if _local_name(child.tag) in {"encoded", "description", "summary", "content"}:
            text = clean_html(child.text)
            if text:
                return text
    return None


def _entry_title(element: ET.Element) -> str | None:
    for child in list(element):
        if _local_name(child.tag) == "title":
            return clean_title(child.text)
    return None


def _entries(root: ET.Element) -> list[ET.Element]:
    name = _local_name(root.tag)
    if name == "feed":
        return [child for child in list(root) if _local_name(child.tag) == "entry"]
    if name in {"rss", "rdf"}:
        found: list[ET.Element] = []
        for child in root.iter():
            if _local_name(child.tag) == "item":
                found.append(child)
        return found
    return []


def parse_entries(feed: FeedConfig, body: bytes) -> list[ParsedEntry]:
    head = body[:4096].lstrip().lower()
    if not head or head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        raise ValueError(f"{feed.id}: la respuesta no es un feed")
    if b"<!doctype" in head or b"<!entity" in head:
        raise ValueError(f"{feed.id}: el feed contiene DOCTYPE o entidades no permitidas")
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise ValueError(f"{feed.id}: XML ilegible ({exc})") from exc
    entries = _entries(root)
    if not entries:
        raise ValueError(f"{feed.id}: feed sin entradas reconocibles")
    parsed: list[ParsedEntry] = []
    for element in entries:
        title = _entry_title(element)
        url = _link(element)
        if not title or not url:
            continue
        title = strip_source_suffix(title, feed.name)
        published = _entry_date(element)
        summary = _entry_summary(element)
        thumbnail = _thumbnail(element)
        video_id = _video_id(element, url)
        parsed.append(
            ParsedEntry(
                feed=feed,
                title=title,
                url=url,
                published_at=published.astimezone(UTC) if published else None,
                summary=summary,
                thumbnail_url=thumbnail,
                video_id=video_id,
                duration_seconds=_duration(element),
            )
        )
    return parsed
