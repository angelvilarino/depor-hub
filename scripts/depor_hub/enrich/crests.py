"""Resolución conservadora de escudos de clubes (ADR 0012).

Prioridad: football-data.org (fixtures) → Wikidata (P154 + Wikimedia Commons) → overrides
manuales. Nunca se inventa un escudo: si la entidad no es inequívoca, no tiene P154 o la
imagen no se puede leer, el resultado es ``None`` y la app pinta un monograma.

Los escudos son URLs externas: el repositorio no guarda binarios ni los redistribuye.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .commons import CommonsClient
from .http import PoliteClient, SourceError
from .wikidata import WikidataClient

FOOTBALL_CLUB_QID = "Q476028"
CREST_WIDTH = 96
# Un escudo es aproximadamente cuadrado. P154 admite errores (fotos de partido o de
# aficionados); una imagen muy apaisada se descarta antes que pintar un escudo falso.
MAX_CREST_ASPECT = 1.4
MIN_CREST_ASPECT = 0.4

# Palabras de forma (no de identidad) que aparecen o no según la fuente.
_CLUB_STOPWORDS = {
    "a",
    "ad",
    "balompie",
    "cd",
    "cf",
    "club",
    "de",
    "del",
    "el",
    "fc",
    "futbol",
    "la",
    "las",
    "los",
    "rc",
    "rcd",
    "sad",
    "sd",
    "the",
    "ud",
}

# Todos los patrones de filial viven aquí. Se aplican sobre `raw_name` (sin tildes).
_RESERVE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("suffix", re.compile(r"\s+(?:b|c|ii)$")),
    ("atletic", re.compile(r"\s+atletic(?:o)?$")),
    ("castilla", re.compile(r"\s+castilla$")),
    ("fabril", re.compile(r"\s+fabril$")),
    ("promesas", re.compile(r"\s+promesas$")),
    ("juvenil", re.compile(r"\s+juvenil(?:\s+[a-z])?$")),
    ("sub", re.compile(r"\s+sub\s+(?:19|21)$")),
    ("u", re.compile(r"\s+u(?:19|21|23)$")),
    ("next-gen", re.compile(r"\s+next\s+gen$")),
    ("jong", re.compile(r"^jong\s+")),
)

# El nombre corto de un filial no siempre permite deducir la matriz.
_RESERVE_PARENT_ALIASES = {
    "fabril": "Deportivo de A Coruña",
}


def raw_name(text: str | None) -> str:
    """Minúsculas, sin tildes ni puntuación. Conserva las palabras de identidad."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(re.findall(r"[a-z0-9]+", ascii_text.lower()))


def club_key(text: str | None) -> str:
    """Clave agresiva para emparejar "Málaga" con "Málaga CF" sin perder el club."""
    return " ".join(token for token in raw_name(text).split() if token not in _CLUB_STOPWORDS)


@dataclass(frozen=True)
class ReserveInfo:
    parent: str
    marker: str


def reserve_info(name: str | None) -> ReserveInfo | None:
    """Devuelve la matriz de un filial/reserva, si el nombre sigue un patrón conocido."""
    text = raw_name(name)
    if not text:
        return None
    for marker, pattern in _RESERVE_PATTERNS:
        match = pattern.search(text)
        if match is None:
            continue
        if marker == "jong":
            parent = text[match.end() :].strip()
        else:
            parent = text[: match.start()].strip()
        if not parent:
            continue
        parent = _RESERVE_PARENT_ALIASES.get(marker, parent)
        return ReserveInfo(parent=parent, marker=marker)
    return None


@dataclass
class CrestIndex:
    """Índice de escudos por nombre literal y por clave normalizada.

    Una clave repetida con URLs distintas queda marcada como ambigua (``None``) y nunca
    se resuelve por parecido: es preferible un monograma a un escudo equivocado.
    """

    raw: dict[str, str | None] = field(default_factory=dict)
    key: dict[str, str | None] = field(default_factory=dict)

    @staticmethod
    def _put(index: dict[str, str | None], name: str, url: str) -> None:
        if not name:
            return
        current = index.get(name)
        if current is None and name in index:
            return  # ya era ambigua
        if current is not None and current != url:
            index[name] = None
        else:
            index[name] = url

    def add(self, name: str | None, url: str | None) -> None:
        if not name or not url:
            return
        self._put(self.raw, raw_name(name), url)
        self._put(self.key, club_key(name), url)

    def get(self, name: str | None) -> str | None:
        if not name:
            return None
        literal = raw_name(name)
        if literal and literal in self.raw:
            return self.raw[literal]
        key = club_key(name)
        if key and key in self.key:
            return self.key[key]
        tokens = set(key.split())
        if not tokens:
            return None
        query_is_reserve = reserve_info(name) is not None
        urls = {
            url
            for candidate, url in self.key.items()
            if url
            and tokens <= set(candidate.split())
            # Un club senior no hereda el escudo de un filial por parecido de nombre.
            and (query_is_reserve or reserve_info(candidate) is None)
        }
        return urls.pop() if len(urls) == 1 else None


def load_fixture_crests(path: Path | str | None) -> CrestIndex:
    index = CrestIndex()
    if path is None:
        return index
    file = Path(path)
    if not file.exists():
        return index
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return index
    for match in data.get("matches") or []:
        if not isinstance(match, dict):
            continue
        for side in ("home", "away"):
            team = match.get(side) or {}
            if not isinstance(team, dict):
                continue
            url = team.get("crestUrl")
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            index.add(team.get("name"), url)
            index.add(team.get("shortName"), url)
    return index


def load_override_crests(path: Path | str | None) -> CrestIndex:
    index = CrestIndex()
    if path is None:
        return index
    file = Path(path)
    if not file.exists():
        return index
    try:
        data = yaml.safe_load(file.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return index
    clubs = data.get("clubs") if isinstance(data, dict) else None
    if not isinstance(clubs, dict):
        return index
    for name, value in clubs.items():
        url: Any = value
        if isinstance(value, dict):
            url = value.get("url") or value.get("crest_url") or value.get("crestUrl")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            index.add(str(name), url)
    return index


def _claim(entity: dict, pid: str) -> list[dict]:
    claims = entity.get("claims", {}).get(pid, [])
    return claims if isinstance(claims, list) else []


def _best(claims: list[dict]) -> dict | None:
    if not claims:
        return None
    preferred = [claim for claim in claims if claim.get("rank") == "preferred"]
    return (preferred or claims)[0]


def _entity_id(snak: dict) -> str | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    return value.get("id") if isinstance(value, dict) else None


def _string(snak: dict) -> str | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    return str(value) if value is not None else None


def _entity_ids(entity: dict, pid: str) -> set[str]:
    return {
        entity_id
        for claim in _claim(entity, pid)
        if (entity_id := _entity_id(claim.get("mainsnak", {})))
    }


def _is_football_club(entity: dict) -> bool:
    return FOOTBALL_CLUB_QID in _entity_ids(entity, "P31")


def _entity_label(entity: dict) -> str | None:
    labels = entity.get("labels") or {}
    for lang in ("es", "gl", "en"):
        value = (labels.get(lang) or {}).get("value")
        if value:
            return str(value)
    return None


def _entity_names(entity: dict) -> list[str]:
    names: list[str] = []
    labels = entity.get("labels") or {}
    for lang in ("es", "gl", "en"):
        value = (labels.get(lang) or {}).get("value")
        if value:
            names.append(str(value))
    aliases = entity.get("aliases") or {}
    for lang in ("es", "gl", "en"):
        for alias in aliases.get(lang) or []:
            value = alias.get("value") if isinstance(alias, dict) else None
            if value:
                names.append(str(value))
    return names


def _has_p154(entity: dict) -> bool:
    return bool(_string(_best(_claim(entity, "P154")).get("mainsnak", {})) if _claim(entity, "P154") else None)


def _exact_entity(club: str, candidates: list[dict]) -> dict | None:
    query_raw = raw_name(club)
    query_key = club_key(club)
    matches: list[dict] = []
    for entity in candidates:
        for name in _entity_names(entity):
            if (query_raw and raw_name(name) == query_raw) or (
                query_key and club_key(name) == query_key
            ):
                matches.append(entity)
                break
    return matches[0] if len(matches) == 1 else None


def _reserve_entity(club: str, candidates: list[dict]) -> dict | None:
    info = reserve_info(club)
    if info is None:
        return None
    parent_tokens = set(club_key(info.parent).split())
    if not parent_tokens:
        return None
    matches: list[dict] = []
    for entity in candidates:
        label_info = reserve_info(_entity_label(entity))
        if label_info is None:
            continue
        candidate_tokens = set(club_key(label_info.parent).split())
        if candidate_tokens and (
            parent_tokens <= candidate_tokens or candidate_tokens <= parent_tokens
        ):
            matches.append(entity)
    return matches[0] if len(matches) == 1 else None


def choose_entity(club: str, entities: dict[str, dict]) -> dict | None:
    """Elige una entidad inequívoca; la ambigüedad se resuelve con ``None``."""
    candidates = [entity for entity in entities.values() if _is_football_club(entity)]
    if not candidates:
        return None
    exact = _exact_entity(club, candidates)
    if exact is not None:
        return exact
    reserve = _reserve_entity(club, candidates)
    if reserve is not None:
        return reserve
    return candidates[0] if len(candidates) == 1 else None


class CrestResolver:
    """Resuelve el escudo de un club y cachea el resultado (incluidos los ``None``)."""

    def __init__(
        self,
        *,
        http: PoliteClient | None = None,
        wikidata: WikidataClient | None = None,
        commons: CommonsClient | None = None,
        fixtures_path: Path | str | None = "data/public/v1/fixtures.json",
        overrides_path: Path | str | None = "data/manual/club_crests.yml",
        cache_path: Path | str | None = None,
        width: int = CREST_WIDTH,
        enabled: bool = True,
        use_wikidata: bool = True,
    ) -> None:
        self.http = http
        self.wikidata = wikidata or (WikidataClient(http) if http and use_wikidata else None)
        self.commons = commons or (CommonsClient(http) if http else None)
        self.fixtures = load_fixture_crests(fixtures_path)
        self.overrides = load_override_crests(overrides_path)
        self.cache_path = Path(cache_path) if cache_path else None
        self.width = width
        self.enabled = enabled
        self._fixtures_path = Path(fixtures_path) if fixtures_path else None
        self._overrides_path = Path(overrides_path) if overrides_path else None
        self._cache: dict[str, str | None] = {}
        self._load_cache()

    def _is_cache_stale(self) -> bool:
        if self.cache_path is None or not self.cache_path.exists():
            return True
        cache_mtime = self.cache_path.stat().st_mtime
        for path in (self._fixtures_path, self._overrides_path):
            if path is not None and path.exists() and path.stat().st_mtime > cache_mtime:
                return True
        return False

    def _load_cache(self) -> None:
        if self.cache_path is None or not self.cache_path.exists() or self._is_cache_stale():
            return
        try:
            data = json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        clubs = data.get("clubs") if isinstance(data, dict) else None
        if not isinstance(clubs, dict):
            return
        for name, value in clubs.items():
            if value is None or isinstance(value, str):
                self._cache[str(name)] = value

    def save(self) -> None:
        if self.cache_path is None or not self._cache:
            return
        payload = {"clubs": {name: self._cache[name] for name in sorted(self._cache)}}
        text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.cache_path.exists() or self.cache_path.read_text(encoding="utf-8") != text:
            self.cache_path.write_text(text, encoding="utf-8")

    def resolve(self, club: str | None) -> str | None:
        if not self.enabled or not club:
            return None
        if club in self._cache:
            return self._cache[club]
        url = self._resolve(club)
        self._cache[club] = url
        return url

    def _resolve(self, club: str) -> str | None:
        # 1) football-data.org: solo los equipos que aparecen en los fixtures.
        url = self.fixtures.get(club)
        if url:
            return url
        info = reserve_info(club)
        if info is not None:
            url = self.fixtures.get(info.parent)
            if url:
                return url
        # 2) Wikidata P154 + Commons.
        url = self._wikidata_crest(club)
        if url:
            return url
        # 3) Overrides manuales, solo como último recurso.
        return self.overrides.get(club)

    def _find_entity(self, club: str) -> dict | None:
        if self.wikidata is None:
            return None
        try:
            ids = self.wikidata.search(club)
            if not ids:
                return None
            entities = self.wikidata.entities(ids)
        except (SourceError, Exception):  # una fuente opcional no tumba el enriquecimiento
            return None
        return choose_entity(club, entities)

    def _parent_entity(self, entity: dict) -> dict | None:
        if self.wikidata is None:
            return None
        for pid in ("P749", "P361"):
            parent_ids = sorted(_entity_ids(entity, pid))
            if not parent_ids:
                continue
            try:
                entities = self.wikidata.entities(parent_ids)
            except (SourceError, Exception):
                continue
            parents = [item for item in entities.values() if _is_football_club(item)]
            if len(parents) == 1:
                return parents[0]
        return None

    def _crest_from_entity(self, entity: dict) -> str | None:
        statement = _best(_claim(entity, "P154"))
        if statement is None or self.commons is None:
            return None
        file = _string(statement.get("mainsnak", {}))
        if not file:
            return None
        try:
            image = self.commons.image(file, width=self.width)
        except (SourceError, Exception):
            return None
        if image is None or not image.url:
            return None
        if image.width and image.height:
            aspect = image.width / image.height
            if not MIN_CREST_ASPECT <= aspect <= MAX_CREST_ASPECT:
                return None
        return image.url

    def _wikidata_crest(self, club: str, depth: int = 0) -> str | None:
        if self.wikidata is None or depth > 2:
            return None
        entity = self._find_entity(club)
        info = reserve_info(club)
        if entity is not None:
            url = self._crest_from_entity(entity)
            if url:
                return url
            # Si la entidad tenía P154 pero Commons no dio una URL, no se toma prestado
            # el escudo de otra entidad: el dato propio prevalece (aunque sea ilegible).
            if _has_p154(entity):
                return None
            label_info = reserve_info(_entity_label(entity))
            if info is None and label_info is None:
                return None
            parent_entity = self._parent_entity(entity)
            if parent_entity is not None:
                url = self._crest_from_entity(parent_entity)
                if url:
                    return url
            parent = info.parent if info is not None else (label_info.parent if label_info else None)
            return self._wikidata_crest(parent, depth + 1) if parent else None
        if info is not None:
            return self._wikidata_crest(info.parent, depth + 1)
        return None


__all__ = [
    "CREST_WIDTH",
    "CrestIndex",
    "CrestResolver",
    "ReserveInfo",
    "choose_entity",
    "club_key",
    "load_fixture_crests",
    "load_override_crests",
    "raw_name",
    "reserve_info",
]
