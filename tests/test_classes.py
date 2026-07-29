from __future__ import annotations

from pathlib import Path

from pf_spells.classes import (
    CLASS_ABBREV,
    CLASS_ABBREV_HORS_LISTE,
    LABELS_COMBINES,
    abbrevs_pour_slug,
    load_classes,
    lookup_abbrev,
)


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
    for abbrev in ("Bard", "Cham", "Inq", "Occ", "Pal", "Prê", "Magus"):
        assert abbrev in CLASS_ABBREV
        assert lookup_abbrev(abbrev) == CLASS_ABBREV[abbrev]


def test_lookup_abbrev_unknown_returns_none() -> None:
    assert lookup_abbrev("Zzz") is None


def test_only_chasseur_has_no_abbrev(repo_root: Path) -> None:
    # A roster class without an abbreviation can never concord with a spell
    # page's own `Niveau` line. Exactly one class is in that position: the
    # Chasseur has a spell list on the wiki but no `Niveau`-line abbreviation of
    # its own (its spells are marked Dru/Rôd instead). Pinned so a genuinely
    # missing mapping for any other class fails here.
    entrees, _ = load_classes(repo_root / "elements_to_do.json")
    sans = {e["slug"] for e in entrees if not abbrevs_pour_slug(e["slug"])}
    assert sans == {"chasseur"}


def test_rodeur_is_recognized_but_outside_the_roster() -> None:
    # The corpus spells it `Rôd` (not `Réd`), and Rôdeur is not one of the 19
    # classes in elements_to_do.json — so it must be a reported expectation,
    # not a roster mapping and not an unknown.
    assert lookup_abbrev("Rôd") is None
    assert "Rôd" in CLASS_ABBREV_HORS_LISTE
    assert CLASS_ABBREV_HORS_LISTE["Rôd"] == "Rôdeur"


def test_conjurateur_unchained_is_outside_the_roster() -> None:
    assert lookup_abbrev("ConU") is None
    assert CLASS_ABBREV_HORS_LISTE["ConU"] == "Conjurateur unchained"


def test_combined_labels_cover_their_members() -> None:
    for label, membres in LABELS_COMBINES.items():
        cibles = {lookup_abbrev(a) for a in membres}
        assert len(cibles) == 1, (label, cibles)
        assert None not in cibles


def test_abbrevs_pour_slug_prefers_the_longest_token() -> None:
    trouvees = abbrevs_pour_slug("arcaniste-ensorceleur-magicien")
    assert "Ens/Mag" in trouvees
    assert trouvees[0] == "ensorceleur/magicien"
    assert len(trouvees[0]) >= len(trouvees[-1])
