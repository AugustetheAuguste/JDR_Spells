# Step 07 — Feat slot calculator (`pf1_dons/feat_slots.py`)

## Objectives

Given a character's class, level, and race, compute the full list of feat
"slots" available: general slots (standard PF1 progression), racial bonus
slots, and class bonus slots (with category restriction metadata attached
when known), each slot tagged with the level it opened at and whether it's
currently filled.

## Dependencies & Parallelization

- **Wave 3.** Depends on Step 03 (`Data/class_bonus_feats.json`) and
  Step 05 (`pf1_dons.race_loader`). Independent of Step 06/08 — can run in
  parallel with Step 08.

## Inherited Context from Step 03 and Step 05

`Data/class_bonus_feats.json` shape (from Step 03):
```json
{
  "guerrier": {"bonus_feat_levels": [1,2,4,6,8,10,12,14,16,18,20], "category_restriction": null},
  "magicien": {"bonus_feat_levels": [], "category_restriction": null}
}
```
`category_restriction` is currently always `null` (Step 03 does not derive
it) — treat `null` as "unrestricted, but unverified" (see
`00_CONTEXT.md` Open Assumption #1). A human may later hand-edit this field
to a category string (e.g. `"combat"`) matching a key produced by Step 04's
`CATEGORY_KEYWORDS`; this step's code must be written to honor that field
if/when it's non-null, without requiring code changes.

From Step 05 (`pf1_dons/race_loader.py`):
```python
def load_races(path: str = "Data/races.json") -> dict[str, RaceInfo]: ...
def get_race(races: dict[str, RaceInfo], race_name: str) -> Optional[RaceInfo]: ...
# RaceInfo.has_bonus_feat: bool
```

## Pseudo-code

In `pf1_dons/models.py`, add:
```python
@dataclass
class FeatSlot:
    slot_id: str            # stable id, e.g. "general-1", "racial-1", "class-4"
    source: str             # "general" | "racial" | "class"
    level_gained: int
    category_restriction: Optional[str] = None  # e.g. "combat", None = unrestricted
    filled_by: Optional[str] = None             # feat name once assigned, else None
```

New file `pf1_dons/feat_slots.py`:
```python
DEFAULT_CLASS_BONUS_FEATS_PATH = "Data/class_bonus_feats.json"

def load_class_bonus_feats(path=DEFAULT_CLASS_BONUS_FEATS_PATH) -> dict[str, dict]:
    return json.loads(Path(path).read_text(encoding="utf-8"))

def general_slot_levels(max_level: int) -> list[int]:
    # standard PF1 rule: level 1, then every odd level thereafter
    return [lvl for lvl in range(1, max_level + 1) if lvl == 1 or lvl % 2 == 1]

def compute_feat_slots(
    character_class: str,
    level: int,
    race_name: Optional[str],
    races: dict[str, RaceInfo],
    class_bonus_feats: dict[str, dict],
) -> list[FeatSlot]:
    slots = []

    for lvl in general_slot_levels(level):
        slots.append(FeatSlot(slot_id=f"general-{lvl}", source="general", level_gained=lvl))

    race_info = get_race(races, race_name) if race_name else None
    if race_info and race_info.has_bonus_feat:
        slots.append(FeatSlot(slot_id="racial-1", source="racial", level_gained=1))

    class_key = _normalize_class_name(character_class)  # from class_progression.py
    class_entry = class_bonus_feats.get(class_key, {"bonus_feat_levels": [], "category_restriction": None})
    for lvl in class_entry["bonus_feat_levels"]:
        if lvl <= level:
            slots.append(FeatSlot(
                slot_id=f"class-{lvl}",
                source="class",
                level_gained=lvl,
                category_restriction=class_entry.get("category_restriction"),
            ))

    slots.sort(key=lambda s: (s.level_gained, s.source))
    return slots
```

## Logic Flow

1. General slots: level 1 plus every odd level up to the character's
   current level (levels 1,3,5,7,...).
2. Racial slot: exactly one, at level 1, iff `RaceInfo.has_bonus_feat` is
   true for the character's race (most racial bonus feats in PF1, e.g.
   human, are granted once at character creation, not per level — this
   plan does not model any race with a repeating bonus feat; if one is
   discovered during Step 01 curation, note it in that step's output but
   this calculator intentionally stays single-slot for `has_bonus_feat`).
3. Class slots: one per level in that class's `bonus_feat_levels` that is
   `<= level`, carrying forward whatever `category_restriction` value is
   present (usually `null`/unrestricted, per Step 03's limitation).
4. Return all slots sorted by level then source, unfilled (`filled_by=None`)
   — filling is Step 09/11's responsibility, not this pure calculator's.

## Implementation Notes

- This module is a pure function over its inputs — no file I/O inside
  `compute_feat_slots` itself; callers load `races` and `class_bonus_feats`
  once (via Step 05's `load_races()` and this step's `load_class_bonus_feats()`)
  and pass them in. This keeps it trivially unit-testable without mocking
  file reads.
- Reuse `_normalize_class_name` from `pf1_dons.class_progression` (already
  used by `get_bba`) for the class-key lookup — do not duplicate.
- An unknown class (not in `class_bonus_feats`) must not raise — fall back
  to zero class bonus slots (general + racial slots still compute
  normally), since `class_bonus_feats` coverage depends on
  `Data/class_features.json` coverage, which may not include every class in
  `CLASS_BBA_PROGRESSION` verbatim (case in point: verify this during
  implementation and log any mismatch).

## Verification Criteria

- `compute_feat_slots("Guerrier", 1, "Humain", races, class_bonus_feats)`
  returns 3 slots: `general-1`, `racial-1`, `class-1`.
- `compute_feat_slots("Guerrier", 2, "Humain", races, class_bonus_feats)`
  still returns only those 3 (no new general slot at level 2 — odd-level
  rule — but DOES add `class-2` since guerrier's bonus_feat_levels includes
  2) → 4 slots total.
- `compute_feat_slots("Magicien", 5, "Elfe", races, class_bonus_feats)`
  returns exactly 3 general slots (`general-1`, `general-3`, `general-5`)
  and zero class slots, zero racial slots (elfe has no bonus feat).
- Passing an unrecognized class string does not raise; returns general (+
  racial if applicable) slots only.

## Git Handling

- Branch: `feature/character-creation/07-feat-slots`.
- Commit `pf1_dons/models.py` additions (`FeatSlot`) and new
  `pf1_dons/feat_slots.py`.
- Commit message: `pf1_dons(07): add feat slot calculator`.

## Expected Outcome

A tested, pure `compute_feat_slots` function that Step 09's character model
calls to know exactly which slots exist and (once combined with assignment
data) which are open.
