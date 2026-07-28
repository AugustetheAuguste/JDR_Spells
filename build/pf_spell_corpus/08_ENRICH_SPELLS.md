# 08 — ENRICH SPELL FILES WITH CLASS / LEVEL DATA

## Objectives

Join the class-list dimension onto each individual spell file, so that opening
any `data/sorts/<id>.json` answers "who can cast this, and at what level" without
consulting another file:

1. Populate each spell's `classes` array from the unique-spell index.
2. Cross-check the class-list levels against the spell page's own `niveaux`
   abbreviations and report every disagreement — this is the plan's main
   correctness audit, since the two sources are independent.
3. Write `reports/08_enrich.md`: enrichment counts, orphans in both directions,
   and the full level-disagreement list.

## Dependencies & Parallelization

- **Wave:** 6
- **Depends on BOTH:**
  - `05_UNIQUE_SPELL_INDEX.md` — `data/index/sorts_uniques.jsonl`.
  - `07_PARSE_SPELL_PAGES.md` — `data/sorts/*.json`.
  This is the single join point in the plan; it cannot run earlier.
- **Wave-mates:** none.
- **Hidden dependencies:** none. No network. Also reads `data/classes.json`
  (step 03) for the label↔slug table and `pf_spells.classes.CLASS_ABBREV`
  (step 02) for the abbreviation mapping.

## Inherited Context from Dependencies

### From step 05 — `data/index/sorts_uniques.jsonl`

One compact JSON object per line:

```
{ "id": "detection-de-la-magie",
  "nom": "Détection de la magie",
  "url": "https://...",
  "classes": [ {"classe": "Druide", "slug": "druide", "niveau": 0},
               {"classe": "Arcaniste/Ensorceleur/Magicien",
                "slug": "arcaniste-ensorceleur-magicien", "niveau": 0} ],
  "nb_classes": 2, "niveau_min": 0, "niveau_max": 0,
  "partage": true, "ecoles": ["Divination"], "sources": [] }
```

`id` is the join key, guaranteed consistent by step 04.

### From step 07 — `data/sorts/<id>.json`

Pretty-printed, 2-space indent, UTF-8, all 21 keys always present:
`id`, `nom`, `url`, `ecole`, `descripteurs`, `niveaux`, `temps_incantation`,
`composantes`, `portee`, `cible`, `duree`, `jet_de_sauvegarde`,
`resistance_magie`, `description`, `description_html`, `mythique`, `variantes`,
`sources`, `autres`, `classes`, `meta`.

- `classes` is currently `[]` — **this step fills it.**
- `niveaux` is the spell page's own map of **wiki abbreviation → level**, e.g.
  `{"Inq":1,"Pal":1,"Prê":1}`, abbreviations verbatim with accents.
- Validated against `schemas/sort.schema.json`.

### From step 03 — `data/classes.json`

19 objects with `classe`, `slug`, `url`, `cache_fichier`, `taille_octets`,
`statut`, `note`.

### From step 02 — `pf_spells.classes` (`PYTHONPATH=src`)

```
CLASS_ABBREV: dict[str, str]      # wiki abbrev -> class slug
lookup_abbrev(abbrev) -> str|None  # None on unknown; caller must REPORT, not guess
```
Confirmed abbreviations: `Bard`, `Cham`, `Inq`, `Occ`, `Pal`, `Prê`, `Magus`,
`Réd`. Others (`Arc`, `Ens`, `Mag`, `Dru`, …) may be marked provisional in the
table — any abbreviation returning `None` is a finding for the report.

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Authority on the key
vocabulary, JSON formatting (`indent=2`, `ensure_ascii=false`, canonical key
order, trailing newline), and the human-correction contract.

### The multi-class label subtlety — read carefully

Two roster labels cover several classes:
`Arcaniste/Ensorceleur/Magicien` and `Prêtre/Prêtre combattant/Oracle`. A spell
page for such a spell shows the *individual* abbreviations (`Arc`, `Ens`, `Mag`
/ `Prê`, `Ora`), while the class list shows the combined label. Therefore:
- An abbreviation mapping to *any* member of a combined label **counts as a
  match** for that label. Do not report `Ens 3` vs
  `Arcaniste/Ensorceleur/Magicien 3` as a disagreement — it is a match.
- Build an explicit `label → set of member abbreviations` table for the two
  combined labels and use it in the cross-check.

### Output contract — the `classes` field

```
"classes": [ { "classe": "Druide", "slug": "druide", "niveau": 0,
               "niveau_page": 0, "concordance": true } ]
```
- `niveau` from the class list (step 05), `niveau_page` from the spell page's
  `niveaux` via abbreviation lookup (`null` if no abbreviation for that class
  appears on the page), `concordance` = `niveau == niveau_page`
  (`null` when `niveau_page` is `null`).
- Sorted by `classe`. Every other key in the file is left **byte-identical**.

## Pseudo-code

```
index   = {l.id: l for l in data/index/sorts_uniques.jsonl}
classes = load data/classes.json;  label_to_slug, slug_to_label
COMBINED = { "Arcaniste/Ensorceleur/Magicien": {"Arc","Ens","Mag"},
             "Prêtre/Prêtre combattant/Oracle": {"Prê","PrC","Ora"} }
    # membership is provisional -> any abbrev not resolvable goes in the report

spell_files = list(data/sorts/*.json)
orphans_files = [ids on disk not in index]     # parsed but on no class list
orphans_index = [ids in index with no file]    # listed but unparsed (step 06 404s)

unknown_abbrevs = Counter(); divergences = []
for f in spell_files:
    doc = load json
    entry = index.get(doc.id)
    if not entry: record orphan; leave classes == []; continue

    enriched = []
    for c in entry.classes:
        abbrevs_for_class = COMBINED.get(c.classe) or {abbrev | lookup_abbrev(abbrev)==c.slug}
        niveau_page = the level from doc.niveaux for any abbrev in abbrevs_for_class
                      (if several and they differ, take the min and note it)
        enriched.append({classe, slug, niveau: c.niveau, niveau_page,
                         concordance: (niveau == niveau_page) if niveau_page is not None else None})
        if concordance is False: divergences.append({id, nom, classe, niveau, niveau_page})

    for abbrev in doc.niveaux:
        if lookup_abbrev(abbrev) is None and abbrev not in any COMBINED set:
            unknown_abbrevs[abbrev] += 1

    doc.classes = sorted(enriched, by classe)
    rewrite the file, canonical key order, indent=2, ensure_ascii=false
    # rewrite ONLY the classes field's content - all other bytes unchanged

write reports/08_enrich.md:
    counts: files enriched / orphaned-on-disk / orphaned-in-index
    concordance: matched / diverged / unknown-page-level, as percentages
    FULL divergence table (id, nom, classe, list level, page level)
    unknown abbreviation table with counts
    note: abbrevs present on pages for classes NOT in elements_to_do.json
          (e.g. Rôdeur 'Réd') are expected and are NOT errors - the plan only
          covers the 19 listed classes
```

## Logic Flow

1. Load the Skill. `PYTHONPATH=src`. Load the index, roster, and file list.
2. Compute both orphan sets first and report them before mutating anything — an
   unexpectedly large orphan set means an upstream `id` mismatch, which is
   blocking.
3. Enrich each file in place, touching only `classes`.
4. Accumulate divergences and unknown abbreviations.
5. Re-validate every rewritten file against `schemas/sort.schema.json`.
6. Write the report.
7. Commit.

## Implementation Notes

- Implement as `src/pf_spells/enrich_spells.py`, run via
  `PYTHONPATH=src python -m pf_spells.enrich_spells`. Flag: `--dry-run` (report
  only, write nothing) — run that first and read the report before writing.
- **Idempotent by construction:** re-running replaces `classes` with the same
  computed value. Running twice must leave files byte-identical. Verify this.
- **Preserve human corrections.** This step rewrites only `classes`. If a human
  has hand-fixed `description` or `portee`, those bytes must survive. Implement
  by loading, replacing the one key, and re-serializing with the canonical key
  order — never by regenerating the document from the HTML.
- Divergences are **findings, not failures**. A class list saying Pal 1 while the
  page says Pal 1 for a different sub-spell, or a wiki typo, are both real and
  both worth a human's eyes. Report them all; fix none automatically.
- `Réd` (Rôdeur/Ranger) and other abbreviations for classes absent from
  `elements_to_do.json` will appear on pages. That is expected — the input list
  has 19 classes and PF1 has more. Note them, do not treat them as errors.
- No network, no HTML parsing.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. Every `data/sorts/*.json` still validates against `schemas/sort.schema.json`
   after the rewrite.
2. **≥99%** of spell files have a non-empty `classes` array. Report the exact
   figure and the full orphan list if any.
3. `orphans_index` (index ids with no file) equals exactly the set of step-06
   fetch failures reported in `reports/06_fetch_spells.md`. Confirm the two lists
   match — a mismatch means data was lost between steps.
4. `orphans_files` (files with no index entry) is **empty**. Any entry here means
   an `id` inconsistency and is blocking.
5. **Concordance rate ≥90%** among pairs where `niveau_page` is not `null`.
   Report matched / diverged / unknown as three percentages. A rate below 90%
   suggests the abbreviation table is wrong — investigate before accepting.
6. Hand-verified fixtures:
   - `armes-contre-le-mal`: `classes` contains entries for the Inquisiteur and
     Paladin labels with `niveau == 1` and `concordance == true`.
   - `detection-de-la-magie`: `classes` has several entries; the
     `Arcaniste/Ensorceleur/Magicien` entry has `concordance == true`, proving
     the combined-label abbreviation mapping works.
   - `requiem-pour-les-fantomes`: the Paladin entry has `niveau_page == 1` and
     the Barde entry `niveau_page == 2` — different levels for different
     classes, correctly resolved per class rather than collapsed.
7. **Idempotence:** run the step twice; `git status` after the second run shows
   no modified files.
8. **Non-destructive:** before running, hand-edit one spell file's `description`
   to a sentinel string; after running, the sentinel is still present and
   `classes` is populated. Then revert the sentinel.
9. `reports/08_enrich.md` contains the full divergence table and the unknown
   abbreviation table, and explicitly notes the non-listed-class abbreviations
   as expected.
10. Confirms inherited tooling: imports `pf_spells.classes` for the abbreviation
    lookup rather than hardcoding a map inside the driver, and reports having
    loaded the `pf-corpus-conventions` Skill.

## Git Handling

- **Branch:** `feat/spell-corpus` directly — Wave 6 is this step alone.
- **Commits:**
  1. `feat(step-08): add class/level enrichment with cross-source concordance check`
  2. `feat(step-08): enrich spell corpus with class and level data`
     (includes the rewritten `data/sorts/*.json` + `reports/08_enrich.md`)
- The second commit touches every spell file. That is expected: one key changes
  in each, and the diff is reviewable because key order and formatting are
  canonical.

## Expected Outcome

A fully joined corpus: every spell file self-describes which of the 19 classes
can cast it and at what level, cross-validated against the spell page's own
data, with every disagreement surfaced for human review instead of silently
reconciled.
