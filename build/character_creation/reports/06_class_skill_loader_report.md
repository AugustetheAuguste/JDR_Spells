# Step 06 — Class skills loader module — Report

## What was built

- `pf1_dons/models.py`: appended (without reordering/reformatting existing
  content) three new dataclasses: `ClassSkillEntry`, `SkillPointsFormula`,
  `ClassSkillInfo`, exactly matching the step file's pseudo-code. Added
  `Optional` to the existing `typing` import line (the only edit to
  pre-existing lines).
- `pf1_dons/class_skills.py` (new file): `load_class_skills`,
  `get_class_skill_info`, `is_class_skill`, `_build`, and
  `DEFAULT_CLASS_SKILLS_PATH = "Data/class_skills.json"`.

## Deviation from the plan's pseudo-code (and why)

The step file's pseudo-code calls a bare `_normalize` and comments "reuse
`pf1_dons.class_progression._normalize_class_name`". I verified the real
function name in `pf1_dons/class_progression.py` before relying on it: it is
`_normalize_class_name(name: str) -> str` (NFKD strip of accents + lowercase +
strip), not `_normalize`. I imported and called it under its real name,
`_normalize_class_name`, everywhere the pseudo-code used `_normalize`. This
is the only deviation from the step file; the pseudo-code's own comment
already flagged the real name, so this was a naming shortcut in the
pseudo-code, not a wrong assumption to correct.

## Evidence gathered before implementing

- Confirmed `pf1_dons/class_progression.py` really defines
  `_normalize_class_name` (module-level, not class-private) — importable as
  `from pf1_dons.class_progression import _normalize_class_name`.
- Confirmed `Data/class_skills.json`'s real `guerrier` entry:
  - `skill_points_formula` = `{"ability": "Int", "base": 2}` — matches the
    step file's example `{"base": 2, "ability": "Int"}` (dict equality is
    order-independent, so this matches).
  - `skill_points_formula_raw` = `"2 + modificateur d'Intelligence"` (real
    file has a smart apostrophe / mojibake byte when read without explicit
    UTF-8, but decodes correctly with `encoding="utf-8"`) — matches step
    file's example text.
  - `class_skills` list includes `{"ability": "Dex", "skill": "Équitation"}`
    — confirms the `is_class_skill(..., "Équitation") is True` criterion is
    checkable against real data (the step file's own example list didn't
    show "Escamotage"/"Intimidation" etc., but the real file has a superset
    including Équitation, Dressage, Escalade, Intimidation, Natation,
    Profession, Survie, Connaissances (exploration souterraine),
    Connaissances (Ingénierie), Artisanat — 41 classes total in the file).
  - "Art de la magie" is present in `alchimiste`'s skill list but absent
    from `guerrier`'s — confirms the negative criterion is a real, correct
    assertion, not a guess.

## Verification Criteria — actual run output

Ran directly against the real `Data/class_skills.json` (no mocks):

```
from pf1_dons.class_skills import load_class_skills, get_class_skill_info, is_class_skill
from pf1_dons.models import SkillPointsFormula

infos = load_class_skills()
g = infos['guerrier']
print('formula check:', g.skill_points_formula == SkillPointsFormula(base=2, ability='Int'))
print('equitation:', is_class_skill(g, 'Équitation'))
print('art de la magie:', is_class_skill(g, 'Art de la magie'))
a = get_class_skill_info(infos, 'GUERRIER')
b = get_class_skill_info(infos, 'guerrier')
print('same object:', a is b)
```

Output:
```
formula check: True
equitation: True
art de la magie: False
same object: True
```

Per-criterion pass/fail:

| Criterion | Result |
|---|---|
| `from pf1_dons.class_skills import load_class_skills, get_class_skill_info, is_class_skill` succeeds | PASS |
| `load_class_skills()["guerrier"].skill_points_formula == SkillPointsFormula(base=2, ability="Int")` | PASS |
| `is_class_skill(load_class_skills()["guerrier"], "Équitation") is True` | PASS |
| `is_class_skill(load_class_skills()["guerrier"], "Art de la magie") is False` | PASS |
| `get_class_skill_info(infos, "GUERRIER")` and `get_class_skill_info(infos, "guerrier")` return the same object | PASS (verified via `is`, same dict-value object since both normalize to key `"guerrier"`) |

All 5 verification criteria: **PASS**. No criterion was unverifiable.

## Regression check

```
python -m pytest -q
```
Output: `15 passed in 4.73s`. No regressions from the pre-existing test suite.

## Files touched

- `pf1_dons/models.py` (appended block only, existing content untouched
  aside from adding `Optional` to the `typing` import)
- `pf1_dons/class_skills.py` (new)

## Merge-conflict risk note

Per the task instructions, the `models.py` addition was kept as a clean
appended block at the end of the file, with no reordering of existing
dataclasses/enum, to minimize conflict risk with Step 05 (which is also
adding dataclasses to `models.py` in parallel).
