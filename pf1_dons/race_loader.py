import json
from pathlib import Path
from typing import Optional

from . import paths
from .engine import _normalize
from .models import AbilityModifier, RaceInfo

DEFAULT_RACES_PATH = paths.RACES


def load_races(path: Path = DEFAULT_RACES_PATH) -> dict[str, RaceInfo]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {key: _build_race_info(key, entry) for key, entry in raw.items()}


def _build_race_info(key: str, entry: dict) -> RaceInfo:
    return RaceInfo(
        key=key,
        traits=entry.get("traits", []),
        ability_modifiers=[
            AbilityModifier(**m) for m in (entry.get("ability_modifiers") or [])
        ],
        size=entry.get("size"),
        speed=entry.get("speed"),
        has_bonus_feat=bool(entry.get("has_bonus_feat")),
        bonus_skill_rank=bool(entry.get("bonus_skill_rank")),
        class_skill_grants=entry.get("class_skill_grants") or [],
        note=entry.get("note"),
    )


def get_race(races: dict[str, RaceInfo], race_name: str) -> Optional[RaceInfo]:
    return races.get(_normalize(race_name))
