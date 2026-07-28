# 04 — PARSE CLASS LISTS → ONE JSONL PER CLASS

## Objectives

Parse each cached class spell-list page and emit **one JSONL file per class** at
`data/listes_classes/<class-slug>.jsonl`, one line per spell entry, carrying:
spell `id` slug, display name, absolute spell-page URL, the spell's level *for
that class*, the magic school (when the page groups by school), the short blurb,
and source-book tags.

Also emit `reports/04_parse_lists.md` recording per-class entry counts, per-level
breakdowns, slug collisions, and any unparseable `<li>`.

This is the step that turns 19 HTML blobs into structured data. Everything
downstream joins on the `id` slug it assigns.

## Dependencies & Parallelization

- **Wave:** 3
- **Depends on:**
  - `03_FETCH_CLASS_PAGES.md` — needs `data/classes.json` and the cached HTML.
  - `01_SKILLS.md` — the `pf-corpus-conventions` Skill.
  - `02_TOOLS.md` — `pf_spells.htmlutil`, `pf_spells.slugs`,
    `pf_spells.classes`, `schemas/liste_classe.schema.json`.
- **Wave-mates:** none. Both Wave-4 steps need this step's JSONL output.
- **Hidden dependencies:** none. **No network access is required or permitted**
  in this step — it reads only from `cache/html/`.

## Inherited Context from Dependencies

### From step 03 — `data/classes.json`

A JSON array of 19 objects, each exactly:

```
{ "classe": "Druide",
  "slug": "druide",
  "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.liste%20des%20sorts%20de%20druides.ashx",
  "cache_fichier": "cache/html/<sha1>.html",
  "taille_octets": 418726,
  "statut": "ok",
  "note": null }
```

All 19 have `statut == "ok"`; every `cache_fichier` exists and is UTF-8.

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Authority on the slug
algorithm, the French key vocabulary, and the JSONL format rules. Restated:
- JSONL = one compact JSON object per line, UTF-8, no BOM, `\n`-terminated.
- Keys are French, snake_case, unaccented. Values keep their accents.
- Slug: œ→oe, æ→ae, NFKD, drop combining marks, lowercase, non-`[a-z0-9]` runs →
  `-`, strip `-`. Collisions get `-2`, `-3`, … and must be reported.

### From step 02 — modules (`PYTHONPATH=src`)

```
from pf_spells.htmlutil import load_html, page_content, clean_text, inner_html, absolutize
    load_html(path) -> str                # UTF-8 strict
    page_content(html) -> bs4.Tag         # the PageContentDiv subtree
    clean_text(node) -> str               # \xa0->space, <br>->\n, collapsed
    inner_html(node) -> str               # raw, untouched
    absolutize(href) -> "https://www.pathfinder-fr.org/Wiki/<href>"
from pf_spells.slugs import slugify, dedupe_slug
from pf_spells.classes import load_classes
```

### Verified HTML structure of a list page — parse against exactly this

Within the `PageContentDiv` subtree:

- **Level sections** are `<h2 class="separator">` whose text matches
  `^(Sorts|Formules) de niveau (\d)` — note **`Formules`**, used on the
  Alchimiste page. Levels seen: 0–9.
- **The first `<h2>` is a nav block titled `Accès rapide aux sections sur la
  magie` — it is NOT a level section. It fails the regex above, which is the
  intended guard. Do not special-case it by position.**
- **Optional school grouping:** some pages nest `<h3>` school headings under each
  `<h2>` (`Abjuration`, `Divination`, `Enchantement`, `Évocation`, `Illusion`,
  `Invocation`, `Nécromancie`, `Transmutation`, `Universelle`). Confirmed
  present on Occultiste and Arcaniste/Ensorceleur/Magicien; confirmed **absent**
  on Druide, Paladin, Alchimiste. When absent, `ecole` is `null`.
- **Entries** are `<li>` elements shaped:
  ```html
  <li><b><i><a class="pagelink" href="Pathfinder-RPG.Assistance%20divine.ashx"
        title="Assistance divine">Assistance divine</a></i></b>.
      +1 sur un jet d'attaque, un jet de sauvegarde ou un test de compétence.</li>
  ```
  Optionally with a source tag between the name and the blurb:
  ```html
  <li><b><i><a class="pagelink" href="...">Diplomatie améliorée</a></i></b>
      <i>(RSE)</i>. +2 à un unique test de Diplomatie ou d'Intimidation.</li>
  ```
  Observed tags: `(RSE)`, `(MJRA)`. Treat any short parenthesised italic run
  immediately after the name as a source tag; there may be more than one.
- **Traversal rule:** walk the `PageContentDiv` children **in document order**,
  tracking "current level" (set by a matching `<h2>`) and "current school" (set
  by an `<h3>`, cleared when a new `<h2>` is seen). Collect `<li>` entries that
  contain an `<a class="pagelink">` as a descendant of a `<b><i>` wrapper. Do
  **not** use `find_all("li")` globally without the level/school context — the
  level is only knowable from the preceding heading.
- Only `<li>` whose link is a `class="pagelink"` count. Other `<a>` (external
  links, nav) must be excluded — this is why slicing to `PageContentDiv` first
  matters.

### Expected magnitudes (sanity gates)

Arcaniste/Ensorceleur/Magicien ~1,225 entries; Occultiste ~511; Alchimiste ~275;
Paladin ~199; Druide several hundred. A class yielding **< 50** entries is
almost certainly a parse failure — flag it as blocking.

### From step 02 — output schema `schemas/liste_classe.schema.json`

Each JSONL line, keys in this order:

```
{ "id": "assistance-divine",
  "nom": "Assistance divine",
  "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Assistance%20divine.ashx",
  "classe": "Druide",
  "niveau": 0,
  "ecole": null,
  "description_courte": "+1 sur un jet d'attaque, un jet de sauvegarde ou un test de compétence.",
  "sources": [],
  "ligne_html": "<b><i><a ...>Assistance divine</a></i></b>. +1 sur ..." }
```

Validate every line against this schema before writing.

## Pseudo-code

```
classes = json.load("data/classes.json")
global_slugs = {}          # nom -> slug, shared across ALL classes so the same
                           # spell gets the SAME id everywhere
collisions = []

for c in classes:
    soup = page_content(load_html(c.cache_fichier))
    level, school = None, None
    lines, skipped = [], []

    for node in soup.descendants in document order:
        if node is h2:
            m = match ^(Sorts|Formules) de niveau (\d) on clean_text(node)
            level = int(m.group(2)) if m else level_unchanged_if_nav_heading
            if m: school = None
            continue
        if node is h3:
            school = clean_text(node) or None
            continue
        if node is li:
            a = node.select_one("b i a.pagelink")
            if not a: skipped.append(clean_text(node)); continue
            if level is None: skipped.append(...); continue   # li before any level h2
            nom  = clean_text(a)
            slug = global_slugs.get(nom) or dedupe_slug(slugify(nom), all_slugs)
            record collision if slugify(nom) != slug
            sources = [text of parenthesised <i> siblings after the <b> wrapper]
            blurb   = clean_text(li) minus the name and source tags,
                      leading ". " stripped
            lines.append({id, nom, url: absolutize(a["href"]), classe: c.classe,
                          niveau: level, ecole: school,
                          description_courte: blurb or null,
                          sources, ligne_html: inner_html(li)})

    validate every line against schemas/liste_classe.schema.json
    assert len(lines) >= 50, else BLOCKING
    write data/listes_classes/<c.slug>.jsonl   (sorted by niveau, then nom)
    record per-class stats + skipped

write reports/04_parse_lists.md
```

## Logic Flow

1. Load the Skill. `PYTHONPATH=src`. Read `data/classes.json`.
2. Process classes **one at a time**, but keep the `global_slugs` map across all
   of them so a spell shared by six classes gets one identical `id`. This is the
   single most important invariant of the step.
3. For each class: slice to `PageContentDiv`, walk in document order maintaining
   level/school state, extract entries.
4. Schema-validate every line; a validation failure is blocking, not a warning.
5. Apply the ≥50-entries-per-class sanity gate.
6. Write the JSONL, sorted by `(niveau, nom)` for human readability.
7. Write the report: per-class counts, per-level counts, skipped `<li>` with
   their text, slug collisions, and the grand total of entries.
8. Commit.

## Implementation Notes

- Implement as `src/pf_spells/parse_lists.py`, run via
  `PYTHONPATH=src python -m pf_spells.parse_lists`.
- **Same name → same id, always.** Derive the id from the spell *name*, not the
  URL, but cross-check: if two different names resolve to the same URL, or one
  name maps to two URLs, report it. Those are real wiki inconsistencies worth
  seeing.
- A `<li>` may contain nested `<li>`; guard against double-counting by skipping
  an `li` that has an `li` ancestor within the same section.
- Blurb extraction: rather than regex-stripping the rendered text, remove the
  `<b>` wrapper and the source-tag `<i>` nodes from a **copy** of the `li` and
  then `clean_text` the remainder. Then strip a leading `.` or `;` and
  whitespace. This is robust to punctuation drift.
- Keep `ligne_html` verbatim — it is the audit trail for correcting a
  misparsed blurb without re-reading the source page.
- Preserve accents in `nom`, `ecole`, and `description_courte` exactly.
- No network. If the code imports `requests`, it is wrong.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `data/listes_classes/` contains exactly **19** `.jsonl` files, one per slug in
   `data/classes.json`.
2. Every line of every file parses as JSON and validates against
   `schemas/liste_classe.schema.json`. Zero validation failures.
3. Every file has ≥50 lines. Report the per-class counts and confirm the
   Arcaniste/Ensorceleur/Magicien file is the largest (expect ~1,200+ lines) and
   that Paladin is ~199.
4. `niveau` is an int in 0–9 on every line; the Paladin file contains only
   levels 1–4; the Alchimiste file contains only levels 1–6 (confirming the
   `Formules de niveau N` heading variant parsed correctly).
5. **Global id consistency:** across all 19 files, grouping by `nom`, every group
   has exactly one distinct `id`. Verify programmatically and state the result.
6. `Détection de la magie` appears in both the Druide and the
   Arcaniste/Ensorceleur/Magicien file with the identical `id`
   `detection-de-la-magie`.
7. School grouping: the Occultiste and Arcaniste files have non-null `ecole` on
   essentially all lines; the Druide, Paladin and Alchimiste files have `ecole`
   null throughout. Both behaviours are correct — confirm both occur.
8. No line has `nom` containing `Accès rapide`, and no `url` points outside
   `pathfinder-fr.org` — proving the nav-heading trap and the `PageContentDiv`
   slice both held.
9. At least one line carries a non-empty `sources` array (e.g. `["RSE"]` on
   `Diplomatie améliorée` in the Druide file).
10. Confirms inherited tooling: `parse_lists.py` imports `htmlutil`, `slugs` and
    the schema file; `grep -n "requests\|urllib" src/pf_spells/parse_lists.py`
    returns nothing.

## Git Handling

- **Branch:** `feat/spell-corpus` directly — Wave 3 is this step alone.
- **Commits:**
  1. `feat(step-04): add class spell-list parser`
  2. `feat(step-04): generate per-class spell list JSONL for 19 classes`
     (includes `data/listes_classes/*.jsonl` + `reports/04_parse_lists.md`)

## Expected Outcome

19 JSONL files totalling roughly 4,000–5,000 entries, every entry carrying a
globally-consistent spell `id`, its per-class level, and its spell-page URL.
This is the substrate for both Wave-4 steps: the uniqueness map (05) and the
spell-page crawl (06).
