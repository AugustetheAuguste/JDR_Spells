---
name: verify-dons-python
description: Build/launch/drive recipe for verifying pf_dons (feats/Dons) changes at a real runtime surface — a Python CLI, no build step, driven from the JDR_Spells repo root. Use when verifying a change to the feats CLI actually works, not just in tests.
---

# Verifying pf_dons

This is a Python CLI tool, no build step. Surface is the terminal, driven
via `python -m pf_dons.cli <command> ...` from the JDR_Spells repo root
(this module is the fusion-dons import of the former standalone `Dons` repo's
`pf1_dons` package — the import path is `pf_dons`, not `pf1_dons`).

This Skill is scoped to the CLI runtime surface only. For the eligibility
engine's five gating layers and their pitfalls, load `pf-dons-conventions`
instead — this file doesn't repeat any of that.

## Setup

```
pip install -r requirements.txt
```

No server/daemon to start. Each CLI invocation is a fresh process.

## Drive it

```
python -m pf_dons.cli create <name> --class <classe> --level <n> [--race <race>] [--for N --dex N --con N --int N --sag N --cha N]
python -m pf_dons.cli show <name>
python -m pf_dons.cli list
python -m pf_dons.cli slots <name> [--open-only]
python -m pf_dons.cli assign <name> <slot_id> "<nom du don>"
python -m pf_dons.cli unassign <name> <slot_id>
```

Full lifecycle to exercise in one pass: `create` → `slots --open-only` →
`assign` (valid) → `assign` same feat to a different open slot (expect
`don déjà attribué à un autre emplacement`, exit 1) → `assign` a different
feat to the now-filled slot (expect `slot déjà occupé`, exit 1) → `show` →
`unassign` → re-`assign` the previously-blocked feat (now succeeds) →
`list` → `show <nonexistent>` (expect `FileNotFoundError`-style message
with the attempted path, exit 1).

## Gotchas

- **Windows console output is cp1252, not UTF-8** — French accented
  characters (é, è, à, ç) print fine in a real Windows terminal, but if
  you're driving this through a tool that captures/relays stdout through a
  different encoding layer (e.g. an agent's bash tool over git-bash), the
  captured text will show as mojibake (`cr??` instead of `créé`) even
  though the actual `print()` call succeeded (exit 0). Don't mistake that
  display artifact for a crash — check the exit code, not just the glyphs.
- **Passing accented feat names as CLI args through git-bash on Windows can
  genuinely mangle the bytes** before Python ever sees them (observed:
  `é` → U+FFFD replacement character → `UnicodeEncodeError` when the app
  tries to print it back in an error message). This is a shell/tool
  encoding issue, not an app bug — confirmed by writing the same string to
  a `.py` file (proper UTF-8 source) and calling `cli.main([...])` directly,
  which works correctly. If you need to test a feat name with accents from
  an agent shell, write a throwaway script with the string as a literal
  rather than passing it as a shell argument.
- Saved character JSON is gitignored — test/manual-verification artifacts
  there don't show up in `git status`, but clean them up anyway to avoid
  confusing a later session that lists real saved characters.
- Level-1 characters only get 3 slots (`general-1`, `racial-1` if the race
  grants a bonus feat, `class-1` if the class grants one at level 1) — use
  level 3+ if you want to see the odd-level general-slot progression
  (`general-1`, `general-3`) and multiple class-bonus-feat levels in one
  character.
- **Module path is `pf_dons`, not `pf1_dons`.** The former standalone `Dons`
  repo used `pf1_dons`; the fusion rename to `pf_dons` (step 04 of the fusion
  plan) is what this Skill assumes throughout — if a command with
  `pf1_dons` is still in muscle memory from the old repo, it will fail with
  `ModuleNotFoundError` here.
