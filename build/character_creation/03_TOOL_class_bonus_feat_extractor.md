# Step 03 — Build the class bonus-feat extractor (`extract_class_bonus_feats.py` → `Data/class_bonus_feats.json`)

## Objectives

Produce a standalone script that reads the **already-scraped**
`Data/class_features.json` (built by the existing `extract_class_features.py`
— do not re-scrape) and derives, per class, the list of levels at which that
class grants a bonus feat, writing `Data/class_bonus_feats.json`.

## Dependencies & Parallelization

- **Wave 1.** Depends only on `Data/class_features.json`, which already
  exists in the repo (built by the pre-existing `extract_class_features.py`
  — confirmed present at `Data/class_features.json` with content like
  `{"guerrier": {"1": ["Don supplémentaire"], "2": [...], ...}}`). No
  dependency on any other step in this plan. Safe to run fully in parallel
  with Steps 01, 02, 04.

## Inherited Context

`Data/class_features.json` shape (confirmed by inspection):
```json
{
  "guerrier": {
    "1": ["Don supplémentaire"],
    "2": ["Courage +1", "don supplémentaire"],
    "3": ["Entraînement aux armures 1"],
    ...
  },
  "magicien": { "1": [...], ... },
  ...
}
```
Keys are class keys matching `CLASS_SLUGS`/`CLASS_BBA_PROGRESSION`; each
class maps level-strings ("1".."20") to a list of feature-name strings for
that level (case varies — "Don supplémentaire" vs "don supplémentaire" seen
in the sample above; some entries have empty lists `[]`).

## Pseudo-code

```
IN_PATH = Path("Data/class_features.json")
OUT_PATH = Path("Data/class_bonus_feats.json")

BONUS_FEAT_MARKERS = ["don supplémentaire", "dons supplémentaires"]

def normalize(text):  # copy from pf1_dons/parser.py::_normalize (NFKD strip + lower)
    ...

def main():
    data = json.loads(IN_PATH.read_text(encoding="utf-8"))
    out = {}
    for class_key, levels in data.items():
        bonus_levels = []
        for level_str, features in levels.items():
            if any(any(marker in normalize(f) for marker in BONUS_FEAT_MARKERS) for f in features):
                bonus_levels.append(int(level_str))
        bonus_levels.sort()
        out[class_key] = {
            "bonus_feat_levels": bonus_levels,
            # category restriction is NOT derivable from this data source;
            # leave explicit and let Step 04 / manual curation fill it in
            "category_restriction": None,
        }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    print(f"{len(out)} classes processed; "
          f"{sum(1 for v in out.values() if v['bonus_feat_levels'])} grant bonus feats")
```

## Logic Flow

1. Load `Data/class_features.json` (already in the repo — no network call
   in this step at all).
2. For every class and every level, check whether any feature-name string
   at that level normalizes to contain "don supplémentaire" (handles the
   observed case inconsistency).
3. Collect the sorted list of levels where that's true → `bonus_feat_levels`.
4. Write `Data/class_bonus_feats.json` with a `category_restriction` field
   present but `null` for every class — this plan does not attempt to
   auto-derive *which* feats a class's bonus slot accepts (see Open
   Assumption #1 in `00_CONTEXT.md`); a human (or a future pass) can later
   fill in values like `"combat"` for guerrier by editing this JSON
   directly. Step 07 (feat slot calculator) must treat `null` as
   "unrestricted" and Step 09/11's CLI must surface that as
   "verify manually" rather than silently allowing anything.

## Implementation Notes

- This script has zero network dependency — it's pure JSON transformation,
  making it trivially fast and safe to re-run.
- Do not import from `pf1_dons` — copy the small `normalize` helper inline
  (2-3 lines), consistent with the other scraper scripts staying
  independent of the installable package.
- If `Data/class_features.json` is missing when this runs, raise a clear
  `FileNotFoundError` telling the user to run `extract_class_features.py`
  first — don't silently produce an empty output.

## Verification Criteria

- `python extract_class_bonus_feats.py` completes without exceptions given
  the existing `Data/class_features.json`.
- `Data/class_bonus_feats.json` has one entry per class key present in
  `Data/class_features.json`.
- `guerrier` entry's `bonus_feat_levels == [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]`
  (matches the live wiki table inspected during planning — every level
  tagged "Don supplémentaire" in the Special column, i.e. 1 then every even
  level through 20).
- A pure caster class with no bonus feats (e.g. `magicien`) has
  `bonus_feat_levels == []`.

## Git Handling

- Branch: `feature/character-creation/03-class-bonus-feats`.
- Commit `extract_class_bonus_feats.py` and `Data/class_bonus_feats.json`.
- Commit message: `pf1_dons(03): derive class bonus feat levels from class_features.json`.

## Expected Outcome

`Data/class_bonus_feats.json` giving, per class, the levels at which a
class-granted bonus feat slot opens — consumed by Step 07.
