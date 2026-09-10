"""Garde de cohérence entre la contrainte SQL `personnages_classe_connue` et
le registre `data/conventions/classes_unifiees.json`.

La contrainte SQL et le registre ne peuvent pas se dériver l'un de l'autre :
la première vit dans une migration, une suite figée qui décrit une évolution
de schéma dans le temps, jamais régénérée ; le second est un artefact curé à
la main (étape 07). Ce script est donc le seul lien qui les tient ensemble —
sans lui, un registre qui gagne ou perd une classe et une contrainte qu'on
oublie de mettre à jour divergent silencieusement, et la base refuse (ou
accepte à tort) un slug légitime.

Il ne dérive rien lui non plus : il lit les deux côtés tels qu'écrits et
compare les ensembles. Sortie 0 si identiques, 1 sinon, avec l'écart nommé.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
REGISTRE = RACINE / "data" / "conventions" / "classes_unifiees.json"
DOSSIER_MIGRATIONS = RACINE / "supabase" / "migrations"


def lire_slugs_registre() -> set[str]:
    donnees = json.loads(REGISTRE.read_text(encoding="utf-8"))
    return {classe["slug"] for classe in donnees["classes"]}


def lire_slugs_contrainte() -> set[str]:
    """Extrait par regex les valeurs littérales de `personnages_classe_connue`.

    Cherche la migration la plus récente qui pose cette contrainte (au cas où
    une migration ultérieure la redéfinirait), et non systématiquement la
    première trouvée par ordre alphabétique de fichier — un `add constraint`
    plus récent est la définition qui prévaut en base.
    """
    fichiers = sorted(DOSSIER_MIGRATIONS.glob("*.sql"))
    bloc_trouve: str | None = None
    fichier_trouve: Path | None = None
    for fichier in fichiers:
        texte = fichier.read_text(encoding="utf-8")
        for correspondance in re.finditer(
            r"add\s+constraint\s+personnages_classe_connue\b(.*?);",
            texte,
            re.IGNORECASE | re.DOTALL,
        ):
            bloc_trouve = correspondance.group(1)
            fichier_trouve = fichier

    if bloc_trouve is None or fichier_trouve is None:
        raise SystemExit(
            "Aucune migration ne pose de contrainte `personnages_classe_connue` : "
            "impossible de comparer au registre."
        )

    valeurs = re.findall(r"'([^']*)'", bloc_trouve)
    return set(valeurs)


def main() -> int:
    slugs_registre = lire_slugs_registre()
    slugs_contrainte = lire_slugs_contrainte()

    if slugs_registre == slugs_contrainte:
        print(f"OK : {len(slugs_registre)} slugs identiques entre le registre et la contrainte SQL.")
        return 0

    manquants_dans_sql = sorted(slugs_registre - slugs_contrainte)
    en_trop_dans_sql = sorted(slugs_contrainte - slugs_registre)

    print("ÉCART entre `classes_unifiees.json` et `personnages_classe_connue` :", file=sys.stderr)
    if manquants_dans_sql:
        print(
            f"  dans le registre mais absents de la contrainte SQL ({len(manquants_dans_sql)}) : "
            f"{manquants_dans_sql}",
            file=sys.stderr,
        )
    if en_trop_dans_sql:
        print(
            f"  dans la contrainte SQL mais absents du registre ({len(en_trop_dans_sql)}) : "
            f"{en_trop_dans_sql}",
            file=sys.stderr,
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
