"""Normalización de URLs, títulos, fechas y extractos (ADR 0018)."""

from __future__ import annotations

import hashlib
import html
import json
import re
import unicodedata
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_TRACKING = {
    "fbclid",
    "gclid",
    "dclid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "ref_src",
    "ref_url",
    "yclid",
    "msclkid",
    "_ga",
    "_gl",
    "amp",
}
_SPACE = re.compile(r"\s+")
_NON_WORD = re.compile(r"[^a-z0-9]+")
_TAG = re.compile(r"<[^>]+>")
_SCRIPT = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.I | re.S)
_STOPWORDS = {
    "a",
    "al",
    "algo",
    "algun",
    "alguna",
    "algunas",
    "alguno",
    "algunos",
    "ante",
    "antes",
    "con",
    "contra",
    "cual",
    "cuando",
    "de",
    "del",
    "desde",
    "donde",
    "dos",
    "el",
    "ella",
    "ellas",
    "ellos",
    "en",
    "entre",
    "era",
    "es",
    "esa",
    "ese",
    "eso",
    "esta",
    "este",
    "esto",
    "fue",
    "ha",
    "hasta",
    "hay",
    "la",
    "las",
    "le",
    "les",
    "lo",
    "los",
    "mas",
    "me",
    "mi",
    "muy",
    "no",
    "nos",
    "o",
    "otra",
    "otro",
    "para",
    "pero",
    "por",
    "que",
    "se",
    "sin",
    "sobre",
    "son",
    "su",
    "sus",
    "tambien",
    "te",
    "tiene",
    "todo",
    "tu",
    "un",
    "una",
    "unas",
    "uno",
    "unos",
    "y",
    "ya",
}


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def canonical_url(value: str) -> str:
    parsed = urlparse(value.strip())
    scheme = parsed.scheme.lower()
    host = (parsed.netloc or "").lower()
    if scheme == "http" and host.endswith(":80"):
        host = host[:-3]
    if scheme == "https" and host.endswith(":443"):
        host = host[:-4]
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path or "/"
    # Variantes AMP habituales: /amp, /amp/ y .amp.
    if path.rstrip("/").endswith("/amp"):
        path = path.rstrip("/")[:-4] or "/"
    if path.endswith(".amp"):
        path = path[:-4] or "/"
    path = path.rstrip("/") or "/"
    query = []
    for key, item in parse_qsl(parsed.query, keep_blank_values=True):
        lowered = key.lower()
        if lowered.startswith("utm_") or lowered in _TRACKING:
            continue
        query.append((key, item))
    query.sort()
    return urlunparse((scheme, host, path, "", urlencode(query, doseq=True), ""))


def stable_id(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def content_hash(payload: dict) -> str:
    """Hash estable de un JSON público: ignora timestamps y el propio hash."""

    canon = {
        key: value for key, value in payload.items() if key not in {"updatedAt", "dataHash", "meta"}
    }
    blob = json.dumps(canon, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def clean_html(value: str | None) -> str | None:
    if not value:
        return None
    text = _SCRIPT.sub(" ", value)
    text = _TAG.sub(" ", text)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = _SPACE.sub(" ", text).strip()
    return text or None


def clean_title(value: str | None) -> str | None:
    if not value:
        return None
    text = html.unescape(value)
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    text = _SPACE.sub(" ", text).strip()
    return text or None


def strip_source_suffix(title: str, source_name: str | None = None) -> str:
    text = html.unescape(title).strip()
    if source_name:
        name = html.unescape(source_name).strip()
        for separator in (" - ", " | ", " · ", " — ", " – "):
            suffix = f"{separator}{name}"
            if text.casefold().endswith(suffix.casefold()):
                text = text[: -len(suffix)].rstrip()
                break
    return _SPACE.sub(" ", text).strip(" -|·—–")


def truncate_summary(value: str | None, limit: int = 140) -> str | None:
    text = clean_html(value) or ""
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit // 2:
        cut = cut[:space]
    return cut.rstrip(" ,.;:") + "…"


_ALIASES = {
    "deportivo": "depor",
    "rcdeportivo": "depor",
    "rc": "depor",
}


def normalize_title(title: str) -> str:
    text = fold(title)
    text = _NON_WORD.sub(" ", text)
    tokens = [
        _ALIASES.get(token, token) for token in text.split() if token and token not in _STOPWORDS
    ]
    return " ".join(tokens)


def title_tokens(title: str) -> set[str]:
    return set(normalize_title(title).split())


def title_token_overlap(left: str, right: str) -> float:
    """Jaccard de palabras tras normalizar; mide que hablan del mismo hecho."""
    return jaccard(title_tokens(left), title_tokens(right))


def char_shingles(text: str, size: int = 4) -> set[str]:
    compact = re.sub(r"[^a-z0-9]+", "", fold(text))
    if len(compact) <= size:
        return {compact} if compact else set()
    return {compact[index : index + size] for index in range(len(compact) - size + 1)}


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def title_similarity(left: str, right: str) -> float:
    """Similitud combinada de titulares, robusta a cambios de medio y prefijos."""

    a = normalize_title(left)
    b = normalize_title(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    left_tokens, right_tokens = set(a.split()), set(b.split())
    token_score = jaccard(left_tokens, right_tokens)
    shingle_score = jaccard(char_shingles(a), char_shingles(b))
    # Un prefijo numérico de marcador no debe penalizar la comparación.
    sequence = _sequence_ratio(a, b)
    return round(0.45 * token_score + 0.35 * sequence + 0.20 * shingle_score, 4)


def _sequence_ratio(left: str, right: str) -> float:
    from difflib import SequenceMatcher

    return SequenceMatcher(None, left, right).ratio()


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
