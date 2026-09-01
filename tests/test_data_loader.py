"""Garde-fou sur le recollage des `Avantages` ratés à l'import.

127 lignes de `Data/dons/Dons.csv` portent `#ERROR!` en `Avantages` alors que
leurs `Conditions` sont intactes. Les filtrer amputait le catalogue de 10 % de
ses dons et trouait le graphe de prérequis à ses nœuds les plus structurants.
"""

from pf1_dons.data_loader import (
    ERREUR_IMPORT,
    clean_feat_name,
    load_catalog,
    load_raw,
    repair_benefits,
)
from pf1_dons.models import OrGroup, RequirementType


def test_aucun_avantage_casse_ne_survit_au_recollage():
    df = repair_benefits(load_raw())
    assert (df["Avantages"] == ERREUR_IMPORT).sum() == 0


def test_le_recollage_preserve_les_avantages_valides():
    brut = load_raw()
    repare = repair_benefits(brut)

    intacts = brut["Avantages"] != ERREUR_IMPORT
    assert repare.loc[intacts, "Avantages"].equals(brut.loc[intacts, "Avantages"])


def test_les_dons_structurants_sont_au_catalogue():
    """« Endurance » est prérequis de 15 dons, « Science de la lutte » de 18 ;
    toutes deux étaient absentes, jetées pour un texte d'avantage manquant."""
    noms = {row.name for row in load_catalog()}
    for nom in ("Endurance", "Science de la lutte", "Souplesse du serpent", "Persuasion"):
        assert nom in noms


def test_tout_prerequis_de_type_don_resout_vers_le_catalogue():
    catalogue = load_catalog()
    noms = {row.name for row in catalogue}
    introuvables = set()
    for row in catalogue:
        for item in row.parsed.requirements:
            options = item.options if isinstance(item, OrGroup) else [item]
            for req in options:
                if req.type is RequirementType.FEAT:
                    nom = clean_feat_name(req.payload["feat_name"])
                    if nom not in noms:
                        introuvables.add(nom)
    assert not introuvables
