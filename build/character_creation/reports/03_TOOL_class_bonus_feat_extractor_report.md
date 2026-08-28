# Step 03 Report — Class Bonus-Feat Extractor

## What was built

- `extract_class_bonus_feats.py` (repo root, standalone script, not imported
  by `pf1_dons`, matches the pattern of `extract_class_features.py`).
- `Data/class_bonus_feats.json` (generated output).

The script reads `Data/class_features.json` (no network access), and for
every class key and every level, checks whether any feature-name string at
that level normalizes (NFKD accent-strip + lowercase, copied inline from
`pf1_dons/parser.py::_normalize` as instructed — no import from the
package) to contain `"don supplementaire"` or `"dons supplementaires"`.
Matching levels are collected, sorted, and written as `bonus_feat_levels`
per class, alongside an explicit `category_restriction: null` field (per the
plan, category restriction is not derivable from this data source and is
left for manual curation / a later step). If `Data/class_features.json` is
missing, the script raises `FileNotFoundError` with a message telling the
user to run `extract_class_features.py` first.

## Verification

Ran: `python extract_class_bonus_feats.py`

Output:
```
41 classes processed; 9 grant bonus feats
```

### Criterion: completes without exceptions given existing `Data/class_features.json`
**PASS.** Ran cleanly against the real, already-present
`Data/class_features.json` (41 class entries), no exceptions.

### Criterion: one entry per class key present in `Data/class_features.json`
**PASS.** Verified programmatically:
`len(class_bonus_feats.json) == 41 == len(class_features.json)`, and the key
sets match exactly (checked full sorted key list of the output, e.g.
`alchimiste`, `guerrier`, `magicien`, `pretre`, `pretre_combattant`, ...,
`tueur` — 41 total, no key added or dropped).

### Criterion: `guerrier` bonus_feat_levels == [1,2,4,6,8,10,12,14,16,18,20]
**PASS.** Actual output:
```json
"guerrier": {"bonus_feat_levels": [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], "category_restriction": null}
```
Matches the step file's confirmed ground truth exactly.

### Criterion: a pure caster class with no bonus feats (e.g. `magicien`) has `bonus_feat_levels == []`
**FAIL as literally stated for `magicien` — this is a stale claim in the
step file, not a bug in the extractor.** Inspecting
`Data/class_features.json` directly shows `magicien` (wizard) has the
literal feature string `"Don supplémentaire"` at levels 5, 10, 15, and 20
(confirmed by reading the raw JSON, not just the derived output), so the
extractor correctly outputs
`"magicien": {"bonus_feat_levels": [5, 10, 15, 20], "category_restriction": null}`.
This is a case where the underlying scraped data (source of truth per this
step's own instructions — "do not re-scrape") disagrees with the step
file's assumed example, not a defect in the transformation logic.

To confirm the *underlying logic* of "pure casters get `[]`" still holds in
spirit, I checked several other classic non-bonus-feat caster classes in
the real output:
- `ensorceleur` (sorcerer): `bonus_feat_levels == []`
- `druide` (druid): `bonus_feat_levels == []`
- `oracle`: `bonus_feat_levels == []`
- `barde` (bard): `bonus_feat_levels == []`

All four are `[]` as expected, so the extractor's logic is correct; only the
specific example class named in the step file (`magicien`) turned out, on
inspection of real data, to not be a valid example of "no bonus feats."

Full list of classes with non-empty `bonus_feat_levels` in the real output:
```
bretteur          [4, 8, 12, 16, 20]
chevalier         [6, 12, 18]
guerrier          [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
magicien          [5, 10, 15, 20]
magus             [5, 11, 17]
moine             [1, 2, 6, 10, 14, 18]
pistolier         [4, 8, 12, 16, 20]
pretre_combattant [3, 6, 9, 12, 15, 18]
samourai          [6, 12, 18]
```

## Deviations from the plan

1. As detailed above, `magicien` is not empty-list as the step file assumed;
   this is a data-fidelity finding, not an implementation deviation — the
   script itself matches the pseudo-code exactly (marker list, normalize
   helper copied inline, `category_restriction: null`, `FileNotFoundError`
   guard, sorted/indented JSON output). No code deviation from spec.
2. No other deviations. Git branch name deviates from the plan's nested
   `feature/character-creation/03-class-bonus-feats` convention per
   orchestrator instruction (nested branch names are impossible in git) —
   used `integration/character-creation--03-class-bonus-feats` instead.

## Final status

| Criterion | Status |
|---|---|
| Runs without exceptions | PASS |
| One entry per class key | PASS |
| `guerrier` == [1,2,4,6,8,10,12,14,16,18,20] | PASS |
| Pure caster (`magicien`) == [] | FAIL — stale example in step file; underlying logic verified correct via `ensorceleur`, `druide`, `oracle`, `barde`, all `[]` |

Overall: implementation is correct and faithful to the pseudo-code and real
input data; one verification criterion's specific example (`magicien`) does
not hold against real data, and is reported here rather than silently
patched or fabricated.
