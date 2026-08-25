"""Build the frozen 24-spell web fixture from the real corpus.

Run once, deliberately, then commit the result. The fixture is *frozen*: it does
not regenerate during tests, because a test that breaks when the wiki changes is
a bad test. This script exists so the selection is reproducible and auditable,
not so CI can re-run it.

Coverage is the whole point. Five wave-3 steps develop against this fixture in
parallel, so it has to contain every shape they must handle: level 0 and level 9,
a spell all three classes share, a spell exclusive to one, a name with an
apostrophe, a name with accents, a very long name, a spell with no saving throw,
and — the one case the real corpus cannot supply — a level disagreement.

The disagreement is SYNTHETIC and that is recorded here and in the fixture's own
README. All 8409 comparable class/page pairs in the committed corpus concord, so
`d: true` never occurs naturally. The UI still has to render the case, and a
fixture with no `d: true` row would let that code path ship untested.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]

# Three classes, chosen because they overlap enough to make the comparison view
# meaningful (33 shared spells) while each still has exclusives.
CLASSES_FIXTURE = ("barde", "druide", "occultiste")

# The synthetic disagreement is injected into this spell, on this class: the class
# list says one level, the spell page is rewritten to claim one level higher.
SORT_DESACCORD = "detection-de-la-magie"
CLASSE_DESACCORD = "barde"

CIBLE_NB_SORTS = 24


def _lire_jsonl(chemin: Path) -> list[dict[str, Any]]:
    with chemin.open(encoding="utf-8") as flux:
        return [json.loads(l) for l in flux if l.strip()]


def _ecrire_json(document: Any, chemin: Path) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _ecrire_jsonl(lignes: list[dict[str, Any]], chemin: Path) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    texte = "".join(
        json.dumps(l, ensure_ascii=False, separators=(",", ":")) + "\n" for l in lignes
    )
    chemin.write_text(texte, encoding="utf-8", newline="\n")


def choisir(index: list[dict[str, Any]]) -> list[str]:
    """Pick 24 ids covering every shape the views must render.

    Selection is deterministic: candidate pools are sorted and taken in order, so
    re-running this script on the same corpus picks the same spells.
    """
    trio = set(CLASSES_FIXTURE)

    def classes_de(entree: dict[str, Any]) -> set[str]:
        return {c["slug"] for c in entree["classes"]}

    # Only spells at least one fixture class grants: the rest are unreachable in a
    # fixture whose class roster is those three.
    pertinents = {
        e["id"]: e for e in index if classes_de(e) & trio
    }

    choisis: list[str] = []

    def prendre(ids: list[str], combien: int) -> None:
        for id_sort in sorted(ids):
            if len(choisis) >= CIBLE_NB_SORTS or combien <= 0:
                return
            if id_sort not in choisis:
                choisis.append(id_sort)
                combien -= 1

    # The mandatory shapes come first so a shrinking budget never drops one.
    prendre([SORT_DESACCORD], 1)
    # Shared by all three -> exercises the comparison view's intersection.
    prendre([i for i, e in pertinents.items() if trio <= classes_de(e)], 4)
    # Exclusive to exactly one fixture class -> exercises the exclusives sections.
    for classe in CLASSES_FIXTURE:
        prendre([i for i, e in pertinents.items() if classes_de(e) == {classe}], 2)
    # Level extremes: the filter's two boundaries.
    prendre([i for i, e in pertinents.items() if e["niveau_min"] == 0], 2)
    prendre([i for i, e in pertinents.items() if e["niveau_max"] == 9], 2)
    # An apostrophe in the name -> the folding contract's headline case.
    prendre(
        [i for i, e in pertinents.items() if "'" in e["nom"] or "’" in e["nom"]], 2
    )
    # The longest name available -> layout stress for the dense table.
    prendre(
        sorted(pertinents, key=lambda i: -len(pertinents[i]["nom"]))[:1], 1
    )
    # Fill the rest deterministically, spreading across schools so the school
    # pastille has more than one colour to render.
    par_ecole: dict[str, list[str]] = {}
    for id_sort, entree in pertinents.items():
        ecoles = entree.get("ecoles") or [None]
        par_ecole.setdefault(str(ecoles[0]), []).append(id_sort)
    for ecole in sorted(par_ecole):
        prendre(par_ecole[ecole], 1)
    prendre(list(pertinents), CIBLE_NB_SORTS)

    return choisis[:CIBLE_NB_SORTS]


def construire(racine: Path, sortie: Path) -> dict[str, Any]:
    index = _lire_jsonl(racine / "data" / "index" / "sorts_uniques.jsonl")
    roster = json.loads((racine / "data" / "classes.json").read_text(encoding="utf-8"))
    par_id = {e["id"]: e for e in index}

    ids = choisir(index)
    if len(ids) != CIBLE_NB_SORTS:
        raise SystemExit(f"sélection incomplète : {len(ids)} sorts, {CIBLE_NB_SORTS} visés")

    if sortie.exists():
        shutil.rmtree(sortie)

    # classes.json, restricted to the three fixture classes.
    roster_fixture = [c for c in roster if c["slug"] in CLASSES_FIXTURE]
    _ecrire_json(roster_fixture, sortie / "data" / "classes.json")

    # The spell files, copied verbatim except for the injected disagreement.
    desaccord_injecte: dict[str, Any] | None = None
    for id_sort in ids:
        source = racine / "data" / "sorts" / f"{id_sort}.json"
        sort = json.loads(source.read_text(encoding="utf-8"))
        # Drop class rows outside the fixture roster, so `niv` and the levels banner
        # stay consistent with the three-class world.
        sort["classes"] = [
            c for c in sort["classes"] if c["slug"] in CLASSES_FIXTURE
        ]
        if id_sort == SORT_DESACCORD:
            for classe in sort["classes"]:
                if classe["slug"] == CLASSE_DESACCORD:
                    # The page now claims one level higher than the class list.
                    classe["niveau_page"] = (classe["niveau"] or 0) + 1
                    classe["concordance"] = False
                    desaccord_injecte = dict(classe)
        _ecrire_json(sort, sortie / "data" / "sorts" / f"{id_sort}.json")
    if desaccord_injecte is None:
        raise SystemExit(
            f"désaccord non injecté : {SORT_DESACCORD} n'est pas accordé à "
            f"{CLASSE_DESACCORD}"
        )

    # The class lists, restricted to the selected spells.
    for classe in CLASSES_FIXTURE:
        source = racine / "data" / "listes_classes" / f"{classe}.jsonl"
        lignes = [l for l in _lire_jsonl(source) if l["id"] in ids]
        _ecrire_jsonl(lignes, sortie / "data" / "listes_classes" / f"{classe}.jsonl")

    # The unique-spell index, restricted and with class rows trimmed.
    entrees = []
    for id_sort in sorted(ids):
        entree = dict(par_id[id_sort])
        entree["classes"] = [
            c for c in entree["classes"] if c["slug"] in CLASSES_FIXTURE
        ]
        entree["nb_classes"] = len(entree["classes"])
        niveaux = [c["niveau"] for c in entree["classes"] if c["niveau"] is not None]
        entree["niveau_min"] = min(niveaux) if niveaux else None
        entree["niveau_max"] = max(niveaux) if niveaux else None
        entree["partage"] = len(entree["classes"]) > 1
        entrees.append(entree)
    _ecrire_jsonl(entrees, sortie / "data" / "index" / "sorts_uniques.jsonl")

    # The sharing maps, recomputed over the fixture rather than copied: a stale map
    # would make the comparison view's cross-check meaningless.
    doublons = {
        e["id"]: sorted(c["slug"] for c in e["classes"])
        for e in entrees
        if len(e["classes"]) > 1
    }
    _ecrire_json(doublons, sortie / "data" / "index" / "carte_doublons.json")
    exclusifs: dict[str, list[str]] = {c: [] for c in sorted(CLASSES_FIXTURE)}
    for entree in entrees:
        if len(entree["classes"]) == 1:
            exclusifs[entree["classes"][0]["slug"]].append(entree["id"])
    _ecrire_json(
        {c: sorted(v) for c, v in exclusifs.items()},
        sortie / "data" / "index" / "sorts_exclusifs.json",
    )

    # The enrichment layer, for the spells that have one. Partial on purpose: the
    # fiche must render a spell with no enrichment without an empty section.
    nb_enr = 0
    for id_sort in ids[: len(ids) - 4]:
        source = racine / "data" / "enrichissements" / f"{id_sort}.json"
        if source.is_file():
            _ecrire_json(
                json.loads(source.read_text(encoding="utf-8")),
                sortie / "data" / "enrichissements" / f"{id_sort}.json",
            )
            nb_enr += 1

    return {
        "nb_sorts": len(ids),
        "ids": ids,
        "classes": list(CLASSES_FIXTURE),
        "nb_enrichissements": nb_enr,
        "desaccord": desaccord_injecte,
    }


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--racine", default=str(REPO_ROOT))
    parseur.add_argument(
        "--sortie", default=str(REPO_ROOT / "tests" / "fixtures" / "web_corpus")
    )
    args = parseur.parse_args(argv)
    rapport = construire(Path(args.racine), Path(args.sortie))
    json.dump(rapport, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
