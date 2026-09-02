"""Récupère les tableaux de progression des classes sur pathfinder-fr.org
et produit Data/classes/class_features.json (capacités spéciales par niveau)."""

import html
import json
import re
import urllib.request
from pathlib import Path
import sys

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths

HTML_DIR = Path("classes_html")
OUT_PATH = Path(paths.CLASS_FEATURES)
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.{slug}.ashx"
USER_AGENT = "Mozilla/5.0"

# clé interne -> slug d'URL (encodage tel qu'utilisé par le wiki)
CLASS_SLUGS = {
    "alchimiste": "Alchimiste",
    "antipaladin": "Antipaladin",
    "arcaniste": "Arcaniste",
    "barbare": "Barbare",
    "barde": "Barde",
    "bretteur": "Bretteur",
    "chaman": "Chaman",
    "chasseur_de_vampire": "Chasseur%20de%20vampire",
    "chasseur": "Chasseur",
    "chevalier": "Chevalier",
    "cinetiste": "Cin%c3%a9tiste",
    "conjurateur": "Conjurateur",
    "druide": "Druide",
    "enqueteur": "Enqu%c3%aateur",
    "ensorceleur": "Ensorceleur",
    "guerrier": "Guerrier",
    "hypnotiseur": "Hypnotiseur",
    "inquisiteur": "Inquisiteur",
    "justicier": "Justicier",
    "lutteur": "Lutteur",
    "medium": "M%c3%a9dium",
    "metamorphe": "M%c3%a9tamorphe",
    "magicien": "Magicien",
    "magus": "Magus",
    "moine": "Moine",
    "ninja": "Ninja",
    "occultiste": "Occultiste",
    "oracle": "Oracle",
    "paladin": "Paladin",
    "pistolier": "Pistolier",
    "pretre_combattant": "Pr%c3%aatre%20combattant",
    "pretre": "Pr%c3%aatre",
    "psychiste": "Psychiste",
    "rodeur": "R%c3%b4deur",
    "roublard": "Roublard",
    "samourai": "Samoura%c3%af",
    "sanguin": "Sanguin",
    "scalde": "Scalde",
    "sorciere": "Sorci%c3%a8re",
    "spirite": "Spirite",
    "tueur": "Tueur",
}

TAG_RE = re.compile(r"<[^>]+>")
HEADER_RE = re.compile(r'CLASS="titre"><td[^>]*>Niv(?:eau)?</td>')
ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.DOTALL)
LEVEL_CELL_RE = re.compile(r"^<td[^>]*>(\d+)</td>")
GAUCHE_CELL_RE = re.compile(r'<td[^>]*CLASS="gauche"[^>]*>(.*?)</td>', re.DOTALL | re.IGNORECASE)


def download_pages(force: bool = False) -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    for key, slug in CLASS_SLUGS.items():
        dest = HTML_DIR / f"{key}.html"
        if dest.exists() and not force:
            continue
        req = urllib.request.Request(BASE_URL.format(slug=slug), headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req) as resp:
            dest.write_bytes(resp.read())


def strip_tags(text: str) -> str:
    return html.unescape(TAG_RE.sub("", text)).strip()


def find_table_span(text: str, header_pos: int) -> tuple[int, int]:
    table_start = text.rfind("<table", 0, header_pos)
    table_end = text.find("</table>", header_pos)
    return table_start, table_end + len("</table>")


def parse_class_page(html_text: str) -> dict[str, list[str]]:
    m = HEADER_RE.search(html_text)
    if not m:
        raise ValueError("table de progression introuvable")
    start, end = find_table_span(html_text, m.start())
    table_html = html_text[start:end]

    features_by_level: dict[str, list[str]] = {}
    for row_match in ROW_RE.finditer(table_html):
        row_html = row_match.group(1)
        level_match = LEVEL_CELL_RE.match(row_html)
        gauche_match = GAUCHE_CELL_RE.search(row_html)
        if not level_match or not gauche_match:
            continue
        level = level_match.group(1)
        cell_text = strip_tags(gauche_match.group(1))
        if not cell_text or cell_text == "-":
            features_by_level[level] = []
            continue
        parts = [p.strip() for p in cell_text.split(",") if p.strip()]
        features_by_level[level] = parts
    return features_by_level


def main() -> None:
    download_pages()

    result = {}
    errors = []
    for path in sorted(HTML_DIR.glob("*.html")):
        class_key = path.stem
        html_text = path.read_text(encoding="utf-8")
        try:
            result[class_key] = parse_class_page(html_text)
        except ValueError as exc:
            errors.append(f"{class_key}: {exc}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Classes traitées : {len(result)}")
    if errors:
        print("Erreurs :")
        for e in errors:
            print(" -", e)


if __name__ == "__main__":
    main()
