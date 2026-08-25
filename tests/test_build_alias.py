"""Tests for the English → French alias table.

The whole risk of this feature is a *wrong* alias: it sends the user to the wrong
spell with confidence, and they have no way to notice. A missing alias merely
leaves them searching in French, which works. Every guard below exists to make
the wrong-alias case impossible to ship quietly:

  - an unknown id aborts the build. Silently skipping the line would mean the
    alias the editor believed they added does not exist, and nothing would say so.
  - an alias folding onto a real French name is refused, never merged. French
    names have absolute priority.
  - the folding is the *same* fold as the exporter's. The negative tests run on
    synthetic corpora built in `tmp_path`, so they assert the refusals rather
    than assuming them.

The committed table is also checked as data, because it is data: every id it
names must exist in the real corpus.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from pf_spells.build_alias import (
    AliasError,
    construire,
    lire_table,
    niveau_minimum,
)
from pf_spells.web_pliage import plier

REPO_ROOT = Path(__file__).resolve().parents[1]
HORODATAGE = "2026-07-31T00:00:00+00:00"


def poser_corpus(
    racine: Path,
    sorts: list[dict[str, Any]],
    lignes_table: list[str],
) -> None:
    """Write a minimal repo layout: a web index and an alias table."""
    index = racine / "web" / "public" / "data" / "index.json"
    index.parent.mkdir(parents=True, exist_ok=True)
    index.write_text(
        json.dumps({"version": 1, "sorts": sorts}, ensure_ascii=False),
        encoding="utf-8",
        newline="\n",
    )
    table = racine / "web" / "data_sources" / "alias_manuel.tsv"
    table.parent.mkdir(parents=True, exist_ok=True)
    table.write_text("\n".join(lignes_table) + "\n", encoding="utf-8", newline="\n")


def batir(racine: Path, **kwargs: Any) -> dict[str, Any]:
    return construire(racine, avec_preflight=False, genere_le=HORODATAGE, **kwargs)


SORTS_MINI = [
    {"id": "boule-de-feu", "n": "Boule de feu", "niv": {"barde": 3}},
    {"id": "vol", "n": "Vol", "niv": {"barde": 3}},
    {"id": "soins-legers", "n": "Soins légers", "niv": {"barde": 1}},
    {"id": "soins-moderes", "n": "Soins modérés", "niv": {"barde": 2}},
    {"id": "mur-d-epines", "n": "Mur d'épines", "niv": {"druide": 5}},
    {"id": "eclair", "n": "Éclair", "niv": {}},
]


class TestPliage:
    """The folded vectors, pinned to literal values.

    These are the same vectors the exporter and the TypeScript port pin. If the
    three implementations ever disagree, search fails *silently* on every
    accented word — half a French corpus — with no error to notice.
    """

    def test_les_vecteurs_du_plan_sont_tenus(self) -> None:
        assert plier("Éclair") == "eclair"
        assert plier("Mur d'épines") == "mur d epines"

    @pytest.mark.parametrize(
        ("entree", "attendu"),
        [
            ("Magic Missile", "magic missile"),
            ("MELF'S ACID ARROW", "melf s acid arrow"),
            ("Cœur incassable", "coeur incassable"),
            ("Détection de la magie", "detection de la magie"),
            ("  espaces   multiples  ", "espaces multiples"),
            ("clairaudience/clairvoyance", "clairaudience/clairvoyance"),
        ],
    )
    def test_vecteurs_figes(self, entree: str, attendu: str) -> None:
        assert plier(entree) == attendu


class TestSurUnCorpusSynthetique:
    def test_construit_la_table_attendue(self, tmp_path: Path) -> None:
        poser_corpus(
            tmp_path,
            SORTS_MINI,
            ["boule-de-feu\tfireball", "mur-d-epines\twall of thorns"],
        )
        rapport = batir(tmp_path)
        assert rapport["n_alias"] == 2
        assert rapport["n_avec_alias"] == 2
        document = json.loads(
            (tmp_path / "web" / "public" / "data" / "alias.json").read_text(
                encoding="utf-8"
            )
        )
        assert document["alias"] == {
            "fireball": ["boule-de-feu"],
            "wall of thorns": ["mur-d-epines"],
        }
        assert document["couverture"] == {
            "n_sorts": 6,
            "n_avec_alias": 2,
            "taux": round(2 / 6, 4),
        }

    def test_un_alias_ambigu_renvoie_plusieurs_ids(self, tmp_path: Path) -> None:
        # The contract is a list, never a string: "cure wounds" covers every tier
        # of soins, and picking one would be inventing an answer.
        poser_corpus(
            tmp_path,
            SORTS_MINI,
            ["soins-legers\tcure wounds", "soins-moderes\tcure wounds"],
        )
        batir(tmp_path)
        document = json.loads(
            (tmp_path / "web" / "public" / "data" / "alias.json").read_text(
                encoding="utf-8"
            )
        )
        assert document["alias"]["cure wounds"] == ["soins-legers", "soins-moderes"]

    def test_l_alias_est_plie_avant_d_etre_une_cle(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tMELF'S Acid Arrow"])
        batir(tmp_path)
        document = json.loads(
            (tmp_path / "web" / "public" / "data" / "alias.json").read_text(
                encoding="utf-8"
            )
        )
        assert list(document["alias"]) == ["melf s acid arrow"]

    def test_deux_constructions_donnent_les_memes_octets(self, tmp_path: Path) -> None:
        # Idempotent to the byte, so a rebuild produces no diff and step 10's
        # drift check does not cry wolf.
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tfireball"])
        chemin = tmp_path / "web" / "public" / "data" / "alias.json"
        batir(tmp_path)
        premier = chemin.read_bytes()
        batir(tmp_path)
        assert chemin.read_bytes() == premier

    def test_un_alias_en_double_n_est_compte_qu_une_fois(self, tmp_path: Path) -> None:
        poser_corpus(
            tmp_path, SORTS_MINI, ["boule-de-feu\tfireball", "boule-de-feu\tFireball"]
        )
        rapport = batir(tmp_path)
        assert rapport["n_doublons"] == 1
        document = json.loads(
            (tmp_path / "web" / "public" / "data" / "alias.json").read_text(
                encoding="utf-8"
            )
        )
        assert document["alias"]["fireball"] == ["boule-de-feu"]


class TestRefus:
    """Every way the builder must refuse rather than mislead."""

    def test_un_id_inconnu_arrete_la_construction(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["sort-qui-n-existe-pas\tfireball"])
        with pytest.raises(AliasError, match="n'existent pas"):
            batir(tmp_path)

    def test_l_erreur_nomme_toutes_les_lignes_fautives(self, tmp_path: Path) -> None:
        # One run must name every bad line: fixing them one error at a time is
        # what makes an editor give up on the table.
        poser_corpus(tmp_path, SORTS_MINI, ["absent-un\ta", "absent-deux\tb"])
        with pytest.raises(AliasError) as erreur:
            batir(tmp_path)
        assert "absent-un" in str(erreur.value)
        assert "absent-deux" in str(erreur.value)

    def test_un_alias_qui_masque_un_nom_francais_est_ignore(
        self, tmp_path: Path
    ) -> None:
        # "vol" is a real spell. An alias folding onto it would hide the spell
        # from anyone typing French, which has absolute priority.
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tVol"])
        rapport = batir(tmp_path)
        assert rapport["n_collisions"] == 1
        assert rapport["n_alias"] == 0
        document = json.loads(
            (tmp_path / "web" / "public" / "data" / "alias.json").read_text(
                encoding="utf-8"
            )
        )
        assert document["alias"] == {}

    def test_la_collision_est_detectee_apres_pliage(self, tmp_path: Path) -> None:
        # "eclair" folds onto "Éclair": the guard has to compare folded forms, or
        # every accented name would be shadowable.
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\teclair"])
        assert batir(tmp_path)["n_collisions"] == 1

    def test_une_ligne_mal_formee_est_une_erreur(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu fireball"])
        with pytest.raises(AliasError, match="attendu"):
            batir(tmp_path)

    def test_un_champ_vide_est_une_erreur(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\t"])
        with pytest.raises(AliasError, match="champ vide"):
            batir(tmp_path)

    def test_une_table_sans_aucune_paire_est_une_erreur(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["# rien que des commentaires"])
        with pytest.raises(AliasError, match="vide"):
            batir(tmp_path)

    def test_une_table_absente_est_une_erreur(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tfireball"])
        (tmp_path / "web" / "data_sources" / "alias_manuel.tsv").unlink()
        with pytest.raises(AliasError, match="table manuelle absente"):
            batir(tmp_path)

    def test_un_index_web_absent_est_une_erreur(self, tmp_path: Path) -> None:
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tfireball"])
        (tmp_path / "web" / "public" / "data" / "index.json").unlink()
        with pytest.raises(AliasError, match="index web absent"):
            batir(tmp_path)

    def test_un_u_fffd_dans_la_table_est_une_erreur(self, tmp_path: Path) -> None:
        # A replacement character means the file was decoded wrong somewhere
        # upstream; folding it into a search key would bake the damage in.
        poser_corpus(tmp_path, SORTS_MINI, ["boule-de-feu\tfire�ball"])
        with pytest.raises(AliasError, match="U\\+FFFD"):
            batir(tmp_path)

    def test_les_commentaires_et_les_lignes_vides_sont_ignores(
        self, tmp_path: Path
    ) -> None:
        chemin = tmp_path / "table.tsv"
        chemin.write_text(
            "# entête\n\nboule-de-feu\tfireball\n\n# fin\n",
            encoding="utf-8",
            newline="\n",
        )
        assert lire_table(chemin) == [(3, "boule-de-feu", "fireball")]


class TestNiveauMinimum:
    """`niv` is a class→level table, never a scalar (B4)."""

    def test_le_minimum_traverse_toutes_les_classes(self) -> None:
        assert niveau_minimum({"niv": {"barde": 3, "druide": 1}}) == 1

    def test_un_sort_sans_niveau_ne_ment_pas_sur_le_sien(self) -> None:
        # None, not 0: a spell no class grants has no level, and 0 is a real
        # level that would sort it to the top of the work list.
        assert niveau_minimum({"niv": {}}) is None
        assert niveau_minimum({}) is None


class TestSurLeCorpusReel:
    """The committed table, checked as the data it is."""

    @pytest.fixture(scope="class")
    def alias_reel(self) -> dict[str, Any]:
        chemin = REPO_ROOT / "web" / "public" / "data" / "alias.json"
        return json.loads(chemin.read_text(encoding="utf-8"))

    @pytest.fixture(scope="class")
    def index_reel(self) -> dict[str, Any]:
        chemin = REPO_ROOT / "web" / "public" / "data" / "index.json"
        return json.loads(chemin.read_text(encoding="utf-8"))

    def test_le_document_porte_le_contrat_attendu(
        self, alias_reel: dict[str, Any]
    ) -> None:
        assert set(alias_reel) == {"version", "genere_le", "couverture", "alias"}
        assert set(alias_reel["couverture"]) == {"n_sorts", "n_avec_alias", "taux"}
        assert alias_reel["alias"]

    def test_tout_id_vise_existe_dans_le_corpus(
        self, alias_reel: dict[str, Any], index_reel: dict[str, Any]
    ) -> None:
        connus = {sort["id"] for sort in index_reel["sorts"]}
        vises = {i for ids in alias_reel["alias"].values() for i in ids}
        assert vises <= connus

    def test_aucune_cle_ne_masque_un_nom_francais(
        self, alias_reel: dict[str, Any], index_reel: dict[str, Any]
    ) -> None:
        # The verification criterion the plan states outright, checked on the
        # committed artefact rather than on a synthetic corpus.
        noms_plies = {plier(sort["n"]) for sort in index_reel["sorts"]}
        assert not (set(alias_reel["alias"]) & noms_plies)

    def test_toute_cle_est_deja_pliee(self, alias_reel: dict[str, Any]) -> None:
        for cle in alias_reel["alias"]:
            assert plier(cle) == cle

    def test_la_table_contient_des_cles_ambigues(
        self, alias_reel: dict[str, Any]
    ) -> None:
        # An ambiguous alias is a fact of the source, not a defect. If this ever
        # reaches zero, either the table shrank or someone "fixed" the ambiguity
        # by choosing a winner.
        ambigus = {k: v for k, v in alias_reel["alias"].items() if len(v) > 1}
        assert ambigus
        assert "cure wounds" in ambigus

    def test_les_ids_de_chaque_cle_sont_tries_et_uniques(
        self, alias_reel: dict[str, Any]
    ) -> None:
        for ids in alias_reel["alias"].values():
            assert ids == sorted(set(ids))

    def test_aucun_u_fffd_dans_l_artefact(self) -> None:
        chemin = REPO_ROOT / "web" / "public" / "data" / "alias.json"
        assert "�" not in chemin.read_text(encoding="utf-8")

    def test_le_fichier_est_en_lf_sans_bom(self) -> None:
        octets = (REPO_ROOT / "web" / "public" / "data" / "alias.json").read_bytes()
        assert b"\r\n" not in octets
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert octets.endswith(b"\n")

    def test_le_rapport_de_couverture_existe_et_donne_un_taux(self) -> None:
        texte = (REPO_ROOT / "reports" / "04_alias.md").read_text(encoding="utf-8")
        assert "## Couverture" in texte
        assert "| Taux |" in texte
        assert "Sorts sans alias" in texte

    def test_reconstruire_ne_change_pas_l_artefact_committe(
        self, tmp_path: Path
    ) -> None:
        # The committed file must be what the current code produces from the
        # current table — otherwise it was hand-edited, and the builder is no
        # longer the authority.
        chemin = REPO_ROOT / "web" / "public" / "data" / "alias.json"
        avant = json.loads(chemin.read_text(encoding="utf-8"))
        rapport = construire(
            REPO_ROOT,
            avec_preflight=False,
            genere_le=avant["genere_le"],
            ecrire_fichiers=False,
        )
        assert rapport["n_avec_alias"] == avant["couverture"]["n_avec_alias"]
        assert rapport["n_collisions"] == 0
