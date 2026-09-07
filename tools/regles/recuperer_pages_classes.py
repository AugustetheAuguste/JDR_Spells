"""Fetch every class page from pathfinder-fr.org into `cache/html_classes/`.

The normal path to a populated cache. Step 05 (the progression table parser)
and step 06 (its report) read `data/conventions/classes_unifiees.json` for the
42 unified classes and need one page per class — never the consolidated list
page, which has no per-level `BBA`/`Réflexes`/`Vigueur`/`Volonté`/`Spécial`
table, cf. `build/fiche_personnage/02_TOOLS.md`.

Model read before writing this: `src/pf_spells/fetch_classes.py` for the
report/roster shape, `src/pf_spells/fetcher.py` for the throttle, retry and
cache-index pattern this module deliberately re-derives rather than imports —
the wiki's per-class page URL (`Pathfinder-RPG.<Nom>.ashx`) is a different
scheme from the per-class *list* URLs `fetcher.py` already serves, so sharing
its cache would conflate two different page kinds under one sha1 key.

Throttle: 1 request per second AT MOST, 1 worker, never negotiable — cf.
CLAUDE.md §7. This is the fifth module in the repository that reaches the
network.

    python tools/regles/recuperer_pages_classes.py
    python tools/regles/recuperer_pages_classes.py --force
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import requests

RACINE = Path(__file__).resolve().parents[2]

USER_AGENT = "JDR_Spells corpus builder (personal, polite crawl)"
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."
CACHE_DIR = RACINE / "cache/html_classes"
INDEX_PATH = CACHE_DIR / "index.jsonl"
REGISTRE = RACINE / "data/conventions/classes_unifiees.json"
REPORT_PATH = RACINE / "reports/regles_recuperation_classes.md"

MIN_INTERVAL = 1.0
BACKOFFS = (2.0, 5.0)  # one identical retry, cf. pseudo-code §"deroulement"
TIMEOUT = 30.0

_last_request = 0.0
_temps_requetes: list[float] = []


@dataclass
class ResultatClasse:
    slug: str
    nom: str
    url: str
    url_secours: str | None
    statut: str  # "cache" | "reseau" | "lacune"
    motif: str | None
    sha1: str | None
    octets: int | None


def _charger_registre() -> list[dict[str, str]]:
    if not REGISTRE.exists():
        raise SystemExit(f"ÉCHEC : registre absent — {REGISTRE.as_posix()}")
    contenu = json.loads(REGISTRE.read_text(encoding="utf-8"))
    return [{"slug": c["slug"], "nom": c["nom"]} for c in contenu["classes"]]


def _url_pour(nom: str) -> str:
    """The individual class page, never the consolidated list page."""
    # `quote` with an empty safe set encodes accents and spaces alike, in
    # uppercase hex — cf. CLAUDE.md §3, "hexadécimal MAJUSCULE".
    return f"{BASE_URL}{quote(nom, safe='')}.ashx"


def _url_secours(nom: str) -> str:
    """Second attempt: the name folded to ASCII, tried only after two failures."""
    depouille = unicodedata.normalize("NFKD", nom)
    sans_accents = "".join(c for c in depouille if not unicodedata.combining(c))
    return f"{BASE_URL}{quote(sans_accents, safe='')}.ashx"


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
    # Decode explicitly as UTF-8 (no <meta charset> on these pages), then write
    # back the raw bytes as received — no re-encoding, cf. CLAUDE.md §3.
    try:
        reponse.content.decode("utf-8")
    except UnicodeDecodeError as exc:
        return None, f"décodage UTF-8 impossible: {exc}"
    return reponse.content, None


def _obtenir(entree: dict[str, str], *, force: bool) -> ResultatClasse:
    slug, nom = entree["slug"], entree["nom"]
    chemin = _chemin_cache(slug)
    url = _url_pour(nom)

    if chemin.exists() and not force:
        octets = chemin.read_bytes()
        return ResultatClasse(
            slug, nom, url, None, "cache", None,
            hashlib.sha1(octets).hexdigest(), len(octets),
        )

    corps, motif = _telecharger_une_fois(url)
    if corps is None:
        # One identical retry, cf. pseudo-code.
        corps, motif = _telecharger_une_fois(url)

    url_secours = None
    if corps is None:
        url_secours = _url_secours(nom)
        if url_secours != url:
            corps, motif_secours = _telecharger_une_fois(url_secours)
            if corps is None:
                motif = f"{motif} ; secours sans accent: {motif_secours}"

    if corps is None:
        return ResultatClasse(slug, nom, url, url_secours, "lacune", motif, None, None)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    chemin.write_bytes(corps)
    return ResultatClasse(
        slug, nom, url, url_secours, "reseau", None,
        hashlib.sha1(corps).hexdigest(), len(corps),
    )


def _ecrire_index(resultats: list[ResultatClasse]) -> None:
    """Full rewrite, so a second run over an unchanged cache is byte-identical.

    Same shape as `importer_cache_classes.py` writes, origin column aside — step
    05 must not be able to tell which tool populated the cache.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    lignes = []
    for r in sorted(resultats, key=lambda r: r.slug):
        if r.sha1 is None:
            continue  # gaps never enter the index, only the report
        lignes.append(
            json.dumps(
                {
                    "slug": r.slug,
                    "url": r.url,
                    "sha1": r.sha1,
                    "octets": r.octets,
                    "date": datetime.now(UTC).isoformat(),
                    "origine": "reseau",
                },
                ensure_ascii=False,
            )
        )
    INDEX_PATH.write_text("\n".join(lignes) + ("\n" if lignes else ""), encoding="utf-8", newline="\n")


def _ecrire_rapport(resultats: list[ResultatClasse]) -> None:
    caches = [r for r in resultats if r.statut == "cache"]
    reseau = [r for r in resultats if r.statut == "reseau"]
    lacunes = [r for r in resultats if r.statut == "lacune"]

    intervalles = [
        b - a for a, b in zip(_temps_requetes, _temps_requetes[1:])
    ]
    if intervalles:
        mesure = (
            f"{len(_temps_requetes)} requête(s) réseau, intervalle minimal mesuré "
            f"entre deux requêtes : {min(intervalles):.3f} s (throttle exigé : "
            f"≥ {MIN_INTERVAL:.1f} s)."
        )
    else:
        mesure = "0 requête réseau cette exécution — rien à mesurer."

    lignes = [
        "# Rapport — récupération des pages de classe",
        "",
        "## Totaux",
        "",
        f"- Classes du registre : **{len(resultats)}**",
        f"- Déjà en cache (aucune requête) : **{len(caches)}**",
        f"- Récupérées en direct : **{len(reseau)}**",
        f"- Lacunes : **{len(lacunes)}**",
        "",
        "## Throttle",
        "",
        mesure,
        "",
        "## Lacunes",
        "",
    ]
    if lacunes:
        lignes.append("| classe | url essayée | url de secours | motif |")
        lignes.append("|---|---|---|---|")
        for r in lacunes:
            lignes.append(f"| {r.nom} | `{r.url}` | `{r.url_secours or '—'}` | {r.motif} |")
    else:
        lignes.append("Aucune. Toutes les pages du registre ont été obtenues.")
    lignes += [
        "",
        "## Idempotence",
        "",
        "Une seconde exécution ne fait aucune requête réseau : chaque page déjà "
        "en cache est servie sans y toucher, cf. `tests/regles/"
        "test_recuperer_pages_classes.py`.",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def executer(*, force: bool = False) -> int:
    entrees = _charger_registre()
    resultats = [_obtenir(e, force=force) for e in entrees]
    _ecrire_index(resultats)
    _ecrire_rapport(resultats)

    caches = sum(1 for r in resultats if r.statut == "cache")
    reseau = sum(1 for r in resultats if r.statut == "reseau")
    lacunes = [r for r in resultats if r.statut == "lacune"]
    print(
        f"{len(resultats)} classe(s) : {caches} depuis le cache, {reseau} en direct, "
        f"{len(lacunes)} lacune(s)"
    )
    for r in lacunes:
        print(f"  LACUNE {r.nom} -> {r.motif}")
    print(f"écrit {INDEX_PATH} et {REPORT_PATH}")
    # Gaps are reported, never guessed — exit 0 even with gaps, cf. pseudo-code.
    return 0


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Récupère les pages de classe individuelles dans cache/html_classes/."
    )
    parseur.add_argument("--force", action="store_true", help="ignorer le cache")
    args = parseur.parse_args(argv)
    return executer(force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
