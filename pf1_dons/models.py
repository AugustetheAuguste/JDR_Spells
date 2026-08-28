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


# --- Race data models (added Step 05: pf1_dons/race_loader.py) ---


@dataclass
class AbilityModifier:
    ability: str  # "For"|"Dex"|"Con"|"Int"|"Sag"|"Cha"|"choice"
    modifier: int


@dataclass
class RaceInfo:
    key: str
    traits: list[dict]  # [{"name": str, "description": str}]
    ability_modifiers: list[AbilityModifier]
    size: Optional[str]
    speed: Optional[int]
    has_bonus_feat: bool
    bonus_skill_rank: bool
    class_skill_grants: list[str]
    note: Optional[str] = None


# --- Class skill data models (added Step 06: pf1_dons/class_skills.py) ---


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


# --- Feat slot model (added Step 07: pf1_dons/feat_slots.py) ---


@dataclass
class FeatSlot:
    slot_id: str            # stable id, e.g. "general-1", "racial-1", "class-4"
    source: str             # "general" | "racial" | "class"
    level_gained: int
    category_restriction: Optional[str] = None  # e.g. "combat", None = unrestricted
    filled_by: Optional[str] = None             # feat name once assigned, else None
