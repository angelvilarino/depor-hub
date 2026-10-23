"""Datos manuales de plantilla que el plan gratuito de la API no da (dorsal, contrato, altura).

Origen: data/manual/squad_extras.yml. Reglas: nunca se inventa nada; cada jugador con datos
exige una `source`; el dato de la API manda si existe y el manual solo rellena huecos.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from . import models as m

_PARTIAL_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


class ExtrasError(ValueError):
    pass


class PlayerExtra(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None  # solo orientativo para quien edita el fichero
    shirt_number: Optional[int] = Field(default=None, ge=1, le=99)
    contract_until: Optional[str] = None
    height_cm: Optional[int] = Field(default=None, ge=140, le=230)
    source: Optional[str] = None

    @field_validator("contract_until", mode="before")
    @classmethod
    def _contract_format(cls, v: object) -> object:
        if v is None:
            return v
        text = str(v)
        if not _PARTIAL_DATE.match(text):
            raise ValueError("contract_until debe ser AAAA, AAAA-MM o AAAA-MM-DD")
        return text

    @model_validator(mode="after")
    def _needs_source(self) -> "PlayerExtra":
        has_data = any(
            v is not None for v in (self.shirt_number, self.contract_until, self.height_cm)
        )
        if has_data and not (self.source and self.source.strip()):
            raise ValueError("falta 'source' (de dónde sale el dato)")
        return self


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


def apply_extras(squad: m.Squad, extras: dict[int, PlayerExtra]) -> m.Squad:
    """Rellena huecos (None) con los datos manuales; el valor de la API nunca se pisa."""
    players = []
    for p in squad.players:
        e = extras.get(p.id)
        if e is None:
            players.append(p)
            continue
        players.append(
            p.model_copy(
                update={
                    "shirt_number": p.shirt_number if p.shirt_number is not None else e.shirt_number,
                    "contract_until": p.contract_until
                    if p.contract_until is not None
                    else e.contract_until,
                    "height_cm": p.height_cm if p.height_cm is not None else e.height_cm,
                }
            )
        )
    return squad.model_copy(update={"players": players})


def unknown_ids(squad: m.Squad, extras: dict[int, PlayerExtra]) -> list[int]:
    known = {p.id for p in squad.players}
    return sorted(i for i in extras if i not in known)
