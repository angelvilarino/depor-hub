"""Pruebas del pipeline de noticias (ADR 0018): sin red y con reloj fijo."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from depor_hub import models as m
from depor_hub.news import audit as news_audit
from depor_hub.news import ingest as news_ingest
from depor_hub.news.cluster import (
    Candidate,
    build_stories,
    cluster_candidates,
    retain,
    same_story,
)
from depor_hub.news.feeds import FeedConfig, load_feeds
from depor_hub.news.http import FeedBlocked, FeedResponse
from depor_hub.news.normalize import (
    canonical_url,
    parse_date,
    strip_source_suffix,
    title_similarity,
    truncate_summary,
)
from depor_hub.news.parse import clean_html, parse_entries
from depor_hub.news.relevance import build_index
from depor_hub.news.tags import TAXONOMY, build_tags

FIXTURES = Path(__file__).parent / "fixtures" / "news"
NOW = datetime(2026, 10, 27, 15, 0, tzinfo=UTC)


def feed(id_="medio", **kwargs) -> FeedConfig:
    data = {
        "id": id_,
        "name": "Medio de prueba",
        "group": "galicia",
        "priority": 50,
        "feedUrl": f"https://{id_}.example.test/rss",
        "homepage": f"https://{id_}.example.test/",
        "kind": "article",
        "enabled": True,
        "deporSpecific": False,
    }
    data.update(kwargs)
    return FeedConfig(**data)


def body(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


class FakeHttp:
    """Sustituye a NewsHttp en las pruebas: no toca la red."""

    def __init__(self, responses: dict[str, bytes | Exception]):
        self.responses = responses
        self.calls: list[tuple[str, bool]] = []

    def fetch(self, feed_id: str, url: str, *, force: bool = False) -> FeedResponse:
        self.calls.append((feed_id, force))
        value = self.responses[feed_id]
        if isinstance(value, Exception):
            raise value
        return FeedResponse(feed_id=feed_id, url=url, final_url=url, status=200, body=value)


def squad(*names: str) -> m.Squad:
    return m.Squad(
        updated_at="2026-10-27T00:00:00Z",
        players=[
            m.Player(id=index + 1, name=name, position="Midfield")
            for index, name in enumerate(names)
        ],
    )


def candidate(**kwargs) -> Candidate:
    data = {
        "title": "El Dépor ficha a un delantero para el ascenso",
        "url": "https://a.test/1",
        "source_id": "a",
        "source_name": "Medio A",
        "source_group": "galicia",
        "source_priority": 10,
        "kind": "article",
        "published_at": NOW - timedelta(hours=2),
        "summary": None,
        "thumbnail_url": None,
    }
    data.update(kwargs)
    return Candidate(**data)


def rss(items: list[tuple[str, str, datetime]]) -> bytes:
    rows = "".join(
        f"<item><title>{title}</title><link>{url}</link>"
        f"<pubDate>{published.strftime('%a, %d %b %Y %H:%M:%S %z')}</pubDate></item>"
        for title, url, published in items
    )
    return (
        "<rss version='2.0'><channel><title>Medio</title>"
        f"<link>https://medio.test/</link>{rows}</channel></rss>"
    ).encode()


# --- catálogo ---------------------------------------------------------------


def test_load_feeds_rejects_duplicate_ids(tmp_path: Path):
    path = tmp_path / "feeds.yml"
    path.write_text(
        "feeds:\n"
        "  - {id: uno, name: Uno, group: galicia, feedUrl: 'https://uno.test/rss',"
        " homepage: 'https://uno.test/'}\n"
        "  - {id: uno, name: Otro, group: galicia, feedUrl: 'https://otro.test/rss',"
        " homepage: 'https://otro.test/'}\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="duplicados"):
        load_feeds(path)


def test_load_feeds_rejects_non_http_url(tmp_path: Path):
    path = tmp_path / "feeds.yml"
    path.write_text(
        "feeds:\n"
        "  - {id: uno, name: Uno, group: galicia, feedUrl: 'ftp://uno.test/rss',"
        " homepage: 'https://uno.test/'}\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="http"):
        load_feeds(path)


def test_committed_catalog_has_five_active_sources():
    feeds = load_feeds(Path("data/manual/news_feeds.yml"))
    active = [feed for feed in feeds if feed.enabled]
    assert len(active) == 5
    assert {feed.group for feed in active} == {"club", "galicia", "nacional"}
    assert sum(1 for feed in active if feed.group == "galicia") == 3


# --- normalización y parseo -------------------------------------------------


def test_clean_html_removes_scripts_and_tags():
    assert clean_html("<p>Hola <strong>Dépor</strong></p><script>x()</script>") == "Hola Dépor"
    assert clean_html(None) is None
    assert clean_html("   ") is None


def test_parse_rss_extracts_dates_images_and_summary():
    entries = parse_entries(feed(), body("rss_basic.xml"))
    assert [entry.title for entry in entries] == [
        "El Dépor ficha a un delantero para el ascenso",
        "El tiempo en A Coruña para el fin de semana",
        "Partido del Fabril el domingo",
    ]
    first = entries[0]
    assert first.published_at == datetime(2026, 10, 27, 10, 0, tzinfo=UTC)
    assert first.thumbnail_url == "https://cdn.example.test/fichaje.jpg"
    assert first.summary == "El club blanquiazul anuncia un refuerzo para la delantera."
    assert first.video_id is None


def test_parse_atom_skips_entries_without_link_and_keeps_timezone():
    entries = parse_entries(feed(), body("atom_basic.xml"))
    assert len(entries) == 1
    entry = entries[0]
    assert entry.url == "https://atom.example.test/riazor"
    assert entry.published_at == datetime(2026, 10, 27, 9, 30, tzinfo=UTC)
    assert entry.thumbnail_url == "https://cdn.example.test/riazor.jpg"


def test_parse_youtube_sets_video_identity():
    entries = parse_entries(feed("youtube-club", kind="video"), body("youtube.xml"))
    assert len(entries) == 1
    entry = entries[0]
    assert entry.video_id == "VIDEO123"
    assert entry.url == "https://www.youtube.com/watch?v=VIDEO123"
    assert entry.thumbnail_url == "https://i.ytimg.com/vi/VIDEO123/hqdefault.jpg"


def test_parse_rejects_html_page():
    with pytest.raises(ValueError, match="no es un feed"):
        parse_entries(feed(), body("not_a_feed.xml"))


def test_parse_rejects_doctype():
    with pytest.raises(ValueError, match="DOCTYPE"):
        parse_entries(
            feed(),
            b"<!DOCTYPE rss [<!ENTITY x 'y'>]><rss version='2.0'><channel/></rss>",
        )


def test_canonical_url_removes_tracking_and_sorts_query():
    assert (
        canonical_url("https://Example.test/nota/?utm_source=rss&b=2&a=1#frag")
        == "https://example.test/nota?a=1&b=2"
    )


def test_strip_source_suffix_only_removes_the_known_medium():
    assert strip_source_suffix("Titular - Medio", "Medio") == "Titular"
    assert strip_source_suffix("Titular | Otro", "Medio") == "Titular | Otro"


def test_truncate_summary_cuts_at_word_boundary():
    result = truncate_summary("palabra " * 60, limit=40)
    assert result is not None and result.endswith("…") and len(result) <= 40
    assert truncate_summary("  ") is None


def test_parse_date_understands_rfc_and_iso():
    assert parse_date("Tue, 27 Oct 2026 10:00:00 +0000") == datetime(
        2026, 10, 27, 10, 0, tzinfo=UTC
    )
    assert parse_date("2026-10-27T12:00:00+02:00") == datetime(2026, 10, 27, 10, 0, tzinfo=UTC)
    assert parse_date("no-es-fecha") is None


# --- relevancia -------------------------------------------------------------


def test_relevance_ignores_other_deportivos():
    index = build_index(squad("Ximo Navarro"))
    assert not index.is_relevant("El Deportivo Alavés ficha a un jugador")
    assert not index.is_relevant("Deportivo Cali golea en su liga")
    assert index.is_relevant("El Dépor gana en Riazor")
    assert index.is_relevant("El Deportivo de La Coruña presenta su campaña")


def test_relevance_rejects_just_deportivo():
    index = build_index(squad("Ximo Navarro"))
    assert not index.is_relevant("El Deportivo anuncia un acuerdo con su patrocinador")
    assert not index.is_relevant("Un deportivo aparca en doble fila en A Coruña")


def test_relevance_rejects_the_cope_molina_false_positive():
    index = build_index(squad("Ximo Navarro"))
    result = index.evaluate(
        "Molina, el blancoazul que pudo ser leyenda del Deportivo",
        "El exjugador del Deportivo repasa su etapa en el club.",
    )
    assert not result.relevant
    assert result.rejected == "irrelevante"


def test_relevance_does_not_treat_the_beach_as_the_stadium():
    index = build_index(squad("Carlos Herrera"))
    assert not index.is_relevant(
        "Eliana López recuerda su rescate en la playa de Riazor, en A Coruña"
    )
    assert not index.is_relevant("Rescate en la playa de Riazor con olas y un socorrista")
    assert index.is_relevant("El Dépor entrena en Riazor antes del partido")


def test_relevance_player_full_name_scores_more_than_a_surname():
    index = build_index(squad("David Mella"))
    full = index.evaluate("David Mella marca un gol")
    surname = index.evaluate("Mella marca un gol")
    assert full.score > surname.score
    assert full.relevant
    assert not surname.relevant  # un apellido suelto no basta


def test_relevance_understands_nicknames():
    index = build_index(squad("Peke", "Angeliño", "Luismi Cruz"))
    assert index.is_relevant("Peke renueva con el Dépor")
    assert index.is_relevant("Angeliño entrena con el grupo")
    assert index.is_relevant("Luismi Cruz, duda para el partido")


def test_relevance_rejects_necrology_without_depor_signal():
    index = build_index(squad("Ximo Navarro"))
    result = index.evaluate("Fallece un vecino de A Coruña a los 90 años")
    assert result.rejected == "necrologia"


def test_relevance_accepts_coach_surname_with_context():
    index = build_index(squad("Ximo Navarro"), coach_name="Antonio Hidalgo")
    assert index.is_relevant("El Dépor, con Hidalgo, prepara el partido ante el Celta Fortuna")


# --- etiquetas --------------------------------------------------------------


HEADLINES = [
    ("El Dépor ficha a un delantero para el ascenso", ["fichajes"]),
    ("El club blanquiazul anuncia un refuerzo para la delantera", ["fichajes", "club"]),
    ("El Fabril asciende a Segunda Federación", ["cantera", "partido"]),
    ("La cantera del Dépor suma tres juveniles", ["cantera"]),
    ("Mella sufre un esguince y será baja", ["lesiones"]),
    ("Parte médico: rotura muscular para el central", ["lesiones"]),
    ("Previa del partido ante el Racing de Ferrol", ["partido"]),
    ("Crónica: el Dépor empata en Riazor", ["partido"]),
    ("La afición llena Riazor en el ascenso", ["aficion", "partido"]),
    ("La peña deportivista organiza un viaje", ["aficion"]),
    ("La asamblea de socios aprueba el presupuesto", ["club"]),
    ("El Dépor presenta su nueva camiseta", ["club"]),
    ("Editorial: este equipo merece más", ["opinion"]),
    ("El 1x1 del Dépor ante el Celta Fortuna", ["opinion"]),
    ("El Dépor renueva a su capitán", ["fichajes"]),
    ("El Dépor cede a un joven del Fabril al Compostela", ["fichajes", "cantera"]),
    ("Convocatoria para el derbi", ["partido"]),
    ("Rueda de prensa de Hidalgo antes del partido", ["partido"]),
    ("El Dépor inaugura su nueva tienda", ["club"]),
    ("Los abonados podrán renovar su carné", ["aficion"]),
    ("El Dépor ficha a una promesa del Fabril", ["fichajes", "cantera"]),
    ("El Dépor gana al Lugo en el último minuto", ["partido"]),
    ("La grada prepara un mosaico", ["aficion"]),
    ("Análisis: las claves del sistema de Hidalgo", ["opinion"]),
    ("El Dépor y el Ayuntamiento firman un convenio", ["club"]),
    ("Lesión de tobillo para el portero", ["lesiones"]),
    ("El juvenil del Dépor debuta con el Fabril", ["cantera"]),
    ("El Dépor anuncia un acuerdo de patrocinio", ["club"]),
    ("El mercado de fichajes se anima para el Dépor", ["fichajes"]),
    ("El Dépor despide a un histórico con un homenaje", ["club"]),
]


def test_tags_stay_inside_the_closed_taxonomy():
    for title, _expected in HEADLINES:
        tags = build_tags(title)
        assert set(tags) <= set(TAXONOMY), (title, tags)
        assert len(tags) <= 2, (title, tags)


def test_tags_match_the_expected_category():
    for title, expected in HEADLINES:
        tags = build_tags(title)
        for tag in expected:
            assert tag in tags, (title, expected, tags)


def test_tags_never_include_teams_or_players():
    tags = build_tags("Yeremay y Mella lideran al Dépor ante el Celta Fortuna")
    assert all(tag in TAXONOMY for tag in tags)


def test_tags_do_not_mark_a_death_as_an_injury():
    tags = build_tags("Fallece un exjugador del Dépor tras una larga enfermedad")
    assert "lesiones" not in tags


def test_tags_require_match_context_for_partido():
    assert "partido" not in build_tags("El Dépor gana un premio de la ciudad")
    assert "partido" in build_tags("El Dépor gana al Lugo en Riazor")


# --- clústeres --------------------------------------------------------------


def test_title_similarity_detects_the_same_story_in_two_media():
    assert (
        title_similarity(
            "El Dépor ficha a un delantero para el ascenso",
            "El Deportivo ficha a un delantero para el ascenso",
        )
        >= 0.8
    )
    assert (
        title_similarity(
            "El Dépor ficha a un delantero",
            "Riazor estrena césped nuevo",
        )
        < 0.5
    )


def test_same_story_merges_three_media_and_keeps_also_in():
    candidates = [
        candidate(source_priority=30, title="El Dépor ficha a un delantero para el ascenso"),
        candidate(
            url="https://b.test/1",
            source_id="b",
            source_name="Medio B",
            source_priority=10,
            title="El Deportivo ficha a un delantero para el ascenso",
            thumbnail_url="https://b.test/foto.jpg",
        ),
        candidate(
            url="https://c.test/1",
            source_id="c",
            source_name="Medio C",
            source_priority=20,
            title="El Dépor incorpora a un delantero para el ascenso",
            published_at=NOW - timedelta(hours=3),
        ),
    ]
    clusters = cluster_candidates(candidates)
    assert len(clusters) == 1
    stories = build_stories(clusters, previous=[], now=NOW)
    assert len(stories) == 1
    story = stories[0]
    assert story.source_id == "b"
    assert story.thumbnail_url == "https://b.test/foto.jpg"
    assert {alt.source_id for alt in story.also_in} == {"a", "c"}


def test_same_url_is_always_the_same_story():
    left = candidate(url="https://a.test/1?utm_source=rss")
    right = candidate(
        url="https://a.test/1?utm_source=rss",
        source_id="b",
        title="Otro titular completamente distinto",
    )
    assert same_story(left, right)


def test_two_posts_from_the_same_medium_are_not_merged():
    left = candidate(url="https://a.test/1")
    right = candidate(url="https://a.test/2", title="El Dépor ficha a un delantero para el ascenso")
    assert not same_story(left, right)


def test_different_stories_about_the_same_player_are_not_merged():
    left = candidate(
        title="Mella renueva con el Dépor hasta 2029",
        url="https://a.test/renueva",
    )
    right = candidate(
        source_id="b",
        source_name="Medio B",
        url="https://b.test/lesion",
        title="Mella sufre una lesión muscular y será baja",
    )
    assert not same_story(left, right)


def test_preview_and_match_report_are_not_merged():
    left = candidate(title="Previa del Dépor ante el Racing de Ferrol")
    right = candidate(
        source_id="b",
        source_name="Medio B",
        url="https://b.test/cronica",
        title="Crónica: el Dépor gana al Racing de Ferrol",
        published_at=NOW - timedelta(hours=1),
    )
    assert not same_story(left, right)


def test_same_event_in_two_media_merges_with_word_overlap():
    left = candidate(
        title="Auriense – Dépor: horario, televisión y cómo ver online la Copa del Rey",
        url="https://a.test/ver",
    )
    right = candidate(
        source_id="b",
        source_name="Medio B",
        url="https://b.test/ver",
        title="Cómo y dónde ver el Auriense-Dépor: horario y TV de la Copa del Rey",
    )
    assert same_story(left, right)


def test_same_player_and_event_merges_but_distinct_stories_do_not():
    index = build_index(squad("Pierre-Emerick Aubameyang"), coach_name="Antonio Hidalgo")
    first = candidate(
        title="Hidalgo ve a Aubameyang «bastante cerca» y no pone fecha a Zaka",
        url="https://a.test/cerca",
    )
    first.entities = index.entities(first.title, first.summary)
    second = candidate(
        source_id="b",
        source_name="Medio B",
        url="https://b.test/cerca",
        title="Antonio Hidalgo: «El regreso de Aubameyang está cerca, bastante cerca»",
    )
    second.entities = index.entities(second.title, second.summary)
    other = candidate(
        source_id="c",
        source_name="Medio C",
        url="https://c.test/porteria",
        title="La portería rival se hace más pequeña sin Aubameyang",
    )
    other.entities = index.entities(other.title, other.summary)

    assert same_story(first, second)
    assert not same_story(first, other)
    assert not same_story(second, other)


def test_cluster_ids_are_stable_between_runs():
    candidates = [
        candidate(),
        candidate(
            url="https://b.test/1",
            source_id="b",
            source_name="Medio B",
            source_priority=20,
            title="El Deportivo ficha a un delantero para el ascenso",
        ),
    ]
    first = build_stories(cluster_candidates(candidates), previous=[], now=NOW)
    later = NOW + timedelta(hours=6)
    moved = [
        candidate(published_at=later - timedelta(hours=1)),
        candidate(
            url="https://b.test/1",
            source_id="b",
            source_name="Medio B",
            source_priority=20,
            title="El Deportivo ficha a un delantero para el ascenso",
            published_at=later - timedelta(hours=2),
        ),
    ]
    second = build_stories(cluster_candidates(moved), previous=first, now=later)
    assert first[0].id == second[0].id


def test_retention_drops_old_stories_and_limits_to_150():
    def story(index: int, published: datetime) -> m.NewsStory:
        return m.NewsStory(
            id=f"s{index}",
            title=f"Historia {index}",
            url=f"https://a.test/{index}",
            source_id="a",
            published_at=published.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )

    old = {f"s{index}" for index in range(3)}
    stories = [story(index, NOW - timedelta(days=15)) for index in range(3)]
    stories += [story(index + 100, NOW - timedelta(hours=index)) for index in range(160)]
    kept = retain(stories, NOW, days=14, limit=150)
    assert len(kept) == 150
    assert not (old & {item.id for item in kept})


# --- ingesta ----------------------------------------------------------------


def test_ingest_normalizes_filters_and_deduplicates():
    http = FakeHttp({"medio": body("rss_basic.xml")})
    result = news_ingest.run_ingest(
        feeds=[feed(deporSpecific=True)],
        http=http,
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    titles = {story.title for story in result.news.stories}
    assert "El Dépor ficha a un delantero para el ascenso" in titles
    assert "Partido del Fabril el domingo" in titles
    assert "El tiempo en A Coruña para el fin de semana" not in titles
    fichaje = next(story for story in result.news.stories if "ficha" in story.title)
    assert fichaje.url == "https://example.test/deportivo-fichaje"
    assert fichaje.summary is not None and "<" not in fichaje.summary
    assert result.changed is True


def test_ingest_keeps_previous_stories_when_one_source_fails():
    first = news_ingest.run_ingest(
        feeds=[feed("a", deporSpecific=True), feed("b", deporSpecific=True)],
        http=FakeHttp({"a": body("rss_basic.xml"), "b": body("atom_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    previous_ids = {story.id for story in first.news.stories}
    http = FakeHttp(
        {
            "a": FeedBlocked("403 en https://a.example.test/rss; no se insiste"),
            "b": body("atom_basic.xml"),
        }
    )
    second = news_ingest.run_ingest(
        feeds=[feed("a", deporSpecific=True), feed("b", deporSpecific=True)],
        http=http,
        squad=None,
        coach_name=None,
        opponents=[],
        existing=first.news,
        now=NOW + timedelta(hours=1),
    )
    assert len(second.errors) == 1 and "403" in second.errors[0]
    assert previous_ids <= {story.id for story in second.news.stories}


def test_ingest_fails_when_every_source_fails():
    http = FakeHttp(
        {
            "a": FeedBlocked("403 en https://a.example.test/rss"),
            "b": FeedBlocked("429 en https://b.example.test/rss"),
        }
    )
    with pytest.raises(news_ingest.AllFeedsFailed):
        news_ingest.run_ingest(
            feeds=[feed("a"), feed("b")],
            http=http,
            squad=None,
            coach_name=None,
            opponents=[],
            existing=None,
            now=NOW,
        )


def test_ingest_is_idempotent():
    feeds = [feed(deporSpecific=True)]
    first = news_ingest.run_ingest(
        feeds=feeds,
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    second = news_ingest.run_ingest(
        feeds=feeds,
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=first.news,
        now=NOW,
    )
    assert second.changed is False
    assert [story.id for story in second.news.stories] == [story.id for story in first.news.stories]


def test_ingest_publishes_the_source_catalog():
    result = news_ingest.run_ingest(
        feeds=[
            feed("nacional", group="nacional", priority=40),
            feed("local", group="galicia", priority=10),
        ],
        http=FakeHttp({"nacional": body("atom_basic.xml"), "local": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    assert [source.group for source in result.news.sources] == ["galicia", "nacional"]
    assert all(source.homepage.startswith("https://") for source in result.news.sources)


def test_ingest_report_has_calibration_sections():
    http = FakeHttp({"medio": body("rss_basic.xml")})
    result = news_ingest.run_ingest(
        feeds=[feed(deporSpecific=True)],
        http=http,
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    report = result.report.render()
    assert "Elementos por fuente" in report
    assert "Descartes" in report
    assert "Tamaños de clúster" in report
    assert "20 clústeres mayores" in report


def test_write_news_round_trips_the_contract(tmp_path: Path):
    result = news_ingest.run_ingest(
        feeds=[feed(deporSpecific=True)],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        now=NOW,
    )
    assert news_ingest.write_news(tmp_path, result) is True
    payload = json.loads((tmp_path / "news.json").read_text(encoding="utf-8"))
    assert set(payload) == {"updatedAt", "sources", "stories"}
    assert set(payload["stories"][0]) == {
        "id",
        "title",
        "url",
        "sourceId",
        "publishedAt",
        "kind",
        "summary",
        "thumbnailUrl",
        "tags",
        "alsoIn",
    }
    assert m.News.model_validate_json((tmp_path / "news.json").read_text())
    assert news_ingest.write_news(tmp_path, result) is False


def test_audit_accepts_the_new_feed_fields(tmp_path: Path):
    rows = news_audit.audit_feeds(
        [feed(deporSpecific=True)],
        FakeHttp({"medio": body("rss_basic.xml")}),
        index=build_index(None),
    )
    assert len(rows) == 1
    assert rows[0].items == 3
    assert rows[0].relevant == 2
    assert "Relevantes" in news_audit.format_table(rows)
