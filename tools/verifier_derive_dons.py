"""Detect the feats/Dons data drifting away from its published artefact.

Same guard rail as `tools/verifier_derive.py` (read that one first), applied to
the "dons" side of the merged repository rather than to the spells corpus, and
with a different mechanism because there is, in this wave, no exporter to
re-run yet: `data/dons/`, `data/classes/`, `data/conditions/`, `data/races/` and
`data/conventions/classes_unifiees.json` do not have a Python module that turns
them into `web/public/data/dons/DERIVE.json` — that module arrives in a later
step of the merge plan. So instead of re-exporting and diffing bytes, this
script computes a content fingerprint of the source trees and compares it
against a fingerprint recorded inside the published artefact.

Recorded-fingerprint shape (`web/public/data/dons/DERIVE.json`), read by
`_lire_empreinte_enregistree` below — the later step that creates this file for
real must write exactly this shape:

    {"empreinte": "<sha256 hexdigest>"}

Right now `web/public/data/dons/` does not exist at all, so running this script
must fail cleanly (exit 1, an explicit "artefact absent" message naming the
missing path) rather than raise. `DeriveError` mirrors `verifier_derive.py`'s
own exception: "the check could not be run at all" (missing file, malformed
JSON, unreadable path), always converted to a clean stderr message in `main`,
never a raw traceback.

    python tools/verifier_derive_dons.py
    python tools/verifier_derive_dons.py --racine .
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

# Every one of these contributes to the fingerprint; a glob matching nothing is
# not an error (a step upstream of this one might not have landed its data yet
# in the exact same commit), it simply contributes zero pairs.
GLOBS_SOURCE = (
    "data/dons/**",
    "data/classes/**",
    "data/conditions/**",
    "data/races/**",
)
FICHIER_SOURCE_UNIQUE = "data/conventions/classes_unifiees.json"

CHEMIN_ARTEFACT = "web/public/data/dons/DERIVE.json"

# The re-export module named here does not exist yet in this wave — it is a
# placeholder name consistent with the eventual export pipeline, not a command
# that can be run today.
COMMANDE_REEXPORT = "python tools/exporter_dons_web.py"


class DeriveError(RuntimeError):
    """The check could not be run at all — distinct from finding drift."""


def _sha256_fichier(chemin: Path) -> str:
    """Content hash of one file, read as bytes so encoding never matters."""
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def _paires_source(racine: Path) -> list[tuple[str, str]]:
    """(relative posix path, sha256 of content) for every real file in scope."""
    paires: list[tuple[str, str]] = []
    for motif in GLOBS_SOURCE:
        for chemin in racine.glob(motif):
            if not chemin.is_file():
                continue
            paires.append((chemin.relative_to(racine).as_posix(), _sha256_fichier(chemin)))

    fichier_unique = racine / FICHIER_SOURCE_UNIQUE
    if fichier_unique.is_file():
        paires.append((FICHIER_SOURCE_UNIQUE, _sha256_fichier(fichier_unique)))

    return paires


def calculer_empreinte(racine: Path) -> str:
    """One sha256 over the sorted (path, content-hash) pairs of the dons corpus."""
    paires = sorted(_paires_source(racine))
    canonique = "\n".join(f"{chemin}:{empreinte}" for chemin, empreinte in paires)
    return hashlib.sha256(canonique.encode("utf-8")).hexdigest()


def _lire_empreinte_enregistree(chemin: Path) -> str:
    """The fingerprint recorded in the published artefact, or a clean DeriveError."""
    if not chemin.exists():
        raise DeriveError(
            f"artefact absent : {chemin.as_posix()} n'existe pas encore — rien à comparer"
        )
    try:
        contenu = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise DeriveError(f"{chemin.as_posix()} n'est pas du JSON : {erreur}") from erreur
    empreinte = contenu.get("empreinte")
    if not isinstance(empreinte, str):
        raise DeriveError(f"{chemin.as_posix()} n'a pas d'`empreinte` exploitable")
    return empreinte


def _diff_fichiers(racine: Path, empreinte_attendue_absente: bool) -> str:
    """Best-effort listing of what the fresh fingerprint saw, for the error message."""
    paires = _paires_source(racine)
    if not paires:
        return "aucun fichier source (data/dons/**, data/classes/**, ...) n'a été trouvé"
    return f"{len(paires)} fichier(s) source pris en compte dans l'empreinte fraîche"


def verifier(racine: Path) -> None:
    """Raise DeriveError on any drift or missing artefact; return normally on match."""
    chemin_artefact = racine / CHEMIN_ARTEFACT
    empreinte_enregistree = _lire_empreinte_enregistree(chemin_artefact)
    empreinte_fraiche = calculer_empreinte(racine)

    if empreinte_fraiche != empreinte_enregistree:
        raise DeriveError(
            "l'empreinte du corpus de dons a changé depuis le dernier réexport "
            f"({_diff_fichiers(racine, False)}) — enregistrée "
            f"{empreinte_enregistree[:12]}…, calculée {empreinte_fraiche[:12]}…\n\n"
            f"Lancer :\n  {COMMANDE_REEXPORT}\n"
            f"puis committer {CHEMIN_ARTEFACT}."
        )


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Vérifie que le corpus de dons (data/dons, data/classes, "
            "data/conditions, data/races, data/conventions/classes_unifiees.json) "
            "n'a pas changé sans réexport vers web/public/data/dons/DERIVE.json."
        )
    )
    parseur.add_argument(
        "--racine",
        default=None,
        help="racine du dépôt (défaut : déduite de l'emplacement de ce script)",
    )
    args = parseur.parse_args(argv)
    racine = Path(args.racine).resolve() if args.racine else Path(__file__).resolve().parent.parent

    try:
        verifier(racine)
    except DeriveError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    print(f"OK — {CHEMIN_ARTEFACT} est à jour avec le corpus de dons.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
