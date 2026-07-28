from __future__ import annotations

import hashlib
import time
from pathlib import Path

import pytest

from pf_spells import fetcher

URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Armes%20contre%20le%20mal.ashx"


@pytest.fixture(autouse=True)
def cache_isole(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Point the fetcher's cache at a temp dir so tests never touch the repo."""
    html_dir = tmp_path / "cache" / "html"
    html_dir.mkdir(parents=True)
    monkeypatch.setattr(fetcher, "CACHE_DIR", html_dir)
    monkeypatch.setattr(fetcher, "CACHE_INDEX", tmp_path / "cache" / "index.jsonl")
    return html_dir


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Any live request in the suite is a hard failure."""

    def interdit(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(fetcher.requests, "get", interdit)


def test_cache_path_is_sha1_of_url(cache_isole: Path) -> None:
    attendu = hashlib.sha1(URL.encode("utf-8")).hexdigest()
    assert fetcher.cache_path_for(URL) == cache_isole / f"{attendu}.html"


def test_fetch_serves_preseeded_cache_without_network(
    cache_isole: Path, pages_dir: Path
) -> None:
    chemin = fetcher.cache_path_for(URL)
    chemin.write_text(
        (pages_dir / "sorts" / "exemple_1.html").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    resultat = fetcher.fetch(URL)

    assert resultat["from_cache"] is True
    assert resultat["status"] == 200
    assert resultat["error"] is None
    assert Path(resultat["cache_path"]) == chemin
    assert not fetcher.CACHE_INDEX.exists()  # cache hits are not live fetches


def test_fetch_many_all_cache_hits_without_network(
    cache_isole: Path, pages_dir: Path
) -> None:
    urls = [f"{URL}?v={n}" for n in range(4)]
    source = (pages_dir / "sorts" / "exemple_1.html").read_text(encoding="utf-8")
    for url in urls:
        fetcher.cache_path_for(url).write_text(source, encoding="utf-8")

    resultats = fetcher.fetch_many(urls, workers=4)

    assert len(resultats) == 4
    assert all(r["from_cache"] for r in resultats)


def test_force_bypasses_cache_and_therefore_hits_the_stub(
    cache_isole: Path, pages_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(fetcher, "BACKOFFS", (0.0,))
    monkeypatch.setattr(fetcher, "MIN_INTERVAL", 0.0)
    fetcher.cache_path_for(URL).write_text("cache", encoding="utf-8")

    resultat = fetcher.fetch(URL, force=True)

    assert resultat["from_cache"] is False
    assert "network access attempted" in (resultat["error"] or "")
    assert fetcher.CACHE_INDEX.exists()


def test_throttle_enforces_minimum_interval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fetcher, "MIN_INTERVAL", 0.05)
    monkeypatch.setattr(fetcher, "_last_request", 0.0)
    fetcher._throttle()
    debut = time.monotonic()
    fetcher._throttle()
    assert time.monotonic() - debut >= 0.04


def test_user_agent_is_the_polite_one() -> None:
    assert fetcher.USER_AGENT == "JDR_Spells corpus builder (personal, polite crawl)"
