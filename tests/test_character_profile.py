import json
from pathlib import Path

import pytest

from pf1_dons import paths
from pf1_dons.character_profile import (
    SlotAssignmentError,
    assign_feat,
    create_profile,
    eligible_feats_for_slot,
    unassign_feat,
)
from pf1_dons.data_loader import load_catalog
from pf1_dons.feat_slots import load_class_bonus_feats
from pf1_dons.race_loader import load_races


@pytest.fixture(scope="module")
def catalog():
    return load_catalog()


@pytest.fixture(scope="module")
def races():
    return load_races()


@pytest.fixture(scope="module")
def class_bonus_feats():
    return load_class_bonus_feats()


@pytest.fixture(scope="module")
def feat_categories():
    return json.loads(Path(paths.FEAT_CATEGORIES).read_text(encoding="utf-8"))


def test_create_profile_slot_count(races, class_bonus_feats):
    profile = create_profile(
        "Test Guerrier", "Guerrier", 1, "humain", {}, races, class_bonus_feats
    )
    assert len(profile.feat_slots) == 3
    assert len(profile.open_slots()) == 3


def test_eligible_feats_for_slot_includes_known_eligible_feat(
    catalog, races, class_bonus_feats, feat_categories
):
    profile = create_profile(
        "Test Guerrier 2", "Guerrier", 1, None, {}, races, class_bonus_feats
    )
    slot = profile.open_slots()[0]
    candidates = eligible_feats_for_slot(profile, slot, catalog, feat_categories)
    names = {f.name for f in candidates}
    assert "Arme en main" in names


def test_assign_feat_fills_slot(races, class_bonus_feats):
    profile = create_profile(
        "Test Assign", "Guerrier", 1, None, {}, races, class_bonus_feats
    )
    slot = profile.open_slots()[0]
    assign_feat(profile, slot.slot_id, "Arme en main")
    filled = profile.find_slot(slot.slot_id)
    assert filled.filled_by == "Arme en main"


def test_assign_duplicate_feat_raises(races, class_bonus_feats):
    profile = create_profile(
        "Test Dup", "Guerrier", 1, "humain", {}, races, class_bonus_feats
    )
    open_slots = profile.open_slots()
    assign_feat(profile, open_slots[0].slot_id, "Arme en main")
    with pytest.raises(SlotAssignmentError):
        assign_feat(profile, open_slots[1].slot_id, "Arme en main")


def test_assign_to_filled_slot_raises(races, class_bonus_feats):
    profile = create_profile(
        "Test Filled", "Guerrier", 1, None, {}, races, class_bonus_feats
    )
    slot = profile.open_slots()[0]
    assign_feat(profile, slot.slot_id, "Arme en main")
    with pytest.raises(SlotAssignmentError):
        assign_feat(profile, slot.slot_id, "Autre Don")


def test_unassign_reopens_slot(races, class_bonus_feats):
    profile = create_profile(
        "Test Unassign", "Guerrier", 1, None, {}, races, class_bonus_feats
    )
    slot = profile.open_slots()[0]
    assign_feat(profile, slot.slot_id, "Arme en main")
    unassign_feat(profile, slot.slot_id)
    reopened = profile.find_slot(slot.slot_id)
    assert reopened.filled_by is None
    assert slot.slot_id in {s.slot_id for s in profile.open_slots()}
