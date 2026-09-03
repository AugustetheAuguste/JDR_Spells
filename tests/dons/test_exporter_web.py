"""Tests for `tools/dons/exporter_web.py` (Wave 08 — l'exporteur Python des
artefacts web des dons).

Trois couches, comme `tests/test_export_web.py` côté sorts : la sortie brute
(comptes, densité, unicité), la conformité au schéma (jsonschema, sans
dépendre de `npx tsx` pour que la suite pytest reste indépendante de node),
et la comparaison champ à champ avec les fixtures figées de l'étape 05/06
(`web/fixtures/index_dons.json`, `web/fixtures/moteur_dons.json`) — les 24
dons qui y figurent doivent avoir, dans l'export réel, une entrée de même
forme (mêmes clés, mêmes types). On ne compare pas les VALEURS sémantiques
(le contenu de la fixture 05/06 a pu être gelé à un instant différent de
celui du catalogue réel), seulement la structure : c'est ce que le plan 08
appelle « structure identique ».
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import jsonschema
import pytest

import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "dons"))

import exporter_web  # noqa: E402

FIXTURE_INDEX = REPO_ROOT / "web" / "fixtures" / "index_dons.json"
FIXTURE_MOTEUR = REPO_ROOT / "web" / "fixtures" / "moteur_dons.json"


@pytest.fixture(scope="module")
def export_reel(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    sortie = tmp_path_factory.mktemp("export_dons_reel")
    exporter_web.exporter(sortie, valider=False, genere_le="2026-09-02T00:00:00Z")
    index = json.loads((sortie / "index.json").read_text(encoding="utf-8"))
    moteur = json.loads((sortie / "moteur.json").read_text(encoding="utf-8"))
    derive = json.loads((sortie / "DERIVE.json").read_text(encoding="utf-8"))
    props = {}
    for entree in index["dons"]:
        chemin = sortie / f"{entree['s']}.json"
        props[entree["s"]] = json.loads(chemin.read_text(encoding="utf-8"))
    return {"index": index, "moteur": moteur, "derive": derive, "props": props, "sortie": sortie}


class TestComptesEtInvariants:
    def test_1417_dons(self, export_reel: dict[str, Any]) -> None:
        assert len(export_reel["index"]["dons"]) == 1417
        assert len(export_reel["moteur"]["conditions"]) == 1417

    def test_i_dense(self, export_reel: dict[str, Any]) -> None:
        indices = [d["i"] for d in export_reel["index"]["dons"]]
        assert indices == list(range(len(indices)))

    def test_slugs_uniques(self, export_reel: dict[str, Any]) -> None:
        slugs = [d["s"] for d in export_reel["index"]["dons"]]
        assert len(slugs) == len(set(slugs))

    def test_un_repetable_porte_r_et_asterisque(self, export_reel: dict[str, Any]) -> None:
        repetables = [d for d in export_reel["index"]["dons"] if d["r"]]
        assert len(repetables) > 0
        assert all(d["n"].rstrip().endswith("*") for d in repetables)

    def test_aucun_champ_dependant_du_personnage(self, export_reel: dict[str, Any]) -> None:
        interdits = {"vague", "cout", "voie", "statut"}
        texte_index = json.dumps(export_reel["index"], ensure_ascii=False)
        texte_moteur = json.dumps(export_reel["moteur"], ensure_ascii=False)
        for champ in interdits:
            assert f'"{champ}"' not in texte_index
            assert f'"{champ}"' not in texte_moteur
        # `levier_catalogue` est attendu ; `levier` seul (dans la vue) doit
        # être absent — distinguer les deux, pas juste chercher la sous-chaîne.
        assert '"levier"' not in texte_moteur
        assert "levier_catalogue" in texte_moteur

    def test_9_genres_bloquants_6_non_bloquants(self, export_reel: dict[str, Any]) -> None:
        moteur = export_reel["moteur"]
        assert len(moteur["genres_bloquants"]) == 9
        assert len(moteur["genres_non_bloquants"]) == 6

    def test_proficiency_18_bloquantes_13_non_bloquantes(
        self, export_reel: dict[str, Any]
    ) -> None:
        hits = [
            h
            for cond in export_reel["moteur"]["conditions"].values()
            for item in cond["exigences"]
            for h in (
                item.get("charge", {}).get("gating", [])
                if "charge" in item
                else [
                    hit
                    for opt in item.get("options", [])
                    for hit in opt.get("charge", {}).get("gating", [])
                ]
            )
            if h.get("kind") == "proficiency"
        ]
        # Chaque hit apparaît potentiellement plusieurs fois (une fois par don
        # qui le cite) : on compte les mot-clés distincts, pas les occurrences.
        bloquants = {h["keyword"] for h in hits if h["blocking"]}
        non_bloquants = {h["keyword"] for h in hits if not h["blocking"]}
        assert len(bloquants) == 18, sorted(bloquants)
        assert len(non_bloquants) == 13, sorted(non_bloquants)

    def test_zero_prerequis_de_don_pendant(self, export_reel: dict[str, Any]) -> None:
        moteur = export_reel["moteur"]
        slugs = set(moteur["conditions"].keys())
        for arete in moteur["aretes"]:
            assert arete["de"] in slugs
            assert arete["vers"] in slugs
        for slug, groupes in moteur["prerequis_dons"].items():
            assert slug in slugs
            for groupe in groupes:
                for prereq_slug in groupe:
                    assert prereq_slug in slugs, prereq_slug


class TestConformiteSchema:
    def test_index_valide_le_schema(self, export_reel: dict[str, Any]) -> None:
        schema = json.loads(
            (REPO_ROOT / "data" / "schemas" / "web_index_dons.schema.json").read_text(
                encoding="utf-8"
            )
        )
        jsonschema.Draft202012Validator.check_schema(schema)
        erreurs = list(
            jsonschema.Draft202012Validator(schema).iter_errors(export_reel["index"])
        )
        assert erreurs == [], [e.message for e in erreurs[:5]]


class TestComparaisonFixtureEtapes05_06:
    """Les 24 dons de la fixture figée doivent avoir une contrepartie de même
    forme dans l'export réel — pas les mêmes valeurs (la fixture a pu être
    gelée avant une correction du catalogue), mais les mêmes clés / types."""

    def test_index_meme_forme(self, export_reel: dict[str, Any]) -> None:
        if not FIXTURE_INDEX.exists():
            pytest.skip("web/fixtures/index_dons.json absent")
        fixture = json.loads(FIXTURE_INDEX.read_text(encoding="utf-8"))
        reel_par_slug = {d["s"]: d for d in export_reel["index"]["dons"]}
        for don_fixture in fixture["dons"]:
            slug = don_fixture["s"]
            assert slug in reel_par_slug, f"{slug} absent de l'export réel"
            don_reel = reel_par_slug[slug]
            assert set(don_fixture.keys()) == set(don_reel.keys()), slug
            for cle, valeur in don_fixture.items():
                assert type(valeur) is type(don_reel[cle]) or (
                    valeur is None or don_reel[cle] is None
                ), f"{slug}.{cle}"

    def test_moteur_meme_forme(self, export_reel: dict[str, Any]) -> None:
        if not FIXTURE_MOTEUR.exists():
            pytest.skip("web/fixtures/moteur_dons.json absent")
        fixture = json.loads(FIXTURE_MOTEUR.read_text(encoding="utf-8"))
        reel = export_reel["moteur"]
        cles_fixture = set(fixture.keys()) - {"_fixture_slugs"}
        assert cles_fixture <= set(reel.keys())
        for slug, cond_fixture in fixture["conditions"].items():
            assert slug in reel["conditions"], f"{slug} absent du moteur réel"
            cond_reel = reel["conditions"][slug]
            assert set(cond_fixture.keys()) == set(cond_reel.keys()), slug
            assert isinstance(cond_reel["brut"], str)
            assert isinstance(cond_reel["effectif"], str)


class TestProps:
    def test_chaque_don_a_ses_props(self, export_reel: dict[str, Any]) -> None:
        assert len(export_reel["props"]) == 1417

    def test_raw_et_effective_distincts_pour_au_moins_un_don(
        self, export_reel: dict[str, Any]
    ) -> None:
        diffs = [
            p
            for p in export_reel["props"].values()
            if p["raw_conditions"] != p["effective_conditions"]
        ]
        assert diffs, "aucun don n'a raw_conditions != effective_conditions"

    def test_astérisque_absente_du_slug(self, export_reel: dict[str, Any]) -> None:
        for slug, props in export_reel["props"].items():
            assert "*" not in slug
            if props["nom"].rstrip().endswith("*"):
                assert props["slug"] == slug


class TestDerive:
    def test_empreinte_present(self, export_reel: dict[str, Any]) -> None:
        assert isinstance(export_reel["derive"]["empreinte"], str)
        assert len(export_reel["derive"]["empreinte"]) == 64  # sha256 hex
