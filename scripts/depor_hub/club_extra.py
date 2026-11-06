"""Ampliaciones editoriales del club: títulos, rivalidades y sondeo de medios.

Este módulo mantiene separado lo que ya publica `club.json` de los ficheros
opcionales `titles.json` y `rivalries.json`. Reglas:

- Pydantic sigue siendo el origen del contrato; este módulo solo carga YAML,
  valida y publica.
- `titles.proposed.yml` es una propuesta: nunca se aplica sola.
- El balance de rivalidades se rellena desde BDFutbol con `PoliteClient`
  (caché, robots.txt y ritmo); si falla, el bloque queda en `null`.
- El sondeo de medios no descarga binarios al repositorio: solo comprueba la
  URL, el tipo y las dimensiones, y escribe una propuesta para revisión.
"""

from __future__ import annotations

import io
import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from . import models as m
from .enrich.htmlutil import normalize_space, strip_tags
from .enrich.http import PoliteClient, SourceBlocked, SourceError
from .rivals import fetch_head_to_head

_BDFUTBOL_TEAM = "https://www.bdfutbol.com/es/e/e13.html"
_PALMARES_TABLE = re.compile(
    r'<table[^>]*class="[^"]*taula-palmares[^"]*"[^>]*>(.*?)</table>', re.S
)
_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_SEASON = re.compile(r">(\d{4}-\d{2})<")
_COUNT = re.compile(r"\s+\d+$")


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _same_content(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    return {k: v for k, v in previous.items() if k != "updatedAt"} == {
        k: v for k, v in current.items() if k != "updatedAt"
    }


def _publish(model: m.Public, target: Path, force: bool = False) -> tuple[bool, Any]:
    """Escribe un JSON opcional de forma idempotente (updatedAt solo si cambia)."""
    body = model.model_dump(by_alias=True, mode="json")
    if target.exists() and not force:
        try:
            previous = json.loads(target.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            previous = None
        if isinstance(previous, dict) and _same_content(previous, body):
            body["updatedAt"] = previous.get("updatedAt", body["updatedAt"])
            return False, type(model).model_validate(body)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return True, type(model).model_validate_json(target.read_text(encoding="utf-8"))


# --- Títulos ----------------------------------------------------------------


def load_titles(path: Path, now: str | None = None) -> m.Titles:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} debe contener un objeto YAML")
    raw.setdefault("updated_at", now or _now())
    return m.Titles.model_validate(raw)


def publish_titles(
    config_path: Path,
    out_dir: Path,
    now: str | None = None,
    force: bool = False,
) -> tuple[bool, m.Titles]:
    titles = load_titles(config_path, now)
    return _publish(titles, out_dir / "titles.json", force)


@dataclass(frozen=True)
class ProposedTitle:
    competition: str
    year: int
    season: str


def _normalize_competition(name: str) -> str | None:
    clean = _COUNT.sub("", normalize_space(name)).strip()
    lower = clean.lower()
    # BDFutbol mezcla títulos de equipo con premios individuales.
    if any(word in lower for word in ("pichichi", "zamora", "máximo goleador", "maximo goleador")):
        return None
    if lower.startswith("liga 1"):
        return "Primera División"
    if lower == "liga":
        return "Primera División"
    if lower.startswith("liga 2"):
        return "Segunda División"
    if "1a rfef" in lower or "primera federación" in lower or "primera federacion" in lower:
        return "Primera Federación"
    if lower.startswith("copa del rey"):
        return "Copa del Rey"
    if lower.startswith("supercopa"):
        return "Supercopa de España"
    if lower.startswith("concurso españa") or lower.startswith("concurso espana"):
        return "Concurso España"
    return clean or None


def _season_year(competition: str, season: str) -> int:
    """Año del título: fin de temporada en liga/copa; inicio en Supercopa y Concurso."""
    start = int(season[:4])
    if competition in {"Supercopa de España", "Concurso España"}:
        return start
    return start + 1


def parse_bdfutbol_titles(html: str, source_url: str = _BDFUTBOL_TEAM) -> list[ProposedTitle]:
    """Extrae solo títulos de equipo del bloque «Títulos» de BDFutbol."""
    table_match = _PALMARES_TABLE.search(html)
    if not table_match:
        raise SourceError("BDFutbol no publicó la tabla de títulos")
    out: list[ProposedTitle] = []
    seen: set[tuple[str, int]] = set()
    for row in _ROW.findall(table_match.group(1)):
        cells = _TD.findall(row)
        if len(cells) < 3:
            continue
        name = strip_tags(cells[1])
        competition = _normalize_competition(name)
        if not competition:
            continue
        seasons = _SEASON.findall(cells[2])
        for season in seasons:
            year = _season_year(competition, season)
            key = (competition, year)
            if key in seen:
                continue
            seen.add(key)
            out.append(ProposedTitle(competition=competition, year=year, season=season))
    out.sort(key=lambda item: (item.competition, item.year))
    return out


def titles_proposal(
    curated: m.Titles,
    proposed: list[ProposedTitle],
    source_url: str = _BDFUTBOL_TEAM,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Compara lo curado con BDFutbol sin aplicar nada automáticamente."""
    curated_by_comp: dict[str, set[int]] = {}
    for edition in curated.editions:
        curated_by_comp.setdefault(edition.competition, set()).add(edition.year)
    source_by_comp: dict[str, set[int]] = {}
    seasons_by_comp: dict[str, set[str]] = {}
    for item in proposed:
        source_by_comp.setdefault(item.competition, set()).add(item.year)
        seasons_by_comp.setdefault(item.competition, set()).add(item.season)

    conflicts: list[dict[str, Any]] = []
    only_in_source: list[dict[str, Any]] = []
    only_in_curated: list[dict[str, Any]] = []
    for competition in sorted(set(curated_by_comp) | set(source_by_comp)):
        curated_years = curated_by_comp.get(competition, set())
        source_years = source_by_comp.get(competition, set())
        if not curated_years:
            only_in_source.append(
                {
                    "competition": competition,
                    "years": sorted(source_years),
                    "seasons": sorted(seasons_by_comp.get(competition, set())),
                }
            )
        elif not source_years:
            only_in_curated.append(
                {"competition": competition, "years": sorted(curated_years)}
            )
        elif curated_years != source_years:
            conflicts.append(
                {
                    "competition": competition,
                    "curated_years": sorted(curated_years),
                    "proposed_years": sorted(source_years),
                    "seasons": sorted(seasons_by_comp.get(competition, set())),
                }
            )
    return {
        "generated_at": generated_at or _now(),
        "source": source_url,
        "note": (
            "Propuesta automática de BDFutbol. No se aplica sola: revisar y editar "
            "data/manual/titles.yml a mano. BDFutbol no cubre competiciones regionales."
        ),
        "proposed": [
            {
                "competition": competition,
                "years": sorted(years),
                "seasons": sorted(seasons_by_comp.get(competition, set())),
            }
            for competition, years in sorted(source_by_comp.items())
        ],
        "conflicts": conflicts,
        "only_in_source": only_in_source,
        "only_in_curated": only_in_curated,
    }


def write_titles_proposal(
    path: Path,
    curated: m.Titles,
    proposed: list[ProposedTitle],
    source_url: str = _BDFUTBOL_TEAM,
) -> dict[str, Any]:
    proposal = titles_proposal(curated, proposed, source_url)
    header = (
        "# Propuesta generada por `python -m depor_hub.cli club titles`.\n"
        "# No editar a mano. Los cambios se aplican únicamente en titles.yml tras revisión.\n\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        header + yaml.safe_dump(proposal, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    return proposal


# --- Rivalidades ------------------------------------------------------------


def load_rivalries(path: Path, now: str | None = None) -> m.Rivalries:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} debe contener un objeto YAML")
    raw.setdefault("updated_at", now or _now())
    return m.Rivalries.model_validate(raw)


def build_rivalries(
    config_path: Path,
    http: PoliteClient,
    now: str | None = None,
) -> m.Rivalries:
    """Carga las rivalidades curadas y rellena el balance desde BDFutbol."""
    rivalries = load_rivalries(config_path, now)
    enriched: list[m.RivalryDetail] = []
    for rivalry in rivalries.rivalries:
        if not rivalry.rival_bdfutbol_id:
            enriched.append(rivalry)
            continue
        try:
            head = fetch_head_to_head(http, rivalry.rival_bdfutbol_id)
        except SourceError as exc:
            print(f"AVISO: sin balance para {rivalry.rival}: {exc}")
            enriched.append(rivalry)
            continue
        enriched.append(rivalry.model_copy(update={"head_to_head": head}))
    return m.Rivalries(
        updated_at=now or rivalries.updated_at,
        rivalries=enriched,
    )


def publish_rivalries(
    config_path: Path,
    out_dir: Path,
    http: PoliteClient,
    now: str | None = None,
    force: bool = False,
    keep_previous_if_empty: bool = True,
) -> tuple[bool, m.Rivalries]:
    rivalries = build_rivalries(config_path, http, now)
    target = out_dir / "rivalries.json"
    if keep_previous_if_empty and not any(item.head_to_head for item in rivalries.rivalries):
        if target.exists():
            try:
                previous = m.Rivalries.model_validate_json(
                    target.read_text(encoding="utf-8")
                )
            except ValueError:
                previous = None
            if previous and any(item.head_to_head for item in previous.rivalries):
                print(
                    "AVISO: BDFutbol no devolvió ningún balance; se conserva "
                    "rivalries.json anterior.",
                    file=sys.stderr,
                )
                return False, previous
    return _publish(rivalries, target, force)


# --- Sondeo de medios -------------------------------------------------------


def load_media_candidates(path: Path) -> list[dict[str, Any]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    items = raw.get("media") if isinstance(raw, dict) else None
    if items is None:
        return []
    if not isinstance(items, list):
        raise ValueError(f"{path}: media debe ser una lista")
    clean: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict) or not item.get("url"):
            raise ValueError(f"{path}: el medio #{index + 1} necesita url")
        clean.append(dict(item))
    return clean


def _image_size(content: bytes) -> tuple[int | None, int | None, str | None]:
    try:
        from PIL import Image

        with Image.open(io.BytesIO(content)) as image:
            return image.width, image.height, image.format
    except Exception:  # noqa: BLE001 - un vídeo o un SVG no son una imagen PIL
        return None, None, None


def probe_media(
    sources_path: Path,
    http: PoliteClient,
    checked_at: str | None = None,
) -> dict[str, Any]:
    """Comprueba URLs externas y devuelve una propuesta, sin escribir en club.yml."""
    candidates = load_media_candidates(sources_path)
    items: list[dict[str, Any]] = []
    for candidate in candidates:
        record = dict(candidate)
        record.setdefault("kind", "photo")
        record.setdefault("origin", "other")
        record["checked_at"] = checked_at or _now()
        try:
            result = http.get_binary(str(candidate["url"]))
            record["status"] = "ok"
            record["final_url"] = result.final_url
            record["content_type"] = result.content_type
            if record["kind"] == "photo" or result.content_type.startswith("image/"):
                width, height, image_format = _image_size(result.content)
                record["width"] = width
                record["height"] = height
                record["format"] = image_format
        except SourceBlocked as exc:
            record["status"] = "blocked"
            record["error"] = str(exc)
        except SourceError as exc:
            record["status"] = "error"
            record["error"] = str(exc)
        items.append(record)
    return {
        "checked_at": checked_at or _now(),
        "source": str(sources_path),
        "note": (
            "Sondeo de URLs externas. No se copian binarios al repositorio. "
            "Revisar licencia y crédito antes de mover una entrada a club.yml."
        ),
        "items": items,
    }


def write_media_proposal(path: Path, result: dict[str, Any]) -> None:
    header = (
        "# Propuesta generada por `python -m depor_hub.cli club probe-media`.\n"
        "# No editar a mano. Una entrada solo pasa a club.yml con licencia y crédito revisados.\n\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        header + yaml.safe_dump(result, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
