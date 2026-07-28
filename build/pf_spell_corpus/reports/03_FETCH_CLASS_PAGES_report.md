# Step 03 — Fetch Class Spell-List Pages — Final Report

**Status: COMPLETE.** All 8 Verification Criteria pass. 19/19 class pages
cached, roster written, step 04 unblocked.

## What was built

| Path | Kind | Notes |
|---|---|---|
| `src/pf_spells/fetch_classes.py` | new | Thin step-03 driver, `python -m` runnable |
| `tests/test_fetch_classes.py` | new | 15 tests: offline unit tests + real-artifact contract tests |
| `src/pf_spells/fetcher.py` | modified | Newline fidelity fix (see Deviations) |
| `data/classes.json` | generated | 19-object roster, the step-04 contract |
| `reports/03_fetch_classes.md` | generated | Totals, roster table, dedup log, idempotence note |
| `cache/html/*.html` (19) | generated | Committed on purpose |
| `cache/index.jsonl` | generated | 19 lines, one per live fetch |

Run with:

```bash
PYTHONPATH=src python -m pf_spells.fetch_classes            # cache-hit no-op after first run
PYTHONPATH=src python -m pf_spells.fetch_classes --force    # bypass cache
PYTHONPATH=src python -m pytest tests -q                    # 57 passed
```

Flags are `--force` and `--workers N` (default 4, deliberately not raised).

## Verification Criteria — evidence

| # | Criterion | Result |
|---|---|---|
| 1 | `data/classes.json`: valid UTF-8, exactly 19 objects, exactly the 7 contract keys | **PASS** — key lists compared for equality *and order* against `["classe","slug","url","cache_fichier","taille_octets","statut","note"]`; no extras |
| 2 | Every `statut == "ok"` | **PASS** — 19/19 `ok`, every `note` is `null` |
| 3 | Each `cache_fichier` exists, decodes UTF-8, ≥20 KB, contains `id="PageContentDiv"` | **PASS** — all 19; also asserted `id="PageAttachmentsDiv"` present so the slice region is closed |
| 4 | Spot-check sizes: Arcaniste largest, Paladin among smallest | **PASS** — Arcaniste 373,000 B is the max; Paladin 113,582 B is in the smallest 3 (with Antipaladin 100,765 and Sanguin 121,763) |
| 5 | `cache/index.jsonl` one line per live fetch, each valid JSON | **PASS** — 19 lines, all parse, all carry an `https://` url |
| 6 | Idempotence: 2nd run = 19 from cache, 0 live, index length unchanged | **PASS** — `diff` on `cache/index.jsonl` before/after is identical; report shows `from_cache = oui` ×19 and "0 en direct"; `data/classes.json` byte-identical across runs |
| 7 | Report documents the dropped `Alchimiste` duplicate | **PASS** — dedicated "Entrées dédoublonnées" table naming the label, the kept entry, the reason, and the discarded `Liste%20des%20formules…` URL |
| 8 | Driver imports inherited tooling, `grep -n "requests"` returns nothing | **PASS** — `grep -c requests` → `0`; test also asserts no `unquote` and that both `pf_spells.fetcher` / `pf_spells.classes` imports are present |

## Findings worth your attention

### 1. Live page sizes are ~half the plan's figures — not a defect

The plan predicted an ~842 KB Arcaniste content region; the live fetch gives
373 KB. I verified this is **not** truncation: the saved `pages/classe/*.html`
samples are browser-rendered DOM dumps carrying extra injected markup, whereas
the fetcher stores the raw server response. Content is equivalent:

| Page | sample `pagelink` count | fetched `pagelink` count |
|---|---|---|
| Arcaniste/Ensorceleur/Magicien | 1574 | **1574** |
| Druide | 791 | **791** |

Structure also checks out across all 19 pages: each has ≥4 `Sorts/Formules de
niveau N` headings and **exactly one** extra `h2.separator` — the
`Accès rapide aux sections sur la magie` nav block (anti-pattern #3). Level
counts match the plan: 10 for Arcaniste/Druide/Chaman/Sorcière/Psychiste/Prêtre,
4 for Paladin, 6 for Alchimiste. Total 13,871 spell links — consistent with the
plan's ~4,000–5,000 unique-entry estimate once cross-class duplicates collapse.

The **20 KB sanity floor is therefore still correct**, just with more headroom
than the plan assumed (smallest real page: 100 KB).

### 2. Deviation: I fixed `fetcher.py` (inherited from step 02)

Two writes used text mode without `newline=`, so on win32 Python translated
`\n` → `\r\n`:

- `cache/index.jsonl` came out CRLF, violating the skill's "LF everywhere,
  including on win32" rule.
- Cached HTML bodies were newline-rewritten, so the committed cache was **not**
  byte-faithful to the server response — bad for a file whose whole purpose is
  reproducibility.

Fixed with `newline="\n"` on the journal and `newline=""` on the body. I then
**deleted and re-fetched the entire cache cold** so nothing corrupted was
committed. The pages genuinely arrive CRLF from the server, and `.gitattributes`
(`* -text`) already disables git-side conversion, so those bytes now round-trip
untouched. Per the skill ("if code and this Skill disagree, the Skill wins and
the code is fixed") I corrected the source rather than working around it. All
11 pre-existing step-02 tests still pass.

### 3. The `Alchimiste` dedup behaves exactly as planned

20 raw → 19 unique. Both label and kept-label are `Alchimiste` (the URLs differ
only in `liste`/`Liste` capitalization), logged to stdout and to the report.
Multi-class labels were **not** split, per the skill.

## Testing approach

- **Offline unit tests** — the driver runs in a `tmp_path` cwd with its own
  cache and `requests.get` monkeypatched to raise, so a live request anywhere in
  the suite is a hard failure. Covers: warm-cache success, key contract and
  order, slug sort order, sub-20 KB body → `erreur` + exit 1, missing
  `PageContentDiv` → `erreur`, report contents, idempotence, and a source-level
  check that the driver holds no HTTP/dedup logic.
- **Contract tests on real artifacts** — assert the committed
  `data/classes.json`, cache files, and `cache/index.jsonl` satisfy criteria
  1–5 and 8, plus the level-heading/nav-`h2` structure check. They `skip`
  rather than fail if the artifacts are absent, so the suite stays green on a
  fresh clone before the step is run.
- **Result:** `57 passed` (42 pre-existing + 15 new).

Failure paths are tested, not just the happy path: an unsound page gets one
forced retry, and if it still fails the driver writes the roster with
`statut: "erreur"`, prints `BLOQUANT`, and returns exit code 1 — step 04 must
not run on an incomplete roster.

## Git

Branch `feat/spell-corpus` (Wave 2 is a solo step, no worktree needed). Working
tree clean; no sibling branch touched.

- `e0925b0` `feat(step-03): add class list-page fetch driver`
- `1b0e4dc` `chore(step-03): cache 19 class spell-list pages and write class roster`

## Constraints honoured

`src/pf_spells/__init__.py` left untouched and empty; no `__all__` added
anywhere; no backwards-compatibility shims; French snake_case unaccented JSON
keys with accented values preserved verbatim; `elements_to_do.json` and
`pages/` unmodified.

## Handoff to step 04

`data/classes.json` is the roster contract — keys `classe`, `slug`, `url`,
`cache_fichier`, `taille_octets`, `statut`, `note`, sorted by `slug`. Every
`cache_fichier` is on disk and committed, so step 04 parses **fully offline**.
Two things to carry forward: slice to `PageContentDiv` first, and skip the one
`Accès rapide` nav `h2` per page (confirmed present on all 19).
