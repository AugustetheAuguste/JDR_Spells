# Step 10 — Character Persistence — Report

## What was built

New file `pf1_dons/persistence.py` implementing JSON save/load for
`CharacterProfile` objects (from `pf1_dons.character_profile`) under
`Data/characters/`:

- `DEFAULT_CHARACTERS_DIR = Path("Data/characters")`
- `_character_path(name, base_dir)` — slugifies the display name
  (`re.sub(r"[^\w\-]+", "_", name.strip())`) into `<base_dir>/<slug>.json`.
- `save_profile(profile, base_dir)` — creates `base_dir` if needed, writes a
  plain JSON dict with keys `name`, `character_class`, `level`, `race`,
  `ability_scores`, `skill_ranks`, `feat_slots` (the latter via
  `dataclasses.asdict(slot)` per `FeatSlot`), UTF-8, `ensure_ascii=False`.
  Returns the written `Path`.
- `load_profile(name, base_dir)` — computes the same path, raises
  `FileNotFoundError(f"personnage introuvable : {name} ({path})")` if it
  doesn't exist, otherwise reconstructs a `CharacterProfile` with
  `feat_slots=[FeatSlot(**s) for s in data.get("feat_slots", [])]`.
- `list_characters(base_dir)` — returns `[]` if `base_dir` doesn't exist,
  else sorted `.stem` of every `*.json` file in it.

Implementation matches the step file's pseudo-code exactly, verified field
names against the real `CharacterProfile` (`name`, `character_class`,
`level`, `race`, `ability_scores: dict[str,int]`, `skill_ranks: dict[str,int]`,
`feat_slots: list[FeatSlot]`) and `FeatSlot` (`slot_id`, `source`,
`level_gained`, `category_restriction`, `filled_by`) in
`pf1_dons/character_profile.py` and `pf1_dons/models.py`. No changes needed
to either — both were already exactly as the step file's "Inherited Context"
described.

Also appended `Data/characters/` to the existing `.gitignore` (appended, not
replaced — existing entries `__pycache__/`, `*.pyc`, `races_html/`,
`classes_html/`, `class_skills_html/` preserved).

## Verification Criteria — evidence and pass/fail

All verification was run as real Python against a temp directory
(`tempfile.mkdtemp()`, outside the repo tree, deleted afterward), not
fabricated.

1. **`save_profile(profile)` creates `Data/characters/<slug>.json` containing
   valid JSON with all expected top-level keys.**
   Ran `save_profile(p1, tmp)` where `p1.name = "Grondemarteau"`. Output:
   `saved to ...\characters\Grondemarteau.json True` (path exists), and
   `json.loads` on the file succeeded with
   `keys: ['ability_scores', 'character_class', 'feat_slots', 'level', 'name', 'race', 'skill_ranks']`.
   **PASS.**

2. **`load_profile(profile.name)` returns a `CharacterProfile` equal to the
   original after save→load, including a profile with at least one filled
   slot and one open slot.**
   `p1` was constructed with `feat_slots=[FeatSlot(slot_id='general-1', ..., filled_by='Attaque en puissance'), FeatSlot(slot_id='class-1', ..., filled_by=None)]`
   — one filled, one open. After `save_profile(p1, tmp)` then
   `load_profile('Grondemarteau', tmp)`, output: `round-trip equal: True`,
   and `assert p1 == p2` did not raise. **PASS.**

3. **`load_profile("does-not-exist")` raises `FileNotFoundError` mentioning
   the attempted path.**
   Output:
   `FileNotFoundError: personnage introuvable : does-not-exist (...\characters\does_not_exist.json)`
   — message contains the requested name and the full attempted path.
   **PASS.**

4. **`list_characters()` returns an empty list when the directory doesn't
   exist yet, and returns the correct slugified names after saving two
   different profiles.**
   Before any save: `list_characters (no dir): []`. After saving
   `Grondemarteau` and `Zil`: `list_characters: ['Grondemarteau', 'Zil']`
   (sorted, correct stems). **PASS.**

## Regression check

`python -m pytest -q` → `15 passed in 3.51s`. No existing test broken.

## Deviations from the step file

None. Implementation is a direct, verified transcription of the step file's
pseudo-code; field names, exception message format, and slugify regex all
match as specified. No assumptions were required beyond what Step 09
already provided.

## Cleanup / git hygiene

- All manual verification used a `tempfile.mkdtemp()` directory outside the
  repository, removed via `shutil.rmtree` at the end of the test script —
  no `Data/characters/` directory or files were ever created inside the
  repo working tree.
- `git status` before commit shows only `pf1_dons/persistence.py` as
  untracked (plus the `.gitignore` edit) — no stray files under
  `Data/characters/`.
- `.gitignore` updated (appended `Data/characters/`) per the step's
  instruction to prevent future incidental commits of character files.

## Final status: PASS (all 4 verification criteria met with real evidence; no regressions)
