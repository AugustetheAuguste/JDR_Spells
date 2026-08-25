"""Build `web/public/data/alias.json` from the hand-edited alias table.

Players search in English constantly — "magic missile", not "projectile
magique". That is a *data* problem, not a language-processing one, so the answer
is a table someone wrote by hand and can be held to.

Nothing here invents an alias. The table (`web/data_sources/alias_manuel.tsv`)
is the only source, and this module's job is to refuse everything about it that
would mislead a reader:

  - an unknown `id` is a hard error, never a skipped line. A typo'd id silently
    dropped means the alias the editor believed they added simply does not
    exist, and no report would say so.
  - an alias that folds onto a real French spell name is rejected. French names
    have absolute priority: if "vol" is a spell, no alias may shadow it, because
    the shadowed spell is one a user typing French expects to find first.
  - an alias may legitimately point at several spells ("cure wounds" covers four
    tiers of soins), so the contract is always a list of ids, never a string.
    Step 05 shows both results rather than picking one.

Offline, idempotent, and it writes nothing under `data/`.
"""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from pf_spells.web_pliage import plier

VERSION_ALIAS = 1

CHEMIN_TABLE = "web/data_sources/alias_manuel.tsv"
CHEMIN_INDEX_WEB = "web/public/data/index.json"
CHEMIN_SORTIE = "web/public/data/alias.json"
CHEMIN_RAPPORT = "reports/04_alias.md"

# Low-level spells are the ones people look up most, so the coverage report is
# ordered by level: it is a work list, not a statistic.
NIVEAU_CIBLE_MAX = 4


class AliasError(Exception):
    """A refusal to write a table that would mislead a reader."""


def lancer_preflight(racine: Path) -> None:
    """Entry guard, loaded by path — `tools/` is deliberately not a package."""
    chemin = racine / "tools" / "preflight_corpus.py"
    if not chemin.is_file():
        raise AliasError(f"garde d'entrée introuvable : {chemin.as_posix()}")
    spec = importlib.util.spec_from_file_location("preflight_corpus", chemin)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise AliasError(f"garde d'entrée non chargeable : {chemin.as_posix()}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["preflight_corpus"] = module
    spec.loader.exec_module(module)
    rapport = module.preflight(racine)
    if rapport.bloquantes:
        details = "\n".join(f"  - {c.id} : {c.detail}" for c in rapport.bloquantes)
        raise AliasError(f"préflight bloquant, construction refusée :\n{details}")


def lire_index_web(racine: Path) -> list[dict[str, Any]]:
    """The web index built at step 02 — the authoritative id and name list."""
    chemin = racine / CHEMIN_INDEX_WEB
    if not chemin.is_file():
        raise AliasError(
            f"index web absent : {chemin.as_posix()} — lancer d'abord "
            "`python -m pf_spells.export_web`"
        )
    document = json.loads(chemin.read_text(encoding="utf-8"))
    sorts = document.get("sorts")
    if not isinstance(sorts, list) or not sorts:
        raise AliasError(f"index web sans sorts : {chemin.as_posix()}")
    return sorts


def lire_table(chemin: Path) -> list[tuple[int, str, str]]:
    """Parse the TSV into `(line number, id, alias)`, comments and blanks dropped.

    The line number is carried so every later refusal can name the line a human
    has to go and fix.
    """
    if not chemin.is_file():
        raise AliasError(f"table manuelle absente : {chemin.as_posix()}")
    paires: list[tuple[int, str, str]] = []
    texte = chemin.read_text(encoding="utf-8")
    if "�" in texte:
        raise AliasError(f"caractère de remplacement U+FFFD dans {chemin.as_posix()}")
    for numero, ligne in enumerate(texte.splitlines(), start=1):
        depouillee = ligne.strip()
        if not depouillee or depouillee.startswith("#"):
            continue
        champs = ligne.split("\t")
        if len(champs) != 2:
            raise AliasError(
                f"{chemin.as_posix()}:{numero} — attendu `id<TAB>alias`, "
                f"trouvé {len(champs)} champ(s) : {ligne!r}"
            )
        identifiant, alias = champs[0].strip(), champs[1].strip()
        if not identifiant or not alias:
            raise AliasError(f"{chemin.as_posix()}:{numero} — champ vide : {ligne!r}")
        paires.append((numero, identifiant, alias))
    if not paires:
        raise AliasError(f"table manuelle vide : {chemin.as_posix()}")
    return paires


def construire(
    racine: Path,
    *,
    avec_preflight: bool = True,
    genere_le: str | None = None,
    ecrire_fichiers: bool = True,
) -> dict[str, Any]:
    """Build `alias.json` and the coverage report; return the run's figures."""
    if avec_preflight:
        lancer_preflight(racine)

    sorts = lire_index_web(racine)
    noms = {sort["id"]: sort["n"] for sort in sorts}
    # Every folded French name, so an alias can never shadow one.
    noms_plies = {plier(sort["n"]): sort["id"] for sort in sorts}

    chemin_table = racine / CHEMIN_TABLE
    paires = lire_table(chemin_table)

    inconnus: list[str] = []
    collisions: list[dict[str, str]] = []
    doublons: list[str] = []
    alias: dict[str, list[str]] = defaultdict(list)
    couverts: set[str] = set()

    for numero, identifiant, brut in paires:
        if identifiant not in noms:
            # A hard error, collected rather than raised, so one run names every
            # bad line instead of making the editor fix them one at a time.
            inconnus.append(f"{CHEMIN_TABLE}:{numero} — id absent du corpus : {identifiant}")
            continue
        cle = plier(brut)
        if not cle:
            raise AliasError(f"{CHEMIN_TABLE}:{numero} — alias vide après pliage : {brut!r}")
        if cle in noms_plies:
            # Absolute priority to the French name: an alias that folds onto a
            # real spell would hide it from someone typing French.
            collisions.append(
                {
                    "ligne": f"{CHEMIN_TABLE}:{numero}",
                    "alias": brut,
                    "cle": cle,
                    "masquerait": noms_plies[cle],
                }
            )
            continue
        if identifiant in alias[cle]:
            doublons.append(f"{CHEMIN_TABLE}:{numero} — paire déjà présente : {identifiant} / {brut}")
            continue
        alias[cle].append(identifiant)
        couverts.add(identifiant)

    if inconnus:
        details = "\n".join(f"  - {ligne}" for ligne in inconnus)
        raise AliasError(
            "la table manuelle vise des sorts qui n'existent pas. Un id faux "
            "n'est pas une ligne à ignorer : l'alias que l'éditeur croit avoir "
            "ajouté n'existe simplement pas.\n" + details
        )

    # Sorted so the file is byte-identical from one run to the next.
    table_alias = {cle: sorted(ids) for cle, ids in sorted(alias.items())}

    horodatage = genere_le or dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    document = {
        "version": VERSION_ALIAS,
        "genere_le": horodatage,
        "couverture": {
            "n_sorts": len(noms),
            "n_avec_alias": len(couverts),
            "taux": round(len(couverts) / len(noms), 4),
        },
        "alias": table_alias,
    }

    if ecrire_fichiers:
        chemin_sortie = racine / CHEMIN_SORTIE
        chemin_sortie.parent.mkdir(parents=True, exist_ok=True)
        chemin_sortie.write_text(
            json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        rapport = rendre_rapport(sorts, couverts, collisions, doublons, document)
        chemin_rapport = racine / CHEMIN_RAPPORT
        chemin_rapport.parent.mkdir(parents=True, exist_ok=True)
        chemin_rapport.write_text(rapport, encoding="utf-8", newline="\n")

    return {
        "n_sorts": len(noms),
        "n_paires": len(paires),
        "n_alias": len(table_alias),
        "n_avec_alias": len(couverts),
        "n_collisions": len(collisions),
        "n_doublons": len(doublons),
        "n_ambigus": sum(1 for ids in table_alias.values() if len(ids) > 1),
        "chemin_sortie": (racine / CHEMIN_SORTIE).as_posix(),
        "chemin_rapport": (racine / CHEMIN_RAPPORT).as_posix(),
    }


def niveau_minimum(sort: dict[str, Any]) -> int | None:
    """The lowest level any class grants this spell at.

    `niv` is a class→level table, never a scalar (B4): a spell is level 2 *for
    the bard*. "The" level of a spell does not exist, so the minimum is what is
    used to prioritise the work list, and it is named as such.
    """
    niveaux = sort.get("niv") or {}
    valeurs = [valeur for valeur in niveaux.values() if isinstance(valeur, int)]
    return min(valeurs) if valeurs else None


def rendre_rapport(
    sorts: list[dict[str, Any]],
    couverts: set[str],
    collisions: list[dict[str, str]],
    doublons: list[str],
    document: dict[str, Any],
) -> str:
    """The coverage report, which is the work list for completing the table."""
    couverture = document["couverture"]
    cibles = [
        sort
        for sort in sorts
        if (niveau := niveau_minimum(sort)) is not None and niveau <= NIVEAU_CIBLE_MAX
    ]
    cibles_couvertes = [sort for sort in cibles if sort["id"] in couverts]
    manquants = sorted(
        (sort for sort in sorts if sort["id"] not in couverts),
        key=lambda sort: (niveau_minimum(sort) if niveau_minimum(sort) is not None else 99, sort["n"]),
    )

    lignes: list[str] = [
        "# Étape 04 — couverture de la table d'alias anglais → français",
        "",
        f"Généré le {document['genere_le']} par `python -m pf_spells.build_alias`.",
        "",
        "## Couverture",
        "",
        "| Mesure | Valeur |",
        "|---|---|",
        f"| Sorts du corpus | {couverture['n_sorts']} |",
        f"| Sorts avec au moins un alias | {couverture['n_avec_alias']} |",
        f"| Taux | {couverture['taux'] * 100:.1f} % |",
        f"| Clés d'alias distinctes | {len(document['alias'])} |",
        f"| Clés visant plusieurs sorts | "
        f"{sum(1 for ids in document['alias'].values() if len(ids) > 1)} |",
        f"| Cible v1 : sorts de niveau ≤ {NIVEAU_CIBLE_MAX} | "
        f"{len(cibles_couvertes)} / {len(cibles)} "
        f"({len(cibles_couvertes) / len(cibles) * 100:.1f} %) |",
        "",
        "« Niveau » est ici le **niveau minimum toutes classes confondues** : un",
        "sort est de niveau 2 *pour le barde*, et « le » niveau d'un sort n'existe",
        "pas (B4). Ce minimum ne sert qu'à trier la liste de travail.",
        "",
    ]

    if collisions:
        lignes += [
            "## Alias refusés — ils masqueraient un nom français",
            "",
            "La priorité au nom français est absolue : un alias qui se plie sur un",
            "nom réel du corpus est ignoré, jamais fusionné.",
            "",
            "| Ligne | Alias | Clé pliée | Masquerait |",
            "|---|---|---|---|",
        ]
        lignes += [
            f"| `{c['ligne']}` | {c['alias']} | `{c['cle']}` | `{c['masquerait']}` |"
            for c in collisions
        ]
        lignes.append("")
    else:
        lignes += ["## Alias refusés", "", "Aucun : aucune clé ne masque un nom français.", ""]

    if doublons:
        lignes += ["## Paires en double", ""] + [f"- `{d}`" for d in doublons] + [""]

    lignes += [
        "## Sorts sans alias — la liste de travail",
        "",
        f"{len(manquants)} sorts, triés par niveau minimum croissant : les sorts de",
        "bas niveau sont les plus cherchés, donc les premiers à couvrir. Ajouter une",
        "ligne à `web/data_sources/alias_manuel.tsv` et relancer suffit.",
        "",
        "**À la main, jamais par un modèle de langue.** Un alias faux envoie",
        "l'utilisateur sur le mauvais sort avec confiance ; un alias manquant le",
        "laisse simplement chercher en français, ce qui marche.",
        "",
        "| Niveau min. | Sort | id |",
        "|---|---|---|",
    ]
    lignes += [
        f"| {niveau_minimum(sort) if niveau_minimum(sort) is not None else '—'} "
        f"| {sort['n']} | `{sort['id']}` |"
        for sort in manquants
    ]
    return "\n".join(lignes) + "\n"


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Construit web/public/data/alias.json depuis la table manuelle. "
            "Hors ligne, idempotent, n'écrit rien sous data/."
        )
    )
    parseur.add_argument("--racine", default=".", help="racine du dépôt")
    parseur.add_argument(
        "--sans-preflight",
        action="store_true",
        help="sauter la garde d'entrée (tests sur corpus miniature uniquement)",
    )
    parseur.add_argument(
        "--genere-le",
        default=None,
        help="horodatage figé, pour une sortie reproductible à l'octet",
    )
    args = parseur.parse_args(argv)

    try:
        rapport = construire(
            Path(args.racine),
            avec_preflight=not args.sans_preflight,
            genere_le=args.genere_le,
        )
    except AliasError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    print(json.dumps(rapport, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
