# Step 14 — CLAUDE.md update & final integration report

## What was built

- `CLAUDE.md` updated in place: new Commands entries (character creation
  CLI's six subcommands, plus the four re-scrape commands), and a new
  "### Character creation" architecture subsection (items 5-11) documenting
  `race_loader.py`, `class_skills.py`, `feat_slots.py`, `skill_budget.py`,
  `character_profile.py`, `persistence.py`, `cli.py`, and
  `Data/feat_categories.json`/the four scraper scripts — including an
  explicit note on how `skill_budget.py` coexists with, and does not
  modify, `engine.py::Character.skill_rank`'s existing placeholder, and a
  note on the repeatable/multi-take-feat limitation.
- **Bugfix in `pf1_dons/persistence.py`** (found during this step's live
  verification, not part of the plan's original scope but necessary for
  correctness — see Step 13's report for full root-cause detail):
  `base_dir` parameters on `save_profile`/`load_profile`/`list_characters`/
  `_character_path` changed from eager `Path = DEFAULT_CHARACTERS_DIR`
  defaults to `Optional[Path] = None`, resolved at call time. This makes
  `monkeypatch.setattr(persistence, "DEFAULT_CHARACTERS_DIR", tmp_path)`
  (used by `tests/test_cli.py`) actually take effect for `cli.py`'s calls,
  which never pass `base_dir` explicitly. Before this fix, every CLI test
  run silently wrote real files into `Data/characters/`.
- Cleaned up 6 stray `Data/characters/*.json` files left by the
  pre-fix test isolation bug.
- Added `.claude/` to `.gitignore` (harness worktree/task bookkeeping, not
  project content).
- Final integration merge: `integration/character-creation` → `main`
  (commit `994dfc9`), covering Steps 01-14.
- Removed the 12 now-fully-merged agent worktrees and their disposable
  `worktree-agent-*` branches; kept the named `integration/character-creation--NN-*`
  step branches on the remote-equivalent local repo as an audit trail (all
  reachable from `main`, safe to prune later if desired).

## Verification Criteria — evidence

- Every file/module path mentioned in the new CLAUDE.md text was confirmed
  to exist via a literal `[ -f "$f" ]` check on `main` post-merge for all
  15 paths (`pf1_dons/race_loader.py`, `class_skills.py`, `feat_slots.py`,
  `skill_budget.py`, `character_profile.py`, `persistence.py`, `cli.py`,
  `scrape_races.py`, `scrape_class_skills.py`, `extract_class_bonus_feats.py`,
  `tag_feat_categories.py`, `Data/races.json`, `Data/class_skills.json`,
  `Data/class_bonus_feats.json`, `Data/feat_categories.json`) — all `OK`.
- Ran every documented CLI command live on `main` post-merge:
  `create` (level 3 Guerrier/Humain, two ability scores), `slots
  --open-only`, `assign` (success), `assign` duplicate-feat-across-slots
  (exit 1, correct French error), `assign` to an already-filled slot with
  an ineligible feat (exit 1, correct French error), `show`, `unassign`,
  `list`, and `show` on a nonexistent character (exit 1, `FileNotFoundError`
  message includes the attempted path) — all matched documented behavior.
- Ran all four re-scrape scripts (`scrape_races.py`, `scrape_class_skills.py`,
  `extract_class_bonus_feats.py`, `tag_feat_categories.py`) — all ran to
  completion with their expected summary output (53/41/41/1417 items
  respectively), confirming idempotent re-run safety.
- `git diff CLAUDE.md` (commit `88214d8`) shows only additive/inserted
  content — no unrelated edits, no rewrite of existing prose.
- Final full-suite run on `main` post-merge: `python -m pytest -q` →
  `48 passed`. `git status --short` clean (only the pre-existing untracked
  `.claude/` harness dir, now gitignored).

All Verification Criteria: **PASS**.

## Deviations from the plan

- Executed this step directly (no delegated subagent) since it's the final
  integration step and required hands-on control over the `main` merge.
- Added an out-of-plan-scope bugfix (the `persistence.py` default-argument
  timing bug) because it was a real, silently-passing test-isolation defect
  discovered during this step's own verification pass — leaving it in
  place would mean every future `pytest` run keeps polluting the real
  `Data/characters/` directory, which directly contradicts Step 10 and
  13's own stated isolation requirements. Documented in both this report
  and Step 13's (reconstructed) report.
- Steps 01, 11, and 13's report files were not present in the repo when
  this step began (the executing agents for 11 and 13 wrote them to their
  worktrees but never committed them, and those worktrees were removed
  once merged; Step 01 was executed by the orchestrator directly, before
  the per-step-report convention was established for this plan). All three
  were reconstructed from verified task-completion evidence and committed
  as part of this step — see
  `build/character_creation/reports/{01,11,13}_*_report.md`.

## Final state

- `main` branch, commit `994dfc9` (merge) + `88214d8` (CLAUDE.md/persistence
  fix) + `238f8c7` (.gitignore).
- 48/48 tests passing.
- Full CLI (`create`/`show`/`list`/`slots`/`assign`/`unassign`) verified
  live end-to-end, including error paths.
- Working tree clean.
