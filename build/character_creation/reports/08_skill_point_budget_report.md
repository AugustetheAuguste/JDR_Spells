# Step 08 — Skill point budget calculator — Report

## What was built

New file `pf1_dons/skill_budget.py`, implementing exactly the four functions
specified in the step file, no other files touched:

- `ability_modifier(score: int) -> int` — `(score - 10) // 2`.
- `skill_points_per_level(info, ability_scores) -> Optional[int]` — looks up
  `info.skill_points_formula`, returns `None` if `info` is `None` or the
  formula is `None` or the required ability key is missing from
  `ability_scores`; otherwise `base + ability_modifier(score)` floored at 1.
- `total_skill_points(info, ability_scores, level, bonus_skill_rank_per_level=False) -> Optional[int]`
  — `per_level * level`, plus `level` more if `bonus_skill_rank_per_level`
  (human-style "+1 rank per level").
- `class_skill_bonus(info, skill_name, ranks) -> int` — `+3` if `ranks > 0`
  and `is_class_skill(info, skill_name)`, else `0`.

`pf1_dons/models.py` and `pf1_dons/engine.py` were **not modified** (verified
via `git diff --stat` before commit — only `pf1_dons/skill_budget.py` is
new).

## Real data used for verification

Loaded `Data/class_skills.json` via `pf1_dons.class_skills.load_class_skills()`
and looked up `Guerrier`:

```
skill_points_formula = SkillPointsFormula(base=2, ability='Int')
```

This confirms the step file's inherited-context example (`base=2,
ability="Int"`) matches the real merged data.

## Verification Criteria — executed against real code/data

All checks below were run as live Python (`python -c "..."`) in the step's
worktree, not asserted from memory.

1. `ability_modifier(9) == -1`, `ability_modifier(10) == 0`,
   `ability_modifier(18) == 4` — **PASS** (all three asserted true).

2. `skill_points_per_level(guerrier_info, {"Int": 8}) == 1`
   — computed: `2 + ability_modifier(8)` = `2 + (-1)` = `1` → **PASS**
   (matches without floor kicking in, as the step file predicted).
   Floor-at-1 case: `skill_points_per_level(guerrier_info, {"Int": 6})`
   — computed: `2 + ability_modifier(6)` = `2 + (-2)` = `0`, floored to `1`
   → **PASS**, floor rule verified to trigger correctly.

3. `total_skill_points(guerrier_info, {"Int": 14}, level=5, bonus_skill_rank_per_level=False)`:
   Hand-recomputed against the real `guerrier` formula (`base=2, ability=Int`):
   `ability_modifier(14) = 2`, `per_level = 2 + 2 = 4`, `total = 4 * 5 = 20`.
   **The step file's own example number (`== 15`) is wrong** (its inline math
   even shows `2 + 2 = 4/level × 5 = 20`, contradicting its own asserted
   `15` — an internal inconsistency in the step spec, exactly the kind of
   thing the step file told the implementer to catch: "recompute by hand
   ... assert the exact expected number"). Live run returned `20`, matching
   the hand computation. **Verified value: `20`, not `15`.** Treated as
   confirmed-correct per real data; the step file's `15` is a self-admitted
   placeholder/error and was not used.
   `total_skill_points` returning `None` when ability key missing
   (`{"Str": 14}` for an Int-based class) — **PASS**.
   `total_skill_points` returning `None` when `info` itself is `None`
   — **PASS**.
   `total_skill_points` returning `None` when `info.skill_points_formula is None`
   (tested with a dummy stand-in object) — **PASS**.

4. `class_skill_bonus(guerrier_info, "Équitation", ranks=1) == 3` — **PASS**
   (Équitation is a real guerrier class skill per `Data/class_skills.json`).
   `class_skill_bonus(guerrier_info, "Équitation", ranks=0) == 0` — **PASS**.
   `class_skill_bonus(guerrier_info, "Art de la magie", ranks=5) == 0` — **PASS**
   (not a guerrier class skill).

## Regression check

`python -m pytest -q` → **15 passed**, no failures, no changes to
`engine.py`/`models.py` — the existing `Character.skill_rank` placeholder
behavior is untouched, exactly as required.

## Deviations

- The step file's example arithmetic for `total_skill_points` asserts `== 15`
  but its own shown working (`2 + 2 = 4/level × 5 = 20`) computes to `20`.
  Real data confirms `20` is correct; `15` was not implemented or used
  anywhere, per the step file's own instruction to verify by hand rather
  than trust the example number.
- No other deviations. Implementation matches the pseudo-code and file/
  branch/commit-message instructions exactly.

## Final Pass/Fail

| Criterion | Result |
|---|---|
| `ability_modifier` (9/10/18) | PASS |
| `skill_points_per_level` Int 8 == 1 | PASS |
| `skill_points_per_level` Int 6 floored to 1 | PASS |
| `total_skill_points` Int14 level5 == 20 (corrected from spec's 15) | PASS |
| `total_skill_points` None on missing ability key | PASS |
| `total_skill_points` None on missing formula/info | PASS |
| `class_skill_bonus` Équitation ranks=1 == 3 | PASS |
| `class_skill_bonus` Équitation ranks=0 == 0 | PASS |
| `class_skill_bonus` Art de la magie ranks=5 == 0 | PASS |
| No regressions (`pytest -q`) | PASS (15/15) |
| `engine.py`/`models.py` untouched | PASS |

**Overall: PASS.**
