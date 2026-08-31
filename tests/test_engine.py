import pytest

from pf1_dons.data_loader import FeatRow, load_catalog
from pf1_dons.engine import Character, evaluate_feat, evaluate_requirement, filter_feats
from pf1_dons.models import ParsedConditions, Requirement, RequirementType


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


def test_acrobate_des_corniches_resout_les_traits_raciaux(catalog):
    """« Dex 13, nain, trait racial montagnard ou stabilité » : les traits
    raciaux sont désormais confrontés à Data/races.json au lieu d'être
    systématiquement renvoyés en vérification manuelle."""
    feat = find_feat(catalog, "Acrobate des corniches")
    nain = Character(
        character_class="Guerrier",
        level=5,
        race="nain",
        ability_scores={"Dex": 13},
    )
    # Le nain possède bien le trait « Stabilité », donc l'alternative est tenue.
    assert evaluate_feat(feat, nain).status == "eligible"

    humain = Character(
        character_class="Guerrier",
        level=5,
        race="humain",
        ability_scores={"Dex": 13},
    )
    # ...et un humain échoue dès le prérequis de race.
    assert evaluate_feat(feat, humain).status == "ineligible"


def test_full_catalog_has_no_exceptions_and_mixed_statuses(catalog):
    character = Character(character_class="Guerrier", level=10)
    grouped = filter_feats(character, catalog)
    total = sum(len(v) for v in grouped.values())
    assert total == len(catalog)
    assert len(grouped["manual_check"]) < total


def test_implied_classes_mismatch_returns_false():
    req = Requirement(
        type=RequirementType.CLASS_FEATURE_TEXT,
        raw_text="capacité de classe d'oracle",
        payload={"text": "capacité de classe d'oracle", "implied_classes": ["oracle"]},
    )
    guerrier = Character(character_class="Guerrier", level=1)
    ok, _reason = evaluate_requirement(req, guerrier)
    assert ok is False


def test_implied_classes_match_returns_none():
    req = Requirement(
        type=RequirementType.CLASS_FEATURE_TEXT,
        raw_text="capacité de classe d'oracle",
        payload={"text": "capacité de classe d'oracle", "implied_classes": ["oracle"]},
    )
    oracle = Character(character_class="Oracle", level=1)
    ok, _reason = evaluate_requirement(req, oracle)
    assert ok is None


def test_class_feature_text_without_implied_classes_stays_manual_check():
    req = Requirement(
        type=RequirementType.CLASS_FEATURE_TEXT,
        raw_text="une capacité de classe non identifiée",
        payload={"text": "une capacité de classe non identifiée"},
    )
    for character in (
        Character(character_class="Guerrier", level=1),
        Character(character_class="Oracle", level=1),
    ):
        ok, _reason = evaluate_requirement(req, character)
        assert ok is None


def test_evaluate_feat_end_to_end_implied_classes():
    req = Requirement(
        type=RequirementType.CLASS_FEATURE_TEXT,
        raw_text="capacité de classe d'oracle",
        payload={"text": "capacité de classe d'oracle", "implied_classes": ["oracle"]},
    )
    feat = FeatRow(
        name="don-de-test-oracle",
        display_name="Don de test oracle",
        source="Test",
        raw_conditions="capacité de classe d'oracle",
        benefits="Bénéfice de test.",
        parsed=ParsedConditions(requirements=[req]),
    )
    guerrier = Character(character_class="Guerrier", level=1)
    oracle = Character(character_class="Oracle", level=1)
    assert evaluate_feat(feat, guerrier).status == "ineligible"
    assert evaluate_feat(feat, oracle).status == "manual_check"
