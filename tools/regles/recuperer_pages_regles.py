"""Fetch the handful of pathfinder-fr.org pages step 06 needs into
`cache/html_regles/`.

Model read before writing this: `tools/regles/recuperer_pages_classes.py` (the
throttle, one-retry, cache-index and report pattern this module deliberately
re-derives rather than imports — this fetcher's URL set is four individual
wiki pages, a different shape from that module's one-page-per-registry-entry
loop).

Four roles, four *files* on disk, but only four *distinct* pages are fetched
— `modificateurs` and `sorts_bonus` come from the same page
(`Caractéristiques`, table "Modificateurs de caractéristique et sorts en
bonus"), and `types_bonus` is sourced from two pages (`Valeurs de combat` for
the per-type bonus entries, `Vocabulaire courant` for the general "bonus of
the same type don't stack" rule) because no single page on the wiki carries a
complete bonus-type table with a stacking column, cf.
`reports/regles_universelles.md` §"Recherche".

Throttle: 1 request per second AT MOST, 1 worker, sequential, never
negotiable — cf. CLAUDE.md §7.

    python tools/regles/recuperer_pages_regles.py
    python tools/regles/recuperer_pages_regles.py --force
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import requests

RACINE = Path(__file__).resolve().parents[2]

USER_AGENT = "JDR_Spells corpus builder (personal, polite crawl)"
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."
CACHE_DIR = RACINE / "cache/html_regles"
INDEX_PATH = CACHE_DIR / "index.jsonl"
REPORT_PATH = RACINE / "reports" / "regles_recuperation.md"

MIN_INTERVAL = 1.0
TIMEOUT = 30.0

# slug -> wiki page name (verbatim, exact spelling read on the wiki before
# being written here — cf. déroulé logique §3 of the plan).
PAGES: dict[str, str] = {
    "caracteristiques": "Caractéristiques",
    "valeurs-de-combat": "Valeurs de combat",
    "vocabulaire-courant": "Vocabulaire courant",
    "tableau-recapitulatif-des-armures": "Tableau récapitulatif des armures",
}

# role -> list of page slugs it is parsed from (order matters for meta.sources).
ROLES: dict[str, list[str]] = {
    "modificateurs": ["caracteristiques"],
    "sorts_bonus": ["caracteristiques"],
    "types_bonus": ["valeurs-de-combat", "vocabulaire-courant"],
    "armures": ["tableau-recapitulatif-des-armures"],
}

_last_request = 0.0
_temps_requetes: list[float] = []


@dataclass
class ResultatPage:
    slug: str
    nom: str
    url: str
    statut: str  # "cache" | "reseau" | "lacune"
    motif: str | None
    sha1: str | None
    octets: int | None


def _url_pour(nom: str) -> str:
    # `quote` with an empty safe set encodes accents and spaces alike, in
    # uppercase hex — cf. CLAUDE.md §3, "hexadécimal MAJUSCULE".
    return f"{BASE_URL}{quote(nom, safe='')}.ashx"


def _chemin_cache(slug: str) -> Path:
    return CACHE_DIR / f"{slug}.html"


def _throttle() -> None:
    global _last_request
    attente = MIN_INTERVAL - (time.monotonic() - _last_request)
    if attente > 0:
        time.sleep(attente)
    _last_request = time.monotonic()
    _temps_requetes.append(time.monotonic())


def _telecharger_une_fois(url: str) -> tuple[bytes | None, str | None]:
    """One throttled GET. Returns (body bytes, error) — never raises."""
    _throttle()
    try:
        reponse = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    except Exception as exc:  # noqa: BLE001 - any transport failure is retryable
        return None, f"{type(exc).__name__}: {exc}"
    if reponse.status_code >= 400:
        return None, f"HTTP {reponse.status_code}"
    # Decode explicitly as UTF-8 (no <meta charset> on these pages) before
    # accepting the bytes, then write back the raw bytes as received.
    try:
        reponse.content.decode("utf-8")
    except UnicodeDecodeError as exc:
        return None, f"décodage UTF-8 impossible: {exc}"
    return reponse.content, None


def _obtenir(slug: str, nom: str, *, force: bool) -> ResultatPage:
    chemin = _chemin_cache(slug)
    url = _url_pour(nom)

    if chemin.exists() and not force:
        octets = chemin.read_bytes()
        return ResultatPage(
            slug, nom, url, "cache", None,
            hashlib.sha1(octets).hexdigest(), len(octets),
        )

    corps, motif = _telecharger_une_fois(url)
    if corps is None:
        # One identical retry, cf. pseudo-code §"recuperer_pages_regles.py".
        corps, motif = _telecharger_une_fois(url)

    if corps is None:
        return ResultatPage(slug, nom, url, "lacune", motif, None, None)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    chemin.write_bytes(corps)
    return ResultatPage(
        slug, nom, url, "reseau", None,
        hashlib.sha1(corps).hexdigest(), len(corps),
    )


def _ecrire_index(resultats: list[ResultatPage]) -> None:
    """Full rewrite, so a second run over an unchanged cache is byte-identical."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    lignes = []
    for r in sorted(resultats, key=lambda r: r.slug):
        if r.sha1 is None:
            continue  # gaps never enter the index, only the report
        lignes.append(
            json.dumps(
                {
                    "slug": r.slug,
                    "nom": r.nom,
                    "url": r.url,
                    "sha1": r.sha1,
                    "octets": r.octets,
                    "date": datetime.now(UTC).isoformat(),
                },
                ensure_ascii=False,
            )
        )
    INDEX_PATH.write_text("\n".join(lignes) + ("\n" if lignes else ""), encoding="utf-8", newline="\n")


def _ecrire_rapport(resultats: list[ResultatPage]) -> None:
    caches = [r for r in resultats if r.statut == "cache"]
    reseau = [r for r in resultats if r.statut == "reseau"]
    lacunes = [r for r in resultats if r.statut == "lacune"]

    intervalles = [b - a for a, b in zip(_temps_requetes, _temps_requetes[1:])]
    if intervalles:
        mesure = (
            f"{len(_temps_requetes)} requête(s) réseau, intervalle minimal mesuré "
            f"entre deux requêtes : {min(intervalles):.3f} s (throttle exigé : "
            f"≥ {MIN_INTERVAL:.1f} s)."
        )
    else:
        mesure = "0 requête réseau cette exécution — rien à mesurer."

    lignes = [
        "# Rapport — récupération des pages de règles universelles",
        "",
        "## Pages",
        "",
        "| slug | nom | url | statut | sha1 |",
        "|---|---|---|---|---|",
    ]
    for r in sorted(resultats, key=lambda r: r.slug):
        lignes.append(f"| {r.slug} | {r.nom} | `{r.url}` | {r.statut} | {r.sha1 or '—'} |")
    lignes += [
        "",
        "## Throttle",
        "",
        mesure,
        "",
        "## Lacunes",
        "",
    ]
    if lacunes:
        lignes.append("| page | url essayée | motif |")
        lignes.append("|---|---|---|")
        for r in lacunes:
            lignes.append(f"| {r.nom} | `{r.url}` | {r.motif} |")
    else:
        lignes.append("Aucune. Toutes les pages ont été obtenues.")
    lignes += [
        "",
        "## Idempotence",
        "",
        "Une seconde exécution ne fait aucune requête réseau : chaque page déjà "
        "en cache est servie sans y toucher, cf. `tests/regles/"
        "test_recuperer_pages_regles.py`.",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def executer(*, force: bool = False) -> int:
    resultats = [_obtenir(slug, nom, force=force) for slug, nom in PAGES.items()]
    _ecrire_index(resultats)
    _ecrire_rapport(resultats)

    caches = sum(1 for r in resultats if r.statut == "cache")
    reseau = sum(1 for r in resultats if r.statut == "reseau")
    lacunes = [r for r in resultats if r.statut == "lacune"]
    print(
        f"{len(resultats)} page(s) : {caches} depuis le cache, {reseau} en direct, "
        f"{len(lacunes)} lacune(s)"
    )
    for r in lacunes:
        print(f"  LACUNE {r.nom} -> {r.motif}")
    print(f"écrit {INDEX_PATH} et {REPORT_PATH}")
    # Gaps are reported, never guessed — exit 0 even with gaps, cf. pseudo-code.
    return 0


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Récupère les pages de règles universelles dans cache/html_regles/."
    )
    parseur.add_argument("--force", action="store_true", help="ignorer le cache")
    args = parseur.parse_args(argv)
    return executer(force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
