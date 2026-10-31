"""Cliente HTTP para feeds: ETag/If-Modified-Since, caché y ritmo por dominio (ADR 0016)."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

import httpx

from depor_hub.enrich.http import DEFAULT_USER_AGENT, SourceBlocked, SourceError


class FeedError(SourceError):
    """El feed no se pudo leer o no es un feed."""


class FeedBlocked(SourceBlocked):
    """403, 429, captcha o petición no permitida: no se insiste."""


@dataclass(frozen=True)
class FeedResponse:
    feed_id: str
    url: str
    final_url: str
    status: int
    body: bytes
    from_cache: bool = False
    not_modified: bool = False
    etag: str | None = None
    last_modified: str | None = None


def _host(url: str) -> str:
    return (urlparse(url).netloc or "").lower()


def _is_feed(body: bytes) -> bool:
    head = body[:4096].lstrip().lower()
    if not head:
        return False
    if head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        return False
    return any(marker in head for marker in (b"<rss", b"<feed", b"<rdf:rdf", b"<?xml"))


class NewsHttp:
    """GET educado con caché de cuerpo y metadatos de validación.

    La caché vive en `data/raw/news/` (ignorada por git) y se restaura en Actions con
    `actions/cache`. Un 304 reutiliza el cuerpo anterior. Un 403/429 no se reintenta.
    """

    def __init__(
        self,
        cache_dir: Path | str,
        contact: str = "contacto-no-configurado",
        interval: float = 1.0,
        timeout: float = 25.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        offline: bool = False,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.interval = interval
        self.offline = offline
        self.sleep = sleep
        self._last: dict[str, float] = {}
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            transport=transport,
            headers={
                "User-Agent": DEFAULT_USER_AGENT.format(contact=contact),
                "Accept": "application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.5",
                "Accept-Language": "es-ES,es;q=0.9,gl;q=0.8,en;q=0.6",
            },
        )

    def close(self) -> None:
        self._client.close()

    def _paths(self, feed_id: str) -> tuple[Path, Path]:
        return self.cache_dir / f"{feed_id}.xml", self.cache_dir / f"{feed_id}.meta.json"

    def _read_meta(self, feed_id: str) -> dict:
        _, meta_path = self._paths(feed_id)
        if not meta_path.exists():
            return {}
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _read_cache(self, feed_id: str) -> tuple[bytes, dict] | None:
        body_path, _ = self._paths(feed_id)
        if not body_path.exists():
            return None
        return body_path.read_bytes(), self._read_meta(feed_id)

    def _write_cache(
        self,
        feed_id: str,
        body: bytes,
        *,
        url: str,
        final_url: str,
        etag: str | None,
        last_modified: str | None,
    ) -> None:
        body_path, meta_path = self._paths(feed_id)
        body_path.write_bytes(body)
        meta_path.write_text(
            json.dumps(
                {
                    "url": url,
                    "finalUrl": final_url,
                    "etag": etag,
                    "lastModified": last_modified,
                    "fetchedAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "sha256": __import__("hashlib").sha256(body).hexdigest(),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    def _throttle(self, host: str) -> None:
        last = self._last.get(host)
        if last is not None:
            wait = self.interval - (time.monotonic() - last)
            if wait > 0:
                self.sleep(wait)
        self._last[host] = time.monotonic()

    def fetch(self, feed_id: str, url: str, *, force: bool = False) -> FeedResponse:
        cached = self._read_cache(feed_id)
        if self.offline:
            if cached is None:
                raise FeedError(f"sin caché para {feed_id} (modo offline)")
            body, meta = cached
            return FeedResponse(
                feed_id=feed_id,
                url=url,
                final_url=meta.get("finalUrl") or url,
                status=200,
                body=body,
                from_cache=True,
                etag=meta.get("etag"),
                last_modified=meta.get("lastModified"),
            )

        headers: dict[str, str] = {}
        if cached is not None and not force:
            _, meta = cached
            # Los validadores solo valen para la misma URL: al cambiar una consulta
            # (por ejemplo, la rotación de jugadores) hay que pedir el cuerpo nuevo.
            if meta.get("url") == url:
                if meta.get("etag"):
                    headers["If-None-Match"] = str(meta["etag"])
                if meta.get("lastModified"):
                    headers["If-Modified-Since"] = str(meta["lastModified"])

        self._throttle(_host(url))
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self._client.get(url, headers=headers)
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < 2:
                    self.sleep(1.0 + attempt)
                    continue
                raise FeedError(f"error de red en {url}: {exc}") from exc

            if response.status_code == 304:
                if cached is None:
                    # El servidor pidió validar algo que ya no tenemos: repetimos sin condición.
                    headers = {}
                    continue
                body, meta = cached
                return FeedResponse(
                    feed_id=feed_id,
                    url=url,
                    final_url=meta.get("finalUrl") or str(response.url),
                    status=304,
                    body=body,
                    from_cache=True,
                    not_modified=True,
                    etag=meta.get("etag"),
                    last_modified=meta.get("lastModified"),
                )
            if response.status_code in {403, 429} or response.status_code == 202:
                retry = response.headers.get("Retry-After")
                detail = f"Retry-After={retry}" if retry else "sin Retry-After"
                raise FeedBlocked(f"{response.status_code} en {url} ({detail}); no se insiste")
            if response.status_code in {500, 502, 503, 504} and attempt < 2:
                self.sleep(1.0 + attempt)
                continue
            if response.status_code >= 400:
                raise FeedError(f"{response.status_code} en {url}")

            body = response.content
            if not _is_feed(body):
                content_type = response.headers.get("content-type", "")
                raise FeedError(f"{url} no devuelve un feed (content-type={content_type!r})")
            self._write_cache(
                feed_id,
                body,
                url=url,
                final_url=str(response.url),
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
            )
            return FeedResponse(
                feed_id=feed_id,
                url=url,
                final_url=str(response.url),
                status=response.status_code,
                body=body,
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
            )

        raise FeedError(f"no se pudo leer {url}: {last_error}")
