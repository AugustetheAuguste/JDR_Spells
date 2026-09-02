"""Fige les écarts de couverture entre le registre des 42 classes et les
trois tables de classes préexistantes. Un écart NOMMÉ ici est connu et
accepté (ex. « chasseur de vampire », qui n'est pas une classe officielle
PF1) ; un écart nouveau et non listé doit faire échouer ce test, pas passer
inaperçu.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "dons"))

from valider_registre_classes import construire_rapport  # noqa: E402


def test_ecarts_figes_nommement() -> None:
    rapport = construire_rapport()
    assert rapport == {
        "class_caster_info.json": {
            "manquantes_du_registre": ["chasseur de vampire"],
            "surnumeraires_de_la_table": [],
        },
        "class_proficiencies.json": {
            "manquantes_du_registre": [],
            "surnumeraires_de_la_table": [],
        },
        "CLASS_BBA_PROGRESSION": {
            "manquantes_du_registre": ["chasseur de vampire"],
            "surnumeraires_de_la_table": [],
        },
    }


def test_rapport_sort_toujours_zero() -> None:
    import subprocess

    resultat = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "dons" / "valider_registre_classes.py")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert resultat.returncode == 0
    assert "chasseur de vampire" in resultat.stdout
