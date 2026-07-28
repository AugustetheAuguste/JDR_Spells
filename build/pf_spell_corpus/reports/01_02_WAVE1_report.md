# Wave 1 report — steps 01 (SKILLS) + 02 (TOOLS)

Both wave-1 steps were executed in parallel git worktrees and merged `--no-ff`
into `feat/spell-corpus` in step order. All 16 Verification Criteria (8 per
step) were run literally, twice: once by the executing subagent inside its
worktree, and once independently by the orchestrator on the merged branch.

## Wave 0 was missing and had to be bootstrapped

The plan assumed an operator had already run Wave 0. It had not: `git status`
returned *fatal: not a git repository*. Bootstrapped before dispatch:

- `git init -b main`, initial commit of `elements_to_do.json`, `pages/`, `build/`
- `core.autocrlf=false` + `.gitattributes` `* -text`. **This was load-bearing:**
  git's default CRLF conversion on win32 would have rewritten the UTF-8 HTML
  fixtures in `pages/`, breaking byte-level parser tests.
- branch `feat/spell-corpus` cut from `main`
- worktrees `../wt-01` (`step/01-skills`) and `../wt-02` (`step/02-tools`)

## Deliverables

### Step 01 — `.claude/skills/pf-corpus-conventions/SKILL.md`
211 lines, 10287 bytes, UTF-8, no BOM, LF-only. Ten `##` sections exactly as
specified. Documentation only — the branch diff touches one file.

### Step 02 — code, schemas, tests
| Path | Lines |
|---|---|
| `src/pf_spells/slugs.py` | 44 |
| `src/pf_spells/htmlutil.py` | 96 |
| `src/pf_spells/classes.py` | 120 |
| `src/pf_spells/fetcher.py` | 142 |
| `src/pf_spells/__init__.py` | **0 bytes** |
| `schemas/sort.schema.json`, `schemas/liste_classe.schema.json` | Draft 2020-12 |
| `tests/` (conftest + 5 modules) | 43 tests |

Plus `.gitignore`, `cache/html/.gitkeep`, `data/.gitkeep`, `reports/.gitkeep`.

## Verification Criteria — results on the merged branch

### Step 01
| # | Criterion | Result |
|---|---|---|
| 1 | frontmatter, UTF-8, `name: pf-corpus-conventions` + 1-line description | PASS — no BOM, no CRLF |
| 2 | all ten sections present | PASS — all 10 `##` headings found |
| 3 | numbered slug recipe + 5 worked examples | PASS — recipe re-implemented from the *written text* and run: all 5 match, incl. `Cœur incassable`→`coeur-incassable` and `Bouclier de la Fleur de l'Aube`→`bouclier-de-la-fleur-de-l-aube` |
| 4 | all 20 JSON keys | PASS — scripted check, 0 missing |
| 5 | 9 label groups + U+2019 + `\xa0` | PASS — 0 missing labels; both named explicitly |
| 6 | 19 class rows, slug + verified marker, dedup documented | PASS — exactly 19 data rows |
| 7 | Anti-patterns names the 8 traps | PASS — 10-row table, 0 traps missing |
| 8 | changes only under `.claude/` | PASS — branch diff = 1 file |

### Step 02
| # | Criterion | Real output |
|---|---|---|
| 1 | pytest green | `43 passed in 7.29s`, exit 0 |
| 2 | slugify | `coeur-incassable` |
| 3 | classes --report | `19 kept / 1 dropped`, dropped names `Alchimiste` |
| 4 | exemple_3 variant survives slicing+decoding | `True` |
| 5 | `check_schema` | both schemas `OK` |
| 6 | cache hit with `requests.get` raising | `from_cache=True`, no socket, no index write |
| 7 | no populated `__init__`, no `__all__` | `0 bytes src/pf_spells/__init__.py`; grep returns nothing |
| 8 | `.gitignore` does not ignore `cache/html/` | `check-ignore` exit 1; `.gitkeep` is tracked |

## Discrepancies found in the plan (implemented against reality)

1. **`<h1 class="pagetitle">` is OUTSIDE `PageContentDiv`** on exemple_1/2/4 and
   `druide.html`. Step 07 must read the spell title from the full document, not
   the sliced region. (On exemple_3 the only in-region `h1` is the *variant*
   title — a naive in-region title read would mislabel that spell.)
2. **`PageAttachmentsDiv` precedes `PageContentDiv`** in byte order in all six
   samples and is never nested inside it. The plan's "content lies between
   PageContentDiv and PageAttachmentsDiv" is stale as a byte-range claim.
   Slicing by DOM subtree is the correct reading and is what was implemented.
3. **`clean_text` cannot trust source newlines** — the saved HTML wraps
   mid-sentence. Newlines are derived only from markup (`<br>` + block tags)
   while raw whitespace collapses; this is what makes the flat
   `<b>Label</b> value<br>` stat block split one line per label.
4. **`inner_html(node) in html` is not a valid fidelity assertion** — bs4/lxml
   normalizes attribute quoting and href hex-escape case. The test asserts the
   load-bearing properties instead (verbatim `<b>Composantes</b>`, accents not
   entity-rewritten).
5. Confirmed as written: the 9 `<b>` labels on exemple_1 (exactly those, in
   order), the `Accès rapide` nav `h2` as first heading on Druide,
   `Sorts de niveau 0`–`9`, 785 `li a.pagelink` on Druide, `h3` school grouping
   only on the Arcaniste page, and the U+0027/U+2019 apostrophe split.

## Cross-step consistency fix applied by the orchestrator

The Skill (the stated authority) folds **U+02BC `ʼ`** in addition to U+2019, but
`normalize_label` handled U+2019/U+2018 only. Per the plan's rule *"if they
diverge, the Skill wins and the code is corrected"*, the code was fixed and a
test added covering all four apostrophe variants — commit `fddb2a6`.

## Git state

```
9749a07 Merge step/02-tools: shared modules, schemas and tests
ee6b8f8 Merge step/01-skills: pf-corpus-conventions skill
```
`step/01-skills`: 1 commit. `step/02-tools`: 6 commits (the 5 mandated messages
plus the U+02BC fix). Both merged `--no-ff`; working tree clean; nothing pushed.

## Notes for downstream steps

- Run everything as `PYTHONPATH=src python -m pf_spells.<mod>` from the repo root.
- `parser_version = "1.0.0"` lives in `htmlutil.py`; step 07 imports it there.
- `Réd` appears in sample `Niveau` lines but maps to no class in
  `elements_to_do.json`. Documented in the Skill as unmapped; step 04 must
  report such abbreviations rather than guess.
- Wave 2 (step 03) is unblocked.
