# Step 13 — Test coverage report

> Reconstructed by the orchestrator from the executing agent's verified
> completion summary. The agent's own report file was written inside its
> worktree but never committed before the orchestrator merged the step and
> later removed the worktree — its full evidence transcript is lost. This
> reconstruction preserves the pass/fail results and evidence reported over
> the task channel, independently re-confirmed by the orchestrator on
> `main` post-merge (see below).

## What was built

7 new test files: `tests/test_race_loader.py`, `tests/test_class_skills.py`,
`tests/test_feat_slots.py`, `tests/test_skill_budget.py`,
`tests/test_character_profile.py`, `tests/test_persistence.py`,
`tests/test_cli.py` — 33 new tests, on top of the 15 pre-existing tests
(48 total). Confirmed via `git show --stat 772dc68` (the step's commit):
only these 7 files added, no existing test file touched.

## Verification Criteria — evidence

- `python -m pytest -q` → `48 passed`, as reported by the agent and
  independently re-run by the orchestrator after merging into
  `integration/character-creation` and again after merging into `main`
  (Step 14) — reproduced both times.
- `git status --porcelain` showed only the 7 new test files as untracked
  before commit; no `Data/characters/*` pollution reported at the time.

### Orchestrator follow-up finding (important)

While running Step 14's final live CLI smoke test on `main`, the
orchestrator discovered that `Data/characters/` on disk actually contained
6 stray files (`Test_CLI.json`, `Test_Assign_CLI.json`,
`Test_Dup_CLI.json`, `Test_Reject_CLI.json`, `Test_Slots.json`,
`Test_Unassign_CLI.json`) — i.e. the `tests/test_cli.py` isolation the
agent verified in its own worktree run did **not** hold once the module was
merged and exercised for real. Root cause: `pf1_dons/persistence.py`'s
`save_profile`/`load_profile`/`list_characters`/`_character_path` all had
`base_dir: Path = DEFAULT_CHARACTERS_DIR` as an eager default-argument
value, evaluated once at function-definition time. Monkeypatching
`pf1_dons.persistence.DEFAULT_CHARACTERS_DIR` in `tests/test_cli.py`'s
`isolate_characters_dir` fixture therefore had no effect on `cli.py`'s
calls (which never pass `base_dir` explicitly) — every `cli.main([...])`
invocation from `test_cli.py` was silently writing into the real
`Data/characters/` the whole time, even though the assertions on stdout
still passed (since they never checked *where* the file landed).

This was **fixed by the orchestrator in Step 14** (commit `88214d8`):
`base_dir` parameters changed to `Optional[Path] = None`, resolved to
`DEFAULT_CHARACTERS_DIR` inside each function body at call time. Re-ran
`python -m pytest -q` after the fix: `48 passed`, and confirmed
`Data/characters/` is empty (`ls Data/characters/` → no output) after a
full suite run — isolation now genuinely holds. The 6 stray files were
deleted (they were gitignored, so `git status` never flagged them, but
they were real repo-tree pollution on disk).

**Revised final verdict for this step's isolation criterion: PASS, but only
after an orchestrator-applied fix in Step 14** — flagging this explicitly
per the "no silently skipped verification" requirement, since the
originally-reported PASS was based on an incomplete check (stdout
assertions only, not actual file-location verification).

## Deviations from the plan (as reported by the agent)

- Magicien actually has bonus feat levels `[5,10,15,20]` (arcane school),
  so the "class X has only general slots" test target was switched from
  Magicien to Ensorceleur, which genuinely has none — matches the same
  discrepancy already found and documented in Steps 07/08's reports.
- The CLI's `slots` command truncates candidate lists to 20
  alphabetically-sorted feats, so a specific named feat isn't guaranteed to
  appear in a slot's printed list — `test_slots_lists_open_slots_with_candidates`
  asserts on the presence of a bullet line and the "... et N autres"
  truncation marker instead of a specific feat name.
- `list_characters` returns filesystem-slugified stems (spaces → `_`), so
  round-trip assertions expect `"Test_CLI"`, not `"Test CLI"`.
