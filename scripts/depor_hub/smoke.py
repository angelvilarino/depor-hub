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


def check_payloads(payloads: dict[str, bytes]) -> list[str]:
    """Devuelve una lista de fallos; vacía significa contrato publicado correcto."""
    failures: list[str] = []
    parsed: dict[str, dict[str, Any]] = {}
    for name in DOCUMENTS:
        raw = payloads.get(name)
        if raw is None:
            failures.append(f"{name}: no publicado")
            continue
        try:
            body = json.loads(raw)
        except ValueError as exc:
            failures.append(f"{name}: JSON ilegible ({exc})")
            continue
        if not isinstance(body, dict):
            failures.append(f"{name}: la raíz no es un objeto")
            continue
        model = MODELS.get(name)
        if model is not None:
            try:
                model.model_validate(body)
            except ValueError as exc:
                failures.append(f"{name}: no valida ({exc})")
                continue
        parsed[name] = body

    if all(name in parsed for name in m.SPORTS_FILES):
        expected = parsed["meta.json"].get("dataHash")
        digest = t.content_hash({name: parsed[name] for name in m.SPORTS_FILES})
        if expected != digest:
            failures.append(
                f"meta.json: dataHash {expected!r} no coincide con el contenido ({digest!r})"
            )
    return failures


def load_local(data_dir: Path) -> dict[str, bytes]:
    return {
        name: (data_dir / name).read_bytes()
        for name in DOCUMENTS
        if (data_dir / name).is_file()
    }


def fetch_published(base_url: str, timeout: float = 20.0) -> dict[str, bytes]:
    base = base_url.rstrip("/")
    payloads: dict[str, bytes] = {}
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for name in DOCUMENTS:
            response = client.get(f"{base}/v1/{name}")
            if response.status_code == 200:
                payloads[name] = response.content
    return payloads
