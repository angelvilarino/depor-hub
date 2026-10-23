"""Contratos PÚBLICOS (v1): lo que consume la app. Origen de verdad del esquema (ADR 0003).

Reglas: JSON en camelCase, todas las claves siempre presentes, desconocido = null,
`extra="forbid"` para que cualquier campo nuevo sea una decisión consciente.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

SCHEMA_VERSION = 1


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


class Coach(Public):
    name: Optional[str] = None
    nationality: Optional[str] = None


class Player(Public):
    id: int
    name: str
    position: Optional[str] = None
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = None
    shirt_number: Optional[int] = None
    contract_until: Optional[str] = None
    height_cm: Optional[int] = None  # ADR 0007: solo de data/manual/squad_extras.yml (con fuente)


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
