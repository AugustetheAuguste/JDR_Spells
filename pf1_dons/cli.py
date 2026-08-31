"""Command-line interface for character creation and inspection.

Usage: ``python -m pf1_dons.cli <command> ...``

This module currently implements ``create``, ``show`` and ``list``. Step 12
extends it (same file) with ``slots``, ``assign`` and ``unassign``.
"""

import argparse
import json
import sys
from pathlib import Path

from .character_profile import (
    SlotAssignmentError,
    assign_feat,
    create_profile,
    eligible_feats_for_slot,
    unassign_feat,
)
from .class_skills import get_class_skill_info, load_class_skills
from .data_loader import load_catalog
from .feat_slots import load_class_bonus_feats
from .persistence import list_characters, load_profile, save_profile
from .race_loader import load_races
from .skill_budget import total_skill_points

ABILITY_KEYS = ["For", "Dex", "Con", "Int", "Sag", "Cha"]
DEFAULT_ABILITY_SCORE = 10


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pf1_dons")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create")
    p_create.add_argument("name")
    p_create.add_argument("--class", dest="character_class", required=True)
    p_create.add_argument("--level", type=int, required=True)
    p_create.add_argument("--race")
    p_create.add_argument("--alignement", dest="alignment")
    p_create.add_argument("--divinite", dest="deity")
    for ability in ABILITY_KEYS:
        p_create.add_argument(f"--{ability.lower()}", type=int, default=None)

    p_show = sub.add_parser("show")
    p_show.add_argument("name")

    sub.add_parser("list")

    p_slots = sub.add_parser("slots")
    p_slots.add_argument("name")
    p_slots.add_argument("--open-only", action="store_true")
    p_slots.add_argument(
        "--limit",
        type=int,
        default=0,
        help="nombre max de dons listés par emplacement (0 = tous, défaut)",
    )

    p_assign = sub.add_parser("assign")
    p_assign.add_argument("name")
    p_assign.add_argument("slot_id")
    p_assign.add_argument("feat_name")

    p_unassign = sub.add_parser("unassign")
    p_unassign.add_argument("name")
    p_unassign.add_argument("slot_id")

    return parser


def cmd_create(args) -> None:
    # Un personnage Pathfinder possède toujours les six caractéristiques :
    # laisser les non renseignées à None renvoyait en vérification manuelle
    # tous les dons qui les testent (« Dex 13 non fourni »). On les fixe donc
    # explicitement à 10 (valeur moyenne), visible dans la fiche sauvegardée.
    ability_scores = {
        a: (getattr(args, a.lower()) if getattr(args, a.lower()) is not None else DEFAULT_ABILITY_SCORE)
        for a in ABILITY_KEYS
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
        alignment=args.alignment,
        deity=args.deity,
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


def _load_feat_categories(path: str = "Data/feat_categories.json") -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def cmd_slots(args) -> None:
    try:
        profile = load_profile(args.name)
    except FileNotFoundError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        sys.exit(1)
    catalog = load_catalog()
    feat_categories = _load_feat_categories()
    slots = profile.open_slots() if args.open_only else profile.feat_slots
    for slot in slots:
        print(f"{slot.slot_id} (niveau {slot.level_gained}, {slot.source}) -> {slot.filled_by or '(vide)'}")
        if slot.filled_by is not None:
            continue
        candidates = sorted(
            eligible_feats_for_slot(profile, slot, catalog, feat_categories),
            key=lambda f: f.name,
        )
        shown = candidates if args.limit <= 0 else candidates[: args.limit]
        print(f"    ({len(candidates)} dons candidats)")
        for feat in shown:
            print(f"    - {feat.name}")
        if len(shown) < len(candidates):
            print(f"    ... et {len(candidates) - len(shown)} autres (--limit 0 pour tout voir)")


def cmd_assign(args) -> None:
    try:
        profile = load_profile(args.name)
    except FileNotFoundError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        sys.exit(1)
    catalog = load_catalog()
    feat_categories = _load_feat_categories()
    slot = profile.find_slot(args.slot_id)
    if slot is None:
        print(f"Emplacement inconnu : {args.slot_id}")
        sys.exit(1)
    eligible_names = {f.name for f in eligible_feats_for_slot(profile, slot, catalog, feat_categories)}
    if args.feat_name not in eligible_names:
        print(
            f"'{args.feat_name}' n'est pas éligible pour l'emplacement {args.slot_id} "
            f"(vérifiez les prérequis ou la restriction de catégorie)."
        )
        sys.exit(1)
    try:
        assign_feat(profile, args.slot_id, args.feat_name)
    except SlotAssignmentError as exc:
        print(str(exc))
        sys.exit(1)
    save_profile(profile)
    print(f"'{args.feat_name}' attribué à {args.slot_id} pour {profile.name}.")


def cmd_unassign(args) -> None:
    try:
        profile = load_profile(args.name)
    except FileNotFoundError as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        sys.exit(1)
    try:
        unassign_feat(profile, args.slot_id)
    except SlotAssignmentError as exc:
        print(str(exc))
        sys.exit(1)
    save_profile(profile)
    print(f"Emplacement {args.slot_id} libéré pour {profile.name}.")


def main(argv=None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    dispatch = {
        "create": cmd_create,
        "show": cmd_show,
        "list": cmd_list,
        "slots": cmd_slots,
        "assign": cmd_assign,
        "unassign": cmd_unassign,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
