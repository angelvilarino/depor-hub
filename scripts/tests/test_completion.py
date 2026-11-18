"""Completitud del enriquecimiento (D1-10).

Dos comprobaciones sobre lo publicado, no sobre la propuesta local:

- Todo campo enriquecido con valor lleva su procedencia y ninguna confianza es
  `conflict`: lo que llega a la app está resuelto.
- Los huecos son deliberados: un campo sin dato queda en `null` y no se rellena
  por inferencia.

Además fija la precedencia manual que resuelve los conflictos entre fuentes.
"""

from __future__ import annotations

import json
from pathlib import Path

from depor_hub.enrich import proposal

DATA = Path("data/public/v1")

# Campos que publica el enriquecimiento; el resto (`id`, `name`, `position`...) viene de football-data.
ENRICHED_FIELDS = {
    "birthPlace",
    "career",
    "careerTotals",
    "contractUntil",
    "deporMatches",
    "heightCm",
    "photos",
    "preferredFoot",
    "shirtNumber",
    "social",
    "weightKg",
}

COACH_FIELDS = {"birthDate", "birthPlace", "career", "photoUrl", "since", "staff"}


def _players() -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted((DATA / "players").glob("*.json"))]


def _has_value(value: object) -> bool:
    """Un objeto con todos sus campos en `null` es un hueco, no un dato."""
    if isinstance(value, dict):
        return any(item is not None for item in value.values())
    return value not in (None, [], "")


def test_published_players_have_provenance_for_every_enriched_field():
    missing = []
    for player in _players():
        provenance = player.get("provenance") or {}
        for field in ENRICHED_FIELDS:
            if not _has_value(player.get(field)) and field not in provenance:
                continue
            if field not in provenance:
                missing.append(f"{player['id']}.{field}")
    assert missing == []


def test_published_players_have_no_unresolved_conflicts():
    conflicts = [
        f"{player['id']}.{field}"
        for player in _players()
        for field, entry in (player.get("provenance") or {}).items()
        if entry.get("confidence") == "conflict"
    ]
    assert conflicts == []


def test_coach_fields_have_provenance_and_no_conflicts():
    coach = json.loads((DATA / "squad.json").read_text(encoding="utf-8")).get("coach") or {}
    provenance = coach.get("provenance") or {}

    missing = [
        field
        for field in COACH_FIELDS
        if _has_value(coach.get(field)) and field not in provenance
    ]
    assert missing == []
    assert all(entry.get("confidence") != "conflict" for entry in provenance.values())


def test_gaps_are_null_and_never_invented():
    """Los tres pesos sin fuente siguen en `null`; no se estiman (D1-10)."""
    gaps = {player["name"]: player.get("weightKg") for player in _players() if player.get("weightKg") is None}

    assert gaps == {
        "Ede Bright": None,
        "Teun Gijselhart": None,
        "Jonathan Asp-Jensen": None,
    }


def test_manual_override_wins_over_generated_extras():
    """Precedencia: overrides > extras > propuesta automática, campo a campo."""
    overrides = {1: {"height_cm": 180, "source": "Ficha oficial", "confidence": "verified"}}
    extras = {1: {"height_cm": 175, "weight_kg": 74, "source": "BDFutbol"}}

    merged = proposal.merge_extras(overrides, extras)

    assert merged[1]["height_cm"] == 180
    assert merged[1]["weight_kg"] == 74
    assert merged[1]["source"] == "Ficha oficial"
    assert merged[1]["confidence"] == "verified"
