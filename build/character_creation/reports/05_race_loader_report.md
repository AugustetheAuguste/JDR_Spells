# Step 05 — Race loader module: Report

## What was built

- `pf1_dons/models.py`: appended (without reformatting existing content) a
  new block with `AbilityModifier` and `RaceInfo` dataclasses, exactly per
  the step's pseudo-code. Added `Optional` to the existing `typing` import
  line (only pre-existing line touched).
- `pf1_dons/race_loader.py` (new file): `DEFAULT_RACES_PATH`, `load_races()`,
  `_build_race_info()`, `get_race()` — matches the step's pseudo-code
  verbatim. Imports `_normalize` from `pf1_dons/engine.py` (confirmed no
  circular import: `engine.py` imports only `.class_progression`,
  `.data_loader`, `.models`, none of which import `race_loader`).
- No caching/memoization added, consistent with `data_loader.load_catalog()`.

## Verification against real codebase (evidence)

Before implementing, inspected the actual files/data instead of trusting
the plan's claims:

- `pf1_dons/models.py` (pre-change): confirmed `Requirement`, `OrGroup`,
  `ParsedConditions` exist, no race dataclass yet. Confirmed via `Read`.
- `pf1_dons/parser.py`: confirmed `KNOWN_RACES`, `ABILITY_ABBREVIATIONS =
  {"For", "Dex", "Con", "Int", "Sag", "Cha"}`, and `_normalize` (NFKD
  accent-strip + lowercase) all exist as described.
- `pf1_dons/engine.py`: confirmed it has its own `_normalize` (identical
  implementation to parser.py's) and does NOT import `race_loader.py` —
  safe to import `_normalize` from `engine` into `race_loader`.
- `Data/races.json`: loaded directly with Python/json and printed real
  entries for `aasimar`, `androide`, `aquatique`, `humain`, `nain` — shape
  matches the step file's example exactly (`traits` list of
  `{"name","description"}`, `ability_modifiers` list of
  `{"ability","modifier"}` with `"choice"` used for humain's ability
  ability, `size`, `speed`, `has_bonus_feat`, `bonus_skill_rank`,
  `class_skill_grants`).
- Searched all 53 entries in `Data/races.json` for the `"note"` key: found
  it set (with `"no scrapeable standard traits page found"`) on exactly
  `ogre`, `troll`, and `homme-serpent` — all other fields `null`/empty on
  those three, confirming the step file's "e.g. ogre" example is real, not
  hypothetical, and additionally covers two more unresolved races.

## Verification Criteria — actual run output

```
>>> from pf1_dons.race_loader import load_races, get_race
>>> races = load_races()
total races: 53                                  # matches len(Data/races.json)
keys match: True                                  # races.keys() == raw json keys()
r1 = get_race(races, 'Nain'); r2 = get_race(races, 'nain')
case-insensitive match: True True                 # r1 is r2, and not None
humain has_bonus_feat: True                       # races['humain'].has_bonus_feat is True
ogre note= no scrapeable standard traits page found has_bonus_feat= False True
troll note= no scrapeable standard traits page found has_bonus_feat= False True
homme-serpent note= no scrapeable standard traits page found has_bonus_feat= False True
```

Per-criterion:

| Criterion | Result |
|---|---|
| `from pf1_dons.race_loader import load_races, get_race` succeeds | PASS |
| `load_races()` returns a dict with a `RaceInfo` for every key in `Data/races.json` | PASS (53 == 53, key sets equal) |
| `get_race(races, "Nain")` and `get_race(races, "nain")` return the same `RaceInfo` | PASS (`r1 is r2`, both non-None) |
| `load_races()["humain"].has_bonus_feat is True` | PASS |
| A race entry with `"note"` set loads without raising, with `has_bonus_feat is False` | PASS — verified for all three real unresolved races (`ogre`, `troll`, `homme-serpent`), not just one |

## Regression check

`python -m pytest -q` from the worktree root: **15 passed**, 0 failed —
no existing test's behavior changed (`race_loader.py` is not imported by
any existing module or test; `models.py`'s only pre-existing line touched
was the `typing` import to add `Optional`, which was already unused-import
safe since `Optional` wasn't previously imported there).

## Deviations from the plan

None. Implementation matches the step file's pseudo-code and models
verbatim. The only judgment call was where to insert the `models.py`
additions — appended as a clearly delimited new block at the end of the
file, per the orchestrator's instruction to minimize merge conflicts with
Step 06 (also touching `models.py`).

## Final status: PASS (all verification criteria met, no regressions)
