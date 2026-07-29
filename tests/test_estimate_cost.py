"""Tests for the offline prompt-cost estimator.

The arithmetic is asserted exactly, on toy records with hand-counted character
lengths: an estimator whose formula is only checked "approximately" is an
estimator whose formula can silently drift. The rest pins the behaviours a caller
depends on — the manifest being skipped, an empty directory reporting zero rather
than crashing, and the low/high/batch ordering.

`tools/` is not a package (no `__init__.py`, by house rule), so the module is
loaded by path once per session.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import math
import sys
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]


def charger_module(nom: str, chemin: Path) -> ModuleType:
    """Import a path-addressed script — `tools/` is deliberately not a package."""
    spec = importlib.util.spec_from_file_location(nom, chemin)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # `dataclasses` resolves string annotations through `sys.modules`, so the
    # module has to be registered before its body runs.
    sys.modules[nom] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def ec() -> ModuleType:
    return charger_module("estimate_cost", REPO_ROOT / "tools" / "estimate_cost.py")


def ecrire_prompt(
    dossier: Path,
    identifiant: str,
    *,
    systeme: str,
    utilisateur: str,
    max_tokens: int,
) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    enregistrement = {
        "id": identifiant,
        "slug": identifiant,
        "hash_source": "0" * 64,
        "version_prompt": "1",
        "version_taxonomie": "taxonomie_v1",
        "systeme": systeme,
        "utilisateur": utilisateur,
        "max_tokens": max_tokens,
    }
    chemin = dossier / f"{identifiant}.json"
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(enregistrement, f, ensure_ascii=False, indent=2)
        f.write("\n")


@pytest.fixture()
def prompts(tmp_path: Path) -> Path:
    """Two records: 100 + 200 = 300 characters, 1000 output tokens each."""
    dossier = tmp_path / "prompts"
    ecrire_prompt(
        dossier, "sort-un", systeme="a" * 40, utilisateur="b" * 60, max_tokens=1000
    )
    ecrire_prompt(
        dossier, "sort-deux", systeme="c" * 80, utilisateur="d" * 120, max_tokens=1000
    )
    return dossier


class TestArithmetique:
    def test_comptes_de_base(self, prompts: Path, ec: ModuleType) -> None:
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000)
        assert estimation.nb_enregistrements == 2
        assert estimation.nb_caracteres == 300
        assert estimation.tokens_entree == math.ceil(300 / 3.6) == 84
        assert estimation.tokens_sortie_haut == 2000

    def test_heuristique_francaise_documentee(self, ec: ModuleType) -> None:
        assert ec.CARACTERES_PAR_TOKEN == 3.6
        assert ec.tokens_approximatifs(360) == 100
        # Rounded up: never under-budget.
        assert ec.tokens_approximatifs(361) == 101

    def test_cout_haut_exact(self, prompts: Path, ec: ModuleType) -> None:
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000)
        attendu = (84 * 1.0 + 2000 * 2.0) / 1000
        assert estimation.cout_haut == pytest.approx(attendu)

    def test_cout_bas_exact(self, prompts: Path, ec: ModuleType) -> None:
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000, fraction_sortie=0.25)
        assert estimation.tokens_sortie_bas == 500
        attendu = (84 * 1.0 + 500 * 2.0) / 1000
        assert estimation.cout_bas == pytest.approx(attendu)

    def test_tarifs_par_millier_de_tokens(self, prompts: Path, ec: ModuleType) -> None:
        assert ec.TOKENS_PAR_UNITE_TARIF == 1000
        # 1000 output tokens at a tariff of 1.0 per 1000 tokens costs 1.0.
        estimation = ec.estimer(prompts, 0.0, 1.0, 1000, fraction_sortie=0.5)
        assert estimation.cout_haut == pytest.approx(2.0)
        assert estimation.cout_bas == pytest.approx(1.0)

    def test_max_tokens_du_cli_sert_de_defaut(self, tmp_path: Path, ec: ModuleType) -> None:
        dossier = tmp_path / "prompts"
        dossier.mkdir()
        (dossier / "sort-un.json").write_text(
            json.dumps({"id": "sort-un", "systeme": "", "utilisateur": "x" * 36}),
            encoding="utf-8",
            newline="\n",
        )
        estimation = ec.estimer(dossier, 1.0, 1.0, 512)
        assert estimation.tokens_sortie_haut == 512
        assert estimation.tokens_entree == 10

    def test_champs_texte_nuls_toleres(self, tmp_path: Path, ec: ModuleType) -> None:
        dossier = tmp_path / "prompts"
        dossier.mkdir()
        (dossier / "sort-un.json").write_text(
            json.dumps(
                {"id": "sort-un", "systeme": None, "utilisateur": None,
                 "max_tokens": 100}
            ),
            encoding="utf-8",
            newline="\n",
        )
        estimation = ec.estimer(dossier, 1.0, 1.0, 1000)
        assert estimation.nb_caracteres == 0
        assert estimation.tokens_entree == 0


class TestManifeste:
    def test_manifeste_ignore(self, prompts: Path, ec: ModuleType) -> None:
        (prompts / ec.FICHIER_MANIFESTE).write_text(
            json.dumps({"genere_le": "2026-07-29", "nb": 2, "systeme": "z" * 10_000}),
            encoding="utf-8",
            newline="\n",
        )
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000)
        assert estimation.nb_enregistrements == 2
        assert estimation.nb_caracteres == 300

    def test_manifeste_hors_liste_des_fichiers(self, prompts: Path, ec: ModuleType) -> None:
        (prompts / ec.FICHIER_MANIFESTE).write_text("{}", encoding="utf-8", newline="\n")
        noms = [c.name for c in ec.fichiers_de_prompts(prompts)]
        assert noms == ["sort-deux.json", "sort-un.json"]


class TestBrackets:
    def test_haut_superieur_ou_egal_au_bas(self, prompts: Path, ec: ModuleType) -> None:
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000)
        assert estimation.cout_haut >= estimation.cout_bas
        assert estimation.tokens_sortie_haut >= estimation.tokens_sortie_bas

    def test_batch_moins_cher_que_a_la_demande(self, prompts: Path, ec: ModuleType) -> None:
        estimation = ec.estimer(prompts, 1.0, 2.0, 1000)
        assert estimation.remise_batch == ec.REMISE_BATCH_DEFAUT == 0.5
        assert estimation.cout_bas_batch < estimation.cout_bas
        assert estimation.cout_haut_batch < estimation.cout_haut
        assert estimation.cout_haut_batch == pytest.approx(estimation.cout_haut * 0.5)

    def test_fraction_de_sortie_nommee(self, ec: ModuleType) -> None:
        assert 0.0 < ec.FRACTION_SORTIE_BASSE < 1.0


class TestRepertoires:
    def test_repertoire_vide_zero_enregistrement(
        self, tmp_path: Path, ec: ModuleType
    ) -> None:
        vide = tmp_path / "vide"
        vide.mkdir()
        estimation = ec.estimer(vide, 1.0, 2.0, 1000)
        assert estimation.nb_enregistrements == 0
        assert estimation.cout_bas == estimation.cout_haut == 0.0

    def test_main_code_0_sur_repertoire_vide(
        self, tmp_path: Path, ec: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        vide = tmp_path / "vide"
        vide.mkdir()
        code = ec.main(
            ["--prompts", str(vide), "--tarif-entree", "1", "--tarif-sortie", "2"]
        )
        assert code == 0
        assert "0 enregistrement" in capsys.readouterr().out

    def test_main_code_non_nul_sur_repertoire_absent(
        self, tmp_path: Path, ec: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = ec.main(
            [
                "--prompts", str(tmp_path / "absent"),
                "--tarif-entree", "1",
                "--tarif-sortie", "2",
            ]
        )
        assert code != 0
        assert "introuvable" in capsys.readouterr().out


class TestSortieCli:
    def test_resume_affiche_les_quatre_mesures(
        self, prompts: Path, ec: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = ec.main(
            ["--prompts", str(prompts), "--tarif-entree", "1", "--tarif-sortie", "2"]
        )
        sortie = capsys.readouterr().out
        assert code == 0
        assert "Enregistrements   : 2" in sortie
        assert "Tokens d'entrée" in sortie
        assert "Coût à la demande" in sortie
        assert "Coût en batch" in sortie

    def test_sortie_json(
        self, prompts: Path, ec: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ec.main(
            [
                "--prompts", str(prompts),
                "--tarif-entree", "1",
                "--tarif-sortie", "2",
                "--json",
            ]
        )
        rapport = json.loads(capsys.readouterr().out)
        assert rapport["nb_enregistrements"] == 2
        assert rapport["tokens_entree"] == 84

    def test_remise_reglable_en_ligne_de_commande(
        self, prompts: Path, ec: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        ec.main(
            [
                "--prompts", str(prompts),
                "--tarif-entree", "1",
                "--tarif-sortie", "2",
                "--remise-batch", "0.25",
                "--json",
            ]
        )
        rapport = json.loads(capsys.readouterr().out)
        assert rapport["remise_batch"] == 0.25
        assert rapport["cout_haut_batch"] == pytest.approx(rapport["cout_haut"] * 0.25)


class TestHorsReseau:
    def test_aucun_import_reseau(self, ec: ModuleType) -> None:
        arbre = ast.parse(Path(ec.__file__).read_text(encoding="utf-8"))
        importes: set[str] = set()
        for noeud in ast.walk(arbre):
            if isinstance(noeud, ast.Import):
                importes |= {a.name.split(".")[0] for a in noeud.names}
            elif isinstance(noeud, ast.ImportFrom) and noeud.module:
                importes.add(noeud.module.split(".")[0])
        assert importes.isdisjoint(
            {"boto3", "botocore", "requests", "urllib", "http", "socket"}
        )
