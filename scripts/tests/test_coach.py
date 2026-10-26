"""Entrenador y cuerpo técnico: parsers, extracción y aplicación al contrato (ADR 0014)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from depor_hub import models as m
from depor_hub.enrich.coach import (
    fetch_coach,
    parse_official_photo,
    parse_official_staff,
    parse_wikipedia_career,
    parse_wikipedia_personal,
)
from depor_hub.enrich.http import SourceError
from depor_hub.extras import (
    CoachExtra,
    ExtrasError,
    apply_coach,
    load_coach,
    reset_coach,
)

WIKITEXT = """{{Ficha de deportista
|nombre = Antonio Hidalgo
|fechadenacimiento = {{Fecha|6|febrero|1979}}
|ciudaddenacimiento = [[Granollers]], [[España]]
|nacionalidad = {{ESP}} española
}}

== Trayectoria ==
Empezó como jugador en el fútbol base.

== Como jugador ==
Debutó con el filial.

== Como jugador ==
{| class="wikitable"
|-
! Club !! Años !! Partidos !! Goles
|-
| [[FC Barcelona B]] || 1998–2000 || 66 || 4
|-
| [[CD Tenerife]] || 2000–2005 || 122 || 15
|-
| rowspan=2 | [[CD Tenerife]] || 2005–2006 || 10 || 1
|-
| 2006–2007 || 5 || 0
|-
| [[CE Sabadell]] || 2014–2015 || 30 || 2
|}

== Como entrenador ==
{| class="wikitable"
|-
! Club !! Años !! Partidos !! Victorias
|-
| [[EC Granollers]] || 2016 || 30 || 10
|-
| [[Deportivo de La Coruña]] || 2025–presente || 40 || 20
|}
"""

STAFF_HTML = """
<html><body>
<h2>Entrenador</h2>
<div>Antonio Hidalgo</div>
<div>Segundo entrenador</div>
<div>Ignasi Salafranca</div>
<div>Entrenador de porteros</div>
<div>Alberto Casal</div>
<div>Preparador físico</div>
<div>Carlos Casal</div>
<div>Fisioterapeuta</div>
<div>Ignasi Salafranca</div>
<h2>Patrocinadores</h2>
</body></html>
"""

PROFILE_HTML = """
<html><head>
<meta property="og:image" content="https://scdn.ovixia.app/images/entrenador.jpg?rect=0,0,1200,1200&amp;w=1200">
</head><body>Antonio Hidalgo</body></html>
"""


class FakeHttp:
    def __init__(self, wikitext: str = WIKITEXT, pages: dict[str, str] | None = None) -> None:
        self.wikitext = wikitext
        self.pages = pages or {}

    def get_json(self, url: str) -> dict:
        return {"parse": {"wikitext": self.wikitext}}

    def get(self, url: str) -> SimpleNamespace:
        return SimpleNamespace(text=self.pages.get(url, ""))


class FakeWikidata:
    def __init__(self, entities: dict[str, dict]) -> None:
        self._entities = entities

    def entities(self, ids: list[str]) -> dict[str, dict]:
        return {item: self._entities[item] for item in ids if item in self._entities}


def entity(label: str, *, birth: str | None = None, place: str | None = None, country: str | None = None) -> dict:
    claims: dict[str, list[dict]] = {}
    if birth:
        claims["P569"] = [
            {
                "mainsnak": {
                    "datavalue": {
                        "value": {"time": f"+{birth}T00:00:00Z", "precision": 11},
                    }
                }
            }
        ]
    if place:
        claims["P19"] = [{"mainsnak": {"datavalue": {"value": {"id": place}}}}]
    if country:
        claims["P27"] = [{"mainsnak": {"datavalue": {"value": {"id": country}}}}]
    return {"labels": {"es": {"value": label}}, "claims": claims}


def test_personal_data_prefers_wikipedia_birthplace():
    assert parse_wikipedia_personal(WIKITEXT) == {
        "birth_date": "1979-02-06",
        "birth_place": "Granollers",
        "nationality": "española",
    }


def test_personal_data_without_infobox_is_all_null():
    assert parse_wikipedia_personal("Sin ficha") == {
        "birth_date": None,
        "birth_place": None,
        "nationality": None,
    }


def test_career_parses_player_and_coach_tables_and_merges_contiguous_rows():
    career = parse_wikipedia_career(WIKITEXT)

    players = [entry for entry in career if entry["role"] == "player"]
    coaches = [entry for entry in career if entry["role"] == "coach"]

    assert [(entry["club"], entry["from"], entry["to"]) for entry in players] == [
        ("FC Barcelona B", "1998", "2000"),
        ("CD Tenerife", "2000", "2007"),
        ("CE Sabadell", "2014", "2015"),
    ]
    # Las filas contiguas del mismo club suman partidos y goles.
    tenerife = players[1]
    assert (tenerife["appearances"], tenerife["goals"]) == (137, 16)
    assert [(entry["club"], entry["from"], entry["to"]) for entry in coaches] == [
        ("EC Granollers", "2016", "2016"),
        ("Deportivo de La Coruña", "2025", None),
    ]


def test_career_ignores_unknown_or_empty_rows():
    wikitext = """== Como jugador ==
{| class="wikitable"
|-
| [[Club Sin Años]] || sin fecha || 10 || 1
|-
| {{ESP}} || 2000–2001 || 5 || 0
|}
"""
    assert parse_wikipedia_career(wikitext) == []


def test_official_staff_keeps_order_and_skips_head_coach_duplicates():
    staff = parse_official_staff(STAFF_HTML)

    assert [(member["name"], member["role"]) for member in staff] == [
        ("Antonio Hidalgo", "head_coach"),
        ("Ignasi Salafranca", "assistant_coach"),
        ("Alberto Casal", "goalkeeping_coach"),
        ("Carlos Casal", "fitness_coach"),
        ("Ignasi Salafranca", "physiotherapist"),
    ]


def test_official_staff_without_the_official_section_is_empty():
    assert parse_official_staff("<html><body>Otra cosa</body></html>") == []


def test_official_photo_strips_the_social_crop():
    assert (
        parse_official_photo(PROFILE_HTML, "Antonio Hidalgo")
        == "https://scdn.ovixia.app/images/entrenador.jpg"
    )


def test_official_photo_falls_back_to_a_jpg_on_the_cdn():
    html = (
        '<html><body><img src="https://scdn.ovixia.app/images/foto.jpg?w=800&amp;x=1">'
        "</body></html>"
    )
    assert parse_official_photo(html, "Antonio Hidalgo") == (
        "https://scdn.ovixia.app/images/foto.jpg?w=800&x=1"
    )


def test_official_photo_ignores_logos_and_unknown_hosts():
    html = '<meta property="og:image" content="https://example.org/logo.png">'
    assert parse_official_photo(html, "Antonio Hidalgo") is None


def test_fetch_coach_cross_checks_wikidata_wikipedia_and_the_club():
    wikidata = FakeWikidata(
        {
            "Q602465": entity(
                "Antonio Hidalgo", birth="1979-02-06", place="Q1", country="Q2"
            ),
            "Q1": entity("Canovelles"),
            "Q2": entity("España"),
        }
    )
    http = FakeHttp(
        pages={
            "https://www.rcdeportivo.es/es/depor": STAFF_HTML,
            "https://www.rcdeportivo.es/es/primer-equipo/entrenador": PROFILE_HTML,
        }
    )

    data = fetch_coach(
        http,  # type: ignore[arg-type]
        wikidata=wikidata,  # type: ignore[arg-type]
        official_team_url="https://www.rcdeportivo.es/es/depor",
        official_profile_url="https://www.rcdeportivo.es/es/primer-equipo/entrenador",
    )

    assert data["name"] == "Antonio Hidalgo"
    assert data["birth_date"] == "1979-02-06"
    # Wikipedia manda sobre el lugar de nacimiento de Wikidata; la nacionalidad
    # viene de Wikidata porque es un dato estructurado.
    assert data["birth_place"] == "Granollers"
    assert data["nationality"] == "España"
    assert data["since"] == "2025"
    assert data["photo_url"] == "https://scdn.ovixia.app/images/entrenador.jpg"
    assert [entry["club"] for entry in data["career"] if entry["role"] == "coach"] == [
        "EC Granollers",
        "Deportivo de La Coruña",
    ]
    assert len(data["staff"]) == 5


def test_fetch_coach_survives_a_blocked_official_page():
    class BlockedHttp(FakeHttp):
        def get(self, url: str) -> SimpleNamespace:
            raise SourceError(url)

    data = fetch_coach(
        BlockedHttp(),  # type: ignore[arg-type]
        wikidata=FakeWikidata({"Q602465": entity("Antonio Hidalgo")}),  # type: ignore[arg-type]
        official_team_url="https://example.org/equipo",
        official_profile_url="https://example.org/foto",
    )

    assert data["photo_url"] is None
    assert data["staff"] == []


def coach_yaml(tmp_path, text: str):
    path = tmp_path / "coach.yml"
    path.write_text(text, encoding="utf-8")
    return path


def test_load_coach_reads_the_manual_file_and_requires_a_source(tmp_path):
    path = coach_yaml(
        tmp_path,
        "coach:\n"
        "  name: Antonio Hidalgo\n"
        "  birth_date: 1979-02-06\n"
        "  source: Wikipedia\n"
        "  career:\n"
        "    - {club: Deportivo, role: coach, from: 2025}\n",
    )
    extra = load_coach(path)
    assert extra is not None
    assert extra.birth_date == "1979-02-06"
    assert extra.career[0].role == "coach"

    with pytest.raises(ExtrasError, match="source"):
        load_coach(coach_yaml(tmp_path, "coach:\n  birth_date: 1979-02-06\n"))


def test_load_coach_rejects_unknown_keys_and_bad_dates(tmp_path):
    assert load_coach(tmp_path / "nope.yml") is None
    assert load_coach(coach_yaml(tmp_path, "coach:\n")) is None
    with pytest.raises(ExtrasError):
        load_coach(coach_yaml(tmp_path, "otra: 1\n"))
    with pytest.raises(ExtrasError):
        load_coach(
            coach_yaml(
                tmp_path,
                "coach:\n  birth_date: mañana\n  source: Wikipedia\n",
            )
        )


def test_apply_coach_fills_gaps_but_keeps_the_api_name_and_nationality():
    squad = m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[],
        coach=m.Coach(name="Nombre API", nationality="Nacionalidad API"),
    )
    extra = CoachExtra.model_validate(
        {
            "name": "Otro nombre",
            "nationality": "Otra nacionalidad",
            "birth_date": "1979-02-06",
            "birth_place": "Granollers",
            "photo_url": "https://cdn.example.org/foto.jpg",
            "since": "2025",
            "contract_until": "2027-06-30",
            "career": [
                {
                    "club": "Deportivo de La Coruña",
                    "role": "coach",
                    "from": "2025",
                }
            ],
            "staff": [{"name": "Ignasi Salafranca", "role": "assistant_coach"}],
            "source": "Wikipedia",
            "confidence": "cross_checked",
        }
    )

    out = apply_coach(squad, extra)
    coach = out.coach

    assert coach is not None
    assert (coach.name, coach.nationality) == ("Nombre API", "Nacionalidad API")
    assert (coach.birth_date, coach.birth_place) == ("1979-02-06", "Granollers")
    assert coach.photo_url == "https://cdn.example.org/foto.jpg"
    assert (coach.since, coach.contract_until) == ("2025", "2027-06-30")
    assert [(entry.club, entry.role) for entry in coach.career] == [
        ("Deportivo de La Coruña", "coach")
    ]
    assert [(member.name, member.role) for member in coach.staff] == [
        ("Ignasi Salafranca", "assistant_coach")
    ]
    assert coach.provenance["birthDate"].source == "Wikipedia"
    assert coach.provenance["career"].confidence == "cross_checked"
    assert "name" not in coach.provenance


def test_apply_coach_is_idempotent_and_does_not_overwrite_existing_data():
    squad = m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[],
        coach=m.Coach(
            name="Antonio Hidalgo",
            birth_place="Granollers",
            career=[m.CareerEntry(club="Deportivo", role="coach", from_="2025")],
            staff=[m.StaffMember(name="Segundo", role="assistant_coach")],
        ),
    )
    extra = CoachExtra.model_validate(
        {
            "name": "Otro",
            "birth_place": "Canovelles",
            "career": [{"club": "Otro club", "role": "coach", "from": "2020"}],
            "staff": [{"name": "Otra persona", "role": "analyst"}],
            "source": "Wikipedia",
        }
    )

    once = apply_coach(squad, extra)
    twice = apply_coach(once, extra)

    assert twice is once
    assert twice.coach is not None
    assert twice.coach.birth_place == "Granollers"
    assert [entry.club for entry in twice.coach.career] == ["Deportivo"]
    assert [member.name for member in twice.coach.staff] == ["Segundo"]


def test_apply_coach_without_extra_returns_the_same_squad():
    squad = m.Squad(updated_at="2026-10-20T10:00:00Z", players=[])
    assert apply_coach(squad, None) is squad


def test_reset_coach_removes_only_enriched_fields_and_provenance():
    provenance = {
        "birthDate": m.Provenance(source="Wikipedia", confidence="cross_checked"),
        "birthPlace": m.Provenance(source="Wikipedia", confidence="cross_checked"),
        "photoUrl": m.Provenance(source="Web oficial", confidence="single_source"),
        "since": m.Provenance(source="Wikipedia", confidence="cross_checked"),
        "contractUntil": m.Provenance(source="Wikipedia", confidence="cross_checked"),
        "career": m.Provenance(source="Wikipedia", confidence="cross_checked"),
        "staff": m.Provenance(source="Web oficial", confidence="single_source"),
        "name": m.Provenance(source="Wikipedia", confidence="cross_checked"),
    }
    squad = m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[],
        coach=m.Coach(
            name="Antonio Hidalgo",
            nationality="España",
            birth_date="1979-02-06",
            birth_place="Granollers",
            photo_url="https://cdn.example.org/foto.jpg",
            since="2025",
            contract_until="2027-06-30",
            career=[m.CareerEntry(club="Deportivo", role="coach", from_="2025")],
            staff=[m.StaffMember(name="Segundo", role="assistant_coach")],
            provenance=provenance,
        ),
    )

    out = reset_coach(squad)
    coach = out.coach

    assert coach is not None
    assert coach.name == "Antonio Hidalgo"
    assert coach.nationality == "España"
    assert coach.birth_date is None
    assert coach.birth_place is None
    assert coach.photo_url is None
    assert coach.since is None
    assert coach.contract_until is None
    assert coach.career == []
    assert coach.staff == []
    assert set(coach.provenance) == {"name"}


def test_reset_coach_understands_legacy_snake_case_provenance():
    squad = m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[],
        coach=m.Coach(
            birth_date="1979-02-06",
            provenance={"birth_date": m.Provenance(source="Wikipedia", confidence="cross_checked")},
        ),
    )

    coach = reset_coach(squad).coach
    assert coach is not None
    assert coach.birth_date is None
    assert coach.provenance == {}


def test_reset_coach_is_a_noop_without_coach_or_provenance():
    empty = m.Squad(updated_at="2026-10-20T10:00:00Z", players=[])
    assert reset_coach(empty) is empty

    plain = m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[],
        coach=m.Coach(name="Antonio Hidalgo", birth_date="1979-02-06"),
    )
    assert reset_coach(plain) is plain
