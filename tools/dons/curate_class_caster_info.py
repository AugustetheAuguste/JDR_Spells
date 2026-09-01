"""One-off curation script for Wave 2 / Step 07: transcribes the verified
research of Step 04 (`build/feat-detail-and-magic-gating/
OUTPUT_class_caster_ground_truth.md`) into the final, committed
`Data/classes/class_caster_info.json`.

Not part of the package; run manually:
    python scripts/curate_class_caster_info.py

This script never improvises or "corrects" a verdict itself: the markdown
table produced by Step 04 is the sole source of truth. Step 05's draft
(`Data/classes/class_caster_info.draft.json`) is used only as a secondary
cross-check, to print disagreements for human audit -- never to override
Step 04.
"""
import json
import re

import sys
from pathlib import Path

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths
from pf1_dons.class_progression import CLASS_BBA_PROGRESSION

GROUND_TRUTH_DOC = "build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md"
DRAFT_PATH = paths.CLASS_CASTER_INFO_DRAFT
OUT_PATH = paths.CLASS_CASTER_INFO

VALID_CLASSES = set(CLASS_BBA_PROGRESSION.keys())
VALID_TYPES = {"arcane", "divine", "psychique"}

TABLE_ROW_RE = re.compile(
    r"^\|\s*(?P<classe>[^|]+?)\s*\|\s*(?P<is_caster>[^|]+?)\s*\|\s*(?P<type>[^|]+?)\s*"
    r"\|\s*(?P<lanceur>[^|]+?)\s*\|\s*(?P<justification>.*?)\s*\|\s*$"
)


def parse_bool(text):
    if text == "true":
        return True
    if text == "false":
        return False
    raise ValueError(f"valeur is_caster inattendue: {text!r}")


def parse_type(text):
    if text == "null":
        return None
    return text


def parse_ground_truth_table(doc_text):
    """Parse the Step 04 markdown table (classe | is_caster | type | lanceur |
    justification) line by line. Returns class_key -> {"is_caster", "type",
    "justification"}, exactly as written in the document -- never
    reinterpreted or "corrected" here."""
    result = {}
    in_table = False
    extra_types_seen = set()

    for raw_line in doc_text.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            in_table = False
            continue

        m = TABLE_ROW_RE.match(line)
        if not m:
            raise ValueError(f"ligne de tableau markdown mal formée: {line!r}")

        classe = m.group("classe").strip()
        is_caster_raw = m.group("is_caster").strip()
        type_raw = m.group("type").strip()

        if classe == "classe" or set(classe) <= {"-", ":"}:
            # header row or separator row (---|---|...)
            in_table = True
            continue

        if not in_table:
            # a stray '|'-prefixed line outside the table we care about
            continue

        is_caster = parse_bool(is_caster_raw)
        type_value = parse_type(type_raw)

        if type_value is not None and type_value not in VALID_TYPES:
            extra_types_seen.add((classe, type_value))

        if is_caster and type_value is None:
            raise ValueError(
                f"classe {classe!r}: is_caster=true mais type=null -- incohérence dans "
                f"le document Step 04, à corriger là-bas, pas ici"
            )
        if not is_caster and type_value is not None:
            raise ValueError(
                f"classe {classe!r}: is_caster=false mais type={type_value!r} -- incohérence "
                f"dans le document Step 04, à corriger là-bas, pas ici"
            )

        if classe in result:
            raise ValueError(f"classe {classe!r} apparaît plusieurs fois dans le tableau Step 04")

        result[classe] = {
            "is_caster": is_caster,
            "type": type_value,
            "justification": m.group("justification").strip(),
        }

    result["_extra_types_seen"] = extra_types_seen
    return result


def main():
    with open(GROUND_TRUTH_DOC, encoding="utf-8") as f:
        doc_text = f.read()

    ground_truth = parse_ground_truth_table(doc_text)
    extra_types_seen = ground_truth.pop("_extra_types_seen")

    try:
        with open(DRAFT_PATH, encoding="utf-8") as f:
            draft = json.load(f)
    except FileNotFoundError:
        draft = {}

    missing = VALID_CLASSES - set(ground_truth.keys())
    if missing:
        raise ValueError(
            f"classes manquantes dans {GROUND_TRUTH_DOC}: {sorted(missing)} -- retourner à "
            f"Step 04 pour les compléter, ne pas deviner ici"
        )

    out = {}
    disagreements = []
    for class_key in sorted(VALID_CLASSES):
        verdict = ground_truth[class_key]
        out[class_key] = {
            "is_caster": verdict["is_caster"],
            "type": verdict["type"],
            "confidence": "reviewed",
            "source": "OUTPUT_class_caster_ground_truth.md",
        }

        draft_entry = draft.get(class_key)
        if (
            draft_entry
            and draft_entry.get("is_caster") is not None
            and draft_entry["is_caster"] != verdict["is_caster"]
        ):
            disagreements.append(class_key)

    assert set(out.keys()) == VALID_CLASSES, "couverture incomplète -- ne devrait jamais arriver ici"

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"total classes = {len(out)}")
    print(f"désaccords draft/ground-truth (à relire, pas bloquant) : {sorted(disagreements)}")
    if extra_types_seen:
        print(f"types hors {sorted(VALID_TYPES)} explicitement documentés par Step 04 : {sorted(extra_types_seen)}")


if __name__ == "__main__":
    main()
