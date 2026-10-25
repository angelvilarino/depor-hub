"""Contratos PÚBLICOS (v1): lo que consume la app. Origen de verdad del esquema (ADR 0003).

Reglas: JSON en camelCase, todas las claves siempre presentes, desconocido = null,
`extra="forbid"` para que cualquier campo nuevo sea una decisión consciente.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

SCHEMA_VERSION = 1

Confidence = Literal["verified", "cross_checked", "single_source", "estimated"]
PreferredFoot = Literal["left", "right", "both"]

_PARTIAL_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2}([T ].*)?)?)?$")


def _check_iso(value: str) -> str:
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


IsoDateTime = Annotated[str, AfterValidator(_check_iso)]


class Public(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class TeamRef(Public):
    id: int
    name: str
    short_name: Optional[str] = None
    tla: Optional[str] = None
    crest_url: Optional[str] = None  # URL externa (ADR 0006): no se almacena ni se redistribuye


class Source(Public):
    name: str
    url: Optional[str] = None
    note: Optional[str] = None


class TeamInfo(TeamRef):
    venue: Optional[str] = None


class Meta(Public):
    schema_version: int
    season: str
    competition_code: str
    competition_name: str
    team: TeamInfo
    updated_at: IsoDateTime
    data_hash: str
    source: Source


class StandingRow(Public):
    position: int
    team: TeamRef
    played: int
    won: int
    draw: int
    lost: int
    points: int
    goals_for: int
    goals_against: int
    goal_difference: int
    form: Optional[str] = None


class Standings(Public):
    updated_at: IsoDateTime
    season: str
    matchday: Optional[int] = None
    table: list[StandingRow]


class Score(Public):
    home: Optional[int] = None
    away: Optional[int] = None
    half_time_home: Optional[int] = None
    half_time_away: Optional[int] = None
    winner: Optional[str] = None


class Match(Public):
    id: int
    utc_date: IsoDateTime
    status: str
    matchday: Optional[int] = None
    stage: Optional[str] = None
    home: TeamRef
    away: TeamRef
    score: Score
    depor_is_home: bool
    venue: Optional[str] = None  # sede del partido (la del local si la API no la da)
    referee: Optional[str] = None  # solo si la API lo informa


class Fixtures(Public):
    updated_at: IsoDateTime
    season: str
    matches: list[Match]


class Provenance(Public):
    """De dónde sale un dato y con qué confianza (ADR 0008)."""

    source: str
    confidence: Confidence = "single_source"
    captured_at: Optional[str] = None


class Social(Public):
    """Handles, no URLs. La app construye los enlaces oficiales."""

    x: Optional[str] = None
    instagram: Optional[str] = None
    tiktok: Optional[str] = None


class PlayerPhoto(Public):
    """Foto externa con su licencia y atribución (ADR 0009).

    `url` apunta siempre a la fuente original: el repositorio no redistribuye binarios.
    Si no hay licencia de reutilización, `license` lo dice explícitamente.
    """

    url: str
    role: Literal["portrait", "action", "other"] = "portrait"
    width: Optional[int] = Field(default=None, ge=1)
    height: Optional[int] = Field(default=None, ge=1)
    license: Optional[str] = None
    license_url: Optional[str] = None
    author: Optional[str] = None
    credit: Optional[str] = None
    source_url: Optional[str] = None


class CareerSeason(Public):
    season: str  # "2009-10"
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)

    @field_validator("season")
    @classmethod
    def _season_format(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}", v):
            raise ValueError("season debe ser AAAA-AA (p. ej. 2009-10)")
        return v


class CareerEntry(Public):
    club: str
    from_: Optional[str] = Field(default=None, alias="from")  # AAAA, AAAA-MM o AAAA-MM-DD
    to: Optional[str] = None
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)
    seasons: list[CareerSeason] = Field(default_factory=list)

    @field_validator("from_", "to")
    @classmethod
    def _partial_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _PARTIAL_DATE.fullmatch(v):
            raise ValueError("fecha parcial debe ser AAAA, AAAA-MM o AAAA-MM-DD")
        return v


class CareerTotals(Public):
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)


class PlayerMatch(Public):
    """Partido disputado con el Depor. Las asistencias no se inventan: null si la fuente no las da."""

    date: str  # AAAA-MM-DD
    opponent: str
    competition: Optional[str] = None
    home: bool
    team_goals: Optional[int] = None
    opponent_goals: Optional[int] = None
    result: Optional[Literal["W", "D", "L"]] = None
    started: Optional[bool] = None
    minutes: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


class Coach(Public):
    name: Optional[str] = None
    nationality: Optional[str] = None
    birth_date: Optional[str] = None
    since: Optional[str] = None
    contract_until: Optional[str] = None
    provenance: dict[str, Provenance] = Field(default_factory=dict)

    @field_validator("birth_date", "since", "contract_until")
    @classmethod
    def _partial_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _PARTIAL_DATE.fullmatch(v):
            raise ValueError("fecha parcial debe ser AAAA, AAAA-MM o AAAA-MM-DD")
        return v


class Player(Public):
    id: int
    name: str
    position: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    shirt_number: Optional[int] = None
    contract_until: Optional[str] = None
    height_cm: Optional[int] = None  # ADR 0007: solo de data/manual/squad_extras.yml (con fuente)
    # ADR 0008: ampliación aditiva. Siempre presentes en el JSON; null/[] si no hay dato.
    birth_place: Optional[str] = None
    preferred_foot: Optional[PreferredFoot] = None
    loan_from: Optional[str] = None
    loan_to: Optional[str] = None  # ADR 0010: cedido por el Depor a otro club
    market_value_eur: Optional[int] = Field(default=None, ge=0)  # SIEMPRE estimación
    weight_kg: Optional[int] = Field(default=None, ge=0)
    social: Social = Field(default_factory=Social)
    photos: list[PlayerPhoto] = Field(default_factory=list)
    career: list[CareerEntry] = Field(default_factory=list)
    career_totals: CareerTotals = Field(default_factory=CareerTotals)
    depor_matches: list[PlayerMatch] = Field(default_factory=list)
    provenance: dict[str, Provenance] = Field(default_factory=dict)


class Squad(Public):
    updated_at: IsoDateTime
    coach: Optional[Coach] = None
    players: list[Player]


# nombre de fichero -> modelo
FILES: dict[str, type[Public]] = {
    "meta.json": Meta,
    "standings.json": Standings,
    "fixtures.json": Fixtures,
    "squad.json": Squad,
}
