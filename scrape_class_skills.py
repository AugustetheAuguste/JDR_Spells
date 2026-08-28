"""Récupère les compétences de classe et la formule de points de compétence
sur pathfinder-fr.org et produit Data/class_skills.json."""

import html
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

HTML_DIR = Path("class_skills_html")
OUT_PATH = Path("Data/class_skills.json")
BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.{slug}.ashx"
USER_AGENT = "Mozilla/5.0"

# clé interne -> slug d'URL (recopié verbatim depuis extract_class_features.py::CLASS_SLUGS)
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
SEPARATOR_H2_RE = re.compile(r'<h2[^>]*class="separator"[^>]*>', re.IGNORECASE)
SKILLS_HEADER_RE = re.compile(
    r'<h2[^>]*class="separator"[^>]*>\s*Comp.tences de classe', re.IGNORECASE
)
FORMULA_RE = re.compile(
    r"(?:Points|Rangs) de comp.tence par niveau\s*\.?\s*</b>\s*\.?\s*(.*?)\.?<br",
    re.DOTALL | re.IGNORECASE,
)
SKILL_ITEM_RE = re.compile(
    r'<a class="pagelink"[^>]*>([^<]+)</a>'
    r'(\s*\([^)]+\))?'
    r'\s*\(\s*(?:<[^>]+>)*\s*(For|Dex|Con|Int|Sag|Cha)\s*(?:<[^>]+>)*\s*\)'
)

ABILITY_NAMES = {
    "force": "For",
    "dexterite": "Dex",
    "constitution": "Con",
    "intelligence": "Int",
    "sagesse": "Sag",
    "charisme": "Cha",
}


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.lower()


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


def extract_class_skills_section(html_text: str) -> str | None:
    m = SKILLS_HEADER_RE.search(html_text)
    if not m:
        return None
    start = m.end()
    next_h2 = SEPARATOR_H2_RE.search(html_text, start)
    end = next_h2.start() if next_h2 else len(html_text)
    return html_text[start:end]


def parse_skills(section_html: str) -> list[dict]:
    skills = []
    for m in SKILL_ITEM_RE.finditer(section_html):
        base_name = strip_tags(m.group(1)).strip()
        sub = strip_tags(m.group(2)).strip("() ").strip() if m.group(2) else None
        ability = m.group(3)
        display = f"{base_name} ({sub})" if sub else base_name
        skills.append({"skill": display, "ability": ability})
    return skills


def parse_formula(section_html: str) -> str | None:
    m = FORMULA_RE.search(section_html)
    return strip_tags(m.group(1)).strip() if m else None


def parse_int_modifier_formula(formula_text: str | None) -> dict | None:
    if not formula_text:
        return None
    normalized = _normalize(formula_text)
    m = re.match(r"(\d+)\s*\+\s*modificateur d.?\s*(\w+)", normalized)
    if not m:
        return None
    ability_key = m.group(2)
    ability_code = ABILITY_NAMES.get(ability_key)
    if ability_code is None:
        return None
    return {"base": int(m.group(1)), "ability": ability_code}


def main() -> None:
    download_pages()

    out: dict = {}
    empty_skills: list[str] = []
    missing_formula: list[str] = []

    for key in sorted(CLASS_SLUGS):
        html_path = HTML_DIR / f"{key}.html"
        html_text = html_path.read_text(encoding="utf-8")
        section = extract_class_skills_section(html_text)

        if section is None:
            out[key] = {
                "class_skills": [],
                "skill_points_formula_raw": None,
                "skill_points_formula": None,
            }
            empty_skills.append(key)
            missing_formula.append(key)
            continue

        skills = parse_skills(section)
        formula_text = parse_formula(section)
        out[key] = {
            "class_skills": skills,
            "skill_points_formula_raw": formula_text,
            "skill_points_formula": parse_int_modifier_formula(formula_text),
        }
        if not skills:
            empty_skills.append(key)
        if formula_text is None:
            missing_formula.append(key)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
    )

    print(f"Classes traitées : {len(out)}")
    if empty_skills:
        print("Listes de compétences vides (à vérifier manuellement) :")
        for key in empty_skills:
            print(" -", key)
    if missing_formula:
        print("Formule de points de compétence introuvable :")
        for key in missing_formula:
            print(" -", key)


if __name__ == "__main__":
    main()
