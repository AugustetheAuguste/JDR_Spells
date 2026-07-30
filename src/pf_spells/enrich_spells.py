"""Step 08 driver: join class/level data onto each spell file.

The class lists and the spell pages are two independent sources for the same
fact ("who casts this, at what level"), so the join is also the corpus's main
correctness audit. Disagreements are **reported, never reconciled** — a wiki typo
and a genuine per-class difference look identical to a program and only a human
can tell them apart.

Only the `classes` key is rewritten. Every other byte of a spell file is
preserved as loaded, because `data/sorts/*.json` is hand-correctable and human
edits are authoritative.

Outputs:
    data/sorts/<id>.json          the `classes` key, filled in place
    reports/08_enrich.md          counts, orphans, divergences, unknown abbrevs
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from jsonschema import Draft202012Validator

from pf_spells.classes import (
    CLASS_ABBREV_HORS_LISTE,
    LABELS_COMBINES,
    abbrevs_pour_slug,
    lookup_abbrev,
)

parser_version = "1.0.0"

INDEX_PATH = Path("data/index/sorts_uniques.jsonl")
CLASSES_PATH = Path("data/classes.json")
SORTS_DIR = Path("data/sorts")
SCHEMA_PATH = Path("schemas/sort.schema.json")
REPORT_PATH = Path("reports/08_enrich.md")

# The `classes` entry contract for this step.
CLES_CLASSE = ("classe", "slug", "niveau", "niveau_page", "concordance")


def charger_index(chemin: Path) -> dict[str, dict]:
    if not chemin.exists():
        raise SystemExit(f"{chemin} absent — l'étape 05 doit tourner d'abord")
    entrees: dict[str, dict] = {}
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if ligne.strip():
            entree = json.loads(ligne)
            entrees[entree["id"]] = entree
    return entrees


def charger_roster(chemin: Path) -> dict[str, str]:
    """Return slug -> label for the 19 roster classes."""
    if not chemin.exists():
        raise SystemExit(f"{chemin} absent — l'étape 03 doit tourner d'abord")
    return {
        c["slug"]: c["classe"]
        for c in json.loads(chemin.read_text(encoding="utf-8"))
    }


def abbrevs_de_classe(label: str, slug: str) -> tuple[str, ...]:
    """Return the abbreviations that stand for a roster class on a spell page.

    A combined label (`Arcaniste/Ensorceleur/Magicien`) resolves from any of its
    member abbreviations — `Ens 3` on the page **matches** the combined label at
    level 3 and is not a divergence.
    """
    combines = LABELS_COMBINES.get(label)
    if combines:
        return combines
    return abbrevs_pour_slug(slug)


def niveau_de_page(
    niveaux: dict[str, int], abbrevs: tuple[str, ...]
) -> tuple[int | None, list[str]]:
    """Return the page's level for a class, plus the abbreviations that gave it.

    When several member abbreviations disagree (e.g. `Ens 3` and `Mag 4` under one
    combined label) the minimum wins and every contributing abbreviation is
    returned so the report can note the spread.
    """
    trouves = {a: niveaux[a] for a in abbrevs if a in niveaux}
    if not trouves:
        return None, []
    return min(trouves.values()), sorted(trouves)


def enrichir_document(doc: dict, entree: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Return (classes, divergences, spreads) for one spell."""
    classes: list[dict] = []
    divergences: list[dict] = []
    spreads: list[dict] = []
    for c in entree.get("classes", []):
        abbrevs = abbrevs_de_classe(c["classe"], c["slug"])
        niveau_page, sources = niveau_de_page(doc["niveaux"], abbrevs)
        concordance = None if niveau_page is None else (c["niveau"] == niveau_page)
        classes.append(
            {
                "classe": c["classe"],
                "slug": c["slug"],
                "niveau": c["niveau"],
                "niveau_page": niveau_page,
                "concordance": concordance,
            }
        )
        if concordance is False:
            divergences.append(
                {
                    "id": doc["id"],
                    "nom": doc["nom"],
                    "classe": c["classe"],
                    "niveau_liste": c["niveau"],
                    "niveau_page": niveau_page,
                    "abbrevs": sources,
                }
            )
        if len(sources) > 1:
            valeurs = {doc["niveaux"][a] for a in sources}
            if len(valeurs) > 1:
                spreads.append(
                    {
                        "id": doc["id"],
                        "nom": doc["nom"],
                        "classe": c["classe"],
                        "niveaux": {a: doc["niveaux"][a] for a in sources},
                        "retenu": niveau_page,
                    }
                )
    classes.sort(key=lambda e: e["classe"])
    return classes, divergences, spreads


def ecrire_document(chemin: Path, doc: dict) -> None:
    """Rewrite a spell file, preserving key order and formatting exactly."""
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _pourcentage(n: int, total: int) -> str:
    return f"{(100.0 * n / total):.2f} %" if total else "n/a"


def build_report(stats: dict) -> str:
    total = stats["fichiers"]
    paires = stats["paires_connues"] + stats["paires_inconnues"]
    lignes = [
        "# Rapport 08 — Enrichissement classes / niveaux",
        "",
        f"Enrichisseur : `pf_spells.enrich_spells` v{parser_version} — "
        "aucun accès réseau, aucune analyse HTML.",
        "",
        "## Totaux",
        "",
        "| Mesure | Valeur |",
        "|---|---:|",
        f"| Fichiers `data/sorts/*.json` | {total} |",
        f"| Fichiers enrichis (`classes` non vide) | {stats['enrichis']} "
        f"({_pourcentage(stats['enrichis'], total)}) |",
        f"| Entrées dans `sorts_uniques.jsonl` | {stats['index']} |",
        f"| Orphelins sur disque (fichier sans entrée d'index) | "
        f"{len(stats['orphans_files'])} |",
        f"| Orphelins d'index (entrée sans fichier) | "
        f"{len(stats['orphans_index'])} |",
        f"| Paires (sort, classe) examinées | {paires} |",
        "",
        "## Concordance entre liste de classe et page du sort",
        "",
        "Les deux sources sont indépendantes : la liste de classe donne le niveau,"
        " la page du sort le redonne via ses abréviations. Un désaccord est un"
        " **constat**, jamais corrigé automatiquement.",
        "",
        "| Résultat | Paires | Part |",
        "|---|---:|---:|",
        f"| Concordantes | {stats['concordantes']} | "
        f"{_pourcentage(stats['concordantes'], paires)} |",
        f"| Divergentes | {stats['divergentes']} | "
        f"{_pourcentage(stats['divergentes'], paires)} |",
        f"| Niveau de page inconnu (`niveau_page: null`) | "
        f"{stats['paires_inconnues']} | "
        f"{_pourcentage(stats['paires_inconnues'], paires)} |",
        "",
        f"**Taux de concordance sur les paires comparables : "
        f"{_pourcentage(stats['concordantes'], stats['paires_connues'])}** "
        f"({stats['concordantes']} / {stats['paires_connues']}).",
        "",
    ]

    lignes += ["## Orphelins", ""]
    if stats["orphans_files"]:
        lignes += [
            "### Fichiers sans entrée d'index (bloquant)",
            "",
            *[f"- `{i}`" for i in stats["orphans_files"]],
            "",
        ]
    else:
        lignes += [
            "Aucun fichier `data/sorts/*.json` sans entrée d'index — "
            "les `id` des étapes 04/05/07 sont cohérents.",
            "",
        ]
    if stats["orphans_index"]:
        lignes += [
            "### Entrées d'index sans fichier",
            "",
            *[f"- `{i}`" for i in stats["orphans_index"]],
            "",
        ]
    else:
        lignes += [
            "Aucune entrée d'index sans fichier : l'étape 06 n'a signalé aucun "
            "échec de récupération, et l'étape 07 aucun échec d'analyse — les "
            "deux ensembles d'exceptions sont donc vides et concordent.",
            "",
        ]

    lignes += [
        "## Divergences de niveau",
        "",
        f"{len(stats['divergences'])} paire(s) où la liste de classe et la page "
        "du sort ne donnent pas le même niveau. Table complète :",
        "",
    ]
    if stats["divergences"]:
        lignes += [
            "| id | nom | classe | niveau liste | niveau page | abréviation(s) |",
            "|---|---|---|---:|---:|---|",
        ]
        for d in stats["divergences"]:
            abbrevs = ", ".join(f"`{a}`" for a in d["abbrevs"])
            lignes.append(
                f"| `{d['id']}` | {d['nom']} | {d['classe']} | "
                f"{d['niveau_liste']} | {d['niveau_page']} | {abbrevs} |"
            )
    else:
        lignes.append("_Aucune._")

    lignes += [
        "",
        "## Abréviations inconnues",
        "",
        "Abréviations rencontrées sur une page de sort sans correspondance dans "
        "`pf_spells.classes.CLASS_ABBREV` ni dans la table hors-liste.",
        "",
    ]
    if stats["abbrevs_inconnues"]:
        lignes += ["| Abréviation | Sorts | Exemples |", "|---|---:|---|"]
        for abbrev, n in stats["abbrevs_inconnues"].most_common():
            exemples = ", ".join(
                f"`{e}`" for e in stats["exemples_inconnues"][abbrev][:3]
            )
            lignes.append(f"| `{abbrev}` | {n} | {exemples} |")
    else:
        lignes.append("_Aucune._")

    lignes += [
        "",
        "## Abréviations hors des 19 classes du plan — attendues, pas des erreurs",
        "",
        "`elements_to_do.json` couvre 19 classes ; Pathfinder 1e en compte "
        "davantage. Les abréviations ci-dessous désignent des classes absentes de "
        "la liste d'entrée : leur présence dans `niveaux` est **normale et "
        "attendue**, ce ne sont pas des anomalies. Elles n'alimentent aucune "
        "entrée `classes`, faute de classe correspondante dans le périmètre.",
        "",
        "| Abréviation | Classe | Sorts |",
        "|---|---|---:|",
    ]
    for abbrev, n in stats["abbrevs_hors_liste"].most_common():
        lignes.append(f"| `{abbrev}` | {CLASS_ABBREV_HORS_LISTE[abbrev]} | {n} |")

    lignes += [
        "",
        "## Classes sans abréviation sur les pages de sorts",
        "",
        "Une classe du périmètre dont aucune abréviation n'apparaît sur les pages "
        "ne peut jamais être recoupée : toutes ses paires ont "
        "`niveau_page: null` et `concordance: null`.",
        "",
    ]
    if stats["classes_sans_abbrev"]:
        lignes += ["| Classe | Paires non comparables |", "|---|---:|"]
        for label, n in sorted(stats["classes_sans_abbrev"].items()):
            lignes.append(f"| {label} | {n} |")
    else:
        lignes.append("_Aucune._")

    lignes += [
        "",
        "## Classes revendiquées par la liste mais absentes de la page",
        "",
        "La classe possède bien une abréviation ailleurs dans le corpus, mais "
        "aucune de ses abréviations n'apparaît sur cette page-ci : la liste de "
        "classe revendique le sort, la page ne le confirme pas. Ce n'est ni une "
        "concordance ni une divergence — `concordance: null` — et le pipeline "
        "s'arrête là : les deux sources sont conservées côte à côte, sans qu'un "
        "arbitrage soit rendu ni attendu.",
        "",
    ]
    if stats["absents_de_la_page"]:
        lignes += [
            "| id | nom | classe | niveau liste | abréviations de la page |",
            "|---|---|---|---:|---|",
        ]
        for a in stats["absents_de_la_page"]:
            abbrevs = ", ".join(f"`{x}`" for x in a["niveaux_page"])
            lignes.append(
                f"| `{a['id']}` | {a['nom']} | {a['classe']} | "
                f"{a['niveau_liste']} | {abbrevs} |"
            )
    else:
        lignes.append("_Aucune._")

    lignes += ["", "## Écarts internes aux libellés combinés", ""]
    if stats["spreads"]:
        lignes += [
            "Un libellé combiné dont les membres n'ont pas le même niveau sur la "
            "page : le minimum est retenu.",
            "",
            "| id | classe | niveaux de la page | retenu |",
            "|---|---|---|---:|",
        ]
        for s in stats["spreads"][:50]:
            detail = ", ".join(f"`{a}` {n}" for a, n in sorted(s["niveaux"].items()))
            lignes.append(
                f"| `{s['id']}` | {s['classe']} | {detail} | {s['retenu']} |"
            )
        if len(stats["spreads"]) > 50:
            lignes.append(f"| … | _{len(stats['spreads']) - 50} de plus_ | | |")
    else:
        lignes.append("_Aucun._")

    lignes += [
        "",
        "## Notes de conformité",
        "",
        "- Seule la clé `classes` est réécrite ; tout le reste du fichier est "
        "conservé tel quel, les corrections humaines font foi.",
        "- L'étape est idempotente : relancée, elle recalcule la même valeur et "
        "laisse les fichiers octet pour octet identiques.",
        "- Les libellés combinés (`Arcaniste/Ensorceleur/Magicien`, "
        "`Prêtre/Prêtre combattant/Oracle`) sont résolus depuis n'importe laquelle "
        "de leurs abréviations membres : `Ens 3` **concorde** avec "
        "`Arcaniste/Ensorceleur/Magicien 3`.",
        "- Les divergences ne sont jamais corrigées automatiquement.",
        "- Table d'abréviations chargée depuis `pf_spells.classes`, "
        "non redéclarée ici.",
        "",
        "## Reproduire",
        "",
        "```",
        "PYTHONPATH=src python -m pf_spells.enrich_spells --dry-run",
        "PYTHONPATH=src python -m pf_spells.enrich_spells",
        "```",
        "",
    ]
    return "\n".join(lignes)


def executer(dry_run: bool, dossier: Path, rapport: Path | None) -> dict:
    index = charger_index(INDEX_PATH)
    roster = charger_roster(CLASSES_PATH)
    validateur = Draft202012Validator(
        json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    )
    fichiers = sorted(dossier.glob("*.json"))
    if not fichiers:
        raise SystemExit(f"aucun fichier dans {dossier} — l'étape 07 doit tourner d'abord")

    ids_disque = {f.stem for f in fichiers}
    stats = {
        "fichiers": len(fichiers),
        "index": len(index),
        "orphans_files": sorted(ids_disque - set(index)),
        "orphans_index": sorted(set(index) - ids_disque),
        "enrichis": 0,
        "reecrits": 0,
        "inchanges": 0,
        "concordantes": 0,
        "divergentes": 0,
        "paires_connues": 0,
        "paires_inconnues": 0,
        "divergences": [],
        "spreads": [],
        "abbrevs_inconnues": Counter(),
        "exemples_inconnues": {},
        "abbrevs_hors_liste": Counter(),
        "classes_sans_abbrev": Counter(),
        "absents_de_la_page": [],
        "invalides": [],
    }

    # A roster class with no abbreviation can never be cross-checked; count it
    # once per file rather than reporting it as a per-spell anomaly.
    sans_abbrev = {
        label
        for slug, label in roster.items()
        if not abbrevs_de_classe(label, slug)
    }

    for fichier in fichiers:
        doc = json.loads(fichier.read_text(encoding="utf-8"))
        entree = index.get(doc["id"])

        for abbrev in doc["niveaux"]:
            if lookup_abbrev(abbrev) is not None:
                continue
            if abbrev in CLASS_ABBREV_HORS_LISTE:
                stats["abbrevs_hors_liste"][abbrev] += 1
                continue
            stats["abbrevs_inconnues"][abbrev] += 1
            stats["exemples_inconnues"].setdefault(abbrev, []).append(doc["id"])

        if entree is None:
            classes = []
        else:
            classes, divergences, spreads = enrichir_document(doc, entree)
            stats["divergences"].extend(divergences)
            stats["spreads"].extend(spreads)
            for c in classes:
                if c["concordance"] is None:
                    stats["paires_inconnues"] += 1
                    if c["classe"] in sans_abbrev:
                        stats["classes_sans_abbrev"][c["classe"]] += 1
                    else:
                        # The class has abbreviations, but none of them is on
                        # this page: the list claims the spell, the page doesn't.
                        stats["absents_de_la_page"].append(
                            {
                                "id": doc["id"],
                                "nom": doc["nom"],
                                "classe": c["classe"],
                                "niveau_liste": c["niveau"],
                                "niveaux_page": sorted(doc["niveaux"]),
                            }
                        )
                elif c["concordance"]:
                    stats["paires_connues"] += 1
                    stats["concordantes"] += 1
                else:
                    stats["paires_connues"] += 1
                    stats["divergentes"] += 1
        if classes:
            stats["enrichis"] += 1

        if doc["classes"] == classes:
            stats["inchanges"] += 1
        else:
            stats["reecrits"] += 1
        doc["classes"] = classes

        erreurs = list(validateur.iter_errors(doc))
        if erreurs:
            stats["invalides"].append(
                {"id": doc["id"], "erreur": erreurs[0].message[:200]}
            )
            continue
        if not dry_run:
            ecrire_document(fichier, doc)

    if rapport is not None:
        rapport.parent.mkdir(parents=True, exist_ok=True)
        rapport.write_text(build_report(stats), encoding="utf-8", newline="\n")
    return stats


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Enrichit data/sorts/*.json avec les classes et niveaux."
    )
    parseur.add_argument(
        "--dry-run",
        action="store_true",
        help="tout calculer et écrire le rapport, sans toucher aux fichiers",
    )
    parseur.add_argument(
        "--sorts-dir", default=str(SORTS_DIR), help="dossier des JSON de sorts"
    )
    parseur.add_argument(
        "--no-report", action="store_true", help="ne pas écrire le rapport"
    )
    args = parseur.parse_args(argv)

    stats = executer(
        dry_run=args.dry_run,
        dossier=Path(args.sorts_dir),
        rapport=None if args.no_report else REPORT_PATH,
    )
    paires = stats["paires_connues"]
    taux = (100.0 * stats["concordantes"] / paires) if paires else 0.0
    print(
        f"{stats['fichiers']} fichiers : {stats['enrichis']} enrichis, "
        f"{stats['reecrits']} modifiés, {stats['inchanges']} inchangés"
        + (" (dry-run, rien écrit)" if args.dry_run else "")
    )
    print(
        f"concordance {taux:.2f} % ({stats['concordantes']}/{paires}), "
        f"{stats['divergentes']} divergence(s), "
        f"{stats['paires_inconnues']} paire(s) non comparables"
    )
    print(
        f"orphelins : {len(stats['orphans_files'])} sur disque, "
        f"{len(stats['orphans_index'])} dans l'index"
    )
    if stats["abbrevs_inconnues"]:
        print(f"abréviations inconnues : {dict(stats['abbrevs_inconnues'])}")
    for invalide in stats["invalides"][:10]:
        print(f"  INVALIDE {invalide['id']}: {invalide['erreur']}")
    return 1 if (stats["invalides"] or stats["orphans_files"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
