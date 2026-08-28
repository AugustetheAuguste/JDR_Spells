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

## Architecture

The pipeline is: **CSV → parse conditions into structured requirements → evaluate against a Character → grouped eligibility results.**

1. **`data_loader.py`** — loads `Data/Dons.csv` (columns: `Dons` name, `Src` source, `Conditions`, `Avantages`) into `FeatRow` objects. Rows where `Conditions` or `Avantages` is `#ERROR!` are filtered out via `filter_valid_rows`, but the *full* set of feat names (including filtered rows) is still passed to the parser as `all_feat_names`, so that feat-name prerequisites referencing an excluded feat still resolve correctly.

2. **`parser.py`** — turns the free-text `Conditions` string into a `ParsedConditions` (from `models.py`): a list of `Requirement` or `OrGroup` objects.
   - Top-level requirements are comma-separated (`_split_top_level`, careful not to split inside parentheses).
   - Within a segment, `" ou "` (French "or") splits into an `OrGroup` of alternative `Requirement`s.
   - `_classify_segment` tries a sequence of regexes/lookups in order (level, BBA, NLS/caster level, size, skill ranks, ability score, known feat name, known race, known class, class-feature-text keywords) and falls back to `RequirementType.UNPARSED` if nothing matches — unparsed/class-feature-text requirements are flagged `needs_manual_check=True` and must never be silently dropped.
   - Feat-name and class-name matching goes through `_normalize` (NFKD strip of accents + lowercase) so French diacritics don't cause misses.

3. **`class_progression.py`** — static table `CLASS_BBA_PROGRESSION` mapping normalized French class names to BBA progression (`good`/`medium`/`poor`), used to compute a character's base attack bonus (BBA) at a given level (`get_bba`). This is also the source of truth for `KNOWN_CLASSES` in `parser.py`.

4. **`engine.py`** — defines `Character` and evaluates a `FeatRow`'s parsed requirements against it:
   - `evaluate_requirement` returns a tri-state result: `True` (met), `False` (not met), or `None` (cannot be determined — missing data, e.g. no ability scores provided, or an inherently non-automatable requirement like caster level or class-feature text).
   - `OrGroup`s are satisfied if any option is `True`; if none is `True` but at least one is `None`, the group is `None` (needs manual check); otherwise `False`.
   - `evaluate_feat` short-circuits to `"ineligible"` on the first `False` requirement; otherwise accumulates `None` reasons and returns `"manual_check"` if any exist, else `"eligible"`.
   - `filter_feats` runs this over a whole catalog and groups+sorts results by status (`eligible` / `manual_check` / `ineligible`).

When adding a new `RequirementType`, you generally need to touch all three of `models.py` (enum + payload shape), `parser.py` (`_classify_segment` recognition), and `engine.py` (`evaluate_requirement` handling) together.

`extract_class_features.py` is a standalone offline scraper (not imported by the package) that produces `Data/class_features.json`; it caches downloaded HTML in `classes_html/` and skips re-downloading unless run with `force=True`.
