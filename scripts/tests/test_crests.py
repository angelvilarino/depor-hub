"""Resolución de escudos: fixtures, Wikidata/Commons, filiales, overrides y caché."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

import yaml

from depor_hub.enrich.commons import CommonsClient
from depor_hub.enrich.crests import (
    CrestResolver,
    choose_entity,
    club_key,
    load_fixture_crests,
    reserve_info,
)
from depor_hub.enrich.wikidata import WikidataClient


def fixtures_file(tmp_path: Path, teams: list[tuple[str, str]]) -> Path:
    matches = [
        {
            "home": {"name": name, "shortName": None, "crestUrl": url},
            "away": {"name": "Depor", "shortName": None, "crestUrl": None},
        }
        for name, url in teams
    ]
    path = tmp_path / "fixtures.json"
    path.write_text(json.dumps({"matches": matches}), encoding="utf-8")
    return path


def overrides_file(tmp_path: Path, clubs: dict[str, str]) -> Path:
    path = tmp_path / "club_crests.yml"
    path.write_text(yaml.safe_dump({"clubs": clubs}), encoding="utf-8")
    return path


def claim(value: object, rank: str = "normal") -> dict:
    return {"rank": rank, "mainsnak": {"snaktype": "value", "datavalue": {"value": value}}}


def qid(value: str) -> dict:
    return {"id": value}


def entity(
    qid_value: str,
    label: str,
    *,
    crest: str | None = None,
    parent: str | None = None,
) -> dict:
    claims: dict[str, list[dict]] = {"P31": [claim(qid("Q476028"))]}
    if crest:
        claims["P154"] = [claim(crest)]
    if parent:
        claims["P749"] = [claim(qid(parent))]
    return {"id": qid_value, "labels": {"es": {"value": label}}, "claims": claims}


class FakeHttp:
    def __init__(
        self,
        *,
        search: dict[str, list[str]] | None = None,
        entities: dict[str, dict] | None = None,
        sizes: dict[str, tuple[int, int]] | None = None,
    ) -> None:
        self.search = search or {}
        self.entities = entities or {}
        self.sizes = sizes or {}
        self.calls: list[str] = []

    def get_json(self, url: str) -> dict:
        self.calls.append(url)
        parsed = urlparse(url)
        if "wbsearchentities" in url:
            query = parse_qs(parsed.query).get("search", [""])[0]
            return {"search": [{"id": item} for item in self.search.get(query, [])]}
        if "wbgetentities" in url:
            ids = parse_qs(parsed.query).get("ids", [""])[0].split("|")
            return {"entities": {item: self.entities[item] for item in ids if item in self.entities}}
        if "commons.wikimedia.org" in url:
            title = parse_qs(parsed.query).get("titles", [""])[0]
            file = title.removeprefix("File:")
            width, height = self.sizes.get(file, (96, 96))
            return {
                "query": {
                    "pages": [
                        {
                            "title": title,
                            "imageinfo": [
                                {
                                    "thumburl": f"https://thumb.example/{quote(file)}/96.png",
                                    "descriptionurl": f"https://commons.wikimedia.org/wiki/{title}",
                                    "thumbwidth": width,
                                    "thumbheight": height,
                                    "extmetadata": {},
                                }
                            ],
                        }
                    ]
                }
            }
        raise AssertionError(f"URL inesperada: {url}")


def wikidata_resolver(tmp_path: Path, http: FakeHttp) -> CrestResolver:
    return CrestResolver(
        http=http,
        wikidata=WikidataClient(http),  # type: ignore[arg-type]
        commons=CommonsClient(http),  # type: ignore[arg-type]
        fixtures_path=tmp_path / "sin-fixtures.json",
        overrides_path=tmp_path / "sin-overrides.yml",
        use_wikidata=True,
    )


def test_fixture_crests_match_names_without_accents_or_suffixes(tmp_path):
    path = fixtures_file(
        tmp_path,
        [
            ("Málaga CF", "https://crests.example/malaga.png"),
            ("FC Barcelona", "https://crests.example/barcelona.png"),
        ],
    )
    index = load_fixture_crests(path)
    assert index.get("Málaga") == "https://crests.example/malaga.png"
    assert index.get("Barcelona") == "https://crests.example/barcelona.png"
    assert index.get("Elche") is None


def test_senior_name_does_not_borrow_a_reserve_fixture(tmp_path):
    path = fixtures_file(tmp_path, [("Barcelona B", "https://crests.example/b.png")])
    index = load_fixture_crests(path)
    assert index.get("Barcelona") is None
    assert index.get("Barcelona B") == "https://crests.example/b.png"


def test_ambiguous_fixture_keys_are_not_guessed(tmp_path):
    path = fixtures_file(
        tmp_path,
        [
            ("SD Logroñés", "https://crests.example/sd.png"),
            ("UD Logroñés", "https://crests.example/ud.png"),
        ],
    )
    resolver = CrestResolver(
        fixtures_path=path,
        overrides_path=tmp_path / "sin-overrides.yml",
        use_wikidata=False,
    )
    assert resolver.resolve("Logroñés") is None
    assert resolver.resolve("SD Logroñés") == "https://crests.example/sd.png"
    assert resolver.resolve("UD Logroñés") == "https://crests.example/ud.png"


def test_manual_override_is_used_but_never_beats_football_data(tmp_path):
    overrides = overrides_file(
        tmp_path,
        {
            "Celta Fortuna": "https://crests.example/override.png",
            "Club Sin Fuente": "https://crests.example/sin-fuente.png",
        },
    )
    resolver = CrestResolver(
        fixtures_path=tmp_path / "sin-fixtures.json",
        overrides_path=overrides,
        use_wikidata=False,
    )
    assert resolver.resolve("Celta Fortuna") == "https://crests.example/override.png"
    assert resolver.resolve("Club Sin Fuente") == "https://crests.example/sin-fuente.png"

    fixtures = fixtures_file(tmp_path, [("Celta Fortuna", "https://crests.example/fd.png")])
    priority = CrestResolver(
        fixtures_path=fixtures,
        overrides_path=overrides,
        use_wikidata=False,
    )
    assert priority.resolve("Celta Fortuna") == "https://crests.example/fd.png"


def test_reserve_teams_resolve_the_parent_crest(tmp_path):
    path = fixtures_file(
        tmp_path,
        [
            ("FC Barcelona", "https://crests.example/barcelona.png"),
            ("Deportivo de A Coruña", "https://crests.example/depor.png"),
            ("Sevilla FC", "https://crests.example/sevilla.png"),
            ("Real Madrid CF", "https://crests.example/madrid.png"),
            ("Atlético de Madrid", "https://crests.example/atleti.png"),
            ("CA Osasuna", "https://crests.example/osasuna.png"),
            ("Real Sociedad de Fútbol", "https://crests.example/real.png"),
            ("RC Celta de Vigo", "https://crests.example/celta.png"),
        ],
    )
    resolver = CrestResolver(
        fixtures_path=path,
        overrides_path=tmp_path / "sin-overrides.yml",
        use_wikidata=False,
    )
    assert resolver.resolve("Barcelona B") == "https://crests.example/barcelona.png"
    assert resolver.resolve("Barcelona Atlètic") == "https://crests.example/barcelona.png"
    assert resolver.resolve("Deportivo Fabril") == "https://crests.example/depor.png"
    assert resolver.resolve("Sevilla Atlético") == "https://crests.example/sevilla.png"
    assert resolver.resolve("Real Madrid Castilla") == "https://crests.example/madrid.png"
    assert resolver.resolve("Atlético de Madrid B") == "https://crests.example/atleti.png"
    assert resolver.resolve("Osasuna B") == "https://crests.example/osasuna.png"
    assert resolver.resolve("Real Sociedad B") == "https://crests.example/real.png"
    assert resolver.resolve("Celta de Vigo B") == "https://crests.example/celta.png"


def test_reserve_patterns_live_in_one_place():
    assert reserve_info("Deportivo Fabril").parent == "Deportivo de A Coruña"
    assert reserve_info("Jong PSV").parent == "psv"
    assert reserve_info("PSV II").parent == "psv"
    assert reserve_info("Atlético Sub-19").parent == "atletico"
    assert reserve_info("Atlético U21").parent == "atletico"
    assert reserve_info("Atlético Next Gen").parent == "atletico"
    assert reserve_info("Sevilla Atlético").parent == "sevilla"
    assert reserve_info("Real Madrid Castilla").parent == "real madrid"
    assert reserve_info("Barcelona Juvenil A").parent == "barcelona"
    assert reserve_info("Atlético de Madrid") is None
    assert reserve_info("Athletic Club") is None


def test_wikidata_p154_and_commons_are_used_when_unambiguous(tmp_path):
    http = FakeHttp(
        search={"Club Uno": ["Q1"]},
        entities={
            "Q1": entity("Q1", "Club Uno", crest="Uno.svg"),
        },
    )
    resolver = wikidata_resolver(tmp_path, http)
    assert resolver.resolve("Club Uno") == "https://thumb.example/Uno.svg/96.png"


def test_wide_p154_image_is_rejected_instead_of_used_as_crest(tmp_path):
    http = FakeHttp(
        search={"Club Foto": ["Q1"]},
        entities={"Q1": entity("Q1", "Club Foto", crest="Partido.jpg")},
        sizes={"Partido.jpg": (96, 50)},
    )
    resolver = wikidata_resolver(tmp_path, http)
    assert resolver.resolve("Club Foto") is None

    square = FakeHttp(
        search={"Club Escudo": ["Q2"]},
        entities={"Q2": entity("Q2", "Club Escudo", crest="Escudo.png")},
        sizes={"Escudo.png": (96, 115)},
    )
    assert wikidata_resolver(tmp_path, square).resolve("Club Escudo") == (
        "https://thumb.example/Escudo.png/96.png"
    )


def test_senior_club_without_p154_does_not_borrow_from_a_parent(tmp_path):
    http = FakeHttp(
        search={"Club Senior": ["Q1"], "Club Reserva B": ["Q3"]},
        entities={
            "Q1": entity("Q1", "Club Senior", parent="Q2"),
            "Q2": entity("Q2", "Club Matriz", crest="Matriz.svg"),
            "Q3": entity("Q3", "Club Reserva B", parent="Q2"),
        },
    )
    resolver = wikidata_resolver(tmp_path, http)
    assert resolver.resolve("Club Senior") is None
    assert resolver.resolve("Club Reserva B") == "https://thumb.example/Matriz.svg/96.png"


def test_ambiguous_wikidata_entities_return_none(tmp_path):
    http = FakeHttp(
        search={"Club Ambiguo": ["Q1", "Q2"]},
        entities={
            "Q1": entity("Q1", "Club Ambiguo Norte", crest="Norte.svg"),
            "Q2": entity("Q2", "Club Ambiguo Sur", crest="Sur.svg"),
        },
    )
    resolver = wikidata_resolver(tmp_path, http)
    assert choose_entity("Club Ambiguo", http.entities) is None
    assert resolver.resolve("Club Ambiguo") is None


def test_resolution_cache_is_idempotent_and_keeps_negatives(tmp_path):
    fixtures = fixtures_file(tmp_path, [("Málaga CF", "https://crests.example/malaga.png")])
    cache = tmp_path / "crests.json"
    resolver = CrestResolver(
        fixtures_path=fixtures,
        overrides_path=tmp_path / "sin-overrides.yml",
        cache_path=cache,
        use_wikidata=False,
    )
    assert resolver.resolve("Málaga") == "https://crests.example/malaga.png"
    assert resolver.resolve("Club Desconocido") is None
    resolver.save()
    first = cache.read_text(encoding="utf-8")
    resolver.save()
    assert cache.read_text(encoding="utf-8") == first

    # Sin fixtures ni overrides, la segunda pasada solo puede vivir de la caché.
    offline = CrestResolver(
        fixtures_path=tmp_path / "sin-fixtures.json",
        overrides_path=tmp_path / "sin-overrides.yml",
        cache_path=cache,
        use_wikidata=False,
    )
    assert offline.resolve("Málaga") == "https://crests.example/malaga.png"
    assert offline.resolve("Club Desconocido") is None


def test_club_key_keeps_identity_words():
    assert club_key("RC Deportivo La Coruña") == "deportivo coruna"
    assert club_key("Deportivo de A Coruña") == "deportivo coruna"
    assert club_key("Real Madrid CF") == "real madrid"
    assert club_key("Atlético de Madrid") == "atletico madrid"
    assert club_key("Málaga CF") == "malaga"
