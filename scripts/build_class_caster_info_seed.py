"""One-off tool: build a draft class -> spellcasting-access map.

Cross-references Data/class_features.json against the fixed list of known
classes in pf1_dons/class_progression.py::CLASS_BBA_PROGRESSION, and writes a
best-effort draft (Data/class_caster_info.draft.json) flagging which classes
appear to have spellcasting access, based on French keyword hits in their
class-feature progression text.

This draft is only a secondary automated cross-check, never the ground truth
for arcane/divine/psychique typing (see Step 04's researched ground-truth doc)
-- "type" is deliberately always left null here.

Standalone script, not imported by the pf1_dons package. No network access.
"""

import json
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons.class_progression import CLASS_BBA_PROGRESSION

CLASS_FEATURES_PATH = "Data/class_features.json"
DRAFT_OUTPUT_PATH = "Data/class_caster_info.draft.json"

# Calibrated against real Data/class_features.json entries: known casters
# (magicien, pretre, ensorceleur, druide, barde, oracle) all hit one of these,
# known non-casters (guerrier, barbare, moine, roublard) hit none of them.
SPELLCASTING_KEYWORDS = [
    "sorts connus",
    "emplacements de sorts",
    "sorts par jour",
    "lanceur de sorts",
    "liste de sorts",
    "niveau de lanceur de sorts",
    "orientation arcane",
    "domaine",
    "mystere",
    "ecole de predilection",
    "sort de mystere",
    "tours de magie",
    "oraisons",
    "oraison",
    "pouvoir de lignage",
    "pacte magique",
    "ecole de magie",
    "incantation spontanee",
]


def _normalize(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in stripped if unicodedata.category(c) != "Mn")
    return stripped.lower()


def _lookup_key(class_key: str) -> str:
    """class_features.json uses underscores where CLASS_BBA_PROGRESSION uses spaces."""
    return class_key.replace(" ", "_")


def guess_caster(class_features_entry: dict) -> dict:
    all_ability_names = []
    for _level, ability_names in class_features_entry.items():
        all_ability_names.extend(ability_names)
    normalized_text = _normalize(" ".join(all_ability_names))

    evidence = [kw for kw in SPELLCASTING_KEYWORDS if kw in normalized_text]

    return {
        "is_caster": bool(evidence),
        "type": None,
        "confidence": "draft",
        "evidence": evidence,
    }


def main() -> None:
    with open(CLASS_FEATURES_PATH, encoding="utf-8") as f:
        class_features = json.load(f)

    out = {}
    for class_key in sorted(CLASS_BBA_PROGRESSION.keys()):
        entry = class_features.get(_lookup_key(class_key))
        if entry is None:
            out[class_key] = {
                "is_caster": None,
                "type": None,
                "confidence": "draft",
                "evidence": [],
                "note": "no class_features.json entry found",
            }
        else:
            out[class_key] = guess_caster(entry)

    with open(DRAFT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, sort_keys=True, ensure_ascii=False, indent=2)

    true_count = sum(1 for v in out.values() if v["is_caster"] is True)
    false_count = sum(1 for v in out.values() if v["is_caster"] is False)
    unknown_count = sum(1 for v in out.values() if v["is_caster"] is None)
    print(f"Total classes: {len(out)}")
    print(f"is_caster=true: {true_count}")
    print(f"is_caster=false: {false_count}")
    print(f"is_caster=unknown (no data): {unknown_count}")
    print(f"Draft written to {DRAFT_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
