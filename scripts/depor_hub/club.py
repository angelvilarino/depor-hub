"""Club público (H7, ADR 0025): contrato, himnos e imágenes locales.

Fuente de verdad: `data/manual/club.yml` (datos), `data/manual/himnos/<id>.txt`
(letras) y `data/manual/club_images.yml` (URLs de las imágenes). El JSON público
solo contiene rutas relativas a `data/public/v1`; la app las resuelve con la base
de datos configurada.

Reglas de este módulo:
- lo desconocido se queda en `null` y no se inventa;
- `updatedAt` solo cambia cuando cambia el contenido (escritura idempotente);
- el contrato no publica fuente, confianza ni estado de verificación.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import yaml

from . import models as m

USER_AGENT = "DeporHub/1.0 (+https://github.com/depor-hub; proyecto no oficial)"
LETA_MARKER = re.compile(r"^\s*letra\s*$", re.IGNORECASE | re.MULTILINE)


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_lyrics(path: Path) -> str | None:
    """Lee una letra y, si hay marcador `Letra`, descarta los créditos previos.

    Los ficheros pueden contener el bloque completo copiado de la web oficial.
    Solo publicamos la letra; los créditos se modelan aparte en el YAML. Las
    líneas que empiezan por `#` son comentarios y no se publican. Si no queda
    texto, se devuelve `None` (nunca una cadena vacía).
    """
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    marker = LETA_MARKER.search(text)
    if marker:
        text = text[marker.end() :]
    lines = [line.rstrip() for line in text.split("\n") if not line.lstrip().startswith("#")]
    cleaned = "\n".join(lines).strip()
    # Colapsa más de dos saltos seguidos sin tocar las estrofas.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned or None


def _lyrics_path(anthems_dir: Path, anthem_id: str, manual_dir: Path | None = None) -> Path:
    primary = anthems_dir / f"{anthem_id}.txt"
    if primary.exists() or manual_dir is None:
        return primary
    return manual_dir / f"{anthem_id}.txt"


def load_club(
    config_path: Path,
    anthems_dir: Path,
    manual_dir: Path | None = None,
    updated_at: str | None = None,
) -> m.Club:
    """Carga y valida el club completo. Lanza ValidationError si algo no cuadra."""
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{config_path} debe contener un objeto YAML")

    anthems = raw.get("anthems") or []
    if not isinstance(anthems, list):
        raise ValueError("club.anthems debe ser una lista")
    for anthem in anthems:
        if not isinstance(anthem, dict) or not anthem.get("id"):
            raise ValueError("cada himno necesita un id")
        anthem["lyrics"] = read_lyrics(
            _lyrics_path(anthems_dir, str(anthem["id"]), manual_dir)
        )

    raw["updated_at"] = updated_at or _now()
    return m.Club.model_validate(raw)


def _same_content(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    return {k: v for k, v in previous.items() if k != "updatedAt"} == {
        k: v for k, v in current.items() if k != "updatedAt"
    }


def publish_club(
    config_path: Path,
    anthems_dir: Path,
    out_dir: Path,
    manual_dir: Path | None = None,
    force: bool = False,
    now: str | None = None,
) -> tuple[bool, m.Club]:
    """Escribe club.json de forma idempotente y devuelve (cambió, club)."""
    club = load_club(config_path, anthems_dir, manual_dir, now)
    body = club.model_dump(by_alias=True, mode="json")
    target = out_dir / "club.json"

    if target.exists() and not force:
        try:
            previous = json.loads(target.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            previous = None
        if isinstance(previous, dict) and _same_content(previous, body):
            # Reutiliza la marca anterior: un refresco sin cambios no mueve la versión.
            body["updatedAt"] = previous.get("updatedAt", body["updatedAt"])
            return False, m.Club.model_validate(body)

    out_dir.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    written = m.Club.model_validate_json(target.read_text(encoding="utf-8"))
    return True, written


def season_start(season: str) -> int:
    """Devuelve el año de inicio de una temporada `AAAA-AA`."""
    return int(season[:4])


def sorted_seasons(kits: list[m.SeasonKits]) -> list[m.SeasonKits]:
    return sorted(kits, key=lambda item: season_start(item.season))


def kits_coverage(club: m.Club) -> str:
    """Informe legible de cobertura de equipaciones (se escribe junto al YAML)."""
    seasons = sorted_seasons(club.kits)
    total = sum(len(season.kits) for season in seasons)
    with_image = sum(1 for season in seasons for kit in season.kits if kit.image)
    lines = [
        "# Cobertura de equipaciones",
        "",
        "Generado por `python -m depor_hub.cli club`. No editar a mano.",
        "",
        f"- Temporadas documentadas: {len(seasons)}",
        f"- Equipaciones: {total}",
        f"- Con imagen local: {with_image}",
        f"- Sin imagen (marcador en la app): {total - with_image}",
        "",
        "| Temporada | Tipo | Fabricante | Patrocinador | Imagen |",
        "| --- | --- | --- | --- | --- |",
    ]
    for season in seasons:
        for kit in season.kits:
            lines.append(
                "| {season} | {type} | {manufacturer} | {sponsor} | {image} |".format(
                    season=season.season,
                    type=kit.type,
                    manufacturer=kit.manufacturer or "—",
                    sponsor=kit.chest_sponsor or "—",
                    image="sí" if kit.image else "no",
                )
            )
    return "\n".join(lines) + "\n"


# --- Imágenes ---------------------------------------------------------------


def _trim_transparent(image: Any) -> Any:
    from PIL import Image, ImageChops

    alpha = image.getchannel("A")
    if alpha.getextrema()[0] < 255:
        bbox = alpha.getbbox()
        return image.crop(bbox) if bbox else image

    # Fuentes con fondo blanco (JPG): recorta el margen casi blanco.
    background = image.convert("RGB")
    blank = Image.new("RGB", background.size, (255, 255, 255))
    difference = ImageChops.difference(background, blank)
    bbox = difference.convert("L").point(lambda value: 255 if value > 12 else 0).getbbox()
    return image.crop(bbox) if bbox else image


def _white_to_transparent(image: Any) -> Any:
    """Quita el fondo blanco conectado a los bordes (solo imágenes sin alfa)."""
    from PIL import ImageDraw

    width, height = image.size
    rgb = image.convert("RGB")
    marker = (255, 0, 255)
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for corner in corners:
        if min(rgb.getpixel(corner)) > 235:
            ImageDraw.floodfill(rgb, corner, marker, thresh=28)

    pixels = rgb.load()
    result = image.copy()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y] == marker:
                alpha_pixels[x, y] = 0
    result.putalpha(alpha)
    return result


def normalize_image(relative_path: str, raw: bytes) -> bytes:
    """Normaliza una imagen descargada según su ruta de destino.

    - SVG: se conserva tal cual (expo-image lo renderiza en iOS/Android).
    - Escudos: recorta el margen, limita a 512 px y guarda PNG con alfa.
    - Equipaciones: aplana sobre blanco, limita a 900 px y guarda JPEG.
    """
    suffix = Path(relative_path).suffix.lower()
    if suffix == ".svg":
        if b"<svg" not in raw[:1024].lower():
            raise ValueError(f"{relative_path} no parece un SVG válido")
        return raw

    from PIL import Image

    with Image.open(io.BytesIO(raw)) as source:
        had_alpha = source.mode in ("RGBA", "LA") or "transparency" in source.info
        image = source.convert("RGBA")
        output = io.BytesIO()
        if "/escudos/" in relative_path:
            image = _trim_transparent(image)
            if not had_alpha:
                image = _white_to_transparent(image)
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            image.save(output, format="PNG", optimize=True)
        else:
            flat = Image.new("RGB", image.size, (255, 255, 255))
            flat.paste(image, mask=image.getchannel("A"))
            flat.thumbnail((900, 900), Image.Resampling.LANCZOS)
            flat.save(output, format="JPEG", quality=82, optimize=True, progressive=True)
        return output.getvalue()


def load_image_sources(path: Path) -> dict[str, dict[str, str]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    sources = raw.get("sources")
    if not isinstance(sources, dict) or not sources:
        raise ValueError(f"{path} no contiene sources")
    clean: dict[str, dict[str, str]] = {}
    for relative_path, value in sources.items():
        if not isinstance(value, dict) or not value.get("url"):
            raise ValueError(f"la imagen {relative_path} necesita url")
        clean[str(relative_path)] = {k: str(v) for k, v in value.items() if v is not None}
    return clean


def download_images(
    sources_path: Path,
    out_dir: Path,
    interval: float = 0.6,
    force: bool = False,
    offline: bool = False,
) -> dict[str, int]:
    """Descarga y normaliza las imágenes declaradas. Devuelve contadores."""
    sources = load_image_sources(sources_path)
    stats = {"total": len(sources), "written": 0, "unchanged": 0, "missing": 0, "failed": 0}
    failures: list[str] = []

    with httpx.Client(
        follow_redirects=True,
        timeout=30.0,
        headers={"User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.8"},
    ) as client:
        for index, (relative_path, source) in enumerate(sorted(sources.items())):
            target = out_dir / relative_path
            if offline:
                if target.exists():
                    stats["unchanged"] += 1
                else:
                    stats["missing"] += 1
                continue

            if index:
                time.sleep(interval)
            try:
                response = client.get(source["url"])
                response.raise_for_status()
                data = normalize_image(relative_path, response.content)
            except Exception as exc:  # noqa: BLE001 - se informa y se sigue con las demás
                failures.append(f"{relative_path}: {exc}")
                stats["failed"] += 1
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and not force and hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(data).digest():
                stats["unchanged"] += 1
                continue
            target.write_bytes(data)
            stats["written"] += 1

    for failure in failures:
        print(f"AVISO: no se pudo descargar {failure}")
    return stats


def images_size_mb(out_dir: Path) -> float:
    folder = out_dir / "img" / "club"
    if not folder.exists():
        return 0.0
    return sum(path.stat().st_size for path in folder.rglob("*") if path.is_file()) / (1024 * 1024)
