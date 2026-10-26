"""Resolución conservadora de escudos de clubes (ADR 0012 y ADR 0014).

Prioridad: football-data.org (fixtures) → Wikidata (P154 + Wikimedia Commons) → overrides
manuales → Wikipedia (imagen del infobox y, como último recurso, imágenes del artículo).

Nunca se inventa un escudo: si la entidad no es inequívoca, la imagen no se puede leer o
no pasa los filtros de forma/identidad, el resultado es ``None`` y la app pinta un
monograma. Los escudos son URLs externas: el repositorio no guarda binarios ni los
redistribuye.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import yaml

from .commons import CommonsClient, parse_imageinfo
from .http import PoliteClient, SourceError
from .wikidata import WikidataClient

FOOTBALL_CLUB_QID = "Q476028"
# Clases de Wikidata aceptadas. Q476028 es «club de fútbol»; Q15944511 «equipo de fútbol»
# y Q103229495 «equipo masculino de fútbol» son subclases directas que Wikidata usa para
# clubes como Chelsea o Wolverhampton.
FOOTBALL_CLUB_QIDS = frozenset({"Q476028", "Q15944511", "Q103229495"})
CREST_WIDTH = 96
# Un escudo es aproximadamente cuadrado. P154 admite errores (fotos de partido o de
# aficionados); una imagen muy apaisada se descarta antes que pintar un escudo falso.
MAX_CREST_ASPECT = 1.4
MIN_CREST_ASPECT = 0.4

WIKI_API = "https://{lang}.wikipedia.org/w/api.php"
WIKI_LANGS = ("es", "en", "gl", "de", "nl", "fr", "it", "pt")

# Palabras de forma (no de identidad) que aparecen o no según la fuente.
_CLUB_STOPWORDS = {
    "a",
    "ad",
    "balompie",
    "calcio",
    "cd",
    "cf",
    "club",
    "de",
    "del",
    "el",
    "fc",
    "football",
    "futbol",
    "la",
    "las",
    "los",
    "rc",
    "rcd",
    "sad",
    "sd",
    "soccer",
    "the",
    "ud",
}

# Todos los patrones de filial viven aquí. Se aplican sobre `raw_name` (sin tildes).
_RESERVE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # ``F.C.``/``S.C.`` acaban en «c»: no son filiales. Solo B/C/II sueltos.
    ("suffix", re.compile(r"(?<![fs])\s+(?:b|c|ii)$")),
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

# Nombres de equipos filiales que Wikidata etiqueta como «reserves», «youth», etc.
_RESERVE_NAME = re.compile(
    r"\b(reserves?|reservas?|youth|juvenil|filial|cantera|academy|academia)\b"
)

# Femenino y otros deportes: nunca son el escudo del primer equipo masculino.
_WOMEN_OTHER = re.compile(
    r"\b("
    r"women|womens|women's|femenino|femenina|femeni|feminin|frauen|vrouwen|"
    r"futsal|basket|baloncesto|basketball|rugby|handball|balonmano|waterpolo|"
    r"hockey|beisbol|baseball|tennis|tenis|athletics|atletismo|cycling|ciclismo|"
    r"esport|e-sport|motorsport|motor"
    r")\b"
)

# Palabras que delatan una imagen que no es el escudo del club.
_BAD_FILE = re.compile(
    r"commons-logo|wikinews|wikidata|wiktionary|question|disambig|flag|stadium|estadio|"
    r"team photo|celebration|president|player|kit|shirt|camiseta|equipacion|photo|foto|"
    r"kleedkamer|locker|training|entrenamiento|map|location|"
    r"adidas|nike|puma|kappa|hummel|macron|umbro|joma|luanvi|kelme|givova|meyba|"
    r"john smith|ressy|yumas|gilcor|tenth|"
    r"laliga|hypermotion|eredivisie|champions|uefa|fifa|conference|europa|"
    r"etoro|brother|philips|cejudos|communityshield|"
    r"originario|old logo|former logo|historical|retro|"
    r"\(\s*(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\s*\)|"
    r"\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b",
    re.I,
)
_ADMIN_FILE = re.compile(
    r"coat of arms|escudo de|escudo del|wappen|stemma|blason|province|provincia|"
    r"municipality|municipio|city of|borough|comarca|newham|"
    r"escudo de oviedo|escudo de eibar|coat of arms of",
    re.I,
)
_HISTORICAL_FILE = re.compile(
    r"\(\s*(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\s*\)|"
    r"\b(?:19|20)\d{2}\b|originario|old logo|former logo|historical|retro",
    re.I,
)
_CREST_WORD = re.compile(r"logo|escudo|crest|badge|shield|emblema|arms|wappen|afbeelding", re.I)
_CLUB_TYPE = re.compile(
    r"(?:^|[^a-z])(fc|cf|cd|ud|sd|rcd|sc|ac|as|ss|us|ue|ca|club|deportivo|sporting|"
    r"atletico|athletic|football|futbol|calcio|soccer)(?:[^a-z]|$)|"
    r"rcd|fcm|cfc|fcb|psv|asroma",
    re.I,
)
_FILE_EXT = re.compile(r"\.(?:svg|png|jpe?g|webp|gif)$", re.I)
_WIKI_FILE_PREFIX = re.compile(r"^(?:File|Archivo|Datei|Bestand|Fichier|Ficheiro)\s*:\s*", re.I)
_WIKI_FILE_LINK = re.compile(
    r"^(?:\[\[\s*)?(?:(?:File|Archivo|Datei|Bestand|Fichier|Ficheiro)\s*:\s*)?"
    r"([^|\]}\n]+?\.(?:svg|png|jpe?g|webp|gif))",
    re.I,
)
_INFOBOX_PARAM = re.compile(
    r"\|\s*(image|logo|imagen|escudo|crest|badge|afbeelding|wappen|"
    r"imagen principal|imagem|immagine)\s*=\s*([^\n]*)",
    re.I,
)


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


def _tokens(text: str | None) -> set[str]:
    return {token for token in raw_name(text).split() if token}


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


def _looks_reserve(name: str | None) -> bool:
    if reserve_info(name) is not None:
        return True
    return bool(_RESERVE_NAME.search(raw_name(name)))


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
    return bool(_entity_ids(entity, "P31") & FOOTBALL_CLUB_QIDS)


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
    statement = _best(_claim(entity, "P154"))
    return bool(statement and _string(statement.get("mainsnak", {})))


def _entity_text(entity: dict) -> str:
    return raw_name(
        json.dumps(
            {
                "labels": entity.get("labels") or {},
                "descriptions": entity.get("descriptions") or {},
            },
            ensure_ascii=False,
        )
    )


def _is_women_or_other(entity: dict) -> bool:
    return bool(_WOMEN_OTHER.search(_entity_text(entity)))


def _is_defunct(entity: dict) -> bool:
    return bool(_claim(entity, "P576"))


def _is_usable_club(entity: dict) -> bool:
    return _is_football_club(entity) and not _is_women_or_other(entity) and not _is_defunct(entity)


def _name_score(entity: dict, club: str) -> int:
    query = club_key(club)
    names = [club_key(name) for name in _entity_names(entity)]
    if not query:
        return 0
    if query in names:
        return 100
    if any(set(query.split()) <= set(name.split()) for name in names if name):
        return 40
    if any(name and set(name.split()) <= set(query.split()) for name in names):
        return 20
    return 0


def _entity_score(entity: dict, club: str) -> int:
    score = _name_score(entity, club)
    if _has_p154(entity):
        score += 10
    score += min(len(entity.get("sitelinks", {})), 40)
    return score


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
    candidates = [entity for entity in entities.values() if _is_usable_club(entity)]
    if not candidates:
        return None
    if not _looks_reserve(club):
        senior = [entity for entity in candidates if not _looks_reserve(_entity_label(entity))]
        if senior:
            candidates = senior
    exact = _exact_entity(club, candidates)
    if exact is not None:
        return exact
    reserve = _reserve_entity(club, candidates)
    if reserve is not None:
        return reserve
    if len(candidates) == 1:
        return candidates[0]
    # La popularidad (sitelinks) no puede competir con un club que no comparte nombre:
    # «Independiente Santa Fe» no es candidato para «Peña Deportiva» por tener más enlaces.
    named = [entity for entity in candidates if _name_score(entity, club) > 0]
    if named:
        candidates = named
    ranked = sorted(candidates, key=lambda entity: _entity_score(entity, club), reverse=True)
    if not ranked:
        return None
    top = _entity_score(ranked[0], club)
    second = _entity_score(ranked[1], club) if len(ranked) > 1 else -1000
    if top >= 40 and top - second >= 10:
        return ranked[0]
    return None


def _file_name(file: str) -> str:
    return _WIKI_FILE_PREFIX.sub("", file.strip())


def _plausible_file(file: str) -> bool:
    name = _file_name(file)
    if not name or not _FILE_EXT.search(name):
        return False
    if _BAD_FILE.search(name) or _ADMIN_FILE.search(name):
        return False
    return True


def _infobox_plausible(file: str, club: str) -> bool:
    """Una foto en el infobox no es un escudo; un SVG sin «logo» sí puede serlo.

    El wikitext puede contener plantillas de partidos o de jugadores con su propio
    ``|image =``. Exigir el nombre del club en el fichero evita escoger esas fotos.
    """
    name = _file_name(file)
    if not _plausible_file(name):
        return False
    if not name.lower().endswith(".svg") and not _CREST_WORD.search(name):
        return False
    club_tokens = _tokens(club) - _CLUB_STOPWORDS
    if club_tokens:
        # PSV, FCB... son siglas cortas pero siguen siendo identidad del club.
        identity = {token for token in club_tokens if len(token) >= 4} or club_tokens
        if not any(token in raw_name(name) for token in identity):
            return False
    return True


def _infobox_file(wikitext: str, club: str) -> str | None:
    for match in _INFOBOX_PARAM.finditer(wikitext):
        value = match.group(2).strip()
        if not value or value.startswith("{{"):
            continue
        link = _WIKI_FILE_LINK.search(value)
        if link:
            candidate = link.group(1).strip()
        else:
            candidate = _file_name(value)
        if _infobox_plausible(candidate, club):
            return candidate
    return None


def _file_score(file: str, club: str, aliases: set[str], *, pageimage: bool = False) -> int:
    name = _file_name(file)
    name_tokens = _tokens(name)
    club_tokens = _tokens(club) - _CLUB_STOPWORDS
    club_tokens |= {token for alias in aliases for token in _tokens(alias)}
    if not club_tokens:
        return -100
    present = club_tokens & name_tokens
    if not present:
        # Permitir acrónimos pegados: "RCDMallorca" contiene "mallorca".
        present = {token for token in club_tokens if len(token) >= 4 and token in raw_name(name)}
        if not present:
            return -100
    score = 4 if present == club_tokens else 2
    if _CREST_WORD.search(name):
        score += 3
    if _CLUB_TYPE.search(name):
        score += 2
    if pageimage:
        score += 6
    if _ADMIN_FILE.search(name):
        score -= 12
    if _BAD_FILE.search(name):
        score -= 8
    if _HISTORICAL_FILE.search(name):
        score -= 8
    return score


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
        self.diagnostics: dict[str, dict[str, Any]] = {}
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
        diagnostics = data.get("diagnostics") if isinstance(data, dict) else None
        if isinstance(diagnostics, dict):
            self.diagnostics = {
                str(name): value
                for name, value in diagnostics.items()
                if isinstance(value, dict)
            }

    def save(self) -> None:
        if self.cache_path is None or not self._cache:
            return
        payload: dict[str, Any] = {
            "clubs": {name: self._cache[name] for name in sorted(self._cache)},
        }
        if self.diagnostics:
            payload["diagnostics"] = {
                name: self.diagnostics[name] for name in sorted(self.diagnostics)
            }
        text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.cache_path.exists() or self.cache_path.read_text(encoding="utf-8") != text:
            self.cache_path.write_text(text, encoding="utf-8")

    def resolve(self, club: str | None) -> str | None:
        if not self.enabled or not club:
            return None
        if club in self._cache:
            return self._cache[club]
        url, reason = self._resolve_diag(club)
        self._cache[club] = url
        self.diagnostics[club] = {"url": url, "reason": reason}
        return url

    def _resolve_diag(self, club: str) -> tuple[str | None, str]:
        # 1) football-data.org: solo los equipos que aparecen en los fixtures.
        url = self.fixtures.get(club)
        if url:
            return url, "fixture"
        info = reserve_info(club)
        if info is not None:
            url = self.fixtures.get(info.parent)
            if url:
                return url, "fixture-matriz"
        # 2) Wikidata P154 + Commons.
        entity = self._find_entity(club)
        reason = "sin-entidad"
        if entity is not None:
            url = self._crest_from_entity(entity)
            if url:
                return url, "wikidata+commons"
            # 3) Override manual: corrige errores de Wikipedia/Wikidata.
            url = self.overrides.get(club)
            if url:
                return url, "override"
            # 4) Wikipedia: imagen del infobox y respaldo por imágenes del artículo.
            url, how = self._wiki_crest(entity, club)
            if url:
                return url, how
            reason = how
            # Un filial sí puede heredar la matriz; un club senior nunca.
            if info is not None or _looks_reserve(_entity_label(entity)):
                parent_entity = self._parent_entity(entity)
                if parent_entity is not None:
                    url = self._crest_from_entity(parent_entity)
                    if url:
                        return url, "parent-wikidata+commons"
                    parent_label = _entity_label(parent_entity) or ""
                    url, how = self._wiki_crest(parent_entity, parent_label)
                    if url:
                        return url, f"parent-{how}"
                parent = info.parent if info is not None else None
                if parent:
                    url, how = self._resolve_wikidata_diag(parent, depth=1)
                    if url:
                        return url, f"parent-{how}"
        else:
            url = self.overrides.get(club)
            if url:
                return url, "override"
            if info is not None:
                url, how = self._resolve_wikidata_diag(info.parent, depth=1)
                if url:
                    return url, f"parent-{how}"
        return None, reason

    def _resolve_wikidata_diag(self, club: str, depth: int = 0) -> tuple[str | None, str]:
        if depth > 2:
            return None, "demasiado-profundo"
        entity = self._find_entity(club)
        if entity is None:
            return None, "sin-entidad"
        url = self._crest_from_entity(entity)
        if url:
            return url, "wikidata+commons"
        if _has_p154(entity):
            return None, "p154-ilegible"
        url, how = self._wiki_crest(entity, club)
        if url:
            return url, how
        info = reserve_info(club)
        if info is not None:
            return self._resolve_wikidata_diag(info.parent, depth + 1)
        return None, how

    # ------------------------------------------------------------------ Wikidata
    def _find_entity(self, club: str) -> dict | None:
        if self.wikidata is None:
            return None
        try:
            ids = self._search_entity_ids(club)
            if not ids:
                return None
            entities = self.wikidata.entities(ids)
        except (SourceError, Exception):  # una fuente opcional no tumba el enriquecimiento
            return None
        return choose_entity(club, entities)

    def _search_entity_ids(self, club: str) -> list[str]:
        ids: list[str] = []
        if self.wikidata is not None:
            for qid in self.wikidata.search_multi(club, ("es", "en")):
                if qid not in ids:
                    ids.append(qid)
        # La búsqueda de Wikidata no siempre devuelve el club (p. ej. "Huesca" apunta al
        # municipio). La búsqueda de Wikipedia sí encuentra el artículo y de ahí el QID.
        for lang in ("es", "en"):
            query = f"{club} club de fútbol" if lang == "es" else f"{club} football club"
            for qid in self._wiki_qids(lang, self._wiki_search(lang, query)):
                if qid not in ids:
                    ids.append(qid)
        return ids[:50]

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
        if statement is None:
            return None
        file = _string(statement.get("mainsnak", {}))
        if not file:
            return None
        if self.commons is not None:
            try:
                image = self.commons.image(file, width=self.width)
            except (SourceError, Exception):
                image = None
            if image is not None and image.url:
                if image.width and image.height:
                    aspect = image.width / image.height
                    if not MIN_CREST_ASPECT <= aspect <= MAX_CREST_ASPECT:
                        return None
                return image.url
        # Respaldo: el fichero existe en Wikidata/Commons pero imageinfo no respondió.
        return (
            "https://commons.wikimedia.org/wiki/Special:FilePath/"
            f"{quote(_file_name(file))}?width={self.width}"
        )

    # ------------------------------------------------------------------ Wikipedia
    def _wiki_get(self, lang: str, params: dict[str, Any]) -> dict | None:
        if self.http is None:
            return None
        query = {"format": "json", "formatversion": 2, "redirects": 1, **params}
        url = WIKI_API.format(lang=lang) + "?" + urlencode(query)
        try:
            data = self.http.get_json(url)
        except (SourceError, Exception):
            return None
        return data if isinstance(data, dict) else None

    def _wiki_search(self, lang: str, query: str) -> list[str]:
        data = self._wiki_get(
            lang,
            {"action": "query", "list": "search", "srsearch": query, "srlimit": 8},
        )
        if data is None:
            return []
        return [
            str(item["title"])
            for item in data.get("query", {}).get("search", [])
            if isinstance(item, dict) and item.get("title")
        ]

    def _wiki_qids(self, lang: str, titles: list[str]) -> list[str]:
        if not titles:
            return []
        data = self._wiki_get(
            lang,
            {
                "action": "query",
                "titles": "|".join(titles),
                "prop": "pageprops",
                "ppprop": "wikibase_item",
            },
        )
        if data is None:
            return []
        out: list[str] = []
        for page in data.get("query", {}).get("pages", []):
            qid = (page.get("pageprops") or {}).get("wikibase_item")
            if qid and qid not in out:
                out.append(str(qid))
        return out

    def _wiki_wikitext(self, lang: str, title: str) -> str:
        data = self._wiki_get(lang, {"action": "parse", "page": title, "prop": "wikitext"})
        if data is None:
            return ""
        return str(data.get("parse", {}).get("wikitext") or "")

    def _wiki_pageimage(self, lang: str, title: str) -> str | None:
        data = self._wiki_get(
            lang,
            {"action": "query", "titles": title, "prop": "pageimages", "piprop": "name"},
        )
        if data is None:
            return None
        for page in data.get("query", {}).get("pages", []):
            name = page.get("pageimage")
            if name:
                return str(name)
        return None

    def _wiki_images(self, lang: str, title: str) -> list[str]:
        data = self._wiki_get(
            lang,
            {"action": "query", "titles": title, "prop": "images", "imlimit": 200},
        )
        if data is None:
            return []
        return [
            str(image["title"])
            for page in data.get("query", {}).get("pages", [])
            for image in page.get("images", [])
            if isinstance(image, dict) and image.get("title")
        ]

    def _wiki_file_url(self, lang: str, file: str) -> str | None:
        """URL de una imagen de Wikipedia/Commons; ``None`` si la forma no es de escudo."""
        name = _file_name(file)
        if not name:
            return None
        if self.commons is not None:
            try:
                image = self.commons.image(name, width=self.width)
            except (SourceError, Exception):
                image = None
            if image is not None and image.url:
                if image.width and image.height:
                    aspect = image.width / image.height
                    if not MIN_CREST_ASPECT <= aspect <= MAX_CREST_ASPECT:
                        return None
                return image.url
        # Fichero local de esa Wikipedia (los escudos no libres no están en Commons).
        data = self._wiki_get(
            lang,
            {
                "action": "query",
                "titles": f"File:{name}",
                "prop": "imageinfo",
                "iiprop": "url|size",
                "iiurlwidth": self.width,
            },
        )
        if data is not None:
            for page in data.get("query", {}).get("pages", []):
                image = parse_imageinfo({"query": {"pages": [page]}}, name)
                if image is not None and image.url:
                    if image.width and image.height:
                        aspect = image.width / image.height
                        if not MIN_CREST_ASPECT <= aspect <= MAX_CREST_ASPECT:
                            return None
                    return image.url
        # Último respaldo: Special:FilePath sirve la miniatura sin exigir imageinfo.
        return (
            f"https://{lang}.wikipedia.org/wiki/Special:FilePath/"
            f"{quote(name)}?width={self.width}"
        )

    def _aliases(self, club: str) -> set[str]:
        aliases = {club}
        if club == "Manchester City":
            aliases |= {"manchester city", "man city"}
        elif club == "PSV":
            aliases |= {"psv", "eindhoven"}
        elif club == "Mallorca":
            aliases |= {"mallorca", "rcd mallorca"}
        elif club == "Las Palmas":
            aliases |= {"las palmas", "union deportiva las palmas"}
        return aliases

    def _wiki_crest(self, entity: dict, club: str) -> tuple[str | None, str]:
        sitelinks = entity.get("sitelinks") or {}
        aliases = self._aliases(club)
        seen: set[str] = set()
        # 1) Imagen del infobox: es la señal más fiable de «escudo actual».
        for lang in WIKI_LANGS:
            title = (sitelinks.get(f"{lang}wiki") or {}).get("title")
            if not title:
                continue
            wikitext = self._wiki_wikitext(lang, title)
            if not wikitext:
                continue
            file = _infobox_file(wikitext, club)
            if not file or raw_name(file) in seen:
                continue
            seen.add(raw_name(file))
            url = self._wiki_file_url(lang, file)
            if url:
                return url, f"wiki-{lang}-infobox"
        # 2) Imágenes del artículo puntuadas por identidad, forma y actualidad.
        candidates: list[tuple[int, int, str, str]] = []
        for rank, lang in enumerate(WIKI_LANGS):
            title = (sitelinks.get(f"{lang}wiki") or {}).get("title")
            if not title:
                continue
            pageimage = self._wiki_pageimage(lang, title)
            files = list(self._wiki_images(lang, title))
            if pageimage:
                files.append(pageimage)
            for file in files:
                name = _file_name(file)
                key = raw_name(name)
                if not name or key in seen:
                    continue
                seen.add(key)
                if not _plausible_file(name):
                    continue
                score = _file_score(
                    name,
                    club,
                    aliases,
                    pageimage=bool(pageimage and raw_name(pageimage) == key),
                )
                if score >= 7:
                    candidates.append((score, rank, lang, name))
        if not candidates:
            return None, "sin-imagen-valida"
        candidates.sort(key=lambda item: (-item[0], item[1]))
        best = candidates[0]
        if len(candidates) > 1:
            second = candidates[1]
            # Empate real entre ficheros distintos: mejor monograma que escudo dudoso.
            if best[0] == second[0] and raw_name(best[3]) != raw_name(second[3]):
                if not (best[0] >= 13 and best[0] - second[0] >= 1):
                    return None, "wiki-ambigua"
        url = self._wiki_file_url(best[2], best[3])
        if not url:
            return None, "wiki-imagen-ilegible"
        return url, f"wiki-{best[2]}-{best[0]}"


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
