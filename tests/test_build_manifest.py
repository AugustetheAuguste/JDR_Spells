"""Tests for the corpus manifest generator.

The manifest exists to be an *independent* census, so these tests recount the
corpus a third time, straight off disk, and compare. A test that read the figures
back out of `data/MANIFEST.json` and compared them to themselves would prove
nothing.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pf_spells import build_manifest

CLES_ARTEFACT = (
    "chemin",
    "type",
    "nb_enregistrements",
    "schema",
    "produit_par_etape",
    "autorite",
    "description",
)


def _lignes(chemin: Path) -> int:
    return sum(
        1 for ligne in chemin.read_text(encoding="utf-8").splitlines() if ligne.strip()
    )


@pytest.fixture(scope="module")
def manifest_path(repo_root: Path) -> Path:
    chemin = repo_root / "data" / "MANIFEST.json"
    if not chemin.exists():
        pytest.skip("data/MANIFEST.json absent — lancer pf_spells.build_manifest")
    return chemin


@pytest.fixture(scope="module")
def manifest(manifest_path: Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


class TestFormat:
    def test_utf8_sans_bom(self, manifest_path: Path) -> None:
        octets = manifest_path.read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        octets.decode("utf-8")

    def test_fins_de_ligne_lf_et_newline_final(self, manifest_path: Path) -> None:
        octets = manifest_path.read_bytes()
        assert b"\r" not in octets
        assert octets.endswith(b"\n")

    def test_indent_2_et_ensure_ascii_false(
        self, manifest_path: Path, manifest: dict
    ) -> None:
        attendu = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        assert manifest_path.read_text(encoding="utf-8") == attendu

    def test_accents_non_echappes(self, manifest_path: Path) -> None:
        # ensure_ascii=False means real accented bytes, never \uXXXX escapes.
        texte = manifest_path.read_text(encoding="utf-8")
        assert "\\u" not in texte

    def test_cles_de_haut_niveau(self, manifest: dict) -> None:
        assert list(manifest) == [
            "genere_le",
            "parser_version",
            "source",
            "artefacts",
            "totaux",
        ]

    def test_attribution_de_la_source(self, manifest: dict) -> None:
        assert "pathfinder-fr.org" in manifest["source"]["site"]
        note = manifest["source"]["note_licence"]
        assert "Black Book Editions" in note
        assert "Paizo" in note
        assert "usage personnel" in note


class TestArtefacts:
    def test_chaque_chemin_existe_sur_disque(
        self, repo_root: Path, manifest: dict
    ) -> None:
        manquants = [
            a["chemin"]
            for a in manifest["artefacts"]
            if not (repo_root / a["chemin"]).exists()
        ]
        assert manquants == []

    def test_chemins_manquants_helper(self, repo_root: Path, manifest: dict) -> None:
        assert build_manifest.chemins_manquants(repo_root, manifest) == []

    def test_champs_obligatoires_peuples(self, manifest: dict) -> None:
        for a in manifest["artefacts"]:
            for cle in CLES_ARTEFACT:
                assert cle in a, f"{a.get('chemin')} : clé {cle} absente"
            assert isinstance(a["nb_enregistrements"], int)
            assert a["nb_enregistrements"] > 0, a["chemin"]
            assert a["autorite"], a["chemin"]
            assert a["description"], a["chemin"]
            # `elements_to_do.json` is an input, so it alone has no producing step.
            if a["chemin"] == "elements_to_do.json":
                assert a["produit_par_etape"] is None
            else:
                assert a["produit_par_etape"], a["chemin"]

    def test_inventaire_complet(self, manifest: dict) -> None:
        attendus = {
            "elements_to_do.json",
            "data/classes.json",
            "data/listes_classes/",
            "data/spell_pages.jsonl",
            "data/index/sorts_uniques.jsonl",
            "data/index/carte_doublons.json",
            "data/index/sorts_exclusifs.json",
            "data/sorts/",
            "cache/html/",
            "cache/index.jsonl",
            "schemas/",
            "reports/",
        }
        assert {a["chemin"] for a in manifest["artefacts"]} == attendus

    def test_chemins_uniques(self, manifest: dict) -> None:
        chemins = [a["chemin"] for a in manifest["artefacts"]]
        assert len(chemins) == len(set(chemins))

    def test_schemas_references_existent(
        self, repo_root: Path, manifest: dict
    ) -> None:
        for a in manifest["artefacts"]:
            if a["schema"] is not None:
                assert (repo_root / a["schema"]).is_file(), a["schema"]

    def test_repertoires_portent_un_nb_fichiers(
        self, repo_root: Path, manifest: dict
    ) -> None:
        for a in manifest["artefacts"]:
            if not a["chemin"].endswith("/"):
                continue
            assert "nb_fichiers" in a, a["chemin"]
            motif = "*" + Path(a["motif"]).suffix
            reel = len(list((repo_root / a["chemin"]).glob(motif)))
            assert a["nb_fichiers"] == reel, a["chemin"]


class TestTotauxRecomptes:
    """Every total is recounted here from disk, not read back from the manifest."""

    def test_nb_classes(self, repo_root: Path, manifest: dict) -> None:
        roster = json.loads(
            (repo_root / "data" / "classes.json").read_text(encoding="utf-8")
        )
        assert manifest["totaux"]["nb_classes"] == len(roster) == 19

    def test_nb_fichiers_sorts(self, repo_root: Path, manifest: dict) -> None:
        reel = len(list((repo_root / "data" / "sorts").glob("*.json")))
        assert manifest["totaux"]["nb_fichiers_sorts"] == reel

    def test_nb_sorts_uniques(self, repo_root: Path, manifest: dict) -> None:
        reel = _lignes(repo_root / "data" / "index" / "sorts_uniques.jsonl")
        assert manifest["totaux"]["nb_sorts_uniques"] == reel

    def test_index_et_corpus_concordent(self, manifest: dict) -> None:
        totaux = manifest["totaux"]
        assert totaux["nb_sorts_uniques"] == totaux["nb_fichiers_sorts"]

    def test_nb_entrees_listes(self, repo_root: Path, manifest: dict) -> None:
        reel = sum(
            _lignes(f)
            for f in sorted((repo_root / "data" / "listes_classes").glob("*.jsonl"))
        )
        assert manifest["totaux"]["nb_entrees_listes"] == reel

    def test_nb_pages_cache(self, repo_root: Path, manifest: dict) -> None:
        reel = len(list((repo_root / "cache" / "html").glob("*.html")))
        assert manifest["totaux"]["nb_pages_cache"] == reel

    def test_sous_blocs_mythique_et_variantes(
        self, repo_root: Path, manifest: dict
    ) -> None:
        mythique = variantes = 0
        for chemin in sorted((repo_root / "data" / "sorts").glob("*.json")):
            doc = json.loads(chemin.read_text(encoding="utf-8"))
            if doc["mythique"] is not None:
                mythique += 1
            if doc["variantes"]:
                variantes += 1
        assert manifest["totaux"]["nb_sorts_avec_mythique"] == mythique
        assert manifest["totaux"]["nb_sorts_avec_variantes"] == variantes

    def test_totaux_coherents_avec_les_artefacts(self, manifest: dict) -> None:
        par_chemin = {a["chemin"]: a for a in manifest["artefacts"]}
        totaux = manifest["totaux"]
        assert par_chemin["data/classes.json"]["nb_enregistrements"] == totaux["nb_classes"]
        assert (
            par_chemin["data/sorts/"]["nb_enregistrements"]
            == totaux["nb_fichiers_sorts"]
        )
        assert (
            par_chemin["data/index/sorts_uniques.jsonl"]["nb_enregistrements"]
            == totaux["nb_sorts_uniques"]
        )
        assert (
            par_chemin["data/listes_classes/"]["nb_enregistrements"]
            == totaux["nb_entrees_listes"]
        )
        assert par_chemin["cache/html/"]["nb_enregistrements"] == totaux["nb_pages_cache"]

    def test_manifeste_regenere_donne_les_memes_totaux(
        self, repo_root: Path, manifest: dict
    ) -> None:
        # Idempotence: only `genere_le` may move between two runs.
        frais = build_manifest.construire_manifeste(repo_root)
        assert frais["totaux"] == manifest["totaux"]
        assert frais["artefacts"] == manifest["artefacts"]


class TestGenerateur:
    def test_ecriture_respecte_les_regles_de_format(self, tmp_path: Path) -> None:
        cible = tmp_path / "sous" / "MANIFEST.json"
        build_manifest.ecrire_manifeste(cible, {"clé": "école"})
        octets = cible.read_bytes()
        assert octets == '{\n  "clé": "école"\n}\n'.encode()

    def test_chemins_manquants_detecte_les_absences(self, tmp_path: Path) -> None:
        manifeste = {"artefacts": [{"chemin": "data/absent.json"}]}
        assert build_manifest.chemins_manquants(tmp_path, manifeste) == [
            "data/absent.json"
        ]

    def test_racine_vide_ne_leve_pas(self, tmp_path: Path) -> None:
        # A fresh clone with no data yet must still produce a well-formed manifest.
        manifeste = build_manifest.construire_manifeste(tmp_path)
        assert manifeste["totaux"]["nb_fichiers_sorts"] == 0
        assert len(manifeste["artefacts"]) == 12

    def test_nb_entrees_json_tableau_et_objet(self, tmp_path: Path) -> None:
        tableau = tmp_path / "a.json"
        tableau.write_text("[1, 2, 3]", encoding="utf-8")
        assert build_manifest._nb_entrees_json(tableau) == 3
        objet = tmp_path / "b.json"
        objet.write_text('{"par_classe": {"x": 1, "y": 2}}', encoding="utf-8")
        assert build_manifest._nb_entrees_json(objet) == 2
        scalaire = tmp_path / "c.json"
        scalaire.write_text('{"genere_le": "x"}', encoding="utf-8")
        assert build_manifest._nb_entrees_json(scalaire) == 1

    def test_dry_run_n_ecrit_rien(self, repo_root: Path, tmp_path: Path) -> None:
        sortie = tmp_path / "MANIFEST.json"
        code = build_manifest.main(
            ["--racine", str(repo_root), "--sortie", str(sortie), "--dry-run"]
        )
        assert code == 0
        assert not sortie.exists()

    def test_main_ecrit_a_la_sortie_demandee(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        sortie = tmp_path / "MANIFEST.json"
        assert build_manifest.main(
            ["--racine", str(repo_root), "--sortie", str(sortie)]
        ) == 0
        assert json.loads(sortie.read_text(encoding="utf-8"))["totaux"]["nb_classes"] == 19

    def test_main_signale_les_chemins_manquants(self, tmp_path: Path) -> None:
        # Nothing exists under an empty root, so the run must fail loudly.
        assert build_manifest.main(
            ["--racine", str(tmp_path), "--sortie", str(tmp_path / "m.json")]
        ) == 1
