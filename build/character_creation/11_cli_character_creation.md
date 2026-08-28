# Step 11 — CLI: create/show/list characters (`pf1_dons/cli.py`, part 1)

## Objectives

Add a CLI entry point (`python -m pf1_dons.cli ...`) with three commands:
`create` (build and persist a new character from class/level/race/ability
scores), `show` (print a saved character's stats and feat slots), and
`list` (list saved character names). This step establishes `cli.py` and its
argument-parsing skeleton; Step 12 adds the `slots`/`assign`/`unassign`
commands into the same file.

## Dependencies & Parallelization

- **Wave 6.** Depends on Step 09 (`pf1_dons.character_profile`) and Step 10
  (`pf1_dons.persistence`). Independent of Step 12's specific commands, but
  both steps edit the same new file `pf1_dons/cli.py` — see Git Handling
  below for how this is reconciled.

## Inherited Context from Step 09 and Step 10

```python
from pf1_dons.character_profile import create_profile
from pf1_dons.persistence import save_profile, load_profile, list_characters
from pf1_dons.race_loader import load_races
from pf1_dons.feat_slots import load_class_bonus_feats
from pf1_dons.skill_budget import total_skill_points
from pf1_dons.class_skills import load_class_skills, get_class_skill_info

create_profile(name, character_class, level, race, ability_scores, races, class_bonus_feats) -> CharacterProfile
save_profile(profile) -> Path
load_profile(name) -> CharacterProfile
list_characters() -> list[str]
```

## Pseudo-code

New file `pf1_dons/cli.py`:
```python
ABILITY_KEYS = ["For", "Dex", "Con", "Int", "Sag", "Cha"]

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pf1_dons")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create")
    p_create.add_argument("name")
    p_create.add_argument("--class", dest="character_class", required=True)
    p_create.add_argument("--level", type=int, required=True)
    p_create.add_argument("--race")
    for ability in ABILITY_KEYS:
        p_create.add_argument(f"--{ability.lower()}", type=int, default=None)

    p_show = sub.add_parser("show")
    p_show.add_argument("name")

    p_list = sub.add_parser("list")
    # (Step 12 adds "slots", "assign", "unassign" parsers here in the same function)

    return parser

def cmd_create(args) -> None:
    ability_scores = {a: getattr(args, a.lower()) for a in ABILITY_KEYS if getattr(args, a.lower()) is not None}
    races = load_races()
    class_bonus_feats = load_class_bonus_feats()
    profile = create_profile(args.name, args.character_class, args.level, args.race, ability_scores, races, class_bonus_feats)
    path = save_profile(profile)
    print(f"Personnage '{profile.name}' créé -> {path}")
    _print_summary(profile)

def cmd_show(args) -> None:
    profile = load_profile(args.name)
    _print_summary(profile)

def cmd_list(args) -> None:
    names = list_characters()
    if not names:
        print("Aucun personnage enregistré.")
    for n in names:
        print(n)

def _print_summary(profile) -> None:
    print(f"{profile.name} — {profile.character_class} niveau {profile.level}"
          + (f", {profile.race}" if profile.race else ""))
    print(f"Caractéristiques : {profile.ability_scores or '(non renseignées)'}")
    class_skill_infos = load_class_skills()
    info = get_class_skill_info(class_skill_infos, profile.character_class)
    budget = total_skill_points(info, profile.ability_scores, profile.level, bonus_skill_rank_per_level=False)
    print(f"Points de compétence estimés : {budget if budget is not None else 'indisponible (données manquantes)'}")
    print("Emplacements de don :")
    for slot in profile.feat_slots:
        state = slot.filled_by or "(vide)"
        restriction = f" [restreint: {slot.category_restriction}]" if slot.category_restriction else ""
        print(f"  {slot.slot_id} (niveau {slot.level_gained}, {slot.source}){restriction} -> {state}")

def main(argv=None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    {"create": cmd_create, "show": cmd_show, "list": cmd_list}[args.command](args)
    # Step 12 adds "slots"/"assign"/"unassign" entries to this dispatch dict

if __name__ == "__main__":
    main()
```

## Logic Flow

1. `create`: parse class/level/race/ability-score flags, build a
   `CharacterProfile` (which internally computes feat slots via Step 07/09),
   persist it, print a human-readable summary.
2. `show`: load a previously saved character by name and print the same
   summary format as `create` (shared `_print_summary` helper — Step 12
   reuses it unchanged after adding slot-listing commands).
3. `list`: print all saved character names, or a friendly message if none
   exist yet.
4. `_print_summary` intentionally surfaces the "budget unavailable" case
   explicitly in French (matching the rest of the codebase's language)
   rather than printing a wrong number or crashing when a class's skill
   formula wasn't scraped cleanly.
5. `bonus_skill_rank_per_level=False` is hardcoded here deliberately for
   this step's minimal summary view — computing it correctly requires
   `RaceInfo.bonus_skill_rank` from Step 05's race loader, which the CLI
   already has access to via `races[...]`; Step 12 (which touches this same
   summary/slots view more deeply while adding assignment) should wire this
   through properly using `get_race(races, profile.race).bonus_skill_rank`
   if `profile.race` is set. Leaving it `False` here is an explicit
   temporary simplification, not an oversight — flag it in this step's PR
   description.

## Implementation Notes

- Ability score flags are optional (`default=None`) — a character can be
  created with partial or no ability scores, consistent with
  `engine.Character.ability_scores` already being `Optional`.
- Do not validate `--class`/`--race` against `KNOWN_CLASSES`/`KNOWN_RACES`
  at the CLI layer beyond what `create_profile`/`compute_feat_slots`
  already tolerate (they degrade gracefully to zero bonus slots for unknown
  values, per Step 07) — surfacing a warning (not a hard error) when the
  class/race string doesn't match any known key is a nice-to-have, not
  required for this step's verification.
- `pyproject.toml`/`setup.py` console-script wiring is out of scope; the
  documented invocation is `python -m pf1_dons.cli <command> ...`, which
  requires `pf1_dons/cli.py` to be runnable as a module — no `__main__.py`
  needed since `python -m pf1_dons.cli` targets the module directly, not
  the package.

## Verification Criteria

- `python -m pf1_dons.cli create Aldric --class Guerrier --level 1 --race Humain --for 16`
  exits 0, prints a summary including 3 feat slots, and creates
  `Data/characters/Aldric.json`.
- `python -m pf1_dons.cli show Aldric` prints the same slot layout.
- `python -m pf1_dons.cli list` includes `Aldric`.
- `python -m pf1_dons.cli show DoesNotExist` exits with a non-zero status
  and a clear error message (let the `FileNotFoundError` from
  `load_profile` propagate as an uncaught exception with a readable
  message, or catch it in `cmd_show` and `sys.exit(1)` with the message —
  either is acceptable as long as it's not a silent success).

## Git Handling

- Branch: `feature/character-creation/11-cli-create`.
- Commit new `pf1_dons/cli.py` (the `create`/`show`/`list` commands and
  `_print_summary` only — leave the `sub.add_parser("list")` line as the
  last subparser registered, so Step 12 can append its three subparsers
  and dispatch entries as a clean diff without reordering existing code).
- Commit message: `pf1_dons(11): add CLI create/show/list commands`.
- Because Step 12 also edits `pf1_dons/cli.py`, merge this step's branch
  into `feature/character-creation` BEFORE Step 12's branch is created (not
  just before it merges) — Step 12 must branch from the post-merge state
  of `feature/character-creation` that includes this step's `cli.py`, even
  though both are nominally "Wave 6." In practice: run Step 11 to
  completion and merge, then start Step 12 from the updated integration
  branch. Note this breaks strict parallel-worktree execution for this pair
  only; call it out when launching Wave 6 rather than launching both
  simultaneously in separate worktrees.

## Expected Outcome

A working `create`/`show`/`list` CLI surface for character persistence,
ready for Step 12 to extend with feat slot assignment commands.
