"""A second run over an already-populated cache must touch the network zero
times. This is the criterion the report of `recuperer_pages_classes.py`
claims, so it is pinned here rather than trusted on faith. Any live request
that reaches `requests.get` in this suite is a hard failure.
"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest


@pytest.fixture()
def module_isole(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Import the module fresh, then point every path constant at tmp_path."""
    racine_src = str(Path(__file__).resolve().parents[2] / "tools" / "regles")
    monkeypatch.syspath_prepend(racine_src)
    sys.modules.pop("recuperer_pages_classes", None)
    module = importlib.import_module("recuperer_pages_classes")

    registre = tmp_path / "classes_unifiees.json"
    registre.write_text(
        json.dumps(
            {
                "version": 1,
                "classes": [
                    {"slug": "guerrier", "nom": "Guerrier"},
                    {"slug": "sorciere", "nom": "Sorcière"},
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(module, "REGISTRE", registre)
    monkeypatch.setattr(module, "CACHE_DIR", tmp_path / "cache" / "html_classes")
    monkeypatch.setattr(module, "INDEX_PATH", tmp_path / "cache" / "html_classes" / "index.jsonl")
    monkeypatch.setattr(module, "REPORT_PATH", tmp_path / "reports" / "regles_recuperation_classes.md")
    monkeypatch.setattr(module, "_last_request", 0.0)
    monkeypatch.setattr(module, "_temps_requetes", [])
    return module


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def interdit(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr("requests.get", interdit)


def test_second_run_makes_zero_requests(module_isole, tmp_path: Path) -> None:
    module = module_isole
    # Pre-seed the cache exactly as a first successful run would leave it —
    # this test asserts the *second* run's behaviour, not the fetch itself.
    module.CACHE_DIR.mkdir(parents=True)
    (module.CACHE_DIR / "guerrier.html").write_bytes(b"<html>guerrier</html>")
    (module.CACHE_DIR / "sorciere.html").write_bytes(b"<html>sorciere</html>")

    code = module.executer(force=False)

    assert code == 0
    assert module._temps_requetes == []
    index_lignes = module.INDEX_PATH.read_text(encoding="utf-8").splitlines()
    assert len(index_lignes) == 2
    for ligne in index_lignes:
        entree = json.loads(ligne)
        assert entree["origine"] == "reseau"


def test_running_twice_is_stable_and_network_free_the_second_time(
    module_isole, tmp_path: Path
) -> None:
    module = module_isole
    module.CACHE_DIR.mkdir(parents=True)
    (module.CACHE_DIR / "guerrier.html").write_bytes(b"<html>guerrier</html>")
    (module.CACHE_DIR / "sorciere.html").write_bytes(b"<html>sorciere</html>")

    module.executer(force=False)
    premier_index = module.INDEX_PATH.read_bytes()

    module.executer(force=False)
    second_index = module.INDEX_PATH.read_bytes()

    assert module._temps_requetes == []  # still zero after two runs
    # `date` differs by construction (freshly rewritten each run), so compare
    # everything except that one field rather than the raw bytes.
    lignes_a = [json.loads(l) for l in premier_index.decode("utf-8").splitlines()]
    lignes_b = [json.loads(l) for l in second_index.decode("utf-8").splitlines()]
    for a, b in zip(lignes_a, lignes_b, strict=True):
        a.pop("date")
        b.pop("date")
        assert a == b
