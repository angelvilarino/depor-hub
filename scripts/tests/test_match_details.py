"""Detalle de partido de BDFutbol: calendario, alineaciones y eventos (ADR 0031)."""

from __future__ import annotations

import argparse
import json
from dataclasses import replace

from depor_hub import cli
from depor_hub import models as m
from depor_hub import transform as t
from depor_hub.enrich import bdfutbol
from depor_hub.enrich.http import SourceError

NOW = "2026-11-04T10:00:00Z"

SCHEDULE = """
<table>
  <tr class='jornadai ij1' style='display:none' data-jornada='1'>
    <th>Fecha</th><th class='text-right'>Local</th><th></th><th class='text-left'>Visitante</th>
  </tr>
  <tr class='jornadai ij1' style='display:none' data-jornada='1'>
    <td class='14'><a href='../p/p.php?id=32382'>17/08/2026</a></td>
    <td class=''><div class='d-flex'><a href='../p/p.php?id=32382'>Deportivo de A Coruña</a></div></td>
    <td class='text-center'><div class='vic_no'>1 1</div></td>
    <td class=''><div class='d-flex'><a href='../p/p.php?id=32382'>Elche</a></div></td>
    <td class='text-left'>Riazor</td>
    <td class='text-left'>Hernández Maeso</td>
  </tr>
  <tr class='jornadai ij2' style='display:none' data-jornada='2'>
    <td class='14'>08/11/2026</td>
    <td class=''><div class='d-flex'>Espanyol</div></td>
    <td class='text-center'><div class='vic_no'>&mdash;</div></td>
    <td class=''><div class='d-flex'>Deportivo de A Coruña</div></td>
    <td class='text-left'></td>
    <td class='text-left'></td>
  </tr>
</table>
"""


def _event(kind: str, minute: str) -> str:
    titles = {
        "G": "Gol",
        "TG": "Tarjeta Amarilla",
        "TV": "Expulsión",
        "Surt": "Sale",
        "Entra": "Entra",
    }
    return f'<div class="{kind}" title="{titles[kind]}"></div>{minute}'


def _row(name: str, number: int, events: str = "") -> str:
    return (
        f"<tr><td class='fit'>{number}</td>"
        f"<td><a href='../j/j{number}00.html'>{name}</a></td>"
        f"<td>{events}</td></tr>"
    )


def _table(rows: list[str]) -> str:
    return "<table class='taula_estil'>" + "".join(rows) + "</table>"


DETAIL = f"""
<div class="f14">Competición</div>
<div class="f13 font-weight-bold"><a href='../t/t2026-27.html'>Primera División</a></div>
<div class="f14">Jornada</div>
<div class="f13 font-weight-bold">Jornada 1</div>
<div class="f14">Estadio</div>
<div class="f13 font-weight-bold">Riazor (A Coruña)</div>
<div class="f14">Fecha</div>
<div class="f13 font-weight-bold">Domingo 17/08/2026</div>
<div class="col-sm-auto"><a href='../r/r600734.html'>Hernández Maeso</a></div>

<h1 class="m-0">
  <a href='../e/e13.html'>Deportivo de A Coruña</a>
  <span class="col-auto resultat-partit">1</span>
  <span class="col-auto resultat-partit">2</span>
  <a href='../e/e42.html'>Elche</a>
</h1>

<div class="row pt-1 pt-md-3 pb-2 text-center">
  <div class="text-right">
    <div class="text-blanc"><span>1-0</span><a href="../j/j100.html">Aubameyang</a> 21' (pen)</div>
  </div>
  <div class="col-sm-auto">Hernández Maeso</div>
  <div class="text-left">
    <div class="text-blanc"><span>1-1</span><a href="../j/j200.html">Aguado</a> 76'</div>
    <div class="text-blanc"><span>1-2</span><a href="../j/j300.html">Tárrega</a> 80' (pp)</div>
  </div>
</div>
<div class="row pt-1 pb-4 d-md-none"></div>

{_table([
    _row("Jensen", 6, _event("Surt", "60")),
    _row("Aubameyang", 9, _event("G", "21")),
])}
{_table([
    _row("Redondo", 5, _event("Surt", "60") + _event("TG", "65")),
    _row("Martim Neto", 8, _event("Surt", "60")),
])}

<h2>Suplentes</h2>

{_table([
    _row("Eddahchouri", 19, _event("Entra", "60")),
])}
{_table([
    _row("Tete Morente", 20, _event("Entra", "60")),
    _row("Cepeda", 21, _event("Entra", "60")),
])}

<h2>Entrenadores</h2>

<div class='col-6'>{_table(["<tr class='entren'><td><a href='../l/l219.html'>Antonio Hidalgo</a></td></tr>"])}</div>
<div class='col-6'>{_table(["<tr class='entren'><td><a href='../l/l68384.html'>Anselmi</a></td></tr>"])}</div>
"""


def test_parse_schedule_keeps_rows_without_result():
    rows = bdfutbol.parse_schedule(SCHEDULE)
    assert [(row.bdf_id, row.home, row.away) for row in rows] == [
        ("32382", "Deportivo de A Coruña", "Elche"),
        (None, "Espanyol", "Deportivo de A Coruña"),
    ]
    assert rows[0].date == "2026-08-17"
    assert rows[0].matchday == 1
    assert rows[1].date == "2026-11-08"


def test_same_team_tolerates_suffixes_but_not_rivals():
    assert bdfutbol.same_team("RC Deportivo La Coruña", "Deportivo de A Coruña")
    assert bdfutbol.same_team("Elche CF", "Elche")
    assert not bdfutbol.same_team("Real Madrid CF", "Club Atlético de Madrid")


def test_find_schedule_match_requires_unambiguous_row():
    rows = bdfutbol.parse_schedule(SCHEDULE)
    found = bdfutbol.find_schedule_match(
        rows, "RC Deportivo La Coruña", "Elche CF", "2026-08-17"
    )
    assert found is not None and found.bdf_id == "32382"

    duplicate = rows + [
        bdfutbol.ScheduleMatch(
            bdf_id="99999",
            date="2026-08-17",
            matchday=1,
            home="Deportivo de A Coruña",
            away="Elche",
        )
    ]
    assert bdfutbol.find_schedule_match(
        duplicate, "RC Deportivo La Coruña", "Elche CF", "2026-08-17"
    ) is None


def test_parse_match_detail_reads_lineups_goals_cards_and_substitutions():
    data = bdfutbol.parse_match_detail(DETAIL, "32382", "https://example.test/p")

    assert (data.home_name, data.away_name) == ("Deportivo de A Coruña", "Elche")
    assert (data.score_home, data.score_away) == (1, 2)
    assert (data.competition, data.matchday, data.date) == (
        "Primera División",
        1,
        "2026-08-17",
    )
    assert (data.home_lineup.coach, data.away_lineup.coach) == ("Antonio Hidalgo", "Anselmi")
    assert [player.name for player in data.home_lineup.starters] == ["Jensen", "Aubameyang"]
    assert [player.name for player in data.away_lineup.substitutes] == [
        "Tete Morente",
        "Cepeda",
    ]

    assert [(goal.player, goal.minute, goal.penalty, goal.own_goal) for goal in data.goals] == [
        ("Aubameyang", 21, True, False),
        ("Aguado", 76, False, False),
        ("Tárrega", 80, False, True),
    ]
    assert [(goal.score_home, goal.score_away) for goal in data.goals] == [
        (1, 0),
        (1, 1),
        (1, 2),
    ]
    assert [(card.player, card.kind, card.minute) for card in data.cards] == [
        ("Redondo", "yellow", 65)
    ]

    # Solo el cambio con un jugador que sale y otro que entra queda emparejado.
    assert [
        (sub.team, sub.minute, sub.player_out, sub.player_in) for sub in data.substitutions
    ] == [
        ("home", 60, "Jensen", "Eddahchouri"),
        ("away", 60, "Redondo", None),
        ("away", 60, "Martim Neto", None),
        ("away", 60, None, "Tete Morente"),
        ("away", 60, None, "Cepeda"),
    ]


def test_build_match_detail_uses_football_data_id_and_keeps_nulls():
    data = bdfutbol.parse_match_detail(DETAIL, "32382", "https://example.test/p")
    match = m.Match(
        id=564635,
        utc_date="2026-08-17T19:00:00Z",
        status="FINISHED",
        matchday=1,
        stage="REGULAR_SEASON",
        home=m.TeamRef(
            id=560,
            name="RC Deportivo La Coruña",
            short_name="Depor",
            tla="DEP",
            crest_url=None,
        ),
        away=m.TeamRef(
            id=78,
            name="Elche CF",
            short_name="Elche",
            tla="ELC",
            crest_url=None,
        ),
        score=m.Score(home=1, away=2, winner="AWAY_TEAM"),
        depor_is_home=True,
        venue="Riazor",
        referee=None,
    )

    detail = cli._build_match_detail(match, "2026-27", data)
    body = t.dump(detail)

    assert body["matchId"] == 564635
    assert body["bdfutbolId"] == 32382
    assert body["deporIsHome"] is True
    assert body["score"]["halfTimeHome"] is None
    assert body["sourceUrl"] == "https://example.test/p"
    m.MatchDetail.model_validate(body)


def _match() -> m.Match:
    return m.Match(
        id=564635,
        utc_date="2026-08-17T19:00:00Z",
        status="FINISHED",
        matchday=1,
        stage="REGULAR_SEASON",
        home=m.TeamRef(id=560, name="RC Deportivo La Coruña", crest_url=None),
        away=m.TeamRef(id=78, name="Elche CF", crest_url=None),
        score=m.Score(home=1, away=2, winner="AWAY_TEAM"),
        depor_is_home=True,
        venue="Riazor",
        referee=None,
    )


def test_cmd_match_details_writes_once_and_not_for_upcoming(monkeypatch, tmp_path):
    fixtures_path = tmp_path / "fixtures.json"
    fixtures_path.write_text(
        json.dumps(
            t.dump(
                m.Fixtures(
                    updated_at=NOW,
                    season="2026-27",
                    matches=[_match()],
                )
            ),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    data = bdfutbol.parse_match_detail(DETAIL, "32382", "https://example.test/p")
    calls: list[str] = []

    class FakeClient:
        def __init__(self, http):
            pass

        def schedule(self, season):
            return bdfutbol.parse_schedule(SCHEDULE)

        def match_detail(self, bdf_id):
            calls.append(bdf_id)
            return data

    monkeypatch.setattr(bdfutbol, "BDFutbolClient", FakeClient)
    args = argparse.Namespace(
        fixtures=str(fixtures_path),
        out=str(tmp_path / "match-details"),
        raw=str(tmp_path / "raw"),
        interval=0,
        offline=True,
        force=False,
    )

    assert cli.cmd_match_details(args) == 0
    target = tmp_path / "match-details" / "2026-27" / "564635.json"
    first = m.MatchDetail.model_validate_json(target.read_text(encoding="utf-8"))
    assert first.match_id == 564635
    assert first.goals[0].player == "Aubameyang"

    assert cli.cmd_match_details(args) == 0
    assert calls == ["32382"]  # el segundo pase no vuelve a pedir la ficha
    again = m.MatchDetail.model_validate_json(target.read_text(encoding="utf-8"))
    assert again.captured_at == first.captured_at


def test_cmd_match_details_strict_fails_when_bdfutbol_is_unavailable(monkeypatch, tmp_path):
    """PIPE-04: un 403/429 con partidos pendientes no puede quedar en verde."""
    fixtures_path = tmp_path / "fixtures.json"
    fixtures_path.write_text(
        json.dumps(
            t.dump(m.Fixtures(updated_at=NOW, season="2026-27", matches=[_match()])),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    class FailingClient:
        def __init__(self, http):
            pass

        def schedule(self, season):
            raise SourceError("403 Forbidden", status=403)

    monkeypatch.setattr(bdfutbol, "BDFutbolClient", FailingClient)
    args = argparse.Namespace(
        fixtures=str(fixtures_path),
        out=str(tmp_path / "match-details"),
        raw=str(tmp_path / "raw"),
        interval=0,
        offline=True,
        force=False,
        strict=True,
    )

    assert cli.cmd_match_details(args) == 2


def test_cmd_match_details_without_pending_matches_stays_green(monkeypatch, tmp_path):
    fixtures_path = tmp_path / "fixtures.json"
    fixtures_path.write_text(
        json.dumps(
            t.dump(m.Fixtures(updated_at=NOW, season="2026-27", matches=[_match()])),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    target = tmp_path / "match-details" / "2026-27" / "564635.json"
    target.parent.mkdir(parents=True)
    target.write_text("{}", encoding="utf-8")

    args = argparse.Namespace(
        fixtures=str(fixtures_path),
        out=str(tmp_path / "match-details"),
        raw=str(tmp_path / "raw"),
        interval=0,
        offline=True,
        force=False,
        strict=True,
    )

    assert cli.cmd_match_details(args) == 0


def test_cmd_match_details_skips_a_different_score(monkeypatch, tmp_path):
    fixtures_path = tmp_path / "fixtures.json"
    fixtures_path.write_text(
        json.dumps(
            t.dump(m.Fixtures(updated_at=NOW, season="2026-27", matches=[_match()])),
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    data = replace(
        bdfutbol.parse_match_detail(DETAIL, "32382", "https://example.test/p"),
        score_home=9,
    )

    class FakeClient:
        def __init__(self, http):
            pass

        def schedule(self, season):
            return bdfutbol.parse_schedule(SCHEDULE)

        def match_detail(self, bdf_id):
            return data

    monkeypatch.setattr(bdfutbol, "BDFutbolClient", FakeClient)
    args = argparse.Namespace(
        fixtures=str(fixtures_path),
        out=str(tmp_path / "match-details"),
        raw=str(tmp_path / "raw"),
        interval=0,
        offline=True,
        force=False,
    )

    assert cli.cmd_match_details(args) == 0
    assert not (tmp_path / "match-details" / "2026-27" / "564635.json").exists()
