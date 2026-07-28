# 10 — CORPUS MANIFEST, CLAUDE.md AND README

## Objectives

Make the finished corpus navigable and the pipeline reproducible by a future
contributor (human or agent) with no memory of how it was built:

1. `data/MANIFEST.json` — machine-readable inventory of every artifact: path,
   kind, record count, schema, producing step, and what it is authoritative for.
2. `CLAUDE.md` at the repo root — the standing instructions for future agent
   sessions in this repo.
3. `README.md` at the repo root — the human entry point: what the data is, how
   to read a spell file, how to re-run the pipeline, how to correct data.

No data is modified. This step reads `data/` and writes documentation.

## Dependencies & Parallelization

- **Wave:** 7
- **Depends on:** `08_ENRICH_SPELLS.md` — the corpus must be final before it can
  be inventoried. Reads artifacts produced by steps 03–08.
- **Wave-mate:** `09_VALIDATE_CORPUS.md`. Fully parallel: that step writes only
  `reports/09_*`; this step writes `data/MANIFEST.json`, `CLAUDE.md`,
  `README.md`. Disjoint. This step deliberately does **not** read step 09's
  report — it must not wait on it. It links to `reports/09_validation.md` by
  path, which is correct whether or not it exists yet.
- **Hidden dependencies:** none. No network.

## Inherited Context from Dependencies

### Artifacts to inventory (final after step 08)

| Path | Kind | Produced by | Authoritative for |
|---|---|---|---|
| `elements_to_do.json` | input | — | the class roster source (20 raw entries) |
| `data/classes.json` | json array, 19 | 03 | class label ↔ slug ↔ list-page URL |
| `data/listes_classes/<slug>.jsonl` | 19 jsonl | 04 | which spells a class gets, at what level |
| `data/spell_pages.jsonl` | jsonl | 06 | url ↔ cached HTML file, fetch status |
| `data/index/sorts_uniques.jsonl` | jsonl | 05 | the set of unique spells |
| `data/index/carte_doublons.json` | json | 05 | cross-class sharing map |
| `data/index/sorts_exclusifs.json` | json | 05 | per-class exclusive spells |
| `data/sorts/<id>.json` | ~3000 json | 07 + 08 | **the spell itself** — full stat block, description, classes |
| `cache/html/<sha1>.html` | html | 03, 06 | raw source bytes (reproducibility) |
| `cache/index.jsonl` | jsonl | 03, 06 | fetch journal |
| `schemas/*.json` | json schema | 02 | the two output contracts |
| `reports/*.md` | markdown | 03–09 | per-step outcomes and audits |

### Spell file shape (for the README's worked example)

21 keys, always all present: `id`, `nom`, `url`, `ecole`, `descripteurs`,
`niveaux`, `temps_incantation`, `composantes`, `portee`, `cible`, `duree`,
`jet_de_sauvegarde`, `resistance_magie`, `description`, `description_html`,
`mythique`, `variantes`, `sources`, `autres`, `classes`, `meta`.
- `niveaux` = wiki abbreviation → level, from the spell page.
- `classes` = `[{classe, slug, niveau, niveau_page, concordance}]`, from the
  class lists, cross-checked against `niveaux`.
- `mythique` = `null` or `{description, description_html}`.
- `variantes` = nested variant spells, each with its own stat block.
- `meta` = `{url, cache_fichier, recupere_le, parser_version}`.

### The pipeline command sequence (document this verbatim in both docs)

```
export PYTHONPATH=src
python -m pf_spells.fetch_classes      # step 03 - cached, idempotent
python -m pf_spells.parse_lists        # step 04 - offline
python -m pf_spells.build_index        # step 05 - offline
python -m pf_spells.fetch_spells       # step 06 - cached, idempotent, ~1h cold
python -m pf_spells.parse_spells       # step 07 - offline; --overwrite is opt-in
python -m pf_spells.enrich_spells      # step 08 - offline, idempotent
python -m pf_spells.validate_corpus    # step 09 - offline, exit 1 on FAIL
```

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. `CLAUDE.md` must **defer** to
this Skill as the authority on conventions rather than restating it — duplicated
rules drift apart. CLAUDE.md states the handful of non-negotiables and points to
the Skill for detail.

### Required CLAUDE.md content (from `00_CONTEXT.md`'s CLAUDE.md Impact section)

1. Project purpose and the two-tier data model (class list pages → spell pages).
2. Directory layout and what each artifact is authoritative for.
3. **Hard rules:** wiki HTML is UTF-8 and must be decoded explicitly; all parsing
   starts by slicing to `PageContentDiv`; JSON keys are French, snake_case,
   unaccented; French content values are never transliterated or
   accent-stripped; `unidecode` is not installed.
4. The spell `id` slug algorithm, stated once, as the join key across all
   artifacts.
5. A pointer to the `pf-corpus-conventions` Skill as the authority.
6. How to re-run the pipeline, and that re-runs are cache hits, not re-crawls.
7. Standing known issues: the `Alchimiste` duplicate in `elements_to_do.json`
   (deduped by normalized URL, 20 → 19); `Mythique` blocks captured but slated
   for removal in a later phase.
8. **`data/sorts/*.json` is hand-correctable; human edits are authoritative.**
   `parse_spells` will not overwrite an existing file without `--overwrite`;
   `enrich_spells` rewrites only the `classes` key.
9. Politeness rule: never raise the fetcher throttle above 1 req/s or the worker
   count above 4 — this is a volunteer-run community wiki.
10. Never populate `__init__` files and never add `__all__` declarations.

## Pseudo-code

```
# MANIFEST
manifest = { genere_le, parser_version,
             source: {site, licence_note}, artefacts: [] }
for each artifact path in the inventory table:
    count = number of lines (jsonl) | number of files (data/sorts) | 1 (json)
    manifest.artefacts.append({chemin, type, nb_enregistrements, schema|null,
                               produit_par_etape, autorite, description})
manifest.totaux = { nb_classes, nb_entrees_listes, nb_sorts_uniques,
                    nb_fichiers_sorts, nb_pages_cache,
                    nb_sorts_avec_mythique, nb_sorts_avec_variantes }
    # all counted from disk, not copied from another report
write data/MANIFEST.json (indent=2, ensure_ascii=false)

# CLAUDE.md - cover points 1..10 above, concise, imperative, tables over prose
# README.md:
#   what this is; data source + attribution
#   directory map
#   "reading a spell file": a real, complete worked example pasted from
#      data/sorts/armes-contre-le-mal.json with each key explained
#   the class list JSONL example, one real line explained
#   the three index files and what question each answers
#   how to re-run the pipeline (the command block above)
#   how to correct data by hand + the non-overwrite guarantee
#   known limitations, linking reports/09_validation.md
```

## Logic Flow

1. Load the Skill. Count every artifact **from disk**.
2. Write `data/MANIFEST.json`.
3. Write `CLAUDE.md` covering all ten required points.
4. Write `README.md`, pasting a genuine spell file as the worked example — copy
   it from the real file, do not retype it from memory.
5. Cross-check: every path named in the manifest and both docs actually exists.
6. Commit.

## Implementation Notes

- Implement the manifest generator as `src/pf_spells/build_manifest.py`, run via
  `PYTHONPATH=src python -m pf_spells.build_manifest`. `CLAUDE.md` and
  `README.md` are hand-authored markdown, not generated.
- **Counts must come from disk.** Do not copy figures out of `reports/05_index.md`
  or `reports/07_parse_spells.md`; recount. The manifest is a second,
  independent census, which is what makes it worth having.
- Include a source-attribution note: content is from pathfinder-fr.org, official
  material belongs to Black Book Editions / Paizo (this notice appears in the
  page footers). State that the corpus is for personal use. Do not draft a
  licence — just record the attribution the source itself asks for.
- Keep `CLAUDE.md` tight (target ≤120 lines). It is loaded into every future
  session's context; it should be rules and pointers, not a narrative. Anything
  that is detail belongs in the Skill or the README.
- `README.md` may be longer — it is read on demand by a human.
- Do not document a future phase's design. Phase 1's scope is scrape and
  organize; note only that mythic removal and further work come later.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `data/MANIFEST.json` exists, is valid UTF-8 JSON, and lists every path in the
   inventory table above with `nb_enregistrements`, `produit_par_etape`, and
   `autorite` populated.
2. Every `chemin` in the manifest exists on disk — verify programmatically, list
   any that don't.
3. Manifest `totaux` are independently recounted and match the corpus:
   `nb_classes == 19`, `nb_fichiers_sorts` == the actual file count in
   `data/sorts/`, `nb_sorts_uniques` == the line count of
   `data/index/sorts_uniques.jsonl`. State each number.
4. `CLAUDE.md` exists at the repo root and demonstrably covers **all ten**
   required points — walk the list and cite the section covering each.
5. `CLAUDE.md` names the `pf-corpus-conventions` Skill and defers to it rather
   than restating the full key vocabulary.
6. `CLAUDE.md` states the hand-correction guarantee and the 1 req/s politeness
   rule explicitly.
7. `README.md` contains a **real** worked spell example whose content matches
   `data/sorts/armes-contre-le-mal.json` byte-for-byte in the quoted fields —
   diff the quoted block against the file.
8. The pipeline command block appears in both `CLAUDE.md` and `README.md` and
   every module named in it exists under `src/pf_spells/`.
9. `git status --porcelain` shows changes only to `CLAUDE.md`, `README.md`,
   `data/MANIFEST.json`, and `src/pf_spells/build_manifest.py` — nothing else in
   `data/` was touched.
10. Confirms inherited context: reports having loaded the
    `pf-corpus-conventions` Skill, and that manifest counts were derived from
    disk rather than from other steps' reports.

## Git Handling

- **Branch:** `step/10-docs`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 09 runs concurrently.
  `git worktree add ../wt-10 -b step/10-docs feat/spell-corpus`
- **Commits:**
  1. `feat(step-10): add corpus manifest generator`
  2. `docs(step-10): add CLAUDE.md and README documenting the spell corpus`
- Merge to `feat/spell-corpus` with `--no-ff` after step 09's merge.

## Expected Outcome

The corpus becomes self-describing: a manifest that inventories and independently
recounts every artifact, a `CLAUDE.md` that keeps future agent sessions on the
established conventions, and a `README.md` that lets the user navigate ~3,000
spell files and correct them confidently. Phase 1 is then complete and ready to
merge to `main`.
