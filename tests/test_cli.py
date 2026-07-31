"""Tests for the single entry point of the four enrichment stages.

`cli.py` holds no domain logic, so almost nothing here asserts about enrichment
content. What it asserts is the three promises the dispatcher makes, each of which
would be a silent trap if broken:

* **Argv is forwarded verbatim.** A dispatcher that re-declared the flags would
  drift from the stages, and the drift would show up as a paid run that ignored
  `--limit`. `TestTransmissionDArgv` pins the forwarding, including the case that
  makes abbreviation dangerous (`--mode batch` vs `--modele`, the reason stage 09
  turned abbreviations off).

* **The guard runs before the stage, and a blocking verdict costs nothing.** For
  `enrich` that is a money statement, so it is tested with a call-counting client:
  0 calls.

* **The exit code is the stage's own.** The CLI is wired into CI (`--strict`), so a
  code it swallowed or invented would make a red run look green.

The end-to-end chain over `mini_corpus` lives here too
(`TestChaineDeBoutEnBout`) — it is this step's central verification criterion and
it belongs in the suite rather than in a shell transcript nobody re-runs. The
`enrich` leg uses the fake client from `test_enrich_llm`: no socket, no token, no
cost.
"""

from __future__ import annotations

import json
import socket
from pathlib import Path
from typing import Any

import pytest

from pf_spells import cli
from pf_spells import enrich_llm as el
from test_enrich_llm import ClientFactice

MINI = Path("tests") / "fixtures" / "mini_corpus"


class EtageFactice:
    """Records the argv it was handed and returns a fixed exit code."""

    def __init__(self, code: int = 0) -> None:
        self.code = code
        self.recus: list[list[str]] = []

    def main(self, argv: list[str]) -> int:
        self.recus.append(list(argv))
        return self.code


@pytest.fixture
def etage(monkeypatch: pytest.MonkeyPatch) -> EtageFactice:
    """Replace every wired stage with the same recorder."""
    factice = EtageFactice()
    monkeypatch.setattr(cli.importlib, "import_module", lambda nom: factice)
    return factice


@pytest.fixture
def pas_de_reseau(monkeypatch: pytest.MonkeyPatch) -> None:
    def interdit(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("aucun appel réseau réel n'est autorisé dans les tests")

    monkeypatch.setattr(socket, "socket", interdit)
    monkeypatch.setattr(socket, "create_connection", interdit)


class TestLesQuatreSousCommandes:
    def test_exactement_quatre_sous_commandes(self) -> None:
        assert set(cli.ETAGES) == {
            "prepare-prompts",
            "enrich",
            "validate-enrich",
            "build-vues",
        }

    @pytest.mark.parametrize("nom", sorted(cli.ETAGES))
    def test_le_module_cable_existe_et_expose_main(self, nom: str) -> None:
        import importlib

        module = importlib.import_module(cli.ETAGES[nom].module)
        assert callable(module.main)

    @pytest.mark.parametrize("nom", sorted(cli.ETAGES))
    def test_help_repond_zero_sans_lancer_la_garde(
        self, nom: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """`--help` must never pay the guard's 20-file read, nor a stage's work."""

        def interdit(*args: Any, **kwargs: Any) -> Any:
            raise AssertionError("--help ne doit pas lancer la garde d'entrée")

        monkeypatch.setattr(cli, "lancer_garde", interdit)
        with pytest.raises(SystemExit) as sortie:
            cli.main([nom, "--help"])
        assert sortie.value.code == 0
        assert "usage" in capsys.readouterr().out.lower()

    def test_l_aide_generale_nomme_les_quatre(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        assert cli.main(["--help"]) == 0
        sortie = capsys.readouterr().out
        for nom in cli.ETAGES:
            assert nom in sortie
        assert "docs/enrichissement.md" in sortie

    def test_sans_sous_commande_est_une_erreur_sur_stderr(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # Usage text on stdout would pollute a pipe that expected stage output.
        assert cli.main([]) == 2
        capture = capsys.readouterr()
        assert capture.out == ""
        assert "usage" in capture.err

    def test_sous_commande_inconnue_refusee(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        assert cli.main(["enrichir"]) == 2
        assert "inconnue" in capsys.readouterr().err

    def test_aucune_sous_commande_n_est_un_prefixe_ambigu(self) -> None:
        # The dispatcher matches exactly; this pins that no one later "helpfully"
        # adds prefix matching, which is what made --mode batch dangerous.
        assert cli.main(["enrich-"]) == 2


class TestTransmissionDArgv:
    def test_les_drapeaux_arrivent_intacts(self, etage: EtageFactice) -> None:
        cli.main(
            [
                "enrich",
                "--sans-preflight",
                "--limit",
                "3",
                "--only",
                "arc-baton",
                "--estimer-seulement",
            ]
        )
        assert etage.recus == [
            ["--limit", "3", "--only", "arc-baton", "--estimer-seulement"]
        ]

    def test_le_drapeau_de_la_cli_ne_fuit_pas_vers_l_etage(
        self, etage: EtageFactice
    ) -> None:
        # Three of the four stages have never heard of --sans-preflight and would
        # reject it outright.
        cli.main(["validate-enrich", "--sans-preflight", "--strict"])
        assert etage.recus == [["--strict"]]

    def test_build_vues_recoit_toujours_sans_preflight(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The guard is the CLI's job now; the stage must not read the sample twice."""
        monkeypatch.setattr(cli, "lancer_garde", lambda racine, journal: 0)
        cli.main(["build-vues", "--only", "arc-baton"])
        assert etage.recus == [["--only", "arc-baton", "--sans-preflight"]]

    def test_sans_preflight_n_est_jamais_dedouble(self, etage: EtageFactice) -> None:
        cli.main(["build-vues", "--sans-preflight"])
        assert etage.recus == [["--sans-preflight"]]

    def test_racine_est_transmise_et_aussi_lue_par_la_cli(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        vues: list[Path] = []
        monkeypatch.setattr(
            cli, "lancer_garde", lambda racine, journal: vues.append(racine) or 0
        )
        cli.main(["validate-enrich", "--racine", "ailleurs"])
        assert vues == [Path("ailleurs")]
        assert etage.recus == [["--racine", "ailleurs"]]

    def test_une_valeur_ressemblant_a_un_drapeau_passe(
        self, etage: EtageFactice
    ) -> None:
        cli.main(["enrich", "--sans-preflight", "--modele", "--pas-un-modele"])
        assert etage.recus == [["--modele", "--pas-un-modele"]]

    def test_mode_batch_n_est_pas_abrege_en_modele_par_la_cli(
        self, etage: EtageFactice
    ) -> None:
        """The trap stage 09 documented: no layer here may resolve prefixes."""
        cli.main(["enrich", "--sans-preflight", "--mode", "batch"])
        assert etage.recus == [["--mode", "batch"]]

    def test_rac_abrege_n_est_pas_lu_comme_racine(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        vues: list[Path] = []
        monkeypatch.setattr(
            cli, "lancer_garde", lambda racine, journal: vues.append(racine) or 0
        )
        cli.main(["validate-enrich", "--rac", "ailleurs"])
        assert vues == [Path(".")], "la CLI ne doit pas résoudre --rac en --racine"


class TestCodeDeSortie:
    @pytest.mark.parametrize("code", [0, 1, 2])
    def test_le_code_de_l_etage_est_rendu_tel_quel(
        self, code: int, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            cli.importlib, "import_module", lambda nom: EtageFactice(code)
        )
        assert cli.main(["validate-enrich", "--sans-preflight"]) == code

    def test_un_module_absent_donne_un_abandon_lisible(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        def echoue(nom: str) -> Any:
            raise ImportError("simulé")

        monkeypatch.setattr(cli.importlib, "import_module", echoue)
        assert cli.main(["validate-enrich", "--sans-preflight"]) == 2
        assert "ABANDON" in capsys.readouterr().err


class TestGardeDEntree:
    def test_la_garde_tourne_avant_l_etage(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        ordre: list[str] = []
        monkeypatch.setattr(
            cli, "lancer_garde", lambda racine, journal: ordre.append("garde") or 0
        )
        vrai_main = etage.main

        def espion(argv: list[str]) -> int:
            ordre.append("etage")
            return vrai_main(argv)

        monkeypatch.setattr(etage, "main", espion)
        cli.main(["validate-enrich"])
        assert ordre == ["garde", "etage"]

    def test_un_verdict_bloquant_n_appelle_pas_l_etage(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(cli, "lancer_garde", lambda racine, journal: 2)
        assert cli.main(["validate-enrich"]) == 2
        assert etage.recus == []

    def test_un_verdict_bloquant_sur_enrich_ne_paie_rien(
        self, tmp_path: Path, pas_de_reseau: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The money statement: a bad corpus costs zero calls, not one."""
        client = ClientFactice()
        monkeypatch.setattr(el, "construire_client", lambda region=el.REGION: client)
        # tmp_path is not a corpus: the guard's every path check fails.
        assert cli.main(["enrich", "--racine", str(tmp_path)]) == 2
        assert client.appels == 0

    def test_sans_preflight_saute_la_garde(
        self, etage: EtageFactice, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def interdit(*args: Any, **kwargs: Any) -> Any:
            raise AssertionError("--sans-preflight doit sauter la garde")

        monkeypatch.setattr(cli, "lancer_garde", interdit)
        assert cli.main(["validate-enrich", "--sans-preflight"]) == 0

    def test_la_garde_passe_sur_le_vrai_depot(
        self, repo_root: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        assert cli.lancer_garde(repo_root, lambda m: print(m)) == 0
        assert "PASS" in capsys.readouterr().out

    def test_un_arbre_vide_est_refuse_avec_toutes_ses_raisons(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Every reason at once: someone fixing a checkout wants the whole list."""
        messages: list[str] = []
        assert cli.lancer_garde(tmp_path, messages.append) == 2
        assert any("FAIL" in m for m in messages)
        assert sum(m.startswith("  - [") for m in messages) > 1
        assert capsys.readouterr().out == "", "la garde ne doit rien écrire sur stdout"

    def test_la_garde_est_introuvable_hors_depot(self, tmp_path: Path) -> None:
        with pytest.raises(cli.EtageIntrouvable, match="garde d'entrée introuvable"):
            cli.charger_garde(tmp_path)

    def test_la_garde_est_cherchee_dans_le_depot_pas_dans_la_racine(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        """`--racine <fixture>` must not fail on the fixture's missing `tools/`.

        The guard is a tool of the checkout being run; the corpus it inspects is
        whatever `--racine` names. Conflating the two would make every fixture run
        die on "garde introuvable" instead of on the fixture's real state.
        """
        assert cli.racine_du_depot() == repo_root
        assert not (tmp_path / "tools").exists()
        assert cli.charger_garde().preflight(tmp_path).verdict == "FAIL"


class TestJournalisation:
    def test_debut_et_fin_sur_stderr_avec_le_code(
        self, etage: EtageFactice, capsys: pytest.CaptureFixture[str]
    ) -> None:
        cli.main(["validate-enrich", "--sans-preflight"])
        journal = capsys.readouterr().err
        assert "validate-enrich" in journal
        assert "code 0" in journal
        assert " s," in journal, "la durée écoulée doit être journalisée"

    def test_stdout_reste_a_l_etage(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        class Bavard:
            def main(self, argv: list[str]) -> int:
                print("sortie de l'étage")
                return 0

        monkeypatch.setattr(cli.importlib, "import_module", lambda nom: Bavard())
        cli.main(["validate-enrich", "--sans-preflight"])
        assert capsys.readouterr().out == "sortie de l'étage\n"


class TestChaineDeBoutEnBout:
    """prepare-prompts → enrich → validate-enrich → build-vues, on the fixture.

    One test, deliberately: the criterion is that the *chain* runs, and splitting
    it would mean re-running each leg's predecessors four times. Every assertion
    inside names which leg it belongs to.
    """

    def test_les_quatre_etages_s_enchainent(
        self,
        repo_root: Path,
        tmp_path: Path,
        pas_de_reseau: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        racine = str(repo_root / MINI)
        commun = ["--sans-preflight", "--racine", racine, "--racine-conventions", "."]
        prompts = tmp_path / "prompts"
        enrichissements = tmp_path / "enrichissements"

        assert (
            cli.main(
                ["prepare-prompts", *commun, "--sortie", str(prompts)]
            )
            == 0
        )
        assembles = list(prompts.rglob("*.json"))
        assert len([c for c in assembles if c.name != "_manifeste.json"]) == 12

        client = ClientFactice()
        monkeypatch.setattr(el, "construire_client", lambda region=el.REGION: client)
        assert (
            cli.main(
                [
                    "enrich",
                    *commun,
                    "--prompts",
                    str(prompts),
                    "--sortie",
                    str(enrichissements),
                    "--quarantaine",
                    str(tmp_path / "quarantaine"),
                    "--rapports",
                    str(tmp_path / "rapports"),
                ]
            )
            == 0
        )
        assert client.appels == 12
        assert len(list(enrichissements.glob("*.json"))) == 12

        argv_valider = [
            "validate-enrich",
            *commun,
            "--enrichissements",
            str(enrichissements),
            "--rapports",
            str(tmp_path / "rapports"),
        ]
        # Without --strict a failing record is reported, not fatal; with --strict it
        # gates. Both codes are asserted because both are wired into procedures.
        assert cli.main(argv_valider) == 0
        assert cli.main([*argv_valider, "--strict"]) == 1
        rapport = json.loads(
            (tmp_path / "rapports" / "validation_enrichissement.json").read_text(
                encoding="utf-8"
            )
        )
        assert rapport["total"] == 12
        # The stub client answers with a fixed `preuves` block that is NOT a
        # substring of these twelve spells. Stage 10 catching exactly that, and
        # nothing else, is the anti-confabulation gate doing its job: a chain that
        # reported 0 failures here would mean the evidence check had gone quiet.
        assert set(rapport["par_type_erreur"]) == {"preuve_absente_du_source"}

        vues = tmp_path / "vues"
        assert (
            cli.main(
                [
                    "build-vues",
                    *commun,
                    "--enrichissements",
                    str(enrichissements),
                    "--sortie",
                    str(vues),
                ]
            )
            == 0
        )
        produites = sorted(c.stem for c in vues.glob("*.json") if c.stem != "_rapport")
        attendus = sorted(c.stem for c in (repo_root / MINI / "data/sorts").glob("*.json"))
        assert produites == attendus
        vue = json.loads((vues / "arc-baton.json").read_text(encoding="utf-8"))
        assert vue["id"] == "arc-baton"
        assert vue["enrichissement"] is not None

    def test_la_relance_de_la_chaine_ne_repaie_rien(
        self,
        repo_root: Path,
        tmp_path: Path,
        pas_de_reseau: None,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Re-running the chain is what a human does after a fix. It must be free."""
        racine = str(repo_root / MINI)
        commun = ["--sans-preflight", "--racine", racine, "--racine-conventions", "."]
        prompts = tmp_path / "prompts"
        enrichissements = tmp_path / "enrichissements"
        argv_enrich = [
            "enrich",
            *commun,
            "--prompts",
            str(prompts),
            "--sortie",
            str(enrichissements),
            "--quarantaine",
            str(tmp_path / "quarantaine"),
            "--rapports",
            str(tmp_path / "rapports"),
        ]
        cli.main(["prepare-prompts", *commun, "--sortie", str(prompts)])
        monkeypatch.setattr(
            el, "construire_client", lambda region=el.REGION: ClientFactice()
        )
        cli.main(argv_enrich)

        second = ClientFactice()
        monkeypatch.setattr(el, "construire_client", lambda region=el.REGION: second)
        assert cli.main(argv_enrich) == 0
        assert second.appels == 0
