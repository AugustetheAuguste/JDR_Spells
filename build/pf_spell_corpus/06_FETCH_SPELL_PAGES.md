# 06 — FETCH ALL UNIQUE SPELL PAGES

## Objectives

Fetch every distinct spell-page URL referenced by the class lists into the
on-disk HTML cache, and emit the fetch manifest that step 07 parses from:

1. `data/spell_pages.jsonl` — one line per distinct spell URL: spell id, name,
   url, cache file path, HTTP status, byte size, sanity verdict.
2. `reports/06_fetch_spells.md` — totals, failures with URLs, and a re-run
   command for the failures.

Expect roughly **2,500–3,500** distinct URLs. This is the heaviest step by
wall-clock. It must be interruptible and resumable without ever re-fetching a
page it already has.

## Dependencies & Parallelization

- **Wave:** 4
- **Depends on:** `04_PARSE_CLASS_LISTS.md` — needs `data/listes_classes/*.jsonl`
  for the distinct `(id, nom, url)` triples.
  Also uses `02_TOOLS.md`'s `pf_spells.fetcher` and `01_SKILLS.md`'s conventions
  Skill.
- **Wave-mate:** `05_UNIQUE_SPELL_INDEX.md`. Fully parallel: that step writes
  only `data/index/*` and reads only the same JSONL; this step writes `cache/*`
  and `data/spell_pages.jsonl`. Neither reads the other's output.
- **Hidden dependencies:** none. Requires network access to
  `pathfinder-fr.org` (verified reachable, HTTP 200).

## Inherited Context from Dependencies

### From step 04 — `data/listes_classes/<class-slug>.jsonl`

19 files, one compact JSON object per line, keys exactly:
`id`, `nom`, `url`, `classe`, `niveau`, `ecole`, `description_courte`,
`sources`, `ligne_html`.

`url` is already absolute, e.g.
`https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Assistance%20divine.ashx`.
The same spell appears on multiple class lines with the identical `id` and
`url` — **you must deduplicate before fetching**, or you will make ~4,500
requests instead of ~3,000.

### From step 02 — `pf_spells.fetcher` (`PYTHONPATH=src`)

```
from pf_spells.fetcher import fetch, fetch_many, FetchResult
fetch(url, *, force=False) -> FetchResult
fetch_many(urls, *, workers=4, force=False) -> list[FetchResult]
FetchResult: url, cache_path, status, from_cache, fetched_at, error
    cache path = cache/html/<sha1(url)>.html
    throttle   = >= 1.0 s between LIVE requests, GLOBAL across worker threads
    retries    = 3 attempts, backoff 2s/5s/12s, on network error or HTTP 5xx
    HTTP 4xx   = no retry; status + error recorded; no cache file written
    cache hit  = returns immediately, from_cache=True, zero network
    journal    = appends one JSON line per LIVE fetch to cache/index.jsonl
```

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Authority on cache layout
(`cache/html/<sha1>.html`, `cache/index.jsonl`), UTF-8 rules, and JSONL format.

### Verified spell-page facts (for the sanity check)

- Spell pages are UTF-8 and contain `<div id="PageContentDiv">` and
  `<h1 class="pagetitle">`.
- The content region is small: measured sample content regions were 3.4 KB to
  6.4 KB, on total files of ~20–32 KB. So the **whole-file** size gate is:
  a fetched body under **8 KB** is suspect (likely an error or stub page).
  Do not apply the 20 KB gate used for list pages in step 03.
- A valid spell page contains at least one `<b>` label from the stat block —
  most reliably `École` (note: also written with the raw byte pair for `É`;
  match on the decoded string `cole` as a substring to stay apostrophe- and
  accent-robust, or check for `Niveau`).

### Runtime expectation

At a global 1 req/s throttle, ~3,000 cold fetches ≈ **50–60 minutes**. This is
expected and correct — do not raise the rate to go faster. Print progress every
100 pages so the operator can see it advancing. If interrupted, simply re-run:
completed pages are cache hits.

## Pseudo-code

```
# 1. collect distinct targets
targets = {}                      # url -> {id, nom, url}
for f in data/listes_classes/*.jsonl:
    for line in f:
        targets.setdefault(line.url, {id: line.id, nom: line.nom, url: line.url})
log: total lines seen, distinct urls
assert 1500 <= len(targets) <= 5000     # sanity band; outside => investigate

# 2. warm-cache skip is handled inside fetch(); just call it
results = fetch_many(sorted(targets), workers=4)
    with progress printed every 100 completions

# 3. sanity-verify each cached file
manifest = []
for url, res in results:
    t = targets[url]
    ok = res.status == 200 and cache file exists
    size = filesize if ok else 0
    body = load as UTF-8 if ok else ""
    sane = ok and size >= 8_000 \
           and 'id="PageContentDiv"' in body \
           and 'class="pagetitle"' in body \
           and ("Niveau" in body)
    manifest.append({id: t.id, nom: t.nom, url: url,
                     cache_fichier: res.cache_path,
                     taille_octets: size, statut: "ok" if sane else "erreur",
                     from_cache: res.from_cache, note: reason if not sane})

write data/spell_pages.jsonl  (sorted by id)
write reports/06_fetch_spells.md:
    totals: distinct urls / live fetched / from cache / ok / erreur
    table of ALL failures: id, nom, url, status, note
    the exact command to retry just the failures
    elapsed wall-clock

# 4. one automatic retry pass for failures
if failures: re-fetch failures with force=True, re-verify, update manifest
if failures remain: report as a KNOWN GAP with the full list.
    A small number of genuine 404s (renamed/removed wiki pages) is acceptable
    and must be listed explicitly; step 07 will skip them and step 09 will
    re-report them. Do NOT invent replacement URLs.
```

## Logic Flow

1. Load the Skill. `PYTHONPATH=src`.
2. Build the distinct URL set from the 19 JSONL files. Log both the raw line
   count and the distinct count — the gap between them is the cross-class
   sharing already visible.
3. Fetch with `fetch_many(workers=4)`. Print progress every 100.
4. Sanity-verify every cached file with the spell-page gates above.
5. Write `data/spell_pages.jsonl` and the report.
6. Auto-retry failures once with `force=True`.
7. Re-run the whole step and confirm 100% cache hits, 0 live fetches.
8. Commit.

## Implementation Notes

- Implement as `src/pf_spells/fetch_spells.py`, run via
  `PYTHONPATH=src python -m pf_spells.fetch_spells`.
- Flags: `--force`, `--workers N` (default 4), `--limit N` (fetch only the first
  N distinct urls — **use `--limit 25` for a smoke test first**, confirm the
  manifest and sanity gates behave, then run the full crawl).
- Keep `workers` at 4. The throttle, not the pool, sets the request rate; more
  workers would only queue. Politeness toward a volunteer-run wiki is a hard
  requirement of this plan.
- Write `data/spell_pages.jsonl` **incrementally** (flush every 100 records) so
  an interrupted run still leaves a usable partial manifest. On re-run, rebuild
  it from scratch — it is cheap because every fetch is a cache hit.
- Do **not** parse the stat block here. This step produces bytes and a manifest
  only; parsing is step 07. Keeping them separate is what makes parser
  iteration free.
- `data/spell_pages.jsonl` is a **step-07 contract**. Keys exactly: `id`, `nom`,
  `url`, `cache_fichier`, `taille_octets`, `statut`, `from_cache`, `note`. Do not
  rename or add keys.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `data/spell_pages.jsonl` exists; every line parses as JSON and carries exactly
   the eight contract keys.
2. Line count equals the number of distinct `url` values across
   `data/listes_classes/*.jsonl` — verify with an independent count and state
   both numbers. Expect the count in the 2,500–3,500 range and strictly less
   than the total line count of the class lists.
3. At least **99%** of lines have `statut == "ok"`. Every `"erreur"` line is
   listed in the report with its URL and HTTP status. If the ok-rate is below
   99%, treat it as blocking and investigate rather than proceeding.
4. For 5 randomly sampled `ok` lines, the `cache_fichier` exists, decodes as
   UTF-8 without error, is ≥8 KB, and contains `id="PageContentDiv"`,
   `class="pagetitle"`, and `Niveau`.
5. Spot-check by content: fetch-verify that the cached page for
   `requiem-pour-les-fantomes` contains the string
   `Requiem pour les fantômes de groupe` (confirming variant sub-blocks are
   present in the fetched HTML, which step 07 depends on).
6. **Idempotence:** re-running the step reports 0 live fetches and 100%
   `from_cache: true`, and `cache/index.jsonl` does not grow.
7. `cache/html/` contains at least one file per `ok` manifest line; every
   `cache_fichier` path in the manifest resolves.
8. `reports/06_fetch_spells.md` records totals, elapsed time, and the complete
   failure list (or states explicitly that there were none).
9. Confirms inherited tooling: `fetch_spells.py` imports `pf_spells.fetcher`
   and contains no HTTP logic of its own —
   `grep -n "requests\.\|httpx\|urlopen" src/pf_spells/fetch_spells.py` returns
   nothing.

## Git Handling

- **Branch:** `step/06-fetch-spells`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 05 runs concurrently.
  `git worktree add ../wt-06 -b step/06-fetch-spells feat/spell-corpus`
- **Commits:**
  1. `feat(step-06): add spell page fetch driver with resumable cache`
  2. `chore(step-06): cache all unique spell pages and write fetch manifest`
     (includes `cache/html/*`, `cache/index.jsonl`, `data/spell_pages.jsonl`,
     `reports/06_fetch_spells.md`)
- This commit is large (thousands of small HTML files). That is intentional: the
  cache is the reproducibility guarantee that lets the parser be corrected
  without ever re-crawling.
- Merge to `feat/spell-corpus` with `--no-ff`.

## Expected Outcome

Every unique spell page on local disk, with a verified manifest naming each
cached file and flagging the handful of genuine wiki 404s. Step 07 can then parse
~3,000 spells entirely offline, and re-parse as many times as correctness
demands at zero network cost.
