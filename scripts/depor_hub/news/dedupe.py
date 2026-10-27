"""Deduplicación entre medios y construcción del ítem principal (ADR 0016)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from depor_hub import models as m

from .normalize import normalize_title, title_similarity


@dataclass
class Candidate:
    id: str
    title: str
    url: str
    source_id: str
    source_name: str
    source_kind: str
    kind: str
    published_at: datetime
    published_estimated: bool
    summary: str | None
    thumbnail_url: str | None
    tags: list[str] = field(default_factory=list)
    players: list[int] = field(default_factory=list)
    duration_seconds: int | None = None
    video_id: str | None = None
    feed_id: str = ""
    source_weight: int = 0


def _within_window(left: Candidate, right: Candidate, days: int = 7) -> bool:
    return abs(left.published_at - right.published_at) <= timedelta(days=days)


def _same_story(left: Candidate, right: Candidate, threshold: float) -> bool:
    if left.url == right.url:
        return True
    if not _within_window(left, right):
        return False
    if left.source_id == right.source_id:
        # Google News puede devolver varias URLs para el mismo artículo del mismo medio.
        # Solo se fusionan si el titular normalizado es idéntico; dos noticias distintas
        # del mismo medio nunca se mezclan por parecido.
        return normalize_title(left.title) == normalize_title(right.title)
    return title_similarity(left.title, right.title) >= threshold


def _order(candidate: Candidate) -> tuple[int, datetime, str]:
    return (-candidate.source_weight, candidate.published_at, candidate.id)


def _principal(cluster: list[Candidate]) -> Candidate:
    return min(
        cluster,
        key=lambda c: (-c.source_weight, c.published_at, c.id),
    )


def _item(cluster: list[Candidate]) -> m.NewsItem:
    principal = _principal(cluster)
    others = [candidate for candidate in cluster if candidate is not principal]
    others.sort(key=_order)

    thumbnail = principal.thumbnail_url or next(
        (candidate.thumbnail_url for candidate in others if candidate.thumbnail_url), None
    )
    summary = principal.summary or next(
        (candidate.summary for candidate in others if candidate.summary), None
    )
    tags = sorted({tag for candidate in cluster for tag in candidate.tags})[:12]
    players = sorted({player for candidate in cluster for player in candidate.players})
    also_in: list[m.NewsAlsoIn] = []
    seen: set[tuple[str, str]] = set()
    for candidate in others:
        key = (candidate.source_name, candidate.url)
        if candidate.source_id == principal.source_id or key in seen:
            continue
        seen.add(key)
        also_in.append(
            m.NewsAlsoIn(
                source_name=candidate.source_name,
                url=candidate.url,
                source_id=candidate.source_id,
            )
        )

    return m.NewsItem(
        id=principal.id,
        title=principal.title,
        url=principal.url,
        source_id=principal.source_id,
        source_name=principal.source_name,
        source_kind=principal.source_kind,  # type: ignore[arg-type]
        kind=principal.kind,  # type: ignore[arg-type]
        published_at=principal.published_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        published_estimated=principal.published_estimated,
        thumbnail_url=thumbnail,
        summary=summary,
        tags=tags,
        players=players,
        also_in=also_in,
        duration_seconds=principal.duration_seconds,
        video_id=principal.video_id,
    )


def cluster(candidates: list[Candidate], threshold: float = 0.82) -> list[m.NewsItem]:
    ordered = sorted(candidates, key=_order)
    clusters: list[list[Candidate]] = []
    for candidate in ordered:
        target: list[Candidate] | None = None
        best = 0.0
        for current in clusters:
            for other in current:
                if not _same_story(candidate, other, threshold):
                    continue
                similarity = 1.0 if candidate.url == other.url else title_similarity(
                    candidate.title, other.title
                )
                if similarity > best:
                    best, target = similarity, current
        if target is None:
            clusters.append([candidate])
        else:
            target.append(candidate)

    items = [_item(current) for current in clusters]
    items.sort(key=lambda item: (item.published_at, item.id), reverse=True)
    return items
