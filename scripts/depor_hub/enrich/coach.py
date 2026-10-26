"""Entrenador y cuerpo técnico (ADR 0014).

Fuentes: Wikidata para los datos personales, Wikipedia (ES) para la trayectoria como
jugador y como entrenador, y la web oficial del club para la foto y el cuerpo técnico.
Nunca se inventa un miembro del staff ni una etapa: si una fuente no lo publica, no se
añade.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any
from urllib.parse import urlencode

from .htmlutil import normalize_space, strip_tags
from .http import PoliteClient, SourceError
from .wikidata import WikidataClient

WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
WIKIDATA_QID = "Q602465"
WIKI_LANG = "es"
WIKI_TITLE = "Antonio Hidalgo Morilla"

# Etiquetas que publica la web oficial, de la más larga a la más corta para que
# «Entrenador de porteros» no se confunda con «Entrenador».
ROLE_LABELS: tuple[tuple[str, str], ...] = (
    ("goalkeeping_coach", "Entrenador de porteros"),
    ("assistant_coach", "Segundo entrenador"),
    ("technical_assistant", "Asistente técnico"),
    ("fitness_coach", "Preparador físico"),
    ("rehab_coach", "Readaptador físico"),
    ("physiotherapist", "Fisioterapeuta"),
    ("nutritionist", "Nutricionista"),
    ("psychologist", "Psicólogo"),
    ("podiatrist", "Podólogo"),
    ("kit_manager", "Utillero"),
    ("head_coach", "Entrenador"),
    ("analyst", "Analista"),
    ("delegate", "Delegado"),
    ("doctor", "Médico"),
)
_ROLE_BY_LABEL = dict(ROLE_LABELS)
_ROLE_PATTERN = re.compile(
    "|".join(re.escape(label) for _, label in ROLE_LABELS), re.UNICODE
)
_ROLE_KEYS = {label: key for key, label in ROLE_LABELS}

_YEAR_RANGE = re.compile(
    r"^(\d{4})(?:\s*[-–]\s*(\d{4}|presente|actualidad|act\.?))?$", re.I
)
_WIKI_LINK = re.compile(r"\[\[([^|\]]+)(?:\|([^\]]+))?\]\]")
_TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
_REF = re.compile(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", re.I | re.S)
_TAG = re.compile(r"<[^>]+>")
_CELL_ATTR = re.compile(r"^(?:rowspan|colspan|style|bgcolor|align|width|class)\b", re.I)
_SECTION = re.compile(r"^(==+)\s*(.*?)\s*\1\s*$", re.M)


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _clean_wiki(value: str) -> str:
    text = _REF.sub("", value)
    text = _TEMPLATE.sub("", text)
    text = _TAG.sub(" ", text)
    text = _WIKI_LINK.sub(lambda m: m.group(2) or m.group(1), text)
    text = text.replace("'''", "").replace("''", "")
    text = text.replace("&nbsp;", " ")
    return normalize_space(text).strip(" |")


def _cell_value(raw: str) -> str:
    cell = raw.strip()
    if not cell:
        return ""
    # ``rowspan=2|[[Club]]``: el atributo va antes del primer «|».
    if "|" in cell and _CELL_ATTR.match(cell):
        cell = cell.split("|", 1)[1]
    return _clean_wiki(cell)


def _row_cells(chunk: str) -> list[str]:
    cells: list[str] = []
    for line in chunk.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("|}", "|+", "!")):
            continue
        if not stripped.startswith("|"):
            continue
        for part in stripped[1:].split("||"):
            cells.append(_cell_value(part))
    return [cell for cell in cells if cell]


def _section_text(wikitext: str, title: str) -> str:
    """Contenido de todas las secciones con ese título (hay «Como jugador» repetido).

    En los artículos de entrenador la primera aparición es prosa y la segunda la tabla
    de clubes; se concatenan para que el parser encuentre la tabla.
    """
    matches = list(_SECTION.finditer(wikitext))
    chunks: list[str] = []
    for index, match in enumerate(matches):
        if _norm(match.group(2)) != _norm(title):
            continue
        start = match.end()
        level = len(match.group(1))
        end = len(wikitext)
        for following in matches[index + 1 :]:
            if len(following.group(1)) <= level:
                end = following.start()
                break
        chunks.append(wikitext[start:end])
    return "\n".join(chunks)


def _first_table(block: str) -> str | None:
    start = block.find("{|")
    if start < 0:
        return None
    end = block.find("|}", start)
    if end < 0:
        return None
    return block[start : end + 2]


def _parse_year(value: str) -> tuple[str, str | None] | None:
    match = _YEAR_RANGE.fullmatch(value.strip())
    if not match:
        return None
    start = match.group(1)
    raw_end = (match.group(2) or "").strip().lower()
    if not raw_end or raw_end in {"presente", "actualidad", "act", "act."}:
        end = None if raw_end else start
    else:
        end = raw_end
    return start, end


def _is_country(value: str) -> bool:
    # Los países vienen como plantilla ({{ESP}}, {{bandera|...}}) y ya se han limpiado
    # a cadena vacía; si queda algo, no debe confundirse con un club.
    return not value or value.isupper() and len(value) <= 3


def _parse_career_table(block: str, role: str) -> list[dict[str, Any]]:
    table = _first_table(block)
    if table is None:
        return []
    entries: list[dict[str, Any]] = []
    current_club: str | None = None
    for chunk in table.split("|-")[1:]:
        cells = _row_cells(chunk)
        if not cells:
            continue
        year_index = next(
            (i for i, cell in enumerate(cells) if _parse_year(cell) is not None), None
        )
        if year_index is None:
            continue
        years = _parse_year(cells[year_index])
        if years is None:
            continue
        before = [cell for cell in cells[:year_index] if not _is_country(cell)]
        if before:
            current_club = before[0]
        if not current_club:
            continue
        # El rol puede venir en el propio nombre: «AEK Larnaca (Segundo Entrenador)».
        club = current_club
        detail = re.search(r"\(([^)]+)\)", club)
        if detail:
            club = normalize_space(club[: detail.start()])
        start, end = years
        numbers = [cell for cell in cells[year_index + 1 :] if cell.isdigit()]
        appearances = int(numbers[0]) if numbers else None
        goals = int(numbers[1]) if len(numbers) > 1 else None
        entry = {
            "club": club,
            "role": role,
            "from": start,
            "to": end,
            "appearances": appearances,
            "goals": goals,
        }
        previous = entries[-1] if entries else None
        contiguous = (
            previous is not None
            and previous["club"] == club
            and previous["role"] == role
            and previous["to"] is not None
            and int(previous["to"]) + 1 >= int(start)
        )
        if contiguous:
            previous["to"] = end if end is not None else previous["to"]
            if appearances is not None:
                previous["appearances"] = (previous["appearances"] or 0) + appearances
            if goals is not None:
                previous["goals"] = (previous["goals"] or 0) + goals
        else:
            entries.append(entry)
    return entries


def parse_wikipedia_career(wikitext: str) -> list[dict[str, Any]]:
    """Trayectoria como jugador y como entrenador desde las tablas de Wikipedia."""
    entries: list[dict[str, Any]] = []
    entries.extend(_parse_career_table(_section_text(wikitext, "Como jugador"), "player"))
    entries.extend(_parse_career_table(_section_text(wikitext, "Como entrenador"), "coach"))
    return entries


def parse_wikipedia_personal(wikitext: str) -> dict[str, str | None]:
    """Datos personales del infobox de entrenador (fechas y lugar de nacimiento)."""
    out: dict[str, str | None] = {
        "birth_date": None,
        "birth_place": None,
        "nationality": None,
    }
    date = re.search(r"\|\s*fechadenacimiento\s*=\s*([^\n]+)", wikitext, re.I)
    if date:
        parts = re.search(
            r"\{\{\s*[Ff]echa\s*\|\s*(\d{1,2})\s*\|\s*([a-záéíóúñ]+)\s*\|\s*(\d{4})",
            date.group(1),
        )
        if parts:
            months = {
                "enero": 1,
                "febrero": 2,
                "marzo": 3,
                "abril": 4,
                "mayo": 5,
                "junio": 6,
                "julio": 7,
                "agosto": 8,
                "septiembre": 9,
                "setiembre": 9,
                "octubre": 10,
                "noviembre": 11,
                "diciembre": 12,
            }
            month = months.get(_norm(parts.group(2)))
            if month:
                out["birth_date"] = (
                    f"{int(parts.group(3)):04d}-{month:02d}-{int(parts.group(1)):02d}"
                )
    place = re.search(r"\|\s*ciudaddenacimiento\s*=\s*([^\n]+)", wikitext, re.I)
    if place:
        out["birth_place"] = _clean_wiki(place.group(1)).split(",")[0].strip() or None
    nationality = re.search(r"\|\s*nacionalidad\s*=\s*([^\n]+)", wikitext, re.I)
    if nationality:
        out["nationality"] = _clean_wiki(nationality.group(1)) or None
    return out


def parse_official_staff(document: str) -> list[dict[str, str]]:
    """Cuerpo técnico publicado por la web oficial, en el orden en que aparece."""
    text = strip_tags(document)
    start = text.find("Entrenador ")
    end = text.find("Patrocinadores", start if start >= 0 else 0)
    if start < 0:
        return []
    segment = text[start:end] if end > start else text[start : start + 3000]
    matches = list(_ROLE_PATTERN.finditer(segment))
    staff: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for index, match in enumerate(matches):
        label = match.group(0)
        role = _ROLE_KEYS.get(label)
        if role is None:
            continue
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(segment)
        name = normalize_space(segment[match.end() : next_start]).strip(" ·-")
        if not name or len(name) > 80:
            continue
        key = (name, role)
        if key in seen:
            continue
        seen.add(key)
        staff.append({"name": name, "role": role})
    return staff


def parse_official_photo(document: str, name: str) -> str | None:
    """Foto oficial: ``og:image`` de la ficha es el retrato del entrenador.

    Se quita el recorte social (``?rect=...&w=...``) para conservar la imagen completa.
    Como respaldo se usa la primera foto JPG del CDN (nunca un logotipo PNG).
    """
    meta = re.search(
        r'<meta\s+property="og:image"\s+content="([^"]+)"', document, re.I
    )
    if meta:
        url = meta.group(1).replace("&amp;", "&").split("?", 1)[0]
        if url.startswith("https://scdn.ovixia.app/"):
            return url
    marker = name.replace(" ", "_").upper()
    position = document.upper().find(marker)
    scope = document[:position] if position >= 0 else document
    urls = re.findall(
        r"https://scdn\.ovixia\.app/[^\"\\ ]+\.(?:jpe?g)\?w=800[^\"\\ ]*", scope
    )
    if not urls:
        return None
    return urls[0].replace("&amp;", "&")


def _wikitext(http: PoliteClient, lang: str, title: str) -> str:
    query = urlencode(
        {
            "action": "parse",
            "page": title,
            "prop": "wikitext",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        }
    )
    try:
        data = http.get_json(WIKI_API.format(lang=lang) + "?" + query)
    except SourceError:
        return ""
    return str(data.get("parse", {}).get("wikitext") or "")


def _entity_label(entity: dict, langs: tuple[str, ...] = ("es", "gl", "en")) -> str | None:
    labels = entity.get("labels") or {}
    for lang in langs:
        value = (labels.get(lang) or {}).get("value")
        if value:
            return str(value)
    return None


def _claim_entity_id(entity: dict, pid: str) -> str | None:
    claims = entity.get("claims", {}).get(pid, [])
    if not claims:
        return None
    value = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    return value.get("id") if isinstance(value, dict) else None


def _claim_time(entity: dict, pid: str) -> str | None:
    claims = entity.get("claims", {}).get(pid, [])
    if not claims:
        return None
    value = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    if not isinstance(value, dict) or "time" not in value:
        return None
    raw = str(value["time"]).lstrip("+")
    precision = int(value.get("precision", 11))
    if precision >= 11:
        return raw[:10]
    if precision == 10:
        return raw[:7]
    return raw[:4]


def fetch_coach(
    http: PoliteClient,
    *,
    wikidata: WikidataClient | None = None,
    qid: str = WIKIDATA_QID,
    wiki_lang: str = WIKI_LANG,
    wiki_title: str = WIKI_TITLE,
    official_team_url: str | None = None,
    official_profile_url: str | None = None,
) -> dict[str, Any]:
    """Reúne los datos del entrenador desde Wikidata, Wikipedia y la web oficial."""
    wikidata = wikidata or WikidataClient(http)
    entity = wikidata.entities([qid]).get(qid, {})
    birth_date = _claim_time(entity, "P569")
    birth_place_id = _claim_entity_id(entity, "P19")
    nationality_id = _claim_entity_id(entity, "P27")
    extra_ids = [item for item in (birth_place_id, nationality_id) if item]
    labels = wikidata.entities(extra_ids) if extra_ids else {}
    birth_place = _entity_label(labels.get(birth_place_id, {})) if birth_place_id else None
    nationality = _entity_label(labels.get(nationality_id, {})) if nationality_id else None

    wikitext = _wikitext(http, wiki_lang, wiki_title)
    personal = parse_wikipedia_personal(wikitext)
    career = parse_wikipedia_career(wikitext)
    since = next(
        (
            entry["from"]
            for entry in reversed(career)
            if entry["role"] == "coach" and "deportivo" in _norm(entry["club"])
        ),
        None,
    )

    photo_url = None
    staff: list[dict[str, str]] = []
    if official_profile_url:
        try:
            profile_html = http.get(official_profile_url).text
            photo_url = parse_official_photo(profile_html, _entity_label(entity) or wiki_title)
        except SourceError:
            photo_url = None
    if official_team_url:
        try:
            staff = parse_official_staff(http.get(official_team_url).text)
        except SourceError:
            staff = []

    return {
        "name": _entity_label(entity) or wiki_title,
        "nationality": nationality or personal.get("nationality"),
        "birth_date": personal.get("birth_date") or birth_date,
        "birth_place": personal.get("birth_place") or birth_place,
        "photo_url": photo_url,
        "since": since,
        "contract_until": None,
        "career": career,
        "staff": staff,
        "source": "Wikidata + Wikipedia + web oficial",
        "confidence": "cross_checked",
    }


__all__ = [
    "ROLE_LABELS",
    "fetch_coach",
    "parse_official_photo",
    "parse_official_staff",
    "parse_wikipedia_career",
    "parse_wikipedia_personal",
]
