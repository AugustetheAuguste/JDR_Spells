# Step 05 — Race loader module (`pf1_dons/race_loader.py`)

## Objectives

Add a package module that loads `Data/races.json` into a typed
`RaceInfo` dataclass (added to `pf1_dons/models.py`) with a lookup function,
so downstream steps (07 feat slots, 09 character model) get race data
through a stable Python API instead of touching raw JSON.

## Dependencies & Parallelization

- **Wave 2.** Depends on Step 01 (`Data/races.json` must exist with the
  shape below). No dependency on Step 02/03/04. Can run in parallel with
  Step 06.

## Inherited Context from Step 01

`Data/races.json` shape (one entry per normalized race key, matching
`pf1_dons/parser.py::KNOWN_RACES` strings):
```json
{
  "humain": {
    "traits": [{"name": "Don supplémentaire.", "description": "..."}],
    "ability_modifiers": [{"ability": "choice", "modifier": 2}],
    "size": "M",
    "speed": 9,
    "has_bonus_feat": true,
    "bonus_skill_rank": true,
    "class_skill_grants": []
  },
  "ogre": {
    "traits": [],
    "ability_modifiers": null,
    "size": null,
    "speed": null,
    "has_bonus_feat": null,
    "bonus_skill_rank": null,
    "class_skill_grants": null,
    "note": "no scrapeable standard traits page found"
  }
}
```
`ability_modifiers` ability values are either a 3-letter code
(`For`/`Dex`/`Con`/`Int`/`Sag`/`Cha`, matching
`pf1_dons/parser.py::ABILITY_ABBREVIATIONS`) or the literal string
`"choice"` for player-chosen bonuses.

## Pseudo-code

In `pf1_dons/models.py`, add:
```python
@dataclass
class AbilityModifier:
    ability: str  # "For"|"Dex"|"Con"|"Int"|"Sag"|"Cha"|"choice"
    modifier: int

@dataclass
class RaceInfo:
    key: str
    traits: list[dict]  # [{"name": str, "description": str}]
    ability_modifiers: list[AbilityModifier]
    size: Optional[str]
    speed: Optional[int]
    has_bonus_feat: bool
    bonus_skill_rank: bool
    class_skill_grants: list[str]
    note: Optional[str] = None
```
Default missing/`null` booleans to `False`, missing lists to `[]`, when
building from JSON (don't propagate `None` into `bool` fields — a race with
no page found simply grants no bonus feat as far as slot-counting is
concerned; its `note` field is what flags the real ambiguity).

New file `pf1_dons/race_loader.py`:
```python
DEFAULT_RACES_PATH = "Data/races.json"

def load_races(path: str = DEFAULT_RACES_PATH) -> dict[str, RaceInfo]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {key: _build_race_info(key, entry) for key, entry in raw.items()}

def _build_race_info(key, entry) -> RaceInfo:
    return RaceInfo(
        key=key,
        traits=entry.get("traits", []),
        ability_modifiers=[AbilityModifier(**m) for m in (entry.get("ability_modifiers") or [])],
        size=entry.get("size"),
        speed=entry.get("speed"),
        has_bonus_feat=bool(entry.get("has_bonus_feat")),
        bonus_skill_rank=bool(entry.get("bonus_skill_rank")),
        class_skill_grants=entry.get("class_skill_grants") or [],
        note=entry.get("note"),
    )

def get_race(races: dict[str, RaceInfo], race_name: str) -> Optional[RaceInfo]:
    # race_name may be user-typed with accents/casing; normalize the same
    # way pf1_dons/parser.py::_normalize does before dict lookup
    return races.get(_normalize(race_name))
```

## Logic Flow

1. Read and parse `Data/races.json` once via `load_races()`.
2. Build one `RaceInfo` per key, coercing `null`/missing fields to safe
   defaults per above.
3. Expose `get_race()` for accent/case-insensitive lookup by a
   user-supplied race string (mirrors how `Character.race` is currently a
   free-text `Optional[str]` in `pf1_dons/engine.py`).

## Implementation Notes

- Put the `_normalize` helper needed by `get_race` in `pf1_dons/race_loader.py`
  as a private copy, OR import the existing one from `pf1_dons/engine.py`
  if that doesn't create a circular import (`engine.py` does not currently
  import `race_loader.py`, so importing `_normalize` from `engine` into
  `race_loader` is safe; prefer this over duplicating the function a third
  time). Confirm no circular import before finalizing.
- Do not memoize/cache `load_races()` at module level with a global — keep
  it a plain function callers invoke once and pass around, consistent with
  how `data_loader.load_catalog()` is used in tests (see
  `tests/test_engine.py`'s `catalog` fixture).

## Verification Criteria

- `from pf1_dons.race_loader import load_races, get_race` succeeds.
- `load_races()` returns a dict with a `RaceInfo` for every key in
  `Data/races.json`.
- `get_race(races, "Nain")` and `get_race(races, "nain")` both return the
  same `RaceInfo` (case-insensitivity check).
- `load_races()["humain"].has_bonus_feat is True`.
- A race entry with `"note"` set (e.g. `"ogre"` if unresolved by Step 01)
  loads without raising, with `has_bonus_feat is False`.

## Git Handling

- Branch: `feature/character-creation/05-race-loader`.
- Commit `pf1_dons/models.py` additions and new `pf1_dons/race_loader.py`.
- Commit message: `pf1_dons(05): add RaceInfo model and race loader`.

## Expected Outcome

A typed, tested way to query race data from Python, consumed by Step 07
(feat slot calculator) and Step 09 (character model).
