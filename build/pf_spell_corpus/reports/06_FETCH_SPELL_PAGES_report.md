# Step 06 — Fetch All Unique Spell Pages — Verification Report

**Status: COMPLETE.** All 9 Verification Criteria pass. 2,070 distinct spell
pages cached, 100.00 % `ok`, 0 failures, 0 genuine wiki 404s.

## What was built

| Artifact | Detail |
|---|---|
| `src/pf_spells/fetch_spells.py` | Step-06 driver, 285 lines. Run: `PYTHONPATH=src python -m pf_spells.fetch_spells` |
| `tests/test_fetch_spells.py` | 28 tests: 20 unit (network hard-blocked, isolated cache) + 8 contract tests on the real committed artifacts |
| `data/spell_pages.jsonl` | 2,070 lines — the step-07 contract |
| `reports/06_fetch_spells.md` | Totals, gates applied, failure list, idempotence note |
| `cache/html/*.html` | 2,089 files = 2,070 spell pages + 19 class pages from step 03 |

Flags: `--force`, `--workers N` (default 4), `--limit N`.

## Headline numbers

| Measure | Value |
|---|---|
| Class-list lines read (`data/listes_classes/*.jsonl`) | 8,927 |
| **Distinct spell URLs → pages fetched** | **2,070** |
| Cross-class sharing collapsed away | 6,857 lines (77 %) |
| `statut == "ok"` | 2,070 / 2,070 = **100.00 %** |
| `statut == "erreur"` | **0** |
| Cold-crawl live fetches | 2,045 (+25 already warm from the smoke test) |
| Re-run wall-clock | 4–8 s, 2,070 cache hits, **0 live fetches** |

**Note on the expected range.** The plan predicted 2,500–3,500 distinct URLs;
the real figure is **2,070**. This is inside the step's own sanity band
(1,500–5,000, so no warning fires) and is a fact about the data, not a gap: it
is an independently reproducible count of distinct `url` values across the 19
step-04 files, and the manifest URL set is *set-equal* to that count
(criterion 2 asserts equality both ways, not just matching cardinality). The
plan's estimate was extrapolated from three large class pages before dedup was
measured.

## Verification Criteria — evidence

| # | Criterion | Result |
|---|---|---|
| 1 | Manifest exists; every line parses; exactly the 8 contract keys | **PASS** — 2,070 lines, `list(line) == [id, nom, url, cache_fichier, taille_octets, statut, from_cache, note]` for every line, in order |
| 2 | Line count == distinct `url` count, independently counted, < class-list total | **PASS** — manifest 2,070 == distinct URLs 2,070; 2,070 < 8,927; URL *sets* identical |
| 3 | ≥ 99 % `statut == "ok"`; every error listed in the report | **PASS** — 100.00 % ok, 0 errors; report states "Aucun échec" explicitly |
| 4 | 5 random `ok` lines: file exists, UTF-8, ≥ 8 KB, 3 markers | **PASS** — and extended to a **full sweep of all 2,070** pages, all gates green (`cage-de-force`, `trou-de-memoire`, `injection`, `aspect-animal`, `abri` were the sampled five, 33–41 KB each) |
| 5 | `requiem-pour-les-fantomes` cached page contains `Requiem pour les fantômes de groupe` | **PASS** — variant sub-block present in the fetched bytes, so step 07 can parse it |
| 6 | Idempotence: 0 live fetches, 100 % `from_cache`, `cache/index.jsonl` does not grow | **PASS** — re-run: 2,070/2,070 from cache, 0 live; index stayed at 2,107 lines (byte-diffed before/after). Manifest re-generated **byte-identical** |
| 7 | ≥ 1 cache file per `ok` line; every `cache_fichier` resolves | **PASS** — all 2,070 resolve; each path verified to equal `cache/html/<sha1(url)>.html`; 2,089 files on disk |
| 8 | Report records totals, elapsed time, complete failure list | **PASS** — all four sections present |
| 9 | No HTTP logic of its own | **PASS** — `grep -n "requests\.\|httpx\|urlopen" src/pf_spells/fetch_spells.py` → **no matches**; imports `from pf_spells.fetcher import fetch_many` |

Full test suite on the merged branch: **116 passed**.

## Incident during the cold crawl (resolved, no data loss)

Mid-crawl the machine suspended: one batch's wall-clock jumped from 1,499 s to
32,199 s and 18 pages failed with transient `ConnectionError` /
`Connection aborted` (17 + 1). These were **not** wiki 404s. The driver's
automatic forced-retry pass recovered all 18, and the final state is 100 % ok
with zero known gaps. This is exactly the resumability the step required, and
it was exercised for real rather than only in tests.

The reported 546 min duration includes that suspend window; actual crawl time
was ~35 min at the mandated global 1 req/s throttle. The throttle was never
raised.

## Design decisions worth knowing

- **Batched driving, not one big call.** URLs are fetched in batches of 100
  (`LOT`), and the manifest is rewritten after every batch. This is what makes
  progress visible every 100 pages *and* leaves an interrupted run with a
  usable partial manifest, satisfying both plan requirements with one
  mechanism.
- **8 KB gate, not 20 KB.** Step 03's list-page floor is deliberately not
  reused; a dedicated test (`test_eight_kb_floor_not_the_twenty_kb_list_page_floor`)
  pins a valid 9 KB spell page so nobody "fixes" this back to 20 KB later.
- **Blocking vs. known-gap exit codes.** Below 99 % ok → exit 1 (blocking).
  Above 99 % with some failures → exit 0 but printed and tabled as a KNOWN GAP.
  Both paths are tested. No replacement URLs are ever invented.
- **UTF-8 rejection is loud.** A cp1252-encoded body is reported as a decode
  failure rather than silently mangled (`test_non_utf8_body_is_rejected_not_silently_mangled`),
  per anti-pattern 1 in the conventions Skill.
- No stat-block parsing here — bytes and manifest only, so step 07 can iterate
  the parser at zero network cost.
- `src/pf_spells/__init__.py` remains empty (0 bytes); no `__all__` anywhere
  (`grep -rn "__all__" src/ tests/` → 0 hits).

## Git

| Item | Value |
|---|---|
| Branch | `step/06-fetch-spells`, cut from `feat/spell-corpus` |
| Worktree | `../wt-06` (wave-mate step 05 ran concurrently in `../wt-05`, untouched) |
| Commit 1 | `1d00198 feat(step-06): add spell page fetch driver with resumable cache` |
| Commit 2 | `09b82cc chore(step-06): cache all unique spell pages and write fetch manifest` (2,073 files) |
| Merge | `aa65d79` into `feat/spell-corpus`, `--no-ff` |

`git status` on `feat/spell-corpus` is clean after the merge.

**One snag worth recording:** the first `--no-ff` merge attempt was killed by a
2-minute command timeout while checking out 2,000+ small files on Windows,
leaving a stale `.git/index.lock` and 1,982 untracked copies (one of them
truncated to 0 bytes). Resolution: confirmed no git process was running, removed
the lock, verified 1,981 of the 1,982 files were byte-identical to their
committed blobs and that the single mismatch was the 0-byte truncation whose
real 32 KB blob was safely in the commit, then `git clean` on `cache/html` and
re-merged with a longer timeout. Nothing was lost; no other branch was touched.
Future large-cache merges on Windows should allow several minutes.

## How to re-run

```bash
# smoke test first (25 pages, ~30 s)
PYTHONPATH=src python -m pf_spells.fetch_spells --limit 25

# full run — a warm cache makes this ~5 s and zero network requests
PYTHONPATH=src python -m pf_spells.fetch_spells

# tests
PYTHONPATH=src python -m pytest tests/test_fetch_spells.py -q
```

## Handoff to step 07

`data/spell_pages.jsonl` is the contract: 2,070 lines, sorted by `id`, ids
unique, keys exactly the eight specified. Every `cache_fichier` resolves to a
UTF-8 file ≥ 8 KB containing `id="PageContentDiv"`, `class="pagetitle"` and
`Niveau`. **No error lines to skip** — step 07 gets a complete input set, and
can parse and re-parse entirely offline.
