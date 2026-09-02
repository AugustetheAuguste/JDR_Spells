"""Rapport de cohérence croisée entre `data/conventions/classes_unifiees.json`
(42 classes, cf. `tools/curate_classes_unifiees.py`) et les trois tables de
classes qui existaient déjà avant l'étape 07 :

- `data/classes/class_caster_info.json` (43 classes, curée à la main),
- `data/classes/class_proficiencies.json` (42 classes, curée à la main),
- `CLASS_BBA_PROGRESSION` dans `src/pf_dons/class_progression.py`.

C'est un RAPPORT, pas une correction : il sort toujours 0 et ne modifie rien.
Le nombre de classes diffère volontairement d'une table à l'autre (ex.
« chasseur de vampire » n'existe que dans class_caster_info.json et
CLASS_BBA_PROGRESSION, jamais dans class_proficiencies.json ni le registre des
42, car ce n'est pas une classe officielle PF1) : c'est un fait à documenter,
pas une anomalie à combler. `tests/dons/test_valider_registre_classes.py`
fige ces écarts nommément.

Usage : python tools/dons/valider_registre_classes.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "src"))

from pf_dons import paths  # noqa: E402
from pf_dons.class_progression import CLASS_BBA_PROGRESSION  # noqa: E402
from pf_dons.classes_unifiees import charger_classes  # noqa: E402


def slugs_registre() -> set[str]:
    return set(charger_classes().keys())


def slugs_caster_info() -> set[str]:
    brut = json.loads(paths.CLASS_CASTER_INFO.read_text(encoding="utf-8"))
    return set(brut.keys())


def slugs_proficiencies() -> set[str]:
    brut = json.loads(paths.CLASS_PROFICIENCIES.read_text(encoding="utf-8"))
    return set(brut.keys())


def slugs_bba() -> set[str]:
    return set(CLASS_BBA_PROGRESSION.keys())


def comparer(registre: set[str], table: set[str], nom_table: str) -> dict[str, list[str]]:
    return {
        "manquantes_du_registre": sorted(table - registre),
        "surnumeraires_de_la_table": sorted(registre - table),
    }


def construire_rapport() -> dict[str, dict[str, list[str]]]:
    registre = slugs_registre()
    return {
        "class_caster_info.json": comparer(registre, slugs_caster_info(), "class_caster_info.json"),
        "class_proficiencies.json": comparer(
            registre, slugs_proficiencies(), "class_proficiencies.json"
        ),
        "CLASS_BBA_PROGRESSION": comparer(registre, slugs_bba(), "CLASS_BBA_PROGRESSION"),
    }


def imprimer(rapport: dict[str, dict[str, list[str]]]) -> None:
    total_ecarts = 0
    for nom_table, ecarts in rapport.items():
        print(f"--- {nom_table} ---")
        manquantes = ecarts["manquantes_du_registre"]
        surnumeraires = ecarts["surnumeraires_de_la_table"]
        print(f"  manquantes du registre des 42 (presentes dans la table) : {manquantes}")
        print(f"  surnumeraires du registre (absentes de la table)        : {surnumeraires}")
        total_ecarts += len(manquantes) + len(surnumeraires)
    print(f"--- total des ecarts constates : {total_ecarts} ---")


def main() -> None:
    imprimer(construire_rapport())
    # Toujours 0 : ceci est un rapport, jamais une validation qui échoue.
    sys.exit(0)


if __name__ == "__main__":
    main()
