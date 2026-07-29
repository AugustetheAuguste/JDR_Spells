"""Tests for the step-06 driver.

Two layers: unit tests that run the driver against an isolated, pre-seeded
cache with the network hard-blocked, and contract tests that assert the real
committed artifacts satisfy step 06's verification criteria.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pf_spells import fetch_spells, fetcher

CLES_CONTRAT = [
    "id",
    "nom",
    "url",
    "cache_fichier",
    "taille_octets",
    "statut",
    "from_cache",
    "note",
]

URL_BASE = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."


def _corps(taille: int = 9_000, *, contenu: bool = True, titre: bool = True,
           statbloc: bool = True) -> str:
    """A spell-page body that clears (or deliberately fails) the sanity gates."""
    morceaux = []
    if contenu:
        morceaux.append('<div id="PageContentDiv">')
    if titre:
        morceaux.append('<h1 class="pagetitle">Sort de test</h1>')
    if statbloc:
        morceaux.append("<b>École</b> Évocation<br><b>Niveau</b> Mag 3")
    bourrage = "Résistance à la magie oui. " * 400
    morceaux.append(bourrage)
    corps = "".join(morceaux)
    if len(corps.encode("utf-8")) < taille:
        corps += "z" * (taille - len(corps.encode("utf-8")))
    return corps


def _ecrire_listes(racine: Path, entrees: list[tuple[str, str, str]]) -> None:
    """Write a fake data/listes_classes tree from (fichier, id, nom) triples."""
    dossier = racine / "data" / "listes_classes"
    dossier.mkdir(parents=True, exist_ok=True)
    par_fichier: dict[str, list[dict]] = {}
    for fichier, identifiant, nom in entrees:
        par_fichier.setdefault(fichier, []).append(
            {"id": identifiant, "nom": nom, "url": URL_BASE + identifiant + ".ashx"}
        )
    for fichier, lignes in par_fichier.items():
        (dossier / f"{fichier}.jsonl").write_text(
            "".join(json.dumps(l, ensure_ascii=False) + "\n" for l in lignes),
            encoding="utf-8",
        )


@pytest.fixture
def bac_a_sable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Run the driver in a temp cwd with its own cache, network forbidden."""
    html_dir = tmp_path / "cache" / "html"
    html_dir.mkdir(parents=True)
    monkeypatch.setattr(fetcher, "CACHE_DIR", html_dir)
    monkeypatch.setattr(fetcher, "CACHE_INDEX", tmp_path / "cache" / "index.jsonl")

    def interdit(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(fetcher.requests, "get", interdit)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(fetch_spells, "LISTES_DIR", Path("data/listes_classes"))
    monkeypatch.setattr(fetch_spells, "MANIFEST_PATH", Path("data/spell_pages.jsonl"))
    monkeypatch.setattr(fetch_spells, "REPORT_PATH", Path("reports/06_fetch_spells.md"))
    # The real sanity band expects thousands of URLs; fixtures use a handful.
    monkeypatch.setattr(fetch_spells, "BANDE_MINIMALE", 0)
    return tmp_path


def _seed(racine: Path, entrees: list[tuple[str, str, str]], **kwargs) -> None:
    _ecrire_listes(racine, entrees)
    for _, identifiant, _ in entrees:
        fetcher.cache_path_for(URL_BASE + identifiant + ".ashx").write_text(
            _corps(**kwargs), encoding="utf-8"
        )


def _manifeste() -> list[dict]:
    return [
        json.loads(l)
        for l in Path("data/spell_pages.jsonl").read_text(encoding="utf-8").splitlines()
    ]


def test_targets_are_deduplicated_across_class_files(bac_a_sable: Path) -> None:
    _ecrire_listes(
        bac_a_sable,
        [
            ("barde", "sort-a", "Sort A"),
            ("barde", "sort-b", "Sort B"),
            ("druide", "sort-a", "Sort A"),  # same spell, second class
        ],
    )

    cibles, lignes_vues = fetch_spells.collecter_cibles()

    assert lignes_vues == 3
    assert len(cibles) == 2
    assert {c["id"] for c in cibles.values()} == {"sort-a", "sort-b"}


def test_missing_class_lists_is_a_hard_stop(bac_a_sable: Path) -> None:
    (bac_a_sable / "data" / "listes_classes").mkdir(parents=True)
    with pytest.raises(SystemExit):
        fetch_spells.collecter_cibles()


def test_driver_succeeds_offline_on_a_warm_cache(bac_a_sable: Path) -> None:
    _seed(bac_a_sable, [("barde", "sort-a", "Sort A"), ("druide", "sort-b", "Sort B")])

    assert fetch_spells.executer() == 0

    manifeste = _manifeste()
    assert len(manifeste) == 2
    assert all(l["statut"] == "ok" for l in manifeste)
    assert all(l["from_cache"] is True for l in manifeste)
    assert all(l["note"] is None for l in manifeste)
    # No live fetch happened, so the journal was never appended to.
    assert not fetcher.CACHE_INDEX.exists()


def test_manifest_keys_are_exactly_the_contract_in_order(bac_a_sable: Path) -> None:
    _seed(bac_a_sable, [("barde", "sort-a", "Sort A")])
    fetch_spells.executer()

    assert all(list(l) == CLES_CONTRAT for l in _manifeste())


def test_manifest_is_sorted_by_id_and_compact(bac_a_sable: Path) -> None:
    _seed(
        bac_a_sable,
        [("barde", "zeta", "Zeta"), ("barde", "alpha", "Alpha"), ("barde", "mu", "Mu")],
    )
    fetch_spells.executer()

    lignes = Path("data/spell_pages.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(l)["id"] for l in lignes] == ["alpha", "mu", "zeta"]
    assert '", "' not in lignes[0]  # compact separators, no spaces


def test_short_body_is_flagged_as_erreur(bac_a_sable: Path) -> None:
    _seed(bac_a_sable, [("barde", "sort-a", "Sort A")])
    fetcher.cache_path_for(URL_BASE + "sort-a.ashx").write_text(
        '<div id="PageContentDiv"><h1 class="pagetitle">x</h1>Niveau</div>',
        encoding="utf-8",
    )

    assert fetch_spells.executer() == 1

    fautif = [l for l in _manifeste() if l["statut"] == "erreur"]
    assert len(fautif) == 1
    assert "corps suspect" in fautif[0]["note"] or "network" in fautif[0]["note"]


def test_eight_kb_floor_not_the_twenty_kb_list_page_floor(bac_a_sable: Path) -> None:
    """A 9 KB spell page is valid; step 03's 20 KB gate must not be applied."""
    _seed(bac_a_sable, [("barde", "sort-a", "Sort A")], taille=9_000)

    assert fetch_spells.executer() == 0
    assert _manifeste()[0]["taille_octets"] < 20_000


@pytest.mark.parametrize(
    "absent, attendu",
    [
        ({"contenu": False}, 'id="PageContentDiv"'),
        ({"titre": False}, 'class="pagetitle"'),
        ({"statbloc": False}, "Niveau"),
    ],
)
def test_each_missing_marker_is_named_in_the_note(
    tmp_path: Path, absent: dict, attendu: str
) -> None:
    chemin = tmp_path / "page.html"
    chemin.write_text(_corps(**absent), encoding="utf-8")

    taille, raison = fetch_spells._controler(str(chemin))

    assert taille >= 8_000
    assert raison is not None
    assert "marqueur" in raison
    assert attendu in raison


def test_all_gates_pass_on_a_well_formed_page(tmp_path: Path) -> None:
    chemin = tmp_path / "page.html"
    chemin.write_text(_corps(), encoding="utf-8")

    assert fetch_spells._controler(str(chemin))[1] is None


@pytest.mark.parametrize(
    "chemin, attendu",
    [("", "aucun fichier de cache"), ("cache/html/absent.html", "absent")],
)
def test_controler_reports_a_missing_cache_file(chemin: str, attendu: str) -> None:
    taille, raison = fetch_spells._controler(chemin)
    assert taille == 0
    assert attendu in raison


def test_non_utf8_body_is_rejected_not_silently_mangled(tmp_path: Path) -> None:
    chemin = tmp_path / "page.html"
    chemin.write_bytes(_corps().encode("cp1252"))  # mojibake trap from the Skill

    taille, raison = fetch_spells._controler(str(chemin))

    assert taille > 0
    assert "UTF-8" in raison


def test_ok_rate_above_99_percent_still_exits_zero_as_a_known_gap(
    bac_a_sable: Path,
) -> None:
    entrees = [("barde", f"sort-{i:03d}", f"Sort {i}") for i in range(200)]
    _seed(bac_a_sable, entrees)
    # One genuine dead page out of 200 = 99.5 % ok: reported, not blocking.
    fetcher.cache_path_for(URL_BASE + "sort-000.ashx").write_text(
        "introuvable", encoding="utf-8"
    )

    assert fetch_spells.executer() == 0

    manifeste = _manifeste()
    assert len(manifeste) == 200
    assert sum(1 for l in manifeste if l["statut"] == "erreur") == 1
    rapport = Path("reports/06_fetch_spells.md").read_text(encoding="utf-8")
    assert "`sort-000`" in rapport
    assert "99.50 %" in rapport


def test_limit_flag_truncates_the_target_set(bac_a_sable: Path) -> None:
    _seed(bac_a_sable, [("barde", f"sort-{i}", f"Sort {i}") for i in range(5)])

    assert fetch_spells.executer(limit=2) == 0
    assert len(_manifeste()) == 2


def test_incremental_flush_happens_every_batch(
    bac_a_sable: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(fetch_spells, "LOT", 2)
    _seed(bac_a_sable, [("barde", f"sort-{i}", f"Sort {i}") for i in range(5)])
    ecrits: list[int] = []
    reel = fetch_spells._ecrire_manifeste
    monkeypatch.setattr(
        fetch_spells,
        "_ecrire_manifeste",
        lambda lignes: (ecrits.append(len(lignes)), reel(lignes))[1],
    )

    fetch_spells.executer()

    assert ecrits[:3] == [2, 4, 5]  # flushed after every batch, not just at the end


def test_report_states_totals_and_the_sharing_gap(bac_a_sable: Path) -> None:
    _seed(
        bac_a_sable,
        [("barde", "sort-a", "Sort A"), ("druide", "sort-a", "Sort A"),
         ("druide", "sort-b", "Sort B")],
    )
    fetch_spells.executer()

    rapport = Path("reports/06_fetch_spells.md").read_text(encoding="utf-8")
    assert "Lignes lues" in rapport
    assert "URL de sorts distinctes : **2**" in rapport
    assert "Aucun échec" in rapport
    assert "Durée totale" in rapport
    assert "Idempotence" in rapport


def test_rerun_is_idempotent(bac_a_sable: Path) -> None:
    _seed(bac_a_sable, [("barde", "sort-a", "Sort A"), ("barde", "sort-b", "Sort B")])
    fetch_spells.executer()
    premier = Path("data/spell_pages.jsonl").read_text(encoding="utf-8")

    fetch_spells.executer()

    assert Path("data/spell_pages.jsonl").read_text(encoding="utf-8") == premier


def test_driver_has_no_http_logic_of_its_own(repo_root: Path) -> None:
    source = (repo_root / "src" / "pf_spells" / "fetch_spells.py").read_text(
        encoding="utf-8"
    )
    for interdit in ("requests.", "httpx", "urlopen"):
        assert interdit not in source
    assert "from pf_spells.fetcher import" in source


# --- Contract tests on the real committed artifacts -----------------------


@pytest.fixture(scope="module")
def manifeste_reel(repo_root: Path) -> list[dict]:
    chemin = repo_root / "data" / "spell_pages.jsonl"
    if not chemin.exists():
        pytest.skip("data/spell_pages.jsonl not generated yet")
    return [
        json.loads(l) for l in chemin.read_text(encoding="utf-8").splitlines()
    ]


def test_real_manifest_lines_carry_exactly_the_contract_keys(
    manifeste_reel: list[dict],
) -> None:
    assert manifeste_reel
    assert all(list(l) == CLES_CONTRAT for l in manifeste_reel)


def test_real_manifest_count_equals_distinct_urls_in_class_lists(
    manifeste_reel: list[dict], repo_root: Path
) -> None:
    urls, lignes = set(), 0
    for fichier in sorted((repo_root / "data" / "listes_classes").glob("*.jsonl")):
        for brut in fichier.read_text(encoding="utf-8").splitlines():
            if brut.strip():
                lignes += 1
                urls.add(json.loads(brut)["url"])
    assert len(manifeste_reel) == len(urls)
    assert len(manifeste_reel) < lignes
    assert {l["url"] for l in manifeste_reel} == urls


def test_real_manifest_ids_are_unique_and_sorted(manifeste_reel: list[dict]) -> None:
    ids = [l["id"] for l in manifeste_reel]
    assert ids == sorted(ids)
    assert len(set(ids)) == len(ids)


def test_real_ok_rate_is_at_least_99_percent(manifeste_reel: list[dict]) -> None:
    ok = sum(1 for l in manifeste_reel if l["statut"] == "ok")
    assert ok / len(manifeste_reel) >= 0.99


def test_real_cached_spell_pages_pass_every_sanity_gate(
    manifeste_reel: list[dict], repo_root: Path
) -> None:
    for ligne in manifeste_reel:
        if ligne["statut"] != "ok":
            continue
        chemin = repo_root / ligne["cache_fichier"]
        assert chemin.exists(), ligne["cache_fichier"]
        html = chemin.read_text(encoding="utf-8")  # raises if not UTF-8
        assert chemin.stat().st_size >= 8_000, ligne["id"]
        assert 'id="PageContentDiv"' in html, ligne["id"]
        assert 'class="pagetitle"' in html, ligne["id"]
        assert "Niveau" in html, ligne["id"]


def test_real_cache_file_matches_the_url_sha1(manifeste_reel: list[dict]) -> None:
    from pf_spells.fetcher import cache_path_for

    for ligne in manifeste_reel:
        if ligne["statut"] == "ok":
            attendu = str(cache_path_for(ligne["url"])).replace("\\", "/")
            assert ligne["cache_fichier"] == attendu, ligne["id"]


def test_real_requiem_page_holds_its_variant_sub_block(
    manifeste_reel: list[dict], repo_root: Path
) -> None:
    """Step 07 parses nested variants out of this page; the bytes must be here."""
    cible = [l for l in manifeste_reel if l["id"] == "requiem-pour-les-fantomes"]
    assert cible, "requiem-pour-les-fantomes absent du manifeste"
    html = (repo_root / cible[0]["cache_fichier"]).read_text(encoding="utf-8")
    assert "Requiem pour les fantômes de groupe" in html


def test_real_report_exists_and_records_totals(repo_root: Path) -> None:
    chemin = repo_root / "reports" / "06_fetch_spells.md"
    if not chemin.exists():
        pytest.skip("reports/06_fetch_spells.md not generated yet")
    rapport = chemin.read_text(encoding="utf-8")
    for attendu in ("## Totaux", "## Échecs", "Durée totale", "Idempotence"):
        assert attendu in rapport
