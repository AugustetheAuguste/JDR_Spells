from __future__ import annotations

from pathlib import Path

from pf_spells.classes import CLASS_ABBREV, load_classes, lookup_abbrev


def test_load_classes_dedupes_20_to_19(repo_root: Path) -> None:
    entrees, abandons = load_classes(repo_root / "elements_to_do.json")
    assert len(entrees) == 19
    assert len(abandons) == 1


def test_dropped_duplicate_is_alchimiste(repo_root: Path) -> None:
    _, abandons = load_classes(repo_root / "elements_to_do.json")
    assert abandons[0]["label"] == "Alchimiste"
    assert abandons[0]["conserve"] == "Alchimiste"


def test_kept_entry_is_first_occurrence(repo_root: Path) -> None:
    entrees, _ = load_classes(repo_root / "elements_to_do.json")
    assert entrees[0]["label"] == "Druide"
    assert entrees[0]["slug"] == "druide"
    alchimiste = next(e for e in entrees if e["label"] == "Alchimiste")
    assert "liste%20des%20formules" in alchimiste["url"]


def test_url_key_is_decoded_and_lowercased(repo_root: Path) -> None:
    entrees, _ = load_classes(repo_root / "elements_to_do.json")
    for entree in entrees:
        assert entree["url_key"] == entree["url_key"].lower()
        assert "%20" not in entree["url_key"]


def test_slugs_are_unique(repo_root: Path) -> None:
    entrees, _ = load_classes(repo_root / "elements_to_do.json")
    slugs = [e["slug"] for e in entrees]
    assert len(set(slugs)) == len(slugs)


def test_confirmed_abbrevs_present() -> None:
    for abbrev in ("Bard", "Cham", "Inq", "Occ", "Pal", "Prê", "Magus", "Réd"):
        assert abbrev in CLASS_ABBREV
        assert lookup_abbrev(abbrev) == CLASS_ABBREV[abbrev]


def test_lookup_abbrev_unknown_returns_none() -> None:
    assert lookup_abbrev("Zzz") is None
