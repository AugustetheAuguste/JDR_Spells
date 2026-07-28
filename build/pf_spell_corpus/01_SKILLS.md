# 01 — SKILLS: `pf-corpus-conventions`

## Objectives

Create one project Skill, `pf-corpus-conventions`, that is the single written
authority on the conventions every later step must obey: encoding rules, the
spell `id` slug algorithm, the French JSON key vocabulary, the class
label/slug/wiki-abbreviation table, directory layout, and file-format rules.

This exists so that eight downstream steps — executed by subagents that share
no context with each other — produce artifacts that actually join together.
The `id` slug in particular is the join key across `data/listes_classes/*.jsonl`,
`data/index/*`, and `data/sorts/*.json`; if two steps compute it differently the
corpus silently fragments.

## Dependencies & Parallelization

- **Wave:** 1
- **Depends on:** nothing (only Wave 0's `git init` + `feat/spell-corpus` branch).
- **Wave-mate:** `02_TOOLS.md`. Runs fully in parallel — that step writes to
  `src/`, `schemas/`, `tests/`, `.gitignore`; this step writes only under
  `.claude/skills/pf-corpus-conventions/`. Disjoint paths, no shared files.
- **Hidden dependencies:** none. This step needs no network, no existing code,
  and reads only the sample HTML already present in `pages/` (optional, for
  sanity-checking the vocabulary below).

## Inherited Context from Dependencies

None inherited. Everything needed is stated here.

### Repository facts you can rely on

- Working directory: `C:\Users\adoyet\Desktop\JDR_Spells` (Git Bash, win32).
- Existing files: `elements_to_do.json`, `pages/classe/*.html` (2 files),
  `pages/sorts/exemple_{1..4}.html`, `build/pf_spell_corpus/*.md`.
- No `.claude/` directory exists yet — create it.
- Skill file location: `.claude/skills/pf-corpus-conventions/SKILL.md`.
- Skill frontmatter format required by the harness:
  ```
  ---
  name: pf-corpus-conventions
  description: <one line, states when to load it>
  ---
  ```

### The exact content the Skill must specify

You are authoring documentation, so the following must appear in the SKILL.md
as normative rules. These values are decided — do not redesign them.

**Encoding**
- All wiki HTML (live-fetched and the saved files in `pages/`) is UTF-8.
- Always decode explicitly as UTF-8; never let a parser sniff the charset
  (the pages carry no `<meta charset>` and get mis-sniffed as cp1252).
- All output files are written UTF-8, `ensure_ascii=false`.
- French accents in *content* are preserved verbatim, always. Accent stripping
  happens **only** inside the `id` slug algorithm.

**Spell `id` slug algorithm** (must be stated as a numbered, reproducible recipe)
1. Take the spell's display name as it appears on the wiki.
2. `unicodedata.normalize('NFKD', name)`, drop combining marks
   (`unicodedata.combining(ch)` truthy) — stdlib only, **`unidecode` is not
   installed, do not use it**.
3. Replace `œ`→`oe`, `æ`→`ae` **before** step 2 (NFKD does not decompose these).
4. Lowercase.
5. Replace any run of characters outside `[a-z0-9]` with a single `-`.
6. Strip leading/trailing `-`.
- Worked examples that must be listed in the Skill (verify each by hand):
  - `Armes contre le mal` → `armes-contre-le-mal`
  - `Cœur incassable` → `coeur-incassable`
  - `Requiem pour les fantômes` → `requiem-pour-les-fantomes`
  - `Bouclier de la Fleur de l'Aube` → `bouclier-de-la-fleur-de-l-aube`
  - `Détection de la magie` → `detection-de-la-magie`
- Collision rule: if two distinct spell names slug identically, append `-2`,
  `-3`, … in the order encountered, and the collision must be logged to a
  report. Slugs are stable once assigned.

**French JSON key vocabulary** — the canonical key names, to be used everywhere:

| Concept | Key |
|---|---|
| slug id | `id` |
| display name | `nom` |
| wiki page URL | `url` |
| magic school | `ecole` |
| school descriptors (`[Bien, feu, lumière]`) | `descripteurs` (array) |
| per-class levels | `niveaux` (object: class-code → int) |
| casting time | `temps_incantation` |
| components | `composantes` |
| range | `portee` |
| target / effect / area | `cible` |
| duration | `duree` |
| saving throw | `jet_de_sauvegarde` |
| spell resistance | `resistance_magie` |
| description, clean text | `description` |
| description, raw inner HTML | `description_html` |
| mythic sub-block | `mythique` (object or `null`) |
| variant sub-spells | `variantes` (array of objects) |
| source-book tags | `sources` (array of strings) |
| classes granting it (added in step 08) | `classes` (array of objects) |
| provenance block | `meta` |

- Keys are **French, snake_case, unaccented** (`portee`, not `portée`) —
  accent-free keys avoid encoding pitfalls in tooling; **values keep their
  accents**.
- Absent-but-expected fields are `null`. Absent list fields are `[]`.
  A field is never omitted — every spell JSON has the full key set, so a human
  scanning files sees a consistent shape.

**Stat-block label normalization** — downstream parsers match labels after
normalizing: NFKD-fold accents, map U+2019 `’` and U+02BC to U+0027 `'`,
collapse whitespace (including `\xa0`), lowercase. The label→key map:

| Normalized label | Key |
|---|---|
| `ecole` | `ecole` (+ `descripteurs`) |
| `niveau` | `niveaux` |
| `temps d'incantation` | `temps_incantation` |
| `composantes` | `composantes` |
| `portee` | `portee` |
| `cible` / `effet` / `zone d'effet` / `zone` | `cible` |
| `duree` | `duree` |
| `jet de sauvegarde` | `jet_de_sauvegarde` |
| `resistance a la magie` | `resistance_magie` |

Unrecognized labels are **not dropped** — they go into an `autres` object and
are reported, so nothing is lost silently.

**Class table** — label (from `elements_to_do.json`) → slug → wiki abbreviation.
Wiki abbreviations are the tokens found in a spell page's `Niveau` line. Those
confirmed in samples: `Bard`, `Cham`, `Inq`, `Occ`, `Pal`, `Prê`, `Magus`,
`Réd`. Author the table with the 20 input labels and their slugs, mark
abbreviations as **provisional where unverified**, and state plainly that
step 04 is responsible for reporting any abbreviation it encounters that is not
in the table (rather than guessing).

**Directory layout** — reproduce the layout from `00_CONTEXT.md`:
`cache/html/`, `cache/index.jsonl`, `data/listes_classes/`, `data/index/`,
`data/sorts/`, `reports/`, `schemas/`, `src/pf_spells/`, `tests/`.

**File format rules**
- JSONL: one compact JSON object per line, `\n` terminated, UTF-8, no BOM,
  keys in the canonical order given above.
- JSON: pretty-printed, `indent=2`, keys in canonical order, trailing newline —
  these files are read and hand-edited by a human, so readability wins over
  compactness.
- `data/sorts/<id>.json` filename is exactly the `id` + `.json`.

**Human-correction contract**
- `data/sorts/*.json` is hand-editable and human edits are authoritative.
- Generators must default to not overwriting an existing spell file
  (`--overwrite` must be an explicit opt-in flag).
- Provenance lives in `meta`: `{url, cache_fichier, recupere_le, parser_version}`
  so a human can tell what a field was derived from.

## Pseudo-code

```
ensure directory .claude/skills/pf-corpus-conventions/
write SKILL.md:
    frontmatter: name, description
    section "When to load this"        -> any step reading/writing corpus data
    section "Encoding rules"
    section "Spell id slug algorithm"  -> numbered recipe + worked examples table
    section "JSON key vocabulary"      -> the table, + null/[] policy
    section "Stat-block label map"     -> normalization recipe + label table
    section "Class table"              -> label | slug | wiki abbrev | verified?
    section "Directory layout"
    section "File format rules"        -> JSONL vs JSON, key ordering
    section "Human-correction contract"
    section "Anti-patterns"            -> the mistakes that must not recur
self-check: hand-verify each worked slug example against the written recipe
git commit
```

## Logic Flow

1. Read `elements_to_do.json` to get the 20 class labels verbatim (accents
   intact) for the class table. Note the `Alchimiste` duplicate and record in
   the Skill that dedup is by percent-decoded lowercased URL, 20 → 19.
2. Optionally grep the 4 sample spell pages for `<b>` labels to confirm the
   label list; the confirmed set is already given above.
3. Author `SKILL.md` covering all sections listed.
4. Hand-verify the five worked slug examples step-by-step against the recipe as
   written. Any mismatch means the recipe text is wrong — fix the recipe.
5. Commit.

## Implementation Notes

- **Documentation only.** Create no `.py` files, no schemas, no tests. Step 02
  owns all code. If the two disagree later, the Skill is the authority and the
  code is fixed to match.
- Include an explicit **Anti-patterns** section — these are the concrete traps
  found while analysing the source:
  - decoding wiki HTML as cp1252 or letting a lib sniff it;
  - parsing a page without slicing to `PageContentDiv` first (site nav links
    then leak in as if they were spells);
  - treating the `Accès rapide aux sections sur la magie` `<h2>` as a spell
    level section;
  - assuming `Sorts de niveau N` — the Alchimiste page says
    `Formules de niveau N`;
  - matching `Temps d'incantation` with a hardcoded U+0027 apostrophe (pages
    use U+2019 too);
  - assuming the stat block is a `<table>` or `<dl>` — it is a flat
    `<b>`/`<br>` run;
  - stripping accents from content values;
  - using `unidecode` (not installed).
- Keep the Skill under ~200 lines. It is a lookup reference, not an essay:
  tables over prose.
- Do not add an `__init__` file anywhere, and do not add `__all__` declarations.

## Verification Criteria

1. `.claude/skills/pf-corpus-conventions/SKILL.md` exists, is valid UTF-8, and
   opens with well-formed `---` frontmatter containing `name:
   pf-corpus-conventions` and a one-line `description:`.
2. The file contains all ten required sections named in the pseudo-code.
3. The slug recipe is present as numbered steps and includes all five worked
   examples; each has been hand-traced through the recipe and matches. In
   particular `Cœur incassable` → `coeur-incassable` (proves the œ pre-mapping
   is documented) and `Bouclier de la Fleur de l'Aube` →
   `bouclier-de-la-fleur-de-l-aube` (proves apostrophe handling).
4. The JSON key table contains every one of the 20 keys listed above.
5. The stat-block label table contains all nine label groups, and the
   normalization recipe explicitly covers the U+2019 apostrophe and `\xa0`.
6. The class table has one row per unique class (19 after dedup), each with slug
   and a verified/provisional marker, and the `Alchimiste` dedup is documented.
7. The Anti-patterns section names at least the eight traps listed above.
8. No `.py`, `.json`, or test file was created by this step:
   `git status --porcelain` shows changes only under `.claude/`.

## Git Handling

- **Branch:** `step/01-skills`, cut from `feat/spell-corpus`.
- **Worktree:** yes — wave-mate 02 runs concurrently.
  `git worktree add ../wt-01 -b step/01-skills feat/spell-corpus`
- **Commit:** everything under `.claude/skills/pf-corpus-conventions/`.
- **Message:**
  `docs(step-01): add pf-corpus-conventions skill defining corpus conventions`
- Merge to `feat/spell-corpus` with `--no-ff` before step 03 starts.

## Expected Outcome

A single authoritative reference Skill that every downstream step names in its
Inherited Context. After this step, the slug algorithm, French key vocabulary,
label map, and encoding rules have exactly one definition — so nine independent
subagents can emit artifacts that join on `id` without ever having talked.
