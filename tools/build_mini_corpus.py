"""ONE-SHOT generator of tests/fixtures/mini_corpus/ — DO NOT RE-RUN.

=============================================================================
!!  LA FIXTURE EST GELÉE.  THIS SCRIPT IS *NOT* PART OF ANY PIPELINE.       !!
!!  It is not imported by any test, it is never invoked by pytest, and it    !!
!!  must not be wired into `python -m pf_spells.*`. It exists for a single   !!
!!  reason: to *record the provenance* of the 12-spell selection so a human !!
!!  can read how the fixture was chosen. Re-running it would silently       !!
!!  re-derive the fixture from a corpus that may have moved, which is        !!
!!  exactly the failure mode tests/fixtures/mini_corpus/README.md forbids.   !!
=============================================================================

Why a script at all, rather than a hand-written list: the selection must be
explicable. The 12 ids are the output of a deterministic greedy set-cover over
the criteria below, iterated over ids in sorted order with no rng, so the choice
is reproducible and arguable rather than arbitrary.

The criteria, recorded here because the implementation plan that first stated
them has been removed now that the pipeline is finished — 12 spell files chosen
to cover: level 0 and level 9, a school from each extreme, a spell with damage,
a spell without, an area spell, a personal spell, a long spell (summoning
table), a spell with a known list/page disagreement, and names containing an
apostrophe, an accent, and a hyphen. Plus `data/index/` and `classes.json`
reduced to stay consistent with those 12.

Usage (historical record only):
    PYTHONPATH=src python tools/build_mini_corpus.py --confirmer-degel
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
CIBLE = RACINE / "tests/fixtures/mini_corpus"

# Longueur au-delà de laquelle une description compte comme « longue » : le
# corpus plafonne à 5911 signes, donc 4000 isole bien le haut de la queue.
SEUIL_LONG = 4000

CRITERES: dict[str, str] = {
    "a": "niveau_min 0",
    "b": "niveau 9",
    "c_abjuration": "école Abjuration",
    "c_transmutation": "école Transmutation",
    "d": "sort à dégâts (dés dans la description)",
    "e": "sort sans dégâts",
    "f": "sort de zone",
    "g": "portée personnelle",
    "h": "description longue avec tableau",
    "i": "désaccord liste/page (concordance non true)",
    "j": "apostrophe dans le nom",
    "k": "accent dans le nom",
    "l": "trait d'union dans le nom",
    "m": "bloc mythique non nul",
    "n": "mythique nul",
}

_DES = re.compile(r"\d\s*d\s*\d")
_ZONE = re.compile(r"zone|émanation|sphère|rayon|cône|propagation", re.IGNORECASE)
_ACCENT = re.compile(r"[^\x00-\x7f]")


def criteres_du_sort(sort: dict, entree: dict) -> set[str]:
    """Which criteria a single spell satisfies. Pure function of the data."""
    couverts: set[str] = set()
    if entree["niveau_min"] == 0:
        couverts.add("a")
    if entree["niveau_max"] == 9:
        couverts.add("b")
    ecole = sort["ecole"] or ""
    if ecole.startswith("Abjuration"):
        couverts.add("c_abjuration")
    if ecole.startswith("Transmutation"):
        couverts.add("c_transmutation")
    description = sort["description"] or ""
    couverts.add("d" if _DES.search(description) else "e")
    if _ZONE.search(f"{sort['cible'] or ''} {sort['portee'] or ''}"):
        couverts.add("f")
    if "personnel" in (sort["portee"] or "").lower():
        couverts.add("g")
    if len(description) >= SEUIL_LONG and "<table" in (sort["description_html"] or ""):
        couverts.add("h")
    if any(c.get("concordance") is not True for c in sort["classes"]):
        couverts.add("i")
    nom = sort["nom"]
    if "'" in nom or "’" in nom:
        couverts.add("j")
    if _ACCENT.search(nom):
        couverts.add("k")
    if "-" in nom:
        couverts.add("l")
    couverts.add("n" if sort["mythique"] is None else "m")
    return couverts


def selectionner(sorts: dict[str, dict], index: dict[str, dict]) -> list[str]:
    """Greedy set-cover, ties broken by sorted id — no rng, fully reproducible."""
    couverture = {i: criteres_du_sort(sorts[i], index[i]) for i in sorted(sorts)}
    restants = set(CRITERES)
    choisis: list[str] = []
    while restants:
        meilleur = max(
            sorted(couverture),
            key=lambda i: (len(couverture[i] & restants), -len(couverture[i])),
        )
        if not couverture[meilleur] & restants:  # pragma: no cover - unreachable
            raise SystemExit(f"critères non couvrables : {sorted(restants)}")
        choisis.append(meilleur)
        restants -= couverture[meilleur]
        del couverture[meilleur]
    # Compléter à 12 en privilégiant les sorts qui couvrent le plus de critères,
    # puis l'ordre alphabétique : encore une fois, aucune part de hasard.
    for identifiant in sorted(couverture, key=lambda i: (-len(couverture[i]), i)):
        if len(choisis) >= 12:
            break
        choisis.append(identifiant)
    return sorted(choisis[:12])


def ecrire_json(chemin: Path, valeur: object) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(valeur, f, ensure_ascii=False, indent=2)
        f.write("\n")


def ecrire_jsonl(chemin: Path, lignes: list[dict]) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        for ligne in lignes:
            f.write(json.dumps(ligne, ensure_ascii=False, separators=(",", ":")) + "\n")


def main(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument(
        "--confirmer-degel",
        action="store_true",
        help="obligatoire : atteste que l'on dégèle sciemment la fixture",
    )
    args = analyseur.parse_args(argv)
    if not args.confirmer_degel:
        print(
            "REFUS : la fixture est gelée. Voir "
            "tests/fixtures/mini_corpus/README.md avant toute régénération.",
            file=sys.stderr,
        )
        return 2

    index = {
        e["id"]: e
        for e in (
            json.loads(l)
            for l in (RACINE / "data/index/sorts_uniques.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
        )
    }
    sorts = {
        p.stem: json.loads(p.read_text(encoding="utf-8"))
        for p in sorted((RACINE / "data/sorts").glob("*.json"))
    }
    choisis = selectionner(sorts, index)

    # 1. Les fichiers de sorts : copie octet pour octet, jamais une réécriture.
    cible_sorts = CIBLE / "data/sorts"
    cible_sorts.mkdir(parents=True, exist_ok=True)
    for identifiant in choisis:
        shutil.copyfile(
            RACINE / f"data/sorts/{identifiant}.json",
            cible_sorts / f"{identifiant}.json",
        )

    # 2. L'index réduit, dans l'ordre du vrai fichier.
    entrees = [index[i] for i in choisis]
    ecrire_jsonl(CIBLE / "data/index/sorts_uniques.jsonl", entrees)

    # 3. classes.json réduit aux seules classes citées par les 12.
    libelles = {c["classe"] for e in entrees for c in e["classes"]}
    referentiel = json.loads(
        (RACINE / "data/classes.json").read_text(encoding="utf-8")
    )
    reduit = [c for c in referentiel if c["classe"] in libelles]
    ecrire_json(CIBLE / "data/classes.json", reduit)

    # 4. carte_doublons.json, recomptée sur les 12 — jamais recopiée.
    source_carte = json.loads(
        (RACINE / "data/index/carte_doublons.json").read_text(encoding="utf-8")
    )
    partages = {
        e["id"]: {
            "nom": e["nom"],
            "classes": {c["classe"]: c["niveau"] for c in e["classes"]},
        }
        for e in entrees
        if e["partage"]
    }
    divergents = [
        d for d in source_carte["niveaux_divergents"] if d["id"] in set(choisis)
    ]
    ecrire_json(
        CIBLE / "data/index/carte_doublons.json",
        {
            "genere_le": source_carte["genere_le"],
            "nb_sorts_uniques": len(entrees),
            "nb_sorts_partages": len(partages),
            "distribution_partage": {
                str(k): v
                for k, v in sorted(Counter(e["nb_classes"] for e in entrees).items())
            },
            "top_partages": [
                {"id": e["id"], "nom": e["nom"], "nb_classes": e["nb_classes"]}
                for e in sorted(
                    entrees, key=lambda e: (-e["nb_classes"], e["id"])
                )[:10]
            ],
            "sorts_partages": {k: partages[k] for k in sorted(partages)},
            "niveaux_divergents": divergents,
        },
    )

    # 5. sorts_exclusifs.json, recompté lui aussi.
    par_slug = {c["classe"]: c["slug"] for c in reduit}
    par_classe: dict[str, dict] = {}
    for e in entrees:
        if e["partage"]:
            continue
        (libelle,) = {c["classe"] for c in e["classes"]}
        seau = par_classe.setdefault(
            libelle, {"slug": par_slug[libelle], "nb": 0, "sorts": []}
        )
        seau["sorts"].append(
            {"id": e["id"], "nom": e["nom"], "niveau": e["niveau_min"]}
        )
    for seau in par_classe.values():
        seau["sorts"].sort(key=lambda s: s["id"])
        seau["nb"] = len(seau["sorts"])
    ecrire_json(
        CIBLE / "data/index/sorts_exclusifs.json",
        {
            "genere_le": source_carte["genere_le"],
            "par_classe": {k: par_classe[k] for k in sorted(par_classe)},
            "totaux": {
                libelle: par_classe.get(libelle, {"nb": 0})["nb"]
                for libelle in sorted(libelles)
            },
        },
    )

    for identifiant in choisis:
        couverts = criteres_du_sort(sorts[identifiant], index[identifiant])
        print(f"{identifiant}\t{','.join(sorted(couverts))}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
