from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Union


class RequirementType(Enum):
    ABILITY_SCORE = "ability_score"
    BBA = "bba"
    LEVEL = "level"
    SKILL_RANKS = "skill_ranks"
    CASTER_LEVEL = "caster_level"
    SIZE = "size"
    FEAT = "feat"
    RACE = "race"
    CLASS = "class"
    CLASS_FEATURE_TEXT = "class_feature_text"
    UNPARSED = "unparsed"


@dataclass
class Requirement:
    type: RequirementType
    raw_text: str
    payload: dict = field(default_factory=dict)
    needs_manual_check: bool = False


@dataclass
class OrGroup:
    options: list["Requirement"]
    raw_text: str = ""


RequirementOrGroup = Union[Requirement, OrGroup]


@dataclass
class ParsedConditions:
    requirements: list[RequirementOrGroup] = field(default_factory=list)

    @property
    def has_unparsed(self) -> bool:
        for req in self.requirements:
            if isinstance(req, OrGroup):
                if any(o.type == RequirementType.UNPARSED for o in req.options):
                    return True
            elif req.type == RequirementType.UNPARSED:
                return True
        return False


@dataclass
class ClassSkillEntry:
    skill: str
    ability: str  # For/Dex/Con/Int/Sag/Cha


@dataclass
class SkillPointsFormula:
    base: int
    ability: str


@dataclass
class ClassSkillInfo:
    key: str
    class_skills: list[ClassSkillEntry]
    skill_points_formula: Optional[SkillPointsFormula]
    skill_points_formula_raw: Optional[str]
