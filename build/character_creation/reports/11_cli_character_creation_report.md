# Step 11 — CLI create/show/list report

> Reconstructed by the orchestrator from the executing agent's verified
> completion summary. The agent's own report file
> (`build/character_creation/reports/11_cli_character_creation_report.md`)
> was written inside its worktree but never `git add`ed/committed before
> the orchestrator merged the step and later removed the worktree — its
> full evidence transcript is lost. This reconstruction preserves the
> pass/fail results and evidence the agent reported back over the task
> channel, which were independently spot-checked (see below).

## What was built

`pf1_dons/cli.py`: `build_parser`, `cmd_create`, `cmd_show`, `cmd_list`,
`_print_summary`, `main`, matching Step 11's pseudo-code against the real
`character_profile.py`/`persistence.py`/`race_loader.py`/`feat_slots.py`/
`class_skills.py`/`skill_budget.py` APIs, with no signature mismatches.
`build_parser()` ends with the `list` subparser last, and `main()`'s
dispatch is a literal dict — both left exactly as needed for Step 12's
append.

## Verification Criteria — evidence (as reported by the agent)

- `python -m pf1_dons.cli create Aldric --class Guerrier --level 1 --race Humain --for 16`
  exited 0, printed a summary with 3 feat slots, created
  `Data/characters/Aldric.json` — PASS.
- `python -m pf1_dons.cli show Aldric` printed the same slot layout — PASS.
- `python -m pf1_dons.cli list` included `Aldric` — PASS.
- `python -m pf1_dons.cli show DoesNotExist` exited 1 with a clear French
  error message (`FileNotFoundError` caught in `cmd_show`) — PASS.
- `python -m pytest -q`: 15/15 passed (no new tests existed yet at this
  step), no regressions.

## Orchestrator's independent re-verification

After merging, the orchestrator ran the full end-to-end CLI flow again
directly (`create`/`slots`/`assign`/`show`/`unassign`/`list`/`show` on a
nonexistent character) as part of Step 14's final smoke test — all of the
above behaviors were reproduced live against the merged `main` branch. See
`build/character_creation/reports/14_claude_md_update_report.md`.

## Deviations from the plan

None reported beyond the ones already documented in Step 11's git history
(commit `ff3b325`, message `pf1_dons(11): add CLI create/show/list
commands`).
