"""Modelos de la respuesta CRUDA de football-data.org v4.

Tolerantes a propósito (extra="ignore", casi todo opcional): si la API añade campos no
rompemos; si quita uno obligatorio que usamos, falla la validación y el job no publica.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class Raw(BaseModel):
    model_config = ConfigDict(extra="ignore")


class FDTeamRef(Raw):
    id: int
    name: str
    shortName: Optional[str] = None
    tla: Optional[str] = None
    crest: Optional[str] = None


class FDSeason(Raw):
    startDate: str
    endDate: Optional[str] = None
    currentMatchday: Optional[int] = None


class FDCompetition(Raw):
    code: str
    name: str
    currentSeason: Optional[FDSeason] = None


class FDScorePart(Raw):
    home: Optional[int] = None
    away: Optional[int] = None


class FDScore(Raw):
    winner: Optional[str] = None
    fullTime: FDScorePart = Field(default_factory=FDScorePart)
    halfTime: FDScorePart = Field(default_factory=FDScorePart)


class FDReferee(Raw):
    id: Optional[int] = None
    name: Optional[str] = None
    type: Optional[str] = None


class FDMatch(Raw):
    id: int
    utcDate: str
    status: str
    matchday: Optional[int] = None
    stage: Optional[str] = None
    homeTeam: FDTeamRef
    awayTeam: FDTeamRef
    score: FDScore = Field(default_factory=FDScore)
    venue: Optional[str] = None  # no siempre viene
    referees: list[FDReferee] = Field(default_factory=list)  # puede venir vacío en el plan gratuito


class FDMatches(Raw):
    matches: list[FDMatch]


class FDStandingRow(Raw):
    position: int
    team: FDTeamRef
    playedGames: int
    won: int
    draw: int
    lost: int
    points: int
    goalsFor: int
    goalsAgainst: int
    goalDifference: int
    form: Optional[str] = None


class FDStandingGroup(Raw):
    type: Optional[str] = None
    table: list[FDStandingRow]


class FDStandings(Raw):
    standings: list[FDStandingGroup]


class FDPerson(Raw):
    id: int
    name: str
    position: Optional[str] = None
    dateOfBirth: Optional[str] = None
    nationality: Optional[str] = None
    shirtNumber: Optional[int] = None  # a verificar con el plan gratuito
    contract: Optional[dict[str, Any]] = None  # a verificar con el plan gratuito


class FDCoach(Raw):
    name: Optional[str] = None
    nationality: Optional[str] = None


class FDTeam(Raw):
    id: int
    name: str
    shortName: Optional[str] = None
    tla: Optional[str] = None
    crest: Optional[str] = None
    venue: Optional[str] = None
    coach: Optional[FDCoach] = None
    squad: list[FDPerson] = Field(default_factory=list)


class FDTeams(Raw):
    teams: list[FDTeam]
