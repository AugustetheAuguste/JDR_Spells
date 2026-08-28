# pf1_dons — Character Creation & Feat Assignment Pipeline

Full report of what was built on top of the existing `pf1_dons` feat-eligibility
engine: data scrapers, typed loaders, calculators, the character model, persistence,
and a CLI. All merged into `main` (commit `994dfc9` + follow-ups), 48/48 tests
passing, verified live end-to-end.

## 1. What this is

`pf1_dons` already had a pipeline for parsing Pathfinder 1e French feats and
checking whether a character is eligible for them. This work adds the missing
piece: actually **building** a character (class/level/race/ability scores),
knowing how many feat slots they have and of what kind, checking which feats
are eligible for each slot, assigning feats, and saving/loading the result —
all through a CLI.

```
scrape/extract data  →  typed loader modules  →  pure calculators
        →  CharacterProfile (bridges into the existing eligibility engine)
        →  JSON persistence  →  CLI
```

## 2. Data pipeline (scrapers)

Four standalone scripts (repo root, not imported by the package — same
convention as the pre-existing `extract_class_features.py`). Each is
idempotent and safe to re-run; downloaded HTML is cached so re-runs don't
re-hit the network unless the cache is deleted or `force=True` is used.

| Script | Produces | Depends on |
|---|---|---|
| `scrape_races.py` | `Data/races.json` (53 races) | pathfinder-fr.org (live fetch) |
| `scrape_class_skills.py` | `Data/class_skills.json` (41 classes) | pathfinder-fr.org (live fetch) |
| `extract_class_bonus_feats.py` | `Data/class_bonus_feats.json` | `Data/class_features.json` (already existed) |
| `tag_feat_categories.py` | `Data/feat_categories.json` (1417 feats) | `Data/Dons.csv` (already existed) |

Regenerate everything:
```bash
python scrape_races.py
python scrape_class_skills.py
python extract_class_bonus_feats.py   # needs Data/class_features.json to exist first
python tag_feat_categories.py
```

### Data shapes produced

**`Data/races.json`** — one entry per race key (matches `pf1_dons/parser.py::KNOWN_RACES`):
```json
{
  "humain": {
    "traits": [{"name": "Don supplémentaire", "description": "..."}],
    "ability_modifiers": [{"ability": "choice", "modifier": 2}],
    "size": "M", "speed": 9,
    "has_bonus_feat": true, "bonus_skill_rank": true,
    "class_skill_grants": []
  }
}
```
Races with no scrapeable standard-traits page (bestiary races: `homme-serpent`,
`ogre`, `troll`) get all structured fields `null`/`[]` plus a `"note"` field
explaining why, instead of a guess or a crash.

**`Data/class_skills.json`** — one entry per class:
```json
{
  "guerrier": {
    "class_skills": [{"skill": "Équitation", "ability": "Dex"}, ...],
    "skill_points_formula_raw": "2 + modificateur d'Intelligence",
    "skill_points_formula": {"base": 2, "ability": "Int"}
  }
}
```

**`Data/class_bonus_feats.json`**:
```json
{"guerrier": {"bonus_feat_levels": [1,2,4,6,8,10,12,14,16,18,20], "category_restriction": null}}
```
`category_restriction` is currently always `null` (best-effort limitation,
documented — see §7); a human can hand-edit it to a category string (e.g.
`"combat"`) and the slot calculator will honor it without any code change.

**`Data/feat_categories.json`**:
```json
{"Arme en main": {"categories": ["combat"], "needs_manual_check": false}}
```
Best-effort keyword tagging; ~80% of feats end up `needs_manual_check: true`
(most feats aren't combat/social/etc. — expected, not a defect).

## 3. Package modules built

All under `pf1_dons/`, all pure Python, all with typed dataclasses in `models.py`.

| Module | Purpose |
|---|---|
| `race_loader.py` | Loads `Data/races.json` → `dict[str, RaceInfo]`. `get_race()` does accent/case-insensitive lookup. |
| `class_skills.py` | Loads `Data/class_skills.json` → `dict[str, ClassSkillInfo]`. `is_class_skill()` checks class-skill membership. |
| `feat_slots.py` | `compute_feat_slots(class, level, race, races, class_bonus_feats) -> list[FeatSlot]` — pure function, no I/O inside it. General slots (level 1 + every odd level), one racial slot if the race grants a bonus feat, one class slot per level in the class's bonus-feat-level list. |
| `skill_budget.py` | `total_skill_points()` — real skill-point budget from a class formula + ability scores + level (+racial bonus rank if applicable). `class_skill_bonus()` — the standard +3 class-skill bonus. Returns `None` explicitly when data is missing, never a wrong number. |
| `character_profile.py` | `CharacterProfile` — the creation-time character model (name, class, level, race, ability scores, skill ranks, feat slots). `to_character()` bridges to the **existing, untouched** `engine.Character` so the pre-existing `evaluate_feat` eligibility machinery works unmodified. `eligible_feats_for_slot()`, `assign_feat()`, `unassign_feat()`. |
| `persistence.py` | `save_profile()` / `load_profile()` / `list_characters()` — JSON round-trip under `Data/characters/`. |
| `cli.py` | The CLI entry point (see §4). |

**Important design point:** none of this touches `pf1_dons/engine.py`'s
existing `Character.skill_rank` "optimistic" placeholder or any pre-existing
test. `skill_budget.py` is a parallel, opt-in calculation the CLI uses; the
engine's eligibility checks keep using the placeholder unless a
`Character.skill_ranks` is explicitly populated.

## 4. CLI — how to launch it

No install/build step beyond the existing `pip install -r requirements.txt`.
Everything runs via:

```bash
python -m pf1_dons.cli <command> ...
```

| Command | Effect |
|---|---|
| `create <name> --class <c> --level <n> [--race <r>] [--for N --dex N --con N --int N --sag N --cha N]` | Builds a character, computes feat slots, saves to `Data/characters/<slug>.json`, prints a summary. |
| `show <name>` | Loads and prints a saved character's summary + slot layout. |
| `list` | Lists saved character names. |
| `slots <name> [--open-only]` | Lists slots; for each open one, lists currently-eligible feats (candidate list capped at 20 for readability). |
| `assign <name> <slot_id> "<feat name>"` | Re-checks eligibility fresh, assigns if valid, persists. |
| `unassign <name> <slot_id>` | Clears a slot, persists. |

### End-to-end example

```bash
python -m pf1_dons.cli create Aldric --class Guerrier --level 3 --race Humain --for 18 --int 12
# Personnage 'Aldric' créé -> Data/characters/Aldric.json
# Aldric — Guerrier niveau 3, Humain
# Caractéristiques : {'For': 18, 'Int': 12}
# Points de compétence estimés : 9
# Emplacements de don :
#   class-1 (niveau 1, class) -> (vide)
#   general-1 (niveau 1, general) -> (vide)
#   racial-1 (niveau 1, racial) -> (vide)
#   class-2 (niveau 2, class) -> (vide)
#   general-3 (niveau 3, general) -> (vide)

python -m pf1_dons.cli slots Aldric --open-only
python -m pf1_dons.cli assign Aldric general-1 "Arme en main"
python -m pf1_dons.cli show Aldric        # reflects the assignment
python -m pf1_dons.cli unassign Aldric general-1
python -m pf1_dons.cli list                # -> Aldric
```

Known, deliberate limitation: repeatable/multi-take feats (names ending in
`*` in `Data/Dons.csv`) can't be assigned to more than one slot via the CLI —
out of scope for this plan, not a bug.

## 5. How to test it

```bash
pip install -r requirements.txt
python -m pytest              # full suite: 48 tests
python -m pytest tests/test_character_profile.py     # one new module
python -m pytest tests/test_cli.py -v                # CLI-level tests
python -m pytest tests/test_engine.py::test_ailes_de_tengu   # single pre-existing test, untouched
```

15 pre-existing tests (`test_class_progression.py`, `test_engine.py`,
`test_parser.py`) are unmodified and still pass. 33 new tests added across
7 files:

| Test file | Covers |
|---|---|
| `test_race_loader.py` | `load_races`, `get_race`, unresolved-race fallback |
| `test_class_skills.py` | Skill formula parsing, `is_class_skill` |
| `test_feat_slots.py` | Slot counts for fighter/wizard/sorcerer at various levels, unknown-class fallback |
| `test_skill_budget.py` | Ability modifier table, floor-at-1 rule, `None`-propagation, class-skill +3 bonus |
| `test_character_profile.py` | Slot creation, real-catalog eligibility, assign/unassign invariants |
| `test_persistence.py` | Save→load round-trip (dataclass equality), missing-character error, `list_characters` |
| `test_cli.py` | Full CLI command flow via `cli.main([...])`, isolated from the real `Data/characters/` via `monkeypatch` + `tmp_path` |

`test_persistence.py`/`test_cli.py` never touch the real `Data/characters/`
directory — confirmed by running the full suite and checking
`Data/characters/` is empty afterward.

A `/verify` pass (live CLI runtime observation, not just pytest) was also
run against `main` — see `build/character_creation/reports/14_claude_md_update_report.md`
and the verify-skill recipe at `.claude/skills/verify/SKILL.md` for the
exact commands and what they showed, including two adversarial probes
(duplicate-feat-across-slots rejection, assign-to-filled-slot rejection)
that both produced distinct, correct French error messages.

## 6. Architecture map (file → file)

```
Data/Dons.csv ──────────────┐
Data/class_features.json ───┼─→ extract_class_bonus_feats.py → Data/class_bonus_feats.json ─┐
                             │                                                                │
scrape_races.py → Data/races.json ──────────────────────→ race_loader.py ─┐                  │
scrape_class_skills.py → Data/class_skills.json ────────→ class_skills.py ─┼─→ feat_slots.py ─┤
tag_feat_categories.py → Data/feat_categories.json ────────────────────────┘                  │
                                                                                                ▼
class_skills.py ──→ skill_budget.py ─┐                                          feat_slots.py
                                       ├──────────────────────────────────────→ character_profile.py
engine.py (pre-existing, untouched) ──┘        (to_character() bridges here)         │
data_loader.py (pre-existing) ─────────────────────────────────────────────────────→ │
                                                                                       ▼
                                                                              persistence.py
                                                                                       │
                                                                                       ▼
                                                                                    cli.py
```

## 7. Known limitations (by design, documented, not oversights)

- `category_restriction` on class-bonus feat slots (e.g. "fighter bonus feat
  must be a combat feat") is always `null` out of the box — Step 03/04's
  data doesn't derive this automatically. Honored if hand-edited into
  `Data/class_bonus_feats.json`, treated as unrestricted otherwise.
- `Data/feat_categories.json` tagging is best-effort keyword matching; ~80%
  of feats are flagged `needs_manual_check` rather than guessed.
- Repeatable/multi-take feats can't be assigned twice via the CLI.
- Skill *rank allocation* is manual — this pipeline computes a skill-point
  *budget*, it does not auto-allocate ranks to specific skills.
- Windows console codepage (cp1252) can display French accented characters
  fine in a native terminal, but passing accented feat names as CLI
  arguments through some shells (e.g. git-bash) can mangle the bytes before
  Python sees them — a shell/tooling quirk, not an app bug (see the verify
  skill's Gotchas section for how this was isolated).

## 8. Where things live

- Step-by-step build plan: `build/character_creation/00_CONTEXT.md` through `14_claude_md_update.md`.
- Per-step verification reports (evidence, deviations, pass/fail): `build/character_creation/reports/`.
- Verify-skill recipe (build/launch/drive commands + gotchas): `.claude/skills/verify/SKILL.md`.
- Updated architecture docs for future sessions: `CLAUDE.md` (Architecture → "Character creation" subsection).
