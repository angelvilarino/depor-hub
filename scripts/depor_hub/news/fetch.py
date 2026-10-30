"""Lectura de feeds con caché, ETag y tolerancia a fallos parciales (ADR 0018)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .feeds import FeedConfig
from .http import FeedBlocked, FeedError, NewsHttp
from .parse import ParsedEntry, parse_entries


@dataclass
class FeedFetch:
    feed: FeedConfig
    entries: list[ParsedEntry] = field(default_factory=list)
    error: str | None = None
    not_modified: bool = False

    @property
    def ok(self) -> bool:
        return self.error is None


def fetch_feed(feed: FeedConfig, http: NewsHttp, *, force: bool = False) -> FeedFetch:
    try:
        response = http.fetch(feed.id, feed.feed_url, force=force)
        if response.not_modified:
            # El cuerpo cacheado se reutiliza; el ETag no nos exime de parsearlo.
            return FeedFetch(
                feed=feed,
                entries=parse_entries(feed, response.body),
                not_modified=True,
            )
        return FeedFetch(feed=feed, entries=parse_entries(feed, response.body))
    except (FeedError, FeedBlocked, ValueError, OSError) as exc:
        return FeedFetch(feed=feed, error=str(exc))


def fetch_all(feeds: list[FeedConfig], http: NewsHttp, *, force: bool = False) -> list[FeedFetch]:
    return [fetch_feed(feed, http, force=force) for feed in feeds if feed.enabled]
