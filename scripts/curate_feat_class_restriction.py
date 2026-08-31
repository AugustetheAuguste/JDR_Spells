"""Curation : dons réservés à une classe par leur *texte d'avantage*.

Certains dons n'ont aucun prérequis de classe dans `Data/Dons.csv` mais leur
avantage n'a de sens que pour une classe précise — typiquement « le personnage
ajoute les sorts suivants à sa liste de druide ». Le signal est donc dans
`Data/feat_details.json` (avantages/description), pas dans les Conditions.

Ce script produit `Data/feat_class_restriction.json`. Comme
`class_ability_map.json` et `class_caster_info.json`, c'est un fichier **curé à
la main** : `candidates()` ne sert qu'à régénérer la liste de candidats à
relire, et seules les entrées transcrites dans RESTRICTIONS ci-dessous sont
écrites. Le raisonnement complet (51 candidats, 1 retenu) est dans
build/feat-detail-and-magic-gating/OUTPUT_benefit_text_class_signal.md.

Usage:
    python scripts/curate_feat_class_restriction.py [--candidats]
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

from pf1_dons.class_progression import CLASS_BBA_PROGRESSION

DETAILS = Path("Data/feat_details.json")
OUT_PATH = Path("Data/feat_class_restriction.json")
ANALYSIS_DOC = "build/feat-detail-and-magic-gating/OUTPUT_benefit_text_class_signal.md"

VALID_CLASSES = set(CLASS_BBA_PROGRESSION.keys())

# Motifs qui, dans le texte d'avantage, nomment la classe dont le don dépend.
# Volontairement restreints : le motif générique « du <classe> » désignait aussi
# bien la classe *de référence de calcul* que la classe requise (voir ANALYSIS_DOC).
CLASS_MENTION_PATTERNS = [
    r"liste de sorts (?:du|de la|de l.|d.|de) {c}\b",
    r"\bsa liste de {c}\b",
    r"\bses listes? de sorts? de {c}\b",
    r"\bniveaux? de {c}\b",
    r"\bniveau effectif de {c}\b",
]

# Contre-motifs : le don *confère* la capacité au lieu de l'exiger. La classe
# citée n'est alors qu'une référence de calcul et le don reste ouvert à tous.
# Ex. « Familier guêpe » : « obtient un familier comme avec la capacité pacte
# magique, en utilisant son niveau de personnage comme niveau de magicien ».
GRANTING_PATTERNS = [
    r"comme un pouvoir magique",
    r"comme des pouvoirs magiques",
    r"comme avec la capacite",
    r"son niveau de personnage comme niveau de",
    r"niveau de personnage comme niveau",
]

# --- Sortie curée : uniquement les dons relus un par un. ---
# Format : nom exact du don -> {"classes": [...], "evidence": "...", "reason": "..."}
RESTRICTIONS = {
    "Ombre druidique": {
        "classes": ["druide"],
        "evidence": "Le personnage ajoute les sorts suivants à sa liste de druide",
        "reason": (
            "Le don ne fait que réécrire la liste de sorts du druide (il ajoute "
            "neuf niveaux de sorts et retire les sorts de feu). Sans niveaux de "
            "druide, il n'a aucun effet. Ses Conditions ne mentionnent qu'un "
            "alignement et une divinité, d'où l'absence de restriction détectable "
            "dans Data/Dons.csv."
        ),
    },
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower()


def candidates() -> dict[str, list[str]]:
    """Régénère la liste de candidats à relire (pas la sortie finale)."""
    details = json.loads(DETAILS.read_text(encoding="utf-8"))
    ordered = sorted(VALID_CLASSES, key=len, reverse=True)
    found: dict[str, list[str]] = {}
    for name, entry in details.items():
        text = normalize(
            " ".join(
                entry.get(k) or ""
                for k in ("avantages_detail", "description", "special")
            )
        )
        if not text.strip() or any(re.search(p, text) for p in GRANTING_PATTERNS):
            continue
        hits = [
            cls
            for cls in ordered
            if any(re.search(p.format(c=re.escape(cls)), text) for p in CLASS_MENTION_PATTERNS)
        ]
        if hits:
            found[name] = sorted(hits)
    return found


def main() -> None:
    if "--candidats" in sys.argv:
        found = candidates()
        print(f"{len(found)} candidats à relire (aucun n'est retenu automatiquement) :")
        for name in sorted(found):
            print(f"  {name} -> {found[name]}")
        return

    details = json.loads(DETAILS.read_text(encoding="utf-8"))
    known = {name.rstrip("*").strip(): name for name in details}
    out = {}
    for name, info in RESTRICTIONS.items():
        if name not in known:
            raise SystemExit(
                f"don introuvable dans {DETAILS} : {name!r} — ne jamais inventer "
                f"un nom de don"
            )
        unknown = set(info["classes"]) - VALID_CLASSES
        if unknown:
            raise SystemExit(f"classes inconnues pour {name!r} : {sorted(unknown)}")
        out[known[name]] = {
            "classes": info["classes"],
            "evidence": info["evidence"],
            "reason": info["reason"],
            "confidence": "reviewed",
        }

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"{OUT_PATH} : {len(out)} don(s) restreint(s) par leur texte d'avantage")
    print(f"Raisonnement et candidats écartés : {ANALYSIS_DOC}")


if __name__ == "__main__":
    main()
