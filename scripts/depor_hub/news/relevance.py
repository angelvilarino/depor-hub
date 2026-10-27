"""Filtro de relevancia del Depor y extracción de jugadores/rivales (ADR 0016)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from depor_hub import models as m

# Términos que no son del Depor aunque contengan «Deportivo». Se eliminan antes de puntuar.
_EXCLUSIONS = (
    "deportivo alaves",
    "deportivo cali",
    "deportivo pasto",
    "deportivo saprissa",
    "deportivo pereira",
    "deportivo tachira",
    "deportivo municipal",
    "deportivo quito",
    "deportivo cuenca",
    "deportivo maldonado",
    "deportivo lara",
    "deportivo anzoategui",
    "deportivo la guaira",
    "deportivo miranda",
    "deportivo junin",
    "deportivo wanka",
    "deportivo espana",
    "deportivo galicia",
)

# Nombres de pila demasiado comunes: un nombre completo formado solo por nombres y
# apellidos comunes («Álvaro Fernández») no identifica por sí solo a un jugador del Depor.
_COMMON_GIVEN_NAMES = {
    "adrian", "alberto", "alejandro", "alvaro", "ana", "andres", "angel", "antonio",
    "carlos", "cristian", "daniel", "david", "diego", "eduardo", "elena", "fernando",
    "francisco", "ignacio", "ivan", "javier", "jesus", "jorge", "jose", "juan", "laura",
    "luis", "manuel", "marcos", "maria", "mario", "marta", "miguel", "pablo", "pedro",
    "rafael", "ramon", "raul", "ruben", "sergio", "victor", "vicente",
}

# Apellidos demasiado comunes: solos no bastan para identificar a un jugador del Depor.
_COMMON_SURNAMES = {
    "alonso", "blanco", "bustos", "cabrera", "calvo", "campos", "cano", "carrasco",
    "castillo", "castro", "cruz", "diaz", "diez", "fernandez", "fuentes", "gallego",
    "garcia", "garrido", "gimenez", "gonzalez", "guerrero", "heredia", "hernandez",
    "herrera", "hidalgo", "iglesias", "jimenez", "leon", "lopez", "lorenzo", "lozano",
    "marin", "martinez", "medina", "mendez", "montero", "moreno", "navarro", "nieto",
    "ortega", "pardo", "pascual", "perez", "prieto", "ramos", "rodriguez", "romero",
    "rubio", "ruiz", "sanchez", "santana", "santos", "sanz", "seoane", "serrano",
    "torres", "traore", "vega", "vidal", "vazquez",
}

# Riazor es también una playa. Si el texto es de sucesos/local y no hay otra señal
# deportiva, no se considera una noticia del club.
_NON_FOOTBALL_RIZOR = (
    "playa", "olas", "ola", "rescate", "arenal", "coraza", "orzan", "surf", "duna",
    "temporal", "meteorologia", "ahogamiento", "socorrista",
)
_DEPOR_STRONG = {
    "deportivo de la coruna",
    "real club deportivo",
    "rc deportivo",
    "rcdeportivo",
    "depor",
    "fabril",
    "abegondo",
    "superdepor",
    "blanquiazul",
}

_PARTICLES = {"de", "del", "da", "das", "do", "dos", "la", "las", "los", "y", "e"}


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", fold(text)).strip("-")
    return value[:48] or "rival"


def _phrase(phrase: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)")


def _is_common_full_name(name: str) -> bool:
    tokens = [token for token in re.split(r"\s+", fold(name)) if token and token not in _PARTICLES]
    return len(tokens) >= 2 and all(
        token in _COMMON_GIVEN_NAMES or token in _COMMON_SURNAMES for token in tokens
    )


@dataclass
class RelevanceIndex:
    weights: dict[str, int] = field(default_factory=dict)
    players: list[tuple[int, list[str], list[str]]] = field(default_factory=list)
    rivals: list[tuple[str, str]] = field(default_factory=list)

    def score(self, text: str) -> int:
        normalized = fold(text)
        for phrase in _EXCLUSIONS:
            normalized = normalized.replace(phrase, " ")
        score = 0
        for phrase, weight in self.weights.items():
            if phrase == "riazor" and any(
                _phrase(term).search(normalized) for term in _NON_FOOTBALL_RIZOR
            ):
                if not any(_phrase(term).search(normalized) for term in _DEPOR_STRONG):
                    continue
            if _phrase(phrase).search(normalized):
                score += weight
        for _player_id, full_names, surnames in self.players:
            matched = next(
                (name for name in full_names if _phrase(name).search(normalized)), None
            )
            if matched is not None:
                # Un nombre completo común no basta por sí solo: suma poco y necesita
                # otra señal (club, fútbol, rival…) para llegar al umbral.
                score += 2 if _is_common_full_name(matched) else 5
            elif any(_phrase(name).search(normalized) for name in surnames):
                score += 3
        return score

    def is_relevant(self, text: str, *, keyword_filter: bool, threshold: int = 3) -> bool:
        return not keyword_filter or self.score(text) >= threshold

    def player_ids(self, text: str) -> list[int]:
        normalized = fold(text)
        found: set[int] = set()
        for player_id, full_names, surnames in self.players:
            if any(_phrase(name).search(normalized) for name in full_names):
                found.add(player_id)
            elif any(_phrase(name).search(normalized) for name in surnames):
                found.add(player_id)
        return sorted(found)

    def rival_tags(self, text: str) -> list[str]:
        normalized = fold(text)
        found: list[str] = []
        for name, slug in self.rivals:
            if _phrase(name).search(normalized):
                found.append(f"rival:{slug}")
        return sorted(set(found))


def _names(name: str) -> tuple[list[str], list[str]]:
    full = fold(name).strip()
    tokens = [token for token in re.split(r"\s+", full) if token and token not in _PARTICLES]
    full_names = [full] if full else []
    surnames: list[str] = []
    if len(tokens) >= 2:
        candidate = tokens[-1]
        if len(candidate) >= 5 and candidate not in _COMMON_SURNAMES:
            surnames.append(candidate)
        if len(tokens) >= 3:
            compound = " ".join(tokens[-2:])
            if len(compound) >= 8:
                surnames.append(compound)
    return full_names, surnames


def build_index(
    squad: m.Squad | None,
    coach_name: str | None = None,
    opponents: list[str] | None = None,
) -> RelevanceIndex:
    weights = {
        "deportivo de la coruna": 5,
        "real club deportivo": 5,
        "rc deportivo": 5,
        "rcdeportivo": 4,
        "depor": 4,
        "riazor": 4,
        "abegondo": 3,
        "fabril": 3,
        "superdepor": 3,
        "blanquiazul": 2,
        "deportivo": 1,
    }
    players: list[tuple[int, list[str], list[str]]] = []
    if squad:
        for player in squad.players:
            full_names, surnames = _names(player.name)
            if full_names:
                players.append((player.id, full_names, surnames))
    if coach_name:
        full_names, surnames = _names(coach_name)
        # El entrenador no es un jugador: solo suma relevancia, no se etiqueta como player.
        for name in full_names:
            weights[name] = 4
        for name in surnames:
            weights[name] = 2
    rivals: list[tuple[str, str]] = []
    seen: set[str] = set()
    for name in opponents or []:
        normalized = fold(name).strip()
        if not normalized or normalized in seen or "deportivo" in normalized and "coruna" in normalized:
            continue
        seen.add(normalized)
        rivals.append((normalized, _slug(name)))
    return RelevanceIndex(weights=weights, players=players, rivals=rivals)
