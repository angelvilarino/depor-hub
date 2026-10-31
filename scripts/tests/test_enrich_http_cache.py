import os
import time
from pathlib import Path

import httpx

from depor_hub.enrich.http import PoliteClient

URL = "https://example.test/page"


def test_expired_cache_fetches_from_network(tmp_path: Path):
    cache = tmp_path / "cache"
    client = PoliteClient(cache_dir=cache, interval=0, sleep=lambda _: None)
    path = client._cache_path(URL)
    assert path is not None
    path.write_text("stale", encoding="utf-8")
    os.utime(path, (time.time() - 3600, time.time() - 3600))

    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(200, text="fresh")

    client.close()
    client = PoliteClient(
        cache_dir=cache,
        interval=0,
        sleep=lambda _: None,
        transport=httpx.MockTransport(handler),
        cache_ttl=60,
    )
    try:
        assert client.get(URL).text == "fresh"
        assert requests[-1] == URL
    finally:
        client.close()


def test_offline_uses_expired_cache(tmp_path: Path):
    cache = tmp_path / "cache"
    client = PoliteClient(cache_dir=cache, offline=True, cache_ttl=1)
    try:
        path = client._cache_path(URL)
        assert path is not None
        path.write_text("cached", encoding="utf-8")
        os.utime(path, (time.time() - 3600, time.time() - 3600))
        result = client.get(URL)
        assert result.text == "cached"
        assert result.from_cache
    finally:
        client.close()
