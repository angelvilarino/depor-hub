import io
import json
from pathlib import Path

import httpx
from PIL import Image

from depor_hub import models as m
from depor_hub.club_extra import (
    ProposedTitle,
    build_rivalries,
    load_rivalries,
    load_titles,
    parse_bdfutbol_titles,
    probe_media,
    publish_rivalries,
    publish_titles,
    titles_proposal,
)
from depor_hub.enrich.http import FetchResult, PoliteClient

ROOT = Path(__file__).resolve().parents[2]
MANUAL = ROOT / "data" / "manual"
NOW = "2026-11-06T10:00:00Z"


def test_real_titles_and_rivalries_validate():
    titles = load_titles(MANUAL / "titles.yml", NOW)
    rivalries = load_rivalries(MANUAL / "rivalries.yml", NOW)
    assert len(titles.editions) == 21
    assert len(rivalries.rivalries) == 6
    assert {rivalry.rival for rivalry in rivalries.rivalries} >= {
        "RC Celta de Vigo",
        "SD Compostela",
        "Real Oviedo",
        "Real Sporting de Gijón",
        "Racing Club de Ferrol",
        "CD Lugo",
    }
    assert all(rivalry.provenance.source for rivalry in rivalries.rivalries)
    celta = next(item for item in rivalries.rivalries if item.rival == "RC Celta de Vigo")
    assert (celta.tier, celta.status) == ("derbi", "verified")
    ferrol = next(
        item for item in rivalries.rivalries if item.rival == "Racing Club de Ferrol"
    )
    assert ferrol.tier == "derbi"


def test_titles_include_the_two_copa_finals_with_source():
    titles = load_titles(MANUAL / "titles.yml", NOW)
    copas = [edition for edition in titles.editions if edition.competition == "Copa del Rey"]
    assert {edition.year for edition in copas} == {1995, 2002}
    assert all(edition.final_match is not None for edition in copas)
    assert all(edition.final_match.source_url for edition in copas)
    assert {edition.final_match.home_goals for edition in copas} == {1, 2}
    assert {edition.status for edition in copas} == {"verified"}
    assert {edition.coach for edition in copas} == {"Arsenio Iglesias", "Javier Irureta"}
    assert {edition.final_match.referee for edition in copas} == {
        "José María García-Aranda",
        "Manuel Mejuto González",
    }
    assert {
        (scorer.player, scorer.minute, scorer.team)
        for edition in copas
        for scorer in edition.final_match.goal_scorers
    } >= {
        ("Javier Manjarín", 35, "RC Deportivo de La Coruña"),
        ("Predrag Mijatović", 70, "Valencia CF"),
        ("Alfredo Santaelena", 81, "RC Deportivo de La Coruña"),
        ("Sergio González", 6, "RC Deportivo de La Coruña"),
        ("Diego Tristán", 37, "RC Deportivo de La Coruña"),
        ("Raúl González", 58, "Real Madrid CF"),
    }


def test_publish_titles_is_idempotent(tmp_path: Path):
    first = publish_titles(MANUAL / "titles.yml", tmp_path, NOW)
    assert first[0] is True
    original = (tmp_path / "titles.json").read_text(encoding="utf-8")
    second = publish_titles(MANUAL / "titles.yml", tmp_path, "2026-12-01T00:00:00Z")
    assert second[0] is False
    assert (tmp_path / "titles.json").read_text(encoding="utf-8") == original
    assert json.loads(original)["updatedAt"] == NOW


def test_parse_bdfutbol_titles_maps_team_titles_and_skips_awards():
    html = """
    <table class="taula_estil taula-palmares">
      <tr><td></td><td><span><b>Liga</b></span><span class="ml-2">1</span></td>
          <td><a href="../t/t1999-0013.html">1999-00</a></td></tr>
      <tr><td></td><td><span><b>Liga 2a división</b></span><span>5</span></td>
          <td><a href="../t/t2011-1213.html">2011-12</a></td></tr>
      <tr><td></td><td><span><b>Copa del Rey</b></span><span>2</span></td>
          <td><a href="../t/t1994-9513.html">1994-95</a>
              <a href="../t/t2001-0213.html">2001-02</a></td></tr>
      <tr><td></td><td><span><b>Pichichi</b></span><span>3</span></td>
          <td><a href="../t/t2001-0213.html">2001-02</a></td></tr>
      <tr><td></td><td><span><b>Supercopa</b></span><span>3</span></td>
          <td><a href="../t/t1995-9613.html">1995-96</a>
              <a href="../t/t2000-0113.html">2000-01</a></td></tr>
    </table>
    """
    proposed = parse_bdfutbol_titles(html)
    assert {(item.competition, item.year) for item in proposed} == {
        ("Primera División", 2000),
        ("Segunda División", 2012),
        ("Copa del Rey", 1995),
        ("Copa del Rey", 2002),
        ("Supercopa de España", 1995),
        ("Supercopa de España", 2000),
    }


def test_titles_proposal_reports_conflicts_without_applying():
    curated = m.Titles(
        updatedAt=NOW,
        editions=[
            m.TitleEdition(
                competition="Copa del Rey",
                year=1995,
                provenance=m.Provenance(source="manual"),
            )
        ],
    )
    proposed = [
        ProposedTitle("Copa del Rey", 1995, "1994-95"),
        ProposedTitle("Copa del Rey", 2002, "2001-02"),
        ProposedTitle("Liga", 2000, "1999-00"),
    ]
    proposal = titles_proposal(curated, proposed)
    assert proposal["conflicts"] == [
        {
            "competition": "Copa del Rey",
            "curated_years": [1995],
            "proposed_years": [1995, 2002],
            "seasons": ["1994-95", "2001-02"],
        }
    ]
    assert proposal["only_in_source"][0]["competition"] == "Liga"


class StubHttp:
    def __init__(self, html: str):
        self.html = html

    def get(self, url: str, **_: object) -> FetchResult:
        return FetchResult(url=url, final_url=url, status=200, text=self.html)


H2H_HTML = """
<table>
  <tr><td>Balance</td></tr>
</table>
<div id='valorpj'>10</div><div id='valorpg'>5</div><div id='valorpp'>3</div>
<div id='valorpe'>2</div><div id='valorgf'>15</div><div id='valorgc'>10</div>
"""


def test_build_rivalries_fills_head_to_head_from_the_source():
    config = MANUAL / "rivalries.yml"
    rivalries = build_rivalries(config, StubHttp(H2H_HTML), NOW)  # type: ignore[arg-type]
    assert len(rivalries.rivalries) == 6
    # El HTML sintético no trae filas de partidos, pero sí el balance global.
    assert all(rivalry.head_to_head is not None for rivalry in rivalries.rivalries)
    assert rivalries.rivalries[0].head_to_head.played == 10


def test_publish_rivalries_is_idempotent(tmp_path: Path):
    first = publish_rivalries(
        MANUAL / "rivalries.yml", tmp_path, StubHttp(H2H_HTML), NOW  # type: ignore[arg-type]
    )
    assert first[0] is True
    original = (tmp_path / "rivalries.json").read_text(encoding="utf-8")
    second = publish_rivalries(
        MANUAL / "rivalries.yml",
        tmp_path,
        StubHttp(H2H_HTML),  # type: ignore[arg-type]
        "2026-12-01T00:00:00Z",
    )
    assert second[0] is False
    assert (tmp_path / "rivalries.json").read_text(encoding="utf-8") == original


def test_publish_rivalries_keeps_the_previous_file_without_balance(tmp_path: Path):
    first = publish_rivalries(
        MANUAL / "rivalries.yml", tmp_path, StubHttp(H2H_HTML), NOW  # type: ignore[arg-type]
    )
    assert first[0] is True
    original = (tmp_path / "rivalries.json").read_text(encoding="utf-8")

    # Una pasada sin tabla de balance no debe borrar el histórico ya verificado.
    second = publish_rivalries(
        MANUAL / "rivalries.yml",
        tmp_path,
        StubHttp("<html></html>"),  # type: ignore[arg-type]
        "2026-12-01T00:00:00Z",
    )
    assert second[0] is False
    assert all(rivalry.head_to_head is not None for rivalry in second[1].rivalries)
    assert (tmp_path / "rivalries.json").read_text(encoding="utf-8") == original


def _png() -> bytes:
    image = Image.new("RGB", (40, 30), (255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_probe_media_reads_dimensions_without_writing_binaries(tmp_path: Path):
    sources = tmp_path / "club_media.yml"
    sources.write_text(
        """
media:
  - id: foto
    url: https://example.org/foto.png
    kind: photo
    origin: commons
    license: CC BY-SA 4.0
    credit: Autoría de ejemplo
""",
        encoding="utf-8",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        if request.url.path == "/foto.png":
            return httpx.Response(200, content=_png(), headers={"Content-Type": "image/png"})
        return httpx.Response(404)

    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        result = probe_media(sources, client, NOW)
    finally:
        client.close()
    assert result["items"][0]["status"] == "ok"
    assert (result["items"][0]["width"], result["items"][0]["height"]) == (40, 30)
    assert not list((tmp_path / "cache").glob("*.png"))


def test_probe_media_reports_a_block_without_retrying(tmp_path: Path):
    sources = tmp_path / "club_media.yml"
    sources.write_text(
        "media:\n  - id: bloqueada\n    url: https://example.org/privada.png\n",
        encoding="utf-8",
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(403)

    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        result = probe_media(sources, client, NOW)
    finally:
        client.close()
    assert result["items"][0]["status"] == "blocked"
    assert "403" in result["items"][0]["error"]
