"""Récupère la page détaillée de chaque don sur pathfinder-fr.org et produit
Data/feat_details.json : description narrative complète, rubriques
structurées (Source, Conditions, Avantages, Spécial, Normal) et texte brut
intégral en fallback, à partir de Data/feat_links.json.

Le contrat HTML des rubriques est celui figé par
build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md
(Section A) — ne pas le redéterminer ici.
"""

import html
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

HTML_DIR = Path("feat_pages_html")
LINKS_PATH = Path("Data/feat_links.json")
OUT_PATH = Path("Data/feat_details.json")
USER_AGENT = "Mozilla/5.0"
REQUEST_DELAY_SECONDS = 0.3

TAG_RE = re.compile(r"<[^>]+>")

CONTENT_DIV_RE = re.compile(
    r'<div id="PageContentDiv"[^>]*>(.*?)<div id="PageAttachmentsDiv"',
    re.IGNORECASE | re.DOTALL,
)

SOURCE_RE = re.compile(r'title="Source\s*:\s*([^"]+)"', re.IGNORECASE)

# Coupure de la description narrative : la première rubrique connue
# (Catégorie/Condition(s), ou Avantages en repli quand un don n'a pas de
# rubrique Condition du tout, ex. Prodige/Métamagie spontanée).
DESCRIPTION_CUT_RE = re.compile(
    r'<b>\s*(?:Cat[ée]gorie|Conditions?|Avantages?)\s*[:.]?\s*</b>',
    re.IGNORECASE,
)

RUBRIC_END_LOOKAHEAD = r'(?=<br\s*/?>\s*<br\s*/?>\s*<b>|<h[23]|$)'

CONDITIONS_RE = re.compile(
    r'<b>\s*Conditions?\s*[:.]?\s*</b>(.*?)' + RUBRIC_END_LOOKAHEAD,
    re.IGNORECASE | re.DOTALL,
)
AVANTAGES_RE = re.compile(
    r'<b>\s*Avantages?\s*[:.]?\s*</b>(.*?)' + RUBRIC_END_LOOKAHEAD,
    re.IGNORECASE | re.DOTALL,
)
SPECIAL_RE = re.compile(
    r'<b>\s*Sp[ée]cial\s*[:.]?\s*</b>(.*?)' + RUBRIC_END_LOOKAHEAD,
    re.IGNORECASE | re.DOTALL,
)
NORMAL_RE = re.compile(
    r'<b>\s*Normal\s*[:.]?\s*</b>(.*?)' + RUBRIC_END_LOOKAHEAD,
    re.IGNORECASE | re.DOTALL,
)


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.lower()


def slug_for_cache(feat_name: str) -> str:
    normalized = _normalize(feat_name)
    slug = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return slug or "unknown"


def strip_tags(text: str) -> str:
    cleaned = TAG_RE.sub(" ", text)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def download_all(links: dict, force: bool = False) -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    total = len(links)
    for i, (name, url) in enumerate(links.items(), start=1):
        dest = HTML_DIR / f"{slug_for_cache(name)}.html"
        if dest.exists() and not force:
            continue
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req) as resp:
                dest.write_bytes(resp.read())
        except Exception as exc:  # noqa: BLE001 - logué, pas fatal
            print(f"[{i}/{total}] ECHEC telechargement {name!r}: {exc}")
        else:
            print(f"[{i}/{total}] {name}")
        time.sleep(REQUEST_DELAY_SECONDS)


def parse_feat_page(html_text: str, url: str) -> dict:
    content_match = CONTENT_DIV_RE.search(html_text)
    content_html = content_match.group(1) if content_match else html_text

    sources = SOURCE_RE.findall(content_html)
    source_detail = "; ".join(s.strip() for s in sources) if sources else None

    cut_match = DESCRIPTION_CUT_RE.search(content_html)
    description_html = content_html[: cut_match.start()] if cut_match else content_html
    description = strip_tags(description_html) or None

    conditions_match = CONDITIONS_RE.search(content_html)
    conditions_detail = strip_tags(conditions_match.group(1)) if conditions_match else None
    if conditions_detail == "":
        conditions_detail = None

    avantages_match = AVANTAGES_RE.search(content_html)
    avantages_detail = strip_tags(avantages_match.group(1)) if avantages_match else None
    if avantages_detail == "":
        avantages_detail = None

    special_match = SPECIAL_RE.search(content_html)
    special = strip_tags(special_match.group(1)) if special_match else None
    if special == "":
        special = None

    normal_match = NORMAL_RE.search(content_html)
    normal = strip_tags(normal_match.group(1)) if normal_match else None
    if normal == "":
        normal = None

    raw_text = strip_tags(content_html)

    return {
        "url": url,
        "source_detail": source_detail,
        "description": description,
        "conditions_detail": conditions_detail,
        "avantages_detail": avantages_detail,
        "special": special,
        "normal": normal,
        "raw_text": raw_text,
        "parse_error": None,
    }


def main() -> None:
    links = json.loads(LINKS_PATH.read_text(encoding="utf-8"))

    download_all(links)

    out: dict = {}
    failures: list[str] = []
    for name, url in links.items():
        dest = HTML_DIR / f"{slug_for_cache(name)}.html"
        try:
            html_text = dest.read_text(encoding="utf-8", errors="replace")
            out[name] = parse_feat_page(html_text, url)
        except Exception as exc:  # noqa: BLE001 - jamais fatal pour tout le run
            failures.append(name)
            out[name] = {
                "url": url,
                "source_detail": None,
                "description": None,
                "conditions_detail": None,
                "avantages_detail": None,
                "special": None,
                "normal": None,
                "raw_text": None,
                "parse_error": str(exc),
            }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
    )

    print(f"Dons traités : {len(out)}")
    print(f"Echecs de parsing : {len(failures)}")
    if failures:
        for name in failures:
            print(" -", name)


if __name__ == "__main__":
    main()
