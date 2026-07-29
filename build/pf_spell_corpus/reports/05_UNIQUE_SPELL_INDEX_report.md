# Step 05 — Unique Spell Index & Cross-Class Duplicate Map — Execution Report

**Status: COMPLETE.** All 10 Verification Criteria pass. Branch `step/05-index`
(worktree `../wt-05`), 2 commits, working tree clean.

## What was built

| Artifact | Kind | Detail |
|---|---|---|
| `src/pf_spells/build_index.py` | new module | Aggregator, CLI via `PYTHONPATH=src python -m pf_spells.build_index` |
| `tests/test_build_index.py` | new tests | 19 tests: 13 unit/synthetic + 6 corpus-output checks |
| `data/index/sorts_uniques.jsonl` | generated | 2070 lines, sorted by `id`, compact JSONL |
| `data/index/carte_doublons.json` | generated | `indent=2`, shared-spell map + stats |
| `data/index/sorts_exclusifs.json` | generated | all 19 classes as keys |
| `reports/05_index.md` | generated | 115-line human report |

`pf-corpus-conventions` Skill was loaded before any code was written; its rules
are what the output formats and key vocabulary follow.

## Headline numbers

| Metric | Value |
|---|---|
| List entries read (19 files) | 8 927 |
| Unique spells (distinct `id`) | **2 070** |
| Ratio uniques / entries | 0.232 |
| Shared (`nb_classes` > 1) | 1 774 |
| Exclusive (`nb_classes` == 1) | 296 |
| Level-divergent across classes | 678 |
| Intra-class level duplicates | 0 |
| URL disagreements | 0 |
| Classes with zero exclusive spells | Hypnotiseur, Médium |

## Deviation from the plan you should know about

**VC2's estimated range does not hold, and this is correct behaviour, not a bug.**
The plan predicted ~2 500–3 500 uniques from ~4 000–5 000 entries. Reality:
**8 927 entries → 2 070 uniques**. Both numbers sit outside the estimate — there
are roughly twice as many entries as predicted and fewer uniques.

I verified the count independently rather than trusting my own aggregation:
counting distinct `nom` values straight from the 19 raw JSONL files gives 2 070,
and distinct `url` values also gives 2 070. Three separate keys (`id`, `nom`,
`url`) agree exactly, so the collapse is faithful to step 04's output. The plan's
estimate was extrapolated from three sample pages; the real corpus simply shares
spells far more heavily than assumed (mean 4.3 classes per spell). The literal
sub-clause of VC2 that is testable — "strictly less than the total entry count,
report both numbers and the ratio" — passes and is reported above.

If the 8 927 entry count is itself wrong, the defect is upstream in step 04, not
here; this step reports what the class lists say, as the plan instructs.

## Verification Criteria — results

| # | Criterion | Result |
|---|---|---|
| 1 | JSONL exists, every line parses, full contract key set; line count == distinct ids | **PASS** — 2070 lines == 2070 distinct ids; all lines carry exactly the 10 contract keys |
| 2 | `nb_sorts_uniques` plausible, strictly < entries, report both + ratio | **PASS with deviation** — 2070 < 8927, ratio 0.232; range deviation analysed above |
| 3 | Partition check exact | **PASS** — 1774 + 296 = 2070; shared/exclusive id sets disjoint and their union is every unique id |
| 4 | Round-trip on 3 hand-picked spells | **PASS** — `detection-de-la-magie` (15 classes, level 0 in all), `arbres-de-siege` (Druide 7 only), `accorder-la-grace` (Paladin 2 only); all match source lines exactly |
| 5 | Every `classe` is one of the 19 roster labels | **PASS** — union of labels used across all three artifacts ⊆ roster; empty difference; slugs match roster slugs |
| 6 | `niveaux_divergents` non-empty, spot-checked | **PASS** — 678 entries; `absorption-de-toxine` (Alch 3 / Arc-Ens-Mag 5 / Chasseur 4 …) confirmed against source files |
| 7 | Exclusives cover all 19 classes incl. `nb: 0`; `totaux` sums | **PASS** — 19 keys, sum 296 == count of `nb_classes == 1`; Hypnotiseur and Médium present with `nb: 0` |
| 8 | Determinism across two runs | **PASS** — `sorts_uniques.jsonl` byte-identical; both JSON files identical after removing `genere_le`, and that timestamp did change |
| 9 | Report has per-class table, histogram, `ecoles`-hint note | **PASS** — all three present; report states the school hint is superseded by step 07 |
| 10 | Skill loaded; `grep -n "requests\|BeautifulSoup" build_index.py` empty | **PASS** — grep exits 1 with no output; tests also assert `httpx`/`bs4`/`lxml` are absent from the module source |

Full suite: **107 passed** (`PYTHONPATH=src python -m pytest -q`) — the 19 new
tests plus every pre-existing test from steps 02–04, so no regression.

## Design decisions taken inside this step

- **Blocking gates run before aggregation**, as instructed: name↔id bijection in
  both directions, plus class labels ⊆ roster (added as blocking because VC5
  demands it and a typo'd label would otherwise silently create a 20th class).
  Both gates pass on the real corpus.
- **URL disagreement resolution** (plan says WARN only, without saying which URL
  to keep): majority wins with alphabetical tie-break, so the choice is
  deterministic, and every divergence is listed in the report. Moot in practice —
  zero disagreements exist.
- **Identical repeated entries are not anomalies.** The plan's edge case is a
  class listing a spell at *two different* levels. A byte-identical repeat is
  folded silently; only a genuine level conflict is recorded (lowest level kept).
- **Extra arithmetic identity enforced in code**: `sum(nb_classes)` must equal
  the count of distinct `(id, classe)` pairs in the input, and the partition
  identity is re-asserted before the function returns. Either failing raises
  `IntegrityError` rather than writing a bad artifact.
- No `__init__` population, no `__all__` anywhere.

## How to re-run and re-verify

```bash
cd ../wt-05
PYTHONPATH=src python -m pf_spells.build_index      # rewrites data/index/ + reports/05_index.md
PYTHONPATH=src python -m pytest tests/test_build_index.py -q
PYTHONPATH=src python -m pytest -q                  # full suite, 107 tests
```

Re-running is safe and idempotent: output is byte-identical apart from
`genere_le` in the two `.json` files.

## Git state

- Branch `step/05-index`, cut from `feat/spell-corpus` via
  `git worktree add ../wt-05 -b step/05-index feat/spell-corpus`.
- `317f8f5 feat(step-05): add unique spell index and duplicate map builder`
- `ee77bb8 feat(step-05): generate unique spell index, duplicate map and exclusives`
- Working tree clean. Nothing outside this step's own paths was touched; the
  wave-mate step 06 writes only to `cache/`, so the merge is conflict-free.
- **Not merged** — merging `step/05-index` into `feat/spell-corpus` with `--no-ff`
  is the operator's call, per the plan's merge-order rule.

## Handoff to step 08

`data/index/sorts_uniques.jsonl` is the join surface: each line's `classes` array
(`{classe, slug, niveau}`, sorted by label) is what step 08 stamps onto each
`data/sorts/<id>.json`. `id` is the join key and is guaranteed identical to the
one step 04 assigned. Note for step 08: `ecoles` here is a list-page hint only,
often empty, and must not override the spell page's authoritative `École`.
