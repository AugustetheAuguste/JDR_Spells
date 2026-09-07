"""A second run over an already-populated cache must touch the network zero
times. Same posture as `tests/regles/test_recuperer_pages_classes.py`.
"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest


@pytest.fixture()
def module_isole(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    racine_src = str(Path(__file__).resolve().parents[2] / "tools" / "regles")
    monkeypatch.syspath_prepend(racine_src)
    sys.modules.pop("recuperer_pages_regles", None)
    module = importlib.import_module("recuperer_pages_regles")

    monkeypatch.setattr(module, "CACHE_DIR", tmp_path / "cache" / "html_regles")
    monkeypatch.setattr(module, "INDEX_PATH", tmp_path / "cache" / "html_regles" / "index.jsonl")
    monkeypatch.setattr(module, "REPORT_PATH", tmp_path / "reports" / "regles_recuperation.md")
    monkeypatch.setattr(module, "_last_request", 0.0)
    monkeypatch.setattr(module, "_temps_requetes", [])
    return module


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def interdit(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr("requests.get", interdit)


def _seed_cache(module) -> None:
    module.CACHE_DIR.mkdir(parents=True)
    for slug in module.PAGES:
        (module.CACHE_DIR / f"{slug}.html").write_bytes(f"<html>{slug}</html>".encode())


def test_second_run_makes_zero_requests(module_isole) -> None:
    module = module_isole
    _seed_cache(module)

    code = module.executer(force=False)

    assert code == 0
    assert module._temps_requetes == []
    lignes = module.INDEX_PATH.read_text(encoding="utf-8").splitlines()
    assert len(lignes) == len(module.PAGES)


def test_running_twice_is_stable_and_network_free(module_isole) -> None:
    module = module_isole
    _seed_cache(module)

    module.executer(force=False)
    premier = module.INDEX_PATH.read_bytes()
    module.executer(force=False)
    second = module.INDEX_PATH.read_bytes()

    assert module._temps_requetes == []
    lignes_a = [json.loads(l) for l in premier.decode("utf-8").splitlines()]
    lignes_b = [json.loads(l) for l in second.decode("utf-8").splitlines()]
    for a, b in zip(lignes_a, lignes_b, strict=True):
        a.pop("date")
        b.pop("date")
        assert a == b


def test_url_uses_uppercase_percent_encoding(module_isole) -> None:
    module = module_isole
    url = module._url_pour("Caractéristiques")
    assert "%C3%A9" in url  # uppercase hex, cf. CLAUDE.md §3
    assert url.startswith("https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.")
