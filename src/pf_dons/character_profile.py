"""Character creation-time profile model.

Wraps the engine's existing ``Character`` (``pf_dons.engine``) with feat
slot tracking (``pf_dons.feat_slots``) and exposes feat assignment
operations (assign/unassign a feat into a specific open slot, with basic
slot-compatibility checks). This is the object the CLI and persistence
layers operate on.
"""

from dataclasses import dataclass, field
from typing import Optional

from .data_loader import FeatRow
from .engine import Character, evaluate_feat
from .feat_slots import compute_feat_slots
from .models import FeatSlot, RaceInfo


@dataclass
class CharacterProfile:
    name: str
    character_class: str
    level: int
    race: Optional[str] = None
    ability_scores: dict[str, int] = field(default_factory=dict)
    skill_ranks: dict[str, int] = field(default_factory=dict)
    feat_slots: list[FeatSlot] = field(default_factory=list)
    # Optionnels : renseignés, ils rendent décidables les prérequis
    # d'alignement et de culte (« alignement Bon », « suivant de Torag »).
    alignment: Optional[str] = None
    deity: Optional[str] = None

    def to_character(self) -> Character:
        return Character(
            character_class=self.character_class,
            level=self.level,
            race=self.race,
            ability_scores=self.ability_scores or None,
            known_feats={s.filled_by for s in self.feat_slots if s.filled_by},
            skill_ranks=self.skill_ranks or None,
            alignment=self.alignment,
            deity=self.deity,
        )

    def open_slots(self) -> list[FeatSlot]:
        return [s for s in self.feat_slots if s.filled_by is None]

    def find_slot(self, slot_id: str) -> Optional[FeatSlot]:
        return next((s for s in self.feat_slots if s.slot_id == slot_id), None)


def create_profile(
    name: str,
    character_class: str,
    level: int,
    race: Optional[str],
    ability_scores: dict[str, int],
    races: dict[str, RaceInfo],
    class_bonus_feats: dict[str, dict],
    alignment: Optional[str] = None,
    deity: Optional[str] = None,
) -> CharacterProfile:
    slots = compute_feat_slots(character_class, level, race, races, class_bonus_feats)
    return CharacterProfile(
        name=name,
        character_class=character_class,
        level=level,
        race=race,
        ability_scores=dict(ability_scores),
        feat_slots=slots,
        alignment=alignment,
        deity=deity,
    )


def eligible_feats_for_slot(
    profile: CharacterProfile,
    slot: FeatSlot,
    catalog: list[FeatRow],
    feat_categories: dict[str, dict],
) -> list[FeatRow]:
    character = profile.to_character()
    candidates = []
    for feat in catalog:
        if slot.category_restriction is not None:
            cat_entry = feat_categories.get(feat.name, {"categories": []})
            if slot.category_restriction not in cat_entry.get("categories", []):
                continue
        result = evaluate_feat(feat, character)
        if result.status in ("eligible", "manual_check"):
            candidates.append(feat)
    return candidates


class SlotAssignmentError(Exception):
    pass


def assign_feat(profile: CharacterProfile, slot_id: str, feat_name: str) -> None:
    slot = profile.find_slot(slot_id)
    if slot is None:
        raise SlotAssignmentError(f"slot inconnu : {slot_id}")
    if slot.filled_by is not None:
        raise SlotAssignmentError(f"slot déjà occupé : {slot_id} -> {slot.filled_by}")
    if feat_name in {s.filled_by for s in profile.feat_slots if s.filled_by}:
        raise SlotAssignmentError(f"don déjà attribué à un autre emplacement : {feat_name}")
    slot.filled_by = feat_name


def unassign_feat(profile: CharacterProfile, slot_id: str) -> None:
    slot = profile.find_slot(slot_id)
    if slot is None:
        raise SlotAssignmentError(f"slot inconnu : {slot_id}")
    slot.filled_by = None
