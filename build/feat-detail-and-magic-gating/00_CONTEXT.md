# 00_CONTEXT — Détail complet des dons + restriction magique

## Project Overview

`pf1_dons` évalue l'éligibilité de personnages Pathfinder 1e (contenu en
français) aux dons du catalogue `Data/Dons.csv`. Le pipeline actuel est :
CSV → `parser.py` (texte libre → `Requirement`/`OrGroup` structurés) →
`engine.py` (évaluation tri-état `eligible`/`manual_check`/`ineligible`).

`Data/Dons.csv` ne contient que 4 colonnes (`Dons`, `Src`, `Conditions`,
`Avantages`) — un résumé, pas la fiche complète du don. Le rapport utilisateur
concret : pour un Guerrier niveau 1, le moteur propose "Adaptation aquatique"
(qui n'a de sens que si le personnage peut "retenir son souffle", un trait le
plus souvent racial/de créature aquatique) et "Acolyte de la Nature" (qui ne
sert vraiment qu'à un lanceur de sorts de nature) sans jamais avertir que ce
sont des dons *à contenu magique/racial spécifique* — l'information complète
n'existe que sur la page web dédiée à chaque don, jamais dans le résumé CSV.

## Objectives

1. Construire un scraper robuste qui récupère, pour **chaque** don du
   catalogue (y compris ceux masqués par défaut dans les lignes dépliables du
   tableau récapitulatif du site), le lien vers sa page dédiée puis le
   contenu détaillé de cette page (description complète, source précise,
   conditions/avantages tels qu'écrits sur la page, rubriques "Spécial"/
   "Normal" si présentes).
2. Détecter, à partir de ce contenu détaillé, si un don est de nature
   magique (nécessite de lancer des sorts / de disposer d'une capacité
   magique pour en tirer un bénéfice réel).
3. Savoir, par classe, si elle a accès à la magie (arcanique, divine ou
   autre) ou non — donnée absente du code actuel (`class_progression.py` ne
   couvre que la BBA).
4. Faire échouer (`ineligible`, pas `manual_check`) l'éligibilité à un don
   magique pour un personnage dont ni la classe ni la race ne donnent accès à
   la magie — symétrique au fix déjà en place pour `implied_classes`
   (voir `engine.py`, commit `956ad95`).
5. Documenter (sans l'implémenter) d'autres catégories de gating généralisable
   repérées dans le contenu détaillé scrappé (taille, alignement, capacité
   raciale précise, etc.), pour une itération future.

## Current State Analysis

- `data_loader.py` charge le CSV brut ; aucune notion d'URL par don.
- `parser.py` a déjà un mécanisme d'enrichissement par mots-clés
  (`_find_implied_classes`, table hand-curated `Data/class_ability_map.json`)
  utilisé par `engine.py` (ligne ~100) pour transformer un `CLASS_FEATURE_TEXT`/
  `UNPARSED` en `ineligible` dur si la classe du personnage ne figure pas dans
  `payload["implied_classes"]`. C'est le patron exact à reproduire pour la
  magie, mais au niveau du **don entier**, pas d'un `Requirement` individuel,
  car le caractère "magique" d'un don n'est presque jamais dans le texte des
  conditions CSV — il n'apparaît que dans la description complète scrappée.
- `class_progression.py` : table statique classe normalisée → progression
  BBA. Aucune notion de magie/caster.
- `race_loader.py` / `Data/races.json` : `RaceInfo.traits` est une liste de
  `{"name", "description"}` en texte brut scrapé de la page de traits
  raciaux standards de chaque race — contient déjà, pour les races qui
  donnent une capacité magique innée (ex. capacités de sorts en tant que
  lanceur de niveau X), le texte nécessaire pour une détection par mots-clés,
  sans qu'aucun champ structuré `is_magic` n'existe encore.
- Scrapers existants (`scrappers/scrape_races.py`,
  `scrappers/extract_class_features.py`, `scrappers/scrape_class_skills.py`)
  suivent tous le même patron : téléchargement HTML mis en cache dans un
  dossier `*_html/` (skip si déjà présent, sauf `force=True`), parsing par
  regex sur balises brutes (pas de vraie librairie HTML), sortie JSON triée
  dans `Data/`, script autonome non importé par le package `pf1_dons`.
- `scrappers/tag_feat_categories.py` établit le patron `needs_manual_check`
  pour un tagger best-effort : un flag JSON par don plutôt qu'une réécriture
  du moteur.
- `scripts/build_class_ability_map_seed.py` + `scripts/curate_class_ability_map.py`
  établissent le patron "draft auto-généré (gitignored) → curation manuelle/IA
  → fichier final committé" utilisé par `Data/class_ability_map.json`. C'est
  le patron à reproduire pour la nouvelle donnée classe/magie.
- **Vérification technique faite pendant ce planning** (chargeable, ne pas
  re-deviner) : la page du tableau récapitulatif
  (`https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20récapitulatif%20des%20dons.ashx`)
  contient déjà, en HTML statique, **toutes** les lignes de dons — y compris
  celles masquées par défaut (classes CSS `donprérequis0`/`donprérequis1`/
  `donprérequis2`, cachées via `$(...).hide()` en jQuery uniquement pour
  l'affichage). Aucune requête JS/AJAX supplémentaire n'est nécessaire ; un
  simple téléchargement HTTP suffit, comme pour les scrapers existants. Le
  contrat HTML exact est documenté dans `01_SKILLS_AND_TOOLS.md`.

## Feature / Issue List Being Addressed

- [ISSUE 1] Absence de description complète par don (perte d'information vs.
  la page web dédiée : mentions "plus courant chez les X", rubriques
  Spécial/Normal, conditions reformulées).
- [ISSUE 2] Absence de notion "ce don est magique" par don.
- [ISSUE 3] Absence de notion "cette classe a accès à la magie" par classe.
- [ISSUE 4] Le moteur propose actuellement des dons magiques à des
  classes/personnages qui ne peuvent structurellement pas en tirer parti
  (ex. Guerrier + "Acolyte de la Nature").
- [ISSUE 5] Pas de suivi/documentation des autres axes de gating généralisables
  (taille, alignement, capacité raciale précise) au-delà de la magie.

## Skills & Tools Inventory

Aucun nouveau Skill Claude Code n'est nécessaire. Deux artefacts partagés,
tous deux construits comme des documents d'analyse dédiés avant que le code
d'implémentation ne démarre (demande explicite de l'utilisateur : aucune
calibration ni aucun verdict de classe hybride ne doit être improvisé par un
subagent d'implémentation) :

1. Le **contrat HTML** du tableau récapitulatif (structure des lignes,
   classes CSS, colonnes), vérifié et figé dans `01_SKILLS_AND_TOOLS.md`.
2. La **calibration vocabulaire/balisage** (`03_STEP_vocab_and_markup_calibration.md`,
   sortie `OUTPUT_vocab_and_markup_calibration.md`) et la **recherche
   vérifiée classe/magie** (`04_STEP_hybrid_class_caster_research.md`,
   sortie `OUTPUT_class_caster_ground_truth.md`) — deux documents d'analyse
   dédiés, produits en Wave 1, qui éliminent tout jugement improvisé dans
   les steps de scraping/tagging/curation/moteur qui suivent.

| Outil / donnée | Statut | Construit par | Consommé par |
|---|---|---|---|
| Contrat HTML tableau récapitulatif | Nouveau (spec) | `01_SKILLS_AND_TOOLS.md` | Step 02 |
| `OUTPUT_vocab_and_markup_calibration.md` | Nouveau (analyse) | Step 03 | Step 06, Step 08, Step 10 |
| `OUTPUT_class_caster_ground_truth.md` (42 classes, hybrides/occultes incluses) | Nouveau (analyse) | Step 04 | Step 07 |
| `Data/feat_links.json` | Nouveau | Step 02 | Step 06 |
| `Data/class_caster_info.draft.json` | Nouveau (gitignored, recoupement secondaire) | Step 05 | Step 07 |
| `Data/feat_details.json` | Nouveau | Step 06 | Step 08, Step 09 |
| `Data/class_caster_info.json` | Nouveau (committed) | Step 07 | Step 10 |
| `Data/feat_magic_info.json` | Nouveau | Step 08 | Step 10 |
| Gating magie dans `engine.py` | Nouveau | Step 10 | Step 11 (tests) |
| `tests/golden/cases.json` (cas magie) | Étendu | Step 11 | CI/pytest |
| Note d'analyse "autres catégories" | Nouveau (doc) | Step 09 | Lecture humaine future |

## Execution Plan (Waves)

- **Wave 1** (aucune dépendance non satisfaite, 4 steps en parallèle) :
  - Step 02 — Scraper des liens de dons (`scrappers/scrape_feat_links.py` →
    `Data/feat_links.json`)
  - Step 03 — Calibration vocabulaire magique + balisage HTML des pages de
    don (échantillon dédié téléchargé indépendamment) →
    `OUTPUT_vocab_and_markup_calibration.md` (Sections A/B/C)
  - Step 04 — Recherche vérifiée classe → accès à la magie pour les 42
    classes (y compris toutes les hybrides/occultes : bretteur, ninja,
    samourai, antipaladin, magus, sanguin, cinetiste, etc.) →
    `OUTPUT_class_caster_ground_truth.md`
  - Step 05 — Seed best-effort du mapping classe → magie
    (`scripts/build_class_caster_info_seed.py` → `Data/class_caster_info.draft.json`),
    simple recoupement automatique secondaire par rapport à Step 04.
- **Wave 2** (dépend de Wave 1) :
  - Step 06 — Scraper des pages détaillées de don (dépend de Step 02 pour
    les liens, de Step 03/Section A pour le balisage HTML) →
    `Data/feat_details.json`
  - Step 07 — Curation de `Data/class_caster_info.json` (dépend de Step 04
    comme source de vérité, Step 05 comme recoupement) → transcrit
    fidèlement les 42 verdicts vérifiés, aucun deviné.
- **Wave 3** (dépend de Wave 2) :
  - Step 08 — Tagger magie par don (dépend de Step 06 pour la donnée, de
    Step 03/Section B pour le vocabulaire) → `Data/feat_magic_info.json`
  - Step 09 — Analyse écrite des autres catégories de gating généralisables
    (dépend de Step 06 et Step 08 pour des exemples concrets ; peut démarrer
    dès que Step 08 est fini, en parallèle de Step 10 en Wave 4)
- **Wave 4** (dépend de Wave 3) :
  - Step 10 — Gating magie dans `engine.py` (dépend de Step 07, Step 08, et
    Step 03/Section C pour le vocabulaire des races à magie innée)
- **Wave 5** (dépend de Wave 4) :
  - Step 11 — Dataset golden + tests + mise à jour CLAUDE.md (dépend de
    Step 10)

Step 09 n'a pas de dépendance réelle sur Step 10 ; elle est placée en fin de
plan uniquement par convention de lecture, mais peut être lancée dès que
Step 08 termine (donc concurremment avec Step 10/Wave 4) si on veut
maximiser le parallélisme.

## Git & Branching Strategy

- Branche de base : `main`.
- Une branche de fonctionnalité par étape, préfixée `feature/feat-details-`,
  ex. `feature/feat-details-scrape-links`, `feature/feat-details-magic-gating`.
- Wave 1 (4 steps : 02, 03, 04, 05) tourne intégralement en **worktrees
  séparés** — aucune dépendance de fichiers en commun à ce stade, vraie
  parallélisation à 4. Wave 2 (06, 07) peut aussi tourner en worktrees
  séparés (fichiers de sortie distincts). Wave 3+ peut réutiliser un seul
  worktree séquentiel si un seul agent exécute la suite, ou rester en
  worktrees séparés si des agents distincts prennent en charge Step 08/09.
- Chaque étape = un commit unique (ou une poignée de commits atomiques si le
  script + les données générées sont commités séparément), message au
  format `<type>: <résumé>` (`scrape:`, `data:`, `engine:`, `tests:`, `docs:`),
  cohérent avec l'historique existant (`engine: fail class-mismatched...`).
- Ordre de merge vers `main` :
  Wave 1 (Step 02, Step 03, Step 04, Step 05 — indépendants, mergeables dans
  n'importe quel ordre entre eux) →
  Wave 2 (Step 06 nécessite Step 02+03 mergés ; Step 07 nécessite Step 04+05
  mergés) →
  Wave 3 (Step 08 nécessite Step 03+06 mergés ; Step 09 nécessite Step 06+08
  mergés, mergeable à tout moment après, y compris en parallèle de Wave 4) →
  Wave 4 (Step 10 nécessite Step 03+07+08 mergés) →
  Wave 5 (Step 11 nécessite Step 10 mergé).
- Ne jamais merger un fichier `*.draft.json` (gitignored, comme
  `Data/class_ability_map.draft.json`) — seul le fichier curaté final est
  committé. Les documents `OUTPUT_*.md` de Step 03/04/09, eux, sont bien
  committés (ce sont des livrables de recherche/analyse, pas des brouillons
  jetables).

## CLAUDE.md Impact

Après exécution complète, `CLAUDE.md` doit gagner :
- Une entrée décrivant `Data/feat_links.json` et `Data/feat_details.json`
  (nouveaux scrapers, patron cache HTML, commande de régénération), au même
  niveau que la description actuelle de `race_loader.py`/`class_skills.py`,
  avec un pointeur vers `OUTPUT_vocab_and_markup_calibration.md` comme
  référence du balisage HTML exploité.
- Une entrée décrivant `Data/feat_magic_info.json` et `Data/class_caster_info.json`
  (curation manuelle comme `class_ability_map.json`, mais adossée à la
  recherche vérifiée `OUTPUT_class_caster_ground_truth.md` couvrant les 42
  classes y compris hybrides/occultes), et la nouvelle règle de gating dans
  `engine.py::evaluate_feat` (don magique + classe/race non magique ⇒
  `ineligible` dur).
- Une mention de la note d'analyse "autres catégories de gating" comme piste
  documentée mais non implémentée.
- Step 11 est chargé de rédiger ce paragraphe exact dans `CLAUDE.md`
  (voir Verification Criteria de ce step).
