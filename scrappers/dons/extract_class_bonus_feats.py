"""Derive per-class bonus-feat levels from the already-scraped
``Data/classes/class_features.json`` and write ``Data/classes/class_bonus_feats.json``.

Standalone script, not imported by the ``pf_dons`` package (matches the
pattern established by ``extract_class_features.py``). Performs no network
access: it is a pure JSON transformation over data already produced by
``extract_class_features.py``.
"""

import json
import unicodedata
from pathlib import Path
import sys

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths

IN_PATH = Path(paths.CLASS_FEATURES)
OUT_PATH = Path(paths.CLASS_BONUS_FEATS)

BONUS_FEAT_MARKERS = ["don supplementaire", "dons supplementaires"]


def normalize(text):
    """NFKD strip of accents + lowercase (copied from pf_dons/parser.py::_normalize)."""
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return stripped.lower()


def main():
    if not IN_PATH.exists():
        raise FileNotFoundError(
            f"{IN_PATH} not found. Run extract_class_features.py first to "
            "produce it before running this script."
        )

    data = json.loads(IN_PATH.read_text(encoding="utf-8"))
    out = {}
    for class_key, levels in data.items():
        bonus_levels = []
        for level_str, features in levels.items():
            if any(
                any(marker in normalize(f) for marker in BONUS_FEAT_MARKERS)
                for f in features
            ):
                bonus_levels.append(int(level_str))
        bonus_levels.sort()
        out[class_key] = {
            "bonus_feat_levels": bonus_levels,
            # Category restriction is not derivable from this data source;
            # left explicit and null for later manual curation / Step 04.
            "category_restriction": None,
        }

    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(
        f"{len(out)} classes processed; "
        f"{sum(1 for v in out.values() if v['bonus_feat_levels'])} grant bonus feats"
    )


if __name__ == "__main__":
    main()
