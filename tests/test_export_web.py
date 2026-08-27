"""Tests for the corpus -> web artefact export.

Three layers. `TestSurLaFixture` runs the exporter against the frozen 24-spell
fixture, where every edge case is present by construction and cheap to assert.
`TestSurLeCorpusReel` runs it against the 2070 committed spells, because an
exporter that only works on a fixture guards nothing. `TestSansCoucheLLM` and
`TestDefauts` cover the two ways this can go wrong in production: the optional
enrichment layer being absent, and the corpus disagreeing with itself.

The determinism tests are not stylistic. Step 10 re-runs the export in CI and
fails when the bytes differ from what is committed — that is the check which
catches a corpus corrected without a re-export. If the exporter is not
byte-stable, that check cries wolf on every run and gets switched off.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any

import jsonschema
import pytest

from pf_spells.export_web import (
    VERSION_CONTRAT,
    ExportWebError,
    construire,
    desaccords_de,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "web_corpus"
HORODATAGE = "2026-07-31T00:00:00+00:00"


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    chemin = REPO_ROOT / "data" / "schemas" / "web_index.schema.json"
    contrat = json.loads(chemin.read_text(encoding="utf-8"))
    # A schema that is not itself valid would make every assertion below vacuous.
    jsonschema.Draft202012Validator.check_schema(contrat)
    return contrat


def exporter(sortie: Path, racine: Path = FIXTURE, **kwargs: Any) -> dict[str, Any]:
    return construire(
        racine, sortie, avec_preflight=False, genere_le=HORODATAGE, **kwargs
    )


@pytest.fixture(scope="module")
def export_fixture(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict]:
    sortie = tmp_path_factory.mktemp("export_fixture")
    rapport = exporter(sortie)
    return sortie, rapport


@pytest.fixture(scope="module")
def index_fixture(export_fixture: tuple[Path, dict]) -> dict[str, Any]:
    sortie, _ = export_fixture
    return json.loads((sortie / "index.json").read_text(encoding="utf-8"))


class TestSurLaFixture:
    def test_le_rapport_compte_ce_qui_a_ete_ecrit(
        self, export_fixture: tuple[Path, dict]
    ) -> None:
        _, rapport = export_fixture
        assert rapport["nb_sorts"] == 24
        assert rapport["nb_classes"] == 3
        assert rapport["couche_enrichissement"] is True

    def test_l_index_valide_contre_le_contrat(
        self, index_fixture: dict, schema: dict
    ) -> None:
        erreurs = list(jsonschema.Draft202012Validator(schema).iter_errors(index_fixture))
        assert erreurs == [], [e.message for e in erreurs[:3]]

    def test_la_version_du_contrat_est_declaree(self, index_fixture: dict) -> None:
        assert index_fixture["version"] == VERSION_CONTRAT

    def test_bijection_slug_fichier_de_props(
        self, export_fixture: tuple[Path, dict], index_fixture: dict
    ) -> None:
        """Every index entry has props, and no props file is an orphan.

        A missing props file is a 404 on a page the index advertises; an orphan is
        dead weight shipped to every visitor.
        """
        sortie, _ = export_fixture
        slugs = {s["s"] for s in index_fixture["sorts"]}
        fichiers = {p.stem for p in (sortie / "sorts").glob("*.json")}
        assert slugs == fichiers

    def test_aucun_niv_n_est_un_entier(self, index_fixture: dict) -> None:
        """B4, asserted directly: the level is relative to the class, always.

        This is the single constraint most easily broken by inadvertence and the
        most expensive to repair, because flattening it here makes the correct UI
        impossible downstream.
        """
        for sort in index_fixture["sorts"]:
            assert isinstance(sort["niv"], dict), sort["s"]
            assert sort["niv"], sort["s"]
            for slug, niveau in sort["niv"].items():
                assert isinstance(slug, str)
                assert isinstance(niveau, int) and not isinstance(niveau, bool)

    def test_l_index_dense_est_bien_dense(self, index_fixture: dict) -> None:
        codes = [s["i"] for s in index_fixture["sorts"]]
        assert codes == list(range(len(codes)))

    def test_les_slugs_sont_uniques(self, index_fixture: dict) -> None:
        slugs = [s["s"] for s in index_fixture["sorts"]]
        assert len(slugs) == len(set(slugs))

    def test_tout_code_reference_existe_dans_sa_table(self, index_fixture: dict) -> None:
        """A dangling code renders as a blank filter chip with no way to notice."""
        for sort in index_fixture["sorts"]:
            if sort["e"] is not None:
                assert 0 <= sort["e"] < len(index_fixture["ecoles"])
            if sort["p"] is not None:
                assert 0 <= sort["p"] < len(index_fixture["portees"])
            if sort["j"] is not None:
                assert 0 <= sort["j"] < len(index_fixture["jets"])
            for code in sort["c"]:
                assert 0 <= code < len(index_fixture["composantes"])
            for code in sort["t"]:
                assert 0 <= code < len(index_fixture["tags"])
            if sort["ti"] is not None:
                assert 0 <= sort["ti"] < len(index_fixture["temps_incantation"])

    def test_les_classes_de_niv_sont_declarees_en_tete(self, index_fixture: dict) -> None:
        declarees = {c["slug"] for c in index_fixture["classes"]}
        for sort in index_fixture["sorts"]:
            assert set(sort["niv"]) <= declarees, sort["s"]

    def test_les_tables_de_codes_sont_triees(self, index_fixture: dict) -> None:
        """Sorted tables are what make the codes deterministic run to run."""
        for cle in ("ecoles", "portees", "jets", "composantes", "tags", "temps_incantation"):
            assert index_fixture[cle] == sorted(index_fixture[cle]), cle

    def test_le_temps_d_incantation_de_la_fixture_couvre_plusieurs_familles(
        self, index_fixture: dict
    ) -> None:
        """The fixture's spread of source values must survive the fold as more
        than one family, or the facet would filter on nothing."""
        familles = {
            index_fixture["temps_incantation"][s["ti"]]
            for s in index_fixture["sorts"]
            if s["ti"] is not None
        }
        assert familles == {"action_simple", "round", "minute", "heure"}

    def test_les_sorts_sont_tries_par_id(self, index_fixture: dict) -> None:
        ids = [s["id"] for s in index_fixture["sorts"]]
        assert ids == sorted(ids)

    def test_le_desaccord_de_la_fixture_est_signale(self, index_fixture: dict) -> None:
        """The fixture's one synthetic disagreement must surface as `d: true`."""
        marques = [s["s"] for s in index_fixture["sorts"] if s["d"]]
        assert marques == ["detection-de-la-magie"]

    def test_le_detail_du_desaccord_est_dans_les_props(
        self, export_fixture: tuple[Path, dict]
    ) -> None:
        """The index carries a boolean to filter on; the fiche needs who-said-what."""
        sortie, _ = export_fixture
        props = json.loads(
            (sortie / "sorts" / "detection-de-la-magie.json").read_text(encoding="utf-8")
        )
        assert len(props["desaccords"]) == 1
        ecart = props["desaccords"][0]
        assert ecart["slug"] == "barde"
        assert ecart["niveau_liste"] != ecart["niveau_page"]
        assert ecart["niveau_liste"] is not None
        assert ecart["niveau_page"] is not None

    def test_un_sort_sans_desaccord_a_une_liste_vide(
        self, export_fixture: tuple[Path, dict]
    ) -> None:
        sortie, _ = export_fixture
        props = json.loads(
            (sortie / "sorts" / "conscience-accrue.json").read_text(encoding="utf-8")
        )
        assert props["desaccords"] == []

    def test_les_props_portent_les_21_cles_du_corpus_plus_le_derive(
        self, export_fixture: tuple[Path, dict]
    ) -> None:
        sortie, _ = export_fixture
        props = json.loads(
            (sortie / "sorts" / "conscience-accrue.json").read_text(encoding="utf-8")
        )
        # The scraped keys pass through verbatim so a human can diff a props file
        # against data/sorts/<id>.json and see the same shape.
        for cle in ("id", "nom", "ecole", "description", "meta", "classes", "niveaux"):
            assert cle in props
        for cle in ("slug", "url_source", "niveaux_par_classe", "desaccords", "enrichissement"):
            assert cle in props

    def test_le_lien_vers_la_source_est_absolu_et_pointe_vers_le_wiki(
        self, export_fixture: tuple[Path, dict], index_fixture: dict
    ) -> None:
        """B8: the link back is a commitment, so it is checked on every spell."""
        sortie, _ = export_fixture
        for sort in index_fixture["sorts"]:
            props = json.loads(
                (sortie / "sorts" / f"{sort['s']}.json").read_text(encoding="utf-8")
            )
            assert props["url_source"].startswith("https://www.pathfinder-fr.org/")

    def test_les_niveaux_par_classe_portent_le_libelle(
        self, export_fixture: tuple[Path, dict]
    ) -> None:
        sortie, _ = export_fixture
        props = json.loads(
            (sortie / "sorts" / "detection-de-la-magie.json").read_text(encoding="utf-8")
        )
        for slug, detail in props["niveaux_par_classe"].items():
            assert detail["nom"]
            assert isinstance(detail["niveau"], int)

    def test_un_sort_partage_par_trois_classes_porte_trois_niveaux(
        self, index_fixture: dict
    ) -> None:
        partages = [s for s in index_fixture["sorts"] if len(s["niv"]) == 3]
        assert partages, "la fixture doit contenir un sort partagé par les 3 classes"

    def test_le_nom_plie_est_coherent_avec_le_nom(self, index_fixture: dict) -> None:
        from pf_spells.web_pliage import plier

        for sort in index_fixture["sorts"]:
            assert sort["nf"] == plier(sort["n"]), sort["s"]


class TestDeterminisme:
    def test_deux_exports_donnent_les_memes_octets(self, tmp_path: Path) -> None:
        a, b = tmp_path / "a", tmp_path / "b"
        exporter(a)
        exporter(b)
        assert (a / "index.json").read_bytes() == (b / "index.json").read_bytes()
        for fichier in sorted((a / "sorts").glob("*.json")):
            jumeau = b / "sorts" / fichier.name
            assert fichier.read_bytes() == jumeau.read_bytes(), fichier.name

    def test_seul_l_horodatage_varie_sans_valeur_figee(self, tmp_path: Path) -> None:
        """Without --genere-le the only difference must still be the timestamp."""
        a, b = tmp_path / "a", tmp_path / "b"
        construire(FIXTURE, a, avec_preflight=False)
        construire(FIXTURE, b, avec_preflight=False)
        gauche = json.loads((a / "index.json").read_text(encoding="utf-8"))
        droite = json.loads((b / "index.json").read_text(encoding="utf-8"))
        gauche.pop("genere_le")
        droite.pop("genere_le")
        assert gauche == droite

    def test_les_fichiers_sont_en_lf_sans_bom(self, tmp_path: Path) -> None:
        """LF on win32 too, or the drift check fails on the developer's machine."""
        sortie = tmp_path / "out"
        exporter(sortie)
        for chemin in [sortie / "index.json", *(sortie / "sorts").glob("*.json")]:
            octets = chemin.read_bytes()
            assert not octets.startswith(b"\xef\xbb\xbf"), chemin.name
            assert b"\r\n" not in octets, chemin.name

    def test_aucun_u_fffd_dans_la_sortie(self, tmp_path: Path) -> None:
        sortie = tmp_path / "out"
        exporter(sortie)
        remplacement = chr(0xFFFD)
        for chemin in [sortie / "index.json", *(sortie / "sorts").glob("*.json")]:
            assert remplacement not in chemin.read_text(encoding="utf-8"), chemin.name


class TestSansCoucheLLM:
    """The enrichment layer is strictly optional; the site works without it."""

    @pytest.fixture
    def corpus_sans_enrichissement(self, tmp_path: Path) -> Path:
        import shutil

        racine = tmp_path / "corpus"
        shutil.copytree(FIXTURE, racine)
        shutil.rmtree(racine / "data" / "enrichissements")
        return racine

    def test_l_export_reussit_sans_le_dossier(
        self, corpus_sans_enrichissement: Path, tmp_path: Path
    ) -> None:
        sortie = tmp_path / "out"
        rapport = exporter(sortie, racine=corpus_sans_enrichissement)
        assert rapport["nb_sorts"] == 24
        assert rapport["couche_enrichissement"] is False
        assert rapport["nb_enrichis"] == 0

    def test_tags_est_vide_et_chaque_t_est_vide(
        self, corpus_sans_enrichissement: Path, tmp_path: Path, schema: dict
    ) -> None:
        """Empty `tags` is the signal the UI uses to hide the tag filter entirely."""
        sortie = tmp_path / "out"
        exporter(sortie, racine=corpus_sans_enrichissement)
        index = json.loads((sortie / "index.json").read_text(encoding="utf-8"))
        assert index["tags"] == []
        assert all(s["t"] == [] for s in index["sorts"])
        # Still a valid index: absence of the layer is a supported state, not a defect.
        assert list(jsonschema.Draft202012Validator(schema).iter_errors(index)) == []

    def test_l_enrichissement_des_props_est_nul(
        self, corpus_sans_enrichissement: Path, tmp_path: Path
    ) -> None:
        sortie = tmp_path / "out"
        exporter(sortie, racine=corpus_sans_enrichissement)
        props = json.loads(
            (sortie / "sorts" / "conscience-accrue.json").read_text(encoding="utf-8")
        )
        assert props["enrichissement"] is None


class TestDesaccords:
    def test_concordance_fausse_est_un_desaccord(self) -> None:
        sort = {
            "classes": [
                {"classe": "Barde", "slug": "barde", "niveau": 2, "niveau_page": 3,
                 "concordance": False}
            ]
        }
        assert desaccords_de(sort) == [
            {"classe": "Barde", "slug": "barde", "niveau_liste": 2, "niveau_page": 3}
        ]

    def test_concordance_nulle_n_est_PAS_un_desaccord(self) -> None:
        """A non-comparable pair is a gap in the source, not an audit finding.

        The corpus has 518 of these. Reporting them as disagreements would invent
        512 findings the audit never made.
        """
        sort = {
            "classes": [
                {"classe": "Barde", "slug": "barde", "niveau": 2, "niveau_page": None,
                 "concordance": None}
            ]
        }
        assert desaccords_de(sort) == []

    def test_concordance_vraie_n_est_pas_un_desaccord(self) -> None:
        sort = {
            "classes": [
                {"classe": "Barde", "slug": "barde", "niveau": 2, "niveau_page": 2,
                 "concordance": True}
            ]
        }
        assert desaccords_de(sort) == []


class TestDefauts:
    def test_un_sort_de_l_index_absent_du_disque_est_bloquant(
        self, tmp_path: Path
    ) -> None:
        import shutil

        racine = tmp_path / "corpus"
        shutil.copytree(FIXTURE, racine)
        (racine / "data" / "sorts" / "conscience-accrue.json").unlink()
        with pytest.raises(ExportWebError, match="absent du disque"):
            exporter(tmp_path / "out", racine=racine)

    def test_un_sort_sans_niveau_de_classe_est_bloquant(self, tmp_path: Path) -> None:
        """An empty `niv` violates the contract; rendering it would show no level."""
        import shutil

        racine = tmp_path / "corpus"
        shutil.copytree(FIXTURE, racine)
        for chemin in (racine / "data" / "listes_classes").glob("*.jsonl"):
            lignes = [
                l
                for l in chemin.read_text(encoding="utf-8").splitlines()
                if l.strip() and json.loads(l)["id"] != "conscience-accrue"
            ]
            chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8", newline="\n")
        with pytest.raises(ExportWebError, match="aucun niveau de classe"):
            exporter(tmp_path / "out", racine=racine)

    def test_un_u_fffd_dans_le_corpus_est_bloquant(self, tmp_path: Path) -> None:
        import shutil

        racine = tmp_path / "corpus"
        shutil.copytree(FIXTURE, racine)
        cible = racine / "data" / "sorts" / "conscience-accrue.json"
        document = json.loads(cible.read_text(encoding="utf-8"))
        document["description"] = "corrompu " + chr(0xFFFD)
        cible.write_text(
            json.dumps(document, ensure_ascii=False), encoding="utf-8", newline="\n"
        )
        with pytest.raises(ExportWebError, match="U\\+FFFD"):
            exporter(tmp_path / "out", racine=racine)

    def test_un_index_vide_est_bloquant(self, tmp_path: Path) -> None:
        import shutil

        racine = tmp_path / "corpus"
        shutil.copytree(FIXTURE, racine)
        (racine / "data" / "index" / "sorts_uniques.jsonl").write_text(
            "", encoding="utf-8", newline="\n"
        )
        with pytest.raises(ExportWebError, match="vide"):
            exporter(tmp_path / "out", racine=racine)


class TestSurLeCorpusReel:
    """The export must hold on the 2070 committed spells, not just the fixture."""

    @pytest.fixture(scope="class")
    def export_reel(self, tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict]:
        sortie = tmp_path_factory.mktemp("export_reel")
        rapport = construire(
            REPO_ROOT, sortie, avec_preflight=False, genere_le=HORODATAGE
        )
        return sortie, rapport

    def test_les_2070_sorts_sont_exportes(self, export_reel: tuple[Path, dict]) -> None:
        _, rapport = export_reel
        assert rapport["nb_sorts"] == 2070
        assert rapport["nb_classes"] == 19

    def test_l_index_reel_valide_contre_le_contrat(
        self, export_reel: tuple[Path, dict], schema: dict
    ) -> None:
        sortie, _ = export_reel
        index = json.loads((sortie / "index.json").read_text(encoding="utf-8"))
        erreurs = list(jsonschema.Draft202012Validator(schema).iter_errors(index))
        assert erreurs == [], [e.message for e in erreurs[:3]]

    def test_la_taille_gzip_rapportee_est_exacte(
        self, export_reel: tuple[Path, dict]
    ) -> None:
        # No ceiling is asserted: weight is reported, never enforced. What is still
        # worth pinning is that the reported number describes the file actually
        # written — a report that drifts from its artefact is misinformation.
        sortie, rapport = export_reel
        octets = (sortie / "index.json").read_text(encoding="utf-8").encode("utf-8")
        mesure = len(gzip.compress(octets, mtime=0))
        assert mesure == rapport["taille_index_gzip"]

    def test_bijection_sur_le_corpus_reel(self, export_reel: tuple[Path, dict]) -> None:
        sortie, _ = export_reel
        index = json.loads((sortie / "index.json").read_text(encoding="utf-8"))
        slugs = {s["s"] for s in index["sorts"]}
        fichiers = {p.stem for p in (sortie / "sorts").glob("*.json")}
        assert slugs == fichiers
        assert len(slugs) == 2070

    def test_aucun_niv_vide_sur_le_corpus_reel(
        self, export_reel: tuple[Path, dict]
    ) -> None:
        sortie, _ = export_reel
        index = json.loads((sortie / "index.json").read_text(encoding="utf-8"))
        assert all(isinstance(s["niv"], dict) and s["niv"] for s in index["sorts"])

    def test_le_corpus_reel_ne_porte_aucun_desaccord(
        self, export_reel: tuple[Path, dict]
    ) -> None:
        """Documents the state of the corpus, and pins it as a signal.

        All 8409 comparable pairs concord today (CLAUDE.md § 9). This test failing
        does NOT mean the exporter broke — it means the corpus grew its first real
        disagreement, which is exactly what the `d` flag exists to surface. Read
        the new value before touching this assertion.
        """
        _, rapport = export_reel
        assert rapport["nb_desaccords"] == 0

    def test_la_couche_llm_couvre_ce_qu_elle_couvre(
        self, export_reel: tuple[Path, dict]
    ) -> None:
        _, rapport = export_reel
        assert rapport["couche_enrichissement"] is True
        # 2048 of 2070: the 22 uncovered spells are a fact of the paid pass, not a
        # defect, and the site renders them without an enrichment section.
        assert rapport["nb_enrichis"] == 2048

    def test_data_n_est_jamais_modifie(self, export_reel: tuple[Path, dict]) -> None:
        """The exporter reads the corpus; it must never write to it."""
        import subprocess

        sortie = subprocess.run(
            ["git", "status", "--porcelain", "--", "data/"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        assert sortie.strip() == "", sortie
