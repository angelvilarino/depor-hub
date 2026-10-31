"""Construcción del `news.json` público, retención y informe de calibración (ADR 0018)."""

from __future__ import annotations

import json
import os
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from depor_hub import models as m

from .cluster import Candidate, StoryCluster
from .feeds import GROUP_ORDER, FeedConfig
from .fetch import FeedFetch
from .normalize import content_hash, iso_utc

ROLLING_DAYS = 14
MAX_STORIES = 150


@dataclass
class IngestResult:
    news: m.News
    changed: bool
    errors: list[str]
    report: "IngestReport"


@dataclass
class SourceReport:
    id: str
    name: str
    entries: int = 0
    relevant: int = 0
    error: str | None = None


@dataclass
class IngestReport:
    sources: list[SourceReport] = field(default_factory=list)
    discarded: Counter[str] = field(default_factory=Counter)
    cluster_sizes: Counter[int] = field(default_factory=Counter)
    tags: Counter[str] = field(default_factory=Counter)
    top_clusters: list[tuple[int, str, list[str]]] = field(default_factory=list)
    entries: int = 0
    stories: int = 0

    def render(self) -> str:
        lines = ["Informe de noticias (ventana de 14 días para calibrar)", ""]
        lines.append("Elementos por fuente:")
        for source in self.sources:
            if source.error:
                lines.append(f"  - {source.name}: ERROR · {source.error}")
            else:
                lines.append(
                    f"  - {source.name}: {source.entries} leídos · {source.relevant} relevantes"
                )
        lines.append("")
        lines.append(f"Entradas leídas: {self.entries}")
        lines.append(f"Historias publicadas: {self.stories}")
        lines.append("Descartes:")
        for reason, count in sorted(self.discarded.items(), key=lambda item: -item[1]):
            lines.append(f"  - {reason}: {count}")
        lines.append("Tamaños de clúster:")
        for size, count in sorted(self.cluster_sizes.items()):
            lines.append(f"  - {size} versión(es): {count} historia(s)")
        lines.append("Etiquetas:")
        for tag, count in sorted(self.tags.items(), key=lambda item: (-item[1], item[0])):
            lines.append(f"  - {tag}: {count}")
        lines.append("20 clústeres mayores:")
        for size, title, sources in self.top_clusters[:20]:
            lines.append(f"  - {size} · {title[:90]} · {', '.join(sources)}")
        return "\n".join(lines)


def _existing_hash(existing: m.News | None) -> str | None:
    if existing is None:
        return None
    return content_hash(existing.model_dump(mode="json", by_alias=True))


def build_news(
    *,
    feeds: list[FeedConfig],
    stories: list[m.NewsStory],
    now: datetime,
    existing: m.News | None,
    report: IngestReport,
) -> IngestResult:
    by_id = {feed.id: feed for feed in feeds if feed.enabled}
    sources = [
        m.NewsSource(
            id=feed.id,
            name=feed.name,
            group=feed.group,  # type: ignore[arg-type]
            kind=feed.kind,  # type: ignore[arg-type]
            homepage=feed.homepage,
        )
        for feed in feeds
        if feed.enabled
    ]
    sources.sort(
        key=lambda source: (GROUP_ORDER[source.group], by_id[source.id].priority, source.name)
    )
    news = m.News(updated_at=iso_utc(now), sources=sources, stories=stories)
    payload = news.model_dump(mode="json", by_alias=True)
    changed = _existing_hash(existing) != content_hash(payload)
    return IngestResult(news=news, changed=changed, errors=[], report=report)


def load_existing(path: Path | str) -> m.News | None:
    target = Path(path)
    if not target.exists():
        return None
    try:
        return m.News.model_validate_json(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_news(out_dir: Path | str, result: IngestResult, force: bool = False) -> bool:
    target = Path(out_dir)
    body = result.news.model_dump(mode="json", by_alias=True)
    m.News.model_validate(body)
    # `--force` bypasses HTTP validators in the fetch layer; it must not rewrite
    # updatedAt or create a commit when the public story content is unchanged.
    if not result.changed:
        return False
    target.mkdir(parents=True, exist_ok=True)
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    path = target / "news.json"
    if not force and path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target, delete=False) as fh:
        temp = Path(fh.name)
        fh.write(text)
    try:
        m.News.model_validate_json(temp.read_text(encoding="utf-8"))
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)
    return True


def make_report(
    fetches: list[FeedFetch],
    candidates: list[Candidate],
    clusters: list[StoryCluster],
    stories: list[m.NewsStory],
    discarded: Counter[str],
) -> IngestReport:
    relevant_by_source: Counter[str] = Counter(candidate.source_id for candidate in candidates)
    sources: list[SourceReport] = []
    for fetch in fetches:
        source = SourceReport(
            id=fetch.feed.id,
            name=fetch.feed.name,
            entries=len(fetch.entries),
            relevant=relevant_by_source.get(fetch.feed.id, 0),
            error=fetch.error,
        )
        sources.append(source)
    sizes = Counter(len(cluster.members) for cluster in clusters if cluster.members)
    tags: Counter[str] = Counter(tag for story in stories for tag in story.tags)
    top: list[tuple[int, str, list[str]]] = []
    for cluster in sorted(clusters, key=lambda item: -len(item.members)):
        if not cluster.members:
            continue
        representative = cluster.representative
        top.append(
            (
                len(cluster.members),
                representative.title,
                sorted({member.source_name for member in cluster.members}),
            )
        )
    return IngestReport(
        sources=sources,
        discarded=discarded,
        cluster_sizes=sizes,
        tags=tags,
        top_clusters=top,
        entries=sum(source.entries for source in sources),
        stories=len(stories),
    )
