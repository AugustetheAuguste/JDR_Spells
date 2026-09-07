"""Import already-captured class pages from a local folder — a comfort shortcut.

Offline. Copies bytes verbatim into `cache/html_classes/`, exactly like
`recuperer_pages_classes.py` populates it, so step 05 cannot tell which tool
was used. Never the only way to obtain the cache: the folder this reads from
is not part of this repository and will be deleted, cf.
`build/fiche_personnage/02_TOOLS.md`. There is deliberately no default for
`--source` — a hard-coded default pointing at a folder due to disappear would
fail this tool with an incomprehensible message on the day it is deleted.

Does not parse anything: reading the wiki's per-class progression table is
step 05's job, and it must decode the (undeclared) UTF-8 explicitly there, not
here. This module only ever touches bytes.

    python tools/regles/importer_cache_classes.py --source <chemin>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

RACINE = Path(__file__).resolve().parents[2]

CACHE_DIR = RACINE / "cache/html_classes"
INDEX_PATH = CACHE_DIR / "index.jsonl"
REGISTRE = RACINE / "data/conventions/classes_unifiees.json"
REPORT_PATH_DEFAUT = RACINE / "reports/regles_import_cache.md"
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."


def _url_pour(nom: str) -> str:
    """Same construction as `recuperer_pages_classes.py`, so the two voies
    agree on the URL a slug maps to, even though this one never fetches it."""
    return f"{BASE_URL}{quote(nom, safe='')}.ashx"


def _charger_noms_registre() -> dict[str, str]:
    contenu = json.loads(REGISTRE.read_text(encoding="utf-8"))
    return {c["slug"]: c["nom"] for c in contenu["classes"]}


def _ecrire_rapport_echec(rapport: Path, motif: str) -> None:
    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text(
        "# Rapport — import du cache de pages de classe\n\n"
        f"ÉCHEC : {motif}\n\n"
        "Utiliser la voie normale à la place :\n\n"
        "```bash\nnpm run regles:recuperer\n```\n",
        encoding="utf-8",
        newline="\n",
    )


def executer(*, source: Path, rapport: Path) -> int:
    if not source.exists() or not source.is_dir():
        motif = f"la source `{source.as_posix()}` n'existe pas ou n'est pas un dossier"
        print(f"ÉCHEC : {motif}", file=sys.stderr)
        print("Utiliser plutôt : npm run regles:recuperer", file=sys.stderr)
        _ecrire_rapport_echec(rapport, motif)
        return 1

    noms_registre = _charger_noms_registre()
    fichiers = sorted(source.glob("*.html"))

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    copies: list[dict[str, object]] = []
    for fichier in fichiers:
        slug = fichier.stem
        octets = fichier.read_bytes()  # binary, never a text read/write round-trip
        sha1 = hashlib.sha1(octets).hexdigest()
        destination = CACHE_DIR / f"{slug}.html"
        destination.write_bytes(octets)
        nom = noms_registre.get(slug)
        copies.append(
            {
                "slug": slug,
                "url": _url_pour(nom) if nom else None,
                "sha1": sha1,
                "octets": len(octets),
                "date": datetime.now(UTC).isoformat(),
                "origine": "import",
                "taille": len(octets),
                "nom_fichier": fichier.name,
            }
        )

    slugs_copies = {c["slug"] for c in copies}
    manquants = sorted(set(noms_registre) - slugs_copies)

    _ecrire_index(copies)
    _ecrire_rapport(rapport, source, copies, manquants)

    print(f"{len(copies)} fichier(s) copié(s) depuis {source.as_posix()}")
    if manquants:
        print(f"{len(manquants)} slug(s) du registre sans fichier : {', '.join(manquants)}")
    print(f"écrit {INDEX_PATH} et {rapport.as_posix()}")
    # Missing slugs are reported, never fatal — the shortcut is best-effort.
    return 0


def _ecrire_index(copies: list[dict[str, object]]) -> None:
    """Same shape as `recuperer_pages_classes.py` writes, origin column aside."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    lignes = [
        json.dumps(
            {
                "slug": c["slug"],
                "url": c["url"],
                "sha1": c["sha1"],
                "octets": c["octets"],
                "date": c["date"],
                "origine": c["origine"],
            },
            ensure_ascii=False,
        )
        for c in sorted(copies, key=lambda c: c["slug"])
    ]
    INDEX_PATH.write_text("\n".join(lignes) + ("\n" if lignes else ""), encoding="utf-8", newline="\n")


def _ecrire_rapport(
    rapport: Path, source: Path, copies: list[dict[str, object]], manquants: list[str]
) -> None:
    lignes = [
        "# Rapport — import du cache de pages de classe",
        "",
        f"Source : `{source.as_posix()}`",
        "",
        "## Totaux",
        "",
        f"- Fichiers copiés : **{len(copies)}**",
        f"- Slugs du registre sans fichier : **{len(manquants)}**",
        "",
        "## Copies",
        "",
        "| slug | fichier source | octets | sha1 |",
        "|---|---|---|---|",
    ]
    for c in sorted(copies, key=lambda c: c["slug"]):
        lignes.append(f"| {c['slug']} | {c['nom_fichier']} | {c['octets']:,} | {c['sha1']} |")

    lignes += ["", "## Slugs manquants", ""]
    if manquants:
        lignes.append(", ".join(f"`{s}`" for s in manquants))
    else:
        lignes.append("Aucun. Tous les slugs du registre ont un fichier.")

    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text("\n".join(lignes) + "\n", encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Importe des pages de classe déjà capturées dans cache/html_classes/."
    )
    parseur.add_argument(
        "--source",
        default=None,
        help="dossier contenant les .html déjà capturés, nommés <slug>.html (obligatoire, aucun défaut)",
    )
    parseur.add_argument(
        "--rapport",
        default=str(REPORT_PATH_DEFAUT),
        help=f"chemin du rapport (défaut : {REPORT_PATH_DEFAUT.relative_to(RACINE).as_posix()})",
    )
    args = parseur.parse_args(argv)

    if args.source is None:
        # A hard-coded fallback here would fail incomprehensibly the day the
        # folder it points at is deleted — this message is the whole point.
        motif = "--source est obligatoire, aucun défaut n'est codé en dur"
        print(f"ÉCHEC : {motif}", file=sys.stderr)
        print(
            "La voie normale est le réseau : npm run regles:recuperer",
            file=sys.stderr,
        )
        _ecrire_rapport_echec(Path(args.rapport), motif)
        return 1

    return executer(source=Path(args.source), rapport=Path(args.rapport))


if __name__ == "__main__":
    raise SystemExit(main())
