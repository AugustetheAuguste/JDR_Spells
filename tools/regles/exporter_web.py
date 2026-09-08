"""Publish `data/regles/*.json` to `web/public/data/regles/`, offline.

Model read before writing this: `tools/exporter_web.py` (the sorts exporter,
same shape: read the committed source of truth, rewrite it byte-clean at the
destination, refuse to run on an empty source rather than publish silence).

Steps 05 and 06 are the producers of `data/regles/<table>.json`; this module
never invents a table, it only republishes what already exists. Every source
file must carry the `meta`/`donnees` envelope fixed by
`build/fiche_personnage/02_TOOLS.md`, so a malformed table is caught here
rather than by the site failing to render a filter.

    python tools/regles/exporter_web.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SOURCE_DIR = RACINE / "data/regles"
DEST_DIR = RACINE / "web/public/data/regles"

# `class_skills.json` (étape 10, moteur des compétences) est un artefact du
# corpus des dons (§12 CLAUDE.md), pas une table de règles au sens de ce
# module : pas d'enveloppe `meta`/`donnees`, pas de contrat vérifié par
# `check_contrat_regles.ts`. Republié verbatim sous un répertoire séparé
# plutôt qu'ajouté à `data/regles/`, pour ne jamais faire croire à ce fichier
# qu'il porte l'enveloppe des autres tables.
SOURCE_CLASS_SKILLS = RACINE / "data/classes/class_skills.json"
DEST_CLASS_SKILLS_DIR = RACINE / "web/public/data/classes"


class ExporterReglesError(RuntimeError):
    """Raised when the export cannot proceed at all."""


def _valider_enveloppe(nom: str, contenu: dict) -> None:
    if "meta" not in contenu or "donnees" not in contenu:
        raise ExporterReglesError(
            f"{nom} n'a pas l'enveloppe attendue (`meta` et `donnees`) — "
            f"clés trouvées : {sorted(contenu)}"
        )


def _exporter_une_table(chemin_source: Path) -> tuple[str, str]:
    """Return (nom, sha256 de la source) after writing the republished file."""
    nom = chemin_source.name
    try:
        contenu = json.loads(chemin_source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ExporterReglesError(f"{nom} n'est pas du JSON valide : {erreur}") from erreur
    _valider_enveloppe(nom, contenu)

    octets_source = chemin_source.read_bytes()
    sha256 = hashlib.sha256(octets_source).hexdigest()

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    destination = DEST_DIR / nom
    texte = json.dumps(contenu, ensure_ascii=False, indent=2) + "\n"
    destination.write_text(texte, encoding="utf-8", newline="\n")
    return nom, sha256


def _ecrire_index(tables: list[dict[str, object]]) -> None:
    contenu = {"tables": sorted(tables, key=lambda t: t["nom"])}
    texte = json.dumps(contenu, ensure_ascii=False, indent=2) + "\n"
    (DEST_DIR / "index.json").write_text(texte, encoding="utf-8", newline="\n")


def _exporter_class_skills() -> str:
    """Republish `data/classes/class_skills.json` verbatim. Returns its sha256."""
    if not SOURCE_CLASS_SKILLS.exists():
        raise ExporterReglesError(f"{SOURCE_CLASS_SKILLS.as_posix()} est absent")

    try:
        contenu = json.loads(SOURCE_CLASS_SKILLS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ExporterReglesError(f"class_skills.json n'est pas du JSON valide : {erreur}") from erreur
    if not contenu:
        raise ExporterReglesError("class_skills.json est vide — rien à publier")

    octets_source = SOURCE_CLASS_SKILLS.read_bytes()
    sha256 = hashlib.sha256(octets_source).hexdigest()

    DEST_CLASS_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(contenu, ensure_ascii=False, indent=2) + "\n"
    (DEST_CLASS_SKILLS_DIR / "class_skills.json").write_text(texte, encoding="utf-8", newline="\n")
    return sha256


def exporter() -> list[dict[str, object]]:
    if not SOURCE_DIR.exists():
        raise ExporterReglesError(f"{SOURCE_DIR.as_posix()} est absent")

    sources = sorted(SOURCE_DIR.glob("*.json"))
    if not sources:
        raise ExporterReglesError(
            f"{SOURCE_DIR.as_posix()} ne contient aucune table — "
            "les étapes 05 et 06 n'ont pas encore tourné, rien à exporter."
        )

    tables: list[dict[str, object]] = []
    for chemin in sources:
        nom, sha256 = _exporter_une_table(chemin)
        contenu = json.loads(chemin.read_text(encoding="utf-8"))
        tables.append(
            {
                "nom": nom,
                "version": contenu["meta"].get("version"),
                "sha256": sha256,
            }
        )

    _ecrire_index(tables)

    # Every source table must have landed at the destination — never publish a
    # partial set in silence.
    publies = {p.name for p in DEST_DIR.glob("*.json") if p.name != "index.json"}
    attendues = {c.name for c in sources}
    manquantes = attendues - publies
    if manquantes:
        raise ExporterReglesError(
            f"table(s) non publiée(s) après export : {', '.join(sorted(manquantes))}"
        )

    sha256_class_skills = _exporter_class_skills()
    tables.append(
        {
            "nom": "classes/class_skills.json",
            "version": None,
            "sha256": sha256_class_skills,
        }
    )

    return tables


def main(argv: list[str] | None = None) -> int:
    try:
        tables = exporter()
    except ExporterReglesError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    print(f"{len(tables)} table(s) publiée(s) sous {DEST_DIR.relative_to(RACINE).as_posix()} :")
    for table in tables:
        print(f"  {table['nom']} (version {table['version']}, sha256 {table['sha256'][:12]}…)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
