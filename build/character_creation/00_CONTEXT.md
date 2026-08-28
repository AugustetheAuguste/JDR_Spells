# 00_CONTEXT — Character Creation & Feat Assignment

## Project Overview

`pf1_dons` currently parses `Data/Dons.csv` (1416 French Pathfinder 1e feats
and their prerequisites) into structured `Requirement`/`OrGroup` objects
(`pf1_dons/parser.py`, `pf1_dons/models.py`), and evaluates a `Character`
(`pf1_dons/engine.py`) against the whole catalog to produce
eligible/manual_check/ineligible groupings (`filter_feats`). BBA is derived
from a static per-class progression table (`pf1_dons/class_progression.py`).
There is no character persistence, no CLI, no notion of "how many feats can
this character actually have," and no racial or class bonus-feat data.

## Objectives

Turn this into an actual character-creation workflow:

1. A CLI to create a character (class, level, race, raw ability scores),
   persisted to disk as JSON.
2. Correct computation of how many feat **slots** a character has at their
   level, split by slot type: general (1 at level 1, +1 every odd level),
   racial bonus (e.g. human's level-1 bonus feat), and class bonus (e.g.
   fighter's bonus feat at 1/2/4/6/8/...), each slot optionally restricted to
   a feat category (e.g. fighter's bonus feat slot only accepts "combat"
   feats).
3. A skill-point budget per level (`2 + Int mod` style formula, class-skill
   list per class) so `Character.skill_rank` can be backed by real numbers
   instead of the current "optimistic ranks = level" placeholder — this plan
   computes the *budget*, it does not auto-allocate ranks.
4. A CLI flow to view open slots, see (for each open slot) the feats that
   are eligible and match that slot's category, assign a chosen feat into a
   slot, persist the update, and re-evaluate.

## Current State Analysis

- `pf1_dons/models.py`: `Requirement`, `OrGroup`, `ParsedConditions`. No
  dataclass yet for race/class metadata.
- `pf1_dons/parser.py`: `KNOWN_RACES` (flat set of normalized race name
  strings, no per-race data), `KNOWN_CLASSES` (from
  `CLASS_BBA_PROGRESSION.keys()`).
- `pf1_dons/class_progression.py`: `CLASS_BBA_PROGRESSION` dict class→good/
  medium/poor, `get_bba`.
- `pf1_dons/engine.py`: `Character` dataclass (`character_class`, `level`,
  `race`, `size`, `ability_scores`, `known_feats`, `skill_ranks`); `bba`
  property; `skill_rank()` returns `level` when `skill_ranks` is `None`
  (optimistic placeholder — out of scope to change *behavior* of, this plan
  adds a real budget calculator alongside it, consumed by the CLI, not by
  `engine.py` itself, so no existing test's behavior changes).
- `pf1_dons/data_loader.py`: `load_catalog()` → `list[FeatRow]` from
  `Data/Dons.csv`.
- `extract_class_features.py`: standalone scraper, not imported by the
  package, hits `pathfinder-fr.org` class wiki pages with
  `urllib.request` + `User-Agent: Mozilla/5.0` (required — the site 403s
  default urllib UA), produces `Data/class_features.json`
  (`{class_key: {level_str: [feature_name, ...]}}`). Confirmed the fighter
  ("guerrier") entry already contains the literal string
  `"Don supplémentaire"` at levels 1,2,4,6,8,10,12,14,16,18,20 — this file
  is reusable as the source of truth for class bonus-feat *timing* (no new
  scrape needed for that).
- No `Data/races.json`, `Data/class_skills.json`, `Data/class_bonus_feats.json`,
  `Data/feat_categories.json` exist yet.
- Wiki page structure confirmed by fetching live pages with `curl -A
  "Mozilla/5.0"`:
  - Race pages (e.g. `Pathfinder-RPG.Humain.ashx`) have an `<h2
    class="separator">Traits raciaux standards<a ... id="Traits_raciaux_standards_N">`
    heading followed by a `<div class="presentation ...">...<ul><li><b>Trait
    Name.</b> free-text description...</li>...</ul></div>` block. Traits are
    unstructured prose; must be parsed with heuristics/keywords, not a
    table. A `<h2>Traits raciaux alternatifs` section follows and MUST be
    excluded (those are optional variant traits, not the character's
    default traits).
  - Class pages (e.g. `Pathfinder-RPG.Guerrier.ashx`) have a `<h2
    class="separator"> Compétences de classe <a ... id="Compétences_de_classe_N">`
    heading followed by prose: `Les compétences de classe du <classe> sont
    les suivantes : <a class="pagelink" ...>Artisanat</a> (Int), ...` (skill
    name + parenthesized ability code, comma-separated, links use
    `class="pagelink"`), then later in the same prose block: `<b>Points de
    compétence par niveau.</b> 2 + modificateur d'<a ...>Intelligence</a>.`
  - `extract_class_features.py`'s `CLASS_SLUGS` dict is the authoritative
    class-key → URL-slug mapping and already lists all 40 classes this
    project tracks; reuse it verbatim for the new scrapers instead of
    rebuilding it.
- Race pages are not centrally listed with a stable machine-readable slug
  map (the index page at `Pathfinder-RPG.Races.ashx` is a prose directory of
  `<a href="./Pathfinder-RPG.<Name>.ashx">` links, several with a
  disambiguating `" (race)"` suffix e.g. `Pathfinder-RPG.Aasimar (race).ashx`).
  A `RACE_SLUGS` dict (key → exact URL path segment) must be hand-built once,
  mirroring `CLASS_SLUGS`'s pattern, covering every race in `KNOWN_RACES`
  (`pf1_dons/parser.py`).

## Feature / Issue List Being Addressed

1. No character persistence → add `Data/characters/*.json` save/load.
2. No feat-slot accounting → add general/racial/class bonus slot
   calculation, including category-restricted class bonus slots.
3. No racial trait data at all → scrape and curate `Data/races.json`
   (ability modifiers, size, speed, bonus feat flag, full traits list —
   general-purpose, reusable beyond this plan per user request).
4. No class skill-point / class-skill data → scrape `Data/class_skills.json`.
5. No feat category tagging → curate `Data/feat_categories.json` so
   category-restricted bonus slots (fighter → "combat", etc.) can be
   validated; best-effort, flags uncertain feats the same way the parser
   already flags `needs_manual_check`.
6. No CLI → add `pf1_dons/cli.py` for character creation, slot viewing, and
   feat assignment.

## Skills & Tools Inventory

All of the following are new Python scripts/modules (no Claude "Skill"
files needed — this is a data engineering + library task). Each is built in
Wave 1, before any functional step:

| Tool | File(s) produced | Built in | Consumed by |
|---|---|---|---|
| Race scraper | `scrape_races.py` → `Data/races.json` | Step 01 | Step 05 |
| Class skills scraper | `scrape_class_skills.py` → `Data/class_skills.json` | Step 02 | Step 06 |
| Class bonus-feat extractor | `extract_class_bonus_feats.py` → `Data/class_bonus_feats.json` | Step 03 | Step 07 |
| Feat category tagger | `tag_feat_categories.py` → `Data/feat_categories.json` | Step 04 | Step 12 |

All four are standalone top-level scripts (siblings of the existing
`extract_class_features.py`), not imported by `pf1_dons`, matching the
existing pattern of keeping scraping tools outside the importable package.

## Execution Plan (Waves)

- **Wave 1** (parallel, no dependencies): Step 01, Step 02, Step 03, Step 04.
- **Wave 2** (parallel): Step 05 (needs 01), Step 06 (needs 02).
- **Wave 3** (parallel): Step 07 (needs 03, 05), Step 08 (needs 06).
- **Wave 4**: Step 09 (needs 07, 08).
- **Wave 5**: Step 10 (needs 09).
- **Wave 6** (parallel): Step 11 (needs 09, 10), Step 12 (needs 09, 10, 04).
- **Wave 7**: Step 13 (needs 05, 06, 07, 08, 09, 10, 11, 12 — the full
  functional surface, for test coverage).
- **Wave 8**: Step 14 (needs everything — CLAUDE.md is written last so it
  documents the real, tested result).

## Git & Branching Strategy

- Base branch: whatever the current default branch is (repo has no git
  history yet at plan-writing time — confirm `git status`/`git log` before
  branching; if this is truly an un-initialized repo, `git init` and an
  initial commit of the current tree is a prerequisite not covered by these
  steps and must happen before Wave 1 starts).
- One integration branch for the whole plan: `feature/character-creation`.
- Each step gets its own short-lived branch off `feature/character-creation`,
  named `feature/character-creation/NN-slug` (e.g.
  `feature/character-creation/01-scrape-races`), so Wave 1's four steps and
  any other same-wave steps can run in parallel git worktrees without
  colliding.
- Commit granularity: one commit per step (the step's full diff), message
  format `pf1_dons(NN): <imperative summary>` e.g.
  `pf1_dons(05): add race loader and RaceInfo model`.
- Merge order: merge each step's branch into
  `feature/character-creation` as soon as that step is verified, strictly
  respecting wave order (don't merge a Wave N branch until every Wave N-1
  branch it depends on is merged) — for steps in the same wave, merge order
  between them doesn't matter since they're independent by construction.
  Resolve any conflicts by re-running the later step's verification after
  merge.
- `feature/character-creation` merges to the base branch only after Step 14
  (CLAUDE.md update) is verified and all tests pass on the integration
  branch.

## CLAUDE.md Impact

After this plan executes, CLAUDE.md's Architecture section needs:
- New data files listed alongside `Data/Dons.csv` and `Data/class_features.json`:
  `Data/races.json`, `Data/class_skills.json`, `Data/class_bonus_feats.json`,
  `Data/feat_categories.json`, `Data/characters/*.json`.
- New standalone scraper scripts alongside `extract_class_features.py`:
  `scrape_races.py`, `scrape_class_skills.py`,
  `extract_class_bonus_feats.py`, `tag_feat_categories.py`.
- New package modules: `pf1_dons/race_loader.py`, `pf1_dons/class_skills.py`,
  `pf1_dons/feat_slots.py`, `pf1_dons/skill_budget.py`,
  `pf1_dons/character_profile.py`, `pf1_dons/persistence.py`,
  `pf1_dons/cli.py`.
- New CLI commands section (`python -m pf1_dons.cli create`, `... show`,
  `... slots`, `... assign`).
- A note that `Character.skill_rank`'s "optimistic" default is now
  superseded, for CLI-created characters, by a real skill-point budget from
  `skill_budget.py` — the placeholder in `engine.py` is untouched and still
  used when no budget/allocation is available.
- This is written last, in Step 14, against the actually-implemented code.

## Open Assumptions To Confirm Before Execution

1. Fighter-style "bonus feat restricted to a category" slots: the category
   restriction text (e.g. "combat feats only") is not present verbatim in
   `Data/class_features.json` (it only has the feature *name*, e.g. "Don
   supplémentaire", not the restriction). Step 04's feat-category tagger is
   necessarily a best-effort, keyword-driven first pass (flagging uncertain
   feats the same way the existing parser flags `needs_manual_check`), not a
   complete authoritative categorization. Treat category-restricted slots
   in the CLI as "suggested, verify manually" for any feat the tagger
   wasn't confident about.
2. `Data/races.json` traits are free-text prose per `<li>`; Step 01 extracts
   structured fields (ability mod, size, speed, bonus-feat flag, class-skill
   grant if any) via keyword heuristics on top of storing the full raw
   trait list/text (per the user's request that this data be reusable
   beyond feat slot counting). Any race whose standard traits don't match
   the expected heuristics gets its structured fields left `null` with the
   raw text preserved, rather than a guessed value.
3. `RACE_SLUGS` (URL slug per race) must be hand-built in Step 01 by
   resolving each `KNOWN_RACES` entry against the live
   `Pathfinder-RPG.Races.ashx` index page — this is manual curation work
   inside Step 01, not automatable from `KNOWN_RACES` alone since slugs use
   inconsistent capitalization/suffixes (`" (race)"`, accents encoded as
   `%c3%a9` etc.).
4. Skill point allocation stays manual (user picks ranks, tool validates
   against budget) per the user's answer — no auto-allocation algorithm is
   in scope.
