# Step 01 — Race scraper report

## What was built

`scrape_races.py` (repo root, standalone script, not imported by `pf1_dons`),
producing `Data/races.json`. Resolved `RACE_SLUGS` for all 53
`KNOWN_RACES` entries by fetching the live `Pathfinder-RPG.Races.ashx`
index page and matching hrefs; `homme-serpent`, `ogre`, `troll` have no
standard player-race traits page and get the documented "not found"
fallback shape.

## Verification Criteria — evidence

- `python scrape_races.py` ran to completion with no unhandled exceptions.
  Output: `Races traitées : 53` / `Non résolues : homme-serpent, ogre, troll`.
- `Data/races.json` is valid JSON with exactly 53 top-level keys (one per
  `KNOWN_RACES` entry), confirmed via
  `python -c "import json; d=json.load(open('Data/races.json',encoding='utf-8')); print(len(d))"` → `53`.
- `humain`: `has_bonus_feat: true`, `bonus_skill_rank: true`,
  `ability_modifiers: [{"ability":"choice","modifier":2}]`, `size: "M"`,
  `speed: 9` — matches ground truth confirmed against the live page.
- `nain`: `traits` has 12 non-empty entries;
  `ability_modifiers == [{"ability":"Con","modifier":2},{"ability":"Sag","modifier":2},{"ability":"Cha","modifier":-2}]`.
- Spot-checked `elfe` (9 traits, size M, speed 9), `gnome` (12 traits, size
  P, speed 6), `ifrit` (9 traits, size M, speed 9), `kitsune` (10 traits,
  size M, speed 9) — all non-empty, no leftover `<...>` HTML tags in any
  `name`/`description` field (asserted programmatically).
- `homme-serpent`/`ogre`/`troll` all load with `traits: []`, all structured
  fields `null`, and `note: "no scrapeable standard traits page found"` —
  no exception raised.

All Verification Criteria: **PASS**.

## Deviations from the plan

- Plan's `00_CONTEXT.md` estimated "46 keys"; the real `KNOWN_RACES` set in
  `pf1_dons/parser.py` has 53 entries. Verified directly by counting the
  literal set — not a code bug, a stale estimate in the plan.

## Git handling

Committed directly to `main` before the git-branching workflow was
established for this plan (repo had no git history at all at the time this
step ran); later steps use the `integration/character-creation` branch
convention. `scrape_races.py` and `Data/races.json` are part of the initial
merge history and are present on `main`.
