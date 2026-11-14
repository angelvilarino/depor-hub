import io
import json
from pathlib import Path

import pytest
from PIL import Image
from pydantic import ValidationError

from depor_hub import models as m
from depor_hub.club import (
    kits_coverage,
    load_club,
    load_image_sources,
    normalize_image,
    publish_club,
    read_lyrics,
    season_start,
    sorted_seasons,
)

ROOT = Path(__file__).resolve().parents[2]
MANUAL = ROOT / "data" / "manual"
NOW = "2026-11-01T10:00:00Z"


def real_club() -> m.Club:
    return load_club(MANUAL / "club.yml", MANUAL / "himnos", MANUAL, NOW)


def test_real_club_validates_and_publishes_expected_sections():
    club = real_club()
    assert club.identity.official_name.startswith("Real Club Deportivo")
    assert club.identity.founded_year == 1906
    assert len(club.anthems) == 3
    assert len(club.crests) == 14
    assert len(club.kits) == 42
    assert club.stadium is not None
    assert club.museum is not None
    assert club.training_center is not None
    assert club.board is not None
    assert club.sponsors is not None
    assert club.titles
    assert club.rivalries
    assert club.links.website == "https://www.rcdeportivo.es"


def test_capacity_is_official_total_and_does_not_double_count_areas():
    capacity = real_club().stadium.capacity
    assert capacity is not None
    assert capacity.total == 32490
    assert capacity.total == sum(zone.seats for zone in capacity.breakdown)
    assert {zone.zone: zone.seats for zone in capacity.breakdown} == {
        "Localidades sentadas": 32490,
    }
    assert capacity.source_url == "https://www.rcdeportivo.es/es/estadio-abanca-riazor"
    assert capacity.confidence == "cross_checked"
    assert capacity.status == "verified"


def test_capacity_contract_rejects_a_broken_breakdown():
    with pytest.raises(ValidationError, match="suma del desglose"):
        m.Capacity(total=10, breakdown=[m.CapacityZone(zone="Gradas", seats=9)])


def test_added_capacity_and_museum_fields_keep_legacy_defaults():
    capacity = m.Capacity(total=0)
    assert capacity.source_url is None
    assert capacity.confidence == "single_source"
    assert capacity.status == "pending_verification"
    assert m.Museum().media == []


def test_anthem_lyrics_only_publish_the_block_after_letra():
    voa = next(anthem for anthem in real_club().anthems if anthem.id == "voa")
    assert voa.lyrics is not None
    assert voa.lyrics.startswith("Voa\nVoa")
    assert "Créditos" not in voa.lyrics
    assert "Xoel López: voz principal" not in voa.lyrics
    assert voa.lyrics.rstrip().endswith("POR!")


def test_anthem_credits_are_structured_not_dumped_in_the_lyrics():
    voa = next(anthem for anthem in real_club().anthems if anthem.id == "voa")
    roles = [credit.role for credit in voa.credits]
    assert roles == ["musicians", "production", "recording", "technicians"]
    assert any("Xoel López" in name for name in voa.credits[0].names)
    assert voa.authors == ["Xoel López"]


def test_anthems_without_marker_use_the_whole_file():
    anthems = {anthem.id: anthem for anthem in real_club().anthems}
    assert anthems["fillos-de-breogan"].lyrics.startswith("Penso en ti")
    assert anthems["rock-del-deportivo"].lyrics.startswith("Vamos !!!")


def test_read_lyrics_ignores_comments_and_empty_files(tmp_path: Path):
    commented = tmp_path / "comentado.txt"
    commented.write_text("# solo un comentario\n\n# otro\n", encoding="utf-8")
    assert read_lyrics(commented) is None
    assert read_lyrics(tmp_path / "no-existe.txt") is None

    with_marker = tmp_path / "himno.txt"
    with_marker.write_text("Créditos\nAutor: alguien\n\nLetra\n\nEstrofa uno\n\nEstrofa dos\n", encoding="utf-8")
    assert read_lyrics(with_marker) == "Estrofa uno\n\nEstrofa dos"


def test_contract_publishes_provenance_only_for_capacity():
    payload = real_club().model_dump(by_alias=True, mode="json")

    def keys(value):
        if isinstance(value, dict):
            for key, child in value.items():
                yield key
                yield from keys(child)
        elif isinstance(value, list):
            for child in value:
                yield from keys(child)

    capacity = payload["stadium"]["capacity"]
    assert capacity["sourceUrl"] == "https://www.rcdeportivo.es/es/estadio-abanca-riazor"
    assert capacity["confidence"] == "cross_checked"
    assert capacity["status"] == "verified"
    capacity.pop("sourceUrl")
    capacity.pop("confidence")
    capacity.pop("status")

    forbidden = {"source", "confidence", "verification", "verified", "provenance"}
    assert forbidden.isdisjoint(set(keys(payload)))


def test_publish_club_is_idempotent_and_keeps_the_previous_timestamp(tmp_path: Path):
    first = publish_club(MANUAL / "club.yml", MANUAL / "himnos", tmp_path, MANUAL, now=NOW)
    assert first[0] is True
    target = tmp_path / "club.json"
    original = target.read_text(encoding="utf-8")

    second = publish_club(
        MANUAL / "club.yml", MANUAL / "himnos", tmp_path, MANUAL, now="2026-12-01T00:00:00Z"
    )
    assert second[0] is False
    assert target.read_text(encoding="utf-8") == original
    assert json.loads(original)["updatedAt"] == NOW


def test_publish_club_rewrites_when_the_content_changes(tmp_path: Path):
    publish_club(MANUAL / "club.yml", MANUAL / "himnos", tmp_path, MANUAL, now=NOW)
    source = tmp_path / "club.yml"
    source.write_text(
        (MANUAL / "club.yml").read_text(encoding="utf-8").replace(
            "short_name: RC Deportivo", "short_name: Dépor"
        ),
        encoding="utf-8",
    )
    changed, club = publish_club(
        source, MANUAL / "himnos", tmp_path, MANUAL, now="2026-12-01T00:00:00Z"
    )
    assert changed is True
    assert club.identity.short_name == "Dépor"
    assert json.loads((tmp_path / "club.json").read_text(encoding="utf-8"))["updatedAt"] == (
        "2026-12-01T00:00:00Z"
    )


def test_club_summaries_follow_the_canonical_titles_and_rivalries(tmp_path: Path):
    """D1-09: club.json no mantiene una segunda lista de títulos/rivales."""
    titles_path = ROOT / "data" / "public" / "v1" / "titles.json"
    rivalries_path = ROOT / "data" / "public" / "v1" / "rivalries.json"
    changed, club = publish_club(
        MANUAL / "club.yml",
        MANUAL / "himnos",
        tmp_path,
        MANUAL,
        now=NOW,
        titles_path=titles_path,
        rivalries_path=rivalries_path,
    )

    editions = json.loads(titles_path.read_text(encoding="utf-8"))["editions"]
    expected_titles: dict[str, list[int]] = {}
    for edition in editions:
        expected_titles.setdefault(edition["competition"], []).append(edition["year"])

    assert changed is True
    assert [(title.competition, title.years) for title in club.titles] == [
        (competition, sorted(years)) for competition, years in expected_titles.items()
    ]
    assert [rivalry.rival for rivalry in club.rivalries] == [
        rivalry["rival"]
        for rivalry in json.loads(rivalries_path.read_text(encoding="utf-8"))["rivalries"]
    ]


def test_club_summaries_fall_back_to_yaml_when_documents_are_missing(tmp_path: Path):
    _, club = publish_club(
        MANUAL / "club.yml",
        MANUAL / "himnos",
        tmp_path,
        MANUAL,
        now=NOW,
        titles_path=tmp_path / "missing-titles.json",
        rivalries_path=tmp_path / "missing-rivalries.json",
    )
    assert club.titles
    assert [rivalry.rival for rivalry in club.rivalries] == ["RC Celta de Vigo"]


def test_kits_are_sorted_by_season_and_groupable_by_decade():
    club = real_club()
    seasons = sorted_seasons(club.kits)
    starts = [season_start(season.season) for season in seasons]
    assert starts == sorted(starts)
    assert seasons[0].season == "1985-86"
    assert seasons[-1].season == "2026-27"
    assert seasons[-1].kits[0].manufacturer == "Nike"
    assert seasons[-1].kits[0].chest_sponsor == "Estrella Galicia"
    assert seasons[-1].kits[0].image == "img/club/equipaciones/2026-27-home.jpg"


def test_season_contract_rejects_invalid_format():
    with pytest.raises(ValidationError):
        m.SeasonKits(season="2026-2027", kits=[])


def test_every_declared_image_has_a_local_source_and_a_file():
    club = real_club()
    sources = load_image_sources(MANUAL / "club_images.yml")
    declared = {crest.image for crest in club.crests if crest.image}
    declared |= {kit.image for season in club.kits for kit in season.kits if kit.image}
    assert declared == set(sources)
    for relative_path in declared:
        assert (ROOT / "data" / "public" / "v1" / relative_path).exists()


def test_coverage_report_lists_the_current_season():
    report = kits_coverage(real_club())
    assert "Temporadas documentadas: 42" in report
    assert "Fotos verificadas con crédito visible: 3" in report
    assert "Ilustraciones de respaldo SVG: 41" in report
    assert "| 1987-88 | home | Gilcor / Rafrei | — | foto verificada |" in report
    assert "| 1999-00 | home | Adidas | Feiraco | foto verificada |" in report
    assert "| 2026-27 | home | Nike | Estrella Galicia | foto verificada |" in report
    assert "| 2026-27 | away | Nike | Estrella Galicia | ilustración SVG |" in report


def test_historical_kit_photos_have_verified_sources_and_svg_fallbacks():
    club = real_club()
    expected = {
        "1987-88": "https://commons.wikimedia.org/wiki/File:Camisetavicenteceleiro.jpg",
        "1999-00": "https://commons.wikimedia.org/wiki/File:Camisetadjalminhaliga9900.jpg",
    }
    for season, source_url in expected.items():
        kit = next(
            item
            for item in next(row for row in club.kits if row.season == season).kits
            if item.type == "home"
        )
        assert kit.media is not None
        assert kit.media.status == "verified"
        assert kit.media.origin == "commons"
        assert kit.media.license == "CC0"
        assert kit.media.author == "Magno2002"
        assert kit.media.source_url == source_url
        assert kit.image is not None and kit.image.endswith(".svg")


def test_normalize_crest_trims_padding_and_keeps_alpha():
    image = Image.new("RGBA", (80, 60), (0, 0, 0, 0))
    image.paste((200, 30, 30, 255), (30, 20, 50, 40))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    normalized = Image.open(io.BytesIO(normalize_image("img/club/escudos/test.png", buffer.getvalue())))
    assert normalized.mode == "RGBA"
    assert normalized.size == (20, 20)
    assert normalized.getchannel("A").getextrema()[0] == 255


def test_normalize_kit_flattens_to_jpeg_and_limits_size():
    image = Image.new("RGBA", (1200, 1600), (255, 255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    data = normalize_image("img/club/equipaciones/test.jpg", buffer.getvalue())
    normalized = Image.open(io.BytesIO(data))
    assert normalized.format == "JPEG"
    assert max(normalized.size) <= 900


def test_normalize_svg_is_passed_through():
    data = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
    assert normalize_image("img/club/escudos/test.svg", data) == data
    with pytest.raises(ValueError):
        normalize_image("img/club/escudos/test.svg", b"no es un svg")
