# Step 13 — Tests for new modules

## Objectives

Add pytest coverage for every new package module introduced in Steps 05-12,
following this repo's existing test conventions (`tests/test_*.py`, module-
scoped fixtures loading real data files, French assertion messages where
the code under test is French-language).

## Dependencies & Parallelization

- **Wave 7.** Depends on Steps 05, 06, 07, 08, 09, 10, 11, 12 all being
  merged (this step tests the full functional surface). Does not depend on
  Step 01-04 directly, only transitively through the data files they
  produce, which the loader modules (05/06) already wrap.

## Inherited Context from Steps 05-12

All public functions/classes referenced below are documented in their
respective step files (`05_race_loader.md` through `12_cli_feat_assignment.md`)
with full signatures. Key imports this step needs:
```python
from pf1_dons.race_loader import load_races, get_race
from pf1_dons.class_skills import load_class_skills, get_class_skill_info, is_class_skill
from pf1_dons.feat_slots import compute_feat_slots, load_class_bonus_feats
from pf1_dons.skill_budget import ability_modifier, skill_points_per_level, total_skill_points, class_skill_bonus
from pf1_dons.character_profile import create_profile, eligible_feats_for_slot, assign_feat, unassign_feat, SlotAssignmentError
from pf1_dons.persistence import save_profile, load_profile, list_characters
from pf1_dons import cli
```
Existing fixture pattern to mirror (from `tests/test_engine.py`):
```python
@pytest.fixture(scope="module")
def catalog():
    return load_catalog()
```

## Pseudo-code / Test Plan

New file `tests/test_race_loader.py`:
```
def test_load_races_has_humain_with_bonus_feat()
def test_get_race_case_insensitive()
def test_unresolved_race_has_no_bonus_feat_but_does_not_raise()
```

New file `tests/test_class_skills.py`:
```
def test_guerrier_skill_points_formula()
def test_is_class_skill_true_for_class_skill()
def test_is_class_skill_false_for_non_class_skill()
```

New file `tests/test_feat_slots.py`:
```
def test_guerrier_humain_level_1_has_general_racial_and_class_slot()
def test_guerrier_level_2_adds_class_slot_not_general_slot()
def test_magicien_elfe_level_5_has_only_general_slots()
def test_unknown_class_falls_back_to_general_slots_only()
```

New file `tests/test_skill_budget.py`:
```
def test_ability_modifier_table(): parametrize (score, expected) pairs
    incl. 9->-1, 10->0, 11->0, 18->4
def test_skill_points_per_level_floors_at_one()
def test_total_skill_points_none_when_ability_missing()
def test_class_skill_bonus_requires_ranks_and_class_skill()
```

New file `tests/test_character_profile.py`:
```
@pytest.fixture(scope="module")
def catalog(): return load_catalog()
@pytest.fixture(scope="module")
def races(): return load_races()
@pytest.fixture(scope="module")
def class_bonus_feats(): return load_class_bonus_feats()
@pytest.fixture(scope="module")
def feat_categories(): return json.loads(Path("Data/feat_categories.json").read_text(encoding="utf-8"))

def test_create_profile_slot_count(races, class_bonus_feats)
def test_eligible_feats_for_slot_includes_known_eligible_feat(catalog, races, class_bonus_feats, feat_categories)
def test_assign_feat_fills_slot(...)
def test_assign_duplicate_feat_raises(...)
def test_assign_to_filled_slot_raises(...)
def test_unassign_reopens_slot(...)
```

New file `tests/test_persistence.py` (uses `tmp_path` fixture, NOT the real
`Data/characters/` dir, to avoid polluting the repo):
```
def test_save_then_load_round_trip(tmp_path)
def test_load_missing_character_raises(tmp_path)
def test_list_characters_empty_dir(tmp_path)
def test_list_characters_after_saving_two(tmp_path)
```

New file `tests/test_cli.py` (invoke `cli.main(argv=[...])` directly,
redirect `Data/characters` via monkeypatching
`pf1_dons.persistence.DEFAULT_CHARACTERS_DIR` to a `tmp_path`, per
`pytest`'s `monkeypatch` fixture — do not let CLI tests write into the
real `Data/characters/`):
```
def test_create_show_list_round_trip(tmp_path, monkeypatch, capsys)
def test_slots_lists_open_slots_with_candidates(tmp_path, monkeypatch, capsys)
def test_assign_then_show_reflects_filled_slot(tmp_path, monkeypatch, capsys)
def test_assign_rejects_ineligible_feat(tmp_path, monkeypatch, capsys)
def test_assign_rejects_duplicate_feat_across_slots(tmp_path, monkeypatch, capsys)
def test_unassign_reopens_slot(tmp_path, monkeypatch, capsys)
```

## Logic Flow

1. Each new module gets its own focused unit-test file, mirroring the
   1-file-per-module convention already used (`test_class_progression.py`,
   `test_engine.py`, `test_parser.py`).
2. `test_character_profile.py` is the main integration point — it exercises
   real catalog + real races + real class_bonus_feats + real
   feat_categories together, similar in spirit to
   `tests/test_engine.py::test_full_catalog_has_no_exceptions_and_mixed_statuses`.
3. `test_persistence.py` and `test_cli.py` must NEVER write to the real
   `Data/characters/` directory — always redirect via `tmp_path` +
   `monkeypatch`, so running the suite repeatedly never leaves stray files
   or requires manual cleanup.
4. Run the full suite (`python -m pytest`) at the end and confirm the
   pre-existing 15 tests (`tests/test_class_progression.py`,
   `tests/test_engine.py`, `tests/test_parser.py`) still pass unmodified —
   this plan must not touch any existing test file or existing module
   behavior.

## Implementation Notes

- For `test_cli.py`, `capsys` captures stdout so assertions can check for
  substrings like the character name or slot IDs, without over-asserting
  on exact formatting (avoid brittle full-string matches on printed output;
  assert on presence of key substrings/values instead).
- Prefer real data (`load_catalog()`, `load_races()`, etc.) over mocks for
  the integration-style tests — this matches the existing suite's
  philosophy (`tests/test_engine.py` loads the real CSV catalog rather than
  a fixture stub) and catches real scraped-data regressions.
- Where a specific known-eligible feat is asserted (e.g. "Arme en main"),
  reuse the exact same feat name already validated by
  `tests/test_engine.py::test_arme_en_main_bba` for consistency and to
  avoid picking a fresh feat whose behavior hasn't already been
  hand-verified in this codebase.

## Verification Criteria

- `python -m pytest` passes: all pre-existing 15 tests plus every new test
  added in this step, with zero warnings about writes to `Data/characters/`.
- `git status` after running the full suite shows no untracked/modified
  files under `Data/characters/` (confirms test isolation held).
- New test files follow the existing repo's French-domain-language style
  for any user-facing string assertions (matching, not translating, the
  actual CLI/error text).

## Git Handling

- Branch: `feature/character-creation/13-tests`.
- Commit all new `tests/test_*.py` files.
- Commit message: `pf1_dons(13): add test coverage for character creation modules`.

## Expected Outcome

Full automated coverage of the new character-creation surface, with the
existing 15 tests still green and no repo pollution from test runs.
