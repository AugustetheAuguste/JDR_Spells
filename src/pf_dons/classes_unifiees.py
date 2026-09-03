"""Lecteur du registre unifié des 42 classes (`data/conventions/classes_unifiees.json`).

Ce module ne fait que lire ; il ne dérive et ne corrige rien. La seule façon
légitime d'écrire ce fichier est `tools/curate_classes_unifiees.py` (cf.
Dons/CLAUDE.md, même patron que `curate_prereq_gating.py`). Ce module n'est
volontairement pas branché dans `engine.py` à cette étape : le moteur doit
rester à comportement identique jusqu'à l'étape 14 (différentiel Python/TS).

`lanceur` et `liste_sorts` sont deux champs indépendants — le scalde en est la
preuve vivante (`lanceur=True`, `liste_sorts=None`) — donc ce module ne dérive
jamais l'un de l'autre.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from pf_dons import paths
from pf_dons.engine import _normalize  # même normalisation que le reste du paquet


@dataclass(frozen=True)
class ClasseUnifiee:
    slug: str
    nom: str
    liste_sorts: str | None
    lanceur: bool | None
    a_curer: bool
    raison_curation: str | None


@lru_cache(maxsize=1)
def charger_classes() -> dict[str, ClasseUnifiee]:
    """Charge le registre, mémoïsé (le fichier ne change pas en cours de run)."""
    brut = json.loads(paths.CLASSES_UNIFIEES.read_text(encoding="utf-8"))
    resultat: dict[str, ClasseUnifiee] = {}
    for entree in brut["classes"]:
        classe = ClasseUnifiee(
            slug=entree["slug"],
            nom=entree["nom"],
            liste_sorts=entree["liste_sorts"],
            lanceur=entree["lanceur"],
            a_curer=entree["a_curer"],
            raison_curation=entree["raison_curation"],
        )
        resultat[classe.slug] = classe
    return resultat


def get_classe(nom: str) -> ClasseUnifiee | None:
    """Recherche insensible aux accents/casse (NFKD + minuscules), via _normalize."""
    cible = _normalize(nom)
    for classe in charger_classes().values():
        if _normalize(classe.slug) == cible:
            return classe
    return None


def liste_sorts_de(nom: str) -> str | None:
    classe = get_classe(nom)
    return classe.liste_sorts if classe is not None else None


def classes_par_liste() -> dict[str, list[str]]:
    """Regroupe les slugs par liste_sorts, recalculé à chaque appel : jamais
    une table inverse figée qui pourrait diverger du registre source."""
    regroupement: dict[str, list[str]] = {}
    for classe in charger_classes().values():
        if classe.liste_sorts is None:
            continue
        regroupement.setdefault(classe.liste_sorts, []).append(classe.slug)
    return regroupement
