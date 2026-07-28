"""Step 06 driver: fetch every distinct spell page into the HTML cache.

Thin orchestration only. All HTTP lives in `pf_spells.fetcher` (global 1 req/s
throttle, retries, cache); this module never talks to the network itself. It
deduplicates the spell URLs referenced by `data/listes_classes/*.jsonl`, drives
the cached fetch in batches so progress and the manifest advance incrementally,
sanity-checks each cached body, and writes the step-07 contract.

Outputs:
    data/spell_pages.jsonl        the step-07 manifest contract
    reports/06_fetch_spells.md    totals, failures, re-run command
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from pf_spells.fetcher import fetch_many

LISTES_DIR = Path("data/listes_classes")
MANIFEST_PATH = Path("data/spell_pages.jsonl")
REPORT_PATH = Path("reports/06_fetch_spells.md")

TAILLE_MINIMALE = 8_000
MARQUEUR_CONTENU = 'id="PageContentDiv"'
MARQUEUR_TITRE = 'class="pagetitle"'
MARQUEUR_STATBLOC = "Niveau"

LOT = 100  # batch size: also the progress and manifest-flush granularity
BANDE_MINIMALE = 1_500
BANDE_MAXIMALE = 5_000

# data/spell_pages.jsonl contract: exactly these keys, in this order.
CLES_MANIFESTE = (
    "id",
    "nom",
    "url",
    "cache_fichier",
    "taille_octets",
    "statut",
    "from_cache",
    "note",
)


def collecter_cibles() -> tuple[dict[str, dict], int]:
    """Return ({url: {id, nom, url}}, total lines seen) from the class lists.

    The same spell appears on many class lines with an identical id and url;
    the first occurrence wins, so the mapping is deterministic.
    """
    cibles: dict[str, dict] = {}
    lignes_vues = 0
    fichiers = sorted(LISTES_DIR.glob("*.jsonl"))
    if not fichiers:
        raise SystemExit(
            f"aucun fichier {LISTES_DIR}/*.jsonl — l'étape 04 doit tourner d'abord"
        )
    for fichier in fichiers:
        with fichier.open(encoding="utf-8") as flux:
            for brut in flux:
                brut = brut.strip()
                if not brut:
                    continue
                lignes_vues += 1
                entree = json.loads(brut)
                cibles.setdefault(
                    entree["url"],
                    {"id": entree["id"], "nom": entree["nom"], "url": entree["url"]},
                )
    return cibles, lignes_vues


def _controler(chemin_cache: str) -> tuple[int, str | None]:
    """Return (size in bytes, failure reason or None) for a cached spell page."""
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
    manquants = [
        marqueur
        for marqueur in (MARQUEUR_CONTENU, MARQUEUR_TITRE, MARQUEUR_STATBLOC)
        if marqueur not in html
    ]
    if manquants:
        return taille, "marqueur(s) absent(s): " + ", ".join(manquants)
    return taille, None


def _ligne_manifeste(cible: dict, resultat: dict) -> dict:
    """Build one manifest record from a target triple and its fetch result."""
    if resultat["error"]:
        taille, raison = 0, f"échec de récupération: {resultat['error']}"
    else:
        taille, raison = _controler(resultat["cache_path"])
    return {
        "id": cible["id"],
        "nom": cible["nom"],
        "url": cible["url"],
        "cache_fichier": resultat["cache_path"].replace("\\", "/"),
        "taille_octets": taille,
        "statut": "erreur" if raison else "ok",
        "from_cache": resultat["from_cache"],
        "note": raison,
    }


def _ecrire_manifeste(lignes: list[dict]) -> None:
    """Write the manifest sorted by id: compact JSONL, UTF-8, LF."""
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    texte = "".join(
        json.dumps(ligne, ensure_ascii=False, separators=(",", ":")) + "\n"
        for ligne in sorted(lignes, key=lambda l: l["id"])
    )
    MANIFEST_PATH.write_text(texte, encoding="utf-8", newline="\n")


def _ecrire_rapport(
    manifeste: list[dict], lignes_vues: int, distinctes: int, secondes: float
) -> None:
    live = sum(1 for l in manifeste if not l["from_cache"])
    caches = sum(1 for l in manifeste if l["from_cache"])
    echecs = [l for l in manifeste if l["statut"] == "erreur"]
    ok = len(manifeste) - len(echecs)
    taux = (ok / len(manifeste) * 100) if manifeste else 0.0

    lignes = [
        "# Rapport 06 — Récupération de toutes les pages de sorts uniques",
        "",
        "## Totaux",
        "",
        f"- Lignes lues dans `data/listes_classes/*.jsonl` : **{lignes_vues:,}**",
        f"- URL de sorts distinctes : **{distinctes:,}**",
        f"- Pages au manifeste : **{len(manifeste):,}**",
        f"- Récupérées en direct (réseau) : **{live:,}**",
        f"- Servies depuis le cache : **{caches:,}**",
        f"- Statut `ok` : **{ok:,}** ({taux:.2f} %)",
        f"- Statut `erreur` : **{len(echecs):,}**",
        f"- Durée totale : **{secondes / 60:.1f} min** ({secondes:.0f} s)",
        "",
        "L'écart entre lignes lues et URL distinctes "
        f"({lignes_vues:,} → {distinctes:,}) est le partage inter-classes des "
        "sorts, déjà visible dans les listes de l'étape 04.",
        "",
        "## Portes de validation appliquées",
        "",
        f"- taille du fichier ≥ {TAILLE_MINIMALE:,} octets",
        "- décodage UTF-8 explicite sans erreur",
        f"- présence de `{MARQUEUR_CONTENU}`, `{MARQUEUR_TITRE}` et "
        f"`{MARQUEUR_STATBLOC}`",
        "",
        "## Échecs",
        "",
    ]
    if echecs:
        lignes.append(
            f"{len(echecs)} page(s) en échec après une passe de reprise forcée. "
            "Aucune URL de remplacement n'a été inventée ; l'étape 07 les "
            "ignorera et l'étape 09 les re-signalera."
        )
        lignes += ["", "| id | nom | note | url |", "|---|---|---|---|"]
        for ligne in sorted(echecs, key=lambda l: l["id"]):
            lignes.append(
                f"| `{ligne['id']}` | {ligne['nom']} | {ligne['note']} | "
                f"`{ligne['url']}` |"
            )
        lignes += [
            "",
            "Commande de reprise (contourne le cache pour tout l'ensemble) :",
            "",
            "```bash",
            "PYTHONPATH=src python -m pf_spells.fetch_spells --force",
            "```",
        ]
    else:
        lignes.append(
            "**Aucun échec.** Les "
            f"{len(manifeste):,} pages sont en cache, décodables en UTF-8, "
            f"≥ {TAILLE_MINIMALE:,} octets et portent les trois marqueurs."
        )

    lignes += [
        "",
        "## Idempotence",
        "",
        "Une seconde exécution ne déclenche aucune requête réseau : "
        "`from_cache` vaut `true` sur toutes les lignes et `cache/index.jsonl` "
        "n'augmente pas (le journal n'est écrit que pour les fetch en direct).",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def executer(*, workers: int = 4, force: bool = False, limit: int | None = None) -> int:
    debut = time.monotonic()
    cibles, lignes_vues = collecter_cibles()
    print(f"{lignes_vues} ligne(s) lue(s) -> {len(cibles)} URL distincte(s)")
    if not BANDE_MINIMALE <= len(cibles) <= BANDE_MAXIMALE:
        print(
            f"  AVERTISSEMENT: {len(cibles)} URL distinctes hors de la bande "
            f"attendue [{BANDE_MINIMALE}, {BANDE_MAXIMALE}] — à investiguer."
        )

    urls = sorted(cibles)
    if limit is not None:
        urls = urls[:limit]
        print(f"  --limit {limit}: {len(urls)} URL traitée(s)")

    manifeste: list[dict] = []
    for debut_lot in range(0, len(urls), LOT):
        lot = urls[debut_lot : debut_lot + LOT]
        resultats = fetch_many(lot, workers=workers, force=force)
        manifeste += [_ligne_manifeste(cibles[u], r) for u, r in zip(lot, resultats)]
        _ecrire_manifeste(manifeste)  # incremental: an interrupted run stays usable
        echecs = sum(1 for l in manifeste if l["statut"] == "erreur")
        print(
            f"  {len(manifeste)}/{len(urls)} pages "
            f"({time.monotonic() - debut:.0f}s, {echecs} échec(s))",
            flush=True,
        )

    # One automatic forced retry pass over the failures, then give up loudly.
    indices_echec = [i for i, l in enumerate(manifeste) if l["statut"] == "erreur"]
    if indices_echec:
        print(f"reprise forcée de {len(indices_echec)} échec(s)")
        reprises = fetch_many(
            [manifeste[i]["url"] for i in indices_echec], workers=workers, force=True
        )
        for indice, reprise in zip(indices_echec, reprises):
            manifeste[indice] = _ligne_manifeste(cibles[manifeste[indice]["url"]], reprise)

    secondes = time.monotonic() - debut
    _ecrire_manifeste(manifeste)
    _ecrire_rapport(manifeste, lignes_vues, len(cibles), secondes)

    echecs = [l for l in manifeste if l["statut"] == "erreur"]
    caches = sum(1 for l in manifeste if l["from_cache"])
    ok = len(manifeste) - len(echecs)
    taux = (ok / len(manifeste) * 100) if manifeste else 0.0
    print(
        f"{len(manifeste)} page(s): {caches} depuis le cache, "
        f"{len(manifeste) - caches} en direct, {len(echecs)} échec(s) "
        f"— {taux:.2f} % ok en {secondes / 60:.1f} min"
    )
    print(f"écrit {MANIFEST_PATH} et {REPORT_PATH}")
    for ligne in echecs:
        print(f"  ÉCHEC {ligne['id']} {ligne['url']} -> {ligne['note']}")
    if taux < 99.0:
        print("BLOQUANT: taux de succès sous 99 %, à investiguer avant l'étape 07.")
        return 1
    if echecs:
        print(
            f"LACUNE CONNUE: {len(echecs)} page(s) inaccessible(s), listée(s) "
            f"dans {REPORT_PATH}."
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Récupère toutes les pages de sorts uniques dans le cache HTML."
    )
    parseur.add_argument("--force", action="store_true", help="ignorer le cache")
    parseur.add_argument("--workers", type=int, default=4, help="threads (défaut 4)")
    parseur.add_argument(
        "--limit", type=int, default=None, help="ne traiter que les N premières URL"
    )
    args = parseur.parse_args(argv)
    return executer(workers=args.workers, force=args.force, limit=args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
