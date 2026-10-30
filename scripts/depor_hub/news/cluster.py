"""Clústeres de historias: una tarjeta por noticia, no una por medio (ADR 0018)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Iterable

from depor_hub import models as m

from .normalize import (
    iso_utc,
    normalize_title,
    stable_id,
    title_similarity,
    title_token_overlap,
)
from .relevance import Entities

CLUSTER_WINDOW_HOURS = 48
DEFAULT_THRESHOLD = 0.52
ENTITY_THRESHOLD = 0.44
PRE_MARKERS = (
    "previa",
    "antes",
    "preview",
    "horario",
    "donde ver",
    "como ver",
    "a que hora",
    "alineaciones",
    "convocatoria",
)
POST_MARKERS = (
    "tras",
    "despues",
    "post",
    "cronica",
    "resumen",
    "1x1",
    "las notas",
    "apuntes",
    "asi te contamos",
    "victoria",
    "derrota",
    "empate",
    "resumen del",
)
EVENT_MARKERS = (
    "presenta",
    "presentacion",
    "foro",
    "ciclo",
    "tertulia",
    "evento",
    "aniversario",
    "celebra",
    "encuentro",
    "congreso",
    "festival",
)
_PROPER_PHRASE = re.compile(
    r"(?<![\w])([A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑáéíóúüñ]*(?:[ \t]+(?:de|del|da|do|dos|das|y|e|[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑáéíóúüñ]*)){1,3})"
)
_GENERIC_PROPER_PHRASES = {"el deportivo", "real club deportivo", "rc deportivo", "el depor"}
_EVENT_LEADS = set(EVENT_MARKERS) | {"de", "del", "da", "do", "dos", "das", "y", "e", "el", "la"}


@dataclass
class Candidate:
    title: str
    url: str
    source_id: str
    source_name: str
    source_group: str
    source_priority: int
    kind: str
    published_at: datetime
    summary: str | None
    thumbnail_url: str | None
    tags: list[str] = field(default_factory=list)
    entities: Entities = field(default_factory=Entities)
    feed_id: str = ""

    @property
    def url_id(self) -> str:
        return stable_id(self.url)


@dataclass
class StoryCluster:
    members: list[Candidate]
    id: str = ""
    extra_also: list[m.NewsAlsoIn] = field(default_factory=list)
    previous_story: m.NewsStory | None = None

    @property
    def representative(self) -> Candidate:
        return min(self.members, key=_order)


def _order(candidate: Candidate) -> tuple[int, datetime, str]:
    return (candidate.source_priority, candidate.published_at, candidate.url_id)


def _within_window(left: Candidate, right: Candidate) -> bool:
    return abs(left.published_at - right.published_at) <= timedelta(hours=CLUSTER_WINDOW_HOURS)


def _has_marker(title: str, markers: Iterable[str]) -> bool:
    normalized = normalize_title(title)
    return any(marker in normalized for marker in markers)


def _event_conflict(left: Candidate, right: Candidate) -> bool:
    left_pre = _has_marker(left.title, PRE_MARKERS)
    left_post = _has_marker(left.title, POST_MARKERS)
    right_pre = _has_marker(right.title, PRE_MARKERS)
    right_post = _has_marker(right.title, POST_MARKERS)
    return (left_pre and right_post) or (left_post and right_pre)


def _named_event_phrases(candidate: Candidate) -> set[str]:
    text = f"{candidate.title} {candidate.summary or ''}"
    normalized = normalize_title(text)
    if not any(marker in normalized for marker in EVENT_MARKERS):
        return set()
    phrases: set[str] = set()
    for match in _PROPER_PHRASE.findall(text):
        words = [word for word in match.split() if normalize_title(word).strip() not in _EVENT_LEADS]
        if len(words) < 2:
            continue
        phrase = normalize_title(" ".join(words)).strip()
        if phrase not in _GENERIC_PROPER_PHRASES:
            phrases.add(phrase)
    return phrases


def same_story(left: Candidate, right: Candidate, threshold: float = DEFAULT_THRESHOLD) -> bool:
    if left.url == right.url:
        return True
    if not _within_window(left, right):
        return False
    if left.source_id == right.source_id:
        # Dos entradas del mismo medio nunca se fusionan si la URL es distinta: pueden
        # ser dos noticias del mismo jugador o dos piezas distintas del mismo día.
        return False
    if _event_conflict(left, right):
        return False
    if _named_event_phrases(left) & _named_event_phrases(right):
        # Una entidad de evento compartida (en título o resumen) permite unir
        # titulares editoriales distintos sin fusionar piezas sobre un jugador.
        return True
    similarity = title_similarity(left.title, right.title)
    if similarity >= 0.82:
        return True
    overlap = title_token_overlap(left.title, right.title)
    if similarity >= threshold and overlap >= 0.55:
        # Titulares distintos pero con el mismo hecho y casi las mismas palabras.
        return True
    if similarity >= ENTITY_THRESHOLD and left.entities.has_strong_overlap(right.entities):
        # Mismo jugador/entrenador/rival y titulares parecidos. Dos noticias distintas
        # del mismo jugador quedan muy por debajo de este umbral (≈0,20).
        return True
    if similarity >= 0.62 and left.entities.overlap_score(right.entities) >= 0.5:
        return True
    return False


def cluster_candidates(
    candidates: list[Candidate], threshold: float = DEFAULT_THRESHOLD
) -> list[StoryCluster]:
    ordered = sorted(candidates, key=_order)
    clusters: list[StoryCluster] = []
    for candidate in ordered:
        target: StoryCluster | None = None
        best = 0.0
        for current in clusters:
            for member in current.members:
                if not same_story(candidate, member, threshold):
                    continue
                similarity = (
                    1.0
                    if candidate.url == member.url
                    else title_similarity(candidate.title, member.title)
                )
                if similarity > best:
                    best, target = similarity, current
        if target is None:
            clusters.append(StoryCluster([candidate]))
        else:
            target.members.append(candidate)
    return clusters


def _previous_urls(story: m.NewsStory) -> set[str]:
    return {story.url} | {alt.url for alt in story.also_in}


def assign_stable_ids(
    clusters: list[StoryCluster], previous: list[m.NewsStory]
) -> list[StoryCluster]:
    by_url: dict[str, m.NewsStory] = {}
    for story in previous:
        for url in _previous_urls(story):
            by_url.setdefault(url, story)
    used: set[str] = set()
    for cluster in clusters:
        match = next(
            (
                by_url[url]
                for member in cluster.members
                for url in [member.url]
                if url in by_url and by_url[url].id not in used
            ),
            None,
        )
        if match is not None:
            cluster.id = match.id
        else:
            cluster.id = cluster.representative.url_id
        while cluster.id in used:
            cluster.id = stable_id(cluster.id + cluster.representative.url)
        used.add(cluster.id)
    return clusters


def merge_previous(
    clusters: list[StoryCluster], previous: list[m.NewsStory], now: datetime
) -> list[StoryCluster]:
    by_url: dict[str, m.NewsStory] = {}
    for story in previous:
        for url in _previous_urls(story):
            by_url.setdefault(url, story)
    matched: set[str] = set()
    for cluster in clusters:
        member_urls = {member.url for member in cluster.members}
        for member in cluster.members:
            old = by_url.get(member.url)
            if old is None:
                continue
            matched.add(old.id)
            for alt in [old, *old.also_in]:
                if alt.url in member_urls:
                    continue
                if alt.source_id == cluster.representative.source_id:
                    continue
                if any(existing.url == alt.url for existing in cluster.extra_also):
                    continue
                cluster.extra_also.append(
                    m.NewsAlsoIn(
                        source_id=alt.source_id,
                        title=alt.title,
                        url=alt.url,
                        published_at=alt.published_at,
                    )
                )
    cutoff = now - timedelta(days=14)
    for story in previous:
        if story.id in matched:
            continue
        try:
            published = datetime.fromisoformat(story.published_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if published.astimezone(UTC) < cutoff:
            continue
        # Se conserva como historia previa; build_stories la trata como ya construida.
        clusters.append(StoryCluster(members=[], id=story.id, previous_story=story))
    return clusters


def _story_from_cluster(cluster: StoryCluster) -> m.NewsStory:
    previous = cluster.previous_story
    if previous is not None:
        return previous
    representative = cluster.representative
    alternatives: list[m.NewsAlsoIn] = []
    seen: set[tuple[str, str]] = set()
    for member in sorted(cluster.members, key=_order):
        if member.source_id == representative.source_id:
            continue
        key = (member.source_id, member.url)
        if key in seen:
            continue
        seen.add(key)
        alternatives.append(
            m.NewsAlsoIn(
                source_id=member.source_id,
                title=member.title,
                url=member.url,
                published_at=iso_utc(member.published_at),
            )
        )
    for alt in cluster.extra_also:
        key = (alt.source_id, alt.url)
        if key in seen or alt.source_id == representative.source_id:
            continue
        seen.add(key)
        alternatives.append(alt)
    tags = list(representative.tags)
    if not tags:
        counts: dict[str, int] = {}
        for member in cluster.members:
            for tag in member.tags:
                counts[tag] = counts.get(tag, 0) + 1
        tags = [tag for tag, _ in sorted(counts.items(), key=lambda item: -item[1])[:2]]
    return m.NewsStory(
        id=cluster.id or representative.url_id,
        title=representative.title,
        url=representative.url,
        source_id=representative.source_id,
        published_at=iso_utc(representative.published_at),
        kind=representative.kind,  # type: ignore[arg-type]
        summary=representative.summary
        or next((member.summary for member in cluster.members if member.summary), None),
        thumbnail_url=representative.thumbnail_url
        or next((member.thumbnail_url for member in cluster.members if member.thumbnail_url), None),
        tags=tags[:2],
        also_in=alternatives,
    )


def build_stories(
    clusters: list[StoryCluster], previous: list[m.NewsStory], now: datetime
) -> list[m.NewsStory]:
    clusters = assign_stable_ids(clusters, previous)
    clusters = merge_previous(clusters, previous, now)
    stories = [_story_from_cluster(cluster) for cluster in clusters]
    stories.sort(key=lambda story: (story.published_at, story.id), reverse=True)
    return stories


def retain(
    stories: list[m.NewsStory], now: datetime, days: int = 14, limit: int = 150
) -> list[m.NewsStory]:
    cutoff = now - timedelta(days=days)
    kept: list[m.NewsStory] = []
    for story in stories:
        try:
            published = datetime.fromisoformat(story.published_at.replace("Z", "+00:00"))
        except ValueError:
            continue
        if published.astimezone(UTC) >= cutoff:
            kept.append(story)
    kept.sort(key=lambda story: (story.published_at, story.id), reverse=True)
    return kept[:limit]
