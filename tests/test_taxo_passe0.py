"""Tests for step 04: the free-proposal pass, its aggregation, and the frozen v1.

Three layers, deliberately separated by what they are allowed to touch.

The **unit** layer exercises pure functions (folding, singularising, response
parsing, source assembly) on hand-written input. The **wired** layer runs the pass
and the aggregation end to end over a synthetic root built in `tmp_path`, with a
fake `converse` client: no network, no token, no cost, and its own
`data/conventions/taxo_groupes.json` so the grouping under test is the one the test
wrote — not the repo's. The **committed** layer only reads the real artifacts and
asserts the properties the step is answerable for, above all the coverage gate
that justifies every retained tag.

`taxo_passe0` must never call Bedrock from a test. The seam is the
`ClientConverse` protocol: every wired test injects `client=`, and the one test
that checks the missing-token guard asserts it raises *before* boto3 is reached.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import pytest

from pf_spells import taxo_agregat as ta
from pf_spells import taxo_passe0 as tp

MINI = Path(__file__).resolve().parent / "fixtures" / "mini_corpus"


class ClientFactice:
    """A `converse` stand-in: records what it was asked, replies from a script."""

    def __init__(self, reponses: dict[str, str] | None = None, defaut: str = "") -> None:
        self.reponses = reponses or {}
        self.defaut = defaut
        self.appels: list[dict[str, Any]] = []

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.appels.append(kwargs)
        envoye = kwargs["messages"][0]["content"][0]["text"]
        texte = self.defaut
        for marque, reponse in self.reponses.items():
            if marque in envoye:
                texte = reponse
                break
        return {
            "output": {"message": {"content": [{"text": texte}]}},
            "usage": {"inputTokens": 11, "outputTokens": 7},
            "stopReason": "end_turn",
        }


class ClientQuiCasse:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc
        self.appels = 0

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.appels += 1
        raise self.exc


def ecrire_racine(
    tmp_path: Path, sorts: dict[str, dict[str, Any]], groupes: dict[str, str]
) -> Path:
    """Build a minimal drop-in root: data/sorts, a sample, and grouping rules."""
    racine = tmp_path / "racine"
    (racine / "data" / "sorts").mkdir(parents=True)
    for sid, doc in sorts.items():
        (racine / "data" / "sorts" / f"{sid}.json").write_text(
            json.dumps(doc, ensure_ascii=False), encoding="utf-8"
        )
    (racine / "data" / "conventions").mkdir(parents=True)
    (racine / "data" / "conventions" / "taxo_groupes.json").write_text(
        json.dumps({"version": "t", "seuil_couverture": 2, "groupes": groupes}),
        encoding="utf-8",
    )
    (racine / "build_artifacts").mkdir(parents=True)
    (racine / "build_artifacts" / "echantillon.json").write_text(
        json.dumps({"strates": {"Test:1": sorted(sorts)}, "empreinte_corpus": "x" * 64}),
        encoding="utf-8",
    )
    return racine


SORTS_JOUET = {
    "sort-a": {
        "id": "sort-a",
        "nom": "Sort A",
        "ecole": "Évocation (feu)",
        "descripteurs": ["feu"],
        "niveaux": {"Mag": 3},
        "portee": "courte",
        "jet_de_sauvegarde": None,
        "description": "Le sort inflige des dégâts de feu.",
    },
    "sort-b": {
        "id": "sort-b",
        "nom": "Sort B",
        "ecole": "Abjuration",
        "descripteurs": [],
        "niveaux": {"Prê": 2},
        "description": "Le sort accorde un bonus.",
    },
}


# --------------------------------------------------------------------------- #
# Unit layer
# --------------------------------------------------------------------------- #


class TestPlierEtSingulariser:
    def test_plie_les_accents_et_la_casse(self) -> None:
        assert ta.plier("Dégâts_De_Feu") == "degats_de_feu"

    def test_plie_les_ligatures_que_nfkd_ne_decompose_pas(self) -> None:
        # The corpus rule: ligatures are pre-mapped *before* NFKD, never after.
        assert ta.plier("cœur") == "coeur"
        assert ta.plier("æther") == "aether"

    def test_ne_laisse_aucun_separateur_de_tete_ni_de_queue(self) -> None:
        assert ta.plier("  --feu!! ") == "feu"

    def test_singularise_sauf_les_mots_courts_et_en_ss(self) -> None:
        assert ta.singulariser("degats") == "degat"
        assert ta.singulariser("sorts") == "sort"
        assert ta.singulariser("feu") == "feu"  # too short to touch
        assert ta.singulariser("masse") == "masse"  # -ss is left alone

    def test_rogne_aussi_un_vrai_singulier_en_s(self) -> None:
        # Documented limitation, not an accident: `bonus` -> `bonu`. Harmless
        # because it applies to every occurrence and is never displayed.
        assert ta.singulariser("bonus") == "bonu"

    def test_la_cle_est_invariante_a_l_ordre_des_mots(self) -> None:
        assert ta.cle_de_regroupement("enchantement_coercition") == (
            ta.cle_de_regroupement("coercition_enchantement")
        )

    def test_la_cle_laisse_tomber_les_mots_vides(self) -> None:
        assert ta.cle_de_regroupement("resistance_a_la_magie_applicable") == (
            ta.cle_de_regroupement("resistance_magie")
        )

    def test_une_cle_n_est_jamais_vide(self) -> None:
        # Every word is a stop word: falling back to the fold beats an empty key.
        assert ta.cle_de_regroupement("de_la_du") != ""


class TestAnalyserReponse:
    def test_une_etiquette_par_ligne_dans_l_ordre_du_modele(self) -> None:
        assert tp.analyser_reponse("feu\nzone\nrayon") == ["feu", "zone", "rayon"]

    def test_retire_les_puces_et_la_ponctuation_de_queue(self) -> None:
        assert tp.analyser_reponse("- feu:\n* zone.") == ["feu", "zone"]

    def test_ecarte_la_prose_et_les_lignes_vides(self) -> None:
        reponse = "Voici les étiquettes :\n\nfeu\nzone\n"
        assert tp.analyser_reponse(reponse) == ["feu", "zone"]

    def test_dedoublonne_dans_une_meme_reponse(self) -> None:
        assert tp.analyser_reponse("feu\nfeu\nzone") == ["feu", "zone"]

    def test_ecarte_une_etiquette_absurdement_longue(self) -> None:
        assert tp.analyser_reponse("f" * 61) == []


class TestTexteSource:
    def test_omet_les_champs_absents_plutot_que_d_ecrire_none(self) -> None:
        texte = tp.texte_source(SORTS_JOUET["sort-a"])
        assert "jet_de_sauvegarde" not in texte
        assert "None" not in texte

    def test_conserve_les_accents_verbatim(self) -> None:
        texte = tp.texte_source(SORTS_JOUET["sort-a"])
        assert "Évocation (feu)" in texte
        assert "dégâts" in texte

    def test_rend_les_niveaux_par_classe(self) -> None:
        assert "niveaux: Mag 3" in tp.texte_source(SORTS_JOUET["sort-a"])

    def test_refuse_un_texte_corrompu(self) -> None:
        # U+FFFD anywhere is a decisive corruption signal: nothing is sent.
        sort = dict(SORTS_JOUET["sort-a"], description="dég�ts")
        with pytest.raises(tp.Passe0Error, match="U\\+FFFD"):
            tp.texte_source(sort)

    def test_le_hash_suit_le_texte(self) -> None:
        a = tp.texte_source(SORTS_JOUET["sort-a"])
        assert tp.hash_texte(a) == tp.hash_texte(a)
        assert tp.hash_texte(a) != tp.hash_texte(tp.texte_source(SORTS_JOUET["sort-b"]))


class TestAppeler:
    def test_envoie_la_garde_de_source_et_la_consigne(self) -> None:
        client = ClientFactice(defaut="feu")
        tp.appeler(client, "TEXTE DU SORT")
        envoye = client.appels[0]["messages"][0]["content"][0]["text"]
        assert tp.GARDE_SOURCE in envoye
        assert tp.CONSIGNE in envoye
        assert "TEXTE DU SORT" in envoye

    def test_appelle_un_profil_d_inference_a_temperature_nulle(self) -> None:
        client = ClientFactice(defaut="feu")
        tp.appeler(client, "t")
        assert client.appels[0]["modelId"].startswith(("eu.", "global."))
        assert client.appels[0]["inferenceConfig"]["temperature"] == 0.0

    def test_ne_reessaie_pas_une_erreur_de_validation(self) -> None:
        # A ValidationException is a coding error; hammering it four more times
        # costs money and hides the bug.
        client = ClientQuiCasse(RuntimeError("ValidationException: bad model id"))
        with pytest.raises(RuntimeError, match="ValidationException"):
            tp.appeler(client, "t", dormir=lambda _: None)
        assert client.appels == 1

    def test_reessaie_un_throttling_puis_abandonne(self) -> None:
        client = ClientQuiCasse(RuntimeError("ThrottlingException: slow down"))
        with pytest.raises(RuntimeError, match="Throttling"):
            tp.appeler(client, "t", tentatives=3, dormir=lambda _: None)
        assert client.appels == 3


class TestGardeDuJeton:
    def test_refuse_de_construire_un_client_sans_jeton(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(tp.VARIABLE_JETON, raising=False)
        with pytest.raises(tp.Passe0Error, match=tp.VARIABLE_JETON):
            tp.construire_client()


# --------------------------------------------------------------------------- #
# Wired layer — synthetic root, fake client, no network
# --------------------------------------------------------------------------- #


@pytest.fixture()
def racine_jouet(tmp_path: Path) -> Path:
    return ecrire_racine(
        tmp_path,
        SORTS_JOUET,
        {"degats_feu": "feu|flamme", "bonus_chiffre": "bonus", "jamais": "zzz"},
    )


def lancer(racine: Path, client: ClientFactice, **kw: Any) -> dict[str, Any]:
    return tp.run(
        racine,
        "build_artifacts/echantillon.json",
        racine / "build_artifacts" / "passe0",
        client=client,
        empreinte=False,
        workers=1,
        **kw,
    )


class TestRunPasse0:
    def test_ecrit_un_fichier_par_sort_et_compte_les_jetons(
        self, racine_jouet: Path
    ) -> None:
        client = ClientFactice({"Sort A": "degats_feu\nrayon", "Sort B": "bonus_ca"})
        resume = lancer(racine_jouet, client)
        assert resume["reussis"] == 2
        assert resume["echecs"] == []
        assert resume["inputTokens"] == 22
        sortie = racine_jouet / "build_artifacts" / "passe0"
        assert {p.stem for p in sortie.glob("*.json")} == {"sort-a", "sort-b"}

    def test_enregistre_le_texte_envoye_comme_preuve(self, racine_jouet: Path) -> None:
        client = ClientFactice(defaut="degats_feu")
        lancer(racine_jouet, client)
        doc = json.loads(
            (racine_jouet / "build_artifacts" / "passe0" / "sort-a.json").read_text(
                encoding="utf-8"
            )
        )
        # The recorded text must be exactly what was hashed, or the run is not
        # evidence of anything.
        assert doc["texte_envoye_hash"] == tp.hash_texte(doc["texte_envoye"])
        assert doc["hash_source"] == doc["texte_envoye_hash"]
        assert doc["consigne"] == tp.CONSIGNE

    def test_la_reprise_ne_rappelle_pas_le_modele(self, racine_jouet: Path) -> None:
        premier = ClientFactice(defaut="degats_feu")
        lancer(racine_jouet, premier)
        second = ClientFactice(defaut="autre")
        resume = lancer(racine_jouet, second)
        assert resume["sautes"] == 2
        assert resume["tentes"] == 0
        assert second.appels == []  # not one paid call on a resume

    def test_force_rappelle_le_modele(self, racine_jouet: Path) -> None:
        lancer(racine_jouet, ClientFactice(defaut="degats_feu"))
        second = ClientFactice(defaut="bonus_ca")
        resume = lancer(racine_jouet, second, force=True)
        assert resume["tentes"] == 2
        assert len(second.appels) == 2

    def test_limit_borne_le_nombre_d_appels(self, racine_jouet: Path) -> None:
        client = ClientFactice(defaut="degats_feu")
        resume = lancer(racine_jouet, client, limite=1)
        assert resume["tentes"] == 1
        assert len(client.appels) == 1

    def test_only_hors_echantillon_est_une_erreur(self, racine_jouet: Path) -> None:
        with pytest.raises(tp.Passe0Error, match="hors échantillon"):
            lancer(racine_jouet, ClientFactice(), seulement=["sort-inexistant"])

    def test_un_echec_est_rapporte_jamais_avale(self, racine_jouet: Path) -> None:
        resume = tp.run(
            racine_jouet,
            "build_artifacts/echantillon.json",
            racine_jouet / "build_artifacts" / "passe0",
            client=ClientQuiCasse(RuntimeError("AccessDeniedException: nope")),
            empreinte=False,
            workers=1,
        )
        assert resume["reussis"] == 0
        assert len(resume["echecs"]) == 2
        assert "AccessDenied" in resume["echecs"][0]["erreur"]

    def test_n_ecrit_jamais_sous_data(self, racine_jouet: Path) -> None:
        avant = {
            p: p.read_bytes() for p in (racine_jouet / "data").rglob("*") if p.is_file()
        }
        lancer(racine_jouet, ClientFactice(defaut="degats_feu"))
        apres = {
            p: p.read_bytes() for p in (racine_jouet / "data").rglob("*") if p.is_file()
        }
        assert avant == apres


class TestGardeEmpreinte:
    def test_refuse_un_echantillon_sans_empreinte(self, tmp_path: Path) -> None:
        chemin = tmp_path / "e.json"
        chemin.write_text(json.dumps({"strates": {"A:1": ["x"]}}), encoding="utf-8")
        with pytest.raises(tp.Passe0Error, match="empreinte_corpus"):
            tp.verifier_empreinte(tmp_path, chemin)

    def test_l_empreinte_du_depot_correspond_a_l_echantillon_committe(
        self, repo_root: Path
    ) -> None:
        # The guard's whole point: it must pass on the committed pair, so a
        # failure means the corpus moved and the sample is stale.
        chemin = repo_root / "build_artifacts" / "echantillon_taxo.json"
        attendue = json.loads(chemin.read_text(encoding="utf-8"))["empreinte_corpus"]
        assert tp.verifier_empreinte(repo_root, chemin) == attendue


class TestAgregation:
    def test_aucune_etiquette_n_est_perdue(self, racine_jouet: Path) -> None:
        par_sort = {"sort-a": ["degats_feu", "rayon"], "sort-b": ["bonus_ca"]}
        lignes = ta.construire_lignes(par_sort, racine_jouet)
        cles = {ta.cle_de_regroupement(str(l["etiquette_brute"])) for l in lignes}
        attendues = {
            ta.cle_de_regroupement(e) for es in par_sort.values() for e in es
        }
        assert cles == attendues
        assert sum(int(l["occurrences"]) for l in lignes) == 3

    def test_la_couverture_se_compte_en_sorts_pas_en_usages(
        self, racine_jouet: Path
    ) -> None:
        # Three fire labels on one spell is one spell of evidence, not three.
        par_sort = {"sort-a": ["degats_feu", "feu_pur", "flamme_vive"]}
        couverture = ta.couverture_par_groupe(par_sort, racine_jouet)
        assert couverture["degats_feu"] == ["sort-a"]

    def test_le_seuil_ecarte_un_groupe_trop_peu_couvert(
        self, racine_jouet: Path
    ) -> None:
        par_sort = {"sort-a": ["degats_feu"], "sort-b": ["bonus_ca"]}
        # Threshold 2: one spell each, so neither group is retained.
        assert ta.groupes_retenus(par_sort, racine_jouet, seuil=2) == []
        par_sort["sort-b"] = ["flamme"]
        assert ta.groupes_retenus(par_sort, racine_jouet, seuil=2) == ["degats_feu"]

    def test_utilise_les_groupes_de_la_racine_donnee(self, racine_jouet: Path) -> None:
        # Regression: the grouping used to default to the *cwd*'s conventions
        # whatever root the caller passed, which made this untestable.
        assert set(ta.charger_groupes(racine_jouet)) == {
            "degats_feu",
            "bonus_chiffre",
            "jamais",
        }

    def test_une_etiquette_sans_groupe_retenu_est_marquee_hors_groupe(
        self, racine_jouet: Path
    ) -> None:
        lignes = ta.construire_lignes({"sort-a": ["chose_inclassable"]}, racine_jouet)
        assert str(lignes[0]["groupe_propose"]).startswith("hors_groupe:")

    def test_le_csv_est_trie_par_occurrences_decroissantes(
        self, racine_jouet: Path, tmp_path: Path
    ) -> None:
        par_sort = {
            "sort-a": ["degats_feu", "rare"],
            "sort-b": ["degats_feu"],
        }
        chemin = ta.ecrire_csv(ta.construire_lignes(par_sort, racine_jouet), tmp_path / "a.csv")
        occ = [int(l["occurrences"]) for l in ta.lire_csv(chemin)]
        assert occ == sorted(occ, reverse=True)

    def test_le_csv_est_utf8_lf_avec_fin_de_ligne(
        self, racine_jouet: Path, tmp_path: Path
    ) -> None:
        chemin = ta.ecrire_csv(
            ta.construire_lignes({"sort-a": ["dégâts_de_feu"]}, racine_jouet),
            tmp_path / "a.csv",
        )
        octets = chemin.read_bytes()
        assert b"\r\n" not in octets
        assert octets.endswith(b"\n")
        assert not octets.startswith(b"\xef\xbb\xbf")
        octets.decode("utf-8")  # strict: raises if not real UTF-8


# --------------------------------------------------------------------------- #
# Committed layer — the real artifacts, read only
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="module")
def passe0_committee(repo_root: Path) -> dict[str, list[str]]:
    dossier = repo_root / "build_artifacts" / "taxo_passe0"
    if not dossier.is_dir():
        pytest.fail(f"sorties de passe 0 absentes : {dossier}")
    return ta.charger_passe0(dossier)


@pytest.fixture(scope="module")
def echantillon_committe(repo_root: Path) -> set[str]:
    chemin = repo_root / "build_artifacts" / "echantillon_taxo.json"
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    return {sid for membres in doc["strates"].values() for sid in membres}


@pytest.fixture(scope="module")
def tags_v1(repo_root: Path) -> dict[str, Any]:
    chemin = repo_root / "data" / "conventions" / "vocabulaires" / "tags.json"
    return json.loads(chemin.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def noms_du_corpus(repo_root: Path) -> set[str]:
    return {
        json.loads(p.read_text(encoding="utf-8"))["nom"]
        for p in (repo_root / "data" / "sorts").glob("*.json")
    }


class TestPasse0Committee:
    def test_couvre_exactement_l_echantillon(
        self, passe0_committee: dict[str, list[str]], echantillon_committe: set[str]
    ) -> None:
        assert set(passe0_committee) == echantillon_committe

    def test_aucun_sort_sans_etiquette(
        self, passe0_committee: dict[str, list[str]]
    ) -> None:
        assert [sid for sid, e in passe0_committee.items() if not e] == []

    def test_chaque_enregistrement_est_sa_propre_preuve(self, repo_root: Path) -> None:
        for chemin in (repo_root / "build_artifacts" / "taxo_passe0").glob("*.json"):
            doc = json.loads(chemin.read_text(encoding="utf-8"))
            assert doc["texte_envoye_hash"] == tp.hash_texte(doc["texte_envoye"]), (
                chemin.name
            )
            assert doc["arret"] == "end_turn", chemin.name
            assert chr(0xFFFD) not in doc["texte_envoye"], chemin.name

    def test_tourne_sur_un_profil_d_inference(self, repo_root: Path) -> None:
        # The bare model id supports only INFERENCE_PROFILE; a record claiming
        # otherwise did not come from a real call.
        for chemin in (repo_root / "build_artifacts" / "taxo_passe0").glob("*.json"):
            doc = json.loads(chemin.read_text(encoding="utf-8"))
            assert doc["modele"].startswith(("eu.", "global.")), chemin.name


class TestTaxonomieV1:
    def test_est_gelee_en_v1(self, tags_v1: dict[str, Any]) -> None:
        assert tags_v1["version"] == "v1"

    def test_compte_entre_25_et_40_entrees(self, tags_v1: dict[str, Any]) -> None:
        assert 25 <= len(tags_v1["valeurs"]) <= 40

    def test_les_cles_sont_en_snake_case_et_uniques(
        self, tags_v1: dict[str, Any]
    ) -> None:
        import re

        cles = [e["cle"] for e in tags_v1["valeurs"]]
        assert len(set(cles)) == len(cles)
        for cle in cles:
            assert re.fullmatch(r"[a-z0-9]+(_[a-z0-9]+)*", cle), cle

    def test_chaque_tag_a_une_definition_et_deux_exemples_de_chaque_signe(
        self, tags_v1: dict[str, Any]
    ) -> None:
        for entree in tags_v1["valeurs"]:
            assert entree["definition_fr"].strip(), entree["cle"]
            assert len(entree["exemples_positifs"]) >= 2, entree["cle"]
            assert len(entree["exemples_negatifs"]) >= 2, entree["cle"]

    def test_les_definitions_sont_distinctes(self, tags_v1: dict[str, Any]) -> None:
        # The cut rule: a tag must be tellable from the others by its definition
        # alone, so two identical definitions mean one tag too many.
        definitions = [e["definition_fr"] for e in tags_v1["valeurs"]]
        assert len(set(definitions)) == len(definitions)

    def test_aucun_exemple_n_est_invente(
        self, tags_v1: dict[str, Any], noms_du_corpus: set[str]
    ) -> None:
        # Examples are drawn from the corpus, never composed by the model.
        for entree in tags_v1["valeurs"]:
            for exemple in entree["exemples_positifs"] + entree["exemples_negatifs"]:
                assert exemple in noms_du_corpus, f"{entree['cle']}: {exemple}"

    def test_un_exemple_positif_n_est_jamais_aussi_negatif(
        self, tags_v1: dict[str, Any]
    ) -> None:
        for entree in tags_v1["valeurs"]:
            chevauchement = set(entree["exemples_positifs"]) & set(
                entree["exemples_negatifs"]
            )
            assert chevauchement == set(), entree["cle"]

    def test_chaque_tag_est_justifie_par_au_moins_10_sorts(
        self,
        tags_v1: dict[str, Any],
        passe0_committee: dict[str, list[str]],
        repo_root: Path,
    ) -> None:
        """The gate that makes the taxonomy derived rather than invented."""
        couverture = ta.couverture_par_groupe(passe0_committee, repo_root)
        maigres = {
            e["cle"]: len(couverture.get(e["cle"], []))
            for e in tags_v1["valeurs"]
            if len(couverture.get(e["cle"], [])) < ta.SEUIL_COUVERTURE
        }
        assert maigres == {}

    def test_la_liste_est_exactement_celle_des_groupes_au_dessus_du_seuil(
        self,
        tags_v1: dict[str, Any],
        passe0_committee: dict[str, list[str]],
        repo_root: Path,
    ) -> None:
        # Not merely "each tag is justified" but "nothing justified was dropped":
        # the cut is a rule applied, not a hand-picked selection.
        retenus = set(ta.groupes_retenus(passe0_committee, repo_root))
        assert {e["cle"] for e in tags_v1["valeurs"]} == retenus


class TestCsvCommitte:
    def test_existe_et_est_trie_par_occurrences(self, repo_root: Path) -> None:
        chemin = repo_root / "build_artifacts" / "taxo_passe0_agrege.csv"
        lignes = ta.lire_csv(chemin)
        assert lignes
        occ = [int(l["occurrences"]) for l in lignes]
        assert occ == sorted(occ, reverse=True)

    def test_porte_les_ids_d_exemples_pas_seulement_des_compteurs(
        self, repo_root: Path
    ) -> None:
        lignes = ta.lire_csv(repo_root / "build_artifacts" / "taxo_passe0_agrege.csv")
        assert all(l["exemples_ids"].split() for l in lignes)

    def test_chaque_id_cite_appartient_a_l_echantillon(
        self, repo_root: Path, echantillon_committe: set[str]
    ) -> None:
        lignes = ta.lire_csv(repo_root / "build_artifacts" / "taxo_passe0_agrege.csv")
        cites = {sid for l in lignes for sid in l["exemples_ids"].split()}
        assert cites <= echantillon_committe

    def test_se_reconstruit_a_l_identique(
        self, repo_root: Path, passe0_committee: dict[str, list[str]], tmp_path: Path
    ) -> None:
        # Replayability is the point of committing the raw pass: the aggregation
        # must be a function of the outputs, not of when it ran.
        refait = ta.ecrire_csv(
            ta.construire_lignes(passe0_committee, repo_root), tmp_path / "refait.csv"
        )
        committe = repo_root / "build_artifacts" / "taxo_passe0_agrege.csv"
        assert refait.read_bytes() == committe.read_bytes()

    def test_les_colonnes_sont_celles_du_contrat(self, repo_root: Path) -> None:
        chemin = repo_root / "build_artifacts" / "taxo_passe0_agrege.csv"
        with chemin.open(encoding="utf-8", newline="") as flux:
            entetes = next(csv.reader(flux))
        assert entetes == list(ta.COLONNES)
