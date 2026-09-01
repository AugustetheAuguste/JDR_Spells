import pytest

from pf1_dons.class_skills import get_class_skill_info, load_class_skills
from pf1_dons.skill_budget import (
    ability_modifier,
    class_skill_bonus,
    skill_points_per_level,
    total_skill_points,
)


@pytest.fixture(scope="module")
def class_skills():
    return load_class_skills()


@pytest.mark.parametrize(
    "score,expected",
    [
        (9, -1),
        (10, 0),
        (11, 0),
        (18, 4),
    ],
)
def test_ability_modifier_table(score, expected):
    assert ability_modifier(score) == expected


def test_skill_points_per_level_floors_at_one(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    per_level = skill_points_per_level(info, {"Int": 1})
    assert per_level == 1


def test_total_skill_points_none_when_ability_missing(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    total = total_skill_points(info, {}, level=5)
    assert total is None


def test_class_skill_bonus_requires_ranks_and_class_skill(class_skills):
    info = get_class_skill_info(class_skills, "Guerrier")
    assert class_skill_bonus(info, "Escalade", ranks=1) == 3
    assert class_skill_bonus(info, "Escalade", ranks=0) == 0
    assert class_skill_bonus(info, "Art de la magie", ranks=1) == 0
