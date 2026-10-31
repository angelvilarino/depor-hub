"""Escritura de los JSON públicos solo si el contenido ha cambiado."""

from __future__ import annotations

import json
import os
import tempfile
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
    models = {**m.FILES, **m.NEWS_FILES, **m.EXTRA_FILES}
    # Validate the in-memory models before touching any published file.
    for name, body in files.items():
        model = models.get(name)
        if model is not None:
            model.model_validate(body)
    if not force and current_hash(out_dir) == data_hash:
        return False
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".publish-", dir=out_dir) as temp:
        staged = Path(temp)
        for name, body in files.items():
            path = staged / name
            path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            model = models.get(name)
            if model is not None:
                model.model_validate_json(path.read_text(encoding="utf-8"))
        # Replace only after every staged file is valid; publish meta last as commit marker.
        order = [name for name in files if name != "meta.json"]
        if "meta.json" in files:
            order.append("meta.json")
        for name in order:
            os.replace(staged / name, out_dir / name)
    return True


def write_optional(
    out_dir: Path,
    name: str,
    body: dict[str, Any],
    model: type[m.Public],
    force: bool = False,
) -> bool:
    """Escribe un JSON opcional (rivals.json) comparando solo su contenido."""
    model.model_validate(body)
    target = out_dir / name
    if not force and target.exists():
        try:
            if json.loads(target.read_text(encoding="utf-8")) == body:
                return False
        except (ValueError, OSError):
            pass
    out_dir.mkdir(parents=True, exist_ok=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as fh:
        temp = Path(fh.name)
        fh.write(json.dumps(body, ensure_ascii=False, indent=2) + "\n")
    try:
        model.model_validate_json(temp.read_text(encoding="utf-8"))
        os.replace(temp, target)
    finally:
        temp.unlink(missing_ok=True)
    return True
