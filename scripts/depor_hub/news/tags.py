"""Etiquetado por reglas de las noticias (ADR 0016)."""

from __future__ import annotations

import re

from .relevance import RelevanceIndex, fold

_RULES: dict[str, tuple[str, ...]] = {
    "fichajes": (
        "fichaje", "fichajes", "fichar", "refuerzo", "refuerzos", "incorporacion",
        "incorporaciones", "traspaso", "traspasos", "cesion", "cesiones", "renovacion",
        "renovaciones", "mercado de fichajes", "rumor", "rumores", "agente libre",
    ),
    "cantera": (
        "cantera", "fabril", "filial", "juvenil", "juveniles", "abegondo", "depor abanca",
        "cadete", "infantil", "alevin",
    ),
    "partido": (
        "partido", "partidos", "jornada", "previa", "cronica", "resumen", "alineacion",
        "alineaciones", "derbi", "marcador", "gol", "goles", "victoria", "derrota",
        "empate", "riazor", "abanca-riazor", "playoff", "ascenso",
    ),
    "rueda-de-prensa": (
        "rueda de prensa", "comparecencia", "declaraciones", "atencion a los medios",
        "previa de prensa", "preguntas de los medios",
    ),
    "lesiones": (
        "lesion", "lesiones", "lesionado", "lesionada", "baja", "bajas", "enfermeria",
        "recuperacion", "molestias", "esguince", "rotura", "muscular", "parte medico",
    ),
    "entrenador": (
        "entrenador", "entrenadora", "mister", "tecnico", "cuerpo tecnico",
    ),
    "aficion": (
        "aficion", "aficionados", "aficionada", "pena deportivista", "penas deportivistas",
        "abonados", "abonado", "grada", "gradas", "hinchas", "aficion deportivista",
    ),
    "resultados": (
        "resultado", "resultados", "marcador", "clasificacion", "puntos", "victoria",
        "derrota", "empate", "goles",
    ),
}

_COMPILED = {
    tag: tuple(re.compile(rf"(?<!\w){re.escape(word)}(?!\w)") for word in words)
    for tag, words in _RULES.items()
}


def base_tags(text: str) -> list[str]:
    normalized = fold(text)
    return sorted(tag for tag, patterns in _COMPILED.items() if any(p.search(normalized) for p in patterns))


def build_tags(text: str, index: RelevanceIndex) -> list[str]:
    tags = set(base_tags(text))
    tags.update(index.rival_tags(text))
    tags.update(f"player:{player_id}" for player_id in index.player_ids(text))
    return sorted(tags)[:12]
