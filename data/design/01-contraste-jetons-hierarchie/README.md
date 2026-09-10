# 01 — Contrast, tokens, hierarchy

**Status: GATE 2 — C1 and H2 closed. C2 is the next commit.**

Scope picked: option B (consolidate), starting with option A's token commits.
Two findings closed: **C1** (body text at 1.04:1 on all four routes) and **H2** (35 tags as
one flat list). 26 findings remain open and are listed, with reasons, in
`99_FOLLOWUPS.md` — the blocker among them is **C2**: no border in the system meets the
3:1 floor.

## What was reported

> « White text on white background » on the spell list, a spell sheet and the class
> comparison, in normal light conditions, default settings.
>
> « The Tags should be better organised — there are too many of them for them not to be
> in families like: target, effect, etc. »

## What it actually is

`class="text-base"` emits **two** declarations, not one:

```css
.text-base { font-size: var(--text-base); line-height: var(--text-base--line-height); color: var(--color-base); }
```

Tailwind 4 resolves the `text-*` utility against both the `--text-*` (font size) and
`--color-*` (colour) namespaces. `web/styles/theme.css` defines **both**
`--text-base: 14.5px` **and** `--color-base: #fafaf9`, so every `text-base` in the
codebase also paints its text `#FAFAF9`. Against `--color-surface` (`#FFFFFF`) that is
**1.04:1**.

Measured in a browser against the repo's own `@theme` block — see
[`reproduction/`](reproduction/).

**1 instance reported, 22 found.** Every `text-base` that sets no colour of its own,
on all four routes. It is not a spell-list bug; it is the entire stat block, the entire
spell description, the per-class level table, the comparison level columns, and the
class list in the comparison selector.

## Index

| File | What is in it |
|---|---|
| [`00_CONTEXT.md`](00_CONTEXT.md) | The report verbatim, the answers that scoped it, routes and themes covered |
| [`01_AUDIT.md`](01_AUDIT.md) | 28 findings with root cause, class size and the layer each fix belongs in |
| [`02_OPTIONS.md`](02_OPTIONS.md) | Three scopes — surgical / consolidate / direction — and one recommendation |
| `reproduction/` | The two instruments: a Tailwind probe and a faithful recreation of the four routes |

| [`02_DECISIONS.md`](02_DECISIONS.md) | ADR-001…005 — scope, why the *size* token was renamed and not the colour, why the guard moved from values to names, why tag families are a heading layer, what was left alone |
| [`03_DESIGN_SYSTEM.md`](03_DESIGN_SYSTEM.md) | **Normative.** The seven rules, the palette with measured ratios, the type scale, density, vocabulary |
| [`05_CHANGES.md`](05_CHANGES.md) | What shipped: C1 and H2, before → after, the exact repository diff, sweep proof |
| [`99_FOLLOWUPS.md`](99_FOLLOWUPS.md) | The 26 open findings, and the two decisions that are yours |

Still to write, once more has shipped: `04_COMPONENTS.md`, `06_ACCESSIBILITY.md`.

## Where the fix is

`--text-base` → **`--text-corps`**, in `styles/theme.css` and `tokens.ts`, plus a test that
fails on any `--color-x`/`--text-x` name pair. No colour value changed and no component
gained a colour — the defect was a name, and it is fixed at the name.

The design is in `recreation-sorts-pf1.dc.html` at the project root. The repository diff is
specified verbatim in `05_CHANGES.md` and is **not yet applied**: this project has read
access to the repo, not write access.
