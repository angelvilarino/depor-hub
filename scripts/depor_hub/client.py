"""Cliente mínimo de football-data.org v4: limitador de ritmo, reintentos y volcado de crudo."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

import httpx

BASE_URL = "https://api.football-data.org/v4"
MIN_INTERVAL_S = 6.5  # plan gratuito: 10 peticiones/min -> margen sobre 6 s
MAX_ATTEMPTS = 3


class FootballDataError(RuntimeError):
    pass


class Client:
    def __init__(
        self,
        token: str,
        contact: str,
        raw_dir: Path | None = None,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        if not token:
            raise FootballDataError("Falta FOOTBALL_DATA_TOKEN")
        self._http = httpx.Client(
            base_url=BASE_URL,
            timeout=30,
            transport=transport,
            headers={
                "X-Auth-Token": token,
                "User-Agent": f"DeporHub/0.1 (fan project, non-commercial; contact: {contact})",
            },
        )
        self._raw_dir = raw_dir
        self._sleep = sleep
        self._mono = monotonic
        self._last: float | None = None

    def _throttle(self) -> None:
        if self._last is not None:
            wait = MIN_INTERVAL_S - (self._mono() - self._last)
            if wait > 0:
                self._sleep(wait)

    def _save_raw(self, path: str, body: Any) -> None:
        if not self._raw_dir:
            return
        self._raw_dir.mkdir(parents=True, exist_ok=True)
        name = path.strip("/").replace("/", "_") or "root"
        out = self._raw_dir / f"{date.today().isoformat()}_{name}.json"
        out.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            self._throttle()
            resp = self._http.get(path, params=params)
            self._last = self._mono()
            if resp.status_code == 200:
                body = resp.json()
                self._save_raw(path, body)
                return body
            retryable = resp.status_code == 429 or resp.status_code >= 500
            if retryable and attempt < MAX_ATTEMPTS:
                default = 60.0 if resp.status_code == 429 else 5.0 * attempt
                try:
                    wait = float(resp.headers.get("Retry-After", default))
                except ValueError:
                    wait = default
                self._sleep(wait)
                continue
            try:
                detail = resp.json().get("message", "")
            except ValueError:
                detail = resp.text[:200]
            raise FootballDataError(f"{resp.status_code} en {path}: {detail}")
        raise FootballDataError(f"Sin respuesta válida en {path}")  # pragma: no cover
