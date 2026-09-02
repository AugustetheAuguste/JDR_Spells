"""Regroupe les divergences RÉGRESSION/RELÂCHEMENT du différentiel de parité
(`scripts/comparer_verdicts.ts`) par cause — (classe du personnage, don en
cause) — plutôt que de les lister cellule par cellule. Une divergence de 400
cellules a d'ordinaire UNE seule cause racine dans `evaluerExigence` ou dans
un genre de gating ; ce script sert à la trouver sans dérouler 400 lignes à
la main.

Usage :
    python tools/dons/rapport_parite.py <reference.jsonl> <candidat.jsonl>
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


def _lire_jsonl(chemin: Path) -> list[dict[str, Any]]:
    lignes: list[dict[str, Any]] = []
    with chemin.open("r", encoding="utf-8") as f:
        for numero, ligne in enumerate(f, start=1):
            texte = ligne.strip()
            if not texte:
                continue
            try:
                lignes.append(json.loads(texte))
            except json.JSONDecodeError as erreur:
                raise ValueError(f"{chemin}:{numero} n'est pas du JSON valide — {erreur}") from erreur
    return lignes


def _cle(verdict: dict[str, Any]) -> tuple[str, str]:
    return (verdict["cle_personnage"], verdict["nom_don"])


def _classe_personnage(cle_personnage: str) -> str:
    return cle_personnage.split("|", 1)[0]


GAGNANTS = {"eligible", "manual_check"}


def comparer(reference: list[dict[str, Any]], candidat: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    par_cle_ref = {_cle(v): v for v in reference}
    par_cle_cand = {_cle(v): v for v in candidat}

    regressions: list[dict[str, Any]] = []
    relachements: list[dict[str, Any]] = []

    for cle, ref in par_cle_ref.items():
        cand = par_cle_cand.get(cle)
        if cand is None:
            continue
        if ref["statut"] in GAGNANTS and cand["statut"] == "ineligible":
            regressions.append({"ref": ref, "cand": cand})
        elif ref["statut"] == "ineligible" and cand["statut"] in GAGNANTS:
            relachements.append({"ref": ref, "cand": cand})

    return {"regressions": regressions, "relachements": relachements}


def _grouper_par_cause(divergences: list[dict[str, Any]]) -> Counter[tuple[str, str]]:
    """(classe, nom_don) est le regroupement le plus utile en pratique — la
    plupart des causes racines sont soit spécifiques à une classe (une table
    de maîtrises mal indexée), soit spécifiques à un don ou un type
    d'exigence (un genre de gating mal branché touche le même don pour
    toutes les classes)."""
    compteur: Counter[tuple[str, str]] = Counter()
    for d in divergences:
        classe = _classe_personnage(d["ref"]["cle_personnage"])
        don = d["ref"]["nom_don"]
        compteur[(classe, don)] += 1
    return compteur


def _afficher_groupes(titre: str, divergences: list[dict[str, Any]], limite: int) -> None:
    print(f"\n=== {titre} : {len(divergences)} cellule(s) ===")
    if not divergences:
        return
    groupes = _grouper_par_cause(divergences)
    for (classe, don), effectif in groupes.most_common(limite):
        exemple = next(
            d for d in divergences if _classe_personnage(d["ref"]["cle_personnage"]) == classe and d["ref"]["nom_don"] == don
        )
        print(
            f"  {effectif:>6}  classe={classe!r:<20} don={don!r:<45} "
            f"{exemple['ref']['statut']} -> {exemple['cand']['statut']}  "
            f"(ex: {exemple['ref']['cle_personnage']})"
        )
    if len(groupes) > limite:
        print(f"  … et {len(groupes) - limite} autre(s) groupe(s)")


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("reference")
    parseur.add_argument("candidat")
    parseur.add_argument("--limite", type=int, default=40, help="nombre de groupes affichés par section")
    args = parseur.parse_args(argv)

    try:
        reference = _lire_jsonl(Path(args.reference))
        candidat = _lire_jsonl(Path(args.candidat))
    except (OSError, ValueError) as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    resultat = comparer(reference, candidat)
    _afficher_groupes("RÉGRESSION (eligible/manual_check -> ineligible)", resultat["regressions"], args.limite)
    _afficher_groupes("RELÂCHEMENT (ineligible -> eligible/manual_check)", resultat["relachements"], args.limite)

    total = len(resultat["regressions"]) + len(resultat["relachements"])
    print(f"\ntotal bloquant : {total} cellule(s) (0 attendu par le garde)")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
