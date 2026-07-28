from __future__ import annotations

from pathlib import Path

import pytest
from bs4 import BeautifulSoup, Tag

from pf_spells.htmlutil import (
    absolutize,
    clean_text,
    inner_html,
    load_html,
    normalize_label,
    page_content,
)

STAT_LABELS = [
    "ecole",
    "niveau",
    "temps d'incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet de sauvegarde",
    "resistance a la magie",
]


@pytest.fixture(scope="module")
def sort_1_html(pages_dir: Path) -> str:
    return load_html(pages_dir / "sorts" / "exemple_1.html")


@pytest.fixture(scope="module")
def druide_html(pages_dir: Path) -> str:
    return load_html(pages_dir / "classe" / "druide.html")


def test_load_html_decodes_utf8(sort_1_html: str) -> None:
    assert "Résistance" in sort_1_html
    assert "�" not in sort_1_html


def test_page_content_found(sort_1_html: str) -> None:
    contenu = page_content(sort_1_html)
    assert isinstance(contenu, Tag)
    assert contenu.get("id") == "PageContentDiv"


def test_page_content_raises_without_div() -> None:
    with pytest.raises(ValueError):
        page_content("<html><body><p>rien</p></body></html>")


def test_title_extracted(sort_1_html: str) -> None:
    titre = BeautifulSoup(sort_1_html, "lxml").find("h1", class_="pagetitle")
    assert titre is not None
    assert clean_text(titre) == "Armes contre le mal"


def test_nine_stat_labels_present(sort_1_html: str) -> None:
    contenu = page_content(sort_1_html)
    labels = [normalize_label(b.get_text()) for b in contenu.find_all("b")]
    assert labels == STAT_LABELS


def test_normalize_label_apostrophe_variants() -> None:
    assert normalize_label("Temps d’incantation") == "temps d'incantation"
    assert normalize_label("Temps d'incantation") == "temps d'incantation"
    assert normalize_label("  Résistance\xa0à la magie :  ") == "resistance a la magie"


def test_clean_text_is_plain(sort_1_html: str) -> None:
    texte = clean_text(page_content(sort_1_html))
    assert "\xa0" not in texte
    assert "<" not in texte
    assert texte == texte.strip()


def test_clean_text_turns_br_into_newlines(sort_1_html: str) -> None:
    texte = clean_text(page_content(sort_1_html))
    assert "École Transmutation" in texte
    assert "\nComposantes " in texte
    assert "\nTemps d'incantation " in texte


def test_inner_html_keeps_markup_verbatim(sort_1_html: str) -> None:
    contenu = page_content(sort_1_html)
    brut = inner_html(contenu)
    assert "<b>Composantes</b>" in brut
    assert "<b>Composantes</b>" in sort_1_html
    # No prettifying and no entity rewriting: the accented bytes stay as-is.
    assert "Résistance" in brut
    assert "&eacute;" not in brut


def test_absolutize_variants() -> None:
    assert absolutize("Pathfinder-RPG.Armes%20contre%20le%20mal.ashx") == (
        "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Armes%20contre%20le%20mal.ashx"
    )
    assert absolutize("/Wiki/x.ashx") == "https://www.pathfinder-fr.org/Wiki/x.ashx"
    assert absolutize("https://example.org/a") == "https://example.org/a"


def test_druide_page_content_found(druide_html: str) -> None:
    assert page_content(druide_html).get("id") == "PageContentDiv"


def test_druide_has_many_pagelink_entries(druide_html: str) -> None:
    entrees = page_content(druide_html).select("li a.pagelink")
    assert len(entrees) >= 100


def test_druide_h2_levels_and_nav_trap(druide_html: str) -> None:
    titres = [clean_text(h2).rstrip("¶").strip() for h2 in page_content(druide_html).find_all("h2")]
    for niveau in range(10):
        assert f"Sorts de niveau {niveau}" in titres
    # Documents the trap: the first h2 is a navigation block, not a level.
    assert "Accès rapide aux sections sur la magie" in titres
    assert titres[0] == "Accès rapide aux sections sur la magie"


def test_normalize_label_folds_all_apostrophe_variants():
    """The Skill mandates U+2019, U+2018 and U+02BC all fold to U+0027."""
    attendu = "temps d'incantation"
    for apostrophe in ("'", "’", "‘", "ʼ"):
        assert normalize_label(f"Temps d{apostrophe}incantation") == attendu
    assert normalize_label("Zone d’effet :") == "zone d'effet"
