import io
import json
from pathlib import Path

import httpx
from PIL import Image

from depor_hub import models as m
from depor_hub.club_extra import (
    ProposedTitle,
    build_rivalries,
    build_title_details,
    load_rivalries,
    load_titles,
    parse_bdfutbol_titles,
    parse_final_rows,
    parse_match_page,
    parse_squad,
    parse_wikipedia_final,
    probe_media,
    publish_rivalries,
    publish_titles,
    titles_proposal,
    top_scorers_from_squad,
    write_titles_proposal,
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


def test_title_field_provenance_is_optional_for_legacy_payloads():
    edition = m.TitleEdition(
        competition="Copa del Rey",
        year=2002,
        provenance=m.Provenance(source="legacy"),
    )
    assert edition.coach_provenance is None
    assert edition.squad_provenance is None


def test_titles_include_the_two_copa_finals_with_source():
    titles = load_titles(MANUAL / "titles.yml", NOW)
    copas = [edition for edition in titles.editions if edition.competition == "Copa del Rey"]
    assert {edition.year for edition in copas} == {1995, 2002}
    assert all(edition.final_match is not None for edition in copas)
    assert all(edition.final_match.source_url for edition in copas)
    assert {edition.final_match.home_goals for edition in copas} == {1, 2}
    assert {
        edition.year: edition.final_match.date for edition in copas
    } == {1995: "1995-06-24", 2002: "2002-03-06"}
    assert {edition.status for edition in copas} == {"verified"}
    assert {edition.coach for edition in copas} == {"Arsenio Iglesias", "Javier Irureta"}
    assert all(
        edition.coach_provenance is not None
        and edition.coach_provenance.confidence == "single_source"
        for edition in copas
    )
    assert {
        edition.year: len(edition.squad)
        for edition in copas
    } == {1995: 24, 2002: 31}
    assert all(
        edition.squad_provenance is not None
        and edition.squad_provenance.confidence == "single_source"
        for edition in copas
    )
    assert {edition.final_match.referee for edition in copas} == {
        "José María García-Aranda",
        "Manuel Mejuto González",
    }
    assert {
        (scorer.player, scorer.minute, scorer.team)
        for edition in copas
        for scorer in edition.final_match.goal_scorers
    } >= {
        ("Javier Manjarín", None, "RC Deportivo de La Coruña"),
        ("Predrag Mijatović", None, "Valencia CF"),
        ("Alfredo Santaelena", None, "RC Deportivo de La Coruña"),
        ("Sergio González", 6, "RC Deportivo de La Coruña"),
        ("Diego Tristán", None, "RC Deportivo de La Coruña"),
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
  <tr data-codi1="13" data-codi2="11">
    <td>16/12/2021</td><td>LaLiga</td><td>Jornada 17</td>
    <td>Deportivo de La Coruña</td><td></td>
    <td><div class='resultat-gols '>2</div><div class='resultat-gols'>1</div></td>
    <td></td><td>RC Celta de Vigo</td>
  </tr>
</table>
<div id='valorpj'>10</div><div id='valorpg'>5</div><div id='valorpp'>3</div>
<div id='valorpe'>2</div><div id='valorgf'>15</div><div id='valorgc'>10</div>
"""


def test_build_rivalries_fills_head_to_head_from_the_source():
    config = MANUAL / "rivalries.yml"
    rivalries = build_rivalries(config, StubHttp(H2H_HTML), NOW)  # type: ignore[arg-type]
    assert len(rivalries.rivalries) == 6
    assert all(rivalry.head_to_head is not None for rivalry in rivalries.rivalries)
    assert rivalries.rivalries[0].head_to_head.played == 10
    assert rivalries.rivalries[0].head_to_head.meetings[0].home_goals == 2


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


TITLES_HTML = """
<table class="taula_estil taula-palmares">
  <tr><td></td><td><span><b>Copa del Rey</b></span><span>2</span></td>
      <td><a href="../t/t1994-9513.html">1994-95</a>
          <a href="../t/t2001-0213.html">2001-02</a></td></tr>
</table>
"""


def test_parse_bdfutbol_titles_keeps_the_edition_source_url():
    proposed = parse_bdfutbol_titles(TITLES_HTML)
    assert {(item.year, item.source_url) for item in proposed} == {
        (1995, "https://www.bdfutbol.com/es/t/t1994-9513.html"),
        (2002, "https://www.bdfutbol.com/es/t/t2001-0213.html"),
    }
    proposal = titles_proposal(m.Titles(updatedAt=NOW), proposed)
    assert proposal["proposed"][0]["sources"] == [
        {"year": 1995, "url": "https://www.bdfutbol.com/es/t/t1994-9513.html"},
        {"year": 2002, "url": "https://www.bdfutbol.com/es/t/t2001-0213.html"},
    ]


COMPETITION_HTML = """
<table>
  <tr>
    <td class='text-left'><a href='../p/p.php?id=501547'>Final</a></td>
    <td class='text-left'>06/03/2002</td>
    <td class="text-right"><a href='../p/p.php?id=501547'>Real Madrid</a></td>
    <td class='fit'><a href='../p/p.php?id=501547'><img src="../../i/eg/2h.png" alt=""></a></td>
    <td><a href='../p/p.php?id=501547'>
      <div class='resultat-gols'>1</div><div class='resultat-gols'>2</div>
    </a></td>
    <td class='fit'><a href='../p/p.php?id=501547'><img src="../../i/eg/13.png" alt=""></a></td>
    <td class="text-left"><a href='../p/p.php?id=501547'>Deportivo de La Coruña</a></td>
    <td class="text-left"><a href='../s/2.html'>Santiago Bernabéu</a></td>
    <td></td>
  </tr>
</table>
"""

MATCH_HTML = """
<html><head>
<title>Real Madrid - Deportivo de La Coruña (1 - 2) 06/03/2002 | BDFutbol</title>
</head><body>
<div class="f14">Competición</div>
<div class="f13 font-weight-bold"><a href='../t/t2001-02aCOP.html'>Copa del Rey</a></div>
<div class="f14">Ronda</div>
<div class="f13 font-weight-bold"><a href='../t/t2001-02aCOP.html?ronda=F'>Final</a></div>
<div class="f14">Estadio</div>
<div class="f13 font-weight-bold"><a href='../s/2.html'>Santiago Bernabéu (Madrid)</a></div>
<div class="row pt-1 pt-md-3 pb-2 text-center mb-0">
  <div class="col-6 col-sm f14">
    <div class="text-right">
      <div class="text-blanc"><span class=''>1-2</span>
        <a href="../j/j2296.html">Raúl</a> 58'</div>
    </div>
  </div>
  <div class="col-sm-auto d-none d-sm-block font-blanc f13">
    <a href='../r/r600022.html'><img src='../../i/am/600022.png' alt=''>Mejuto González</a>
  </div>
  <div class="col-6 col-sm f14">
    <div class="text-left">
      <div class="text-blanc"><span>0-1</span>
        <a class="font-blanc" href="../j/j2491.html">Sergio</a> 6'</div>
      <div class="text-blanc"><span>0-2</span>
        <a class="font-blanc" href="../j/j588.html">Tristán</a> 38'</div>
    </div>
  </div>
</div>
<div class="row pt-1 pb-4 d-md-none"></div>
</body></html>
"""

SQUAD_HTML = """
<table id="taulaplantilla">
  <tr>
    <th data-colid='nom'>Nombre</th><th data-colid='dem'>Pos</th>
    <th data-colid='pj'>PJ</th><th data-colid='g'>G</th>
  </tr>
  <tr>
    <td class="text-left"><a href='../j/j820.html'>
      <span class='font-weight-bold mr-2 float-left'>Liaño</span>
      <span class='d-none d-md-block float-left'>Francisco Liaño Fernández</span>
    </a></td>
    <td><div class="fit por"></div></td><td>27</td><td>-22</td>
  </tr>
  <tr>
    <td class="text-left"><a href='../j/j999.html'>
      <span class='font-weight-bold mr-2 float-left'>Bebeto</span>
    </a></td>
    <td><div class="fit dav"></div></td><td>34</td><td>16</td>
  </tr>
</table>
"""

WIKI_FINAL_HTML = """
<script>
{"date":{"wt":"6 March 2002"},"score":{"wt":"1–2"},
 "team1":{"wt":"[[Real Madrid CF|Real Madrid]]"},
 "team2":{"wt":"[[Deportivo de La Coruña|Deportivo La Coruña]]"},
 "goals1":{"wt":"[[Raúl (footballer)|Raúl]] {{goal|58}}"},
 "goals2":{"wt":"[[Sergio (footballer, born 1976)|Sergio]] {{goal|6}}<br>[[Diego Tristán|Tristán]] {{goal|37}}"},
 "stadium":{"wt":"[[Santiago Bernabéu Stadium|Santiago Bernabéu]]"},
 "referee":{"wt":"[[Manuel Mejuto González]] ([[Royal Spanish Football Federation|Spain]])"}}
</script>
"""

SUSPENDED_WIKI_FINAL_HTML = """
<script>
{"date":{"wt":"24 June 1995 (suspended; resumed 27 June 1995)"},
 "score":{"wt":"1–1 (resumed final score 2–1)"},
 "team1score":{"wt":"2"},"team2score":{"wt":"1"},
 "team1":{"wt":"[[Valencia CF|Valencia]]"},
 "team2":{"wt":"[[RC Deportivo de La Coruña|Deportivo La Coruña]]"},
 "goals1":{"wt":"[[Player One]] {{goal|35}}"},
 "goals2":{"wt":"[[Player Two]] {{goal|50}}"},
 "goals1":{"wt":"[[Player One]] {{goal|35}}<br>[[Player Three]] {{goal|83}}"},
 "goals2":{"wt":"[[Player Two]] {{goal|50}}"}}
</script>
"""


def test_parse_final_row_and_match_page():
    rows = parse_final_rows(COMPETITION_HTML)
    assert len(rows) == 1
    assert (rows[0].date, rows[0].home, rows[0].away) == (
        "2002-03-06",
        "Real Madrid",
        "Deportivo de La Coruña",
    )
    assert (rows[0].home_goals, rows[0].away_goals) == (1, 2)
    assert rows[0].source_url == "https://www.bdfutbol.com/es/p/p.php?id=501547"

    final = parse_match_page(MATCH_HTML)
    assert (final.home, final.away) == ("Real Madrid", "Deportivo de La Coruña")
    assert (final.home_goals, final.away_goals) == (1, 2)
    assert final.venue == "Santiago Bernabéu (Madrid)"
    assert final.referee == "Mejuto González"
    assert {
        (scorer.player, scorer.minute, scorer.team) for scorer in final.goal_scorers
    } == {
        ("Raúl", 58, "Real Madrid"),
        ("Sergio", 6, "Deportivo de La Coruña"),
        ("Tristán", 38, "Deportivo de La Coruña"),
    }


def test_parse_squad_ignores_goalkeeper_conceded_goals():
    squad = parse_squad(SQUAD_HTML)
    assert [(member.name, member.role, member.appearances, member.goals) for member in squad] == [
        ("Liaño", "Portero", 27, None),
        ("Bebeto", "Delantero", 34, 16),
    ]
    top = top_scorers_from_squad(squad)
    assert [(scorer.player, scorer.goals) for scorer in top] == [("Bebeto", 16)]


def test_parse_wikipedia_final_reads_the_infobox():
    final = parse_wikipedia_final(WIKI_FINAL_HTML, "https://en.wikipedia.org/wiki/x")
    assert final.date == "2002-03-06"
    assert (final.home, final.away) == ("Real Madrid", "Deportivo La Coruña")
    assert (final.home_goals, final.away_goals) == (1, 2)
    assert final.venue == "Santiago Bernabéu"
    assert final.referee == "Manuel Mejuto González"
    assert [(scorer.player, scorer.minute) for scorer in final.goal_scorers] == [
        ("Raúl", 58),
        ("Sergio", 6),
        ("Tristán", 37),
    ]


def test_parse_wikipedia_final_uses_resumed_score_and_scorers():
    final = parse_wikipedia_final(
        SUSPENDED_WIKI_FINAL_HTML, "https://en.wikipedia.org/wiki/x"
    )
    assert final.date == "1995-06-24"
    assert (final.home_goals, final.away_goals) == (2, 1)
    assert "suspensión" in (final.note or "")
    assert [(scorer.player, scorer.minute) for scorer in final.goal_scorers] == [
        ("Player One", 35),
        ("Player Three", 83),
        ("Player Two", 50),
    ]


SEASON_HTML = """
<html><body>
<a href="../t/t2001-02aCOP.html">Copa del Rey</a>
""" + SQUAD_HTML + """
</body></html>
"""


def _detail_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/robots.txt":
        return httpx.Response(200, text="User-agent: *\nAllow: /\n")
    if request.url.host == "en.wikipedia.org":
        return httpx.Response(200, text=WIKI_FINAL_HTML)
    if request.url.path == "/es/t/t2001-0213.html":
        return httpx.Response(200, text=SEASON_HTML)
    if request.url.path == "/es/t/t2001-02aCOP.html":
        return httpx.Response(200, text=COMPETITION_HTML)
    if request.url.path == "/es/p/p.php":
        return httpx.Response(200, text=MATCH_HTML)
    return httpx.Response(404)


def _curated_final(minute: int = 38) -> m.FinalMatch:
    return m.FinalMatch(
        date="2002-03-06",
        round_="Final",
        home="Real Madrid CF",
        away="RC Deportivo de La Coruña",
        home_goals=1,
        away_goals=2,
        venue="Estadio Santiago Bernabéu, Madrid",
        referee="Manuel Mejuto González",
        goal_scorers=[
            m.GoalScorer(
                player="Sergio González",
                goals=1,
                minute=6,
                team="RC Deportivo de La Coruña",
            ),
            m.GoalScorer(
                player="Diego Tristán",
                goals=1,
                minute=minute,
                team="RC Deportivo de La Coruña",
            ),
            m.GoalScorer(
                player="Raúl González",
                goals=1,
                minute=58,
                team="Real Madrid CF",
            ),
        ],
    )


def test_title_details_flags_scorer_minute_conflict_without_mutating_curated_title(tmp_path: Path):
    curated = m.Titles(
        updatedAt=NOW,
        editions=[
            m.TitleEdition(
                competition="Copa del Rey",
                year=2002,
                season="2001-02",
                final_match=_curated_final(38),
                provenance=m.Provenance(source="manual"),
            )
        ],
    )
    before = curated.model_dump()
    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(_detail_handler),
    )
    try:
        details = build_title_details(curated, client)
    finally:
        client.close()

    assert len(details) == 1
    detail = details[0]
    assert detail["status"] == "conflict"
    assert detail["differences"] == [
        {
            "field": "goal_scorer_minute",
            "player": "Diego Tristán",
            "curated": 38,
            "bdfutbol": 38,
            "wikipedia": 37,
        }
    ]
    assert detail["bdfutbol"]["final_matches"][0]["referee"] == "Mejuto González"
    assert detail["bdfutbol"]["top_scorers"][0]["player"] == "Bebeto"
    assert detail["wikipedia"]["final_match"]["date"] == "2002-03-06"
    # La edición curada no se modifica: la propuesta solo se escribe aparte.
    assert curated.model_dump() == before


def test_title_details_flags_a_curated_scorer_minute_conflict_and_proposal_keeps_titles_yml_intact(tmp_path: Path):
    titles_path = MANUAL / "titles.yml"
    before = titles_path.read_bytes()
    curated = m.Titles(
        updatedAt=NOW,
        editions=[
            m.TitleEdition(
                competition="Copa del Rey",
                year=2002,
                season="2001-02",
                final_match=_curated_final(37),
                provenance=m.Provenance(source="manual"),
            )
        ],
    )
    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(_detail_handler),
    )
    try:
        details = build_title_details(curated, client)
    finally:
        client.close()

    assert details[0]["status"] == "conflict"
    assert "goal_scorer_minute" in {item["field"] for item in details[0]["differences"]}

    proposal_path = tmp_path / "titles.proposed.yml"
    proposal = write_titles_proposal(
        proposal_path, curated, [], details=details
    )
    assert proposal["details"] == details
    assert "goal_scorer_minute" in proposal_path.read_text(encoding="utf-8")
    assert titles_path.read_bytes() == before


def test_title_details_keep_disputed_unpublished_minutes_unresolved(tmp_path: Path):
    final = _curated_final()
    final.goal_scorers = [
        scorer.model_copy(update={"minute": None}) for scorer in final.goal_scorers
    ]
    curated = m.Titles(
        updatedAt=NOW,
        editions=[
            m.TitleEdition(
                competition="Copa del Rey",
                year=2002,
                season="2001-02",
                final_match=final,
                provenance=m.Provenance(source="manual"),
            )
        ],
    )
    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(_detail_handler),
    )
    try:
        detail = build_title_details(curated, client)[0]
    finally:
        client.close()

    assert detail["status"] == "match_with_unresolved"
    assert detail["differences"] == []
    assert detail["unresolved"] == [
        {"player": "Diego Tristán", "bdfutbol": 38, "wikipedia": 37}
    ]


# ---------------------------------------------------------------------------
# H5 — pipeline club rivalries
# ---------------------------------------------------------------------------


def test_rivalries_offline_uses_cache_and_does_not_fail(tmp_path: Path) -> None:
    """En modo offline, el pipeline usa solo la caché y no levanta excepciones."""
    # Primera pasada online: llena la caché sintética.
    client_online = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(lambda r: httpx.Response(200, text=H2H_HTML)),
    )
    try:
        first_changed, rivalries_online = publish_rivalries(
            MANUAL / "rivalries.yml", tmp_path / "out", client_online, NOW
        )
    finally:
        client_online.close()

    assert first_changed is True
    assert all(r.head_to_head is not None for r in rivalries_online.rivalries)

    # Segunda pasada offline: usa la caché, no hace peticiones reales.
    client_offline = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        offline=True,
    )
    try:
        second_changed, rivalries_offline = publish_rivalries(
            MANUAL / "rivalries.yml", tmp_path / "out", client_offline, NOW
        )
    finally:
        client_offline.close()

    # Idempotente: sin cambios en la segunda pasada.
    assert second_changed is False
    # Con balance porque viene de la caché (o del fichero previo).
    assert len(rivalries_offline.rivalries) == len(rivalries_online.rivalries)


def test_rivalries_iconic_matches_and_facts_start_empty() -> None:
    """Los campos iconicMatches y facts de las rivalidades curadas arrancan vacíos.

    Solo se rellenan desde YAML manual con fuente verificable; nunca por
    deducción ni por scraping automático.
    """
    rivalries = load_rivalries(MANUAL / "rivalries.yml", NOW)
    for rivalry in rivalries.rivalries:
        assert rivalry.iconic_matches == [], (
            f"{rivalry.rival}: iconicMatches no vacío en el YAML curado"
        )
        assert rivalry.facts == [], (
            f"{rivalry.rival}: facts no vacío en el YAML curado"
        )
        assert rivalry.media == [], (
            f"{rivalry.rival}: media no vacío en el YAML curado (solo URL con crédito)"
        )


def test_rivalries_tier_values_are_valid() -> None:
    """Todas las rivalidades tienen tier 'derbi' o 'historico'."""
    rivalries = load_rivalries(MANUAL / "rivalries.yml", NOW)
    for rivalry in rivalries.rivalries:
        assert rivalry.tier in ("derbi", "historico"), (
            f"{rivalry.rival}: tier inesperado '{rivalry.tier}'"
        )


def test_rivalries_all_have_bdfutbol_id() -> None:
    """Todas las rivalidades tienen un id BDFutbol verificado manualmente."""
    rivalries = load_rivalries(MANUAL / "rivalries.yml", NOW)
    for rivalry in rivalries.rivalries:
        assert rivalry.rival_bdfutbol_id is not None, (
            f"{rivalry.rival}: falta rival_bdfutbol_id"
        )


def test_rivalries_racing_santander_not_in_rivalries() -> None:
    """Racing de Santander está en bdfutbol_teams.yml como rival actual de LaLiga
    pero no como rivalidad histórica del club: no tiene suficiente historia
    compartida documentada para incluirse en rivalries.yml.
    """
    rivalries = load_rivalries(MANUAL / "rivalries.yml", NOW)
    names = [r.rival for r in rivalries.rivalries]
    assert not any("Santander" in n for n in names), (
        "Racing de Santander apareció en rivalries.yml sin fuente documentada"
    )
