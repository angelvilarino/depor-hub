"""BDFutbol: trayectoria, estadísticas por temporada y partidos con el Depor.

Fuente principal para carrera y partidos. El HTML se interpreta sin navegador ni JS.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import quote

from .htmlutil import Cell, Table, normalize_space, parse_tables, strip_tags
from .http import PoliteClient, SourceError

BASE = "https://www.bdfutbol.com"
DEPOR_BDF_ID = 13
DEPOR_NAMES = ("deportivo de a coruña", "deportivo", "rc deportivo")

_SEASON = re.compile(r"^\d{4}-\d{2}$")
_DOB = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
_P = re.compile(r"\bP=(\[\[.*?\]\])\s*;", re.S)

_COMPETITIONS = {
    "1a": "LaLiga",
    "2a": "LaLiga Hypermotion",
    "2b": "Segunda Federación",
    "3a": "Tercera Federación",
    "Cop": "Copa del Rey",
    "UEF": "Competición europea",
    "UCL": "Champions League",
    "UEL": "Europa League",
    "UIC": "Copa Intertoto",
    "Amf": "Amistoso",
    "Sel": "Selección",
}


@dataclass(frozen=True)
class Candidate:
    bdf_id: str
    name: str
    date_of_birth: str
    clubs: tuple[str, ...]
    url: str


@dataclass
class SeasonRow:
    season: str
    club: str
    appearances: int | None
    goals: int | None
    minutes: int | None
    yellow_cards: int | None
    red_cards: int | None
    shirt_number: int | None = None


@dataclass
class CareerEntryData:
    club: str
    from_: str | None
    to: str | None
    appearances: int | None
    goals: int | None
    minutes: int | None
    yellow_cards: int | None
    red_cards: int | None
    seasons: list[SeasonRow] = field(default_factory=list)


@dataclass
class Profile:
    bdf_id: str
    url: str
    name: str
    date_of_birth: str | None
    birth_place: str | None
    height_cm: int | None
    weight_kg: int | None
    seasons: list[SeasonRow]
    career: list[CareerEntryData]
    totals: dict[str, int | None]


@dataclass
class MatchData:
    date: str
    opponent: str
    competition: str
    home: bool
    team_goals: int | None
    opponent_goals: int | None
    result: str | None
    started: bool | None
    minutes: int | None
    goals: int | None
    assists: int | None
    yellow_cards: int | None
    red_cards: int | None


def _int(text: str | None) -> int | None:
    if text is None:
        return None
    digits = re.sub(r"\D", "", text)
    return int(digits) if digits else None


def _first_int(text: str | None) -> int | None:
    """Primer número de un texto tipo "90+13"; evita convertir los minutos en 9013."""
    if text is None:
        return None
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def _cell(row: list[Cell], class_name: str) -> Cell | None:
    return next((c for c in row if c.has_class(class_name)), None)


def _text(row: list[Cell], class_name: str) -> str | None:
    cell = _cell(row, class_name)
    return cell.text if cell and cell.text else None


def _dob(day: str, month: str, year: str) -> str:
    return f"{year}-{month}-{day}"


def parse_search(document: str) -> list[Candidate]:
    """Candidatos de `buscar.php?d=...&bj=on`; el llamador desambigua por fecha exacta."""
    out: list[Candidate] = []
    for match in re.finditer(r"<tr class=['\"]tipus1['\"]>(.*?)</tr>", document, re.S):
        row = match.group(1)
        link = re.search(r"href=['\"]j/(j\d+)\.html['\"]", row)
        dob = _DOB.search(row)
        if not link or not dob:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 3:
            continue
        name = re.sub(r"\s*\([^)]*\)\s*$", "", strip_tags(cells[1]))
        # La última celda son los clubes; las anteriores, demarcación y fecha.
        clubs_text = strip_tags(cells[-1])
        clubs = tuple(c.strip() for c in clubs_text.split(",") if c.strip())
        out.append(
            Candidate(
                bdf_id=link.group(1),
                name=name,
                date_of_birth=_dob(*dob.groups()),
                clubs=clubs,
                url=f"{BASE}/es/j/{link.group(1)}.html",
            )
        )
    return out


def choose_candidate(candidates: list[Candidate], name: str, date_of_birth: str | None) -> Candidate | None:
    if not candidates:
        return None
    if date_of_birth:
        # La fecha de nacimiento es obligatoria: un homónimo con otra fecha NUNCA vale.
        exact = [c for c in candidates if c.date_of_birth == date_of_birth]
        if len(exact) == 1:
            return exact[0]
        if len(exact) > 1:
            depor = [c for c in exact if any("deportivo" in club.lower() for club in c.clubs)]
            return depor[0] if len(depor) == 1 else None
        return None
    # Sin fecha en la plantilla: solo aceptamos coincidencia de nombre completa inequívoca.
    normalized = normalize_space(name).lower()
    names = [c for c in candidates if normalize_space(c.name).lower() == normalized]
    return names[0] if len(names) == 1 else None


def _profile_value(document: str, label: str) -> str | None:
    index = document.find(f">{label}<")
    if index < 0:
        return None
    chunk = document[index : index + 1200]
    match = re.search(r"font-weight-bold[^>]*>(.*?)</div>", chunk, re.S)
    if not match:
        return None
    value = strip_tags(match.group(1))
    return value or None


def _profile_country(document: str) -> str | None:
    index = document.find(">País de nacimiento<")
    if index < 0:
        return None
    chunk = document[index : index + 1200]
    match = re.search(r"<a[^>]*>(.*?)</a>", chunk, re.S)
    return strip_tags(match.group(1)) if match else None


def _clean_place(text: str) -> str:
    """`strip_tags` deja espacios dentro de los paréntesis: "Arnedo ( La Rioja )"."""
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\s+,", ",", text)
    return normalize_space(text)


def _season_table(tables: list[Table]) -> Table | None:
    for table in tables:
        if not table.rows:
            continue
        header = {c.text for c in table.rows[0]}
        if "Temp" in header and "PJ" in header:
            return table
    return None


def _row_stat(row: list[Cell], class_name: str) -> int | None:
    return _int(_text(row, class_name))


def parse_profile(document: str, bdf_id: str, url: str) -> Profile:
    title = re.search(r"<title>(.*?)</title>", document, re.S)
    full_name = _profile_value(document, "Nombre completo")
    name = full_name or (strip_tags(title.group(1)).split(" - ")[0] if title else bdf_id)
    dob_index = document.find(">Fecha de nacimiento<")
    dob_match = _DOB.search(document[dob_index : dob_index + 1200]) if dob_index >= 0 else None
    dob = _dob(*dob_match.groups()) if dob_match else None

    city = _profile_value(document, "Lugar de nacimiento")
    country = _profile_country(document)
    birth_place = None
    if city:
        cleaned = _clean_place(city)
        birth_place = cleaned if not country or country.lower() in cleaned.lower() else f"{cleaned}, {country}"

    height = _int(_profile_value(document, "Altura"))
    weight = _int(_profile_value(document, "Peso"))

    table = _season_table(parse_tables(document))
    rows: list[SeasonRow] = []
    if table is not None:
        for row in table.rows[1:]:
            season = _text(row, "colTemporada")
            if not season or not _SEASON.fullmatch(season):
                continue
            club = _text(row, "colEquip")
            if not club:
                continue
            rows.append(
                SeasonRow(
                    season=season,
                    club=club,
                    appearances=_row_stat(row, "colPJ"),
                    goals=_row_stat(row, "colGols"),
                    minutes=_row_stat(row, "colMin"),
                    yellow_cards=_row_stat(row, "colTG"),
                    red_cards=_row_stat(row, "colTV"),
                    shirt_number=_row_stat(row, "colDorsal"),
                )
            )

    totals: dict[str, int | None] = {}
    if table is not None:
        for row in table.rows:
            if not any(c.text == "Total" for c in row):
                continue
            totals = {
                "appearances": _row_stat(row, "colPJ"),
                "goals": _row_stat(row, "colGols"),
                "minutes": _row_stat(row, "colMin"),
                "yellow_cards": _row_stat(row, "colTG"),
                "red_cards": _row_stat(row, "colTV"),
                "assists": None,
            }
            break

    return Profile(
        bdf_id=bdf_id,
        url=url,
        name=name,
        date_of_birth=dob,
        birth_place=birth_place,
        height_cm=height,
        weight_kg=weight,
        seasons=rows,
        career=_career(rows),
        totals=totals,
    )


def _sum(rows: list[SeasonRow], attr: str) -> int | None:
    values = [getattr(r, attr) for r in rows if getattr(r, attr) is not None]
    return sum(values) if values else None


def _career(rows: list[SeasonRow]) -> list[CareerEntryData]:
    entries: list[CareerEntryData] = []
    for row in rows:
        current = entries[-1] if entries else None
        if current is not None and current.club == row.club:
            current.seasons.append(row)
            continue
        entries.append(CareerEntryData(
            club=row.club,
            from_=row.season[:4],
            to=None,
            appearances=None,
            goals=None,
            minutes=None,
            yellow_cards=None,
            red_cards=None,
            seasons=[row],
        ))

    for entry in entries:
        entry.appearances = _sum(entry.seasons, "appearances")
        entry.goals = _sum(entry.seasons, "goals")
        entry.minutes = _sum(entry.seasons, "minutes")
        entry.yellow_cards = _sum(entry.seasons, "yellow_cards")
        entry.red_cards = _sum(entry.seasons, "red_cards")
        last = entry.seasons[-1].season
        current = last == max((r.season for r in rows), default="") and entry is entries[-1]
        entry.to = None if current and entry.club.lower().startswith("deportivo") else str(int(last[:4]) + 1)
    # Orden cronológico ascendente, con las fechas parciales comparadas como tuplas.
    entries.sort(key=lambda e: (e.from_ or "", e.to or "9999"))
    return entries


def parse_matches(document: str) -> list[MatchData]:
    match = _P.search(document)
    if not match:
        return []
    try:
        raw = json.loads(match.group(1).replace("\\/", "/"))
    except json.JSONDecodeError as exc:
        raise SourceError("no se pudo interpretar la tabla de partidos de BDFutbol") from exc

    out: list[MatchData] = []
    for p in raw:
        if len(p) < 27:
            continue
        # p[4] indica de qué lado juega el jugador: 1 = primer equipo (local), 0 = segundo.
        player_team = p[19] if p[4] else p[20]
        if player_team != DEPOR_BDF_ID:
            continue
        minutes = _first_int(str(p[12]))
        if not minutes:
            continue
        home = bool(p[4])
        team_goals = _int(str(p[6] if home else p[7]))
        opponent_goals = _int(str(p[7] if home else p[6]))
        result = None
        if team_goals is not None and opponent_goals is not None:
            result = "W" if team_goals > opponent_goals else "D" if team_goals == opponent_goals else "L"
        # p[17] guarda los goles como "GO12-GO90+1"; "PN" es penalti y "PP" en propia puerta.
        events = str(p[17] or "")
        goals = sum(1 for event in events.split("-") if event and not event.startswith("PP"))
        out.append(
            MatchData(
                date=_iso_date(str(p[3])),
                opponent=str(p[18] if home else p[5]),
                competition=_COMPETITIONS.get(str(p[1]), str(p[1])),
                home=home,
                team_goals=team_goals,
                opponent_goals=opponent_goals,
                result=result,
                started=bool(p[9]),
                minutes=minutes,
                goals=goals,
                assists=None,
                # p[14] y p[15] son minutos de amarilla (dos como máximo); p[16], la roja.
                yellow_cards=int(bool(p[14])) + int(bool(p[15])),
                red_cards=1 if p[16] else 0,
            )
        )
    out.sort(key=lambda m: m.date, reverse=True)
    return out


def _iso_date(value: str) -> str:
    day, month, year = value.split("/")
    return f"{year}-{month}-{day}"


class BDFutbolClient:
    def __init__(self, http: PoliteClient) -> None:
        self.http = http

    def search(self, name: str) -> list[Candidate]:
        document = self.http.get(f"{BASE}/es/buscar.php?d={quote(name)}&bj=on").text
        return parse_search(document)

    def resolve(
        self, name: str, date_of_birth: str | None, aliases: tuple[str, ...] = ()
    ) -> Candidate | None:
        terms = [name, *aliases]
        seen: set[str] = set()
        for term in terms:
            term = term.strip()
            if not term or term in seen:
                continue
            seen.add(term)
            candidate = choose_candidate(self.search(term), name, date_of_birth)
            if candidate is not None:
                return candidate
        return None

    def resolve_near(
        self, name: str, date_of_birth: str | None, max_days: int = 45
    ) -> Candidate | None:
        """Candidato con la fecha muy parecida y el Depor en su historial.

        Solo se usa cuando la fecha exacta no aparece (erratas de un mes en la fuente).
        El llamador DEBE dejar constancia de la diferencia; nunca es un emparejamiento silencioso.
        """
        if not date_of_birth:
            return None
        from datetime import date as _date

        target = _date.fromisoformat(date_of_birth)
        terms = [name, *name.split()]
        seen_ids: set[str] = set()
        matches: list[Candidate] = []
        for term in terms:
            for candidate in self.search(term):
                if candidate.bdf_id in seen_ids:
                    continue
                seen_ids.add(candidate.bdf_id)
                if not any("deportivo" in club.lower() for club in candidate.clubs):
                    continue
                try:
                    delta = abs((_date.fromisoformat(candidate.date_of_birth) - target).days)
                except ValueError:
                    continue
                if delta <= max_days:
                    matches.append(candidate)
        return matches[0] if len(matches) == 1 else None

    def profile(self, candidate: Candidate) -> Profile:
        document = self.http.get(candidate.url).text
        return parse_profile(document, candidate.bdf_id, candidate.url)

    def matches(self, candidate: Candidate) -> list[MatchData]:
        document = self.http.get(f"{BASE}/es/p/{candidate.bdf_id}.html").text
        return parse_matches(document)


def _fetched_at() -> str:
    return date.today().isoformat()


__all__ = [
    "BASE",
    "BDFutbolClient",
    "Candidate",
    "CareerEntryData",
    "MatchData",
    "Profile",
    "SeasonRow",
    "choose_candidate",
    "parse_matches",
    "parse_profile",
    "parse_search",
]
