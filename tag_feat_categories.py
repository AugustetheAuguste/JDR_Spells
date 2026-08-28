"""Best-effort feat category tagger.

Standalone script (not imported by the `pf1_dons` package, matching the
existing pattern of `extract_class_features.py`). Reads `Data/Dons.csv` and
writes `Data/feat_categories.json`, tagging each feat with zero or more
best-effort category keywords derived from its name and benefit text
(`Avantages`). Feats that match no category are flagged
`"needs_manual_check": true`, mirroring the `needs_manual_check` convention
used by `pf1_dons/parser.py` for unparsed prerequisite text.

Usage:
    python tag_feat_categories.py
"""

import json
import unicodedata
from pathlib import Path

import pandas as pd

IN_PATH = Path("Data/Dons.csv")
OUT_PATH = Path("Data/feat_categories.json")

# category -> list of keyword cues (matched case/accent-insensitively as
# substrings of the normalized name + benefit text). Kept intentionally
# small and reviewable; "combat" is the only category this plan's
# functional steps (fighter-style bonus feat slots) actually need, others
# are a best-effort bonus.
CATEGORY_KEYWORDS = {
    "combat": [
        "attaque en puissance", "attaque en finesse", "corps a corps",
        "arme de guerre", "attaque d'opportunite", "manoeuvre offensive",
        "manoeuvre de combat", "esquive", "combat a deux armes",
        "port du bouclier", "attaque a outrance", "arme de base",
        "arme exotique", "arme courante", "coup de pied", "coup de poing",
        "charge", "bourrer", "feinte", "desarmement", "renversement",
        "croc-en-jambe", "bousculade", "immobilisation", "combat monte",
        "frappe", "parade", "riposte", "arme naturelle", "attaque naturelle",
        "arme en main", "maitrise d'armes", "degainer", "port d'armure",
        "arme improvisee",
    ],
    "tir_a_distance": [
        "arme a distance", "arc composite", "arc long", "arc court",
        "arbalete", "tir de precision", "tir en mouvement", "fronde",
        "tir de loin", "tir a bout portant", "tir rapide", "tir en cloche",
    ],
    "metamagie": [
        "metamagique", "sort modifie", "sorts modifies", "don metamagique",
    ],
    "creation_objet": [
        "creation d'objet", "objet magique", "confection", "creation de parchemin",
        "creation de potion", "creer un objet", "fabrication d'objet",
    ],
    "monture": [
        "monture", "cavalier", "lancier", "combat monte",
    ],
    "sociale": [
        "diplomatie", "intimidation", "representation", "bluff",
        "influence", "reaction initiale",
    ],
}


def normalize(text: str) -> str:
    """Accent-insensitive, case-insensitive normalization.

    Copied from `pf1_dons/parser.py::_normalize` (kept standalone rather
    than imported, matching the pattern of other scraper/tagger scripts
    in this repo staying independent of the package).
    """
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def clean_feat_name(name: str) -> str:
    """Copied from `pf1_dons/data_loader.py::clean_feat_name`."""
    return name.strip().rstrip("*").strip()


def classify(name: str, benefits_text: str) -> list[str]:
    haystack = normalize(f"{name} {benefits_text}")
    matched = [
        cat
        for cat, keywords in CATEGORY_KEYWORDS.items()
        if any(normalize(kw) in haystack for kw in keywords)
    ]
    return sorted(matched)


def main() -> None:
    df = pd.read_csv(IN_PATH, encoding="utf-8")
    out: dict[str, dict] = {}
    unclassified = 0

    for _, row in df.iterrows():
        name = clean_feat_name(str(row["Dons"]))
        categories = classify(name, str(row["Avantages"]))
        out[name] = {
            "categories": categories,
            "needs_manual_check": len(categories) == 0,
        }
        if not categories:
            unclassified += 1

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"{len(out)} feats tagged; {unclassified} unclassified (needs_manual_check)")


if __name__ == "__main__":
    main()
