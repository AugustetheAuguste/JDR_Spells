# 03 — FETCH CLASS SPELL-LIST PAGES

## Objectives

Fetch the spell-list wiki page for each unique class in `elements_to_do.json`
into the on-disk HTML cache, and emit a machine-readable roster that step 04
consumes. Concretely:

1. Deduplicate the 20 input entries down to 19 unique class pages.
2. Fetch each page politely, with caching and retries.
3. Write `data/classes.json` — the authoritative class roster (label, slug,
   url, cache file).
4. Write `reports/03_fetch_classes.md` — outcomes, dedup log, any failures.

This is one of the two network-bound steps. It must be safely re-runnable: a
second run performs zero network requests.

## Dependencies & Parallelization

- **Wave:** 2
- **Depends on:**
  - `01_SKILLS.md` — the `pf-corpus-conventions` Skill (directory layout,
    class slug rules).
  - `02_TOOLS.md` — `pf_spells.fetcher` and `pf_spells.classes`.
- **Wave-mates:** none. Wave 2 is this step alone, because step 04 cannot parse
  pages that have not been fetched.
- **Hidden dependencies:** none. It needs `elements_to_do.json` (present in the
  repo, unmodified) and network access to `pathfinder-fr.org` (verified
  reachable, HTTP 200).

## Inherited Context from Dependencies

### From step 01 — Skill `pf-corpus-conventions`

Load it with the `Skill` tool: `Skill(skill="pf-corpus-conventions")`. It is the
authority on the directory layout and the class slug rules. Relevant rules,
restated so this file stands alone:
- All wiki HTML is UTF-8; decode explicitly, never sniff.
- Cache lives at `cache/html/<sha1-of-url>.html`, with an append-only journal
  at `cache/index.jsonl`.
- Reports go in `reports/`; data artifacts in `data/`.
- Class slug = the `slugify()` recipe applied to the class label, e.g.
  `Prêtre/Prêtre combattant/Oracle` → `pretre-pretre-combattant-oracle`,
  `Sorcière` → `sorciere`, `Arcaniste/Ensorceleur/Magicien` →
  `arcaniste-ensorceleur-magicien`.

### From step 02 — modules (run with `PYTHONPATH=src`)

```
from pf_spells.classes import load_classes
load_classes("elements_to_do.json") -> (entries, dropped)
    entries: list of {label, slug, url, url_key}   # 19 items
    dropped: list of duplicate records removed      # 1 item: Alchimiste
    url_key = percent-decoded, lowercased url; dedupe keeps FIRST label

from pf_spells.fetcher import fetch, fetch_many
fetch(url, *, force=False) -> FetchResult
fetch_many(urls, *, workers=4, force=False) -> list[FetchResult]
FetchResult fields: url, cache_path, status, from_cache, fetched_at, error
    cache path  = cache/html/<sha1(url)>.html
    throttle    = >= 1.0 s between LIVE requests, global across workers
    retries     = 3 attempts, backoff 2s/5s/12s, on network error or HTTP 5xx
    HTTP 4xx    = no retry; status + error recorded; no cache file written
    cache hit   = returns immediately, from_cache=True, no network
```

### Input file shape

`elements_to_do.json` is a JSON array of `{"class": <label>, "link": <url>}`.
20 entries. The known duplicate: `Alchimiste` appears twice with URLs differing
only in the capitalization of `liste`/`Liste`.

### Expected page-size sanity range

Verified live/saved sizes for the content region: Paladin ~82 KB, Alchimiste
~99 KB, Occultiste ~156 KB, Druide ~419 KB, Arcaniste/Ensorceleur/Magicien
~842 KB. A fetched body under **20 KB** is almost certainly an error page, not a
spell list — flag it.

## Pseudo-code

```
entries, dropped = load_classes("elements_to_do.json")
assert len(entries) == 19
log dropped duplicates (do not silently discard)

results = fetch_many([e.url for e in entries], workers=4)

roster = []
for entry, res in zip(entries, results):
    ok = res.status == 200 and cache file exists
    size = size of cache file if ok else 0
    sane = ok and size >= 20_000 and 'PageContentDiv' in cached html
    roster.append({
        classe: entry.label,
        slug: entry.slug,
        url: entry.url,
        cache_fichier: res.cache_path,
        taille_octets: size,
        statut: "ok" if sane else "erreur",
        note: reason when not sane
    })

write data/classes.json (indent=2, ensure_ascii=false, sorted by slug)
write reports/03_fetch_classes.md:
    table: classe | slug | statut | taille | from_cache
    section: deduplicated entries (the Alchimiste drop)
    section: failures with url + status + error, and a retry command
    totals: fetched live / served from cache / failed

if any statut == "erreur": report loudly; retry those URLs once with force=True;
    if still failing, leave them marked "erreur" and STOP -
    step 04 must not run on an incomplete roster
```

## Logic Flow

1. Load the Skill. Set `PYTHONPATH=src`.
2. `load_classes()`; assert 19 kept / 1 dropped. If the count differs, the input
   file changed since planning — report the discrepancy and continue with
   whatever unique set exists, noting it prominently.
3. Fetch all 19 URLs via `fetch_many(workers=4)`. Expect ~20–40 s on a cold
   cache, near-instant on a warm one.
4. For each result, sanity-check the cached file: exists, ≥20 KB, decodes as
   UTF-8, contains `id="PageContentDiv"`.
5. Build and write `data/classes.json`.
6. Write `reports/03_fetch_classes.md`.
7. Re-run the whole step once and confirm the report shows 19/19 from cache and
   0 live requests — this is the idempotence proof.
8. Commit.

## Implementation Notes

- Write a small driver at `src/pf_spells/fetch_classes.py`, runnable as
  `PYTHONPATH=src python -m pf_spells.fetch_classes`. Keep it thin: it
  orchestrates, it does not re-implement fetching.
- Flags: `--force` (bypass cache) and `--workers N` (default 4). Do not raise
  the default worker count; the throttle is the real limiter and this is a
  volunteer-run wiki.
- Do **not** parse spell entries here. This step's only job is bytes-on-disk
  plus the roster. Parsing is step 04, deliberately separate so a parser fix
  never triggers a re-crawl.
- `data/classes.json` is a **step-04 contract**. Its keys are exactly:
  `classe`, `slug`, `url`, `cache_fichier`, `taille_octets`, `statut`, `note`.
  Do not rename or add keys.
- Never create or populate an `__init__` file with content, and never add
  `__all__`.
- If a URL 404s, that is a real data problem (wiki page renamed). Report the URL
  and the class; do not guess a replacement URL.

## Verification Criteria

1. `data/classes.json` exists, is valid UTF-8 JSON, and contains exactly **19**
   objects, each with the seven contract keys and no others.
2. Every object has `statut == "ok"`. If any is `"erreur"`, the step is a
   failure and must be reported as blocking, not worked around.
3. Every `cache_fichier` path exists on disk, decodes as UTF-8 without error,
   is ≥20 KB, and contains the string `id="PageContentDiv"`.
4. Spot-check three known pages against the sizes given above: the
   Arcaniste/Ensorceleur/Magicien entry is the largest (~800 KB+), Paladin is
   among the smallest (~80 KB).
5. `cache/index.jsonl` has one line per live fetch, each parsing as JSON.
6. **Idempotence:** running the step a second time reports 19 served from cache
   and 0 live fetches, and leaves `cache/index.jsonl` unchanged in length.
7. `reports/03_fetch_classes.md` exists and explicitly documents the dropped
   `Alchimiste` duplicate.
8. Confirms use of inherited tooling: the driver imports `pf_spells.fetcher`
   and `pf_spells.classes` rather than containing its own HTTP or dedup logic
   (`grep -n "requests" src/pf_spells/fetch_classes.py` returns nothing).

## Git Handling

- **Branch:** `feat/spell-corpus` directly — Wave 2 has no parallel step, so no
  worktree is needed.
- **Commits:**
  1. `feat(step-03): add class list-page fetch driver`
  2. `chore(step-03): cache 19 class spell-list pages and write class roster`
     (includes `cache/html/*`, `cache/index.jsonl`, `data/classes.json`,
     `reports/03_fetch_classes.md`)
- The cached HTML is committed on purpose — it is what makes later parser fixes
  free.

## Expected Outcome

19 class spell-list pages on disk in `cache/html/`, a validated
`data/classes.json` roster, and a fetch report. Step 04 can now parse entirely
offline, and any future parser change costs zero network requests.
