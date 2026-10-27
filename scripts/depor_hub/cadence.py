"""Cadencia adaptativa de la ingesta (H5).

Durante la ventana de un partido se refresca cada 10 minutos; fuera de ella, cada 60.
El estado del último refresco no se puede deducir de ``updatedAt`` porque ese campo
solo cambia cuando cambia el contenido, así que se guarda aparte y el workflow lo
persiste con la caché de GitHub Actions.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from . import models as m

MATCH_WINDOW_BEFORE = timedelta(minutes=30)
MATCH_WINDOW_AFTER = timedelta(hours=3)
IN_WINDOW_INTERVAL = timedelta(minutes=10)
OUT_WINDOW_INTERVAL = timedelta(minutes=60)

# PAUSED es el descanso de un partido que ya empezó: sigue siendo ventana de partido.
LIVE_STATUSES = frozenset({"TIMED", "IN_PLAY", "PAUSED"})


def parse_utc(value: str) -> datetime:
    """ISO-8601 a datetime consciente de zona; sin zona se asume UTC."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def in_match_window(fixtures: m.Fixtures, now: datetime) -> bool:
    """¿Hay algún partido TIMED/en juego entre -30 min y +3 h del kickoff?"""
    for match in fixtures.matches:
        if match.status not in LIVE_STATUSES:
            continue
        kickoff = parse_utc(match.utc_date)
        if kickoff - MATCH_WINDOW_BEFORE <= now <= kickoff + MATCH_WINDOW_AFTER:
            return True
    return False


def refresh_interval(fixtures: m.Fixtures | None, now: datetime) -> timedelta:
    if fixtures is None:
        # Sin fixtures no se puede saber si hay partido: se intenta refrescar.
        return IN_WINDOW_INTERVAL
    return IN_WINDOW_INTERVAL if in_match_window(fixtures, now) else OUT_WINDOW_INTERVAL


def is_due(fixtures: m.Fixtures | None, now: datetime, last_refresh: datetime | None) -> bool:
    """Decide si toca refrescar. Sin fixtures o sin estado previo, sí."""
    if fixtures is None or last_refresh is None:
        return True
    return now - last_refresh >= refresh_interval(fixtures, now)


def load_fixtures(path: Path) -> m.Fixtures | None:
    """Lee fixtures.json; ausente o inválido = None (se tratará como «toca refrescar»)."""
    try:
        return m.Fixtures.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def read_last_refresh(path: Path) -> datetime | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        value = payload.get("lastRefreshAt")
        return parse_utc(value) if isinstance(value, str) else None
    except (OSError, ValueError, TypeError):
        return None


def write_last_refresh(path: Path, now: datetime) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    stamp = now.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    path.write_text(json.dumps({"lastRefreshAt": stamp}) + "\n", encoding="utf-8")
