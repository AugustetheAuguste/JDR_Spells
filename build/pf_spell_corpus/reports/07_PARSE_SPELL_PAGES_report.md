# Step 07 — Parse Spell Pages — Verification Report

**Status: COMPLETE.** All 10 Verification Criteria pass. 2,070 spell files
written, 0 failures, 0 schema violations, 0 occurrences of the U+FFFD
replacement character.

## What was built

| Artifact | Detail |
|---|---|
| `src/pf_spells/parse_spells.py` | Step-07 driver, ~630 lines. Run: `PYTHONPATH=src python -m pf_spells.parse_spells` |
| `tests/test_parse_spells.py` | Unit tests on the stat-block reader, the four hand-verified sample pages in full, and contract tests over the committed corpus |
| `data/sorts/*.json` | **2,070 files** — the corpus |
| `reports/07_parse_spells.md` | Per-field coverage, unknown-label table, level-abbreviation table, failure list |
| `schemas/sort.schema.json` | Extended: `mythique` hoisted into a shared `$def` so a nested variant can carry its own mythic block |

Flags: `--limit N`, `--only <id>`, `--overwrite` (default **off**), `--out-dir`,
`--no-report`.

## The plan's page anatomy was partly wrong — corrected against all 2,070 pages

Rather than trust the spec, every cached page was surveyed before the parser was
written. Four findings changed the implementation:

| The plan said | The pages actually show | Consequence had it been trusted |
|---|---|---|
| Variant blocks are `<h3>`-titled | `<h1 class="separator">` inside `div.box` | zero variants extracted |
| Every `div.box` is a variant | 348 boxes reproduce the **base** spell instead (no `div.voiraussi` heading) | 348 phantom variants |
| Mythic heading is `Mythique` | `Version mythique` also occurs, 147 times | 147 mythic blocks leaking into `description` |
| — (unmentioned) | 94 variants carry their **own** mythic block, which the inherited schema forbade | 94 hard validation failures |

Also corrected: `cible` has eight real label synonyms in the corpus
(`Cible`, `Cibles`, `Effet`, `Zone`, `Zone d'effet`, `Cible ou cibles`,
`Cible et zone d'effet`, `Zone d'effet ou cible`, …), two of which were only
discovered by reading the first full run's unknown-label table and then re-running
with `--overwrite`.

**Design decision, kept deliberately:** bold text *after* the last recognized
stat label is prose, not a label. Real pages bold things like `<b>Amplifié.</b>`
and `<b>Attaque.</b>` mid-description. The parser tracks the index of the last
*recognized* label and maps no anchor beyond it — which is why the test suite
distinguishes "unknown label **between** known ones" (→ `autres`) from "unknown
label **after** the last known one" (→ prose).

## Verification Criteria — evidence

| # | Criterion | Result |
|---|---|---|
| 1 | One file per `ok` manifest line, counts reconcile | 2,070 `ok` lines → **2,070 files**, 0 failures. Asserted set-equal (not just count-equal) by `test_one_file_per_ok_manifest_line` |
| 2 | Every file validates; all 21 keys present | **0** schema errors, **0** files with a wrong key set or order |
| 3 | ≥98 % non-null `ecole` and non-empty `niveaux` | `ecole` **100.00 %**, `niveaux` **100.00 %**. Full nine-field table below |
| 4 | ≥99 % with `description` ≥ 40 chars | **100.00 %** |
| 5 | Four hand-verified fixtures | All four pass, asserted field-by-field in `TestEchantillons` |
| 6 | No variant also exists as its own top-level file | Passes. One genuine wiki slip pinned separately (below) |
| 7 | `classes == []` in every file | 2,070 / 2,070 at the time of step 07; step 08 then filled it |
| 8 | Spot-read 3 files | Accents render, 2-space indent, LF, no BOM, trailing newline, readable prose |
| 9 | Report contains coverage / unknown labels / counts / failures | `reports/07_parse_spells.md` |
| 10 | Inherited tooling; no network | Imports `htmlutil` + `slugs`, validates against `schemas/sort.schema.json`; `grep -n "requests\|urlopen\|httpx" src/pf_spells/parse_spells.py` is **empty** |

## Per-field coverage (criterion 3, all nine stat-block fields)

| Field | Coverage |
|---|---:|
| `ecole` | 100.00 % |
| `niveaux` | 100.00 % |
| `temps_incantation` | 100.00 % |
| `composantes` | 100.00 % |
| `portee` | 99.90 % (2068 / 2070) |
| `cible` | 99.57 % (2061 / 2070) |
| `duree` | 100.00 % |
| `jet_de_sauvegarde` | 85.65 % (1773 / 2070) |
| `resistance_magie` | 85.17 % (1763 / 2070) |
| `description` (≥40 chars) | 100.00 % |

`jet_de_sauvegarde` and `resistance_magie` sit near 85 % because many spells
genuinely omit those lines on the wiki (they are not applicable). They are `null`,
never invented — the null policy is that a missing scalar is `null`, never an
empty string and never omitted.

Other counts: `sources` 81.35 %, `mythique` populated on 287 spells,
`variantes` on 196 spells (357 nested variants), `autres` non-empty on 519.

## Two data facts confirmed as non-bugs and pinned in tests

1. **`immobilisation-de-monstre` nests a variant under its own display name.**
   The wiki author gave the level-9 mass version the parent's name. Verified by
   reading the page: the base block is `{Bard:4, …, Ens/Mag:5, …}` and the nested
   one `{Ens/Mag:9, Psy:9, Sor:9}` — two distinct spells, one name. Criterion 6
   is therefore expressed as *"no file exists **solely** because another page
   nested a variant of that name"*, and `test_the_only_self_named_variant_is_the_known_wiki_slip`
   pins the set to exactly `{"immobilisation-de-monstre"}` so a second occurrence
   fails loudly.
2. **`toucher-de-combustion` has a missing comma**: its `Niveau` line reads
   `magus 1 Ens/Mag 1`. Found during step 08 (it surfaced as a single unknown
   abbreviation `magus 1 Ens/Mag`). Fixed in the parser by splitting a run of
   `abbrev level` pairs inside one comma-chunk, guarded so it can only fire when
   the abbreviation itself contains a digit. Pinned by
   `test_parse_niveaux_splits_a_missing_comma` and by a corpus-wide invariant
   test that no abbreviation anywhere contains a digit.

## Setup and how to re-run

```
export PYTHONPATH=src
python -m pf_spells.parse_spells                  # writes only missing files
python -m pf_spells.parse_spells --overwrite      # rewrites all 2,070
python -m pf_spells.parse_spells --only armes-contre-le-mal --overwrite
python -m pytest tests/test_parse_spells.py -q
```

The default is **non-destructive**: an existing `data/sorts/<id>.json` is
preserved unless `--overwrite` is passed, because those files are hand-editable
and human edits are authoritative. Every parse failure is caught and reported,
never raised, and a schema-invalid document is never written.

## Commits

| SHA | Message |
|---|---|
| `8e4b0b1` | `feat(step-07): add spell page parser with variant and mythic isolation` |
| `5cf1563` | `test(step-07): add parser unit tests and corpus contract tests` |
| `d89e832` | `feat(step-07): generate per-spell JSON corpus` |

The `toucher-de-combustion` parser fix and its tests landed in step 08's first
commit, since that is where the defect was detected.
