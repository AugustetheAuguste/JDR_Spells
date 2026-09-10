# 02 — Decisions

ADR-style. One record per decision, with what was rejected and why.

---

## ADR-001 — Scope: B (consolidate), started with A's two token commits

**Date:** 2026-08-26
**Status:** accepted, partially delivered

**Decision.** Option B from `02_OPTIONS.md`, with option A's token fixes as the first
commits. Delivered so far: **C1** and **H2**.

**Why not A alone.** A closes « white text on white » and leaves « organize it better »
open. Both sentences were in the same report.

**Why not C.** C's first phase *is* B's token layer, so C cannot be started earlier. Its
distinguishing argument — the level thumb-index rail — answers H1/L1/R3, which B answers
too, without spending a typeface decision mid-audit.

---

## ADR-002 — C1 is fixed by renaming the *size* token, not the *colour* token

**Date:** 2026-08-26
**Status:** accepted

**Context.** `--color-base` and `--text-base` both existed, so Tailwind 4 compiled
`text-base` to `font-size` **and** `color: #FAFAF9`. Either name could have moved.

**Decision.** Rename the size: `--text-base` → `--text-corps`, `ECHELLE.base` →
`ECHELLE.corps`. `--color-base` keeps its name.

**Alternatives rejected.**

- *Rename the colour to `--color-fond`.* Fewer call sites (`bg-base` appears twice against
  `text-base`'s 38), but it renames the token that is *correctly* named — `base` is the page
  base — to fix a collision caused by the other one. It also leaves `--text-base` as a name
  a future contributor may reasonably pair with a `--color-base`.
- *Add an explicit `text-encre` at each of the 22 uncoloured sites.* This is the auto-fail
  case. It fixes 22 occurrences of a bug whose cause is two lines in the token file, and
  leaves the 23rd occurrence — the one written next week — broken.
- *Drop `--text-base` and use `text-[14.5px]`.* Removes the collision by removing the
  token, i.e. by putting a literal in every component. Rejected on the same rule.

**Consequence.** `text-corps` is now the only name for body size, and no `--color-corps`
exists. Enforced by ADR-003 rather than by memory.

---

## ADR-003 — The guard moves from values to names

**Date:** 2026-08-26
**Status:** accepted

**Context.** `lib/design/tokens.test.ts` already parsed `theme.css` and asserted every
value matched `tokens.ts`. Both values in the collision were correct, so the test passed
while the product rendered 1.04:1 text. The guard was checking the half that was never at
risk.

**Decision.** Add a test that intersects the `--color-*` and `--text-*` name sets declared
in `@theme` and fails if the intersection is non-empty.

**Alternative rejected.** *A lint rule banning `text-base`.* Bans the symptom's current
spelling; says nothing about the next colliding pair.

**Consequence.** The bug class is unshippable, not merely absent. This is the reason C1 is
recorded as closed rather than patched.

---

## ADR-004 — Tag families are a heading layer, not a data change

**Date:** 2026-08-26
**Status:** accepted

**Context.** 35 closed tag ids rendered as one flat alphabetical wrap. Reported as: « there
are too many of them for them not to be in families like: target, effect, etc. »

**Decision.** Nine named families group the existing 35 ids in the filter panel. The ids
themselves are untouched: not renamed, not translated, not abbreviated, not hidden. Every
tag stays visible and clickable at all times; a family is a heading placed above a subset.

**Alternatives rejected.**

- *Collapse the families by default.* Would have cut the panel from ~35 chips to 9 lines.
  Rejected: the brief protects density, and hiding a tag the player came to filter on is
  the « decluttering » anti-pattern. Fewer items per screen is a cost, and here it buys
  only panel height.
- *Change the closed vocabulary to add a `famille` key per tag.* Correct in the long run
  and out of scope: it means regenerating the enrichment layer, which is a paid pipeline
  run, to solve a layout problem. The UI can group ids it already has.
- *Derive the families mechanically from `conventions/taxo_groupes.json`.* Tempting,
  because that file's ids already encode families (`degats_*`, `duree_*`). Rejected as the
  *sole* source: that file is the **generator** of the closed list, not a taxonomy of it —
  it holds 54 candidate regex groups of which only those clearing `seuil_couverture: 10`
  became tags. Reading it as an enumeration is exactly what its own `note` field forbids.
  It informed the family names; it is not queried at runtime.

**Consequence.** The map is authored, and therefore can go stale. Mitigated by a
`Non classés` family: any id in `index.tags` the map does not know is rendered there rather
than dropped. A regenerated taxonomy can add a tag and the filter panel cannot silently
lose it.

---

## ADR-005 — What was deliberately left alone this round

**Date:** 2026-08-26
**Status:** accepted

Findings **C2** (no border meets 3:1) and **C3** (`encre-faible` below AA on three tinted
surfaces) are blockers/majors and are **not** fixed here. The request was the white text
and the tags; changing the border palette in the same pass would have moved every rule,
input and panel edge in the product under cover of a contrast fix — « while I was in
there » restyling.

They are open, with measured ratios, in `99_FOLLOWUPS.md`. C2 is the next commit.
