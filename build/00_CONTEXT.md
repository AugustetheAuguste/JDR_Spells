# 00 — CONTEXTE : Enrichissement LLM du corpus de sorts

## Project Overview

Phase 1 a produit un corpus structuré de ~2 070 sorts Pathfinder 1e en français,
scrapé depuis pathfinder-fr.org. Track A (ce plan) ajoute une couche
d'enrichissement générée par LLM : catégorie, résumé court, tags, rôles
tactiques, cible, type de dégâts — des champs que le texte source ne porte pas
explicitement mais qu'on peut en dériver.

Le principe non négociable hérité de la Phase 1 : **les fichiers écrits à la main
font autorité**. `data/sorts/<id>.json` reste intouché par cette track. Tout ce
qui est généré par machine vit dans un arbre parallèle.

## Objectives

1. Geler un contrat fermé (schéma JSON + vocabulaires clos) pour les données
   enrichies, dans `data/enrichissements/<id>.json`.
2. Construire une taxonomie de tags curée à la main (25–40 entrées) à partir
   d'un échantillon stratifié, plutôt que de laisser le modèle inventer.
3. Ajouter trois étages numérotés au pipeline existant :
   `08_prepare_prompts` → `09_enrich_llm` → `10_validate_enrichment`.
4. Rendre la confabulation détectable mécaniquement (champ `preuves` :
   sous-chaîne exacte du source, vérifiée post-hoc).
5. Rendre les corrections humaines survivables (`verifie_par_humain`, refus
   d'écrasement sans `--force`).
6. Produire une vue dérivée jointe `data/vues/sorts_enrichis/<id>.json` pour les
   Tracks B et C.

## Current State Analysis

**Hypothèse de départ — à confirmer par le préflight de l'étape 01.** Le dépôt
n'a pas pu être lu au moment de la rédaction ; ce plan s'appuie sur la
description fournie. Structure supposée :

```
src/pf_spells/            un module par étage (fetch_classes … validate_corpus)
data/classes.json         roster des 19 classes
data/listes_classes/<slug>.jsonl
data/index/               index des sorts uniques + cartes de partage inter-classes
data/sorts/<id>.json      ~2 070 fichiers, 21 clés snake_case françaises
schemas/                  JSON Schema des contrats Phase 1
cache/html/               pages brutes committées
tests/                    suite pytest
CLAUDE.md
Skill: pf-corpus-conventions   (slug, vocabulaire, encodage, politique des nulls)
```

Contraintes structurelles à respecter :
- U+FFFD n'importe où = signal de corruption décisif, échec immédiat.
- Chaque étage doit tourner hors ligne et être idempotent. `09_enrich_llm` est la
  seule exception réseau de cette track.
- Les 21 clés existantes ne sont ni renommées ni étendues.

## Feature / Issue List

| # | Sujet | Résolution |
|---|---|---|
| A1 | Où vivent les données LLM | Arbre parallèle `data/enrichissements/`, jointure sur `id` |
| A2 | Liste de champs | Ensemble clos gelé à l'étape 02 |
| A3 | Taxonomie | Passe 0 sur échantillon → curation main → `taxonomie_v1` gelée |
| A5 | Pas de savoir importé | Une seule source dans le prompt + champ `preuves` vérifié |
| A8 | Coût / reprise | Bedrock Batch, reprise par hash de source, `--limit` / `--only` |
| A9 | Survie des corrections | `verifie_par_humain` + refus sans `--force` |
| A10 | Découpage en étages | 08 / 09 / 10, seul 09 touche le réseau |

## Skills & Tools Inventory

| Nom | État | Construit à | Consommé par |
|---|---|---|---|
| Skill `pf-corpus-conventions` | **existe** | — | toutes les étapes (slug, encodage, nulls) |
| Skill `pf-enrichment-conventions` | **à construire** | 01 | 02, 04, 05, 06, 07, 08, 09 |
| Skill `pf-bedrock-batch` | **à construire** | 01 | 06 |
| Outil `tools/preflight_corpus.py` | **à construire** | 01 | toutes (garde d'entrée) |
| Fixture `tests/fixtures/mini_corpus/` (12 sorts) | **à construire** | 01 | 02, 03, 05, 06, 07, 08 |
| Outil `tools/estimate_cost.py` | **à construire** | 01 | 05, 06 |

Aucune étape fonctionnelle ne démarre avant que l'étape 01 soit fusionnée.

## Execution Plan (Waves)

```
Wave 1 : 01_SKILLS_AND_TOOLS
Wave 2 : 02_SCHEMA_ENRICHISSEMENT      03_ECHANTILLON_STRATIFIE
Wave 3 : 04_TAXONOMIE_PASSE0           08_VUE_SORTS_ENRICHIS
Wave 4 : 05_STAGE_08_PREPARE_PROMPTS   07_STAGE_10_VALIDATE
Wave 5 : 06_STAGE_09_ENRICH_LLM
Wave 6 : 09_CLI_DOCS_CLAUDE_MD
```

Dépendances réelles (aucune inventée) :
- 02 et 03 ne dépendent que des outils de 01.
- 04 a besoin de l'échantillon produit par 03.
- 08 a besoin uniquement de la forme du schéma (02).
- 05 a besoin du schéma (02, pour décrire la sortie attendue au modèle) et de la
  taxonomie gelée (04, embarquée dans le prompt).
- 07 a besoin du schéma (02) et des vocabulaires gelés (04) — pas du générateur.
  Il est testé sur des enregistrements fixtures, d'où son parallélisme avec 05.
- 06 a besoin des artefacts de prompt produits par 05.
- 09 nomme les trois étages et la vue : dépend de 05, 06, 07, 08.

## Git & Branching Strategy

- Branche de base de la track : `feat/enrichissement-llm`, partant de la branche
  où Phase 1 a été fusionnée.
- Une branche par étape : `feat/enrichissement-llm/NN-slug`
  (ex. `feat/enrichissement-llm/05-prepare-prompts`).
- Toute étape lancée en parallèle tourne dans son propre worktree :
  `git worktree add ../wt-NN feat/enrichissement-llm/NN-slug`.
- Granularité : un commit par unité livrable à l'intérieur de l'étape
  (schéma, code, tests, doc) — pas un commit géant de fin d'étape.
- Convention de message : `type(scope): sujet à l'impératif`, scopes
  `enrich`, `schema`, `taxo`, `tools`, `skills`, `docs`.
  Ex. `feat(enrich): ajouter l'étage 09 de génération Bedrock`.
- Ordre de fusion : par vague, `--no-ff`, dans l'ordre numérique à l'intérieur
  d'une vague. Une vague entière est fusionnée avant que la suivante démarre.
- Les artefacts volumineux générés (`data/enrichissements/`,
  `data/vues/sorts_enrichis/`) sont committés — cohérent avec `cache/html/`.
  Les prompts assemblés (`build_artifacts/prompts/`) sont committés aussi : ils
  sont la preuve de ce qui a été envoyé et permettent le rejeu.

## CLAUDE.md Impact

À mettre à jour après l'exécution :
- Nouvelle section « Enrichissement LLM » : arbre `data/enrichissements/`,
  règle de non-écrasement, sémantique de `verifie_par_humain`.
- Table des étages étendue de 08, 09, 10 avec la mention explicite que 09 est le
  seul étage réseau de la track.
- Renvoi vers les nouveaux Skills `pf-enrichment-conventions` et
  `pf-bedrock-batch`.
- Note d'exploitation : identifiants AWS attendus en variables d'environnement,
  jamais dans le dépôt ; plafond de dépense à vérifier avant tout run complet.
- Avertissement : `data/vues/` est dérivé, jamais édité à la main.
