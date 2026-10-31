"""Propuestas de enriquecimiento: observaciones, conflictos y aplicación conservadora.

Regla de oro: un campo con dos fuentes que no coinciden NO se aplica; se queda en el informe
de conflictos para que una persona lo revise. Lo que se aplica lleva siempre procedencia.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from .. import models as m
from . import bdfutbol, crests, official, wikidata, wikipedia
from .bdfutbol import BDFutbolClient, Candidate, CareerEntryData, MatchData, Profile, SeasonRow
from .official import OfficialPlayer, OfficialProfile
from .wikidata import WikidataCareer, WikidataClient, WikidataData
from .wikipedia import WikiPlayer, WikiProfile

CONFIDENCE_ORDER = {"estimated": 0, "single_source": 1, "cross_checked": 2, "verified": 3}

_FIELD_LABELS = {
    "shirt_number": "shirtNumber",
    "contract_until": "contractUntil",
    "height_cm": "heightCm",
    "weight_kg": "weightKg",
    "birth_place": "birthPlace",
    "preferred_foot": "preferredFoot",
    "loan_from": "loanFrom",
    "social": "social",
    "photos": "photos",
    "career": "career",
    "career_totals": "careerTotals",
    "depor_matches": "deporMatches",
}
_SIMPLE_FIELDS = (
    "shirt_number",
    "contract_until",
    "height_cm",
    "weight_kg",
    "birth_place",
    "preferred_foot",
    "loan_from",
)
_MISSING_LABELS = {
    "shirt_number": "shirtNumber",
    "contract_until": "contractUntil",
    "height_cm": "heightCm",
    "birth_place": "birthPlace",
    "preferred_foot": "preferredFoot",
    "weight_kg": "weightKg",
    "social": "social",
    "photos": "photos",
    "career": "career",
    "depor_matches": "deporMatches",
}


@dataclass(frozen=True)
class Observation:
    value: Any
    source: str
    url: str


@dataclass
class Decision:
    value: Any
    confidence: str
    sources: tuple[str, ...]
    urls: tuple[str, ...] = ()
    candidates: list[dict[str, Any]] = field(default_factory=list)
    resolved_by: str | None = None

    def provenance(self, captured_at: str) -> dict[str, Any]:
        return {
            "source": " + ".join(c for c in self.sources if c) or "desconocida",
            "confidence": self.confidence,
            "captured_at": captured_at,
        }


@dataclass
class PlayerProposal:
    player_id: int
    name: str
    decisions: dict[str, Decision] = field(default_factory=dict)
    conflicts: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    source_urls: dict[str, str] = field(default_factory=dict)
    bdf: Profile | None = None
    wikidata: WikidataData | None = None
    wiki: WikiPlayer | None = None
    wiki_profile: WikiProfile | None = None
    wiki_profiles: list[WikiProfile] = field(default_factory=list)
    official: OfficialProfile | None = None
    error: str | None = None
    captured_at: str = field(default_factory=lambda: date.today().isoformat())

    def missing(self) -> list[str]:
        return [label for key, label in _MISSING_LABELS.items() if key not in self.decisions]

    def applied_confidences(self, min_confidence: str) -> dict[str, str]:
        floor = CONFIDENCE_ORDER.get(min_confidence, 1)
        return {
            key: decision.confidence
            for key, decision in self.decisions.items()
            if CONFIDENCE_ORDER.get(decision.confidence, 0) >= floor
        }

    def to_extras(self, min_confidence: str) -> dict[str, Any]:
        floor = CONFIDENCE_ORDER.get(min_confidence, 1)
        out: dict[str, Any] = {}
        provenance: dict[str, Any] = {}
        chosen: dict[str, Decision] = {}
        for key, decision in self.decisions.items():
            if CONFIDENCE_ORDER.get(decision.confidence, 0) < floor:
                continue
            camel = _FIELD_LABELS[key]
            if key == "photos":
                value = [_photo_dict(p) for p in decision.value]
            elif key == "career":
                value = [_career_dict(c) for c in decision.value]
            elif key == "career_totals":
                value = _totals_dict(decision.value)
            elif key == "depor_matches":
                value = [_match_dict(x) for x in decision.value]
            else:
                value = decision.value
            if value in (None, [], {}):
                continue
            out[key] = value
            chosen[key] = decision
            provenance[camel] = decision.provenance(self.captured_at)

        if not chosen:
            return {}
        sources = sorted({s for d in chosen.values() for s in d.sources if s})
        confidence = (
            "cross_checked"
            if all(CONFIDENCE_ORDER.get(d.confidence, 0) >= 2 for d in chosen.values())
            else "single_source"
        )
        out.update({
            "name": self.name,
            "source": " + ".join(sources) or "desconocida",
            "confidence": confidence,
            "captured_at": self.captured_at,
            "provenance": provenance,
        })
        return out


@dataclass
class EnrichmentProposal:
    squad_updated_at: str
    generated_at: str
    players: list[PlayerProposal]
    source_urls: dict[str, str]

    def coverage(self) -> dict[str, Any]:
        total = len(self.players)
        counts = {label: 0 for label in _MISSING_LABELS.values()}
        for player in self.players:
            for key, label in _FIELD_LABELS.items():
                if key in player.decisions:
                    counts[label] = counts.get(label, 0) + 1
        career = [
            entry
            for player in self.players
            for entry in (
                (player.decisions["career"].value or []) if "career" in player.decisions else []
            )
        ]
        matches = [
            match
            for player in self.players
            for match in (
                (player.decisions["depor_matches"].value or [])
                if "depor_matches" in player.decisions
                else []
            )
        ]
        return {
            "players": total,
            "withData": sum(1 for p in self.players if p.decisions),
            "withErrors": sum(1 for p in self.players if p.error),
            "fields": counts,
            "conflicts": sum(len(p.conflicts) for p in self.players),
            "crests": {
                "career": {
                    "total": len(career),
                    "resolved": sum(1 for entry in career if entry.crest_url),
                },
                "matches": {
                    "total": len(matches),
                    "resolved": sum(1 for match in matches if match.opponent_crest_url),
                },
            },
        }

    def generated_extras(self, min_confidence: str) -> dict[int, dict[str, Any]]:
        return {
            player.player_id: extras
            for player in self.players
            if (extras := player.to_extras(min_confidence))
        }


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).strip()


_PLACE_STOPWORDS = {
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "y",
    "en",
    "provincia",
    "province",
    "comunidad",
    "region",
    "municipio",
    "espana",
    "spain",
    "italia",
    "italy",
    "portugal",
    "francia",
    "france",
    "alemania",
    "germany",
    "pais",
}


def _place_tokens(text: str) -> set[str]:
    ascii_text = _norm(text)
    return {
        token
        for token in re.findall(r"[a-z0-9]+", ascii_text)
        if len(token) > 1 and token not in _PLACE_STOPWORDS
    }


def _compatible_places(a: object, b: object) -> bool:
    """Dos formas del mismo lugar: una contiene los términos de la otra.

    "Arnedo" y "Arnedo, La Rioja, España" son compatibles; "Cambre" y "El Temple" no.
    """
    left, right = _place_tokens(str(a)), _place_tokens(str(b))
    return bool(left and right) and (left <= right or right <= left)


def _birth_place_decision(observations: list[Observation]) -> Decision | None:
    groups: list[list[Observation]] = []
    for observation in observations:
        for group in groups:
            if all(_compatible_places(observation.value, item.value) for item in group):
                group.append(observation)
                break
        else:
            groups.append([observation])
    if not groups:
        return None
    groups.sort(key=len, reverse=True)
    best = groups[0]
    if len(best) < 2:
        return Decision(
            value=None,
            confidence="conflict",
            sources=tuple(o.source for o in observations),
            urls=tuple(o.url for o in observations),
            candidates=[{"value": o.value, "source": o.source, "url": o.url} for o in observations],
        )
    longest = max((str(o.value) for o in best), key=len)
    dissent = [o for o in observations if o not in best]
    return Decision(
        value=longest,
        confidence="cross_checked",
        sources=tuple(o.source for o in best),
        urls=tuple(o.url for o in best),
        candidates=dissent and [{"value": o.value, "source": o.source, "url": o.url} for o in dissent] or [],
        resolved_by="consenso de fuentes" if dissent else None,
    )


def _same(a: Any, b: Any) -> bool:
    if isinstance(a, str) and isinstance(b, str):
        return _norm(a) == _norm(b)
    return a == b


def _decide(field_name: str, observations: list[Observation]) -> Decision | None:
    observations = [o for o in observations if o.value not in (None, "", [], {})]
    if not observations:
        return None
    if len(observations) == 1:
        o = observations[0]
        return Decision(value=o.value, confidence="single_source", sources=(o.source,), urls=(o.url,))

    values = [o.value for o in observations]
    if field_name == "birth_place":
        place = _birth_place_decision(observations)
        if place is not None:
            return place
    if all(_same(values[0], v) for v in values[1:]):
        return Decision(
            value=values[0],
            confidence="cross_checked",
            sources=tuple(o.source for o in observations),
            urls=tuple(o.url for o in observations),
        )

    return Decision(
        value=None,
        confidence="conflict",
        sources=tuple(o.source for o in observations),
        urls=tuple(o.url for o in observations),
        candidates=[{"value": o.value, "source": o.source, "url": o.url} for o in observations],
    )


def _add(
    proposal: PlayerProposal,
    field_name: str,
    observations: list[Observation],
) -> None:
    decision = _decide(field_name, observations)
    if decision is None:
        return
    if decision.confidence == "conflict":
        proposal.conflicts.append({
            "field": _FIELD_LABELS[field_name],
            "candidates": decision.candidates,
        })
        return
    if decision.candidates:
        # Consenso: se aplica lo que comparten varias fuentes, pero la discrepancia queda visible.
        proposal.conflicts.append({
            "field": _FIELD_LABELS[field_name],
            "candidates": decision.candidates,
            "applied": decision.value,
            "resolution": decision.resolved_by or "consenso de fuentes",
        })
    if any(o.source == "official" for o in observations) and decision.confidence == "cross_checked":
        decision.confidence = "verified"
    proposal.decisions[field_name] = decision
    for source, url in zip(decision.sources, decision.urls, strict=False):
        if source and url:
            proposal.source_urls[source] = url


def _add_official_priority(
    proposal: PlayerProposal,
    field_name: str,
    observations: list[Observation],
) -> None:
    """Como `_add`, pero la ficha oficial del club gana si hay discrepancia.

    La discrepancia NO se oculta: queda en `conflicts` con la resolución aplicada.
    """
    decision = _decide(field_name, observations)
    if decision is None:
        return
    if decision.confidence != "conflict":
        _add(proposal, field_name, observations)
        return
    official_obs = [o for o in observations if o.source == "official"]
    if len(official_obs) != 1:
        proposal.conflicts.append({
            "field": _FIELD_LABELS[field_name],
            "candidates": decision.candidates,
        })
        return
    chosen = official_obs[0]
    proposal.decisions[field_name] = Decision(
        value=chosen.value,
        confidence="single_source",
        sources=("official",),
        urls=(chosen.url,),
    )
    proposal.conflicts.append({
        "field": _FIELD_LABELS[field_name],
        "candidates": decision.candidates,
        "applied": chosen.value,
        "resolution": "se usa la ficha oficial del club; el conflicto queda registrado",
    })
    proposal.source_urls["official"] = chosen.url


def _add_primary(
    proposal: PlayerProposal,
    field_name: str,
    observations: list[Observation],
    primary: str,
) -> None:
    """Como `_add`, pero una fuente primaria gana si hay discrepancia.

    Se usa solo donde la fuente primaria está documentada (p. ej. BDFutbol para el peso,
    porque el club no publica ese dato). La discrepancia queda en `conflicts`.
    """
    decision = _decide(field_name, observations)
    if decision is None:
        return
    if decision.confidence != "conflict":
        _add(proposal, field_name, observations)
        return
    primary_obs = [o for o in observations if o.source == primary]
    if len(primary_obs) != 1:
        proposal.conflicts.append({
            "field": _FIELD_LABELS[field_name],
            "candidates": decision.candidates,
        })
        return
    chosen = primary_obs[0]
    proposal.decisions[field_name] = Decision(
        value=chosen.value,
        confidence="single_source",
        sources=(primary,),
        urls=(chosen.url,),
    )
    proposal.conflicts.append({
        "field": _FIELD_LABELS[field_name],
        "candidates": decision.candidates,
        "applied": chosen.value,
        "resolution": f"se usa {primary} como fuente primaria; el conflicto queda registrado",
    })
    proposal.source_urls[primary] = chosen.url


def _photo_dict(photo: dict[str, Any]) -> dict[str, Any]:
    return dict(photo)


def _career_dict(entry: CareerEntryData) -> dict[str, Any]:
    return {
        "club": entry.club,
        "crest_url": entry.crest_url,
        "from": entry.from_,
        "to": entry.to,
        "appearances": entry.appearances,
        "goals": entry.goals,
        "assists": None,
        "minutes": entry.minutes,
        "yellow_cards": entry.yellow_cards,
        "red_cards": entry.red_cards,
        "seasons": [
            {
                "season": s.season,
                "appearances": s.appearances,
                "goals": s.goals,
                "assists": None,
                "minutes": s.minutes,
                "yellow_cards": s.yellow_cards,
                "red_cards": s.red_cards,
            }
            for s in entry.seasons
        ],
    }


def _totals_dict(values: dict[str, int | None]) -> dict[str, int | None]:
    return {
        "appearances": values.get("appearances"),
        "goals": values.get("goals"),
        "assists": values.get("assists"),
        "minutes": values.get("minutes"),
        "yellow_cards": values.get("yellow_cards"),
        "red_cards": values.get("red_cards"),
    }


def _totals_from_seasons(seasons: list[SeasonRow]) -> dict[str, int | None]:
    def total(attr: str) -> int | None:
        values = [getattr(s, attr) for s in seasons if getattr(s, attr) is not None]
        return sum(values) if values else None

    return {
        "appearances": total("appearances"),
        "goals": total("goals"),
        "assists": None,
        "minutes": total("minutes"),
        "yellow_cards": total("yellow_cards"),
        "red_cards": total("red_cards"),
    }


def _match_dict(match: MatchData) -> dict[str, Any]:
    return {
        "date": match.date,
        "opponent": match.opponent,
        "opponent_crest_url": match.opponent_crest_url,
        "competition": match.competition,
        "home": match.home,
        "team_goals": match.team_goals,
        "opponent_goals": match.opponent_goals,
        "result": match.result,
        "started": match.started,
        "minutes": match.minutes,
        "goals": match.goals,
        "assists": match.assists,
        "yellow_cards": match.yellow_cards,
        "red_cards": match.red_cards,
    }


def _career_overlap(bdf_career: list[CareerEntryData], wikidata_career: list[WikidataCareer]) -> bool:
    bdf_clubs = {_norm(c.club) for c in bdf_career}
    wd_clubs = {_norm(c.club) for c in wikidata_career}
    for a in bdf_clubs:
        for b in wd_clubs:
            if a and b and (a in b or b in a):
                return True
    return False


def collect_player(
    player: m.Player,
    bdf: BDFutbolClient | None,
    wd: WikidataClient | None,
    wiki_players: list[WikiPlayer],
    official_profiles: list[OfficialProfile],
    official_players: list[OfficialPlayer] = (),
    wiki_client: wikipedia.WikipediaClient | None = None,
    with_photos: bool = True,
    crest_resolver: crests.CrestResolver | None = None,
) -> PlayerProposal:
    proposal = PlayerProposal(player_id=player.id, name=player.name)

    # Wikidata primero: su etiqueta/alias ayuda a encontrar nombres cortos en BDFutbol ("Yeremay").
    wd_data: WikidataData | None = None
    if wd is not None:
        try:
            entity = wd.resolve(player.name, player.date_of_birth)
            if entity is None:
                proposal.notes.append("Wikidata: sin entidad con fecha de nacimiento exacta")
            else:
                wd_data = wd.extract(entity)
                proposal.wikidata = wd_data
                proposal.source_urls["Wikidata"] = wd_data.url
        except Exception as exc:
            proposal.notes.append(f"Wikidata: {exc}")

    candidate: Candidate | None = None
    profile: Profile | None = None
    matches: list[MatchData] = []
    if bdf is not None:
        try:
            aliases = tuple(
                term
                for term in ([wd_data.label, *wd_data.aliases] if wd_data else [])
                if term
            )
            candidate = bdf.resolve(player.name, player.date_of_birth, aliases)
            near_match = False
            if candidate is None:
                candidate = bdf.resolve_near(player.name, player.date_of_birth)
                near_match = candidate is not None
                if candidate is None:
                    proposal.notes.append("BDFutbol: sin candidato con fecha de nacimiento exacta")
            if candidate is not None:
                profile = bdf.profile(candidate)
                if (
                    player.date_of_birth
                    and profile.date_of_birth
                    and profile.date_of_birth != player.date_of_birth
                ):
                    if near_match:
                        proposal.notes.append(
                            f"BDFutbol: la ficha tiene {profile.date_of_birth}, no "
                            f"{player.date_of_birth}; se acepta solo para carrera/partidos "
                            "(mismo jugador y mismo club, fecha casi idéntica)"
                        )
                    else:
                        proposal.notes.append(
                            f"BDFutbol: la ficha tiene {profile.date_of_birth}, no "
                            f"{player.date_of_birth}; se descarta"
                        )
                        profile = None
                        candidate = None
                if profile is not None:
                    proposal.bdf = profile
                    proposal.source_urls["BDFutbol"] = candidate.url
                    try:
                        matches = bdf.matches(candidate)
                    except Exception as exc:  # una fuente secundaria no tumba al jugador
                        proposal.notes.append(f"BDFutbol partidos: {exc}")
        except Exception as exc:
            proposal.notes.append(f"BDFutbol: {exc}")

    wiki = wikipedia.choose_wiki(wiki_players, player.name, player.date_of_birth)
    if wiki is not None and player.date_of_birth and wiki.date_of_birth != player.date_of_birth:
        proposal.notes.append(
            f"Wikipedia: fecha de nacimiento {wiki.date_of_birth} distinta de la API "
            f"{player.date_of_birth}; se descarta"
        )
        wiki = None
    if wiki is not None:
        proposal.wiki = wiki
        proposal.source_urls["Wikipedia"] = wiki.source_url

    wiki_profiles: list[WikiProfile] = []
    if wiki_client is not None and wd_data is not None:
        titles = dict(wd_data.wiki_titles)
        if not titles and wd_data.wiki_title:
            titles[wd_data.wiki_lang] = wd_data.wiki_title
        for lang in ("es", "gl", "en"):
            title = titles.get(lang)
            if not title:
                continue
            profile_lang = wiki_client.profile(title, lang)
            if profile_lang is None:
                continue
            if (
                player.date_of_birth
                and profile_lang.date_of_birth
                and profile_lang.date_of_birth != player.date_of_birth
            ):
                proposal.notes.append(
                    f"Wikipedia ({lang}): fecha {profile_lang.date_of_birth} distinta "
                    f"de la API {player.date_of_birth}; no se usa su ficha"
                )
                continue
            wiki_profiles.append(profile_lang)
            proposal.source_urls[f"Wikipedia ({lang})"] = profile_lang.url
    if wiki_profiles:
        proposal.wiki_profiles = wiki_profiles
        proposal.wiki_profile = wiki_profiles[0]

    off = official.choose_profile(official_profiles, player.name, player.date_of_birth)
    if off is None:
        off_player = official.choose_official(list(official_players), player.name)
    else:
        off_player = None
    if off is not None:
        proposal.official = off
        proposal.source_urls["official"] = off.source_url
    elif off_player is not None:
        proposal.source_urls["official"] = off_player.source_url

    observations: dict[str, list[Observation]] = {f: [] for f in _SIMPLE_FIELDS}
    if profile is not None:
        if profile.birth_place:
            observations["birth_place"].append(Observation(profile.birth_place, "BDFutbol", profile.url))
        if profile.height_cm is not None:
            observations["height_cm"].append(Observation(profile.height_cm, "BDFutbol", profile.url))
        if profile.weight_kg is not None:
            observations["weight_kg"].append(Observation(profile.weight_kg, "BDFutbol", profile.url))
        if profile.career and profile.career[-1].club.lower().startswith("deportivo"):
            current = profile.career[-1].seasons[-1]
            if current.shirt_number is not None:
                observations["shirt_number"].append(
                    Observation(current.shirt_number, "BDFutbol", profile.url)
                )
    if wd_data is not None:
        if wd_data.birth_place:
            observations["birth_place"].append(Observation(wd_data.birth_place, "Wikidata", wd_data.url))
        if wd_data.height_cm is not None:
            observations["height_cm"].append(Observation(wd_data.height_cm, "Wikidata", wd_data.url))
        if wd_data.preferred_foot:
            observations["preferred_foot"].append(Observation(wd_data.preferred_foot, "Wikidata", wd_data.url))
        if wd_data.shirt_number is not None:
            observations["shirt_number"].append(Observation(wd_data.shirt_number, "Wikidata", wd_data.url))
    for wiki_profile in wiki_profiles:
        source = f"Wikipedia ({wiki_profile.url.split('/')[2].split('.')[0]})"
        if wiki_profile.birth_place:
            observations["birth_place"].append(
                Observation(wiki_profile.birth_place, source, wiki_profile.url)
            )
        if wiki_profile.height_cm is not None:
            observations["height_cm"].append(
                Observation(wiki_profile.height_cm, source, wiki_profile.url)
            )
        if wiki_profile.weight_kg is not None:
            observations["weight_kg"].append(
                Observation(wiki_profile.weight_kg, source, wiki_profile.url)
            )
    if wiki is not None:
        if wiki.shirt_number is not None:
            observations["shirt_number"].append(Observation(wiki.shirt_number, "Wikipedia", wiki.source_url))
        if wiki.contract_until:
            observations["contract_until"].append(Observation(wiki.contract_until, "Wikipedia", wiki.source_url))
        if wiki.loan_from:
            observations["loan_from"].append(Observation(wiki.loan_from, "Wikipedia", wiki.source_url))
    if off_player is not None:
        observations["shirt_number"].append(Observation(off_player.shirt_number, "official", off_player.source_url))
    if off is not None:
        if off.height_cm is not None:
            observations["height_cm"].append(Observation(off.height_cm, "official", off.source_url))
        if off.preferred_foot:
            observations["preferred_foot"].append(Observation(off.preferred_foot, "official", off.source_url))

    for key, obs in observations.items():
        if key == "weight_kg":
            _add_primary(proposal, key, obs, "BDFutbol")
        elif key in {"shirt_number", "height_cm", "preferred_foot"}:
            _add_official_priority(proposal, key, obs)
        else:
            _add(proposal, key, obs)

    social: dict[str, str | None] = {"x": None, "instagram": None, "tiktok": None}
    social_sources: list[str] = []
    social_urls: list[str] = []
    for network in social:
        wd_value = wd_data.social.get(network) if wd_data is not None else None
        off_value = off.social.get(network) if off is not None else None
        handle = None
        if wd_value:
            candidate_handle = wd_value.strip().lstrip("@")
            if re.fullmatch(r"[A-Za-z0-9._]{1,30}", candidate_handle):
                handle = candidate_handle
                social_sources.append("Wikidata")
                social_urls.append(wd_data.url if wd_data else "")
            else:
                proposal.notes.append(f"Wikidata: handle de {network} no válido ({wd_value!r}); se omite")
        if off_value:
            if handle and _norm(handle) != _norm(off_value):
                proposal.notes.append(
                    f"Redes: {network} difiere entre Wikidata (@{handle}) y la web oficial "
                    f"(@{off_value}); se usa la oficial"
                )
            handle = off_value
            social_sources.append("official")
            social_urls.append(off.source_url if off else "")
        social[network] = handle
    if any(social.values()):
        sources = tuple(dict.fromkeys(s for s in social_sources if s))
        proposal.decisions["social"] = Decision(
            value=social,
            confidence="cross_checked" if len(set(sources)) > 1 else "single_source",
            sources=sources or ("desconocida",),
            urls=tuple(dict.fromkeys(u for u in social_urls if u)),
        )

    # Solo la foto que publica el club en su ficha oficial. El resto de fuentes de imagen
    # (Commons/Wikipedia) se descartan a propósito: el retrato de perfil debe ser el del Depor.
    if with_photos and off is not None and off.photo_url:
        photos = [{
            "url": off.photo_url,
            "role": "portrait",
            "width": None,
            "height": None,
            "license": "Uso editorial del club (sin licencia de reutilización)",
            "license_url": None,
            "author": "RC Deportivo de La Coruña",
            "credit": "© RC Deportivo de La Coruña",
            "source_url": off.source_url,
        }]
        proposal.decisions["photos"] = Decision(
            value=photos,
            confidence="single_source",
            sources=("official",),
            urls=(off.source_url,),
        )

    if crest_resolver is not None:
        for entry in profile.career if profile is not None else []:
            entry.crest_url = crest_resolver.resolve(entry.club)
        for match in matches:
            match.opponent_crest_url = crest_resolver.resolve(match.opponent)

    if profile is not None and profile.career:
        confidence = "cross_checked" if wd_data and _career_overlap(profile.career, wd_data.career) else "single_source"
        proposal.decisions["career"] = Decision(
            value=profile.career,
            confidence=confidence,
            sources=("BDFutbol", "Wikidata") if confidence == "cross_checked" else ("BDFutbol",),
            urls=(profile.url, wd_data.url if wd_data else ""),
        )
    elif wd_data is not None and wd_data.career:
        proposal.decisions["career"] = Decision(
            value=[
                CareerEntryData(
                    club=c.club,
                    from_=c.from_,
                    to=c.to,
                    appearances=c.appearances,
                    goals=c.goals,
                    minutes=None,
                    yellow_cards=None,
                    red_cards=None,
                    seasons=[],
                    crest_url=(
                        crest_resolver.resolve(c.club) if crest_resolver is not None else None
                    ),
                )
                for c in wd_data.career
            ],
            confidence="single_source",
            sources=("Wikidata",),
            urls=(wd_data.url,),
        )
    if profile is not None:
        totals = profile.totals
        if not any(v is not None for v in totals.values()):
            totals = _totals_from_seasons(profile.seasons)
        if any(v is not None for v in totals.values()):
            proposal.decisions["career_totals"] = Decision(
                value=totals,
                confidence="single_source",
                sources=("BDFutbol",),
                urls=(profile.url,),
            )
    if matches:
        proposal.decisions["depor_matches"] = Decision(
            value=matches,
            confidence="single_source",
            sources=("BDFutbol",),
            urls=(f"{bdfutbol.BASE}/es/p/{candidate.bdf_id}.html",) if candidate else (),
        )

    return proposal


def build_proposals(
    squad: m.Squad,
    bdf: BDFutbolClient | None,
    wd: WikidataClient | None,
    wiki_players: list[WikiPlayer],
    official_profiles: list[OfficialProfile],
    official_players: list[OfficialPlayer] = (),
    limit: int | None = None,
    log: Any = None,
    wiki_client: wikipedia.WikipediaClient | None = None,
    with_photos: bool = True,
    crest_resolver: crests.CrestResolver | None = None,
) -> EnrichmentProposal:
    players = squad.players[:limit] if limit else squad.players
    out: list[PlayerProposal] = []
    for player in players:
        if log:
            log(f"· {player.name}")
        try:
            out.append(collect_player(
                player, bdf, wd, wiki_players, official_profiles, official_players,
                wiki_client, with_photos, crest_resolver,
            ))
        except Exception as exc:
            out.append(PlayerProposal(player_id=player.id, name=player.name, error=str(exc)))
    return EnrichmentProposal(
        squad_updated_at=squad.updated_at,
        generated_at=date.today().isoformat(),
        players=out,
        source_urls={
            "BDFutbol": bdfutbol.BASE,
            "Wikidata": wikidata.API,
            "Wikipedia": "https://es.wikipedia.org/wiki/Real_Club_Deportivo_de_La_Coruña",
        },
    )


def proposal_data(proposal: EnrichmentProposal, min_confidence: str) -> dict[str, Any]:
    players: dict[str, Any] = {}
    for player in proposal.players:
        entry: dict[str, Any] = {
            "name": player.name,
            "missing": player.missing(),
            "sources": player.source_urls,
        }
        extras = player.to_extras(min_confidence)
        if extras:
            entry["applied"] = extras
        if player.conflicts:
            entry["conflicts"] = player.conflicts
        if player.notes:
            entry["notes"] = player.notes
        if player.error:
            entry["error"] = player.error
        players[str(player.player_id)] = entry
    return {
        "generatedAt": proposal.generated_at,
        "squadUpdatedAt": proposal.squad_updated_at,
        "minConfidence": min_confidence,
        "sources": proposal.source_urls,
        "coverage": proposal.coverage(),
        "players": players,
    }


EXTRAS_HEADER = """# GENERADO por `python -m depor_hub.cli enrich --apply`.
# Datos de BDFutbol, Wikidata y Wikipedia con fuente y confianza. Los conflictos NO se aplican.
# Puedes editar este fichero a mano: el dato manual manda y este generador solo rellena huecos.
"""


def write_extras(path: Path, players: dict[int, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.safe_dump({"players": players}, allow_unicode=True, sort_keys=False, width=100)
    path.write_text(EXTRAS_HEADER + body, encoding="utf-8")


def write_proposal(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "# Informe de enriquecimiento. Revisa `conflicts` antes de tocar nada a mano.\n"
        + yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=120),
        encoding="utf-8",
    )


def load_manual(path: Path) -> dict[int, dict[str, Any]]:
    if not path.exists():
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    result: dict[int, dict[str, Any]] = {}
    for key, value in (raw.get("players") or {}).items():
        try:
            result[int(key)] = _normalize_extras(dict(value or {}))
        except (TypeError, ValueError):
            continue
    return result


# Versiones antiguas del generador escribían las claves anidadas en camelCase. Se aceptan
# al leer para no romper ficheros ya existentes, pero siempre se escribe snake_case.
_LEGACY_KEYS = {
    "yellowCards": "yellow_cards",
    "redCards": "red_cards",
    "teamGoals": "team_goals",
    "opponentGoals": "opponent_goals",
    "careerTotals": "career_totals",
    "deporMatches": "depor_matches",
    "capturedAt": "captured_at",
    "shirtNumber": "shirt_number",
    "contractUntil": "contract_until",
    "heightCm": "height_cm",
    "weightKg": "weight_kg",
    "birthPlace": "birth_place",
    "preferredFoot": "preferred_foot",
    "loanFrom": "loan_from",
    "marketValueEur": "market_value_eur",
    "licenseUrl": "license_url",
    "sourceUrl": "source_url",
    "crestUrl": "crest_url",
    "opponentCrestUrl": "opponent_crest_url",
}


def _snake(value: dict[str, Any]) -> dict[str, Any]:
    return {_LEGACY_KEYS.get(key, key): item for key, item in value.items()}


def _normalize_extras(raw: dict[str, Any]) -> dict[str, Any]:
    data = _snake(raw)
    career = data.get("career")
    if isinstance(career, list):
        entries: list[Any] = []
        for entry in career:
            if not isinstance(entry, dict):
                entries.append(entry)
                continue
            clean = _snake(entry)
            if isinstance(clean.get("seasons"), list):
                clean["seasons"] = [
                    _snake(s) if isinstance(s, dict) else s for s in clean["seasons"]
                ]
            entries.append(clean)
        data["career"] = entries
    if isinstance(data.get("career_totals"), dict):
        data["career_totals"] = _snake(data["career_totals"])
    if isinstance(data.get("depor_matches"), list):
        data["depor_matches"] = [
            _snake(x) if isinstance(x, dict) else x for x in data["depor_matches"]
        ]
    if isinstance(data.get("photos"), list):
        data["photos"] = [
            _snake(photo) if isinstance(photo, dict) else photo for photo in data["photos"]
        ]
    provenance = data.get("provenance")
    if isinstance(provenance, dict):
        # Las claves de provenance son los nombres camelCase del contrato: no se tocan.
        data["provenance"] = {
            key: _snake(value) if isinstance(value, dict) else value
            for key, value in provenance.items()
        }
    return data


def merge_extras(
    manual: dict[int, dict[str, Any]], generated: dict[int, dict[str, Any]]
) -> dict[int, dict[str, Any]]:
    """El dato manual manda; el generado solo rellena lo que falta."""
    out = {pid: dict(value) for pid, value in manual.items()}
    for pid, gen in generated.items():
        current = out.get(pid)
        if current is None:
            out[pid] = dict(gen)
            continue
        merged = dict(current)
        for key, value in gen.items():
            if key == "provenance":
                merged["provenance"] = {**value, **(current.get("provenance") or {})}
            elif key in {"name", "source", "confidence", "captured_at"}:
                merged.setdefault(key, value)
            elif key not in merged or merged[key] in (None, [], {}):
                merged[key] = value
        out[pid] = merged
    return out


__all__ = [
    "EnrichmentProposal",
    "PlayerProposal",
    "build_proposals",
    "collect_player",
    "load_manual",
    "merge_extras",
    "proposal_data",
    "write_extras",
    "write_proposal",
]
