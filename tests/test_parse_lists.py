"""Unit tests for the class-list parser plus checks on its committed output."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from jsonschema import Draft202012Validator

from pf_spells import parse_lists

LI_SIMPLE = (
    '<ul><li><b><i><a class="pagelink" '
    'href="Pathfinder-RPG.Assistance%20divine.ashx" '
    'title="Assistance divine">Assistance divine</a></i></b>. '
    "+1 sur un jet d'attaque.</li></ul>"
)
LI_SOURCE = (
    '<ul><li><b><i><a class="pagelink" href="Pathfinder-RPG.Diplomatie.ashx">'
    "Diplomatie améliorée</a></i></b> <i>(RSE)</i>. "
    "+2 à un unique test de Diplomatie.</li></ul>"
)
LI_DEUX_SOURCES = (
    '<ul><li><b><i><a class="pagelink" href="Pathfinder-RPG.X.ashx">Sort X</a></i></b> '
    "<i>(AM)</i> <i>(LD)</i>. Une description.</li></ul>"
)
LI_NAV = '<ul><li><a class="pagelink" href="Pathfinder-RPG.Lancer.ashx">Lancer</a></li></ul>'


def li_de(fragment: str):
    return BeautifulSoup(fragment, "lxml").find("li")


def page(corps: str) -> str:
    return f'<html><body><div id="PageContentDiv">{corps}</div></body></html>'


def h2(titre: str) -> str:
    return (
        f'<h2 class="separator">{titre}'
        f'<a class="headeranchor" href="#x" title="Lien vers cette section">¶</a></h2>'
    )


def h3(titre: str) -> str:
    return f'<h3>{titre}<a class="headeranchor" href="#y">¶</a></h3>'


class TestHelpers:
    def test_heading_text_strips_anchor(self):
        node = BeautifulSoup(h2("Sorts de niveau 3"), "lxml").find("h2")
        assert parse_lists.heading_text(node) == "Sorts de niveau 3"

    @pytest.mark.parametrize(
        "titre,attendu",
        [
            ("Sorts de niveau 0", "0"),
            ("Formules de niveau 6", "6"),
            ("Sorts de niveau 9", "9"),
        ],
    )
    def test_niveau_h2_matches_both_wordings(self, titre, attendu):
        assert parse_lists.NIVEAU_H2.match(titre).group(1) == attendu

    def test_niveau_h2_rejects_nav_heading(self):
        assert parse_lists.NIVEAU_H2.match("Accès rapide aux sections sur la magie") is None

    def test_source_tags_none(self):
        li = li_de(LI_SIMPLE)
        assert parse_lists.source_tags(li.find("b", recursive=False)) == []

    def test_source_tags_one(self):
        li = li_de(LI_SOURCE)
        assert parse_lists.source_tags(li.find("b", recursive=False)) == ["RSE"]

    def test_source_tags_several(self):
        li = li_de(LI_DEUX_SOURCES)
        assert parse_lists.source_tags(li.find("b", recursive=False)) == ["AM", "LD"]

    def test_blurb_drops_name_and_tag(self):
        li = li_de(LI_SOURCE)
        assert (
            parse_lists.short_blurb(li, 1) == "+2 à un unique test de Diplomatie."
        )

    def test_blurb_keeps_accents_and_strips_leading_period(self):
        li = li_de(LI_SIMPLE)
        assert parse_lists.short_blurb(li, 0) == "+1 sur un jet d'attaque."


class TestParseClassPage:
    def _parse(self, corps: str, tmp_path: Path, **kw):
        chemin = tmp_path / "p.html"
        chemin.write_text(page(corps), encoding="utf-8")
        classe = {"classe": "Test", "slug": "test", "cache_fichier": str(chemin)}
        return parse_lists.parse_class_page(classe, kw.get("g", {}), kw.get("s", set()), [])

    def test_nav_heading_is_not_a_level(self, tmp_path):
        corps = h2("Accès rapide aux sections sur la magie") + LI_NAV + LI_SIMPLE
        lignes, ignores = self._parse(corps, tmp_path)
        assert lignes == []
        assert len(ignores) == 2
        assert {i["raison"] for i in ignores} == {
            "aucun <b><i><a class=pagelink>",
            "entrée avant tout <h2> de niveau",
        }

    def test_level_and_school_state(self, tmp_path):
        corps = (
            h2("Accès rapide aux sections sur la magie")
            + h2("Sorts de niveau 2")
            + h3("Abjuration")
            + LI_SIMPLE
            + h2("Formules de niveau 3")
            + LI_SOURCE
        )
        lignes, _ = self._parse(corps, tmp_path)
        assert [(l["niveau"], l["ecole"]) for l in lignes] == [(2, "Abjuration"), (3, None)]

    def test_record_shape_and_url_absolutization(self, tmp_path):
        lignes, _ = self._parse(h2("Sorts de niveau 0") + LI_SIMPLE, tmp_path)
        assert lignes[0] == {
            "id": "assistance-divine",
            "nom": "Assistance divine",
            "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Assistance%20divine.ashx",
            "classe": "Test",
            "niveau": 0,
            "ecole": None,
            "description_courte": "+1 sur un jet d'attaque.",
            "sources": [],
            "ligne_html": lignes[0]["ligne_html"],
        }
        assert lignes[0]["ligne_html"].startswith("<b><i><a class=")

    def test_global_slug_map_shared_across_classes(self, tmp_path):
        globaux, vus = {}, set()
        corps = h2("Sorts de niveau 1") + LI_SIMPLE
        a, _ = self._parse(corps, tmp_path, g=globaux, s=vus)
        b, _ = self._parse(corps, tmp_path, g=globaux, s=vus)
        assert a[0]["id"] == b[0]["id"] == "assistance-divine"
        assert vus == {"assistance-divine"}

    def test_distinct_names_colliding_on_slug_get_suffix(self, tmp_path):
        autre = LI_SIMPLE.replace(">Assistance divine<", ">Assistance  divine!<")
        corps = h2("Sorts de niveau 1") + LI_SIMPLE + autre
        chemin = tmp_path / "c.html"
        chemin.write_text(page(corps), encoding="utf-8")
        collisions: list[dict] = []
        lignes, _ = parse_lists.parse_class_page(
            {"classe": "T", "slug": "t", "cache_fichier": str(chemin)}, {}, set(), collisions
        )
        assert [l["id"] for l in lignes] == ["assistance-divine", "assistance-divine-2"]
        assert collisions[0]["slug_attribue"] == "assistance-divine-2"

    def test_nested_li_not_double_counted(self, tmp_path):
        imbrique = (
            '<ul><li><b><i><a class="pagelink" href="Pathfinder-RPG.A.ashx">Sort A</a></i></b>. Blurb.'
            '<ul><li><b><i><a class="pagelink" href="Pathfinder-RPG.B.ashx">Sort B</a></i></b>. B.</li></ul>'
            "</li></ul>"
        )
        lignes, _ = self._parse(h2("Sorts de niveau 1") + imbrique, tmp_path)
        assert [l["nom"] for l in lignes] == ["Sort A"]

    def test_content_outside_page_content_div_is_ignored(self, tmp_path):
        chemin = tmp_path / "nav.html"
        chemin.write_text(
            "<html><body>"
            + h2("Sorts de niveau 1")
            + '<ul><li><b><i><a class="pagelink" href="http://evil.example/x">Nav</a></i></b></li></ul>'
            + page(h2("Sorts de niveau 1") + LI_SIMPLE)
            + "</body></html>",
            encoding="utf-8",
        )
        lignes, _ = parse_lists.parse_class_page(
            {"classe": "T", "slug": "t", "cache_fichier": str(chemin)}, {}, set(), []
        )
        assert [l["nom"] for l in lignes] == ["Assistance divine"]


class TestWriteJsonl:
    def test_compact_lf_utf8_ordered(self, tmp_path):
        ligne = {cle: None for cle in parse_lists.KEY_ORDER}
        ligne.update(
            {"id": "x", "nom": "Épée", "url": "u", "classe": "C", "niveau": 1, "sources": []}
        )
        chemin = tmp_path / "out.jsonl"
        parse_lists.write_jsonl(chemin, [ligne])
        brut = chemin.read_bytes()
        assert not brut.startswith(b"\xef\xbb\xbf")
        assert b"\r\n" not in brut and brut.endswith(b"\n")
        texte = brut.decode("utf-8")
        assert '"nom":"Épée"' in texte
        assert list(json.loads(texte).keys()) == list(parse_lists.KEY_ORDER)


class TestNoNetwork:
    def test_module_source_has_no_http_client(self, repo_root: Path):
        source = (repo_root / "src/pf_spells/parse_lists.py").read_text(encoding="utf-8")
        for interdit in ("requests", "urllib.request", "httpx", "socket"):
            assert interdit not in source


@pytest.fixture(scope="module")
def corpus(repo_root: Path) -> dict[str, list[dict]]:
    dossier = repo_root / "data/listes_classes"
    if not dossier.is_dir():
        pytest.skip("data/listes_classes not generated yet")
    return {
        p.stem: [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines()]
        for p in sorted(dossier.glob("*.jsonl"))
    }


class TestGeneratedCorpus:
    def test_one_file_per_class(self, repo_root: Path, corpus):
        classes = json.loads((repo_root / "data/classes.json").read_text(encoding="utf-8"))
        assert set(corpus) == {c["slug"] for c in classes}
        assert len(corpus) == 19

    def test_every_line_validates(self, repo_root: Path, corpus):
        schema = json.loads(
            (repo_root / "schemas/liste_classe.schema.json").read_text(encoding="utf-8")
        )
        validateur = Draft202012Validator(schema)
        for slug, lignes in corpus.items():
            for ligne in lignes:
                assert list(ligne.keys()) == list(parse_lists.KEY_ORDER)
                assert not list(validateur.iter_errors(ligne)), (slug, ligne["id"])

    def test_minimum_entries_per_class(self, corpus):
        assert all(len(v) >= 50 for v in corpus.values())

    def test_expected_magnitudes(self, corpus):
        assert len(corpus["arcaniste-ensorceleur-magicien"]) == 1225
        assert len(corpus["arcaniste-ensorceleur-magicien"]) == max(
            len(v) for v in corpus.values()
        )
        assert len(corpus["occultiste"]) == 511
        assert len(corpus["paladin"]) == 199
        assert len(corpus["alchimiste"]) == 275

    def test_level_ranges(self, corpus):
        for lignes in corpus.values():
            for ligne in lignes:
                assert isinstance(ligne["niveau"], int) and 0 <= ligne["niveau"] <= 9
        assert {l["niveau"] for l in corpus["paladin"]} == {1, 2, 3, 4}
        assert {l["niveau"] for l in corpus["alchimiste"]} == {1, 2, 3, 4, 5, 6}

    def test_global_id_consistency(self, corpus):
        par_nom: dict[str, set[str]] = {}
        for lignes in corpus.values():
            for ligne in lignes:
                par_nom.setdefault(ligne["nom"], set()).add(ligne["id"])
        assert [n for n, ids in par_nom.items() if len(ids) > 1] == []

    def test_shared_spell_same_id(self, corpus):
        ids = {
            slug: next(
                l["id"] for l in corpus[slug] if l["nom"] == "Détection de la magie"
            )
            for slug in ("druide", "arcaniste-ensorceleur-magicien")
        }
        assert set(ids.values()) == {"detection-de-la-magie"}

    def test_school_grouping_both_behaviours(self, corpus):
        for slug in ("occultiste", "arcaniste-ensorceleur-magicien"):
            assert all(l["ecole"] for l in corpus[slug])
        for slug in ("druide", "paladin", "alchimiste"):
            assert all(l["ecole"] is None for l in corpus[slug])

    def test_no_nav_leak(self, corpus):
        for lignes in corpus.values():
            for ligne in lignes:
                assert "Accès rapide" not in ligne["nom"]
                assert ligne["url"].startswith("https://www.pathfinder-fr.org/Wiki/")

    def test_sources_populated(self, corpus):
        ligne = next(
            l for l in corpus["druide"] if l["nom"] == "Diplomatie améliorée"
        )
        assert ligne["sources"] == ["RSE"]
        assert any(l["sources"] for lignes in corpus.values() for l in lignes)

    def test_sorted_by_level_then_name(self, corpus):
        for lignes in corpus.values():
            cles = [(l["niveau"], l["nom"]) for l in lignes]
            assert cles == sorted(cles)

    def test_report_exists(self, repo_root: Path):
        rapport = repo_root / "reports/04_parse_lists.md"
        assert rapport.is_file()
        assert "Rapport 04" in rapport.read_text(encoding="utf-8")
