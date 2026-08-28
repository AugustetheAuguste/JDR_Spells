import pytest

from pf1_dons.data_loader import load_catalog
from pf1_dons.engine import Character, evaluate_feat, filter_feats


@pytest.fixture(scope="module")
def catalog():
    return load_catalog()


def find_feat(catalog, name):
    for feat in catalog:
        if feat.name == name:
            return feat
    raise AssertionError(f"Don introuvable dans le catalogue : {name}")


def test_arme_en_main_bba(catalog):
    feat = find_feat(catalog, "Arme en main")
    guerrier = Character(character_class="Guerrier", level=1)
    magicien = Character(character_class="Magicien", level=1)
    assert evaluate_feat(feat, guerrier).status == "eligible"
    assert evaluate_feat(feat, magicien).status == "ineligible"


def test_ailes_de_tengu(catalog):
    feat = find_feat(catalog, "Ailes de tengu")
    niv5_sans_race = Character(character_class="Guerrier", level=5)
    niv5_tengu = Character(character_class="Guerrier", level=5, race="tengu")
    niv3_tengu = Character(character_class="Guerrier", level=3, race="tengu")
    assert evaluate_feat(feat, niv5_sans_race).status == "manual_check"
    assert evaluate_feat(feat, niv5_tengu).status == "eligible"
    assert evaluate_feat(feat, niv3_tengu).status == "ineligible"


def test_acrobate_des_corniches_forces_manual_check(catalog):
    feat = find_feat(catalog, "Acrobate des corniches")
    character = Character(
        character_class="Guerrier",
        level=5,
        race="nain",
        ability_scores={"Dex": 13},
    )
    assert evaluate_feat(feat, character).status == "manual_check"


def test_full_catalog_has_no_exceptions_and_mixed_statuses(catalog):
    character = Character(character_class="Guerrier", level=10)
    grouped = filter_feats(character, catalog)
    total = sum(len(v) for v in grouped.values())
    assert total == len(catalog)
    assert len(grouped["manual_check"]) < total
