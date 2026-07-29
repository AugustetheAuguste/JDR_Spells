# Step 08 — Enrich Spells with Classes and Levels — Verification Report

**Status: COMPLETE.** All 10 Verification Criteria pass. 2,070 / 2,070 spells
enriched, **100.00 % concordance** on the 8,409 comparable (spell, class) pairs,
**zero** divergences, **zero** orphans in either direction.

## What was built

| Artifact | Detail |
|---|---|
| `src/pf_spells/enrich_spells.py` | Step-08 driver. Run: `PYTHONPATH=src python -m pf_spells.enrich_spells` |
| `tests/test_enrich_spells.py` | 22 tests: the join and the concordance verdict on synthetic docs, non-destructiveness, format rules, corpus-wide contract, independent re-derivation, idempotence |
| `src/pf_spells/classes.py` | `CLASS_ABBREV` rebuilt from evidence (below), plus `CLASS_ABBREV_HORS_LISTE`, `LABELS_COMBINES`, `abbrevs_pour_slug()` |
| `schemas/sort.schema.json` | `classes` entries extended to require `niveau_page` and `concordance` |
| `data/sorts/*.json` | `classes` filled on all 2,070 files; every other byte preserved |
| `reports/08_enrich.md` | Concordance table, orphans, divergences, unknown/out-of-roster abbreviations, the two null-verdict categories |

Flags: `--dry-run` (compute and report, write nothing), `--sorts-dir`, `--no-report`.

## The inherited abbreviation table was materially wrong — rebuilt from evidence

`CLASS_ABBREV` as inherited was guessed. Audited against the real corpus it left
these unmapped: `Ens/Mag` (1,221 spells), `Sor` (733), `Dru` (494), `Con` (276),
`ConU` (257), `San` (242), `Rôd` (233), `Apal` (117) — and four roster classes
(chasseur, druide, sanguin, sorcière) were unreachable altogether. Enrichment on
that table would have produced a corpus of `null` verdicts that still *looked*
schema-valid.

It was rebuilt empirically: on a spell page, every abbreviation on the `Niveau`
line is a **hyperlink to its class page**, so the mapping was derived from the
`<a href>` target of every such link across all 2,070 cached pages. 30 evidenced
rows, all observed spellings included (`Apal`/`Antipal`/`AntiPal`, `Méd`/`Med`,
`Rôd`/`Rod`, and the lowercase variants).

Two further structures were needed and are new:

- **`LABELS_COMBINES`** — a roster label naming several classes at once resolves
  from any member abbreviation, so `Ens 3` on a page **concords** with
  `Arcaniste/Ensorceleur/Magicien 3` rather than reading as a mismatch. Without
  this, ~1,200 spells would have shown a false divergence.
- **`CLASS_ABBREV_HORS_LISTE`** — `Rôd`, `ConU`, `Adepte` are real PF1 classes
  outside the plan's 19. Recognizing them explicitly means they are reported as
  *expected findings*, never as unknowns needing investigation.

The plan's known-acceptable list names abbreviation `Réd`; the corpus actually
spells it **`Rôd`** (234 spells). The stale assertion in the inherited
`tests/test_classes.py` was removed and replaced with a test pinning the real
behaviour.

## Verification Criteria — evidence

| # | Criterion | Result |
|---|---|---|
| 1 | Every file still validates after the rewrite | **0** schema errors across 2,070 files (`test_all_files_still_validate`) |
| 2 | ≥99 % of files have a non-empty `classes` | **100.00 %** — 2,070 / 2,070. Orphan list empty |
| 3 | `orphans_index` equals the step-06 failure set | Both are **empty**. Step 06 reported 0 failures and 0 genuine 404s; the index has 2,070 entries and disk has 2,070 files. Verified set-equal both ways |
| 4 | `orphans_files` is empty | **Empty** — 0 files without an index entry |
| 5 | Concordance ≥ 90 % | **100.00 %** (8,409 / 8,409). Matched 94.20 %, diverged 0.00 %, unknown 5.80 % of all 8,927 pairs |
| 6 | Three hand-verified fixtures | All pass — table below |
| 7 | Idempotence | Second run: `2070 enrichis, 0 modifiés, 2070 inchangés`; the working-tree diff stayed at exactly the same 2,070 files, no new change. Also asserted in `TestIdempotence` |
| 8 | Non-destructive (sentinel) | Run for real: appended ` SENTINELLE-HUMAINE-08` to `armes-contre-le-mal`'s `description` and emptied its `classes`; after enrichment the sentinel was **still present** and `classes` was repopulated with 3 entries. Sentinel then reverted; `git status` clean. Also asserted as a pytest test |
| 9 | Report has divergence + unknown-abbrev tables and notes non-roster abbrevs | `reports/08_enrich.md` — plus two sections the plan did not ask for (below) |
| 10 | Imports `pf_spells.classes` rather than hardcoding a map; Skill loaded | The driver imports `CLASS_ABBREV_HORS_LISTE`, `LABELS_COMBINES`, `abbrevs_pour_slug`, `lookup_abbrev` from `pf_spells.classes` and declares no map of its own. `pf-corpus-conventions` Skill loaded and used as the authority for the key vocabulary, null policy and file-format rules |

### Criterion 6 — fixtures

| Spell | Expected | Observed |
|---|---|---|
| `armes-contre-le-mal` | Inquisiteur and Paladin at `niveau 1`, `concordance true` | Inquisiteur 1/1 ✓, Paladin 1/1 ✓, Prêtre… 1/1 ✓ |
| `detection-de-la-magie` | several entries; `Arcaniste/Ensorceleur/Magicien` concords | 15 entries; Arcaniste/Ensorceleur/Magicien `niveau 0`, `niveau_page 0`, `concordance true` — the combined-label mapping works |
| `requiem-pour-les-fantomes` | Paladin `niveau_page 1`, Barde `niveau_page 2` | Paladin 1/1, Barde 2/2 — resolved **per class**, not collapsed |

## The 518 non-comparable pairs, both categories named

A `null` verdict is neither a match nor a mismatch, and the report separates the
two reasons rather than lumping them:

1. **Chasseur — 512 pairs.** The class has a spell list on the wiki but **no
   `Niveau`-line abbreviation of its own** anywhere in the corpus (its spells are
   marked `Dru`/`Rôd` instead). It therefore can never be cross-checked. Verified
   directly against the data, and pinned by `test_only_chasseur_has_no_abbrev`,
   which asserts the set of abbreviation-less roster classes is *exactly*
   `{"chasseur"}` — so a genuinely missing mapping for any other class still
   fails loudly.
2. **6 pairs where the class list claims a spell the page does not confirm** —
   `adaptation-culturelle` (Médium, Occultiste, Psychiste),
   `protection-contre-les-sorts` (Psychiste), `rejeter-la-faute` (Sorcière),
   `toucher-de-combustion` (Sanguin). The class has abbreviations elsewhere, but
   none appears on that page. Listed individually in `reports/08_enrich.md` with
   the page's actual abbreviations, for human review.

**Divergences are reported, never reconciled.** A wiki typo and a genuine
per-class difference are indistinguishable to a program; the class-list level is
always preserved verbatim in `niveau` and only the verdict changes. In this
corpus there happen to be zero divergences.

## One genuine wiki defect found and fixed upstream

The single unknown abbreviation in the first dry run was `magus 1 Ens/Mag` on
`toucher-de-combustion` — the wiki author dropped a comma, so its `Niveau` line
reads `magus 1 Ens/Mag 1`. Fixed in `parse_spells.parse_niveaux` by splitting a
run of `abbrev level` pairs inside one comma-chunk, guarded so the split can only
fire when the abbreviation itself contains a digit (which is otherwise
impossible). That page was re-parsed with `--only`, and a corpus-wide invariant
test now asserts **no abbreviation anywhere contains a digit**.

## Non-destructiveness is structural, not incidental

`data/sorts/*.json` is hand-editable and human edits are authoritative, so the
driver loads the document, replaces exactly one key, and re-serializes with the
same format rules (`indent=2`, `ensure_ascii=False`, LF, no BOM, trailing
newline). Proven mechanically: filtering the full `git diff -U0` of all 2,070
files down to lines that are *not* part of a `classes` block leaves only the
three intended `niveaux` lines from the `toucher-de-combustion` fix — nothing
else in the corpus moved.

## Setup and how to re-run

```
export PYTHONPATH=src
python -m pf_spells.enrich_spells --dry-run   # read reports/08_enrich.md first
python -m pf_spells.enrich_spells
python -m pytest tests/test_enrich_spells.py -q
```

Exit code is 1 if any file fails validation or any `orphans_files` entry exists,
so the step can gate a pipeline. Offline; the module contains no HTTP client and
no HTML parsing.

## Test suite

**199 tests pass** (`PYTHONPATH=src python -m pytest tests -q`, ~71 s), up from
170 after step 07. Three inherited tests were corrected where they asserted
things the real data contradicts — the stale `Réd` abbreviation, the
`variantes.mythique` schema shape, and a `classes` fixture that predated the
five-key entry contract.

## Commits

| SHA | Message |
|---|---|
| `02d5244` | `feat(step-08): add class/level enrichment with cross-source concordance check` |
| `3767a36` | `chore(step-08): fill classes on all 2070 spells and write the enrich report` |
