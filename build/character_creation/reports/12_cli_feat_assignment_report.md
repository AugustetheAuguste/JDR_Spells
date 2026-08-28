# Step 12 report — CLI slots/assign/unassign

## What was built

Appended to `pf1_dons/cli.py` (no edits to Step 11's existing `cmd_create`,
`cmd_show`, `cmd_list`, `_print_summary`, or `build_parser`'s pre-existing
lines):

- Imports: `json`, `pathlib.Path`, and from `character_profile`:
  `SlotAssignmentError`, `assign_feat`, `eligible_feats_for_slot`,
  `unassign_feat`; plus `data_loader.load_catalog`.
- `build_parser()`: added `slots` (name, `--open-only`), `assign`
  (name, slot_id, feat_name), `unassign` (name, slot_id) subparsers,
  inserted after the existing `list` subparser.
- New functions: `_load_feat_categories`, `cmd_slots`, `cmd_assign`,
  `cmd_unassign` — matching the plan's pseudo-code, with an added
  `FileNotFoundError` guard on `load_profile` in each (consistent with
  Step 11's `cmd_show` pattern, not present in the plan's pseudo-code but
  needed for a clean error message instead of an uncaught traceback).
- `main()`'s dispatch dict extended with `"slots"`, `"assign"`,
  `"unassign"` entries; all six commands now dispatch from one dict.

All names (`eligible_feats_for_slot`, `assign_feat`, `unassign_feat`,
`SlotAssignmentError`, `load_profile`, `save_profile`, `load_catalog`,
`FeatSlot.category_restriction`, `feat_categories.json` shape) matched the
plan's pseudo-code exactly against the real Step 09/10/04 code — no
adaptation needed beyond the FileNotFoundError guard.

## Verification (real CLI runs against a fresh `Aldric`)

Setup: `python -m pf1_dons.cli create Aldric --class Guerrier --level 1 --race Humain --for 16`
→ exit 0, produced 3 slots: `class-1`, `general-1`, `racial-1` (all niveau 1).
Note: at level 1 a fighter/human only has one general slot each — there is
no `general-3` slot to test against, so the "duplicate feat across slots"
and "unassign then reassign" criteria were verified using `racial-1`
instead of `general-3` (same code path: `assign_feat`'s duplicate-feat
check is slot-agnostic, keyed only on `feat_name` already being in
`known_feats`).

1. **`slots Aldric` lists 3 slots with candidates, incl. "Arme en main" under
   a general slot** — PASS. Output showed `class-1`, `general-1`,
   `racial-1`, each with 496 eligible candidates (capped at 20 lines +
   "... et 476 autres"). "Arme en main" wasn't in the first-20 alphabetical
   slice (it sorts past many "A..." feats), so confirmed separately via a
   direct `eligible_feats_for_slot` call: `general-1 496 True` (i.e.
   "Arme en main" ∈ the general-1 candidate set). The *display* cap is a
   presentation choice per the plan; `assign`'s validation uses the
   uncapped set, confirmed below.

2. **`assign Aldric general-1 "Arme en main"` exits 0, `show` reflects
   `general-1 -> Arme en main`** — PASS.
   ```
   'Arme en main' attribué à general-1 pour Aldric.
   EXIT=0
   ...
     general-1 (niveau 1, general) -> Arme en main
   ```

3. **Re-running the same assign against an already-filled slot fails,
   non-zero exit, clear message, no silent overwrite** — PASS.
   ```
   $ python -m pf1_dons.cli assign Aldric general-1 "Arme en main"
   slot déjà occupé : general-1 -> Arme en main
   EXIT=1
   ```

4. **Same feat, different open slot, fails with duplicate-feat error from
   Step 09** — PASS (used `racial-1` in place of the plan's `general-3`,
   which doesn't exist at level 1 — see note above).
   ```
   $ python -m pf1_dons.cli assign Aldric racial-1 "Arme en main"
   don déjà attribué à un autre emplacement : Arme en main
   EXIT=1
   ```

5. **`unassign Aldric general-1` then `show` reflects it open again, and the
   previously-blocked duplicate assignment now succeeds** — PASS.
   ```
   $ python -m pf1_dons.cli unassign Aldric general-1
   Emplacement general-1 libéré pour Aldric.
   EXIT=0
   ...
     general-1 (niveau 1, general) -> (vide)
   $ python -m pf1_dons.cli assign Aldric racial-1 "Arme en main"
   'Arme en main' attribué à racial-1 pour Aldric.
   EXIT=0
   ...
     racial-1 (niveau 1, racial) -> Arme en main
   ```

6. **Category-restricted slot logic only narrows class-bonus slots, not
   general slots** — PASS, verified by code inspection (not a CLI run,
   since no manual-check-flagged/category-restricted class slot happened
   to appear on this level-1 fighter to exercise end-to-end): confirmed in
   `pf1_dons/character_profile.py` line 75, `eligible_feats_for_slot` only
   applies the category filter `if slot.category_restriction is not
   None`, and `pf1_dons/models.py` line 105 / `pf1_dons/feat_slots.py`
   line 39-48 show `category_restriction` defaults to `None` and is only
   set for class-bonus slots sourced from `class_bonus_feats.json` —
   general and racial slots never receive one. This matches the plan's
   criterion exactly.

## Regression run

`python -m pytest -q` → `15 passed in 3.82s`, no regressions.

## Cleanup

`Data/characters/Aldric.json` (test artifact) deleted after verification;
already gitignored per Step 10, not part of the commit.

## Deviations from plan

- Added `try/except FileNotFoundError` around `load_profile` in
  `cmd_slots`, `cmd_assign`, `cmd_unassign` (plan's pseudo-code omitted
  this) — matches the existing error-handling pattern in Step 11's
  `cmd_show` and avoids an uncaught traceback for a missing character.
- Verification criteria referencing `general-3` were exercised against
  `racial-1` instead, since a level-1 character only has one general slot;
  the underlying code path (`assign_feat`'s duplicate check) is identical
  regardless of which slot is targeted.

## Final pass/fail summary

All 6 verification criteria: PASS. Test suite: PASS (15/15, no
regressions). No fabricated results — every command above was actually
run against a live `Aldric` character in this worktree.
