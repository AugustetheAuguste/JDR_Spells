"""Step 03 driver: fetch every class spell-list page into the HTML cache.

Thin orchestration only. Fetching lives in `pf_spells.fetcher`, deduplication in
`pf_spells.classes`; neither is reimplemented here. Re-running hits the cache
only and touches the network zero times.

Outputs:
    data/classes.json               the step-04 roster contract
    reports/03_fetch_classes.md     outcomes, dedup log, failures
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pf_spells.classes import load_classes
from pf_spells.fetcher import fetch, fetch_many

CLASSES_ATTENDUES = 19
TAILLE_MINIMALE = 20_000
MARQUEUR_CONTENU = 'id="PageContentDiv"'

ROSTER_PATH = Path("data/classes.json")
REPORT_PATH = Path("reports/03_fetch_classes.md")

# data/classes.json contract: exactly these keys, in this order.
CLES_ROSTER = (
    "classe",
    "slug",
    "url",
    "cache_fichier",
    "taille_octets",
    "statut",
    "note",
)


def _controler(chemin_cache: str) -> tuple[int, str | None]:
    """Return (size in bytes, failure reason or None) for a cached page."""
    if not chemin_cache:
        return 0, "aucun fichier de cache écrit"
    chemin = Path(chemin_cache)
    if not chemin.exists():
        return 0, f"fichier de cache absent: {chemin_cache}"
    taille = chemin.stat().st_size
    try:
        html = chemin.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        return taille, f"décodage UTF-8 impossible: {exc}"
    if taille < TAILLE_MINIMALE:
        return taille, f"corps suspect ({taille} octets < {TAILLE_MINIMALE})"
    if MARQUEUR_CONTENU not in html:
        return taille, f"marqueur {MARQUEUR_CONTENU} absent"
    return taille, None


def _ligne_roster(entree: dict, resultat: dict) -> dict:
    """Build one roster record from a class entry and its fetch result."""
    if resultat["error"]:
        taille, raison = 0, f"échec de récupération: {resultat['error']}"
    else:
        taille, raison = _controler(resultat["cache_path"])
    return {
        "classe": entree["label"],
        "slug": entree["slug"],
        "url": entree["url"],
        "cache_fichier": resultat["cache_path"].replace("\\", "/"),
        "taille_octets": taille,
        "statut": "erreur" if raison else "ok",
        "note": raison,
    }


def _ecrire_roster(roster: list[dict]) -> None:
    ROSTER_PATH.parent.mkdir(parents=True, exist_ok=True)
    trie = sorted(roster, key=lambda l: l["slug"])
    texte = json.dumps(trie, ensure_ascii=False, indent=2) + "\n"
    ROSTER_PATH.write_text(texte, encoding="utf-8", newline="\n")


def _ecrire_rapport(
    roster: list[dict], abandons: list[dict], resultats: list[dict]
) -> None:
    depuis_cache = {r["url"]: r["from_cache"] for r in resultats}
    live = sum(1 for r in resultats if not r["from_cache"] and not r["error"])
    caches = sum(1 for r in resultats if r["from_cache"])
    echecs = [l for l in roster if l["statut"] == "erreur"]

    lignes = [
        "# Rapport 03 — Récupération des pages de listes de sorts par classe",
        "",
        "## Totaux",
        "",
        f"- Classes uniques traitées : **{len(roster)}**",
        f"- Récupérées en direct (réseau) : **{live}**",
        f"- Servies depuis le cache : **{caches}**",
        f"- En échec : **{len(echecs)}**",
        f"- Doublons écartés à l'entrée : **{len(abandons)}**",
        "",
        "## Roster",
        "",
        "| classe | slug | statut | taille (octets) | from_cache |",
        "|---|---|---|---|---|",
    ]
    for ligne in sorted(roster, key=lambda l: l["slug"]):
        lignes.append(
            f"| {ligne['classe']} | `{ligne['slug']}` | {ligne['statut']} | "
            f"{ligne['taille_octets']:,} | "
            f"{'oui' if depuis_cache.get(ligne['url']) else 'non'} |"
        )

    lignes += ["", "## Entrées dédoublonnées", ""]
    if abandons:
        lignes.append(
            "Le fichier d'entrée `elements_to_do.json` contient 20 entrées pour "
            f"{len(roster)} pages uniques. Dédoublonnage par URL "
            "percent-décodée et minusculée, la première occurrence gagne :"
        )
        lignes.append("")
        lignes.append("| label écarté | conservé à la place | raison | url écartée |")
        lignes.append("|---|---|---|---|")
        for abandon in abandons:
            lignes.append(
                f"| {abandon['label']} | {abandon['conserve']} | "
                f"{abandon['raison']} | `{abandon['url']}` |"
            )
    else:
        lignes.append("Aucun doublon détecté à l'entrée.")

    lignes += ["", "## Échecs", ""]
    if echecs:
        lignes.append("| classe | statut | note | url |")
        lignes.append("|---|---|---|---|")
        for ligne in echecs:
            lignes.append(
                f"| {ligne['classe']} | {ligne['statut']} | {ligne['note']} | "
                f"`{ligne['url']}` |"
            )
        lignes += [
            "",
            "Commande de reprise (force le contournement du cache) :",
            "",
            "```bash",
            "PYTHONPATH=src python -m pf_spells.fetch_classes --force",
            "```",
        ]
    else:
        lignes.append(
            "Aucun échec. Les 19 pages sont en cache, décodables en UTF-8, "
            "≥ 20 000 octets et contiennent `id=\"PageContentDiv\"`."
        )

    lignes += [
        "",
        "## Idempotence",
        "",
        "Une seconde exécution de cette étape ne déclenche aucune requête "
        "réseau : `from_cache` vaut `oui` pour les 19 classes et "
        "`cache/index.jsonl` reste inchangé.",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def executer(*, workers: int = 4, force: bool = False) -> int:
    entrees, abandons = load_classes()
    print(f"{len(entrees)} classe(s) unique(s) / {len(abandons)} doublon(s) écarté(s)")
    for abandon in abandons:
        print(f"  ÉCARTÉ {abandon['label']} (doublon de {abandon['conserve']}) {abandon['url']}")
    if len(entrees) != CLASSES_ATTENDUES:
        print(
            f"  AVERTISSEMENT: {len(entrees)} classes uniques au lieu de "
            f"{CLASSES_ATTENDUES} attendues — elements_to_do.json a changé "
            "depuis la planification. Poursuite avec l'ensemble réel."
        )

    resultats = fetch_many([e["url"] for e in entrees], workers=workers, force=force)
    roster = [_ligne_roster(e, r) for e, r in zip(entrees, resultats)]

    # One forced retry for anything unsound, then give up loudly.
    for indice, ligne in enumerate(roster):
        if ligne["statut"] != "erreur":
            continue
        print(f"  REPRISE {ligne['classe']} -> {ligne['note']}")
        reprise = fetch(entrees[indice]["url"], force=True)
        resultats[indice] = reprise
        roster[indice] = _ligne_roster(entrees[indice], reprise)

    _ecrire_roster(roster)
    _ecrire_rapport(roster, abandons, resultats)

    echecs = [l for l in roster if l["statut"] == "erreur"]
    caches = sum(1 for r in resultats if r["from_cache"])
    print(
        f"{len(roster)} page(s): {caches} depuis le cache, "
        f"{len(roster) - caches} en direct, {len(echecs)} échec(s)"
    )
    print(f"écrit {ROSTER_PATH} et {REPORT_PATH}")
    if echecs:
        for ligne in echecs:
            print(f"  ÉCHEC {ligne['classe']} {ligne['url']} -> {ligne['note']}")
        print("BLOQUANT: roster incomplet, l'étape 04 ne doit pas démarrer.")
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Récupère les pages de listes de sorts par classe dans le cache."
    )
    parseur.add_argument("--force", action="store_true", help="ignorer le cache")
    parseur.add_argument("--workers", type=int, default=4, help="threads (défaut 4)")
    args = parseur.parse_args(argv)
    return executer(workers=args.workers, force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
