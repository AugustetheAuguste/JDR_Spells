"""Collapse the per-class spell lists into the unique-spell index.

Consumes `data/classes.json` plus `data/listes_classes/*.jsonl` and writes three
artifacts under `data/index/` and one report under `reports/`. No network, no
HTML parsing: this module reads JSONL only.

Determinism is a contract. Every collection is sorted before it is written, so
re-running produces byte-identical files apart from the `genere_le` timestamp,
which is confined to the two `.json` files and never appears in the JSONL.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

builder_version = "1.0.0"

DEFAULT_CLASSES = "data/classes.json"
DEFAULT_LISTS = "data/listes_classes"
DEFAULT_OUT = "data/index"
DEFAULT_REPORT = "reports/05_index.md"

TOP_N = 25

# Canonical key order for one `sorts_uniques.jsonl` line, per the
# pf-corpus-conventions Skill (French, snake_case, unaccented keys).
KEY_ORDER = (
    "id",
    "nom",
    "url",
    "classes",
    "nb_classes",
    "niveau_min",
    "niveau_max",
    "partage",
    "ecoles",
    "sources",
)


class IntegrityError(RuntimeError):
    """A blocking violation of an invariant step 04 is required to guarantee."""


def load_roster(chemin: str | Path = DEFAULT_CLASSES) -> dict[str, str]:
    """Return the canonical class label -> slug mapping from `data/classes.json`."""
    roster = json.loads(Path(chemin).read_text(encoding="utf-8"))
    labels: dict[str, str] = {}
    for entree in roster:
        label = entree["classe"]
        if label in labels:
            raise IntegrityError(f"libellé de classe en doublon dans le roster : {label!r}")
        labels[label] = entree["slug"]
    return labels


def load_entries(repertoire: str | Path = DEFAULT_LISTS) -> list[dict]:
    """Read every JSONL line from every class list file, in sorted file order."""
    entrees: list[dict] = []
    for chemin in sorted(Path(repertoire).glob("*.jsonl")):
        with chemin.open(encoding="utf-8") as f:
            for numero, ligne in enumerate(f, start=1):
                ligne = ligne.strip()
                if not ligne:
                    continue
                try:
                    entree = json.loads(ligne)
                except json.JSONDecodeError as exc:  # pragma: no cover - corrupt input
                    raise IntegrityError(f"{chemin}:{numero} JSON invalide : {exc}") from exc
                entree["_fichier"] = chemin.name
                entrees.append(entree)
    return entrees


def check_bijection(entrees: list[dict]) -> None:
    """Assert the name<->id bijection step 04 guarantees. Blocking on failure."""
    par_nom: dict[str, set[str]] = defaultdict(set)
    par_id: dict[str, set[str]] = defaultdict(set)
    for e in entrees:
        par_nom[e["nom"]].add(e["id"])
        par_id[e["id"]].add(e["nom"])
    noms_casses = {n: sorted(v) for n, v in par_nom.items() if len(v) > 1}
    ids_casses = {i: sorted(v) for i, v in par_id.items() if len(v) > 1}
    if noms_casses or ids_casses:
        raise IntegrityError(
            "bijection nom<->id rompue (bug de l'étape 04) — "
            f"noms à plusieurs id : {noms_casses} ; "
            f"id à plusieurs noms : {ids_casses}"
        )


def check_roster(entrees: list[dict], labels: dict[str, str]) -> None:
    """Assert every `classe` value is one of the roster labels. Blocking."""
    inconnues = sorted({e["classe"] for e in entrees} - set(labels))
    if inconnues:
        raise IntegrityError(f"classes absentes de {DEFAULT_CLASSES} : {inconnues}")


def aggregate(entrees: list[dict], labels: dict[str, str]) -> tuple[dict[str, dict], dict]:
    """Fold the entries into the unique-spell map plus the anomaly record."""
    uniques: dict[str, dict] = {}
    urls_vues: dict[str, Counter] = defaultdict(Counter)
    doublons_intra: list[dict] = []
    ecoles_par_id: dict[str, set[str]] = defaultdict(set)
    sources_par_id: dict[str, set[str]] = defaultdict(set)

    for e in entrees:
        sid = e["id"]
        u = uniques.setdefault(sid, {"id": sid, "nom": e["nom"], "classes": {}})
        urls_vues[sid][e["url"]] += 1

        classe = e["classe"]
        niveau = e["niveau"]
        deja = u["classes"].get(classe)
        if deja is None:
            u["classes"][classe] = niveau
        elif deja != niveau:
            doublons_intra.append(
                {
                    "id": sid,
                    "nom": e["nom"],
                    "classe": classe,
                    "niveaux": sorted({deja, niveau}),
                    "conserve": min(deja, niveau),
                    "fichier": e.get("_fichier"),
                }
            )
            u["classes"][classe] = min(deja, niveau)
        # `deja == niveau` is a plain repeat of an identical entry: nothing to do.

        if e.get("ecole"):
            ecoles_par_id[sid].add(e["ecole"])
        sources_par_id[sid].update(e.get("sources") or [])

    desaccords_url: list[dict] = []
    for sid, compteur in urls_vues.items():
        if len(compteur) > 1:
            # Majority wins, alphabetical tie-break: deterministic, and the
            # divergence is reported rather than silently resolved.
            retenue = sorted(compteur.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            desaccords_url.append(
                {
                    "id": sid,
                    "nom": uniques[sid]["nom"],
                    "urls": dict(sorted(compteur.items())),
                    "conserve": retenue,
                }
            )
        else:
            retenue = next(iter(compteur))
        uniques[sid]["url"] = retenue

    for sid, u in uniques.items():
        niveaux = sorted(u["classes"].values())
        classes = [
            {"classe": label, "slug": labels[label], "niveau": u["classes"][label]}
            for label in sorted(u["classes"])
        ]
        u["classes"] = classes
        u["nb_classes"] = len(classes)
        u["niveau_min"] = niveaux[0]
        u["niveau_max"] = niveaux[-1]
        u["partage"] = len(classes) > 1
        u["ecoles"] = sorted(ecoles_par_id[sid])
        u["sources"] = sorted(sources_par_id[sid])

    anomalies = {
        "doublons_intra_classe": sorted(
            doublons_intra, key=lambda d: (d["id"], d["classe"])
        ),
        "desaccords_url": sorted(desaccords_url, key=lambda d: d["id"]),
    }
    return uniques, anomalies


def order_keys(u: dict) -> dict:
    return {cle: u[cle] for cle in KEY_ORDER}


def build_carte_doublons(uniques: dict[str, dict], genere_le: str) -> dict:
    partages = {sid: u for sid, u in uniques.items() if u["partage"]}
    distribution = Counter(u["nb_classes"] for u in uniques.values())
    top = sorted(
        partages.values(), key=lambda u: (-u["nb_classes"], u["id"])
    )[:TOP_N]
    divergents = [
        u for u in partages.values() if u["niveau_min"] != u["niveau_max"]
    ]
    return {
        "genere_le": genere_le,
        "nb_sorts_uniques": len(uniques),
        "nb_sorts_partages": len(partages),
        "distribution_partage": {
            str(n): distribution[n] for n in sorted(distribution)
        },
        "top_partages": [
            {"id": u["id"], "nom": u["nom"], "nb_classes": u["nb_classes"]} for u in top
        ],
        "sorts_partages": {
            sid: {
                "nom": u["nom"],
                "classes": {c["classe"]: c["niveau"] for c in u["classes"]},
            }
            for sid, u in sorted(partages.items())
        },
        "niveaux_divergents": [
            {
                "id": u["id"],
                "nom": u["nom"],
                "classes": {c["classe"]: c["niveau"] for c in u["classes"]},
            }
            for u in sorted(divergents, key=lambda u: u["id"])
        ],
    }


def build_sorts_exclusifs(
    uniques: dict[str, dict], labels: dict[str, str], genere_le: str
) -> dict:
    # Every roster class is a key, even with zero exclusive spells.
    par_classe: dict[str, dict] = {
        label: {"slug": slug, "nb": 0, "sorts": []} for label, slug in sorted(labels.items())
    }
    for u in uniques.values():
        if u["nb_classes"] != 1:
            continue
        seule = u["classes"][0]
        par_classe[seule["classe"]]["sorts"].append(
            {"id": u["id"], "nom": u["nom"], "niveau": seule["niveau"]}
        )
    for bloc in par_classe.values():
        bloc["sorts"].sort(key=lambda s: s["id"])
        bloc["nb"] = len(bloc["sorts"])
    return {
        "genere_le": genere_le,
        "par_classe": par_classe,
        "totaux": {label: bloc["nb"] for label, bloc in par_classe.items()},
    }


def write_jsonl(uniques: dict[str, dict], chemin: Path) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        for sid in sorted(uniques):
            f.write(
                json.dumps(
                    order_keys(uniques[sid]), ensure_ascii=False, separators=(",", ":")
                )
            )
            f.write("\n")


def write_json(donnees: dict, chemin: Path) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(
        json.dumps(donnees, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def histogramme(distribution: dict[str, int]) -> list[str]:
    if not distribution:
        return []
    maxi = max(distribution.values())
    lignes = ["| nb de classes | nb de sorts | |", "|---|---|---|"]
    for n, nb in sorted(distribution.items(), key=lambda kv: int(kv[0])):
        barre = "#" * max(1, round(nb * 40 / maxi))
        lignes.append(f"| {n} | {nb} | `{barre}` |")
    return lignes


def build_report(
    entrees: list[dict],
    uniques: dict[str, dict],
    carte: dict,
    exclusifs: dict,
    labels: dict[str, str],
    anomalies: dict,
) -> str:
    total_par_classe = Counter(e["classe"] for e in entrees)
    nb_exclusifs = sum(exclusifs["totaux"].values())
    ratio = len(uniques) / len(entrees) if entrees else 0.0

    lignes = [
        "# Rapport étape 05 — index des sorts uniques",
        "",
        f"- Généré le : `{carte['genere_le']}`",
        f"- Version du constructeur : `{builder_version}`",
        "",
        "## Totaux",
        "",
        "| Métrique | Valeur |",
        "|---|---|",
        f"| Entrées de liste lues (19 fichiers) | {len(entrees)} |",
        f"| Sorts uniques (`id` distincts) | {len(uniques)} |",
        f"| Ratio uniques / entrées | {ratio:.3f} |",
        f"| Sorts partagés (`nb_classes` > 1) | {carte['nb_sorts_partages']} |",
        f"| Sorts exclusifs (`nb_classes` == 1) | {nb_exclusifs} |",
        f"| Sorts à niveaux divergents | {len(carte['niveaux_divergents'])} |",
        "",
        "Contrôle de partition : "
        f"{carte['nb_sorts_partages']} + {nb_exclusifs} = "
        f"{carte['nb_sorts_partages'] + nb_exclusifs} "
        f"(attendu {len(uniques)}) — "
        f"{'OK' if carte['nb_sorts_partages'] + nb_exclusifs == len(uniques) else 'ÉCHEC'}",
        "",
        "## Par classe : total contre exclusifs",
        "",
        "| Classe | slug | entrées de liste | sorts exclusifs | part exclusive |",
        "|---|---|---|---|---|",
    ]
    for label in sorted(labels):
        total = total_par_classe.get(label, 0)
        excl = exclusifs["totaux"][label]
        part = f"{excl / total:.1%}" if total else "—"
        lignes.append(f"| {label} | `{labels[label]}` | {total} | {excl} | {part} |")

    lignes += ["", "## Distribution du partage", ""]
    lignes += histogramme(carte["distribution_partage"])
    lignes += [
        "",
        f"## Les {len(carte['top_partages'])} sorts les plus partagés",
        "",
        "| # | sort | nb de classes |",
        "|---|---|---|",
    ]
    for rang, s in enumerate(carte["top_partages"], start=1):
        lignes.append(f"| {rang} | {s['nom']} (`{s['id']}`) | {s['nb_classes']} |")

    lignes += ["", "## Anomalies", ""]
    intra = anomalies["doublons_intra_classe"]
    lignes.append(f"### Doublons intra-classe : {len(intra)}")
    lignes.append("")
    if intra:
        lignes += ["| sort | classe | niveaux vus | niveau conservé |", "|---|---|---|---|"]
        for d in intra:
            vus = ", ".join(str(n) for n in d["niveaux"])
            lignes.append(f"| {d['nom']} (`{d['id']}`) | {d['classe']} | {vus} | {d['conserve']} |")
    else:
        lignes.append(
            "Aucun : aucune classe ne liste le même sort à deux niveaux différents."
        )

    desaccords = anomalies["desaccords_url"]
    lignes += ["", f"### Désaccords d'URL : {len(desaccords)}", ""]
    if desaccords:
        lignes += ["| sort | URL conservée | URLs vues |", "|---|---|---|"]
        for d in desaccords:
            vues = "<br>".join(f"`{u}` ×{n}" for u, n in d["urls"].items())
            lignes.append(f"| {d['nom']} (`{d['id']}`) | `{d['conserve']}` | {vues} |")
    else:
        lignes.append("Aucun : chaque `id` porte une URL identique dans tous les fichiers.")

    lignes += [
        "",
        "## Notes de lecture",
        "",
        "- Le champ `ecoles` est un **indice** dérivé du regroupement `<h3>` des pages",
        "  de liste ; il est vide pour les classes dont la page ne regroupe pas par",
        "  école. Ce n'est **pas** une donnée manquante : l'école faisant autorité est",
        "  le champ `École` de la page du sort, extrait à l'étape 07, qui supplante",
        "  cet indice.",
        "- `niveaux_divergents` est une liste de revue, pas une liste d'erreurs : un",
        "  même sort n'a normalement pas le même niveau pour toutes les classes.",
        "- Les libellés multi-classes (`Arcaniste/Ensorceleur/Magicien`,",
        "  `Prêtre/Prêtre combattant/Oracle`) restent **une seule** entrée de classe,",
        "  conformément à la décision consignée dans `00_CONTEXT.md`.",
        "",
    ]
    return "\n".join(lignes)


def run(
    classes_path: str | Path = DEFAULT_CLASSES,
    lists_dir: str | Path = DEFAULT_LISTS,
    out_dir: str | Path = DEFAULT_OUT,
    report_path: str | Path = DEFAULT_REPORT,
) -> dict:
    labels = load_roster(classes_path)
    entrees = load_entries(lists_dir)
    if not entrees:
        raise IntegrityError(f"aucune entrée lue depuis {lists_dir}")

    check_bijection(entrees)
    check_roster(entrees, labels)

    uniques, anomalies = aggregate(entrees, labels)
    genere_le = datetime.now(timezone.utc).isoformat()
    carte = build_carte_doublons(uniques, genere_le)
    exclusifs = build_sorts_exclusifs(uniques, labels, genere_le)

    out = Path(out_dir)
    write_jsonl(uniques, out / "sorts_uniques.jsonl")
    write_json(carte, out / "carte_doublons.json")
    write_json(exclusifs, out / "sorts_exclusifs.json")

    rapport = Path(report_path)
    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text(
        build_report(entrees, uniques, carte, exclusifs, labels, anomalies),
        encoding="utf-8",
        newline="\n",
    )

    # Arithmetic identity: every entry contributes one (id, classe) pair except
    # the intra-class duplicates that were folded into a single lowest level.
    somme_nb_classes = sum(u["nb_classes"] for u in uniques.values())
    paires = len({(e["id"], e["classe"]) for e in entrees})
    if somme_nb_classes != paires:
        raise IntegrityError(
            f"identité arithmétique rompue : somme(nb_classes)={somme_nb_classes} "
            f"!= paires (id, classe) distinctes={paires}"
        )

    nb_exclusifs = sum(exclusifs["totaux"].values())
    if carte["nb_sorts_partages"] + nb_exclusifs != len(uniques):
        raise IntegrityError("contrôle de partition rompu (partagés + exclusifs != uniques)")

    return {
        "nb_entrees": len(entrees),
        "nb_uniques": len(uniques),
        "nb_partages": carte["nb_sorts_partages"],
        "nb_exclusifs": nb_exclusifs,
        "nb_divergents": len(carte["niveaux_divergents"]),
        "somme_nb_classes": somme_nb_classes,
        "paires_distinctes": paires,
        "anomalies": anomalies,
    }


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Construit l'index des sorts uniques et la carte des doublons."
    )
    parseur.add_argument("--classes", default=DEFAULT_CLASSES)
    parseur.add_argument("--lists", default=DEFAULT_LISTS)
    parseur.add_argument("--out", default=DEFAULT_OUT)
    parseur.add_argument("--report", default=DEFAULT_REPORT)
    args = parseur.parse_args(argv)

    resume = run(args.classes, args.lists, args.out, args.report)
    print(
        f"{resume['nb_entrees']} entrées -> {resume['nb_uniques']} sorts uniques "
        f"({resume['nb_partages']} partagés, {resume['nb_exclusifs']} exclusifs, "
        f"{resume['nb_divergents']} à niveaux divergents)"
    )
    intra = len(resume["anomalies"]["doublons_intra_classe"])
    urls = len(resume["anomalies"]["desaccords_url"])
    print(f"anomalies : {intra} doublon(s) intra-classe, {urls} désaccord(s) d'URL")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
