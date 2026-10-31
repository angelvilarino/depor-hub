"""Cliente HTTP educado para enriquecimiento: caché, robots.txt, ritmo y bloqueos explícitos.

No intenta saltarse 403/429, captchas ni muros de pago. Si una fuente no quiere que la
leamos, se registra el motivo y se sigue con las demás.
"""

from __future__ import annotations

import hashlib
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlparse

import httpx

DEFAULT_USER_AGENT = "DeporHubBot/0.1 (+https://github.com/angelvilarino/depor-hub; contacto: {contact})"


class SourceError(RuntimeError):
    """La fuente respondió algo que no podemos interpretar."""


class SourceBlocked(SourceError):
    """403, 429, captcha o robots.txt: no se insiste."""


@dataclass(frozen=True)
class FetchResult:
    url: str
    final_url: str
    status: int
    text: str
    from_cache: bool = False


def _cache_name(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest() + ".txt"


def _host(url: str) -> str:
    return urlparse(url).netloc.lower()


def _robots_allows(robots: str, path: str, agent: str = "*") -> bool:
    """Parser mínimo de robots.txt: reglas de grupo, la más específica gana."""
    groups: list[tuple[list[str], list[str], list[str]]] = []
    current_agents: list[str] = []
    current_allow: list[str] = []
    current_disallow: list[str] = []
    for raw in robots.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            if current_agents and (current_allow or current_disallow):
                groups.append((current_agents, current_allow, current_disallow))
                current_agents, current_allow, current_disallow = [], [], []
            current_agents.append(value.lower())
        elif key in {"allow", "disallow"}:
            (current_allow if key == "allow" else current_disallow).append(value)
    if current_agents:
        groups.append((current_agents, current_allow, current_disallow))

    best_len = -1
    allowed = True
    for agents, allows, disallows in groups:
        if agent not in agents and "*" not in agents:
            continue
        for pattern in disallows:
            if pattern and path.startswith(pattern) and len(pattern) > best_len:
                best_len, allowed = len(pattern), False
        for pattern in allows:
            if pattern and path.startswith(pattern) and len(pattern) >= best_len:
                best_len, allowed = len(pattern), True
    return allowed


class PoliteClient:
    """GET con caché en disco y al menos `interval` segundos entre peticiones por host."""

    def __init__(
        self,
        cache_dir: Path | str | None = None,
        contact: str = "contacto-no-configurado",
        interval: float = 1.0,
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        offline: bool = False,
        cache_ttl: float = 24 * 60 * 60,
    ) -> None:
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.contact = contact
        self.interval = interval
        self.timeout = timeout
        self.transport = transport
        self.sleep = sleep
        self.offline = offline
        self.cache_ttl = cache_ttl
        self._last: dict[str, float] = {}
        self._robots: dict[str, str] = {}
        self.user_agent = DEFAULT_USER_AGENT.format(contact=contact)
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            transport=transport,
            headers={
                "User-Agent": self.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
            },
        )

    def close(self) -> None:
        self._client.close()

    def _cache_path(self, url: str) -> Path | None:
        return self.cache_dir / _cache_name(url) if self.cache_dir else None

    def _read_cache(self, url: str) -> FetchResult | None:
        path = self._cache_path(url)
        if not path or not path.exists():
            return None
        if not self.offline and time.time() - path.stat().st_mtime > self.cache_ttl:
            return None
        return FetchResult(url=url, final_url=url, status=200, text=path.read_text("utf-8"), from_cache=True)

    def _write_cache(self, url: str, text: str) -> None:
        path = self._cache_path(url)
        if path:
            path.write_text(text, encoding="utf-8")

    def _throttle(self, host: str) -> None:
        last = self._last.get(host)
        if last is not None:
            wait = self.interval - (time.monotonic() - last)
            if wait > 0:
                self.sleep(wait)
        self._last[host] = time.monotonic()

    def _robots_for(self, url: str) -> str:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin in self._robots:
            return self._robots[origin]
        robots_url = urljoin(origin, "/robots.txt")
        try:
            response = self._client.get(robots_url)
            text = response.text if response.status_code < 400 else ""
        except httpx.HTTPError:
            text = ""
        self._robots[origin] = text
        return text

    def get(self, url: str, *, cache: bool = True, check_robots: bool = True) -> FetchResult:
        if cache:
            cached = self._read_cache(url)
            if cached:
                return cached
        if self.offline:
            raise SourceBlocked(f"sin caché para {url} (modo offline)")
        if check_robots:
            path = urlparse(url).path or "/"
            if not _robots_allows(self._robots_for(url), path, "*"):
                raise SourceBlocked(f"robots.txt no permite {path} en {_host(url)}")

        self._throttle(_host(url))
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self._client.get(url)
            except httpx.HTTPError as exc:
                last_error = exc
                if attempt < 2:
                    self.sleep(1.0 + attempt)
                    continue
                raise SourceError(f"error de red en {url}: {exc}") from exc
            if response.status_code in {403, 429} or response.status_code == 202:
                retry = response.headers.get("Retry-After")
                detail = f"Retry-After={retry}" if retry else "sin Retry-After"
                raise SourceBlocked(f"{response.status_code} en {url} ({detail}); no se insiste")
            if response.status_code in {500, 502, 503, 504} and attempt < 2:
                self.sleep(1.0 + attempt)
                continue
            if response.status_code >= 400:
                raise SourceError(f"{response.status_code} en {url}")
            text = response.text
            if cache:
                self._write_cache(url, text)
            return FetchResult(
                url=url,
                final_url=str(response.url),
                status=response.status_code,
                text=text,
            )
        raise SourceError(f"no se pudo leer {url}: {last_error}")

    def get_json(self, url: str, *, cache: bool = True, check_robots: bool = False) -> dict:
        import json

        result = self.get(url, cache=cache, check_robots=check_robots)
        try:
            return json.loads(result.text)
        except json.JSONDecodeError as exc:
            raise SourceError(f"JSON inválido en {url}") from exc


def contact_from_env() -> str:
    return os.environ.get("CONTACT_EMAIL", "contacto-no-configurado")
