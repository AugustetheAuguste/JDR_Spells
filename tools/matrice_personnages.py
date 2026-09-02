"""Generate the fixed matrix of test characters shared by the Python and TS engines.

This script deliberately does not import `pf_dons`: it is a wave-1 tool, meant to
exist and be committed before step 03 (class registry) or step 04 (Python move)
land. Its only inputs are the class/race/level lists inlined below, copied
verbatim from `02_TOOLS.md`'s "Les 42 classes" section — that document is the
frozen source of truth for this vocabulary, not any Python module.

`caracteristiques` is pinned at 14 for every ability, never randomized: a random
generator would make a CI failure non-reproducible, and the fixture's whole point
is that two people (or two runs, months apart) get the exact same character.

`dons_acquis` is an explicit empty list, never `None`/omitted. The two values mean
different things downstream to the eligibility engine: `known_feats=None` reads as
"unknown" (a feat prerequisite resolves to `manual_check`), while
`known_feats=set()` reads as "definitely does not have it" (resolves to `False`).
`exporter_arbre_dons.py` in the Dons repo already passes an explicit empty set for
this exact reason; the matrix must match, or the Python and TS producers (steps 08
and 09) would silently measure two different semantics.

    python tools/matrice_personnages.py
    python tools/matrice_personnages.py --profil rapide
    python tools/matrice_personnages.py --sortie chemin/vers/fichier.json
"""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path
from typing import TypedDict

# The 42 base classes, inlined exactly as listed in 02_TOOLS.md — this tool must
# stay independent of any class registry that a later step introduces.
CLASSES: list[str] = [
    "alchimiste",
    "antipaladin",
    "arcaniste",
    "barbare",
    "barde",
    "bretteur",
    "cavalier",
    "chaman",
    "chasseur",
    "chevalier",
    "cinetiste",
    "clerc",
    "conjurateur",
    "druide",
    "enqueteur",
    "ensorceleur",
    "guerrier",
    "hypnotiseur",
    "inquisiteur",
    "justicier",
    "lutteur",
    "magicien",
    "magus",
    "medium",
    "metamorphe",
    "moine",
    "ninja",
    "occultiste",
    "oracle",
    "paladin",
    "pistolier",
    "pretre",
    "pretre combattant",
    "psychiste",
    "rodeur",
    "roublard",
    "samourai",
    "sanguin",
    "scalde",
    "sorciere",
    "spirite",
    "tueur",
]

NIVEAUX: list[int] = [1, 5, 10, 15, 20]

# Six races chosen to exercise every gating mechanism the merged engine has to
# handle (racial weapon, dwarf reclassification, anatomy, innate magic, size).
RACES: list[str] = ["humain", "elfe", "nain", "tengu", "aasimar", "gnome"]

NIVEAU_RAPIDE = 6
RACE_RAPIDE = "humain"

VALEUR_CARACTERISTIQUE = 14  # fixed, never randomized — see module docstring


class Caracteristiques(TypedDict):
    """The six standard Pathfinder ability scores."""

    force: int
    dexterite: int
    constitution: int
    intelligence: int
    sagesse: int
    charisme: int


class PersonnageTest(TypedDict):
    """One row of the matrix: a character definition, not a full sheet."""

    classe: str
    niveau: int
    race: str
    caracteristiques: Caracteristiques
    alignement: str
    divinite: str | None
    dons_acquis: list[str]


def _caracteristiques_fixes() -> Caracteristiques:
    return {
        "force": VALEUR_CARACTERISTIQUE,
        "dexterite": VALEUR_CARACTERISTIQUE,
        "constitution": VALEUR_CARACTERISTIQUE,
        "intelligence": VALEUR_CARACTERISTIQUE,
        "sagesse": VALEUR_CARACTERISTIQUE,
        "charisme": VALEUR_CARACTERISTIQUE,
    }


def _personnage(classe: str, niveau: int, race: str) -> PersonnageTest:
    return {
        "classe": classe,
        "niveau": niveau,
        "race": race,
        "caracteristiques": _caracteristiques_fixes(),
        "alignement": "Neutre",
        "divinite": None,
        "dons_acquis": [],  # explicit empty list, never None — see module docstring
    }


def _cle_tri(personnage: PersonnageTest) -> tuple[str, int, str]:
    """Deterministic sort key so the file is byte-identical across reruns."""
    return (personnage["classe"], personnage["niveau"], personnage["race"])


def engendrer(profil: str) -> list[PersonnageTest]:
    """Build one profile's rows, sorted for reproducibility.

    "complet" is the full cartesian product (42 classes x 5 levels x 6 races =
    1260 entries); "rapide" is a single-level, single-race slice (42 entries) for
    a fast local loop.
    """
    if profil == "complet":
        personnages = [
            _personnage(classe, niveau, race)
            for classe, niveau, race in itertools.product(CLASSES, NIVEAUX, RACES)
        ]
    elif profil == "rapide":
        personnages = [
            _personnage(classe, NIVEAU_RAPIDE, RACE_RAPIDE) for classe in CLASSES
        ]
    else:
        raise ValueError(f"profil inconnu : {profil!r} (attendu 'complet' ou 'rapide')")
    return sorted(personnages, key=_cle_tri)


def construire_matrice() -> dict[str, list[PersonnageTest]]:
    """Both profiles in a single document.

    The plan file speaks of writing a single
    `data/dons/matrice_personnages.json`, singular, but also names two distinct
    profiles ("complet" and "rapide") that both need to exist as committed
    fixtures. Rather than pick one profile arbitrarily or write two files, this
    resolves the ambiguity by nesting both profiles under their name in the one
    file the plan names.
    """
    return {"complet": engendrer("complet"), "rapide": engendrer("rapide")}


def ecrire(matrice: dict[str, list[PersonnageTest]], chemin: Path) -> None:
    """Write deterministic, LF-terminated JSON — byte-identical across reruns.

    `sort_keys=True` fixes key order inside each object; the list order is
    already fixed by `engendrer`'s sort. `newline="\\n"` stops Python from
    translating to CRLF on Windows, and no trailing platform newline is added
    beyond the single one written explicitly.
    """
    chemin.parent.mkdir(parents=True, exist_ok=True)
    contenu = json.dumps(matrice, indent=2, sort_keys=True, ensure_ascii=False)
    with chemin.open("w", encoding="utf-8", newline="\n") as flux:
        flux.write(contenu)
        flux.write("\n")


def main(argv: list[str] | None = None) -> int:
    racine = Path(__file__).resolve().parent.parent
    parseur = argparse.ArgumentParser(
        description=(
            "Engendre la matrice de personnages de test (dépôt Dons -> JDR_Spells, "
            "étape 02_TOOLS). Sans dépendance sur pf_dons : classes inlinées."
        )
    )
    parseur.add_argument(
        "--profil",
        choices=("complet", "rapide", "les-deux"),
        default="les-deux",
        help="profil à engendrer ; 'les-deux' (défaut) écrit le fichier committé",
    )
    parseur.add_argument(
        "--sortie",
        default=str(racine / "data" / "dons" / "matrice_personnages.json"),
        help="chemin de sortie (défaut : data/dons/matrice_personnages.json)",
    )
    args = parseur.parse_args(argv)

    chemin = Path(args.sortie)
    if args.profil == "les-deux":
        matrice = construire_matrice()
    else:
        matrice = {args.profil: engendrer(args.profil)}

    ecrire(matrice, chemin)
    resume = ", ".join(f"{cle} : {len(valeur)}" for cle, valeur in matrice.items())
    print(f"OK — {chemin} écrit ({resume}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
