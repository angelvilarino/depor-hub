"""Utilidades HTML/wikitext sin dependencias nuevas (stdlib)."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser


@dataclass
class Cell:
    attrs: dict[str, str] = field(default_factory=dict)
    parts: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return normalize_space(" ".join(self.parts))

    def has_class(self, name: str) -> bool:
        return name in self.attrs.get("class", "").split()


@dataclass
class Table:
    rows: list[list[Cell]] = field(default_factory=list)


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[Table] = []
        self._table_stack: list[Table] = []
        self._row: list[Cell] | None = None
        self._cell: Cell | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            table = Table()
            self.tables.append(table)
            self._table_stack.append(table)
        elif tag == "tr" and self._table_stack:
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = Cell(attrs={k: v or "" for k, v in attrs})
        elif tag == "br" and self._cell is not None:
            self._cell.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table_stack:
            if self._row:
                self._table_stack[-1].rows.append(self._row)
            self._row = None
        elif tag == "table" and self._table_stack:
            self._table_stack.pop()

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.parts.append(data)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def strip_tags(fragment: str) -> str:
    return normalize_space(re.sub(r"<[^>]+>", " ", fragment))


def parse_tables(document: str) -> list[Table]:
    parser = _TableParser()
    parser.feed(document)
    parser.close()
    return parser.tables


def remove_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def iter_templates(text: str, name: str):
    """Itera `(índice, cuerpo)` de plantillas `{{name|...}}`, con llaves balanceadas."""
    start = 0
    needle = "{{" + name
    while True:
        index = text.find(needle, start)
        if index < 0:
            return
        if text.rfind("<!--", 0, index) > text.rfind("-->", 0, index):
            start = index + len(needle)
            continue
        depth = 0
        i = index
        while i < len(text) - 1:
            pair = text[i : i + 2]
            if pair == "{{":
                depth += 1
                i += 2
                continue
            if pair == "}}":
                depth -= 1
                i += 2
                if depth == 0:
                    break
                continue
            i += 1
        if depth != 0:
            return
        yield index, text[index + 2 : i - 2]
        start = i


def split_top_level(text: str, separator: str = "|") -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    braces = brackets = 0
    i = 0
    while i < len(text):
        pair = text[i : i + 2]
        if pair == "{{":
            braces += 1
            current.append(pair)
            i += 2
            continue
        if pair == "}}":
            braces = max(0, braces - 1)
            current.append(pair)
            i += 2
            continue
        if pair == "[[":
            brackets += 1
            current.append(pair)
            i += 2
            continue
        if pair == "]]":
            brackets = max(0, brackets - 1)
            current.append(pair)
            i += 2
            continue
        if text[i] == separator and braces == 0 and brackets == 0:
            parts.append("".join(current))
            current = []
            i += 1
            continue
        current.append(text[i])
        i += 1
    parts.append("".join(current))
    return parts


def template_params(body: str) -> dict[str, str]:
    params: dict[str, str] = {}
    for raw in split_top_level(body):
        if "=" not in raw:
            continue
        key, _, value = raw.partition("=")
        key = key.strip()
        if key:
            params[key] = value.strip()
    return params


_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
_NESTED_TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")


def clean_wiki(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<ref[^>]*>.*?</ref>", " ", value, flags=re.S | re.I)
    text = re.sub(r"<ref[^>]*/>", " ", text, flags=re.I)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = _LINK.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\{\{(?:bandera|Bandera|Bandera de|flagicon)[^{}]*\}\}", " ", text, flags=re.I)
    text = _NESTED_TEMPLATE.sub(" ", text)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("'''", "").replace("''", "")
    text = text.replace("&nbsp;", " ")
    return normalize_space(text)
