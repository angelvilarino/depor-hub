"""Wikidata: lugar de nacimiento, altura, pie, dorsal actual, redes y carrera como contraste."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import urlencode

from .http import PoliteClient, SourceError

API = "https://www.wikidata.org/w/api.php"
DEPOR_QID = "Q8760"  # Deportivo de A Coruña
USER_AGENT = "DeporHubBot/0.1"

_FOOT = {
    "left": "left",
    "zurdo": "left",
    "izquierdo": "left",
    "esquerdo": "left",
    "right": "right",
    "diestro": "right",
    "derecho": "right",
    "direito": "right",
    "both": "both",
    "ambidextrous": "both",
    "ambidiestro": "both",
    "ambidestro": "both",
}


@dataclass
class WikidataCareer:
    club: str
    from_: str | None
    to: str | None
    appearances: int | None = None
    goals: int | None = None
    seasons: list[dict] = field(default_factory=list)


@dataclass
class WikidataData:
    qid: str
    url: str
    label: str
    date_of_birth: str | None
    birth_place: str | None
    height_cm: int | None
    preferred_foot: str | None
    shirt_number: int | None
    social: dict[str, str | None]
    career: list[WikidataCareer]
    entity: dict
    aliases: list[str] = field(default_factory=list)
    image_file: str | None = None
    wiki_title: str | None = None
    wiki_lang: str = "es"
    wiki_titles: dict[str, str] = field(default_factory=dict)


def _api_url(params: dict[str, str | int]) -> str:
    return API + "?" + urlencode({**params, "format": "json", "formatversion": "2", "origin": "*"})


def _claim(entity: dict, pid: str) -> list[dict]:
    return entity.get("claims", {}).get(pid, [])


def _best(claims: list[dict]) -> dict | None:
    if not claims:
        return None
    preferred = [c for c in claims if c.get("rank") == "preferred"]
    return (preferred or claims)[0]


def _entity_id(snak: dict) -> str | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    return value.get("id") if isinstance(value, dict) else None


def _quantity(snak: dict) -> int | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    if not isinstance(value, dict) or "amount" not in value:
        return None
    try:
        return int(float(value["amount"]))
    except (TypeError, ValueError):
        return None


def _height_cm(snak: dict) -> int | None:
    """P2048 puede venir en metros (Q11573) o centímetros (Q174728)."""
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    if not isinstance(value, dict) or "amount" not in value:
        return None
    try:
        amount = float(value["amount"])
    except (TypeError, ValueError):
        return None
    unit = str(value.get("unit", ""))
    if unit.endswith("Q11573"):  # metro
        return round(amount * 100)
    if unit.endswith("Q174728"):  # centímetro
        return round(amount)
    return round(amount * 100) if amount < 3 else round(amount)


def _string(snak: dict) -> str | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    return str(value) if value is not None else None


def _date_value(snak: dict) -> str | None:
    if snak.get("snaktype") != "value":
        return None
    value = snak.get("datavalue", {}).get("value")
    if not isinstance(value, dict) or "time" not in value:
        return None
    raw = str(value["time"]).lstrip("+")
    precision = int(value.get("precision", 11))
    year, month, day = raw[:4], raw[5:7], raw[8:10]
    if precision >= 11:
        return f"{year}-{month}-{day}"
    if precision == 10:
        return f"{year}-{month}"
    return year


def _qualifier(statement: dict, pid: str) -> list[dict]:
    return statement.get("qualifiers", {}).get(pid, [])


def _qualifier_snak(statement: dict, pid: str) -> dict:
    claims = _qualifier(statement, pid)
    return claims[0].get("mainsnak", {}) if claims else {}


def _labels(client: "WikidataClient", ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    result: dict[str, str] = {}
    ids_list = sorted(ids)
    for i in range(0, len(ids_list), 40):
        batch = ids_list[i : i + 40]
        data = client.http.get_json(_api_url({
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "es|en|gl",
        }))
        for qid, entity in data.get("entities", {}).items():
            labels = entity.get("labels", {})
            result[qid] = (
                labels.get("es", {}).get("value")
                or labels.get("gl", {}).get("value")
                or labels.get("en", {}).get("value")
                or qid
            )
    return result


class WikidataClient:
    def __init__(self, http: PoliteClient) -> None:
        self.http = http

    def search(self, name: str) -> list[str]:
        data = self.http.get_json(_api_url({
            "action": "wbsearchentities",
            "search": name,
            "language": "es",
            "uselang": "es",
            "limit": 10,
            "type": "item",
        }))
        return [item["id"] for item in data.get("search", []) if item.get("id")]

    def entities(self, ids: list[str]) -> dict[str, dict]:
        if not ids:
            return {}
        data = self.http.get_json(_api_url({
            "action": "wbgetentities",
            "ids": "|".join(ids),
            "props": "claims|labels|descriptions|sitelinks",
            "languages": "es|en|gl",
        }))
        entities = data.get("entities", {})
        if not isinstance(entities, dict):
            raise SourceError("respuesta inesperada de Wikidata")
        return {k: v for k, v in entities.items() if isinstance(v, dict) and "missing" not in v}

    def resolve(self, name: str, date_of_birth: str | None) -> dict | None:
        ids = self.search(name)
        if not ids:
            return None
        entities = self.entities(ids)
        matches: list[dict] = []
        for entity in entities.values():
            dob = _date_value(_best(_claim(entity, "P569"))["mainsnak"]) if _claim(entity, "P569") else None
            if date_of_birth and dob == date_of_birth:
                matches.append(entity)
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            football = [
                e for e in matches
                if re.search(r"football|futbol|soccer", str(e.get("descriptions", {})), re.I)
            ]
            return football[0] if len(football) == 1 else None
        return None

    def extract(self, entity: dict) -> WikidataData:
        qid = str(entity.get("id", ""))
        label = (
            entity.get("labels", {}).get("es", {}).get("value")
            or entity.get("labels", {}).get("en", {}).get("value")
            or qid
        )
        referenced: set[str] = set()
        for pid in ("P19", "P54", "P8006", "P413"):
            for statement in _claim(entity, pid):
                qid_ref = _entity_id(statement.get("mainsnak", {}))
                if qid_ref:
                    referenced.add(qid_ref)
        for statement in _claim(entity, "P1618"):
            for qualifier in _qualifier(statement, "P54"):
                qid_ref = _entity_id(qualifier.get("mainsnak", {}))
                if qid_ref:
                    referenced.add(qid_ref)
        labels = _labels(self, referenced)

        birth_place = None
        p19 = _best(_claim(entity, "P19"))
        if p19:
            place = _entity_id(p19.get("mainsnak", {}))
            birth_place = labels.get(place or "") or None

        height = None
        p2048 = _best(_claim(entity, "P2048"))
        if p2048:
            height = _height_cm(p2048.get("mainsnak", {}))

        foot = None
        p8006 = _best(_claim(entity, "P8006"))
        if p8006:
            foot_id = _entity_id(p8006.get("mainsnak", {}))
            foot = _FOOT.get((labels.get(foot_id or "") or "").strip().lower())

        shirt = None
        for statement in _claim(entity, "P1618"):
            clubs = {
                _entity_id(q.get("mainsnak", {})) for q in _qualifier(statement, "P54")
            }
            if DEPOR_QID in clubs:
                value = _string(statement.get("mainsnak", {}))
                if value and value.isdigit():
                    shirt = int(value)
                    break

        social = {
            "x": _string(_best(_claim(entity, "P2002")).get("mainsnak", {})) if _claim(entity, "P2002") else None,
            "instagram": _string(_best(_claim(entity, "P2003")).get("mainsnak", {})) if _claim(entity, "P2003") else None,
            "tiktok": _string(_best(_claim(entity, "P7085")).get("mainsnak", {})) if _claim(entity, "P7085") else None,
        }

        career: list[WikidataCareer] = []
        for statement in _claim(entity, "P54"):
            club_id = _entity_id(statement.get("mainsnak", {}))
            if not club_id:
                continue
            from_ = _date_value(_qualifier_snak(statement, "P580"))
            to = _date_value(_qualifier_snak(statement, "P582"))
            appearances = _quantity(_qualifier_snak(statement, "P1350") or {})
            goals = _quantity(_qualifier_snak(statement, "P1351") or {})
            career.append(WikidataCareer(
                club=labels.get(club_id, club_id),
                from_=from_,
                to=to,
                appearances=appearances,
                goals=goals,
            ))
        career.sort(key=lambda c: (c.from_ or "9999", c.to or "9999"))

        dob = None
        p569 = _best(_claim(entity, "P569"))
        if p569:
            dob = _date_value(p569.get("mainsnak", {}))

        aliases = [
            str(item.get("value"))
            for lang in ("es", "gl", "en")
            for item in entity.get("aliases", {}).get(lang, [])
            if item.get("value")
        ]
        p18 = _best(_claim(entity, "P18"))
        image_file = _string(p18.get("mainsnak", {})) if p18 else None

        wiki_title = None
        wiki_lang = "es"
        sitelinks = entity.get("sitelinks", {})
        wiki_titles: dict[str, str] = {}
        for lang in ("es", "gl", "en", "nl", "pt", "fr", "de", "it"):
            link = sitelinks.get(f"{lang}wiki", {})
            if link.get("title"):
                wiki_titles[lang] = link["title"]
        for lang in ("es", "gl", "en"):
            link = sitelinks.get(f"{lang}wiki", {})
            if link.get("title"):
                wiki_title, wiki_lang = link["title"], lang
                break

        return WikidataData(
            qid=qid,
            url=f"https://www.wikidata.org/wiki/{qid}",
            label=label,
            date_of_birth=dob,
            birth_place=birth_place,
            height_cm=height,
            preferred_foot=foot,
            shirt_number=shirt,
            social=social,
            career=career,
            entity=entity,
            aliases=aliases,
            image_file=image_file,
            wiki_title=wiki_title,
            wiki_lang=wiki_lang,
            wiki_titles=wiki_titles,
        )

    def fetch(self, qid: str) -> WikidataData:
        entities = self.entities([qid])
        if qid not in entities:
            raise SourceError(f"Wikidata no tiene {qid}")
        return self.extract(entities[qid])


def today() -> str:
    return date.today().isoformat()


__all__ = ["WikidataClient", "WikidataData", "WikidataCareer", "DEPOR_QID"]
