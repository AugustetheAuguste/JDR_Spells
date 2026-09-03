"""Garde-fous sur la couche « prérequis lus sur la page, absents du CSV ».

`Data/dons/feat_prereq_supplements.json` (curé par
`scripts/curate_prereq_supplements.py`) ajoute aux Conditions du CSV les
prérequis *quantifiables* que la page dédiée du don énonce. Ce que ces tests
protègent, dans l'ordre d'importance :

1. la table couvre les 86 dons du relevé et n'invente rien hors de lui ;
2. tout ajout est reconnu par le parser — un ajout illisible ne produirait qu'un
   `manual_check` de plus, l'inverse du but ;
3. les fragments écartés (auto-référence, maniement d'arme, prose…) ne sont
   **jamais** appliqués : les appliquer produirait la sous-attribution que le
   principe de sûreté du dépôt interdit ;
4. sans le fichier, le catalogue est inchangé.
"""

import json

import pytest

from pf_dons import paths
from pf_dons.data_loader import (
    _concatener_conditions,
    _prereq_supplements,
    clean_feat_name,
    load_catalog,
)
from pf_dons.engine import Character, evaluate_feat
from pf_dons.models import OrGroup, RequirementType

TYPES_QUANTIFIABLES = {
    RequirementType.ABILITY_SCORE,
    RequirementType.BBA,
    RequirementType.SKILL_RANKS,
    RequirementType.FEAT,
    RequirementType.LEVEL,
    RequirementType.CLASS_LEVEL,
}


@pytest.fixture(scope="module")
def table():
    return json.loads(paths.FEAT_PREREQ_SUPPLEMENTS.read_text(encoding="utf-8"))["entries"]


@pytest.fixture(scope="module")
def catalogue():
    return {feat.name: feat for feat in load_catalog()}


def test_la_table_couvre_tout_le_releve(table):
    """Aucun don du relevé ne doit rester non tranché. L'inclusion est stricte
    dans ce sens seulement : un nouveau passage du tagueur compare la page aux
    conditions *augmentées*, donc un don déjà curé peut quitter le relevé."""
    revue = json.loads(paths.FEAT_SEMANTICS_REVIEW.read_text(encoding="utf-8"))
    assert set(revue) <= {e["don"] for e in table}


def test_chaque_fragment_releve_est_tranche(table):
    revue = json.loads(paths.FEAT_SEMANTICS_REVIEW.read_text(encoding="utf-8"))
    for entree in table:
        if entree["don"] not in revue:
            continue
        releves = revue[entree["don"]]["prerequis_non_modelises"]
        tranches = len(entree["ajouts"]) + len({i["fragment"] for i in entree["ignores"]})
        assert tranches >= len(releves), entree["don"]


def test_tous_les_dons_cures_existent_au_catalogue(table, catalogue):
    for entree in table:
        assert clean_feat_name(entree["don"]) in catalogue, entree["don"]


def test_les_ajouts_sont_tous_quantifiables(table, catalogue):
    """Un ajout doit se lire comme une caractéristique, un BBA, des rangs ou un don."""
    for entree in table:
        feat = catalogue[clean_feat_name(entree["don"])]
        ajoutes = set(entree["ajouts"])
        if not ajoutes:
            continue
        types = {
            req.type
            for req in feat.parsed.requirements
            if not isinstance(req, OrGroup) and req.raw_text.strip() in ajoutes
        }
        assert types, entree["don"]
        assert types <= TYPES_QUANTIFIABLES, (entree["don"], types)


def test_les_fragments_ecartes_ne_sont_jamais_appliques(table, catalogue):
    for entree in table:
        feat = catalogue[clean_feat_name(entree["don"])]
        for ignore in entree["ignores"]:
            assert ignore["fragment"] not in feat.prereq_supplements
            assert ignore["fragment"] not in feat.effective_conditions


def test_aucun_don_ne_se_reference_lui_meme(catalogue):
    """L'auto-référence est insatisfiable par construction : elle rendrait le don
    inaccessible à tout le monde."""
    for feat in catalogue.values():
        for req in feat.parsed.requirements:
            options = req.options if isinstance(req, OrGroup) else [req]
            for option in options:
                if option.type is RequirementType.FEAT:
                    exige = clean_feat_name(option.payload["feat_name"])
                    assert exige != feat.name, feat.name


def test_les_conditions_csv_restent_intactes(catalogue):
    """`raw_conditions` est la source à citer dans un audit ; seul `parsed` bouge."""
    feat = catalogue["Souplesse du serpent"]
    assert feat.raw_conditions == "Esquive"
    assert feat.prereq_supplements == ("Dex 13",)
    assert feat.effective_conditions == "Esquive, Dex 13"


def test_le_marqueur_aucune_condition_ne_fabrique_pas_de_segment_vide():
    assert _concatener_conditions("—", ["Dex 13"]) == "Dex 13"
    assert _concatener_conditions("", ["Dex 13"]) == "Dex 13"
    assert _concatener_conditions("Esquive", []) == "Esquive"


def test_un_ajout_rend_bien_le_don_inaccessible(catalogue):
    """Le cas d'école : « Souplesse du serpent » exige Dex 13 sur sa page, rien
    dans le CSV. Avec Esquive et Dex 12, le don doit être refusé."""
    perso = Character(
        character_class="Guerrier",
        level=6,
        race="Humain",
        known_feats={"Esquive"},
        ability_scores={"For": 14, "Dex": 12, "Con": 12, "Int": 10, "Sag": 10, "Cha": 10},
        skill_ranks={},
    )
    assert evaluate_feat(catalogue["Souplesse du serpent"], perso).status == "ineligible"

    doue = Character(
        character_class="Guerrier",
        level=6,
        race="Humain",
        known_feats={"Esquive"},
        ability_scores={"For": 14, "Dex": 13, "Con": 12, "Int": 10, "Sag": 10, "Cha": 10},
        skill_ranks={},
    )
    assert evaluate_feat(catalogue["Souplesse du serpent"], doue).status == "eligible"


def test_fichier_absent_laisse_le_catalogue_inchange(monkeypatch, tmp_path):
    monkeypatch.setattr(paths, "FEAT_PREREQ_SUPPLEMENTS", tmp_path / "absent.json")
    _prereq_supplements.cache_clear()
    try:
        catalogue = {feat.name: feat for feat in load_catalog()}
        assert catalogue["Souplesse du serpent"].prereq_supplements == ()
        assert catalogue["Souplesse du serpent"].effective_conditions == "Esquive"
    finally:
        _prereq_supplements.cache_clear()
