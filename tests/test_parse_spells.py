"""Unit tests for the spell-page parser, pinned to the four sample pages.

The four files in `pages/sorts/` are the hand-verified reference: they cover a
plain spell, the U+2019 apostrophe variant, a nested "fonctionnent comme"
variant and a `Mythique` sub-block. Everything asserted here was read off the
HTML by hand, so a parser regression fails loudly rather than silently changing
the corpus.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from jsonschema import Draft202012Validator

from pf_spells import parse_spells
from pf_spells.htmlutil import load_html

ECHANTILLONS = {
    "armes-contre-le-mal": ("exemple_1", "Armes contre le mal"),
    "coeur-incassable": ("exemple_2", "Cœur incassable"),
    "requiem-pour-les-fantomes": ("exemple_3", "Requiem pour les fantômes"),
    "bouclier-de-la-fleur-de-l-aube": ("exemple_4", "Bouclier de la Fleur de l'Aube"),
}


@pytest.fixture(scope="session")
def schema(repo_root: Path) -> dict:
    return json.loads(
        (repo_root / "data" / "schemas" / "sort.schema.json").read_text(encoding="utf-8")
    )


@pytest.fixture(scope="session")
def docs(repo_root: Path) -> dict[str, dict]:
    resultat = {}
    for sid, (fichier, nom) in ECHANTILLONS.items():
        chemin = repo_root / "pages" / "sorts" / f"{fichier}.html"
        doc, _ = parse_spells.parse_page(
            load_html(chemin),
            {
                "id": sid,
                "nom": nom,
                "url": f"https://www.pathfinder-fr.org/Wiki/{fichier}.ashx",
                "cache_fichier": str(chemin),
                "recupere_le": "2026-07-28T00:00:00+00:00",
            },
        )
        resultat[sid] = doc
    return resultat


def noeuds(fragment: str) -> list:
    return list(BeautifulSoup(f"<div>{fragment}</div>", "lxml").div.children)


class TestHelpers:
    def test_heading_text_strips_pilcrow(self):
        node = BeautifulSoup(
            '<h1 class="separator">Alarme sélective'
            '<a class="headeranchor" href="#x">¶</a></h1>',
            "lxml",
        ).find("h1")
        assert parse_spells.heading_text(node) == "Alarme sélective"

    @pytest.mark.parametrize(
        "valeur,attendu",
        [
            ("Transmutation", ("Transmutation", [])),
            (
                "Évocation [Bien, feu, lumière]",
                ("Évocation", ["Bien", "feu", "lumière"]),
            ),
            (
                "Enchantement (coercition) [effet mental]",
                ("Enchantement (coercition)", ["effet mental"]),
            ),
            (None, (None, [])),
        ],
    )
    def test_separer_ecole(self, valeur, attendu):
        assert parse_spells.separer_ecole(valeur) == attendu

    def test_parse_niveaux_preserves_accented_abbrevs(self):
        niveaux, rejets = parse_spells.parse_niveaux(
            "Bard 2, Cham 2, Inq 2, Occ 2, Pal 1, Prê 2"
        )
        assert niveaux == {
            "Bard": 2,
            "Cham": 2,
            "Inq": 2,
            "Occ": 2,
            "Pal": 1,
            "Prê": 2,
        }
        assert rejets == []

    def test_parse_niveaux_keeps_slash_abbrevs_verbatim(self):
        niveaux, _ = parse_spells.parse_niveaux("Ens/Mag 3, Psy 3")
        assert niveaux == {"Ens/Mag": 3, "Psy": 3}

    def test_parse_niveaux_tolerates_parenthetical(self):
        niveaux, rejets = parse_spells.parse_niveaux("Rôd 1 (Déesse du soleil)")
        assert niveaux == {"Rôd": 1}
        assert rejets == []

    def test_parse_niveaux_splits_a_missing_comma(self):
        # `Toucher de combustion` reads `magus 1 Ens/Mag 1`: the wiki author
        # dropped a comma. Both classes must be recovered, not merged into one
        # bogus abbreviation.
        niveaux, rejets = parse_spells.parse_niveaux(
            "Dru 1, Inq 1, magus 1 Ens/Mag 1, Sor 1, Psy 1"
        )
        assert niveaux == {
            "Dru": 1,
            "Inq": 1,
            "magus": 1,
            "Ens/Mag": 1,
            "Sor": 1,
            "Psy": 1,
        }
        assert rejets == []

    def test_parse_niveaux_reports_unparsable(self):
        niveaux, rejets = parse_spells.parse_niveaux("Bard 1, n'importe quoi")
        assert niveaux == {"Bard": 1}
        assert rejets == ["n'importe quoi"]

    def test_normalized_labels_are_all_in_the_map(self):
        # The map's keys must already be in normalized form, else lookups miss.
        from pf_spells.htmlutil import normalize_label

        for label in parse_spells.LABEL_MAP:
            assert normalize_label(label) == label


class TestStatbloc:
    def test_two_labels_on_one_line(self):
        champs, autres, reste = parse_spells.parse_statbloc(
            noeuds(
                "<b>Jet de sauvegarde</b> Vigueur, annule ; "
                "<b>Résistance à la magie</b> oui<br/>"
            )
        )
        assert champs["jet_de_sauvegarde"] == "Vigueur, annule"
        assert champs["resistance_magie"] == "oui"
        assert autres == {}

    def test_u2019_apostrophe_label(self):
        champs, _, _ = parse_spells.parse_statbloc(
            noeuds("<b>Temps d’incantation</b> 1 action simple<br/>x")
        )
        assert champs["temps_incantation"] == "1 action simple"

    def test_unknown_label_between_known_ones_goes_to_autres(self):
        champs, autres, _ = parse_spells.parse_statbloc(
            noeuds(
                "<b>Fréquence</b> 1/jour<br/><b>Durée</b> 1 round<br/>texte"
            )
        )
        assert champs["duree"] == "1 round"
        assert autres == {"Fréquence": "1/jour"}

    def test_unknown_label_after_the_last_known_one_is_prose(self):
        # A `<b>` past the final stat label is description emphasis, not a label:
        # real pages bold things like "Attaque." mid-prose.
        champs, autres, reste = parse_spells.parse_statbloc(
            noeuds("<b>Durée</b> 1 round<br/><b>Amplifié.</b> Du texte.")
        )
        assert champs == {"duree": "1 round"}
        assert autres == {}
        assert "Amplifié" in parse_spells.texte(reste)

    def test_bold_after_last_label_is_prose_not_a_label(self):
        champs, autres, reste = parse_spells.parse_statbloc(
            noeuds("<b>Durée</b> 1 round<br/>Prose avec <b>Attaque.</b> suite.")
        )
        assert champs == {"duree": "1 round"}
        assert autres == {}
        assert "Attaque" in parse_spells.texte(reste)

    def test_effet_and_zone_map_onto_cible(self):
        champs, _, _ = parse_spells.parse_statbloc(
            noeuds("<b>Zone d'effet</b> émanation de 6 m<br/>x")
        )
        assert champs["cible"] == "émanation de 6 m"

    def test_value_wrapped_across_a_newline_stays_whole(self):
        champs, _, _ = parse_spells.parse_statbloc(
            noeuds("<b>Résistance à la magie</b> oui \n(inoffensif)<br/>Prose.")
        )
        assert champs["resistance_magie"] == "oui (inoffensif)"

    def test_prose_after_a_bare_newline_is_not_part_of_the_value(self):
        prose = "Ce sort s’apparente à un autre sort. " * 8
        champs, _, reste = parse_spells.parse_statbloc(
            noeuds(f"<b>Résistance à la magie</b> non (voir texte)\n{prose}")
        )
        assert champs["resistance_magie"] == "non (voir texte)"
        assert parse_spells.texte(reste).startswith("Ce sort s’apparente")


class TestEchantillons:
    def test_all_samples_validate(self, docs, schema):
        validateur = Draft202012Validator(schema)
        for sid, doc in docs.items():
            erreurs = list(validateur.iter_errors(doc))
            assert not erreurs, f"{sid}: {[e.message for e in erreurs]}"

    def test_every_key_present_in_canonical_order(self, docs):
        for doc in docs.values():
            assert tuple(doc) == parse_spells.KEY_ORDER

    def test_classes_is_always_empty(self, docs):
        # Step 08 owns this field.
        for doc in docs.values():
            assert doc["classes"] == []

    def test_armes_contre_le_mal(self, docs):
        doc = docs["armes-contre-le-mal"]
        assert doc["nom"] == "Armes contre le mal"
        assert doc["ecole"] == "Transmutation"
        assert doc["descripteurs"] == []
        assert doc["niveaux"] == {"Inq": 1, "Pal": 1, "Prê": 1}
        assert doc["temps_incantation"] == "1 action simple"
        assert doc["composantes"] == "V, FD"
        assert doc["portee"] == (
            "courte (7,50 m + 1,50 m/2 niveaux) (5 c + 1 c/2 niveaux)"
        )
        assert doc["cible"] == (
            "une arme/niveau, éloignées les unes des autres au maximum de 6 m"
        )
        assert doc["duree"] == "1 round/niveau"
        assert doc["jet_de_sauvegarde"] == "Vigueur, annule (inoffensif, objet)"
        assert doc["resistance_magie"] == "oui (inoffensif, objet)"
        assert doc["mythique"] is None
        assert doc["variantes"] == []
        assert len(doc["sources"]) == 2
        assert doc["sources"][0] == "Inner Sea Gods/Dieux de la mer Intérieure"
        assert doc["description"].startswith("Les armes affectées par ce sort brillent")
        assert "Iomédae" in doc["autres"]["restriction_divinite"]
        # The deity sidebar is captured, not left in the prose.
        assert "Option plus" not in doc["description"]

    def test_coeur_incassable_handles_u2019(self, docs):
        doc = docs["coeur-incassable"]
        assert doc["temps_incantation"] == "1 action simple"
        assert doc["niveaux"]["Bard"] == 1
        assert doc["descripteurs"] == ["effet mental"]
        assert "œ" in doc["nom"]

    def test_requiem_nests_its_variant(self, docs):
        doc = docs["requiem-pour-les-fantomes"]
        assert doc["niveaux"] == {
            "Bard": 2,
            "Cham": 2,
            "Inq": 2,
            "Occ": 2,
            "Pal": 1,
            "Prê": 2,
        }
        assert len(doc["variantes"]) == 1
        variante = doc["variantes"][0]
        assert variante["nom"] == "Requiem pour les fantômes de groupe"
        assert variante["id"] == "requiem-pour-les-fantomes-de-groupe"
        assert variante["niveaux"] == {
            "Bard": 4,
            "Cham": 5,
            "Inq": 5,
            "Occ": 5,
            "Pal": 3,
            "Prê": 5,
        }
        assert variante["ecole"] == "Transmutation"
        assert variante["description"].startswith("Ce sort fonctionne comme")
        assert tuple(variante) == parse_spells.VARIANTE_KEY_ORDER
        # The variant's stat block must not leak into the parent's description.
        assert "Bard 4" not in doc["description"]
        assert "de groupe" not in doc["description"]

    def test_bouclier_isolates_the_mythic_block(self, docs):
        doc = docs["bouclier-de-la-fleur-de-l-aube"]
        assert doc["descripteurs"] == ["Bien", "feu", "lumière"]
        assert doc["mythique"] is not None
        assert doc["mythique"]["description"].startswith("Le disque de lumière")
        assert doc["mythique"]["description_html"]
        # The isolation guarantee: the word never appears in the description.
        assert "Mythique" not in doc["description"]
        assert "targe" not in doc["description"]
        assert doc["description"].startswith("Le personnage crée un disque")


class TestCorpus:
    """Checks over the committed corpus, so a stale corpus fails the suite."""

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

    def test_one_file_per_ok_manifest_line(self, repo_root: Path, sorts_dir: Path):
        manifeste = [
            json.loads(ligne)
            for ligne in (repo_root / "data" / "spell_pages.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
            if ligne.strip()
        ]
        attendus = {e["id"] for e in manifeste if e["statut"] == "ok"}
        presents = {f.stem for f in sorts_dir.glob("*.json")}
        assert presents == attendus

    def test_all_files_validate(self, corpus, schema):
        validateur = Draft202012Validator(schema)
        for doc in corpus:
            erreurs = list(validateur.iter_errors(doc))
            assert not erreurs, f"{doc['id']}: {[e.message for e in erreurs]}"

    def test_all_files_carry_the_full_key_set(self, corpus):
        for doc in corpus:
            assert tuple(doc) == parse_spells.KEY_ORDER

    def test_filenames_match_ids(self, sorts_dir: Path):
        for fichier in sorts_dir.glob("*.json"):
            doc = json.loads(fichier.read_text(encoding="utf-8"))
            assert doc["id"] == fichier.stem

    def test_no_replacement_character_anywhere(self, sorts_dir: Path):
        for fichier in sorts_dir.glob("*.json"):
            assert "�" not in fichier.read_text(encoding="utf-8"), fichier.name

    def test_coverage_thresholds(self, corpus):
        total = len(corpus)
        avec_ecole = sum(1 for d in corpus if d["ecole"])
        avec_niveaux = sum(1 for d in corpus if d["niveaux"])
        avec_description = sum(1 for d in corpus if len(d["description"]) >= 40)
        assert avec_ecole / total >= 0.98
        assert avec_niveaux / total >= 0.98
        assert avec_description / total >= 0.99

    def test_variants_get_no_file_of_their_own(self, corpus):
        # The user's nesting decision: a variant exists only nested. A variant id
        # may coincide with a spell that has its own wiki page — that page is a
        # manifest entry in its own right, which is fine — but no file may exist
        # solely because some other page nested a variant of that name.
        par_id = {d["id"]: d for d in corpus}
        for doc in corpus:
            for variante in doc["variantes"]:
                autre = par_id.get(variante["id"])
                if autre is None or autre["id"] == doc["id"]:
                    # Not written by this step, or the wiki reused the parent's
                    # own name for its mass version (immobilisation-de-monstre).
                    continue
                # It has a page of its own; its file comes from that page.
                assert autre["meta"]["cache_fichier"] != doc["meta"]["cache_fichier"]

    def test_the_only_self_named_variant_is_the_known_wiki_slip(self, corpus):
        # One page nests a variant under its own display name: the level-9 mass
        # version of `immobilisation de monstre`. Pinned so a new one is noticed.
        auto = {
            doc["id"]
            for doc in corpus
            for variante in doc["variantes"]
            if variante["id"] == doc["id"]
        }
        assert auto == {"immobilisation-de-monstre"}

    def test_mythic_never_leaks_into_description(self, corpus):
        for doc in corpus:
            if doc["mythique"]:
                extrait = doc["mythique"]["description"][:60]
                if extrait:
                    assert extrait not in doc["description"], doc["id"]

    def test_classes_still_empty_or_enriched_consistently(self, corpus):
        # Step 07 writes []; step 08 fills it. Either state is internally valid,
        # but a half-filled entry is not.
        for doc in corpus:
            for entree in doc["classes"]:
                assert {"classe", "slug", "niveau"} <= set(entree)

    def test_niveaux_abbrevs_never_contain_a_level(self, corpus):
        # A digit in an abbreviation means two `abbrev level` pairs were merged
        # by a missing comma on the wiki and not split apart.
        for doc in corpus:
            for abbrev in doc["niveaux"]:
                assert not any(c.isdigit() for c in abbrev), (doc["id"], abbrev)
