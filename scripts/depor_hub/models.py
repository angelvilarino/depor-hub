"""Contratos PÚBLICOS (v1): lo que consume la app. Origen de verdad del esquema (ADR 0003).

Reglas: JSON en camelCase, todas las claves siempre presentes, desconocido = null,
`extra="forbid"` para que cualquier campo nuevo sea una decisión consciente.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated, Any, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator
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


# --- H5.2: contexto de temporada y rivales (ADR 0017) -------------------------


class SeasonSummary(Public):
    position: int = Field(ge=1)
    points: int = Field(ge=0)
    played: int = Field(ge=0)
    won: int = Field(ge=0)
    drawn: int = Field(ge=0)
    lost: int = Field(ge=0)
    goals_for: int = Field(ge=0)
    goals_against: int = Field(ge=0)
    goal_difference: int


class SeasonFormMatch(Public):
    """Partido terminado con el detalle mínimo para explicar la racha."""

    match_id: int
    matchday: Optional[int] = None
    date: str  # AAAA-MM-DD
    opponent: TeamRef
    home: bool
    score_for: int = Field(ge=0)
    score_against: int = Field(ge=0)
    result: Literal["W", "D", "L"]

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


class PositionPoint(Public):
    matchday: int = Field(ge=0)
    position: int = Field(ge=1)
    points: int = Field(ge=0)


class Season(Public):
    # Strip the retired H5.2 key on input while keeping every other v1 key strict.
    @model_validator(mode="before")
    @classmethod
    def _drop_retired_stake_scenarios(cls, value: Any) -> Any:
        if isinstance(value, dict) and ("whatIsAtStake" in value or "what_is_at_stake" in value):
            value = dict(value)
            value.pop("whatIsAtStake", None)
            value.pop("what_is_at_stake", None)
        return value

    updated_at: IsoDateTime
    season: str
    matchday: Optional[int] = None
    team: TeamRef
    summary: SeasonSummary
    form: list[SeasonFormMatch] = Field(default_factory=list)
    position_evolution: list[PositionPoint] = Field(default_factory=list)
    provenance: dict[str, Provenance] = Field(default_factory=dict)


class HeadToHeadMeeting(Public):
    date: str
    competition: str
    round_: Optional[str] = Field(default=None, alias="round")
    home: str
    away: str
    home_goals: int = Field(ge=0)
    away_goals: int = Field(ge=0)
    depor_result: Literal["W", "D", "L"]

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


class HeadToHead(Public):
    """Balance histórico completo y los últimos cinco cruces (BDFutbol)."""

    scope: Literal["all_official_matches"] = "all_official_matches"
    source: str = "BDFutbol"
    confidence: Confidence = "single_source"
    source_url: str
    played: int = Field(ge=0)
    won: int = Field(ge=0)
    drawn: int = Field(ge=0)
    lost: int = Field(ge=0)
    goals_for: int = Field(ge=0)
    goals_against: int = Field(ge=0)
    meetings: list[HeadToHeadMeeting] = Field(default_factory=list)


class KeyPlayer(Public):
    """Contrato legado: la publicación actual no incluye estadísticas individuales de rivales."""

    id: int
    name: str
    goals: int = Field(ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    played_matches: Optional[int] = Field(default=None, ge=0)


class Rival(Public):
    team: TeamRef
    bdfutbol_id: Optional[str] = None
    coach: Optional[str] = None
    key_players: list[KeyPlayer] = Field(default_factory=list)
    head_to_head: Optional[HeadToHead] = None


class Rivals(Public):
    updated_at: IsoDateTime
    season: str
    rivals: list[Rival] = Field(default_factory=list)


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


NewsKind = Literal["article", "video"]
NewsGroup = Literal["club", "galicia", "nacional"]


class NewsSource(Public):
    """Medio curado que puede aparecer como representante o en `alsoIn` (ADR 0018)."""

    id: str
    name: str
    group: NewsGroup
    kind: NewsKind = "article"
    homepage: str
    icon_url: Optional[str] = None


class NewsAlsoIn(Public):
    """Otra versión de la misma historia publicada por un medio distinto."""

    source_id: str
    title: str
    url: str
    published_at: IsoDateTime


class NewsStory(Public):
    """Una historia, no un artículo suelto: representante + versiones en otros medios.

    Solo se publica lo que entrega el feed: título, enlace, fecha, miniatura y extracto
    corto. No se descarga ni se scrapea el cuerpo del artículo.
    """

    id: str
    title: str
    url: str
    source_id: str
    published_at: IsoDateTime
    kind: NewsKind = "article"
    summary: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    also_in: list[NewsAlsoIn] = Field(default_factory=list)


class News(Public):
    """Contrato de noticias v1 reescrito en ADR 0018 (ruptura consciente)."""

    updated_at: IsoDateTime
    sources: list[NewsSource]
    stories: list[NewsStory]


SocialPlatform = Literal[
    "x", "instagram", "youtube", "tiktok", "facebook", "whatsapp", "twitch", "bluesky", "threads"
]


class SocialProfile(Public):
    """Perfil oficial enlazado desde data/manual/social_pins.yml (ADR 0016)."""

    id: str
    platform: SocialPlatform
    name: str
    url: str
    handle: Optional[str] = None


class SocialPin(Public):
    """Publicación concreta curada a mano. Nunca se obtiene por scraping."""

    id: str
    platform: SocialPlatform
    url: str
    title: str
    published_at: Optional[IsoDateTime] = None
    image_url: Optional[str] = None
    source: Optional[str] = None


class SocialFeed(Public):
    updated_at: IsoDateTime
    data_hash: str = ""
    profiles: list[SocialProfile] = Field(default_factory=list)
    pins: list[SocialPin] = Field(default_factory=list)


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
    crest_url: Optional[str] = None  # URL externa del escudo (ADR 0012); null si no se resuelve
    # ADR 0014: distingue la trayectoria como jugador de la de entrenador. Default "player"
    # para que el JSON y las cachés anteriores sigan siendo válidos.
    role: Literal["player", "coach"] = "player"
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
    opponent_crest_url: Optional[str] = None  # URL externa del rival (ADR 0012)
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


class StaffMember(Public):
    """Miembro del cuerpo técnico publicado por la web oficial (ADR 0014).

    `role` es una clave estable (``head_coach``, ``assistant_coach``...); la app la
    traduce y, si no la conoce, muestra el texto original sin inventar nada.
    """

    name: str
    role: str
    photo_url: Optional[str] = None


class Coach(Public):
    name: Optional[str] = None
    nationality: Optional[str] = None
    birth_date: Optional[str] = None
    birth_place: Optional[str] = None
    photo_url: Optional[str] = None  # foto oficial del club; URL externa
    since: Optional[str] = None
    contract_until: Optional[str] = None
    # ADR 0014: trayectoria como jugador y como entrenador, y cuerpo técnico oficial.
    career: list[CareerEntry] = Field(default_factory=list)
    staff: list[StaffMember] = Field(default_factory=list)
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
    "season.json": Season,
}

# Contratos que aún no publica la ingesta (news.json llega en H6) pero que la app
# ya puede leer de forma opcional. Se exportan igual para mantener Pydantic como origen.
NEWS_FILES: dict[str, type[Public]] = {
    "news.json": News,
    "social.json": SocialFeed,
}

# Contexto que se publica en su propio comando (rivals.json): la app lo trata como
# opcional, igual que news.json, y funciona con 404 o con una caché anterior.
EXTRA_FILES: dict[str, type[Public]] = {
    "rivals.json": Rivals,
}
