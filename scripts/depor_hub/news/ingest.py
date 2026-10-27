"""Orquestación de la ingesta de noticias: normalización, filtro, dedupe y publicación."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

from depor_hub import models as m

from .dedupe import Candidate, cluster
from .feeds import FeedConfig, load_feeds, media_identity
from .http import FeedBlocked, FeedError, NewsHttp
from .normalize import (
    canonical_url,
    content_hash,
    normalize_title,
    stable_id,
    strip_source_suffix,
    title_similarity,
    truncate_summary,
)
from .parse import ParsedEntry, parse_entries
from .relevance import RelevanceIndex, build_index
from .tags import build_tags

ROLLING_DAYS = 14
MAX_ITEMS = 400


@dataclass
class IngestResult:
    news: m.News
    sources: m.NewsSources
    changed: bool
    next_player_offset: int
    errors: list[str]


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def load_existing(path: Path | str) -> m.News | None:
    target = Path(path)
    if not target.exists():
        return None
    try:
        return m.News.model_validate_json(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def load_existing_sources(path: Path | str) -> m.NewsSources | None:
    target = Path(path)
    if not target.exists():
        return None
    try:
        return m.NewsSources.model_validate_json(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def player_feeds(squad: m.Squad | None, offset: int, count: int) -> list[FeedConfig]:
    if not squad or count <= 0:
        return []
    players = sorted(squad.players, key=lambda p: p.name)
    if not players:
        return []
    start = offset % len(players)
    selected = [players[(start + index) % len(players)] for index in range(min(count, len(players)))]
    feeds: list[FeedConfig] = []
    for player in selected:
        query = urlencode(
            {
                "q": f'"{player.name}" (Dépor OR Deportivo)',
                "hl": "es",
                "gl": "ES",
                "ceid": "ES:es",
            }
        )
        feeds.append(
            FeedConfig(
                id=f"google-news-player-{player.id}",
                name=f"Google News · {player.name}",
                kind="agregador",
                url=f"https://news.google.com/rss/search?{query}",
                media_url="https://news.google.com/",
                language="es",
                weight=12,
                keyword_filter=True,
                enabled=True,
            )
        )
    return feeds


def _previous_meta(previous: m.News | None) -> dict[str, m.NewsSourceMeta]:
    if not previous or not previous.meta:
        return {}
    return {source.feed_id: source for source in previous.meta.sources}


def _fetch(
    feeds: list[FeedConfig],
    http: NewsHttp,
    now: datetime,
    previous: m.News | None,
    force: bool,
) -> tuple[list[ParsedEntry], list[m.NewsSourceMeta], list[str]]:
    entries: list[ParsedEntry] = []
    meta: list[m.NewsSourceMeta] = []
    errors: list[str] = []
    prior = _previous_meta(previous)
    last_success = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    for feed in feeds:
        prior_meta = prior.get(feed.id)
        items = prior_meta.items if prior_meta else 0
        success_at = prior_meta.last_success_at if prior_meta else None
        error: str | None = None
        try:
            response = http.fetch(feed.id, feed.url, force=force)
            if response.not_modified:
                if success_at is None:
                    success_at = last_success
            else:
                parsed = parse_entries(feed, response.body)
                entries.extend(parsed)
                items = len(parsed)
                success_at = last_success
        except (FeedError, FeedBlocked, ValueError, OSError) as exc:
            error = str(exc)
            errors.append(f"{feed.id}: {exc}")
        meta.append(
            m.NewsSourceMeta(
                feed_id=feed.id,
                feed_name=feed.name,
                items=items,
                error=error,
                last_attempt_at=last_success,
                last_success_at=success_at,
            )
        )
    return entries, meta, errors


def _candidate(
    entry: ParsedEntry,
    index: RelevanceIndex,
    now: datetime,
    existing: dict[str, m.NewsItem],
    threshold: int,
) -> Candidate | None:
    title = strip_source_suffix(entry.title, entry.source_name)
    text = f"{title} {entry.summary or ''}".strip()
    if not index.is_relevant(text, keyword_filter=entry.feed.keyword_filter, threshold=threshold):
        return None
    canonical = canonical_url(entry.url)
    item_id = stable_id(canonical)
    published = entry.published_at
    estimated = published is None
    if published is None:
        prior = existing.get(item_id)
        if prior is not None:
            published = _parse_iso(prior.published_at)
            estimated = prior.published_estimated
        else:
            published = now
    source_id, source_name, _source_url, source_kind = media_identity(
        entry.source_name, entry.feed, entry.source_url
    )
    summary = truncate_summary(entry.summary)
    tags = build_tags(text, index)
    players = index.player_ids(text)
    kind = "video" if entry.feed.kind == "video" or entry.video_id else "article"
    return Candidate(
        id=item_id,
        title=title,
        url=canonical,
        source_id=source_id,
        source_name=source_name,
        source_kind=source_kind,
        kind=kind,
        published_at=published,
        published_estimated=estimated,
        summary=summary,
        thumbnail_url=entry.thumbnail_url,
        tags=tags,
        players=players,
        duration_seconds=entry.duration_seconds,
        video_id=entry.video_id,
        feed_id=entry.feed_id,
        source_weight=entry.feed.weight,
    )


def _same_item(left: m.NewsItem, right: m.NewsItem, threshold: float) -> bool:
    if left.id == right.id or left.url == right.url:
        return True
    try:
        delta = abs(_parse_iso(left.published_at) - _parse_iso(right.published_at))
    except ValueError:
        return False
    if delta > timedelta(days=7):
        return False
    if left.source_id == right.source_id:
        # Igual que en el clustering: del mismo medio solo se fusiona el titular idéntico.
        return normalize_title(left.title) == normalize_title(right.title)
    return title_similarity(left.title, right.title) >= threshold


def _merge_existing(
    new_items: list[m.NewsItem], existing: list[m.NewsItem], threshold: float
) -> list[m.NewsItem]:
    merged = list(new_items)
    for old in existing:
        match = next((item for item in merged if _same_item(item, old, threshold)), None)
        if match is None:
            merged.append(old)
            continue
        match.tags = sorted(set(match.tags) | set(old.tags))[:12]
        match.players = sorted(set(match.players) | set(old.players))
        if match.summary is None:
            match.summary = old.summary
        if match.thumbnail_url is None:
            match.thumbnail_url = old.thumbnail_url
        if old.source_id and old.source_id != match.source_id:
            if not any(
                alt.url == old.url and alt.source_name == old.source_name for alt in match.also_in
            ):
                match.also_in.append(
                    m.NewsAlsoIn(
                        source_name=old.source_name,
                        url=old.url,
                        source_id=old.source_id,
                    )
                )
        for alt in old.also_in:
            if alt.source_id == match.source_id:
                continue
            if not any(
                current.url == alt.url and current.source_name == alt.source_name
                for current in match.also_in
            ):
                match.also_in.append(alt)
    return merged


def _window(items: list[m.NewsItem], now: datetime) -> list[m.NewsItem]:
    cutoff = now - timedelta(days=ROLLING_DAYS)
    kept = [item for item in items if _parse_iso(item.published_at) >= cutoff]
    kept.sort(key=lambda item: (item.published_at, item.id), reverse=True)
    return kept[:MAX_ITEMS]


def _build_sources(
    items: list[m.NewsItem],
    media_urls: dict[str, str | None],
    now: datetime,
) -> m.NewsSources:
    grouped: dict[str, m.NewsSource] = {}
    for item in items:
        source_id = item.source_id or item.source_name
        current = grouped.get(source_id)
        if current is None:
            grouped[source_id] = m.NewsSource(
                id=source_id,
                name=item.source_name,
                url=media_urls.get(source_id),
                kind=item.source_kind,  # type: ignore[arg-type]
                items=1,
            )
        else:
            current.items += 1
    sources = sorted(grouped.values(), key=lambda source: source.name.casefold())
    payload = {
        "updatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": [source.model_dump(mode="json", by_alias=True) for source in sources],
    }
    return m.NewsSources(
        updated_at=payload["updatedAt"],
        data_hash=content_hash(payload),
        sources=sources,
    )


def run_ingest(
    *,
    feeds: list[FeedConfig],
    http: NewsHttp,
    squad: m.Squad | None,
    coach_name: str | None,
    opponents: list[str],
    existing: m.News | None,
    existing_sources: m.NewsSources | None,
    now: datetime | None = None,
    threshold: int = 3,
    dedupe_threshold: float = 0.82,
    player_offset: int = 0,
    player_count: int = 0,
    force: bool = False,
) -> IngestResult:
    now = now or datetime.now(UTC)
    all_feeds = [feed for feed in feeds if feed.enabled]
    all_feeds.extend(player_feeds(squad, player_offset, player_count))
    entries, meta, errors = _fetch(all_feeds, http, now, existing, force)

    existing_items = existing.items if existing else []
    index = build_index(squad, coach_name=coach_name, opponents=opponents)
    # Revalida lo ya publicado: si una regla de relevancia se endurece, los falsos
    # positivos antiguos desaparecen en la siguiente pasada en vez de quedarse 14 días.
    existing_items = [
        item
        for item in existing_items
        if item.source_kind in {"club", "video"}
        or index.is_relevant(
            f"{item.title} {item.summary or ''}",
            keyword_filter=True,
            threshold=threshold,
        )
    ]
    existing_map = {item.id: item for item in existing_items}
    candidates = [
        candidate
        for entry in entries
        if (candidate := _candidate(entry, index, now, existing_map, threshold)) is not None
    ]
    new_items = cluster(candidates, threshold=dedupe_threshold)
    merged = _merge_existing(new_items, existing_items, dedupe_threshold)
    items = _window(merged, now)

    media_urls: dict[str, str | None] = {}
    if existing_sources:
        media_urls.update({source.id: source.url for source in existing_sources.sources})
    for entry in entries:
        source_id, _name, source_url, _kind = media_identity(
            entry.source_name, entry.feed, entry.source_url
        )
        media_urls.setdefault(source_id, source_url)
        if source_url:
            media_urls[source_id] = source_url
    for feed in feeds:
        if not feed.url.startswith("https://news.google.com/"):
            media_urls.setdefault(feed.id, feed.media_url)

    sources = _build_sources(items, media_urls, now)
    payload = {
        "updatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": [item.model_dump(mode="json", by_alias=True) for item in items],
    }
    data_hash = content_hash(payload)
    news = m.News(
        updated_at=payload["updatedAt"],
        data_hash=data_hash,
        items=items,
        meta=m.NewsMeta(
            captured_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            sources=meta,
        ),
    )
    changed = existing is None or existing.data_hash != data_hash
    if existing_sources is not None:
        changed = changed or existing_sources.data_hash != sources.data_hash
    next_offset = (player_offset + player_count) % max(len(squad.players) if squad else 0, 1)
    return IngestResult(
        news=news,
        sources=sources,
        changed=changed,
        next_player_offset=next_offset,
        errors=errors,
    )


def write_news(out_dir: Path | str, result: IngestResult, force: bool = False) -> bool:
    target = Path(out_dir)
    target.mkdir(parents=True, exist_ok=True)
    changed = force or result.changed
    if not changed:
        return False
    (target / "news.json").write_text(
        json.dumps(result.news.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    (target / "sources.json").write_text(
        json.dumps(
            result.sources.model_dump(mode="json", by_alias=True), ensure_ascii=False, indent=2
        )
        + "\n",
        encoding="utf-8",
    )
    m.News.model_validate_json((target / "news.json").read_text(encoding="utf-8"))
    m.NewsSources.model_validate_json((target / "sources.json").read_text(encoding="utf-8"))
    return True


def live_feeds(path: Path | str) -> list[FeedConfig]:
    return load_feeds(path)
