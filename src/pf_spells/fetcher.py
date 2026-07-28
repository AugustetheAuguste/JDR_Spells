"""Cached, throttled, retrying HTTP GET for pathfinder-fr.org wiki pages.

A second run over the same URL set performs zero network requests.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable, TypedDict

import requests

USER_AGENT = "JDR_Spells corpus builder (personal, polite crawl)"
CACHE_DIR = Path("cache/html")
CACHE_INDEX = Path("cache/index.jsonl")
MIN_INTERVAL = 1.0
BACKOFFS = (2.0, 5.0, 12.0)
TIMEOUT = 30.0

_clock_lock = threading.Lock()
_index_lock = threading.Lock()
_last_request = 0.0


class FetchResult(TypedDict):
    url: str
    cache_path: str
    status: int | None
    from_cache: bool
    fetched_at: str | None
    error: str | None


def cache_path_for(url: str) -> Path:
    return CACHE_DIR / f"{hashlib.sha1(url.encode('utf-8')).hexdigest()}.html"


def _throttle() -> None:
    """Block until at least MIN_INTERVAL has elapsed since the last request."""
    global _last_request
    with _clock_lock:
        attente = MIN_INTERVAL - (time.monotonic() - _last_request)
        if attente > 0:
            time.sleep(attente)
        _last_request = time.monotonic()


def _append_index(result: FetchResult) -> None:
    CACHE_INDEX.parent.mkdir(parents=True, exist_ok=True)
    ligne = json.dumps(result, ensure_ascii=False)
    with _index_lock, CACHE_INDEX.open("a", encoding="utf-8") as flux:
        flux.write(ligne + "\n")


def fetch(url: str, *, force: bool = False) -> FetchResult:
    """GET `url`, serving from cache/html unless `force` is set."""
    chemin = cache_path_for(url)
    if chemin.exists() and not force:
        return FetchResult(
            url=url,
            cache_path=str(chemin),
            status=200,
            from_cache=True,
            fetched_at=datetime.fromtimestamp(chemin.stat().st_mtime, UTC).isoformat(),
            error=None,
        )

    statut: int | None = None
    erreur: str | None = None
    for tentative, pause in enumerate(BACKOFFS):
        _throttle()
        try:
            reponse = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        except Exception as exc:  # noqa: BLE001 - any transport failure is retryable
            erreur = f"{type(exc).__name__}: {exc}"
        else:
            statut = reponse.status_code
            if statut < 400:
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                chemin.write_text(reponse.content.decode("utf-8"), encoding="utf-8")
                erreur = None
                break
            erreur = f"HTTP {statut}"
            if statut < 500:
                break  # client error: no retry, no cache file
        if tentative < len(BACKOFFS) - 1:
            time.sleep(pause)

    resultat = FetchResult(
        url=url,
        cache_path=str(chemin) if erreur is None else "",
        status=statut,
        from_cache=False,
        fetched_at=datetime.now(UTC).isoformat(),
        error=erreur,
    )
    _append_index(resultat)
    return resultat


def fetch_many(
    urls: Iterable[str], *, workers: int = 4, force: bool = False
) -> list[FetchResult]:
    """Fetch every URL through a thread pool; the throttle stays global."""
    liste = list(urls)
    if not liste:
        return []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(lambda u: fetch(u, force=force), liste))


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description="Récupération HTTP cachée et polie.")
    parseur.add_argument("--urls-file", required=True, help="fichier texte, une URL par ligne")
    parseur.add_argument("--force", action="store_true", help="ignorer le cache")
    parseur.add_argument("--workers", type=int, default=4, help="threads (défaut 4)")
    args = parseur.parse_args(argv)

    urls = [
        ligne.strip()
        for ligne in Path(args.urls_file).read_text(encoding="utf-8").splitlines()
        if ligne.strip() and not ligne.startswith("#")
    ]
    resultats = fetch_many(urls, workers=args.workers, force=args.force)
    caches = sum(1 for r in resultats if r["from_cache"])
    echecs = [r for r in resultats if r["error"]]
    print(f"{len(resultats)} url(s): {caches} cache-hit, {len(resultats) - caches} live, "
          f"{len(echecs)} échec(s)")
    for r in echecs:
        print(f"  ÉCHEC {r['url']} -> {r['error']}")
    return 1 if echecs else 0


if __name__ == "__main__":
    raise SystemExit(main())
