# Step 06 — Class skills loader module (`pf1_dons/class_skills.py`)

## Objectives

Add a package module that loads `Data/class_skills.json` into a typed
`ClassSkillInfo` dataclass with a lookup function, for use by the skill
point budget calculator (Step 08).

## Dependencies & Parallelization

- **Wave 2.** Depends on Step 02 (`Data/class_skills.json` must exist with
  the shape below). No dependency on Step 01/03/04. Can run in parallel
  with Step 05.

## Inherited Context from Step 02

`Data/class_skills.json` shape (one entry per class key, matching
`pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION` keys):
```json
{
  "guerrier": {
    "class_skills": [
      {"skill": "Artisanat", "ability": "Int"},
      {"skill": "Connaissances (exploration souterraine)", "ability": "Int"},
      {"skill": "Connaissances (Ingénierie)", "ability": "Int"},
      {"skill": "Équitation", "ability": "Dex"}
    ],
    "skill_points_formula_raw": "2 + modificateur d'Intelligence",
    "skill_points_formula": {"base": 2, "ability": "Int"}
  }
}
```
`skill_points_formula` may be `null` for a class whose formula text didn't
match the standard `N + modificateur d'Ability` pattern — the raw text is
always present as a fallback for human inspection, but `null` structured
formula means Step 08 cannot compute a numeric budget for that class (must
surface this rather than guessing).

## Pseudo-code

In `pf1_dons/models.py`, add:
```python
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
```

New file `pf1_dons/class_skills.py`:
```python
DEFAULT_CLASS_SKILLS_PATH = "Data/class_skills.json"

def load_class_skills(path: str = DEFAULT_CLASS_SKILLS_PATH) -> dict[str, ClassSkillInfo]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {key: _build(key, entry) for key, entry in raw.items()}

def _build(key, entry) -> ClassSkillInfo:
    formula = entry.get("skill_points_formula")
    return ClassSkillInfo(
        key=key,
        class_skills=[ClassSkillEntry(**s) for s in entry.get("class_skills", [])],
        skill_points_formula=SkillPointsFormula(**formula) if formula else None,
        skill_points_formula_raw=entry.get("skill_points_formula_raw"),
    )

def get_class_skill_info(infos: dict[str, ClassSkillInfo], class_name: str) -> Optional[ClassSkillInfo]:
    return infos.get(_normalize(class_name))  # reuse pf1_dons.class_progression._normalize_class_name

def is_class_skill(info: ClassSkillInfo, skill_name: str) -> bool:
    target = _normalize(skill_name)
    return any(_normalize(s.skill) == target or _normalize(s.skill).startswith(target) for s in info.class_skills)
```

## Logic Flow

1. Load and parse `Data/class_skills.json` once via `load_class_skills()`.
2. Build one `ClassSkillInfo` per class key.
3. Expose `get_class_skill_info()` for case/accent-insensitive lookup by a
   user-supplied class string (mirrors
   `pf1_dons/class_progression.py::_normalize_class_name` usage in
   `get_bba`).
4. Expose `is_class_skill()` as a small helper Step 08 needs to determine
   the +3 class-skill bonus rule (standard PF1 rule: a class skill with at
   least 1 rank gets a flat +3 bonus — noted here for Step 08's contract,
   not implemented in this step).

## Implementation Notes

- Import `_normalize_class_name` from `pf1_dons.class_progression` for the
  class-name lookup (already public-ish, used the same way `get_bba` uses
  it internally) rather than duplicating it a third time.
- `is_class_skill`'s `.startswith(target)` fallback handles the case where a
  caller passes the base skill name ("Connaissances") without the
  sub-specialization suffix — treat any sub-specialized entry as matching
  the bare base name for "is this a class skill at all" purposes; exact
  sub-specialization matching (if ever needed) is out of scope here.

## Verification Criteria

- `from pf1_dons.class_skills import load_class_skills, get_class_skill_info, is_class_skill` succeeds.
- `load_class_skills()["guerrier"].skill_points_formula == SkillPointsFormula(base=2, ability="Int")`.
- `is_class_skill(load_class_skills()["guerrier"], "Équitation") is True`.
- `is_class_skill(load_class_skills()["guerrier"], "Art de la magie") is False` (not a fighter class skill).
- `get_class_skill_info(infos, "GUERRIER")` and `get_class_skill_info(infos, "guerrier")` return the same object.

## Git Handling

- Branch: `feature/character-creation/06-class-skill-loader`.
- Commit `pf1_dons/models.py` additions and new `pf1_dons/class_skills.py`.
- Commit message: `pf1_dons(06): add ClassSkillInfo model and class skills loader`.

## Expected Outcome

A typed way to query per-class skill lists and skill-point formulas,
consumed by Step 08.
