"""Web oficial del club: plantilla y fichas de jugador.

La ficha de `/es/jugadores/depor/<slug>` trae, en el HTML servido, la altura visible y
un bloque de datos con fecha de nacimiento, pie preferido, redes y la foto del CDN.
Se usa como fuente oficial; nunca se inventan valores que la página no muestre.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from urllib.parse import urljoin

from .htmlutil import normalize_space, strip_tags
from .http import PoliteClient, SourceError

TEAM_URL = "https://www.rcdeportivo.es/es/depor"
FABRIL_URL = "https://www.rcdeportivo.es/es/depor-fabril"
_PROFILE_HREF = re.compile(r'href="(/es/jugadores/(?:depor|depor-fabril)/[^"]+)"')

_NUMBERED = re.compile(
    r"(?<!\d)(\d{1,2})\.\s*([A-ZÁÉÍÓÚÑÜ][\w.'’\-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][\w.'’\-]+){0,3})"
)
_SPANISH_DATE = re.compile(r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})", re.I)
_CDN_PHOTO = re.compile(
    r"https://cdn\.bff\.rcdeportivo\.app/players/\d+-(?:large|small)(?:\?v=\d+)?"
)
_IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
_MONTHS = {
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
_FEET = {
    "derecho": "right",
    "derecha": "right",
    "diestro": "right",
    "izquierdo": "left",
    "izquierda": "left",
    "zurdo": "left",
    "ambidiestro": "both",
    "ambidiestra": "both",
    "ambidextro": "both",
}


@dataclass
class OfficialPlayer:
    name: str
    shirt_number: int
    source_url: str


@dataclass
class OfficialProfile:
    name: str
    date_of_birth: str | None
    height_cm: int | None
    preferred_foot: str | None
    photo_url: str | None
    social: dict[str, str | None] = field(default_factory=dict)
    contract_until: str | None = None
    source_url: str = ""


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _parse_spanish_date(text: str | None) -> str | None:
    if not text:
        return None
    match = _SPANISH_DATE.search(text)
    if not match:
        return None
    month = _MONTHS.get(_norm(match.group(2)))
    if not month:
        return None
    return f"{int(match.group(3)):04d}-{month:02d}-{int(match.group(1)):02d}"


def _parse_height(document: str) -> int | None:
    # En la ficha: <h2>1,93</h2><h3>Altura</h3>
    match = re.search(
        r">\s*([12]),(\d{2})\s*</h[23]>\s*<h[23][^>]*>\s*Altura\s*<", document, re.I
    )
    if not match:
        return None
    return int(f"{match.group(1)}{match.group(2)}")


def _parse_title(document: str) -> str | None:
    match = re.search(r"<title>(.*?)</title>", document, re.S | re.I)
    if not match:
        return None
    title = strip_tags(match.group(1))
    name = title.split("|", 1)[0].strip()
    return name or None


def _parse_photo(document: str, after: int | None = None) -> str | None:
    """La primera foto del CDN después de los datos del jugador es la suya."""
    matches = list(_CDN_PHOTO.finditer(document))
    if not matches:
        return None
    if after is not None:
        for match in matches:
            if match.start() > after:
                return re.sub(r"-(?:small|medium)(?=\?)", "-large", match.group(0))
    return re.sub(r"-(?:small|medium)(?=\?)", "-large", matches[0].group(0))


_SOCIAL_URL = {
    "x": re.compile(r"https?://(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]+)", re.I),
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)", re.I),
    "tiktok": re.compile(r"https?://(?:www\.)?tiktok\.com/@?([A-Za-z0-9_.]+)", re.I),
}
_SOCIAL_RESERVED = {
    "rcdeportivo",
    "realclubdeportivo",
    "intent",
    "share",
    "home",
    "hashtag",
    "explore",
    "p",
    "reel",
}


def _parse_social(document: str) -> dict[str, str | None]:
    """Redes del jugador; se descartan las cuentas del propio club.

    El HTML incrusta las URLs en un bloque JSON con formatos distintos según la ficha
    (`"platform","https://x.com/..."`, `"instagram","https://..."`, etc.), así que se
    buscan todas y se filtra la primera cuenta que no sea del club ni una ruta del sitio.
    """
    plain = document.replace('\\"', '"')
    social: dict[str, str | None] = {"x": None, "instagram": None, "tiktok": None}
    for network, pattern in _SOCIAL_URL.items():
        for match in pattern.finditer(plain):
            handle = match.group(1).rstrip("/").lstrip("@")
            if not handle or handle.lower() in _SOCIAL_RESERVED:
                continue
            social[network] = handle
            break
    return social


def parse_official_profile(document: str, source_url: str) -> OfficialProfile:
    plain = document.replace('\\"', '"')
    dob_match = re.search(r'"Nacimiento"\s*,\s*"([^"]+)"', plain)
    foot_match = re.search(r'"Pie preferido"\s*,\s*"([^"]+)"', plain)
    dob = _parse_spanish_date(dob_match.group(1)) if dob_match else _parse_spanish_date(strip_tags(document))
    dob_pos = dob_match.start() if dob_match else None
    name = _parse_title(document)
    if not name:
        name = source_url.rstrip("/").rsplit("/", 1)[-1]
    foot = None
    if foot_match:
        foot = _FEET.get(_norm(foot_match.group(1)).strip())
    return OfficialProfile(
        name=name,
        date_of_birth=dob,
        height_cm=_parse_height(document),
        preferred_foot=foot,
        photo_url=_parse_photo(document, dob_pos),
        social=_parse_social(document),
        source_url=source_url,
    )


def parse_official_squad(document: str, source_url: str) -> list[OfficialPlayer]:
    text = strip_tags(document)
    seen: set[tuple[str, int]] = set()
    out: list[OfficialPlayer] = []
    for match in _NUMBERED.finditer(text):
        number = int(match.group(1))
        name = normalize_space(match.group(2))
        key = (_norm(name), number)
        if 1 <= number <= 99 and key not in seen:
            seen.add(key)
            out.append(OfficialPlayer(name=name, shirt_number=number, source_url=source_url))
    return out


def choose_official(players: list[OfficialPlayer], name: str) -> OfficialPlayer | None:
    target = _norm(name)
    exact = [p for p in players if _norm(p.name) == target]
    if len(exact) == 1:
        return exact[0]
    # "A. Alti" -> comparar por el último apellido.
    last = target.split()[-1]
    by_last = [p for p in players if last in _norm(p.name).split()]
    return by_last[0] if len(by_last) == 1 else None


def choose_profile(
    profiles: list[OfficialProfile], name: str, date_of_birth: str | None
) -> OfficialProfile | None:
    if date_of_birth:
        exact = [p for p in profiles if p.date_of_birth == date_of_birth]
        if len(exact) == 1:
            return exact[0]
        if len(exact) > 1:
            # La fecha sola no basta: comprobamos que el nombre comparta algún token.
            tokens = set(_norm(name).split())
            named = [p for p in exact if tokens & set(_norm(p.name).split())]
            return named[0] if len(named) == 1 else None
        return None
    target = _norm(name)
    exact = [p for p in profiles if _norm(p.name) == target]
    return exact[0] if len(exact) == 1 else None


class OfficialClient:
    def __init__(self, http: PoliteClient, url: str | None = None) -> None:
        self.http = http
        self.url = url

    def squad(self) -> tuple[list[OfficialPlayer], str | None]:
        if not self.url:
            return [], None
        return parse_official_squad(self.http.get(self.url).text, self.url), self.url

    def _profile_urls(self, team_url: str) -> list[str]:
        document = self.http.get(team_url).text
        hrefs = sorted(set(_PROFILE_HREF.findall(document)))
        return [urljoin(team_url, href) for href in hrefs]

    def profiles(
        self,
        team_url: str = TEAM_URL,
        extra_urls: tuple[str, ...] = (),
        team_urls: tuple[str, ...] = (),
    ) -> tuple[list[OfficialProfile], str]:
        out: list[OfficialProfile] = []
        urls: list[str] = []
        for source in (team_url, *team_urls):
            if not source:
                continue
            try:
                urls.extend(self._profile_urls(source))
            except SourceError:
                continue
        urls.extend(extra_urls)
        seen: set[str] = set()
        seen_profiles: set[tuple[str, str]] = set()
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            try:
                profile = parse_official_profile(self.http.get(url).text, url)
            except SourceError:
                continue
            if not (profile.date_of_birth or profile.name):
                continue
            # La misma ficha aparece en /depor y /depor-fabril con distinto nombre.
            key = (profile.date_of_birth or "", profile.photo_url or _norm(profile.name))
            if key in seen_profiles:
                continue
            seen_profiles.add(key)
            out.append(profile)
        return out, team_url


__all__ = [
    "OfficialClient",
    "OfficialPlayer",
    "OfficialProfile",
    "choose_official",
    "choose_profile",
    "parse_official_profile",
    "parse_official_squad",
]
