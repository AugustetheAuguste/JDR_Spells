# Step 07 — Feat Slot Calculator — Report

## What was built

- `pf1_dons/models.py`: appended a new `FeatSlot` dataclass at the end of
  the file (clean new block, nothing reordered/reformatted):
  `slot_id: str`, `source: str`, `level_gained: int`,
  `category_restriction: Optional[str] = None`, `filled_by: Optional[str] = None`.
- `pf1_dons/feat_slots.py` (new file): `DEFAULT_CLASS_BONUS_FEATS_PATH`,
  `load_class_bonus_feats(path=...)`, `general_slot_levels(max_level)`,
  `compute_feat_slots(character_class, level, race_name, races, class_bonus_feats)`.
  Implementation matches the step's pseudo-code exactly, reusing
  `_normalize_class_name` from `pf1_dons.class_progression` and `get_race`
  from `pf1_dons.race_loader` (no duplicated logic).

## Pre-implementation verification of assumptions

Ran real code against real data before writing anything:

- `Data/class_bonus_feats.json` — confirmed shape; `guerrier` entry has
  `bonus_feat_levels: [1,2,4,6,8,10,12,14,16,18,20]`, `category_restriction: null`,
  exactly as the step file states.
- `pf1_dons.class_progression._normalize_class_name` — confirmed importable
  and usable (`from .class_progression import _normalize_class_name`).
- `pf1_dons.race_loader.get_race(load_races(), "Humain")` — confirmed
  `has_bonus_feat == True`. `get_race(load_races(), "Elfe")` — confirmed
  `has_bonus_feat == False`.
- Cross-checked `CLASS_BBA_PROGRESSION` keys (class_progression.py) against
  `Data/class_bonus_feats.json` keys: 4 classes present in the BBA table are
  **absent** from `class_bonus_feats.json`: `chasseur de vampire`,
  `pretre combattant`, `cavalier`, `clerc` (note: `class_bonus_feats.json`
  uses underscore keys `chasseur_de_vampire` / `pretre_combattant` while
  `CLASS_BBA_PROGRESSION` uses space-separated keys — these are different
  normalized forms and don't match `.get()` lookups; `cavalier`/`clerc` are
  aliases with no entry at all). This confirms the step file's warning
  ("class_bonus_feats coverage depends on Data/class_features.json coverage,
  which may not include every class... verify this during implementation
  and log any mismatch") — logged here. Per spec this must not raise: for
  these 4 classes, `compute_feat_slots` correctly falls back to zero class
  bonus slots (verified: general/racial slots still compute normally).

## Verification Criteria — literal executable results

Ran the following against real `Data/races.json` and
`Data/class_bonus_feats.json` (loaded via `load_races()` and
`load_class_bonus_feats()`, no mocks):

1. `compute_feat_slots("Guerrier", 1, "Humain", races, cbf)` →
   `['class-1', 'general-1', 'racial-1']`, len 3. **PASS** — matches spec
   exactly.
2. `compute_feat_slots("Guerrier", 2, "Humain", races, cbf)` →
   `['class-1', 'class-2', 'general-1', 'racial-1']`, len 4. **PASS** —
   matches spec exactly (no new general slot at level 2, `class-2` added).
3. `compute_feat_slots("Magicien", 5, "Elfe", races, cbf)` →
   `['class-5', 'general-1', 'general-3', 'general-5']`, len 4.
   **DEVIATION FROM STATED CRITERION** — the step file's Verification
   Criteria says this should return exactly 3 general slots and **zero**
   class slots. That assumption is factually wrong against the real data:
   `Data/class_bonus_feats.json`'s `magicien` entry has
   `bonus_feat_levels: [5, 10, 15, 20]` (wizards' bonus feat for
   item-creation/metamagic feats at 5th level and every 5 levels
   thereafter — this is a real PF1 rule, and the data reflects it
   correctly; it was produced by Step 03, which is out of scope for this
   step to alter). Given the real, correct input data, `compute_feat_slots`
   is doing exactly what the pseudo-code says: including `class-5` because
   `5 <= 5`. The general/racial parts of the criterion (3 general slots,
   zero racial slots for Elfe) **did** pass as stated. I did not alter
   `compute_feat_slots`'s logic to force a wrong answer just to match a
   criterion that contradicts the actual upstream data — the function is
   correct; the step file's example is stale/incorrect.
4. Unrecognized class string (`"NotAClass"`, level 3, with and without a
   race) does not raise: with `"Humain"` →
   `['general-1', 'general-3', 'racial-1']` (len 3); with `race_name=None` →
   `['general-1', 'general-3']`. **PASS** — no exception, falls back to
   zero class slots, general/racial slots computed normally.

## Regression check

`python -m pytest -q` → `15 passed in 5.56s`. No existing test broken.

## Deviations summary

- Verification Criterion 3's expected "zero class slots for Magicien at
  level 5" is incorrect given the real `Data/class_bonus_feats.json`
  content; implementation follows the pseudo-code and real data, not the
  stale example. All other criteria pass as literally stated.
- Confirmed and logged a real class-key coverage mismatch between
  `CLASS_BBA_PROGRESSION` and `class_bonus_feats.json` (4 classes), as the
  step file asked to check; `compute_feat_slots` handles it gracefully
  (falls back to zero class slots, does not raise) per spec.
- `FeatSlot` appended as a clean new block at the end of `models.py`, no
  reordering of Step 05/06 additions, to minimize conflict risk with the
  parallel Step 08 branch.

## Final pass/fail per Verification Criterion

1. Guerrier lvl1 + Humain → 3 slots (general-1, racial-1, class-1): **PASS**
2. Guerrier lvl2 + Humain → 4 slots (adds class-2): **PASS**
3. Magicien lvl5 + Elfe → 3 general, 0 racial, 0 class slots: **FAIL as
   literally stated** — real data yields 1 class slot (class-5); this is
   correct behavior against correct upstream data, not a bug in this
   step's code. General-slot part (3 general slots) and racial part (0
   racial slots) both individually verified true.
4. Unrecognized class does not raise, falls back to general(+racial) only:
   **PASS**
