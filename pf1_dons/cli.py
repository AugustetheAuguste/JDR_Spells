"""Command-line interface for character creation and inspection.

Usage: ``python -m pf1_dons.cli <command> ...``

This module currently implements ``create``, ``show`` and ``list``. Step 12
extends it (same file) with ``slots``, ``assign`` and ``unassign``.
"""

import argparse
import sys

from .character_profile import create_profile
from .class_skills import get_class_skill_info, load_class_skills
from .feat_slots import load_class_bonus_feats
from .persistence import list_characters, load_profile, save_profile
from .race_loader import load_races
from .skill_budget import total_skill_points

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

    sub.add_parser("list")
    # (Step 12 adds "slots", "assign", "unassign" parsers here in the same function)

    return parser


def cmd_create(args) -> None:
    ability_scores = {
        a: getattr(args, a.lower())
        for a in ABILITY_KEYS
        if getattr(args, a.lower()) is not None
    }
    races = load_races()
    class_bonus_feats = load_class_bonus_feats()
    profile = create_profile(
        args.name,
        args.character_class,
        args.level,
        args.race,
        ability_scores,
        races,
        class_bonus_feats,
    )
    path = save_profile(profile)
    print(f"Personnage '{profile.name}' créé -> {path}")
    _print_summary(profile)


def cmd_show(args) -> None:
    try:
        profile = load_profile(args.name)
    except FileNotFoundError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        sys.exit(1)
    _print_summary(profile)


def cmd_list(args) -> None:
    names = list_characters()
    if not names:
        print("Aucun personnage enregistré.")
        return
    for n in names:
        print(n)


def _print_summary(profile) -> None:
    print(
        f"{profile.name} — {profile.character_class} niveau {profile.level}"
        + (f", {profile.race}" if profile.race else "")
    )
    print(f"Caractéristiques : {profile.ability_scores or '(non renseignées)'}")
    class_skill_infos = load_class_skills()
    info = get_class_skill_info(class_skill_infos, profile.character_class)
    budget = total_skill_points(
        info, profile.ability_scores, profile.level, bonus_skill_rank_per_level=False
    )
    print(
        "Points de compétence estimés : "
        + (str(budget) if budget is not None else "indisponible (données manquantes)")
    )
    print("Emplacements de don :")
    for slot in profile.feat_slots:
        state = slot.filled_by or "(vide)"
        restriction = (
            f" [restreint: {slot.category_restriction}]"
            if slot.category_restriction
            else ""
        )
        print(f"  {slot.slot_id} (niveau {slot.level_gained}, {slot.source}){restriction} -> {state}")


def main(argv=None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    {"create": cmd_create, "show": cmd_show, "list": cmd_list}[args.command](args)
    # Step 12 adds "slots"/"assign"/"unassign" entries to this dispatch dict


if __name__ == "__main__":
    main()
