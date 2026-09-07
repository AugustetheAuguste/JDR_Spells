"""Offline tests for `tools/regles/parser_tables_universelles.py`, driven by
the real cached bytes under `cache/html_regles/` — never the network, and
never a hand-written fixture, so a wiki markup change is caught by the same
route a human would notice it (cf. `pf-corpus-conventions` posture: read the
cache the fetcher actually wrote).

Skipped outright if the cache has not been populated yet (a fresh clone,
before `recuperer_pages_regles.py` has run) — that is the one tolerated gap,
mirroring the check-contract script's own "not populated yet" exemption.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[2]
CACHE_DIR = RACINE / "cache" / "html_regles"

pytestmark = pytest.mark.skipif(
    not CACHE_DIR.exists() or not any(CACHE_DIR.glob("*.html")),
    reason="cache/html_regles/ non peuplé — lancer tools/regles/recuperer_pages_regles.py",
)


@pytest.fixture()
def module():
    racine_src = str(RACINE / "tools" / "regles")
    sys.path.insert(0, racine_src)
    sys.modules.pop("parser_tables_universelles", None)
    mod = importlib.import_module("parser_tables_universelles")
    yield mod
    sys.path.remove(racine_src)


def test_modificateurs_bounds_and_no_extrapolation(module) -> None:
    soup = module._contenu("caracteristiques")
    donnees, rapport = module.parser_modificateurs(soup)
    assert rapport["borne_basse"] == 1
    assert rapport["borne_haute"] == 45
    bornes = donnees["bornes"]
    assert bornes[0] == {"min": 1, "max": 1, "modificateur": -5}
    assert bornes[-1] == {"min": 44, "max": 45, "modificateur": 17}
    # Every borne covers a contiguous +1 step of modificateur.
    for a, b in zip(bornes, bornes[1:]):
        assert b["modificateur"] == a["modificateur"] + 1


def test_sorts_bonus_empty_cells_are_null_never_zero(module) -> None:
    soup = module._contenu("caracteristiques")
    donnees, rapport = module.parser_sorts_bonus(soup)
    par_mod = donnees["par_modificateur"]
    # Negative modifiers cannot cast at all: every level is null, not 0.
    assert par_mod["-5"]["1"] is None
    # Niveau 0 (cantrips) never gets a bonus slot: null everywhere.
    assert all(par_mod[m]["0"] is None for m in par_mod)
    # Known anchor values from the table, read by hand from the source.
    assert par_mod["1"]["1"] == 1
    assert par_mod["5"]["1"] == 2
    assert par_mod["17"]["1"] == 5
    assert rapport["modificateur_maximal_lu"] == 17


def test_types_bonus_esquive_is_cumulable_others_left_null(module) -> None:
    soup_combat = module._contenu("valeurs-de-combat")
    soup_vocab = module._contenu("vocabulaire-courant")
    donnees, rapport = module.parser_types_bonus(soup_combat, soup_vocab)
    par_cle = {t["cle"]: t for t in donnees["types"]}
    assert par_cle["esquive"]["cumulable"] is True
    assert "cumulent" in par_cle["esquive"]["note"]
    # No invented type: "force" (an unrelated damage rule on the same page)
    # must never appear here.
    assert "force" not in par_cle
    for cle, entree in par_cle.items():
        if cle != "esquive":
            assert entree["cumulable"] is None
    assert donnees["regle_generale"] is not None
    assert "ne se cumulent pas" in donnees["regle_generale"]


def test_armures_categories_and_null_cells(module) -> None:
    soup = module._contenu("tableau-recapitulatif-des-armures")
    donnees, rapport = module.parser_armures(soup)
    armures = donnees["armures"]
    assert rapport["total"] == len(armures) > 0
    categories = {a["categorie"] for a in armures}
    assert categories == {"legere", "intermediaire", "lourde", "bouclier", "supplement"}
    # A shield's "Dex max" cell is empty on the source table -> null.
    ecu = next(a for a in armures if a["nom"].startswith("Écu"))
    assert ecu["dex_max"] is None
    # A cell holding a real "0" must survive as "0", never collapse to null.
    plaques = next(a for a in armures if a["nom"] == "Armure de plaques")
    assert plaques["dex_max"] == "0"


def test_idempotent_across_two_runs(module, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(module, "OUT_DIR", tmp_path / "regles")
    monkeypatch.setattr(module, "REPORT_PATH", tmp_path / "rapport.md")
    module.executer()
    premiers = {p.name: p.read_bytes() for p in (tmp_path / "regles").glob("*.json")}
    module.executer()
    seconds = {p.name: p.read_bytes() for p in (tmp_path / "regles").glob("*.json")}
    assert premiers == seconds
