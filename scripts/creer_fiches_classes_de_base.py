"""Crée les 11 fiches de personnage des classes de base de Pathfinder 1e,
au niveau 6, pour servir de banc d'essai à l'audit d'éligibilité des dons.

Toutes les fiches partagent la même race (humain) afin d'isoler l'effet de la
*classe* : c'est la classe qui varie, pas la race. Les caractéristiques suivent
un tableau standard (15/14/13/12/10/8 + 2 points de niveau) réparti selon la
caractéristique maîtresse de chaque classe, et l'alignement/la divinité sont
renseignés pour les classes qui en dépendent (paladin, prêtre, druide, moine,
barbare), afin que les prérequis correspondants se résolvent au lieu de rester
en vérification manuelle.

Idempotent : réécrit les fiches à chaque exécution.

Usage:
    python scripts/creer_fiches_classes_de_base.py
"""

from pf1_dons.character_profile import create_profile
from pf1_dons.class_skills import load_class_skills  # noqa: F401  (cohérence d'import)
from pf1_dons.feat_slots import load_class_bonus_feats
from pf1_dons.persistence import save_profile
from pf1_dons.race_loader import load_races

NIVEAU = 6
RACE = "Humain"

# (nom de la fiche, classe, caractéristiques, alignement, divinité)
FICHES = [
    ("Base Barbare", "Barbare",
     {"For": 18, "Dex": 14, "Con": 16, "Int": 8, "Sag": 12, "Cha": 10},
     "Chaotique Neutre", None),
    ("Base Barde", "Barde",
     {"For": 10, "Dex": 14, "Con": 12, "Int": 13, "Sag": 8, "Cha": 18},
     "Chaotique Bon", None),
    ("Base Druide", "Druide",
     {"For": 12, "Dex": 13, "Con": 14, "Int": 10, "Sag": 18, "Cha": 8},
     "Neutre", "Gozreh"),
    ("Base Ensorceleur", "Ensorceleur",
     {"For": 8, "Dex": 14, "Con": 14, "Int": 12, "Sag": 10, "Cha": 18},
     "Chaotique Neutre", None),
    ("Base Guerrier", "Guerrier",
     {"For": 18, "Dex": 14, "Con": 16, "Int": 10, "Sag": 12, "Cha": 8},
     "Neutre", None),
    ("Base Magicien", "Magicien",
     {"For": 8, "Dex": 14, "Con": 12, "Int": 18, "Sag": 13, "Cha": 10},
     "Neutre", None),
    ("Base Moine", "Moine",
     {"For": 14, "Dex": 18, "Con": 13, "Int": 10, "Sag": 16, "Cha": 8},
     "Loyal Neutre", "Irori"),
    ("Base Paladin", "Paladin",
     {"For": 16, "Dex": 12, "Con": 14, "Int": 10, "Sag": 13, "Cha": 16},
     "Loyal Bon", "Iomédae"),
    ("Base Prêtre", "Prêtre",
     {"For": 12, "Dex": 10, "Con": 14, "Int": 13, "Sag": 18, "Cha": 8},
     "Neutre Bon", "Sarenrae"),
    ("Base Rôdeur", "Rôdeur",
     {"For": 16, "Dex": 16, "Con": 14, "Int": 10, "Sag": 13, "Cha": 8},
     "Neutre Bon", "Érastil"),
    ("Base Roublard", "Roublard",
     {"For": 10, "Dex": 18, "Con": 13, "Int": 14, "Sag": 12, "Cha": 12},
     "Chaotique Neutre", None),
]


def main() -> None:
    races = load_races()
    bonus = load_class_bonus_feats()
    for nom, classe, carac, alignement, divinite in FICHES:
        profil = create_profile(
            nom, classe, NIVEAU, RACE, carac, races, bonus,
            alignment=alignement, deity=divinite,
        )
        chemin = save_profile(profil)
        print(f"{nom:18} {classe:12} niveau {NIVEAU}  {len(profil.feat_slots)} emplacements  -> {chemin}")


if __name__ == "__main__":
    main()
