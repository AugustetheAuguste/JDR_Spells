# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`pf1_dons` (Pathfinder 1e "Dons" = French for Feats) parses a French-language CSV catalog of Pathfinder 1e feats and their prerequisites ("Conditions"), then evaluates whether a given character is eligible for each feat. All identifiers, comments, and string content in this codebase are in French — keep new code consistent with that.

## Commands

Install deps:
```
pip install -r requirements.txt
```

Run all tests:
```
python -m pytest
```

Run a single test file / test:
```
python -m pytest tests/test_engine.py
python -m pytest tests/test_engine.py::test_ailes_de_tengu
```

All scrapers and scripts are run from the repository root (they import
`pf1_dons`, and every data path they use comes from `pf1_dons/paths.py`).

Regenerate `Data/classes/class_features.json` (scrapes pathfinder-fr.org class progression tables):
```
python scrappers/extract_class_features.py
```

Regenerate the other character-creation data files (each idempotent, safe to re-run; `extract_class_bonus_feats.py` requires `Data/classes/class_features.json` to already exist):
```
python scrappers/scrape_races.py
python scrappers/scrape_class_skills.py
python scrappers/extract_class_bonus_feats.py
python scrappers/tag_feat_categories.py
```

Regenerate the feat detail pages and the derived per-feat tags:
```
python scrappers/scrape_feat_links.py
python scrappers/scrape_feat_details.py
python scrappers/tag_feat_magic.py
python scrappers/tag_feat_creature_affinity.py
```

Character creation CLI (`pf1_dons/cli.py`):
```
python -m pf1_dons.cli create <name> --class <classe> --level <n> [--race <race>] [--for N --dex N --con N --int N --sag N --cha N] [--alignement <alignement>] [--divinite <divinite>]
python -m pf1_dons.cli show <name>
python -m pf1_dons.cli list
python -m pf1_dons.cli slots <name> [--open-only] [--limit N]
python -m pf1_dons.cli assign <name> <slot_id> "<nom du don>"
python -m pf1_dons.cli unassign <name> <slot_id>
```

Complete, untruncated per-feat eligibility audit for a character (every feat of the
catalog, every requirement's individual verdict, raw CSV `Conditions` and the
detail-page `conditions_detail`):
```
python scripts/audit_character_feats.py <nom_du_personnage> [-o rapport.txt]
python scripts/audit_character_feats.py --classe Guerrier --niveau 3 --race Humain
```

Regenerate the hand-curated gating tables from their reviewed classification tables:
```
python scripts/curate_prereq_gating.py
python scripts/curate_feat_class_restriction.py             # Data/dons/feat_class_restriction.json
python scripts/curate_feat_class_restriction.py --candidats  # liste les candidats à réviser
```

Multi-class test bench (11 base classes at level 6, all human, to isolate the
class variable) and the cross-class eligibility matrix:
```
python scripts/creer_fiches_classes_de_base.py
python scripts/comparer_classes.py "Base Guerrier" "Base Druide" [...] -o rapport.txt
```

## Repository layout

```
pf1_dons/    the package: parsing + eligibility engine + character creation
scrappers/   standalone scrapers/taggers that produce Data/ (not imported by the package)
scripts/     standalone curation, audit and test-bench scripts (not imported by the package)
web/         l'explorateur de dons à facettes (JSON + JS + CSS, embarquable) et son test jsdom
tests/       pytest suite + the tests/golden/ regression fixture
build/        per-project working notes; OUTPUT_*.md hold the durable reasoning
Data/
  dons/        the feat itself: Dons.csv catalog, scraped pages, derived per-feat tags
  classes/     class progressions, skills, bonus feats, and the class-keyed gating tables
  races/       races.json
  conditions/  prereq_gating.json — prerequisites that belong to neither class nor race
  characters/  saved CharacterProfile JSON (gitignored)
```

**`pf1_dons/paths.py` is the single place where a data file's location is
written down.** Every module, scraper, script and test imports its paths from
there instead of hard-coding a relative string. Paths are anchored on the
repository root, deduced from `paths.py`'s own location, so importing the
package no longer depends on the current working directory. Moving or renaming
a data file means editing one line in `paths.py`.

## Architecture

The pipeline is: **CSV → parse conditions into structured requirements → evaluate against a Character → grouped eligibility results.**

1. **`data_loader.py`** — loads `Data/dons/Dons.csv` (columns: `Dons` name, `Src` source, `Conditions`, `Avantages`) into `FeatRow` objects. Rows where `Conditions` or `Avantages` is `#ERROR!` are filtered out via `filter_valid_rows`, but the *full* set of feat names (including filtered rows) is still passed to the parser as `all_feat_names`, so that feat-name prerequisites referencing an excluded feat still resolve correctly.

   **`repair_benefits` runs before `filter_valid_rows` and, in practice, leaves it nothing to drop.** 127 of the CSV's 1417 rows carried `#ERROR!` in `Avantages` while their `Conditions` were intact — the column the eligibility engine never reads. Filtering them amputated 10 % of the catalog and, worse, punched holes in the prerequisite graph at its most structural nodes: `Endurance` (a prerequisite of 15 feats, and itself requiring nothing), `Science de la lutte` (18), `Souplesse du serpent` (17), `Science du croc-en-jambe` (16)… 44 feat-name prerequisites resolved to nothing, so whole feat chains were invisible. `repair_benefits` backfills those `Avantages` from `Data/dons/feat_details.json`'s `avantages_detail` (keyed on the `clean_feat_name` form, since that file drops the repeatable-feat asterisk the CSV keeps) — it covers all 127. The catalog is therefore 1417 feats with **zero** dangling feat prerequisites; chains of depth 2 went from 123 to 177 and of depth 3 from 25 to 48. `tests/test_data_loader.py` guards both the coverage and the no-dangling-prerequisite invariant. Rows are still dropped if a repair is unavailable, so the filter remains the backstop.

2. **`parser.py`** — turns the free-text `Conditions` string into a `ParsedConditions` (from `models.py`): a list of `Requirement` or `OrGroup` objects.
   - Top-level requirements are comma- *or semicolon*-separated (`_split_top_level` splits on `[,;]`, careful not to split inside parentheses).
   - Within a segment, `" ou "` (French "or") splits into an `OrGroup` of alternative `Requirement`s — but only *after* `_parse_segment` has handled the cases where `ou` is not an alternative: size comparisons (`SIZE_MAX_RE`/`SIZE_MIN_RE`, e.g. "taille P ou plus petit") and the comparative suffix `COMPARATIVE_SUFFIX_RE` ("Trois attaques naturelles ou plus"), which would otherwise produce a meaningless "plus" option.
   - `LEVEL_EXACT_RE` ("niveau N uniquement") and `CLASS_LEVEL_RE` ("Magicien de niveau 1", only when the leading words are a `KNOWN_CLASSES` entry) are tried *before* the generic `LEVEL_RE`; without them a class-scoped or level-locked feat was read as a plain character-level floor and offered to everyone.
   - `_classify_segment` tries a sequence of regexes/lookups in order (level, BBA, NLS/caster level, size, skill ranks, ability score, known feat name, known race, known class, class-feature-text keywords) and falls back to `RequirementType.UNPARSED` if nothing matches — unparsed/class-feature-text requirements are flagged `needs_manual_check=True` and must never be silently dropped.
   - Feat-name and class-name matching goes through `_normalize` (NFKD strip of accents + lowercase) so French diacritics don't cause misses.
   - When a segment falls into `CLASS_FEATURE_TEXT` or `UNPARSED`, `_find_implied_classes` additionally checks whether the text names or implies one or more specific classes — via a literal known-class-name word-boundary match, and via substring lookup against `Data/classes/class_ability_map.json` — and if so attaches `payload["implied_classes"] = [...]` (a sorted list of normalized class names). The requirement's `.type` and `needs_manual_check` are unchanged; this only enriches the payload so `engine.py` can hard-fail a class mismatch instead of always deferring to manual review.
   - `_enrich_payload` is the single place where an unclassifiable segment's payload is built. Besides `implied_classes` it attaches `payload["gating"]` (see `Data/conditions/prereq_gating.json` below) via `_find_gating`, and `payload["fragment"] = True` when the whole segment is one of the curated fragment keywords. It also handles **negative** prerequisites: a segment starting with `"aucun niveau dans"` emits a single `{"kind": "no_class_levels", "param": [classes exclues]}` hit instead of `implied_classes` — otherwise the rule was inverted (`class_ability_map.json` maps "aucun niveau dans une classe dotée de panache" to `['bretteur']`, which made the engine *require* being a bretteur).

3. **`class_progression.py`** — static table `CLASS_BBA_PROGRESSION` mapping normalized French class names to BBA progression (`good`/`medium`/`poor`), used to compute a character's base attack bonus (BBA) at a given level (`get_bba`). This is also the source of truth for `KNOWN_CLASSES` in `parser.py`.

4. **`engine.py`** — defines `Character` and evaluates a `FeatRow`'s parsed requirements against it:
   - `evaluate_requirement` returns a tri-state result: `True` (met), `False` (not met), or `None` (cannot be determined — missing data, e.g. no ability scores provided, or an inherently non-automatable requirement like caster level or class-feature text).
   - `OrGroup`s are satisfied if any option is `True`; if none is `True` but at least one is `None`, the group is `None` (needs manual check); otherwise `False`. Options whose payload is `fragment` (splitting artefacts like "familier", "monture", "plus") are dropped first, unless *every* option is a fragment.
   - `Character` carries optional `alignment` and `deity` (both free French text) alongside race/class/level/abilities, plus two derived properties: `effective_size` (explicit size, else the race's size from `Data/races/races.json`) and `racial_trait_text` (normalized `"nom | description"` of all of the race's traits, `None` if the race is unknown). The latter is what racial-trait / creature-type / anatomy gating is matched against.
   - `evaluate_feat` short-circuits to `"ineligible"` on the first `False` requirement; otherwise accumulates `None` reasons and returns `"manual_check"` if any exist, else `"eligible"`.
   - For `CLASS_FEATURE_TEXT`/`UNPARSED` requirements, if `payload` carries `implied_classes` (see `parser.py` above) and the character's class isn't among them, the requirement resolves to `False` (`ineligible`) instead of the default `None` — e.g. a `Guerrier` is now correctly `ineligible` for "Abondance de révélations" (Oracle-only) rather than `manual_check`. If the character's class IS among `implied_classes`, the requirement still resolves to `None` (`manual_check`) since the specific ability/spell-level detail inside the text remains unverified.
   - For every *blocking* `payload["gating"]` hit, `_gating_verdict(hit, character)` returns the same tri-state plus a French reason, dispatching on `kind`: `spellcasting` (reuses `Data/classes/class_caster_info.json` + racial magic keywords), `class_ability` and `no_class_levels` (the hit's `param` lists the classes that grant / are excluded by it), `mythic`, `racial_trait`/`creature_type`/`anatomy` (searched in `racial_trait_text`; `_ANATOMY_SYNONYMS` deliberately uses **long, unambiguous** phrases like `"attaque de morsure"` — a short synonym such as `"langue"` matched the universal "Langues" trait and produced false positives), `alignment` and `deity` (compared to `Character.alignment`/`deity`, `None` with an explicit "non renseigné" reason when absent). A `False` short-circuits the whole requirement; otherwise pending reasons win over satisfied ones, and a hit that covers the *entire* segment and is satisfied makes the requirement `True` rather than falling through to `manual_check`.
   - `filter_feats` runs this over a whole catalog and groups+sorts results by status (`eligible` / `manual_check` / `ineligible`).

When adding a new `RequirementType`, you generally need to touch all three of `models.py` (enum + payload shape), `parser.py` (`_classify_segment` recognition), and `engine.py` (`evaluate_requirement` handling) together.

`extract_class_features.py` is a standalone offline scraper (not imported by the package) that produces `Data/classes/class_features.json`; it caches downloaded HTML in `classes_html/` and skips re-downloading unless run with `force=True`.

### Character creation

A second pipeline, layered on top of the eligibility engine above, handles building and persisting actual characters and assigning feats into their feat slots.

5. **`race_loader.py`** — loads `Data/races/races.json` (scraped by `scrape_races.py` from pathfinder-fr.org race pages) into `RaceInfo` dataclasses (`models.py`): ability modifiers, size, speed, `has_bonus_feat`, `bonus_skill_rank`, and the raw traits list. `get_race()` does accent/case-insensitive lookup by race name. Races with no scrapeable standard-traits page (a few bestiary races) load with all structured fields `False`/`None` and a `note` explaining why, rather than raising.

6. **`class_skills.py`** — loads `Data/classes/class_skills.json` (scraped by `scrape_class_skills.py`) into `ClassSkillInfo` dataclasses: each class's skill list (skill + governing ability) and skill-point-per-level formula (`SkillPointsFormula(base, ability)`, or `None` if the scraped formula text didn't match the expected pattern). `is_class_skill()` checks whether a given skill name is on a class's list.

7. **`feat_slots.py`** — `compute_feat_slots(character_class, level, race_name, races, class_bonus_feats)` returns the full list of `FeatSlot`s (general/racial/class) a character has at their level: one general slot at level 1 and every odd level after, one racial slot if `RaceInfo.has_bonus_feat`, and one class slot per level in `Data/classes/class_bonus_feats.json` (produced by `extract_class_bonus_feats.py` from `Data/classes/class_features.json`) up to the character's level. `category_restriction` on a class slot is currently always `None` (not derived automatically) but is honored if hand-edited.

8. **`skill_budget.py`** — computes a real skill-point budget (`total_skill_points`) from a class's `SkillPointsFormula` and ability scores, plus the standard PF1 class-skill +3 bonus (`class_skill_bonus`). This is separate from, and does not modify, `engine.py::Character.skill_rank`'s existing "optimistic" placeholder (which returns `level` when `skill_ranks` is unset) — the CLI-driven creation flow uses `skill_budget.py`'s real numbers, while `engine.py`'s eligibility checks keep using the placeholder unless a `Character`'s `skill_ranks` is explicitly populated.

9. **`character_profile.py`** — `CharacterProfile` is the creation-time model: name, class, level, race, ability scores, skill ranks, and a `list[FeatSlot]`. `to_character()` bridges it to `engine.Character` (feeding assigned feat names in as `known_feats`) so the existing `evaluate_feat` machinery can be reused unchanged. `eligible_feats_for_slot()` filters the catalog by a slot's category restriction (via `Data/dons/feat_categories.json`, see below) then by engine eligibility, keeping both `eligible` and `manual_check` feats. `assign_feat()`/`unassign_feat()` mutate slot bookkeeping (slot must exist and be open; a feat can't be assigned to two slots at once — repeatable/multi-take feats, i.e. names ending in `*` in `Data/dons/Dons.csv`, cannot currently be assigned more than once via the CLI).

10. **`persistence.py`** — saves/loads a `CharacterProfile` as JSON under `Data/characters/<slug>.json` (`save_profile`, `load_profile`, `list_characters`). `base_dir` defaults to the module-level `DEFAULT_CHARACTERS_DIR`, read at call time (not bound as an eager default argument), so tests can monkeypatch `pf1_dons.persistence.DEFAULT_CHARACTERS_DIR` and have it take effect even for callers (like `cli.py`) that don't pass `base_dir` explicitly.

11. **`cli.py`** (`python -m pf1_dons.cli ...`) — `create`/`show`/`list` build, persist, and inspect characters; `slots`/`assign`/`unassign` view open feat slots (with live-recomputed eligible candidates per slot) and mutate/persist feat assignments. `assign` always re-derives eligibility at assignment time rather than trusting a previous `slots` listing, since assigning one feat can change what's eligible elsewhere via prerequisite chains. `create` always writes all six ability scores (`DEFAULT_ABILITY_SCORE = 10` for the ones not passed) — leaving them absent produced a stream of "score de Dex non fourni" manual checks — and accepts `--alignement`/`--divinite`, which unlock the `alignment`/`deity` gating kinds. `slots` shows **every** candidate by default (`--limit 0`) and prints a `(N dons candidats)` count; `--limit N` truncates with "… et N autres".

`CharacterProfile` (and its persisted JSON) carries `alignment`/`deity` through to `to_character()`. A profile saved before those fields existed simply loads them as `None`; re-run `create` to refresh it.

`Data/dons/feat_categories.json` (produced by `tag_feat_categories.py`) tags each feat with a best-effort keyword-derived category list (e.g. `combat`) and a `needs_manual_check` flag for anything the tagger wasn't confident about — mirrors the parser's existing philosophy of surfacing ambiguity instead of guessing. `scrape_races.py`, `scrape_class_skills.py`, `extract_class_bonus_feats.py`, and `tag_feat_categories.py` are standalone scripts (not imported by the package), matching `extract_class_features.py`'s pattern; the two scrapers cache downloaded HTML (`races_html/`, `classes_html/`) and skip re-downloading unless run with `force=True`.

`Data/classes/class_ability_map.json` maps class-ability keywords (French, normalized) to the class(es) that grant them, `{"entries": [{"keyword", "classes", "disposition": "mapped"|"no_single_class", "reason", "source_raw_examples", "confidence"}]}`. It powers `parser.py`'s `implied_classes` enrichment above. Unlike the other `Data/**/*.json` files, it is hand-curated, not auto-regenerated by a single command: `scripts/build_class_ability_map_seed.py` only produces a draft (`Data/classes/class_ability_map.draft.json`, gitignored) by cross-referencing `Data/classes/class_features.json` against every unclassifiable requirement segment in the catalog; turning that draft into the final, reviewed file is a manual/AI curation pass, not a script run.

`Data/dons/feat_links.json` (`scrappers/scrape_feat_links.py`) et `Data/dons/feat_details.json` (`scrappers/scrape_feat_details.py`) scrapent, pour chaque don, sa page dédiée sur pathfinder-fr.org (description complète, rubriques Spécial/Normal) — information absente du résumé `Data/dons/Dons.csv`. Le balisage HTML exact de ces rubriques et le vocabulaire magique utilisés ci-dessous sont calibrés une fois pour toutes dans `build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md`. `Data/dons/feat_magic_info.json` (`scrappers/tag_feat_magic.py`) tague par mots-clés si un don est de nature magique (`is_magic`/`needs_manual_check`, même convention que `feat_categories.json`). `Data/classes/class_caster_info.json` (hand-curated, patron identique à `class_ability_map.json` : draft best-effort via `scripts/build_class_caster_info_seed.py`, vérité terrain vérifiée pour les 43 classes, hybrides/occultes incluses (dont la correction du scalde, qui y était à tort marqué non-lanceur alors que sa progression scrapée accorde « tours de magie » au niveau 1), dans `build/feat-detail-and-magic-gating/OUTPUT_class_caster_ground_truth.md`, transcrite via `scripts/curate_class_caster_info.py`) indique par classe si elle a accès à la magie. `engine.py::evaluate_feat` refuse (`ineligible`) un don magique de confiance haute quand ni la classe ni la race du personnage n'y donnent accès (vérifié par mots-clés sur les traits raciaux déjà scrapés dans `Data/races/races.json`), symétrique au fix `implied_classes`.

`Data/conditions/prereq_gating.json` est la couche **orthogonale** à `class_ability_map.json` : là où celui-ci ne répond qu'à « ce prérequis est-il réservé à certaines classes ? », celle-ci dit de *quelle nature* est chacune de ses 341 entrées `no_single_class`, sous la forme `{"entries": [{"keyword", "kind", "param", "blocking", "source_raw_examples"}]}`. Les `kind` sont `racial_trait`, `creature_type`, `anatomy`, `spellcasting`, `deity`, `alignment`, `mythic`, `class_ability`, `no_class_levels` (tous *blocking*, cf. `BLOCKING_KINDS`), plus `class_ability_unmapped`, `proficiency`, `feat`, `background`, `fragment`, `generic` (non bloquants : ils restent en `manual_check`). Sans elle, ces 341 prérequis — traits raciaux, types de créature, anatomie, divinité, alignement… — retombaient tous en `manual_check` et noyaient la liste de candidats. Comme `class_ability_map.json` et `class_caster_info.json`, ce fichier est curé à la main : `scripts/curate_prereq_gating.py` ne fait que **transcrire** en JSON les tables de classification relues (`RACIAL_TRAIT_EXTRA`, `CREATURE_TYPE`, `ANATOMY`, `CLASS_ABILITY_OVERRIDES`, `NO_CLASS_LEVELS`…) ; il ne les redérive pas. Le raisonnement, catégorie par catégorie, avec les erreurs concrètes qu'il corrige, est dans `build/feat-detail-and-magic-gating/OUTPUT_guerrier_audit_rules.md`.

`Data/dons/feat_class_restriction.json` (`scripts/curate_feat_class_restriction.py`) est une quatrième couche de gating, pour les dons dont la restriction de classe n'est visible **que dans leur texte d'avantage**, jamais dans leurs Conditions — cas d'école : « Ombre druidique », dont les Conditions (alignement + divinité) sont satisfiables par un roublard alors que son avantage ne fait qu'ajouter des sorts « à sa liste de druide ». `engine.py::evaluate_feat` refuse le don si la classe du personnage n'est pas dans `restriction["classes"]`, en citant l'`evidence`. Le signal s'est révélé **très peu spécifique** (1 vrai positif pour 49 candidats) et n'est donc **jamais** appliqué automatiquement : la table est entièrement curée à la main, `--candidats` ne sert qu'à produire la liste à réviser. Les deux contre-motifs (le don qui *accorde* la capacité — « comme un pouvoir magique », cf. `GRANTING_PATTERNS` ; et la classe citée comme simple *référence de calcul* quand les Conditions sont purement numériques) sont documentés dans `build/feat-detail-and-magic-gating/OUTPUT_benefit_text_class_signal.md`.

Un prérequis `CASTER_LEVEL` (« NLS *n* ») exige d'être lanceur de sorts : `engine.py::evaluate_requirement` renvoie `False` — et non plus `None` — quand `magie_inaccessible(character)`. Ce helper est volontairement conservateur : il n'est vrai que si la classe est **connue et explicitement non-lanceuse** (`class_grants_magic() is False`, donc jamais pour une classe absente de `class_caster_info.json`) **et** que la race n'accorde pas la magie. La valeur numérique du NLS reste, elle, non dérivable.

`Data/classes/class_proficiencies.json` (`scripts/curate_class_proficiencies.py`, transcrivant `build/armes-et-armures-de-classe/OUTPUT_class_proficiencies_ground_truth.md`) est une cinquième couche de gating, pour les 31 entrées de genre `proficiency` de `prereq_gating.json` (« maniement de X ») — jusqu'ici toutes non-bloquantes, y compris pour un Guerrier qui a d'office toutes les armes courantes et de guerre. Sur ces 31, **18** nomment une arme ou un bouclier précis (« maniement du cimeterre », « maniement de l'arc long »…) et sont devenues bloquantes ; les **13** autres dépendent d'un choix du joueur que `Character` ne trace pas (« l'arme choisie », « le bouclier utilisé », « l'arme du dieu »…) et restent volontairement non-bloquantes — les résoudre en supposant que le joueur choisira toujours dans son champ de compétence aurait été une inférence, pas une lecture directe, et ce chantier a délibérément tracé cette limite plutôt que de la dépasser.

`_proficiency_verdict` (`engine.py`) résout chaque entrée bloquante contre `class_proficiencies.json` (`armes_simples`/`armes_martiales`/`armes_specifiques`/`boucliers`, 42 classes ; absente = classe inconnue, jamais devinée, `None`) **et** contre la race, via deux tables recopiées des traits « Armes familières » déjà scrapés dans `races.json` : `RACE_WEAPON_PROFICIENCY` (l'elfe a l'arc long, le nain le marteau de guerre, l'halfelin la fronde, indépendamment de la classe) et `RACE_WEAPON_RECLASSIFICATION` (le nain traite toute arme « naine » — ex. la dorn-dergar naine — comme une arme de guerre au lieu d'exotique, à condition que la classe ait les armes martiales). Sans le second mécanisme, un Guerrier nain aurait été refusé à tort sur « Frappe de la vipère jaillissante » : exactement le risque de sous-attribution que ce principe de sûreté cherche à éviter partout ailleurs dans le dépôt.

`chasseur de vampire` est absente de `class_proficiencies.json` : aucune classe officielle Pathfinder 1e de ce nom n'existe (vérifié indépendamment), donc le moteur la traite comme une classe inconnue (`manual_check`), jamais comme « aucune maîtrise » (`ineligible`).

### Banc d'essai multi-classes

`scripts/creer_fiches_classes_de_base.py` crée les 11 fiches des classes de base au niveau 6, toutes de race humaine pour isoler la variable « classe », avec alignement et divinité renseignés là où la classe en dépend. `scripts/comparer_classes.py` produit le tableau croisé (une ligne par don, une colonne par classe, `O`/`?`/`.`, sortie complète jamais tronquée) suivi des dons proposés à toutes les classes et des dons exclusifs à une seule. Ce croisement détecte la classe d'erreurs qu'un audit mono-classe ne peut pas voir — *un don refusé à la classe qui possède justement la capacité requise* — et a ainsi révélé trois erreurs de données (le scalde marqué non-lanceur, « forme animale » attribuée au seul métamorphe donc refusée au druide, et une extraction de divinité cassée par un `lstrip` pris pour un retrait de préfixe). Résultats, métriques par classe et motifs rejetés : `build/feat-detail-and-magic-gating/OUTPUT_multiclasse_niveau6.md`.

Principe de sûreté qui gouverne toutes ces couches : **une sous-attribution est bien plus grave qu'une sur-attribution.** Sur-attribuer ne coûte qu'un `manual_check` ; sous-attribuer produit un `ineligible` faux, qui cache le don au joueur sans recours.

### Explorateur de dons (visualisation web)

`scripts/exporter_arbre_dons.py` produit, pour un personnage, le **graphe élagué**
des dons qu'il peut viser, en JSON ; `web/explorateur_dons.js`
(+ `explorateur_dons.css`) le rend sous forme de **navigateur à facettes**, dont
l'arbre Cytoscape/dagre n'est qu'une des vues. La frontière est stricte : le Python
n'émet aucune mise en forme, le JS n'émet aucune règle d'éligibilité — c'est ce qui
rend le même JSON réutilisable dans un site. `web/index.html` est la page de démo
*et* la référence d'intégration (elle exige un serveur, `python -m http.server`, un
navigateur refusant `fetch` en `file://`). Point d'entrée unique :
`ExplorateurDons.rendre(conteneur, donnees)`.

```
python scripts/exporter_arbre_dons.py <nom_du_personnage> [--slots N] [-o f.json]
python scripts/exporter_arbre_dons.py --classe Guerrier --niveau 6 --race Humain -o web/exemple_guerrier.json
```

L'atteignabilité est calculée par **fermeture itérative** (`calculer_vagues`) : on
évalue le catalogue, on suppose acquis les dons obtenus, on réévalue, jusqu'à
`--slots` tours. Cette méthode réutilise `evaluate_feat` inchangé, donc elle
hérite de tout son gating et gère les `OrGroup` sans qu'un seul bout de la logique
des prérequis soit réimplémenté. **Elle passe un `known_feats` explicite** (jamais
`None`), ce qui change la sémantique par rapport à `filter_feats` : un prérequis-don
non possédé y vaut `False` au lieu de `None`, donc un don gated sur un don non pris
est rangé dans une vague ultérieure au lieu d'être annoncé accessible (pour un
Guerrier 6 : 234 accessibles tout de suite contre 482 vus par `filter_feats`).

Grandeurs dérivées, toutes dans l'export :

- **`cout`** — nombre exact d'emplacements pour décrocher le don, prérequis
  compris. La vague n'en est qu'une borne inférieure : un don exigeant deux
  prérequis distincts de vague 1 coûte 3, pas 2 ; `calculer_couts` calcule donc la
  fermeture des prérequis manquants en dédupliquant les branches partagées, et
  retient l'alternative la moins chère pour un OU.
- **`levier`** / **`levier_catalogue`** / **`debloque`** — nombre de dons que
  celui-ci débloque transitivement, respectivement **dans la vue** et **dans le
  catalogue entier**, plus la **liste** des enfants directs. Le proxy de valeur le
  plus honnête disponible : le CSV ne dit **rien** de la puissance d'un don, mais
  « Expertise du combat » en ouvrant 65 est un fait structurel. Ne jamais présenter
  ce classement comme une mesure de puissance.
- **`voie`** / **`voie_taille`** — le hub racine dont le don descend, et la taille
  de cette voie. Sans ce découpage la composante géante s'affiche d'un bloc et
  n'apprend rien ; avec lui on retrouve les familles qu'un joueur a en tête (voie de
  l'Expertise du combat, de l'Attaque en puissance…). `voie_taille` permet au rendu
  de replier les voies de taille 1-2 sans rien redériver.

**`construire_graphe(catalog, restreint_a=None)` est appelé deux fois, et c'est le
cœur du correctif du bug d'origine** (« des groupes de 1 qui annoncent débloquer 2
dons sans les montrer ») : les trois grandeurs étaient calculées sur le catalogue
(1417 dons) puis affichées à côté d'un graphe ne montrant que le sous-ensemble
atteignable (459 pour un Guerrier 6). Tout ce que l'une comptait et que l'autre ne
montrait pas devenait un mensonge à l'écran : 94 nœuds à levier surévalué, 13 nœuds
sans arête, 2 voies nommées d'après un don non retenu — désormais 0/0/0. L'écart
entre `levier` et `levier_catalogue` n'est plus caché mais *affiché*, comme
information (« ce don ouvre plus loin que tu ne vois d'ici »). Raisonnement complet
et mesures avant/après : `build/explorateur-et-etiquetage-semantique/OUTPUT_defauts_du_graphe.md`.

Côté rendu : la navigation à facettes passe devant le graphe parce qu'un joueur
demande d'abord « quels dons me donnent un bonus aux dégâts pour deux emplacements »
(le graphe ne répond qu'à « d'où vient ce don »). **OU dans une facette, ET entre
facettes** ; chaque option est comptée sous toutes les *autres* facettes
(`passe(n, saufFacette, …)`), de sorte que le compteur prédit exactement le résultat
du clic, et les options à zéro disparaissent. Ajouter une facette est une ligne dans
la table `FACETTES` — y déclarer `liste: true` est obligatoire pour un champ
multivalué (l'oublier sur `categorie_officielle` faisait annoncer 249 dons pour un
filtre qui n'en gardait aucun). Le coût est une magnitude ordinale, il prend donc la
rampe séquentielle bleue à une seule teinte (validée par
`validate_palette.js --ordinal` dans les deux modes), et le statut `manual_check`
passe par la **bordure en tirets plus un « ! » textuel**, jamais par la teinte seule.
Les dons **isolés** (165 pour un Guerrier 6) sont listés dans la vue liste mais
exclus du graphe : sans arête, ils ne forment qu'un nuage de points. Cytoscape
n'interprète pas les variables CSS, donc `lireRoles()` les résout depuis l'élément
racine via `global.getComputedStyle` (jamais le global implicite du navigateur : le
composant doit rester rendable sous jsdom) — la feuille de style reste l'unique
source de vérité des couleurs, y compris pour le thème sombre (`rafraichirTheme()`).

`web/test_explorateur.js` est un test headless jsdom (`npm install jsdom` puis
`node web/test_explorateur.js web/exemple_guerrier.json`). Il garde les deux
invariants qui *sont* le bug d'origine, et qu'aucune relecture de code ne peut
attraper : **le compteur d'une option prédit exactement le résultat du clic**, et
**ce que le panneau de détail annonce, il le montre** (comparé sur 38 dons réels).
Le composant se dégrade proprement : facettes sémantiques masquées si
`resume.dons_etiquetes === 0`, onglet « arbre » désactivé sans Cytoscape — les deux
états sont eux aussi testés.

### Étiquetage sémantique des dons (LLM)

Le CSV et les pages scrapées disent ce qu'un don *exige*, jamais ce qu'il *donne*.
`scrappers/tag_feat_semantics.py` comble ce trou en étiquetant les 1417 dons via
Bedrock (`eu.anthropic.claude-opus-5`), et produit `Data/dons/feat_semantics.json` :
`effet_principal` (l'axe d'organisation primaire de l'explorateur),
`effets_secondaires`, `cible_du_bonus`, `valeur_bonus`, `contexte`, `activation`,
`utilisations`, `polyvalence`, `resume_court`, `mots_cles`, `categorie_officielle`,
`confiance`. Il écrit aussi `Data/dons/feat_semantics_review.json` : les 86 dons dont
la page mentionne un prérequis **absent du CSV** (`prerequis_non_modelises`, p.ex.
« Attaque au galop » exige 1 rang en Équitation). Ce fichier est un **relevé brut**
destiné à une relecture humaine et ne doit **jamais** être appliqué automatiquement
au moteur d'éligibilité ; sa relecture curée est
`Data/dons/feat_prereq_supplements.json` (ci-dessous).

```
python scrappers/tag_feat_semantics.py [--lot N] [--limite N]
python scrappers/tag_feat_semantics.py --normaliser   # hors-ligne, re-normalise l'existant
```

Deux propriétés du script tirées de l'expérience, à ne pas retirer : les vocabulaires
fermés sont **renormalisés côté client** (`normaliser_fiche`), car les `enum` du
schéma d'outil ne sont **pas** appliqués sur ce chemin Bedrock — une valeur
hors-vocabulaire devient `None` plutôt que de polluer une facette ; et un lot qui
échoue est **repris don par don** automatiquement, l'échec s'étant révélé être une
propriété du lot et non des dons (les 20 récalcitrants ont tous passé en `--lot 1`).
La reprise est incrémentale : `traiter` isole chaque lot, donc huit lots réussis ne
sont plus perdus pour un neuvième malformé.

Le rendu ne dépend pas de cette passe : sans `feat_semantics.json`, l'export reste
valide et l'explorateur masque les facettes sémantiques. Limite connue :
`polyvalence` vaut `conditionnel` pour 61 % des dons, c'est donc une facette faible.
Le choix des quatre axes, les vocabulaires, les distributions mesurées et les deux
enseignements ci-dessus sont détaillés dans
`build/explorateur-et-etiquetage-semantique/OUTPUT_taxonomie_semantique.md`.

### Prérequis lus sur la page et absents du CSV

`Data/dons/feat_prereq_supplements.json` (`scripts/curate_prereq_supplements.py`)
est la relecture **curée à la main** des 86 dons de `feat_semantics_review.json`.
La question posée à chaque fragment relevé est : *est-il quantifiable ?* — donc
réductible à une caractéristique, un BBA, des rangs de compétence ou un nom de don,
les quatre choses que le parser sait déjà lire.

- Oui → il part dans `ajouts`, réécrit **dans la syntaxe de la colonne
  `Conditions`** (« bonus de base à l'attaque +1 » → « BBA +1 »).
  `data_loader.py::_concatener_conditions` les colle aux conditions du CSV avant
  l'appel au parser : aucune règle, aucun `RequirementType`, aucune ligne de moteur
  n'a été ajoutée pour cette couche. `FeatRow.raw_conditions` reste le texte du CSV
  (la source qu'un audit doit citer) ; `FeatRow.prereq_supplements` porte les
  ajouts et `FeatRow.effective_conditions` la concaténation réellement évaluée.
- Non → il part dans `ignores` avec le **genre** qui dit pourquoi, rien n'étant
  jeté en silence : `self_reference` (7 dons listés comme leur propre prérequis —
  bruit de scraping, condition insatisfiable par construction), `proficiency`
  (« maniement de l'arme choisie » : non modélisé, et tout personnage choisit son
  arme), `niveau_1_uniquement`, `contrainte_de_jeu` (matériel, encombrement,
  rituel), `prose_permissive` (la phrase *élargit* l'accès, la transcrire
  l'inverserait), `non_automatisable`, `variante_de_source`, `redondant`.

Bilan : 47 dons augmentés (68 fragments), 39 entièrement écartés. Le genre le plus
dangereux est `variante_de_source` : la page **contredit** le CSV au lieu de le
compléter (« homme-lézard » contre « homme-serpent », ou le grade mythique de
l'homonyme mythique de « Maîtrise du combat défensif ») et l'additionner
fabriquerait une condition impossible, donc un `ineligible` universel.

```
python scripts/curate_prereq_supplements.py
python scripts/curate_prereq_supplements.py --verifier   # contrôles seuls
```

Le contrôle qui compte : `--verifier` refuse d'écrire si un `ajout` n'est pas lu
par le parser comme un prérequis quantifiable unique. Un ajout retombant en
`UNPARSED` n'ajouterait qu'un `manual_check`, l'inverse du but de la couche — c'est
lui qui a renvoyé « fidèle du Destructeur » vers `non_automatisable`. Fichier
absent = catalogue inchangé, comme pour toutes les couches de gating.
`tag_feat_semantics.py` compare désormais la page à `effective_conditions`, sinon
un nouveau passage re-signalerait sans fin les prérequis déjà intégrés ; par
conséquent un don curé peut quitter le relevé, et l'inclusion vérifiée est à sens
unique (tout don du relevé doit être tranché, pas l'inverse). Relecture détaillée,
mesures avant/après et pièges dans
`build/explorateur-et-etiquetage-semantique/OUTPUT_prerequis_de_la_page.md`.

### Pistes futures

D'autres catégories de gating potentielles (au-delà de la magie) sont analysées dans `build/feat-detail-and-magic-gating/OUTPUT_other_gating_categories.md`.

Le levier identifié dans `OUTPUT_guerrier_audit_rules.md` (section a) — les maniements d'armes/d'armures conférés par la classe — est désormais couvert pour les 18 entrées `proficiency` à arme/bouclier nommé (voir `class_proficiencies.json` ci-dessus) ; les 13 restantes dépendent d'un choix du joueur non tracé et resteront en `manual_check` par construction, pas par lacune. La limite connue est que **`Character.skill_rank` est optimiste** : sans `skill_ranks` explicite il renvoie `level`, donc tous les prérequis de rangs de compétence passent simultanément (défendable pour un dépistage « ce personnage *pourrait*-il qualifier ? », PF1 n'ayant pas de malus hors-classe, mais cela gonfle la liste des dons universels). Les 6 entrées `class_ability_unmapped` de `prereq_gating.json` (capacité de classe dont la curation n'a pas pu déterminer la classe) sont l'autre gisement de `manual_check` réductible.

### Test fixtures

`tests/golden/cases.json` is a hand-annotated, stratified regression fixture of feat-eligibility test cases (one object per case: `id`, `feat_name`, `character`, `expected_status`, `note`), covering every `RequirementType`, the `implied_classes` class-gating fix, and the `feat_magic_info`/`class_caster_info` magic-feat gating fix. `tests/test_golden.py` loads and parametrizes over it, evaluating each case's `feat_name` (looked up in the real catalog) against its `character` via the real parser+engine pipeline. To add a new regression case, append an entry with a unique `id`, a real `feat_name` from `Data/dons/Dons.csv`, a minimal `character` dict, the hand-derived `expected_status`, and a `note` explaining what it guards against.
