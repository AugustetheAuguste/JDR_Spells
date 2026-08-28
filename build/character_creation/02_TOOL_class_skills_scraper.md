# Step 02 — Build the class skills scraper (`scrape_class_skills.py` → `Data/class_skills.json`)

## Objectives

Produce a standalone script `scrape_class_skills.py` that downloads each
class's wiki page and extracts: (a) the skill-points-per-level formula, and
(b) the list of class skills with their governing ability score.

## Dependencies & Parallelization

- **Wave 1.** No dependencies on any other step. Safe to run fully in
  parallel with Steps 01, 03, 04.

## Inherited Context

None (Wave 1). Reference material below is self-contained.

`extract_class_features.py` already defines `CLASS_SLUGS` (repo root,
`extract_class_features.py` lines ~16-58): a dict of 40 normalized class
keys → URL slug strings (e.g. `"guerrier": "Guerrier"`,
`"pretre_combattant": "Pr%c3%aatre%20combattant"`). Reuse this dict
verbatim (copy it into the new script) rather than re-deriving it.

Confirmed live page structure (fetched `Pathfinder-RPG.Guerrier.ashx` with
`curl -A "Mozilla/5.0"`), inside one contiguous HTML region:
```
<h2 class="separator"> Compétences de classe <a class="headeranchor" id="Compétences_de_classe_7" ...>&#0182;</a></h2>
Les compétences de classe du guerrier sont les suivantes : <a class="pagelink" href="Pathfinder-RPG.Artisanat.ashx" ...>Artisanat</a> (Int), <a ...>Connaissances</a> (exploration souterraine) (Int), ... et <a ...>Survie</a> (Sag).<br /><br />
<b>Points de compétence par niveau.</b> 2 + modificateur d'<a class="pagelink" href="Pathfinder-RPG.Intelligence.ashx" ...>Intelligence</a>.<br /><br />
<h2 class="separator"> Descriptif de la classe ...
```
Key facts: the skills sentence starts with "Les compétences de classe du
... sont les suivantes :" and ends at the first `.<br` after that opening;
each skill appears as `<a class="pagelink" ...>SkillName</a>` optionally
followed by a parenthetical sub-specialization (e.g.
`(exploration souterraine)`, `(Ingénierie)` for Connaissances) and always
followed by `(Ability3LetterCode)`. The formula sentence is literally
`<b>Points de compétence par niveau.</b> ` followed by free text ending in
`.` (usually `N + modificateur d'Intelligence` but verify per class — some
occult classes may reference a different ability; do not assume Int).

## Pseudo-code

```
CLASS_SLUGS = { ... copied verbatim from extract_class_features.py ... }
HTML_DIR = Path("class_skills_html")
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.{slug}.ashx"
USER_AGENT = "Mozilla/5.0"

function download_pages(force=False):
    # identical caching pattern to extract_class_features.py::download_pages,
    # but cache under class_skills_html/ (separate cache dir — do not
    # collide with classes_html/ used by extract_class_features.py, since
    # page content is byte-identical but keeping caches separate avoids
    # cross-tool coupling)

SKILLS_HEADER_RE = search for the "Compétences de classe" <h2> heading
FORMULA_RE = re.compile(r"Points de comp.tence par niveau\.</b>\s*(.*?)\.<br", re.DOTALL)
SKILL_ITEM_RE = re.compile(
    r'<a class="pagelink"[^>]*>([^<]+)</a>(\s*\([^)]+\))?\s*\((For|Dex|Con|Int|Sag|Cha)\)'
)

function extract_class_skills_section(html_text) -> str:
    find SKILLS_HEADER_RE match; slice from there to the next "<h2 class=\"separator\">"
    return slice

function parse_skills(section_html) -> list[dict]:
    matches = SKILL_ITEM_RE.finditer(section_html)
    skills = []
    for m in matches:
        base_name = strip_tags(m.group(1)).strip()
        sub = strip_tags(m.group(2)).strip("() ") if m.group(2) else None
        ability = m.group(3)
        display = f"{base_name} ({sub})" if sub else base_name
        skills.append({"skill": display, "ability": ability})
    return skills

function parse_formula(section_html) -> str | None:
    m = FORMULA_RE.search(section_html)
    return strip_tags(m.group(1)).strip() if m else None

function parse_int_modifier_formula(formula_text) -> dict:
    # structure the common case machine-readably without discarding the raw text
    m = re.match(r"(\d+)\s*\+\s*modificateur d.(\w+)", normalize(formula_text))
    if m:
        return {"base": int(m.group(1)), "ability": ability_code_for(m.group(2))}
    return None  # class uses a non-standard formula; raw text is still kept

function main():
    download_pages()
    out = {}
    for key, slug in CLASS_SLUGS:
        html_text = read class_skills_html/{key}.html
        section = extract_class_skills_section(html_text)
        skills = parse_skills(section)
        formula_text = parse_formula(section)
        out[key] = {
            "class_skills": skills,
            "skill_points_formula_raw": formula_text,
            "skill_points_formula": parse_int_modifier_formula(formula_text),
        }
    write Data/class_skills.json
    print summary: N classes processed, list of classes where skills list is
      empty or formula is None (needs manual follow-up)
```

## Logic Flow

1. Download all 40 class pages (cache in `class_skills_html/`).
2. Per page, isolate the "Compétences de classe" section (bounded by the
   next `<h2 class="separator">`).
3. Regex out the skill list (name + optional sub-specialization + ability
   code) and the skill-points formula sentence.
4. Structure the common `N + modificateur d'Ability` formula into
   `{base, ability}`; always keep the raw sentence too, since some classes
   may phrase it differently or use a non-Int ability.
5. Write `Data/class_skills.json` keyed by the same class keys used in
   `CLASS_BBA_PROGRESSION` (`pf1_dons/class_progression.py`).

## Implementation Notes

- Copy `strip_tags`/`TAG_RE`/normalize helpers from
  `extract_class_features.py` rather than importing (script-to-script
  independence, matching existing repo convention).
- `Connaissances` (Knowledge) appears multiple times per class with
  different sub-specializations (e.g. "Connaissances (Ingénierie)",
  "Connaissances (exploration souterraine)") — each is a distinct skill
  entry, keep them separate, don't dedupe by base name.
- If `SKILL_ITEM_RE` fails to match anything for a class, log it and still
  write an entry with `"class_skills": []` — never drop a class key from
  the output or raise.
- Ability code casing: keep the site's own 3-letter French codes exactly as
  they appear (`For`, `Dex`, `Con`, `Int`, `Sag`, `Cha`) — this matches
  `ABILITY_ABBREVIATIONS` in `pf1_dons/parser.py`.

## Verification Criteria

- `python scrape_class_skills.py` completes without unhandled exceptions.
- `Data/class_skills.json` has exactly the same 40 keys as `CLASS_SLUGS`.
- `guerrier` entry: `skill_points_formula == {"base": 2, "ability": "Int"}`,
  and `class_skills` contains at least `Artisanat`, `Équitation`,
  `Escalade`, `Intimidation`, `Natation`, `Profession`, `Survie`, and two
  distinct `Connaissances (...)` entries (10 total per the live page).
- Every class's `class_skills` list is non-empty (manually re-check any
  class the script logs as empty and fix the regex/section-bounding before
  considering this step done — do not ship silent zero-skill classes).

## Git Handling

- Branch: `feature/character-creation/02-scrape-class-skills`.
- Commit `scrape_class_skills.py` and `Data/class_skills.json`;
  `.gitignore` the `class_skills_html/` cache dir (mirror however
  `classes_html/` is handled).
- Commit message: `pf1_dons(02): add class skills scraper and Data/class_skills.json`.

## Expected Outcome

`Data/class_skills.json` with skill-point formula + class skill list for
all 40 classes, consumed by Step 06's loader.
