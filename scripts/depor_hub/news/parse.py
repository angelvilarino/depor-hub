"""Parseo de RSS 2.0, Atom y YouTube a un modelo intermedio (ADR 0016)."""

from __future__ import annotations

import calendar
import html
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlparse

import feedparser

from .feeds import FeedConfig, media_identity

_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
_SCRIPT = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.I | re.S)
_IMAGE_EXT = re.compile(r"\.(?:jpe?g|png|webp|gif|avif)(?:\?|$)", re.I)


@dataclass
class ParsedEntry:
    feed_id: str
    feed: FeedConfig
    title: str
    url: str
    published_at: datetime | None
    summary: str | None
    thumbnail_url: str | None
    source_name: str
    source_url: str | None
    source_kind: str
    video_id: str | None
    duration_seconds: int | None


def clean_html(value: str | None) -> str | None:
    if not value:
        return None
    text = _SCRIPT.sub(" ", value)
    text = _TAG.sub(" ", text)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = _SPACE.sub(" ", text).strip()
    return text or None


def clean_title(value: str | None) -> str | None:
    if not value:
        return None
    text = html.unescape(value)
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = _SPACE.sub(" ", text).strip()
    return text or None


def _http_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return value
    return None


def _date_from_struct(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(calendar.timegm(value), UTC)
    except (TypeError, ValueError, OverflowError):
        return None


def parse_date(value: Any, parsed: Any = None) -> datetime | None:
    """Acepta la estructura de feedparser y, si falta, una cadena RFC 822 o ISO."""

    result = _date_from_struct(parsed)
    if result is not None:
        return result
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _summary(entry: Any) -> str | None:
    candidates = [entry.get("summary"), entry.get("description")]
    content = entry.get("content")
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                candidates.append(item.get("value"))
    for candidate in candidates:
        text = clean_html(candidate if isinstance(candidate, str) else None)
        if text:
            return text
    return None


def _thumbnail(entry: Any) -> str | None:
    for item in entry.get("media_thumbnail") or []:
        if isinstance(item, dict):
            url = _http_url(item.get("url"))
            if url:
                return url
    for item in entry.get("media_content") or []:
        if not isinstance(item, dict):
            continue
        url = _http_url(item.get("url"))
        if not url:
            continue
        medium = str(item.get("medium") or "").lower()
        mime = str(item.get("type") or "").lower()
        if medium == "image" or mime.startswith("image/") or _IMAGE_EXT.search(url):
            return url
    for item in entry.get("links") or []:
        if not isinstance(item, dict):
            continue
        url = _http_url(item.get("href"))
        if not url:
            continue
        if str(item.get("rel") or "").lower() == "enclosure" and (
            str(item.get("type") or "").lower().startswith("image/") or _IMAGE_EXT.search(url)
        ):
            return url
    image = entry.get("image")
    if isinstance(image, dict):
        url = _http_url(image.get("href") or image.get("url"))
        if url:
            return url
    return None


def _duration_seconds(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return max(0, int(value))
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    parts = text.split(":")
    if not all(part.isdigit() for part in parts):
        return None
    seconds = 0
    for part in parts:
        seconds = seconds * 60 + int(part)
    return seconds


def _duration(entry: Any) -> int | None:
    value = _duration_seconds(entry.get("itunes_duration"))
    if value is not None:
        return value
    for item in entry.get("media_content") or []:
        if isinstance(item, dict):
            value = _duration_seconds(item.get("duration"))
            if value is not None:
                return value
    return None


def _source(entry: Any) -> tuple[str | None, str | None]:
    source = entry.get("source")
    if isinstance(source, dict):
        return source.get("title"), _http_url(source.get("href"))
    if source:
        return str(source), None
    return None, None


def _link(entry: Any) -> str | None:
    link = _http_url(entry.get("link"))
    if link:
        return link
    for item in entry.get("links") or []:
        if isinstance(item, dict) and str(item.get("rel") or "").lower() in {"alternate", ""}:
            link = _http_url(item.get("href"))
            if link:
                return link
    return None


def _video_id(entry: Any, link: str) -> str | None:
    value = entry.get("yt_videoid")
    if value:
        return str(value)
    parsed = urlparse(link)
    if "youtube.com" in parsed.netloc:
        query = dict(
            part.split("=", 1) for part in parsed.query.split("&") if "=" in part
        )
        if query.get("v"):
            return query["v"]
    if "youtu.be" in parsed.netloc:
        return parsed.path.strip("/") or None
    return None


def parse_entries(feed: FeedConfig, body: bytes) -> list[ParsedEntry]:
    parsed = feedparser.parse(body)
    if not parsed.get("version") and not parsed.get("entries"):
        raise ValueError(
            f"{feed.id}: feed ilegible ({parsed.get('bozo_exception') or 'sin formato reconocible'})"
        )
    if parsed.get("bozo") and not parsed.get("entries"):
        raise ValueError(f"{feed.id}: feed ilegible ({parsed.get('bozo_exception')})")
    entries: list[ParsedEntry] = []
    for entry in parsed.get("entries") or []:
        title = clean_title(entry.get("title"))
        url = _link(entry)
        if not title or not url:
            continue
        published = parse_date(
            entry.get("published") or entry.get("updated") or entry.get("created"),
            entry.get("published_parsed")
            or entry.get("updated_parsed")
            or entry.get("created_parsed"),
        )
        source_name, source_url = _source(entry)
        _media_id, canonical_name, media_url, source_kind = media_identity(
            source_name, feed, source_url
        )
        # `source_name` se resuelve después en el pipeline con media_identity; aquí se
        # guarda el nombre que da el feed para poder limpiar el sufijo del título.
        entries.append(
            ParsedEntry(
                feed_id=feed.id,
                feed=feed,
                title=title,
                url=url,
                published_at=published,
                summary=_summary(entry),
                thumbnail_url=_thumbnail(entry),
                source_name=source_name or canonical_name,
                source_url=source_url or media_url,
                source_kind=source_kind,
                video_id=_video_id(entry, url),
                duration_seconds=_duration(entry),
            )
        )
    return entries
