"""Persistence (JSON save/load) for `CharacterProfile` objects.

Characters are stored as one JSON file per character under
`Data/characters/`, keyed by a filesystem-safe slug of their display name.
"""

import json
import re
from dataclasses import asdict
from pathlib import Path

from .character_profile import CharacterProfile
from .models import FeatSlot

DEFAULT_CHARACTERS_DIR = Path("Data/characters")


def _character_path(name: str, base_dir: Path = DEFAULT_CHARACTERS_DIR) -> Path:
    safe_name = re.sub(r"[^\w\-]+", "_", name.strip())
    return base_dir / f"{safe_name}.json"


def save_profile(
    profile: CharacterProfile, base_dir: Path = DEFAULT_CHARACTERS_DIR
) -> Path:
    base_dir.mkdir(parents=True, exist_ok=True)
    path = _character_path(profile.name, base_dir)
    payload = {
        "name": profile.name,
        "character_class": profile.character_class,
        "level": profile.level,
        "race": profile.race,
        "ability_scores": profile.ability_scores,
        "skill_ranks": profile.skill_ranks,
        "feat_slots": [asdict(slot) for slot in profile.feat_slots],
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def load_profile(
    name: str, base_dir: Path = DEFAULT_CHARACTERS_DIR
) -> CharacterProfile:
    path = _character_path(name, base_dir)
    if not path.exists():
        raise FileNotFoundError(f"personnage introuvable : {name} ({path})")
    data = json.loads(path.read_text(encoding="utf-8"))
    return CharacterProfile(
        name=data["name"],
        character_class=data["character_class"],
        level=data["level"],
        race=data.get("race"),
        ability_scores=data.get("ability_scores", {}),
        skill_ranks=data.get("skill_ranks", {}),
        feat_slots=[FeatSlot(**s) for s in data.get("feat_slots", [])],
    )


def list_characters(base_dir: Path = DEFAULT_CHARACTERS_DIR) -> list[str]:
    if not base_dir.exists():
        return []
    return sorted(p.stem for p in base_dir.glob("*.json"))
