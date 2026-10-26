"""Datos manuales de plantilla que la API no da (dorsal, contrato, altura, carrera, stats).

Origen: data/manual/squad_extras.yml. Reglas: nunca se inventa nada; cada jugador con datos
exige una `source`; el dato de la API manda si existe y el manual solo rellena huecos.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from . import models as m

_PARTIAL_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2}([T ].*)?)?)?$")
_FULL_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_SEASON = re.compile(r"^\d{4}-\d{2}$")
_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")

FIELD_KEYS = {
    "shirtNumber",
    "contractUntil",
    "heightCm",
    "weightKg",
    "birthPlace",
    "preferredFoot",
    "loanFrom",
    "loanTo",
    "marketValueEur",
    "social",
    "photos",
    "career",
    "careerTotals",
    "deporMatches",
}

# Las claves de provenance usan los nombres camelCase del contrato público (ADR 0008).
_PROVENANCE_KEYS = {
    "shirt_number": "shirtNumber",
    "contract_until": "contractUntil",
    "height_cm": "heightCm",
    "weight_kg": "weightKg",
    "birth_place": "birthPlace",
    "preferred_foot": "preferredFoot",
    "loan_from": "loanFrom",
    "loan_to": "loanTo",
    "market_value_eur": "marketValueEur",
    "social": "social",
    "photos": "photos",
    "career": "career",
    "career_totals": "careerTotals",
    "depor_matches": "deporMatches",
}

_COACH_PROVENANCE_KEYS = {
    "birth_date": "birthDate",
    "birth_place": "birthPlace",
    "photo_url": "photoUrl",
    "since": "since",
    "contract_until": "contractUntil",
    "career": "career",
    "staff": "staff",
}


class ExtrasError(ValueError):
    pass


def _text(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _partial(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = _text(value) or ""
    if not _PARTIAL_DATE.fullmatch(text):
        raise ValueError("fecha parcial debe ser AAAA, AAAA-MM o AAAA-MM-DD")
    return text


def _full_date(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    if not _FULL_DATE.fullmatch(text):
        raise ValueError("fecha completa debe ser AAAA-MM-DD")
    date.fromisoformat(text)
    return text


def _handle(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().lstrip("@")
    if "://" in text or "/" in text:
        raise ValueError("las redes se guardan como handle, no como URL")
    if not _HANDLE.fullmatch(text):
        raise ValueError("handle inválido (solo letras, números, punto y guion bajo)")
    return text


def _cmp_partial(a: str, b: str) -> int:
    """Compara fechas parciales por tuplas numéricas (las incompletas valen menos)."""
    pa = tuple(int(x) for x in re.split(r"[-T ]", a)[:3] if x.isdigit())
    pb = tuple(int(x) for x in re.split(r"[-T ]", b)[:3] if x.isdigit())
    return (pa > pb) - (pa < pb)


class SocialExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: Optional[str] = None
    instagram: Optional[str] = None
    tiktok: Optional[str] = None

    @field_validator("x", "instagram", "tiktok")
    @classmethod
    def _validate_handle(cls, v: Optional[str]) -> Optional[str]:
        return _handle(v)

    def has_data(self) -> bool:
        return any(v is not None for v in (self.x, self.instagram, self.tiktok))


class PhotoExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str
    role: Literal["portrait", "action", "other"] = "portrait"
    width: Optional[int] = Field(default=None, ge=1)
    height: Optional[int] = Field(default=None, ge=1)
    license: Optional[str] = None
    license_url: Optional[str] = None
    author: Optional[str] = None
    credit: Optional[str] = None
    source_url: Optional[str] = None

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        text = v.strip()
        if not text.startswith(("http://", "https://")):
            raise ValueError("la foto debe ser una URL http(s)")
        return text

    def has_data(self) -> bool:
        return bool(self.url)


class CareerSeasonExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    season: str
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)

    @field_validator("season")
    @classmethod
    def _season_format(cls, v: str) -> str:
        if not _SEASON.fullmatch(v):
            raise ValueError("season debe ser AAAA-AA (p. ej. 2009-10)")
        return v


class CareerExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    club: str
    crest_url: Optional[str] = None
    role: Literal["player", "coach"] = "player"
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)
    seasons: list[CareerSeasonExtra] = Field(default_factory=list)

    @field_validator("from_", "to", mode="before")
    @classmethod
    def _validate_partial(cls, v: object) -> Optional[str]:
        return _partial(v)  # type: ignore[arg-type]

    @model_validator(mode="after")
    def _date_order(self) -> "CareerExtra":
        if self.from_ and self.to and _cmp_partial(self.from_, self.to) > 0:
            raise ValueError("'from' no puede ser posterior a 'to'")
        return self

    def has_data(self) -> bool:
        return True


class CareerTotalsExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appearances: Optional[int] = Field(default=None, ge=0)
    goals: Optional[int] = Field(default=None, ge=0)
    assists: Optional[int] = Field(default=None, ge=0)
    minutes: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)

    def has_data(self) -> bool:
        return any(
            v is not None
            for v in (
                self.appearances,
                self.goals,
                self.assists,
                self.minutes,
                self.yellow_cards,
                self.red_cards,
            )
        )


class MatchExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    opponent: str
    opponent_crest_url: Optional[str] = None
    competition: Optional[str] = None
    home: bool
    team_goals: Optional[int] = Field(default=None, ge=0, le=30)
    opponent_goals: Optional[int] = Field(default=None, ge=0, le=30)
    result: Optional[Literal["W", "D", "L"]] = None
    started: Optional[bool] = None
    minutes: Optional[int] = Field(default=None, ge=0, le=130)
    goals: Optional[int] = Field(default=None, ge=0, le=20)
    assists: Optional[int] = Field(default=None, ge=0, le=20)
    yellow_cards: Optional[int] = Field(default=None, ge=0, le=2)
    red_cards: Optional[int] = Field(default=None, ge=0, le=1)

    @field_validator("date", mode="before")
    @classmethod
    def _validate_date(cls, v: object) -> str:
        return _full_date(v) or ""  # type: ignore[arg-type]

    @field_validator("result")
    @classmethod
    def _validate_result(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"W", "D", "L"}:
            raise ValueError("result debe ser W, D o L")
        return v


class ProvenanceExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    confidence: m.Confidence = "single_source"
    captured_at: Optional[str] = None

    @field_validator("source")
    @classmethod
    def _source_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("'source' no puede estar vacío")
        return v.strip()

    @field_validator("captured_at")
    @classmethod
    def _captured(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        text = str(v)
        try:
            datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            _partial(text)
        return text


class PlayerExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None  # solo orientativo para quien edita el fichero
    shirt_number: Optional[int] = Field(default=None, ge=1, le=99)
    contract_until: Optional[str] = None
    height_cm: Optional[int] = Field(default=None, ge=140, le=230)
    weight_kg: Optional[int] = Field(default=None, ge=40, le=150)
    birth_place: Optional[str] = None
    preferred_foot: Optional[m.PreferredFoot] = None
    loan_from: Optional[str] = None
    loan_to: Optional[str] = None
    market_value_eur: Optional[int] = Field(default=None, ge=0, le=500_000_000)
    social: Optional[SocialExtra] = None
    photos: list[PhotoExtra] = Field(default_factory=list)
    career: list[CareerExtra] = Field(default_factory=list)
    career_totals: Optional[CareerTotalsExtra] = None
    depor_matches: list[MatchExtra] = Field(default_factory=list)
    provenance: dict[str, ProvenanceExtra] = Field(default_factory=dict)
    source: Optional[str] = None
    confidence: m.Confidence = "single_source"
    captured_at: Optional[str] = None

    @field_validator("contract_until", mode="before")
    @classmethod
    def _contract_format(cls, v: object) -> Optional[str]:
        return _partial(v)  # type: ignore[arg-type]

    @field_validator("birth_place", "loan_from", "loan_to")
    @classmethod
    def _non_empty_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        text = str(v).strip()
        if not text:
            raise ValueError("texto vacío")
        return text

    @field_validator("captured_at")
    @classmethod
    def _captured(cls, v: Optional[str]) -> Optional[str]:
        return ProvenanceExtra._captured(v)

    @model_validator(mode="after")
    def _needs_source(self) -> "PlayerExtra":
        has_data = any(
            v is not None
            for v in (
                self.shirt_number,
                self.contract_until,
                self.height_cm,
                self.weight_kg,
                self.birth_place,
                self.preferred_foot,
                self.loan_from,
                self.loan_to,
                self.market_value_eur,
            )
        ) or bool(self.career) or bool(self.depor_matches)
        has_data = has_data or bool(self.photos)
        has_data = has_data or (self.social is not None and self.social.has_data())
        has_data = has_data or (self.career_totals is not None and self.career_totals.has_data())
        if has_data and not (self.source and self.source.strip()):
            raise ValueError("falta 'source' (de dónde sale el dato)")
        unknown = set(self.provenance) - FIELD_KEYS
        if unknown:
            raise ValueError(f"provenance con campos desconocidos: {sorted(unknown)}")
        if self.market_value_eur is not None:
            prov = self.provenance.get("marketValueEur")
            conf = prov.confidence if prov else self.confidence
            if conf != "estimated":
                raise ValueError("market_value_eur es siempre una estimación (confidence=estimated)")
        return self


class StaffExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    role: str
    photo_url: Optional[str] = None

    @field_validator("name", "role")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        text = str(v).strip()
        if not text:
            raise ValueError("texto vacío")
        return text


class CoachExtra(BaseModel):
    """Datos del entrenador y del cuerpo técnico (ADR 0014).

    Igual que en la plantilla, `source` es obligatoria si hay algún dato. Los valores
    de la API (nombre y nacionalidad) nunca se pisan.
    """

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    nationality: Optional[str] = None
    birth_date: Optional[str] = None
    birth_place: Optional[str] = None
    photo_url: Optional[str] = None
    since: Optional[str] = None
    contract_until: Optional[str] = None
    career: list[CareerExtra] = Field(default_factory=list)
    staff: list[StaffExtra] = Field(default_factory=list)
    provenance: dict[str, ProvenanceExtra] = Field(default_factory=dict)
    source: Optional[str] = None
    confidence: m.Confidence = "single_source"
    captured_at: Optional[str] = None

    @field_validator("birth_date", "since", "contract_until", mode="before")
    @classmethod
    def _partial(cls, v: object) -> Optional[str]:
        return _partial(v)  # type: ignore[arg-type]

    @field_validator("birth_place", "photo_url", "nationality", "name")
    @classmethod
    def _text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        text = str(v).strip()
        if not text:
            raise ValueError("texto vacío")
        return text

    @field_validator("photo_url")
    @classmethod
    def _url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("la foto debe ser una URL http(s)")
        return v

    @field_validator("captured_at")
    @classmethod
    def _captured(cls, v: Optional[str]) -> Optional[str]:
        return ProvenanceExtra._captured(v)

    @model_validator(mode="after")
    def _needs_source(self) -> "CoachExtra":
        has_data = any(
            v is not None
            for v in (
                self.birth_date,
                self.birth_place,
                self.photo_url,
                self.since,
                self.contract_until,
            )
        ) or bool(self.career) or bool(self.staff)
        if has_data and not (self.source and self.source.strip()):
            raise ValueError("falta 'source' (de dónde sale el dato)")
        unknown = set(self.provenance) - (
            set(_COACH_PROVENANCE_KEYS) | set(_COACH_PROVENANCE_KEYS.values())
        )
        if unknown:
            raise ValueError(f"provenance con campos desconocidos: {sorted(unknown)}")
        return self


def load_coach(path: Path) -> CoachExtra | None:
    if not path.exists():
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict) or set(data) - {"coach"}:
        raise ExtrasError(f"{path}: solo se admite la clave de primer nivel 'coach'")
    raw = data.get("coach")
    if raw is None:
        return None
    try:
        return CoachExtra.model_validate(raw)
    except ValidationError as exc:
        raise ExtrasError(f"{path}: entrenador: {exc}") from exc


def load_extras(path: Path) -> dict[int, PlayerExtra]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict) or set(data) - {"players"}:
        raise ExtrasError(f"{path}: solo se admite la clave de primer nivel 'players'")
    out: dict[int, PlayerExtra] = {}
    for key, raw in (data.get("players") or {}).items():
        try:
            pid = int(key)
        except (TypeError, ValueError) as exc:
            raise ExtrasError(f"{path}: id de jugador no numérico: {key!r}") from exc
        try:
            out[pid] = PlayerExtra.model_validate(raw or {})
        except ValidationError as exc:
            raise ExtrasError(f"{path}: jugador {pid}: {exc}") from exc
    return out


def _social(extra: SocialExtra) -> m.Social:
    return m.Social(x=extra.x, instagram=extra.instagram, tiktok=extra.tiktok)


def _photo(extra: PhotoExtra) -> m.PlayerPhoto:
    return m.PlayerPhoto(
        url=extra.url,
        role=extra.role,
        width=extra.width,
        height=extra.height,
        license=extra.license,
        license_url=extra.license_url,
        author=extra.author,
        credit=extra.credit,
        source_url=extra.source_url,
    )


def _career(extra: CareerExtra) -> m.CareerEntry:
    return m.CareerEntry(
        club=extra.club,
        crest_url=extra.crest_url,
        role=extra.role,
        from_=extra.from_,
        to=extra.to,
        appearances=extra.appearances,
        goals=extra.goals,
        assists=extra.assists,
        minutes=extra.minutes,
        yellow_cards=extra.yellow_cards,
        red_cards=extra.red_cards,
        seasons=[
            m.CareerSeason(
                season=s.season,
                appearances=s.appearances,
                goals=s.goals,
                assists=s.assists,
                minutes=s.minutes,
                yellow_cards=s.yellow_cards,
                red_cards=s.red_cards,
            )
            for s in extra.seasons
        ],
    )


def _totals(extra: CareerTotalsExtra) -> m.CareerTotals:
    return m.CareerTotals(
        appearances=extra.appearances,
        goals=extra.goals,
        assists=extra.assists,
        minutes=extra.minutes,
        yellow_cards=extra.yellow_cards,
        red_cards=extra.red_cards,
    )


def _match(extra: MatchExtra) -> m.PlayerMatch:
    return m.PlayerMatch(
        date=extra.date,
        opponent=extra.opponent,
        opponent_crest_url=extra.opponent_crest_url,
        competition=extra.competition,
        home=extra.home,
        team_goals=extra.team_goals,
        opponent_goals=extra.opponent_goals,
        result=extra.result,
        started=extra.started,
        minutes=extra.minutes,
        goals=extra.goals,
        assists=extra.assists,
        yellow_cards=extra.yellow_cards,
        red_cards=extra.red_cards,
    )


def _provenance(extra: PlayerExtra, field: str) -> m.Provenance:
    given = extra.provenance.get(_PROVENANCE_KEYS.get(field, field))
    if given is not None:
        return m.Provenance(
            source=given.source, confidence=given.confidence, captured_at=given.captured_at
        )
    return m.Provenance(
        source=(extra.source or "desconocida").strip(),
        confidence=extra.confidence,
        captured_at=extra.captured_at,
    )


def _fill(
    player: m.Player,
    extra: PlayerExtra,
    updates: dict[str, Any],
    provenance: dict[str, m.Provenance],
    field: str,
    value: Any,
) -> None:
    if getattr(player, field) is None and value is not None:
        updates[field] = value
        provenance[_PROVENANCE_KEYS.get(field, field)] = _provenance(extra, field)


def reset_enriched(squad: m.Squad) -> m.Squad:
    """Quita los campos que puso el enriquecimiento para poder recalcularlos desde cero.

    Solo toca campos con provenance (la API no deja provenance). Así `enrich --apply`
    puede corregir datos ya publicados sin pisar lo que venga de la fuente oficial.
    """
    players = []
    for p in squad.players:
        if not p.provenance:
            players.append(p)
            continue
        updates: dict[str, Any] = {}
        for field, key in _PROVENANCE_KEYS.items():
            if key not in p.provenance and field not in p.provenance:
                continue
            if field == "social":
                updates["social"] = m.Social()
            elif field == "photos":
                updates["photos"] = []
            elif field in {"career", "depor_matches"}:
                updates[field] = []
            elif field == "career_totals":
                updates["career_totals"] = m.CareerTotals()
            else:
                updates[field] = None
        legacy = set(_PROVENANCE_KEYS) | set(_PROVENANCE_KEYS.values())
        updates["provenance"] = {
            key: value for key, value in p.provenance.items() if key not in legacy
        }
        players.append(p.model_copy(update=updates))
    return squad.model_copy(update={"players": players})


def apply_extras(squad: m.Squad, extras: dict[int, PlayerExtra]) -> m.Squad:
    """Rellena huecos (None) con los datos manuales; el valor de la API nunca se pisa."""
    players = []
    for p in squad.players:
        e = extras.get(p.id)
        if e is None:
            players.append(p)
            continue
        updates: dict[str, Any] = {}
        provenance = dict(p.provenance)

        _fill(p, e, updates, provenance, "shirt_number", e.shirt_number)
        _fill(p, e, updates, provenance, "contract_until", e.contract_until)
        _fill(p, e, updates, provenance, "height_cm", e.height_cm)
        _fill(p, e, updates, provenance, "weight_kg", e.weight_kg)
        _fill(p, e, updates, provenance, "birth_place", e.birth_place)
        _fill(p, e, updates, provenance, "preferred_foot", e.preferred_foot)
        _fill(p, e, updates, provenance, "loan_from", e.loan_from)
        _fill(p, e, updates, provenance, "loan_to", e.loan_to)
        _fill(p, e, updates, provenance, "market_value_eur", e.market_value_eur)

        if e.social is not None and e.social.has_data():
            social = p.social.model_copy(
                update={
                    "x": p.social.x if p.social.x is not None else e.social.x,
                    "instagram": p.social.instagram
                    if p.social.instagram is not None
                    else e.social.instagram,
                    "tiktok": p.social.tiktok if p.social.tiktok is not None else e.social.tiktok,
                }
            )
            if social != p.social:
                updates["social"] = social
                provenance["social"] = _provenance(e, "social")

        if not p.photos and e.photos:
            updates["photos"] = [_photo(photo) for photo in e.photos]
            provenance["photos"] = _provenance(e, "photos")

        if not p.career and e.career:
            updates["career"] = [_career(c) for c in e.career]
            provenance["career"] = _provenance(e, "career")

        if (
            p.career_totals.appearances is None
            and p.career_totals.goals is None
            and p.career_totals.assists is None
            and p.career_totals.minutes is None
            and p.career_totals.yellow_cards is None
            and p.career_totals.red_cards is None
            and e.career_totals is not None
            and e.career_totals.has_data()
        ):
            updates["career_totals"] = _totals(e.career_totals)
            provenance["careerTotals"] = _provenance(e, "careerTotals")

        if not p.depor_matches and e.depor_matches:
            updates["depor_matches"] = [_match(x) for x in e.depor_matches]
            provenance["deporMatches"] = _provenance(e, "deporMatches")

        if "provenance" not in updates:
            updates["provenance"] = provenance
        players.append(p.model_copy(update=updates))
    return squad.model_copy(update={"players": players})


def _coach_provenance(extra: CoachExtra, field: str) -> m.Provenance:
    key = _COACH_PROVENANCE_KEYS.get(field, field)
    given = extra.provenance.get(key)
    if given is not None:
        return m.Provenance(
            source=given.source, confidence=given.confidence, captured_at=given.captured_at
        )
    return m.Provenance(
        source=(extra.source or "desconocida").strip(),
        confidence=extra.confidence,
        captured_at=extra.captured_at,
    )


def reset_coach(squad: m.Squad) -> m.Squad:
    """Quita los campos del entrenador puestos por el enriquecimiento (ADR 0014)."""
    coach = squad.coach
    if coach is None or not coach.provenance:
        return squad
    updates: dict[str, Any] = {}
    for field, key in _COACH_PROVENANCE_KEYS.items():
        if key not in coach.provenance and field not in coach.provenance:
            continue
        if field in {"career", "staff"}:
            updates[field] = []
        else:
            updates[field] = None
    legacy = set(_COACH_PROVENANCE_KEYS) | set(_COACH_PROVENANCE_KEYS.values())
    updates["provenance"] = {
        key: value for key, value in coach.provenance.items() if key not in legacy
    }
    return squad.model_copy(update={"coach": coach.model_copy(update=updates)})


def apply_coach(squad: m.Squad, extra: CoachExtra | None) -> m.Squad:
    """Rellena los huecos del entrenador y añade trayectoria/cuerpo técnico.

    El nombre y la nacionalidad que vengan de football-data.org nunca se pisan.
    """
    if extra is None:
        return squad
    coach = squad.coach or m.Coach()
    updates: dict[str, Any] = {}
    provenance = dict(coach.provenance)

    def fill(field: str, value: Any) -> None:
        if getattr(coach, field) is None and value is not None:
            updates[field] = value
            provenance[_COACH_PROVENANCE_KEYS.get(field, field)] = _coach_provenance(extra, field)

    fill("name", extra.name)
    fill("nationality", extra.nationality)
    fill("birth_date", extra.birth_date)
    fill("birth_place", extra.birth_place)
    fill("photo_url", extra.photo_url)
    fill("since", extra.since)
    fill("contract_until", extra.contract_until)

    if not coach.career and extra.career:
        updates["career"] = [_career(c) for c in extra.career]
        provenance["career"] = _coach_provenance(extra, "career")

    if not coach.staff and extra.staff:
        updates["staff"] = [
            m.StaffMember(name=member.name, role=member.role, photo_url=member.photo_url)
            for member in extra.staff
        ]
        provenance["staff"] = _coach_provenance(extra, "staff")

    if not updates:
        return squad
    updates["provenance"] = provenance
    return squad.model_copy(update={"coach": coach.model_copy(update=updates)})


def unknown_ids(squad: m.Squad, extras: dict[int, PlayerExtra]) -> list[int]:
    known = {p.id for p in squad.players}
    return sorted(i for i in extras if i not in known)
