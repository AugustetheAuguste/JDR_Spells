"""One-off tool: build a draft ability-keyword -> class(es) map.

Cross-references Data/classes/class_features.json against every CLASS_FEATURE_TEXT /
UNPARSED requirement segment currently produced by the parser across the
full Data/dons/Dons.csv catalog, and writes a draft file for manual curation.

Standalone script, not imported by the pf_dons package. No network access.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf_dons import paths
from pf_dons.data_loader import load_catalog
from pf_dons.models import OrGroup, RequirementType
from pf_dons.parser import KNOWN_CLASSES, _normalize

CLASS_FEATURES_PATH = paths.CLASS_FEATURES
DRAFT_OUTPUT_PATH = paths.CLASS_ABILITY_MAP_DRAFT


def build_reverse_index(class_to_levels: dict) -> dict[str, set[str]]:
    reverse_index: dict[str, set[str]] = {}
    for class_name, levels in class_to_levels.items():
        for _level, ability_names in levels.items():
            for ability_name in ability_names:
                key = _normalize(ability_name)
                reverse_index.setdefault(key, set()).add(class_name)
    return reverse_index


def flatten_requirements(requirements):
    for req in requirements:
        if isinstance(req, OrGroup):
            yield from req.options
        else:
            yield req


def collect_unique_segments(catalog) -> dict[str, str]:
    unique_segments: dict[str, str] = {}
    for feat in catalog:
        for req in flatten_requirements(feat.parsed.requirements):
            if req.type in (RequirementType.CLASS_FEATURE_TEXT, RequirementType.UNPARSED):
                key = _normalize(req.raw_text)
                unique_segments.setdefault(key, req.raw_text)
    return unique_segments


def literal_class_matches(normalized_text: str) -> list[str]:
    return sorted(
        cls for cls in KNOWN_CLASSES
        if re.search(rf"\b{re.escape(cls)}\b", normalized_text)
    )


def keyword_class_matches(normalized_text: str, reverse_index: dict[str, set[str]]):
    classes: set[str] = set()
    matched_keywords: list[str] = []
    for ability_key, classes_for_key in reverse_index.items():
        if ability_key and ability_key in normalized_text:
            classes |= classes_for_key
            matched_keywords.append(ability_key)
    return classes, matched_keywords


def main() -> None:
    with open(CLASS_FEATURES_PATH, encoding="utf-8") as f:
        class_to_levels = json.load(f)
    reverse_index = build_reverse_index(class_to_levels)

    catalog = load_catalog()
    unique_segments = collect_unique_segments(catalog)

    draft_entries = []
    for normalized_text, raw_text in unique_segments.items():
        literal_classes = literal_class_matches(normalized_text)
        keyword_classes, matched_keywords = keyword_class_matches(normalized_text, reverse_index)
        all_classes = sorted(set(literal_classes) | keyword_classes)
        draft_entries.append({
            "raw_text": raw_text,
            "normalized_text": normalized_text,
            "auto_detected_classes": all_classes,
            "matched_ability_keywords": matched_keywords,
            "matched_literal_class_names": literal_classes,
        })

    draft_entries.sort(key=lambda e: e["raw_text"])

    with open(DRAFT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(draft_entries, f, ensure_ascii=False, indent=2)

    total = len(draft_entries)
    matched = sum(1 for e in draft_entries if e["auto_detected_classes"])
    unmatched = total - matched
    print(f"Total unique segments: {total}")
    print(f"Auto-detected >=1 class: {matched}")
    print(f"Zero auto-detected classes (need manual review): {unmatched}")
    print(f"Draft written to {DRAFT_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
