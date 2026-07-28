"""UTF-8 HTML loading, PageContentDiv slicing and text normalization helpers.

Every wiki page is UTF-8 and carries no <meta charset>, so decoding is always
explicit and BeautifulSoup is only ever fed an already-decoded `str`.
"""

from __future__ import annotations

import copy
import re
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup, Tag

parser_version = "1.0.0"

WIKI_BASE = "https://www.pathfinder-fr.org/Wiki/"

_CONTENT_ID = "PageContentDiv"
_ATTACHMENTS_ID = "PageAttachmentsDiv"

_BLOCK_TAGS = (
    "p", "div", "li", "ul", "ol", "table", "tr", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
)
_SENTINEL = "\x00"
_WS = re.compile(r"\s+")
_SENTINEL_RUN = re.compile(f"{_SENTINEL}+")


def load_html(path: str | Path) -> str:
    """Read `path` as UTF-8 with strict error handling."""
    return Path(path).read_text(encoding="utf-8", errors="strict")


def page_content(html: str) -> Tag:
    """Return the `PageContentDiv` subtree, attachments block excluded."""
    soup = BeautifulSoup(html, "lxml")
    div = soup.find(id=_CONTENT_ID)
    if div is None:
        raise ValueError(f"no <div id={_CONTENT_ID!r}> in document")
    attachments = div.find(id=_ATTACHMENTS_ID)
    if attachments is not None:
        attachments.decompose()
    return div


def clean_text(node: Tag | str) -> str:
    """Return visible text.

    Line breaks come from the markup (`<br>` and block-level tags), never from
    the source file's own indentation: raw whitespace collapses to one space and
    `\\xa0` becomes a plain space.
    """
    if isinstance(node, str):
        texte = node.replace("\xa0", " ")
        return _WS.sub(" ", texte).strip()

    copie = copy.copy(node)
    for br in copie.find_all("br"):
        br.replace_with(_SENTINEL)
    for bloc in copie.find_all(_BLOCK_TAGS):
        bloc.insert_before(_SENTINEL)
        bloc.insert_after(_SENTINEL)
    texte = copie.get_text().replace("\xa0", " ")
    lignes = [_WS.sub(" ", part).strip() for part in _SENTINEL_RUN.split(texte)]
    return "\n".join(ligne for ligne in lignes if ligne)


def inner_html(node: Tag) -> str:
    """Return the raw inner HTML of `node`, unmodified."""
    return node.decode_contents()


def normalize_label(s: str) -> str:
    """Fold a stat-block label to an accent-free, apostrophe-stable key."""
    texte = s.replace("\xa0", " ")
    for apostrophe in ("’", "‘", "ʼ"):
        texte = texte.replace(apostrophe, "'")
    decompose = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in decompose if not unicodedata.combining(c))
    texte = re.sub(r"\s+", " ", texte).strip().lower()
    return texte.rstrip(":").strip()


def absolutize(href: str) -> str:
    """Turn a relative wiki href into an absolute pathfinder-fr.org URL."""
    href = href.strip()
    if href.startswith(("http://", "https://")):
        return href
    if href.startswith("//"):
        return f"https:{href}"
    if href.startswith("/"):
        return f"https://www.pathfinder-fr.org{href}"
    return WIKI_BASE + href
