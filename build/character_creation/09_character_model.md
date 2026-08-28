# Step 09 — Character profile model (`pf1_dons/character_profile.py`)

## Objectives

Introduce `CharacterProfile`, the rich creation-time character model that
wraps the engine's existing `Character` (`pf1_dons/engine.py`), adds feat
slot tracking (Step 07) and known ability-score-driven skill budget
(Step 08), and exposes feat assignment operations (assign/unassign a feat
into a specific open slot, with basic slot-compatibility checks). This is
the object the CLI (Steps 10/11) and persistence (Step 10... see numbering
below) operate on.

## Dependencies & Parallelization

- **Wave 4.** Depends on Step 07 (`pf1_dons.feat_slots`) and Step 08
  (`pf1_dons.skill_budget`). Also depends on the pre-existing
  `pf1_dons.engine.Character` and `pf1_dons.data_loader.FeatRow` — no
  changes needed to either, this step only imports them.

## Inherited Context from Step 07 and Step 08

```python
from pf1_dons.feat_slots import compute_feat_slots, load_class_bonus_feats
from pf1_dons.race_loader import load_races
from pf1_dons.class_skills import load_class_skills, get_class_skill_info
from pf1_dons.skill_budget import total_skill_points
from pf1_dons.models import FeatSlot
from pf1_dons.engine import Character, evaluate_feat, EligibilityResult
from pf1_dons.data_loader import FeatRow

compute_feat_slots(character_class, level, race_name, races, class_bonus_feats) -> list[FeatSlot]
# FeatSlot(slot_id, source, level_gained, category_restriction, filled_by)
total_skill_points(class_skill_info, ability_scores, level, bonus_skill_rank_per_level) -> Optional[int]
evaluate_feat(feat: FeatRow, character: Character) -> EligibilityResult  # .status in eligible/manual_check/ineligible
```

## Pseudo-code

New file `pf1_dons/character_profile.py`:
```python
@dataclass
class CharacterProfile:
    name: str
    character_class: str
    level: int
    race: Optional[str] = None
    ability_scores: dict[str, int] = field(default_factory=dict)
    skill_ranks: dict[str, int] = field(default_factory=dict)
    feat_slots: list[FeatSlot] = field(default_factory=list)

    def to_character(self) -> Character:
        return Character(
            character_class=self.character_class,
            level=self.level,
            race=self.race,
            ability_scores=self.ability_scores or None,
            known_feats={s.filled_by for s in self.feat_slots if s.filled_by},
            skill_ranks=self.skill_ranks or None,
        )

    def open_slots(self) -> list[FeatSlot]:
        return [s for s in self.feat_slots if s.filled_by is None]

    def find_slot(self, slot_id: str) -> Optional[FeatSlot]:
        return next((s for s in self.feat_slots if s.slot_id == slot_id), None)


def create_profile(
    name: str, character_class: str, level: int, race: Optional[str],
    ability_scores: dict[str, int],
    races: dict[str, RaceInfo], class_bonus_feats: dict[str, dict],
) -> CharacterProfile:
    slots = compute_feat_slots(character_class, level, race, races, class_bonus_feats)
    return CharacterProfile(
        name=name, character_class=character_class, level=level,
        race=race, ability_scores=dict(ability_scores), feat_slots=slots,
    )


def eligible_feats_for_slot(
    profile: CharacterProfile, slot: FeatSlot, catalog: list[FeatRow],
    feat_categories: dict[str, dict],
) -> list[FeatRow]:
    character = profile.to_character()
    candidates = []
    for feat in catalog:
        if slot.category_restriction is not None:
            cat_entry = feat_categories.get(feat.name, {"categories": []})
            if slot.category_restriction not in cat_entry["categories"]:
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
```

## Logic Flow

1. `create_profile` computes the slot layout once at creation time from
   class/level/race, leaving every slot unfilled.
2. `to_character()` bridges to the existing `engine.Character`, feeding
   currently-assigned feat names in as `known_feats` — this makes the
   existing `evaluate_feat`/`filter_feats` machinery immediately reusable
   for eligibility checks against a partially-built character, with zero
   changes to `engine.py`.
3. `eligible_feats_for_slot` filters the full catalog first by the slot's
   category restriction (if any, via Step 04's `Data/feat_categories.json`),
   then by engine eligibility, returning both "eligible" and
   "manual_check" feats (never silently drop manual_check ones — a human
   still needs to be able to pick them, matching this codebase's existing
   philosophy of surfacing ambiguity rather than hiding it).
4. `assign_feat`/`unassign_feat` mutate `profile.feat_slots` in place with
   basic guardrails: slot must exist, must be open, and the feat must not
   already be assigned to a different slot (no duplicate feats across
   slots — this is a simplification; feats that can be taken multiple
   times, e.g. via `*`-suffixed repeatable feats in `Data/Dons.csv`, are
   explicitly out of scope for this plan and should raise the same
   `SlotAssignmentError` if attempted twice — flag this limitation in the
   CLI's help text in Step 10).

## Implementation Notes

- `CharacterProfile` does NOT re-validate eligibility inside `assign_feat`
  — that check happens earlier via `eligible_feats_for_slot`, which the CLI
  is required to call before presenting choices to the user (Step 10/11's
  Verification Criteria must confirm this ordering). `assign_feat` itself
  only enforces slot bookkeeping invariants, keeping it a cheap, pure
  mutation.
- `feat_categories` param type in `eligible_feats_for_slot` matches Step
  04's `Data/feat_categories.json` shape: `{feat_name: {"categories": [...], "needs_manual_check": bool}}`.
- Do not add a skill-ranks auto-fill here; `skill_ranks` stays whatever the
  CLI (Step 10) explicitly sets, consistent with the "manual allocation"
  decision.

## Verification Criteria

- `create_profile("Test", "Guerrier", 1, "Humain", {"For": 16}, races, class_bonus_feats)`
  produces a profile with 3 open slots (`general-1`, `racial-1`, `class-1`).
- `eligible_feats_for_slot` on the `general-1` slot for a level-1 fighter
  with `For` provided returns a non-empty list including feats whose only
  requirement is level/class/BBA (cross-check against
  `tests/test_engine.py::test_arme_en_main_bba`'s known-eligible feat
  "Arme en main").
- `assign_feat(profile, "general-1", "Arme en main")` then
  `profile.find_slot("general-1").filled_by == "Arme en main"`.
- Assigning the same feat name to a second slot raises `SlotAssignmentError`.
- Assigning to an already-filled or nonexistent slot_id raises
  `SlotAssignmentError`.
- `unassign_feat` clears `filled_by` and the slot becomes assignable again.

## Git Handling

- Branch: `feature/character-creation/09-character-profile`.
- Commit new `pf1_dons/character_profile.py`.
- Commit message: `pf1_dons(09): add CharacterProfile with feat slot assignment`.

## Expected Outcome

A tested `CharacterProfile` API that bridges slot tracking to the existing
eligibility engine, ready for persistence (Step 10) and CLI wiring
(Step 11/12).
