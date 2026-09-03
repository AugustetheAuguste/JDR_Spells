import pytest

from pf_dons.race_loader import get_race, load_races


@pytest.fixture(scope="module")
def races():
    return load_races()


def test_load_races_has_humain_with_bonus_feat(races):
    humain = races.get("humain")
    assert humain is not None
    assert humain.has_bonus_feat is True


def test_get_race_case_insensitive(races):
    lower = get_race(races, "humain")
    upper = get_race(races, "HUMAIN")
    assert lower is not None
    assert upper is not None
    assert lower.key == upper.key


def test_unresolved_race_has_no_bonus_feat_but_does_not_raise(races):
    result = get_race(races, "race-inexistante-xyz")
    assert result is None
