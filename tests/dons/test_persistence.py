import pytest

from pf1_dons.character_profile import CharacterProfile
from pf1_dons.models import FeatSlot
from pf1_dons.persistence import list_characters, load_profile, save_profile


def _make_profile(name="Test Persist"):
    return CharacterProfile(
        name=name,
        character_class="Guerrier",
        level=1,
        race="humain",
        ability_scores={"For": 16},
        skill_ranks={},
        feat_slots=[FeatSlot(slot_id="general-1", source="general", level_gained=1)],
    )


def test_save_then_load_round_trip(tmp_path):
    profile = _make_profile()
    save_profile(profile, base_dir=tmp_path)
    loaded = load_profile(profile.name, base_dir=tmp_path)
    assert loaded.name == profile.name
    assert loaded.character_class == profile.character_class
    assert loaded.level == profile.level
    assert loaded.race == profile.race
    assert loaded.ability_scores == profile.ability_scores
    assert len(loaded.feat_slots) == 1
    assert loaded.feat_slots[0].slot_id == "general-1"


def test_load_missing_character_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_profile("Personnage Inexistant", base_dir=tmp_path)


def test_list_characters_empty_dir(tmp_path):
    assert list_characters(base_dir=tmp_path / "does_not_exist") == []


def test_list_characters_after_saving_two(tmp_path):
    save_profile(_make_profile("Perso A"), base_dir=tmp_path)
    save_profile(_make_profile("Perso B"), base_dir=tmp_path)
    names = list_characters(base_dir=tmp_path)
    assert names == sorted(names)
    assert len(names) == 2
