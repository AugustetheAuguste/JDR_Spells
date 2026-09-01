import json
from pathlib import Path
from typing import Optional

from pf1_dons.class_progression import _normalize_class_name
from pf1_dons.models import ClassSkillEntry, ClassSkillInfo, SkillPointsFormula
from . import paths

DEFAULT_CLASS_SKILLS_PATH = paths.CLASS_SKILLS


def _build(key: str, entry: dict) -> ClassSkillInfo:
    formula = entry.get("skill_points_formula")
    return ClassSkillInfo(
        key=key,
        class_skills=[ClassSkillEntry(**s) for s in entry.get("class_skills", [])],
        skill_points_formula=SkillPointsFormula(**formula) if formula else None,
        skill_points_formula_raw=entry.get("skill_points_formula_raw"),
    )


def load_class_skills(path: Path = DEFAULT_CLASS_SKILLS_PATH) -> dict[str, ClassSkillInfo]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {key: _build(key, entry) for key, entry in raw.items()}


def get_class_skill_info(
    infos: dict[str, ClassSkillInfo], class_name: str
) -> Optional[ClassSkillInfo]:
    return infos.get(_normalize_class_name(class_name))


def is_class_skill(info: ClassSkillInfo, skill_name: str) -> bool:
    target = _normalize_class_name(skill_name)
    return any(
        _normalize_class_name(s.skill) == target
        or _normalize_class_name(s.skill).startswith(target)
        for s in info.class_skills
    )
