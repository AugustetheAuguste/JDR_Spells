"""Tests for stage 10, the enrichment validator.

The stage exists to make confabulation *detectable*, so these tests are mostly
about the evidence check: what it must reject (a plausible rewording), what it
must accept (a difference of representation), and — the property that matters most
— that loosening it is not silently possible. `TestPreuvesRejetteLaConfabulation`
is the heart of the file.

Two harness decisions worth stating:

* Records are staged into a tmp directory under their `<id>.json` production name.
  The step-02 fixtures are named descriptively (`invalide_tag_inconnu.json`), which
  is right for schema tests but is not the on-disk contract the validator enforces.
  The fixture tree is frozen and belongs to another step; it is copied, not edited.
* `hash_source` is recomputed when staging. That field is machine-derived
  provenance, and the step-02 fixtures carry placeholder values that predate the
  freeze of `texte_source_canonique` in step 05. Restamping isolates what each test
  is about; `TestDeriveDuSource` then asserts the stale values ARE caught, so the
  restamping cannot mask a broken drift check.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

from pf_spells.enrichissement_schema import charger_schema_resolu
from pf_spells.texte_source import hash_source, texte_source_canonique
from pf_spells.validate_enrichment import (
    CODES_ERREUR,
    FICHIER_RAPPORT,
    SEUIL_AMBIGUITE,
    ValidateEnrichmentError,
    _plier,
    charger_index,
    construire_resume,
    fichiers_d_enrichissements,
    main,
    run,
    valider_un,
)

VALIDES = (
    "valide_degats_avec_preuve.json",
    "valide_sans_degats.json",
    "valide_avec_note_ambiguite.json",
)

# fixture -> the error code the validator MUST report for it. The step's criterion
# is not merely "rejected" but "rejected for the right reason": a record refused
# under the wrong code sends whoever reads the report to fix the wrong thing.
INVALIDES: tuple[tuple[str, str], ...] = (
    ("invalide_cle_en_trop.json", "schema_invalide"),
    ("invalide_resume_trop_long.json", "schema_invalide"),
    ("invalide_tag_inconnu.json", "hors_taxonomie"),
    ("invalide_type_degats_sans_preuve.json", "preuve_manquante"),
    ("invalide_preuve_absente.json", "preuve_manquante"),
)

APOSTROPHE_TYPO = chr(0x2019)


@pytest.fixture(scope="module")
def fixtures_enr(repo_root: Path) -> Path:
    return repo_root / "tests" / "fixtures" / "enrichissements"


@pytest.fixture(scope="module")
def mini_corpus(repo_root: Path) -> Path:
    return repo_root / "tests" / "fixtures" / "mini_corpus"


@pytest.fixture(scope="module")
def sorts_dir(mini_corpus: Path) -> Path:
    return mini_corpus / "data" / "sorts"


@pytest.fixture(scope="module")
def schema(repo_root: Path) -> dict[str, Any]:
    return charger_schema_resolu(repo_root)


@pytest.fixture(scope="module")
def validateur(schema: dict[str, Any]) -> Draft202012Validator:
    return Draft202012Validator(schema)


def _source(sorts_dir: Path, identifiant: str) -> str:
    sort = json.loads((sorts_dir / f"{identifiant}.json").read_text(encoding="utf-8"))
    return texte_source_canonique(sort)


def _charger(fixtures_enr: Path, nom: str) -> dict[str, Any]:
    return json.loads((fixtures_enr / nom).read_text(encoding="utf-8"))


def _ecrire(document: dict[str, Any], repertoire: Path) -> Path:
    """Write one record under its production name `<id>.json`."""
    repertoire.mkdir(parents=True, exist_ok=True)
    chemin = repertoire / f"{document['id']}.json"
    chemin.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return chemin


def _poser(
    document: dict[str, Any], repertoire: Path, sorts_dir: Path, *, restamper: bool = True
) -> Path:
    if restamper:
        document = {
            **document,
            "hash_source": hash_source(_source(sorts_dir, document["id"])),
        }
    return _ecrire(document, repertoire)


def _valider(
    document: dict[str, Any],
    tmp_path: Path,
    sorts_dir: Path,
    schema: dict[str, Any],
    validateur: Draft202012Validator,
    *,
    restamper: bool = True,
    index: set[str] | None = None,
) -> Any:
    chemin = _poser(document, tmp_path / "enr", sorts_dir, restamper=restamper)
    return valider_un(
        chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=index
    )


def _codes(verdict: Any) -> set[str]:
    return {erreur["code"] for erreur in verdict.erreurs}


class TestFixturesDeLEtape02:
    """The step's first criterion: 3 accepted, 5 rejected, each for the right reason."""

    @pytest.mark.parametrize("nom", VALIDES)
    def test_les_trois_valides_sont_acceptes(
        self,
        nom: str,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        verdict = _valider(
            _charger(fixtures_enr, nom), tmp_path, sorts_dir, schema, validateur
        )
        assert verdict.ok, verdict.erreurs
        assert verdict.erreurs == []

    @pytest.mark.parametrize(("nom", "code"), INVALIDES)
    def test_les_cinq_invalides_sont_rejetes_avec_le_bon_code(
        self,
        nom: str,
        code: str,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        verdict = _valider(
            _charger(fixtures_enr, nom), tmp_path, sorts_dir, schema, validateur
        )
        assert not verdict.ok
        assert code in _codes(verdict), _codes(verdict)

    def test_les_huit_fixtures_sont_couvertes(self, fixtures_enr: Path) -> None:
        # Guards against a fixture being added by another step and silently
        # escaping this file's coverage.
        sur_disque = {c.name for c in fixtures_enr.glob("*.json")}
        assert sur_disque == set(VALIDES) | {nom for nom, _ in INVALIDES}

    def test_chaque_valide_couvre_une_situation_de_la_politique_des_nulls(
        self, fixtures_enr: Path
    ) -> None:
        docs = [_charger(fixtures_enr, nom) for nom in VALIDES]
        assert any(d["type_degats"] is not None for d in docs)
        assert any(d["type_degats"] is None for d in docs)
        assert any(d["notes_ambiguite"] for d in docs)


class TestPreuvesRejetteLaConfabulation:
    """The anti-confabulation contract, stated as the properties it must have."""

    def test_une_reformulation_plausible_mais_absente_est_rejetee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """The step's dedicated criterion.

        The record stays schema-valid and taxonomy-valid, and the *conclusion*
        `type_degats: "positif"` is even correct for this spell. Only the quote is
        invented — fluent, plausible, and not in the text. That is exactly the
        failure mode no schema can catch, so it is the one test this stage cannot
        be allowed to pass without.
        """
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        source = _source(sorts_dir, doc["id"])
        doc["preuves"]["type_degats"] = "un trait d'énergie positive canalisée"
        assert doc["preuves"]["type_degats"] not in source
        assert validateur.is_valid(doc), "le leurre doit rester valide au schéma"

        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert not verdict.ok
        assert "preuve_absente_du_source" in _codes(verdict)
        assert "schema_invalide" not in _codes(verdict)

    def test_la_preuve_rapportee_est_citee_dans_le_verdict(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # The report must name the offending string; "an evidence failed" is not
        # actionable for tuning the prompt.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = "totalement inventé"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        fautes = [e for e in verdict.erreurs if e["code"] == "preuve_absente_du_source"]
        assert fautes[0]["preuve"] == "totalement inventé"
        assert fautes[0]["champ"] == "preuves.type_degats"

    def test_une_preuve_de_condition_inventee_est_rejetee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        doc["preuves"]["condition_infligee"] = ["la victime tremble de terreur"]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)

    def test_une_preuve_de_cible_inventee_est_rejetee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_sans_degats.json")
        doc["preuves"]["cible_typique"] = "le magicien lui-même, exclusivement"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)

    def test_une_preuve_tronquee_au_mot_pres_reste_acceptee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # A shorter *real* substring is still a real substring. The rule is
        # "occurs in the source", not "matches a blessed span".
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = doc["preuves"]["type_degats"][:12]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert verdict.ok, verdict.erreurs

    def test_la_casse_n_est_pas_repliee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = doc["preuves"]["type_degats"].upper()
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)

    def test_les_accents_ne_sont_pas_replies(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """Stripping an accent is a rejection, not a tolerance.

        This is the boundary of the apostrophe fold below: one is a difference of
        representation, the other is a different string. Observed in the real
        corpus as `'est etourdi'` for `est étourdi` — a genuine miscopy that must
        stay rejected.
        """
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        preuve = doc["preuves"]["type_degats"]
        sans_accent = "".join(
            c
            for c in unicodedata.normalize("NFKD", preuve)
            if not unicodedata.combining(c)
        )
        assert sans_accent != preuve, "la preuve témoin doit porter un accent"
        doc["preuves"]["type_degats"] = sans_accent
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)

    def test_les_espaces_ne_sont_pas_normalises(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = doc["preuves"]["type_degats"].replace(" ", "  ")
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)

    def test_une_preuve_fournie_pour_un_type_degats_nul_est_rejetee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # Quoting the source to justify "the source is silent" is incoherent, and
        # it pollutes the null-policy counts the taxonomy cut relies on.
        doc = _charger(fixtures_enr, "valide_sans_degats.json")
        doc["preuves"]["type_degats"] = "malus de Force"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_pour_valeur_nulle" in _codes(verdict)

    def test_des_conditions_sans_aucune_preuve_sont_rejetees(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        assert doc["condition_infligee"], "le témoin doit porter une condition"
        doc["preuves"]["condition_infligee"] = []
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_manquante" in _codes(verdict)

    def test_des_preuves_sans_condition_declaree_sont_rejetees(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        doc["condition_infligee"] = []
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_pour_valeur_nulle" in _codes(verdict)

    def test_une_seule_phrase_peut_fonder_deux_conditions(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """No positional 1:1 pairing is imposed — the source does not read that way.

        `cecite-surdite` in the real corpus grounds both `aveugle` and `assourdi`
        on the single sentence "La victime du sort devient sourde ou aveugle". A
        strict pairing rejected it, and its evidence is correct.
        """
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        source = _source(sorts_dir, doc["id"])
        preuve = doc["preuves"]["condition_infligee"][0]
        assert preuve in source
        doc["condition_infligee"] = ["secoue", "effraye"]
        doc["preuves"]["condition_infligee"] = [preuve]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert verdict.ok, verdict.erreurs


class TestApostropheTypographique:
    """The single documented tolerance, and the proof it cannot launder a rewording."""

    def test_le_pli_ne_touche_que_l_apostrophe_et_la_forme_nfc(self) -> None:
        assert _plier(f"d{APOSTROPHE_TYPO}énergie") == "d'énergie"
        # NFC composes; nothing else moves.
        assert _plier("e" + chr(0x301)) == "é"
        assert _plier("Dégâts DE Feu  ") == "Dégâts DE Feu  "

    def test_nfc_seule_ne_replierait_pas_l_apostrophe(self) -> None:
        """Why the fold is needed on top of NFC, asserted rather than asserted-in-prose.

        U+2019 and U+0027 are distinct characters, not two encodings of one, so no
        Unicode normal form maps between them. Measured on the real corpus: 276 of
        292 failing evidence strings differ by nothing else, and NFC rescues zero.
        """
        typo = f"d{APOSTROPHE_TYPO}énergie"
        for forme in ("NFC", "NFD", "NFKC", "NFKD"):
            assert unicodedata.normalize(forme, typo) != unicodedata.normalize(
                forme, "d'énergie"
            )

    def test_une_preuve_en_apostrophe_ascii_est_acceptee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        source = _source(sorts_dir, doc["id"])
        assert APOSTROPHE_TYPO in doc["preuves"]["type_degats"]
        doc["preuves"]["type_degats"] = doc["preuves"]["type_degats"].replace(
            APOSTROPHE_TYPO, "'"
        )
        # Literally absent from the source: only the fold makes it pass.
        assert doc["preuves"]["type_degats"] not in source
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert verdict.ok, verdict.erreurs

    def test_le_pli_reste_directionnellement_neutre(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # Applied to both sides, so a TYPOGRAPHIC quote passes against a span the
        # source writes with the ASCII form. Neither side is privileged — this is
        # the mirror of the test above, which went the other way.
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        source = _source(sorts_dir, doc["id"])
        # A span this source writes ONLY in the ASCII form, so the typographic
        # variant below is genuinely absent from it.
        assert "d'air" in source
        doc["preuves"]["cible_typique"] = f"d{APOSTROPHE_TYPO}air"
        assert doc["preuves"]["cible_typique"] not in source, "absent au sens littéral"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert verdict.ok, verdict.erreurs

    def test_le_pli_ne_sauve_pas_une_paraphrase(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # The tolerance must not become a crack. Same apostrophe, different words.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"]["type_degats"] = "un flux d'énergie bénéfique"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "preuve_absente_du_source" in _codes(verdict)


class TestTaxonomie:
    def test_un_tag_hors_liste_close_est_rejete(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["tags"] = ["degats_directs", "sort_de_mort_qui_tue"]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        fautes = [e for e in verdict.erreurs if e["code"] == "hors_taxonomie"]
        assert fautes and fautes[0]["champ"] == "tags"
        assert fautes[0]["valeur"] == "sort_de_mort_qui_tue"

    @pytest.mark.parametrize(
        ("champ", "valeur"),
        [
            ("categorie_principale", "categorie_inventee"),
            ("cible_typique", "cible_inventee"),
            ("type_degats", "degats_inventes"),
        ],
    )
    def test_chaque_scalaire_enumere_est_controle(
        self,
        champ: str,
        valeur: str,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc[champ] = valeur
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        fautes = [
            e
            for e in verdict.erreurs
            if e["code"] == "hors_taxonomie" and e["champ"] == champ
        ]
        assert fautes, _codes(verdict)

    @pytest.mark.parametrize("champ", ["roles_tactiques", "condition_infligee"])
    def test_chaque_liste_enumeree_est_controlee(
        self,
        champ: str,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc[champ] = ["valeur_inventee"]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        fautes = [
            e
            for e in verdict.erreurs
            if e["code"] == "hors_taxonomie" and e["champ"] == champ
        ]
        assert fautes, _codes(verdict)

    def test_type_degats_nul_n_est_pas_traite_comme_hors_taxonomie(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # `null` means "absent from the source"; it is not a vocabulary member.
        doc = _charger(fixtures_enr, "valide_sans_degats.json")
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "hors_taxonomie" not in _codes(verdict)

    def test_aucune_liste_close_n_est_recopiee_dans_le_module(
        self, repo_root: Path
    ) -> None:
        """Anti-pattern #9: a duplicated closed list will drift.

        The enums are read back out of the resolved schema, so widening a
        vocabulary needs no edit here. If a real vocabulary key appears literally
        in this module, someone hard-coded a list.
        """
        source = (
            repo_root / "src" / "pf_spells" / "validate_enrichment.py"
        ).read_text(encoding="utf-8")
        tags = json.loads(
            (repo_root / "conventions" / "vocabulaires" / "tags.json").read_text(
                encoding="utf-8"
            )
        )
        presents = [e["cle"] for e in tags["valeurs"] if e["cle"] in source]
        assert presents == [], presents

    def test_la_liste_close_elargie_est_lue_depuis_les_conventions(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        repo_root: Path,
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """A v2 addition validates without touching this module — the v1/v2 promise.

        `conditions.json` went to v2 with `nauseeux`; a record using it must pass,
        which it can only do if the enum really comes from the conventions tree.
        """
        schema = charger_schema_resolu(repo_root)
        assert "nauseeux" in schema["$defs"]["vocabulaire_conditions"]["enum"]
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        doc["condition_infligee"] = ["nauseeux"]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "hors_taxonomie" not in _codes(verdict), verdict.erreurs


class TestDeriveDuSource:
    """Drift is reported, never repaired."""

    def test_un_hash_perime_est_signale(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["hash_source"] = "0" * 64
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur, restamper=False)
        assert not verdict.ok
        assert verdict.derive_source is True
        assert "derive_source" in _codes(verdict)

    def test_les_hashes_des_fixtures_de_l_etape_02_sont_bien_perimes(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """The restamping in `_poser` cannot be masking a broken drift check.

        The step-02 fixtures carry placeholder hashes that predate the freeze of
        `texte_source_canonique`. Staged verbatim, every one of them MUST be caught
        as drift — which is what proves the check has teeth.
        """
        for nom in VALIDES:
            verdict = _valider(
                _charger(fixtures_enr, nom),
                tmp_path / nom,
                sorts_dir,
                schema,
                validateur,
                restamper=False,
            )
            assert verdict.derive_source is True, nom

    def test_modifier_le_sort_source_produit_la_derive(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """The step's criterion, run the way it is written: change the source, re-run.

        The mini_corpus is frozen, so the spell is copied into a tmp tree and the
        copy is edited — the fixture itself is never written to.
        """
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        faux_sorts = tmp_path / "sorts"
        faux_sorts.mkdir()
        original = json.loads(
            (sorts_dir / f"{doc['id']}.json").read_text(encoding="utf-8")
        )
        (faux_sorts / f"{doc['id']}.json").write_text(
            json.dumps(original, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        # Stamp against the pristine text: the record is correct before the edit.
        doc["hash_source"] = hash_source(texte_source_canonique(original))
        chemin = _ecrire(doc, tmp_path / "enr")
        avant = valider_un(
            chemin, sorts=faux_sorts, schema=schema, validateur=validateur, index=None
        )
        assert avant.ok, avant.erreurs

        modifie = {**original, "duree": "concentration, 10 minutes/niveau"}
        (faux_sorts / f"{doc['id']}.json").write_text(
            json.dumps(modifie, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        apres = valider_un(
            chemin, sorts=faux_sorts, schema=schema, validateur=validateur, index=None
        )
        assert apres.derive_source is True
        assert "derive_source" in _codes(apres)

    def test_la_derive_n_est_jamais_reparee(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["hash_source"] = "1" * 64
        chemin = _poser(doc, tmp_path / "enr", sorts_dir, restamper=False)
        avant = chemin.read_bytes()
        valider_un(
            chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=None
        )
        assert chemin.read_bytes() == avant


class TestIntegriteDeLaJointure:
    def test_un_sort_source_absent_est_une_erreur(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # Staged without restamping: computing a hash would itself need the source
        # that this test is about removing.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        chemin = _ecrire(doc, tmp_path / "enr")
        verdict = valider_un(
            chemin,
            sorts=tmp_path / "vide",
            schema=schema,
            validateur=validateur,
            index=None,
        )
        assert "sort_absent" in _codes(verdict)

    def test_un_id_qui_ne_suit_pas_le_nom_de_fichier_est_une_erreur(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # The join is on `id` alone; a filename that disagrees breaks it silently.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["hash_source"] = hash_source(_source(sorts_dir, doc["id"]))
        repertoire = tmp_path / "enr"
        repertoire.mkdir(parents=True)
        chemin = repertoire / "un-autre-id.json"
        chemin.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        verdict = valider_un(
            chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=None
        )
        assert "id_ne_correspond_pas_au_fichier" in _codes(verdict)

    def test_un_orphelin_hors_index_est_une_erreur(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # The Skill: an id absent from the index is an error, not a warning.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        verdict = _valider(
            doc, tmp_path, sorts_dir, schema, validateur, index={"un-autre-sort"}
        )
        assert "id_hors_index" in _codes(verdict)

    def test_un_id_present_dans_l_index_ne_declenche_rien(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        verdict = _valider(
            doc, tmp_path, sorts_dir, schema, validateur, index={doc["id"]}
        )
        assert verdict.ok, verdict.erreurs

    def test_l_index_du_mini_corpus_se_charge(self, mini_corpus: Path) -> None:
        ids = charger_index(mini_corpus)
        assert ids is not None and len(ids) == 12
        assert "destruction-de-mort-vivant" in ids

    def test_un_index_absent_donne_none(self, tmp_path: Path) -> None:
        assert charger_index(tmp_path) is None


class TestRobustesse:
    """One bad file must not abort a 2 000-record run."""

    def test_un_json_illisible_est_un_verdict_pas_une_exception(
        self,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        chemin = tmp_path / "casse.json"
        chemin.write_text("{ceci n est pas du JSON", encoding="utf-8")
        verdict = valider_un(
            chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=None
        )
        assert not verdict.ok
        assert "json_illisible" in _codes(verdict)

    def test_un_u_fffd_est_une_corruption_signalee(
        self,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        chemin = tmp_path / "corrompu.json"
        chemin.write_text(
            json.dumps({"id": "x", "resume_court": chr(0xFFFD)}, ensure_ascii=False),
            encoding="utf-8",
        )
        verdict = valider_un(
            chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=None
        )
        assert "encodage_corrompu" in _codes(verdict)

    def test_un_document_qui_n_est_pas_un_objet_est_rejete(
        self,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        chemin = tmp_path / "liste.json"
        chemin.write_text("[]", encoding="utf-8")
        verdict = valider_un(
            chemin, sorts=sorts_dir, schema=schema, validateur=validateur, index=None
        )
        assert "json_illisible" in _codes(verdict)

    def test_des_preuves_malformees_ne_font_pas_planter(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["preuves"] = "pas un objet"
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert "schema_invalide" in _codes(verdict)

    def test_un_repertoire_d_enrichissements_absent_est_un_abandon_explicite(
        self, tmp_path: Path
    ) -> None:
        with pytest.raises(ValidateEnrichmentError, match="absent"):
            fichiers_d_enrichissements(tmp_path / "nulle-part")

    def test_tous_les_codes_emis_sont_declares(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # `par_type_erreur` is read by a human tuning the prompt; a code absent from
        # CODES_ERREUR would mean an unannounced bucket.
        emis: set[str] = set()
        for nom in [n for n, _ in INVALIDES] + list(VALIDES):
            verdict = _valider(
                _charger(fixtures_enr, nom),
                tmp_path / nom,
                sorts_dir,
                schema,
                validateur,
                restamper=False,
            )
            emis |= _codes(verdict)
        assert emis <= set(CODES_ERREUR), emis - set(CODES_ERREUR)


CLES_RAPPORT: frozenset[str] = frozenset(
    {
        "total",
        "ok",
        "echecs",
        "par_type_erreur",
        "echecs_par_type",
        "notes_ambiguite",
        "taux_notes_ambiguite",
        "seuil_ambiguite",
        "taxonomie_incomplete",
        "derive_source",
        "echoues",
        "version_taxonomie",
        "skill",
        "validate_enrichment_version",
        "termine_le",
    }
)


class TestRapport:
    """The report shape is a contract: step 09 wires it into the CLI."""

    def test_les_cles_du_rapport_sont_stables(self) -> None:
        resume = construire_resume([], taxonomie="taxonomie_v2")
        assert set(resume) == CLES_RAPPORT

    def test_un_corpus_vide_ne_divise_pas_par_zero(self) -> None:
        resume = construire_resume([], taxonomie="taxonomie_v2")
        assert resume["total"] == 0
        assert resume["taux_notes_ambiguite"] == 0.0
        assert resume["taxonomie_incomplete"] is False

    def test_les_deux_comptages_d_erreurs_sont_distincts(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        """Occurrences vs records touched: reading one as the other misjudges spread."""
        doc = _charger(fixtures_enr, "valide_avec_note_ambiguite.json")
        doc["preuves"]["condition_infligee"] = ["inventé un", "inventé deux"]
        doc["condition_infligee"] = ["secoue", "aveugle"]
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        resume = construire_resume([verdict], taxonomie="taxonomie_v2")
        assert resume["par_type_erreur"]["preuve_absente_du_source"] == 2
        assert resume["echecs_par_type"]["preuve_absente_du_source"] == 1

    def test_le_drapeau_des_cinq_pour_cent_se_leve_au_dela_du_seuil(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        ambigu = _valider(
            _charger(fixtures_enr, "valide_avec_note_ambiguite.json"),
            tmp_path / "a",
            sorts_dir,
            schema,
            validateur,
        )
        net = _valider(
            _charger(fixtures_enr, "valide_sans_degats.json"),
            tmp_path / "b",
            sorts_dir,
            schema,
            validateur,
        )
        assert ambigu.notes_ambiguite is True
        assert net.notes_ambiguite is False

        # 1 ambiguous in 2 = 50 % > 5 %.
        haut = construire_resume([ambigu, net], taxonomie="taxonomie_v2")
        assert haut["taxonomie_incomplete"] is True
        assert haut["taux_notes_ambiguite"] == 0.5

        # 1 in 40 = 2.5 % <= 5 %.
        bas = construire_resume([ambigu] + [net] * 39, taxonomie="taxonomie_v2")
        assert bas["taxonomie_incomplete"] is False
        assert bas["seuil_ambiguite"] == SEUIL_AMBIGUITE

    def test_le_seuil_est_exclusif_a_exactement_cinq_pour_cent(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # The Skill: "<= 5 % sufficient", "> 5 % insufficient". Exactly 5 % passes.
        ambigu = _valider(
            _charger(fixtures_enr, "valide_avec_note_ambiguite.json"),
            tmp_path / "a",
            sorts_dir,
            schema,
            validateur,
        )
        net = _valider(
            _charger(fixtures_enr, "valide_sans_degats.json"),
            tmp_path / "b",
            sorts_dir,
            schema,
            validateur,
        )
        pile = construire_resume([ambigu] + [net] * 19, taxonomie="taxonomie_v2")
        assert pile["taux_notes_ambiguite"] == 0.05
        assert pile["taxonomie_incomplete"] is False

    def test_une_note_vide_ne_compte_pas_comme_ambiguite(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # A blank string is not a documented hesitation; counting it would inflate
        # the measure that decides whether to re-cut the taxonomy.
        doc = _charger(fixtures_enr, "valide_sans_degats.json")
        doc["notes_ambiguite"] = "   "
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert verdict.notes_ambiguite is False

    def test_les_echoues_portent_leurs_erreurs_et_les_conformes_sont_omis(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        bon = _valider(
            _charger(fixtures_enr, "valide_sans_degats.json"),
            tmp_path / "a",
            sorts_dir,
            schema,
            validateur,
        )
        mauvais = _valider(
            _charger(fixtures_enr, "invalide_tag_inconnu.json"),
            tmp_path / "b",
            sorts_dir,
            schema,
            validateur,
        )
        resume = construire_resume([bon, mauvais], taxonomie="taxonomie_v2")
        assert [e["id"] for e in resume["echoues"]] == [mauvais.id]
        assert resume["echoues"][0]["erreurs"]
        assert resume["ok"] == 1 and resume["echecs"] == 1

    def test_le_rapport_est_serialisable_en_json(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        verdict = _valider(
            _charger(fixtures_enr, "invalide_tag_inconnu.json"),
            tmp_path,
            sorts_dir,
            schema,
            validateur,
        )
        resume = construire_resume([verdict], taxonomie="taxonomie_v2")
        recharge = json.loads(json.dumps(resume, ensure_ascii=False))
        assert recharge == resume


class TestRunSurLeCorpusReel:
    """The validator must actually work on the 2 048 records that exist."""

    def test_aucune_derive_de_source_sur_le_corpus_reel(self, repo_root: Path) -> None:
        # Every stored record still describes the exact text it was generated from.
        resume, verdicts = run(repo_root)
        assert resume["total"] == len(verdicts) == 2048
        assert resume["derive_source"] == []

    def test_les_seuls_echecs_reels_sont_des_preuves_non_retrouvees(
        self, repo_root: Path
    ) -> None:
        """The corpus is 2 030/2 048 conformant; the 16 failures are genuine miscopies.

        Asserted as an exact figure rather than `echecs == 0`, because these records
        are really wrong — hand-verified: paraphrases ("Le type d'énergie dépend
        du type d'écaille"), and one unaccented `est etourdi` for `est étourdi`.
        The fix is upstream (prompt, then regenerate), which is another step's work.
        A test demanding 0 here would only be satisfiable by weakening the check
        this stage exists to perform.
        """
        resume, _ = run(repo_root)
        assert resume["par_type_erreur"] == {"preuve_absente_du_source": 16}
        assert resume["echecs"] == 16
        assert resume["ok"] == 2032

    def test_la_regle_des_cinq_pour_cent_est_mesuree_et_signalee(
        self, repo_root: Path
    ) -> None:
        """The flag is raised on the real corpus, and that is the correct outcome.

        46 % of records carry a non-null `notes_ambiguite`, far above the 5 %
        threshold. This stage's contract is to *report* that, never to correct it
        and never to relax the threshold until it passes: the response the Skill
        prescribes is to widen the closed lists and cut a new taxonomy version.
        The assertion is therefore that the measurement happens and the flag is up.
        """
        resume, _ = run(repo_root)
        assert resume["seuil_ambiguite"] == SEUIL_AMBIGUITE
        assert resume["taux_notes_ambiguite"] > SEUIL_AMBIGUITE
        assert resume["taxonomie_incomplete"] is True

    def test_only_restreint_la_validation(self, repo_root: Path) -> None:
        resume, verdicts = run(repo_root, only=["destruction-de-mort-vivant"])
        assert [v.id for v in verdicts] == ["destruction-de-mort-vivant"]
        assert resume["total"] == 1

    def test_la_version_de_taxonomie_est_celle_des_six_listes(
        self, repo_root: Path
    ) -> None:
        from pf_spells.enrichissement_schema import etiquette_taxonomie

        resume, _ = run(repo_root, only=["destruction-de-mort-vivant"])
        assert resume["version_taxonomie"] == etiquette_taxonomie(repo_root)

    def test_le_run_est_deterministe(self, repo_root: Path) -> None:
        ids = ["destruction-de-mort-vivant", "resistance-a-l-age", "possession"]
        premier, _ = run(repo_root, only=ids)
        second, _ = run(repo_root, only=ids)
        del premier["termine_le"], second["termine_le"]
        assert premier == second


class TestNEcritJamaisDansData:
    """The step's criterion: `git status data/` is empty after a run."""

    def test_git_status_data_est_vide_apres_un_run(self, repo_root: Path) -> None:
        avant = subprocess.run(
            ["git", "status", "--porcelain", "--", "data/"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        run(repo_root)
        apres = subprocess.run(
            ["git", "status", "--porcelain", "--", "data/"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        assert apres == avant
        assert apres.strip() == "", apres

    def test_le_module_n_ouvre_jamais_data_en_ecriture(self, repo_root: Path) -> None:
        """A static guard, because a run that happens to write nothing proves little.

        The only write path is `ecrire_atomique`, and it is called exactly once, on
        the report under `--rapports`. Any second call site is a design change that
        must be seen in review.
        """
        source = (
            repo_root / "src" / "pf_spells" / "validate_enrichment.py"
        ).read_text(encoding="utf-8")
        appels = [
            ligne
            for ligne in source.splitlines()
            if "ecrire_atomique(" in ligne and "def " not in ligne
        ]
        assert len(appels) == 1, appels
        for interdit in ("shutil.", "os.remove", "os.rmdir", "unlink(", "rmtree"):
            # `unlink` in ecrire_atomique's own cleanup is the sole exception.
            occurrences = source.count(interdit)
            attendu = 1 if interdit == "unlink(" else 0
            assert occurrences == attendu, f"{interdit} : {occurrences}"

    def test_aucune_mkdir_ne_cible_data(self, repo_root: Path) -> None:
        source = (
            repo_root / "src" / "pf_spells" / "validate_enrichment.py"
        ).read_text(encoding="utf-8")
        # The single mkdir belongs to the report writer.
        assert source.count("mkdir(") == 1


class TestPasDeVerrouHumain:
    """Anti-pattern #6: the contract is 16 machine keys, with no review key."""

    def test_le_module_ne_connait_aucun_verrou_de_relecture(
        self, repo_root: Path
    ) -> None:
        """No review key is *read* anywhere — checked on the AST, not on the text.

        The module's docstring names `verifie_par_humain` deliberately, to record
        that the plan's step-5 lock was dropped on 2026-07-30 and why. A substring
        scan would forbid documenting the decision; what must be absent is any
        actual reference to such a field, so the check runs on parsed code with
        docstrings and comments excluded.
        """
        import ast

        arbre = ast.parse(
            (repo_root / "src" / "pf_spells" / "validate_enrichment.py").read_text(
                encoding="utf-8"
            )
        )
        interdits = {"verifie_par_humain", "verrouille", "relecture_humaine"}
        litteraux = {
            noeud.value
            for noeud in ast.walk(arbre)
            if isinstance(noeud, ast.Constant) and isinstance(noeud.value, str)
        }
        docstrings = {
            ast.get_docstring(n)
            for n in ast.walk(arbre)
            if isinstance(
                n, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
            )
        }
        for valeur in litteraux - docstrings:
            assert not (interdits & set(valeur.split())), valeur
        noms = {n.id for n in ast.walk(arbre) if isinstance(n, ast.Name)} | {
            n.attr for n in ast.walk(arbre) if isinstance(n, ast.Attribute)
        }
        assert not (interdits & noms), interdits & noms

    def test_un_champ_de_relecture_ajoute_est_rejete(
        self,
        fixtures_enr: Path,
        sorts_dir: Path,
        schema: dict[str, Any],
        validateur: Draft202012Validator,
        tmp_path: Path,
    ) -> None:
        # `additionalProperties: false` is what refuses the 17th key. A record
        # claiming to be human-locked is invalid, not exempt.
        doc = _charger(fixtures_enr, "valide_degats_avec_preuve.json")
        doc["verifie_par_humain"] = True
        verdict = _valider(doc, tmp_path, sorts_dir, schema, validateur)
        assert not verdict.ok
        assert "schema_invalide" in _codes(verdict)

    def test_le_rapport_ne_porte_pas_de_file_de_relecture(self) -> None:
        resume = construire_resume([], taxonomie="taxonomie_v2")
        assert "verrouilles_mais_invalides" not in resume


class TestCLI:
    def test_le_run_reel_sort_en_zero_et_ecrit_le_rapport(
        self, repo_root: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = main(
            [
                "--racine",
                str(repo_root),
                "--rapports",
                str(tmp_path),
                "--only",
                "destruction-de-mort-vivant",
            ]
        )
        assert code == 0
        rapport = tmp_path / FICHIER_RAPPORT
        assert rapport.is_file()
        resume = json.loads(rapport.read_text(encoding="utf-8"))
        assert set(resume) == CLES_RAPPORT
        assert resume["total"] == 1 and resume["echecs"] == 0
        assert "validés : 1" in capsys.readouterr().out

    def test_le_rapport_est_utf8_lf_sans_bom_avec_newline_final(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        main(
            [
                "--racine",
                str(repo_root),
                "--rapports",
                str(tmp_path),
                "--only",
                "destruction-de-mort-vivant",
            ]
        )
        octets = (tmp_path / FICHIER_RAPPORT).read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in octets
        assert octets.endswith(b"\n")
        octets.decode("utf-8")

    def test_strict_sort_en_un_quand_un_enregistrement_echoue(
        self, repo_root: Path, fixtures_enr: Path, sorts_dir: Path, tmp_path: Path
    ) -> None:
        enr = tmp_path / "enr"
        _poser(
            _charger(fixtures_enr, "invalide_tag_inconnu.json"),
            enr,
            sorts_dir,
            restamper=True,
        )
        argv = [
            "--racine",
            str(repo_root),
            "--enrichissements",
            str(enr),
            "--sorts",
            str(sorts_dir),
            "--rapports",
            str(tmp_path / "rap"),
        ]
        assert main(argv) == 0
        assert main([*argv, "--strict"]) == 1

    def test_strict_sort_en_zero_quand_tout_est_conforme(
        self, repo_root: Path, fixtures_enr: Path, sorts_dir: Path, tmp_path: Path
    ) -> None:
        enr = tmp_path / "enr"
        for nom in VALIDES:
            _poser(_charger(fixtures_enr, nom), enr, sorts_dir)
        code = main(
            [
                "--racine",
                str(repo_root),
                "--enrichissements",
                str(enr),
                "--sorts",
                str(sorts_dir),
                "--rapports",
                str(tmp_path / "rap"),
                "--strict",
            ]
        )
        assert code == 0

    def test_un_repertoire_absent_abandonne_sans_traceback(
        self, repo_root: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        code = main(
            [
                "--racine",
                str(repo_root),
                "--enrichissements",
                str(tmp_path / "nulle-part"),
                "--rapports",
                str(tmp_path / "rap"),
            ]
        )
        assert code == 2
        assert "ABANDON" in capsys.readouterr().err
        assert not (tmp_path / "rap").exists(), "aucun rapport sur un abandon"

    def test_les_abreviations_de_drapeaux_sont_desactivees(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        # Same rule as stage 09: a silently-accepted prefix is a wrong run.
        with pytest.raises(SystemExit):
            main(["--racine", str(repo_root), "--rapp", str(tmp_path)])

    def test_le_module_est_executable_en_ligne_de_commande(
        self, repo_root: Path, tmp_path: Path
    ) -> None:
        acheve = subprocess.run(
            [
                sys.executable,
                "-m",
                "pf_spells.validate_enrichment",
                "--racine",
                str(repo_root),
                "--rapports",
                str(tmp_path),
                "--only",
                "destruction-de-mort-vivant",
                "--strict",
            ],
            cwd=repo_root,
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONPATH": str(repo_root / "src")},
        )
        assert acheve.returncode == 0, acheve.stderr
        assert (tmp_path / FICHIER_RAPPORT).is_file()


class TestHorsLigne:
    def test_le_module_n_importe_aucun_client_reseau(self, repo_root: Path) -> None:
        # Stage 10 is offline by design; an import of boto3 here would be a bug of
        # conception, not an optimisation.
        source = (
            repo_root / "src" / "pf_spells" / "validate_enrichment.py"
        ).read_text(encoding="utf-8")
        for interdit in ("boto3", "botocore", "urllib", "requests", "httpx", "socket"):
            assert interdit not in source, interdit

    def test_le_texte_source_n_est_pas_reimplemente(self, repo_root: Path) -> None:
        """Anti-pattern #4: two divergent strings would fail 100 % of evidence.

        The module must import the shared assembler, never rebuild it. A local copy
        of `CHAMPS` or of the separators is the signature of that mistake.
        """
        source = (
            repo_root / "src" / "pf_spells" / "validate_enrichment.py"
        ).read_text(encoding="utf-8")
        assert "from pf_spells.texte_source import" in source
        assert "CHAMPS" not in source
        assert "SEPARATEUR" not in source
        assert "hashlib" not in source


class TestChainageDepuisLEtage09:
    def test_l_etage_09_pointe_vers_ce_module_et_il_existe(
        self, repo_root: Path
    ) -> None:
        """Stage 09 tells the operator what to run next; the name must be real.

        It pointed at `pf_spells.validate_enrichissements`, which never existed —
        a dead-end instruction printed after a paid pass. The plan, both Skills and
        step 09 all say `validate_enrichment`, so that is the name, and this test
        keeps the printed pointer tied to a module on disk.
        """
        source = (repo_root / "src" / "pf_spells" / "enrich_llm.py").read_text(
            encoding="utf-8"
        )
        cites = re.findall(r"python -m (pf_spells\.\w+)", source)
        assert "pf_spells.validate_enrichment" in cites, cites
        for module in cites:
            chemin = repo_root / "src" / Path(*module.split(".")).with_suffix(".py")
            assert chemin.is_file(), module
