"""Canonicalización, limpieza y similitud de titulares (ADR 0016)."""

from __future__ import annotations

import hashlib
import html
import json
import re
import unicodedata
from difflib import SequenceMatcher
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_TRACKING = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "igshid",
    "ref_src",
    "ref_url",
    "yclid",
    "msclkid",
    "_ga",
}
_SPACE = re.compile(r"\s+")
_NON_WORD = re.compile(r"[^a-z0-9]+")
_STOPWORDS = {
    "a", "al", "algo", "algun", "alguna", "algunas", "alguno", "algunos", "ante", "antes",
    "con", "contra", "cual", "cuando", "de", "del", "desde", "donde", "dos", "el", "ella",
    "ellas", "ellos", "en", "entre", "era", "es", "esa", "ese", "eso", "esta", "este",
    "esto", "fue", "ha", "hasta", "hay", "la", "las", "le", "les", "lo", "los", "mas",
    "me", "mi", "muy", "no", "nos", "o", "otra", "otro", "para", "pero", "por", "que",
    "se", "sin", "sobre", "son", "su", "sus", "tambien", "te", "tiene", "todo", "tu",
    "un", "una", "unas", "uno", "unos", "y", "ya",
}


def canonical_url(value: str) -> str:
    parsed = urlparse(value.strip())
    scheme = parsed.scheme.lower()
    host = parsed.netloc.lower()
    if ":80" in host and scheme == "http":
        host = host.replace(":80", "")
    if ":443" in host and scheme == "https":
        host = host.replace(":443", "")
    path = parsed.path.rstrip("/")
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
    """Hash estable de un JSON público: ignora timestamps y el propio hash.

    Así un refresco sin cambios no genera un commit solo por `updatedAt`.
    """

    canon = {
        key: value
        for key, value in payload.items()
        if key not in {"updatedAt", "dataHash", "meta"}
    }
    blob = json.dumps(canon, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def strip_source_suffix(title: str, source_name: str | None) -> str:
    text = html.unescape(title).strip()
    if source_name:
        name = html.unescape(source_name).strip()
        for separator in (" - ", " | ", " · ", " — "):
            suffix = f"{separator}{name}"
            if text.casefold().endswith(suffix.casefold()):
                text = text[: -len(suffix)].rstrip()
                break
    return _SPACE.sub(" ", text).strip(" -|·—")


def truncate_summary(value: str | None, limit: int = 240) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit // 2:
        cut = cut[:space]
    return cut.rstrip(" ,.;:") + "…"


def _ascii(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def normalize_title(title: str) -> str:
    text = _ascii(title)
    text = _NON_WORD.sub(" ", text)
    tokens = [token for token in text.split() if token and token not in _STOPWORDS]
    return " ".join(tokens)


def title_tokens(title: str) -> set[str]:
    return set(normalize_title(title).split())


def title_similarity(left: str, right: str) -> float:
    a = normalize_title(left)
    b = normalize_title(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    longest = max(len(a), len(b))
    if abs(len(a) - len(b)) / longest > 0.45:
        return 0.0
    sequence = SequenceMatcher(None, a, b).ratio()
    left_tokens = set(a.split())
    right_tokens = set(b.split())
    union = left_tokens | right_tokens
    jaccard = len(left_tokens & right_tokens) / len(union) if union else 0.0
    return max(sequence, jaccard)
