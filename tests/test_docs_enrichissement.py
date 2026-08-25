"""Tests for `docs/enrichissement.md` — the operating procedure of the LLM track.

The document's value is that its commands are **literal**: someone tuning a prompt
copies them and runs them. A stale flag there is worse than no documentation,
because it is followed. So the commands are checked against the real parsers,
which is a check no human review reliably performs.

What is asserted, and why each would be a real trap if it drifted:

* Every `python -m pf_spells.X` names a module that exists on disk. The precedent
  is concrete: stage 09 once printed `pf_spells.validate_enrichissements`, a module
  that never existed, right after a paid pass.
* Every long flag written after a subcommand is accepted by the stage that will
  really parse it. Stage 09 has `allow_abbrev=False`, so a near-miss like `--mode`
  is not silently absorbed — it is a hard error at the worst moment.
* The two procedures the step requires (prompt tuning, human correction) are
  present as commands, not as principles.
"""

from __future__ import annotations

import argparse
import importlib
import re
from pathlib import Path

import pytest

from pf_spells import cli

MODULE = re.compile(r"python -m pf_spells\.(\w+)")
BLOCS = re.compile(r"```\n(.*?)```", re.DOTALL)
# A subcommand invocation, with everything up to the end of its (possibly
# backslash-continued) command line.
INVOCATION = re.compile(
    r"python -m pf_spells\.cli\s+([a-z-]+)((?:[^\n]|\\\n)*)",
)
LONG = re.compile(r"(--[a-z][a-z-]*)")

# Flags of the tools that are not stages, plus the CLI's own. Excluded from the
# per-stage check because they are parsed elsewhere or by this dispatcher.
HORS_ETAGES = {"--sans-preflight"}


@pytest.fixture(scope="module")
def doc(repo_root: Path) -> Path:
    return repo_root / "docs" / "enrichissement.md"


@pytest.fixture(scope="module")
def texte(doc: Path) -> str:
    return doc.read_text(encoding="utf-8")


def _drapeaux_longs(etage_module: str) -> set[str]:
    """The long options a stage's parser really accepts.

    Read off the built parser rather than off the source: a `--help` string could
    document a flag that was never wired, and that is precisely the failure this
    test exists to catch.
    """
    module = importlib.import_module(etage_module)
    parseur_capture: list[argparse.ArgumentParser] = []
    vrai = argparse.ArgumentParser.parse_args

    def espion(self: argparse.ArgumentParser, *args: object, **kw: object) -> object:
        parseur_capture.append(self)
        raise _Interception

    argparse.ArgumentParser.parse_args = espion  # type: ignore[method-assign]
    try:
        module.main([])
    except _Interception:
        pass
    finally:
        argparse.ArgumentParser.parse_args = vrai  # type: ignore[method-assign]

    assert parseur_capture, f"{etage_module}.main n'a pas construit de parseur"
    drapeaux: set[str] = set()
    for action in parseur_capture[0]._actions:
        drapeaux.update(o for o in action.option_strings if o.startswith("--"))
    return drapeaux


class _Interception(Exception):
    """Raised in place of parsing, so no stage actually runs during collection."""


class TestFormat:
    def test_utf8_lf_sans_bom_newline_final(self, doc: Path) -> None:
        octets = doc.read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in octets
        assert octets.endswith(b"\n")
        octets.decode("utf-8")

    def test_aucun_caractere_de_remplacement(self, texte: str) -> None:
        # U+FFFD anywhere in this repo means something was decoded as cp1252.
        assert chr(0xFFFD) not in texte


class TestLesCommandesSontVraies:
    def test_chaque_module_cite_existe(self, repo_root: Path, texte: str) -> None:
        manquants = [
            nom
            for nom in sorted(set(MODULE.findall(texte)))
            if not (repo_root / "src" / "pf_spells" / f"{nom}.py").is_file()
        ]
        assert manquants == []

    def test_les_quatre_sous_commandes_sont_documentees(self, texte: str) -> None:
        for nom in cli.ETAGES:
            assert f"python -m pf_spells.cli {nom}" in texte, nom

    def test_aucune_sous_commande_inventee(self, texte: str) -> None:
        citees = {nom for nom, _ in INVOCATION.findall(texte)}
        assert citees <= set(cli.ETAGES), citees - set(cli.ETAGES)

    @pytest.mark.parametrize("nom", sorted(cli.ETAGES))
    def test_chaque_drapeau_cite_est_accepte_par_son_etage(
        self, nom: str, texte: str
    ) -> None:
        acceptes = _drapeaux_longs(cli.ETAGES[nom].module) | HORS_ETAGES
        for sous_commande, reste in INVOCATION.findall(texte):
            if sous_commande != nom:
                continue
            for drapeau in LONG.findall(reste):
                assert drapeau in acceptes, (
                    f"docs/enrichissement.md : `{nom} {drapeau}` — l'étage "
                    f"{cli.ETAGES[nom].module} n'accepte pas ce drapeau"
                )

    def test_les_outils_cites_existent(self, repo_root: Path, texte: str) -> None:
        for outil in re.findall(r"python (tools/[\w./]+)", texte):
            assert (repo_root / outil).is_file(), outil

    def test_les_chemins_cites_existent(self, repo_root: Path, texte: str) -> None:
        chemins = [
            "src/pf_spells/prepare_prompts.py",
            "tools/preflight_corpus.py",
            "tools/estimate_cost.py",
            "conventions/vocabulaires",
            "data/enrichissements",
            "data/sorts",
            ".claude/skills/pf-enrichment-conventions/SKILL.md",
            "build_artifacts/rapports/validation_enrichissement.json",
        ]
        for chemin in chemins:
            assert chemin in texte, f"{chemin} absent du document"
            assert (repo_root / chemin).exists(), f"{chemin} absent du disque"

    def test_la_version_de_prompt_citee_est_la_courante(self, texte: str) -> None:
        """The tuning loop's example bumps FROM the current version.

        If VERSION_PROMPT moves and this stays put, the documented `--limit 50`
        command would re-run a version that is already on disk — a paid no-op.
        """
        from pf_spells.prepare_prompts import VERSION_PROMPT

        assert f"build_artifacts/prompts/{VERSION_PROMPT}" in texte
        assert f"({VERSION_PROMPT} -> " in texte


class TestLesDeuxProcedures:
    def test_la_boucle_de_reglage_donne_ses_commandes(self, texte: str) -> None:
        for littéral in (
            "python -m pf_spells.cli prepare-prompts --version-prompt p1.6",
            "--limit 50",
            "VERSION_PROMPT",
        ):
            assert littéral in texte, littéral

    def test_la_boucle_de_reglage_interdit_le_reglage_sur_la_passe_complete(
        self, texte: str
    ) -> None:
        assert "est une passe payée" in texte
        assert "Ne jamais régler un prompt sur la passe complète" in texte

    def test_le_bump_de_version_est_explique_comme_necessaire(
        self, texte: str
    ) -> None:
        # Tuning without bumping produces records the resume logic believes current.
        assert "sans** bumper" in texte

    def test_la_correction_humaine_donne_ses_commandes(self, texte: str) -> None:
        for littéral in (
            "python -m pf_spells.cli validate-enrich --only <id>",
            "--force",
        ):
            assert littéral in texte, littéral

    def test_la_correction_humaine_dit_qu_une_edition_manuelle_est_ecrasee(
        self, texte: str
    ) -> None:
        assert "entièrement régénérable" in texte
        assert "sera écrasée" in texte

    def test_le_verrou_humain_est_declare_inexistant(self, texte: str) -> None:
        """`verifie_par_humain` was removed from the pipeline; the doc must not
        promise it, or someone will set a key the schema rejects."""
        assert "`verifie_par_humain` du plan initial **n'existe pas**" in texte
        assert "16 clés" in texte


class TestLesDeuxAlertesDuRapport:
    def test_taxonomie_incomplete_a_sa_procedure(self, texte: str) -> None:
        assert "taxonomie_incomplete" in texte
        assert "on ne desserre pas le seuil" in texte
        assert "5 %" in texte

    def test_derive_source_a_sa_procedure(self, texte: str) -> None:
        assert "derive_source" in texte
        assert "hash_source" in texte

    def test_le_taux_documente_est_celui_du_rapport(
        self, repo_root: Path, texte: str
    ) -> None:
        """The figures quoted are the ones on disk, not remembered ones."""
        import json

        rapport = json.loads(
            (
                repo_root
                / "build_artifacts"
                / "rapports"
                / "validation_enrichissement.json"
            ).read_text(encoding="utf-8")
        )
        assert f"{rapport['total']}" in texte
        assert f"{rapport['ok']}" in texte
        assert f"{rapport['notes_ambiguite']}" in texte
        # French typography: decimal comma, and a space before the percent sign.
        taux = f"{rapport['taux_notes_ambiguite'] * 100:.1f}".replace(".", ",")
        assert f"{taux} %" in texte


class TestExploitation:
    def test_le_jeton_passe_par_l_environnement(self, texte: str) -> None:
        assert "AWS_BEARER_TOKEN_BEDROCK" in texte
        assert "jamais par le dépôt" in texte

    def test_la_variable_citee_est_celle_que_le_code_lit(self, texte: str) -> None:
        from pf_spells.enrich_llm import VARIABLE_JETON

        assert VARIABLE_JETON in texte

    def test_le_plafond_et_le_seuil_cites_sont_ceux_du_code(self, texte: str) -> None:
        from pf_spells.enrich_llm import PLAFOND_APPELS_DEFAUT, SEUIL_CONFIRMATION

        assert f"({PLAFOND_APPELS_DEFAUT})" in texte
        assert f"au-delà de {SEUIL_CONFIRMATION} enregistrements" in texte

    def test_le_piege_de_la_version_perimee_est_documente(self, texte: str) -> None:
        """The trap `--estimer-seulement` surfaced: a default run repays 1972 calls."""
        assert "--estimer-seulement" in texte
        assert "1972" in texte

    def test_l_avertissement_sur_le_cache_est_present(self, texte: str) -> None:
        assert "en silence" in texte
        assert "4096" in texte

    def test_ce_qui_n_est_pas_committe_est_dit(self, texte: str) -> None:
        for chemin in ("build_artifacts/prompts/", "`.env`"):
            assert chemin in texte, chemin
