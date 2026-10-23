import pytest

from depor_hub import models as m
from depor_hub.extras import ExtrasError, apply_extras, load_extras, unknown_ids


def squad():
    return m.Squad(
        updated_at="2026-10-20T10:00:00Z",
        players=[
            m.Player(id=1, name="A", shirt_number=5),
            m.Player(id=2, name="B"),
        ],
    )


def write(tmp_path, text):
    f = tmp_path / "extras.yml"
    f.write_text(text, encoding="utf-8")
    return f


def test_missing_or_comment_only_file_is_empty(tmp_path):
    assert load_extras(tmp_path / "nope.yml") == {}
    assert load_extras(write(tmp_path, "# solo comentarios\nplayers:\n")) == {}


def test_fills_gaps_but_api_value_wins(tmp_path):
    f = write(
        tmp_path,
        "players:\n  1: {shirt_number: 9, height_cm: 180, source: club}\n"
        "  2: {shirt_number: 7, contract_until: 2028-06-30, source: club}\n",
    )
    extras = load_extras(f)
    out = apply_extras(squad(), extras)
    a, b = out.players
    assert (a.shirt_number, a.height_cm) == (5, 180)  # dorsal de la API intacto
    assert (b.shirt_number, b.contract_until, b.height_cm) == (7, "2028-06-30", None)


def test_source_is_required_when_data_present(tmp_path):
    with pytest.raises(ExtrasError, match="source"):
        load_extras(write(tmp_path, "players:\n  2: {shirt_number: 7}\n"))


def test_rejects_unknown_keys_and_bad_values(tmp_path):
    with pytest.raises(ExtrasError):
        load_extras(write(tmp_path, "players:\n  2: {dorsal: 7, source: x}\n"))
    with pytest.raises(ExtrasError):
        load_extras(write(tmp_path, "players:\n  2: {contract_until: mañana, source: x}\n"))
    with pytest.raises(ExtrasError):
        load_extras(write(tmp_path, "otra: 1\n"))


def test_unknown_ids_reported(tmp_path):
    extras = load_extras(write(tmp_path, "players:\n  99: {height_cm: 180, source: x}\n"))
    assert unknown_ids(squad(), extras) == [99]


def test_height_field_is_public_and_defaults_to_null():
    assert m.Player(id=3, name="C").height_cm is None
