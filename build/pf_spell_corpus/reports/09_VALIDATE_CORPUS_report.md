# Step 09 — Validate the corpus: execution report

**Verdict: PASS.** `PYTHONPATH=src python -m pf_spells.validate_corpus` exits 0.
Zero blocking anomalies over 2 070 spell files, 8 927 class-list entries and
2 070 index entries. `feat/spell-corpus` is fit to merge to `main`.

## Deliverables

| Artifact | Content |
|---|---|
| `src/pf_spells/validate_corpus.py` | the auditor; 22 checks, exit code 0/1 |
| `tests/test_validate_corpus.py` | 74 tests (synthetic fixtures + real corpus) |
| `reports/09_validation.md` | the audit, `VERDICT: PASS` on line 1 |
| `reports/09_anomalies.jsonl` | 624 records: 0 blocking, 4 warnings, 620 info |

## Verification criteria

| # | Criterion | Evidence |
|---:|---|---|
| 1 | Report exists, verdict on line 1 | first line is exactly `VERDICT: PASS` |
| 2 | JSONL parses, four keys + optional `nom` | 624/624 lines parse; every record has `check`, `gravite`, `id`, `detail`; no key outside that set plus `nom` |
| 3 | All A1–E3 in the summary table with a result | the table is generated from the `CHECKS` mapping and any check without a result is itself a blocking anomaly; 22/22 present, none "skipped" |
| 4 | Exit code matches verdict | PASS → 0, observed; the broken-copy run returned 1 |
| 5 | C4 reports zero U+FFFD | 0 occurrences across 2 070 files, scanned on the raw file text (not just values) so keys and `description_html` are covered |
| 6 | Coverage `ecole`/`niveaux` ≥ 98 %, `description` ≥ 99 % | 100.00 % / 100.00 % / 100.00 % |
| 7 | Self-audit of the auditor | a copy of `armes-contre-le-mal.json` with `portee` deleted, in a scratch dir outside `data/`, came back `A1 bloquant` + `C2 bloquant`, verdict FAIL, exit 1. Scratch dir deleted; `git status --porcelain data/` empty. Encoded as `TestAutoAudit::test_portee_supprimee_est_bloquante` |
| 8 | Changes only under `reports/` and the new module | `git status --porcelain` listed only `src/pf_spells/validate_corpus.py`, `tests/test_validate_corpus.py`, `reports/09_validation.md`, `reports/09_anomalies.jsonl` |
| 9 | Known-acceptable findings addressed | all five, in a table, each with an explicit observed/not-observed verdict and its measured count |
| 10 | Inherited tooling confirmed | validates with `schemas/sort.schema.json` and `schemas/liste_classe.schema.json` via `Draft202012Validator`; re-derives ids with `pf_spells.slugs.slugify`; reuses `pf_spells.classes` for the abbreviation tables; states the Skill path it was audited against |

## Where the plan was wrong

1. **D3's volumetry bands are stale.** The plan expects 2 500–3 500 unique
   spells and 4 000–5 000 class-list entries. The corpus has **2 070** unique
   spells and **8 927** entries. Both plan figures were extrapolations from three
   list pages made before any parsing; the measured values agree with steps 04,
   05 and 06 (8 927 lines → 2 070 distinct URLs). Reported as an
   `avertissement`, with the real numbers and the sharing ratio (4.31), and
   explicitly **not** blocking. `D4`'s Antipaladin band (1–4) is stale the same
   way: the page really goes to level 6 — also a warning.
2. **`Réd` vs `Rôd`.** The plan's known-acceptable list spells the out-of-roster
   ranger abbreviation `Réd`. The corpus writes `Rôd` (234 spells) and once
   `Rod`. Same class (Rôdeur), wrong spelling in the plan. The report says so.
   Two further out-of-roster abbreviations the plan does not mention are also
   present and expected: `ConU` (257) and `Adepte` (1).
3. **The B1 exception set is empty.** Verified by parsing `reports/06_fetch_spells.md`
   and `reports/08_enrich.md`: zero fetch failures, zero orphans in either
   direction. So the plan's "small number of genuine wiki 404s" exception is
   recorded as **not observed** rather than confirmed. A missing report would
   itself be blocking; both exist.
4. **The plan's check list mislabels C4.** In `09_VALIDATE_CORPUS.md` the fourth
   convention check is written `- D-free of accent damage` under section **C**,
   while the Logic Flow and Verification Criterion 5 both call it C4. Implemented
   as C4, which is what the rest of the plan assumes.

## Notable findings for the human

- **Hypnotiseur and Médium have 0 exclusive spells.** Flagged as a warning and
  put second in the review queue: either genuine, or a list mis-attribution in
  step 04. Not decidable by a program.
- 678 spells carry level divergences between the class list and the spell page
  (step 08's table) — top of the review queue.
- `jet_de_sauvegarde` 85.65 % and `resistance_magie` 85.17 % coverage. No floor
  applies: a spell with no saving throw has no `Jet de sauvegarde` line at all.
  Each gap is nonetheless named spell by spell in the JSONL as `info`, so the
  human can sample-check that the absence is the source's and not the parser's.
  `portee` is missing on 2 spells and `cible` on 9 — few enough to open by hand.

## Tests

74 new tests in `tests/test_validate_corpus.py`; full suite **273 passed**
(199 on the base commit + 74). The unit tests break a synthetic corpus one way at
a time so each check is pinned to the defect it must catch *and* to the gravity
it must assign — including the cases that must **not** block (documented `-2`
slug suffixes, out-of-roster abbreviations, unfloored coverage gaps, an agreed
B1 exception, a spell listed at two different levels in one class). The corpus
tests assert the committed report is in sync with a fresh run, so the report
cannot go stale silently.

## Conformance

- Read-only over `data/`: `git status --porcelain data/` is empty after the full
  run and after the self-audit. No network anywhere in the module.
- No `__init__.py` was touched; no `__all__` anywhere.
