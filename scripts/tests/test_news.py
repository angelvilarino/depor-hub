import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest

from depor_hub import models as m
from depor_hub.news import audit as news_audit
from depor_hub.news import ingest as news_ingest
from depor_hub.news.dedupe import Candidate
from depor_hub.news.feeds import FeedConfig, load_feeds
from depor_hub.news.http import FeedBlocked, FeedError, FeedResponse, NewsHttp
from depor_hub.news.normalize import (
    canonical_url,
    strip_source_suffix,
    title_similarity,
    truncate_summary,
)
from depor_hub.news.parse import clean_html, parse_entries
from depor_hub.news.relevance import build_index
from depor_hub.news.tags import base_tags, build_tags

FIXTURES = Path(__file__).parent / "fixtures" / "news"
NOW = datetime(2026, 10, 27, 15, 0, tzinfo=UTC)


def feed(id_="medio", **kwargs) -> FeedConfig:
    data = {
        "id": id_,
        "name": "Medio de prueba",
        "kind": "local",
        "url": f"https://{id_}.example.test/rss",
        "media_url": f"https://{id_}.example.test/",
        "weight": 50,
        "keyword_filter": True,
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
        return FeedResponse(
            feed_id=feed_id,
            url=url,
            final_url=url,
            status=200,
            body=value,
        )


def squad(*names: str) -> m.Squad:
    return m.Squad(
        updated_at="2026-10-27T00:00:00Z",
        players=[
            m.Player(id=index + 1, name=name, position="Midfield")
            for index, name in enumerate(names)
        ],
    )


def test_load_feeds_rejects_duplicate_ids(tmp_path: Path):
    path = tmp_path / "feeds.yml"
    path.write_text(
        "feeds:\n"
        "  - {id: uno, name: Uno, kind: local, url: 'https://uno.test/rss'}\n"
        "  - {id: uno, name: Otro, kind: local, url: 'https://otro.test/rss'}\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="duplicados"):
        load_feeds(path)


def test_load_feeds_rejects_non_http_url(tmp_path: Path):
    path = tmp_path / "feeds.yml"
    path.write_text(
        "feeds:\n  - {id: uno, name: Uno, kind: local, url: 'ftp://uno.test/rss'}\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="http"):
        load_feeds(path)


def test_clean_html_removes_scripts_and_tags():
    assert clean_html("<p>Hola <strong>Dépor</strong></p><script>x()</script>") == "Hola Dépor"
    assert clean_html(None) is None
    assert clean_html("   ") is None


def test_parse_rss_extracts_dates_images_and_summary():
    entries = parse_entries(feed(), body("rss_basic.xml"))
    assert [entry.title for entry in entries] == [
        "El Dépor ficha a un delantero para el ascenso",
        "El tiempo en A Coruña para el fin de semana - Medio de prueba",
        "Partido del Fabril el domingo",
    ]
    first = entries[0]
    assert first.published_at == datetime(2026, 10, 27, 10, 0, tzinfo=UTC)
    assert first.thumbnail_url == "https://cdn.example.test/fichaje.jpg"
    assert first.summary == "El club blanquiazul anuncia un refuerzo para la delantera."
    assert first.video_id is None
    assert first.source_name == "Medio de prueba"


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
    assert entry.duration_seconds is None
    assert entry.source_kind == "video"


def test_parse_rejects_html_page():
    with pytest.raises(ValueError, match="ilegible"):
        parse_entries(feed(), body("not_a_feed.xml"))


def test_http_reuses_validators_only_for_the_same_url(tmp_path: Path):
    seen: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append({key.lower(): value for key, value in request.headers.items()})
        if len(seen) == 1:
            return httpx.Response(
                200,
                content=b"<rss version='2.0'><channel><title>A</title></channel></rss>",
                headers={"etag": '"etag-a"'},
            )
        return httpx.Response(
            200,
            content=b"<rss version='2.0'><channel><title>B</title></channel></rss>",
        )

    http = NewsHttp(tmp_path, transport=httpx.MockTransport(handler), sleep=lambda _: None)
    first = http.fetch("jugador", "https://news.google.com/rss/search?q=A")
    second = http.fetch("jugador", "https://news.google.com/rss/search?q=B")
    http.close()

    assert "if-none-match" not in seen[0]
    assert "if-none-match" not in seen[1]
    assert b"<title>A</title>" in first.body
    assert b"<title>B</title>" in second.body


def test_http_answers_304_from_cache(tmp_path: Path):
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(
                200,
                content=b"<rss version='2.0'><channel><title>A</title></channel></rss>",
                headers={"etag": '"etag-a"'},
            )
        assert request.headers.get("if-none-match") == '"etag-a"'
        return httpx.Response(304)

    http = NewsHttp(tmp_path, transport=httpx.MockTransport(handler), sleep=lambda _: None)
    url = "https://news.google.com/rss/search?q=A"
    http.fetch("jugador", url, force=True)
    response = http.fetch("jugador", url)
    http.close()

    assert response.not_modified is True
    assert response.from_cache is True
    assert b"<title>A</title>" in response.body


def test_canonical_url_removes_tracking_and_sorts_query():
    assert (
        canonical_url("https://Example.test/nota/?utm_source=rss&b=2&a=1#frag")
        == "https://example.test/nota?a=1&b=2"
    )


def test_strip_source_suffix_only_removes_the_known_medium():
    assert strip_source_suffix("Titular - Medio", "Medio") == "Titular"
    assert strip_source_suffix("Titular | Otro", "Medio") == "Titular | Otro"


def test_truncate_summary_cuts_at_word_boundary():
    text = "palabra " * 60
    result = truncate_summary(text, limit=40)
    assert result is not None and result.endswith("…") and len(result) <= 40
    assert truncate_summary("  ") is None


def test_relevance_ignores_other_deportivos_and_common_surnames():
    index = build_index(squad("Ximo Navarro"))
    assert index.score("El Deportivo Alavés ficha a un jugador") == 0
    assert index.score("Carlos Herrera entrevista con María José Navarro") == 0
    assert index.score("El Dépor gana en Riazor") >= 3
    assert index.score("El Deportivo de La Coruña presenta su campaña") >= 3


def test_relevance_does_not_treat_the_beach_as_the_stadium():
    index = build_index(squad("Carlos Herrera"))
    text = "Eliana López recuerda su rescate en la playa de Riazor, en A Coruña"
    assert index.score(text) == 0
    assert index.score("Rescate en la playa de Riazor con olas y un socorrista") == 0
    assert index.score("El Dépor entrena en Riazor antes del partido") >= 3


def test_relevance_player_full_name_scores_more_than_an_uncommon_surname():
    index = build_index(squad("David Mella"))
    full = index.score("David Mella marca un gol")
    surname = index.score("Mella marca un gol")
    assert full == 5
    assert surname == 3
    # Un apellido común no basta por sí solo.
    common = build_index(squad("Yeremay Hernández"))
    assert common.score("Hernández marca un gol") == 0
    assert common.score("Yeremay Hernández marca un gol") == 5


def test_relevance_ignores_a_common_full_name_without_context():
    index = build_index(squad("Álvaro Fernández"))
    assert index.score("Álvaro Fernández, farmacéutico, habla del embarazo") == 2
    assert not index.is_relevant(
        "Álvaro Fernández, farmacéutico, habla del embarazo",
        keyword_filter=True,
    )
    assert index.is_relevant("Álvaro Fernández ficha por el Dépor", keyword_filter=True)


def test_tags_are_specific_and_ordered():
    index = build_index(squad("Yeremay Hernández"))
    tags = build_tags("Fichaje para la cantera del Fabril", index)
    assert "fichajes" in tags and "cantera" in tags
    assert base_tags("Una pena que no llueva") == []
    assert "cantera" not in base_tags("El Orzán amanece con olas")
    assert "aficion" not in base_tags("La peña se reúne el viernes")
    assert base_tags("La afición llena Riazor") == ["aficion", "partido"]


def test_title_similarity_detects_the_same_story_in_two_media():
    assert title_similarity(
        "El Dépor ficha a un delantero para el ascenso",
        "El Deportivo ficha a un delantero para el ascenso",
    ) >= 0.82
    assert title_similarity(
        "El Dépor ficha a un delantero",
        "Riazor estrena césped nuevo",
    ) < 0.5


def candidate(**kwargs) -> Candidate:
    data = {
        "id": "a",
        "title": "El Dépor ficha a un delantero para el ascenso",
        "url": "https://a.test/1",
        "source_id": "a",
        "source_name": "Medio A",
        "source_kind": "local",
        "kind": "article",
        "published_at": NOW - timedelta(hours=2),
        "published_estimated": False,
        "summary": None,
        "thumbnail_url": None,
        "source_weight": 70,
    }
    data.update(kwargs)
    return Candidate(**data)


def test_dedupe_keeps_the_heaviest_media_and_records_also_in():
    redundant = candidate(
        id="b",
        url="https://b.test/1",
        source_id="b",
        source_name="Medio B",
        title="El Deportivo ficha a un delantero para el ascenso",
        source_weight=40,
        thumbnail_url="https://b.test/image.jpg",
    )
    items = news_ingest.cluster([candidate(), redundant])
    assert len(items) == 1
    item = items[0]
    assert item.source_name == "Medio A"
    assert item.thumbnail_url == "https://b.test/image.jpg"
    assert [alt.source_name for alt in item.also_in] == ["Medio B"]


def test_dedupe_never_merges_two_posts_from_the_same_medium():
    items = news_ingest.cluster(
        [
            candidate(id="a1", url="https://a.test/1"),
            candidate(
                id="a2",
                url="https://a.test/2",
                title="El Deportivo ficha a un delantero para el ascenso",
            ),
        ]
    )
    assert len(items) == 2


def test_dedupe_keeps_unrelated_stories_apart():
    items = news_ingest.cluster(
        [
            candidate(),
            candidate(
                id="b",
                url="https://b.test/2",
                source_id="b",
                source_name="Medio B",
                title="Riazor estrena césped nuevo",
            ),
        ]
    )
    assert len(items) == 2


def test_ingest_normalizes_filters_and_deduplicates():
    http = FakeHttp({"medio": body("rss_basic.xml")})
    result = news_ingest.run_ingest(
        feeds=[feed()],
        http=http,
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    titles = {item.title for item in result.news.items}
    assert "El Dépor ficha a un delantero para el ascenso" in titles
    assert "Partido del Fabril el domingo" in titles
    assert "El tiempo en A Coruña para el fin de semana - Medio de prueba" not in titles
    fichaje = next(item for item in result.news.items if "ficha" in item.title)
    assert fichaje.url == "https://example.test/deportivo-fichaje"
    assert fichaje.summary is not None and "<" not in fichaje.summary
    assert "fichajes" in fichaje.tags
    assert result.errors == []
    assert result.changed is True
    assert result.sources.sources[0].items >= 1


def test_ingest_is_idempotent_and_keeps_previous_items():
    first = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    second = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=first.news,
        existing_sources=first.sources,
        now=NOW,
    )
    assert second.news.data_hash == first.news.data_hash
    assert second.changed is False
    assert len(second.news.items) == len(first.news.items)


def test_ingest_revalidates_previous_items_against_the_current_filter():
    def old_item(id_: str, title: str) -> m.NewsItem:
        return m.NewsItem(
            id=id_,
            title=title,
            url=f"https://example.test/{id_}",
            source_name="The Objective",
            source_kind="nacional",
            published_at="2026-10-27T12:00:00Z",
        )

    existing = m.News(
        updated_at="2026-10-27T12:00:00Z",
        items=[
            old_item("farmac", "Álvaro Fernández, farmacéutico, habla del embarazo"),
            old_item("depor", "El Dépor ficha a un delantero para el ascenso"),
        ],
    )
    result = news_ingest.run_ingest(
        feeds=[],
        http=FakeHttp({}),
        squad=squad("Álvaro Fernández"),
        coach_name=None,
        opponents=[],
        existing=existing,
        existing_sources=None,
        now=NOW,
    )
    titles = [item.title for item in result.news.items]
    assert "El Dépor ficha a un delantero para el ascenso" in titles
    assert not any("farmacéutico" in title for title in titles)


def test_ingest_drops_items_outside_the_rolling_window():
    old = body("rss_basic.xml").replace(
        b"Sun, 25 Oct 2026 18:30:00 +0000", b"Sun, 01 Sep 2026 18:30:00 +0000"
    )
    result = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": old}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    assert all("Fabril" not in item.title for item in result.news.items)


def test_ingest_tolerates_one_broken_feed():
    http = FakeHttp(
        {
            "medio": body("rss_basic.xml"),
            "roto": FeedBlocked("403 en https://roto.test/rss; no se insiste"),
        }
    )
    result = news_ingest.run_ingest(
        feeds=[feed(), feed("roto", name="Feed roto")],
        http=http,
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    assert len(result.errors) == 1
    broken = next(meta for meta in result.news.meta.sources if meta.feed_id == "roto")
    assert broken.error and "403" in broken.error
    assert result.news.items


def test_ingest_estimates_the_date_when_the_feed_does_not_provide_one():
    rss = (
        "<rss version='2.0'><channel><title>Sin fecha</title>"
        "<item><title>El Dépor presenta el nuevo césped</title>"
        "<link>https://example.test/cesped</link></item>"
        "</channel></rss>"
    ).encode()
    result = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": rss}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    item = result.news.items[0]
    assert item.published_estimated is True
    assert item.published_at.startswith("2026-10-27T15:00:00")


def test_ingest_keeps_a_stable_date_for_an_item_without_date_on_a_second_run():
    rss = (
        "<rss version='2.0'><channel><title>Sin fecha</title>"
        "<item><title>El Dépor presenta el nuevo césped</title>"
        "<link>https://example.test/cesped</link></item>"
        "</channel></rss>"
    ).encode()
    first = news_ingest.run_ingest(
        feeds=[feed()], http=FakeHttp({"medio": rss}), squad=None, coach_name=None,
        opponents=[], existing=None, existing_sources=None, now=NOW,
    )
    second = news_ingest.run_ingest(
        feeds=[feed()], http=FakeHttp({"medio": rss}), squad=None, coach_name=None,
        opponents=[], existing=first.news, existing_sources=first.sources,
        now=NOW + timedelta(hours=2),
    )
    assert second.news.items[0].published_at == first.news.items[0].published_at
    assert second.changed is False


def test_write_news_only_when_changed_and_validates_output(tmp_path: Path):
    result = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    assert news_ingest.write_news(tmp_path, result) is True
    again = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=result.news,
        existing_sources=result.sources,
        now=NOW,
    )
    assert again.changed is False
    assert news_ingest.write_news(tmp_path, again) is False
    assert m.News.model_validate_json((tmp_path / "news.json").read_text(encoding="utf-8"))
    assert m.NewsSources.model_validate_json(
        (tmp_path / "sources.json").read_text(encoding="utf-8")
    )
    assert news_ingest.write_news(tmp_path, again, force=True) is True


def test_player_feed_queries_rotate_through_the_squad():
    team = squad("Uno Jugador", "Dos Jugador", "Tres Jugador")
    first = news_ingest.player_feeds(team, 0, 2)
    second = news_ingest.player_feeds(team, 2, 2)
    assert [item.id for item in first] == ["google-news-player-2", "google-news-player-3"]
    assert [item.id for item in second] == ["google-news-player-1", "google-news-player-2"]
    assert all(item.keyword_filter for item in first)
    # La consulta se limita al club: sin esto, un nombre común devuelve noticias que no
    # tienen nada que ver con el Depor (farmacéuticos, otras ligas, etc.).
    assert all("%28D%C3%A9por+OR+Deportivo%29" in item.url for item in first)


def test_audit_flags_errors_and_updates_docs(tmp_path: Path):
    docs = tmp_path / "sources.md"
    docs.write_text("# Fuentes\n\nIntroducción.\n", encoding="utf-8")
    catalog = tmp_path / "feeds.yml"
    catalog.write_text(
        "feeds:\n"
        "  - {id: medio, name: Medio de prueba, kind: local, url: 'https://medio.test/rss'}\n"
        "  - {id: roto, name: Feed roto, kind: local, url: 'https://roto.test/rss'}\n",
        encoding="utf-8",
    )
    feeds = load_feeds(catalog)
    http = FakeHttp({"medio": body("rss_basic.xml"), "roto": FeedError("404 en roto")})
    rows = news_audit.audit_feeds(feeds, http, index=build_index(None))
    table = news_audit.format_table(rows)
    assert "| Medio de prueba |" in table and "| Feed roto |" in table
    assert "404 en roto" in table
    assert news_audit.update_catalog(catalog, feeds, rows) is True
    updated = load_feeds(catalog)
    assert next(item for item in updated if item.id == "roto").enabled is False
    assert "Deshabilitado por la auditoría" in (
        next(item for item in updated if item.id == "roto").note or ""
    )
    news_audit.update_docs(docs, rows, now=NOW)
    text = docs.read_text(encoding="utf-8")
    assert news_audit.START in text and news_audit.END in text
    assert "Auditoría automática" in text and "Introducción." in text
    news_audit.update_docs(docs, rows, now=NOW)
    assert text.count(news_audit.START) == docs.read_text(encoding="utf-8").count(
        news_audit.START
    )


def test_audit_can_be_limited_to_enabled_feeds():
    http = FakeHttp({"medio": body("rss_basic.xml")})
    rows = news_audit.audit_feeds(
        [feed(), feed("apagado", enabled=False)],
        http,
        include_disabled=False,
    )
    assert [row.feed.id for row in rows] == ["medio"]


def test_sources_json_lists_the_real_media():
    result = news_ingest.run_ingest(
        feeds=[feed()],
        http=FakeHttp({"medio": body("rss_basic.xml")}),
        squad=None,
        coach_name=None,
        opponents=[],
        existing=None,
        existing_sources=None,
        now=NOW,
    )
    payload = json.loads(result.sources.model_dump_json(by_alias=True))
    assert payload["sources"][0]["id"] == "medio"
    assert payload["sources"][0]["kind"] == "local"
