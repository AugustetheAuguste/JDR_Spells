"""Render `README.md`, splicing in real files rather than retyped copies.

Why a renderer and not a hand-edited document: three of the README's blocks must
match bytes on disk exactly — the worked spell example, the class-list line, and
the pipeline command block shared with `CLAUDE.md`. `tests/test_docs.py` asserts
that equality, on the grounds that an example retyped from memory is worse than no
example because it teaches shapes the corpus does not have. Splicing makes the
equality structural instead of a thing someone has to remember.

Figures come from the corpus on disk for the same reason, never from the reports.

Run after any change to the spliced sources:
    PYTHONPATH=src python tools/render_readme.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]

# The canonical pipeline block lives in CLAUDE.md; the README quotes it verbatim so
# the two can never drift into naming different modules.
_BLOC_PIPELINE = re.compile(r"```\nexport PYTHONPATH=src\n.*?```", re.DOTALL)


def _pipeline() -> str:
    texte = (RACINE / "CLAUDE.md").read_text(encoding="utf-8")
    trouve = _BLOC_PIPELINE.search(texte)
    if trouve is None:
        raise SystemExit("ABANDON : bloc de pipeline introuvable dans CLAUDE.md")
    return trouve.group(0)


def _totaux() -> dict[str, int]:
    """Recount from disk. The manifest is a second opinion, not the source here."""
    sorts = sorted((RACINE / "data" / "sorts").glob("*.json"))
    classes = json.loads((RACINE / "data" / "classes.json").read_text(encoding="utf-8"))
    listes = sum(
        1
        for f in (RACINE / "data" / "listes_classes").glob("*.jsonl")
        for ligne in f.read_text(encoding="utf-8").splitlines()
        if ligne.strip()
    )
    enrichis = sorted((RACINE / "data" / "enrichissements").glob("*.json"))
    vues = [
        p
        for p in (RACINE / "data" / "vues" / "sorts_enrichis").glob("*.json")
        if p.name != "_rapport.json"
    ]
    # Distinct pages, not journal lines: `cache/index.jsonl` is append-only, so a
    # re-fetch of the same URL adds a line without adding a page. Counting lines
    # gives 2107 where the manifest says 2089, and the manifest is right.
    cache = len(
        {
            json.loads(ligne)["url"]
            for ligne in (RACINE / "cache" / "index.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
            if ligne.strip()
        }
    )
    mythiques = 0
    variantes = 0
    for chemin in sorts:
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        mythiques += 1 if doc.get("mythique") else 0
        variantes += 1 if doc.get("variantes") else 0
    return {
        "classes": len(classes),
        "entrees": listes,
        "sorts": len(sorts),
        "cache": cache,
        "mythiques": mythiques,
        "variantes": variantes,
        "enrichis": len(enrichis),
        "vues": len(vues),
        "quarantaine": len(sorted((RACINE / "build_artifacts" / "quarantaine").glob("*.json"))),
    }


def rendre() -> str:
    exemple_sort = (RACINE / "data" / "sorts" / "armes-contre-le-mal.json").read_text(
        encoding="utf-8"
    )
    exemple_liste = (
        (RACINE / "data" / "listes_classes" / "paladin.jsonl")
        .read_text(encoding="utf-8")
        .splitlines(keepends=True)[0]
    )
    rapport_vues = json.loads(
        (RACINE / "data" / "vues" / "sorts_enrichis" / "_rapport.json").read_text(
            encoding="utf-8"
        )
    )
    validation = json.loads(
        (
            RACINE / "build_artifacts" / "rapports" / "validation_enrichissement.json"
        ).read_text(encoding="utf-8")
    )
    t = _totaux()
    gabarit = (RACINE / "tools" / "readme_gabarit.md").read_text(encoding="utf-8")
    texte = gabarit.format(
        exemple_sort=exemple_sort,
        exemple_liste=exemple_liste,
        pipeline=_pipeline(),
        taux_ambiguite=f"{validation['taux_notes_ambiguite'] * 100:.1f}".replace(
            ".", ","
        ),
        seuil_ambiguite=f"{validation['seuil_ambiguite'] * 100:.0f}",
        notes_ambiguite=validation["notes_ambiguite"],
        rejets=validation["echecs"],
        conformes=validation["ok"],
        sans_enrichissement=rapport_vues["sans_enrichissement"],
        **t,
    )
    if "\r" in texte:
        raise SystemExit("ABANDON : CR dans le rendu")
    return texte


def main() -> int:
    texte = rendre()
    cible = RACINE / "README.md"
    # newline='' keeps LF on win32, per CLAUDE.md § 3.
    with cible.open("w", encoding="utf-8", newline="") as flux:
        flux.write(texte)
    print(f"écrit : {cible.name} ({len(texte)} caractères)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
