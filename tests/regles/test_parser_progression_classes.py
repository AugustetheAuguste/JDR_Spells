"""Step 05 parser tests, on real cached-page extracts.

Fixtures under `tests/regles/fixtures/` are trimmed, byte-real slices of
`guerrier.html` (non-caster, and the table nesting quirk: the real page wraps
the `tablo` table inside a layout `<table width="100%">`) and `magicien.html`
(caster, single-table spell slots), captured from the corpus-des-dons scrape —
not synthesized — plus one page with no progression table at all.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture()
def module_isole(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.syspath_prepend(str(RACINE / "tools" / "regles"))
    sys.modules.pop("parser_progression_classes", None)
    return importlib.import_module("parser_progression_classes")


def test_guerrier_non_lanceur(module_isole) -> None:
    module = module_isole
    lacunes: list = []
    inconnus: set[str] = set()
    resultat = module.parser_un_fichier(
        FIXTURES / "guerrier_extrait.html", urls={}, lacunes=lacunes, entetes_inconnus=inconnus
    )

    assert resultat["nom_affiche"] == "Le guerrier"
    assert resultat["de_vie"] == "d10"
    assert resultat["genre_table_sorts"] is None
    assert resultat["emplacements"] is None

    progression = resultat["progression"]
    assert progression is not None
    niveau_6 = next(p for p in progression if p["niveau"] == 6)
    assert niveau_6["bba"] == 6
    assert niveau_6["bba_serie"] == ["+6", "+1"]
    assert niveau_6["reflexes"] == 2
    assert niveau_6["vigueur"] == 5
    assert niveau_6["volonte"] == 2

    niveau_1 = next(p for p in progression if p["niveau"] == 1)
    assert niveau_1["special"] == ["Don supplémentaire"]

    # No gap should have been logged for a class whose table this parser
    # recognizes correctly, table-nesting quirk included.
    assert lacunes == []


def test_magicien_lanceur(module_isole) -> None:
    module = module_isole
    lacunes: list = []
    inconnus: set[str] = set()
    resultat = module.parser_un_fichier(
        FIXTURES / "magicien_extrait.html", urls={}, lacunes=lacunes, entetes_inconnus=inconnus
    )

    assert resultat["nom_affiche"] == "Le magicien"
    assert resultat["de_vie"] == "d6"
    assert resultat["genre_table_sorts"] == "sorts_par_jour"

    emplacements = resultat["emplacements"]
    assert emplacements is not None
    # level 1: 3 cantrips (level 0), 1 first-level slot, nothing beyond.
    assert emplacements["1"]["0"] == 3
    assert emplacements["1"]["1"] == 1
    assert emplacements["1"]["2"] is None
    # a genuinely empty cell is null, never 0.
    for valeur in emplacements["1"].values():
        assert valeur != 0 or valeur is None


def test_page_sans_table_de_progression(module_isole) -> None:
    module = module_isole
    lacunes: list = []
    inconnus: set[str] = set()
    resultat = module.parser_un_fichier(
        FIXTURES / "sans_table_extrait.html", urls={}, lacunes=lacunes, entetes_inconnus=inconnus
    )

    assert resultat["progression"] is None
    assert resultat["genre_table_sorts"] is None
    assert resultat["emplacements"] is None
    assert any(l.categorie == "sans_table_progression" for l in lacunes)
