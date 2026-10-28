"""Escritura de los JSON públicos solo si el contenido ha cambiado."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import models as m


def current_hash(out_dir: Path) -> str | None:
    meta = out_dir / "meta.json"
    if not meta.exists():
        return None
    try:
        return json.loads(meta.read_text(encoding="utf-8")).get("dataHash")
    except (ValueError, OSError):
        return None


def write_if_changed(
    out_dir: Path, files: dict[str, dict[str, Any]], data_hash: str, force: bool = False
) -> bool:
    if not force and current_hash(out_dir) == data_hash:
        return False
    out_dir.mkdir(parents=True, exist_ok=True)
    # meta.json el último: si algo falla a medias, el hash viejo fuerza reintento.
    order = [n for n in files if n != "meta.json"] + ["meta.json"]
    for name in order:
        (out_dir / name).write_text(
            json.dumps(files[name], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    for name in files:  # revalida solo lo escrito
        model = {**m.FILES, **m.NEWS_FILES, **m.EXTRA_FILES}.get(name)
        if model is not None:
            model.model_validate_json((out_dir / name).read_text(encoding="utf-8"))
    return True


def write_optional(
    out_dir: Path,
    name: str,
    body: dict[str, Any],
    model: type[m.Public],
    force: bool = False,
) -> bool:
    """Escribe un JSON opcional (rivals.json) comparando solo su contenido."""
    target = out_dir / name
    if not force and target.exists():
        try:
            if json.loads(target.read_text(encoding="utf-8")) == body:
                return False
        except (ValueError, OSError):
            pass
    out_dir.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    model.model_validate_json(target.read_text(encoding="utf-8"))
    return True
