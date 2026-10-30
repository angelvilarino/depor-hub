"""Auditoría de feeds y actualización de docs/sources.md (ADR 0018)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .feeds import FeedConfig, dump_feeds
from .http import FeedBlocked, FeedError, NewsHttp
from .parse import parse_entries
from .relevance import RelevanceIndex

START = "<!-- news-audit:start -->"
END = "<!-- news-audit:end -->"


@dataclass
class AuditRow:
    feed: FeedConfig
    status: str
    http_status: int | None
    items: int
    relevant: int
    latest: str
    images: int
    summaries: int
    error: str | None


def audit_feeds(
    feeds: list[FeedConfig],
    http: NewsHttp,
    *,
    include_disabled: bool = False,
    index: RelevanceIndex | None = None,
) -> list[AuditRow]:
    rows: list[AuditRow] = []
    for feed in feeds:
        if not feed.enabled and not include_disabled:
            continue
        try:
            response = http.fetch(feed.id, feed.feed_url, force=True)
            entries = parse_entries(feed, response.body)
            latest = max(
                (entry.published_at for entry in entries if entry.published_at),
                default=None,
            )
            relevant = len(entries)
            if index is not None:
                relevant = sum(
                    1
                    for entry in entries
                    if index.is_relevant(
                        entry.title,
                        entry.summary,
                        depor_specific=feed.depor_specific,
                    )
                )
            rows.append(
                AuditRow(
                    feed=feed,
                    status="ok" if entries else "empty",
                    http_status=response.status,
                    items=len(entries),
                    relevant=relevant,
                    latest=latest.strftime("%Y-%m-%d %H:%MZ") if latest else "—",
                    images=sum(1 for entry in entries if entry.thumbnail_url),
                    summaries=sum(1 for entry in entries if entry.summary),
                    error=None,
                )
            )
        except (FeedError, FeedBlocked, ValueError, OSError) as exc:
            rows.append(
                AuditRow(
                    feed=feed,
                    status="error",
                    http_status=None,
                    items=0,
                    relevant=0,
                    latest="—",
                    images=0,
                    summaries=0,
                    error=str(exc),
                )
            )
    return rows


def format_table(rows: list[AuditRow]) -> str:
    lines = [
        "| Fuente | Grupo | Feed | Estado | Ítems | Relevantes | Más reciente | Imagen | Resumen | Nota |",
        "|---|---|---|---|---:|---:|---|---:|---:|---|",
    ]
    for row in rows:
        feed = row.feed
        note = row.error or feed.note or ""
        if row.status == "empty" and not note:
            note = "0 ítems en esta pasada"
        if not feed.enabled and row.status == "ok":
            note = f"{note} (deshabilitado en el catálogo)".strip()
        lines.append(
            "| {name} | {group} | {url} | {status} | {items} | {relevant} | {latest} | "
            "{images}/{items} | {summaries}/{items} | {note} |".format(
                name=str(feed.name).replace("|", "\\|"),
                group=feed.group,
                url=str(feed.feed_url).replace("|", "\\|"),
                status=row.status,
                items=row.items,
                relevant=row.relevant,
                latest=row.latest,
                images=row.images,
                summaries=row.summaries,
                note=str(note).replace("|", "\\|").replace("\n", " "),
            )
        )
    return "\n".join(lines)


def update_catalog(path: Path | str, feeds: list[FeedConfig], rows: list[AuditRow]) -> bool:
    by_id = {row.feed.id: row for row in rows}
    changed = False
    for feed in feeds:
        row = by_id.get(feed.id)
        if row is None:
            continue
        if row.status == "error" and feed.enabled:
            feed.enabled = False
            feed.note = f"Deshabilitado por la auditoría: {row.error}"
            changed = True
        elif row.status == "error" and not feed.enabled and row.error:
            note = f"Deshabilitado por la auditoría: {row.error}"
            if feed.note != note:
                feed.note = note
                changed = True
    if changed:
        dump_feeds(path, feeds)
    return changed


def update_docs(path: Path | str, rows: list[AuditRow], *, now: datetime | None = None) -> None:
    now = now or datetime.now(UTC)
    target = Path(path)
    text = target.read_text(encoding="utf-8") if target.exists() else "# Fuentes de datos\n"
    stamp = now.strftime("%d-%b-%Y %H:%M UTC")
    block = (
        f"{START}\n"
        f"Auditoría automática: **{stamp}**. "
        "`Relevantes` aplica el filtro del Depor de ADR 0018.\n\n"
        f"{format_table(rows)}\n\n"
        "Los feeds con error se deshabilitan en `data/manual/news_feeds.yml`. "
        "No se intenta saltar 403/429/captchas ni muros de pago.\n"
        f"{END}"
    )
    if START in text and END in text:
        before, _, rest = text.partition(START)
        _, _, after = rest.partition(END)
        target.write_text(before + block + after, encoding="utf-8")
    else:
        target.write_text(text.rstrip() + "\n\n" + block + "\n", encoding="utf-8")
