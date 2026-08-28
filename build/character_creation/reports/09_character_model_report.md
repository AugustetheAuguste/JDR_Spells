# Step 09 report — `pf1_dons/character_profile.py`

## What was built

`pf1_dons/character_profile.py` implementing exactly the API described in
`build/character_creation/09_character_model.md`:

- `CharacterProfile` dataclass (`name`, `character_class`, `level`, `race`,
  `ability_scores`, `skill_ranks`, `feat_slots`) with methods
  `to_character()`, `open_slots()`, `find_slot(slot_id)`.
- `create_profile(name, character_class, level, race, ability_scores, races, class_bonus_feats)`
  → calls `feat_slots.compute_feat_slots` and returns a populated
  `CharacterProfile` with unfilled slots.
- `eligible_feats_for_slot(profile, slot, catalog, feat_categories)` →
  builds `profile.to_character()`, filters the catalog by
  `slot.category_restriction` (if any) against
  `feat_categories[feat.name]["categories"]`, then keeps feats whose
  `evaluate_feat(...).status` is `"eligible"` or `"manual_check"`.
- `assign_feat(profile, slot_id, feat_name)` / `unassign_feat(profile, slot_id)`
  with `SlotAssignmentError` for: unknown slot, already-filled slot, and
  feat already assigned to a different slot.

No other files were modified. Only new file added:
`pf1_dons/character_profile.py`.

## Verification of real signatures before writing code

Read the actual source (not assumed) of:
- `pf1_dons/engine.py`: confirmed `evaluate_feat(feat: FeatRow, character: Character) -> EligibilityResult`
  where `EligibilityResult` is a dataclass `(feat_name, status, reasons)` and
  `status: Literal["eligible", "manual_check", "ineligible"]` — exactly as
  the step file's pseudo-code assumed (`.status` attribute, three string
  values). No deviation needed here.
- `pf1_dons/feat_slots.py`: confirmed `compute_feat_slots(character_class, level, race_name, races, class_bonus_feats) -> list[FeatSlot]`
  and `load_class_bonus_feats(path=...)`, matching the step file exactly.
- `pf1_dons/models.py`: confirmed `FeatSlot(slot_id, source, level_gained, category_restriction=None, filled_by=None)`.
- `pf1_dons/race_loader.py`: confirmed `load_races(path=...) -> dict[str, RaceInfo]`.
- `pf1_dons/data_loader.py`: confirmed `load_catalog(path=...) -> list[FeatRow]`,
  `FeatRow(name, display_name, source, raw_conditions, benefits, parsed)`.
- `Data/feat_categories.json`, `Data/races.json`, `Data/class_bonus_feats.json`,
  `Data/class_skills.json` all already exist on disk (Steps 01-08 merged) —
  confirmed via `Glob`, loaded for real in the verification run below (no
  mocks).

No deviations from the step file's pseudo-code were required — the real
APIs matched the pseudo-code signatures exactly.

## Verification Criteria — executed for real

Ran the following against the real catalog (`pf1_dons.data_loader.load_catalog()`,
1416-row `Data/Dons.csv`), real `Data/races.json` via `load_races()`, real
`Data/class_bonus_feats.json` via `load_class_bonus_feats()`, and real
`Data/feat_categories.json` loaded from disk. Full script and output:

```
races = load_races()
cbf = load_class_bonus_feats()
catalog = load_catalog()
feat_categories = json.load(open('Data/feat_categories.json', encoding='utf-8'))

profile = create_profile('Test', 'Guerrier', 1, 'Humain', {'For':16}, races, cbf)
# slots: ['class-1', 'general-1', 'racial-1']

gen1 = profile.find_slot('general-1')
elig = eligible_feats_for_slot(profile, gen1, catalog, feat_categories)
# Arme en main in eligible: True
# len(elig) > 0: True

assign_feat(profile, 'general-1', 'Arme en main')
# profile.find_slot('general-1').filled_by == 'Arme en main': True

assign_feat(profile, 'racial-1', 'Arme en main')  # -> SlotAssignmentError
# "don deja attribue a un autre emplacement : Arme en main"

assign_feat(profile, 'general-1', 'Autre don')  # -> SlotAssignmentError (already filled)
# "slot deja occupe : general-1 -> Arme en main"

assign_feat(profile, 'nope', 'Autre don')  # -> SlotAssignmentError (nonexistent)
# "slot inconnu : nope"

unassign_feat(profile, 'general-1')
# profile.find_slot('general-1').filled_by is None: True

# Output: ALL PASS
```

Actual console output (verbatim, non-ASCII garbled only in terminal display,
not in file/string content — accented chars round-trip fine in Python):

```
slots: ['class-1', 'general-1', 'racial-1']
Arme en main in eligible: True
assign ok
dup feat error ok: don d?j? attribu? ? un autre emplacement : Arme en main
filled slot error ok: slot d?j? occup? : general-1 -> Arme en main
nonexistent slot error ok: slot inconnu : nope
unassign ok
ALL PASS
```

(The `?` characters are a Windows console codepage display artifact when
printing accented French text — cp1252/cp850 mangling of UTF-8 text on
stdout — not a bug in the code; the actual exception message strings are
correct UTF-8 f-strings as written in `character_profile.py`.)

### Per-criterion pass/fail

| Criterion | Result |
|---|---|
| `create_profile(...)` for level-1 Humain Guerrier produces exactly `general-1`, `racial-1`, `class-1` open slots | **PASS** — verified set equality |
| `eligible_feats_for_slot` on `general-1` for level-1 Guerrier with `For` provided returns non-empty list including "Arme en main" | **PASS** — `Arme en main` present, `len(elig) > 0` |
| Cross-check against `tests/test_engine.py::test_arme_en_main_bba` | **PASS** — ran `python -m pytest -q tests/test_engine.py::test_arme_en_main_bba` directly: `1 passed`. That test asserts `evaluate_feat(feat, Character(character_class="Guerrier", level=1)).status == "eligible"` and `... Character(character_class="Magicien", level=1) ... == "ineligible"`, which is exactly the mechanism `eligible_feats_for_slot` relies on (same `evaluate_feat` call, same feat, same class/level). Consistent by construction and independently green. |
| `assign_feat(profile, "general-1", "Arme en main")` then `filled_by == "Arme en main"` | **PASS** |
| Assigning same feat name to a second slot raises `SlotAssignmentError` | **PASS** |
| Assigning to an already-filled slot raises `SlotAssignmentError` | **PASS** |
| Assigning to a nonexistent slot_id raises `SlotAssignmentError` | **PASS** |
| `unassign_feat` clears `filled_by`, slot becomes assignable again | **PASS** (verified `filled_by is None`; re-assignability follows directly from `assign_feat`'s only guard being `filled_by is not None`) |

## Regression check

```
python -m pytest -q
...............                                                        [100%]
15 passed in 4.12s
```

All 15 existing tests pass unchanged. No existing file was modified.

## Deviations

None. The step file's pseudo-code was implemented verbatim; all imported
APIs (`compute_feat_slots`, `load_class_bonus_feats`, `load_races`,
`evaluate_feat`, `EligibilityResult`, `load_catalog`, `FeatRow`, `FeatSlot`,
`RaceInfo`, `Character`) matched their real signatures exactly, so no
adjustment was needed.

## Files touched

- Added: `pf1_dons/character_profile.py`
- Added: `build/character_creation/reports/09_character_model_report.md` (this file)
- No other files modified.
