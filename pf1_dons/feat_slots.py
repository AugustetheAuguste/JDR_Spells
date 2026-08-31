import json
from pathlib import Path
from typing import Optional

from . import paths
from .class_progression import _normalize_class_name
from .models import FeatSlot, RaceInfo
from .race_loader import get_race

DEFAULT_CLASS_BONUS_FEATS_PATH = paths.CLASS_BONUS_FEATS


def load_class_bonus_feats(path: Path = DEFAULT_CLASS_BONUS_FEATS_PATH) -> dict[str, dict]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def general_slot_levels(max_level: int) -> list[int]:
    # standard PF1 rule: level 1, then every odd level thereafter
    return [lvl for lvl in range(1, max_level + 1) if lvl == 1 or lvl % 2 == 1]


def compute_feat_slots(
    character_class: str,
    level: int,
    race_name: Optional[str],
    races: dict[str, RaceInfo],
    class_bonus_feats: dict[str, dict],
) -> list[FeatSlot]:
    slots: list[FeatSlot] = []

    for lvl in general_slot_levels(level):
        slots.append(FeatSlot(slot_id=f"general-{lvl}", source="general", level_gained=lvl))

    race_info = get_race(races, race_name) if race_name else None
    if race_info and race_info.has_bonus_feat:
        slots.append(FeatSlot(slot_id="racial-1", source="racial", level_gained=1))

    class_key = _normalize_class_name(character_class)
    class_entry = class_bonus_feats.get(
        class_key, {"bonus_feat_levels": [], "category_restriction": None}
    )
    for lvl in class_entry.get("bonus_feat_levels", []):
        if lvl <= level:
            slots.append(
                FeatSlot(
                    slot_id=f"class-{lvl}",
                    source="class",
                    level_gained=lvl,
                    category_restriction=class_entry.get("category_restriction"),
                )
            )

    slots.sort(key=lambda s: (s.level_gained, s.source))
    return slots
