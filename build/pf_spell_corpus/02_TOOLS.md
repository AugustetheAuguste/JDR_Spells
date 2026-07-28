# 02 — TOOLS: shared Python modules, schemas, tests

## Objectives

Build the shared tooling every functional step depends on, so that no
downstream step reinvents fetching, HTML handling, slugging, or class lookup:

1. `src/pf_spells/fetcher.py` — cached, throttled, retrying HTTP GET.
2. `src/pf_spells/htmlutil.py` — UTF-8 load, `PageContentDiv` slicing,
   HTML→clean text, label normalization, URL absolutization.
3. `src/pf_spells/slugs.py` — the deterministic spell-`id` slug function.
4. `src/pf_spells/classes.py` — load + dedupe `elements_to_do.json`, class
   label/slug/abbreviation table.
5. `schemas/sort.schema.json` and `schemas/liste_classe.schema.json`.
6. `tests/` — pytest suite pinned to the six sample HTML files in `pages/`.
7. `.gitignore`.

## Dependencies & Parallelization

- **Wave:** 1
- **Depends on:** nothing (only Wave 0's `git init` + `feat/spell-corpus`).
- **Wave-mate:** `01_SKILLS.md`. Fully parallel — that step writes only under
  `.claude/skills/`; this step writes `src/`, `schemas/`, `tests/`,
  `.gitignore`. Disjoint.
- **Hidden dependencies:** none. All conventions this step must implement are
  restated in full below, so it does **not** need to read step 01's output.
  (Step 01 documents the same rules; if they ever diverge, the Skill wins and
  the code is corrected.)

## Inherited Context from Dependencies

Nothing inherited from another step. The full contract follows.

### Verified environment

- Python **3.11.0**, Git Bash on win32. Present: `bs4`, `lxml`, `requests`,
  `httpx`, `jsonschema`. **`unidecode` is NOT installed — do not import it.**
  `pytest` may be missing; `pip install pytest` if so.
- Run modules as `python -m pf_spells.<mod>` with `PYTHONPATH=src`.

### Verified source-HTML facts to implement against

- All pages are UTF-8; there is no `<meta charset>`, so decode explicitly.
- Meaningful content of every page lies between `<div id="PageContentDiv">` and
  `<div id="PageAttachmentsDiv"`.
- Spell page title: `<h1 class="pagetitle">`.
- Stat block: flat `<b>Label</b> value` pairs separated by `<br>` — not a table.
- Label apostrophes vary between U+0027 and U+2019; `\xa0` appears in values.

### Required module contracts (implement exactly these signatures)

```
# slugs.py
slugify(nom: str) -> str
    œ->oe, æ->ae; NFKD; drop combining marks; lower;
    non [a-z0-9] runs -> "-"; strip "-"
    Must satisfy:
      "Armes contre le mal"            -> "armes-contre-le-mal"
      "Cœur incassable"                -> "coeur-incassable"
      "Requiem pour les fantômes"      -> "requiem-pour-les-fantomes"
      "Bouclier de la Fleur de l'Aube" -> "bouclier-de-la-fleur-de-l-aube"
      "Détection de la magie"          -> "detection-de-la-magie"
dedupe_slug(slug, seen: set) -> str      # appends -2, -3, ... ; mutates seen

# htmlutil.py
load_html(path) -> str                   # UTF-8, errors="strict"
page_content(html: str) -> bs4.Tag       # the PageContentDiv subtree; raises if absent
clean_text(node) -> str                  # visible text; \xa0->space; collapse ws;
                                         # <br> -> newline; strip
inner_html(node) -> str                  # raw inner HTML, unmodified
normalize_label(s: str) -> str           # NFKD-fold accents, ’->', \xa0->space,
                                         # collapse ws, lower, strip trailing ':'
absolutize(href: str) -> str             # relative wiki href -> full
                                         # https://www.pathfinder-fr.org/Wiki/<href>

# fetcher.py
fetch(url: str, *, force: bool=False) -> FetchResult
    FetchResult = {url, cache_path, status, from_cache: bool, fetched_at, error}
    cache key  = sha1(url).hexdigest() -> cache/html/<sha1>.html
    if cached and not force: return immediately, no network
    throttle: >= 1.0 s between live requests (module-level clock)
    retries: 3 attempts, backoff 2s/5s/12s, on network error or HTTP 5xx
    HTTP 4xx: no retry, record status, error, no cache file written
    User-Agent: "JDR_Spells corpus builder (personal, polite crawl)"
    appends one JSON line per live fetch to cache/index.jsonl
fetch_many(urls, *, workers: int=4, force=False) -> list[FetchResult]
    thread pool; the >=1.0s throttle is GLOBAL across workers, not per-worker
    (workers overlap latency, they do not raise request rate above ~1/s)

# classes.py
load_classes(path="elements_to_do.json") -> (list[ClasseEntry], list[dict])
    ClasseEntry = {label, slug, url, url_key}
    url_key = percent-decoded, lowercased url
    dedupe on url_key, keep FIRST occurrence's label
    returns (deduped_entries, dropped_duplicates)  # never silent
CLASS_ABBREV: dict[str, str]   # wiki abbrev -> class slug
    Confirmed abbrevs: Bard, Cham, Inq, Occ, Pal, Prê, Magus, Réd
    Others provisional; lookup_abbrev() returns None on unknown (caller reports)
```

### Schema contracts

`schemas/liste_classe.schema.json` — one JSONL line:
required `id`, `nom`, `url`, `niveau` (int 0–9), `classe`; optional `ecole`,
`description_courte`, `sources` (array), `ligne_html`. `additionalProperties:
false`.

`schemas/sort.schema.json` — one spell file. All keys always present:
`id`, `nom`, `url`, `ecole`, `descripteurs`, `niveaux`, `temps_incantation`,
`composantes`, `portee`, `cible`, `duree`, `jet_de_sauvegarde`,
`resistance_magie`, `description`, `description_html`, `mythique`, `variantes`,
`sources`, `autres`, `classes`, `meta`.
- Nullable strings: `ecole`, `temps_incantation`, `composantes`, `portee`,
  `cible`, `duree`, `jet_de_sauvegarde`, `resistance_magie`.
- `niveaux`: object, string keys → integer values.
- `mythique`: `null` or `{description, description_html}`.
- `variantes`: array of objects each with `nom`, `id`, plus the same optional
  stat-block keys and `description`/`description_html`.
- `classes`: array (filled by step 08) of `{classe, slug, niveau}`.
- `meta`: `{url, cache_fichier, recupere_le, parser_version}`.
- `additionalProperties: false` at the top level.

## Pseudo-code

```
mkdir src/pf_spells, schemas, tests, cache/html, data, reports
write .gitignore  (__pycache__/, *.pyc, .pytest_cache/, .venv/)
    # NOTE: cache/html/ is NOT ignored - it is committed on purpose

slugs.py     -> slugify, dedupe_slug
htmlutil.py  -> load_html, page_content, clean_text, inner_html,
                normalize_label, absolutize
fetcher.py   -> FetchResult, _throttle, fetch, fetch_many
                CLI: python -m pf_spells.fetcher --urls-file F [--force]
classes.py   -> load_classes, CLASS_ABBREV, lookup_abbrev
                CLI: python -m pf_spells.classes --report  (prints dedup result)

schemas/liste_classe.schema.json
schemas/sort.schema.json

tests/test_slugs.py     -> the 5 pinned examples + collision behaviour
tests/test_htmlutil.py  -> against pages/sorts/exemple_1.html:
      page_content() found; title extracted; nine <b> labels present;
      normalize_label("Temps d’incantation") == "temps d'incantation";
      clean_text has no "\xa0" and no "<"
      against pages/classe/druide.html:
      page_content() found; >=100 <li> pagelink entries;
      h2 list includes "Sorts de niveau 0".."Sorts de niveau 9"
      and also includes the "Accès rapide" nav heading (documents the trap)
tests/test_classes.py   -> load_classes returns 19 entries, 1 dropped duplicate,
      and the dropped one is Alchimiste
tests/test_fetcher.py   -> cache-hit path only, NO network:
      pre-seed cache/html/<sha1(url)>.html, assert fetch() returns
      from_cache=True and never opens a socket (monkeypatch requests.get to raise)
tests/test_schemas.py   -> both schema files load and are valid JSON Schema
      (jsonschema.Draft202012Validator.check_schema)

run: PYTHONPATH=src python -m pytest tests -q   -> all green
git commit
```

## Logic Flow

1. Create directories. Add `.gitignore`. Add `cache/html/.gitkeep`,
   `data/.gitkeep`, `reports/.gitkeep` so the tree exists for later steps.
2. Implement `slugs.py` first (no dependencies); write and pass its tests.
3. Implement `htmlutil.py`; test it against the real sample files in `pages/` —
   these are the fixtures, do not invent synthetic HTML.
4. Implement `classes.py`; test the dedup outcome (20 → 19).
5. Implement `fetcher.py` last. Test only the cache-hit path and the throttle
   arithmetic; **the test suite must never hit the network.**
6. Write both JSON Schemas; validate they are well-formed schemas.
7. Run the full suite. Green is the gate.
8. Run `PYTHONPATH=src python -m pf_spells.classes --report` and confirm it
   prints 19 kept / 1 dropped.
9. Commit.

## Implementation Notes

- **Never create `__init__.py` content and never add `__all__`.** If Python
  packaging demands the file exist, create it **empty** — zero bytes, no
  imports, no declarations.
- `clean_text` must convert `<br>` to newline *before* extracting text,
  otherwise stat lines run together. Replace `\xa0` with a normal space.
- `inner_html` returns the source HTML **untouched** — no prettifying, no
  entity rewriting. Its whole purpose is fidelity for later re-parsing.
- Parse with `lxml` via bs4 (`BeautifulSoup(html, "lxml")`). Feed it a
  **`str`**, already decoded, so it cannot re-sniff the encoding.
- `fetcher.py` must be genuinely idempotent: a second run over the same URL set
  performs **zero** network requests. This is what makes steps 03 and 06
  resumable after interruption, which matters at ~3,000 pages.
- The throttle must be enforced with a lock shared across threads. Four workers
  with a global 1 req/s cap is the target: parallelism hides latency without
  increasing load on a volunteer-run wiki.
- Set `parser_version = "1.0.0"` as a module constant in one place; step 07
  stamps it into every spell's `meta`.
- Keep every module under ~150 lines. These are utilities, not frameworks.
- Do not build a CLI framework — `argparse` only.

## Verification Criteria

1. `PYTHONPATH=src python -m pytest tests -q` exits 0 with **all** tests
   passing. Paste the summary line into the step report.
2. `PYTHONPATH=src python -c "from pf_spells.slugs import slugify;
   print(slugify('Cœur incassable'))"` prints exactly `coeur-incassable`.
3. `PYTHONPATH=src python -m pf_spells.classes --report` reports 19 kept and 1
   dropped duplicate, naming `Alchimiste`.
4. `PYTHONPATH=src python -c` snippet loading `pages/sorts/exemple_3.html`
   through `load_html` + `page_content` succeeds and the resulting text
   contains `Requiem pour les fantômes de groupe` (proves variant content is
   inside the sliced region and survives decoding).
5. Both files in `schemas/` pass
   `jsonschema.Draft202012Validator.check_schema`.
6. `fetch()` on a pre-seeded cache entry returns `from_cache=True` with
   `requests.get` monkeypatched to raise — proving no network on cache hit.
7. `git ls-files` shows **no** `__init__.py` containing any content: any
   `__init__.py` present is 0 bytes. No `__all__` appears anywhere:
   `grep -rn "__all__" src/ tests/` returns nothing.
8. `.gitignore` exists and does **not** ignore `cache/html/`.

## Git Handling

- **Branch:** `step/02-tools`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 01 runs concurrently.
  `git worktree add ../wt-02 -b step/02-tools feat/spell-corpus`
- **Commits** (in this order, one logical unit each):
  1. `chore(step-02): scaffold src/schemas/tests layout and gitignore`
  2. `feat(step-02): add slugs, htmlutil and classes modules`
  3. `feat(step-02): add cached throttled wiki fetcher`
  4. `feat(step-02): add sort and liste_classe JSON schemas`
  5. `test(step-02): pin parser behaviour to sample wiki pages`
- Merge to `feat/spell-corpus` with `--no-ff` before step 03 starts.

## Expected Outcome

A tested utility layer plus two JSON Schemas. Downstream steps import these
rather than re-solving encoding, slugging, dedup, and polite fetching — which is
what keeps eight independently-executed steps consistent. The fetcher's
idempotence is what makes the two large crawls (steps 03 and 06) safe to
interrupt and resume.
