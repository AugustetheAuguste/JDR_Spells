# 00 — CONTEXT: Pathfinder Spell Corpus (Scrape & Organize)

## Project Overview

`JDR_Spells` is a French-language Pathfinder 1e (PF1) tabletop RPG data project.
The source of truth is the community wiki **pathfinder-fr.org**, which publishes:

1. **Class spell-list pages** — one page per casting class, listing every spell
   available to that class, grouped by spell level (and on some pages, by
   magic school). Each entry links to the spell's own wiki page.
2. **Spell pages** — one page per spell, holding the full stat block
   (école, niveau, temps d'incantation, composantes, portée, cible, durée,
   jet de sauvegarde, résistance à la magie) plus the prose description, and
   sometimes extra sub-blocks (a `Mythique` section, and a
   "Sorts qui « fonctionnent comme » X" section listing variant spells).

This plan covers **Phase 1 only: scrape and organize**. It produces the clean,
inspectable, correctable data foundation that every later phase of the project
will build on. No game logic, no UI, no search — just a trustworthy corpus.

## Objectives

1. For every class in `elements_to_do.json`, fetch its spell-list page and emit
   **one JSONL file per class** — one line per spell entry, with spell name,
   spell level for that class, magic school (when the page groups by school),
   short blurb, source-book tags, and the absolute URL of the spell page.
2. Build a **unique-spell index** plus an explicit **duplicate/uniqueness map**:
   which spells are shared across classes, which are exclusive to exactly one
   class, and at what level each class gets each spell.
3. Fetch every unique spell page and emit **one JSON file per spell**, holding
   the fully parsed stat block, the prose description as both cleaned plain
   text and raw HTML, and any nested sub-blocks — designed for a human to open,
   read, audit, and hand-correct.
4. Cache every fetched HTML page on disk so parser fixes never require
   re-scraping the wiki.
5. Ship a validation report that makes gaps and anomalies visible rather than
   silently dropping them.

## Current State Analysis

### What exists

```
JDR_Spells/
├── elements_to_do.json          # 20 entries, class name + list-page URL
└── pages/
    ├── classe/                  # 2 saved sample list pages
    │   ├── arcaniste_ensorceleur_magicien.html
    │   └── druide.html
    └── sorts/                   # 4 saved sample spell pages
        ├── exemple_1.html       # Armes contre le mal  — plain spell
        ├── exemple_2.html       # Cœur incassable      — plain spell
        ├── exemple_3.html       # Requiem pour les fantômes — has "fonctionnent comme" variant
        └── exemple_4.html       # Bouclier de la Fleur de l'Aube — has Mythique section
```

There is **no code, no CLAUDE.md, no tests, no `.claude/` directory, and no git
repository**. This plan starts from zero tooling.

### Verified environment facts

- Python **3.11.0** on win32 / Git Bash. Available: `bs4`, `lxml`, `requests`,
  `httpx`, `jsonschema`. **Not** available: `unidecode` (do not depend on it —
  use `unicodedata.normalize('NFKD', …)` from the stdlib for slugs).
- Node v24 is present but **Python is the chosen implementation language** for
  all tooling in this plan.
- Live network access to `pathfinder-fr.org` **works** — a plain
  `curl`/`requests` GET on a list page returns HTTP 200 with full HTML.

### Verified HTML structure facts (do not re-derive these)

- Pages are served as **UTF-8**. Confirmed: `Résistance` appears in the raw
  bytes as `\xc3\xa9`. The saved sample files in `pages/` are the same UTF-8
  bytes. **Always read/decode as UTF-8.** There is no `<meta charset>` in the
  saved fragments, so decoding must be explicit; do not let a library sniff it
  as cp1252.
- The meaningful content of **every** page (list page and spell page alike) is
  bounded by `<div id="PageContentDiv">` … `<div id="PageAttachmentsDiv"`.
  Everything before is site navigation and boilerplate; everything after is
  scripts and footer. **Every parser must slice to this region first** —
  otherwise the site's own nav links pollute the results.
- **List pages**: spell level sections are `<h2 class="separator">` with text
  `Sorts de niveau N` (or `Formules de niveau N` on the Alchimiste page).
  Some pages additionally group by school with `<h3>` (`Abjuration`,
  `Divination`, …) nested under each `h2` — confirmed on
  `Sorts doccultiste` and the Arcaniste/Ensorceleur/Magicien page; absent on
  Druide, Paladin, Alchimiste. Entries are `<li>` containing
  `<b><i><a class="pagelink" href="Pathfinder-RPG.<name>.ashx">Name</a></i></b>`,
  optionally followed by an italic source tag like `<i>(RSE)</i>` or
  `<i>(MJRA)</i>`, then a period and a short blurb.
  Every list page also contains a first `h2` titled
  `Accès rapide aux sections sur la magie` — **that is a nav block, not a spell
  level section; skip it.** Levels observed: 0–9 (Arcaniste), 1–4 (Paladin),
  1–6 (Alchimiste/Occultiste), 0–9 (Druide).
- **Spell pages**: title is `<h1 class="pagetitle">`. The stat block is a flat
  run of `<b>Label</b> value` pairs separated by `<br>`, all as direct siblings
  inside `PageContentDiv` — *not* a table, *not* a definition list. Labels
  observed: `École`, `Niveau`, `Temps d'incantation`, `Composantes`, `Portée`,
  `Cible`, `Durée`, `Jet de sauvegarde`, `Résistance à la magie`.
  **The apostrophe in labels varies** between U+0027 `'` and U+2019 `’`
  (`Temps d'incantation` vs `Temps d’incantation` — both confirmed in samples).
  Label matching must normalize apostrophes and be accent-safe.
  The `Niveau` value is a comma-separated list of class-abbreviation + level
  pairs, e.g. `Bard 2, Cham 2, Inq 2, Occ 2, Pal 1, Prê 2`.
  `École` may carry bracketed descriptors: `Évocation [Bien, feu, lumière]`.
  After the last stat line, the remaining content is the description prose.
- **Spell-page sub-blocks** (both confirmed in samples):
  - A `<h2>Mythique</h2>` section (exemple_4).
  - A "Sorts qui « fonctionnent comme » *X*" section introducing variant
    spells, each with its own `<h3>`-titled full stat block (exemple_3, which
    contains a second complete stat block for
    *Requiem pour les fantômes de groupe*).
  **Decision (user-confirmed): both are stored NESTED inside the parent
  spell's JSON. They do NOT get their own top-level spell files.** Rationale
  given by the user: variants exist elsewhere in the corpus anyway, and the
  mythic material is unwanted and will be stripped in a later phase — so it
  must be cleanly isolated in its own field, easy to delete.

### Known data-quality issue in the input

`elements_to_do.json` still contains a **duplicate**: `Alchimiste` appears
twice (lines 5 and 13) with URLs differing only in capitalization
(`liste%20des%20formules…` vs `Liste%20des%20formules…`). The wiki is
case-insensitive on page titles, so these are the same page.
**Resolution baked into this plan:** classes are deduplicated by a normalized
URL key (lowercased, percent-decoded), keeping the first occurrence's class
label. 20 raw entries → **19 unique class pages**. The dedup is logged, never
silent. The other class labels that name several classes at once
(`Arcaniste/Ensorceleur/Magicien`, `Prêtre/Prêtre combattant/Oracle`) are
treated as **a single source page with a multi-class label**; they are not
split, and the per-spell `Niveau` field preserves the individual class
abbreviations anyway.

### Scale estimate

The Arcaniste/Ensorceleur/Magicien page alone holds ~1,225 entries; Occultiste
~511; Paladin ~199. Across 19 classes expect **~4,000–5,000 total entries**
resolving to roughly **~2,500–3,500 unique spell pages** to fetch. At a polite
throttle this is a multi-thousand-request crawl — caching and resumability are
not optional niceties, they are core requirements.

## Feature / Issue List Being Addressed

| # | Item |
|---|------|
| F1 | Deduplicate and normalize the class list from `elements_to_do.json` |
| F2 | Polite, cached, resumable HTTP fetching of all wiki pages |
| F3 | Per-class spell-list JSONL (name, level, school, blurb, tags, URL) |
| F4 | Unique-spell index + cross-class duplicate/uniqueness map |
| F5 | Per-spell JSON with full parsed stat block + description (text + raw HTML) |
| F6 | Nested capture of `Mythique` and "fonctionnent comme" variant sub-blocks |
| F7 | Enrichment: each spell JSON carries the list of classes/levels granting it |
| F8 | Validation report surfacing missing fields, orphans, and fetch failures |
| F9 | Corpus manifest + README so a human can navigate and correct the data |
| I1 | UTF-8 decoding must be explicit (no charset meta on pages) |
| I2 | Apostrophe variants (U+0027 / U+2019) in stat-block labels |
| I3 | `Accès rapide…` nav `h2` must not be mistaken for a level section |
| I4 | `Formules de niveau N` wording on the Alchimiste page |
| I5 | Optional `h3` school grouping present on some list pages only |

## Skills & Tools Inventory

Everything below is **built in Wave 1** (steps 01 and 02), before any
functional step runs. No functional step may reinvent these.

### Skills (built in step 01)

| Skill | Status | Purpose | Consumed by |
|---|---|---|---|
| `pf-corpus-conventions` | **TO BUILD** | Project-wide conventions: UTF-8 rules, spell-`id` slug algorithm, French JSON key vocabulary, directory layout, JSONL/JSON formatting rules, class-code table | 03, 04, 05, 06, 07, 08, 09, 10 |

### Tools (built in step 02)

All live under `src/pf_spells/`. Plain Python modules, importable and each
runnable as a CLI via `python -m`.

| Tool / module | Status | Purpose | Consumed by |
|---|---|---|---|
| `src/pf_spells/fetcher.py` | **TO BUILD** | Cached, throttled, retrying HTTP GET → writes `cache/html/<sha1>.html` + `cache/index.jsonl`; re-runs are no-ops | 03, 06 |
| `src/pf_spells/htmlutil.py` | **TO BUILD** | UTF-8 load, slice to `PageContentDiv`, HTML→clean text, label normalization (apostrophes/accents), URL absolutization | 04, 07 |
| `src/pf_spells/slugs.py` | **TO BUILD** | Deterministic `id` slug from a spell name (NFKD, stdlib only) | 04, 05, 07, 08 |
| `src/pf_spells/classes.py` | **TO BUILD** | Load + dedupe `elements_to_do.json`; class label ↔ slug ↔ wiki abbreviation table | 03, 04, 05, 08 |
| `schemas/sort.schema.json` | **TO BUILD** | JSON Schema for a per-spell JSON file | 07, 08, 09 |
| `schemas/liste_classe.schema.json` | **TO BUILD** | JSON Schema for one JSONL line of a class list | 04, 09 |
| `tests/` (pytest, fixture-driven) | **TO BUILD** | Unit tests pinned to the 6 sample files in `pages/` | 02, and regression-checked by 09 |

### Pre-existing tooling relied upon

`python3.11`, `bs4`, `lxml`, `requests`, `jsonschema` — all verified present.
`pytest` may need `pip install pytest`; step 02 handles that.
**Do not depend on `unidecode`.**

## Target Directory Layout

```
JDR_Spells/
├── elements_to_do.json               # input, never modified
├── CLAUDE.md                         # written in step 10
├── schemas/                          # step 02
├── src/pf_spells/                    # step 02
├── tests/                            # step 02
├── .claude/skills/pf-corpus-conventions/SKILL.md   # step 01
├── cache/
│   ├── index.jsonl                   # url → cache file, status, fetched_at
│   └── html/<sha1>.html              # steps 03, 06
├── data/
│   ├── listes_classes/<class-slug>.jsonl          # step 04
│   ├── index/
│   │   ├── sorts_uniques.jsonl                    # step 05
│   │   ├── carte_doublons.json                    # step 05
│   │   └── sorts_exclusifs.json                   # step 05
│   └── sorts/<spell-id>.json                      # steps 07 (write), 08 (enrich)
├── reports/                          # steps 03,04,05,06,07,08,09
└── build/pf_spell_corpus/            # this plan
```

## Execution Plan (Waves)

Wave 0 is a one-time operator bootstrap; Waves 1–7 are subagent-executed.

| Wave | Steps (parallel within the wave) | Depends on |
|---|---|---|
| **0** | Operator: `git init`, initial commit of `elements_to_do.json` + `pages/` + `build/`, create branch `feat/spell-corpus` | — |
| **1** | `01_SKILLS.md` · `02_TOOLS.md` | Wave 0 |
| **2** | `03_FETCH_CLASS_PAGES.md` | 01, 02 |
| **3** | `04_PARSE_CLASS_LISTS.md` | 03 (+01, 02) |
| **4** | `05_UNIQUE_SPELL_INDEX.md` · `06_FETCH_SPELL_PAGES.md` | 04 |
| **5** | `07_PARSE_SPELL_PAGES.md` | 06 (+02) |
| **6** | `08_ENRICH_SPELLS.md` | 05 **and** 07 |
| **7** | `09_VALIDATE_CORPUS.md` · `10_MANIFEST_AND_DOCS.md` | 08 |

**10 steps, 7 waves.** Notes on why the chain is this shape and no shallower:

- 01 and 02 are genuinely independent (different files: `.claude/skills/…` vs
  `src/`, `schemas/`, `tests/`) → same wave.
- 05 (index) and 06 (fetch spell pages) both need only step 04's JSONL output
  and are mutually independent — 06 needs the URL set, 05 needs the
  name/level/class tuples. Deliberately **not** chained.
- 07 depends on 06 only (the cached HTML), not on 05.
- 08 is the single true join point: it needs 05's class/level map and 07's
  spell files.
- 09 and 10 both read the finished corpus from 08 and touch disjoint outputs
  (`reports/` vs `CLAUDE.md` + `data/MANIFEST.json`) → same wave.

No step depends on "everything so far". Steps 03 and 06 are the wall-clock
bottleneck (network-bound); both are internally parallel and resumable.

## Git & Branching Strategy

- **Base branch:** `main` (created in Wave 0 by `git init`).
- **Integration branch:** `feat/spell-corpus`, branched from `main` in Wave 0.
  Every step's work lands here.
- **Per-step branches:** each step works on `step/NN-<short-slug>` cut from
  `feat/spell-corpus`.
  - Steps sharing a wave run in **separate git worktrees**
    (`git worktree add ../wt-NN step/NN-<slug>`) so parallel agents never
    collide on the index. This applies to waves 1, 4, and 7.
  - Single-step waves (2, 3, 5, 6) may commit directly on
    `feat/spell-corpus` — no worktree needed.
- **Merge order back to `feat/spell-corpus`:** strictly by step number
  (01, 02, 03, …, 10), `--no-ff`, so history shows one merge commit per step.
  Within a wave the merges are conflict-free by construction because outputs
  are disjoint; step 08 is the one step that *modifies* files created by 07,
  and it runs in a later wave, so no concurrent write ever occurs.
- **Commit granularity:** one commit per logical unit inside a step
  (e.g. "module + its tests"), squash-free. Large generated data directories
  are committed **once** at the end of their producing step.
- **Message convention:** Conventional Commits with a step scope —
  `feat(step-04): parse class spell lists into per-class JSONL`.
  Types in use: `feat`, `test`, `docs`, `chore`, `fix`.
- **`.gitignore`** (created in step 02): `__pycache__/`, `.pytest_cache/`,
  `*.pyc`, `.venv/`. **`cache/html/` IS committed** — it is the reproducibility
  guarantee that lets parsers be fixed without re-crawling. If its size proves
  impractical, that is a follow-up decision, not a step-level improvisation.
- **Final merge:** `feat/spell-corpus` → `main` with `--no-ff` once step 09's
  validation report shows zero blocking errors.

## CLAUDE.md Impact

No `CLAUDE.md` exists today. **Step 10 creates it**, and it must document:

1. Project purpose and the two-tier wiki data model (list pages → spell pages).
2. Directory layout and what each `data/` artifact is authoritative for.
3. **Hard rules:** all wiki HTML is UTF-8 and must be decoded explicitly; all
   parsing starts by slicing to `PageContentDiv`; JSON keys are French; French
   text content is never transliterated or accent-stripped (only `id` slugs
   are).
4. The spell `id` slug algorithm, stated once, as the join key across all
   artifacts.
5. Pointer to the `pf-corpus-conventions` Skill as the authority, with
   CLAUDE.md deferring to it rather than duplicating it.
6. How to re-run the pipeline (`python -m pf_spells.…` command sequence) and
   the note that re-runs are cache-hits, not re-crawls.
7. The standing known issues: the `Alchimiste` duplicate in
   `elements_to_do.json`, and the fact that `Mythique` blocks are captured but
   slated for removal in a later phase.
8. Explicit statement that `data/sorts/*.json` is **hand-correctable** — human
   edits there are authoritative and must not be clobbered by a naive re-run
   (step 07 writes with a `--no-overwrite` default for exactly this reason).
