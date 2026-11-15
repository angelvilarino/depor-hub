"""Smoke test del contrato publicado (D1-01).

Comprueba que los documentos de `data/public/v1` existen, son JSON válidos,
validan con Pydantic y que `meta.dataHash` coincide con el contenido deportivo
publicado. Sirve tanto contra GitHub Pages como contra un directorio local.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from . import models as m
from . import transform as t

DOCUMENTS: tuple[str, ...] = (
    "meta.json",
    "standings.json",
    "fixtures.json",
    "squad.json",
    "season.json",
    "club.json",
    "news.json",
    "news-home.json",
    "rivals.json",
    "social.json",
    "titles.json",
    "rivalries.json",
)

MODELS: dict[str, type[m.Public]] = {
    **m.FILES,
    **m.NEWS_FILES,
    **m.EXTRA_FILES,
}


def _player_names(payloads: dict[str, bytes]) -> list[str]:
    """Nombres `players/{id}.json` que anuncia el resumen de `squad.json`."""
    raw = payloads.get("squad.json")
    if raw is None:
        return []
    try:
        summary = m.SquadSummary.model_validate_json(raw)
    except ValueError:
        return []
    return [f"players/{row.id}.json" for row in summary.players]


def _parse(
    name: str, raw: bytes, failures: list[str], parsed: dict[str, dict[str, Any]]
) -> bool:
    try:
        body = json.loads(raw)
    except ValueError as exc:
        failures.append(f"{name}: JSON ilegible ({exc})")
        return False
    if not isinstance(body, dict):
        failures.append(f"{name}: la raíz no es un objeto")
        return False
    parsed[name] = body
    return True


def check_payloads(payloads: dict[str, bytes]) -> list[str]:
    """Devuelve una lista de fallos; vacía significa contrato publicado correcto."""
    failures: list[str] = []
    parsed: dict[str, dict[str, Any]] = {}
    for name in DOCUMENTS:
        raw = payloads.get(name)
        if raw is None:
            if name in m.OPTIONAL_FILES:
                continue  # 404 explícito = la app muestra el estado vacío
            failures.append(f"{name}: no publicado")
            continue
        if not _parse(name, raw, failures, parsed):
            continue
        model = MODELS.get(name)
        if model is not None:
            try:
                model.model_validate(parsed[name])
            except ValueError as exc:
                failures.append(f"{name}: no valida ({exc})")
                parsed.pop(name, None)

    # D1-03: cada fila del resumen debe tener su detalle, y el hash los incluye.
    details = _player_names(payloads)
    for name in details:
        raw = payloads.get(name)
        if raw is None:
            failures.append(f"{name}: no publicado")
            continue
        if not _parse(name, raw, failures, parsed):
            continue
        try:
            m.Player.model_validate(parsed[name])
        except ValueError as exc:
            failures.append(f"{name}: no valida ({exc})")
            parsed.pop(name, None)

    complete = all(name in parsed for name in m.SPORTS_FILES) and all(
        name in parsed for name in details
    )
    if complete:
        expected = parsed["meta.json"].get("dataHash")
        digest = t.content_hash(
            {name: parsed[name] for name in m.SPORTS_FILES}
            | {name: parsed[name] for name in details}
        )
        if expected != digest:
            failures.append(
                f"meta.json: dataHash {expected!r} no coincide con el contenido ({digest!r})"
            )
    return failures


def load_local(data_dir: Path) -> dict[str, bytes]:
    payloads = {
        name: (data_dir / name).read_bytes()
        for name in DOCUMENTS
        if (data_dir / name).is_file()
    }
    for name in _player_names(payloads):
        target = data_dir / name
        if target.is_file():
            payloads[name] = target.read_bytes()
    return payloads


def fetch_published(base_url: str, timeout: float = 20.0) -> dict[str, bytes]:
    base = base_url.rstrip("/")
    payloads: dict[str, bytes] = {}
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for name in DOCUMENTS:
            response = client.get(f"{base}/v1/{name}")
            if response.status_code == 200:
                payloads[name] = response.content
        for name in _player_names(payloads):
            response = client.get(f"{base}/v1/{name}")
            if response.status_code == 200:
                payloads[name] = response.content
    return payloads
