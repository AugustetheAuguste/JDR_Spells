# 05 — UNIQUE SPELL INDEX & CROSS-CLASS DUPLICATE MAP

## Objectives

Collapse the ~4,000–5,000 per-class list entries into the set of **unique
spells**, and make the sharing structure explicit and queryable:

1. `data/index/sorts_uniques.jsonl` — one line per unique spell: id, name, URL,
   which classes grant it and at what level, and how many classes share it.
2. `data/index/carte_doublons.json` — the duplicate map: for every spell present
   in **more than one** class, the full class→level mapping, plus aggregate
   statistics (distribution of sharing counts, most widely shared spells).
3. `data/index/sorts_exclusifs.json` — spells appearing in exactly **one** class,
   grouped by class: the "unique spells" a class alone can cast.
4. `reports/05_index.md` — human-readable summary of the same, with anomalies.

## Dependencies & Parallelization

- **Wave:** 4
- **Depends on:** `04_PARSE_CLASS_LISTS.md` only — specifically
  `data/listes_classes/*.jsonl` and `data/classes.json`.
- **Wave-mate:** `06_FETCH_SPELL_PAGES.md`. Fully parallel: 06 needs only the
  distinct `url` values from step 04's JSONL and writes to `cache/`; this step
  needs the name/level/class tuples and writes to `data/index/`. Disjoint
  outputs, neither reads the other's product.
- **Hidden dependencies:** none. **No network. No spell pages needed** — this
  step works purely from the list-level data. It deliberately does not wait for
  the ~3,000-page crawl.

## Inherited Context from Dependencies

### From step 04 — `data/listes_classes/<class-slug>.jsonl`

19 files. Each line is a compact JSON object with exactly these keys:

```
{ "id": "detection-de-la-magie",
  "nom": "Détection de la magie",
  "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.D%c3%a9tection%20de%20la%20magie.ashx",
  "classe": "Druide",
  "niveau": 0,
  "ecole": null,
  "description_courte": "Détecte sorts et objets magiques à 18 m à la ronde.",
  "sources": [],
  "ligne_html": "<b><i><a ...>...</a></i></b>. ..." }
```

**Guaranteed invariant from step 04:** the same spell `nom` carries the same `id`
in every file. `id` is therefore a safe join key. `niveau` is an int 0–9 and is
the level *for that class*.

### From step 03 — `data/classes.json`

Array of 19 objects with keys `classe`, `slug`, `url`, `cache_fichier`,
`taille_octets`, `statut`, `note`. Use it for the canonical class label↔slug
mapping and to confirm all 19 classes are represented.

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Authority on French key
vocabulary and JSON/JSONL formatting (JSONL compact one-per-line; JSON
`indent=2`; UTF-8, `ensure_ascii=false`; accents preserved in values,
unaccented snake_case keys).

### Note on multi-class class labels

Two roster labels name several classes at once:
`Arcaniste/Ensorceleur/Magicien` and `Prêtre/Prêtre combattant/Oracle`. Per the
decision recorded in `00_CONTEXT.md`, these are treated as **one source list
each** and are **not** split. Their label appears as a single entry in
`classes` arrays. Do not invent per-sub-class splits here; the individual class
abbreviations survive on the spell pages themselves and are handled in step 08.

## Output contracts

`data/index/sorts_uniques.jsonl` — one line per unique spell:

```
{ "id": "detection-de-la-magie",
  "nom": "Détection de la magie",
  "url": "https://...",
  "classes": [ {"classe": "Druide", "slug": "druide", "niveau": 0},
               {"classe": "Arcaniste/Ensorceleur/Magicien", "slug": "arcaniste-ensorceleur-magicien", "niveau": 0} ],
  "nb_classes": 2,
  "niveau_min": 0,
  "niveau_max": 0,
  "partage": true,
  "ecoles": ["Divination"],
  "sources": [] }
```

- `classes` sorted by class label; `ecoles` = distinct non-null `ecole` values
  seen across list entries (a page-level school hint; the spell page is
  authoritative later); `sources` = union of `sources` arrays.
- `partage` = `nb_classes > 1`.

`data/index/carte_doublons.json`:

```
{ "genere_le": "<ISO date>",
  "nb_sorts_uniques": N,
  "nb_sorts_partages": M,
  "distribution_partage": { "1": 1234, "2": 456, "3": 210, ... },
  "top_partages": [ {"id":..., "nom":..., "nb_classes": 12}, ... top 25 ],
  "sorts_partages": { "<id>": { "nom":..., "classes": {"Druide": 0, "Barde": 1} } },
  "niveaux_divergents": [ {"id":..., "nom":..., "classes": {...}} ] }
```

- `niveaux_divergents` = shared spells whose level differs across classes (very
  common and expected, e.g. *Requiem pour les fantômes* is Pal 1 but Bard 2).
  It is a useful review list, not an error list.

`data/index/sorts_exclusifs.json`:

```
{ "genere_le": "<ISO date>",
  "par_classe": { "Druide": { "slug": "druide", "nb": 42,
                              "sorts": [ {"id":..., "nom":..., "niveau": 3} ] } },
  "totaux": { "Druide": 42, ... } }
```

## Pseudo-code

```
classes = load data/classes.json
entries = [line for f in data/listes_classes/*.jsonl for line in f]

# integrity gate before aggregating
group entries by nom -> assert each group has exactly 1 distinct id  (BLOCKING)
group entries by id  -> assert each group has exactly 1 distinct nom (BLOCKING)
report any id whose entries disagree on url  (WARN, list them)

uniques = {}
for e in entries:
    u = uniques.setdefault(e.id, {id, nom, url, classes: [], ecoles: set(), sources: set()})
    if e.classe already in u.classes with a DIFFERENT niveau:
        record in doublons_intra_classe   # same class lists spell twice at 2 levels
        keep the LOWEST niveau, note it
    else append {classe, slug, niveau}
    u.ecoles |= {e.ecole} if e.ecole; u.sources |= set(e.sources)

for u in uniques: compute nb_classes, niveau_min, niveau_max, partage
write data/index/sorts_uniques.jsonl  sorted by id

partages  = {id: u for u in uniques if u.nb_classes > 1}
exclusifs = {id: u for u in uniques if u.nb_classes == 1}
build carte_doublons.json  (distribution, top 25, per-spell class->level map,
                            niveaux_divergents)
build sorts_exclusifs.json (grouped by the single class)
write reports/05_index.md:
    totals; per-class total vs exclusive counts table;
    sharing distribution histogram; top 25 most-shared;
    anomalies: intra-class duplicates, url disagreements
sanity: sum(nb_classes over uniques) == len(entries) - (intra-class dupes removed)
```

## Logic Flow

1. Load the Skill. Read `data/classes.json` and all 19 JSONL files.
2. Run the two blocking integrity gates (name↔id bijection). If either fails,
   step 04 has a bug — stop and report; do not paper over it here.
3. Aggregate into the unique-spell map, handling the intra-class-duplicate edge
   case by keeping the lowest level and recording the anomaly.
4. Compute derived fields and split into shared vs exclusive.
5. Write the three artifacts and the report.
6. Verify the arithmetic identity in the sanity check.
7. Commit.

## Implementation Notes

- Implement as `src/pf_spells/build_index.py`, run via
  `PYTHONPATH=src python -m pf_spells.build_index`.
- Determinism matters: sort `classes` arrays by label, sort JSONL lines by `id`,
  sort dict keys on output. Re-running must produce byte-identical files apart
  from `genere_le`. This makes future diffs meaningful.
- `genere_le` uses `datetime.now(timezone.utc).isoformat()` — it is the only
  non-deterministic field, and it belongs only in the two JSON files, never in
  the JSONL.
- Do **not** guess at whether a spell "should" be shared. The class lists are the
  evidence; report what they say.
- The `ecoles` field here is a *hint* derived from list-page grouping and may be
  empty for classes whose pages don't group by school. The spell page's `École`
  is authoritative and lands in step 07. Say so in the report so nobody treats
  an empty `ecoles` as missing data.
- No network, no HTML parsing in this step — it consumes JSONL only.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `data/index/sorts_uniques.jsonl` exists; every line parses as JSON and has all
   eleven contract keys. Line count equals the number of distinct `id` values
   across the 19 input files — verify by independent count.
2. `nb_sorts_uniques` is plausible: expect roughly **2,500–3,500**, and strictly
   less than the total entry count (~4,000–5,000). Report both numbers and the
   ratio.
3. **Partition check:** `nb_sorts_partages` + (count of spells with
   `nb_classes == 1`) == `nb_sorts_uniques`, exactly. Every unique spell appears
   in exactly one of `carte_doublons.json`'s `sorts_partages` or
   `sorts_exclusifs.json`.
4. **Round-trip check:** for three hand-picked spells, the class→level mapping in
   `sorts_uniques.jsonl` matches the source JSONL lines exactly. Use
   `detection-de-la-magie` (expect it shared by many classes, level 0 in several)
   and two spells found only in a single class.
5. Every `classe` value appearing anywhere in the index is one of the 19 labels
   in `data/classes.json` — no typos, no invented classes.
6. `niveaux_divergents` is non-empty (level divergence across classes is known to
   occur) and each listed spell genuinely shows two different levels in the
   source files. Spot-check one.
7. `sorts_exclusifs.json` covers all 19 classes as keys (a class with zero
   exclusive spells still appears, with `nb: 0`) and its `totaux` sum equals the
   count of `nb_classes == 1` spells.
8. Determinism: run the step twice; the two `sorts_uniques.jsonl` files are
   byte-identical, and the JSON files differ only in `genere_le`.
9. `reports/05_index.md` contains the per-class total/exclusive table and the
   sharing histogram, and states that `ecoles` is a list-page hint superseded by
   step 07.
10. Confirms inherited context: the step reports having loaded the
    `pf-corpus-conventions` Skill, and `grep -n "requests\|BeautifulSoup"
    src/pf_spells/build_index.py` returns nothing.

## Git Handling

- **Branch:** `step/05-index`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 06 runs concurrently and writes to `cache/`.
  `git worktree add ../wt-05 -b step/05-index feat/spell-corpus`
- **Commits:**
  1. `feat(step-05): add unique spell index and duplicate map builder`
  2. `feat(step-05): generate unique spell index, duplicate map and exclusives`
- Merge to `feat/spell-corpus` with `--no-ff`, after step 06's merge (step order:
  05 then 06 by number, but the merges are conflict-free either way since
  outputs are disjoint).

## Expected Outcome

A definitive answer to "which spells exist, which are shared, which are a class's
own" — the second deliverable the user asked for. Step 08 consumes
`sorts_uniques.jsonl` to stamp the class/level list onto each individual spell
file.
