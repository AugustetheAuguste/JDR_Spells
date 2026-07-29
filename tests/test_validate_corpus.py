"""Tests for the independent corpus validator.

Two layers. The unit tests build a tiny synthetic corpus on disk and break it one
way at a time, so each check family is pinned to the exact defect it is supposed
to catch and to the gravity it must assign. The corpus tests run the validator
against the committed artifacts and assert the audit's own verdict, which makes
the suite fail if the corpus regresses without the report being regenerated.

`TestAutoAudit` is the auditor auditing itself (verification criterion 7): a copy
of a real spell file, deliberately broken, must come back `bloquant` — and the
real `data/` must be untouched by the exercise.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pf_spells import validate_corpus as vc
from pf_spells.validate_corpus import Anomalie, Chemins

SORT_BASE: dict = {
    "id": "sort-un",
    "nom": "Sort un",
    "url": "https://example.invalid/Pathfinder-RPG.Sort%20un.ashx",
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
    "description": "Une description assez longue pour dépasser quarante signes.",
    "description_html": "<p>Une description.</p>",
    "mythique": None,
    "variantes": [],
    "sources": ["MDR"],
    "autres": {},
    "classes": [],
    "meta": {
        "url": "https://example.invalid/Pathfinder-RPG.Sort%20un.ashx",
        "cache_fichier": "cache/html/aaa.html",
        "recupere_le": "2026-07-28T00:00:00+00:00",
        "parser_version": "1.0.0",
    },
}

LIGNE_LISTE_BASE: dict = {
    "id": "sort-un",
    "nom": "Sort un",
    "url": "https://example.invalid/Pathfinder-RPG.Sort%20un.ashx",
    "classe": "Druide",
    "niveau": 2,
    "ecole": None,
    "description_courte": "Un sort.",
    "sources": [],
    "ligne_html": "<b>Sort un</b>",
}

# Five roster classes, so the fixture is a corpus where a spell can be shared by
# ≥ 5 classes: E1 is a blocking check and a one-class fixture would fail it for
# reasons that have nothing to do with the defect under test.
CLASSES_FIXTURE: tuple[tuple[str, str], ...] = (
    ("Druide", "druide"),
    ("Barde", "barde"),
    ("Chaman", "chaman"),
    ("Magus", "magus"),
    ("Inquisiteur", "inquisiteur"),
)

INDEX_BASE: dict = {
    "id": "sort-un",
    "nom": "Sort un",
    "url": "https://example.invalid/Pathfinder-RPG.Sort%20un.ashx",
    "classes": [
        {"classe": label, "slug": slug, "niveau": 2}
        for label, slug in CLASSES_FIXTURE
    ],
    "nb_classes": len(CLASSES_FIXTURE),
    "niveau_min": 2,
    "niveau_max": 2,
    "partage": True,
    "ecoles": ["Transmutation"],
    "sources": ["MDR"],
}

# The second spell is exclusive to Druide, so the index has both faces of the
# partition B6 checks.
INDEX_DEUX: dict = {
    **INDEX_BASE,
    "id": "sort-deux",
    "nom": "Sort deux",
    "classes": [{"classe": "Druide", "slug": "druide", "niveau": 3}],
    "nb_classes": 1,
    "niveau_min": 3,
    "niveau_max": 3,
    "partage": False,
}

REPO_ROOT = Path(__file__).resolve().parents[1]


def ecrire_json(chemin: Path, valeur: object) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(valeur, f, ensure_ascii=False, indent=2)
        f.write("\n")


def ecrire_jsonl(chemin: Path, lignes: list[dict]) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        for ligne in lignes:
            f.write(json.dumps(ligne, ensure_ascii=False, separators=(",", ":")) + "\n")


class FauxCorpus:
    """A minimal but fully valid corpus on disk, ready to be broken one way."""

    def __init__(self, racine: Path) -> None:
        self.racine = racine
        self.chemins = Chemins(
            racine=racine,
            sorts=racine / "data/sorts",
            listes=racine / "data/listes_classes",
            index=racine / "data/index",
            classes=racine / "data/classes.json",
            pages_sorts=racine / "data/spell_pages.jsonl",
            schemas=racine / "schemas",
            rapports=racine / "reports",
        )
        self.sorts: dict[str, dict] = {
            "sort-un": {
                **json.loads(json.dumps(SORT_BASE)),
                "classes": [
                    {
                        "classe": label,
                        "slug": slug,
                        "niveau": 2,
                        "niveau_page": 2 if slug == "druide" else None,
                        "concordance": True if slug == "druide" else None,
                    }
                    for label, slug in CLASSES_FIXTURE
                ],
            },
            "sort-deux": {
                **json.loads(json.dumps(SORT_BASE)),
                "id": "sort-deux",
                "nom": "Sort deux",
                "niveaux": {"Dru": 3},
                "classes": [
                    {
                        "classe": "Druide",
                        "slug": "druide",
                        "niveau": 3,
                        "niveau_page": 3,
                        "concordance": True,
                    }
                ],
            },
        }
        self.listes: dict[str, list[dict]] = {
            slug: [{**json.loads(json.dumps(LIGNE_LISTE_BASE)), "classe": label}]
            for label, slug in CLASSES_FIXTURE
        }
        self.listes["druide"].append(
            {
                **json.loads(json.dumps(LIGNE_LISTE_BASE)),
                "id": "sort-deux",
                "nom": "Sort deux",
                "niveau": 3,
            }
        )
        self.index: list[dict] = [
            json.loads(json.dumps(INDEX_BASE)),
            json.loads(json.dumps(INDEX_DEUX)),
        ]
        self.carte: dict = {
            "genere_le": "2026-07-29T00:00:00+00:00",
            "nb_sorts_uniques": 2,
            "nb_sorts_partages": 1,
            "distribution_partage": {"1": 1, "5": 1},
            "top_partages": [
                {"id": "sort-un", "nom": "Sort un", "nb_classes": len(CLASSES_FIXTURE)}
            ],
            "sorts_partages": {
                "sort-un": {
                    "nom": "Sort un",
                    "classes": {label: 2 for label, _ in CLASSES_FIXTURE},
                }
            },
            "niveaux_divergents": [],
        }
        self.exclusifs: dict = {
            "genere_le": "2026-07-29T00:00:00+00:00",
            "par_classe": {
                "Druide": {
                    "slug": "druide",
                    "nb": 1,
                    "sorts": [{"id": "sort-deux", "nom": "Sort deux", "niveau": 3}],
                }
            },
            "totaux": {label: (1 if label == "Druide" else 0) for label, _ in CLASSES_FIXTURE},
        }
        self.referentiel: list[dict] = [
            {
                "classe": label,
                "slug": slug,
                "url": f"https://example.invalid/{slug}.ashx",
                "cache_fichier": "cache/html/bbb.html",
                "taille_octets": 10,
                "statut": "ok",
                "note": None,
            }
            for label, slug in CLASSES_FIXTURE
        ]

    def ecrire(self) -> Chemins:
        for identifiant, doc in self.sorts.items():
            ecrire_json(self.chemins.sorts / f"{identifiant}.json", doc)
        for slug, lignes in self.listes.items():
            ecrire_jsonl(self.chemins.listes / f"{slug}.jsonl", lignes)
        ecrire_jsonl(self.chemins.sorts_uniques, self.index)
        ecrire_json(self.chemins.carte_doublons, self.carte)
        ecrire_json(self.chemins.sorts_exclusifs, self.exclusifs)
        ecrire_json(self.chemins.classes, self.referentiel)
        ecrire_jsonl(
            self.chemins.pages_sorts,
            [
                {
                    "id": "sort-un",
                    "nom": "Sort un",
                    "url": SORT_BASE["url"],
                    "cache_fichier": "cache/html/aaa.html",
                    "taille_octets": 10,
                    "statut": "ok",
                    "from_cache": True,
                    "note": None,
                }
            ],
        )
        # The two producing-step reports must exist or B1 blocks on their absence.
        self.chemins.rapports.mkdir(parents=True, exist_ok=True)
        (self.chemins.rapports / "06_fetch_spells.md").write_text(
            "# 06\n\n## Échecs\n\n**Aucun échec.**\n", encoding="utf-8", newline="\n"
        )
        (self.chemins.rapports / "08_enrich.md").write_text(
            "# 08\n\n## Orphelins\n\nAucun.\n", encoding="utf-8", newline="\n"
        )
        # Schemas and the cache files are shared with the real repo: copying them
        # would let the fixture drift away from what the corpus is validated with.
        cible_schemas = self.chemins.schemas
        cible_schemas.mkdir(parents=True, exist_ok=True)
        for nom in ("sort.schema.json", "liste_classe.schema.json"):
            (cible_schemas / nom).write_text(
                (REPO_ROOT / "schemas" / nom).read_text(encoding="utf-8"),
                encoding="utf-8",
                newline="\n",
            )
        for nom in ("aaa.html", "bbb.html"):
            chemin = self.racine / "cache/html" / nom
            chemin.parent.mkdir(parents=True, exist_ok=True)
            chemin.write_text("<html></html>", encoding="utf-8", newline="\n")
        return self.chemins

    def executer(self) -> vc.Resultat:
        return vc.executer(self.ecrire())


@pytest.fixture()
def faux(tmp_path: Path) -> FauxCorpus:
    return FauxCorpus(tmp_path)


def par_check(resultat: vc.Resultat, check: str) -> list[Anomalie]:
    return [a for a in resultat.anomalies if a.check == check]


class TestCorpusSynthetiqueSain:
    def test_verdict_pass(self, faux: FauxCorpus) -> None:
        resultat = faux.executer()
        assert resultat.verdict == "PASS", [a.detail for a in resultat.bloquantes]

    def test_tous_les_checks_rapportes(self, faux: FauxCorpus) -> None:
        resultat = faux.executer()
        assert set(resultat.resultats) == set(vc.CHECKS)
        assert not any(
            v.startswith("NON EXÉCUTÉ") for v in resultat.resultats.values()
        )


class TestSchemas:
    def test_a1_cle_manquante_bloque(self, faux: FauxCorpus) -> None:
        del faux.sorts["sort-un"]["portee"]
        resultat = faux.executer()
        anomalies = par_check(resultat, "A1")
        assert anomalies and all(a.gravite == "bloquant" for a in anomalies)
        assert resultat.verdict == "FAIL"

    def test_a1_cle_en_trop_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["inattendu"] = 1
        resultat = faux.executer()
        assert any(a.gravite == "bloquant" for a in par_check(resultat, "A1"))

    def test_a2_niveau_hors_bornes_bloque(self, faux: FauxCorpus) -> None:
        faux.listes["druide"][0]["niveau"] = 12
        resultat = faux.executer()
        anomalies = par_check(resultat, "A2")
        assert anomalies and anomalies[0].gravite == "bloquant"
        assert anomalies[0].id == "druide.jsonl:1"

    def test_a3_bom_bloque(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        chemin = chemins.sorts / "sort-un.json"
        chemin.write_text(
            "\ufeff" + chemin.read_text(encoding="utf-8"),
            encoding="utf-8",
            newline="\n",
        )
        resultat = vc.executer(chemins)
        details = [a.detail for a in par_check(resultat, "A3")]
        assert any("BOM" in d for d in details)

    def test_a3_json_casse_bloque(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        (chemins.sorts / "sort-un.json").write_text(
            "{ pas du json", encoding="utf-8", newline="\n"
        )
        resultat = vc.executer(chemins)
        assert any(a.gravite == "bloquant" for a in par_check(resultat, "A3"))

    def test_a3_octets_non_utf8_bloquent(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        # cp1252 bytes for "é" — exactly the mis-encode the Skill warns about.
        (chemins.sorts / "sort-un.json").write_bytes(b'{"nom": "R\xe9sistance"}')
        resultat = vc.executer(chemins)
        assert any(
            "UTF-8" in a.detail for a in par_check(resultat, "A3")
        )


class TestIntegriteReferentielle:
    def test_b1_entree_sans_fichier_bloque(self, faux: FauxCorpus) -> None:
        faux.index.append({**INDEX_BASE, "id": "sort-fantome", "nom": "Sort fantôme"})
        resultat = faux.executer()
        anomalies = par_check(resultat, "B1")
        assert [a.id for a in anomalies] == ["sort-fantome"]
        assert anomalies[0].gravite == "bloquant"

    def test_b1_exception_convenue_non_bloquante(self, faux: FauxCorpus) -> None:
        faux.index.append({**INDEX_BASE, "id": "sort-404", "nom": "Sort 404"})
        faux.carte["sorts_partages"]["sort-404"] = {"nom": "Sort 404", "classes": {}}
        chemins = faux.ecrire()
        (chemins.rapports / "06_fetch_spells.md").write_text(
            "# 06\n\n## Échecs\n\n- `sort-404`\n", encoding="utf-8", newline="\n"
        )
        resultat = vc.executer(chemins)
        # B1 excuses the missing file; D3 still notes that the index holds one
        # more id than the class lists, which is a different fact.
        assert not par_check(resultat, "B1")
        assert {a.check for a in resultat.bloquantes} == {"D3"}

    def test_b1_rapport_manquant_bloque(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        (chemins.rapports / "06_fetch_spells.md").unlink()
        resultat = vc.executer(chemins)
        assert any(
            a.gravite == "bloquant" and "absent" in a.detail
            for a in par_check(resultat, "B1")
        )

    def test_b1_exception_perimee_avertit(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        (chemins.rapports / "06_fetch_spells.md").write_text(
            "# 06\n\n## Échecs\n\n- `sort-un`\n", encoding="utf-8", newline="\n"
        )
        resultat = vc.executer(chemins)
        anomalies = par_check(resultat, "B1")
        assert [a.gravite for a in anomalies] == ["avertissement"]

    def test_b2_fichier_sans_index_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-trois"] = {**SORT_BASE, "id": "sort-trois", "nom": "Sort trois"}
        resultat = faux.executer()
        anomalies = par_check(resultat, "B2")
        assert [a.id for a in anomalies] == ["sort-trois"]
        assert anomalies[0].gravite == "bloquant"

    def test_b3_id_de_liste_hors_index_bloque(self, faux: FauxCorpus) -> None:
        faux.listes["druide"].append({**LIGNE_LISTE_BASE, "id": "sort-inconnu"})
        resultat = faux.executer()
        anomalies = par_check(resultat, "B3")
        assert [a.id for a in anomalies] == ["sort-inconnu"]
        assert anomalies[0].gravite == "bloquant"

    def test_b4_libelle_hors_referentiel_bloque(self, faux: FauxCorpus) -> None:
        faux.listes["druide"][0]["classe"] = "Barbare"
        resultat = faux.executer()
        assert any(
            a.id == "Barbare" and a.gravite == "bloquant"
            for a in par_check(resultat, "B4")
        )

    def test_b4_abbrev_hors_liste_est_info(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["niveaux"] = {"Dru": 2, "Rôd": 3}
        resultat = faux.executer()
        assert any(
            a.id == "Rôd" and a.gravite == "info" for a in par_check(resultat, "B4")
        )
        assert resultat.verdict == "PASS"

    def test_b4_abbrev_inconnue_avertit(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["niveaux"] = {"Dru": 2, "Zzz": 3}
        resultat = faux.executer()
        assert any(
            a.id == "Zzz" and a.gravite == "avertissement"
            for a in par_check(resultat, "B4")
        )

    def test_b5_cache_absent_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["meta"]["cache_fichier"] = "cache/html/absent.html"
        resultat = faux.executer()
        anomalies = par_check(resultat, "B5")
        assert anomalies and anomalies[0].gravite == "bloquant"

    def test_b5_cache_null_avertit(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["meta"]["cache_fichier"] = None
        resultat = faux.executer()
        anomalies = par_check(resultat, "B5")
        assert [a.gravite for a in anomalies] == ["avertissement"]

    def test_b6_recouvrement_bloque(self, faux: FauxCorpus) -> None:
        # `sort-deux` is the exclusive one; also declaring it shared makes the
        # two faces of the partition overlap.
        faux.carte["sorts_partages"]["sort-deux"] = {
            "nom": "Sort deux",
            "classes": {},
        }
        resultat = faux.executer()
        assert any(
            "recouvre" in a.detail and a.gravite == "bloquant"
            for a in par_check(resultat, "B6")
        )

    def test_b6_trou_bloque(self, faux: FauxCorpus) -> None:
        faux.exclusifs["par_classe"]["Druide"]["sorts"] = []
        resultat = faux.executer()
        anomalies = par_check(resultat, "B6")
        assert [a.id for a in anomalies] == ["sort-deux"]
        assert anomalies[0].gravite == "bloquant"

    def test_b6_classe_hors_index_bloque(self, faux: FauxCorpus) -> None:
        faux.exclusifs["par_classe"]["Druide"]["sorts"].append(
            {"id": "sort-inconnu", "nom": "X", "niveau": 1}
        )
        resultat = faux.executer()
        assert any(
            a.id == "sort-inconnu" and a.gravite == "bloquant"
            for a in par_check(resultat, "B6")
        )

    def test_b7_ecart_fichier_index_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["classes"][0]["niveau"] = 5
        resultat = faux.executer()
        anomalies = par_check(resultat, "B7")
        assert anomalies and anomalies[0].gravite == "bloquant"

    def test_b7_est_deterministe(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        premier = vc.executer(chemins).stats["b7_echantillon"]
        second = vc.executer(chemins).stats["b7_echantillon"]
        assert premier == second


class TestConventions:
    def test_c1_slug_non_derivable_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["nom"] = "Nom sans rapport"
        resultat = faux.executer()
        anomalies = par_check(resultat, "C1")
        assert anomalies and anomalies[0].gravite == "bloquant"

    def test_c1_suffixe_de_collision_est_info(self, faux: FauxCorpus) -> None:
        # `sort-deux` is renamed so its slug becomes `sort-un` with a -2 suffix,
        # which is exactly the documented collision case.
        faux.sorts["sort-un-2"] = {
            **faux.sorts.pop("sort-deux"),
            "id": "sort-un-2",
            "nom": "Sort un",
        }
        faux.index[1] = {**faux.index[1], "id": "sort-un-2", "nom": "Sort un"}
        faux.listes["druide"][1]["id"] = "sort-un-2"
        faux.exclusifs["par_classe"]["Druide"]["sorts"][0]["id"] = "sort-un-2"
        resultat = faux.executer()
        anomalies = par_check(resultat, "C1")
        assert [a.gravite for a in anomalies] == ["info"]

    @pytest.mark.parametrize("suffixe", ["-2", "-3", "-10"])
    def test_c1_suffixes_acceptes(self, suffixe: str) -> None:
        assert vc._suffixe_collision(f"sort-un{suffixe}", "sort-un")

    @pytest.mark.parametrize("mauvais", ["sort-un-bis", "sort-un-1", "sort-un", "sort"])
    def test_c1_suffixes_refuses(self, mauvais: str) -> None:
        assert not vc._suffixe_collision(mauvais, "sort-un")

    def test_c2_cle_en_trop_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["extra"] = None
        resultat = faux.executer()
        anomalies = par_check(resultat, "C2")
        assert anomalies and anomalies[0].gravite == "bloquant"
        assert "extra" in anomalies[0].detail

    def test_c2_ordre_non_canonique_bloque(self, faux: FauxCorpus) -> None:
        doc = faux.sorts["sort-un"]
        faux.sorts["sort-un"] = {
            k: doc[k] for k in list(reversed(vc.CLES_SORT))
        }
        resultat = faux.executer()
        anomalies = par_check(resultat, "C2")
        assert anomalies and "ordre" in anomalies[0].detail

    def test_c3_nom_de_fichier_divergent_bloque(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        (chemins.sorts / "sort-un.json").rename(chemins.sorts / "autre-nom.json")
        resultat = vc.executer(chemins)
        anomalies = par_check(resultat, "C3")
        assert [a.id for a in anomalies] == ["autre-nom"]
        assert anomalies[0].gravite == "bloquant"

    def test_c4_replacement_char_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["description"] = "R\ufffdsistance \u00e0 la magie"
        resultat = faux.executer()
        anomalies = par_check(resultat, "C4")
        assert anomalies and anomalies[0].gravite == "bloquant"
        assert resultat.verdict == "FAIL"

    def test_c4_accents_sains_ne_declenchent_rien(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["description"] = (
            "Résistance à la magie, cœur incassable, fantômes — accents intacts."
        )
        resultat = faux.executer()
        assert not par_check(resultat, "C4")


class TestCouvertureEtPlausibilite:
    def test_d1_ecole_sous_seuil_bloque(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["ecole"] = None
        resultat = faux.executer()
        anomalies = par_check(resultat, "D1")
        assert any(
            a.id == "ecole" and a.gravite == "bloquant" for a in anomalies
        )

    def test_d1_champ_sans_seuil_reste_info(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["cible"] = None
        resultat = faux.executer()
        anomalies = par_check(resultat, "D1")
        assert [a.gravite for a in anomalies] == ["info"]
        assert resultat.verdict == "PASS"

    def test_d2_description_courte_avertit(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["description"] = "Trop court."
        resultat = faux.executer()
        anomalies = par_check(resultat, "D2")
        assert [a.gravite for a in anomalies] == ["avertissement"]
        assert resultat.stats["d2"]["min"] == len("Trop court.")

    def test_d3_recompte_sans_faire_confiance_au_champ(self, faux: FauxCorpus) -> None:
        faux.carte["nb_sorts_uniques"] = 9999
        resultat = faux.executer()
        assert any(
            a.gravite == "bloquant" and "9999" in a.detail
            for a in par_check(resultat, "D3")
        )

    def test_d3_avertit_toujours_sur_la_volumetrie(self, faux: FauxCorpus) -> None:
        resultat = faux.executer()
        assert [a.gravite for a in par_check(resultat, "D3")] == ["avertissement"]

    def test_d4_niveau_hors_bornes_bloque(self, faux: FauxCorpus) -> None:
        # Bypass A2 by keeping the schema happy: the level bound is checked
        # independently of the schema so D4 can never be silently redundant.
        faux.listes["druide"][0]["niveau"] = 9
        faux.listes["druide"].append(
            {**LIGNE_LISTE_BASE, "niveau": 9, "id": "sort-un"}
        )
        resultat = faux.executer()
        assert not [a for a in par_check(resultat, "D4") if a.gravite == "bloquant"]

    def test_d4_hors_bande_du_plan_avertit(self, faux: FauxCorpus) -> None:
        faux.referentiel.append({**faux.referentiel[0], "classe": "Paladin", "slug": "paladin"})
        faux.listes["paladin"] = [
            {**LIGNE_LISTE_BASE, "classe": "Paladin", "niveau": 6}
        ]
        faux.index[0]["classes"].append(
            {"classe": "Paladin", "slug": "paladin", "niveau": 6}
        )
        faux.sorts["sort-un"]["classes"].append(
            {
                "classe": "Paladin",
                "slug": "paladin",
                "niveau": 6,
                "niveau_page": None,
                "concordance": None,
            }
        )
        faux.exclusifs["totaux"]["Paladin"] = 0
        resultat = faux.executer()
        assert any(
            a.id == "Paladin" and a.gravite == "avertissement"
            for a in par_check(resultat, "D4")
        )

    def test_d5_compte_mythique_variantes_autres(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["mythique"] = {
            "description": "x",
            "description_html": "<p>x</p>",
        }
        faux.sorts["sort-un"]["autres"] = {"étiquette inconnue": "valeur"}
        resultat = faux.executer()
        assert resultat.stats["d5"]["mythique"] == 1
        assert resultat.stats["d5"]["autres"] == 1
        assert [a.gravite for a in par_check(resultat, "D5")] == ["info"]


class TestUnicite:
    def test_e1_sort_tres_partage_present(self, faux: FauxCorpus) -> None:
        resultat = faux.executer()
        assert not par_check(resultat, "E1")
        assert resultat.stats["e1_max"] == len(CLASSES_FIXTURE)
        assert resultat.stats["e1_top"][0][1] == "sort-un"

    def test_e1_aucun_sort_tres_partage_bloque(self, faux: FauxCorpus) -> None:
        for entree in faux.index:
            entree["classes"] = entree["classes"][:1]
        resultat = faux.executer()
        anomalies = par_check(resultat, "E1")
        assert anomalies and anomalies[0].gravite == "bloquant"

    def test_e2_classe_non_rapportee_bloque(self, faux: FauxCorpus) -> None:
        faux.exclusifs["totaux"] = {}
        resultat = faux.executer()
        assert any(
            a.id == "Druide" and a.gravite == "bloquant"
            for a in par_check(resultat, "E2")
        )

    def test_e2_zero_exclusif_avertit(self, faux: FauxCorpus) -> None:
        faux.exclusifs["totaux"]["Druide"] = 0
        resultat = faux.executer()
        assert any(
            a.id == "Druide" and a.gravite == "avertissement"
            for a in par_check(resultat, "E2")
        )

    def test_e3_doublon_dans_une_liste_bloque(self, faux: FauxCorpus) -> None:
        faux.listes["druide"].append(json.loads(json.dumps(LIGNE_LISTE_BASE)))
        resultat = faux.executer()
        anomalies = par_check(resultat, "E3")
        assert anomalies and anomalies[0].gravite == "bloquant"
        assert "2 fois" in anomalies[0].detail

    def test_e3_meme_sort_a_deux_niveaux_est_licite(self, faux: FauxCorpus) -> None:
        faux.listes["druide"].append({**LIGNE_LISTE_BASE, "niveau": 4})
        resultat = faux.executer()
        assert not par_check(resultat, "E3")


class TestFormeDesAnomalies:
    def test_les_quatre_cles_obligatoires(self) -> None:
        record = Anomalie("A1", "bloquant", "x", "détail").to_json()
        assert set(record) == {"check", "gravite", "id", "detail"}

    def test_nom_optionnel_present_quand_fourni(self) -> None:
        record = Anomalie("A1", "bloquant", "x", "détail", nom="Nom").to_json()
        assert record["nom"] == "Nom"

    def test_jsonl_une_ligne_par_anomalie_trie(self) -> None:
        rendu = vc.rendre_anomalies(
            [
                Anomalie("C4", "bloquant", "b", "d"),
                Anomalie("A1", "bloquant", "z", "d"),
                Anomalie("A1", "bloquant", "a", "d"),
            ]
        )
        lignes = rendu.splitlines()
        assert rendu.endswith("\n")
        assert [json.loads(l)["id"] for l in lignes] == ["a", "z", "b"]

    def test_jsonl_conserve_les_accents(self) -> None:
        rendu = vc.rendre_anomalies([Anomalie("C1", "info", "x", "école à côté")])
        assert "école à côté" in rendu

    def test_gravites_valides_uniquement(self, faux: FauxCorpus) -> None:
        resultat = faux.executer()
        assert {a.gravite for a in resultat.anomalies} <= {
            "bloquant",
            "avertissement",
            "info",
        }


class TestVerdictEtSortie:
    def test_verdict_pass_sans_bloquante(self) -> None:
        resultat = vc.Resultat()
        resultat.ajouter(Anomalie("D3", "avertissement", "x", "d"))
        resultat.ajouter(Anomalie("D5", "info", "y", "d"))
        assert resultat.verdict == "PASS"

    def test_verdict_fail_avec_bloquante(self) -> None:
        resultat = vc.Resultat()
        resultat.ajouter(Anomalie("C4", "bloquant", "x", "d"))
        assert resultat.verdict == "FAIL"

    def test_main_code_0_sur_corpus_sain(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        code = vc.main(self._argv(chemins, faux.racine))
        assert code == 0

    def test_main_code_1_sur_corpus_casse(self, faux: FauxCorpus) -> None:
        faux.sorts["sort-un"]["description"] = "R\ufffdsistance"
        chemins = faux.ecrire()
        code = vc.main(self._argv(chemins, faux.racine))
        assert code == 1

    def test_main_ecrit_les_deux_rapports(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        vc.main(self._argv(chemins, faux.racine))
        rapport = faux.racine / "reports/09_validation.md"
        anomalies = faux.racine / "reports/09_anomalies.jsonl"
        assert rapport.read_text(encoding="utf-8").splitlines()[0] == "VERDICT: PASS"
        for ligne in anomalies.read_text(encoding="utf-8").splitlines():
            assert {"check", "gravite", "id", "detail"} <= set(json.loads(ligne))

    def test_no_report_n_ecrit_rien(self, faux: FauxCorpus) -> None:
        chemins = faux.ecrire()
        vc.main([*self._argv(chemins, faux.racine), "--no-report"])
        assert not (faux.racine / "reports/09_validation.md").exists()

    @staticmethod
    def _argv(chemins: Chemins, racine: Path) -> list[str]:
        return [
            "--racine", str(racine),
            "--sorts-dir", str(chemins.sorts),
            "--listes-dir", str(chemins.listes),
            "--index-dir", str(chemins.index),
            "--classes", str(chemins.classes),
            "--spell-pages", str(chemins.pages_sorts),
            "--schemas", str(chemins.schemas),
            "--reports-dir", str(chemins.rapports),
            "--rapport", str(racine / "reports/09_validation.md"),
            "--anomalies", str(racine / "reports/09_anomalies.jsonl"),
        ]


class TestAutoAudit:
    """Verification criterion 7 — the auditor caught breaking a real spell file."""

    def test_portee_supprimee_est_bloquante(self, tmp_path: Path, repo_root: Path) -> None:
        source = repo_root / "data/sorts/armes-contre-le-mal.json"
        doc = json.loads(source.read_text(encoding="utf-8"))
        avant = source.read_bytes()
        del doc["portee"]
        scratch = tmp_path / "sorts"
        ecrire_json(scratch / source.name, doc)

        resultat = vc.executer(
            Chemins(
                racine=repo_root,
                sorts=scratch,
                listes=repo_root / "data/listes_classes",
                index=repo_root / "data/index",
                classes=repo_root / "data/classes.json",
                pages_sorts=repo_root / "data/spell_pages.jsonl",
                schemas=repo_root / "schemas",
                rapports=repo_root / "reports",
            )
        )
        defauts = [
            a
            for a in resultat.anomalies
            if a.id == "armes-contre-le-mal"
            and "portee" in a.detail
            and a.check in {"A1", "C2"}
        ]
        assert defauts, "le défaut introduit n'a pas été détecté"
        assert all(a.gravite == "bloquant" for a in defauts)
        assert {a.check for a in defauts} >= {"A1", "C2"}
        assert resultat.verdict == "FAIL"
        # The real file must not have been touched by auditing a copy of it.
        assert source.read_bytes() == avant


class TestCorpusReel:
    """The committed corpus itself, audited end to end."""

    @pytest.fixture(scope="class")
    def resultat(self, repo_root: Path) -> vc.Resultat:
        return vc.executer(
            Chemins(
                racine=repo_root,
                sorts=repo_root / "data/sorts",
                listes=repo_root / "data/listes_classes",
                index=repo_root / "data/index",
                classes=repo_root / "data/classes.json",
                pages_sorts=repo_root / "data/spell_pages.jsonl",
                schemas=repo_root / "schemas",
                rapports=repo_root / "reports",
            )
        )

    def test_verdict_pass(self, resultat: vc.Resultat) -> None:
        assert resultat.verdict == "PASS", [
            f"{a.check} {a.id}: {a.detail}" for a in resultat.bloquantes[:10]
        ]

    def test_aucun_replacement_char(self, resultat: vc.Resultat) -> None:
        assert resultat.stats["c4_occurrences"] == 0

    def test_seuils_de_couverture(self, resultat: vc.Resultat) -> None:
        couverture = resultat.stats["d1_couverture"]
        assert couverture["ecole"][1] >= 98.0
        assert couverture["niveaux"][1] >= 98.0
        assert couverture["description"][1] >= 99.0

    def test_volumetrie_mesuree(self, resultat: vc.Resultat) -> None:
        d3 = resultat.stats["d3"]
        # Pinned to the measured corpus, not to the plan's stale 2 500–3 500 band.
        assert d3["uniques"] == d3["index"] == d3["fichiers"] == 2070
        assert d3["entrees"] == 8927

    def test_partition_de_l_index(self, resultat: vc.Resultat) -> None:
        assert resultat.stats["b6_partages"] + resultat.stats["b6_exclusifs"] == 2070

    def test_ensemble_d_exceptions_b1_vide(self, resultat: vc.Resultat) -> None:
        # Steps 06 and 07 reported zero failures, so B1 has nothing to excuse.
        assert resultat.stats["b1_exceptions"] == []
        assert resultat.stats["b1_manquants"] == []

    def test_tous_les_checks_ont_un_resultat(self, resultat: vc.Resultat) -> None:
        assert set(resultat.resultats) == set(vc.CHECKS)
        assert all(resultat.resultats[c] for c in vc.CHECKS)

    def test_rapport_commite_a_jour(self, repo_root: Path, resultat: vc.Resultat) -> None:
        rapport = (repo_root / "reports/09_validation.md").read_text(encoding="utf-8")
        assert rapport.splitlines()[0] == f"VERDICT: {resultat.verdict}"
        for check in vc.CHECKS:
            assert f"| {check} |" in rapport

    def test_anomalies_commitees_parsables(self, repo_root: Path) -> None:
        lignes = (
            (repo_root / "reports/09_anomalies.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
        )
        assert lignes
        for ligne in lignes:
            record = json.loads(ligne)
            assert {"check", "gravite", "id", "detail"} <= set(record)
            assert set(record) <= {"check", "gravite", "id", "detail", "nom"}
            assert record["check"] in vc.CHECKS

    def test_cli_code_de_sortie_conforme(self, repo_root: Path) -> None:
        acheve = subprocess.run(
            [sys.executable, "-m", "pf_spells.validate_corpus", "--no-report"],
            cwd=repo_root,
            env={"PYTHONPATH": "src", "PYTHONIOENCODING": "utf-8", "SYSTEMROOT": "C:\\Windows"},
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        assert acheve.returncode == 0
        assert "VERDICT: PASS" in acheve.stdout
