"""BDFutbol: trayectoria, estadísticas por temporada y partidos con el Depor.

Fuente principal para carrera y partidos. El HTML se interpreta sin navegador ni JS.
"""

from __future__ import annotations

import json
import re
import unicodedata
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
    crest_url: str | None = None


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
    opponent_crest_url: str | None = None


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

    def schedule(self, season: str) -> list[ScheduleMatch]:
        document = self.http.get(f"{BASE}/es/t/t{season}.html").text
        return parse_schedule(document)

    def match_detail(self, bdf_id: str) -> MatchDetailData:
        url = f"{BASE}/es/p/p.php?id={bdf_id}"
        document = self.http.get(url).text
        return parse_match_detail(document, bdf_id, url)


# --- Calendario y detalle de partido (ADR 0031) ------------------------------
#
# La ficha de partido de BDFutbol publica alineaciones, goles, tarjetas y cambios
# en HTML. Se interpretan esos hechos y no se deduce nada que no esté escrito:
# una sustitución solo se empareja cuando hay exactamente un jugador que sale y
# otro que entra en el mismo minuto. Las fotos, escudos y textos no se publican.


@dataclass(frozen=True)
class ScheduleMatch:
    bdf_id: str | None
    date: str
    matchday: int | None
    home: str
    away: str


@dataclass(frozen=True)
class LineupPlayer:
    name: str
    shirt_number: int | None
    bdfutbol_id: str | None


@dataclass
class LineupData:
    coach: str | None = None
    starters: list[LineupPlayer] = field(default_factory=list)
    substitutes: list[LineupPlayer] = field(default_factory=list)


@dataclass(frozen=True)
class GoalEvent:
    minute: int
    minute_label: str
    team: str
    player: str
    own_goal: bool = False
    penalty: bool = False
    score_home: int | None = None
    score_away: int | None = None


@dataclass(frozen=True)
class CardEvent:
    minute: int
    minute_label: str
    team: str
    player: str
    kind: str


@dataclass(frozen=True)
class SubstitutionEvent:
    minute: int
    minute_label: str
    team: str
    player_out: str | None = None
    player_in: str | None = None


@dataclass
class MatchDetailData:
    bdfutbol_id: str
    url: str
    competition: str | None
    matchday: int | None
    date: str | None
    venue: str | None
    referee: str | None
    home_name: str
    away_name: str
    home_bdf_id: str | None
    away_bdf_id: str | None
    score_home: int | None
    score_away: int | None
    home_lineup: LineupData
    away_lineup: LineupData
    goals: list[GoalEvent]
    cards: list[CardEvent]
    substitutions: list[SubstitutionEvent]


_TEAM_STOPWORDS = {
    "a",
    "balompie",
    "ca",
    "cd",
    "cf",
    "club",
    "de",
    "del",
    "deportivo",
    "el",
    "fc",
    "futbol",
    "la",
    "las",
    "los",
    "rc",
    "rcd",
    "sd",
    "sad",
    "ud",
}


def team_key(name: str) -> frozenset[str]:
    """Clave de equipo tolerante a acentos y sufijos societarios."""
    decomposed = unicodedata.normalize("NFKD", name)
    plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    words = re.sub(r"[^a-z0-9 ]", " ", plain.lower()).split()
    return frozenset(word for word in words if word and word not in _TEAM_STOPWORDS)


def same_team(left: str, right: str) -> bool:
    """Dos nombres designan el mismo equipo si uno contiene al otro.

    «RC Deportivo La Coruña» y «Deportivo de A Coruña» comparten la clave
    suficiente; «Real Madrid» y «Atlético de Madrid» no, porque solo coinciden
    en una palabra genérica.
    """
    a, b = team_key(left), team_key(right)
    if not a or not b:
        return False
    return a <= b or b <= a or len(a & b) >= 2


def parse_schedule(document: str) -> list[ScheduleMatch]:
    """Partidos del calendario de una temporada, con su id de BDFutbol si existe."""
    out: list[ScheduleMatch] = []
    for row_match in re.finditer(r"<tr([^>]*)>(.*?)</tr>", document, re.S):
        attrs, body = row_match.groups()
        if "jornadai" not in attrs:
            continue
        matchday_match = re.search(r"data-jornada=['\"](\d+)['\"]", attrs)
        cells = re.findall(r"<td[^>]*>(.*?)</td>", body, re.S)
        if len(cells) < 4:
            continue
        raw_date = strip_tags(cells[0])
        date_match = re.match(r"(\d{2})/(\d{2})/(\d{4})", raw_date)
        if not date_match:
            continue
        day, month, year = date_match.groups()
        link = re.search(r"p\.php\?id=(\d+)", body)
        out.append(
            ScheduleMatch(
                bdf_id=link.group(1) if link else None,
                date=f"{year}-{month}-{day}",
                matchday=int(matchday_match.group(1)) if matchday_match else None,
                home=strip_tags(cells[1]),
                away=strip_tags(cells[3]),
            )
        )
    return out


def find_schedule_match(
    schedule: list[ScheduleMatch],
    home: str,
    away: str,
    iso_date: str,
    max_days: int = 3,
) -> ScheduleMatch | None:
    """Empareja un partido de football-data con el calendario de BDFutbol.

    Se exigen los dos equipos y una fecha a menos de `max_days` días. Si hay
    empate entre dos candidatos, no se elige ninguno: es preferible no publicar
    detalle a publicar el partido equivocado.
    """
    try:
        target = date.fromisoformat(iso_date)
    except ValueError:
        return None
    candidates: list[tuple[int, ScheduleMatch]] = []
    for row in schedule:
        if not row.bdf_id or not same_team(home, row.home) or not same_team(away, row.away):
            continue
        try:
            delta = abs((date.fromisoformat(row.date) - target).days)
        except ValueError:
            continue
        if delta <= max_days:
            candidates.append((delta, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    if len(candidates) > 1 and candidates[0][0] == candidates[1][0]:
        return None
    return candidates[0][1]


def _header_value(document: str, label: str) -> str | None:
    index = document.find(f">{label}<")
    if index < 0:
        return None
    chunk = document[index : index + 900]
    match = re.search(
        r"font-weight-bold[^>]*>\s*(?:<a[^>]*>)?(.*?)(?:</a>)?\s*</div>", chunk, re.S
    )
    if not match:
        return None
    value = normalize_space(strip_tags(match.group(1)))
    return value or None


def _player_rows(table_html: str) -> list[tuple[LineupPlayer, tuple[tuple[str, str], ...]]]:
    """Filas de una alineación con sus eventos (clase, minuto) tal como aparecen."""
    rows: list[tuple[LineupPlayer, tuple[tuple[str, str], ...]]] = []
    for row_match in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_html, re.S):
        row = row_match.group(1)
        link = re.search(
            r"<a href=['\"]\.\./j/j(\d+)\.html['\"]>(.*?)</a>", row, re.S
        )
        if not link:
            continue
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        number = _first_int(strip_tags(cells[0])) if cells else None
        events: list[tuple[str, str]] = []
        for event_match in re.finditer(
            r'<div class="([A-Za-z0-9]+)" title="[^"]*"\s*></div>\s*([0-9]+(?:\+[0-9]+)?)?',
            row,
        ):
            kind, minute = event_match.groups()
            if kind in {"Surt", "Entra", "G", "GP", "GPP", "TG", "TG2", "TV"} and minute:
                events.append((kind, minute))
        rows.append(
            (
                LineupPlayer(
                    name=normalize_space(strip_tags(link.group(2))),
                    shirt_number=number,
                    bdfutbol_id=link.group(1),
                ),
                tuple(events),
            )
        )
    return rows


def _parse_lineup(table_html: str) -> tuple[LineupData, list[tuple[LineupPlayer, tuple[tuple[str, str], ...]]]]:
    rows = _player_rows(table_html)
    coach_match = re.search(
        r"<a href=['\"]\.\./l/l\d+\.html['\"]>(.*?)</a>", table_html, re.S
    )
    coach = normalize_space(strip_tags(coach_match.group(1))) if coach_match else None
    return (
        LineupData(
            coach=coach or None,
            starters=[player for player, _ in rows],
            substitutes=[],
        ),
        rows,
    )


def _goal_timeline(document: str) -> list[GoalEvent]:
    start = document.find('<div class="row pt-1 pt-md-3 pb-2 text-center')
    if start < 0:
        return []
    end = document.find('<div class="row pt-1 pb-4 d-md-none">', start)
    segment = document[start : end if end > start else start + 20000]
    home_start = segment.find('<div class="text-right">')
    referee_start = segment.find('<div class="col-sm-auto', home_start)
    away_start = segment.find('<div class="text-left">', referee_start)
    if home_start < 0 or away_start < 0:
        return []
    home_end = referee_start if referee_start > home_start else away_start
    chunks = (("home", segment[home_start:home_end]), ("away", segment[away_start:]))
    out: list[GoalEvent] = []
    for side, chunk in chunks:
        for goal_match in re.finditer(r'<div class="text-blanc">(.*?)</div>', chunk, re.S):
            body = goal_match.group(1)
            score = re.search(r"<span[^>]*>(\d+)\s*-\s*(\d+)</span>", body)
            player = re.search(r"<a[^>]*>(.*?)</a>", body, re.S)
            minute = re.search(r"(\d+(?:\+\d+)?)'", body)
            if not (score and player and minute):
                continue
            out.append(
                GoalEvent(
                    minute=_first_int(minute.group(1)) or 0,
                    minute_label=minute.group(1),
                    team=side,
                    player=normalize_space(strip_tags(player.group(1))),
                    own_goal="(pp)" in body,
                    penalty="(pen)" in body,
                    score_home=int(score.group(1)),
                    score_away=int(score.group(2)),
                )
            )
    return out


def _match_moment(minute_label: str) -> int:
    return _first_int(minute_label) or 0


def _split_tables(fragment: str) -> list[str]:
    return re.findall(r"<table[^>]*>.*?</table>", fragment, re.S)


def parse_match_detail(document: str, bdf_id: str, url: str) -> MatchDetailData:
    """Interpreta la ficha de un partido: cabecera, alineaciones y eventos."""
    competition = _header_value(document, "Competición")
    matchday_text = _header_value(document, "Jornada")
    matchday = _first_int(matchday_text) if matchday_text else None
    venue = _header_value(document, "Estadio")
    raw_date = _header_value(document, "Fecha")
    iso_date = None
    if raw_date:
        date_match = re.search(r"(\d{2})/(\d{2})/(\d{4})", raw_date)
        if date_match:
            day, month, year = date_match.groups()
            iso_date = f"{year}-{month}-{day}"
    referee = None
    referee_match = re.search(
        r"<a href=['\"]\.\./r/r\d+\.html['\"]>(.*?)</a>", document, re.S
    )
    if referee_match:
        referee = normalize_space(strip_tags(referee_match.group(1))) or None

    heading = re.search(r'<h1 class="m-0".*?</h1>', document, re.S)
    if not heading:
        raise SourceError("no se pudo interpretar la cabecera del partido de BDFutbol")
    teams: list[tuple[str, str]] = []
    seen_ids: set[str] = set()
    for team_id, name in re.findall(
        r"<a href='\.\./e/e(\d+)\.html'>(.*?)</a>", heading.group(0), re.S
    ):
        if team_id in seen_ids:
            continue
        seen_ids.add(team_id)
        teams.append((team_id, normalize_space(strip_tags(name))))
    if len(teams) < 2:
        raise SourceError("la ficha del partido no identifica a los dos equipos")
    scores = [int(value) for value in re.findall(
        r"resultat-partit[^>]*>\s*(\d+)\s*<", heading.group(0)
    )]
    score_home = scores[0] if len(scores) > 0 else None
    score_away = scores[1] if len(scores) > 1 else None

    home_lineup = LineupData()
    away_lineup = LineupData()
    player_rows: list[tuple[str, list[tuple[LineupPlayer, tuple[tuple[str, str], ...]]]]] = [
        ("home", []),
        ("away", []),
    ]
    subs_index = document.find("<h2>Suplentes</h2>")
    coaches_index = document.find("<h2>Entrenadores</h2>")
    if subs_index > 0 and coaches_index > subs_index:
        starter_tables = _split_tables(document[:subs_index])[-2:]
        substitute_tables = _split_tables(document[subs_index:coaches_index])[:2]
        coach_tables = _split_tables(document[coaches_index:])[:2]
        for index, table in enumerate(substitute_tables):
            lineup, rows = _parse_lineup(table)
            lineup.substitutes = [player for player, _ in rows]
            player_rows[index][1].extend(rows)
            if index == 0:
                home_lineup.substitutes = lineup.substitutes
            else:
                away_lineup.substitutes = lineup.substitutes
        for index, table in enumerate(starter_tables):
            lineup, rows = _parse_lineup(table)
            player_rows[index][1].extend(rows)
            if index == 0:
                home_lineup.starters = lineup.starters
            else:
                away_lineup.starters = lineup.starters
        for index, table in enumerate(coach_tables):
            lineup, _ = _parse_lineup(table)
            if index == 0:
                home_lineup.coach = lineup.coach
            else:
                away_lineup.coach = lineup.coach

    goals = _goal_timeline(document)
    cards: list[CardEvent] = []
    substitution_raw: dict[str, list[tuple[str, str]]] = {"home": [], "away": []}
    for side, rows in player_rows:
        for player, events in rows:
            for kind, minute_label in events:
                if kind in {"TG", "TG2", "TV"}:
                    cards.append(
                        CardEvent(
                            minute=_match_moment(minute_label),
                            minute_label=minute_label,
                            team=side,
                            player=player.name,
                            kind={"TG": "yellow", "TG2": "second_yellow", "TV": "red"}[kind],
                        )
                    )
                elif kind in {"Surt", "Entra"}:
                    substitution_raw[side].append((kind, f"{minute_label}|{player.name}"))

    substitutions: list[SubstitutionEvent] = []
    for side, items in substitution_raw.items():
        grouped: dict[str, list[tuple[str, str]]] = {}
        for kind, payload in items:
            minute_label, _, name = payload.partition("|")
            grouped.setdefault(minute_label, []).append((kind, name))
        for minute_label, group in grouped.items():
            outs = [name for kind, name in group if kind == "Surt"]
            ins = [name for kind, name in group if kind == "Entra"]
            if len(outs) == 1 and len(ins) == 1:
                substitutions.append(
                    SubstitutionEvent(
                        minute=_match_moment(minute_label),
                        minute_label=minute_label,
                        team=side,
                        player_out=outs[0],
                        player_in=ins[0],
                    )
                )
            else:
                # Sin emparejamiento inequívoco se publican las dos mitades por
                # separado; nunca se inventa qué jugador sustituye a cuál.
                for name in outs:
                    substitutions.append(
                        SubstitutionEvent(
                            minute=_match_moment(minute_label),
                            minute_label=minute_label,
                            team=side,
                            player_out=name,
                        )
                    )
                for name in ins:
                    substitutions.append(
                        SubstitutionEvent(
                            minute=_match_moment(minute_label),
                            minute_label=minute_label,
                            team=side,
                            player_in=name,
                        )
                    )

    def sort_key(item: GoalEvent | CardEvent | SubstitutionEvent) -> tuple[int, int]:
        parts = item.minute_label.split("+")
        return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)

    goals.sort(key=sort_key)
    cards.sort(key=sort_key)
    substitutions.sort(key=sort_key)

    return MatchDetailData(
        bdfutbol_id=bdf_id,
        url=url,
        competition=competition,
        matchday=matchday,
        date=iso_date,
        venue=venue,
        referee=referee,
        home_name=teams[0][1],
        away_name=teams[1][1],
        home_bdf_id=teams[0][0],
        away_bdf_id=teams[1][0],
        score_home=score_home,
        score_away=score_away,
        home_lineup=home_lineup,
        away_lineup=away_lineup,
        goals=goals,
        cards=cards,
        substitutions=substitutions,
    )


def _fetched_at() -> str:
    return date.today().isoformat()


__all__ = [
    "BASE",
    "BDFutbolClient",
    "Candidate",
    "CardEvent",
    "CareerEntryData",
    "GoalEvent",
    "LineupData",
    "LineupPlayer",
    "MatchData",
    "MatchDetailData",
    "Profile",
    "ScheduleMatch",
    "SeasonRow",
    "SubstitutionEvent",
    "choose_candidate",
    "find_schedule_match",
    "parse_match_detail",
    "parse_matches",
    "parse_profile",
    "parse_schedule",
    "parse_search",
    "same_team",
    "team_key",
]
