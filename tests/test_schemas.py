from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SCHEMA_FILES = ["sort.schema.json", "liste_classe.schema.json"]


@pytest.mark.parametrize("nom", SCHEMA_FILES)
def test_schema_is_valid_draft_2020_12(repo_root: Path, nom: str) -> None:
    schema = json.loads((repo_root / "schemas" / nom).read_text(encoding="utf-8"))
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


@pytest.mark.parametrize("nom", SCHEMA_FILES)
def test_schema_forbids_extra_top_level_keys(repo_root: Path, nom: str) -> None:
    schema = json.loads((repo_root / "schemas" / nom).read_text(encoding="utf-8"))
    assert schema["additionalProperties"] is False


def test_liste_classe_accepts_a_realistic_line(repo_root: Path) -> None:
    schema = json.loads(
        (repo_root / "schemas" / "liste_classe.schema.json").read_text(encoding="utf-8")
    )
    ligne = {
        "id": "armes-contre-le-mal",
        "nom": "Armes contre le mal",
        "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Armes.ashx",
        "niveau": 2,
        "classe": "druide",
        "ecole": "Abjuration",
        "description_courte": "Les armes touchées deviennent bénies.",
        "sources": ["RSE"],
        "ligne_html": "<b><i><a>Armes contre le mal</a></i></b>",
    }
    Draft202012Validator(schema).validate(ligne)

    with pytest.raises(Exception):
        Draft202012Validator(schema).validate({**ligne, "inconnu": 1})


def test_sort_schema_accepts_a_realistic_spell(repo_root: Path) -> None:
    schema = json.loads((repo_root / "schemas" / "sort.schema.json").read_text(encoding="utf-8"))
    sort = {
        "id": "requiem-pour-les-fantomes",
        "nom": "Requiem pour les fantômes",
        "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Requiem.ashx",
        "ecole": "Transmutation",
        "descripteurs": [],
        "niveaux": {"Bard": 2, "Pal": 1},
        "temps_incantation": "1 action simple",
        "composantes": "V, G, M/FD",
        "portee": "courte",
        "cible": None,
        "duree": "1 minute",
        "jet_de_sauvegarde": "aucun",
        "resistance_magie": "non",
        "description": "texte",
        "description_html": "<p>texte</p>",
        "mythique": None,
        "variantes": [
            {
                "nom": "Requiem pour les fantômes de groupe",
                "id": "requiem-pour-les-fantomes-de-groupe",
                "niveaux": {"Bard": 4},
                "description": "texte",
                "description_html": "<p>texte</p>",
            }
        ],
        "sources": ["RSE"],
        "autres": {"note": None},
        "classes": [{"classe": "Barde", "slug": "barde", "niveau": 2}],
        "meta": {
            "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Requiem.ashx",
            "cache_fichier": "cache/html/abc.html",
            "recupere_le": "2026-07-28T00:00:00+00:00",
            "parser_version": "1.0.0",
        },
    }
    Draft202012Validator(schema).validate(sort)

    with pytest.raises(Exception):
        Draft202012Validator(schema).validate({**sort, "inconnu": 1})


def test_sort_schema_mythique_block_shape(repo_root: Path) -> None:
    schema = json.loads((repo_root / "schemas" / "sort.schema.json").read_text(encoding="utf-8"))
    validateur = Draft202012Validator(schema)
    bloc = {"description": "t", "description_html": "<p>t</p>"}
    assert validateur.is_valid({"mythique": bloc}) is False  # champs requis manquants
    sous_schema = schema["properties"]["mythique"]
    Draft202012Validator(sous_schema).validate(bloc)
    Draft202012Validator(sous_schema).validate(None)
