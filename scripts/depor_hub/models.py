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


class MatchSnapshot(Public):
    """Foto congelada de un partido terminado (ADR 0028).

    Se escribe una sola vez, cuando el partido ya tiene marcador final. Sirve para
    que una ficha antigua siga disponible aunque el partido desaparezca de la API.
    No contiene eventos, alineaciones ni estadísticas: esos datos no se inventan.
    """

    match_id: int
    season: str
    captured_at: IsoDateTime
    source: str = "football-data.org"
    status: Literal["FINISHED", "AWARDED"]
    utc_date: IsoDateTime
    matchday: Optional[int] = None
    stage: Optional[str] = None
    home: TeamRef
    away: TeamRef
    score: Score
    depor_is_home: bool
    venue: Optional[str] = None
    referee: Optional[str] = None

    @model_validator(mode="after")
    def _has_final_score(self) -> MatchSnapshot:
        if self.score.home is None or self.score.away is None:
            raise ValueError("un snapshot solo se crea con marcador final")
        return self


# --- Detalle de partido (ADR 0031) -------------------------------------------
# Documento por partido terminado con alineaciones y eventos publicados por BDFutbol.
# No se publican fotos, escudos ni textos de la fuente; los datos desconocidos son null.


MatchSide = Literal["home", "away"]
MatchCardKind = Literal["yellow", "red", "second_yellow"]


class MatchDetailTeam(Public):
    name: str
    bdfutbol_id: Optional[int] = Field(default=None, ge=1)


class MatchDetailPlayer(Public):
    name: str
    shirt_number: Optional[int] = Field(default=None, ge=0)
    bdfutbol_id: Optional[int] = Field(default=None, ge=1)


class MatchDetailLineup(Public):
    coach: Optional[str] = None
    starters: list[MatchDetailPlayer] = Field(default_factory=list)
    substitutes: list[MatchDetailPlayer] = Field(default_factory=list)


class MatchDetailLineups(Public):
    home: MatchDetailLineup = Field(default_factory=MatchDetailLineup)
    away: MatchDetailLineup = Field(default_factory=MatchDetailLineup)


class MatchDetailScoreAfter(Public):
    home: int = Field(ge=0)
    away: int = Field(ge=0)


class MatchDetailGoal(Public):
    minute: int = Field(ge=0)
    minute_label: str
    team: MatchSide
    player: str
    own_goal: bool = False
    penalty: bool = False
    score_after: Optional[MatchDetailScoreAfter] = None


class MatchDetailCard(Public):
    minute: int = Field(ge=0)
    minute_label: str
    team: MatchSide
    player: str
    kind: MatchCardKind


class MatchDetailSubstitution(Public):
    minute: int = Field(ge=0)
    minute_label: str
    team: MatchSide
    player_out: Optional[str] = None
    player_in: Optional[str] = None

    @model_validator(mode="after")
    def _has_player(self) -> MatchDetailSubstitution:
        if not self.player_out and not self.player_in:
            raise ValueError("una sustitución debe indicar al menos un jugador")
        return self


class MatchDetail(Public):
    """Alineaciones y eventos de un partido terminado (ADR 0031).

    `matchId` es el identificador de football-data.org que usa la app; el resto
    procede de BDFutbol. No hay estadísticas, fotos ni datos deducidos: si la
    fuente no publica un evento, no aparece.
    """

    match_id: int
    season: str
    source: str = "BDFutbol"
    source_url: str
    bdfutbol_id: int = Field(ge=1)
    captured_at: IsoDateTime
    competition: Optional[str] = None
    matchday: Optional[int] = Field(default=None, ge=0)
    date: str  # AAAA-MM-DD
    venue: Optional[str] = None
    referee: Optional[str] = None
    home: MatchDetailTeam
    away: MatchDetailTeam
    depor_is_home: bool
    score: Score
    lineups: MatchDetailLineups = Field(default_factory=MatchDetailLineups)
    goals: list[MatchDetailGoal] = Field(default_factory=list)
    cards: list[MatchDetailCard] = Field(default_factory=list)
    substitutions: list[MatchDetailSubstitution] = Field(default_factory=list)

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


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


# --- H7: club (ADR 0025) -----------------------------------------------------
# El contrato Club no publica fuente, confianza ni estado: esos datos viven en
# data/manual/club.yml (comentarios) y docs/sources.md. La app no muestra procedencia.


class ClubContact(Public):
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class ClubIdentity(Public):
    official_name: str
    short_name: Optional[str] = None
    founded_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    city: Optional[str] = None
    country: Optional[str] = None
    colors: list[str] = Field(default_factory=list)
    nicknames: list[str] = Field(default_factory=list)
    motto: Optional[str] = None
    president: Optional[str] = None
    entity: Optional[str] = None
    headquarters: Optional[str] = None
    website: Optional[str] = None
    contact: ClubContact = Field(default_factory=ClubContact)


MediaKind = Literal["photo", "video", "audio", "document"]
MediaOrigin = Literal["commons", "club_official", "press", "other"]


class MediaRef(Public):
    """Referencia a un medio externo con su licencia y atribución.

    Regla del proyecto: las imágenes nuevas no se copian al repositorio. Se
    publica la URL original, el crédito y la licencia; si no hay licencia de
    reutilización, se dice explícitamente. `verifiedAt` es la fecha en la que se
    comprobó que la URL seguía viva, no la fecha del dato deportivo.
    """

    url: str
    kind: MediaKind = "photo"
    width: Optional[int] = Field(default=None, ge=0)
    height: Optional[int] = Field(default=None, ge=0)
    license: Optional[str] = None
    license_url: Optional[str] = None
    author: Optional[str] = None
    credit: Optional[str] = None
    source_url: Optional[str] = None
    origin: MediaOrigin = "other"
    verified_at: Optional[str] = None


LyricsRightsStatus = Literal[
    "licensed", "public_domain", "permission_granted", "unknown"
]


class AnthemLyricsRights(Public):
    """Situación legal de una letra publicada.

    `unknown` es un estado honesto, no una licencia. Mientras no haya permiso
    expreso, la app puede mostrar la letra con uso editorial y atribución, pero
    el proyecto no afirma que sea reutilizable.
    """

    status: LyricsRightsStatus = "unknown"
    holder: Optional[str] = None
    license: Optional[str] = None
    license_url: Optional[str] = None
    source_url: Optional[str] = None
    note: Optional[str] = None
    verified_at: Optional[str] = None


AnthemKind = Literal["oficial", "no_oficial", "popular"]


class AnthemCredit(Public):
    """Bloque de créditos de un himno (músicos, producción, grabación...).

    `role` es una clave estable; la app la traduce y, si no la conoce, muestra el
    texto original. `names` conserva una línea por persona o colaboración.
    """

    role: str
    names: list[str] = Field(default_factory=list)
    text: Optional[str] = None


class Anthem(Public):
    id: str
    title: str
    kind: Optional[AnthemKind] = None
    authors: list[str] = Field(default_factory=list)
    year: Optional[int] = Field(default=None, ge=1800, le=2100)
    description: Optional[str] = None
    lyrics: Optional[str] = None
    audio_url: Optional[str] = None
    credits: list[AnthemCredit] = Field(default_factory=list)
    media: Optional[MediaRef] = None
    lyrics_rights: Optional[AnthemLyricsRights] = None


class CrestVersion(Public):
    id: str
    year_from: int = Field(ge=1800, le=2100)
    year_to: Optional[int] = Field(default=None, ge=1800, le=2100)
    description: Optional[str] = None
    image: Optional[str] = None  # ruta relativa a data/public/v1, no URL externa
    media: Optional[MediaRef] = None

    @model_validator(mode="after")
    def _years(self) -> CrestVersion:
        if self.year_to is not None and self.year_to < self.year_from:
            raise ValueError("yearTo no puede ser anterior a yearFrom")
        return self


KitType = Literal["home", "away", "third", "gk_home", "gk_away", "gk_third", "special"]


class Kit(Public):
    type: KitType
    manufacturer: Optional[str] = None
    chest_sponsor: Optional[str] = None
    sleeve_sponsor: Optional[str] = None
    back_sponsor: Optional[str] = None
    colors: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    image: Optional[str] = None  # ruta relativa a data/public/v1
    media: Optional[MediaRef] = None


class SeasonKits(Public):
    season: str  # AAAA-AA
    kits: list[Kit] = Field(default_factory=list)

    @field_validator("season")
    @classmethod
    def _season_format(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}", v):
            raise ValueError("season debe ser AAAA-AA (p. ej. 1999-00)")
        return v


class StadiumCoordinates(Public):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class CapacityZone(Public):
    zone: str
    seats: int = Field(ge=0)


class CapacityAlternative(Public):
    """Aforo alternativo publicado por otra fuente (conciertos, configuración UEFA...)."""

    label: str
    total: int = Field(ge=0)
    note: Optional[str] = None
    source_url: Optional[str] = None


class VenueSchedule(Public):
    days: Optional[str] = None
    hours: Optional[str] = None
    note: Optional[str] = None
    source_url: Optional[str] = None
    verified_at: Optional[str] = None


class VenueAccess(Public):
    public_transport: Optional[str] = None
    parking: Optional[str] = None
    accessibility: Optional[str] = None
    note: Optional[str] = None
    source_url: Optional[str] = None


class Tenure(Public):
    """Club o entidad que usa el estadio, con su periodo documentado."""

    club: str
    from_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    to_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    note: Optional[str] = None
    source_url: Optional[str] = None


class Capacity(Public):
    total: int = Field(ge=0)
    breakdown: list[CapacityZone] = Field(default_factory=list)

    @model_validator(mode="after")
    def _total_is_sum(self) -> Capacity:
        if self.total != sum(zone.seats for zone in self.breakdown):
            raise ValueError("capacity.total debe ser la suma del desglose")
        return self


class Stadium(Public):
    name: str
    address: Optional[str] = None
    coordinates: Optional[StadiumCoordinates] = None
    opened_on: Optional[str] = None  # AAAA-MM-DD
    renovations: list[str] = Field(default_factory=list)
    pitch: Optional[str] = None
    dimensions: Optional[str] = None
    access: Optional[str] = None
    transport: Optional[str] = None
    parking: Optional[str] = None
    capacity: Optional[Capacity] = None
    description: Optional[str] = None
    schedule: Optional[VenueSchedule] = None
    access_details: Optional[VenueAccess] = None
    capacity_alternatives: list[CapacityAlternative] = Field(default_factory=list)
    tenants: list[Tenure] = Field(default_factory=list)
    media: list[MediaRef] = Field(default_factory=list)

    @field_validator("opened_on")
    @classmethod
    def _full_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            datetime.strptime(v, "%Y-%m-%d")
        return v


class Price(Public):
    label: str
    price_eur: Optional[float] = Field(default=None, ge=0)
    note: Optional[str] = None


class Tickets(Public):
    season: Optional[str] = None
    zones: list[Price] = Field(default_factory=list)
    purchase_url: Optional[str] = None
    note: Optional[str] = None


class ClubLink(Public):
    id: str
    label: str
    url: str


class Museum(Public):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    prices: list[Price] = Field(default_factory=list)
    links: list[ClubLink] = Field(default_factory=list)


class TrainingCenter(Public):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    facilities: list[str] = Field(default_factory=list)
    coordinates: Optional[StadiumCoordinates] = None


class BoardMember(Public):
    name: str
    role: Optional[str] = None


class Board(Public):
    president: Optional[str] = None
    members: list[BoardMember] = Field(default_factory=list)
    sporting_director: Optional[str] = None
    note: Optional[str] = None


SponsorRole = Literal["principal", "technical", "official", "collaborator", "other"]


class Sponsor(Public):
    """Patrocinio con su papel, vigencia y fuente. No sustituye a `Sponsors.official`."""

    name: str
    role: SponsorRole = "official"
    category: Optional[str] = None
    since_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    until_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    url: Optional[str] = None
    note: Optional[str] = None
    source_url: Optional[str] = None
    verified_at: Optional[str] = None


class Sponsors(Public):
    principal: Optional[str] = None
    technical: Optional[str] = None
    official: list[str] = Field(default_factory=list)
    collaborators: list[str] = Field(default_factory=list)
    since_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    details: list[Sponsor] = Field(default_factory=list)


class Title(Public):
    competition: str
    years: list[int] = Field(default_factory=list)


TitleScope = Literal["national", "regional", "international", "other"]


class GoalScorer(Public):
    player: str
    goals: int = Field(ge=0)
    note: Optional[str] = None


class FinalMatch(Public):
    date: Optional[str] = None  # AAAA-MM-DD
    competition: Optional[str] = None
    round_: Optional[str] = Field(default=None, alias="round")
    home: Optional[str] = None
    away: Optional[str] = None
    home_goals: Optional[int] = Field(default=None, ge=0)
    away_goals: Optional[int] = Field(default=None, ge=0)
    venue: Optional[str] = None
    note: Optional[str] = None
    source_url: Optional[str] = None

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            datetime.strptime(v, "%Y-%m-%d")
        return v


class TitleSquadMember(Public):
    name: str
    role: Optional[str] = None
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)


class TitleEdition(Public):
    """Una edición concreta de un título, con detalle opcional y procedencia.

    La app puede seguir usando `Club.titles` (agrupado por competición). Este
    contrato añade la edición individual sin romper el bloque legado.
    """

    competition: str
    year: int = Field(ge=1800, le=2100)
    season: Optional[str] = None
    scope: Optional[TitleScope] = None
    final_match: Optional[FinalMatch] = None
    top_scorers: list[GoalScorer] = Field(default_factory=list)
    squad: list[TitleSquadMember] = Field(default_factory=list)
    note: Optional[str] = None
    provenance: Provenance


class Titles(Public):
    updated_at: IsoDateTime
    editions: list[TitleEdition] = Field(default_factory=list)


class Rivalry(Public):
    rival: str
    description: Optional[str] = None
    since_year: Optional[int] = Field(default=None, ge=1800, le=2100)


class RivalryMeeting(Public):
    date: str  # AAAA-MM-DD
    competition: Optional[str] = None
    round_: Optional[str] = Field(default=None, alias="round")
    home: str
    away: str
    home_goals: int = Field(ge=0)
    away_goals: int = Field(ge=0)
    note: Optional[str] = None
    source_url: Optional[str] = None

    @field_validator("date")
    @classmethod
    def _full_date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v


class RivalryFact(Public):
    text: str
    provenance: Provenance


class RivalryDetail(Public):
    """Rivalidad con narrativa, cruces icónicos y balance histórico opcional.

    No sustituye a `Club.rivalries`; lo amplía en un fichero opcional. El balance
    lo rellena el pipeline desde BDFutbol y conserva su propia fuente.
    """

    rival: str
    rival_bdfutbol_id: Optional[str] = None
    description: Optional[str] = None
    since_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    head_to_head: Optional[HeadToHead] = None
    iconic_matches: list[RivalryMeeting] = Field(default_factory=list)
    facts: list[RivalryFact] = Field(default_factory=list)
    media: list[MediaRef] = Field(default_factory=list)
    provenance: Provenance


class Rivalries(Public):
    updated_at: IsoDateTime
    rivalries: list[RivalryDetail] = Field(default_factory=list)


class ClubLinks(Public):
    website: Optional[str] = None
    app: Optional[str] = None
    x: Optional[str] = None
    instagram: Optional[str] = None
    tiktok: Optional[str] = None
    youtube: Optional[str] = None
    facebook: Optional[str] = None
    twitch: Optional[str] = None
    whatsapp: Optional[str] = None
    store: Optional[str] = None
    tickets: Optional[str] = None
    museum: Optional[str] = None
    others: list[ClubLink] = Field(default_factory=list)


class Club(Public):
    updated_at: IsoDateTime
    identity: ClubIdentity
    anthems: list[Anthem] = Field(default_factory=list)
    crests: list[CrestVersion] = Field(default_factory=list)
    kits: list[SeasonKits] = Field(default_factory=list)
    stadium: Optional[Stadium] = None
    tickets: Optional[Tickets] = None
    museum: Optional[Museum] = None
    training_center: Optional[TrainingCenter] = None
    board: Optional[Board] = None
    sponsors: Optional[Sponsors] = None
    titles: list[Title] = Field(default_factory=list)
    rivalries: list[Rivalry] = Field(default_factory=list)
    facts: list[str] = Field(default_factory=list)
    links: ClubLinks = Field(default_factory=ClubLinks)
    media: list[MediaRef] = Field(default_factory=list)


class StatusFile(Public):
    """Estado de un JSON publicado, sin inferir salud por su antigüedad."""

    name: str
    present: bool
    updated_at: Optional[IsoDateTime] = None
    age_minutes: Optional[int] = Field(default=None, ge=0)
    detail: Optional[str] = None


class StatusWorkflow(Public):
    """Última ejecución completada de un workflow de datos."""

    name: str
    file: str
    conclusion: Optional[str] = None
    updated_at: Optional[IsoDateTime] = None
    url: Optional[str] = None


class Status(Public):
    """Diagnóstico operativo publicado en la rama `status` (ADR 0027).

    No sustituye a `meta.json` ni a `news.json`: solo dice qué se publicó, cuándo
    y cómo terminó la última pasada de cada workflow. La app no depende de él.
    """

    updated_at: IsoDateTime
    commit: Optional[str] = None
    ok: bool
    files: list[StatusFile] = Field(default_factory=list)
    workflows: list[StatusWorkflow] = Field(default_factory=list)


# nombre de fichero -> modelo
FILES: dict[str, type[Public]] = {
    "meta.json": Meta,
    "standings.json": Standings,
    "fixtures.json": Fixtures,
    "squad.json": Squad,
    "season.json": Season,
    "club.json": Club,
}

# Ficheros que alimentan meta.dataHash (solo datos deportivos). club.json tiene
# su propia escritura idempotente y no debe cambiar el hash de la ingesta.
SPORTS_FILES = ("meta.json", "standings.json", "fixtures.json", "squad.json", "season.json")

# Contratos que aún no publica la ingesta (news.json llega en H6) pero que la app
# ya puede leer de forma opcional. Se exportan igual para mantener Pydantic como origen.
NEWS_FILES: dict[str, type[Public]] = {
    "news.json": News,
    "social.json": SocialFeed,
}

# Contexto que se publica en su propio comando (rivals.json): la app lo trata como
# opcional, igual que news.json, y funciona con 404 o con una caché anterior.
# `titles.json` y `rivalries.json` son ampliaciones editoriales opcionales: si no
# existen, la app sigue leyendo `club.json`.
EXTRA_FILES: dict[str, type[Public]] = {
    "rivals.json": Rivals,
    "titles.json": Titles,
    "rivalries.json": Rivalries,
}

# Ficheros de EXTRA_FILES que no son obligatorios en `validate`: 404 = sin datos.
OPTIONAL_FILES: frozenset[str] = frozenset({"titles.json", "rivalries.json"})

# Diagnóstico operativo (ADR 0027): se publica en la rama `status`, no en Pages.
# Se genera su esquema con el resto, pero `validate` no lo exige en data/public/v1.
STATUS_FILES: dict[str, type[Public]] = {
    "status.json": Status,
}

# Snapshot congelado de un partido terminado (ADR 0028). El fichero real vive en
# data/public/v1/snapshots/<season>/<matchId>.json; este nombre solo genera el esquema.
SNAPSHOT_FILES: dict[str, type[Public]] = {
    "snapshot.json": MatchSnapshot,
}

# Detalle de un partido terminado (ADR 0031). El fichero real vive en
# data/public/v1/match-details/<season>/<matchId>.json.
MATCH_DETAIL_FILES: dict[str, type[Public]] = {
    "match-detail.json": MatchDetail,
}
