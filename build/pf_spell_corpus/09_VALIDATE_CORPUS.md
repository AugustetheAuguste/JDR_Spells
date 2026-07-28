# 09 — VALIDATE THE CORPUS & PRODUCE THE AUDIT REPORT

## Objectives

Independently audit the finished corpus and produce the report a human uses to
decide what to correct by hand. This step **writes no data** — it only reads,
verifies, and reports.

1. `reports/09_validation.md` — the headline audit: schema conformance,
   referential integrity across all artifacts, field coverage, anomaly lists.
2. `reports/09_anomalies.jsonl` — machine-readable anomaly list, one per line,
   so a correction pass can be driven from it.
3. A pass/fail verdict on whether `feat/spell-corpus` is fit to merge to `main`.

The value here is **independence**: this step re-derives its checks from the
artifacts themselves rather than trusting any producing step's self-report.

## Dependencies & Parallelization

- **Wave:** 7
- **Depends on:** `08_ENRICH_SPELLS.md` — the corpus in its final state.
  Transitively reads artifacts from steps 03–07, all of which are final by now.
  Uses `schemas/*.json` (step 02) and the Skill (step 01).
- **Wave-mate:** `10_MANIFEST_AND_DOCS.md`. Fully parallel: this step writes only
  `reports/09_*`; step 10 writes only `CLAUDE.md`, `README.md`, and
  `data/MANIFEST.json`. Disjoint outputs, and both are read-only over `data/`.
- **Hidden dependencies:** none. No network.

## Inherited Context from Dependencies

### Artifacts to audit (all final)

| Path | Shape |
|---|---|
| `data/classes.json` | 19 objects: `classe`, `slug`, `url`, `cache_fichier`, `taille_octets`, `statut`, `note` |
| `data/listes_classes/<slug>.jsonl` | 19 files; keys `id`, `nom`, `url`, `classe`, `niveau`, `ecole`, `description_courte`, `sources`, `ligne_html` |
| `data/spell_pages.jsonl` | keys `id`, `nom`, `url`, `cache_fichier`, `taille_octets`, `statut`, `from_cache`, `note` |
| `data/index/sorts_uniques.jsonl` | keys `id`, `nom`, `url`, `classes`, `nb_classes`, `niveau_min`, `niveau_max`, `partage`, `ecoles`, `sources` |
| `data/index/carte_doublons.json` | `genere_le`, `nb_sorts_uniques`, `nb_sorts_partages`, `distribution_partage`, `top_partages`, `sorts_partages`, `niveaux_divergents` |
| `data/index/sorts_exclusifs.json` | `genere_le`, `par_classe`, `totaux` |
| `data/sorts/<id>.json` | 21 keys (see below) |
| `cache/html/<sha1>.html`, `cache/index.jsonl` | raw cached pages + fetch journal |
| `reports/03..08_*.md` | producing steps' own reports |

Spell file keys: `id`, `nom`, `url`, `ecole`, `descripteurs`, `niveaux`,
`temps_incantation`, `composantes`, `portee`, `cible`, `duree`,
`jet_de_sauvegarde`, `resistance_magie`, `description`, `description_html`,
`mythique`, `variantes`, `sources`, `autres`, `classes`, `meta`.
`classes` entries: `{classe, slug, niveau, niveau_page, concordance}`.

### From step 02 — schemas and modules (`PYTHONPATH=src`)

`schemas/sort.schema.json`, `schemas/liste_classe.schema.json`,
`pf_spells.slugs.slugify`, `pf_spells.htmlutil`. Use `jsonschema`
(`Draft202012Validator`).

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Use it as the reference against
which conventions are checked — in particular, re-derive `slugify(nom)` for every
spell and confirm it matches the stored `id` (allowing documented `-2`/`-3`
collision suffixes).

### Known-acceptable findings (do not report these as defects)

- A small number of genuine wiki 404s from step 06, provided they are listed in
  `reports/06_fetch_spells.md` and appear as index orphans in step 08's report.
- Level divergence across classes for the same spell (`niveaux_divergents`) —
  normal PF1 design.
- Wiki abbreviations for classes outside the 19 in `elements_to_do.json`
  (e.g. `Réd`) appearing in a spell's `niveaux`.
- Empty `ecoles` in the index for classes whose list pages don't group by school
  (Druide, Paladin, Alchimiste).
- `mythique` populated on some spells — captured deliberately, slated for
  removal in a later project phase.

## Checks to run

**A. Schema conformance**
- A1 every `data/sorts/*.json` validates against `sort.schema.json`.
- A2 every line of every `data/listes_classes/*.jsonl` validates against
  `liste_classe.schema.json`.
- A3 all JSON/JSONL files parse; all files decode as UTF-8 strict; no BOM.

**B. Referential integrity**
- B1 every `id` in `sorts_uniques.jsonl` has a `data/sorts/<id>.json`, except the
  step-06 failures — and that exception set matches exactly.
- B2 every `data/sorts/<id>.json` has an index entry (must be 100%).
- B3 every `id` in every class JSONL appears in `sorts_uniques.jsonl`.
- B4 every `classe` value everywhere is one of the 19 roster labels.
- B5 every `meta.cache_fichier` in every spell file exists on disk.
- B6 `carte_doublons.sorts_partages` ∪ `sorts_exclusifs` partitions the index
  exactly, with no overlap and no gap.
- B7 for 20 random spells, the `classes` array in the spell file matches the
  index entry's `classes` (same labels, same `niveau`).

**C. Convention conformance**
- C1 `slugify(nom) == id` for every spell (modulo documented collision suffixes);
  list every exception.
- C2 all 21 keys present in every spell file, in canonical order; no extras.
- C3 filenames equal `<id>.json`.
- D-free of accent damage: no spell file contains the U+FFFD replacement
  character `` in any value. **This is the decisive encoding check** — its
  presence anywhere means something was decoded as the wrong charset.

**D. Coverage and plausibility**
- D1 per-field non-null coverage across all spells, as percentages, for the nine
  stat-block fields plus `description`.
- D2 `description` length distribution: min, median, max; list every spell with
  a description under 40 characters.
- D3 unique spell count in the 2,500–3,500 band; total class-list entries in the
  4,000–5,000 band; report both with the sharing ratio.
- D4 level ranges per class are plausible: Paladin/Antipaladin 1–4,
  Alchimiste 1–6, Arcaniste/Ensorceleur/Magicien and Druide and
  Prêtre… 0–9. Flag any class whose max level exceeds 9 or whose min is below 0.
- D5 counts of spells with `mythique`, with `variantes`, and with non-empty
  `autres`.

**E. Duplicate/uniqueness sanity (the user's second deliverable)**
- E1 at least one spell is shared by ≥5 classes; name the top 10.
- E2 every class has its exclusive-spell count reported; classes with 0 are
  called out explicitly as a notable (possibly suspicious) result.
- E3 no spell appears twice in the same class's JSONL at the same level.

## Pseudo-code

```
anomalies = []      # each: {check, gravite: "bloquant"|"avertissement"|"info",
                    #        id, nom, detail}
run checks A1..E3, appending anomalies rather than raising
blocking = [a for a in anomalies if a.gravite == "bloquant"]

write reports/09_anomalies.jsonl  (one anomaly per line, sorted by check then id)
write reports/09_validation.md:
    VERDICT: PASS if not blocking else FAIL, stated in the first line
    summary table: check id | description | result | count
    coverage table (D1) with percentages
    counts table (D3, D5)
    top-10 most-shared spells (E1) and per-class exclusives (E2)
    every blocking anomaly, in full
    warnings, grouped by check, truncated to 25 examples each with total counts
    an explicit "Known-acceptable findings" section confirming which
      pre-agreed exceptions were observed
    a "Recommended human review queue" section: the highest-value items for
      the user to inspect first (low-coverage spells, step-08 divergences,
      slug collisions, unknown labels)
```

## Logic Flow

1. Load the Skill. `PYTHONPATH=src`.
2. Load every artifact once into memory (the corpus is a few hundred MB at most
   including `description_html`; if memory is tight, stream the spell files).
3. Run checks A → E in order, accumulating anomalies. **Never abort on the first
   failure** — a complete picture is the whole point.
4. Assign gravity: A1, A2, A3, B2, B4, B6, C2, C3, C4 → `bloquant`.
   B1/B3/B5/B7 mismatches beyond the agreed exception set → `bloquant`.
   Coverage below the step-07 thresholds → `bloquant`. Everything else →
   `avertissement` or `info`.
5. Write both reports. State the verdict on line 1 of the markdown.
6. Commit. If the verdict is FAIL, do **not** merge to `main`; report which step
   needs re-running.

## Implementation Notes

- Implement as `src/pf_spells/validate_corpus.py`, run via
  `PYTHONPATH=src python -m pf_spells.validate_corpus`. Exit code 0 on PASS,
  1 on FAIL — so it can gate the final merge.
- **Re-derive, don't trust.** Recount the unique spells from the class JSONL
  rather than reading `nb_sorts_uniques`; recompute `slugify(nom)` rather than
  assuming step 04 got it right. The point of this step is independent
  confirmation.
- Check C4 (the `` replacement character) is the single highest-value check in
  the plan: the source pages have no `<meta charset>`, so a mis-decode is the
  most likely silent corruption, and it would be invisible in aggregate counts
  while ruining individual French text.
- Read `reports/06_fetch_spells.md` and `reports/08_enrich.md` to obtain the
  agreed exception sets for B1. If those reports are missing, that itself is a
  blocking anomaly.
- This step is **read-only over `data/`**. It must not write, move, or fix
  anything there. Corrections are a human decision, informed by this report.
- No network.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `reports/09_validation.md` exists and its first line states `VERDICT: PASS` or
   `VERDICT: FAIL` unambiguously.
2. `reports/09_anomalies.jsonl` exists; every line parses as JSON with the four
   keys `check`, `gravite`, `id`, `detail` (plus optional `nom`).
3. All checks A1–E3 appear in the summary table with an explicit result — none
   marked "skipped" or "not run".
4. `PYTHONPATH=src python -m pf_spells.validate_corpus` exit code matches the
   stated verdict (0 for PASS, 1 for FAIL).
5. Check C4 reports **zero** occurrences of the U+FFFD replacement character
   across the whole corpus. Any occurrence is blocking.
6. The report's coverage table shows `ecole` and `niveaux` at ≥98% and
   `description` at ≥99%, or explains each shortfall spell-by-spell.
7. Self-audit of the auditor: deliberately introduce one defect into a **copy**
   of a spell file in a scratch directory (e.g. delete the `portee` key), point
   the validator at the copy, and confirm it is caught and classified
   `bloquant`. Then discard the scratch copy. Confirm `git status` over `data/`
   is clean afterwards.
8. `git status --porcelain` shows changes only under `reports/` and
   `src/pf_spells/validate_corpus.py` — proving the step wrote nothing into
   `data/`.
9. The "Known-acceptable findings" section explicitly addresses all five
   pre-agreed exceptions listed in this file.
10. Confirms inherited tooling: validates using `schemas/sort.schema.json` and
    `schemas/liste_classe.schema.json` and re-derives ids with
    `pf_spells.slugs.slugify`; reports having loaded the
    `pf-corpus-conventions` Skill.

## Git Handling

- **Branch:** `step/09-validate`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 10 runs concurrently.
  `git worktree add ../wt-09 -b step/09-validate feat/spell-corpus`
- **Commits:**
  1. `feat(step-09): add independent corpus validator`
  2. `docs(step-09): add corpus validation report and anomaly list`
- Merge to `feat/spell-corpus` with `--no-ff`. **The final merge of
  `feat/spell-corpus` into `main` is gated on this step's verdict being PASS.**

## Expected Outcome

An independent, reproducible audit with a binary verdict and a prioritized human
review queue. The user learns not just that the corpus was built, but exactly
where it is weak and what to inspect first — which is the stated purpose of
Phase 1.
