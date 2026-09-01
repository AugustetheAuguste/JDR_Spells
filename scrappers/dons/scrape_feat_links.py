"""Récupère les liens vers les pages dédiées des dons depuis le tableau
récapitulatif de pathfinder-fr.org et produit Data/dons/feat_links.json
(nom de don nettoyé -> URL absolue de la page dédiée)."""

import csv
import html
import json
import re
import urllib.request
from pathlib import Path
import sys

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths

URL = (
    "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."
    "Tableau%20r%C3%A9capitulatif%20des%20dons.ashx"
)
HTML_DIR = Path("feat_table_html")
HTML_FILE = HTML_DIR / "tableau_recapitulatif.html"
OUT_PATH = Path(paths.FEAT_LINKS)
CSV_PATH = Path(paths.DONS_CSV)
BASE = "https://www.pathfinder-fr.org/Wiki/"
USER_AGENT = "Mozilla/5.0"

ROW_RE = re.compile(
    r'<tr\s+CLASS="[^"]*(?:donprincipal|donpr[eé]requis[0-2])[^"]*"[^>]*>(.*?)</tr>',
    re.IGNORECASE | re.DOTALL,
)
TD_RE = re.compile(r"<td\b[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
LINK_RE = re.compile(
    r'<a\s+class="pagelink"\s+href="([^"]+)"[^>]*>(.*?)</a>(\*?)',
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")


def clean_feat_name(name: str) -> str:
    return name.strip().rstrip("*").strip()


def strip_tags(text: str) -> str:
    return html.unescape(TAG_RE.sub("", text)).strip()


def download(force: bool = False) -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    if HTML_FILE.exists() and not force:
        return
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        HTML_FILE.write_bytes(resp.read())


def extract_row_blocks(html_text: str) -> list[str]:
    return [m.group(1) for m in ROW_RE.finditer(html_text)]


def extract_first_link(row_html: str) -> tuple[str, str] | None:
    td_match = TD_RE.search(row_html)
    if not td_match:
        return None
    first_td = td_match.group(1)
    link_match = LINK_RE.search(first_td)
    if not link_match:
        return None
    href, link_text, _star = link_match.groups()
    name_raw = strip_tags(link_text)
    clean_name = clean_feat_name(name_raw)
    absolute_url = BASE + href
    return clean_name, absolute_url


def main() -> None:
    download()

    html_text = HTML_FILE.read_text(encoding="utf-8", errors="replace")
    rows = extract_row_blocks(html_text)

    out: dict[str, str] = {}
    ambiguous: list[str] = []
    for row in rows:
        extracted = extract_first_link(row)
        if extracted is None:
            continue
        name, url = extracted
        if name in out and out[name] != url:
            ambiguous.append(name)
        out[name] = url

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    print(f"Lignes de don trouvées : {len(rows)}")
    print(f"Dons uniques avec lien : {len(out)}")
    if ambiguous:
        print("Noms ambigus (URLs différentes pour un même nom nettoyé) :")
        for name in sorted(set(ambiguous)):
            print(" -", name)

    if CSV_PATH.exists():
        with CSV_PATH.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            csv_names = {clean_feat_name(row["Dons"]) for row in reader if row.get("Dons")}
        missing = sorted(n for n in csv_names if n not in out)
        coverage = 100.0 * (len(csv_names) - len(missing)) / len(csv_names) if csv_names else 0.0
        print(f"Couverture vs Data/dons/Dons.csv : {coverage:.2f}% ({len(csv_names) - len(missing)}/{len(csv_names)})")
        if missing:
            print("Noms du CSV sans lien trouvé :")
            for name in missing:
                print(" -", name)


if __name__ == "__main__":
    main()
