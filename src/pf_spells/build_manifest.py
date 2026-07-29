"""Step 10 driver: inventory every corpus artifact into `data/MANIFEST.json`.

The manifest is deliberately a **second, independent census**: every count here is
recomputed from disk rather than copied out of another step's report. That is the
whole point — if step 05 and this module disagree on how many unique spells exist,
the disagreement is a real finding, and copying figures around would hide it.

No network, no HTML parsing, and nothing under `data/` is modified except the
manifest itself.

Outputs:
    data/MANIFEST.json    inventory + independently recounted totals
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

parser_version = "1.0.0"

MANIFEST_PATH = Path("data/MANIFEST.json")

SITE = "https://www.pathfinder-fr.org/"
NOTE_LICENCE = (
    "Contenu extrait du wiki communautaire pathfinder-fr.org. Le matériel "
    "officiel Pathfinder appartient à Black Book Editions et Paizo Publishing, "
    "conformément à la mention portée en pied des pages du wiki. Ce corpus est "
    "constitué pour un usage personnel ; aucune licence n'est accordée ici."
)


def _lignes_jsonl(chemin: Path) -> int:
    """Count non-blank lines — a JSONL record count, tolerant of a trailing LF."""
    if not chemin.exists():
        return 0
    with chemin.open(encoding="utf-8") as f:
        return sum(1 for ligne in f if ligne.strip())


def _nb_fichiers(dossier: Path, motif: str) -> int:
    return sum(1 for _ in dossier.glob(motif)) if dossier.is_dir() else 0


def _documents_sorts(dossier: Path) -> Iterator[dict]:
    for chemin in sorted(dossier.glob("*.json")):
        yield json.loads(chemin.read_text(encoding="utf-8"))


def _entrees_listes(dossier: Path) -> int:
    return sum(_lignes_jsonl(f) for f in sorted(dossier.glob("*.jsonl")))


def _nb_entrees_json(chemin: Path) -> int:
    """Record count for a plain `.json` artifact.

    A top-level array counts its elements; a mapping-of-records object counts its
    keys; anything else is a single document. This keeps `nb_enregistrements`
    meaningful for `classes.json` (19 classes) and for the index objects, instead
    of flatly reporting 1 for every `.json` file.
    """
    if not chemin.exists():
        return 0
    contenu = json.loads(chemin.read_text(encoding="utf-8"))
    if isinstance(contenu, list):
        return len(contenu)
    if isinstance(contenu, dict):
        for cle in ("par_classe", "sorts"):
            if isinstance(contenu.get(cle), dict):
                return len(contenu[cle])
    return 1


def construire_manifeste(racine: Path) -> dict:
    """Build the manifest dict, counting every figure from `racine` on disk."""
    sorts_dir = racine / "data" / "sorts"
    listes_dir = racine / "data" / "listes_classes"
    index_dir = racine / "data" / "index"
    cache_dir = racine / "cache"

    nb_fichiers_sorts = 0
    nb_mythique = 0
    nb_variantes = 0
    for doc in _documents_sorts(sorts_dir):
        nb_fichiers_sorts += 1
        if doc.get("mythique") is not None:
            nb_mythique += 1
        if doc.get("variantes"):
            nb_variantes += 1

    nb_classes = _nb_entrees_json(racine / "data" / "classes.json")
    nb_entrees_listes = _entrees_listes(listes_dir)
    nb_sorts_uniques = _lignes_jsonl(index_dir / "sorts_uniques.jsonl")
    nb_pages_cache = _nb_fichiers(cache_dir / "html", "*.html")

    artefacts = [
        {
            "chemin": "elements_to_do.json",
            "type": "json",
            "nb_enregistrements": _nb_entrees_json(racine / "elements_to_do.json"),
            "schema": None,
            "produit_par_etape": None,
            "autorite": "la liste d'entrée des classes (20 entrées brutes, jamais modifiée)",
            "description": "Source du périmètre : libellé de classe + URL de sa page de liste de sorts.",
        },
        {
            "chemin": "data/classes.json",
            "type": "json",
            "nb_enregistrements": nb_classes,
            "schema": None,
            "produit_par_etape": "03",
            "autorite": "la correspondance libellé de classe ↔ slug ↔ URL de page de liste",
            "description": "Roster dédoublonné par URL normalisée : 20 entrées brutes → 19 classes.",
        },
        {
            "chemin": "data/listes_classes/",
            "type": "repertoire_jsonl",
            "motif": "<class-slug>.jsonl",
            "nb_fichiers": _nb_fichiers(listes_dir, "*.jsonl"),
            "nb_enregistrements": nb_entrees_listes,
            "schema": "schemas/liste_classe.schema.json",
            "produit_par_etape": "04",
            "autorite": "quels sorts une classe reçoit, et à quel niveau",
            "description": "Une ligne par entrée de liste de classe, avec niveau, école, blurb, sources.",
        },
        {
            "chemin": "data/spell_pages.jsonl",
            "type": "jsonl",
            "nb_enregistrements": _lignes_jsonl(racine / "data" / "spell_pages.jsonl"),
            "schema": None,
            "produit_par_etape": "06",
            "autorite": "url de sort ↔ fichier HTML en cache, et statut de récupération",
            "description": "Manifeste de récupération des pages de sorts (reprise sur interruption).",
        },
        {
            "chemin": "data/index/sorts_uniques.jsonl",
            "type": "jsonl",
            "nb_enregistrements": nb_sorts_uniques,
            "schema": None,
            "produit_par_etape": "05",
            "autorite": "l'ensemble des sorts uniques du corpus",
            "description": "Une ligne par sort unique : classes et niveaux agrégés, écoles, sources.",
        },
        {
            "chemin": "data/index/carte_doublons.json",
            "type": "json",
            "nb_enregistrements": _nb_entrees_json(index_dir / "carte_doublons.json"),
            "schema": None,
            "produit_par_etape": "05",
            "autorite": "le partage des sorts entre classes",
            "description": "Distribution du partage : combien de classes accordent chaque sort.",
        },
        {
            "chemin": "data/index/sorts_exclusifs.json",
            "type": "json",
            "nb_enregistrements": _nb_entrees_json(index_dir / "sorts_exclusifs.json"),
            "schema": None,
            "produit_par_etape": "05",
            "autorite": "les sorts exclusifs à une seule classe",
            "description": "Par classe, les sorts qu'aucune autre classe du périmètre n'accorde.",
        },
        {
            "chemin": "data/sorts/",
            "type": "repertoire_json",
            "motif": "<spell-id>.json",
            "nb_fichiers": nb_fichiers_sorts,
            "nb_enregistrements": nb_fichiers_sorts,
            "schema": "schemas/sort.schema.json",
            "produit_par_etape": "07 + 08",
            "autorite": "le sort lui-même — bloc technique, description, classes",
            "description": "Un fichier JSON par sort, 21 clés toujours présentes. Corrigeable à la main : les éditions humaines font foi.",
        },
        {
            "chemin": "cache/html/",
            "type": "repertoire_html",
            "motif": "<sha1>.html",
            "nb_fichiers": nb_pages_cache,
            "nb_enregistrements": nb_pages_cache,
            "schema": None,
            "produit_par_etape": "03, 06",
            "autorite": "les octets source bruts (reproductibilité)",
            "description": "HTML UTF-8 tel que servi par le wiki : permet de corriger un parseur sans re-crawler.",
        },
        {
            "chemin": "cache/index.jsonl",
            "type": "jsonl",
            "nb_enregistrements": _lignes_jsonl(cache_dir / "index.jsonl"),
            "schema": None,
            "produit_par_etape": "03, 06",
            "autorite": "le journal de récupération (url, fichier, statut, date)",
            "description": "Journal append-only : peut compter plus de lignes que de fichiers en cache (une URL revisitée est réécrite).",
        },
        {
            "chemin": "schemas/",
            "type": "repertoire_json_schema",
            "motif": "*.json",
            "nb_fichiers": _nb_fichiers(racine / "schemas", "*.json"),
            "nb_enregistrements": _nb_fichiers(racine / "schemas", "*.json"),
            "schema": None,
            "produit_par_etape": "02",
            "autorite": "les deux contrats de sortie (sort, ligne de liste de classe)",
            "description": "JSON Schema Draft 2020-12, validés à l'écriture par les étapes 04, 07, 08, 09.",
        },
        {
            "chemin": "reports/",
            "type": "repertoire_markdown",
            "motif": "*.md",
            "nb_fichiers": _nb_fichiers(racine / "reports", "*.md"),
            "nb_enregistrements": _nb_fichiers(racine / "reports", "*.md"),
            "schema": None,
            "produit_par_etape": "03–09",
            "autorite": "le résultat et les anomalies de chaque étape",
            "description": "Rien n'est jamais écarté silencieusement : lacunes, libellés inconnus, collisions de slug atterrissent ici.",
        },
    ]

    return {
        "genere_le": datetime.now(UTC).isoformat(),
        "parser_version": parser_version,
        "source": {"site": SITE, "note_licence": NOTE_LICENCE},
        "artefacts": artefacts,
        "totaux": {
            "nb_classes": nb_classes,
            "nb_entrees_listes": nb_entrees_listes,
            "nb_sorts_uniques": nb_sorts_uniques,
            "nb_fichiers_sorts": nb_fichiers_sorts,
            "nb_pages_cache": nb_pages_cache,
            "nb_sorts_avec_mythique": nb_mythique,
            "nb_sorts_avec_variantes": nb_variantes,
        },
    }


def ecrire_manifeste(chemin: Path, manifeste: dict) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=2)
        f.write("\n")


def chemins_manquants(racine: Path, manifeste: dict) -> list[str]:
    """Return the manifest `chemin` values that do not exist under `racine`."""
    return [
        a["chemin"]
        for a in manifeste["artefacts"]
        if not (racine / a["chemin"]).exists()
    ]


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Recense les artefacts du corpus dans data/MANIFEST.json."
    )
    parseur.add_argument(
        "--racine", default=".", help="racine du dépôt à recenser"
    )
    parseur.add_argument(
        "--sortie", default=None, help="chemin du manifeste (défaut : data/MANIFEST.json)"
    )
    parseur.add_argument(
        "--dry-run", action="store_true", help="tout compter sans rien écrire"
    )
    args = parseur.parse_args(argv)

    racine = Path(args.racine)
    manifeste = construire_manifeste(racine)
    manquants = chemins_manquants(racine, manifeste)

    if not args.dry_run:
        sortie = Path(args.sortie) if args.sortie else racine / MANIFEST_PATH
        ecrire_manifeste(sortie, manifeste)

    for cle, valeur in manifeste["totaux"].items():
        print(f"{cle} = {valeur}")
    print(f"{len(manifeste['artefacts'])} artefacts recensés")
    for manquant in manquants:
        print(f"  MANQUANT {manquant}")
    return 1 if manquants else 0


if __name__ == "__main__":
    raise SystemExit(main())
