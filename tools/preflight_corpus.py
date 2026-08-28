"""Entry guard for the LLM-enrichment track: is this repo the corpus we expect?

Every stage of the enrichment plan assumes a precise shape on disk — 21 keys per
spell file, an index that partitions the corpus, a roster of 19 classes, and the
Skill `pf-corpus-conventions` as the written authority. This module asserts that
shape **before** any stage runs, so a stage never fails halfway through on a
premise that was wrong from the start.

Two design constraints, both deliberate:

* **Read-only.** Nothing under `data/` is written, moved or created. The tool is
  safe to run at any point, including on a dirty working tree.
* **Standalone.** It imports nothing from `pf_spells`, so it runs with no
  `PYTHONPATH` and can therefore be the very first thing a session executes —
  including in a checkout where `src/` is the thing that turns out to be missing.

The sample of spell files is drawn with a seeded RNG over the *sorted* file list.
A guard that samples differently on each run is a guard nobody trusts: the same
`--graine` must always read the same files, so a failure is reproducible by
re-running the exact command from the report.

Output: a JSON report on stdout. Exit code 0 when no anomaly is `bloquant`, 1
otherwise, so the tool can gate a pipeline the way `validate_corpus` gates a merge.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal


def forcer_stdout_utf8() -> None:
    """Emit UTF-8 on stdout even where the console codepage is not UTF-8.

    The report carries accented French verbatim (`ensure_ascii=False`), and on
    win32 Python wires stdout to the console codepage — cp1252 — which raises on
    or mangles those bytes. The corpus rule is that every output is UTF-8 on
    every platform, win32 included, so the stream is reconfigured rather than the
    content downgraded: a report a caller cannot `json.load` is not a report.
    """
    flux = getattr(sys.stdout, "reconfigure", None)
    if flux is not None:
        flux(encoding="utf-8", newline="\n")

outil_version = "1.0.0"

# Same severity vocabulary as `pf_spells.validate_corpus`, restated rather than
# imported: this tool must stay importable with no PYTHONPATH.
Gravite = Literal["bloquant", "avertissement", "info"]

# Canonical spell-file key order, from the Skill's JSON key vocabulary table.
CLES_SORT: tuple[str, ...] = (
    "id",
    "nom",
    "url",
    "ecole",
    "descripteurs",
    "niveaux",
    "temps_incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet_de_sauvegarde",
    "resistance_magie",
    "description",
    "description_html",
    "mythique",
    "variantes",
    "sources",
    "autres",
    "classes",
    "meta",
)

# Directories and files whose absence makes every downstream stage meaningless.
CHEMINS_REQUIS: tuple[str, ...] = (
    "src/pf_spells",
    "data/sorts",
    "data/index",
    "data/index/sorts_uniques.jsonl",
    "data/index/carte_doublons.json",
    "data/index/sorts_exclusifs.json",
    "data/classes.json",
    "data/schemas",
    "tests",
)

# The Skill is the authority the whole track defers to; a checkout without it is
# a checkout where the conventions cannot be honoured.
CHEMIN_SKILL = ".claude/skills/pf-corpus-conventions/SKILL.md"

# Plausibility band for the spell count. Outside it, the corpus is probably a
# partial checkout or a mid-scrape snapshot — worth saying out loud, but not a
# reason to refuse to run: the exact figure is a fact of the wiki, not a contract.
NB_SORTS_MIN = 1900
NB_SORTS_MAX = 2300

# Spelled as `chr` so this source file never itself contains U+FFFD: a tool that
# hunts for the replacement character must not be a false positive for its own grep.
REPLACEMENT_CHAR = chr(0xFFFD)

ECHANTILLON_DEFAUT = 20
GRAINE_DEFAUT = 20260729


@dataclass(frozen=True, slots=True)
class Anomalie:
    """One finding. `id` is a path, a file stem or `-` when repo-wide."""

    controle: str
    gravite: Gravite
    id: str
    detail: str

    def to_json(self) -> dict[str, Any]:
        return {
            "controle": self.controle,
            "gravite": self.gravite,
            "id": self.id,
            "detail": self.detail,
        }


@dataclass
class Rapport:
    """The whole verdict: what was checked, how many spells, what went wrong."""

    racine: Path
    nb_sorts: int = 0
    graine: int = GRAINE_DEFAUT
    echantillon_demande: int = ECHANTILLON_DEFAUT
    echantillon: list[str] = field(default_factory=list)
    controles: dict[str, str] = field(default_factory=dict)
    anomalies: list[Anomalie] = field(default_factory=list)

    def ajouter(self, anomalie: Anomalie) -> None:
        self.anomalies.append(anomalie)

    @property
    def bloquantes(self) -> list[Anomalie]:
        return [a for a in self.anomalies if a.gravite == "bloquant"]

    @property
    def verdict(self) -> str:
        return "FAIL" if self.bloquantes else "PASS"

    def to_json(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "outil": "tools/preflight_corpus.py",
            "outil_version": outil_version,
            "racine": self.racine.as_posix(),
            "nb_sorts": self.nb_sorts,
            "graine": self.graine,
            "echantillon_demande": self.echantillon_demande,
            "echantillon": self.echantillon,
            "controles": self.controles,
            "anomalies": [a.to_json() for a in self.anomalies],
        }


def _verifier_chemins(racine: Path, rapport: Rapport) -> None:
    """Assert the expected tree exists. Absence is blocking, never a warning."""
    manquants = [c for c in CHEMINS_REQUIS if not (racine / c).exists()]
    for chemin in manquants:
        rapport.ajouter(
            Anomalie(
                "P1",
                "bloquant",
                chemin,
                "chemin requis absent : la structure supposée par le plan "
                "d'enrichissement n'est pas celle de ce dépôt",
            )
        )
    rapport.controles["P1"] = (
        f"OK — {len(CHEMINS_REQUIS)} chemins requis présents"
        if not manquants
        else f"ÉCHEC — {len(manquants)} chemin(s) absent(s)"
    )


def _compter_sorts(racine: Path, rapport: Rapport) -> list[Path]:
    """Count and return the spell files, sorted — the sample draws from this list."""
    dossier = racine / "data/sorts"
    fichiers = sorted(dossier.glob("*.json")) if dossier.is_dir() else []
    rapport.nb_sorts = len(fichiers)

    hors_bande = not (NB_SORTS_MIN <= len(fichiers) <= NB_SORTS_MAX)
    if hors_bande:
        rapport.ajouter(
            Anomalie(
                "P2",
                "avertissement",
                "data/sorts",
                f"{len(fichiers)} fichiers, hors de la fourchette attendue "
                f"[{NB_SORTS_MIN}, {NB_SORTS_MAX}] : dépôt partiel, corpus "
                "réduit ou wiki qui a bougé — à confirmer à la main",
            )
        )
    rapport.controles["P2"] = (
        f"OK — {len(fichiers)} sorts, dans [{NB_SORTS_MIN}, {NB_SORTS_MAX}]"
        if not hors_bande
        else f"HORS FOURCHETTE — {len(fichiers)} sorts"
    )
    return fichiers


def tirer_echantillon(
    fichiers: list[Path], echantillon: int, graine: int
) -> list[Path]:
    """Draw a reproducible sample: seeded RNG over an already-sorted list.

    Never `glob` order (filesystem-dependent) and never an unseeded RNG: the
    report has to name files a human can re-read with the same command.
    """
    tirage = random.Random(graine).sample(fichiers, min(echantillon, len(fichiers)))
    return sorted(tirage)


def _verifier_echantillon(fichiers: list[Path], rapport: Rapport) -> None:
    """Decode, key-check and U+FFFD-check the sampled files. All blocking."""
    tirage = tirer_echantillon(
        fichiers, rapport.echantillon_demande, rapport.graine
    )
    rapport.echantillon = [c.stem for c in tirage]
    defauts = 0

    for chemin in tirage:
        try:
            texte = chemin.read_text(encoding="utf-8", errors="strict")
        except UnicodeDecodeError as erreur:
            defauts += 1
            rapport.ajouter(
                Anomalie(
                    "P3", "bloquant", chemin.stem,
                    f"décodage UTF-8 strict impossible : {erreur}",
                )
            )
            continue

        if REPLACEMENT_CHAR in texte:
            defauts += 1
            rapport.ajouter(
                Anomalie(
                    "P4", "bloquant", chemin.stem,
                    f"{texte.count(REPLACEMENT_CHAR)} caractère(s) de "
                    "remplacement U+FFFD : le fichier a été décodé avec le "
                    "mauvais jeu de caractères en amont",
                )
            )

        try:
            doc = json.loads(texte)
        except json.JSONDecodeError as erreur:
            defauts += 1
            rapport.ajouter(
                Anomalie("P3", "bloquant", chemin.stem, f"JSON illisible : {erreur}")
            )
            continue

        manquantes = [c for c in CLES_SORT if c not in doc]
        extras = [c for c in doc if c not in CLES_SORT]
        if manquantes or extras:
            defauts += 1
            rapport.ajouter(
                Anomalie(
                    "P5", "bloquant", chemin.stem,
                    f"jeu de clés non conforme : {len(doc)} clés, manquantes "
                    f"{manquantes}, en trop {extras} (attendu : les "
                    f"{len(CLES_SORT)} clés canoniques)",
                )
            )

    for controle, libelle in (
        ("P3", "décodage UTF-8 strict et JSON analysable"),
        ("P4", "aucun U+FFFD"),
        ("P5", f"les {len(CLES_SORT)} clés canoniques présentes"),
    ):
        rapport.controles[controle] = (
            f"OK — {len(tirage)} fichiers tirés (graine {rapport.graine}) : "
            f"{libelle}"
            if not any(a.controle == controle for a in rapport.anomalies)
            else f"ÉCHEC — {libelle} : violation sur l'échantillon"
        )
    if not tirage:
        rapport.ajouter(
            Anomalie(
                "P3", "bloquant", "data/sorts",
                "échantillon vide : aucun fichier de sort à contrôler",
            )
        )


def _verifier_skill(racine: Path, rapport: Rapport) -> None:
    chemin = racine / CHEMIN_SKILL
    present = chemin.is_file()
    if not present:
        rapport.ajouter(
            Anomalie(
                "P6", "bloquant", CHEMIN_SKILL,
                "Skill `pf-corpus-conventions` introuvable : les conventions du "
                "corpus n'ont pas d'autorité écrite dans ce dépôt",
            )
        )
    rapport.controles["P6"] = (
        f"OK — Skill résolue en `{CHEMIN_SKILL}`"
        if present
        else "ÉCHEC — Skill `pf-corpus-conventions` absente"
    )


def preflight(
    racine_depot: Path,
    *,
    echantillon: int = ECHANTILLON_DEFAUT,
    graine: int = GRAINE_DEFAUT,
) -> Rapport:
    """Run every guard against `racine_depot` and return the full report.

    No check aborts the run: a single invocation must yield the complete picture,
    because a human fixing a bad checkout wants every reason at once.
    """
    rapport = Rapport(
        racine=racine_depot, graine=graine, echantillon_demande=echantillon
    )
    _verifier_chemins(racine_depot, rapport)
    fichiers = _compter_sorts(racine_depot, rapport)
    _verifier_echantillon(fichiers, rapport)
    _verifier_skill(racine_depot, rapport)
    return rapport


def racine_par_defaut() -> Path:
    """The repo root, inferred from this file's location (`<racine>/tools/`)."""
    return Path(__file__).resolve().parents[1]


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Garde d'entrée du corpus de sorts : vérifie la structure du dépôt, "
            "compte les sorts, contrôle un échantillon déterministe. "
            "Lecture seule — n'écrit rien sous data/."
        )
    )
    parseur.add_argument(
        "--racine",
        default=None,
        help="racine du dépôt (défaut : déduite de l'emplacement de ce script)",
    )
    parseur.add_argument(
        "--echantillon",
        type=int,
        default=ECHANTILLON_DEFAUT,
        help="nombre de fichiers de sorts à ouvrir (défaut : %(default)s)",
    )
    parseur.add_argument(
        "--graine",
        type=int,
        default=GRAINE_DEFAUT,
        help="graine du tirage ; même graine, même échantillon (défaut : %(default)s)",
    )
    args = parseur.parse_args(argv)
    forcer_stdout_utf8()

    racine = Path(args.racine) if args.racine else racine_par_defaut()
    rapport = preflight(
        racine, echantillon=args.echantillon, graine=args.graine
    )
    print(json.dumps(rapport.to_json(), ensure_ascii=False, indent=2))
    return 1 if rapport.bloquantes else 0


if __name__ == "__main__":
    raise SystemExit(main())
