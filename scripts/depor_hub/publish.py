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
    for name, model in m.FILES.items():  # revalida lo escrito
        model.model_validate_json((out_dir / name).read_text(encoding="utf-8"))
    return True
