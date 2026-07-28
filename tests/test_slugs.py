from __future__ import annotations

import pytest

from pf_spells.slugs import dedupe_slug, slugify

PINNED = [
    ("Armes contre le mal", "armes-contre-le-mal"),
    ("Cœur incassable", "coeur-incassable"),
    ("Requiem pour les fantômes", "requiem-pour-les-fantomes"),
    ("Bouclier de la Fleur de l'Aube", "bouclier-de-la-fleur-de-l-aube"),
    ("Détection de la magie", "detection-de-la-magie"),
]


@pytest.mark.parametrize(("nom", "attendu"), PINNED)
def test_slugify_pinned_examples(nom: str, attendu: str) -> None:
    assert slugify(nom) == attendu


def test_slugify_is_deterministic() -> None:
    assert slugify("Cœur incassable") == slugify("Cœur incassable")


def test_slugify_strips_edge_separators() -> None:
    assert slugify("  « Requiem » !  ") == "requiem"


def test_dedupe_slug_collision_sequence() -> None:
    seen: set[str] = set()
    assert dedupe_slug("armes-contre-le-mal", seen) == "armes-contre-le-mal"
    assert dedupe_slug("armes-contre-le-mal", seen) == "armes-contre-le-mal-2"
    assert dedupe_slug("armes-contre-le-mal", seen) == "armes-contre-le-mal-3"
    assert seen == {
        "armes-contre-le-mal",
        "armes-contre-le-mal-2",
        "armes-contre-le-mal-3",
    }


def test_dedupe_slug_skips_preexisting_suffix() -> None:
    seen = {"requiem", "requiem-2"}
    assert dedupe_slug("requiem", seen) == "requiem-3"
