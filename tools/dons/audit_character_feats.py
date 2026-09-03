"""Audit complet et non tronqué de l'éligibilité aux dons d'un personnage.

Sortie : un rapport texte listant, pour CHAQUE don du catalogue (aucune
troncature, aucun "... et N autres"), le statut rendu par le moteur, le
détail requirement par requirement (type, verdict, raison), les Conditions
brutes du CSV et, quand elle existe, la version enrichie de la page du don
(``Data/dons/feat_details.json`` -> ``conditions_detail``).

Usage :
    python scripts/audit_character_feats.py <nom_du_personnage> [-o rapport.txt]
    python scripts/audit_character_feats.py --classe Guerrier --niveau 3 --race Humain

Le rapport est conçu pour la relecture don par don : c'est lui qui sert de
base à l'ajout de nouvelles règles de gating dans ``engine.py``.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths
from pf_dons.data_loader import load_catalog
from pf_dons.engine import (
    Character,
    evaluate_feat,
    evaluate_or_group,
    evaluate_requirement,
)
from pf_dons.models import OrGroup
from pf_dons.persistence import load_profile

STATUS_ORDER = ["eligible", "manual_check", "ineligible"]


def _load_feat_details() -> dict:
    path = Path(paths.FEAT_DETAILS)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _requirement_lines(feat, character) -> list[str]:
    lines = []
    for req in feat.parsed.requirements:
        if isinstance(req, OrGroup):
            ok, reason = evaluate_or_group(req, character)
            types = "/".join(opt.type.value for opt in req.options)
            lines.append(f"      [OU {types}] {_verdict(ok)} | {req.raw_text!r} -> {reason}")
            for opt in req.options:
                sub_ok, sub_reason = evaluate_requirement(opt, character)
                lines.append(
                    f"          - [{opt.type.value}] {_verdict(sub_ok)} | "
                    f"{opt.raw_text!r} -> {sub_reason}"
                )
        else:
            ok, reason = evaluate_requirement(req, character)
            lines.append(f"      [{req.type.value}] {_verdict(ok)} | {req.raw_text!r} -> {reason}")
    if not lines:
        lines.append("      (aucune condition)")
    return lines


def _verdict(ok) -> str:
    return {True: "OK   ", False: "ECHEC", None: "?    "}[ok]


def build_report(character: Character, label: str, catalog: list) -> str:
    details = _load_feat_details()
    results = {status: [] for status in STATUS_ORDER}
    for feat in catalog:
        results[evaluate_feat(feat, character).status].append(feat)

    out = []
    out.append("=" * 78)
    out.append(f"AUDIT D'ELIGIBILITE AUX DONS — {label}")
    out.append("=" * 78)
    out.append(f"Classe : {character.character_class} | niveau {character.level} "
               f"| race {character.race or '(non fournie)'} | BBA {character.bba}")
    out.append(f"Caractéristiques : {character.ability_scores or '(non fournies)'}")
    out.append(f"Rangs de compétence : {character.skill_ranks or '(non fournis)'}")
    out.append(f"Dons déjà pris : {sorted(character.known_feats or []) or '(aucun)'}")
    out.append("")
    out.append(f"Catalogue : {len(catalog)} dons")
    for status in STATUS_ORDER:
        out.append(f"  {status:<13}: {len(results[status])}")
    out.append("")

    for status in STATUS_ORDER:
        out.append("")
        out.append("#" * 78)
        out.append(f"# {status.upper()} — {len(results[status])} dons (liste complète)")
        out.append("#" * 78)
        for feat in sorted(results[status], key=lambda f: f.name):
            result = evaluate_feat(feat, character)
            out.append("")
            out.append(f"--- {feat.name} [{feat.source}]")
            out.append(f"    Conditions (CSV) : {feat.raw_conditions!r}")
            if feat.prereq_supplements:
                # Prérequis lus sur la page et retenus par la curation de
                # `Data/dons/feat_prereq_supplements.json` : le moteur les évalue,
                # l'audit doit donc les citer à côté de la source CSV.
                out.append(f"    Ajouts (page)    : {list(feat.prereq_supplements)!r}")
            detail = details.get(feat.name) or {}
            if detail.get("conditions_detail"):
                out.append(f"    Conditions (page): {detail['conditions_detail']!r}")
            out.append("    Requirements :")
            out.extend(_requirement_lines(feat, character))
            out.append(f"    Statut moteur : {result.status}")
            for reason in result.reasons:
                out.append(f"      * {reason}")
    out.append("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", nargs="?", help="personnage déjà sauvegardé")
    parser.add_argument("--classe")
    parser.add_argument("--niveau", type=int)
    parser.add_argument("--race")
    parser.add_argument("-o", "--output", help="fichier de sortie (défaut : stdout)")
    args = parser.parse_args()

    if args.name:
        profile = load_profile(args.name)
        character = profile.to_character()
        label = f"{profile.name} ({profile.character_class} {profile.level})"
    elif args.classe and args.niveau:
        character = Character(
            character_class=args.classe, level=args.niveau, race=args.race
        )
        label = f"{args.classe} niveau {args.niveau}" + (f", {args.race}" if args.race else "")
    else:
        parser.error("fournir un nom de personnage, ou --classe et --niveau")

    catalog = load_catalog()
    report = build_report(character, label, catalog)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"Rapport écrit : {args.output} ({len(report.splitlines())} lignes)")
    else:
        sys.stdout.write(report)


if __name__ == "__main__":
    main()
