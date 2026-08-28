# Step 02 Report — Class skills scraper

## What was built

- `scrape_class_skills.py` (repo root): standalone script, siblings of
  `extract_class_features.py`. Downloads each of the 41 class wiki pages
  (cached in `class_skills_html/`, gitignored, mirroring `classes_html/`)
  and extracts, per class:
  - `class_skills`: list of `{"skill": "<name>" or "<name> (<sub>)", "ability": "For|Dex|Con|Int|Sag|Cha"}`.
  - `skill_points_formula_raw`: the raw French sentence for the skill-point
    formula.
  - `skill_points_formula`: structured `{"base": int, "ability": "<code>"}`
    when the sentence matches the common `N + modificateur d'Ability`
    pattern, else `null` (raw text is still preserved either way).
- `Data/class_skills.json`: output, 41 keys (one per `CLASS_SLUGS` entry
  copied verbatim from `extract_class_features.py`), UTF-8, `ensure_ascii=False`,
  sorted keys.
- `.gitignore`: added `class_skills_html/`.

## Deviation from the plan (and why)

- The step file and `00_CONTEXT.md` both assert `CLASS_SLUGS` has "40
  classes". Actual count in `extract_class_features.py` is **41**. I copied
  the dict verbatim as instructed rather than "fixing" it — the verification
  criterion is really "same keys as `CLASS_SLUGS`", which holds (see below).
  This is a stale claim in the planning docs, not a defect in this step's
  output.
- The pseudo-code's `FORMULA_RE` (`r"Points de comp.tence par niveau\.</b>\s*(.*?)\.<br"`)
  and `SKILL_ITEM_RE` (ability code must be bare `(For)` etc.) did not match
  every live page. Real pages showed two variations the spec didn't
  mention:
  1. Some classes (e.g. `alchimiste`, `bretteur`, `conjurateur`,
     `enqueteur`, `inquisiteur`, `justicier`, `metamorphe`, `oracle`,
     `pretre_combattant`, `sanguin`, `spirite`, `chasseur_de_vampire`) use
     the heading text **"Rangs de compétence par niveau"** instead of
     "Points de compétence par niveau", and several omit the period before
     `</b>` or before `<br` (e.g. `chevalier`: `...niveau.</b> 4 + ...Intelligence<br` — no trailing period at all).
     Fixed by relaxing `FORMULA_RE` to
     `r"(?:Points|Rangs) de comp.tence par niveau\s*\.?\s*</b>\s*\.?\s*(.*?)\.?<br"`.
  2. `antipaladin`'s skill list wraps each ability code in its own
     `<a class="pagelink">` link (`(<a ...>Int</a>)`) instead of bare
     `(Int)`, which the original `SKILL_ITEM_RE` didn't match (empty skill
     list for that class). Fixed by allowing optional tags around the
     ability code: `\(\s*(?:<[^>]+>)*\s*(For|Dex|Con|Int|Sag|Cha)\s*(?:<[^>]+>)*\s*\)`.
  Both fixes were verified against the live cached HTML for every affected
  class before considering the step done, per the step file's explicit
  instruction not to ship silent zero-skill/zero-formula classes.

## Verification Criteria — evidence

1. **`python scrape_class_skills.py` completes without unhandled
   exceptions.**
   PASS. Ran `py -3.11 scrape_class_skills.py` (full run, live network
   fetch on first run, cached on reruns). Output:
   ```
   Classes traitées : 41
   ```
   No exceptions, no "Listes de compétences vides" / "Formule ... introuvable"
   lines in the final run (after the regex fixes above; the first run,
   before fixing, did print `antipaladin` under vides and 15 classes under
   formule introuvable — all resolved by rerunning after the fix).

2. **`Data/class_skills.json` has exactly the same keys as `CLASS_SLUGS`.**
   PASS. Verified programmatically:
   ```
   >>> set(json.load(open("Data/class_skills.json", encoding="utf-8")).keys()) == set(CLASS_SLUGS.keys())
   True
   ```
   (41 keys each — see deviation note above re: the "40" figure in the
   planning docs being stale.)

3. **`guerrier` entry: `skill_points_formula == {"base": 2, "ability":
   "Int"}`, and `class_skills` contains at least `Artisanat`, `Équitation`,
   `Escalade`, `Intimidation`, `Natation`, `Profession`, `Survie`, and two
   distinct `Connaissances (...)` entries (10 total).**
   PASS. Actual `Data/class_skills.json["guerrier"]`:
   ```json
   {
     "class_skills": [
       {"ability": "Int", "skill": "Artisanat"},
       {"ability": "Int", "skill": "Connaissances (exploration souterraine)"},
       {"ability": "Int", "skill": "Connaissances (Ingénierie)"},
       {"ability": "Cha", "skill": "Dressage"},
       {"ability": "Dex", "skill": "Équitation"},
       {"ability": "For", "skill": "Escalade"},
       {"ability": "Cha", "skill": "Intimidation"},
       {"ability": "For", "skill": "Natation"},
       {"ability": "Sag", "skill": "Profession"},
       {"ability": "Sag", "skill": "Survie"}
     ],
     "skill_points_formula": {"ability": "Int", "base": 2},
     "skill_points_formula_raw": "2 + modificateur d’Intelligence"
   }
   ```
   10 entries total, all required skills present, exactly two distinct
   `Connaissances (...)` entries, `skill_points_formula` matches exactly.
   UTF-8 byte-level check confirmed correct accented characters (e.g.
   `Équitation` = `b'\xc3\x89quitation'`, `Ingénierie` contains
   `b'\xc3\xa9'`), ruling out mojibake in the persisted file (terminal
   echo garbling accented chars during interactive `bash` output was a
   display artifact only, not a data artifact — confirmed via `.encode('utf-8')`
   inspection).

4. **Every class's `class_skills` list is non-empty (no silent zero-skill
   classes).**
   PASS. Programmatic check over all 41 entries:
   ```python
   bad = [(k, "no skills") for k, v in d.items() if not v["class_skills"]]
   # bad == []
   ```
   Also checked `skill_points_formula_raw` and `skill_points_formula` are
   non-null for all 41 classes — same empty result.

## Spot checks beyond the mandated criteria

- `alchimiste`: 13 skills, formula `{"base": 4, "ability": "Int"}` (4 +
  Int) — matches known PF1e alchemist skill-point rate.
- `magicien`: 7 skills, formula `{"base": 2, "ability": "Int"}` — matches
  known PF1e wizard rate.
- `moine`: 14 skills, formula `{"base": 4, "ability": "Int"}` — matches
  known PF1e monk rate.
- `chevalier` (cavalier): formula `4 + Int` — matches known PF1e cavalier
  rate, extracted correctly despite the missing trailing period before
  `<br` on that page.

## Final status: PASS on all 4 verification criteria.

Files touched: `scrape_class_skills.py` (new), `Data/class_skills.json`
(new), `.gitignore` (added `class_skills_html/`).
