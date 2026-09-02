"""Transcrit le registre unifié des 42 classes du corpus de dons vers
`data/conventions/classes_unifiees.json`.

Ce script ne **dérive** rien : les deux tables ci-dessous (`TABLE` et `NOMS`)
sont recopiées à la main depuis
`Dons/build/fusion-dons-sorts/03_CLASS_REGISTRY.md`, qui est l'autorité. Même
philosophie que `curate_prereq_gating.py` dans le dépôt `Dons` : un
transcripteur, pas un dériveur — le relancer doit laisser le fichier
byte-identique.

Pourquoi 42 -> 19 et pas l'inverse : la correspondance des 42 classes du
corpus de dons vers les 19 listes de sorts du corpus de sorts est une
fonction totale (chaque classe a au plus une liste). L'inverse ne l'est pas
(plusieurs classes partagent une liste, ex. arcaniste/ensorceleur/magicien) ;
en faire la clé primaire aurait exigé une structure many-to-one bien plus
compliquée pour aucun bénéfice. Les 42 classes du corpus de dons sont donc la
clé primaire de ce registre.

`lanceur` et `liste_sorts` sont deux faits indépendants, pas un seul champ à
deux lectures : le scalde en est la preuve — il lance des sorts
(`lanceur: true`, vérité terrain corrigée dans `Dons/CLAUDE.md`) mais n'a
aucune liste dans le corpus de sorts (`liste_sorts: null`). Un schéma à un
seul champ rendrait cet état inexprimable. `lanceur` reste `null` ici à
dessein : sa seule autorité est `Data/classes/class_caster_info.json`, qui
n'existe dans ce dépôt qu'après l'étape 04 ; le renseigner de mémoire
reviendrait à recopier une table de gating curée à la main sans l'avoir sous
les yeux. L'étape 07 le remplit et le vérifie.

`clerc` porte `a_curer: true` : `Data/classes/class_proficiencies.json`
contient à la fois `clerc`, `pretre` et `pretre combattant`, alors qu'en
Pathfinder 1e francophone le clerc *est* le prêtre. C'est très probablement
un doublon ou un alias d'extraction plutôt qu'une 42e classe distincte, mais
ce script ne tranche pas — exactement le précédent de `chasseur de vampire`
dans `Dons` : une entrée douteuse est marquée, jamais devinée.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SORTIE = REPO_ROOT / "data" / "conventions" / "classes_unifiees.json"

# slug (corpus de dons, 42 entrées) -> liste_sorts (un des 19 slugs du corpus
# de sorts, ou None). Recopié verbatim depuis la table de correspondance de
# 03_CLASS_REGISTRY.md.
TABLE: dict[str, str | None] = {
    "alchimiste": "alchimiste",
    "antipaladin": "antipaladin",
    "arcaniste": "arcaniste-ensorceleur-magicien",
    "ensorceleur": "arcaniste-ensorceleur-magicien",
    "magicien": "arcaniste-ensorceleur-magicien",
    "barde": "barde",
    "chaman": "chaman",
    "chasseur": "chasseur",
    "conjurateur": "conjurateur",
    "druide": "druide",
    "hypnotiseur": "hypnotiseur",
    "inquisiteur": "inquisiteur",
    "magus": "magus",
    "medium": "medium",
    "occultiste": "occultiste",
    "paladin": "paladin",
    "oracle": "pretre-pretre-combattant-oracle",
    "pretre": "pretre-pretre-combattant-oracle",
    "pretre combattant": "pretre-pretre-combattant-oracle",
    "psychiste": "psychiste",
    "sanguin": "sanguin",
    "sorciere": "sorciere",
    "spirite": "spirite",
    # Classes sans sorts.
    "barbare": None,
    "bretteur": None,
    "cavalier": None,
    "chevalier": None,
    "guerrier": None,
    "justicier": None,
    "lutteur": None,
    "moine": None,
    "ninja": None,
    "pistolier": None,
    "roublard": None,
    "samourai": None,
    "tueur": None,
    # Lancent des sorts, mais leur liste est absente du corpus de sorts.
    "cinetiste": None,
    "enqueteur": None,
    "metamorphe": None,
    "rodeur": None,
    "scalde": None,
    # À curer : doublon suspecté de « pretre ».
    "clerc": None,
}

# slug -> libellé d'affichage accentué, verbatim.
NOMS: dict[str, str] = {
    "alchimiste": "Alchimiste",
    "antipaladin": "Antipaladin",
    "arcaniste": "Arcaniste",
    "ensorceleur": "Ensorceleur",
    "magicien": "Magicien",
    "barde": "Barde",
    "chaman": "Chaman",
    "chasseur": "Chasseur",
    "conjurateur": "Conjurateur",
    "druide": "Druide",
    "hypnotiseur": "Hypnotiseur",
    "inquisiteur": "Inquisiteur",
    "magus": "Magus",
    "medium": "Médium",
    "occultiste": "Occultiste",
    "paladin": "Paladin",
    "oracle": "Oracle",
    "pretre": "Prêtre",
    "pretre combattant": "Prêtre combattant",
    "psychiste": "Psychiste",
    "sanguin": "Sanguin",
    "sorciere": "Sorcière",
    "spirite": "Spirite",
    "barbare": "Barbare",
    "bretteur": "Bretteur",
    "cavalier": "Cavalier",
    "chevalier": "Chevalier",
    "guerrier": "Guerrier",
    "justicier": "Justicier",
    "lutteur": "Lutteur",
    "moine": "Moine",
    "ninja": "Ninja",
    "pistolier": "Pistolier",
    "roublard": "Roublard",
    "samourai": "Samouraï",
    "tueur": "Tueur",
    "cinetiste": "Cinétiste",
    "enqueteur": "Enquêteur",
    "metamorphe": "Métamorphe",
    "rodeur": "Rôdeur",
    "scalde": "Scalde",
    "clerc": "Clerc",
}

# slug -> raison de curation (seul « clerc » en a une).
A_CURER: dict[str, str] = {
    "clerc": (
        "doublon suspecté de « pretre » ; Data/classes/class_proficiencies.json "
        "contient à la fois clerc, pretre et pretre combattant alors qu'en "
        "Pathfinder 1e francophone le clerc est le pretre. Aucune classe "
        "officielle « clerc » distincte du pretre n'est confirmée ; non tranché "
        "ici, à curer à la main."
    ),
}


def construire() -> dict:
    assert set(TABLE) == set(NOMS), "TABLE et NOMS doivent couvrir les memes slugs"
    entrees = []
    for slug in sorted(TABLE):
        entrees.append(
            {
                "slug": slug,
                "nom": NOMS[slug],
                "liste_sorts": TABLE[slug],
                "lanceur": None,
                "a_curer": slug in A_CURER,
                "raison_curation": A_CURER.get(slug),
            }
        )
    return {"version": 1, "classes": entrees}


def ecrire(donnees: dict, chemin: Path = SORTIE) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(donnees, ensure_ascii=False, indent=2) + "\n"
    chemin.write_text(texte, encoding="utf-8", newline="\n")


def main() -> None:
    ecrire(construire())


if __name__ == "__main__":
    main()
