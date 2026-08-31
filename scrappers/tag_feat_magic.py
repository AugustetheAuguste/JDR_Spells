"""Best-effort "magic-dependent feat" tagger.

Standalone script (not imported by the `pf1_dons` package, matching the
existing pattern of `scrappers/tag_feat_categories.py`). Reads
`Data/feat_details.json` (produced by Step 06's
`scrappers/scrape_feat_details.py`) and writes `Data/feat_magic_info.json`,
tagging each feat with `is_magic` (the feat only has real
sense/benefit for a character with access to magic) and
`needs_manual_check` (insufficient confidence to decide automatically),
mirroring the `needs_manual_check` convention used by
`Data/feat_categories.json`.

The three keyword lists below (STRONG_MAGIC_KEYWORDS, WEAK_MAGIC_KEYWORDS,
EXCLUSION_PHRASES) are transcribed literally from Step 03's
`build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md`,
Section B -- they are NOT re-derived or guessed here.

Usage:
    python scrappers/tag_feat_magic.py
"""

import json
import unicodedata
from pathlib import Path

IN_PATH = Path("Data/feat_details.json")
OUT_PATH = Path("Data/feat_magic_info.json")
CALIBRATION_DOC = (
    "build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md"
)

# Recopiees litteralement depuis CALIBRATION_DOC, Section B -- ne pas
# reinventer ces listes, seulement les transcrire en code.
STRONG_MAGIC_KEYWORDS = [
    "capacite a lancer des sorts",
    "sorts profanes",
    "lancer des sorts spontanes",
    "don de metamagie",
    "niveau de lanceur de sorts",
    "emplacement de sort",
    "emplacements de sorts",
    "aptitude magique",
    # Ajouté après le merge initial (voir OUTPUT_vocab_and_markup_calibration.md,
    # Section B, entrée 9) : couvre la famille des dons d'amplification
    # élémentaire ("Amplification brûlante" et consorts), passés inaperçus
    # dans l'échantillon initial car ils utilisent une formulation ("lorsque
    # le personnage lance un sort...") différente des autres mots-clés forts.
    "lorsque le personnage lance un sort",
    # Ajoutés lors de l'audit d'éligibilité du guerrier (voir
    # OUTPUT_vocab_and_markup_calibration.md, Section B, entrées 10 à 12) :
    # des dons sans aucune Condition dans le CSV mais qui décrivent ce que le
    # personnage fait en lançant / en contrant un sort.
    "peut lancer des sorts",
    "sorts lances par le personnage",
    "contrer un sort",
    # Ajoutés lors de l'audit multi-classes niveau 6 (voir
    # OUTPUT_vocab_and_markup_calibration.md, Section B, entrées 13 à 16) :
    # des dons dont l'avantage décrit une manipulation de la propre magie du
    # personnage (sa liste de sorts, ses sorts de contact, son incantation).
    "a sa liste de sorts",
    "sort de contact",
    "quand le personnage lance un sort",
    # Mot-clé volontairement très étroit (1 seul don) : il lève le « résidu
    # connu » documenté en Section B, « Lecture des résidus magiques », dont
    # l'avantage ne parle que d'un sort nommé sans aucun autre marqueur.
    "tout autre sort d'un niveau plus eleve",
    # Deux mots-clés ciblés (1 don chacun) : le motif large « de ses sorts »
    # aurait aussi attrapé « Signes secrets », qui garde un avantage non
    # magique indépendant (+4 en Bluff pour les messages secrets) et reste donc
    # utile à un non-lanceur. Voir Section B, entrées 17 et 18.
    "la veritable nature de ses sorts",
    "attaques de contact au corps a corps de ses sorts",
]

WEAK_MAGIC_KEYWORDS = [
    "objet magique",
    "objets magiques",
    "pouvoir magique",
    "pouvoirs magiques",
    "pierre magique",
    "energie magique",
    "capacite de classe",
]

EXCLUSION_PHRASES = [
    "objets magiques ou non magiques",
    "objet magique",
    "objets magiques",
    "resistance a la magie",
]


def normalize(text: str) -> str:
    """Accent-insensitive, case-insensitive normalization.

    Copied from `pf1_dons/parser.py::_normalize` (kept standalone rather
    than imported, matching the pattern of other scraper/tagger scripts
    in this repo staying independent of the package).
    """
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def classify(name: str, entry: dict) -> dict:
    haystack = normalize(f"{name} {entry.get('raw_text') or ''}")

    strong_matches = [kw for kw in STRONG_MAGIC_KEYWORDS if normalize(kw) in haystack]
    if strong_matches:
        return {
            "is_magic": True,
            "needs_manual_check": False,
            "matched_keywords": strong_matches,
        }

    exclusion_matches = [kw for kw in EXCLUSION_PHRASES if normalize(kw) in haystack]
    if exclusion_matches:
        return {
            "is_magic": False,
            "needs_manual_check": False,
            "matched_keywords": [],
        }

    weak_matches = [kw for kw in WEAK_MAGIC_KEYWORDS if normalize(kw) in haystack]
    if weak_matches:
        return {
            "is_magic": False,
            "needs_manual_check": True,
            "matched_keywords": weak_matches,
        }

    return {"is_magic": False, "needs_manual_check": False, "matched_keywords": []}


def main() -> None:
    details = json.loads(IN_PATH.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    is_magic_count = 0
    manual_check_count = 0

    for name, entry in details.items():
        result = classify(name, entry)
        out[name] = result
        if result["is_magic"]:
            is_magic_count += 1
        if result["needs_manual_check"]:
            manual_check_count += 1

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(
        f"{len(out)} feats tagged; {is_magic_count} is_magic=true; "
        f"{manual_check_count} needs_manual_check=true"
    )
    print(f"Keyword vocabulary source: {CALIBRATION_DOC} (Section B)")


if __name__ == "__main__":
    main()
