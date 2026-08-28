"""Parse the cached class spell-list pages into one JSONL file per class.

Reads only from `cache/html/` via `data/classes.json`: this module never touches
the network. Every emitted line is validated against
`data/schemas/liste_classe.schema.json` before it is written, and the spell `id` slug
is assigned from a map shared across all classes so a spell granted by six
classes carries one identical `id` everywhere.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from bs4 import Tag
from jsonschema import Draft202012Validator

from pf_spells.htmlutil import (
    absolutize,
    clean_text,
    inner_html,
    load_html,
    page_content,
)
from pf_spells.slugs import dedupe_slug, slugify

parser_version = "1.0.0"

DEFAULT_CLASSES = "data/classes.json"
DEFAULT_SCHEMA = "data/schemas/liste_classe.schema.json"
DEFAULT_OUT = "data/listes_classes"
DEFAULT_REPORT = "reports/04_parse_lists.md"

# `Formules de niveau N` is the Alchimiste wording; the nav heading
# `Accès rapide aux sections sur la magie` fails this on purpose.
NIVEAU_H2 = re.compile(r"^(?:Sorts|Formules) de niveau (\d)$")

# A source tag is a short parenthesised italic run right after the name, e.g.
# `(RSE)`, `(MJRA)`, `(AM, LD)`.
SOURCE_TAG = re.compile(r"^\((.+)\)$")

# Canonical key order, per the pf-corpus-conventions Skill.
KEY_ORDER = (
    "id",
    "nom",
    "url",
    "classe",
    "niveau",
    "ecole",
    "description_courte",
    "sources",
    "ligne_html",
)


def heading_text(node: Tag) -> str:
    """Return a heading's text without the trailing `¶` section-anchor link."""
    copie = copy.copy(node)
    for ancre in copie.select("a.headeranchor"):
        ancre.decompose()
    return clean_text(copie)


def source_tags(bloc: Tag) -> list[str]:
    """Return the source-book tags following the `<b>` name wrapper.

    Walks the `<i>` siblings after `<b>` and stops at the first sibling that is
    not an italic parenthesised run — that is where the blurb starts.
    """
    tags: list[str] = []
    for frere in bloc.next_siblings:
        if isinstance(frere, Tag):
            if frere.name != "i":
                break
            m = SOURCE_TAG.match(clean_text(frere))
            if m is None:
                break
            tags.append(m.group(1).strip())
            continue
        if clean_text(frere):
            break
    return tags


def short_blurb(li: Tag, nb_sources: int) -> str | None:
    """Return the entry blurb: the `<li>` minus the name wrapper and its tags.

    Works on a copy of the node and drops whole elements rather than
    regex-stripping rendered text, so punctuation drift cannot corrupt it.
    """
    copie = copy.copy(li)
    bloc = copie.find("b", recursive=False)
    if bloc is None:
        return None
    a_retirer = [bloc]
    restants = nb_sources
    for frere in bloc.next_siblings:
        if restants == 0:
            break
        if isinstance(frere, Tag) and frere.name == "i":
            a_retirer.append(frere)
            restants -= 1
    for noeud in a_retirer:
        noeud.extract()
    texte = clean_text(copie).lstrip(".;:").strip()
    return texte or None


def parse_class_page(
    classe: dict,
    slugs_globaux: dict[str, str],
    slugs_vus: set[str],
    collisions: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Parse one cached list page into (lines, skipped `<li>` diagnostics)."""
    contenu = page_content(load_html(classe["cache_fichier"]))
    niveau: int | None = None
    ecole: str | None = None
    lignes: list[dict] = []
    ignores: list[dict] = []

    for noeud in contenu.descendants:
        if not isinstance(noeud, Tag):
            continue
        if noeud.name == "h2":
            m = NIVEAU_H2.match(heading_text(noeud))
            if m is not None:
                niveau = int(m.group(1))
                ecole = None
            continue
        if noeud.name == "h3":
            ecole = heading_text(noeud) or None
            continue
        if noeud.name != "li":
            continue
        if noeud.find_parent("li") is not None:
            continue  # nested list item: already covered by its parent
        lien = noeud.select_one("b i a.pagelink")
        if lien is None:
            ignores.append(
                {
                    "classe": classe["classe"],
                    "niveau": niveau,
                    "raison": "aucun <b><i><a class=pagelink>",
                    "texte": clean_text(noeud)[:160],
                }
            )
            continue
        if niveau is None:
            ignores.append(
                {
                    "classe": classe["classe"],
                    "niveau": None,
                    "raison": "entrée avant tout <h2> de niveau",
                    "texte": clean_text(noeud)[:160],
                }
            )
            continue

        nom = clean_text(lien)
        identifiant = slugs_globaux.get(nom)
        if identifiant is None:
            base = slugify(nom)
            identifiant = dedupe_slug(base, slugs_vus)
            slugs_globaux[nom] = identifiant
            if identifiant != base:
                collisions.append(
                    {
                        "nom": nom,
                        "slug_base": base,
                        "slug_attribue": identifiant,
                        "classe": classe["classe"],
                    }
                )

        bloc = noeud.find("b", recursive=False)
        sources = source_tags(bloc) if bloc is not None else []
        lignes.append(
            {
                "id": identifiant,
                "nom": nom,
                "url": absolutize(lien["href"]),
                "classe": classe["classe"],
                "niveau": niveau,
                "ecole": ecole,
                "description_courte": short_blurb(noeud, len(sources)),
                "sources": sources,
                "ligne_html": inner_html(noeud),
            }
        )

    return lignes, ignores


def write_jsonl(chemin: Path, lignes: list[dict]) -> None:
    """Write compact one-object-per-line JSONL, UTF-8, LF, no BOM."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        for ligne in lignes:
            ordonnee = {cle: ligne[cle] for cle in KEY_ORDER}
            f.write(json.dumps(ordonnee, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")


def _bloc_liste(titre: str, elements: list[str]) -> list[str]:
    if not elements:
        return [f"### {titre}", "", "_Aucun._", ""]
    return [f"### {titre}", "", *[f"- {e}" for e in elements], ""]


def build_report(
    stats: list[dict],
    ignores: list[dict],
    collisions: list[dict],
    conflits: list[str],
    total: int,
) -> str:
    lignes = [
        "# Rapport 04 — Analyse des listes de sorts par classe",
        "",
        f"Parser : `pf_spells.parse_lists` v{parser_version} — aucun accès réseau.",
        "",
        f"**{len(stats)} classes analysées, {total} entrées au total.**",
        "",
        "## Compte par classe",
        "",
        "| Classe | Fichier | Entrées | Niveaux | Écoles |",
        "|---|---|---:|---|---|",
    ]
    for s in sorted(stats, key=lambda x: -x["entrees"]):
        niveaux = ", ".join(
            f"{n}:{s['par_niveau'][n]}" for n in sorted(s["par_niveau"])
        )
        ecoles = (
            f"{len(s['ecoles'])} école(s), {s['sans_ecole']} ligne(s) sans école"
            if s["ecoles"]
            else "aucune (`ecole` = null partout)"
        )
        lignes.append(
            f"| {s['classe']} | `{s['fichier']}` | {s['entrees']} | {niveaux} | {ecoles} |"
        )
    lignes += ["", "## Anomalies", ""]
    lignes += _bloc_liste(
        "Collisions de slug",
        [
            f"`{c['nom']}` → `{c['slug_base']}` déjà pris, attribué `{c['slug_attribue']}` "
            f"(vu dans {c['classe']})"
            for c in collisions
        ],
    )
    lignes += _bloc_liste("Incohérences nom ↔ URL", conflits)

    par_raison = Counter(i["raison"] for i in ignores)
    lignes += [
        "### `<li>` ignorés",
        "",
        f"{len(ignores)} au total — tous sont les puces de navigation du bandeau "
        "d'introduction commun à toutes les pages (aucune n'apparaît après un "
        "titre de niveau).",
        "",
    ]
    for raison, n in par_raison.most_common():
        lignes.append(f"- {n} × {raison}")
    lignes.append("")
    echantillon = sorted({i["texte"] for i in ignores})[:15]
    lignes += ["Échantillon de textes ignorés :", ""]
    lignes += [f"- `{t}`" for t in echantillon]
    lignes.append("")
    return "\n".join(lignes)


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Analyse les pages de listes de sorts en cache → un JSONL par classe."
    )
    parseur.add_argument("--classes", default=DEFAULT_CLASSES)
    parseur.add_argument("--schema", default=DEFAULT_SCHEMA)
    parseur.add_argument("--out", default=DEFAULT_OUT)
    parseur.add_argument("--report", default=DEFAULT_REPORT)
    parseur.add_argument(
        "--min-entrees",
        type=int,
        default=50,
        help="seuil bloquant d'entrées par classe",
    )
    args = parseur.parse_args(argv)

    classes = json.loads(Path(args.classes).read_text(encoding="utf-8"))
    validateur = Draft202012Validator(
        json.loads(Path(args.schema).read_text(encoding="utf-8"))
    )

    slugs_globaux: dict[str, str] = {}
    slugs_vus: set[str] = set()
    collisions: list[dict] = []
    tous_ignores: list[dict] = []
    stats: list[dict] = []
    noms_par_url: dict[str, set[str]] = defaultdict(set)
    urls_par_nom: dict[str, set[str]] = defaultdict(set)
    total = 0

    for classe in classes:
        if classe.get("statut") != "ok":
            raise SystemExit(f"BLOQUANT: {classe['classe']} a le statut {classe['statut']!r}")
        lignes, ignores = parse_class_page(classe, slugs_globaux, slugs_vus, collisions)
        tous_ignores.extend(ignores)

        erreurs = []
        for ligne in lignes:
            for err in validateur.iter_errors(ligne):
                erreurs.append(f"{ligne['id']}: {err.message}")
        if erreurs:
            raise SystemExit(
                f"BLOQUANT: {len(erreurs)} échec(s) de validation pour "
                f"{classe['classe']}:\n  " + "\n  ".join(erreurs[:20])
            )
        if len(lignes) < args.min_entrees:
            raise SystemExit(
                f"BLOQUANT: {classe['classe']} n'a produit que {len(lignes)} entrées "
                f"(< {args.min_entrees}) — échec d'analyse probable"
            )

        for ligne in lignes:
            noms_par_url[ligne["url"]].add(ligne["nom"])
            urls_par_nom[ligne["nom"]].add(ligne["url"])

        lignes.sort(key=lambda l: (l["niveau"], l["nom"]))
        fichier = Path(args.out) / f"{classe['slug']}.jsonl"
        write_jsonl(fichier, lignes)

        stats.append(
            {
                "classe": classe["classe"],
                "fichier": fichier.as_posix(),
                "entrees": len(lignes),
                "par_niveau": dict(Counter(l["niveau"] for l in lignes)),
                "ecoles": sorted({l["ecole"] for l in lignes if l["ecole"]}),
                "sans_ecole": sum(1 for l in lignes if l["ecole"] is None),
            }
        )
        total += len(lignes)
        print(f"{classe['slug']:34s} {len(lignes):5d} entrées -> {fichier.as_posix()}")

    conflits = [
        f"URL `{u}` porte plusieurs noms : {sorted(n)}"
        for u, n in noms_par_url.items()
        if len(n) > 1
    ] + [
        f"Nom `{n}` pointe vers plusieurs URL : {sorted(u)}"
        for n, u in urls_par_nom.items()
        if len(u) > 1
    ]

    rapport = Path(args.report)
    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text(
        build_report(stats, tous_ignores, collisions, conflits, total),
        encoding="utf-8",
        newline="\n",
    )

    print(
        f"\n{len(stats)} classes, {total} entrées, {len(slugs_globaux)} noms distincts, "
        f"{len(collisions)} collision(s) de slug, {len(conflits)} incohérence(s) nom/URL"
    )
    print(f"rapport -> {rapport.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
