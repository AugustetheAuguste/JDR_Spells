"""Tests for the class/level enrichment step.

The unit tests pin the join and the concordance verdict on synthetic documents;
the corpus tests check the committed `data/sorts/*.json` after enrichment, so a
stale or half-enriched corpus fails the suite.

The non-destructiveness test is the important one: `data/sorts/*.json` is
hand-correctable, so enrichment must touch the `classes` key and nothing else.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pf_spells import enrich_spells

DOC_MINIMAL = {
    "id": "sort-test",
    "nom": "Sort test",
    "url": "https://example.invalid/x.ashx",
    "ecole": "Transmutation",
    "descripteurs": [],
    "niveaux": {"Dru": 2, "Ens/Mag": 3},
    "temps_incantation": "1 action simple",
    "composantes": "V",
    "portee": "courte",
    "cible": None,
    "duree": "1 round",
    "jet_de_sauvegarde": "aucun",
    "resistance_magie": "non",
    "description": "texte",
    "description_html": "<p>texte</p>",
    "mythique": None,
    "variantes": [],
    "sources": [],
    "autres": {},
    "classes": [],
    "meta": {
        "url": "https://example.invalid/x.ashx",
        "cache_fichier": "cache/html/x.html",
        "recupere_le": "2026-07-28T00:00:00+00:00",
        "parser_version": "1.0.0",
    },
}


def entree(*classes: tuple[str, str, int]) -> dict:
    return {
        "id": "sort-test",
        "classes": [
            {"classe": c, "slug": s, "niveau": n} for c, s, n in classes
        ],
    }


class TestJoin:
    def test_agreement_is_concordant(self):
        classes, divergences, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL, entree(("Druide", "druide", 2))
        )
        assert classes == [
            {
                "classe": "Druide",
                "slug": "druide",
                "niveau": 2,
                "niveau_page": 2,
                "concordance": True,
            }
        ]
        assert divergences == []

    def test_disagreement_is_reported_not_reconciled(self):
        classes, divergences, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL, entree(("Druide", "druide", 5))
        )
        # The class-list level is preserved verbatim; only the verdict changes.
        assert classes[0]["niveau"] == 5
        assert classes[0]["niveau_page"] == 2
        assert classes[0]["concordance"] is False
        assert divergences[0]["classe"] == "Druide"
        assert divergences[0]["abbrevs"] == ["Dru"]

    def test_combined_label_matches_any_member_abbrev(self):
        # `Ens/Mag 3` on the page must concord with the combined roster label.
        classes, divergences, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL,
            entree(
                (
                    "Arcaniste/Ensorceleur/Magicien",
                    "arcaniste-ensorceleur-magicien",
                    3,
                )
            ),
        )
        assert classes[0]["concordance"] is True
        assert divergences == []

    def test_class_absent_from_the_page_is_null_not_false(self):
        # No abbreviation on the page means "unknown", which is not a divergence.
        classes, divergences, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL, entree(("Barde", "barde", 1))
        )
        assert classes[0]["niveau_page"] is None
        assert classes[0]["concordance"] is None
        assert divergences == []

    def test_chasseur_can_never_be_cross_checked(self):
        # Chasseur has no `Niveau`-line abbreviation anywhere in the corpus.
        assert enrich_spells.abbrevs_de_classe("Chasseur", "chasseur") == ()
        classes, _, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL, entree(("Chasseur", "chasseur", 1))
        )
        assert classes[0]["concordance"] is None

    def test_classes_are_sorted_by_label(self):
        classes, _, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL,
            entree(
                ("Druide", "druide", 2),
                ("Barde", "barde", 1),
                ("Chaman", "chaman", 3),
            ),
        )
        assert [c["classe"] for c in classes] == ["Barde", "Chaman", "Druide"]

    def test_entry_keys_are_exactly_the_contract(self):
        classes, _, _ = enrich_spells.enrichir_document(
            DOC_MINIMAL, entree(("Druide", "druide", 2))
        )
        assert tuple(classes[0]) == enrich_spells.CLES_CLASSE

    def test_member_spread_takes_the_minimum_and_is_reported(self):
        doc = {**DOC_MINIMAL, "niveaux": {"Ens": 3, "Mag": 4}}
        classes, _, spreads = enrich_spells.enrichir_document(
            doc,
            entree(
                (
                    "Arcaniste/Ensorceleur/Magicien",
                    "arcaniste-ensorceleur-magicien",
                    3,
                )
            ),
        )
        assert classes[0]["niveau_page"] == 3
        assert spreads[0]["niveaux"] == {"Ens": 3, "Mag": 4}
        assert spreads[0]["retenu"] == 3


class TestNonDestructiveness:
    def test_only_the_classes_key_changes(self, tmp_path: Path, repo_root: Path):
        # A hand-added sentinel elsewhere in the file must survive untouched.
        source = repo_root / "data" / "sorts" / "armes-contre-le-mal.json"
        if not source.exists():
            pytest.skip("data/sorts absent")

        doc = json.loads(source.read_text(encoding="utf-8"))
        doc["description"] = doc["description"] + " SENTINELLE-HUMAINE"
        doc["autres"]["note_humaine"] = "corrigé à la main"
        avant = dict(doc)

        cible = tmp_path / "armes-contre-le-mal.json"
        enrich_spells.ecrire_document(cible, doc)
        relu = json.loads(cible.read_text(encoding="utf-8"))

        assert "SENTINELLE-HUMAINE" in relu["description"]
        assert relu["autres"]["note_humaine"] == "corrigé à la main"
        for cle in relu:
            if cle != "classes":
                assert relu[cle] == avant[cle], cle

    def test_written_files_keep_the_canonical_format(self, tmp_path: Path):
        cible = tmp_path / "sort-test.json"
        enrich_spells.ecrire_document(cible, DOC_MINIMAL)
        octets = cible.read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")  # no BOM
        assert b"\r\n" not in octets  # LF only
        assert octets.endswith(b"\n")
        texte = octets.decode("utf-8")
        assert '\n  "nom": "Sort test",' in texte  # indent=2
        assert "\\u" not in texte  # ensure_ascii=False


class TestCorpus:
    @pytest.fixture(scope="class")
    def sorts_dir(self, repo_root: Path) -> Path:
        chemin = repo_root / "data" / "sorts"
        if not chemin.is_dir():
            pytest.skip("data/sorts absent — l'étape 07 n'a pas encore tourné")
        return chemin

    @pytest.fixture(scope="class")
    def corpus(self, sorts_dir: Path) -> list[dict]:
        return [
            json.loads(f.read_text(encoding="utf-8"))
            for f in sorted(sorts_dir.glob("*.json"))
        ]

    @pytest.fixture(scope="class")
    def index(self, repo_root: Path) -> dict[str, dict]:
        chemin = repo_root / "data" / "index" / "sorts_uniques.jsonl"
        if not chemin.exists():
            pytest.skip("data/index absent")
        return enrich_spells.charger_index(chemin)

    def test_every_spell_has_at_least_one_class(self, corpus):
        vides = [d["id"] for d in corpus if not d["classes"]]
        assert vides == []

    def test_every_entry_has_the_full_contract(self, corpus):
        for doc in corpus:
            for c in doc["classes"]:
                assert tuple(c) == enrich_spells.CLES_CLASSE, doc["id"]

    def test_entries_are_sorted_by_label(self, corpus):
        for doc in corpus:
            labels = [c["classe"] for c in doc["classes"]]
            assert labels == sorted(labels), doc["id"]

    def test_no_duplicate_class_per_spell(self, corpus):
        for doc in corpus:
            slugs = [c["slug"] for c in doc["classes"]]
            assert len(set(slugs)) == len(slugs), doc["id"]

    def test_classes_match_the_index_exactly(self, corpus, index):
        for doc in corpus:
            attendu = {
                (c["classe"], c["slug"], c["niveau"])
                for c in index[doc["id"]]["classes"]
            }
            obtenu = {
                (c["classe"], c["slug"], c["niveau"]) for c in doc["classes"]
            }
            assert obtenu == attendu, doc["id"]

    def test_concordance_verdict_is_self_consistent(self, corpus):
        for doc in corpus:
            for c in doc["classes"]:
                if c["niveau_page"] is None:
                    assert c["concordance"] is None, doc["id"]
                else:
                    assert c["concordance"] == (
                        c["niveau"] == c["niveau_page"]
                    ), doc["id"]

    def test_page_level_is_re_derivable_from_niveaux(self, corpus):
        # Independent re-derivation: `niveau_page` must be exactly the minimum of
        # the class's abbreviations as they appear in the document's own `niveaux`.
        for doc in corpus:
            for c in doc["classes"]:
                abbrevs = enrich_spells.abbrevs_de_classe(c["classe"], c["slug"])
                trouves = [doc["niveaux"][a] for a in abbrevs if a in doc["niveaux"]]
                attendu = min(trouves) if trouves else None
                assert c["niveau_page"] == attendu, (doc["id"], c["classe"])

    def test_concordance_rate_is_at_least_90_percent(self, corpus):
        comparables = [
            c
            for doc in corpus
            for c in doc["classes"]
            if c["concordance"] is not None
        ]
        assert comparables
        accord = sum(1 for c in comparables if c["concordance"])
        assert accord / len(comparables) >= 0.90

    def test_all_files_still_validate(self, corpus, repo_root: Path):
        schema = json.loads(
            (repo_root / "schemas" / "sort.schema.json").read_text(encoding="utf-8")
        )
        validateur = Draft202012Validator(schema)
        for doc in corpus:
            erreurs = list(validateur.iter_errors(doc))
            assert not erreurs, f"{doc['id']}: {[e.message for e in erreurs]}"

    def test_no_orphans_either_way(self, corpus, index):
        assert {d["id"] for d in corpus} == set(index)

    def test_no_unknown_abbrev_remains(self, corpus):
        from pf_spells.classes import CLASS_ABBREV_HORS_LISTE, lookup_abbrev

        inconnues = {
            a
            for doc in corpus
            for a in doc["niveaux"]
            if lookup_abbrev(a) is None and a not in CLASS_ABBREV_HORS_LISTE
        }
        assert inconnues == set()


class TestIdempotence:
    def test_a_second_pass_computes_the_same_value(self, repo_root: Path):
        chemin = repo_root / "data" / "sorts"
        if not chemin.is_dir():
            pytest.skip("data/sorts absent")
        index = enrich_spells.charger_index(
            repo_root / "data" / "index" / "sorts_uniques.jsonl"
        )
        for fichier in sorted(chemin.glob("*.json")):
            doc = json.loads(fichier.read_text(encoding="utf-8"))
            classes, _, _ = enrich_spells.enrichir_document(doc, index[doc["id"]])
            assert doc["classes"] == classes, doc["id"]
