"""Tests for the stratified taxonomy sample: the builder, then the committed file.

Two layers. The builder is exercised offline on `tests/fixtures/mini_corpus`,
which is a drop-in `racine` (it mirrors `data/sorts`, `data/index`,
`data/classes.json`) but is *not* a full repo — no `src/`, no `schemas/`, no
Skill — so the entry guard would legitimately fail on it and is skipped there via
`preflight=False`. The second layer only reads the committed artifact and the real
corpus; it never rebuilds over `build_artifacts/`.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pf_spells import echantillon_taxo as et

MINI = Path(__file__).resolve().parent / "fixtures" / "mini_corpus"


@pytest.fixture(scope="module")
def artefact_mini() -> dict:
    return et.construire_echantillon(MINI, taille_cible=6, graine=et.GRAINE)


@pytest.fixture(scope="module")
def artefact_committe(repo_root: Path) -> dict:
    chemin = repo_root / "build_artifacts" / "echantillon_taxo.json"
    if not chemin.is_file():
        pytest.fail(f"artefact committé absent : {chemin}")
    return json.loads(chemin.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def ids_corpus(repo_root: Path) -> set[str]:
    chemin = repo_root / "data" / "index" / "sorts_uniques.jsonl"
    return {
        json.loads(l)["id"]
        for l in chemin.read_text(encoding="utf-8").splitlines()
        if l.strip()
    }


def tous_les_ids(artefact: dict) -> list[str]:
    return [sid for ids in artefact["strates"].values() for sid in ids]


class TestEcoleDeBase:
    """The raw -> base school collapse, the one normalisation this module owns."""

    @pytest.mark.parametrize(
        ("brute", "attendu"),
        [
            ("Transmutation", "Transmutation"),
            ("Invocation (convocation)", "Invocation"),
            ("invocation (création)", "Invocation"),
            ("invocation(guérison)", "Invocation"),
            ("Évocation (froid)", "Évocation"),
            ("évocation", "Évocation"),
            ("Nécromancie (Mal)", "Nécromancie"),
            ("Enchantement (coercition) ]émotion, effet mental]", "Enchantement"),
            ("Universel", "Universelle"),
            ("Universelle", "Universelle"),
        ],
    )
    def test_valeurs_brutes_reduites_a_l_ecole_de_base(self, brute, attendu):
        assert et.ecole_de_base(brute) == attendu

    def test_les_accents_ne_sont_jamais_retires(self):
        # Corpus rule: values stay verbatim. Folding is for grouping keys only,
        # and the grouping key is itself a value here.
        assert et.ecole_de_base("évocation (force)") == "Évocation"
        assert "E" not in et.ecole_de_base("évocation")[:1]

    def test_ecole_illisible_bloque(self):
        with pytest.raises(et.EchantillonError, match="école illisible"):
            et.ecole_de_base("(convocation)")


class TestStratificationSurMiniCorpus:
    """Offline run on the 12 frozen spells — never touches the full corpus."""

    def test_le_corpus_complet_n_est_pas_lu(self, artefact_mini):
        assert artefact_mini["nb_sorts_corpus"] == 12

    def test_les_ids_tires_viennent_du_mini_corpus(self, artefact_mini):
        attendus = {p.stem for p in (MINI / "data" / "sorts").glob("*.json")}
        ids = tous_les_ids(artefact_mini)
        assert set(ids) <= attendus
        assert len(ids) == len(set(ids))

    def test_les_cles_de_strate_sont_ecole_deux_points_niveau(self, artefact_mini):
        for cle in artefact_mini["strates"]:
            ecole, separateur, niveau = cle.rpartition(":")
            assert separateur == ":"
            assert ecole and niveau.isdigit()

    def test_forme_attendue_par_l_etape_04(self, artefact_mini):
        for cle in ("graine", "taille", "construit_le", "strates", "couverture"):
            assert cle in artefact_mini
        assert set(artefact_mini["couverture"]) >= {"ecoles", "niveaux"}
        assert artefact_mini["taille"] == len(tous_les_ids(artefact_mini))

    def test_une_strate_ne_depasse_jamais_sa_population(self, artefact_mini):
        for cle, ids in artefact_mini["strates"].items():
            assert len(ids) <= artefact_mini["distribution_brute"][cle]

    def test_ids_tries_dans_chaque_strate(self, artefact_mini):
        for ids in artefact_mini["strates"].values():
            assert ids == sorted(ids)

    def test_strates_sous_plancher_enregistrees_et_non_ecartees(self, artefact_mini):
        maigres = {
            cle
            for cle, n in artefact_mini["distribution_brute"].items()
            if n < et.PLANCHER
        }
        enregistrees = {s["strate"] for s in artefact_mini["strates_sous_plancher"]}
        assert enregistrees == maigres
        # A thin stratum contributes all of its members: never padded, never
        # sampled with replacement.
        for s in artefact_mini["strates_sous_plancher"]:
            assert s["tires"] == s["taille_strate"]

    def test_toutes_les_ecoles_du_mini_corpus_sont_couvertes(self, artefact_mini):
        assert artefact_mini["ecoles_absentes_de_l_echantillon"] == []
        assert artefact_mini["couverture"]["ecoles"] == len(
            artefact_mini["ecoles_corpus"]
        )

    def test_la_table_de_normalisation_couvre_les_valeurs_brutes(self, artefact_mini):
        brutes = {
            json.loads(p.read_text(encoding="utf-8"))["ecole"]
            for p in (MINI / "data" / "sorts").glob("*.json")
        }
        assert set(artefact_mini["ecoles_normalisation"]) == brutes


class TestDeterminisme:
    """Two builds, byte for byte — and the seed is genuinely used."""

    def test_deux_constructions_donnent_un_octet_a_octet_identique(self):
        premier = et.serialiser(
            et.construire_echantillon(MINI, taille_cible=6, graine=et.GRAINE)
        ).encode("utf-8")
        second = et.serialiser(
            et.construire_echantillon(MINI, taille_cible=6, graine=et.GRAINE)
        ).encode("utf-8")
        assert premier == second

    def test_construit_le_ne_porte_aucune_horloge(self, artefact_mini):
        # A wall clock would make the committed artifact irreproducible; the
        # field is a content fingerprint instead, so equality above is honest.
        assert artefact_mini["construit_le"].startswith("empreinte:")
        assert artefact_mini["construit_le"] == (
            "empreinte:" + artefact_mini["empreinte_corpus"][:16]
        )

    def test_construit_le_injectable(self):
        artefact = et.construire_echantillon(
            MINI, taille_cible=6, graine=1, construit_le="v1"
        )
        assert artefact["construit_le"] == "v1"

    def test_une_graine_differente_change_le_tirage(self, repo_root: Path):
        # On the real corpus, where strata are large enough for the draw to have
        # freedom; the 12-spell fixture is mostly exhaustive strata.
        a = et.construire_echantillon(repo_root, graine=et.GRAINE)
        b = et.construire_echantillon(repo_root, graine=et.GRAINE + 1)
        assert a["graine"] != b["graine"]
        assert tous_les_ids(a) != tous_les_ids(b)
        # Same strata, same quotas: only the members drawn differ.
        assert a["distribution_brute"] == b["distribution_brute"]
        assert {k: len(v) for k, v in a["strates"].items()} == {
            k: len(v) for k, v in b["strates"].items()
        }

    def test_l_artefact_committe_se_rejoue_a_l_octet(
        self, repo_root: Path, artefact_committe: dict
    ):
        rejoue = et.serialiser(
            et.construire_echantillon(
                repo_root,
                taille_cible=artefact_committe["taille_cible"],
                graine=artefact_committe["graine"],
            )
        )
        attendu = (
            repo_root / "build_artifacts" / "echantillon_taxo.json"
        ).read_text(encoding="utf-8")
        assert rejoue == attendu


class TestArtefactCommitte:
    """The committed file against the real corpus — the step's own criteria."""

    def test_taille_dans_la_bande(self, artefact_committe):
        ids = tous_les_ids(artefact_committe)
        assert et.BANDE_MIN <= len(ids) <= et.BANDE_MAX
        assert artefact_committe["taille"] == len(ids)
        assert artefact_committe["dans_la_bande"] is True

    def test_ids_tous_uniques(self, artefact_committe):
        ids = tous_les_ids(artefact_committe)
        assert len(ids) == len(set(ids))

    def test_chaque_id_existe_dans_l_index_et_dans_data_sorts(
        self, repo_root: Path, artefact_committe, ids_corpus
    ):
        for sid in tous_les_ids(artefact_committe):
            assert sid in ids_corpus
            assert (repo_root / "data" / "sorts" / f"{sid}.json").is_file()

    def test_toutes_les_ecoles_du_corpus_sont_representees(
        self, repo_root: Path, artefact_committe
    ):
        ecoles_reelles = {
            et.ecole_de_base(json.loads(p.read_text(encoding="utf-8"))["ecole"])
            for p in sorted((repo_root / "data" / "sorts").glob("*.json"))
        }
        tirees = {cle.rsplit(":", 1)[0] for cle in artefact_committe["strates"]}
        assert ecoles_reelles == tirees
        assert artefact_committe["ecoles_absentes_de_l_echantillon"] == []
        assert artefact_committe["ecoles_inattendues"] == []
        assert len(ecoles_reelles) == 9

    def test_l_ecart_a_la_cible_est_explicite(self, artefact_committe):
        assert artefact_committe["ecart_taille_cible"] == (
            artefact_committe["taille"] - artefact_committe["taille_cible"]
        )
        assert artefact_committe["bande_acceptee"] == [et.BANDE_MIN, et.BANDE_MAX]

    def test_les_strates_maigres_sont_enregistrees_pas_ecartees(
        self, artefact_committe
    ):
        maigres = {
            cle
            for cle, n in artefact_committe["distribution_brute"].items()
            if n < et.PLANCHER
        }
        assert maigres, "le corpus réel a des strates sous le plancher"
        assert {
            s["strate"] for s in artefact_committe["strates_sous_plancher"]
        } == maigres
        for s in artefact_committe["strates_sous_plancher"]:
            assert s["tires"] == s["taille_strate"] < et.PLANCHER
        # Recorded, and still present in the draw: nothing was dropped.
        for cle in maigres:
            assert artefact_committe["strates"][cle]

    def test_la_distribution_brute_correspond_au_corpus(
        self, artefact_committe, ids_corpus
    ):
        assert sum(artefact_committe["distribution_brute"].values()) == len(ids_corpus)
        assert artefact_committe["nb_sorts_corpus"] == len(ids_corpus)
        assert artefact_committe["nb_strates"] == len(
            artefact_committe["distribution_brute"]
        )

    def test_niveau_min_couvre_les_dix_niveaux(self, artefact_committe):
        niveaux = {int(cle.rsplit(":", 1)[1]) for cle in artefact_committe["strates"]}
        assert niveaux == set(range(10))
        assert artefact_committe["couverture"]["niveaux"] == 10

    def test_desaccords_niveau_min_rapportes_et_tranches(
        self, repo_root: Path, artefact_committe
    ):
        for d in artefact_committe["desaccords_niveau_min"]:
            doc = json.loads(
                (repo_root / "data" / "sorts" / f"{d['id']}.json").read_text(
                    encoding="utf-8"
                )
            )
            assert d["niveau_min_sort"] == min(doc["niveaux"].values())
            assert d["retenu"] == d["niveau_min_sort"] != d["niveau_min_index"]

    def test_la_convention_de_niveau_est_documentee(self, artefact_committe):
        assert "niveau_min" in artefact_committe["convention_niveau"]
        assert "ecole" in artefact_committe["convention_ecole"]


class TestFormatDeSortie:
    """Encoding contract: UTF-8 without BOM, LF, trailing newline, no U+FFFD."""

    @pytest.fixture(scope="class")
    def brut(self, repo_root: Path) -> bytes:
        return (repo_root / "build_artifacts" / "echantillon_taxo.json").read_bytes()

    def test_utf8_sans_bom_lf_et_newline_final(self, brut):
        assert not brut.startswith(b"\xef\xbb\xbf")
        assert b"\r\n" not in brut
        assert brut.endswith(b"\n")

    def test_aucun_caractere_de_remplacement(self, brut):
        assert chr(0xFFFD) not in brut.decode("utf-8", errors="strict")

    def test_accents_verbatim_et_indent_2(self, brut):
        texte = brut.decode("utf-8")
        assert "Évocation" in texte and "Nécromancie" in texte
        assert '\n  "graine"' in texte

    def test_cles_triees(self, repo_root: Path, artefact_committe):
        assert list(artefact_committe) == sorted(artefact_committe)


class TestGardeEtEcritures:
    """The entry guard, and the promise that nothing under data/ is written."""

    def test_preflight_bloquant_arrete_la_construction(self, tmp_path: Path):
        with pytest.raises(et.EchantillonError, match="garde d'entrée introuvable"):
            et.run(tmp_path, sortie=tmp_path / "out.json")

    def test_preflight_echoue_sur_le_mini_corpus(self, tmp_path: Path):
        # Documented reason for `--sans-preflight`: mini_corpus is a valid
        # `racine` for the data it holds, but not a repo — no `tools/`, no `src/`,
        # no Skill — so the guard cannot pass and must be skipped there.
        assert not (MINI / "tools").exists()
        with pytest.raises(et.EchantillonError):
            et.run(MINI, sortie=tmp_path / "out.json")

    def test_index_absent_bloque(self, tmp_path: Path):
        with pytest.raises(et.EchantillonError, match="index absent"):
            et.construire_echantillon(tmp_path)

    def test_aucune_ecriture_sous_data(self, tmp_path: Path):
        sortie = tmp_path / "sous" / "echantillon.json"
        et.run(MINI, taille_cible=6, sortie=sortie, preflight=False)
        assert sortie.is_file()
        assert not (tmp_path / "data").exists()

    def test_pas_de_reseau_ni_de_html(self):
        source = Path(et.__file__).read_text(encoding="utf-8")
        for interdit in ("requests", "httpx", "BeautifulSoup", "bs4", "lxml", "urlopen"):
            assert interdit not in source
