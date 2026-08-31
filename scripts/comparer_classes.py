"""Tableau croisé de l'éligibilité des dons entre plusieurs personnages.

Complète `scripts/audit_character_feats.py` (qui détaille *un* personnage) en
répondant à la question inverse : pour chaque don du catalogue, quel est son
statut pour *chaque* classe ? C'est ce croisement qui fait ressortir les
incohérences — un don refusé à la classe qui possède justement la capacité
requise, ou offert à tout le monde alors qu'il est spécialisé.

La sortie est complète : une ligne par don, jamais tronquée.

Usage:
    python scripts/comparer_classes.py <fiche> [<fiche> ...] [-o rapport.txt]
"""

import argparse
import sys
from collections import Counter

from pf1_dons.data_loader import load_catalog
from pf1_dons.engine import evaluate_feat
from pf1_dons.persistence import load_profile

# Une lettre par statut, pour que le tableau tienne en largeur.
CODE = {"eligible": "O", "manual_check": "?", "ineligible": "."}
LEGENDE = "O = éligible   ? = à vérifier manuellement   . = inéligible"


def build_report(noms: list[str]) -> str:
    catalogue = load_catalog()
    personnages = {nom: load_profile(nom).to_character() for nom in noms}
    resultats = {
        nom: {f.name: evaluate_feat(f, perso) for f in catalogue}
        for nom, perso in personnages.items()
    }

    etiquettes = [personnages[nom].character_class for nom in noms]
    largeur = max(len(e) for e in etiquettes)
    lignes: list[str] = []
    lignes.append("=" * 100)
    lignes.append("TABLEAU CROISÉ D'ÉLIGIBILITÉ DES DONS PAR CLASSE")
    lignes.append("=" * 100)
    lignes.append(LEGENDE)
    lignes.append("")
    for nom in noms:
        p = personnages[nom]
        compte = Counter(r.status for r in resultats[nom].values())
        lignes.append(
            f"  {p.character_class:<{largeur}}  niveau {p.level}  race {p.race}  "
            f"BBA {p.bba}  |  éligibles {compte['eligible']:4}  "
            f"à vérifier {compte['manual_check']:4}  inéligibles {compte['ineligible']:5}  "
            f"=> {compte['eligible'] + compte['manual_check']:4} dons proposés"
        )
    lignes.append("")

    # En-tête vertical : une colonne par classe.
    for i in range(largeur):
        prefixe = " " * 52
        lignes.append(prefixe + " ".join(e[i] if i < len(e) else " " for e in etiquettes))
    lignes.append("-" * 100)

    for feat in sorted(catalogue, key=lambda f: f.name):
        codes = " ".join(CODE[resultats[nom][feat.name].status] for nom in noms)
        lignes.append(f"{feat.name[:50]:<52}{codes}")

    lignes.append("")
    lignes.append("=" * 100)
    lignes.append("DONS PROPOSÉS À TOUTES LES CLASSES TESTÉES (éligibles partout)")
    lignes.append("=" * 100)
    universels = [
        f.name
        for f in sorted(catalogue, key=lambda f: f.name)
        if all(resultats[nom][f.name].status == "eligible" for nom in noms)
    ]
    lignes.append(f"{len(universels)} dons :")
    for nom_don in universels:
        lignes.append(f"  {nom_don}")

    lignes.append("")
    lignes.append("=" * 100)
    lignes.append("DONS PROPOSÉS À UNE SEULE CLASSE (spécialisation exclusive)")
    lignes.append("=" * 100)
    for feat in sorted(catalogue, key=lambda f: f.name):
        offrants = [
            personnages[nom].character_class
            for nom in noms
            if resultats[nom][feat.name].status in ("eligible", "manual_check")
        ]
        if len(offrants) == 1:
            lignes.append(f"  {feat.name[:52]:<54}{offrants[0]}")

    return "\n".join(lignes) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fiches", nargs="+", help="noms des personnages sauvegardés")
    parser.add_argument("-o", "--sortie", help="fichier de sortie (sinon stdout)")
    args = parser.parse_args()

    rapport = build_report(args.fiches)
    if args.sortie:
        with open(args.sortie, "w", encoding="utf-8") as f:
            f.write(rapport)
        print(f"Rapport écrit : {args.sortie} ({rapport.count(chr(10))} lignes)")
    else:
        sys.stdout.write(rapport)


if __name__ == "__main__":
    main()
