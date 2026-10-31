"""Etiquetas cerradas y explicables (ADR 0018).

Nunca se derivan etiquetas de nombres de equipos o jugadores. Como máximo dos por
historia y, si ninguna regla aplica, la lista queda vacía.
"""

from __future__ import annotations

import re

from .normalize import fold

TAXONOMY: tuple[str, ...] = (
    "fichajes",
    "cantera",
    "lesiones",
    "partido",
    "aficion",
    "club",
    "opinion",
)

_RULES: dict[str, tuple[str, ...]] = {
    "fichajes": (
        "fichaje",
        "fichajes",
        "ficha",
        "fichan",
        "fichar",
        "refuerzo",
        "refuerzos",
        "incorpora",
        "incorporan",
        "incorporacion",
        "incorporaciones",
        "traspaso",
        "traspasos",
        "cede",
        "cedido",
        "cedida",
        "cesion",
        "cesiones",
        "renueva",
        "renuevan",
        "renovacion",
        "renovaciones",
        "mercado de fichajes",
        "rumor",
        "rumores",
        "agente libre",
        "contrato",
        "clausula",
    ),
    "cantera": (
        "cantera",
        "fabril",
        "filial",
        "juvenil",
        "juveniles",
        "abegondo",
        "depor abanca",
        "cadete",
        "infantil",
        "alevin",
        "alevines",
    ),
    "lesiones": (
        "lesion",
        "lesiones",
        "lesionado",
        "lesionada",
        "lesionados",
        "lesionadas",
        "lesionarse",
        "enfermeria",
        "parte medico",
        "esguince",
        "rotura",
        "molestias",
        "muscular",
        "recuperacion",
        "bajas",
    ),
    "partido": (
        "partido",
        "partidos",
        "jornada",
        "previa",
        "cronica",
        "resumen",
        "alineacion",
        "alineaciones",
        "convocatoria",
        "marcador",
        "gol",
        "goles",
        "victoria",
        "derrota",
        "empate",
        "copa",
        "liga",
        "playoff",
        "asciende",
        "desciende",
        "ascenso",
        "descenso",
        "arbitro",
        "tarjeta",
        "gana al",
        "gana en",
        "ganan al",
        "vence al",
        "pierde ante",
        "pierden ante",
        "rueda de prensa",
        "comparecencia",
    ),
    "aficion": (
        "aficion",
        "aficionados",
        "aficionada",
        "abonados",
        "abonado",
        "grada",
        "gradas",
        "pena deportivista",
        "penas deportivistas",
        "hinchas",
        "seguidores",
        "socios",
    ),
    "club": (
        "club",
        "institucional",
        "asamblea",
        "presidente",
        "directiva",
        "consejo",
        "accionistas",
        "fundacion",
        "aniversario",
        "historia",
        "historico",
        "homenaje",
        "estadio",
        "ciudad",
        "patrocinio",
        "camiseta",
        "equipacion",
        "convenio",
        "ayuntamiento",
        "tertulia",
        "foro",
        "centenario",
        "tienda",
    ),
    "opinion": (
        "opinion",
        "analisis",
        "columna",
        "editorial",
        "reflexion",
        "debate",
        "tertulia",
        "las notas",
        "el 1x1",
        "apuntes",
        "comentario",
    ),
}

_COMPILED = {
    tag: tuple(re.compile(rf"(?<!\w){re.escape(word)}(?!\w)") for word in words)
    for tag, words in _RULES.items()
}

_NECRO = {
    "muerte",
    "fallecimiento",
    "fallece",
    "fallecido",
    "fallecida",
    "luto",
    "funeral",
    "obituario",
    "pesame",
    "condolencias",
    "sepelio",
    "entierro",
}
_LESION_EVIDENCE = {
    "lesion",
    "lesiones",
    "lesionado",
    "lesionada",
    "lesionados",
    "lesionadas",
    "lesionarse",
    "enfermeria",
    "parte medico",
    "esguince",
    "rotura",
    "molestias",
    "muscular",
}


def _matches(text: str, words: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(text) for pattern in words)


def build_tags(title: str, summary: str | None = None) -> list[str]:
    title_text = fold(title)
    body_text = fold(summary or "")
    scores: dict[str, int] = {}
    for tag, patterns in _COMPILED.items():
        if _matches(title_text, patterns):
            scores[tag] = scores.get(tag, 0) + 2
        if _matches(body_text, patterns):
            scores[tag] = scores.get(tag, 0) + 1
    if any(pattern in title_text for pattern in _NECRO):
        scores.pop("lesiones", None)
    if "lesiones" in scores and not any(
        re.search(rf"(?<!\w){re.escape(word)}(?!\w)", title_text + " " + body_text)
        for word in _LESION_EVIDENCE
    ):
        scores.pop("lesiones", None)
    ordered = sorted(scores.items(), key=lambda item: (-item[1], TAXONOMY.index(item[0])))
    return [tag for tag, _score in ordered[:2]]
