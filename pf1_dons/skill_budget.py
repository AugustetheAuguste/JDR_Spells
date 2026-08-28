"""Skill point budget calculator.

Computes the total number of skill-rank points a character has accumulated
by their current level, given their class's skill-point formula (see
``pf1_dons.class_skills``), and exposes the standard Pathfinder 1e +3
class-skill bonus rule.

This module does not touch ``pf1_dons.engine.Character.skill_rank`` at all
-- that "optimistic ranks = level" placeholder is left untouched. This is a
parallel, opt-in calculation intended for the character-creation CLI.
Allocation of ranks to specific skills stays manual; this module only
computes/validates the *budget*.
"""

from typing import Optional

from pf1_dons.class_skills import is_class_skill
from pf1_dons.models import ClassSkillInfo


def ability_modifier(score: int) -> int:
    """Standard Pathfinder 1e ability modifier, floored (e.g. Int 9 -> -1)."""
    return (score - 10) // 2


def skill_points_per_level(
    info: Optional[ClassSkillInfo], ability_scores: dict[str, int]
) -> Optional[int]:
    """Skill points gained per level for this class, or None if unknown."""
    if info is None or info.skill_points_formula is None:
        return None  # cannot compute -- raw formula text should be shown instead
    formula = info.skill_points_formula
    score = ability_scores.get(formula.ability)
    if score is None:
        return None  # ability score for the relevant stat not provided
    per_level = formula.base + ability_modifier(score)
    return max(per_level, 1)  # PF1 rule: minimum 1 skill point per level


def total_skill_points(
    info: Optional[ClassSkillInfo],
    ability_scores: dict[str, int],
    level: int,
    bonus_skill_rank_per_level: bool = False,
) -> Optional[int]:
    """Total accumulated skill points at ``level``, or None if unknown.

    ``bonus_skill_rank_per_level`` reflects racial traits such as human's
    "+1 skill rank per level" bonus (RaceInfo.bonus_skill_rank): applied
    identically at every level, so it adds ``level`` to the total.
    """
    per_level = skill_points_per_level(info, ability_scores)
    if per_level is None:
        return None
    total = per_level * level
    if bonus_skill_rank_per_level:
        total += level
    return total


def class_skill_bonus(info: ClassSkillInfo, skill_name: str, ranks: int) -> int:
    """Standard PF1 +3 bonus to a skill check for a class skill with >=1 rank."""
    if ranks > 0 and is_class_skill(info, skill_name):
        return 3
    return 0
