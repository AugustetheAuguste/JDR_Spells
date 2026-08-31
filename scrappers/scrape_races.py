"""Récupère les traits raciaux standards sur pathfinder-fr.org et produit
Data/races/races.json (modificateurs de caractéristiques, taille, vitesse, dons
supplémentaires, rangs de compétence bonus, et texte brut des traits)."""

import html
import json
import re
import unicodedata
import urllib.request
from pathlib import Path
import sys

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths

HTML_DIR = Path("races_html")
OUT_PATH = Path(paths.RACES)
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.{slug}.ashx"
USER_AGENT = "Mozilla/5.0"

# Toutes les races connues du parseur (pf1_dons/parser.py::KNOWN_RACES),
# recopiées ici en dur (ce script ne dépend pas du package pf1_dons).
KNOWN_RACES = {
    "demi-elfe", "demi-orque", "elfe", "gnome", "halfelin", "humain", "nain",
    "aasimar", "dhampir", "drow", "fetchelin", "gobelin", "hobgobelin",
    "homme-felin", "homme-rat", "ifrit", "kobold", "ondin", "orque",
    "oreade", "sylphe", "tengu", "tieffelin",
    "aquatique", "changelin", "duergar", "grippli", "homme-poisson",
    "kitsune", "nagaji", "samsaran", "strix", "suli", "svirfneblin",
    "vanara", "vishkanya", "wayang",
    "androide", "changepeau", "elfe aquatique", "gathelain", "ghoran",
    "gobelin simiesque", "kasatha", "lashunta", "syrinx", "trox",
    "triaxien", "virebois", "wivaran",
    "homme-serpent", "ogre", "troll",
}

# clé interne -> slug d'URL (résolu à la main contre l'index
# Pathfinder-RPG.Races.ashx). homme-serpent, ogre et troll sont des races du
# bestiaire sans page de traits standards dédiée dans ce format.
RACE_SLUGS = {
    "demi-elfe": "Demi-elfe",
    "demi-orque": "Demi-orque",
    "elfe": "Elfe",
    "gnome": "Gnome",
    "halfelin": "Halfelin",
    "humain": "Humain",
    "nain": "Nain",
    "aasimar": "Aasimar%20(race)",
    "dhampir": "Dhampir%20(race)",
    "drow": "Drow%20(race)",
    "fetchelin": "Fetchelin%20(race)",
    "gobelin": "Gobelin%20(race)",
    "hobgobelin": "Hobgobelin%20(race)",
    "homme-felin": "Homme-f%c3%a9lin%20(race)",
    "homme-rat": "Homme-rat%20(race)",
    "ifrit": "Ifrit%20(race)",
    "kobold": "Kobold%20(race)",
    "ondin": "Ondin%20(race)",
    "orque": "Orque%20(race)",
    "oreade": "Or%c3%a9ade%20(race)",
    "sylphe": "Sylphe%20(race)",
    "tengu": "Tengu%20(race)",
    "tieffelin": "Tieffelin%20(race)",
    "aquatique": "Aquatique%20(race)",
    "changelin": "Changelin%20(race)",
    "duergar": "Duergar%20(race)",
    "grippli": "Grippli%20(race)",
    "homme-poisson": "Homme-poisson%20(race)",
    "kitsune": "Kitsune%20(race)",
    "nagaji": "Nagaji%20(race)",
    "samsaran": "Samsaran%20(race)",
    "strix": "Strix%20(race)",
    "suli": "Suli%20(race)",
    "svirfneblin": "Svirfneblin%20(race)",
    "vanara": "Vanara%20(race)",
    "vishkanya": "Vishkanya%20(race)",
    "wayang": "Wayang%20(race)",
    "androide": "Andro%c3%afde%20(race)",
    "changepeau": "Changepeau%20(race)",
    "elfe aquatique": "Elfe%20aquatique%20(race)",
    "gathelain": "Gathelain%20(race)",
    "ghoran": "Ghoran%20(race)",
    "gobelin simiesque": "Gobelin%20simiesque%20(race)",
    "kasatha": "Kasatha%20(race)",
    "lashunta": "Lashunta%20(race)",
    "syrinx": "Syrinx%20(race)",
    "trox": "Trox%20(race)",
    "triaxien": "Triaxien%20(race)",
    "virebois": "Virebois%20(race)",
    "wivaran": "Wivaran%20(race)",
}

TAG_RE = re.compile(r"<[^>]+>")
TABLE_RE = re.compile(r"<table\b.*?</table>", re.DOTALL | re.IGNORECASE)
SEPARATOR_H2_RE = re.compile(r'<h2[^>]*class="separator"[^>]*>', re.IGNORECASE)
STANDARD_TRAITS_RE = re.compile(
    r'<h2[^>]*class="separator"[^>]*>\s*Traits raciaux standards', re.IGNORECASE
)
UL_RE = re.compile(r"<ul>(.*?)</ul>", re.DOTALL | re.IGNORECASE)
LI_RE = re.compile(r"<li>(.*?)</li>", re.DOTALL | re.IGNORECASE)
BOLD_RE = re.compile(r"<b>(.*?)</b>", re.DOTALL | re.IGNORECASE)

ABILITY_NAMES = {
    "force": "For",
    "dexterite": "Dex",
    "constitution": "Con",
    "intelligence": "Int",
    "sagesse": "Sag",
    "charisme": "Cha",
}
ABILITY_MOD_RE = re.compile(
    r"([+-]\s*\d+)\s*(?:<[^>]+>)?\s*(force|dexterite|constitution|intelligence|sagesse|charisme)",
)
SIZE_RE = re.compile(r"\btaille\s+(tp|p|m|g|tg)\b")
SPEED_RE = re.compile(r"vitesse de base(?:[^0-9]*?)(\d+)\s*metres?")


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.lower()


def download_pages(force: bool = False) -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    for key, slug in RACE_SLUGS.items():
        dest = HTML_DIR / f"{key}.html"
        if dest.exists() and not force:
            continue
        req = urllib.request.Request(BASE_URL.format(slug=slug), headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req) as resp:
            dest.write_bytes(resp.read())


def strip_tags(text: str) -> str:
    return html.unescape(TAG_RE.sub("", text)).strip()


def extract_standard_traits_html(html_text: str) -> str | None:
    m = STANDARD_TRAITS_RE.search(html_text)
    if not m:
        return None
    start = m.end()
    next_h2 = SEPARATOR_H2_RE.search(html_text, start)
    end = next_h2.start() if next_h2 else len(html_text)
    return html_text[start:end]


def parse_trait_items(section_html: str) -> list[dict]:
    # Retire les tableaux imbriqués (encarts FAQ) avant de chercher le <ul>
    # réel, pour ne pas confondre un <ul> de FAQ avec la liste des traits.
    cleaned = TABLE_RE.sub("", section_html)
    ul_match = UL_RE.search(cleaned)
    if not ul_match:
        return []
    traits = []
    for li_match in LI_RE.finditer(ul_match.group(1)):
        li_html = li_match.group(1)
        bold_match = BOLD_RE.search(li_html)
        if not bold_match:
            continue
        name = strip_tags(bold_match.group(1)).rstrip(".").strip()
        remainder = li_html[bold_match.end():]
        description = strip_tags(remainder)
        traits.append({"name": name, "description": description})
    return traits


def classify_traits(traits: list[dict]) -> dict:
    result: dict = {
        "ability_modifiers": [],
        "size": None,
        "speed": None,
        "has_bonus_feat": False,
        "bonus_skill_rank": False,
        "class_skill_grants": [],
    }
    for trait in traits:
        text = _normalize(trait["name"] + " " + trait["description"])
        if "don supplementaire" in text:
            result["has_bonus_feat"] = True
        if "rang de competence supplementaire" in text or "rang bonus" in text:
            result["bonus_skill_rank"] = True
        if not result["ability_modifiers"]:
            if "valeur de caracteristique de leur choix" in text or "caracteristique de son choix" in text:
                result["ability_modifiers"].append({"ability": "choice", "modifier": 2})
            else:
                mods = ABILITY_MOD_RE.findall(text)
                if mods:
                    result["ability_modifiers"] = [
                        {"ability": ABILITY_NAMES[ability], "modifier": int(sign.replace(" ", ""))}
                        for sign, ability in mods
                    ]
        if result["size"] is None:
            size_match = SIZE_RE.search(text)
            if size_match:
                result["size"] = size_match.group(1).upper()
        if result["speed"] is None:
            speed_match = SPEED_RE.search(text)
            if speed_match:
                result["speed"] = int(speed_match.group(1))
    return result


def main() -> None:
    download_pages()

    out: dict = {}
    unresolved: list[str] = []
    for key in sorted(KNOWN_RACES):
        if key not in RACE_SLUGS:
            out[key] = {
                "traits": [],
                "ability_modifiers": None,
                "size": None,
                "speed": None,
                "has_bonus_feat": None,
                "bonus_skill_rank": None,
                "class_skill_grants": None,
                "note": "no scrapeable standard traits page found",
            }
            unresolved.append(key)
            continue

        html_text = (HTML_DIR / f"{key}.html").read_text(encoding="utf-8")
        section = extract_standard_traits_html(html_text)
        if section is None:
            out[key] = {
                "traits": [],
                "ability_modifiers": None,
                "size": None,
                "speed": None,
                "has_bonus_feat": None,
                "bonus_skill_rank": None,
                "class_skill_grants": None,
                "note": "no scrapeable standard traits page found",
            }
            unresolved.append(key)
            continue

        traits = parse_trait_items(section)
        structured = classify_traits(traits)
        out[key] = {"traits": traits, **structured}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
    )

    print(f"Races traitées : {len(out)}")
    if unresolved:
        print("Non résolues :")
        for key in unresolved:
            print(" -", key)


if __name__ == "__main__":
    main()
