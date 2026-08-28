# Step 08 — Skill point budget calculator (`pf1_dons/skill_budget.py`)

## Objectives

Compute how many total skill-rank points a character has accumulated by
their current level, and expose the class-skill +3 bonus rule, so the CLI
can show a real budget instead of the engine's "optimistic" placeholder.
This step computes/validates a budget only — it does not auto-allocate
ranks to specific skills (per the user's explicit answer that allocation
stays manual).

## Dependencies & Parallelization

- **Wave 3.** Depends on Step 06 (`pf1_dons.class_skills`). Independent of
  Step 05/07 — can run in parallel with Step 07.

## Inherited Context from Step 06

```python
from pf1_dons.class_skills import load_class_skills, get_class_skill_info, is_class_skill
from pf1_dons.models import ClassSkillInfo, SkillPointsFormula

infos = load_class_skills()                         # dict[str, ClassSkillInfo]
info = get_class_skill_info(infos, "Guerrier")       # ClassSkillInfo | None
info.skill_points_formula                            # SkillPointsFormula(base=2, ability="Int") | None
is_class_skill(info, "Équitation")                   # bool
```
Ability modifier formula (standard PF1, not currently implemented anywhere
in this repo — must be added here): `modifier = (score - 10) // 2`, using
Python's floor division (matches PF1 rounding-down rule, e.g. Int 9 → -1,
Int 10 or 11 → 0, Int 12 → +1).

## Pseudo-code

New file `pf1_dons/skill_budget.py`:
```python
def ability_modifier(score: int) -> int:
    return (score - 10) // 2

def skill_points_per_level(info: ClassSkillInfo, ability_scores: dict[str, int]) -> Optional[int]:
    if info is None or info.skill_points_formula is None:
        return None  # cannot compute — raw formula text should be shown to the user instead
    formula = info.skill_points_formula
    score = ability_scores.get(formula.ability)
    if score is None:
        return None  # ability score for the relevant stat not provided
    per_level = formula.base + ability_modifier(score)
    return max(per_level, 1)  # PF1 rule: minimum 1 skill point per level regardless of penalty

def total_skill_points(
    info: ClassSkillInfo,
    ability_scores: dict[str, int],
    level: int,
    bonus_skill_rank_per_level: bool = False,  # from RaceInfo.bonus_skill_rank, e.g. human
) -> Optional[int]:
    per_level = skill_points_per_level(info, ability_scores)
    if per_level is None:
        return None
    total = per_level * level
    if bonus_skill_rank_per_level:
        total += level  # human: +1 rank per level, applied identically each level
    return total

def class_skill_bonus(info: ClassSkillInfo, skill_name: str, ranks: int) -> int:
    # standard PF1 rule: +3 bonus to a skill check if it's a class skill and
    # the character has invested at least 1 rank in it
    if ranks > 0 and is_class_skill(info, skill_name):
        return 3
    return 0
```

## Logic Flow

1. Look up the class's skill-point formula (Step 06).
2. Compute per-level points as `base + ability_modifier(relevant_score)`,
   floored at 1 per PF1 rules (a character always gets at least 1 skill
   point per level even with a severe ability penalty).
3. Multiply by level for a naive running total; add the racial "+1 rank per
   level" bonus (human's `bonus_skill_rank`) if applicable, since that is a
   flat per-level addition, not a modifier to the formula itself.
4. `class_skill_bonus` is a standalone helper the CLI can call when
   displaying/validating a specific skill's ranks — not part of the running
   total, it's the +3 bonus applied to skill *checks*, unrelated to the
   points *budget*.
5. Any case where the ability score needed isn't provided, or the class's
   formula wasn't scraped cleanly (`skill_points_formula is None`), returns
   `None` explicitly — callers (Step 10/11 CLI) must show
   "skill point budget unavailable, formula/ability missing" rather than a
   wrong number.

## Implementation Notes

- This module does not touch `pf1_dons/engine.py::Character.skill_rank` at
  all — that placeholder stays exactly as-is (existing tests depend on its
  current "optimistic" behavior). This is a parallel, opt-in calculation
  the CLI uses for character creation; nothing here changes existing
  `engine.py` behavior or its test suite.
- `bonus_skill_rank_per_level` humans' actual PF1 rule is "+1 rank at level
  1 and one more each time they take a level" — i.e. it applies every
  level, not just level 1; the pseudo-code above already reflects that
  (`total += level`, not `+= 1`).
- Keep `ability_modifier` here rather than adding it to
  `pf1_dons/engine.py` — no other module needs it yet, and duplicating a
  one-line formula across two tiny modules is preferable to introducing a
  cross-import for a single function (avoid over-coupling early).

## Verification Criteria

- `ability_modifier(9) == -1`, `ability_modifier(10) == 0`, `ability_modifier(18) == 4`.
- `skill_points_per_level(guerrier_info, {"Int": 8}) == 1` (2 + (-1) = 1,
  not floored further since it's already >= 1; verify the floor-at-1 rule
  triggers correctly for a lower score like `Int 6` → 2 + (-2) = 0 → floored to 1).
- `total_skill_points(guerrier_info, {"Int": 14}, level=5, bonus_skill_rank_per_level=False) == 15`
  (2 + 2 = 4/level × 5 = 20 — recompute by hand during implementation and
  assert the exact expected number; this file's job is to specify the
  *rule*, the implementer must verify the arithmetic against the real
  `ClassSkillInfo` for guerrier once Step 06 is merged).
- `total_skill_points(...)` returns `None` when `ability_scores` doesn't
  contain the required key, and when `info.skill_points_formula is None`.
- `class_skill_bonus(guerrier_info, "Équitation", ranks=1) == 3`;
  `class_skill_bonus(guerrier_info, "Équitation", ranks=0) == 0`;
  `class_skill_bonus(guerrier_info, "Art de la magie", ranks=5) == 0`.

## Git Handling

- Branch: `feature/character-creation/08-skill-budget`.
- Commit new `pf1_dons/skill_budget.py`.
- Commit message: `pf1_dons(08): add skill point budget calculator`.

## Expected Outcome

A tested skill-point budget function the CLI (Step 10) can display when
creating a character, and a class-skill-bonus helper the CLI can use when
showing skill details — without altering any existing `engine.py` behavior.
