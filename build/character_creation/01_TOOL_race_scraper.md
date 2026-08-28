# Step 01 — Build the race scraper (`scrape_races.py` → `Data/races.json`)

## Objectives

Produce a standalone script `scrape_races.py` (repo root, sibling of
`extract_class_features.py`) that downloads each race's wiki page from
pathfinder-fr.org and writes `Data/races.json`: one entry per race with both
structured fields (ability modifiers, size, speed, has_bonus_feat,
bonus_skill_rank, class_skill_grants) and the full raw standard-traits list,
so the file is reusable for purposes beyond feat-slot counting.

## Dependencies & Parallelization

- **Wave 1.** No dependencies on any other step in this plan. Safe to run
  fully in parallel with Steps 02, 03, 04.
- Reads only: nothing in-repo except `pf1_dons/parser.py`'s `KNOWN_RACES`
  set (for the list of races to cover) — this is a read-only reference, not
  a code dependency; do not import `pf1_dons` from this script (it lives
  outside the package, matching `extract_class_features.py`'s pattern).

## Inherited Context

None (Wave 1, first step). Reference material below is self-contained.

`pf1_dons/parser.py` currently defines:
```python
KNOWN_RACES = {
    "demi-elfe", "demi-orque", "elfe", "gnome", "halfelin", "humain", "nain",
    "aasimar", "dhampir", "drow", "fetchelin", "gobelin", "hobgobelin",
    "homme-felin", "homme-rat", "ifrit", "kobold", "ondin", "orque",
    "oreade", "sylphe", "tengu", "tieffelin",
    "aquatique", "changelin", "duergar", "grippli", "homme-poisson",
    "kitsune", "nagaji", "samsaran", "strix", "suli", "svirfneblin",
    "vanara", "vishkanya", "wayang",
    "androide", "changepeau", "elfe aquatique", "gathelain", "ghoran",
    "gobelin simiesque", "kasatha", "lashunta", "syrinx", "trox",
    "triaxien", "virebois", "wivaran",
    "homme-serpent", "ogre", "troll",
}
```
These are lowercase, accent-stripped normalized names (see `_normalize` in
`parser.py`: NFKD decompose + strip combining marks + lowercase). The
scraper must cover every entry in this set, mapping each to a real wiki URL.

The last three (`homme-serpent`, `ogre`, `troll`) are bestiary monster races
without dedicated standard player-race trait pages in the same format —
confirm this while building `RACE_SLUGS`; if no matching
`Pathfinder-RPG.<Name>.ashx` page with a "Traits raciaux" section exists for
one of them, write that race's entry in `Data/races.json` with
`"traits": []`, all structured fields `null`, and
`"note": "no scrapeable standard traits page found"` — do not fabricate
data or crash the run.

## Pseudo-code

```
RACE_SLUGS = {
    "demi-elfe": "Demi-elfe",
    "demi-orque": "Demi-orque",
    "elfe": "Elfe",
    "gnome": "Gnome",
    "halfelin": "Halfelin",
    "humain": "Humain",
    "nain": "Nain",
    "aasimar": "Aasimar (race)",
    "dhampir": "Dhampir (race)",
    "drow": "Drow (race)",
    "fetchelin": "Fetchelin (race)",
    "gobelin": "Gobelin (race)",
    "hobgobelin": "Hobgobelin (race)",
    "homme-felin": "Homme-Félin (race)",
    "homme-rat": "Homme-rat (race)",
    "ifrit": "Ifrit (race)",
    "kobold": "Kobold (race)",
    "ondin": "Ondin (race)",
    "orque": "Orque (race)",
    "oreade": "Oréade (race)",
    "sylphe": "Sylphe (race)",
    "tengu": "Tengu (race)",
    "tieffelin": "Tieffelin (race)",
    "aquatique": "Aquatique (race)",
    "changelin": "Changelin (race)",
    "duergar": "Duergar (race)",
    "grippli": "Grippli (race)",
    "homme-poisson": "Homme-poisson (race)",
    "kitsune": "Kitsune (race)",
    "nagaji": "Nagaji (race)",
    "samsaran": "Samsaran (race)",
    "strix": "Strix (race)",
    "suli": "Suli (race)",
    "svirfneblin": "Svirfneblin (race)",
    "vanara": "Vanara (race)",
    "vishkanya": "Vishkanya (race)",
    "wayang": "Wayang (race)",
    # androide, changepeau, gathelain, ghoran, gobelin simiesque, kasatha,
    # lashunta, syrinx, trox, triaxien, virebois, wivaran, elfe aquatique,
    # homme-serpent, ogre, troll: resolve each against the live
    # Pathfinder-RPG.Races.ashx index page (fetch it first, list every
    # <a href="./Pathfinder-RPG....ashx"> whose text/href loosely matches
    # the KNOWN_RACES entry, normalize+compare) — fill in exact slugs found;
    # if genuinely absent, omit from RACE_SLUGS and handle as "not found"
    # per Objectives above.
}

BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.{slug}.ashx"
USER_AGENT = "Mozilla/5.0"   # required: default urllib UA gets HTTP 403

function download_pages(force=False):
    for key, slug in RACE_SLUGS: cache to races_html/{key}.html (skip if exists, like extract_class_features.py's download_pages)

function extract_standard_traits_html(html_text) -> str | None:
    find "<h2 class=\"separator\">Traits raciaux standards" heading
    if not found: try "Traits raciaux" (fallback header text) or return None
    slice from that heading to the NEXT "<h2 class=\"separator\">" occurrence
      (this naturally excludes "Traits raciaux alternatifs" and everything after)
    return that slice

function parse_trait_items(section_html) -> list[dict]:
    find every <li>...</li> inside the section's <ul> (ignore any <ul> that
      is itself inside the small FAQ toggle <table> at the top of the
      section — identify those by being nested inside a <table>...</table>
      that precedes the real <ul>; the real trait <ul> is the top-level one
      whose <li> children start with "<b>Name.</b>")
    for each <li>:
        name = text inside first <b>...</b>, minus trailing "."
        description = strip_tags(remaining li text) after the </b>
        traits.append({"name": name, "description": description})
    return traits

function classify_traits(traits: list[dict]) -> dict:
    # heuristics over trait name + description, all case/accent-insensitive
    result = {
        "ability_modifiers": [],   # list of {"ability": "For"|..., "modifier": int, "note": str|None}
        "size": None,              # "TP"|"P"|"M"|"G"|"TG"
        "speed": None,             # int, meters, from "vitesse de base de N mètres"
        "has_bonus_feat": False,   # "don supplémentaire" keyword present
        "bonus_skill_rank": False, # "rang de compétence supplémentaire" keyword present
        "class_skill_grants": [],  # skills made class skills by name, if stated plainly
    }
    for trait in traits:
        text = normalize(trait.name + " " + trait.description)
        if "don supplementaire" in text: result.has_bonus_feat = True
        if "rang de competence supplementaire" in text or "rang bonus" in text: result.bonus_skill_rank = True
        if match(r"bonus.*\+(\d+).*(force|dexterite|constitution|intelligence|sagesse|charisme)", text)
            or similarly worded ability-modifier sentences: append to ability_modifiers
            (accept "+2 à une valeur de caractéristique de leur choix" as a
             free-choice modifier: {"ability": "choice", "modifier": 2})
        if match(r"taille (tp|p|m|g|tg)", text): result.size = matched size, uppercased
        if match(r"vitesse de base de (\d+) metres?", text): result.speed = int(match)
    return result

function main():
    download_pages()
    out = {}
    for key in RACE_SLUGS (plus any KNOWN_RACES entries not in RACE_SLUGS, handled per Objectives):
        html_text = read races_html/{key}.html
        section = extract_standard_traits_html(html_text)
        if section is None:
            out[key] = {"traits": [], **all-null structured fields, "note": "..."}
            continue
        traits = parse_trait_items(section)
        structured = classify_traits(traits)
        out[key] = {"traits": traits, **structured}
    write Data/races.json (json.dumps, ensure_ascii=False, indent=2, sorted keys)
    print summary: N races processed, list of races with "note" (unresolved)
```

## Logic Flow

1. Resolve `RACE_SLUGS` (hardcode the confirmed ones above; fetch the index
   page live to resolve the remaining ~16 entries — this is a one-time
   manual-in-code lookup, not a runtime web-crawl of the index every run).
2. Download each race page (cached under `races_html/`, same pattern as
   `extract_class_features.py`'s `classes_html/`).
3. For each page, isolate the "Traits raciaux standards" section only.
4. Extract each `<li>` as a `{name, description}` pair — this is the
   reusable raw data the user asked for.
5. Run keyword/regex heuristics over that raw data to populate structured
   fields used later by Step 05/07 (bonus feat, size, speed, ability mods).
6. Write `Data/races.json` keyed by the same normalized race-name strings
   used in `KNOWN_RACES` / `Character.race`.

## Implementation Notes

- Reuse `TAG_RE`, `strip_tags`, and the `USER_AGENT`/caching pattern from
  `extract_class_features.py` verbatim (copy, don't import — it's a script,
  not a package module).
- Normalization for keyword matching: NFKD decompose + strip combining
  marks + lowercase (same recipe as `pf1_dons/parser.py::_normalize` — copy
  the function, don't import from the package).
- Be conservative with `ability_modifiers` extraction: only populate it from
  the *first* "+2 à une valeur de caractéristique" / explicit
  "+2 <ABILITY>" style sentences; leave anything ambiguous out of the
  structured field (it's still preserved in `traits` raw text).
- `Data/races.json` top-level shape:
  ```json
  {
    "humain": {
      "traits": [{"name": "Don supplémentaire.", "description": "..."}],
      "ability_modifiers": [{"ability": "choice", "modifier": 2}],
      "size": "M",
      "speed": 9,
      "has_bonus_feat": true,
      "bonus_skill_rank": true,
      "class_skill_grants": []
    }
  }
  ```

## Verification Criteria

- `python scrape_races.py` runs to completion without unhandled exceptions.
- `Data/races.json` exists, is valid JSON, and has one top-level key per
  `KNOWN_RACES` entry (46 keys) — entries without a resolvable page still
  appear, per the "not found" fallback shape.
- `humain` entry has `has_bonus_feat: true` and `bonus_skill_rank: true`
  (ground truth confirmed manually against the live page during planning).
- `nain` entry's `traits` list is non-empty (used later by
  `Acrobate des corniches` test in `tests/test_engine.py`, which requires
  race "nain" — confirms the nain page was scraped correctly).
- Spot-check 3 other races' `traits` lists are non-empty and their `<li>`
  text doesn't include leftover HTML tags.

## Git Handling

- Branch: `feature/character-creation/01-scrape-races`.
- Commit everything: `scrape_races.py`, `Data/races.json`. Do NOT commit
  `races_html/` (add it to `.gitignore` if not already ignored, matching
  however `classes_html/` is currently handled — check `.gitignore` first;
  if `classes_html/` is untracked/ignored, mirror that for `races_html/`).
- Commit message: `pf1_dons(01): add race scraper and Data/races.json`.

## Expected Outcome

A committed `Data/races.json` covering all known races with both raw trait
text and structured fields, and a reusable `scrape_races.py` that can be
re-run later if the source wiki changes.
