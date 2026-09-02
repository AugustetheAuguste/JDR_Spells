import pytest

from pf_dons.feat_slots import compute_feat_slots, load_class_bonus_feats
from pf_dons.race_loader import load_races


@pytest.fixture(scope="module")
def races():
    return load_races()


@pytest.fixture(scope="module")
def class_bonus_feats():
    return load_class_bonus_feats()


def test_guerrier_humain_level_1_has_general_racial_and_class_slot(races, class_bonus_feats):
    slots = compute_feat_slots("Guerrier", 1, "humain", races, class_bonus_feats)
    sources = [s.source for s in slots]
    assert sources.count("general") == 1
    assert sources.count("racial") == 1
    assert sources.count("class") == 1


def test_guerrier_level_2_adds_class_slot_not_general_slot(races, class_bonus_feats):
    slots_1 = compute_feat_slots("Guerrier", 1, None, races, class_bonus_feats)
    slots_2 = compute_feat_slots("Guerrier", 2, None, races, class_bonus_feats)
    general_1 = [s for s in slots_1 if s.source == "general"]
    general_2 = [s for s in slots_2 if s.source == "general"]
    class_1 = [s for s in slots_1 if s.source == "class"]
    class_2 = [s for s in slots_2 if s.source == "class"]
    assert len(general_2) == len(general_1)
    assert len(class_2) == len(class_1) + 1


def test_magicien_elfe_level_5_has_only_general_slots(races, class_bonus_feats):
    slots = compute_feat_slots("Ensorceleur", 5, "elfe", races, class_bonus_feats)
    sources = {s.source for s in slots}
    assert sources == {"general"}


def test_unknown_class_falls_back_to_general_slots_only(races, class_bonus_feats):
    slots = compute_feat_slots("ClasseImaginaireXYZ", 3, None, races, class_bonus_feats)
    sources = {s.source for s in slots}
    assert sources == {"general"}
