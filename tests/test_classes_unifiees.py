from __future__ import annotations

import json
from pathlib import Path

import pytest

LES_19_LISTES_SORTS = {
    "alchimiste",
    "antipaladin",
    "arcaniste-ensorceleur-magicien",
    "barde",
    "chaman",
    "chasseur",
    "conjurateur",
    "druide",
    "hypnotiseur",
    "inquisiteur",
    "magus",
    "medium",
    "occultiste",
    "paladin",
    "pretre-pretre-combattant-oracle",
    "psychiste",
    "sanguin",
    "sorciere",
    "spirite",
}


@pytest.fixture(scope="module")
def classes_unifiees(repo_root: Path) -> dict:
    chemin = repo_root / "data" / "conventions" / "classes_unifiees.json"
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_exactement_42_entrees(classes_unifiees: dict) -> None:
    assert len(classes_unifiees["classes"]) == 42


def test_slugs_uniques_et_tries(classes_unifiees: dict) -> None:
    slugs = [c["slug"] for c in classes_unifiees["classes"]]
    assert len(slugs) == len(set(slugs))
    assert slugs == sorted(slugs)


def test_liste_sorts_appartient_aux_19_connues(classes_unifiees: dict) -> None:
    for classe in classes_unifiees["classes"]:
        if classe["liste_sorts"] is not None:
            assert classe["liste_sorts"] in LES_19_LISTES_SORTS


def test_les_19_listes_sont_toutes_couvertes(classes_unifiees: dict) -> None:
    couvertes = {
        c["liste_sorts"] for c in classes_unifiees["classes"] if c["liste_sorts"] is not None
    }
    assert couvertes == LES_19_LISTES_SORTS


def test_regroupement_arcaniste_ensorceleur_magicien(classes_unifiees: dict) -> None:
    par_slug = {c["slug"]: c for c in classes_unifiees["classes"]}
    for slug in ("arcaniste", "ensorceleur", "magicien"):
        assert par_slug[slug]["liste_sorts"] == "arcaniste-ensorceleur-magicien"


def test_regroupement_pretre_pretre_combattant_oracle(classes_unifiees: dict) -> None:
    par_slug = {c["slug"]: c for c in classes_unifiees["classes"]}
    for slug in ("oracle", "pretre", "pretre combattant"):
        assert par_slug[slug]["liste_sorts"] == "pretre-pretre-combattant-oracle"


def test_exactement_une_entree_a_curer_et_cest_clerc(classes_unifiees: dict) -> None:
    a_curer = [c for c in classes_unifiees["classes"] if c["a_curer"]]
    assert len(a_curer) == 1
    assert a_curer[0]["slug"] == "clerc"
    assert a_curer[0]["raison_curation"]
    assert isinstance(a_curer[0]["raison_curation"], str)
    assert a_curer[0]["raison_curation"].strip() != ""


def test_toutes_les_autres_entrees_ne_sont_pas_a_curer(classes_unifiees: dict) -> None:
    for classe in classes_unifiees["classes"]:
        if classe["slug"] != "clerc":
            assert classe["a_curer"] is False
            assert classe["raison_curation"] is None


def test_lanceur_renseigne_depuis_class_caster_info(classes_unifiees: dict) -> None:
    # Étape 07 : `lanceur` est désormais lu depuis data/classes/class_caster_info.json
    # (les 42 classes du registre y sont toutes présentes ; seule
    # « chasseur de vampire », absente des 42, n'y figure pas en None ici).
    # Aucune entrée ne doit rester `null` par oubli : chaque valeur vaut
    # explicitement `True` ou `False`.
    for classe in classes_unifiees["classes"]:
        assert classe["lanceur"] in (True, False)


def test_scalde_lanceur_sans_liste_de_sorts(classes_unifiees: dict) -> None:
    scalde = next(c for c in classes_unifiees["classes"] if c["slug"] == "scalde")
    assert scalde["lanceur"] is True
    assert scalde["liste_sorts"] is None


def test_pretre_combattant_a_une_espace_pas_un_tiret(classes_unifiees: dict) -> None:
    slugs = {c["slug"] for c in classes_unifiees["classes"]}
    assert "pretre combattant" in slugs
    assert "pretre-combattant" not in slugs
