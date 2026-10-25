"""Fixtures locales: parsers de BDFutbol/Wikidata/Wikipedia sin tocar la red."""

from __future__ import annotations

import json

import yaml

from depor_hub import models as m
from depor_hub.enrich import bdfutbol, commons, official, wikidata, wikipedia
from depor_hub.enrich.proposal import (
    Observation,
    PlayerProposal,
    _add_official_priority,
    _add_primary,
    _birth_place_decision,
    _decide,
    _match_dict,
    collect_player,
    load_manual,
    merge_extras,
)
from depor_hub.extras import apply_extras, load_extras, reset_enriched

SEARCH = """
<table>
  <tr class="tipus1">
    <td>Portero</td>
    <td><a href="j/j123.html">Álvaro Fernández (Ferllo)</a></td>
    <td>13/04/1998</td>
    <td>Deportivo de La Coruña, Huesca</td>
  </tr>
  <tr class="tipus1">
    <td>Portero</td>
    <td><a href="j/j999.html">Álvaro Fernández</a></td>
    <td>01/01/1990</td>
    <td>Otro club</td>
  </tr>
</table>
"""

PROFILE = """
<div>Nombre completo</div>
<div class="font-weight-bold">Álvaro Fernández Llorente</div>
<div>Fecha de nacimiento</div>
<div class="font-weight-bold">13/04/1998 (28 años)</div>
<div>Lugar de nacimiento</div>
<div class="font-weight-bold"><a href='x'>Arnedo</a> (<a href='y'>La Rioja</a>)</div>
<div>País de nacimiento</div>
<div class="font-weight-bold"><a href='z'>España</a></div>
<div>Altura</div>
<div class="font-weight-bold">186 cm</div>
<div>Peso</div>
<div class="font-weight-bold">80 kg</div>
<table>
  <tr>
    <th>Temp</th><th>Equipo</th><th>Dorsal</th><th>PJ</th><th>Gols</th><th>Min</th><th>TG</th><th>TV</th>
  </tr>
  <tr>
    <td class="colTemporada">2014-15</td><td class="colEquip">Osasuna B</td>
    <td class="colPJ">19</td><td class="colGols">0</td><td class="colMin">1710</td>
    <td class="colTG">2</td><td class="colTV">0</td>
  </tr>
  <tr>
    <td class="colTemporada">2016-17</td><td class="colEquip">Osasuna B</td>
    <td class="colPJ">10</td><td class="colGols">1</td><td class="colMin">900</td>
    <td class="colTG">0</td><td class="colTV">1</td>
  </tr>
  <tr>
    <td class="colTemporada">2016-17</td><td class="colEquip">Osasuna</td>
    <td class="colPJ">1</td><td class="colGols">0</td><td class="colMin">44</td>
    <td class="colTG">0</td><td class="colTV">0</td>
  </tr>
  <tr>
    <td class="colTemporada">2025-26</td><td class="colEquip">Deportivo de La Coruña</td>
    <td class="colDorsal">25</td><td class="colPJ">30</td><td class="colGols">4</td><td class="colMin">2700</td>
    <td class="colTG">3</td><td class="colTV">0</td>
  </tr>
  <tr>
    <td>Total</td><td></td><td class="colPJ">60</td><td class="colGols">5</td>
    <td class="colMin">5354</td><td class="colTG">5</td><td class="colTV">1</td>
  </tr>
</table>
"""


def match_row(
    date: str,
    side: int,
    home: str,
    away: str,
    home_goals: int,
    away_goals: int,
    home_id: int,
    away_id: int,
    minutes: int,
    *,
    yellow_1: object = 0,
    yellow_2: object = 0,
    red: object = 0,
    goals: str = "",
    starter: int = 1,
) -> list:
    return [
        2025, "2a", "", date, side, home, home_goals, away_goals, 123, starter, 1, 0,
        minutes, 0, yellow_1, yellow_2, red, goals, away, home_id, away_id, 1, 1, 0,
        "Jornada 1", "1", "2025-26",
    ]


MATCHES = [
    match_row(
        "24/05/2026", 1, "Deportivo de La Coruña", "Valladolid", 2, 0, 13, 37, 90,
        yellow_1="90+13", red="67", goals="GO12-GO90+1-PP3-PN7",
    ),
    match_row("17/05/2026", 0, "Racing de Santander", "Deportivo de La Coruña", 1, 2, 29, 13, 90,
              yellow_1="S", yellow_2="72"),
    match_row("18/05/2026", 0, "Rival", "Deportivo de La Coruña", 1, 1, 99, 13, 0),
    match_row("19/05/2026", 1, "Otro", "Tercero", 1, 0, 98, 97, 90),
    match_row("20/05/2026", 1, "Deportivo de La Coruña", "Rival", 0, 0, 13, 99, 45, goals="PP3"),
]


def test_bdfutbol_search_disambiguates_by_exact_birth_date():
    candidates = bdfutbol.parse_search(SEARCH)
    assert [c.bdf_id for c in candidates] == ["j123", "j999"]
    chosen = bdfutbol.choose_candidate(candidates, "Álvaro Fernández", "1998-04-13")
    assert chosen is not None
    assert chosen.url.endswith("/j/j123.html")
    # Una fecha distinta no se compensa con un nombre único: podría ser un homónimo.
    assert bdfutbol.choose_candidate(candidates, "Álvaro Fernández", "1991-01-01") is None


def test_bdfutbol_profile_seasons_career_and_totals():
    profile = bdfutbol.parse_profile(PROFILE, "j123", "https://example.test/j/j123.html")
    assert profile.date_of_birth == "1998-04-13"
    assert profile.birth_place == "Arnedo (La Rioja), España"
    assert (profile.height_cm, profile.weight_kg) == (186, 80)
    assert profile.totals == {
        "appearances": 60,
        "goals": 5,
        "minutes": 5354,
        "yellow_cards": 5,
        "red_cards": 1,
        "assists": None,
    }
    assert [c.club for c in profile.career] == [
        "Osasuna B",
        "Osasuna",
        "Deportivo de La Coruña",
    ]
    b = profile.career[0]
    assert (b.from_, b.to, b.appearances, b.goals, len(b.seasons)) == ("2014", "2017", 29, 1, 2)
    assert profile.career[-1].to is None  # sigue en el Depor
    assert profile.career[-1].seasons[-1].shirt_number == 25


def test_bdfutbol_matches_only_for_depor_and_parses_cards_and_goals():
    document = "P=" + json.dumps(MATCHES) + ";"
    matches = bdfutbol.parse_matches(document)
    assert [m.date for m in matches] == ["2026-05-24", "2026-05-20", "2026-05-17"]
    first = matches[0]
    assert (first.opponent, first.home, first.minutes) == ("Valladolid", True, 90)
    assert (first.team_goals, first.opponent_goals, first.result) == (2, 0, "W")
    assert (first.goals, first.yellow_cards, first.red_cards) == (3, 1, 1)
    away = matches[2]
    assert (away.home, away.team_goals, away.opponent_goals) == (False, 2, 1)
    assert (away.yellow_cards, away.red_cards) == (2, 0)


def test_bdfutbol_goal_minutes_do_not_become_thousands():
    document = "P=" + json.dumps([MATCHES[0]]) + ";"
    assert bdfutbol.parse_matches(document)[0].minutes == 90


WIKITEXT = """
== Porteros ==
{{Jugador de fútbol con esquema
| nombre = [[Álvaro Fernández]]
| num = 25
| contrato = 2027
| procedencia = [[CA Osasuna|Osasuna]]
| nota = cedido
| edad = {{edad|13|4|1998}}
}}
{{Jugador de fútbol con esquema
| nombre = [[Otro Portero]]
| num = 13
| contrato = 2026
}}
== Cesiones ==
{{Jugador de fútbol con esquema
| nombre = [[Cedido Fuera]]
| num = 30
| nota = cedido a otro club
}}
"""


def test_wikipedia_template_dorsal_contract_loan_and_dob():
    players = wikipedia.parse_squad_template(WIKITEXT, "https://es.wikipedia.org/wiki/Depor")
    assert [p.name for p in players] == ["Álvaro Fernández", "Otro Portero"]
    first = players[0]
    assert first.date_of_birth == "1998-04-13"
    assert (first.shirt_number, first.contract_until, first.loan_from) == (25, "2027", "Osasuna")
    assert wikipedia.choose_wiki(players, "Álvaro Fernández", "1998-04-13") is first
    assert wikipedia.choose_wiki(players, "Otro Portero", None) is players[1]
    # Si la fecha no coincide, no se cae al nombre: la plantilla podría ser otro jugador.
    assert wikipedia.choose_wiki(players, "Álvaro Fernández", "1990-01-01") is None


class FakeWikidataHttp:
    LABELS = {
        "Q1": "Arnedo",
        "Q2": "Osasuna",
        "Q3": "Izquierdo",
        "Q8760": "Deportivo de La Coruña",
    }

    def get_json(self, url: str) -> dict:
        from urllib.parse import parse_qs, urlparse

        ids = parse_qs(urlparse(url).query)["ids"][0].split("|")
        return {
            "entities": {
                qid: {"labels": {"es": {"value": self.LABELS.get(qid, qid)}}} for qid in ids
            }
        }


def claim(pid: str, value: object, qualifiers: dict | None = None) -> dict:
    return {
        "rank": "normal",
        "mainsnak": {"snaktype": "value", "datavalue": {"value": value}},
        "qualifiers": qualifiers or {},
    }


def entity_id(qid: str) -> dict:
    return {"id": qid}


def quantity(amount: str, unit: str) -> dict:
    return {"amount": amount, "unit": unit}


def time(value: str) -> dict:
    return {"time": value, "precision": 11}


def wikidata_entity(height: dict) -> dict:
    return {
        "id": "Q10",
        "labels": {"es": {"value": "Álvaro Fernández"}},
        "claims": {
            "P569": [claim("P569", time("+1998-04-13T00:00:00Z"))],
            "P19": [claim("P19", entity_id("Q1"))],
            "P2048": [claim("P2048", height)],
            "P8006": [claim("P8006", entity_id("Q3"))],
            "P1618": [claim("P1618", "25", {"P54": [claim("P54", entity_id("Q8760"))]})],
            "P2002": [claim("P2002", "deporhub")],
            "P54": [
                claim(
                    "P54",
                    entity_id("Q8760"),
                    {
                        "P580": [claim("P580", time("+2025-07-01T00:00:00Z"))],
                        "P1350": [claim("P1350", quantity("+22", "1"))],
                        "P1351": [claim("P1351", quantity("+4", "1"))],
                    },
                ),
                claim(
                    "P54",
                    entity_id("Q2"),
                    {
                        "P580": [claim("P580", time("+2014-07-01T00:00:00Z"))],
                        "P582": [claim("P582", time("+2017-06-30T00:00:00Z"))],
                    },
                ),
            ],
        },
    }


def test_wikidata_height_metres_and_centimetres():
    metres = quantity("+1.86", "http://www.wikidata.org/entity/Q11573")
    centimetres = quantity("+186", "http://www.wikidata.org/entity/Q174728")
    assert wikidata._height_cm({"snaktype": "value", "datavalue": {"value": metres}}) == 186
    assert wikidata._height_cm({"snaktype": "value", "datavalue": {"value": centimetres}}) == 186


def test_wikidata_extract_foot_shirt_social_career_and_dob():
    client = wikidata.WikidataClient(FakeWikidataHttp())  # type: ignore[arg-type]
    data = client.extract(wikidata_entity(quantity("+1.86", "http://www.wikidata.org/entity/Q11573")))

    assert data.date_of_birth == "1998-04-13"
    assert (data.birth_place, data.height_cm, data.preferred_foot, data.shirt_number) == (
        "Arnedo",
        186,
        "left",
        25,
    )
    assert data.social == {"x": "deporhub", "instagram": None, "tiktok": None}
    assert [(c.club, c.from_, c.to, c.appearances, c.goals) for c in data.career] == [
        ("Osasuna", "2014-07-01", "2017-06-30", None, None),
        ("Deportivo de La Coruña", "2025-07-01", None, 22, 4),
    ]


def test_decide_conflict_is_not_silently_resolved():
    decision = _decide(
        "height_cm",
        [Observation(185, "BDFutbol", "u1"), Observation(187, "Wikidata", "u2")],
    )
    assert decision is not None
    assert decision.confidence == "conflict"
    assert decision.value is None
    assert [c["value"] for c in decision.candidates] == [185, 187]


def test_decide_equal_values_are_cross_checked():
    decision = _decide(
        "height_cm",
        [Observation(186, "BDFutbol", "u1"), Observation(186, "Wikidata", "u2")],
    )
    assert decision is not None
    assert (decision.value, decision.confidence) == (186, "cross_checked")


def test_extras_are_written_with_the_snake_case_schema():
    proposal = PlayerProposal(player_id=1, name="A")
    proposal.decisions["depor_matches"] = _decide(
        "depor_matches",
        [
            Observation(
                [
                    bdfutbol.MatchData(
                        date="2026-05-24",
                        opponent="Valladolid",
                        competition="LaLiga",
                        home=True,
                        team_goals=2,
                        opponent_goals=0,
                        result="W",
                        started=True,
                        minutes=90,
                        goals=1,
                        assists=None,
                        yellow_cards=1,
                        red_cards=0,
                    )
                ],
                "BDFutbol",
                "u",
            )
        ],
    )
    extras = proposal.to_extras("single_source")
    match = extras["depor_matches"][0]
    assert (match["team_goals"], match["opponent_goals"]) == (2, 0)
    assert (match["yellow_cards"], match["red_cards"]) == (1, 0)
    assert extras["provenance"]["deporMatches"]["captured_at"] == proposal.captured_at
    assert "teamGoals" not in _match_dict(
        bdfutbol.MatchData(
            date="2026-01-01",
            opponent="X",
            competition=None,
            home=True,
            team_goals=None,
            opponent_goals=None,
            result=None,
            started=None,
            minutes=None,
            goals=None,
            assists=None,
            yellow_cards=None,
            red_cards=None,
        )
    )


def test_manual_data_wins_and_generated_only_fills_gaps():
    merged = merge_extras(
        {1: {"height_cm": 180, "source": "manual"}},
        {1: {"height_cm": 186, "source": "BDFutbol", "career": [{"club": "X"}], "confidence": "single_source"}},
    )
    assert merged[1]["height_cm"] == 180
    assert merged[1]["source"] == "manual"
    assert merged[1]["career"] == [{"club": "X"}]


def test_load_manual_accepts_legacy_camel_case(tmp_path):
    path = tmp_path / "extras.yml"
    path.write_text(
        yaml.safe_dump(
            {
                "players": {
                    "1": {
                        "career": [
                            {
                                "club": "X",
                                "from": "2014",
                                "yellowCards": 2,
                                "seasons": [{"season": "2014-15", "redCards": 1}],
                            }
                        ],
                        "provenance": {"heightCm": {"source": "BDFutbol", "capturedAt": "2026-10-25"}},
                        "source": "BDFutbol",
                    }
                }
            }
        ),
        encoding="utf-8",
    )
    data = load_manual(path)[1]
    assert data["career"][0]["yellow_cards"] == 2
    assert data["career"][0]["seasons"][0]["red_cards"] == 1
    assert data["provenance"]["heightCm"]["captured_at"] == "2026-10-25"


def squad() -> m.Squad:
    return m.Squad(updated_at="2026-10-20T10:00:00Z", players=[m.Player(id=1, name="A")])


def extras_file(tmp_path):
    path = tmp_path / "extras.yml"
    path.write_text(
        """
players:
  1:
    shirt_number: 25
    height_cm: 186
    source: BDFutbol
    confidence: cross_checked
    captured_at: '2026-10-25'
    provenance:
      heightCm: {source: BDFutbol + Wikidata, confidence: cross_checked, captured_at: '2026-10-25'}
""",
        encoding="utf-8",
    )
    return path


def test_apply_is_idempotent_and_refreshes_enriched_fields(tmp_path):
    extras = load_extras(extras_file(tmp_path))
    once = apply_extras(squad(), extras)
    twice = apply_extras(once, extras)
    assert once.model_dump(by_alias=True) == twice.model_dump(by_alias=True)
    assert once.players[0].provenance["heightCm"].source == "BDFutbol + Wikidata"

    stale = once.model_copy(
        update={
            "players": [once.players[0].model_copy(update={"height_cm": 170})],
        }
    )
    refreshed = apply_extras(reset_enriched(stale), extras)
    assert refreshed.players[0].height_cm == 186
    assert refreshed.model_dump(by_alias=True) == once.model_dump(by_alias=True)


def test_csv_template_round_trip(tmp_path):
    from depor_hub import cli

    template = tmp_path / "squad.csv"
    cli._write_template(template, squad())
    text = template.read_text(encoding="utf-8")
    assert "shirt_number" in text and "A" in text

    lines = text.splitlines()
    header = lines[0].split(",")
    row = [""] * len(header)
    row[header.index("id")] = "1"
    row[header.index("shirt_number")] = "9"
    row[header.index("height_cm")] = "188"
    row[header.index("source")] = "manual"
    template.write_text("\n".join([lines[0], ",".join(row)]) + "\n", encoding="utf-8")

    target = tmp_path / "extras.yml"
    assert cli._import_csv(template, target, squad()) == 0
    out = load_extras(target)
    assert out[1].shirt_number == 9
    assert out[1].height_cm == 188
    assert out[1].source == "manual"


OFFICIAL_DOC = """
<html><head><title>Álvaro Ferllo | RC Deportivo de La Coruña</title></head>
<body>
  <h2>1,93</h2><h3>Altura</h3>
  <script>
    window.__DATA__ = {
      "Nacimiento","13 de abril de 1998",
      "Pie preferido","Zurdo",
      "platform","instagram","https://instagram.com/alvaroferllo",
      "platform","x","https://x.com/alvaroferllo"
    };
  </script>
  <img src="https://cdn.bff.rcdeportivo.app/players/328414-small?v=21">
</body></html>
"""


def test_official_profile_parses_height_foot_photo_social_and_dob():
    profile = official.parse_official_profile(
        OFFICIAL_DOC, "https://www.rcdeportivo.es/es/jugadores/depor/alvaro-ferllo"
    )
    assert profile.name == "Álvaro Ferllo"
    assert profile.date_of_birth == "1998-04-13"
    assert profile.height_cm == 193
    assert profile.preferred_foot == "left"
    assert profile.photo_url == "https://cdn.bff.rcdeportivo.app/players/328414-large?v=21"
    assert profile.social == {"x": "alvaroferllo", "instagram": "alvaroferllo", "tiktok": None}


def _official_page(name: str, dob: str, photo_id: int, foot: str = "Derecho") -> str:
    return f"""
    <html><head><title>{name} | RC Deportivo</title></head><body>
      <h2>1,82</h2><h3>Altura</h3>
      <script>{{"Nacimiento","{dob}","Pie preferido","{foot}"}}</script>
      <img src="https://cdn.bff.rcdeportivo.app/players/{photo_id}-large?v=21">
    </body></html>
    """


class _FakeHttp:
    def __init__(self, pages: dict[str, str]) -> None:
        self.pages = pages

    def get(self, url: str):
        from types import SimpleNamespace

        return SimpleNamespace(text=self.pages[url])


def test_official_crawl_includes_fabril_and_dedupes_the_same_profile():
    team = "https://www.rcdeportivo.es/es/depor"
    fabril = official.FABRIL_URL
    profile_a = "https://www.rcdeportivo.es/es/jugadores/depor/nsongo-bil2"
    profile_b = "https://www.rcdeportivo.es/es/jugadores/depor-fabril/nsongo-bil"
    http = _FakeHttp({
        team: '<a href="/es/jugadores/depor/nsongo-bil2">Nsongo</a>',
        fabril: '<a href="/es/jugadores/depor-fabril/nsongo-bil">Bil</a>',
        profile_a: _official_page("Nsongo Bil", "21 de septiembre de 2004", 3531694),
        profile_b: _official_page("Bil Nsongo", "21 de septiembre de 2004", 3531694),
    })
    profiles, _ = official.OfficialClient(http).profiles(team_url=team, team_urls=(fabril,))

    assert len(profiles) == 1
    chosen = official.choose_profile(profiles, "Nsongo Tonfack", "2004-09-21")
    assert chosen is not None and chosen.photo_url.endswith("3531694-large?v=21")


def test_commons_imageinfo_keeps_license_attribution_and_thumbnail():
    payload = {
        "query": {
            "pages": [{
                "title": "File:Foto.jpg",
                "imageinfo": [{
                    "thumburl": "https://thumb.wikimedia.org/foto/960px-Foto.jpg",
                    "descriptionurl": "https://commons.wikimedia.org/wiki/File:Foto.jpg",
                    "thumbwidth": 900,
                    "thumbheight": 1200,
                    "extmetadata": {
                        "LicenseShortName": {"value": "CC BY-SA 4.0"},
                        "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"},
                        "Artist": {"value": '<a href="/wiki/User:Ada">Ada</a>'},
                        "Credit": {"value": "own work"},
                    },
                }],
            }]
        }
    }
    image = commons.parse_imageinfo(payload, "Foto.jpg")
    assert image is not None
    assert image.url == "https://thumb.wikimedia.org/foto/960px-Foto.jpg"
    assert image.description_url == "https://commons.wikimedia.org/wiki/File:Foto.jpg"
    assert (image.width, image.height) == (900, 1200)
    assert image.license == "CC BY-SA 4.0"
    assert image.author == "Ada"
    assert image.credit == "own work"


def test_commons_missing_page_returns_none():
    assert commons.parse_imageinfo({"query": {"pages": [{"title": "File:X", "missing": True}]}}, "X") is None


def test_wikipedia_english_infobox_height_and_birthplace():
    wikitext = """{{Infobox football biography
| name = Teun Gijselhart
| birth_date = {{birth date and age|2005|4|6|df=y}}
| birth_place = [[Amsterdam]], Netherlands
| height = 1.76 m
}}"""
    profile = wikipedia.parse_profile(
        wikitext, "Teun Gijselhart", "https://en.wikipedia.org/wiki/Teun_Gijselhart"
    )
    assert profile is not None
    assert profile.date_of_birth == "2005-04-06"
    assert profile.height_cm == 176
    assert profile.birth_place == "Amsterdam, Netherlands"


def test_official_value_wins_but_the_conflict_is_logged():
    proposal = PlayerProposal(player_id=1, name="A")
    _add_official_priority(
        proposal,
        "height_cm",
        [
            Observation(186, "BDFutbol", "https://bdfutbol"),
            Observation(185, "official", "https://rcdeportivo"),
        ],
    )
    assert proposal.decisions["height_cm"].value == 185
    assert proposal.decisions["height_cm"].sources == ("official",)
    assert proposal.conflicts[0]["applied"] == 185
    assert "ficha oficial" in proposal.conflicts[0]["resolution"]


def test_primary_source_wins_for_weight_but_the_conflict_is_logged():
    proposal = PlayerProposal(player_id=1, name="A")
    _add_primary(
        proposal,
        "weight_kg",
        [
            Observation(81, "BDFutbol", "https://bdfutbol"),
            Observation(68, "Wikipedia (en)", "https://en.wikipedia"),
        ],
        "BDFutbol",
    )
    assert proposal.decisions["weight_kg"].value == 81
    assert proposal.conflicts[0]["applied"] == 81
    assert "BDFutbol" in proposal.conflicts[0]["resolution"]


def test_birth_place_compatible_forms_are_merged_and_dissent_stays_visible():
    decision = _birth_place_decision([
        Observation("Arnedo", "Wikidata", "u1"),
        Observation("Arnedo, La Rioja, España", "Wikipedia (es)", "u2"),
        Observation("Cambre", "BDFutbol", "u3"),
    ])
    assert decision is not None
    assert decision.value == "Arnedo, La Rioja, España"
    assert decision.confidence == "cross_checked"
    assert [c["value"] for c in decision.candidates] == ["Cambre"]
    assert decision.resolved_by == "consenso de fuentes"


def test_birth_place_without_consensus_is_a_conflict():
    decision = _birth_place_decision([
        Observation("Cambre", "BDFutbol", "u1"),
        Observation("El Temple", "Wikipedia (es)", "u2"),
    ])
    assert decision is not None
    assert decision.confidence == "conflict"
    assert decision.value is None


def test_manual_photos_override_generated_photos():
    manual_photo = {"url": "https://example.org/manual.jpg", "role": "portrait"}
    generated_photo = {"url": "https://example.org/generated.jpg", "role": "portrait"}
    merged = merge_extras(
        {1: {"source": "manual", "photos": [manual_photo]}},
        {
            1: {
                "photos": [generated_photo],
                "provenance": {"photos": {"source": "Commons"}},
            }
        },
    )
    assert merged[1]["photos"] == [manual_photo]
    assert merged[1]["provenance"]["photos"] == {"source": "Commons"}


def test_only_the_official_club_photo_is_kept_and_it_is_the_portrait():
    player = m.Player(id=1, name="A", date_of_birth="2000-01-31")
    profile = official.OfficialProfile(
        name="A",
        date_of_birth="2000-01-31",
        height_cm=180,
        preferred_foot="right",
        photo_url="https://cdn.bff.rcdeportivo.app/players/1-large?v=21",
        source_url="https://www.rcdeportivo.es/es/jugadores/depor/a",
    )
    proposal = collect_player(player, None, None, [], [profile])

    photos = proposal.decisions["photos"].value
    assert len(photos) == 1
    assert photos[0]["url"] == "https://cdn.bff.rcdeportivo.app/players/1-large?v=21"
    assert photos[0]["role"] == "portrait"
    assert photos[0]["credit"] == "© RC Deportivo de La Coruña"
    assert proposal.decisions["photos"].sources == ("official",)
    assert proposal.decisions["photos"].urls == (
        "https://www.rcdeportivo.es/es/jugadores/depor/a",
    )


def test_no_photos_flag_skips_the_official_photo_too():
    player = m.Player(id=1, name="A", date_of_birth="2000-01-31")
    profile = official.OfficialProfile(
        name="A",
        date_of_birth="2000-01-31",
        height_cm=180,
        preferred_foot="right",
        photo_url="https://cdn.bff.rcdeportivo.app/players/1-large?v=21",
        source_url="https://www.rcdeportivo.es/es/jugadores/depor/a",
    )
    proposal = collect_player(player, None, None, [], [profile], with_photos=False)
    assert "photos" not in proposal.decisions


def test_manual_loan_to_is_applied_with_provenance_and_cleared_on_reset(tmp_path):
    path = tmp_path / "overrides.yml"
    path.write_text(
        """
players:
  1:
    loan_to: Al Ain (Emiratos Árabes Unidos)
    source: https://www.rcdeportivo.es/es/noticias/teun-gijselhart-cedido-al-al-ain
    provenance:
      loanTo:
        source: https://www.rcdeportivo.es/es/noticias/teun-gijselhart-cedido-al-al-ain
        confidence: verified
""",
        encoding="utf-8",
    )
    applied = apply_extras(squad(), load_extras(path))
    assert applied.players[0].loan_to == "Al Ain (Emiratos Árabes Unidos)"
    assert applied.players[0].provenance["loanTo"].confidence == "verified"
    assert reset_enriched(applied).players[0].loan_to is None
