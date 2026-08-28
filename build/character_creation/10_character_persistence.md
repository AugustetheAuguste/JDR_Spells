# Step 10 — Character persistence (`pf1_dons/persistence.py`)

## Objectives

Save and load `CharacterProfile` objects as JSON files under
`Data/characters/`, so a character created via CLI survives between runs.

## Dependencies & Parallelization

- **Wave 5.** Depends on Step 09 (`pf1_dons.character_profile.CharacterProfile`,
  `pf1_dons.models.FeatSlot`). No other dependency.

## Inherited Context from Step 09

```python
from pf1_dons.character_profile import CharacterProfile
from pf1_dons.models import FeatSlot

# CharacterProfile fields: name, character_class, level, race,
#   ability_scores: dict[str,int], skill_ranks: dict[str,int],
#   feat_slots: list[FeatSlot]
# FeatSlot fields: slot_id, source, level_gained, category_restriction, filled_by
```
Both are plain `@dataclass` definitions with only JSON-serializable field
types (str, int, Optional[str], dict[str,int], list[FeatSlot]) — no custom
`__init__` logic to worry about when round-tripping.

## Pseudo-code

New file `pf1_dons/persistence.py`:
```python
DEFAULT_CHARACTERS_DIR = Path("Data/characters")

def _character_path(name: str, base_dir: Path = DEFAULT_CHARACTERS_DIR) -> Path:
    safe_name = re.sub(r"[^\w\-]+", "_", name.strip())  # filesystem-safe slug
    return base_dir / f"{safe_name}.json"

def save_profile(profile: CharacterProfile, base_dir: Path = DEFAULT_CHARACTERS_DIR) -> Path:
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
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path

def load_profile(name: str, base_dir: Path = DEFAULT_CHARACTERS_DIR) -> CharacterProfile:
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
```

## Logic Flow

1. `save_profile` slugifies the character's display `name` into a
   filesystem-safe filename, ensures `Data/characters/` exists, and writes
   a plain JSON dict (using `dataclasses.asdict` for the `FeatSlot` list to
   avoid hand-writing that mapping).
2. `load_profile` reverses this exactly, reconstructing `FeatSlot` objects
   from their dict form and raising a clear `FileNotFoundError` (with the
   attempted path) if the character doesn't exist — never returns a
   partially-built or default profile silently.
3. `list_characters` is a convenience the CLI (Step 11) uses to show what's
   available to load, by listing `*.json` stems in the characters
   directory.

## Implementation Notes

- Use `dataclasses.asdict(slot)` for each `FeatSlot`, not a hand-rolled
  dict, to avoid the list of fields silently drifting out of sync if
  `FeatSlot` gains fields later.
- Round-trip fidelity is the hard requirement here — `save_profile` then
  `load_profile` must reproduce an equal `CharacterProfile` (field-for-field,
  including exact slot list order and every `filled_by` value).
- `_character_path`'s slugify regex intentionally allows only word
  characters and hyphens — if two different display names slugify to the
  same filename, `save_profile` silently overwrites the earlier file; this
  is an acceptable known limitation for this plan's scope (single-user,
  local tool) — do not add collision-detection logic beyond this.

## Verification Criteria

- `save_profile(profile)` creates `Data/characters/<slug>.json` containing
  valid JSON with all expected top-level keys.
- `load_profile(profile.name)` returns a `CharacterProfile` equal to the
  original (`==` on dataclasses with matching field values) after a
  save→load round trip, including a profile with at least one filled slot
  and one open slot.
- `load_profile("does-not-exist")` raises `FileNotFoundError` mentioning the
  attempted path.
- `list_characters()` returns an empty list when the directory doesn't
  exist yet, and returns the correct slugified names after saving two
  different profiles.

## Git Handling

- Branch: `feature/character-creation/10-persistence`.
- Commit new `pf1_dons/persistence.py`. Add `Data/characters/` to
  `.gitignore` if test fixtures would otherwise leave stray character files
  in the repo — verify how the test suite (Step 13) isolates its I/O (e.g.
  via `tmp_path`) before deciding whether any real committed characters
  belong in the repo at all; default to NOT committing any
  `Data/characters/*.json` produced incidentally by manual testing during
  this step.
- Commit message: `pf1_dons(10): add character profile persistence`.

## Expected Outcome

Reliable JSON save/load for `CharacterProfile`, ready for the CLI (Steps
11/12) to build on.
