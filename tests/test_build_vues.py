"""Tests for the derived joined view.

The step's criteria are the spine of this file: the three statuses on the frozen
`mini_corpus`, the 21 spell keys copied verbatim key by key, byte-level idempotence,
no write under `data/sorts/` or `data/enrichissements/`, and no U+FFFD in the output.

Harness decisions worth stating:

* The fixture trees are **frozen and belong to other steps**. `mini_corpus` is never
  written to, and `tests/fixtures/enrichissements/` is copied — its records are
  staged into a tmp directory under their production name `<id>.json`, which is the
  on-disk contract the join enforces (the fixtures are named descriptively, which is
  right for schema tests and is not that contract).
* `mini_corpus` is a valid `racine` for the data it holds but is not a repo — no
  `tools/`, no `src/`, no Skill — so `preflight=False` is used there, exactly as
  `test_echantillon_taxo` does. The guard itself is tested separately, on a tree
  where it can legitimately fail.
* The schema and the closed vocabularies come from the real repo via
  `racine_conventions`: they are frozen repo-level artefacts, and giving the fixture
  a copy is the duplication `data/conventions/vocabulaires/` exists to prevent.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from pf_spells import build_vues as bv

# The 21 Phase 1 keys, in canonical order. Restated here rather than imported from
# the module under test: a test that reads its expectation out of the code it checks
# proves only self-consistency.
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

# fixture file -> the status the joined view must carry for its id.
MISE_EN_SCENE: tuple[tuple[str, str], ...] = (
    ("valide_degats_avec_preuve.json", bv.STATUT_OK),
    ("valide_avec_note_ambiguite.json", bv.STATUT_OK),
    ("invalide_resume_trop_long.json", bv.STATUT_INVALIDE),
)

REMPLACEMENT = chr(0xFFFD)


@pytest.fixture(scope="module")
def mini_corpus(repo_root: Path) -> Path:
    return repo_root / "tests" / "fixtures" / "mini_corpus"


@pytest.fixture(scope="module")
def sorts_dir(mini_corpus: Path) -> Path:
    return mini_corpus / "data" / "sorts"


@pytest.fixture(scope="module")
def fixtures_enr(repo_root: Path) -> Path:
    return repo_root / "tests" / "fixtures" / "enrichissements"


def _charger(chemin: Path) -> Any:
    return json.loads(chemin.read_text(encoding="utf-8"))


def _poser_enrichissements(fixtures_enr: Path, destination: Path) -> dict[str, str]:
    """Stage the fixture records under their production name. Returns id -> status."""
    destination.mkdir(parents=True, exist_ok=True)
    attendus: dict[str, str] = {}
    for nom, statut in MISE_EN_SCENE:
        doc = _charger(fixtures_enr / nom)
        (destination / f"{doc['id']}.json").write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        attendus[doc["id"]] = statut
    return attendus


def _construire(
    repo_root: Path,
    mini_corpus: Path,
    fixtures_enr: Path,
    tmp_path: Path,
    **extra: Any,
) -> tuple[dict[str, Any], Path, dict[str, str]]:
    """Run a build of the fixture corpus into `tmp_path`. Nothing frozen is written."""
    enr = tmp_path / "enrichissements"
    attendus = _poser_enrichissements(fixtures_enr, enr)
    sortie = tmp_path / "vues"
    rapport = bv.run(
        mini_corpus,
        sortie=sortie,
        enrichissements=enr,
        racine_conventions=repo_root,
        preflight=False,
        **extra,
    )
    return rapport, sortie, attendus


class TestLesTroisStatutsSurLeMiniCorpus:
    """The step's first criterion, stated exactly as written."""

    def test_douze_vues_dont_les_trois_statuts(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        rapport, sortie, attendus = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        vues = sorted(c for c in sortie.glob("*.json") if c.name != bv.FICHIER_RAPPORT)
        assert len(vues) == 12

        statuts = {c.stem: _charger(c)["statut_enrichissement"] for c in vues}
        assert set(statuts.values()) == set(bv.STATUTS), statuts
        for identifiant, statut in attendus.items():
            assert statuts[identifiant] == statut, identifiant
        assert rapport["ok"] >= 1
        assert rapport["sans_enrichissement"] >= 1
        assert rapport["enrichissement_invalide"] >= 1

    def test_un_enrichissement_absent_laisse_la_couche_nulle(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, attendus = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        orphelines = [
            c
            for c in sortie.glob("*.json")
            if c.name != bv.FICHIER_RAPPORT and c.stem not in attendus
        ]
        assert orphelines
        for chemin in orphelines:
            vue = _charger(chemin)
            assert vue["statut_enrichissement"] == bv.STATUT_SANS
            assert vue["enrichissement"] is None

    def test_un_enrichissement_valide_est_recopie_a_l_identique(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        attendu = _charger(fixtures_enr / "valide_degats_avec_preuve.json")
        vue = _charger(sortie / f"{attendu['id']}.json")
        assert vue["statut_enrichissement"] == bv.STATUT_OK
        assert vue["enrichissement"] == attendu

    def test_un_invalide_est_rapporte_avec_ses_fautes_et_sa_couche_tombee(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        """Reported, never repaired, and never merged in half."""
        rapport, sortie, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        doc = _charger(fixtures_enr / "invalide_resume_trop_long.json")
        vue = _charger(sortie / f"{doc['id']}.json")
        assert vue["statut_enrichissement"] == bv.STATUT_INVALIDE
        assert vue["enrichissement"] is None
        entrees = [e for e in rapport["ids_invalides"] if e["id"] == doc["id"]]
        assert entrees and entrees[0]["erreurs"]
        assert any("resume_court" in e["champ"] for e in entrees[0]["erreurs"])

    def test_absence_et_invalidite_ne_sont_pas_confondues(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # Both leave the layer null; collapsing them would hide a generation defect
        # as a coverage gap. The distinction has to survive in the file itself.
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        doc = _charger(fixtures_enr / "invalide_resume_trop_long.json")
        invalide = _charger(sortie / f"{doc['id']}.json")
        sans = _charger(sortie / "arc-baton.json")
        assert invalide["enrichissement"] is sans["enrichissement"] is None
        assert invalide["statut_enrichissement"] != sans["statut_enrichissement"]

    def test_un_json_illisible_devient_invalide_sans_interrompre_la_construction(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        enr = tmp_path / "enrichissements"
        _poser_enrichissements(fixtures_enr, enr)
        (enr / "arc-baton.json").write_text("{ceci n est pas du JSON", encoding="utf-8")
        rapport = bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=enr,
            racine_conventions=repo_root,
            preflight=False,
        )
        assert rapport["total"] == 12
        vue = _charger(tmp_path / "vues" / "arc-baton.json")
        assert vue["statut_enrichissement"] == bv.STATUT_INVALIDE
        assert vue["enrichissement"] is None


class TestLesVingtEtUneClesSontIntactes:
    """The step's criterion: key-by-key comparison against the source file."""

    def test_chaque_vue_recopie_les_21_cles_a_l_identique(
        self,
        repo_root: Path,
        mini_corpus: Path,
        sorts_dir: Path,
        fixtures_enr: Path,
        tmp_path: Path,
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        for chemin in sortie.glob("*.json"):
            if chemin.name == bv.FICHIER_RAPPORT:
                continue
            source = _charger(sorts_dir / chemin.name)
            vue = _charger(chemin)
            assert set(source) == set(CLES_SORT), chemin.name
            for cle in CLES_SORT:
                assert vue[cle] == source[cle], f"{chemin.name}:{cle}"

    def test_l_ordre_des_cles_du_sort_est_preserve_et_la_vue_vient_apres(
        self,
        repo_root: Path,
        mini_corpus: Path,
        sorts_dir: Path,
        fixtures_enr: Path,
        tmp_path: Path,
    ) -> None:
        """Not sorted: "the scraped spell, then the generated box" is the artefact.

        Sorting would interleave `enrichissement` among the 21 keys and destroy the
        one distinction a consumer reads the file for.
        """
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        vue = _charger(sortie / "arc-baton.json")
        assert list(vue) == list(CLES_SORT) + list(bv.CLES_VUE)

    def test_aucune_cle_du_sort_n_est_renommee_ni_aplatie(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # The enrichment stays in its own box: none of its 16 keys may appear at the
        # top level of the view.
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        doc = _charger(fixtures_enr / "valide_degats_avec_preuve.json")
        vue = _charger(sortie / f"{doc['id']}.json")
        for cle in doc:
            if cle == "id":  # the join key, legitimately present on both sides
                continue
            assert cle not in set(vue) - {"enrichissement"}, cle

    def test_les_cinq_cles_de_vue_sont_exactement_celles_declarees(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        vue = _charger(sortie / "arc-baton.json")
        assert set(vue) - set(CLES_SORT) == set(bv.CLES_VUE)


class TestRapport:
    """Totals must agree with the files actually on disk."""

    def test_les_totaux_sont_coherents_avec_les_fichiers_produits(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        rapport, sortie, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        vues = [c for c in sortie.glob("*.json") if c.name != bv.FICHIER_RAPPORT]
        statuts = [_charger(c)["statut_enrichissement"] for c in vues]
        assert rapport["total"] == len(vues) == 12
        assert rapport["ok"] == statuts.count(bv.STATUT_OK)
        assert rapport["sans_enrichissement"] == statuts.count(bv.STATUT_SANS)
        assert rapport["enrichissement_invalide"] == statuts.count(bv.STATUT_INVALIDE)
        assert (
            rapport["ok"]
            + rapport["sans_enrichissement"]
            + rapport["enrichissement_invalide"]
            == rapport["total"]
        )

    def test_le_rapport_est_ecrit_dans_l_arbre_de_la_vue(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert (sortie / bv.FICHIER_RAPPORT).is_file()

    def test_les_ids_listes_correspondent_aux_statuts(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        rapport, sortie, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        for entree in rapport["ids_invalides"]:
            vue = _charger(sortie / f"{entree['id']}.json")
            assert vue["statut_enrichissement"] == bv.STATUT_INVALIDE
        for identifiant in rapport["ids_sans_enrichissement"]:
            vue = _charger(sortie / f"{identifiant}.json")
            assert vue["statut_enrichissement"] == bv.STATUT_SANS
        assert len(rapport["ids_sans_enrichissement"]) == rapport["sans_enrichissement"]
        assert len(rapport["ids_invalides"]) == rapport["enrichissement_invalide"]

    def test_le_rapport_est_serialisable_et_relisible(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        rapport, sortie, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path
        )
        assert _charger(sortie / bv.FICHIER_RAPPORT) == rapport


class TestIdempotence:
    """The step's criterion: two runs, identical files bar the timestamp."""

    def test_deux_executions_produisent_des_fichiers_identiques(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        sortie = tmp_path / "vues"
        avant = {c.name: c.read_bytes() for c in sorted(sortie.glob("*.json"))}
        _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        apres = {c.name: c.read_bytes() for c in sorted(sortie.glob("*.json"))}
        assert apres == avant

    def test_construit_le_est_nul_par_defaut(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # A wall clock written by default would make every file differ on every run
        # and drown the real diff. Same reasoning as stage 08's manifest.
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert _charger(sortie / "arc-baton.json")["construit_le"] is None
        assert _charger(sortie / bv.FICHIER_RAPPORT)["construit_le"] is None

    def test_horodater_renseigne_le_champ_sans_toucher_au_hash(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sans, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path / "a")
        _, avec, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path / "b", horodater=True
        )
        nu = _charger(sans / "arc-baton.json")
        date = _charger(avec / "arc-baton.json")
        assert nu["construit_le"] is None
        assert isinstance(date["construit_le"], str) and date["construit_le"]
        # Everything else — including the fingerprint — must be identical, which is
        # what makes `--horodater` safe to use without breaking the edit detector.
        assert {k: v for k, v in nu.items() if k != "construit_le"} == {
            k: v for k, v in date.items() if k != "construit_le"
        }

    def test_le_hash_du_sort_ne_depend_pas_de_l_ordre_des_cles(
        self, sorts_dir: Path
    ) -> None:
        source = _charger(sorts_dir / "arc-baton.json")
        melange = {cle: source[cle] for cle in reversed(list(source))}
        assert bv._hash_canonique(melange) == bv._hash_canonique(source)

    def test_le_hash_du_sort_change_avec_le_contenu(self, sorts_dir: Path) -> None:
        source = _charger(sorts_dir / "arc-baton.json")
        modifie = {**source, "duree": "concentration"}
        assert bv._hash_canonique(modifie) != bv._hash_canonique(source)

    def test_le_hash_de_vue_couvre_la_couche_enrichie(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        doc = _charger(fixtures_enr / "valide_degats_avec_preuve.json")
        vue = _charger(sortie / f"{doc['id']}.json")
        assert vue["hash_vue"] == bv.hash_vue(vue)
        altere = {**vue, "statut_enrichissement": bv.STATUT_SANS}
        assert bv.hash_vue(altere) != vue["hash_vue"]


class TestDeriveEtEditionManuelle:
    """`data/vues/` is derived: a hand edit is refused, loudly, not overwritten."""

    def test_une_vue_modifiee_a_la_main_est_laissee_intacte_et_signalee(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        cible = sortie / "arc-baton.json"
        vue = _charger(cible)
        vue["nom"] = "Arc-bâton retouché à la main"
        cible.write_text(
            json.dumps(vue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        avant = cible.read_bytes()

        rapport, _, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert rapport["vues_protegees"] == ["arc-baton"]
        assert cible.read_bytes() == avant

    def test_force_ecrase_la_vue_modifiee(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        cible = sortie / "arc-baton.json"
        attendu = cible.read_bytes()
        cible.write_text('{"bricolage": true}\n', encoding="utf-8")

        rapport, _, _ = _construire(
            repo_root, mini_corpus, fixtures_enr, tmp_path, force=True
        )
        assert rapport["vues_protegees"] == []
        assert cible.read_bytes() == attendu

    def test_une_vue_sans_empreinte_est_traitee_comme_modifiee(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # A file this builder did not write has no `hash_vue`; overwriting it
        # silently is exactly the data loss the guard exists to prevent.
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        cible = sortie / "arc-baton.json"
        vue = _charger(cible)
        del vue["hash_vue"]
        cible.write_text(
            json.dumps(vue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        rapport, _, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert "arc-baton" in rapport["vues_protegees"]

    def test_une_vue_intacte_n_est_jamais_signalee(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        rapport, _, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert rapport["vues_protegees"] == []
        assert rapport["ecrits"] == 12


class TestNEcritQueDansLArbreDeLaVue:
    """The step's criterion: `git status` is clean for the two input trees."""

    def test_git_status_des_entrees_est_inchange_apres_un_run(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        chemins = ["data/sorts", "data/enrichissements", "tests/fixtures"]

        def _statut() -> str:
            return subprocess.run(
                ["git", "status", "--porcelain", "--", *chemins],
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=True,
            ).stdout

        avant = _statut()
        _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        apres = _statut()
        assert apres == avant
        assert apres.strip() == "", apres

    def test_le_module_n_ecrit_que_par_ecrire(self, repo_root: Path) -> None:
        """A run that happens to write nothing proves little; the shape does.

        Every write goes through `ecrire`, and `ecrire` is called exactly twice: the
        per-spell view and the report. A third call site is a design change that
        must be seen in review.
        """
        source = (repo_root / "src" / "pf_spells" / "build_vues.py").read_text(
            encoding="utf-8"
        )
        appels = [
            ligne
            for ligne in source.splitlines()
            if "ecrire(" in ligne and "def ecrire" not in ligne
        ]
        assert len(appels) == 2, appels
        assert source.count("write_text(") == 1
        for interdit in ("shutil.", "os.remove", "os.rmdir", "unlink(", "rmtree"):
            assert source.count(interdit) == 0, interdit

    def test_aucun_chemin_d_ecriture_ne_vise_les_entrees(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        enr = tmp_path / "enrichissements"
        _poser_enrichissements(fixtures_enr, enr)
        empreintes = {
            chemin: chemin.read_bytes()
            for chemin in list((mini_corpus / "data").rglob("*"))
            + list(enr.glob("*.json"))
            if chemin.is_file()
        }
        bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=enr,
            racine_conventions=repo_root,
            preflight=False,
        )
        assert {c: c.read_bytes() for c in empreintes} == empreintes

    def test_la_sortie_par_defaut_est_l_arbre_derive(self) -> None:
        assert bv.DEFAULT_SORTIE == "data/vues/sorts_enrichis"


class TestEncodage:
    def test_aucun_u_fffd_dans_la_sortie(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        for chemin in sortie.glob("*.json"):
            assert REMPLACEMENT not in chemin.read_text(encoding="utf-8"), chemin.name

    def test_les_vues_sont_utf8_lf_sans_bom_avec_newline_final(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        for chemin in sortie.glob("*.json"):
            octets = chemin.read_bytes()
            assert not octets.startswith(b"\xef\xbb\xbf"), chemin.name
            assert b"\r" not in octets, chemin.name
            assert octets.endswith(b"\n"), chemin.name
            octets.decode("utf-8")

    def test_les_accents_sont_verbatim_jamais_echappes(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        texte = (sortie / "arc-baton.json").read_text(encoding="utf-8")
        assert "\\u00e2" not in texte
        assert "bâton" in texte

    def test_un_u_fffd_dans_un_sort_source_abandonne_sans_rien_ecrire(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        faux = tmp_path / "corpus"
        (faux / "data" / "index").mkdir(parents=True)
        (faux / "data" / "index" / "sorts_uniques.jsonl").write_text(
            json.dumps({"id": "sort-corrompu"}, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        sorts = faux / "data" / "sorts"
        sorts.mkdir()
        (sorts / "sort-corrompu.json").write_text(
            json.dumps({"id": "sort-corrompu", "nom": REMPLACEMENT}, ensure_ascii=False),
            encoding="utf-8",
        )
        with pytest.raises(bv.BuildVuesError, match="U\\+FFFD"):
            bv.run(
                faux,
                sortie=tmp_path / "vues",
                enrichissements=tmp_path / "vide",
                racine_conventions=repo_root,
                preflight=False,
            )
        assert not (tmp_path / "vues").exists()

    def test_la_verification_finale_relit_les_octets_produits(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # The guard must read what was WRITTEN, not what was read: a corruption
        # introduced mid-build is only observable in the output bytes.
        _, sortie, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        (sortie / "arc-baton.json").write_text(
            json.dumps({"id": REMPLACEMENT}, ensure_ascii=False), encoding="utf-8"
        )
        with pytest.raises(bv.BuildVuesError, match="U\\+FFFD"):
            bv._verifier_absence_de_remplacement(sortie, ["arc-baton"])


class TestGardesDEntree:
    def test_le_preflight_bloquant_arrete_la_construction(self, tmp_path: Path) -> None:
        with pytest.raises(bv.BuildVuesError, match="garde d'entrée introuvable"):
            bv.run(tmp_path, sortie=tmp_path / "vues")

    def test_le_preflight_echoue_sur_le_mini_corpus(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        # Documented reason for `--sans-preflight`: the fixture holds valid data but
        # is not a repo — no tools/, no src/, no Skill — so the guard cannot pass.
        assert not (mini_corpus / "tools").exists()
        with pytest.raises(bv.BuildVuesError):
            bv.run(
                mini_corpus,
                sortie=tmp_path / "vues",
                racine_conventions=repo_root,
            )

    def test_le_preflight_du_depot_reel_passe(self, repo_root: Path) -> None:
        # The guard must not be a permanent obstacle on the tree it was written for.
        bv.lancer_preflight(repo_root)

    def test_un_index_absent_est_un_abandon_explicite(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        (tmp_path / "data" / "sorts").mkdir(parents=True)
        with pytest.raises(bv.BuildVuesError, match="index absent"):
            bv.run(
                tmp_path,
                sortie=tmp_path / "vues",
                racine_conventions=repo_root,
                preflight=False,
            )

    def test_un_repertoire_de_sorts_absent_est_un_abandon_explicite(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        with pytest.raises(bv.BuildVuesError, match="répertoire des sorts absent"):
            bv.run(
                mini_corpus,
                sortie=tmp_path / "vues",
                sorts=tmp_path / "nulle-part",
                racine_conventions=repo_root,
                preflight=False,
            )

    def test_un_sort_de_l_index_sans_fichier_est_un_abandon(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        faux = tmp_path / "corpus"
        (faux / "data" / "index").mkdir(parents=True)
        (faux / "data" / "index" / "sorts_uniques.jsonl").write_text(
            json.dumps({"id": "sort-fantome"}) + "\n", encoding="utf-8"
        )
        (faux / "data" / "sorts").mkdir()
        with pytest.raises(bv.BuildVuesError, match="sans fichier"):
            bv.run(
                faux,
                sortie=tmp_path / "vues",
                racine_conventions=repo_root,
                preflight=False,
            )

    def test_un_enrichissement_orphelin_est_une_erreur_pas_un_avertissement(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        # The Skill: an id absent from data/index/ is an error. A view built around
        # it would be silently incomplete, which is what a shared join must not be.
        enr = tmp_path / "enrichissements"
        _poser_enrichissements(fixtures_enr, enr)
        doc = _charger(fixtures_enr / "valide_degats_avec_preuve.json")
        (enr / "sort-qui-n-existe-pas.json").write_text(
            json.dumps({**doc, "id": "sort-qui-n-existe-pas"}, ensure_ascii=False),
            encoding="utf-8",
        )
        with pytest.raises(bv.BuildVuesError, match="orphelin"):
            bv.run(
                mini_corpus,
                sortie=tmp_path / "vues",
                enrichissements=enr,
                racine_conventions=repo_root,
                preflight=False,
            )

    def test_only_hors_index_est_un_abandon(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        with pytest.raises(bv.BuildVuesError, match="--only hors de l'index"):
            bv.run(
                mini_corpus,
                sortie=tmp_path / "vues",
                enrichissements=tmp_path / "vide",
                racine_conventions=repo_root,
                preflight=False,
                seulement=["sort-inexistant"],
            )

    def test_only_restreint_la_construction(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        rapport = bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=tmp_path / "vide",
            racine_conventions=repo_root,
            preflight=False,
            seulement=["arc-baton"],
        )
        assert rapport["total"] == 1
        vues = {
            c.stem
            for c in (tmp_path / "vues").glob("*.json")
            if c.name != bv.FICHIER_RAPPORT
        }
        assert vues == {"arc-baton"}


class TestTaxonomieLueDepuisLesConventions:
    def test_aucune_liste_close_n_est_recopiee_dans_le_module(
        self, repo_root: Path
    ) -> None:
        """Anti-pattern #9: a duplicated closed list will drift.

        Validity is judged against the resolved schema, so a widened vocabulary
        needs no edit here. A real vocabulary key appearing literally in this module
        would mean someone hard-coded a list.
        """
        source = (repo_root / "src" / "pf_spells" / "build_vues.py").read_text(
            encoding="utf-8"
        )
        for nom in ("tags.json", "categories.json", "conditions.json"):
            doc = _charger(repo_root / "data" / "conventions" / "vocabulaires" / nom)
            presents = [e["cle"] for e in doc["valeurs"] if e["cle"] in source]
            assert presents == [], (nom, presents)

    def test_le_rapport_date_la_taxonomie_des_six_listes(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        from pf_spells.enrichissement_schema import etiquette_taxonomie

        rapport, _, _ = _construire(repo_root, mini_corpus, fixtures_enr, tmp_path)
        assert rapport["version_taxonomie"] == etiquette_taxonomie(repo_root)

    def test_un_tag_hors_liste_close_rend_l_enrichissement_invalide(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        enr = tmp_path / "enrichissements"
        enr.mkdir(parents=True)
        doc = _charger(fixtures_enr / "invalide_tag_inconnu.json")
        (enr / f"{doc['id']}.json").write_text(
            json.dumps(doc, ensure_ascii=False), encoding="utf-8"
        )
        bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=enr,
            racine_conventions=repo_root,
            preflight=False,
        )
        vue = _charger(tmp_path / "vues" / f"{doc['id']}.json")
        assert vue["statut_enrichissement"] == bv.STATUT_INVALIDE

    def test_une_valeur_de_v2_reste_valide_sans_toucher_au_module(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        """The v1/v2 promise: widening a list periments nothing."""
        enr = tmp_path / "enrichissements"
        enr.mkdir(parents=True)
        doc = _charger(fixtures_enr / "valide_avec_note_ambiguite.json")
        doc["condition_infligee"] = ["nauseeux"]
        (enr / f"{doc['id']}.json").write_text(
            json.dumps(doc, ensure_ascii=False), encoding="utf-8"
        )
        bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=enr,
            racine_conventions=repo_root,
            preflight=False,
        )
        vue = _charger(tmp_path / "vues" / f"{doc['id']}.json")
        assert vue["statut_enrichissement"] == bv.STATUT_OK, vue["statut_enrichissement"]


class TestPasDeSecondValidateurDePreuves:
    """Anti-pattern #4: the substring rule has exactly one implementation."""

    def test_le_module_ne_reimplemente_pas_la_verification_des_preuves(
        self, repo_root: Path
    ) -> None:
        source = (repo_root / "src" / "pf_spells" / "build_vues.py").read_text(
            encoding="utf-8"
        )
        assert "texte_source_canonique" not in source
        assert "CHAMPS" not in source
        assert "SEPARATEUR" not in source

    def test_une_preuve_confabulee_ne_degrade_pas_le_statut(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        """The view says "well-formed"; stage 10 says "grounded". Two jobs, two stages.

        A record whose evidence is invented is schema-valid, so it joins as `ok` here
        — deliberately. Making the view re-check evidence would put a second
        implementation of the substring rule next to stage 10's, and two divergent
        implementations of that rule is the failure the track exists to prevent.
        """
        enr = tmp_path / "enrichissements"
        enr.mkdir(parents=True)
        doc = _charger(fixtures_enr / "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = "un trait d'énergie totalement inventé"
        (enr / f"{doc['id']}.json").write_text(
            json.dumps(doc, ensure_ascii=False), encoding="utf-8"
        )
        bv.run(
            mini_corpus,
            sortie=tmp_path / "vues",
            enrichissements=enr,
            racine_conventions=repo_root,
            preflight=False,
        )
        vue = _charger(tmp_path / "vues" / f"{doc['id']}.json")
        assert vue["statut_enrichissement"] == bv.STATUT_OK


class TestHorsLigne:
    def test_le_module_n_importe_aucun_client_reseau(self, repo_root: Path) -> None:
        source = (repo_root / "src" / "pf_spells" / "build_vues.py").read_text(
            encoding="utf-8"
        )
        for interdit in ("boto3", "botocore", "urllib", "requests", "httpx", "socket"):
            assert interdit not in source, interdit


class TestCLI:
    def _argv(self, repo_root: Path, mini_corpus: Path, tmp_path: Path) -> list[str]:
        return [
            "--racine",
            str(mini_corpus),
            "--sortie",
            str(tmp_path / "vues"),
            "--enrichissements",
            str(tmp_path / "enrichissements"),
            "--racine-conventions",
            str(repo_root),
            "--sans-preflight",
        ]

    def test_un_run_nominal_sort_en_zero_et_resume(
        self,
        repo_root: Path,
        mini_corpus: Path,
        fixtures_enr: Path,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        _poser_enrichissements(fixtures_enr, tmp_path / "enrichissements")
        code = bv.main(self._argv(repo_root, mini_corpus, tmp_path))
        assert code == 0
        sortie = capsys.readouterr().out
        assert "12 sorts" in sortie
        assert bv.STATUT_INVALIDE in sortie
        assert (tmp_path / "vues" / bv.FICHIER_RAPPORT).is_file()

    def test_une_vue_modifiee_fait_sortir_en_un_avec_le_message_derive(
        self,
        repo_root: Path,
        mini_corpus: Path,
        fixtures_enr: Path,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        _poser_enrichissements(fixtures_enr, tmp_path / "enrichissements")
        argv = self._argv(repo_root, mini_corpus, tmp_path)
        assert bv.main(argv) == 0
        capsys.readouterr()
        cible = tmp_path / "vues" / "arc-baton.json"
        vue = _charger(cible)
        vue["nom"] = "retouché"
        cible.write_text(
            json.dumps(vue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        assert bv.main(argv) == 1
        erreur = capsys.readouterr().err
        assert "dérivé" in erreur and "--force" in erreur

    def test_un_abandon_ne_sort_pas_en_traceback(
        self, repo_root: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = bv.main(
            [
                "--racine",
                str(tmp_path / "nulle-part"),
                "--sortie",
                str(tmp_path / "vues"),
                "--racine-conventions",
                str(repo_root),
                "--sans-preflight",
            ]
        )
        assert code == 2
        assert "ABANDON" in capsys.readouterr().err
        assert not (tmp_path / "vues").exists()

    def test_les_abreviations_de_drapeaux_sont_desactivees(
        self, repo_root: Path, mini_corpus: Path, tmp_path: Path
    ) -> None:
        # Same rule as stages 09 and 10: a silently-accepted prefix is a wrong run.
        with pytest.raises(SystemExit):
            bv.main(["--racine", str(mini_corpus), "--sort", str(tmp_path)])

    def test_le_module_est_executable_en_ligne_de_commande(
        self, repo_root: Path, mini_corpus: Path, fixtures_enr: Path, tmp_path: Path
    ) -> None:
        _poser_enrichissements(fixtures_enr, tmp_path / "enrichissements")
        acheve = subprocess.run(
            [sys.executable, "-m", "pf_spells.build_vues"]
            + self._argv(repo_root, mini_corpus, tmp_path),
            cwd=repo_root,
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONPATH": str(repo_root / "src")},
        )
        assert acheve.returncode == 0, acheve.stderr
        assert (tmp_path / "vues" / bv.FICHIER_RAPPORT).is_file()


class TestSurLeCorpusReel:
    """The builder must work on the 2 070 spells and 2 048 records that exist."""

    def test_la_construction_complete_couvre_l_index(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        rapport = bv.run(repo_root, sortie=tmp_path / "vues")
        assert rapport["total"] == 2070
        assert rapport["ok"] + rapport["sans_enrichissement"] + rapport[
            "enrichissement_invalide"
        ] == 2070
        vues = [
            c
            for c in (tmp_path / "vues").glob("*.json")
            if c.name != bv.FICHIER_RAPPORT
        ]
        assert len(vues) == 2070

    def test_les_2048_enregistrements_reels_sont_tous_bien_formes(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        """Stage 09's output validates against the frozen schema, wholesale.

        `ok` counts *well-formed* records, not *grounded* ones: 16 of these carry a
        miscopied `preuve` that stage 10 rejects. That is the right split — the view
        judges shape, stage 10 judges truth.
        """
        rapport = bv.run(repo_root, sortie=tmp_path / "vues")
        assert rapport["ok"] == 2048
        assert rapport["enrichissement_invalide"] == 0
        assert rapport["sans_enrichissement"] == 22

    def test_le_run_complet_est_idempotent_octet_a_octet(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        sortie = tmp_path / "vues"
        bv.run(repo_root, sortie=sortie)
        avant = {c.name: c.read_bytes() for c in sorted(sortie.glob("*.json"))}
        bv.run(repo_root, sortie=sortie)
        assert {c.name: c.read_bytes() for c in sorted(sortie.glob("*.json"))} == avant

    def test_aucun_u_fffd_sur_le_corpus_complet(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        sortie = tmp_path / "vues"
        bv.run(repo_root, sortie=sortie)
        for chemin in sortie.glob("*.json"):
            assert REMPLACEMENT not in chemin.read_text(encoding="utf-8"), chemin.name
