"""Single entry point for the four LLM-enrichment stages.

Four modules already carry the whole behaviour — `prepare_prompts` (stage 08),
`enrich_llm` (stage 09), `validate_enrichment` (stage 10) and `build_vues` (the
derived view). This file adds **no** domain logic: if a subcommand needed to
compute something, that something would be missing from its stage.

What it does add is the two things no single stage can own:

* **One entry guard for all four.** `tools/preflight_corpus.py` asserts the corpus
  shape before a stage starts, so a stage never dies halfway through on a premise
  that was already false. `build_vues` and `echantillon_taxo` each grew their own
  call to it; wiring the remaining stages the same way would put a fourth copy of
  the same loader in the tree. The guard is run here, once, and `build-vues` is
  told to skip its own (`--sans-preflight` is appended for it) rather than pay for
  the same 20-file sample twice.

* **A uniform run log.** Start line, end line, elapsed seconds, exit code — on
  stderr, so a caller that pipes a stage's stdout into a file still gets a clean
  artefact. Stage 09 costs money; knowing when a run started and what code it
  ended on is the difference between "did that pass finish?" and re-paying it.

Argv is forwarded **verbatim**. That is the whole reason this file is short: the
flags are the stages' flags, spelled and documented in one place each, and
`pf-spells enrich --help` prints the real stage help rather than a second,
drifting copy of it. The only argument this file consumes is `--sans-preflight`,
and only because it must know whether to run the guard.

Usage:
    python -m pf_spells.cli prepare-prompts [--limit N] [--only ID] …
    python -m pf_spells.cli enrich          [--estimer-seulement] [--limit N] …
    python -m pf_spells.cli validate-enrich [--strict] [--only ID …]
    python -m pf_spells.cli build-vues      [--only ID …] [--force]

Exit code is the stage's own, unchanged: 0 nominal, 1 for a failing `--strict` or
a protected view, 2 for an abort (bad preflight, budget stop).
"""

from __future__ import annotations

import argparse
import importlib
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Callable, Iterable, NamedTuple


class EtageIntrouvable(RuntimeError):
    """Raised when a wired stage module cannot be imported — a packaging fault."""


class Etage(NamedTuple):
    """One subcommand: which module runs it, and whether it guards itself.

    `garde_integree` is True for the one stage that already calls the preflight in
    its own `run()`. For it, the CLI runs the guard and then tells the stage to
    skip its own, so the sample is read once per invocation instead of twice.
    """

    module: str
    resume: str
    garde_integree: bool


ETAGES: dict[str, Etage] = {
    "prepare-prompts": Etage(
        "pf_spells.prepare_prompts",
        "étage 08 — assembler un prompt par sort (hors ligne, idempotent)",
        garde_integree=False,
    ),
    "enrich": Etage(
        "pf_spells.enrich_llm",
        "étage 09 — appeler le modèle (RÉSEAU, PAYANT ; --estimer-seulement d'abord)",
        garde_integree=False,
    ),
    "validate-enrich": Etage(
        "pf_spells.validate_enrichment",
        "étage 10 — valider schéma, vocabulaires clos et preuves (hors ligne)",
        garde_integree=False,
    ),
    "build-vues": Etage(
        "pf_spells.build_vues",
        "vue jointe data/vues/sorts_enrichis/ (hors ligne, dérivée)",
        garde_integree=True,
    ),
}

DRAPEAU_SANS_GARDE = "--sans-preflight"
DRAPEAUX_AIDE = ("-h", "--help")


def _forcer_utf8() -> None:
    """UTF-8 on both streams: the stages print accented French, win32 included."""
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")


def racine_du_depot() -> Path:
    """This checkout's root, from this file's location (`<racine>/src/pf_spells/`).

    The guard is a tool of the repo being *run*, not of the corpus being checked —
    which are different trees whenever `--racine` names a fixture. Resolving it
    against `--racine` instead would make `--racine <fixture>` fail on a missing
    `tools/` rather than on whatever is actually wrong with the fixture.
    """
    return Path(__file__).resolve().parents[2]


def charger_garde(racine_outils: Path | None = None) -> ModuleType:
    """Import `tools/preflight_corpus.py` by path.

    It is deliberately not a package — it must import with no PYTHONPATH, so that
    it can run in a checkout where `src/` is the thing that turns out to be
    missing. Hence loading it by location rather than by name.
    """
    import importlib.util

    base = racine_du_depot() if racine_outils is None else racine_outils
    chemin = base / "tools" / "preflight_corpus.py"
    if not chemin.is_file():
        raise EtageIntrouvable(f"garde d'entrée introuvable : {chemin.as_posix()}")
    spec = importlib.util.spec_from_file_location("preflight_corpus", chemin)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise EtageIntrouvable(f"garde d'entrée non chargeable : {chemin.as_posix()}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["preflight_corpus"] = module
    spec.loader.exec_module(module)
    return module


def lancer_garde(racine: Path, journal: Callable[[str], None]) -> int:
    """Run the entry guard. Returns 0 to proceed, 2 to abort.

    A blocking verdict is reported with **every** reason at once: someone fixing a
    bad checkout wants the whole list, not the first item of it. Code 2 matches
    what the stages themselves return on an abort, so a caller has one convention.
    """
    garde = charger_garde()
    rapport = garde.preflight(racine)
    if not rapport.bloquantes:
        journal(
            f"préflight {rapport.verdict} — {rapport.nb_sorts} sorts, "
            f"{len(rapport.echantillon)} fichiers échantillonnés"
        )
        return 0
    journal(f"préflight {rapport.verdict} — {len(rapport.bloquantes)} bloquante(s) :")
    for anomalie in rapport.bloquantes:
        journal(f"  - [{anomalie.controle}] {anomalie.id} : {anomalie.detail}")
    journal(
        "corpus non conforme : aucun étage n'est lancé. Réexécuter "
        "`python tools/preflight_corpus.py` pour le rapport complet."
    )
    return 2


def _analyser_prefixe(args: list[str]) -> tuple[Path, bool]:
    """Peek at `--racine` and `--sans-preflight` without consuming anything else.

    `parse_known_args` on a two-flag parser: every other flag stays in `args` and
    reaches the stage untouched, which is the property this whole module rests on.
    Abbreviations are off — `--rac` must not silently become `--racine` here when
    the stage that will really parse it has `allow_abbrev=False`.
    """
    parseur = argparse.ArgumentParser(add_help=False, allow_abbrev=False)
    parseur.add_argument("--racine", default=".")
    parseur.add_argument(DRAPEAU_SANS_GARDE, action="store_true")
    connus, _ = parseur.parse_known_args(args)
    return Path(connus.racine), connus.sans_preflight


def _argv_etage(etage: Etage, args: list[str]) -> list[str]:
    """Build the stage's argv: `--sans-preflight` moved, never duplicated.

    The flag is the CLI's, so it is stripped from what the stage sees — three of
    the four stages have never heard of it and would reject it. `build-vues` is
    the exception: it always receives it, because the CLI has already run the
    guard and the stage must not run it a second time.
    """
    reste = [a for a in args if a != DRAPEAU_SANS_GARDE]
    if etage.garde_integree and not any(a in DRAPEAUX_AIDE for a in args):
        reste.append(DRAPEAU_SANS_GARDE)
    return reste


def _aide(nom_programme: str) -> str:
    lignes = [
        f"usage : {nom_programme} <sous-commande> [options]",
        "",
        "Les quatre étages de la couche d'enrichissement LLM. Chaque",
        "sous-commande transmet ses options telles quelles à son étage :",
        f"`{nom_programme} <sous-commande> --help` affiche l'aide de l'étage.",
        "",
    ]
    largeur = max(len(nom) for nom in ETAGES)
    lignes += [
        f"  {nom.ljust(largeur)}  {etage.resume}" for nom, etage in ETAGES.items()
    ]
    lignes += [
        "",
        "Ordre nominal : prepare-prompts → enrich → validate-enrich → build-vues.",
        f"Garde d'entrée `tools/preflight_corpus.py` avant chaque étage ; "
        f"{DRAPEAU_SANS_GARDE} la saute",
        "(réservé aux fixtures, qui portent des données valides sans être un dépôt).",
        "",
        "Documentation : docs/enrichissement.md",
    ]
    return "\n".join(lignes)


def _journaliser(message: str) -> None:
    # stderr, so stdout stays a stage's own output and can be piped to a file.
    print(f"[pf-spells] {message}", file=sys.stderr)


def dispatcher(
    argv: Iterable[str] | None = None, *, nom_programme: str = "pf-spells"
) -> int:
    """Resolve the subcommand, run the guard, delegate, and log the outcome."""
    args = list(sys.argv[1:] if argv is None else argv)
    if args[:1] and args[0] in DRAPEAUX_AIDE:
        print(_aide(nom_programme))
        return 0
    if not args:
        # No subcommand is a usage error, so the help goes to stderr: a caller
        # that pipes stdout must not receive help text where output was expected.
        print(_aide(nom_programme), file=sys.stderr)
        return 2

    nom, reste = args[0], args[1:]
    etage = ETAGES.get(nom)
    if etage is None:
        print(
            f"sous-commande inconnue : {nom!r}\n\n{_aide(nom_programme)}",
            file=sys.stderr,
        )
        return 2

    demande_aide = any(a in DRAPEAUX_AIDE for a in reste)
    racine, sans_garde = _analyser_prefixe(reste)

    try:
        module = importlib.import_module(etage.module)
    except ImportError as erreur:  # pragma: no cover - packaging fault
        raise EtageIntrouvable(f"{etage.module} introuvable : {erreur}") from erreur

    if not demande_aide:
        _journaliser(f"{nom} — {etage.resume}")
        if sans_garde:
            _journaliser("garde d'entrée sautée (--sans-preflight)")
        else:
            code_garde = lancer_garde(racine, _journaliser)
            if code_garde:
                _journaliser(f"{nom} : abandon avant tout traitement (code {code_garde})")
                return code_garde

    depart = time.monotonic()
    # The stages build their parsers with argparse's default `prog`, i.e. the
    # basename of sys.argv[0] — "cli.py" when delegated to from here. Borrowing
    # argv[0] for the call makes `pf-spells enrich --help` print a usage line the
    # reader can retype; without it the help advertises a path that is not the
    # command they ran.
    argv0 = sys.argv[0]
    sys.argv[0] = f"{nom_programme} {nom}"
    try:
        code = module.main(_argv_etage(etage, reste))
    finally:
        sys.argv[0] = argv0
    if not demande_aide:
        _journaliser(f"{nom} : terminé en {time.monotonic() - depart:.1f} s, code {code}")
    return code


def main(argv: Iterable[str] | None = None) -> int:
    _forcer_utf8()
    try:
        return dispatcher(argv)
    except EtageIntrouvable as erreur:
        print(f"ABANDON : {erreur}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
