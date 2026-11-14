"""Cadencia adaptativa de la ingesta (H5).

La pasada diaria de `data-refresh.yml` es la base. En un día de partido,
`data-matchday.yml` lanza esa pasada cada 10 minutos dentro de la ventana del
encuentro; fuera de ella el intervalo mínimo es de 55 minutos. El estado del
último refresco no se puede deducir de ``updatedAt`` porque ese campo solo
cambia cuando cambia el contenido, así que se guarda aparte y el workflow lo
persiste con la caché de GitHub Actions.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from . import models as m

MATCH_WINDOW_BEFORE = timedelta(minutes=30)
MATCH_WINDOW_AFTER = timedelta(minutes=150)
IN_WINDOW_INTERVAL = timedelta(minutes=10)
# 55 min y no 60: el cron horario puede dispararse 59 min después de la pasada
# anterior (por ejemplo, 12:05 -> 13:00) y con 60 se saltaría, dejando un hueco
# de casi dos horas. El objetivo operativo sigue siendo «una vez por hora».
OUT_WINDOW_INTERVAL = timedelta(minutes=55)

# PAUSED es el descanso de un partido que ya empezó: sigue siendo ventana de partido.
LIVE_STATUSES = frozenset({"TIMED", "IN_PLAY", "PAUSED"})

# El supervisor de día de partido arranca cuando la ventana está a menos de 2,5 h.
# Así un checkpoint cada 2 h cubre cualquier kickoff sin mantener un runner 14 h.
MATCHDAY_LEAD = timedelta(minutes=150)


@dataclass(frozen=True)
class MatchdayPlan:
    """Ventana en la que el supervisor debe refrescar cada 10 minutos."""

    active: bool
    start: datetime | None
    until: datetime | None


def parse_utc(value: str) -> datetime:
    """ISO-8601 a datetime consciente de zona; sin zona se asume UTC."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def in_match_window(fixtures: m.Fixtures, now: datetime) -> bool:
    """¿Hay algún partido confirmado/en juego entre -30 min y +150 min del kickoff?"""
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


def plan_matchday(
    fixtures: m.Fixtures, now: datetime, lead: timedelta = MATCHDAY_LEAD
) -> MatchdayPlan:
    """¿Debe arrancar el supervisor de partido y hasta cuándo?

    Devuelve una ventana que empieza cuando toca lanzar el primer refresco y
    termina 150 min después del último kickoff aplicable. Un partido sin hora
    confirmada (`SCHEDULED`) no abre la ventana.
    """
    windows: list[tuple[datetime, datetime]] = []
    for match in fixtures.matches:
        if match.status not in LIVE_STATUSES:
            continue
        kickoff = parse_utc(match.utc_date)
        start = kickoff - MATCH_WINDOW_BEFORE
        until = kickoff + MATCH_WINDOW_AFTER
        if now < start - lead or now > until:
            continue
        windows.append((start, until))
    if not windows:
        return MatchdayPlan(False, None, None)
    start = max(now, min(window[0] for window in windows))
    until = max(window[1] for window in windows)
    return MatchdayPlan(True, start, until)


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
