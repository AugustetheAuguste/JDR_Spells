import pytest

from pf_dons.class_skills import get_class_skill_info, is_class_skill, load_class_skills


@pytest.fixture(scope="module")
def class_skills():
    return load_class_skills()


def test_guerrier_skill_points_formula(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    assert info is not None
    assert info.skill_points_formula is not None
    assert info.skill_points_formula.base == 2
    assert info.skill_points_formula.ability == "Int"


def test_is_class_skill_true_for_class_skill(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    assert is_class_skill(info, "Escalade") is True


def test_is_class_skill_false_for_non_class_skill(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    assert is_class_skill(info, "Art de la magie") is False
