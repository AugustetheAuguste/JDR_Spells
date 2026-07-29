"""Tests for the corpus entry guard.

Two layers, mirroring `test_validate_corpus.py`. The miniature trees built in
`tmp_path` break the expected repo shape one way at a time, so each blocking mode
is pinned to the exact defect it must catch. `TestDepotReel` runs the guard
against the committed repo and asserts it passes with the real spell count — a
guard that does not pass on the artifact it guards is worthless.

`tools/` is not a package (no `__init__.py`, by house rule), so the module is
loaded by path once per session.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
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
def pf() -> ModuleType:
    return charger_module(
        "preflight_corpus", REPO_ROOT / "tools" / "preflight_corpus.py"
    )


def sort_valide(identifiant: str, pf: ModuleType) -> dict:
    """A spell document carrying exactly the 21 canonical keys, in order."""
    valeurs: dict[str, object] = {
        "id": identifiant,
        "nom": identifiant.replace("-", " ").capitalize(),
        "url": f"https://example.invalid/{identifiant}.ashx",
        "ecole": "Transmutation",
        "descripteurs": [],
        "niveaux": {"Dru": 2},
        "temps_incantation": "1 action simple",
        "composantes": "V, G",
        "portee": "courte",
        "cible": "une créature",
        "duree": "1 round/niveau",
        "jet_de_sauvegarde": "Volonté, annule",
        "resistance_magie": "oui",
        "description": "Une description accentuée : école, cœur, fantôme.",
        "description_html": "<p>Une description.</p>",
        "mythique": None,
        "variantes": [],
        "sources": ["MDR"],
        "autres": {},
        "classes": [],
        "meta": {"url": None, "cache_fichier": None, "recupere_le": None,
                 "parser_version": "1.0.0"},
    }
    return {cle: valeurs[cle] for cle in pf.CLES_SORT}


class FauxDepot:
    """A minimal repo shaped exactly as the guard expects, ready to be broken."""

    def __init__(self, racine: Path, pf: ModuleType, nb_sorts: int = 1950) -> None:
        self.racine = racine
        self.pf = pf
        self.nb_sorts = nb_sorts

    def ecrire(self) -> Path:
        for chemin in ("src/pf_spells", "data/sorts", "data/index", "schemas", "tests"):
            (self.racine / chemin).mkdir(parents=True, exist_ok=True)
        (self.racine / "data/index/sorts_uniques.jsonl").write_text(
            "", encoding="utf-8", newline="\n"
        )
        for nom in ("carte_doublons.json", "sorts_exclusifs.json"):
            self.ecrire_json(self.racine / "data/index" / nom, {})
        self.ecrire_json(self.racine / "data/classes.json", [])
        skill = self.racine / self.pf.CHEMIN_SKILL
        skill.parent.mkdir(parents=True, exist_ok=True)
        skill.write_text("# conventions\n", encoding="utf-8", newline="\n")
        for numero in range(self.nb_sorts):
            identifiant = f"sort-{numero:05d}"
            self.ecrire_json(
                self.racine / "data/sorts" / f"{identifiant}.json",
                sort_valide(identifiant, self.pf),
            )
        return self.racine

    @staticmethod
    def ecrire_json(chemin: Path, valeur: object) -> None:
        chemin.parent.mkdir(parents=True, exist_ok=True)
        with chemin.open("w", encoding="utf-8", newline="\n") as f:
            json.dump(valeur, f, ensure_ascii=False, indent=2)
            f.write("\n")


@pytest.fixture()
def faux(tmp_path: Path, pf: ModuleType) -> FauxDepot:
    # 30 files: enough to draw a 20-file sample from, cheap enough to write.
    return FauxDepot(tmp_path, pf, nb_sorts=30)


def controles(rapport: object, code: str) -> list:
    return [a for a in rapport.anomalies if a.controle == code]  # type: ignore[attr-defined]


class TestDepotSain:
    def test_verdict_pass(self, faux: FauxDepot, pf: ModuleType) -> None:
        rapport = pf.preflight(faux.ecrire())
        # 30 files is outside [1900, 2300]: a warning, never blocking.
        assert rapport.verdict == "PASS", [a.detail for a in rapport.bloquantes]

    def test_nombre_de_sorts_rapporte(self, faux: FauxDepot, pf: ModuleType) -> None:
        rapport = pf.preflight(faux.ecrire())
        assert rapport.nb_sorts == 30
        assert rapport.to_json()["nb_sorts"] == 30

    def test_tous_les_controles_rapportes(self, faux: FauxDepot, pf: ModuleType) -> None:
        rapport = pf.preflight(faux.ecrire())
        assert set(rapport.controles) == {"P1", "P2", "P3", "P4", "P5", "P6"}


class TestStructureManquante:
    @pytest.mark.parametrize(
        "chemin", ["src/pf_spells", "data/sorts", "data/index", "schemas", "tests"]
    )
    def test_dossier_absent_bloque(
        self, faux: FauxDepot, pf: ModuleType, chemin: str
    ) -> None:
        racine = faux.ecrire()
        shutil.rmtree(racine / chemin)
        rapport = pf.preflight(racine)
        assert rapport.verdict == "FAIL"
        assert any(a.id == chemin for a in controles(rapport, "P1"))

    @pytest.mark.parametrize(
        "fichier",
        [
            "data/index/sorts_uniques.jsonl",
            "data/index/carte_doublons.json",
            "data/index/sorts_exclusifs.json",
            "data/classes.json",
        ],
    )
    def test_fichier_d_index_absent_bloque(
        self, faux: FauxDepot, pf: ModuleType, fichier: str
    ) -> None:
        racine = faux.ecrire()
        (racine / fichier).unlink()
        rapport = pf.preflight(racine)
        anomalies = controles(rapport, "P1")
        assert [a.id for a in anomalies] == [fichier]
        assert anomalies[0].gravite == "bloquant"

    def test_skill_absente_bloque(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        (racine / pf.CHEMIN_SKILL).unlink()
        rapport = pf.preflight(racine)
        anomalies = controles(rapport, "P6")
        assert anomalies and anomalies[0].gravite == "bloquant"
        assert rapport.verdict == "FAIL"


class TestEchantillon:
    def test_vingt_cles_bloque(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        chemin = racine / "data/sorts/sort-00000.json"
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        del doc["portee"]
        FauxDepot.ecrire_json(chemin, doc)
        rapport = pf.preflight(racine, echantillon=30)
        anomalies = controles(rapport, "P5")
        assert [a.id for a in anomalies] == ["sort-00000"]
        assert anomalies[0].gravite == "bloquant"
        assert "portee" in anomalies[0].detail
        assert rapport.verdict == "FAIL"

    def test_cle_en_trop_bloque(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        chemin = racine / "data/sorts/sort-00000.json"
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        doc["inattendu"] = 1
        FauxDepot.ecrire_json(chemin, doc)
        rapport = pf.preflight(racine, echantillon=30)
        assert any("inattendu" in a.detail for a in controles(rapport, "P5"))

    def test_replacement_char_bloque(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        chemin = racine / "data/sorts/sort-00001.json"
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        doc["description"] = "R" + chr(0xFFFD) + "sistance à la magie"
        FauxDepot.ecrire_json(chemin, doc)
        rapport = pf.preflight(racine, echantillon=30)
        anomalies = controles(rapport, "P4")
        assert [a.id for a in anomalies] == ["sort-00001"]
        assert anomalies[0].gravite == "bloquant"

    def test_accents_sains_ne_declenchent_rien(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        rapport = pf.preflight(faux.ecrire(), echantillon=30)
        assert not controles(rapport, "P4")

    def test_octets_non_utf8_bloquent(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        # cp1252 bytes for "é" — exactly the mis-encode the conventions warn about.
        (racine / "data/sorts/sort-00002.json").write_bytes(
            b'{"nom": "R\xe9sistance"}'
        )
        rapport = pf.preflight(racine, echantillon=30)
        assert any(
            "UTF-8" in a.detail and a.gravite == "bloquant"
            for a in controles(rapport, "P3")
        )

    def test_json_casse_bloque(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        (racine / "data/sorts/sort-00003.json").write_text(
            "{ pas du json", encoding="utf-8", newline="\n"
        )
        rapport = pf.preflight(racine, echantillon=30)
        assert any(
            "JSON illisible" in a.detail for a in controles(rapport, "P3")
        )

    def test_aucun_sort_bloque(self, tmp_path: Path, pf: ModuleType) -> None:
        racine = FauxDepot(tmp_path, pf, nb_sorts=0).ecrire()
        rapport = pf.preflight(racine)
        assert rapport.nb_sorts == 0
        assert rapport.verdict == "FAIL"
        assert any("échantillon vide" in a.detail for a in controles(rapport, "P3"))


class TestFourchetteDeVolumetrie:
    def test_hors_fourchette_avertit_sans_bloquer(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        rapport = pf.preflight(faux.ecrire())
        anomalies = controles(rapport, "P2")
        assert [a.gravite for a in anomalies] == ["avertissement"]
        assert rapport.verdict == "PASS"
        assert "30" in anomalies[0].detail

    def test_bornes_de_la_fourchette(self, pf: ModuleType) -> None:
        assert (pf.NB_SORTS_MIN, pf.NB_SORTS_MAX) == (1900, 2300)


class TestDeterminisme:
    def test_meme_graine_meme_echantillon(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        racine = faux.ecrire()
        premier = pf.preflight(racine, echantillon=10, graine=1234).echantillon
        second = pf.preflight(racine, echantillon=10, graine=1234).echantillon
        assert premier == second
        assert len(premier) == 10

    def test_graines_differentes_echantillons_differents(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        racine = faux.ecrire()
        # 10 out of 30: the odds of two seeds colliding on the same set are tiny,
        # and the assertion is about the seed mattering at all.
        premier = pf.preflight(racine, echantillon=10, graine=1).echantillon
        second = pf.preflight(racine, echantillon=10, graine=2).echantillon
        assert premier != second

    def test_echantillon_trie_et_independant_du_glob(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        rapport = pf.preflight(faux.ecrire(), echantillon=10, graine=7)
        assert rapport.echantillon == sorted(rapport.echantillon)

    def test_echantillon_plafonne_au_nombre_de_fichiers(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        rapport = pf.preflight(faux.ecrire(), echantillon=999)
        assert len(rapport.echantillon) == 30


class TestSortieCli:
    def test_main_code_0_et_json_sur_stdout(
        self, faux: FauxDepot, pf: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        racine = faux.ecrire()
        code = pf.main(["--racine", str(racine)])
        sortie = capsys.readouterr().out
        assert code == 0
        assert sortie.endswith("\n")
        rapport = json.loads(sortie)
        assert rapport["verdict"] == "PASS"
        assert rapport["nb_sorts"] == 30

    def test_main_code_1_sur_depot_casse(
        self, faux: FauxDepot, pf: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        racine = faux.ecrire()
        (racine / pf.CHEMIN_SKILL).unlink()
        code = pf.main(["--racine", str(racine)])
        assert code == 1
        assert json.loads(capsys.readouterr().out)["verdict"] == "FAIL"

    def test_json_conserve_les_accents(
        self, faux: FauxDepot, pf: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        racine = faux.ecrire()
        (racine / "data/classes.json").unlink()
        pf.main(["--racine", str(racine)])
        sortie = capsys.readouterr().out
        # `ensure_ascii=False`: accented details stay readable, never \uXXXX.
        assert "supposée" in sortie
        assert "\\u" not in sortie

    def test_n_ecrit_rien_sous_data(self, faux: FauxDepot, pf: ModuleType) -> None:
        racine = faux.ecrire()
        avant = {c: c.stat().st_mtime_ns for c in (racine / "data").rglob("*")}
        pf.main(["--racine", str(racine)])
        apres = {c: c.stat().st_mtime_ns for c in (racine / "data").rglob("*")}
        assert avant == apres

    def test_gravites_valides_uniquement(
        self, faux: FauxDepot, pf: ModuleType
    ) -> None:
        rapport = pf.preflight(faux.ecrire())
        assert {a.gravite for a in rapport.anomalies} <= {
            "bloquant",
            "avertissement",
            "info",
        }


class TestSortieUtf8EnSousProcessus:
    """Guard the *real* stdout, which `capsys` cannot see.

    `capsys` swaps stdout for an in-memory text buffer that already accepts every
    codepoint, so an accented report passes under it while the real command dies
    or emits mojibake: on win32 the console stream is cp1252. Only a genuine
    subprocess exercises the encoding, hence this test shells out and decodes the
    bytes as strict UTF-8 — exactly what a downstream `json.load` would do.
    """

    def test_stdout_est_de_l_utf8_strict_decodable(self, repo_root: Path) -> None:
        acheve = subprocess.run(
            [sys.executable, "tools/preflight_corpus.py"],
            cwd=repo_root,
            capture_output=True,
        )
        assert acheve.returncode == 0, acheve.stderr.decode("utf-8", "replace")
        texte = acheve.stdout.decode("utf-8")  # strict: raises on cp1252 bytes
        assert "�" not in texte
        rapport = json.loads(texte)
        assert rapport["verdict"] == "PASS"
        assert rapport["nb_sorts"] == len(
            list((repo_root / "data/sorts").glob("*.json"))
        )


class TestDepotReel:
    """The committed repo, guarded for real — the verification criterion."""

    def test_pass_et_compte_exact(self, repo_root: Path, pf: ModuleType) -> None:
        rapport = pf.preflight(repo_root)
        attendu = len(list((repo_root / "data/sorts").glob("*.json")))
        assert rapport.verdict == "PASS", [
            f"{a.controle} {a.id}: {a.detail}" for a in rapport.bloquantes[:10]
        ]
        assert rapport.nb_sorts == attendu
        assert not controles(rapport, "P2"), "le corpus réel doit être en fourchette"

    def test_main_code_0(
        self, repo_root: Path, pf: ModuleType, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = pf.main(["--racine", str(repo_root)])
        rapport = json.loads(capsys.readouterr().out)
        assert code == 0
        assert rapport["nb_sorts"] == len(
            list((repo_root / "data/sorts").glob("*.json"))
        )
        assert len(rapport["echantillon"]) == pf.ECHANTILLON_DEFAUT

    def test_racine_par_defaut_est_le_depot(self, repo_root: Path, pf: ModuleType) -> None:
        assert pf.racine_par_defaut() == repo_root
