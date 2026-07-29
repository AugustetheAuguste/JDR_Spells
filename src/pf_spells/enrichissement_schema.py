"""Load the enrichment schema with the closed vocabularies injected into it.

Phase 1 validates with a plain `Draft202012Validator` over a self-contained
schema and never resolves an external `$ref` — no retrieval hook, no registry.
Rather than hand-copying the closed lists into the schema (which would give each
list two homes and guarantee drift), the schema ships each closed value slot as a
bare `type: string` placeholder under `$defs/vocabulaire_*`, and this module
injects the real `enum` read from `conventions/vocabulaires/*.json` at load time.
Consequence: `conventions/vocabulaires/` stays the single source of truth, and
callers still get one flat dict usable directly with `Draft202012Validator`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# $defs entry <- vocabulary file whose `valeurs[].cle` fills its enum.
VOCABULAIRES: dict[str, str] = {
    "vocabulaire_categories": "categories.json",
    "vocabulaire_tags": "tags.json",
    "vocabulaire_roles_tactiques": "roles_tactiques.json",
    "vocabulaire_cibles": "cibles.json",
    "vocabulaire_types_degats": "types_degats.json",
    "vocabulaire_conditions": "conditions.json",
}

CHEMIN_SCHEMA = Path("schemas") / "enrichissement.schema.json"
CHEMIN_VOCABULAIRES = Path("conventions") / "vocabulaires"

# U+FFFD, spelled by codepoint: writing it literally would make this very file
# trip the encoding checks it exists to enforce.
_REMPLACEMENT = chr(0xFFFD)


def _lire_json(chemin: Path) -> Any:
    """Decode UTF-8 explicitly: auto-detection is what produces mojibake here."""
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise ValueError(f"U+FFFD dans {chemin} : corruption d'encodage, pas une donnée")
    return json.loads(texte)


def charger_vocabulaire(racine: Path, nom_fichier: str) -> list[str]:
    """Return the ordered `cle` list of one vocabulary file.

    Order is preserved so that a diff of the resolved schema stays readable.
    """
    doc = _lire_json(racine / CHEMIN_VOCABULAIRES / nom_fichier)
    valeurs = doc["valeurs"]
    cles = [entree["cle"] for entree in valeurs]
    doublons = {cle for cle in cles if cles.count(cle) > 1}
    if doublons:
        raise ValueError(f"clés dupliquées dans {nom_fichier} : {sorted(doublons)}")
    return cles


def charger_schema_brut(racine: Path) -> dict[str, Any]:
    """Return the on-disk schema, placeholders unresolved."""
    return _lire_json(racine / CHEMIN_SCHEMA)


def charger_schema_resolu(racine: Path) -> dict[str, Any]:
    """Return a self-contained enrichment schema, enums injected.

    Every `$defs/vocabulaire_*` placeholder MUST exist in the schema and MUST NOT
    already carry an `enum`: an enum found on disk would mean someone duplicated a
    closed list into the schema, which is exactly what this indirection forbids.
    """
    schema = charger_schema_brut(racine)
    defs = schema["$defs"]
    for nom_def, nom_fichier in VOCABULAIRES.items():
        if nom_def not in defs:
            raise KeyError(f"$defs/{nom_def} absent du schéma")
        if "enum" in defs[nom_def]:
            raise ValueError(
                f"$defs/{nom_def} porte déjà un enum : une liste close ne vit que "
                f"dans conventions/vocabulaires/{nom_fichier}"
            )
        defs[nom_def]["enum"] = charger_vocabulaire(racine, nom_fichier)
    return schema
