"""Orquestación de noticias: fetch → relevancia → etiquetas → clústeres → publicación."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

from depor_hub import models as m

from .build import (
    MAX_STORIES,
    ROLLING_DAYS,
    IngestResult,
    build_news,
    load_existing,
    make_report,
    write_news,
)
from .cluster import Candidate, build_stories, cluster_candidates, retain
from .feeds import FeedConfig
from .fetch import fetch_all
from .http import NewsHttp
from .normalize import canonical_url, strip_source_suffix, truncate_summary
from .relevance import build_index
from .tags import build_tags

__all__ = [
    "AllFeedsFailed",
    "IngestResult",
    "build_index",
    "load_existing",
    "run_ingest",
    "write_news",
]


class AllFeedsFailed(RuntimeError):
    """Ninguna fuente respondió: no se publica y el proceso sale con error."""


def _previous_stories(existing: m.News | None) -> list[m.NewsStory]:
    """Conserva lo ya publicado: si una fuente falla, sus historias siguen visibles.

    Solo se recalculan las etiquetas para que un cambio de taxonomía no deje valores
    obsoletos en el JSON publicado. La relevancia ya se validó cuando se publicó.
    """

    if existing is None:
        return []
    return [
        story.model_copy(update={"tags": build_tags(story.title, story.summary)})
        for story in existing.stories
    ]


def run_ingest(
    *,
    feeds: list[FeedConfig],
    http: NewsHttp,
    squad: m.Squad | None,
    coach_name: str | None,
    opponents: list[str],
    existing: m.News | None,
    now: datetime | None = None,
    threshold: int | None = None,
    dedupe_threshold: float = 0.52,
    force: bool = False,
) -> IngestResult:
    now = now or datetime.now(UTC)
    active = [feed for feed in feeds if feed.enabled]
    if not active:
        raise AllFeedsFailed("no hay feeds activos")
    fetches = fetch_all(active, http, force=force)
    if not any(fetch.ok for fetch in fetches):
        details = "; ".join(f"{fetch.feed.id}: {fetch.error}" for fetch in fetches)
        raise AllFeedsFailed(f"ninguna fuente respondió ({details})")

    index = build_index(squad, coach_name=coach_name, opponents=opponents)
    previous = _previous_stories(existing)
    candidates: list[Candidate] = []
    discarded: Counter[str] = Counter()
    for fetch in fetches:
        if not fetch.ok:
            discarded["fuente_caida"] += 1
            continue
        for entry in fetch.entries:
            if entry.published_at is None:
                discarded["sin_fecha"] += 1
                continue
            title = strip_source_suffix(entry.title, fetch.feed.name)
            summary = truncate_summary(entry.summary)
            relevance = index.evaluate(
                title,
                summary,
                depor_specific=fetch.feed.depor_specific,
                threshold=threshold,
            )
            if not relevance.relevant:
                discarded[relevance.rejected or "irrelevante"] += 1
                continue
            url = canonical_url(entry.url)
            if not url:
                discarded["url_invalida"] += 1
                continue
            candidates.append(
                Candidate(
                    title=title,
                    url=url,
                    source_id=fetch.feed.id,
                    source_name=fetch.feed.name,
                    source_group=fetch.feed.group,
                    source_priority=fetch.feed.priority,
                    kind=fetch.feed.kind,
                    published_at=entry.published_at,
                    summary=summary,
                    thumbnail_url=entry.thumbnail_url,
                    tags=build_tags(title, summary),
                    entities=index.entities(title, summary),
                    feed_id=fetch.feed.id,
                )
            )

    clusters = cluster_candidates(candidates, threshold=dedupe_threshold)
    discarded["duplicado"] += sum(max(0, len(cluster.members) - 1) for cluster in clusters)
    stories = build_stories(clusters, previous, now)
    stories = retain(stories, now, days=ROLLING_DAYS, limit=MAX_STORIES)
    report = make_report(fetches, candidates, clusters, stories, discarded)
    result = build_news(
        feeds=feeds,
        stories=stories,
        now=now,
        existing=existing,
        report=report,
    )
    result.errors = [f"{fetch.feed.id}: {fetch.error}" for fetch in fetches if fetch.error]
    return result
