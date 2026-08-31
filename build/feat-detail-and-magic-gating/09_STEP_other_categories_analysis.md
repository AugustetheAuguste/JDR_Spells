# 09_STEP — Analyse écrite : autres axes de gating généralisables

## Objectives

Produire un document d'analyse (pas de code, pas de nouvelle donnée
consommée par le moteur) recensant, à partir du contenu réellement scrapé
dans `Data/feat_details.json`, d'autres catégories de prérequis implicites
qui suivent le même schéma que le fix `implied_classes`/le gating magie
(Step 10) — c'est-à-dire une information présente dans la description
complète d'un don mais absente/non structurée dans `Data/Dons.csv`, qui
pourrait justifier un `ineligible` dur plutôt qu'un `manual_check`.

## Dependencies & Parallelization

- Wave 3 (n'a besoin que de Step 06 pour la donnée brute et, idéalement,
  Step 08 pour un exemple concret déjà traité comme référence). Peut tourner
  en parallèle de Step 10 dans un worktree séparé — aucune modification de
  code partagée.

## Inherited Context from Dependencies

- `Data/feat_details.json` (Step 06) : par don, `description` (texte
  narratif complet), `conditions_detail`, `avantages_detail`, `special`,
  `normal`, `raw_text`.
- `Data/feat_magic_info.json` (Step 08) : exemple de référence d'un axe déjà
  traité (magie), à citer en comparaison dans le document produit.
- Cas d'origine à analyser explicitement (rapporté par l'utilisateur) :
  `"Adaptation aquatique"` — condition réelle "Capacité retenir son souffle",
  qui est une capacité extraordinaire de créature/race (pas une classe, pas
  de la magie) ; aucun mécanisme actuel (`implied_classes` ni le nouveau
  gating magie) ne la couvre. C'est l'exemple central à documenter en
  premier.

## Pseudo-code

```
DOCUMENT: build/feat-detail-and-magic-gating/OUTPUT_other_gating_categories.md

STRUCTURE:
  1. Méthode : comment l'analyse a été faite (lecture d'un échantillon de
     Data/feat_details.json, recherche de motifs répétés dans les
     conditions/descriptions qui nomment une capacité/trait précis sans
     nommer de classe).
  2. Catégorie "capacité raciale/de créature précise" (ex. "Adaptation
     aquatique" / "Capacité retenir son souffle") :
     - fréquence estimée (compter combien de dons du catalogue ont une
       condition qui matche des motifs similaires, ex. "retenir son
       souffle", "vision dans le noir", "résistance élémentaire innée")
     - pourquoi c'est un axe différent de implied_classes (c'est une
       capacité, pas une classe) et différent de la magie
     - proposition d'implémentation future (nouveau fichier
       Data/ability_owner_map.json sur le modèle de class_ability_map.json,
       mais mappant capacité -> races/créatures qui la possèdent plutôt que
       classes)
  3. Catégorie "taille" implicite non capturée par RequirementType.SIZE
     actuel (ex. dons dont la description mentionne une taille sans que
     "Conditions" ne le formalise en "taille X") — chercher des exemples
     réels concrets dans feat_details.json, ne pas inventer.
  4. Catégorie "alignement" (dons dont la description exige un alignement
     précis mentionné seulement dans le texte détaillé, pas dans
     Conditions/Avantages du CSV) — chercher des exemples réels concrets.
  5. Toute autre catégorie repérée pendant la lecture de l'échantillon,
     avec au moins 2 exemples réels cités par catégorie proposée (nom du
     don + extrait de texte exact).
  6. Recommandation de priorité (quelle catégorie mériterait d'être
     implémentée en premier dans une itération future, et pourquoi — ex.
     fréquence dans le catalogue, risque de faux positifs).

NE PAS : écrire de code, modifier engine.py/parser.py/models.py, créer de
nouveau RequirementType, ni committer de nouveau fichier Data/*.json.
```

## Logic Flow

1. Charger et lire un échantillon réel de `Data/feat_details.json` (au moins
   50-100 entrées, en priorisant celles taguées `needs_manual_check: true`
   dans `Data/feat_categories.json` existant et dans
   `Data/feat_magic_info.json` — ce sont les dons les plus susceptibles de
   cacher un motif de gating non couvert).
2. Grouper les motifs textuels répétés observés dans les conditions/
   descriptions qui ne sont couverts par aucun `RequirementType` existant ni
   par le gating magie.
3. Rédiger le document avec des exemples réels (jamais inventés) et une
   recommandation de priorité.

## Implementation Notes

- Ce step est purement analytique/documentaire — aucune modification de
  code de production, aucune nouvelle dépendance dans `pf1_dons`.
- Le document produit doit vivre sous
  `build/feat-detail-and-magic-gating/OUTPUT_other_gating_categories.md`
  (préfixe `OUTPUT_` pour le distinguer clairement des fichiers de plan
  `NN_STEP.md`).
- Toute citation d'exemple doit inclure le nom exact du don et un extrait
  textuel vérifiable dans `Data/feat_details.json`, pour que la future
  itération puisse repartir directement de ce document sans re-scraper.

## Verification Criteria

- Le document existe, contient au moins 3 catégories distinctes avec ≥2
  exemples réels chacune (nom de don + citation exacte), et une section de
  recommandation de priorité claire.
- Aucun fichier de code (`.py`) n'a été créé ou modifié par ce step.
- Le cas "Adaptation aquatique" est explicitement traité comme exemple
  d'ouverture de la catégorie "capacité raciale/de créature précise".

## Git Handling

- Branche : `feature/feat-details-other-categories-analysis`, basée sur la
  branche mergée de Step 06 (et idéalement Step 08 pour la comparaison).
- Commit : uniquement le document d'analyse.
- Message : `docs: catalog other feat-gating categories for a future pass`
- Mergeable indépendamment, à tout moment après Step 06/08 — pas de
  dépendance de merge avec Step 10/11.

## Expected Outcome

Un document exploitable par une future itération pour étendre le gating
au-delà de la magie, sans avoir à re-scraper ou re-explorer le catalogue
depuis zéro.
