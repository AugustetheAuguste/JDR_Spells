from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pf_spells.enrichissement_schema import (
    VOCABULAIRES,
    charger_schema_brut,
    charger_schema_resolu,
    charger_vocabulaire,
)

FICHIERS_VOCABULAIRE = sorted(VOCABULAIRES.values())

VALIDES = [
    "valide_degats_avec_preuve.json",
    "valide_sans_degats.json",
    "valide_avec_note_ambiguite.json",
]

# One invalid fixture per failure mode, with what the rejection must look like:
# (fichier, mot-clé du validateur, chemin json de l'erreur, fragment de message).
INVALIDES = [
    ("invalide_tag_inconnu.json", "enum", "$.tags[1]", "sort_de_mort_qui_tue"),
    ("invalide_resume_trop_long.json", "maxLength", "$.resume_court", "is too long"),
    ("invalide_preuve_absente.json", "required", "$.preuves", "cible_typique"),
    ("invalide_cle_en_trop.json", "additionalProperties", "$", "puissance_estimee"),
    ("invalide_type_degats_sans_preuve.json", "type", "$.preuves.type_degats", "string"),
]

_CLE_VOCABULAIRE = re.compile(r"^[a-z0-9_]+$")

# U+FFFD by codepoint: a literal would make this file fail its own encoding check.
_REMPLACEMENT = chr(0xFFFD)


@pytest.fixture(scope="module")
def schema_resolu(repo_root: Path) -> dict:
    return charger_schema_resolu(repo_root)


@pytest.fixture(scope="module")
def validateur(schema_resolu: dict) -> Draft202012Validator:
    return Draft202012Validator(schema_resolu)


def _fixture(repo_root: Path, nom: str) -> dict:
    chemin = repo_root / "tests" / "fixtures" / "enrichissements" / nom
    return json.loads(chemin.read_text(encoding="utf-8"))


class TestSchema:
    def test_le_schema_sur_disque_est_un_draft_2020_12_valide(self, repo_root: Path) -> None:
        schema = charger_schema_brut(repo_root)
        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["$id"] == "https://jdr-spells.local/schemas/enrichissement.schema.json"
        Draft202012Validator.check_schema(schema)

    def test_le_schema_resolu_est_aussi_un_draft_2020_12_valide(self, schema_resolu: dict) -> None:
        Draft202012Validator.check_schema(schema_resolu)

    def test_le_schema_ferme_l_objet_et_exige_les_dix_sept_cles(self, schema_resolu: dict) -> None:
        assert schema_resolu["additionalProperties"] is False
        assert len(schema_resolu["required"]) == 17
        assert sorted(schema_resolu["required"]) == sorted(schema_resolu["properties"])

    def test_le_schema_cite_le_skill_comme_source_de_la_politique_des_nulls(
        self, repo_root: Path
    ) -> None:
        description = charger_schema_brut(repo_root)["description"]
        assert "pf-enrichment-conventions" in description
        assert "null" in description

    def test_le_schema_resolu_est_autonome_aucun_ref_externe(self, schema_resolu: dict) -> None:
        refs: list[str] = []

        def collecter(noeud: object) -> None:
            if isinstance(noeud, dict):
                if isinstance(noeud.get("$ref"), str):
                    refs.append(noeud["$ref"])
                for valeur in noeud.values():
                    collecter(valeur)
            elif isinstance(noeud, list):
                for valeur in noeud:
                    collecter(valeur)

        collecter(schema_resolu)
        assert refs, "le schéma utilise bien des $ref internes"
        assert all(ref.startswith("#/") for ref in refs), refs

    def test_le_validateur_marche_sans_registre_de_resolution(
        self, validateur: Draft202012Validator, repo_root: Path
    ) -> None:
        # No retrieval hook, no registry: exactly how Phase 1 validates.
        assert validateur.is_valid(_fixture(repo_root, VALIDES[0])) is True


class TestCasValides:
    @pytest.mark.parametrize("nom", VALIDES)
    def test_le_cas_valide_passe_sans_aucune_erreur(
        self, validateur: Draft202012Validator, repo_root: Path, nom: str
    ) -> None:
        erreurs = list(validateur.iter_errors(_fixture(repo_root, nom)))
        assert erreurs == [], [e.message for e in erreurs]

    def test_les_trois_cas_couvrent_les_trois_situations_de_la_politique_des_nulls(
        self, repo_root: Path
    ) -> None:
        avec_degats = _fixture(repo_root, "valide_degats_avec_preuve.json")
        sans_degats = _fixture(repo_root, "valide_sans_degats.json")
        ambigu = _fixture(repo_root, "valide_avec_note_ambiguite.json")
        assert avec_degats["type_degats"] is not None
        assert isinstance(avec_degats["preuves"]["type_degats"], str)
        assert sans_degats["type_degats"] is None
        assert sans_degats["preuves"]["type_degats"] is None
        assert sans_degats["condition_infligee"] == []
        assert isinstance(ambigu["notes_ambiguite"], str) and ambigu["notes_ambiguite"]

    @pytest.mark.parametrize("nom", VALIDES)
    def test_le_cas_valide_reprend_un_id_de_la_fixture_mini_corpus(
        self, repo_root: Path, nom: str
    ) -> None:
        doc = _fixture(repo_root, nom)
        sorts = repo_root / "tests" / "fixtures" / "mini_corpus" / "data" / "sorts"
        assert (sorts / f"{doc['id']}.json").is_file()

    @pytest.mark.parametrize("nom", VALIDES)
    def test_le_cas_valide_n_emploie_que_des_tags_du_vocabulaire_v0(
        self, repo_root: Path, nom: str
    ) -> None:
        connus = set(charger_vocabulaire(repo_root, "tags.json"))
        assert set(_fixture(repo_root, nom)["tags"]) <= connus


class TestCasInvalides:
    @pytest.mark.parametrize(("nom", "mot_cle", "chemin", "fragment"), INVALIDES)
    def test_le_cas_invalide_echoue_pour_la_bonne_raison(
        self,
        validateur: Draft202012Validator,
        repo_root: Path,
        nom: str,
        mot_cle: str,
        chemin: str,
        fragment: str,
    ) -> None:
        erreurs = list(validateur.iter_errors(_fixture(repo_root, nom)))
        assert erreurs, f"{nom} devrait être rejeté"
        vises = [
            e
            for e in erreurs
            if e.validator == mot_cle and e.json_path == chemin and fragment in e.message
        ]
        assert vises, [(e.validator, e.json_path, e.message) for e in erreurs]

    @pytest.mark.parametrize(("nom", "mot_cle", "chemin", "fragment"), INVALIDES)
    def test_le_cas_invalide_ne_porte_qu_un_seul_defaut(
        self, repo_root: Path, nom: str, mot_cle: str, chemin: str, fragment: str
    ) -> None:
        # Each invalid fixture is one valid record plus exactly one mutation, so
        # the corresponding valid record must itself be clean.
        del mot_cle, chemin, fragment
        assert _fixture(repo_root, nom)["id"] in {
            _fixture(repo_root, valide)["id"] for valide in VALIDES
        }

    def test_le_couplage_type_degats_preuve_est_bien_exprime_dans_le_schema(
        self, repo_root: Path
    ) -> None:
        # The rejection of mode (e) comes from pure JSON Schema (if/then), not from
        # an auxiliary Python check: nothing outside the schema can forget it.
        couplage = charger_schema_brut(repo_root)["allOf"][0]
        assert couplage["if"]["properties"]["type_degats"] == {"type": "string"}
        cible = couplage["then"]["properties"]["preuves"]
        assert cible["required"] == ["type_degats"]
        assert cible["properties"]["type_degats"]["type"] == "string"

    def test_type_degats_nul_avec_preuve_nulle_reste_accepte(
        self, validateur: Draft202012Validator, repo_root: Path
    ) -> None:
        # The if/then must not fire when the spell simply deals no damage.
        doc = _fixture(repo_root, "valide_sans_degats.json")
        assert validateur.is_valid(doc) is True


class TestVocabulaires:
    def test_les_six_fichiers_existent(self, repo_root: Path) -> None:
        presents = sorted(
            p.name for p in (repo_root / "conventions" / "vocabulaires").glob("*.json")
        )
        assert presents == FICHIERS_VOCABULAIRE

    @pytest.mark.parametrize("nom", FICHIERS_VOCABULAIRE)
    def test_le_fichier_porte_une_version_et_des_valeurs(self, repo_root: Path, nom: str) -> None:
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / nom).read_text(encoding="utf-8")
        )
        # `tags.json` a été recoupée en v1 par l'étape 04 ; les cinq autres
        # listes n'ont pas de passe de dérivation et restent en v0.
        attendue = "v1" if nom == "tags.json" else "v0"
        assert doc["version"] == attendue
        assert isinstance(doc["valeurs"], list) and doc["valeurs"]

    @pytest.mark.parametrize("nom", FICHIERS_VOCABULAIRE)
    def test_chaque_entree_a_definition_et_deux_exemples_de_chaque_signe(
        self, repo_root: Path, nom: str
    ) -> None:
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / nom).read_text(encoding="utf-8")
        )
        for entree in doc["valeurs"]:
            assert set(entree) == {
                "cle",
                "definition_fr",
                "exemples_positifs",
                "exemples_negatifs",
            }, entree
            assert entree["definition_fr"].strip()
            assert len(entree["exemples_positifs"]) >= 2, entree["cle"]
            assert len(entree["exemples_negatifs"]) >= 2, entree["cle"]
            assert not set(entree["exemples_positifs"]) & set(entree["exemples_negatifs"])

    @pytest.mark.parametrize("nom", FICHIERS_VOCABULAIRE)
    def test_les_cles_sont_snake_case_sans_accent_et_uniques(
        self, repo_root: Path, nom: str
    ) -> None:
        cles = charger_vocabulaire(repo_root, nom)  # lève si doublon
        assert len(cles) == len(set(cles))
        for cle in cles:
            assert _CLE_VOCABULAIRE.fullmatch(cle), cle

    @pytest.mark.parametrize("nom", FICHIERS_VOCABULAIRE)
    def test_les_exemples_sont_des_noms_de_sorts_du_corpus_reel(
        self, repo_root: Path, nom: str
    ) -> None:
        noms = set()
        for ligne in (
            (repo_root / "data" / "index" / "sorts_uniques.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
        ):
            if ligne.strip():
                noms.add(json.loads(ligne)["nom"])
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / nom).read_text(encoding="utf-8")
        )
        inconnus = [
            exemple
            for entree in doc["valeurs"]
            for exemple in entree["exemples_positifs"] + entree["exemples_negatifs"]
            if exemple not in noms
        ]
        assert inconnus == []

    def test_tags_v1_se_declare_gelee_et_nomme_sa_regle_de_coupe(
        self, repo_root: Path
    ) -> None:
        """La v0 se disait provisoire ; la v1 doit dire d'où elle vient.

        Une liste close dérivée par machine n'a d'autorité que si son mode de
        dérivation est écrit à côté d'elle — sinon rien ne distingue une coupe
        réglée d'une liste improvisée.
        """
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / "tags.json").read_text(encoding="utf-8")
        )
        assert doc["version"] == "v1"
        assert doc["gele_le"]
        assert "taxonomie_v1" in doc["note"]
        regle = doc["regle_de_coupe"]
        assert regle["seuil_sorts_echantillon"] == 10
        assert regle["source"] == "build_artifacts/taxo_passe0_agrege.csv"
        assert regle["groupes"] == "conventions/taxo_groupes.json"
        # Le plafond de 5 % de notes_ambiguite est une règle de la passe 1, mais
        # elle doit être écrite dès le gel (exigence de l'étape 04).
        assert "5 %" in doc["notes_ambiguite_plafond"]

    def test_tags_v1_compte_entre_25_et_40_entrees(self, repo_root: Path) -> None:
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / "tags.json").read_text(encoding="utf-8")
        )
        assert 25 <= len(doc["valeurs"]) <= 40

    def test_roles_tactiques_et_cibles_valent_exactement_le_contrat(
        self, repo_root: Path
    ) -> None:
        assert charger_vocabulaire(repo_root, "roles_tactiques.json") == [
            "combat",
            "exploration",
            "social",
            "utilitaire",
        ]
        assert charger_vocabulaire(repo_root, "cibles.json") == [
            "soi",
            "allie",
            "ennemi",
            "zone",
            "objet",
        ]


class TestAntiDerive:
    @pytest.mark.parametrize(("nom_def", "nom_fichier"), sorted(VOCABULAIRES.items()))
    def test_l_enum_appliquee_a_la_validation_egale_le_fichier_de_vocabulaire(
        self, schema_resolu: dict, repo_root: Path, nom_def: str, nom_fichier: str
    ) -> None:
        assert schema_resolu["$defs"][nom_def]["enum"] == charger_vocabulaire(
            repo_root, nom_fichier
        )

    @pytest.mark.parametrize(("nom_def", "nom_fichier"), sorted(VOCABULAIRES.items()))
    def test_le_schema_sur_disque_ne_porte_aucun_enum(
        self, repo_root: Path, nom_def: str, nom_fichier: str
    ) -> None:
        del nom_fichier
        assert "enum" not in charger_schema_brut(repo_root)["$defs"][nom_def]

    def test_une_valeur_hors_vocabulaire_est_bien_refusee_champ_par_champ(
        self, validateur: Draft202012Validator, repo_root: Path
    ) -> None:
        doc = _fixture(repo_root, "valide_degats_avec_preuve.json")
        for champ, intrus in [
            ("categorie_principale", "categorie_inventee"),
            ("cible_typique", "cible_inventee"),
            ("type_degats", "degats_inventes"),
        ]:
            assert validateur.is_valid({**doc, champ: intrus}) is False, champ
        assert validateur.is_valid({**doc, "roles_tactiques": ["role_invente"]}) is False
        assert validateur.is_valid({**doc, "condition_infligee": ["condition_inventee"]}) is False

    def test_aucune_liste_close_n_est_recopiee_hors_de_conventions_vocabulaires(
        self, repo_root: Path
    ) -> None:
        # Mechanical form of the plan's grep criterion: for every vocabulary, no
        # file outside conventions/vocabulaires/ may name a majority of its keys.
        # A whole closed list duplicated anywhere would trip this immediately.
        vocabulaires = {
            nom_fichier: set(charger_vocabulaire(repo_root, nom_fichier))
            for nom_fichier in FICHIERS_VOCABULAIRE
        }
        surveilles = [
            repo_root / "schemas" / "enrichissement.schema.json",
            *sorted((repo_root / "src" / "pf_spells").glob("*.py")),
            repo_root / "tests" / "test_enrichissement_schema.py",
        ]
        fautifs: list[tuple[str, str, int]] = []
        for chemin in surveilles:
            texte = chemin.read_text(encoding="utf-8")
            mots = set(re.findall(r"[a-z0-9_]+", texte))
            for nom_fichier, cles in vocabulaires.items():
                # roles_tactiques and cibles are short and their members are common
                # French words; they are exempted only from the ratio heuristic and
                # are covered instead by the exact assertion below.
                if nom_fichier in {"roles_tactiques.json", "cibles.json"}:
                    continue
                presentes = len(cles & mots)
                if presentes > len(cles) // 2:
                    fautifs.append((chemin.name, nom_fichier, presentes))
        assert fautifs == [], fautifs

    def test_les_listes_courtes_ne_sont_pas_ecrites_en_dur_dans_le_schema(
        self, repo_root: Path
    ) -> None:
        texte = (repo_root / "schemas" / "enrichissement.schema.json").read_text(encoding="utf-8")
        mots = set(re.findall(r"[a-z0-9_]+", texte))
        for nom_fichier in ("roles_tactiques.json", "cibles.json"):
            cles = set(charger_vocabulaire(repo_root, nom_fichier))
            # `utilitaire` etc. must not appear at all in the schema text.
            assert not (cles & mots), (nom_fichier, sorted(cles & mots))


class TestFormatDesFichiers:
    @staticmethod
    def _fichiers(repo_root: Path) -> list[Path]:
        return [
            repo_root / "schemas" / "enrichissement.schema.json",
            repo_root / "src" / "pf_spells" / "enrichissement_schema.py",
            repo_root / "tests" / "test_enrichissement_schema.py",
            *sorted((repo_root / "conventions" / "vocabulaires").glob("*.json")),
            *sorted((repo_root / "tests" / "fixtures" / "enrichissements").glob("*.json")),
        ]

    def test_utf8_sans_bom_lf_et_saut_de_ligne_final(self, repo_root: Path) -> None:
        for chemin in self._fichiers(repo_root):
            octets = chemin.read_bytes()
            assert not octets.startswith(b"\xef\xbb\xbf"), chemin
            assert b"\r" not in octets, chemin
            assert octets.endswith(b"\n"), chemin
            texte = octets.decode("utf-8")
            assert _REMPLACEMENT not in texte, chemin

    def test_les_json_sont_en_indent_2_et_ensure_ascii_false(self, repo_root: Path) -> None:
        for chemin in self._fichiers(repo_root):
            if chemin.suffix != ".json":
                continue
            texte = chemin.read_text(encoding="utf-8")
            attendu = json.dumps(
                json.loads(texte), ensure_ascii=False, indent=2, sort_keys=False
            )
            assert texte == attendu + "\n", chemin

    def test_les_fixtures_sont_bien_trois_valides_et_cinq_invalides(self, repo_root: Path) -> None:
        presents = sorted(
            p.name for p in (repo_root / "tests" / "fixtures" / "enrichissements").glob("*.json")
        )
        assert presents == sorted(VALIDES + [nom for nom, *_ in INVALIDES])
