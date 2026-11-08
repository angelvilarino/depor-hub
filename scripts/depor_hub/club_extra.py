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

_CLUB_MEDIA_START = "<!-- club-media:start -->"
_CLUB_MEDIA_END = "<!-- club-media:end -->"
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"}
_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m3u8"}
_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".ogg", ".wav"}
_SVG_WIDTH = re.compile(r'<svg[^>]*\bwidth=["\']([\d.]+)')
_SVG_HEIGHT = re.compile(r'<svg[^>]*\bheight=["\']([\d.]+)')
_SVG_VIEWBOX = re.compile(r'<svg[^>]*\bviewBox=["\']([\d.\-\s]+)["\']')


def _kind_from_path(value: str) -> str:
    suffix = Path(value).suffix.lower()
    if suffix in _VIDEO_EXTENSIONS:
        return "video"
    if suffix in _AUDIO_EXTENSIONS:
        return "audio"
    if suffix in _IMAGE_EXTENSIONS:
        return "photo"
    return "document"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "media"


def _merge_candidate(
    candidates: list[dict[str, Any]], candidate: dict[str, Any]
) -> None:
    """Une la misma ruta/URL declarada por club.yml y club_images.yml."""
    for existing in candidates:
        same_path = (
            candidate.get("path")
            and existing.get("path") == candidate.get("path")
        )
        same_url = candidate.get("url") and existing.get("url") == candidate.get("url")
        if not (same_path or same_url):
            continue
        for key, value in candidate.items():
            if value not in (None, "", []) and existing.get(key) in (None, "", []):
                existing[key] = value
        return
    candidates.append(candidate)


def _media_candidate(
    entry: dict[str, Any], context: str, source_file: str
) -> dict[str, Any]:
    url = entry.get("url")
    path = entry.get("image") if not url else None
    return {
        "id": _slug(context),
        "kind": entry.get("kind") or _kind_from_path(str(url or path or "")),
        "origin": entry.get("origin") or "other",
        "url": url,
        "path": path,
        "source_file": source_file,
        "context": context,
        "license": entry.get("license"),
        "credit": entry.get("credit"),
        "source_url": entry.get("source_url") or entry.get("sourceUrl"),
    }


def _collect_media_tree(
    node: Any, context: str, source_file: str, candidates: list[dict[str, Any]]
) -> None:
    """Recorre un YAML y recoge `media`, `photos`, `image` y `audio_url`."""
    if isinstance(node, dict):
        for key, value in node.items():
            child = f"{context}.{key}" if context else key
            if key in {"media", "photos"} and isinstance(value, list):
                for index, entry in enumerate(value):
                    if isinstance(entry, dict) and entry.get("url"):
                        _merge_candidate(
                            candidates,
                            _media_candidate(
                                entry, f"{child}[{index}]", source_file
                            ),
                        )
                continue
            if key == "image" and isinstance(value, str) and value:
                if value.startswith(("http://", "https://")):
                    _merge_candidate(
                        candidates,
                        {
                            "id": _slug(child),
                            "kind": _kind_from_path(value),
                            "origin": "other",
                            "url": value,
                            "path": None,
                            "source_file": source_file,
                            "context": child,
                        },
                    )
                else:
                    _merge_candidate(
                        candidates,
                        {
                            "id": _slug(child),
                            "kind": _kind_from_path(value),
                            "origin": "club_official",
                            "url": None,
                            "path": value,
                            "source_file": source_file,
                            "context": child,
                        },
                    )
                continue
            if key == "audio_url" and isinstance(value, str) and value:
                _merge_candidate(
                    candidates,
                    {
                        "id": _slug(child),
                        "kind": "audio",
                        "origin": "other",
                        "url": value,
                        "path": None,
                        "source_file": source_file,
                        "context": child,
                    },
                )
                continue
            _collect_media_tree(value, child, source_file, candidates)
    elif isinstance(node, list):
        for index, entry in enumerate(node):
            _collect_media_tree(
                entry, f"{context}[{index}]", source_file, candidates
            )


def _load_yaml(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return raw if isinstance(raw, dict) else {}


def collect_media_candidates(
    club_path: Path,
    titles_path: Path | None = None,
    rivalries_path: Path | None = None,
    club_images_path: Path | None = None,
    manual_media_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Descubre todos los medios del club, títulos, rivalidades y fuentes locales.

    No lee binarios ni escribe nada: solo devuelve candidatos con su contexto y
    su procedencia editorial. Las rutas locales se resuelven después contra
    `data/public/v1`.
    """
    candidates: list[dict[str, Any]] = []
    for path in (club_path, titles_path, rivalries_path):
        if path is None:
            continue
        raw = _load_yaml(path)
        if raw is None:
            continue
        _collect_media_tree(raw, "", path.name, candidates)

    images = _load_yaml(club_images_path) if club_images_path else None
    if images:
        sources = images.get("sources")
        if isinstance(sources, dict):
            for local_path, item in sources.items():
                if not isinstance(item, dict):
                    continue
                _merge_candidate(
                    candidates,
                    {
                        "id": _slug(str(local_path)),
                        "kind": _kind_from_path(str(local_path)),
                        "origin": "club_official",
                        "url": item.get("url"),
                        "path": str(local_path),
                        "source_file": club_images_path.name
                        if club_images_path
                        else "club_images.yml",
                        "context": f"sources.{local_path}",
                        "source_url": item.get("source"),
                    },
                )

    if manual_media_path:
        manual = _load_yaml(manual_media_path)
        if manual:
            items = manual.get("media")
            if items is not None and not isinstance(items, list):
                raise ValueError(f"{manual_media_path}: media debe ser una lista")
            for index, item in enumerate(items or []):
                if not isinstance(item, dict) or not item.get("url"):
                    raise ValueError(
                        f"{manual_media_path}: el medio #{index + 1} necesita url"
                    )
                _merge_candidate(
                    candidates,
                    _media_candidate(
                        item, f"media[{index}]", manual_media_path.name
                    ),
                )
    return candidates


def load_media_candidates(path: Path) -> list[dict[str, Any]]:
    """Compatibilidad: lee el antiguo `club_media.yml` de candidatos sueltos."""
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


def _svg_size(content: bytes) -> tuple[int | None, int | None, str | None]:
    head = content[:4096].decode("utf-8", errors="ignore")
    width_match = _SVG_WIDTH.search(head)
    height_match = _SVG_HEIGHT.search(head)
    if width_match and height_match:
        return (
            int(float(width_match.group(1))),
            int(float(height_match.group(1))),
            "SVG",
        )
    viewbox = _SVG_VIEWBOX.search(head)
    if viewbox:
        parts = viewbox.group(1).replace(",", " ").split()
        if len(parts) == 4:
            return (
                int(float(parts[2])),
                int(float(parts[3])),
                "SVG",
            )
    return None, None, "SVG"


def _local_media(
    record: dict[str, Any], public_root: Path | None, local_path: str
) -> None:
    record["path"] = local_path
    if public_root is None:
        record["status"] = "missing"
        record["error"] = "no se indicó la raíz pública para resolver la ruta local"
        return
    target = public_root / local_path
    if not target.exists():
        record["status"] = "missing"
        record["error"] = "no existe el fichero local"
        return
    record["local_exists"] = True
    record["local_size_bytes"] = target.stat().st_size
    suffix = target.suffix.lower()
    if suffix == ".svg":
        width, height, image_format = _svg_size(target.read_bytes())
    else:
        width, height, image_format = _image_size(target.read_bytes())
    record["local_width"] = width
    record["local_height"] = height
    record["local_format"] = image_format
    if not record.get("url"):
        record["status"] = "local"
        record["mime"] = target.suffix.lower()
        record["size_bytes"] = record["local_size_bytes"]
        record["width"] = width
        record["height"] = height
        record["format"] = image_format


def _probe_get(record: dict[str, Any], url: str, http: PoliteClient) -> None:
    try:
        fetched = http.get_binary(url)
    except SourceBlocked as exc:
        record["status"] = "blocked"
        record["error"] = str(exc)
        return
    except SourceError as exc:
        record["status"] = "broken"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return
    record["final_url"] = fetched.final_url
    record["mime"] = fetched.content_type.split(";")[0].strip() or None
    record["size_bytes"] = len(fetched.content)
    if record.get("kind") == "photo" or (record.get("mime") or "").startswith("image/"):
        width, height, image_format = _image_size(fetched.content)
        is_svg = (
            (record.get("mime") or "").endswith("svg+xml")
            or str(url).lower().split("?", 1)[0].endswith(".svg")
            or str(record.get("path") or "").lower().endswith(".svg")
        )
        if width is None and is_svg:
            width, height, image_format = _svg_size(fetched.content)
        record["width"] = width
        record["height"] = height
        record["format"] = image_format
        if width is None and not (record.get("mime") or "").startswith("image/"):
            record["status"] = "broken"
            record["error"] = (
                f"MIME {record.get('mime') or 'desconocido'} no es una imagen legible"
            )
            return
    record["status"] = "ok"


def _probe_external(record: dict[str, Any], url: str, http: PoliteClient) -> None:
    """HEAD para estado/MIME/tamaño y GET mínimo para imágenes."""
    try:
        head = http.head(url)
    except SourceBlocked as exc:
        record["status"] = "blocked"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return
    except SourceError as exc:
        if getattr(exc, "status", None) == 405:
            _probe_get(record, url, http)
            return
        record["status"] = "broken"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return

    record["http_status"] = head.status
    record["final_url"] = head.final_url
    record["mime"] = head.content_type.split(";")[0].strip() or None
    record["size_bytes"] = head.content_length
    if record.get("kind") == "photo" or (record.get("mime") or "").startswith("image/"):
        _probe_get(record, url, http)
        return
    record["status"] = "ok"


def _probe_candidates(
    candidates: list[dict[str, Any]],
    http: PoliteClient,
    checked_at: str | None,
    public_root: Path | None,
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for candidate in candidates:
        record = {
            key: value
            for key, value in candidate.items()
            if value not in (None, "", [])
        }
        record.setdefault("kind", "photo")
        record.setdefault("origin", "other")
        record["checked_at"] = checked_at or _now()
        if record.get("path"):
            _local_media(record, public_root, str(record["path"]))
        if record.get("url"):
            _probe_external(record, str(record["url"]), http)
        elif not record.get("path"):
            record["status"] = "missing"
            record["error"] = "ni URL ni ruta local"
        items.append(record)

    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    return {
        "checked_at": checked_at or _now(),
        "note": (
            "Sondeo de URLs externas y rutas locales. No se copian binarios al "
            "repositorio ni se sustituyen URLs rotas: quedan en null y se "
            "registran en docs/sources.md para revisión humana."
        ),
        "counts": counts,
        "items": items,
    }


def probe_media(
    sources_path: Path,
    http: PoliteClient,
    checked_at: str | None = None,
    public_root: Path | None = None,
) -> dict[str, Any]:
    """Comprueba las URLs de `club_media.yml` (compatibilidad con H1)."""
    candidates = load_media_candidates(sources_path)
    result = _probe_candidates(candidates, http, checked_at, public_root)
    result["source"] = str(sources_path)
    return result


def probe_club_media(
    club_path: Path,
    http: PoliteClient,
    titles_path: Path | None = None,
    rivalries_path: Path | None = None,
    club_images_path: Path | None = None,
    manual_media_path: Path | None = None,
    public_root: Path | None = None,
    checked_at: str | None = None,
) -> dict[str, Any]:
    """Sondea todos los medios del club sin tocar los YAML ni los JSON."""
    candidates = collect_media_candidates(
        club_path,
        titles_path=titles_path,
        rivalries_path=rivalries_path,
        club_images_path=club_images_path,
        manual_media_path=manual_media_path,
    )
    result = _probe_candidates(candidates, http, checked_at, public_root)
    result["source"] = str(club_path)
    result["sources"] = [
        str(path)
        for path in (
            club_path,
            titles_path,
            rivalries_path,
            club_images_path,
            manual_media_path,
        )
        if path is not None
    ]
    return result


def _md_cell(value: Any) -> str:
    return str(value if value is not None else "—").replace("|", "\\|")


def media_report_markdown(result: dict[str, Any]) -> str:
    counts = result.get("counts", {})
    checked_at = result.get("checked_at", "")
    lines = [
        _CLUB_MEDIA_START,
        f"### Sondeo de medios del club — {checked_at}",
        "",
        "Generado por `python -m depor_hub.cli club probe-media`. No sustituye "
        "ninguna URL: las rotas quedan en `null` y se listan aquí.",
        "",
        (
            f"OK: **{counts.get('ok', 0)}** · locales: **{counts.get('local', 0)}** · "
            f"rotas: **{counts.get('broken', 0)}** · bloqueadas: "
            f"**{counts.get('blocked', 0)}** · ausentes: **{counts.get('missing', 0)}**"
        ),
        "",
    ]
    problems = [
        item
        for item in result.get("items", [])
        if item.get("status") in {"broken", "blocked", "missing"}
    ]
    if problems:
        lines.extend(
            [
                "| Estado | Contexto | URL o ruta | HTTP / MIME | Motivo |",
                "|---|---|---|---|---|",
            ]
        )
        for item in problems:
            location = item.get("url") or item.get("path") or "—"
            http_mime = " / ".join(
                part
                for part in (str(item.get("http_status") or ""), item.get("mime") or "")
                if part
            )
            lines.append(
                "| "
                + " | ".join(
                    _md_cell(value)
                    for value in (
                        item.get("status"),
                        item.get("context"),
                        location,
                        http_mime or "—",
                        item.get("error") or "—",
                    )
                )
                + " |"
            )
    else:
        lines.append(
            "Sin URLs rotas, bloqueadas ni ficheros locales ausentes en el último sondeo."
        )
    lines.append(_CLUB_MEDIA_END)
    return "\n".join(lines)


def _without_checked_at(section: str) -> str:
    return re.sub(
        r"^### Sondeo de medios del club — .*$",
        "### Sondeo de medios del club",
        section,
        count=1,
        flags=re.M,
    )


def write_media_report(path: Path, result: dict[str, Any]) -> None:
    """Inserta o reemplaza la sección del sondeo en docs/sources.md.

    Si solo cambia la hora de comprobación, conserva la sección anterior para
    que una segunda pasada no ensucie el repositorio.
    """
    section = media_report_markdown(result)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if _CLUB_MEDIA_START in existing and _CLUB_MEDIA_END in existing:
        before, _, rest = existing.partition(_CLUB_MEDIA_START)
        previous = _CLUB_MEDIA_START + rest.partition(_CLUB_MEDIA_END)[0] + _CLUB_MEDIA_END
        if _without_checked_at(previous) == _without_checked_at(section):
            return
        _, _, after = rest.partition(_CLUB_MEDIA_END)
        body = before.rstrip() + "\n\n" + section + after
    else:
        body = existing.rstrip() + "\n\n" + section + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.rstrip() + "\n", encoding="utf-8")


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
