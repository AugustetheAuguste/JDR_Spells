# 07 — PARSE SPELL PAGES → ONE JSON PER SPELL

## Objectives

Parse every cached spell page into **one pretty-printed JSON file per spell** at
`data/sorts/<id>.json`, holding the fully structured stat block, the description
as both clean text and raw HTML, and any nested sub-blocks (`Mythique`,
"fonctionnent comme" variants). Then emit
`reports/07_parse_spells.md` covering field-coverage rates, unknown labels, and
every page that failed to parse.

These files are the deliverable the user will actually read, audit, and correct
by hand. Legibility and fidelity outrank cleverness.

## Dependencies & Parallelization

- **Wave:** 5
- **Depends on:** `06_FETCH_SPELL_PAGES.md` — needs `data/spell_pages.jsonl` and
  the cached HTML. Also uses `02_TOOLS.md` (`pf_spells.htmlutil`,
  `pf_spells.slugs`, `schemas/sort.schema.json`) and `01_SKILLS.md`'s Skill.
- **Wave-mates:** none. Step 08 must wait for these files to exist.
- **Hidden dependencies:** none. **No network.** Does *not* depend on step 05 —
  class/level enrichment is step 08's job, and the `classes` field is written as
  `[]` here.

## Inherited Context from Dependencies

### From step 06 — `data/spell_pages.jsonl`

One compact JSON object per line, keys exactly: `id`, `nom`, `url`,
`cache_fichier`, `taille_octets`, `statut`, `from_cache`, `note`.
Process only lines with `statut == "ok"`; skip and report the rest.

### From step 01 — Skill `pf-corpus-conventions`

Load with `Skill(skill="pf-corpus-conventions")`. Authority on the slug
algorithm, the French key vocabulary, the label-normalization map, output
formatting, and the human-correction contract. Restated essentials:
- JSON output: `indent=2`, UTF-8, `ensure_ascii=false`, keys in canonical order,
  trailing newline. Accents preserved in all values.
- **Every key is always present.** Missing scalar → `null`; missing list → `[]`.
- **Human edits to `data/sorts/*.json` are authoritative.** The generator must
  default to *not* overwriting an existing file; `--overwrite` is opt-in.

### From step 02 — modules (`PYTHONPATH=src`)

```
from pf_spells.htmlutil import load_html, page_content, clean_text, inner_html, normalize_label
from pf_spells.slugs import slugify
from pf_spells.fetcher import PARSER_VERSION      # "1.0.0"
```
`normalize_label(s)` folds accents, maps U+2019 `’` → U+0027 `'`, replaces
`\xa0`, collapses whitespace, lowercases, strips a trailing `:`.

### Verified spell-page structure — parse against exactly this

Inside the `PageContentDiv` subtree:

- Title: `<h1 class="pagetitle">` — but note it sits **outside**
  `PageContentDiv`, in the preceding `PageHeaderDiv`. Extract it from the full
  document, not the sliced region. Fall back to the `nom` from the manifest.
- The stat block is a **flat run of `<b>Label</b> value` pairs separated by
  `<br>`** — direct siblings, not a table and not a `<dl>`. Verbatim sample:
  ```html
  <b>École</b> <a class="pagelink" href="...">Transmutation</a> ;
  <b>Niveau</b> <a ...>Inq</a> 1, <a ...>Pal</a> 1, <a ...>Prê</a> 1<br>
  <b>Temps d'incantation</b> 1 <a ...>action simple</a><br>
  <b>Composantes</b> <a ...>V, FD</a><br>
  <b>Portée</b> courte (7,50 m + 1,50 m/2 <a ...>niveaux</a>) (5 c + 1 c/2 niveaux)<br>
  <b>Cible</b> une arme/niveau, éloignées les unes des autres au maximum de 6 m<br>
  <b>Durée</b> 1 <a ...>round</a>/<a ...>niveau</a><br>
  <b>Jet de sauvegarde</b> Vigueur, annule (inoffensif, objet) ;
  <b>Résistance à la magie</b> oui (inoffensif, objet)<br><br>
  Les armes affectées par ce sort brillent…
  ```
  Note: **two labels can share one line**, separated by ` ; ` (École+Niveau,
  and Jet de sauvegarde+Résistance à la magie). So do not assume one label per
  `<br>`-delimited line.
- Label apostrophes vary: `Temps d'incantation` (U+0027) **and**
  `Temps d’incantation` (U+2019) both occur. Always match via
  `normalize_label`.
- `École` may carry bracketed descriptors:
  `<b>École</b> Évocation [Bien, feu, lumière] ; <b>Niveau</b> …`
  → `ecole: "Évocation"`, `descripteurs: ["Bien","feu","lumière"]`.
- `Niveau` value is a comma-separated list of `<abbrev> <int>` pairs:
  `Bard 2, Cham 2, Inq 2, Occ 2, Pal 1, Prê 2`
  → `niveaux: {"Bard":2,"Cham":2,"Inq":2,"Occ":2,"Pal":1,"Prê":2}`.
  Abbrevs seen: `Bard`, `Cham`, `Inq`, `Occ`, `Pal`, `Prê`, `Magus`, `Réd`,
  `Arc`, `Ens`, `Mag`, `Dru`. Preserve the abbreviation **verbatim, accents
  intact** — mapping to class labels is step 08's job.
- **Description** = everything after the last stat-block label's value, up to
  the first sub-block boundary (a `<h2>` / `<h3>` / the `voiraussi` div) or the
  end of `PageContentDiv`.
- **Source-book logos**: `<a href="/Wiki/Pathfinder-RPG.<Book> (Contenu).ashx">`
  wrapping an `<img title="Source : …">`. Extract the `title` text after
  `Source : ` into `sources`. Sample yields
  `["Inner Sea Gods/Dieux de la mer Intérieure", "Gods and Magic, …/Dieux et magie"]`.
- **Deity-restriction sidebar**: a `<div class="presentation navmenudroite">`
  containing "Option plus commune chez les fidèles de X". This is **not** part of
  the description — remove it from the description region. Capture the text into
  `autres["restriction_divinite"]` rather than discarding it.

### Sub-blocks — both nested, never separate files (user decision)

- **`Mythique`**: an `<h2>` whose normalized text is `mythique`. Everything from
  it to the next `<h2>` (or end) →
  `mythique: {description, description_html}`. Confirmed in
  `pages/sorts/exemple_4.html` (*Bouclier de la Fleur de l'Aube*).
  **The user has stated mythic content is unwanted and will be stripped later —
  so it must be fully isolated in this one field and never leak into
  `description`.** That isolation is the point of the field.
- **Variants**: a section introduced by text matching
  `Sorts qui .*fonctionnent comme` (inside a `voiraussi`-classed div). Each
  variant has its own `<h3>`-titled **complete stat block**. Parse each with the
  *same* stat-block routine and append to
  `variantes: [{nom, id, ecole, descripteurs, niveaux, temps_incantation,
  composantes, portee, cible, duree, jet_de_sauvegarde, resistance_magie,
  description, description_html}]`, `id` = `slugify(nom)`.
  Confirmed in `pages/sorts/exemple_3.html`: *Requiem pour les fantômes*
  carries the variant *Requiem pour les fantômes de groupe* with a full second
  stat block (`Bard 4, Cham 5, Inq 5, Occ 5, Pal 3, Prê 5`).
  Variants get **no** top-level file — they exist only nested here.

### Output contract — `data/sorts/<id>.json`, validated against `schemas/sort.schema.json`

```json
{ "id": "armes-contre-le-mal",
  "nom": "Armes contre le mal",
  "url": "https://...",
  "ecole": "Transmutation",
  "descripteurs": [],
  "niveaux": { "Inq": 1, "Pal": 1, "Prê": 1 },
  "temps_incantation": "1 action simple",
  "composantes": "V, FD",
  "portee": "courte (7,50 m + 1,50 m/2 niveaux) (5 c + 1 c/2 niveaux)",
  "cible": "une arme/niveau, éloignées les unes des autres au maximum de 6 m",
  "duree": "1 round/niveau",
  "jet_de_sauvegarde": "Vigueur, annule (inoffensif, objet)",
  "resistance_magie": "oui (inoffensif, objet)",
  "description": "Les armes affectées par ce sort brillent d'une lueur pâle…",
  "description_html": "<raw inner HTML>",
  "mythique": null,
  "variantes": [],
  "sources": ["Inner Sea Gods/Dieux de la mer Intérieure"],
  "autres": {},
  "classes": [],
  "meta": { "url": "...", "cache_fichier": "cache/html/<sha1>.html",
            "recupere_le": "<ISO>", "parser_version": "1.0.0" } }
```

`classes` is `[]` here — **step 08 fills it.** Do not attempt it.

## Pseudo-code

```
pages = [l for l in data/spell_pages.jsonl if l.statut == "ok"]
stats = coverage counters; unknown_labels = Counter(); failures = []

for p in pages:
    html = load_html(p.cache_fichier)
    titre = text of <h1 class="pagetitle"> in full doc, else p.nom
    root  = page_content(html)

    sources = [img.title minus "Source : " for source-logo <a><img> in root]
    restriction = text of div.presentation.navmenudroite if present
    remove from root (a COPY): source-logo anchors, the navmenudroite div, <script>

    statblock, rest = parse_statblock(root)
        # walk direct children in order; for each <b>:
        #   key = LABEL_MAP[normalize_label(text)]  (unknown -> autres + count)
        #   value = clean_text of siblings until the next <b> or <br>,
        #           trimming a trailing " ;"
        # stop at the first <br><br> or first non-empty text run with no
        # preceding unconsumed <b>: that begins the description
    ecole, descripteurs = split "Nom [a, b, c]"
    niveaux = {abbrev: int(n) for each "Abbrev N" in the Niveau value}

    mythique = extract h2 'mythique' .. next h2   -> {description, description_html} | null
    variantes = for each h3 inside the "fonctionnent comme" section:
                    {nom, id: slugify(nom), **parse_statblock(that section),
                     description, description_html}
    description      = clean_text(rest minus mythique minus variantes sections)
    description_html = inner_html(same region)

    doc = assemble in canonical key order; classes = []
    autres["restriction_divinite"] = restriction if restriction
    validate(doc, schemas/sort.schema.json)   # failure => record, do NOT write
    if data/sorts/<id>.json exists and not --overwrite: skip, count as preserved
    else write pretty JSON

write reports/07_parse_spells.md:
    total / written / preserved / failed
    per-field coverage % (ecole, niveaux, temps_incantation, ..., description)
    unknown labels with counts and 3 example spell ids each
    count of spells with mythique, count with variantes
    full list of failures with id, url, error
```

## Logic Flow

1. Load the Skill. `PYTHONPATH=src`. Read `data/spell_pages.jsonl`.
2. **Develop against the four sample files first.** Run the parser over
   `pages/sorts/exemple_{1..4}.html` and hand-verify all fields, including the
   variant in exemple_3 and the mythic block in exemple_4, before touching the
   full corpus. Add each as a pytest fixture assertion.
3. Run over the full manifest with `--limit 50` and eyeball 5 outputs.
4. Run the full corpus.
5. Schema-validate every document; a failure means no file is written for that
   spell and the failure is reported.
6. Write the report with coverage percentages.
7. Commit.

## Implementation Notes

- Implement as `src/pf_spells/parse_spells.py`, run via
  `PYTHONPATH=src python -m pf_spells.parse_spells`. Flags: `--limit N`,
  `--overwrite`, `--only <id>` (re-parse a single spell — essential for
  iterating on one troublesome page).
- **`--overwrite` defaults to off.** A human may already have corrected a file;
  clobbering that silently would violate the whole point of this deliverable.
  On the very first full run the directory is empty, so nothing is skipped.
- Coverage is the quality signal, not exceptions. `École` and `Niveau` should be
  present on ≳99% of spells; `Cible` and `Jet de sauvegarde` legitimately vary.
  Report the actual percentages and call out anything unexpectedly low.
- Unknown labels go to `autres` and get counted — **never dropped**. Real PF1
  spell pages also use labels like `Effet`, `Zone d'effet`, `Durée de
  fabrication`; the label map handles the known ones and `autres` catches the
  rest so a later pass can promote them.
- `description_html` is verbatim source HTML. Do not prettify, re-encode
  entities, or rewrite relative links. Its purpose is that a human (or a later
  parser fix) can recover anything this pass got wrong.
- `clean_text` for `description`: `<br>` → newline, `\xa0` → space, paragraph
  breaks preserved as blank lines. The text must be pleasant to read in a plain
  editor.
- No network. `grep` for `requests` must come back empty.
- Never populate an `__init__` file; never add `__all__`.

## Verification Criteria

1. `data/sorts/` contains one `.json` per `ok` line in `data/spell_pages.jsonl`
   minus reported failures. State the three counts and confirm they reconcile.
2. **Every** file validates against `schemas/sort.schema.json`, and every file
   contains all 21 top-level keys (no key omitted, `null`/`[]` used instead).
3. **≥98%** of files have non-null `ecole` and a non-empty `niveaux`. Report the
   exact percentages for all nine stat-block fields.
4. **≥99%** of files have a non-empty `description` of at least 40 characters.
5. Hand-verified fixtures — check these four exactly against the sample pages:
   - `armes-contre-le-mal`: `ecole == "Transmutation"`,
     `niveaux == {"Inq":1,"Pal":1,"Prê":1}`, `mythique is null`,
     `variantes == []`, `sources` has 2 entries.
   - `coeur-incassable`: parses despite the U+2019 apostrophe in
     `Temps d’incantation` — `temps_incantation` is non-null.
   - `requiem-pour-les-fantomes`: `niveaux == {"Bard":2,"Cham":2,"Inq":2,
     "Occ":2,"Pal":1,"Prê":2}`; `len(variantes) == 1`; that variant's `nom` is
     `Requiem pour les fantômes de groupe`, its `id` is
     `requiem-pour-les-fantomes-de-groupe`, and its `niveaux` is
     `{"Bard":4,"Cham":5,"Inq":5,"Occ":5,"Pal":3,"Prê":5}`.
   - `bouclier-de-la-fleur-de-l-aube`: `mythique` is non-null,
     `descripteurs == ["Bien","feu","lumière"]`, and the string `Mythique` does
     **not** appear in `description` (proving isolation).
6. No `data/sorts/*.json` file has a `variantes` entry that also exists as its
   own top-level file — confirming the user's nesting decision was honoured.
7. `classes` is `[]` in every file (step 08 owns it).
8. Spot-read 3 files in an editor: accents render correctly, indentation is 2
   spaces, and the description is readable prose.
9. `reports/07_parse_spells.md` lists per-field coverage, the unknown-label
   table, mythic/variant counts, and all failures.
10. Confirms inherited tooling: imports `htmlutil`, `slugs`, and validates
    against `schemas/sort.schema.json`;
    `grep -n "requests\|urlopen" src/pf_spells/parse_spells.py` is empty.

## Git Handling

- **Branch:** `feat/spell-corpus` directly — Wave 5 is this step alone.
- **Commits:**
  1. `feat(step-07): add spell page parser with nested mythic and variant blocks`
  2. `test(step-07): pin spell parser to the four sample spell pages`
  3. `feat(step-07): generate per-spell JSON corpus`
     (includes `data/sorts/*.json` + `reports/07_parse_spells.md`)

## Expected Outcome

~2,500–3,500 hand-auditable JSON files, one per spell, each schema-valid, with
mythic material quarantined in its own deletable field and variants nested where
the user asked for them. This is the third and largest deliverable of Phase 1.
