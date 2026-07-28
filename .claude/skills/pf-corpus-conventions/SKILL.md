---
name: pf-corpus-conventions
description: Authoritative conventions for the Pathfinder-fr spell corpus (UTF-8 rules, spell id slug algorithm, French JSON keys, stat-block label map, class table, directory layout, file formats) — load before reading or writing anything under cache/, data/ or reports/.
---

# pf-corpus-conventions

## When to load this

Load this Skill in **any** step that reads or writes corpus data: fetching wiki
pages, parsing class list pages or spell pages, building indexes, enriching or
validating spell JSON, or writing the manifest/docs. It is the single authority.
If code and this Skill disagree, **the Skill wins and the code is fixed**.

## Encoding rules

| Rule | Detail |
|---|---|
| Input charset | All wiki HTML (live and the saved files in `pages/`) is **UTF-8** |
| Decoding | Always decode **explicitly** as UTF-8. Never let a lib sniff — pages have no `<meta charset>` and get mis-sniffed as cp1252 |
| Output | All output files UTF-8, **no BOM**, LF newlines, `json.dump(..., ensure_ascii=False)` |
| Accents in content | Preserved **verbatim**, always. Never transliterate values |
| Accent stripping | Happens **only** inside the `id` slug algorithm |
| Content region | Every parser slices to `<div id="PageContentDiv">` … `<div id="PageAttachmentsDiv"` **before** anything else |

## Spell `id` slug algorithm

The `id` is the join key across `data/listes_classes/*.jsonl`, `data/index/*`
and `data/sorts/*.json`. Compute it **only** this way:

1. Take the spell's display name exactly as shown on the wiki.
2. Pre-map ligatures: `œ`→`oe`, `Œ`→`oe`, `æ`→`ae`, `Æ`→`ae`
   (NFKD does **not** decompose these, so this must come first).
3. `unicodedata.normalize('NFKD', name)`, then drop every char where
   `unicodedata.combining(ch)` is truthy. Stdlib only —
   **`unidecode` is not installed, do not use it.**
4. Lowercase.
5. Replace every run of characters outside `[a-z0-9]` with a single `-`.
6. Strip leading/trailing `-`.

Worked examples (each hand-traced through the steps above):

| Display name | Slug | Step that matters |
|---|---|---|
| `Armes contre le mal` | `armes-contre-le-mal` | 5 (spaces → `-`) |
| `Cœur incassable` | `coeur-incassable` | 2 (`œ`→`oe`) |
| `Requiem pour les fantômes` | `requiem-pour-les-fantomes` | 3 (`ô`→`o`) |
| `Bouclier de la Fleur de l'Aube` | `bouclier-de-la-fleur-de-l-aube` | 5 (`'` is one run → single `-`) |
| `Détection de la magie` | `detection-de-la-magie` | 3 + 4 (`É`→`E`→`e`) |

**Collision rule:** if two distinct names produce the same slug, append `-2`,
`-3`, … in order of first encounter, and log the collision to `reports/`.
Slugs are **stable once assigned** — never renumber retroactively.

## JSON key vocabulary

Keys are **French, snake_case, unaccented** (`portee`, not `portée`); **values
keep their accents**. Canonical order is top-to-bottom in this table.

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
| classes granting it (step 08) | `classes` (array of objects) |
| provenance block | `meta` |

**Null/empty policy:** a key is **never omitted**. Absent-but-expected scalars
are `null`; absent list fields are `[]`; absent object fields are `{}` or
`null` as typed above. Every spell JSON carries the full key set so a human
scanning files sees one consistent shape.

## Stat-block label map

Spell-page stat blocks are a flat run of `<b>Label</b> value` pairs separated
by `<br>`. **Normalization recipe**, applied to a label before lookup:

1. Map `’` (**U+2019**) and `ʼ` (U+02BC) to `'` (U+0027).
2. NFKD-fold and drop combining marks (accent-insensitive matching).
3. Collapse all whitespace runs — **including `\xa0`** (NO-BREAK SPACE, which
   NFKD turns into a plain space) — to a single U+0020, then strip.
4. Lowercase. Drop a trailing `:`.

| Normalized label | Key |
|---|---|
| `ecole` | `ecole` (+ `descripteurs` from `[...]`) |
| `niveau` | `niveaux` |
| `temps d'incantation` | `temps_incantation` |
| `composantes` | `composantes` |
| `portee` | `portee` |
| `cible` / `effet` / `zone d'effet` / `zone` | `cible` |
| `duree` | `duree` |
| `jet de sauvegarde` | `jet_de_sauvegarde` |
| `resistance a la magie` | `resistance_magie` |

Unrecognized labels are **never dropped**: they go into an `autres` object and
are listed in the validation report.

## Class table

`elements_to_do.json` holds **20 raw entries**; `Alchimiste` appears twice with
URLs differing only in capitalization (`liste%20…` vs `Liste%20…`). **Dedup by
percent-decoded, lowercased URL, keeping the first occurrence's label →
20 → 19 unique classes.** The dedup is always logged, never silent.

Abbreviations are the tokens in a spell page's `Niveau` line. **Provisional**
rows are guesses. Step 04 **must report** any abbreviation it meets that is not
in this table, and must never guess a mapping.

| Label (verbatim) | Slug | Wiki abbrev | Verified? |
|---|---|---|---|
| Druide | `druide` | `Dru` | provisional |
| Arcaniste/Ensorceleur/Magicien | `arcaniste-ensorceleur-magicien` | `Arc` / `Ens` / `Mag` | provisional |
| Paladin | `paladin` | `Pal` | **verified** |
| Alchimiste | `alchimiste` | `Alch` | provisional |
| Antipaladin | `antipaladin` | `Antipal` | provisional |
| Conjurateur | `conjurateur` | `Conj` | provisional |
| Inquisiteur | `inquisiteur` | `Inq` | **verified** |
| Magus | `magus` | `Magus` | **verified** |
| Sorcière | `sorciere` | `Sorc` | provisional |
| Chaman | `chaman` | `Cham` | **verified** |
| Chasseur | `chasseur` | `Chas` | provisional |
| Prêtre/Prêtre combattant/Oracle | `pretre-pretre-combattant-oracle` | `Prê` / `PrêC` / `Ora` | `Prê` **verified**, rest provisional |
| Sanguin | `sanguin` | `Sang` | provisional |
| Hypnotiseur | `hypnotiseur` | `Hyp` | provisional |
| Médium | `medium` | `Méd` | provisional |
| Occultiste | `occultiste` | `Occ` | **verified** |
| Psychiste | `psychiste` | `Psy` | provisional |
| Spirite | `spirite` | `Spi` | provisional |
| Barde | `barde` | `Bard` | **verified** |

`Réd` is also confirmed in sample `Niveau` lines but maps to **no class in the
input list** — treat it as an unmapped abbreviation and report it.

Multi-class labels (`Arcaniste/Ensorceleur/Magicien`,
`Prêtre/Prêtre combattant/Oracle`) are **one source page with one multi-class
label**; they are not split. Per-spell `niveaux` preserves the individual
abbreviations anyway. Class slugs use the same recipe as spell slugs.

## Directory layout

```
elements_to_do.json                  # input, never modified
pages/                               # saved sample HTML, never modified
.claude/skills/pf-corpus-conventions/SKILL.md
schemas/                             # sort.schema.json, liste_classe.schema.json
src/pf_spells/                       # fetcher, htmlutil, slugs, classes
tests/                               # pytest, fixture-driven on pages/
cache/index.jsonl                    # url -> cache file, status, fetched_at
cache/html/<sha1>.html               # committed: lets parsers be fixed w/o re-crawl
data/listes_classes/<class-slug>.jsonl
data/index/sorts_uniques.jsonl
data/index/carte_doublons.json
data/index/sorts_exclusifs.json
data/sorts/<spell-id>.json
reports/
build/pf_spell_corpus/
```

## File format rules

| Format | Rules |
|---|---|
| `.jsonl` | One **compact** JSON object per line (`separators=(',', ':')`), `\n`-terminated, UTF-8, no BOM, keys in canonical order |
| `.json` | **Pretty-printed** `indent=2`, keys in canonical order, trailing newline — these are read and hand-edited by humans, readability beats compactness |
| Filenames | `data/sorts/<id>.json` is exactly the `id` + `.json`; `data/listes_classes/<class-slug>.jsonl` likewise |
| Newlines | LF everywhere, including on win32 |

## Human-correction contract

- `data/sorts/*.json` is **hand-editable and human edits are authoritative**.
- Generators **must not overwrite** an existing spell file by default;
  `--overwrite` is an explicit opt-in flag.
- Provenance lives in `meta`:
  `{url, cache_fichier, recupere_le, parser_version}` — so a human can tell
  what any field was derived from.
- Nothing is ever dropped silently: gaps, unknown labels, unknown class
  abbreviations and slug collisions all land in `reports/`.

## Anti-patterns

Concrete traps found in the source material. **Do not repeat any of these.**

| # | Anti-pattern | Why it breaks |
|---|---|---|
| 1 | Decoding wiki HTML as cp1252, or letting a lib sniff the charset | Pages are UTF-8 with no `<meta charset>` → mojibake (`Résistance`) |
| 2 | Parsing a page without slicing to `PageContentDiv` first | Site nav links leak in and are counted as spells |
| 3 | Treating the `Accès rapide aux sections sur la magie` `<h2>` as a spell-level section | It is a nav block; must be skipped |
| 4 | Assuming level headings always read `Sorts de niveau N` | The Alchimiste page says `Formules de niveau N` |
| 5 | Matching `Temps d'incantation` with a hardcoded U+0027 apostrophe | Pages also use U+2019 `’` — normalize first |
| 6 | Assuming the stat block is a `<table>` or `<dl>` | It is a flat `<b>`/`<br>` sibling run |
| 7 | Stripping accents from content values | Content is French and stays accented; only `id` slugs are folded |
| 8 | Using `unidecode` | Not installed — use `unicodedata.normalize('NFKD', …)` |
| 9 | Splitting multi-class labels, or silently dropping the `Alchimiste` duplicate | Dedup is by normalized URL and must be logged |
| 10 | Omitting a key instead of writing `null`/`[]` | Breaks the consistent hand-auditable shape |
