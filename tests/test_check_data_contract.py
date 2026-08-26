"""Tests for `scripts/check_data_contract.ts`, driven from pytest.

A checker that has only ever been seen to pass is not known to check anything.
Each test here takes the frozen fixture index, breaks exactly one thing, and
asserts the checker exits non-zero and names the defect. The positive cases run
last, so a failure tells you whether the tool is broken or the artefact is.

Driven from pytest rather than a JS test runner on purpose: there is no web
toolchain at the repository root beyond `tsx`, and the Python suite is the one
that runs on every change. Step 10 wires the same command into CI.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "check_data_contract.ts"
INDEX_FIXTURE = REPO_ROOT / "web" / "fixtures" / "index.json"
INDEX_REEL = REPO_ROOT / "web" / "public" / "data" / "index.json"

pytestmark = pytest.mark.skipif(
    shutil.which("npx") is None or not (REPO_ROOT / "node_modules" / "tsx").is_dir(),
    reason="chaîne Node absente : lancer `npm install` à la racine",
)


def verifier(chemin: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["npx", "--no-install", "tsx", str(SCRIPT), str(chemin)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        # npx resolves through the shell on win32.
        shell=os.name == "nt",
    )


@pytest.fixture
def index() -> dict[str, Any]:
    return json.loads(INDEX_FIXTURE.read_text(encoding="utf-8"))


def ecrire(document: Any, chemin: Path) -> Path:
    chemin.write_text(
        json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return chemin


class TestLeVerificateurMord:
    """One defect per test. Each must be *detected*, not merely survived."""

    def test_un_slug_en_doublon_echoue(
        self, index: dict, tmp_path: Path
    ) -> None:
        """Two spells on one slug is two spells fighting over one public URL."""
        index["sorts"][1]["s"] = index["sorts"][0]["s"]
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "doublon" in resultat.stderr

    def test_un_i_non_dense_echoue(self, index: dict, tmp_path: Path) -> None:
        index["sorts"][3]["i"] = 99
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "dense" in resultat.stderr

    def test_un_code_d_ecole_pendant_echoue(
        self, index: dict, tmp_path: Path
    ) -> None:
        """The defect that has no visible symptom: a blank pastille."""
        index["sorts"][0]["e"] = len(index["ecoles"]) + 5
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "ecoles" in resultat.stderr

    def test_un_code_de_composante_pendant_echoue(
        self, index: dict, tmp_path: Path
    ) -> None:
        index["sorts"][0]["c"] = [len(index["composantes"])]
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "composantes" in resultat.stderr

    def test_un_niv_scalaire_echoue(self, index: dict, tmp_path: Path) -> None:
        """B4, guarded at the door: a flat level cannot be recovered downstream."""
        index["sorts"][0]["niv"] = 3
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "niv" in resultat.stderr

    def test_un_niv_vide_echoue(self, index: dict, tmp_path: Path) -> None:
        index["sorts"][0]["niv"] = {}
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout

    def test_un_niv_citant_une_classe_inconnue_echoue(
        self, index: dict, tmp_path: Path
    ) -> None:
        index["sorts"][0]["niv"] = {"classe-fantome": 2}
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout

    def test_un_niveau_hors_bornes_echoue(
        self, index: dict, tmp_path: Path
    ) -> None:
        slug = next(iter(index["sorts"][0]["niv"]))
        index["sorts"][0]["niv"][slug] = 12
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout

    def test_une_cle_en_trop_echoue(self, index: dict, tmp_path: Path) -> None:
        """`additionalProperties: false` — the contract is closed, and stays closed."""
        index["sorts"][0]["verifie_par_humain"] = True
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "contrat" in resultat.stderr

    def test_une_cle_manquante_echoue(self, index: dict, tmp_path: Path) -> None:
        del index["sorts"][0]["nf"]
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "contrat" in resultat.stderr

    def test_une_table_orpheline_echoue(self, index: dict, tmp_path: Path) -> None:
        """Dead weight shipped to every visitor, and the trace of a lost facet."""
        index["tags"].append("zzz-tag-jamais-reference")
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "jamais référencée" in resultat.stderr

    def test_un_u_fffd_echoue(self, index: dict, tmp_path: Path) -> None:
        index["sorts"][0]["n"] = "Boule de fe" + chr(0xFFFD)
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        assert "FFFD" in resultat.stderr

    def test_un_crlf_echoue(self, index: dict, tmp_path: Path) -> None:
        chemin = tmp_path / "index.json"
        chemin.write_bytes(
            json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            + b"\r\n"
        )
        resultat = verifier(chemin)
        assert resultat.returncode == 1, resultat.stdout
        assert "CRLF" in resultat.stderr

    def test_un_nf_vide_echoue(self, index: dict, tmp_path: Path) -> None:
        """An empty fold on a non-empty name means search silently misses the spell."""
        index["sorts"][0]["nf"] = ""
        resultat = verifier(ecrire(index, tmp_path / "index.json"))
        assert resultat.returncode == 1, resultat.stdout
        # Caught by the contract's own `minLength: 1` before the fold check is
        # reached. Both guards are wanted: the schema stops an empty string, and
        # `verifierTexte` stops a fold that collapsed a non-empty name to spaces.
        assert "contrat" in resultat.stderr

    def test_un_json_invalide_echoue_proprement(self, tmp_path: Path) -> None:
        chemin = tmp_path / "index.json"
        chemin.write_text("{ pas du json", encoding="utf-8", newline="\n")
        resultat = verifier(chemin)
        assert resultat.returncode == 1
        assert "JSON invalide" in resultat.stderr

    def test_un_fichier_absent_echoue_proprement(self, tmp_path: Path) -> None:
        resultat = verifier(tmp_path / "nulle-part.json")
        assert resultat.returncode == 1
        assert "illisible" in resultat.stderr


class TestLeVerificateurPasseSurLeReel:
    def test_la_fixture_passe(self) -> None:
        resultat = verifier(INDEX_FIXTURE)
        assert resultat.returncode == 0, resultat.stderr

    def test_la_fixture_affiche_une_taille_gzip(self) -> None:
        """The size is reported. It is no longer checked against anything."""
        resultat = verifier(INDEX_FIXTURE)
        assert "gzip" in resultat.stdout

    def test_l_index_reel_passe(self) -> None:
        resultat = verifier(INDEX_REEL)
        assert resultat.returncode == 0, resultat.stderr
        assert "2070" in resultat.stdout
