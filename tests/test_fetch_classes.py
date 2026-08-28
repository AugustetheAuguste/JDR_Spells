"""Tests for the step-03 driver.

Two layers: unit tests that run the driver against an isolated, pre-seeded
cache with the network hard-blocked, and contract tests that assert the real
committed artifacts satisfy step 03's verification criteria.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pf_spells import fetch_classes, fetcher

CLES_CONTRAT = [
    "classe",
    "slug",
    "url",
    "cache_fichier",
    "taille_octets",
    "statut",
    "note",
]

# A body big enough to clear the 20 KB sanity floor, with the content marker.
CORPS_VALIDE = '<div id="PageContentDiv">Résistance à la magie ' + "x" * 25_000 + "</div>"


@pytest.fixture
def bac_a_sable(
    tmp_path: Path, repo_root: Path, monkeypatch: pytest.MonkeyPatch
) -> Path:
    """Run the driver in a temp cwd with its own cache, network forbidden."""
    html_dir = tmp_path / "cache" / "html"
    html_dir.mkdir(parents=True)
    monkeypatch.setattr(fetcher, "CACHE_DIR", html_dir)
    monkeypatch.setattr(fetcher, "CACHE_INDEX", tmp_path / "cache" / "index.jsonl")

    def interdit(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(fetcher.requests, "get", interdit)

    (tmp_path / "elements_to_do.json").write_text(
        (repo_root / "elements_to_do.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(fetch_classes, "ROSTER_PATH", Path("data/classes.json"))
    monkeypatch.setattr(fetch_classes, "REPORT_PATH", Path("reports/03_fetch_classes.md"))
    return tmp_path


def _preremplir(corps: str = CORPS_VALIDE) -> list[dict]:
    """Seed the cache for every class URL; return the class entries."""
    entrees, _ = fetch_classes.load_classes()
    for entree in entrees:
        fetcher.cache_path_for(entree["url"]).write_text(corps, encoding="utf-8")
    return entrees


def test_dedupe_yields_nineteen_classes_and_logs_the_alchimiste_drop() -> None:
    entrees, abandons = fetch_classes.load_classes()
    assert len(entrees) == 19
    assert len(abandons) == 1
    assert abandons[0]["label"] == "Alchimiste"
    assert "Liste%20des%20formules" in abandons[0]["url"]


def test_driver_succeeds_offline_on_a_warm_cache(bac_a_sable: Path) -> None:
    _preremplir()

    assert fetch_classes.executer() == 0

    roster = json.loads(Path("data/classes.json").read_text(encoding="utf-8"))
    assert len(roster) == 19
    assert all(ligne["statut"] == "ok" for ligne in roster)
    assert all(ligne["note"] is None for ligne in roster)
    # No live fetch happened, so the journal was never appended to.
    assert not fetcher.CACHE_INDEX.exists()


def test_roster_keys_are_exactly_the_contract_in_order(bac_a_sable: Path) -> None:
    _preremplir()
    fetch_classes.executer()

    roster = json.loads(Path("data/classes.json").read_text(encoding="utf-8"))
    assert all(list(ligne) == CLES_CONTRAT for ligne in roster)


def test_roster_is_sorted_by_slug(bac_a_sable: Path) -> None:
    _preremplir()
    fetch_classes.executer()

    slugs = [l["slug"] for l in json.loads(Path("data/classes.json").read_text("utf-8"))]
    assert slugs == sorted(slugs)


def test_short_body_is_flagged_as_erreur_and_the_step_blocks(
    bac_a_sable: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    entrees = _preremplir()
    # Truncate one page below the 20 KB floor; the forced retry cannot save it.
    fetcher.cache_path_for(entrees[0]["url"]).write_text(
        '<div id="PageContentDiv">trop court</div>', encoding="utf-8"
    )

    assert fetch_classes.executer() == 1

    roster = json.loads(Path("data/classes.json").read_text(encoding="utf-8"))
    fautif = [l for l in roster if l["statut"] == "erreur"]
    assert len(fautif) == 1
    assert "corps suspect" in fautif[0]["note"] or "network" in fautif[0]["note"]


def test_missing_content_marker_is_flagged(bac_a_sable: Path) -> None:
    entrees = _preremplir()
    fetcher.cache_path_for(entrees[0]["url"]).write_text(
        "<html>page d'erreur</html>" + "y" * 25_000, encoding="utf-8"
    )

    assert fetch_classes.executer() == 1

    roster = json.loads(Path("data/classes.json").read_text(encoding="utf-8"))
    assert any(l["statut"] == "erreur" for l in roster)


def test_report_documents_the_dropped_duplicate(bac_a_sable: Path) -> None:
    _preremplir()
    fetch_classes.executer()

    rapport = Path("reports/03_fetch_classes.md").read_text(encoding="utf-8")
    assert "Alchimiste" in rapport
    assert "Entrées dédoublonnées" in rapport
    assert "Liste%20des%20formules" in rapport


def test_rerun_is_idempotent(bac_a_sable: Path) -> None:
    _preremplir()
    fetch_classes.executer()
    premier = Path("data/classes.json").read_text(encoding="utf-8")

    fetch_classes.executer()

    assert Path("data/classes.json").read_text(encoding="utf-8") == premier


def test_driver_has_no_http_or_dedup_logic_of_its_own(repo_root: Path) -> None:
    source = (repo_root / "src" / "pf_spells" / "fetch_classes.py").read_text(
        encoding="utf-8"
    )
    assert "requests" not in source
    assert "unquote" not in source
    assert "from pf_spells.fetcher import" in source
    assert "from pf_spells.classes import" in source


# --- Contract tests on the real committed artifacts -----------------------


@pytest.fixture(scope="module")
def roster_reel(repo_root: Path) -> list[dict]:
    chemin = repo_root / "data" / "classes.json"
    if not chemin.exists():
        pytest.skip("data/classes.json not generated yet")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_real_roster_has_nineteen_ok_classes(roster_reel: list[dict]) -> None:
    assert len(roster_reel) == 19
    assert [l for l in roster_reel if l["statut"] != "ok"] == []


def test_real_cached_pages_are_utf8_sane_and_sliceable(
    roster_reel: list[dict], repo_root: Path
) -> None:
    if not (repo_root / "cache" / "html").is_dir():
        pytest.skip("cache/html/ n'est pas committé (scraping clos)")
    for ligne in roster_reel:
        chemin = repo_root / ligne["cache_fichier"]
        assert chemin.exists(), ligne["cache_fichier"]
        html = chemin.read_text(encoding="utf-8")  # raises if not UTF-8
        assert chemin.stat().st_size >= 20_000
        assert 'id="PageContentDiv"' in html
        assert 'id="PageAttachmentsDiv"' in html


def test_real_arcaniste_is_largest_and_paladin_among_smallest(
    roster_reel: list[dict],
) -> None:
    par_taille = sorted(roster_reel, key=lambda l: l["taille_octets"])
    assert par_taille[-1]["slug"] == "arcaniste-ensorceleur-magicien"
    assert "paladin" in [l["slug"] for l in par_taille[:3]]


def test_real_cache_index_lines_all_parse_as_json(repo_root: Path) -> None:
    chemin = repo_root / "cache" / "index.jsonl"
    if not chemin.exists():
        pytest.skip("cache/index.jsonl not generated yet")
    lignes = chemin.read_text(encoding="utf-8").splitlines()
    assert lignes
    for ligne in lignes:
        enregistrement = json.loads(ligne)
        assert enregistrement["url"].startswith("https://")


def test_real_pages_have_level_sections_and_a_nav_h2(
    roster_reel: list[dict], repo_root: Path
) -> None:
    """Each page holds >=4 level headings plus exactly one non-level h2 (nav)."""
    import re

    if not (repo_root / "cache" / "html").is_dir():
        pytest.skip("cache/html/ n'est pas committé (scraping clos)")
    for ligne in roster_reel:
        html = (repo_root / ligne["cache_fichier"]).read_text(encoding="utf-8")
        region = html[
            html.index('id="PageContentDiv"') : html.index('id="PageAttachmentsDiv"')
        ]
        titres = re.findall(r'<h2[^>]*class="separator"[^>]*>(.*?)</h2>', region, re.S)
        niveaux = [t for t in titres if re.search(r"(Sorts|Formules) de niveau", t)]
        assert len(niveaux) >= 4, ligne["slug"]
        assert len(titres) - len(niveaux) == 1, ligne["slug"]
