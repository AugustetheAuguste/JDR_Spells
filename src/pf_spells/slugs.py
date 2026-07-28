"""Deterministic slug generation for spell and class identifiers.

Stdlib only: `unidecode` is deliberately not used.
"""

from __future__ import annotations

import re
import unicodedata

_LIGATURES = {
    "œ": "oe",  # oe
    "Œ": "OE",  # OE
    "æ": "ae",  # ae
    "Æ": "AE",  # AE
}

_NON_SLUG = re.compile(r"[^a-z0-9]+")


def slugify(nom: str) -> str:
    """Return a lowercase ASCII hyphen slug for `nom`."""
    texte = nom
    for source, cible in _LIGATURES.items():
        texte = texte.replace(source, cible)
    decompose = unicodedata.normalize("NFKD", texte)
    sans_marques = "".join(c for c in decompose if not unicodedata.combining(c))
    return _NON_SLUG.sub("-", sans_marques.lower()).strip("-")


def dedupe_slug(slug: str, seen: set[str]) -> str:
    """Return `slug`, suffixed with -2, -3, ... if already in `seen`.

    Mutates `seen` by adding the returned value.
    """
    if slug not in seen:
        seen.add(slug)
        return slug
    n = 2
    while f"{slug}-{n}" in seen:
        n += 1
    unique = f"{slug}-{n}"
    seen.add(unique)
    return unique
