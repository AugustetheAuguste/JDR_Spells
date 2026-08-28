# Step 14 — Update CLAUDE.md

## Objectives

Bring `CLAUDE.md` up to date with the new architecture, data files, and CLI
commands added by this plan, matching its existing tone/structure (no
speculative sections, only what's actually true of the merged code).

## Dependencies & Parallelization

- **Wave 8 (final step).** Depends on every prior step (05-13) being
  merged, since this step documents the real, tested end state.

## Inherited Context

Current `CLAUDE.md` (repo root) has sections: Project overview, Commands,
Architecture (numbered 1-4 covering `data_loader.py`, `parser.py`,
`class_progression.py`, `engine.py`), plus a closing paragraph on
`extract_class_features.py`. This step edits that file in place — read it
fresh at execution time rather than assuming this plan's description of it
stays byte-accurate after Steps 01-13 land.

## Pseudo-code

Edit `CLAUDE.md`:
```
1. Commands section: add
   - `python -m pf1_dons.cli create <name> --class <c> --level <n> [--race <r>] [--for N --dex N ...]`
   - `python -m pf1_dons.cli show <name>`
   - `python -m pf1_dons.cli list`
   - `python -m pf1_dons.cli slots <name> [--open-only]`
   - `python -m pf1_dons.cli assign <name> <slot_id> "<feat name>"`
   - `python -m pf1_dons.cli unassign <name> <slot_id>`
   - Re-scrape commands: `python scrape_races.py`, `python scrape_class_skills.py`,
     `python extract_class_bonus_feats.py`, `python tag_feat_categories.py`
     (each idempotent, safe to re-run; note extract_class_bonus_feats.py
     requires Data/class_features.json to already exist)

2. Architecture section: add new numbered items (renumber existing 1-4 as
   needed, or append as 5+ if the existing numbering scheme is preserved —
   match whatever the actual file does by the time this step runs) covering:
   - pf1_dons/race_loader.py + Data/races.json (RaceInfo)
   - pf1_dons/class_skills.py + Data/class_skills.json (ClassSkillInfo)
   - pf1_dons/feat_slots.py + Data/class_bonus_feats.json (FeatSlot, compute_feat_slots)
   - pf1_dons/skill_budget.py (skill point budget, class skill +3 bonus — separate from engine.Character's optimistic placeholder)
   - pf1_dons/character_profile.py (CharacterProfile, bridges to engine.Character via to_character())
   - pf1_dons/persistence.py + Data/characters/*.json
   - pf1_dons/cli.py (all six commands)
   - Data/feat_categories.json (best-effort category tags, needs_manual_check convention)
   - Note the four new standalone scraper/extractor scripts alongside extract_class_features.py

3. Add one paragraph clarifying the relationship between the new
   skill_budget.py calculation and engine.py::Character.skill_rank's
   existing "optimistic" placeholder — they coexist; the CLI-driven
   creation flow uses the former, engine.py's eligibility checks still use
   the latter unless skill_ranks is explicitly populated on the Character.

4. Add one line noting the known limitation: repeatable/multi-take feats
   (Data/Dons.csv names ending in "*") cannot currently be assigned to more
   than one slot via the CLI.
```

## Logic Flow

1. Read the current `CLAUDE.md` in full.
2. Verify every new file/module path referenced actually exists at the path
   named (do not describe anything speculative) — cross-check against the
   real repo tree after Steps 01-13.
3. Insert new Commands entries near the existing `extract_class_features.py`
   command example, and new Architecture entries after the existing
   4-item list, preserving the existing writing style (concise, references
   real file:function names, no marketing language).
4. Verify no new section duplicates information already covered by an
   existing CLAUDE.md paragraph.

## Implementation Notes

- Do not restate anything already generic/obvious (per this project's own
  CLAUDE.md-writing constraints) — e.g. don't add a "Testing" section that
  just says "run pytest," since the Commands section already covers that.
- Keep the same French-domain/English-prose mix the existing file uses
  (identifiers and CLI examples in French/domain terms, explanatory prose
  in English).

## Verification Criteria

- Every file path and command mentioned in the updated `CLAUDE.md` exists
  and runs/imports successfully at the time of this step (spot-check by
  actually running each new CLI command example and each scraper's
  `--help`/invocation once).
- `git diff CLAUDE.md` shows only additions/reorganizations consistent with
  this step's scope — no unrelated edits.

## Git Handling

- Branch: `feature/character-creation/14-claude-md`.
- Commit updated `CLAUDE.md`.
- Commit message: `pf1_dons(14): document character creation architecture in CLAUDE.md`.
- After this step's branch merges into `feature/character-creation`, merge
  `feature/character-creation` into the base branch (final integration
  merge for the whole plan) — run the full test suite once more on the
  base branch post-merge before considering the plan complete.

## Expected Outcome

`CLAUDE.md` accurately reflects the shipped character-creation feature,
ready for the next Claude Code session to be immediately productive with
it.
