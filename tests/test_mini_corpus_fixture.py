"""Tests for the frozen mini-corpus fixture.

The fixture is a drop-in `racine` for offline consumers, so what has to be
pinned is not "the code works" but "the data is still what was frozen": the
shape, the encoding, and the selection coverage. Every criterion the plan asks
the selection to cover is asserted mechanically here, because a criterion that
lives only in a README rots the day someone edits the tree.

`TestCopieVerbatim` is the load-bearing one: it pins *copied, not retyped*. Its
failure message is deliberately verbose — it is the test most likely to fail for
a reason that is not the fixture's fault.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pf_spells.slugs import slugify

FIXTURE = Path(__file__).resolve().parent / "fixtures/mini_corpus"
SORTS_FIXTURE = FIXTURE / "data/sorts"
INDEX_FIXTURE = FIXTURE / "data/index"

IDS_GELES: tuple[str, ...] = (
    "absorption-d-energie",
    "alarme-d-invisibilite",
    "animation-des-morts",
    "arc-baton",
    "arret-du-temps",
    "aura-d-avidite",
    "controle-de-l-eau",
    "destruction-de-mort-vivant",
    "lamentation-des-derniers-jours-d-ete",
    "resistance-a-l-age",
    "resistance-a-l-age-mineure",
    "voile-d-energie-positive",
)

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

# Le corpus plafonne à 5911 signes de description ; 4000 isole le haut de la
# queue sans dépendre d'un seul sort.
SEUIL_DESCRIPTION_LONGUE = 4000

# Écrit en échappement : un littéral U+FFFD dans ce fichier ferait de la suite
# elle-même une source de corruption si elle était un jour copiée dans la fixture.
REMPLACEMENT = "\ufffd"

MESSAGE_GEL = (
    "La fixture tests/fixtures/mini_corpus/ est GELÉE À DESSEIN. Cet échec dit "
    "que data/sorts/ a bougé sous elle, pas que la fixture est fautive. "
    "Lire tests/fixtures/mini_corpus/README.md avant de toucher à quoi que ce "
    "soit : soit la modification du corpus est involontaire et il faut la "
    "corriger, soit elle est légitime et un humain dégèle la fixture "
    "explicitement."
)


@pytest.fixture(scope="module")
def sorts() -> dict[str, dict]:
    return {
        p.stem: json.loads(p.read_text(encoding="utf-8"))
        for p in sorted(SORTS_FIXTURE.glob("*.json"))
    }


@pytest.fixture(scope="module")
def index() -> list[dict]:
    lignes = (
        (INDEX_FIXTURE / "sorts_uniques.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
    )
    return [json.loads(l) for l in lignes]


@pytest.fixture(scope="module")
def referentiel() -> list[dict]:
    return json.loads((FIXTURE / "data/classes.json").read_text(encoding="utf-8"))


def tous_les_fichiers() -> list[Path]:
    return sorted(p for p in FIXTURE.rglob("*") if p.is_file())


class TestStructure:
    def test_douze_fichiers_de_sorts(self) -> None:
        assert sorted(p.stem for p in SORTS_FIXTURE.glob("*.json")) == list(IDS_GELES)

    def test_arbre_miroir_du_depot(self) -> None:
        for relatif in (
            "data/classes.json",
            "data/index/sorts_uniques.jsonl",
            "data/index/carte_doublons.json",
            "data/index/sorts_exclusifs.json",
            "README.md",
        ):
            assert (FIXTURE / relatif).is_file(), relatif

    def test_vingt_et_une_cles_canoniques(self, sorts: dict[str, dict]) -> None:
        for identifiant, doc in sorts.items():
            assert tuple(doc) == CLES_SORT, identifiant


class TestEncodage:
    @pytest.mark.parametrize("chemin", tous_les_fichiers(), ids=lambda p: p.name)
    def test_decodage_utf8_strict(self, chemin: Path) -> None:
        chemin.read_bytes().decode("utf-8", errors="strict")

    @pytest.mark.parametrize("chemin", tous_les_fichiers(), ids=lambda p: p.name)
    def test_aucun_caractere_de_remplacement(self, chemin: Path) -> None:
        texte = chemin.read_text(encoding="utf-8")
        assert REMPLACEMENT not in texte, f"U+FFFD dans {chemin}"

    @pytest.mark.parametrize("chemin", tous_les_fichiers(), ids=lambda p: p.name)
    def test_sans_bom_et_en_lf(self, chemin: Path) -> None:
        octets = chemin.read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in octets

    def test_json_indente_avec_saut_final(self) -> None:
        for chemin in FIXTURE.rglob("*.json"):
            texte = chemin.read_text(encoding="utf-8")
            assert texte.endswith("\n")
            assert texte.startswith(("{\n", "[\n"))

    def test_jsonl_compact_une_ligne_par_entree(self, index: list[dict]) -> None:
        texte = (INDEX_FIXTURE / "sorts_uniques.jsonl").read_text(encoding="utf-8")
        assert texte.endswith("\n")
        lignes = texte.splitlines()
        assert len(lignes) == 12 == len(index)
        assert all(", " not in l and '": ' not in l for l in lignes)

    def test_accents_preserves(self, sorts: dict[str, dict]) -> None:
        assert sorts["arret-du-temps"]["nom"] == "Arrêt du temps"


class TestSchema:
    """Le critère « passe le validateur Phase 1 » : zéro erreur de schéma."""

    @pytest.fixture(scope="class")
    def validateur(self, repo_root: Path) -> Draft202012Validator:
        schema = json.loads(
            (repo_root / "schemas/sort.schema.json").read_text(encoding="utf-8")
        )
        return Draft202012Validator(schema)

    def test_chaque_sort_valide(
        self, validateur: Draft202012Validator, sorts: dict[str, dict]
    ) -> None:
        for identifiant, doc in sorts.items():
            erreurs = sorted(validateur.iter_errors(doc), key=lambda e: e.json_path)
            assert not erreurs, [
                f"{identifiant} {e.json_path}: {e.message}" for e in erreurs
            ]


class TestCoherenceDeLIndexReduit:
    def test_index_et_fichiers_couvrent_le_meme_ensemble(
        self, index: list[dict], sorts: dict[str, dict]
    ) -> None:
        assert {e["id"] for e in index} == set(sorts) == set(IDS_GELES)

    def test_index_aligne_sur_les_fichiers(
        self, index: list[dict], sorts: dict[str, dict]
    ) -> None:
        for entree in index:
            doc = sorts[entree["id"]]
            assert entree["nom"] == doc["nom"]
            assert entree["url"] == doc["url"]
            assert entree["nb_classes"] == len(entree["classes"])

    def test_toute_classe_citee_existe_dans_le_referentiel_reduit(
        self, sorts: dict[str, dict], referentiel: list[dict]
    ) -> None:
        slugs = {c["slug"] for c in referentiel}
        libelles = {c["classe"] for c in referentiel}
        for identifiant, doc in sorts.items():
            for classe in doc["classes"]:
                assert classe["slug"] in slugs, (identifiant, classe["slug"])
                assert classe["classe"] in libelles, (identifiant, classe["classe"])

    def test_referentiel_reduit_sans_classe_orpheline(
        self, sorts: dict[str, dict], referentiel: list[dict]
    ) -> None:
        cites = {c["classe"] for doc in sorts.values() for c in doc["classes"]}
        assert {c["classe"] for c in referentiel} == cites

    def test_referentiel_garde_la_forme_du_vrai_fichier(
        self, referentiel: list[dict], repo_root: Path
    ) -> None:
        reel = json.loads((repo_root / "data/classes.json").read_text(encoding="utf-8"))
        assert referentiel
        assert all(set(c) == set(reel[0]) for c in referentiel)
        # Réduit, donc copié : chaque entrée est un enregistrement du vrai fichier.
        assert all(c in reel for c in referentiel)

    def test_carte_doublons_partition_avec_les_exclusifs(
        self, index: list[dict]
    ) -> None:
        carte = json.loads(
            (INDEX_FIXTURE / "carte_doublons.json").read_text(encoding="utf-8")
        )
        exclusifs = json.loads(
            (INDEX_FIXTURE / "sorts_exclusifs.json").read_text(encoding="utf-8")
        )
        partages = set(carte["sorts_partages"])
        seuls = {
            s["id"]
            for seau in exclusifs["par_classe"].values()
            for s in seau["sorts"]
        }
        assert carte["nb_sorts_uniques"] == 12
        assert carte["nb_sorts_partages"] == len(partages)
        assert not partages & seuls
        assert partages | seuls == {e["id"] for e in index}
        assert partages == {e["id"] for e in index if e["partage"]}

    def test_exclusifs_totaux_couvrent_le_referentiel(
        self, referentiel: list[dict]
    ) -> None:
        exclusifs = json.loads(
            (INDEX_FIXTURE / "sorts_exclusifs.json").read_text(encoding="utf-8")
        )
        assert set(exclusifs["totaux"]) == {c["classe"] for c in referentiel}
        for libelle, seau in exclusifs["par_classe"].items():
            assert seau["nb"] == len(seau["sorts"]) == exclusifs["totaux"][libelle]


class TestSlugs:
    def test_id_egale_slugify_du_nom(self, sorts: dict[str, dict]) -> None:
        for identifiant, doc in sorts.items():
            assert identifiant == doc["id"] == slugify(doc["nom"])

    def test_aucun_suffixe_de_collision_dans_la_selection(
        self, sorts: dict[str, dict]
    ) -> None:
        # Choix assumé : la fixture évite les slugs `-2`/`-3` pour ne pas mêler
        # la question des collisions à celle de la couverture des critères.
        assert not [i for i in sorts if re.search(r"-\d+$", i)]


class TestCouvertureDesCriteres:
    """Un test par critère du plan, asserté sur les données, pas sur le README."""

    def test_a_un_sort_de_niveau_zero(self, index: list[dict]) -> None:
        assert [e["id"] for e in index if e["niveau_min"] == 0] == [
            "destruction-de-mort-vivant"
        ]

    def test_b_un_sort_de_niveau_neuf(self, index: list[dict]) -> None:
        assert [e["id"] for e in index if e["niveau_max"] == 9]

    def test_c_au_moins_deux_ecoles_de_base_distinctes(
        self, sorts: dict[str, dict]
    ) -> None:
        bases = {(d["ecole"] or "").split(" (")[0] for d in sorts.values()}
        assert len(bases) >= 2
        assert {"Abjuration", "Transmutation"} <= bases

    def test_d_un_sort_a_degats(self, sorts: dict[str, dict]) -> None:
        assert [
            i for i, d in sorts.items() if re.search(r"\d\s*d\s*\d", d["description"])
        ]

    def test_e_un_sort_sans_degats(self, sorts: dict[str, dict]) -> None:
        assert [
            i
            for i, d in sorts.items()
            if not re.search(r"\d\s*d\s*\d", d["description"])
        ]

    def test_f_un_sort_de_zone(self, sorts: dict[str, dict]) -> None:
        motif = re.compile(r"zone|émanation|sphère|rayon|cône|propagation", re.I)
        assert [
            i
            for i, d in sorts.items()
            if motif.search(f"{d['cible'] or ''} {d['portee'] or ''}")
        ]

    def test_g_un_sort_a_portee_personnelle(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if "personnel" in (d["portee"] or "").lower()]

    def test_h_une_description_longue_avec_tableau(
        self, sorts: dict[str, dict]
    ) -> None:
        longs = [
            i
            for i, d in sorts.items()
            if len(d["description"]) >= SEUIL_DESCRIPTION_LONGUE
            and "<table" in d["description_html"]
        ]
        assert longs == ["animation-des-morts"]

    def test_i_un_desaccord_liste_page(self, sorts: dict[str, dict]) -> None:
        assert [
            i
            for i, d in sorts.items()
            if any(c.get("concordance") is not True for c in d["classes"])
        ]

    def test_j_une_apostrophe_dans_un_nom(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if "'" in d["nom"] or "’" in d["nom"]]

    def test_k_un_accent_dans_un_nom(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if re.search(r"[^\x00-\x7f]", d["nom"])]

    def test_l_un_trait_d_union_dans_un_nom(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if "-" in d["nom"]]

    def test_m_un_bloc_mythique_non_nul(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if d["mythique"] is not None]

    def test_n_un_mythique_nul(self, sorts: dict[str, dict]) -> None:
        assert [i for i, d in sorts.items() if d["mythique"] is None]


class TestCopieVerbatim:
    """« Copiée, pas retapée » — et le message d'échec dit pourquoi c'est gelé."""

    @pytest.mark.parametrize("identifiant", IDS_GELES)
    def test_octet_pour_octet_identique_au_corpus_reel(
        self, identifiant: str, repo_root: Path
    ) -> None:
        gelee = (SORTS_FIXTURE / f"{identifiant}.json").read_bytes()
        reelle = (repo_root / f"data/sorts/{identifiant}.json").read_bytes()
        assert gelee == reelle, f"{identifiant} : {MESSAGE_GEL}"

    @pytest.mark.parametrize("identifiant", IDS_GELES)
    def test_entree_d_index_identique_au_corpus_reel(
        self, identifiant: str, repo_root: Path, index: list[dict]
    ) -> None:
        reel = {
            json.loads(l)["id"]: json.loads(l)
            for l in (repo_root / "data/index/sorts_uniques.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
        }
        (entree,) = [e for e in index if e["id"] == identifiant]
        assert entree == reel[identifiant], f"{identifiant} : {MESSAGE_GEL}"


class TestDocumentationDuGel:
    def test_readme_declare_le_gel_et_le_commit_source(self) -> None:
        texte = (FIXTURE / "README.md").read_text(encoding="utf-8")
        assert "GELÉE" in texte
        assert "un mauvais test" in texte
        assert re.search(r"\b[0-9a-f]{40}\b", texte), "sha du commit source absent"
        assert "U+FFFD" in texte

    def test_readme_cite_les_douze_ids(self) -> None:
        texte = (FIXTURE / "README.md").read_text(encoding="utf-8")
        for identifiant in IDS_GELES:
            assert f"`{identifiant}`" in texte
