# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`pf1_dons` (Pathfinder 1e "Dons" = French for Feats) parses a French-language CSV catalog of Pathfinder 1e feats and their prerequisites ("Conditions"), then evaluates whether a given character is eligible for each feat. All identifiers, comments, and string content in this codebase are in French — keep new code consistent with that.

## Commands

Install deps:
```
pip install -r requirements.txt
```

Run all tests:
```
python -m pytest
```

Run a single test file / test:
```
python -m pytest tests/test_engine.py
python -m pytest tests/test_engine.py::test_ailes_de_tengu
```

Regenerate `Data/class_features.json` (scrapes pathfinder-fr.org class progression tables):
```
python extract_class_features.py
```

Regenerate the other character-creation data files (each idempotent, safe to re-run; `extract_class_bonus_feats.py` requires `Data/class_features.json` to already exist):
```
python scrape_races.py
python scrape_class_skills.py
python extract_class_bonus_feats.py
python tag_feat_categories.py
```

Character creation CLI (`pf1_dons/cli.py`):
```
python -m pf1_dons.cli create <name> --class <classe> --level <n> [--race <race>] [--for N --dex N --con N --int N --sag N --cha N]
python -m pf1_dons.cli show <name>
python -m pf1_dons.cli list
python -m pf1_dons.cli slots <name> [--open-only]
python -m pf1_dons.cli assign <name> <slot_id> "<nom du don>"
python -m pf1_dons.cli unassign <name> <slot_id>
```

## Architecture

The pipeline is: **CSV → parse conditions into structured requirements → evaluate against a Character → grouped eligibility results.**

1. **`data_loader.py`** — loads `Data/Dons.csv` (columns: `Dons` name, `Src` source, `Conditions`, `Avantages`) into `FeatRow` objects. Rows where `Conditions` or `Avantages` is `#ERROR!` are filtered out via `filter_valid_rows`, but the *full* set of feat names (including filtered rows) is still passed to the parser as `all_feat_names`, so that feat-name prerequisites referencing an excluded feat still resolve correctly.

2. **`parser.py`** — turns the free-text `Conditions` string into a `ParsedConditions` (from `models.py`): a list of `Requirement` or `OrGroup` objects.
   - Top-level requirements are comma-separated (`_split_top_level`, careful not to split inside parentheses).
   - Within a segment, `" ou "` (French "or") splits into an `OrGroup` of alternative `Requirement`s.
   - `_classify_segment` tries a sequence of regexes/lookups in order (level, BBA, NLS/caster level, size, skill ranks, ability score, known feat name, known race, known class, class-feature-text keywords) and falls back to `RequirementType.UNPARSED` if nothing matches — unparsed/class-feature-text requirements are flagged `needs_manual_check=True` and must never be silently dropped.
   - Feat-name and class-name matching goes through `_normalize` (NFKD strip of accents + lowercase) so French diacritics don't cause misses.
   - When a segment falls into `CLASS_FEATURE_TEXT` or `UNPARSED`, `_find_implied_classes` additionally checks whether the text names or implies one or more specific classes — via a literal known-class-name word-boundary match, and via substring lookup against `Data/class_ability_map.json` — and if so attaches `payload["implied_classes"] = [...]` (a sorted list of normalized class names). The requirement's `.type` and `needs_manual_check` are unchanged; this only enriches the payload so `engine.py` can hard-fail a class mismatch instead of always deferring to manual review.

3. **`class_progression.py`** — static table `CLASS_BBA_PROGRESSION` mapping normalized French class names to BBA progression (`good`/`medium`/`poor`), used to compute a character's base attack bonus (BBA) at a given level (`get_bba`). This is also the source of truth for `KNOWN_CLASSES` in `parser.py`.

4. **`engine.py`** — defines `Character` and evaluates a `FeatRow`'s parsed requirements against it:
   - `evaluate_requirement` returns a tri-state result: `True` (met), `False` (not met), or `None` (cannot be determined — missing data, e.g. no ability scores provided, or an inherently non-automatable requirement like caster level or class-feature text).
   - `OrGroup`s are satisfied if any option is `True`; if none is `True` but at least one is `None`, the group is `None` (needs manual check); otherwise `False`.
   - `evaluate_feat` short-circuits to `"ineligible"` on the first `False` requirement; otherwise accumulates `None` reasons and returns `"manual_check"` if any exist, else `"eligible"`.
   - For `CLASS_FEATURE_TEXT`/`UNPARSED` requirements, if `payload` carries `implied_classes` (see `parser.py` above) and the character's class isn't among them, the requirement resolves to `False` (`ineligible`) instead of the default `None` — e.g. a `Guerrier` is now correctly `ineligible` for "Abondance de révélations" (Oracle-only) rather than `manual_check`. If the character's class IS among `implied_classes`, the requirement still resolves to `None` (`manual_check`) since the specific ability/spell-level detail inside the text remains unverified.
   - `filter_feats` runs this over a whole catalog and groups+sorts results by status (`eligible` / `manual_check` / `ineligible`).

When adding a new `RequirementType`, you generally need to touch all three of `models.py` (enum + payload shape), `parser.py` (`_classify_segment` recognition), and `engine.py` (`evaluate_requirement` handling) together.

`extract_class_features.py` is a standalone offline scraper (not imported by the package) that produces `Data/class_features.json`; it caches downloaded HTML in `classes_html/` and skips re-downloading unless run with `force=True`.

### Character creation

A second pipeline, layered on top of the eligibility engine above, handles building and persisting actual characters and assigning feats into their feat slots.

5. **`race_loader.py`** — loads `Data/races.json` (scraped by `scrape_races.py` from pathfinder-fr.org race pages) into `RaceInfo` dataclasses (`models.py`): ability modifiers, size, speed, `has_bonus_feat`, `bonus_skill_rank`, and the raw traits list. `get_race()` does accent/case-insensitive lookup by race name. Races with no scrapeable standard-traits page (a few bestiary races) load with all structured fields `False`/`None` and a `note` explaining why, rather than raising.

6. **`class_skills.py`** — loads `Data/class_skills.json` (scraped by `scrape_class_skills.py`) into `ClassSkillInfo` dataclasses: each class's skill list (skill + governing ability) and skill-point-per-level formula (`SkillPointsFormula(base, ability)`, or `None` if the scraped formula text didn't match the expected pattern). `is_class_skill()` checks whether a given skill name is on a class's list.

7. **`feat_slots.py`** — `compute_feat_slots(character_class, level, race_name, races, class_bonus_feats)` returns the full list of `FeatSlot`s (general/racial/class) a character has at their level: one general slot at level 1 and every odd level after, one racial slot if `RaceInfo.has_bonus_feat`, and one class slot per level in `Data/class_bonus_feats.json` (produced by `extract_class_bonus_feats.py` from `Data/class_features.json`) up to the character's level. `category_restriction` on a class slot is currently always `None` (not derived automatically) but is honored if hand-edited.

8. **`skill_budget.py`** — computes a real skill-point budget (`total_skill_points`) from a class's `SkillPointsFormula` and ability scores, plus the standard PF1 class-skill +3 bonus (`class_skill_bonus`). This is separate from, and does not modify, `engine.py::Character.skill_rank`'s existing "optimistic" placeholder (which returns `level` when `skill_ranks` is unset) — the CLI-driven creation flow uses `skill_budget.py`'s real numbers, while `engine.py`'s eligibility checks keep using the placeholder unless a `Character`'s `skill_ranks` is explicitly populated.

9. **`character_profile.py`** — `CharacterProfile` is the creation-time model: name, class, level, race, ability scores, skill ranks, and a `list[FeatSlot]`. `to_character()` bridges it to `engine.Character` (feeding assigned feat names in as `known_feats`) so the existing `evaluate_feat` machinery can be reused unchanged. `eligible_feats_for_slot()` filters the catalog by a slot's category restriction (via `Data/feat_categories.json`, see below) then by engine eligibility, keeping both `eligible` and `manual_check` feats. `assign_feat()`/`unassign_feat()` mutate slot bookkeeping (slot must exist and be open; a feat can't be assigned to two slots at once — repeatable/multi-take feats, i.e. names ending in `*` in `Data/Dons.csv`, cannot currently be assigned more than once via the CLI).

10. **`persistence.py`** — saves/loads a `CharacterProfile` as JSON under `Data/characters/<slug>.json` (`save_profile`, `load_profile`, `list_characters`). `base_dir` defaults to the module-level `DEFAULT_CHARACTERS_DIR`, read at call time (not bound as an eager default argument), so tests can monkeypatch `pf1_dons.persistence.DEFAULT_CHARACTERS_DIR` and have it take effect even for callers (like `cli.py`) that don't pass `base_dir` explicitly.

11. **`cli.py`** (`python -m pf1_dons.cli ...`) — `create`/`show`/`list` build, persist, and inspect characters; `slots`/`assign`/`unassign` view open feat slots (with live-recomputed eligible candidates per slot) and mutate/persist feat assignments. `assign` always re-derives eligibility at assignment time rather than trusting a previous `slots` listing, since assigning one feat can change what's eligible elsewhere via prerequisite chains.

`Data/feat_categories.json` (produced by `tag_feat_categories.py`) tags each feat with a best-effort keyword-derived category list (e.g. `combat`) and a `needs_manual_check` flag for anything the tagger wasn't confident about — mirrors the parser's existing philosophy of surfacing ambiguity instead of guessing. `scrape_races.py`, `scrape_class_skills.py`, `extract_class_bonus_feats.py`, and `tag_feat_categories.py` are standalone scripts (not imported by the package), matching `extract_class_features.py`'s pattern; the two scrapers cache downloaded HTML (`races_html/`, `classes_html/`) and skip re-downloading unless run with `force=True`.

`Data/class_ability_map.json` maps class-ability keywords (French, normalized) to the class(es) that grant them, `{"entries": [{"keyword", "classes", "disposition": "mapped"|"no_single_class", "reason", "source_raw_examples", "confidence"}]}`. It powers `parser.py`'s `implied_classes` enrichment above. Unlike the other `Data/*.json` files, it is hand-curated, not auto-regenerated by a single command: `scripts/build_class_ability_map_seed.py` only produces a draft (`Data/class_ability_map.draft.json`, gitignored) by cross-referencing `Data/class_features.json` against every unclassifiable requirement segment in the catalog; turning that draft into the final, reviewed file is a manual/AI curation pass, not a script run.

`Data/feat_links.json` (`scrappers/scrape_feat_links.py`) et `Data/feat_details.json` (`scrappers/scrape_feat_details.py`) scrapent, pour chaque don, sa page dédiée sur pathfinder-fr.org (description complète, rubriques Spécial/Normal) — information absente du résumé `Data/Dons.csv`. Le balisage HTML exact de ces rubriques et le vocabulaire magique utilisés ci-dessous sont calibrés une fois pour toutes dans `build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md`. `Data/feat_magic_info.json` (`scrappers/tag_feat_magic.py`) tague par mots-clés si un don est de nature magique (`is_magic`/`needs_manual_check`, même convention que `feat_categories.json`). `Data/class_caster_info.json` (hand-curated, patron identique à `class_ability_map.json` : draft best-effort via `scripts/build_class_caster_info_seed.py`, vérité terrain vérifiée pour les 42 classes, hybrides/occultes incluses, dans `build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md`, transcrite via `scripts/curate_class_caster_info.py`) indique par classe si elle a accès à la magie. `engine.py::evaluate_feat` refuse (`ineligible`) un don magique de confiance haute quand ni la classe ni la race du personnage n'y donnent accès (vérifié par mots-clés sur les traits raciaux déjà scrapés dans `Data/races.json`), symétrique au fix `implied_classes`.

### Pistes futures

D'autres catégories de gating potentielles (au-delà de la magie) sont analysées dans `build/feat-detail-and-magic-gating/OUTPUT_other_gating_categories.md`.

### Test fixtures

`tests/golden/cases.json` is a hand-annotated, stratified regression fixture of feat-eligibility test cases (one object per case: `id`, `feat_name`, `character`, `expected_status`, `note`), covering every `RequirementType`, the `implied_classes` class-gating fix, and the `feat_magic_info`/`class_caster_info` magic-feat gating fix. `tests/test_golden.py` loads and parametrizes over it, evaluating each case's `feat_name` (looked up in the real catalog) against its `character` via the real parser+engine pipeline. To add a new regression case, append an entry with a unique `id`, a real `feat_name` from `Data/Dons.csv`, a minimal `character` dict, the hand-derived `expected_status`, and a `note` explaining what it guards against.
