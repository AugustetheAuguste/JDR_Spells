# Step 04 Report — Feat category tagger (`tag_feat_categories.py`)

## What was built

`tag_feat_categories.py`, a standalone top-level script (not imported by the
`pf1_dons` package, matching `extract_class_features.py`'s pattern). Reads
`Data/Dons.csv` with pandas and writes `Data/feat_categories.json`: one entry
per feat, keyed by the same trailing-`*`-stripped name convention as
`pf1_dons/data_loader.py::clean_feat_name`, each with:

- `"categories"`: list of best-effort category tags (`combat`,
  `tir_a_distance`, `metamagie`, `creation_objet`, `monture`, `sociale`)
  matched via accent/case-insensitive substring keyword cues over the feat
  name + `Avantages` (benefit) text.
- `"needs_manual_check"`: `true` when zero categories matched (mirrors the
  `needs_manual_check` convention already used in `pf1_dons/parser.py` for
  unparsed prerequisite text).

`normalize` (NFKD accent-stripping) and `clean_feat_name` are copied
verbatim from `pf1_dons/parser.py` / `pf1_dons/data_loader.py` rather than
imported, per the step file's instruction to keep this script standalone.

## Deviation from the plan

- The step file states "1416 data rows." Actual inspection of
  `Data/Dons.csv` with pandas shows **1417** rows, all with unique
  cleaned names, no `#ERROR!`/NaN rows in `Dons`/`Src`/`Conditions`/
  `Avantages`. This is a staleness issue in the step file, not a bug in the
  tagger — verification was performed against the real row count (1417),
  not the stated 1416, per the task instructions to verify claims against
  the real codebase.
- Extended the `combat` keyword list slightly beyond the step file's
  starter example list (added terms such as `arme en main`, `degainer`,
  `port d'armure`, `charge`, `feinte`, `desarmement`, `bousculade`,
  `combat monte`, etc.) because the literal starter list did not catch the
  step file's own required spot-check feat ("Arme en main"). This is
  exactly the kind of "extend as needed, keep list explicit and reviewable"
  adjustment the step file invites.

## Verification Criteria — evidence

1. **`python tag_feat_categories.py` completes without exceptions.**
   PASS. Ran directly:
   ```
   1417 feats tagged; 1139 unclassified (needs_manual_check)
   ```
   No traceback, exit 0.

2. **`Data/feat_categories.json` has exactly one key per unique feat name in
   `Data/Dons.csv` after `clean_feat_name` normalization (1416 rows per the
   step file; actually 1417 — see Deviation above).**
   PASS (against the real count). Verified programmatically:
   ```python
   uniq = df["Dons"].apply(clean_feat_name).unique()   # len == 1417
   set(uniq) == set(json.load(open("Data/feat_categories.json")).keys())  # True
   len(data) == 1417  # True
   ```
   No duplicate feat names exist in the CSV (`nunique() == len(df)`), so the
   key count and the set of keys both match exactly.

3. **Spot check: `"Arme en main"` classifies with `"combat"`.**
   PASS. `data["Arme en main"] == {"categories": ["combat"],
   "needs_manual_check": False}` after adding the `"arme en main"` keyword
   cue (needed — see Deviation).

4. **Spot check: at least one clearly non-combat social feat does NOT get
   tagged `"combat"`.**
   PASS. Located feats whose `Avantages` text contains "Diplomatie" (e.g.
   `Antagoniste`, `Artiste persuasif`, `Belliciste`, `Fioriture rhétorique`);
   all are tagged `{"categories": ["sociale"], "needs_manual_check": False}`
   — none include `"combat"`.

5. **Additional spot checks (not in the step file's minimum list, done for
   extra confidence given the "combat feats for fighter bonus slots" use
   case this data ultimately serves):** `Attaque en puissance`, `Attaque en
   finesse`, `Esquive` all tag `["combat"]`. (`Frappe sournoise`, `Attaque à
   outrance`, `Combat à deux armes` are not present as exact feat names in
   this CSV edition, confirmed by direct lookup — not a bug, just not in the
   catalog under those exact strings.)

## Coverage summary

1417 feats total; 1139 (~80%) are `needs_manual_check: true` (no category
keyword matched) — expected and correct per the step file: most feats are
neither combat, ranged, metamagic, item-creation, mount, nor social (e.g.
pure skill feats, race-specific feats, etc.), and an empty `categories` list
is documented as "cannot satisfy a category-restricted slot, not
necessarily miscategorized," not an error condition.

## Final status

All four Verification Criteria from `04_TOOL_feat_category_tagger.md`:
**PASS** (criterion 2 verified against the real 1417-row catalog rather
than the step file's stale "1416" figure).
