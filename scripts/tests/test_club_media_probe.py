import io
from pathlib import Path

import httpx
from PIL import Image

from depor_hub.club_extra import (
    collect_media_candidates,
    media_report_markdown,
    probe_club_media,
    write_media_report,
)
from depor_hub.enrich.http import PoliteClient

NOW = "2026-11-06T10:00:00Z"


def _png() -> bytes:
    image = Image.new("RGB", (40, 30), (255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _write_yaml(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


def test_collect_media_candidates_covers_club_titles_rivalries_and_images(tmp_path: Path):
    club = _write_yaml(
        tmp_path / "club.yml",
        """
crests:
  - id: uno
    image: img/club/uno.png
museum:
  media:
    - url: https://example.org/museum.jpg
      kind: photo
      origin: commons
      license: CC BY-SA 4.0
      credit: Autoría de ejemplo
""",
    )
    titles = _write_yaml(
        tmp_path / "titles.yml",
        """
editions:
  - competition: Copa del Rey
    year: 2000
    media:
      - url: https://example.org/final.jpg
        kind: photo
        origin: club_official
""",
    )
    rivalries = _write_yaml(
        tmp_path / "rivalries.yml",
        """
rivalries:
  - rival: Rival de ejemplo
    media:
      - url: https://example.org/rival.mp4
        kind: video
""",
    )
    images = _write_yaml(
        tmp_path / "club_images.yml",
        """
sources:
  img/club/uno.png:
    url: https://example.org/uno.png
    source: https://example.org/fuente
""",
    )

    candidates = collect_media_candidates(
        club,
        titles_path=titles,
        rivalries_path=rivalries,
        club_images_path=images,
    )

    by_context = {item["context"]: item for item in candidates}
    assert len(candidates) == 4
    assert by_context["crests[0].image"] == {
        "id": "crests-0-image",
        "kind": "photo",
        "origin": "club_official",
        "url": "https://example.org/uno.png",
        "path": "img/club/uno.png",
        "source_file": "club.yml",
        "context": "crests[0].image",
        "source_url": "https://example.org/fuente",
    }
    assert by_context["museum.media[0]"]["kind"] == "photo"
    assert by_context["editions[0].media[0]"]["origin"] == "club_official"
    assert by_context["rivalries[0].media[0]"]["kind"] == "video"


def test_probe_club_media_reports_ok_broken_blocked_local_and_missing(tmp_path: Path):
    public_root = tmp_path / "public"
    (public_root / "img" / "club").mkdir(parents=True)
    (public_root / "img" / "club" / "local.png").write_bytes(_png())

    club = _write_yaml(
        tmp_path / "club.yml",
        """
crests:
  - id: local
    image: img/club/local.png
  - id: remoto
    image: img/club/remoto.png
  - id: ausente
    image: img/club/ausente.png
museum:
  media:
    - url: https://example.org/rota.png
      kind: photo
      origin: commons
""",
    )
    titles = _write_yaml(
        tmp_path / "titles.yml",
        """
editions:
  - competition: Copa del Rey
    year: 2000
    media:
      - url: https://example.org/clip.mp4
        kind: video
        origin: club_official
""",
    )
    rivalries = _write_yaml(
        tmp_path / "rivalries.yml",
        """
rivalries:
  - rival: Rival de ejemplo
    media:
      - url: https://example.org/bloqueada.png
        kind: photo
        origin: press
""",
    )
    images = _write_yaml(
        tmp_path / "club_images.yml",
        """
sources:
  img/club/remoto.png:
    url: https://example.org/ok.png
    source: https://example.org/fuente
""",
    )
    before = {path: path.read_text(encoding="utf-8") for path in (club, titles, rivalries)}
    png = _png()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        if request.url.path == "/ok.png":
            if request.method == "HEAD":
                return httpx.Response(
                    200,
                    headers={
                        "Content-Type": "image/png",
                        "Content-Length": str(len(png)),
                    },
                )
            return httpx.Response(200, content=png, headers={"Content-Type": "image/png"})
        if request.url.path == "/clip.mp4":
            return httpx.Response(
                200, headers={"Content-Type": "video/mp4", "Content-Length": "123"}
            )
        if request.url.path == "/rota.png":
            return httpx.Response(404)
        if request.url.path == "/bloqueada.png":
            return httpx.Response(403)
        return httpx.Response(404)

    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        result = probe_club_media(
            club,
            client,
            titles_path=titles,
            rivalries_path=rivalries,
            club_images_path=images,
            public_root=public_root,
            checked_at=NOW,
        )
    finally:
        client.close()

    by_context = {item["context"]: item for item in result["items"]}
    local = by_context["crests[0].image"]
    assert local["status"] == "local"
    assert local["local_exists"] is True
    assert (local["width"], local["height"]) == (40, 30)

    remote = by_context["crests[1].image"]
    assert remote["status"] == "ok"
    assert remote["mime"] == "image/png"
    assert remote["size_bytes"] == len(png)
    assert (remote["width"], remote["height"]) == (40, 30)
    assert remote["path"] == "img/club/remoto.png"

    missing = by_context["crests[2].image"]
    assert missing["status"] == "missing"
    assert missing.get("local_exists") is not True

    broken = by_context["museum.media[0]"]
    assert broken["status"] == "broken"
    assert broken["http_status"] == 404

    blocked = by_context["rivalries[0].media[0]"]
    assert blocked["status"] == "blocked"
    assert blocked["http_status"] == 403

    video = by_context["editions[0].media[0]"]
    assert video["status"] == "ok"
    assert video["mime"] == "video/mp4"
    assert video["size_bytes"] == 123

    assert result["counts"] == {
        "local": 1,
        "ok": 2,
        "missing": 1,
        "broken": 1,
        "blocked": 1,
    }
    assert {path: path.read_text(encoding="utf-8") for path in before} == before


def test_write_media_report_lists_problems_once_and_keeps_existing_text(tmp_path: Path):
    docs = tmp_path / "sources.md"
    docs.write_text("# Fuentes\n\nTexto previo.\n", encoding="utf-8")
    result = {
        "checked_at": NOW,
        "counts": {"ok": 3, "broken": 1, "blocked": 1, "missing": 1},
        "items": [
            {"status": "ok", "context": "crests[0].image", "url": "https://example.org/ok.png"},
            {
                "status": "broken",
                "context": "museum.media[0]",
                "url": "https://example.org/rota.png",
                "http_status": 404,
                "mime": "text/html",
                "error": "404 en https://example.org/rota.png",
            },
            {
                "status": "blocked",
                "context": "rivalries[0].media[0]",
                "url": "https://example.org/bloqueada.png",
                "http_status": 403,
                "error": "403 en https://example.org/bloqueada.png",
            },
            {
                "status": "missing",
                "context": "crests[2].image",
                "path": "img/club/ausente.png",
                "error": "no existe el fichero local",
            },
        ],
    }

    write_media_report(docs, result)
    write_media_report(docs, result)
    body = docs.read_text(encoding="utf-8")

    assert body.count("<!-- club-media:start -->") == 1
    assert body.count("<!-- club-media:end -->") == 1
    assert "Texto previo." in body
    assert "https://example.org/rota.png" in body
    assert "https://example.org/bloqueada.png" in body
    assert "img/club/ausente.png" in body
    assert "rotas: **1**" in body
    assert "bloqueadas: **1**" in body
    assert "ausentes: **1**" in body

    section = media_report_markdown(result)
    assert "https://example.org/ok.png" not in section

    # Cambiar solo la hora de comprobación no debe ensuciar el repositorio.
    write_media_report(docs, {**result, "checked_at": "2026-12-01T00:00:00Z"})
    assert docs.read_text(encoding="utf-8") == body


def test_probe_get_accepts_svg_served_as_octet_stream(tmp_path: Path):
    club = _write_yaml(
        tmp_path / "club.yml",
        """
museum:
  media:
    - url: https://example.org/escudo.svg
      kind: photo
      origin: club_official
""",
    )
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"></svg>'

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        if request.url.path == "/escudo.svg":
            return httpx.Response(
                200,
                content=svg,
                headers={"Content-Type": "application/octet-stream"},
            )
        return httpx.Response(404)

    client = PoliteClient(
        cache_dir=tmp_path / "cache",
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        result = probe_club_media(club, client, checked_at=NOW)
    finally:
        client.close()
    item = result["items"][0]
    assert item["status"] == "ok"
    assert item["mime"] == "application/octet-stream"
    assert (item["width"], item["height"]) == (120, 80)
    assert item["format"] == "SVG"


def test_binary_cache_keeps_content_type_for_offline_reads(tmp_path: Path):
    png = _png()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(200, content=png, headers={"Content-Type": "image/png"})

    cache = tmp_path / "cache"
    online = PoliteClient(
        cache_dir=cache,
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        online.get_binary("https://example.org/foto.png")
    finally:
        online.close()

    offline = PoliteClient(cache_dir=cache, offline=True)
    try:
        cached = offline.get_binary("https://example.org/foto.png")
    finally:
        offline.close()
    assert cached.from_cache is True
    assert cached.content_type == "image/png"
    assert cached.content == png


def test_head_is_cached_and_can_be_read_offline(tmp_path: Path):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(
            200,
            headers={"Content-Type": "image/png", "Content-Length": "42"},
        )

    cache = tmp_path / "cache"
    first = PoliteClient(
        cache_dir=cache,
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
    )
    try:
        online = first.head("https://example.org/foto.png")
    finally:
        first.close()
    assert online.from_cache is False
    assert online.content_length == 42

    offline = PoliteClient(cache_dir=cache, offline=True)
    try:
        cached = offline.head("https://example.org/foto.png")
    finally:
        offline.close()
    assert cached.from_cache is True
    assert cached.content_type == "image/png"
    assert cached.content_length == 42
