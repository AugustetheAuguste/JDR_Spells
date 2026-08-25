"""Detect a corpus corrected but never re-exported.

This is the guard rail that matters. Without it, someone fixes a spell in
`data/sorts/`, commits, and the site keeps serving the old value forever: nothing
errors, because `web/public/data/` is a committed artefact and the build reads it
happily. The symptom is a wrong spell on a working site, which is the worst kind.

The method is to re-run the export into a temporary directory and compare bytes
with what is committed. `genere_le` is the one field allowed to differ between two
runs, so it is not compared away with a fuzzy diff — it is *pinned* to the value
the committed artefact carries, which makes every remaining byte meaningful. A
timestamp-tolerant comparison would also tolerate the next field someone decides
is "basically the same".

Read-only with respect to the repository: everything is written under a temporary
directory, and `web/public/data/` is never touched. Exit 1 on drift, so CI blocks.

    python tools/verifier_derive.py
    python tools/verifier_derive.py --racine .
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

CHEMIN_DONNEES = "web/public/data"

# `alias.json` is built by a second module, from a hand-edited table, and it lands
# in the same directory. Comparing it means comparing the whole published surface.
ARTEFACTS = ("index.json", "alias.json")


class DeriveError(RuntimeError):
    """The check could not be run at all — distinct from finding drift."""


@dataclass(frozen=True)
class Divergence:
    """One artefact that differs, with enough detail to act on it."""

    artefact: str
    detail: str


def _lire_genere_le(chemin: Path) -> str:
    """The committed timestamp, which becomes the pin for the re-export."""
    try:
        contenu = json.loads(chemin.read_text(encoding="utf-8"))
    except FileNotFoundError as erreur:
        raise DeriveError(f"{chemin.as_posix()} est absent : rien à comparer") from erreur
    except json.JSONDecodeError as erreur:
        raise DeriveError(f"{chemin.as_posix()} n'est pas du JSON : {erreur}") from erreur
    horodatage = contenu.get("genere_le")
    if not isinstance(horodatage, str):
        raise DeriveError(f"{chemin.as_posix()} n'a pas de `genere_le` exploitable")
    return horodatage


def _lancer(argv: list[str], racine: Path) -> None:
    """Run a pipeline module, surfacing its stderr when it fails."""
    resultat = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [sys.executable, "-m", *argv],
        cwd=racine,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**_env(racine)},
    )
    if resultat.returncode != 0:
        raise DeriveError(
            f"`python -m {' '.join(argv)}` a échoué (code {resultat.returncode}) :\n"
            f"{resultat.stderr.strip()}"
        )


def _env(racine: Path) -> dict[str, str]:
    import os

    env = dict(os.environ)
    # The modules live under `src/`, and this script must work from a fresh clone
    # without the caller having exported anything.
    env["PYTHONPATH"] = str(racine / "src")
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def _comparer_fichier(attendu: Path, obtenu: Path, artefact: str) -> Divergence | None:
    """Byte comparison, with a first differing key when both sides parse."""
    if not obtenu.exists():
        return Divergence(artefact, "le réexport ne l'a pas produit")
    octets_attendus = attendu.read_bytes()
    octets_obtenus = obtenu.read_bytes()
    if octets_attendus == octets_obtenus:
        return None

    detail = (
        f"{len(octets_attendus)} octets committés contre "
        f"{len(octets_obtenus)} réexportés"
    )
    try:
        a = json.loads(octets_attendus.decode("utf-8"))
        b = json.loads(octets_obtenus.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return Divergence(artefact, detail)

    if isinstance(a, dict) and isinstance(b, dict):
        cles = sorted(set(a) | set(b))
        divergentes = [cle for cle in cles if a.get(cle) != b.get(cle)]
        if divergentes:
            detail += f" ; clés divergentes : {', '.join(divergentes[:6])}"
            if "sorts" in divergentes and isinstance(a.get("sorts"), list):
                detail += _detailler_sorts(a["sorts"], b.get("sorts", []))
    return Divergence(artefact, detail)


def _detailler_sorts(attendus: list[object], obtenus: list[object]) -> str:
    """Name the first spells that differ: « sorts diverge » alone is unactionable."""
    if len(attendus) != len(obtenus):
        return f" ; {len(attendus)} sorts committés contre {len(obtenus)} réexportés"
    noms: list[str] = []
    for gauche, droite in zip(attendus, obtenus, strict=True):
        if gauche != droite and isinstance(gauche, dict):
            slug = gauche.get("s")
            noms.append(str(slug))
        if len(noms) == 5:
            break
    return f" ; premiers sorts en cause : {', '.join(noms)}" if noms else ""


def _comparer_props(reference: Path, obtenu: Path) -> list[Divergence]:
    """The per-spell props tree, compared file by file."""
    if not reference.is_dir():
        return [Divergence("sorts/", f"{reference.as_posix()} est absent")]
    if not obtenu.is_dir():
        return [Divergence("sorts/", "le réexport n'a pas produit de dossier sorts/")]

    committes = {chemin.name for chemin in reference.glob("*.json")}
    reexportes = {chemin.name for chemin in obtenu.glob("*.json")}

    divergences: list[Divergence] = []
    manquants = sorted(committes - reexportes)
    surnumeraires = sorted(reexportes - committes)
    if manquants:
        divergences.append(
            Divergence(
                "sorts/",
                f"{len(manquants)} fichier(s) committé(s) que le réexport ne produit "
                f"plus : {', '.join(manquants[:5])}",
            )
        )
    if surnumeraires:
        divergences.append(
            Divergence(
                "sorts/",
                f"{len(surnumeraires)} fichier(s) produit(s) mais non committé(s) : "
                f"{', '.join(surnumeraires[:5])}",
            )
        )

    differents = [
        nom
        for nom in sorted(committes & reexportes)
        if (reference / nom).read_bytes() != (obtenu / nom).read_bytes()
    ]
    if differents:
        divergences.append(
            Divergence(
                "sorts/",
                f"{len(differents)} fichier(s) au contenu divergent : "
                f"{', '.join(differents[:5])}",
            )
        )
    return divergences


def verifier(racine: Path) -> list[Divergence]:
    """Re-export into a temporary tree and compare. Returns the drift found."""
    donnees = racine / CHEMIN_DONNEES
    horodatage_index = _lire_genere_le(donnees / "index.json")

    with tempfile.TemporaryDirectory(prefix="derive-") as brut:
        temporaire = Path(brut)
        sortie = temporaire / "data"
        _lancer(
            [
                "pf_spells.export_web",
                "--racine",
                str(racine),
                "--sortie",
                str(sortie),
                "--genere-le",
                horodatage_index,
            ],
            racine,
        )

        divergences: list[Divergence] = []
        divergence = _comparer_fichier(
            donnees / "index.json", sortie / "index.json", "index.json"
        )
        if divergence is not None:
            divergences.append(divergence)
        divergences.extend(_comparer_props(donnees / "sorts", sortie / "sorts"))

        # `alias.json` is written in place by its builder, so the committed copy is
        # moved aside and restored rather than redirected — the module has no
        # `--sortie`, and adding one to satisfy a checker would be the tail wagging
        # the dog.
        divergences.extend(_verifier_alias(racine, donnees, temporaire))

    return divergences


def _verifier_alias(racine: Path, donnees: Path, temporaire: Path) -> list[Divergence]:
    """Rebuild `alias.json` in place, compare, then put the original back."""
    chemin = donnees / "alias.json"
    if not chemin.exists():
        return [Divergence("alias.json", "absent du dépôt")]
    horodatage = _lire_genere_le(chemin)
    abri = temporaire / "alias_committe.json"
    shutil.copy2(chemin, abri)
    try:
        _lancer(
            [
                "pf_spells.build_alias",
                "--racine",
                str(racine),
                "--genere-le",
                horodatage,
            ],
            racine,
        )
        divergence = _comparer_fichier(abri, chemin, "alias.json")
        return [] if divergence is None else [divergence]
    finally:
        # Whatever happened, the working tree is left as it was found.
        shutil.copy2(abri, chemin)


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Réexporte le corpus et échoue si la sortie diffère de ce qui est "
            "committé sous web/public/data/. Détecte un corpus corrigé sans réexport."
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
        divergences = verifier(racine)
    except DeriveError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    if divergences:
        print(
            f"ÉCHEC — {len(divergences)} divergence(s) entre le corpus et "
            f"{CHEMIN_DONNEES} :",
            file=sys.stderr,
        )
        for divergence in divergences:
            print(f"  - {divergence.artefact} : {divergence.detail}", file=sys.stderr)
        print(
            "\nLe corpus a changé sans réexport. Lancer :\n"
            "  python -m pf_spells.export_web\n"
            "  python -m pf_spells.build_alias\n"
            "puis committer web/public/data/.",
            file=sys.stderr,
        )
        return 1

    print(f"OK — {CHEMIN_DONNEES} est à jour avec le corpus (comparaison à l'octet).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
