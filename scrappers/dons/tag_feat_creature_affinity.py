"""Détecte, par mots-clés, les dons dont la description scrapée indique
qu'ils sont pensés pour une créature/race précise (motif "Cette option est
plus courante chez les X.") plutôt qu'un personnage humanoïde standard.

Ce motif est une donnée narrative de la page de don, absente des colonnes
Conditions/Avantages du CSV — même patron que scrappers/tag_feat_magic.py :
un tagger best-effort, jamais consommé sans passer par needs_manual_check
sur les cas ambigus.
"""

import json
import re
import unicodedata
import sys
from pathlib import Path

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths

FEAT_DETAILS_PATH = paths.FEAT_DETAILS
OUT_PATH = paths.FEAT_CREATURE_AFFINITY

PREVALENCE_PATTERN = re.compile(
    r"plus courante?s? chez (?:le|les) ([^.]+)\.",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.lower().strip()


def classify(name: str, entry: dict) -> dict | None:
    text = entry.get("description") or ""
    match = PREVALENCE_PATTERN.search(text)
    if not match:
        return None
    phrase = match.group(1).strip()
    # Haute confiance seulement pour une phrase courte et simple ("les
    # hommes-lézards", "les gobelours") — toute clause plus longue/complexe
    # (virgules, "comme Abraxas ou Geryon", etc.) est laissée en
    # needs_manual_check plutôt que devinée.
    is_simple = (
        len(phrase.split()) <= 4
        and "," not in phrase
        and " comme " not in phrase.lower()
    )
    return {
        "matched_text": phrase,
        "creature_keywords": [phrase] if is_simple else [],
        "needs_manual_check": not is_simple,
    }


def main() -> None:
    with open(FEAT_DETAILS_PATH, encoding="utf-8") as f:
        details = json.load(f)

    out = {}
    for name, entry in details.items():
        result = classify(name, entry)
        if result is not None:
            out[name] = result

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=True)

    high_confidence = sum(1 for v in out.values() if not v["needs_manual_check"])
    print(f"{len(out)} dons tagués (motif de prévalence créature/race trouvé)")
    print(f"  haute confiance (creature_keywords non vide) : {high_confidence}")
    print(f"  needs_manual_check : {len(out) - high_confidence}")


if __name__ == "__main__":
    main()
