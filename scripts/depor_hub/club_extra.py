"""Ampliaciones editoriales del club: títulos, rivalidades y sondeo de medios.

Este módulo mantiene separado lo que ya publica `club.json` de los ficheros
opcionales `titles.json` y `rivalries.json`. Reglas:

- Pydantic sigue siendo el origen del contrato; este módulo solo carga YAML,
  valida y publica.
- `titles.proposed.yml` es una propuesta: nunca se aplica sola.
- El balance de rivalidades se rellena desde BDFutbol con `PoliteClient`
  (caché, robots.txt y ritmo); si falla, el bloque queda en `null`.
- El sondeo de medios no descarga binarios al repositorio: solo comprueba la
  URL, el tipo y las dimensiones, y escribe una propuesta para revisión.
"""

from __future__ import annotations

import html as html_lib
import io
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import yaml

from . import models as m
from .enrich.htmlutil import normalize_space, strip_tags
from .enrich.http import PoliteClient, SourceBlocked, SourceError
from .rivals import fetch_head_to_head

_BDFUTBOL_TEAM = "https://www.bdfutbol.com/es/e/e13.html"
_PALMARES_TABLE = re.compile(
    r'<table[^>]*class="[^"]*taula-palmares[^"]*"[^>]*>(.*?)</table>', re.S
)
_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
_SEASON = re.compile(r">(\d{4}-\d{2})<")
_COUNT = re.compile(r"\s+\d+$")
_HREF = re.compile(r"""href=["']([^"']+)["']""")
_TEAM_PATH = re.compile(r"/e/e(\d+)\.html")
_DATE_DMY = re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b")
_TABLE_ID = re.compile(r'<table[^>]*id="taulaplantilla"[^>]*>(.*?)</table>', re.S)
_ROLE = re.compile(r'<div class="fit (por|ltd|lti|cen|mig|dac|dav)"></div>')
_PLAYER_NAME = re.compile(
    r"<span class=['\"]font-weight-bold mr-2 float-left['\"]>([^<]+)</span>"
)
_GOAL_ENTRY = re.compile(
    r"<span[^>]*>\s*(\d+)\s*-\s*(\d+)\s*</span>\s*<a[^>]*>(.*?)</a>\s*(\d+)'",
    re.S,
)
_REFEREE_LINK = re.compile(
    r"""href=["']\.\./r/r\d+\.html["'][^>]*>(.*?)</a>""", re.S
)
_MATCH_TITLE = re.compile(
    r"<title>\s*(.*?)\s*-\s*(.*?)\s*\((\d+)\s*-\s*(\d+)\)\s*"
    r"(\d{2}/\d{2}/\d{4})",
    re.S,
)
_WIKI_GOAL = re.compile(r"\{\{goal\|(\d+)(?:\|[^}]*)?\}\}")
_WIKI_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")

_COMPETITION_CODES = {
    "Copa del Rey": "COP",
    "Supercopa de España": "SUP",
}
_COMPETITION_WIKI = {
    "Copa del Rey": "https://en.wikipedia.org/wiki/{year}_Copa_del_Rey_final",
}
_ROLE_LABELS = {
    "por": "Portero",
    "ltd": "Lateral",
    "lti": "Lateral",
    "cen": "Defensa central",
    "mig": "Centrocampista",
    "dac": "Delantero",
    "dav": "Delantero",
}
_TEAM_STOPWORDS = {
    "ca",
    "cd",
    "cf",
    "club",
    "de",
    "del",
    "el",
    "fc",
    "futbol",
    "la",
    "las",
    "los",
    "rc",
    "real",
    "sad",
    "sd",
    "ud",
}
_VENUE_STOPWORDS = {"estadio", "stadium", "municipal"}
_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _same_content(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    return {k: v for k, v in previous.items() if k != "updatedAt"} == {
        k: v for k, v in current.items() if k != "updatedAt"
    }


def _publish(model: m.Public, target: Path, force: bool = False) -> tuple[bool, Any]:
    """Escribe un JSON opcional de forma idempotente (updatedAt solo si cambia)."""
    body = model.model_dump(by_alias=True, mode="json")
    if target.exists() and not force:
        try:
            previous = json.loads(target.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            previous = None
        if isinstance(previous, dict) and _same_content(previous, body):
            body["updatedAt"] = previous.get("updatedAt", body["updatedAt"])
            return False, type(model).model_validate(body)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return True, type(model).model_validate_json(target.read_text(encoding="utf-8"))


# --- Títulos ----------------------------------------------------------------


def load_titles(path: Path, now: str | None = None) -> m.Titles:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} debe contener un objeto YAML")
    raw.setdefault("updated_at", now or _now())
    return m.Titles.model_validate(raw)


def publish_titles(
    config_path: Path,
    out_dir: Path,
    now: str | None = None,
    force: bool = False,
) -> tuple[bool, m.Titles]:
    titles = load_titles(config_path, now)
    return _publish(titles, out_dir / "titles.json", force)


@dataclass(frozen=True)
class ProposedTitle:
    competition: str
    year: int
    season: str
    source_url: str | None = None


def _normalize_competition(name: str) -> str | None:
    clean = _COUNT.sub("", normalize_space(name)).strip()
    lower = clean.lower()
    # BDFutbol mezcla títulos de equipo con premios individuales.
    if any(word in lower for word in ("pichichi", "zamora", "máximo goleador", "maximo goleador")):
        return None
    if lower.startswith("liga 1"):
        return "Primera División"
    if lower == "liga":
        return "Primera División"
    if lower.startswith("liga 2"):
        return "Segunda División"
    if "1a rfef" in lower or "primera federación" in lower or "primera federacion" in lower:
        return "Primera Federación"
    if lower.startswith("copa del rey"):
        return "Copa del Rey"
    if lower.startswith("supercopa"):
        return "Supercopa de España"
    if lower.startswith("concurso españa") or lower.startswith("concurso espana"):
        return "Concurso España"
    return clean or None


def _season_year(competition: str, season: str) -> int:
    """Año del título: fin de temporada en liga/copa; inicio en Supercopa y Concurso."""
    start = int(season[:4])
    if competition in {"Supercopa de España", "Concurso España"}:
        return start
    return start + 1


def parse_bdfutbol_titles(html: str, source_url: str = _BDFUTBOL_TEAM) -> list[ProposedTitle]:
    """Extrae solo títulos de equipo del bloque «Títulos» de BDFutbol."""
    table_match = _PALMARES_TABLE.search(html)
    if not table_match:
        raise SourceError("BDFutbol no publicó la tabla de títulos")
    out: list[ProposedTitle] = []
    seen: set[tuple[str, int]] = set()
    for row in _ROW.findall(table_match.group(1)):
        cells = _TD.findall(row)
        if len(cells) < 3:
            continue
        name = strip_tags(cells[1])
        competition = _normalize_competition(name)
        if not competition:
            continue
        seasons = _SEASON.findall(cells[2])
        hrefs = _HREF.findall(cells[2])
        for index, season in enumerate(seasons):
            year = _season_year(competition, season)
            key = (competition, year)
            if key in seen:
                continue
            seen.add(key)
            href = hrefs[index] if index < len(hrefs) else None
            item_url = urljoin(source_url, href) if href else None
            out.append(
                ProposedTitle(
                    competition=competition,
                    year=year,
                    season=season,
                    source_url=item_url,
                )
            )
    out.sort(key=lambda item: (item.competition, item.year))
    return out


def _text(value: str) -> str:
    return normalize_space(html_lib.unescape(strip_tags(value)))


def _iso_date_dmy(value: str) -> str | None:
    match = _DATE_DMY.search(value)
    if not match:
        return None
    day, month, year = match.groups()
    try:
        datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
    except ValueError:
        return None
    return f"{year}-{month}-{day}"


def _int_or_none(value: str) -> int | None:
    match = re.search(r"-?\d+", value)
    return int(match.group()) if match else None


def _bdfutbol_team_id(team_url: str) -> str:
    match = _TEAM_PATH.search(urlparse(team_url).path)
    if not match:
        raise ValueError(f"no se pudo leer el id del equipo en {team_url}")
    return match.group(1)


def _season_url(team_url: str, season: str, team_id: str) -> str:
    return urljoin(team_url, f"../t/t{season}{team_id}.html")


def _competition_url(
    season_html: str, season_url: str, season: str, code: str
) -> str | None:
    pattern = re.compile(
        rf"""href=["']([^"']*t{re.escape(season)}a{re.escape(code)}\.html)["']""",
        re.I,
    )
    match = pattern.search(season_html)
    return urljoin(season_url, match.group(1)) if match else None


@dataclass(frozen=True)
class FinalRow:
    label: str
    date: str | None
    home: str
    away: str
    home_goals: int
    away_goals: int
    venue: str | None
    note: str | None
    source_url: str | None


def parse_final_rows(html: str, source_url: str = "") -> list[FinalRow]:
    """Lee las filas `Final` de la página de una competición de BDFutbol."""
    rows: list[FinalRow] = []
    for row in _ROW.findall(html):
        cells = _TD.findall(row)
        if len(cells) < 8:
            continue
        label = _text(cells[0])
        if not label.lower().startswith("final"):
            continue
        scores = [
            int(value)
            for value in re.findall(
                r"resultat-gols[^>]*>\s*(-?\d+)\s*<", cells[4]
            )
        ]
        if len(scores) < 2:
            continue
        note_match = re.search(r"""title=['"]([^'"]+)['"]""", cells[8])
        note = _text(note_match.group(1)) if note_match else None
        href = _HREF.search(row)
        base = source_url or "https://www.bdfutbol.com/es/t/"
        rows.append(
            FinalRow(
                label=label,
                date=_iso_date_dmy(_text(cells[1])),
                home=_text(cells[2]),
                away=_text(cells[6]),
                home_goals=scores[0],
                away_goals=scores[1],
                venue=_text(cells[7]) or None,
                note=note,
                source_url=urljoin(base, href.group(1)) if href else None,
            )
        )
    return rows


def parse_match_page(html: str, source_url: str = "") -> m.FinalMatch:
    """Extrae la ficha de un partido: fecha, equipos, marcador, sede, árbitro y goles."""
    title_match = _MATCH_TITLE.search(html)
    if not title_match:
        raise SourceError(f"ficha de partido sin título reconocible: {source_url}")

    home, away = _text(title_match.group(1)), _text(title_match.group(2))
    home_goals, away_goals = int(title_match.group(3)), int(title_match.group(4))

    competition = round_name = venue = None
    for label, target in (
        ("Competición", "competition"),
        ("Ronda", "round"),
        ("Estadio", "venue"),
    ):
        match = re.search(
            rf"{label}</div>\s*<div[^>]*>\s*<a[^>]*>(.*?)</a>", html, re.S
        )
        if not match:
            continue
        value = _text(match.group(1))
        if target == "competition":
            competition = value
        elif target == "round":
            round_name = value
        else:
            venue = value

    referee_match = _REFEREE_LINK.search(html)
    referee = _text(referee_match.group(1)) if referee_match else None

    start = html.find("row pt-1 pt-md-3 pb-2 text-center")
    end = html.find("row pt-1 pb-4", start)
    block = html[start : end if end > 0 else start + 12000] if start >= 0 else ""
    right = block.find('class="text-right"')
    left = block.find('class="text-left"')
    scorers: list[m.GoalScorer] = []
    for match in _GOAL_ENTRY.finditer(block):
        position = match.start()
        team = home if right >= 0 and position > right and (left < 0 or position < left) else away
        scorers.append(
            m.GoalScorer(
                player=_text(match.group(3)),
                goals=1,
                minute=int(match.group(4)),
                team=team,
            )
        )

    return m.FinalMatch(
        date=_iso_date_dmy(title_match.group(5)),
        competition=competition,
        round_=round_name,
        home=home,
        away=away,
        home_goals=home_goals,
        away_goals=away_goals,
        venue=venue,
        referee=referee,
        goal_scorers=scorers,
        source_url=source_url or None,
    )


def parse_squad(html: str) -> list[m.TitleSquadMember]:
    """Lee la plantilla de `table#taulaplantilla` (PJ y G; porteros sin goles)."""
    table_match = _TABLE_ID.search(html)
    if not table_match:
        return []
    table = table_match.group(1)
    header = re.search(r"<tr[^>]*>(.*?)</tr>", table, re.S)
    if not header:
        return []
    columns = re.findall(r"""data-colid=['"]([^'"]+)['"]""", header.group(1))
    if "pj" not in columns or "g" not in columns:
        return []
    pj_index, goals_index = columns.index("pj"), columns.index("g")
    name_index = columns.index("nom") if "nom" in columns else 3

    squad: list[m.TitleSquadMember] = []
    for row in _ROW.findall(table):
        cells = _TD.findall(row)
        if len(cells) <= max(pj_index, goals_index, name_index):
            continue
        name_match = _PLAYER_NAME.search(row)
        name = _text(name_match.group(1)) if name_match else _text(cells[name_index])
        if not name:
            continue
        role_match = _ROLE.search(row)
        role = _ROLE_LABELS.get(role_match.group(1)) if role_match else None
        appearances = _int_or_none(_text(cells[pj_index]))
        goals = _int_or_none(_text(cells[goals_index]))
        if role == "Portero":
            # La columna G de un portero son goles encajados, no goles marcados.
            goals = None
        elif goals is not None and goals < 0:
            goals = None
        squad.append(
            m.TitleSquadMember(
                name=name,
                role=role,
                appearances=appearances if appearances is None or appearances >= 0 else None,
                goals=goals,
            )
        )
    return squad


def top_scorers_from_squad(
    squad: list[m.TitleSquadMember], limit: int = 5
) -> list[m.GoalScorer]:
    scorers = [
        m.GoalScorer(player=member.name, goals=member.goals or 0, note=member.role)
        for member in squad
        if (member.goals or 0) > 0
    ]
    scorers.sort(key=lambda scorer: (-scorer.goals, scorer.player))
    return scorers[:limit]


def _wiki_field(text: str, field: str) -> str | None:
    fields = _wiki_fields(text, field)
    return fields[0] if fields else None


def _wiki_fields(text: str, field: str) -> list[str]:
    pattern = '"' + re.escape(field) + '":\\{"wt":"(.*?)"\\}'
    return re.findall(pattern, text, re.S)


def _wiki_link_text(value: str | None) -> str | None:
    if not value:
        return None
    match = _WIKI_LINK.search(value)
    if not match:
        return None
    name = match.group(2) or match.group(1)
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return name or None


def _wiki_date(value: str | None) -> str | None:
    if not value:
        return None
    clean = re.sub(r"<[^>]+>", " ", value)
    candidates: list[str] = []
    for day, month, year in re.findall(
        r"(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+(\d{4})", clean
    ):
        month_number = _MONTHS.get(month.lower())
        if month_number:
            candidates.append(f"{year}-{month_number:02d}-{int(day):02d}")
    if candidates:
        return candidates[0] if "susp" in clean.lower() else candidates[-1]
    iso = re.search(r"\d{4}-\d{2}-\d{2}", value)
    return iso.group() if iso else None


def _wiki_goals(value: str | None, team: str) -> list[m.GoalScorer]:
    if not value:
        return []
    scorers: list[m.GoalScorer] = []
    for part in re.split(r"<br\s*/?>", value, flags=re.I):
        link = _WIKI_LINK.search(part)
        if not link:
            continue
        player = link.group(2) or re.sub(r"\s*\([^)]*\)\s*$", "", link.group(1))
        player = player.strip()
        if not player:
            continue
        minutes = [int(minute) for minute in _WIKI_GOAL.findall(part)]
        if minutes:
            for minute in minutes:
                scorers.append(
                    m.GoalScorer(player=player, goals=1, minute=minute, team=team)
                )
        else:
            scorers.append(m.GoalScorer(player=player, goals=1, team=team))
    return scorers


def parse_wikipedia_final(
    html: str, source_url: str = ""
) -> m.FinalMatch:
    """Lee la ficha de la final desde el wikitext incrustado en Wikipedia."""
    text = html_lib.unescape(html)
    home = _wiki_link_text(_wiki_field(text, "team1")) or ""
    away = _wiki_link_text(_wiki_field(text, "team2")) or ""
    score_raw = _wiki_field(text, "score") or ""
    date_raw = _wiki_field(text, "date") or ""
    suspended = "susp" in f"{score_raw} {date_raw}".lower()
    home_score = _wiki_field(text, "team1score")
    away_score = _wiki_field(text, "team2score")
    score_match = None
    if home_score and away_score and home_score.isdigit() and away_score.isdigit():
        score_match = (home_score, away_score)
    else:
        scores = re.findall(r"(\d+)\s*[-–—]\s*(\d+)", score_raw)
        if scores:
            score_match = scores[-1] if suspended else scores[0]
    note = None
    if suspended:
        note = "marcador en el momento de la suspensión; la final se reanudó después"
    goals1 = _wiki_fields(text, "goals1")
    goals2 = _wiki_fields(text, "goals2")
    goals1_raw = goals1[-1] if suspended and goals1 else (goals1[0] if goals1 else "")
    goals2_raw = goals2[-1] if suspended and goals2 else (goals2[0] if goals2 else "")
    return m.FinalMatch(
        date=_wiki_date(date_raw),
        round_="Final",
        home=home or None,
        away=away or None,
        home_goals=int(score_match[0]) if score_match else None,
        away_goals=int(score_match[1]) if score_match else None,
        venue=_wiki_link_text(_wiki_field(text, "stadium")),
        referee=_wiki_link_text(_wiki_field(text, "referee")),
        goal_scorers=_wiki_goals(goals1_raw, home) + _wiki_goals(goals2_raw, away),
        note=note,
        source_url=source_url or None,
    )


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower()


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", _fold(value))
        if token
    }


def _same_name(left: str, right: str) -> bool:
    left_tokens, right_tokens = _tokens(left), _tokens(right)
    if not left_tokens or not right_tokens:
        return False
    if left_tokens == right_tokens:
        return True
    if left_tokens <= right_tokens or right_tokens <= left_tokens:
        return True
    return sorted(left_tokens)[-1] == sorted(right_tokens)[-1]


def _same_team(left: str, right: str) -> bool:
    left_tokens = _tokens(left) - _TEAM_STOPWORDS
    right_tokens = _tokens(right) - _TEAM_STOPWORDS
    if not left_tokens or not right_tokens:
        return _fold(left) == _fold(right)
    return left_tokens == right_tokens or left_tokens <= right_tokens or right_tokens <= left_tokens


def _same_venue(left: str, right: str) -> bool:
    left_tokens = _tokens(left) - _VENUE_STOPWORDS
    right_tokens = _tokens(right) - _VENUE_STOPWORDS
    if not left_tokens or not right_tokens:
        return _fold(left) == _fold(right)
    return left_tokens == right_tokens or left_tokens <= right_tokens or right_tokens <= left_tokens


def _same_goals(left: list[m.GoalScorer], right: list[m.GoalScorer]) -> bool:
    if len(left) != len(right):
        return False
    remaining = list(right)
    for scorer in left:
        index = next(
            (
                i for i, candidate in enumerate(remaining)
                if scorer.goals == candidate.goals
                and _same_name(scorer.player, candidate.player)
                and _same_team(scorer.team or "", candidate.team or "")
            ),
            None,
        )
        if index is None:
            return False
        remaining.pop(index)
    return not remaining


def _scorer_minute_evidence(
    curated: m.FinalMatch | None,
    bdfutbol: m.FinalMatch | None,
    wikipedia: m.FinalMatch | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if curated is None:
        return [], []

    sources = [
        ("bdfutbol", bdfutbol),
        ("wikipedia", wikipedia),
    ]
    differences: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    for scorer in curated.goal_scorers:
        candidates: dict[str, int] = {}
        for source, final in sources:
            if final is None:
                continue
            match = next(
                (
                    other for other in final.goal_scorers
                    if scorer.goals == other.goals
                    and _same_name(scorer.player, other.player)
                    and _same_team(scorer.team or "", other.team or "")
                ),
                None,
            )
            if match is not None and match.minute is not None:
                candidates[source] = match.minute

        if scorer.minute is not None:
            if any(minute != scorer.minute for minute in candidates.values()):
                differences.append(
                    {
                        "field": "goal_scorer_minute",
                        "player": scorer.player,
                        "curated": scorer.minute,
                        **candidates,
                    }
                )
        elif len(set(candidates.values())) > 1:
            unresolved.append({"player": scorer.player, **candidates})

    return differences, unresolved


def _scorers_json(scorers: list[m.GoalScorer]) -> list[dict[str, Any]]:
    return [
        scorer.model_dump(by_alias=True, mode="json", exclude_none=True)
        for scorer in scorers
    ]


def _final_json(final: m.FinalMatch | None) -> dict[str, Any] | None:
    if final is None:
        return None
    data = final.model_dump(by_alias=True, mode="json", exclude_none=True)
    if data.get("goalScorers"):
        data["goalScorers"].sort(
            key=lambda scorer: (scorer.get("minute") or 0, scorer.get("player", ""))
        )
    return data


def _field_values(
    curated: m.FinalMatch | None,
    bdfutbol: m.FinalMatch | None,
    wikipedia: m.FinalMatch | None,
) -> dict[str, dict[str, Any]]:
    fields = ("date", "home", "away", "home_goals", "away_goals", "venue", "referee")
    values: dict[str, dict[str, Any]] = {}
    for field in fields:
        values[field] = {
            name: getattr(final, field)
            for name, final in (
                ("curated", curated),
                ("bdfutbol", bdfutbol),
                ("wikipedia", wikipedia),
            )
            if final is not None and getattr(final, field) not in (None, "")
        }
    return values


def _same_field(field: str, values: dict[str, Any]) -> bool:
    items = list(values.values())
    if len(items) < 2:
        return True
    first = items[0]
    for other in items[1:]:
        if field in {"home", "away"} and not _same_team(str(first), str(other)):
            return False
        if field == "venue" and not _same_venue(str(first), str(other)):
            return False
        if field == "referee" and not _same_name(str(first), str(other)):
            return False
        if field in {"date", "home_goals", "away_goals"} and first != other:
            return False
    return True


def _differences(
    curated: m.FinalMatch | None,
    bdfutbol: m.FinalMatch | None,
    wikipedia: m.FinalMatch | None,
) -> list[dict[str, Any]]:
    differences: list[dict[str, Any]] = []
    for field, values in _field_values(curated, bdfutbol, wikipedia).items():
        if not _same_field(field, values):
            differences.append({"field": field, **values})

    goal_sources = {
        name: final
        for name, final in (
            ("curated", curated),
            ("bdfutbol", bdfutbol),
            ("wikipedia", wikipedia),
        )
        if final is not None and final.goal_scorers
    }
    if len(goal_sources) >= 2:
        first_name = next(iter(goal_sources))
        first = goal_sources[first_name].goal_scorers
        if any(
            not _same_goals(first, final.goal_scorers)
            for name, final in goal_sources.items()
            if name != first_name
        ):
            differences.append(
                {
                    "field": "goal_scorers",
                    **{
                        name: _scorers_json(final.goal_scorers)
                        for name, final in goal_sources.items()
                    },
                }
            )
    minute_differences, _ = _scorer_minute_evidence(
        curated, bdfutbol, wikipedia
    )
    differences.extend(minute_differences)
    return differences


def _final_from_row(row: FinalRow) -> m.FinalMatch:
    return m.FinalMatch(
        date=row.date,
        round_=row.label,
        home=row.home,
        away=row.away,
        home_goals=row.home_goals,
        away_goals=row.away_goals,
        venue=row.venue,
        note=row.note,
        source_url=row.source_url,
    )


def _wikipedia_url(edition: m.TitleEdition) -> str | None:
    if edition.final_match and edition.final_match.source_url:
        if "wikipedia.org" in edition.final_match.source_url:
            return edition.final_match.source_url
    template = _COMPETITION_WIKI.get(edition.competition)
    return template.format(year=edition.year) if template else None


def enrich_title_edition(
    edition: m.TitleEdition,
    http: PoliteClient,
    team_url: str = _BDFUTBOL_TEAM,
    wikipedia: bool = True,
) -> dict[str, Any]:
    """Contrasta una edición con BDFutbol y, si existe, con la final de Wikipedia.

    Devuelve una propuesta, nunca modifica `TitleEdition` ni `titles.yml`.
    """
    team_id = _bdfutbol_team_id(team_url)
    detail: dict[str, Any] = {
        "competition": edition.competition,
        "year": edition.year,
        "season": edition.season,
        "curated": {"final_match": _final_json(edition.final_match)},
        "bdfutbol": {
            "season_url": None,
            "competition_url": None,
            "final_matches": [],
            "top_scorers": [],
            "squad": [],
            "errors": [],
        },
        "wikipedia": None,
        "differences": [],
        "unresolved": [],
        "status": "unavailable",
    }
    errors: list[str] = detail["bdfutbol"]["errors"]
    season_url = _season_url(team_url, edition.season or "", team_id)
    detail["bdfutbol"]["season_url"] = season_url
    try:
        season_html = http.get(season_url).text
    except SourceError as exc:
        errors.append(str(exc))
        return detail

    squad = parse_squad(season_html)
    detail["bdfutbol"]["squad"] = [
        member.model_dump(mode="json", exclude_none=True) for member in squad
    ]
    detail["bdfutbol"]["top_scorers"] = _scorers_json(top_scorers_from_squad(squad))

    competition_html = season_html
    code = _COMPETITION_CODES.get(edition.competition)
    if code:
        competition_url = _competition_url(
            season_html, season_url, edition.season or "", code
        )
        if competition_url:
            detail["bdfutbol"]["competition_url"] = competition_url
            try:
                competition_html = http.get(competition_url).text
            except SourceError as exc:
                errors.append(str(exc))
                competition_html = ""
        else:
            errors.append(f"no se encontró la página de {edition.competition}")

    final_matches: list[m.FinalMatch] = []
    for row in parse_final_rows(competition_html, detail["bdfutbol"]["competition_url"] or ""):
        if row.source_url:
            try:
                final_matches.append(parse_match_page(http.get(row.source_url).text, row.source_url))
                continue
            except SourceError as exc:
                errors.append(str(exc))
        final_matches.append(_final_from_row(row))
    detail["bdfutbol"]["final_matches"] = [
        _final_json(final) for final in final_matches if final is not None
    ]

    bdfutbol_final = final_matches[0] if len(final_matches) == 1 else None
    if len(final_matches) > 1:
        errors.append(
            "final a doble partido: se listan los partidos, no se compara como final única"
        )

    wikipedia_final: m.FinalMatch | None = None
    wiki_url = _wikipedia_url(edition) if wikipedia else None
    if wiki_url:
        detail["wikipedia"] = {"source_url": wiki_url, "final_match": None, "errors": []}
        try:
            wikipedia_final = parse_wikipedia_final(http.get(wiki_url).text, wiki_url)
            detail["wikipedia"]["final_match"] = _final_json(wikipedia_final)
        except SourceError as exc:
            detail["wikipedia"]["errors"].append(str(exc))

    detail["differences"] = _differences(
        edition.final_match, bdfutbol_final, wikipedia_final
    )
    _, detail["unresolved"] = _scorer_minute_evidence(
        edition.final_match, bdfutbol_final, wikipedia_final
    )
    sources = [final for final in (bdfutbol_final, wikipedia_final) if final is not None]
    if detail["differences"]:
        detail["status"] = "conflict"
    elif detail["unresolved"]:
        detail["status"] = "match_with_unresolved"
    elif len(sources) == 2:
        detail["status"] = "match"
    elif sources or final_matches or squad:
        detail["status"] = "single_source"
    return detail


def build_title_details(
    curated: m.Titles,
    http: PoliteClient,
    team_url: str = _BDFUTBOL_TEAM,
    max_editions: int = 0,
    wikipedia: bool = True,
) -> list[dict[str, Any]]:
    """Enriquece las ediciones con temporada conocida, sin tocar `titles.yml`."""
    selected = sorted(
        (edition for edition in curated.editions if edition.season),
        key=lambda edition: (edition.year, edition.competition),
    )
    if max_editions > 0:
        selected = selected[:max_editions]
    return [
        enrich_title_edition(edition, http, team_url, wikipedia=wikipedia)
        for edition in selected
    ]


def titles_proposal(
    curated: m.Titles,
    proposed: list[ProposedTitle],
    source_url: str = _BDFUTBOL_TEAM,
    generated_at: str | None = None,
    details: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Compara lo curado con BDFutbol sin aplicar nada automáticamente."""
    curated_by_comp: dict[str, set[int]] = {}
    for edition in curated.editions:
        curated_by_comp.setdefault(edition.competition, set()).add(edition.year)
    source_by_comp: dict[str, set[int]] = {}
    seasons_by_comp: dict[str, set[str]] = {}
    urls_by_comp: dict[str, dict[int, str]] = {}
    for item in proposed:
        source_by_comp.setdefault(item.competition, set()).add(item.year)
        seasons_by_comp.setdefault(item.competition, set()).add(item.season)
        if item.source_url:
            urls_by_comp.setdefault(item.competition, {})[item.year] = item.source_url

    conflicts: list[dict[str, Any]] = []
    only_in_source: list[dict[str, Any]] = []
    only_in_curated: list[dict[str, Any]] = []
    for competition in sorted(set(curated_by_comp) | set(source_by_comp)):
        curated_years = curated_by_comp.get(competition, set())
        source_years = source_by_comp.get(competition, set())
        if not curated_years:
            only_in_source.append(
                {
                    "competition": competition,
                    "years": sorted(source_years),
                    "seasons": sorted(seasons_by_comp.get(competition, set())),
                    "sources": [
                        {"year": year, "url": url}
                        for year, url in sorted(urls_by_comp.get(competition, {}).items())
                    ],
                }
            )
        elif not source_years:
            only_in_curated.append(
                {"competition": competition, "years": sorted(curated_years)}
            )
        elif curated_years != source_years:
            conflicts.append(
                {
                    "competition": competition,
                    "curated_years": sorted(curated_years),
                    "proposed_years": sorted(source_years),
                    "seasons": sorted(seasons_by_comp.get(competition, set())),
                }
            )
    return {
        "generated_at": generated_at or _now(),
        "source": source_url,
        "note": (
            "Propuesta automática de BDFutbol. No se aplica sola: revisar y editar "
            "data/manual/titles.yml a mano. BDFutbol no cubre competiciones regionales."
        ),
        "proposed": [
            {
                "competition": competition,
                "years": sorted(years),
                "seasons": sorted(seasons_by_comp.get(competition, set())),
                "sources": [
                    {"year": year, "url": url}
                    for year, url in sorted(urls_by_comp.get(competition, {}).items())
                ],
            }
            for competition, years in sorted(source_by_comp.items())
        ],
        "conflicts": conflicts,
        "only_in_source": only_in_source,
        "only_in_curated": only_in_curated,
        "details": details or [],
    }


def write_titles_proposal(
    path: Path,
    curated: m.Titles,
    proposed: list[ProposedTitle],
    source_url: str = _BDFUTBOL_TEAM,
    details: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    proposal = titles_proposal(curated, proposed, source_url, details=details)
    header = (
        "# Propuesta generada por `python -m depor_hub.cli club titles`.\n"
        "# No editar a mano. Los cambios se aplican únicamente en titles.yml tras revisión.\n\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        header + yaml.safe_dump(proposal, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    return proposal


# --- Rivalidades ------------------------------------------------------------


def load_rivalries(path: Path, now: str | None = None) -> m.Rivalries:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} debe contener un objeto YAML")
    raw.setdefault("updated_at", now or _now())
    return m.Rivalries.model_validate(raw)


def build_rivalries(
    config_path: Path,
    http: PoliteClient,
    now: str | None = None,
) -> m.Rivalries:
    """Carga las rivalidades curadas y rellena el balance desde BDFutbol."""
    rivalries = load_rivalries(config_path, now)
    enriched: list[m.RivalryDetail] = []
    for rivalry in rivalries.rivalries:
        if not rivalry.rival_bdfutbol_id:
            enriched.append(rivalry)
            continue
        try:
            head = fetch_head_to_head(http, rivalry.rival_bdfutbol_id)
        except SourceError as exc:
            print(f"AVISO: sin balance para {rivalry.rival}: {exc}")
            enriched.append(rivalry)
            continue
        enriched.append(rivalry.model_copy(update={"head_to_head": head}))
    return m.Rivalries(
        updated_at=now or rivalries.updated_at,
        rivalries=enriched,
    )


def publish_rivalries(
    config_path: Path,
    out_dir: Path,
    http: PoliteClient,
    now: str | None = None,
    force: bool = False,
    keep_previous_if_empty: bool = True,
) -> tuple[bool, m.Rivalries]:
    rivalries = build_rivalries(config_path, http, now)
    target = out_dir / "rivalries.json"
    if keep_previous_if_empty and not any(item.head_to_head for item in rivalries.rivalries):
        if target.exists():
            try:
                previous = m.Rivalries.model_validate_json(
                    target.read_text(encoding="utf-8")
                )
            except ValueError:
                previous = None
            if previous and any(item.head_to_head for item in previous.rivalries):
                print(
                    "AVISO: BDFutbol no devolvió ningún balance; se conserva "
                    "rivalries.json anterior.",
                    file=sys.stderr,
                )
                return False, previous
    return _publish(rivalries, target, force)


# --- Sondeo de medios -------------------------------------------------------

_CLUB_MEDIA_START = "<!-- club-media:start -->"
_CLUB_MEDIA_END = "<!-- club-media:end -->"
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"}
_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m3u8"}
_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".ogg", ".wav"}
_SVG_WIDTH = re.compile(r'<svg[^>]*\bwidth=["\']([\d.]+)')
_SVG_HEIGHT = re.compile(r'<svg[^>]*\bheight=["\']([\d.]+)')
_SVG_VIEWBOX = re.compile(r'<svg[^>]*\bviewBox=["\']([\d.\-\s]+)["\']')


def _kind_from_path(value: str) -> str:
    suffix = Path(value).suffix.lower()
    if suffix in _VIDEO_EXTENSIONS:
        return "video"
    if suffix in _AUDIO_EXTENSIONS:
        return "audio"
    if suffix in _IMAGE_EXTENSIONS:
        return "photo"
    return "document"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "media"


def _merge_candidate(
    candidates: list[dict[str, Any]], candidate: dict[str, Any]
) -> None:
    """Une la misma ruta/URL declarada por club.yml y club_images.yml."""
    for existing in candidates:
        same_path = (
            candidate.get("path")
            and existing.get("path") == candidate.get("path")
        )
        same_url = candidate.get("url") and existing.get("url") == candidate.get("url")
        if not (same_path or same_url):
            continue
        for key, value in candidate.items():
            if value not in (None, "", []) and existing.get(key) in (None, "", []):
                existing[key] = value
        return
    candidates.append(candidate)


def _media_candidate(
    entry: dict[str, Any], context: str, source_file: str
) -> dict[str, Any]:
    url = entry.get("url")
    path = entry.get("image") if not url else None
    return {
        "id": _slug(context),
        "kind": entry.get("kind") or _kind_from_path(str(url or path or "")),
        "origin": entry.get("origin") or "other",
        "url": url,
        "path": path,
        "source_file": source_file,
        "context": context,
        "license": entry.get("license"),
        "credit": entry.get("credit"),
        "source_url": entry.get("source_url") or entry.get("sourceUrl"),
    }


def _collect_media_tree(
    node: Any, context: str, source_file: str, candidates: list[dict[str, Any]]
) -> None:
    """Recorre un YAML y recoge `media`, `photos`, `image` y `audio_url`."""
    if isinstance(node, dict):
        for key, value in node.items():
            child = f"{context}.{key}" if context else key
            if key in {"media", "photos"} and isinstance(value, list):
                for index, entry in enumerate(value):
                    if isinstance(entry, dict) and entry.get("url"):
                        _merge_candidate(
                            candidates,
                            _media_candidate(
                                entry, f"{child}[{index}]", source_file
                            ),
                        )
                continue
            if key == "image" and isinstance(value, str) and value:
                if value.startswith(("http://", "https://")):
                    _merge_candidate(
                        candidates,
                        {
                            "id": _slug(child),
                            "kind": _kind_from_path(value),
                            "origin": "other",
                            "url": value,
                            "path": None,
                            "source_file": source_file,
                            "context": child,
                        },
                    )
                else:
                    _merge_candidate(
                        candidates,
                        {
                            "id": _slug(child),
                            "kind": _kind_from_path(value),
                            "origin": "club_official",
                            "url": None,
                            "path": value,
                            "source_file": source_file,
                            "context": child,
                        },
                    )
                continue
            if key == "audio_url" and isinstance(value, str) and value:
                _merge_candidate(
                    candidates,
                    {
                        "id": _slug(child),
                        "kind": "audio",
                        "origin": "other",
                        "url": value,
                        "path": None,
                        "source_file": source_file,
                        "context": child,
                    },
                )
                continue
            _collect_media_tree(value, child, source_file, candidates)
    elif isinstance(node, list):
        for index, entry in enumerate(node):
            _collect_media_tree(
                entry, f"{context}[{index}]", source_file, candidates
            )


def _load_yaml(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return raw if isinstance(raw, dict) else {}


def collect_media_candidates(
    club_path: Path,
    titles_path: Path | None = None,
    rivalries_path: Path | None = None,
    club_images_path: Path | None = None,
    manual_media_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Descubre todos los medios del club, títulos, rivalidades y fuentes locales.

    No lee binarios ni escribe nada: solo devuelve candidatos con su contexto y
    su procedencia editorial. Las rutas locales se resuelven después contra
    `data/public/v1`.
    """
    candidates: list[dict[str, Any]] = []
    for path in (club_path, titles_path, rivalries_path):
        if path is None:
            continue
        raw = _load_yaml(path)
        if raw is None:
            continue
        _collect_media_tree(raw, "", path.name, candidates)

    images = _load_yaml(club_images_path) if club_images_path else None
    if images:
        sources = images.get("sources")
        if isinstance(sources, dict):
            for local_path, item in sources.items():
                if not isinstance(item, dict):
                    continue
                _merge_candidate(
                    candidates,
                    {
                        "id": _slug(str(local_path)),
                        "kind": _kind_from_path(str(local_path)),
                        "origin": "club_official",
                        "url": item.get("url"),
                        "path": str(local_path),
                        "source_file": club_images_path.name
                        if club_images_path
                        else "club_images.yml",
                        "context": f"sources.{local_path}",
                        "source_url": item.get("source"),
                    },
                )

    if manual_media_path:
        manual = _load_yaml(manual_media_path)
        if manual:
            items = manual.get("media")
            if items is not None and not isinstance(items, list):
                raise ValueError(f"{manual_media_path}: media debe ser una lista")
            for index, item in enumerate(items or []):
                if not isinstance(item, dict) or not item.get("url"):
                    raise ValueError(
                        f"{manual_media_path}: el medio #{index + 1} necesita url"
                    )
                _merge_candidate(
                    candidates,
                    _media_candidate(
                        item, f"media[{index}]", manual_media_path.name
                    ),
                )
    return candidates


def load_media_candidates(path: Path) -> list[dict[str, Any]]:
    """Compatibilidad: lee el antiguo `club_media.yml` de candidatos sueltos."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    items = raw.get("media") if isinstance(raw, dict) else None
    if items is None:
        return []
    if not isinstance(items, list):
        raise ValueError(f"{path}: media debe ser una lista")
    clean: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict) or not item.get("url"):
            raise ValueError(f"{path}: el medio #{index + 1} necesita url")
        clean.append(dict(item))
    return clean


def _image_size(content: bytes) -> tuple[int | None, int | None, str | None]:
    try:
        from PIL import Image

        with Image.open(io.BytesIO(content)) as image:
            return image.width, image.height, image.format
    except Exception:  # noqa: BLE001 - un vídeo o un SVG no son una imagen PIL
        return None, None, None


def _svg_size(content: bytes) -> tuple[int | None, int | None, str | None]:
    head = content[:4096].decode("utf-8", errors="ignore")
    width_match = _SVG_WIDTH.search(head)
    height_match = _SVG_HEIGHT.search(head)
    if width_match and height_match:
        return (
            int(float(width_match.group(1))),
            int(float(height_match.group(1))),
            "SVG",
        )
    viewbox = _SVG_VIEWBOX.search(head)
    if viewbox:
        parts = viewbox.group(1).replace(",", " ").split()
        if len(parts) == 4:
            return (
                int(float(parts[2])),
                int(float(parts[3])),
                "SVG",
            )
    return None, None, "SVG"


def _local_media(
    record: dict[str, Any], public_root: Path | None, local_path: str
) -> None:
    record["path"] = local_path
    if public_root is None:
        record["status"] = "missing"
        record["error"] = "no se indicó la raíz pública para resolver la ruta local"
        return
    target = public_root / local_path
    if not target.exists():
        record["status"] = "missing"
        record["error"] = "no existe el fichero local"
        return
    record["local_exists"] = True
    record["local_size_bytes"] = target.stat().st_size
    suffix = target.suffix.lower()
    if suffix == ".svg":
        width, height, image_format = _svg_size(target.read_bytes())
    else:
        width, height, image_format = _image_size(target.read_bytes())
    record["local_width"] = width
    record["local_height"] = height
    record["local_format"] = image_format
    if not record.get("url"):
        record["status"] = "local"
        record["mime"] = target.suffix.lower()
        record["size_bytes"] = record["local_size_bytes"]
        record["width"] = width
        record["height"] = height
        record["format"] = image_format


def _probe_get(record: dict[str, Any], url: str, http: PoliteClient) -> None:
    try:
        fetched = http.get_binary(url)
    except SourceBlocked as exc:
        record["status"] = "blocked"
        record["error"] = str(exc)
        return
    except SourceError as exc:
        record["status"] = "broken"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return
    record["final_url"] = fetched.final_url
    record["mime"] = fetched.content_type.split(";")[0].strip() or None
    record["size_bytes"] = len(fetched.content)
    if record.get("kind") == "photo" or (record.get("mime") or "").startswith("image/"):
        width, height, image_format = _image_size(fetched.content)
        is_svg = (
            (record.get("mime") or "").endswith("svg+xml")
            or str(url).lower().split("?", 1)[0].endswith(".svg")
            or str(record.get("path") or "").lower().endswith(".svg")
        )
        if width is None and is_svg:
            width, height, image_format = _svg_size(fetched.content)
        record["width"] = width
        record["height"] = height
        record["format"] = image_format
        if width is None and not (record.get("mime") or "").startswith("image/"):
            record["status"] = "broken"
            record["error"] = (
                f"MIME {record.get('mime') or 'desconocido'} no es una imagen legible"
            )
            return
    record["status"] = "ok"


def _probe_external(record: dict[str, Any], url: str, http: PoliteClient) -> None:
    """HEAD para estado/MIME/tamaño y GET mínimo para imágenes."""
    try:
        head = http.head(url)
    except SourceBlocked as exc:
        record["status"] = "blocked"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return
    except SourceError as exc:
        if getattr(exc, "status", None) == 405:
            _probe_get(record, url, http)
            return
        record["status"] = "broken"
        record["http_status"] = getattr(exc, "status", None)
        record["error"] = str(exc)
        return

    record["http_status"] = head.status
    record["final_url"] = head.final_url
    record["mime"] = head.content_type.split(";")[0].strip() or None
    record["size_bytes"] = head.content_length
    if record.get("kind") == "photo" or (record.get("mime") or "").startswith("image/"):
        _probe_get(record, url, http)
        return
    record["status"] = "ok"


def _probe_candidates(
    candidates: list[dict[str, Any]],
    http: PoliteClient,
    checked_at: str | None,
    public_root: Path | None,
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for candidate in candidates:
        record = {
            key: value
            for key, value in candidate.items()
            if value not in (None, "", [])
        }
        record.setdefault("kind", "photo")
        record.setdefault("origin", "other")
        record["checked_at"] = checked_at or _now()
        if record.get("path"):
            _local_media(record, public_root, str(record["path"]))
        if record.get("url"):
            _probe_external(record, str(record["url"]), http)
        elif not record.get("path"):
            record["status"] = "missing"
            record["error"] = "ni URL ni ruta local"
        items.append(record)

    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    return {
        "checked_at": checked_at or _now(),
        "note": (
            "Sondeo de URLs externas y rutas locales. No se copian binarios al "
            "repositorio ni se sustituyen URLs rotas: quedan en null y se "
            "registran en docs/sources.md para revisión humana."
        ),
        "counts": counts,
        "items": items,
    }


def probe_media(
    sources_path: Path,
    http: PoliteClient,
    checked_at: str | None = None,
    public_root: Path | None = None,
) -> dict[str, Any]:
    """Comprueba las URLs de `club_media.yml` (compatibilidad con H1)."""
    candidates = load_media_candidates(sources_path)
    result = _probe_candidates(candidates, http, checked_at, public_root)
    result["source"] = str(sources_path)
    return result


def probe_club_media(
    club_path: Path,
    http: PoliteClient,
    titles_path: Path | None = None,
    rivalries_path: Path | None = None,
    club_images_path: Path | None = None,
    manual_media_path: Path | None = None,
    public_root: Path | None = None,
    checked_at: str | None = None,
) -> dict[str, Any]:
    """Sondea todos los medios del club sin tocar los YAML ni los JSON."""
    candidates = collect_media_candidates(
        club_path,
        titles_path=titles_path,
        rivalries_path=rivalries_path,
        club_images_path=club_images_path,
        manual_media_path=manual_media_path,
    )
    result = _probe_candidates(candidates, http, checked_at, public_root)
    result["source"] = str(club_path)
    result["sources"] = [
        str(path)
        for path in (
            club_path,
            titles_path,
            rivalries_path,
            club_images_path,
            manual_media_path,
        )
        if path is not None
    ]
    return result


def _md_cell(value: Any) -> str:
    return str(value if value is not None else "—").replace("|", "\\|")


def media_report_markdown(result: dict[str, Any]) -> str:
    counts = result.get("counts", {})
    checked_at = result.get("checked_at", "")
    lines = [
        _CLUB_MEDIA_START,
        f"### Sondeo de medios del club — {checked_at}",
        "",
        "Generado por `python -m depor_hub.cli club probe-media`. No sustituye "
        "ninguna URL: las rotas quedan en `null` y se listan aquí.",
        "",
        (
            f"OK: **{counts.get('ok', 0)}** · locales: **{counts.get('local', 0)}** · "
            f"rotas: **{counts.get('broken', 0)}** · bloqueadas: "
            f"**{counts.get('blocked', 0)}** · ausentes: **{counts.get('missing', 0)}**"
        ),
        "",
    ]
    problems = [
        item
        for item in result.get("items", [])
        if item.get("status") in {"broken", "blocked", "missing"}
    ]
    if problems:
        lines.extend(
            [
                "| Estado | Contexto | URL o ruta | HTTP / MIME | Motivo |",
                "|---|---|---|---|---|",
            ]
        )
        for item in problems:
            location = item.get("url") or item.get("path") or "—"
            http_mime = " / ".join(
                part
                for part in (str(item.get("http_status") or ""), item.get("mime") or "")
                if part
            )
            lines.append(
                "| "
                + " | ".join(
                    _md_cell(value)
                    for value in (
                        item.get("status"),
                        item.get("context"),
                        location,
                        http_mime or "—",
                        item.get("error") or "—",
                    )
                )
                + " |"
            )
    else:
        lines.append(
            "Sin URLs rotas, bloqueadas ni ficheros locales ausentes en el último sondeo."
        )
    lines.append(_CLUB_MEDIA_END)
    return "\n".join(lines)


def _without_checked_at(section: str) -> str:
    return re.sub(
        r"^### Sondeo de medios del club — .*$",
        "### Sondeo de medios del club",
        section,
        count=1,
        flags=re.M,
    )


def write_media_report(path: Path, result: dict[str, Any]) -> None:
    """Inserta o reemplaza la sección del sondeo en docs/sources.md.

    Si solo cambia la hora de comprobación, conserva la sección anterior para
    que una segunda pasada no ensucie el repositorio.
    """
    section = media_report_markdown(result)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if _CLUB_MEDIA_START in existing and _CLUB_MEDIA_END in existing:
        before, _, rest = existing.partition(_CLUB_MEDIA_START)
        previous = _CLUB_MEDIA_START + rest.partition(_CLUB_MEDIA_END)[0] + _CLUB_MEDIA_END
        if _without_checked_at(previous) == _without_checked_at(section):
            return
        _, _, after = rest.partition(_CLUB_MEDIA_END)
        body = before.rstrip() + "\n\n" + section + after
    else:
        body = existing.rstrip() + "\n\n" + section + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.rstrip() + "\n", encoding="utf-8")


def write_media_proposal(path: Path, result: dict[str, Any]) -> None:
    header = (
        "# Propuesta generada por `python -m depor_hub.cli club probe-media`.\n"
        "# No editar a mano. Una entrada solo pasa a club.yml con licencia y crédito revisados.\n\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        header + yaml.safe_dump(result, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
