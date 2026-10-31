"""Relevancia determinista y explicable del RC Deportivo (ADR 0018).

Regla de oro: «Deportivo» a secas no cuenta. La palabra aparece en decenas de clubes
(Alavés, Cali, Saprissa, Tenerife…) y en usos genéricos. Solo suman las señales que
identifican al club de A Coruña, a su entorno o a personas de la plantilla.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from depor_hub import models as m

# Clubes y usos que contienen «Deportivo» pero no son el RC Deportivo de La Coruña.
EXCLUSIONS: tuple[str, ...] = (
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
    "deportivo tenerife",
    "club deportivo tenerife",
    "deportivo betis",
    "betis deportivo",
    "deportivo a coruna femenino",
)

# Señales de que el texto habla de fútbol y no de una persona homónima.
_FOOTBALL_CONTEXT = {
    "futbol",
    "fichaje",
    "fichar",
    "partido",
    "jornada",
    "entrenamiento",
    "entrena",
    "lesion",
    "lesionado",
    "gol",
    "goles",
    "portero",
    "defensa",
    "delantero",
    "centrocampista",
    "club",
    "equipo",
    "temporada",
    "copa",
    "liga",
    "cantera",
    "fabril",
    "abegondo",
    "deportivo",
    "depor",
    "entrenador",
    "mister",
    "convocatoria",
    "alineacion",
    "mercado",
    "cesion",
    "renovacion",
    "contrato",
    "vestuario",
    "aficion",
    "arbitro",
    "tarjeta",
    "minuto",
    "once",
    "rival",
    "pretemporada",
    "ascenso",
    "descenso",
    "playoff",
    "clasificacion",
}

_NECRO = {
    "muerte",
    "fallecimiento",
    "fallece",
    "fallecido",
    "fallecida",
    "luto",
    "funeral",
    "obituario",
    "pesame",
    "condolencias",
    "sepelio",
    "entierro",
}

_RIZOR_NON_FOOTBALL = {
    "playa",
    "olas",
    "ola",
    "rescate",
    "arenal",
    "coraza",
    "orzan",
    "surf",
    "duna",
    "temporal",
    "meteorologia",
    "ahogamiento",
    "socorrista",
    "paseo",
}

_DEPOR_STRONG = {
    "deportivo de la coruna",
    "deportivo de a coruna",
    "real club deportivo",
    "rc deportivo",
    "rcdeportivo",
    "depor",
    "superdepor",
}

_COMMON_GIVEN_NAMES = {
    "adrian",
    "alberto",
    "alejandro",
    "alvaro",
    "ana",
    "andres",
    "angel",
    "antonio",
    "carlos",
    "cristian",
    "daniel",
    "david",
    "diego",
    "eduardo",
    "elena",
    "fernando",
    "francisco",
    "ignacio",
    "ivan",
    "javier",
    "jesus",
    "jorge",
    "jose",
    "juan",
    "laura",
    "luis",
    "manuel",
    "marcos",
    "maria",
    "mario",
    "marta",
    "miguel",
    "pablo",
    "pedro",
    "rafael",
    "ramon",
    "raul",
    "ruben",
    "sergio",
    "victor",
    "vicente",
}

_COMMON_SURNAMES = {
    "alonso",
    "blanco",
    "bustos",
    "cabrera",
    "calvo",
    "campos",
    "cano",
    "carrasco",
    "castillo",
    "castro",
    "cruz",
    "diaz",
    "diez",
    "fernandez",
    "fuentes",
    "gallego",
    "garcia",
    "garrido",
    "gimenez",
    "gonzalez",
    "guerrero",
    "heredia",
    "hernandez",
    "herrera",
    "hidalgo",
    "iglesias",
    "jimenez",
    "leon",
    "lopez",
    "lorenzo",
    "lozano",
    "marin",
    "martinez",
    "medina",
    "mendez",
    "montero",
    "moreno",
    "navarro",
    "nieto",
    "ortega",
    "pardo",
    "pascual",
    "perez",
    "prieto",
    "ramos",
    "rodriguez",
    "romero",
    "rubio",
    "ruiz",
    "sanchez",
    "santana",
    "santos",
    "sanz",
    "seoane",
    "serrano",
    "torres",
    "traore",
    "vega",
    "vidal",
    "vazquez",
}

_PARTICLES = {"de", "del", "da", "das", "do", "dos", "la", "las", "los", "y", "e"}


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _phrase(phrase: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)")


def _slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", fold(text)).strip("-")
    return value[:48] or "rival"


def _tokens(text: str) -> list[str]:
    return [token for token in re.split(r"\s+", fold(text)) if token and token not in _PARTICLES]


def _is_common_full_name(name: str) -> bool:
    tokens = _tokens(name)
    return len(tokens) >= 2 and all(
        token in _COMMON_GIVEN_NAMES or token in _COMMON_SURNAMES for token in tokens
    )


def _names(name: str) -> tuple[list[str], list[str]]:
    full = fold(name).strip()
    tokens = _tokens(name)
    full_names = [full] if full else []
    surnames: list[str] = []
    if len(tokens) == 1:
        # Apodos y nombres de una sola palabra («Peke», «Angeliño»): solo si no son
        # nombres comunes, para no convertir «David» en una señal del club.
        alias = tokens[0]
        if len(alias) >= 4 and alias not in _COMMON_GIVEN_NAMES:
            full_names.append(alias)
    if len(tokens) >= 2:
        candidate = tokens[-1]
        if len(candidate) >= 5 and candidate not in _COMMON_SURNAMES:
            surnames.append(candidate)
        # Nombre de pila poco común usado como alias («Luismi», «Yeremay»).
        alias = tokens[0]
        if len(alias) >= 5 and alias not in _COMMON_GIVEN_NAMES:
            full_names.append(alias)
        if len(tokens) >= 3:
            compound = " ".join(tokens[-2:])
            if len(compound) >= 8:
                surnames.append(compound)
    return full_names, surnames


@dataclass
class RelevanceResult:
    score: int
    reasons: list[str] = field(default_factory=list)
    rejected: str | None = None

    @property
    def relevant(self) -> bool:
        return self.rejected is None


@dataclass
class Entities:
    players: set[int] = field(default_factory=set)
    opponents: set[str] = field(default_factory=set)
    numbers: set[str] = field(default_factory=set)
    coach: bool = False

    def overlap_score(self, other: "Entities") -> float:
        parts: list[float] = []
        if self.players or other.players:
            parts.append(
                len(self.players & other.players) / max(1, len(self.players | other.players))
            )
        if self.opponents or other.opponents:
            parts.append(
                len(self.opponents & other.opponents)
                / max(1, len(self.opponents | other.opponents))
            )
        if self.numbers or other.numbers:
            parts.append(
                len(self.numbers & other.numbers) / max(1, len(self.numbers | other.numbers))
            )
        if self.coach or other.coach:
            parts.append(1.0 if self.coach and other.coach else 0.0)
        return sum(parts) / len(parts) if parts else 0.0

    def has_strong_overlap(self, other: "Entities") -> bool:
        return bool(
            (self.players & other.players)
            or (self.opponents & other.opponents)
            or (self.numbers & other.numbers)
            or (self.coach and other.coach)
        )


@dataclass
class RelevanceIndex:
    players: list[tuple[int, list[str], list[str]]] = field(default_factory=list)
    coach: tuple[list[str], list[str]] = field(default_factory=tuple)
    opponents: list[tuple[str, str]] = field(default_factory=list)
    exclusions: tuple[str, ...] = EXCLUSIONS

    def _clean(self, text: str) -> tuple[str, bool]:
        normalized = fold(text)
        foreign = False
        for phrase in self.exclusions:
            pattern = _phrase(phrase)
            if pattern.search(normalized):
                foreign = True
                normalized = pattern.sub(" ", normalized)
        return normalized, foreign

    def _score_text(self, normalized: str) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []
        has_context = any(_phrase(word).search(normalized) for word in _FOOTBALL_CONTEXT)
        if any(_phrase(word).search(normalized) for word in _RIZOR_NON_FOOTBALL):
            if not any(_phrase(phrase).search(normalized) for phrase in _DEPOR_STRONG):
                # «Riazor» también es una playa; sin otra señal no cuenta.
                has_context = False
        strong = {
            "deportivo de la coruna": 6,
            "deportivo de a coruna": 6,
            "real club deportivo": 6,
            "rc deportivo": 6,
            "rcdeportivo": 5,
            "depor": 5,
            "riazor": 4,
            "abegondo": 4,
            "depor training center": 4,
            "superdepor": 4,
        }
        for phrase, weight in strong.items():
            if _phrase(phrase).search(normalized):
                if phrase == "riazor" and not has_context:
                    continue
                score += weight
                reasons.append(phrase)
        if _phrase("fabril").search(normalized) and has_context:
            score += 3
            reasons.append("fabril")
        for player_id, full_names, surnames in self.players:
            matched_full = next(
                (name for name in full_names if _phrase(name).search(normalized)), None
            )
            if matched_full:
                points = 6 if has_context else 2
                score += points
                reasons.append(f"jugador:{player_id}:{points}")
                continue
            if not has_context:
                continue
            matched_surname = next(
                (name for name in surnames if _phrase(name).search(normalized)), None
            )
            if matched_surname:
                score += 3
                reasons.append(f"apellido:{player_id}:3")
        if self.coach:
            full_names, surnames = self.coach
            if any(_phrase(name).search(normalized) for name in full_names):
                score += 4
                reasons.append("entrenador")
            elif has_context and any(_phrase(name).search(normalized) for name in surnames):
                score += 2
                reasons.append("entrenador:apellido")
        if score > 0 and _phrase("blanquiazul").search(normalized):
            # «blanquiazul» lo usan muchos clubes; solo refuerza si ya hay señal del Depor.
            score += 1
            reasons.append("blanquiazul")
        return score, reasons

    @staticmethod
    def _strong_body(reasons: list[str]) -> bool:
        return any(
            reason.startswith("jugador:")
            or reason in {"entrenador", "fabril", "abegondo"}
            or reason in _DEPOR_STRONG
            for reason in reasons
        )

    def evaluate(
        self,
        title: str,
        summary: str | None = None,
        *,
        depor_specific: bool = False,
        threshold: int | None = None,
    ) -> RelevanceResult:
        title_norm, title_foreign = self._clean(title)
        body_norm, body_foreign = self._clean(summary or "")
        title_score, title_reasons = self._score_text(title_norm)
        body_score, body_reasons = self._score_text(body_norm)
        score = title_score + min(body_score, 4)
        reasons = title_reasons + [f"extracto:{reason}" for reason in body_reasons]
        if title_foreign and not any(
            _phrase(phrase).search(title_norm) for phrase in _DEPOR_STRONG
        ):
            return RelevanceResult(score, reasons, "otro_deportivo")
        if body_foreign and title_score == 0:
            return RelevanceResult(score, reasons, "otro_deportivo")
        if any(_phrase(word).search(title_norm) for word in _NECRO) and not any(
            _phrase(phrase).search(title_norm) for phrase in _DEPOR_STRONG
        ):
            return RelevanceResult(score, reasons, "necrologia")
        limit = threshold if threshold is not None else (3 if depor_specific else 4)
        if score < limit:
            return RelevanceResult(score, reasons, "irrelevante")
        if title_score == 0 and not self._strong_body(body_reasons):
            # Un titular sin señal propia no se publica solo porque el extracto mencione
            # «Riazor» o «el Dépor» de pasada (Osasuna, Real Sociedad, sucesos...).
            return RelevanceResult(score, reasons, "solo_extracto")
        return RelevanceResult(score, reasons)

    def is_relevant(
        self,
        title: str,
        summary: str | None = None,
        *,
        depor_specific: bool = False,
        threshold: int | None = None,
    ) -> bool:
        return self.evaluate(
            title, summary, depor_specific=depor_specific, threshold=threshold
        ).relevant

    def player_ids(self, text: str) -> list[int]:
        normalized = fold(text)
        found: set[int] = set()
        for player_id, full_names, surnames in self.players:
            if any(_phrase(name).search(normalized) for name in full_names):
                found.add(player_id)
            elif any(_phrase(name).search(normalized) for name in surnames):
                found.add(player_id)
        return sorted(found)

    def entities(self, title: str, summary: str | None = None) -> Entities:
        text = f"{title} {summary or ''}"
        normalized = fold(text)
        players = set(self.player_ids(text))
        opponents = {
            slug for name, slug in self.opponents if _phrase(fold(name)).search(normalized)
        }
        numbers = set(re.findall(r"\b\d{1,2}\s*[-–]\s*\d{1,2}\b", normalized))
        coach = bool(self.coach and any(_phrase(name).search(normalized) for name in self.coach[0]))
        return Entities(players=players, opponents=opponents, numbers=numbers, coach=coach)


def build_index(
    squad: m.Squad | None,
    coach_name: str | None = None,
    opponents: list[str] | None = None,
) -> RelevanceIndex:
    players: list[tuple[int, list[str], list[str]]] = []
    if squad:
        for player in squad.players:
            full_names, surnames = _names(player.name)
            if full_names:
                players.append((player.id, full_names, surnames))
    coach: tuple[list[str], list[str]] = ([], [])
    if coach_name:
        coach = _names(coach_name)
        # El apellido del entrenador puede ser común («Hidalgo»): se acepta siempre,
        # aunque el resto de apellidos comunes se ignoren para evitar falsos positivos.
        tokens = _tokens(coach_name)
        if len(tokens) >= 2 and tokens[-1] not in coach[1]:
            coach[1].append(tokens[-1])
    rivals: list[tuple[str, str]] = []
    seen: set[str] = set()
    for name in opponents or []:
        normalized = fold(name).strip()
        if not normalized or normalized in seen:
            continue
        if "deportivo" in normalized and ("coruna" in normalized or normalized == "deportivo"):
            continue
        seen.add(normalized)
        rivals.append((name, _slug(name)))
    return RelevanceIndex(players=players, coach=coach, opponents=rivals)
