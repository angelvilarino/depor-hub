"""Plantilla de la Wikipedia en español: dorsales, contratos y cesiones con fecha de nacimiento.

La fecha de nacimiento es la clave de emparejamiento: evita confundir homónimos.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from urllib.parse import quote

from .htmlutil import clean_wiki, iter_templates, template_params
from .http import PoliteClient

_FOOT = {
    "izquierdo": "left",
    "izquierda": "left",
    "zurdo": "left",
    "derecho": "right",
    "derecha": "right",
    "diestro": "right",
    "ambidiestro": "both",
    "ambidiestra": "both",
    "ambidextro": "both",
}

PAGE = "Real_Club_Deportivo_de_La_Coruña"
API = "https://es.wikipedia.org/w/api.php"
TEMPLATE = "Jugador de fútbol con esquema"


@dataclass
class WikiPlayer:
    name: str
    date_of_birth: str | None
    shirt_number: int | None
    contract_until: str | None
    loan_from: str | None
    out_on_loan: bool
    source_url: str


@dataclass
class WikiProfile:
    title: str
    url: str
    date_of_birth: str | None
    birth_place: str | None
    height_cm: int | None
    weight_kg: int | None
    image_file: str | None


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _first(params: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        value = params.get(key)
        if value:
            return value
    return None


def _date_from_infobox(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(
        r"\{\{\s*(?:birth date and age|birth date|birth date and age2|birth-date and age)"
        r"\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})",
        value,
        re.I,
    )
    if match:
        return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"
    match = re.search(r"\{\{\s*fecha2?\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*(\d{4})", value, re.I)
    if match:
        return f"{int(match.group(3)):04d}-{int(match.group(2)):02d}-{int(match.group(1)):02d}"
    match = re.search(r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})", value, re.I)
    if match:
        months = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
            "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
            "noviembre": 11, "diciembre": 12,
        }
        month = months.get(_norm(match.group(2)))
        if month:
            return f"{int(match.group(3)):04d}-{month:02d}-{int(match.group(1)):02d}"
    return None


def _height_cm(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\{\{\s*altura\s*\|\s*m\s*=\s*([\d.,]+)", value, re.I)
    if match:
        return round(float(match.group(1).replace(",", ".")) * 100)
    match = re.search(r"([\d.,]+)\s*(m|cm)\b", value, re.I)
    if not match:
        return None
    amount = float(match.group(1).replace(",", "."))
    return round(amount * 100) if match.group(2).lower() == "m" else round(amount)


def _weight_kg(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\{\{\s*peso\s*\|\s*kg\s*=\s*([\d.,]+)", value, re.I)
    if match:
        return round(float(match.group(1).replace(",", ".")))
    match = re.search(r"([\d.,]+)\s*kg\b", value, re.I)
    if not match:
        return None
    return round(float(match.group(1).replace(",", ".")))


def _clean_place(value: str | None) -> str | None:
    text = clean_wiki(value).strip(" ,;()")
    return text or None


def parse_profile(wikitext: str, title: str, source_url: str) -> WikiProfile | None:
    body = None
    english = False
    for template in ("Ficha de deportista", "Ficha de futbolista", "Infobox football biography"):
        found = next(iter_templates(wikitext, template), None)
        if found:
            body = found[1]
            english = template == "Infobox football biography"
            break
    if body is None:
        return None
    params = template_params(body)
    if english:
        birth_place = _clean_place(_first(params, "birth_place", "birth place"))
        return WikiProfile(
            title=title,
            url=source_url,
            date_of_birth=_date_from_infobox(_first(params, "birth_date", "birth date")),
            birth_place=birth_place,
            height_cm=_height_cm(_first(params, "height", "height_m")),
            weight_kg=_weight_kg(_first(params, "weight", "weight_kg")),
            image_file=clean_wiki(_first(params, "image")) or None,
        )
    birth_place = _clean_place(_first(
        params,
        "lugar nacimiento",
        "lugar de nacimiento",
        "ciudaddenacimiento",
        "ciudad de nacimiento",
        "nacimiento",
    ))
    country = _clean_place(_first(
        params, "paisdenacimiento", "país de nacimiento", "pais", "país"
    ))
    if birth_place and country and _norm(country) not in _norm(birth_place):
        birth_place = f"{birth_place}, {country}"
    return WikiProfile(
        title=title,
        url=source_url,
        date_of_birth=_date_from_infobox(_first(
            params, "fecha nacimiento", "fechadenacimiento", "fecha de nacimiento"
        )),
        birth_place=birth_place,
        height_cm=_height_cm(_first(params, "altura", "estatura")),
        weight_kg=_weight_kg(_first(params, "peso")),
        image_file=clean_wiki(_first(params, "imagen", "imagen de perfil")) or None,
    )


def _section_before(wikitext: str, index: int) -> str:
    headers = list(re.finditer(r"(?:'''(?P<table>[^']+)'''|==+\s*(?P<eq>[^=]+?)\s*==+)", wikitext[:index]))
    if not headers:
        return ""
    last = headers[-1]
    return (last.group("table") or last.group("eq") or "").strip()


def _int(value: str | None) -> int | None:
    digits = re.sub(r"\D", "", value or "")
    return int(digits) if digits else None


def parse_squad_template(wikitext: str, source_url: str) -> list[WikiPlayer]:
    out: list[WikiPlayer] = []
    for index, body in iter_templates(wikitext, TEMPLATE):
        params = template_params(body)
        section = _section_before(wikitext, index)
        out_on_loan = "cesion" in _norm(section) or "OUT" in body.upper()
        if out_on_loan:
            continue

        age = re.search(r"\{\{\s*edad\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})\s*\|\s*(\d{4})", body, re.I)
        dob = f"{age.group(3)}-{int(age.group(2)):02d}-{int(age.group(1)):02d}" if age else None
        name = clean_wiki(params.get("nombre"))
        if not name:
            continue
        contract = clean_wiki(params.get("contrato"))
        contract = contract if re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", contract) else None
        note = params.get("nota", "")
        origin = clean_wiki(params.get("procedencia"))
        loan_from = None
        # "cedido" (participio) no contiene la cadena "cesion": se aceptan ambas raíces.
        is_loan = any(marker in _norm(note) for marker in ("cesion", "cedid"))
        is_loan = is_loan or any(marker in _norm(origin) for marker in ("cesion", "cedid"))
        if is_loan and origin and not origin.lower().startswith("formado"):
            loan_from = origin
        out.append(
            WikiPlayer(
                name=name,
                date_of_birth=dob,
                shirt_number=_int(params.get("num")),
                contract_until=contract,
                loan_from=loan_from,
                out_on_loan=out_on_loan,
                source_url=source_url,
            )
        )
    return out


def choose_wiki(players: list[WikiPlayer], name: str, date_of_birth: str | None) -> WikiPlayer | None:
    if date_of_birth:
        # La fecha es la clave: si no coincide, no se usa la plantilla aunque el nombre cuadre.
        exact = [p for p in players if p.date_of_birth == date_of_birth]
        return exact[0] if len(exact) == 1 else None
    normalized = _norm(name)
    matches = [p for p in players if _norm(p.name) == normalized]
    return matches[0] if len(matches) == 1 else None


class WikipediaClient:
    def __init__(self, http: PoliteClient, page: str = PAGE) -> None:
        self.http = http
        self.page = page

    def squad(self) -> tuple[list[WikiPlayer], str]:
        url = (
            f"{API}?action=parse&page={quote(self.page)}"
            "&prop=wikitext&format=json&formatversion=2&origin=*"
        )
        data = self.http.get_json(url)
        wikitext = data.get("parse", {}).get("wikitext", "")
        source_url = f"https://es.wikipedia.org/wiki/{quote(self.page.replace(' ', '_'))}"
        return parse_squad_template(wikitext, source_url), source_url

    def profile(self, title: str, lang: str = "es") -> WikiProfile | None:
        if not title:
            return None
        api = API if lang == "es" else f"https://{lang}.wikipedia.org/w/api.php"
        url = (
            f"{api}?action=parse&page={quote(title)}"
            "&prop=wikitext&format=json&formatversion=2&origin=*"
        )
        try:
            data = self.http.get_json(url)
        except Exception:
            return None
        wikitext = data.get("parse", {}).get("wikitext", "")
        source_url = f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
        return parse_profile(wikitext, title, source_url)


__all__ = [
    "WikiPlayer",
    "WikiProfile",
    "WikipediaClient",
    "choose_wiki",
    "parse_profile",
    "parse_squad_template",
]
