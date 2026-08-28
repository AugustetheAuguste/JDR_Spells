# Step 04 — Build the feat category tagger (`tag_feat_categories.py` → `Data/feat_categories.json`)

## Objectives

Produce a standalone script that assigns a best-effort category tag (e.g.
`"combat"`, `"metamagie"`, `"creation_objet"`, `"tir_a_distance"`, etc.) to
each feat in `Data/Dons.csv`, so that category-restricted bonus feat slots
(fighter's "combat feats only", etc.) can later be checked. This is
explicitly best-effort — feats the heuristics can't confidently classify
are tagged `"categories": [], "needs_manual_check": true`, mirroring the
existing `needs_manual_check` convention in `pf1_dons/parser.py`.

## Dependencies & Parallelization

- **Wave 1.** Depends only on `Data/Dons.csv`, which already exists. No
  dependency on any other step. Safe to run fully in parallel with Steps
  01, 02, 03.

## Inherited Context

`Data/Dons.csv` columns (confirmed by inspection): `Dons` (feat name, some
suffixed with `*`), `Src` (source book abbreviation, e.g. `AG`, `AM`, `MCA`,
`MR`), `Conditions` (prerequisites, French prose), `Avantages` (benefit
text, French prose). 1416 data rows. No existing category/tag column.

There is no reliable single source on pathfinder-fr.org that tags every
feat with its official category in a machine-parseable way across this
many feats within this plan's scope — this step uses **keyword heuristics
over the `Avantages` (benefit) text and feat name**, not a scrape.

## Pseudo-code

```
IN_PATH = Path("Data/Dons.csv")
OUT_PATH = Path("Data/feat_categories.json")

# category -> list of (regex or substring, case/accent-insensitive) keyword cues
CATEGORY_KEYWORDS = {
    "combat": [
        "attaque en puissance", "attaque en finesse", "cac", "arme de guerre",
        "attaque d'opportunite", "manoeuvre offensive", "coup", "esquive",
        "combat a deux armes", "port du bouclier", "attaque a outrance",
    ],
    "tir_a_distance": ["arme a distance", "arc", "arbalete", "tir de precision", "tir en mouvement"],
    "metamagie": ["metamagique", "sort modifie", "sorts modifies"],
    "creation_objet": ["creation d'objet", "objet magique", "confection"],
    "monture": ["monture", "cavalier", "lancier"],
    "sociale": ["diplomatie", "intimidation", "representation", "bluff"],
    # extend as needed; keep list explicit and reviewable, not exhaustive-by-design
}

def normalize(text):  # copy from pf1_dons/parser.py::_normalize
    ...

def classify(name, benefits_text) -> list[str]:
    haystack = normalize(name + " " + benefits_text)
    matched = [cat for cat, keywords in CATEGORY_KEYWORDS.items()
               if any(normalize(kw) in haystack for kw in keywords)]
    return matched

def main():
    df = pandas.read_csv(IN_PATH, encoding="utf-8")
    out = {}
    unclassified = 0
    for _, row in df.iterrows():
        name = clean_feat_name(row["Dons"])  # strip trailing "*" and whitespace, copy from data_loader.py
        categories = classify(name, str(row["Avantages"]))
        out[name] = {
            "categories": categories,
            "needs_manual_check": len(categories) == 0,
        }
        if not categories:
            unclassified += 1
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    print(f"{len(out)} feats tagged; {unclassified} unclassified (needs_manual_check)")
```

## Logic Flow

1. Load `Data/Dons.csv` directly with pandas (same library already used by
   `pf1_dons/data_loader.py`; this script stays standalone and does not
   import the package, but may depend on the same third-party library
   already in `requirements.txt`).
2. For each feat, run keyword matching over its name + benefit text against
   a curated `CATEGORY_KEYWORDS` table.
3. Write one entry per feat name (using the same trailing-`*`-stripped
   `clean_feat_name` convention as `pf1_dons/data_loader.py`, so keys line
   up with `FeatRow.name`), recording matched categories and a
   `needs_manual_check` flag when nothing matched.
4. Print a summary count so whoever runs this can gauge coverage.

## Implementation Notes

- Copy (don't import) `clean_feat_name` and the accent-stripping `normalize`
  helper — same rationale as other scraper scripts staying independent of
  the package.
- A feat may legitimately match zero categories (many feats are neither
  combat nor magic nor social, e.g. pure skill feats) — `needs_manual_check`
  is not "this is wrong," it's "no category tag applies or the heuristic
  missed it"; downstream consumers (Step 07/12) must treat an empty
  `categories` list as "cannot satisfy a category-restricted slot, but not
  necessarily miscategorized."
- A feat may match multiple categories — keep all matches, don't force a
  single category per feat.
- Keep `CATEGORY_KEYWORDS` intentionally small and reviewable at first
  (covering at minimum "combat", since that's the only category this plan's
  functional steps actually need for fighter-style bonus slots); expanding
  it later is a cheap, isolated follow-up since this script has no other
  dependents' contracts baked into its keyword list.

## Verification Criteria

- `python tag_feat_categories.py` completes without exceptions.
- `Data/feat_categories.json` has exactly one key per unique feat name in
  `Data/Dons.csv` after the same `clean_feat_name` normalization
  `pf1_dons/data_loader.py::build_catalog` uses (1416 rows, but verify
  final key count against `len(df["Dons"].apply(clean_feat_name).unique())`
  in case of duplicate names).
- Spot check: `"Arme en main"` classifies with `"combat"` in its categories
  (it's a proficiency/combat feat by name).
- Spot check: at least one clearly non-combat social feat (e.g. something
  whose benefit text is about Diplomatie) does NOT get tagged `"combat"`.

## Git Handling

- Branch: `feature/character-creation/04-feat-categories`.
- Commit `tag_feat_categories.py` and `Data/feat_categories.json`.
- Commit message: `pf1_dons(04): add best-effort feat category tagger`.

## Expected Outcome

`Data/feat_categories.json` giving a best-effort category tag per feat,
consumed by Step 12 (CLI feat assignment) to validate category-restricted
bonus slots, with unclassified feats explicitly flagged rather than
silently treated as matching everything or nothing.
