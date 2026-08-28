# Step 12 — CLI: view slots and assign/unassign feats (`pf1_dons/cli.py`, part 2)

## Objectives

Extend `pf1_dons/cli.py` (created in Step 11) with three more commands:
`slots` (list a character's open slots and, per slot, the feats currently
eligible for it), `assign` (assign a chosen feat into a specific slot and
persist), and `unassign` (clear a slot and persist).

## Dependencies & Parallelization

- **Wave 6**, but sequenced after Step 11 merges (both edit
  `pf1_dons/cli.py` — see Step 11's Git Handling note; branch this step
  from the integration branch only once Step 11 is merged into it, even
  though no *data* dependency prevents starting the design work earlier).
- Depends on Step 09 (`pf1_dons.character_profile.eligible_feats_for_slot`,
  `assign_feat`, `unassign_feat`), Step 10 (`persistence`), and Step 04
  (`Data/feat_categories.json`).

## Inherited Context from Step 09, Step 10, Step 04

```python
from pf1_dons.character_profile import eligible_feats_for_slot, assign_feat, unassign_feat, SlotAssignmentError
from pf1_dons.persistence import load_profile, save_profile
from pf1_dons.data_loader import load_catalog

catalog = load_catalog()                      # list[FeatRow]
feat_categories = json.loads(Path("Data/feat_categories.json").read_text(encoding="utf-8"))
# {feat_name: {"categories": [...], "needs_manual_check": bool}}

eligible_feats_for_slot(profile, slot, catalog, feat_categories) -> list[FeatRow]
assign_feat(profile, slot_id, feat_name) -> None       # raises SlotAssignmentError
unassign_feat(profile, slot_id) -> None                # raises SlotAssignmentError
```
`pf1_dons/cli.py`'s existing `build_parser()` (Step 11) ends with
`p_list = sub.add_parser("list")` as the last registered subparser and a
dispatch dict `{"create": cmd_create, "show": cmd_show, "list": cmd_list}`
inside `main()` — this step appends to both without altering Step 11's
existing lines.

## Pseudo-code

Additions to `pf1_dons/cli.py`:
```python
def build_parser() -> argparse.ArgumentParser:
    # ... existing p_create/p_show/p_list unchanged ...

    p_slots = sub.add_parser("slots")
    p_slots.add_argument("name")
    p_slots.add_argument("--open-only", action="store_true")

    p_assign = sub.add_parser("assign")
    p_assign.add_argument("name")
    p_assign.add_argument("slot_id")
    p_assign.add_argument("feat_name")

    p_unassign = sub.add_parser("unassign")
    p_unassign.add_argument("name")
    p_unassign.add_argument("slot_id")

    return parser

def _load_feat_categories(path="Data/feat_categories.json") -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))

def cmd_slots(args) -> None:
    profile = load_profile(args.name)
    catalog = load_catalog()
    feat_categories = _load_feat_categories()
    slots = profile.open_slots() if args.open_only else profile.feat_slots
    for slot in slots:
        print(f"{slot.slot_id} (niveau {slot.level_gained}, {slot.source}) -> {slot.filled_by or '(vide)'}")
        if slot.filled_by is not None:
            continue
        candidates = eligible_feats_for_slot(profile, slot, catalog, feat_categories)
        for feat in sorted(candidates, key=lambda f: f.name)[:20]:  # cap noisy output
            print(f"    - {feat.name}")
        if len(candidates) > 20:
            print(f"    ... et {len(candidates) - 20} autres")

def cmd_assign(args) -> None:
    profile = load_profile(args.name)
    catalog = load_catalog()
    feat_categories = _load_feat_categories()
    slot = profile.find_slot(args.slot_id)
    if slot is None:
        print(f"Emplacement inconnu : {args.slot_id}")
        sys.exit(1)
    eligible_names = {f.name for f in eligible_feats_for_slot(profile, slot, catalog, feat_categories)}
    if args.feat_name not in eligible_names:
        print(f"'{args.feat_name}' n'est pas éligible pour l'emplacement {args.slot_id} "
              f"(vérifiez les prérequis ou la restriction de catégorie).")
        sys.exit(1)
    try:
        assign_feat(profile, args.slot_id, args.feat_name)
    except SlotAssignmentError as exc:
        print(str(exc)); sys.exit(1)
    save_profile(profile)
    print(f"'{args.feat_name}' attribué à {args.slot_id} pour {profile.name}.")

def cmd_unassign(args) -> None:
    profile = load_profile(args.name)
    try:
        unassign_feat(profile, args.slot_id)
    except SlotAssignmentError as exc:
        print(str(exc)); sys.exit(1)
    save_profile(profile)
    print(f"Emplacement {args.slot_id} libéré pour {profile.name}.")

def main(argv=None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    dispatch = {
        "create": cmd_create, "show": cmd_show, "list": cmd_list,
        "slots": cmd_slots, "assign": cmd_assign, "unassign": cmd_unassign,
    }
    dispatch[args.command](args)
```

## Logic Flow

1. `slots`: load the character, recompute eligibility fresh against the
   current catalog + current `known_feats` (derived from already-filled
   slots via `to_character()` inside `eligible_feats_for_slot`) every time
   — never trust a stale eligibility snapshot, since assigning one feat can
   change what's eligible for another open slot (prerequisite chains).
2. `assign`: re-derive the eligible set for the target slot at assignment
   time (not just trusting whatever `slots` printed earlier, in case
   something changed), reject with a clear message if the requested feat
   isn't in that set, otherwise delegate to `character_profile.assign_feat`
   for the slot-bookkeeping invariants, then persist.
3. `unassign`: delegate to `character_profile.unassign_feat`, persist.
4. Both mutating commands re-save the full profile after every change —
   this plan does not attempt partial/patch updates to the JSON file.

## Implementation Notes

- `manual_check` feats ARE included in `eligible_feats_for_slot`'s output
  (per Step 09) and therefore assignable via `assign` — the CLI does not
  block on `manual_check`, it's the user's judgment call, consistent with
  this codebase treating `manual_check` as "needs a human," not "blocked."
- Cap the `slots` command's per-slot candidate listing at 20 to keep output
  readable for early general-purpose feats with huge eligible pools) —
  purely a display choice, does not affect `assign`'s validation, which
  checks membership in the full uncapped set.
- Repeatable/multiple-instance feats (marked with a trailing `*` in
  `Data/Dons.csv`, per `pf1_dons/data_loader.py::clean_feat_name`) are
  still blocked from being assigned twice by `character_profile.assign_feat`'s
  duplicate check (Step 09) — this is a known, explicitly out-of-scope
  limitation; do not attempt to fix it in this step.

## Verification Criteria

- `python -m pf1_dons.cli slots Aldric` (character from Step 11's
  verification) lists 3 slots with candidate feats under each open one,
  including `Arme en main` under at least one general slot.
- `python -m pf1_dons.cli assign Aldric general-1 "Arme en main"` exits 0,
  and a subsequent `show`/`slots` reflects `general-1 -> Arme en main`.
- Re-running the same `assign` command against an already-filled slot
  fails with a non-zero exit and a clear message (no silent overwrite).
- `python -m pf1_dons.cli assign Aldric general-3 "Arme en main"` (same feat,
  different open slot) fails with the duplicate-feat error from Step 09.
- `python -m pf1_dons.cli unassign Aldric general-1` then `show` reflects
  `general-1` as open again, and the previously-blocked duplicate-feat
  assignment to `general-3` now succeeds.
- A feat requiring a category-restricted class slot rejects assignment to
  an unrestricted general slot only if it is not otherwise eligible
  there — category restriction only narrows the class-bonus slot's
  candidate pool, it doesn't add a *requirement* to general slots
  (confirm this reflects `eligible_feats_for_slot`'s actual logic — the
  restriction is checked only when `slot.category_restriction is not
  None`, which general slots never have).

## Git Handling

- Branch: `feature/character-creation/12-cli-assign` (created from
  `feature/character-creation` AFTER Step 11 is merged into it).
- Commit the additions to `pf1_dons/cli.py` (append-only diff, no edits to
  Step 11's existing functions).
- Commit message: `pf1_dons(12): add CLI slots/assign/unassign commands`.

## Expected Outcome

A complete CLI covering the full character-creation-to-feat-assignment
loop: create → view slots → assign → re-check → done.
