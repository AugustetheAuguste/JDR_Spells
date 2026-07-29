# 03 — Échantillon stratifié pour la passe 0 de taxonomie

## Objectives

Produire un échantillon reproductible d'environ 200 sorts, stratifié sur le
niveau et l'école, qui servira de base à la construction de la taxonomie de tags
(étape 04). L'échantillon est un artefact committé, pas un tirage refait à
chaque exécution.

## Dependencies & Parallelization

- **Vague 2.** Dépend de : `01_SKILLS_AND_TOOLS` (préflight, fixture).
- Aucune dépendance sur `02_SCHEMA_ENRICHISSEMENT`, qui tourne en parallèle :
  l'échantillon ne contient que des identifiants de sorts existants, il ne
  connaît aucun champ d'enrichissement.
- Bloque `04_TAXONOMIE_PASSE0`.

## Inherited Context from Dependencies

De `01_SKILLS_AND_TOOLS` :
- `tools/preflight_corpus.py` — à appeler en garde d'entrée ; sortie non nulle
  = arrêt.
- `tests/fixtures/mini_corpus/` — 12 sorts figés pour tester la stratification
  hors ligne.

Du dépôt :
- `data/index/` : index des sorts uniques, source de vérité de la liste des ids.
- `data/sorts/<id>.json` : 21 clés françaises. Les clés utilisées ici sont celles
  qui portent l'école et le niveau — **ne pas les deviner**, les lire dans le
  Skill `pf-corpus-conventions` et dans un fichier réel avant de coder.
- Rappel : le niveau est relatif à la classe. Un sort n'a pas « un » niveau ;
  il a un niveau par classe. La stratification doit choisir une convention et
  la documenter (recommandé : `niveau_min` toutes classes confondues).

## Pseudo-code

```
FONCTION construire_echantillon(taille_cible=200, graine=20240101):
  ids <- charger data/index/
  POUR chaque id :
     sort  <- charger data/sorts/<id>.json
     ecole <- lire la clé d'école
     niv   <- min des niveaux sur toutes les classes qui listent ce sort
     strate <- (ecole, niv)
  strates <- regrouper par strate

  # allocation proportionnelle avec plancher
  POUR chaque strate :
     quota <- max(2, round(taille_cible * |strate| / |total|))
  ajuster les quotas pour retomber sur taille_cible (arrondi déterministe)

  rng <- générateur seedé par graine
  POUR chaque strate (dans un ordre trié, pas un ordre de dict) :
     tirer quota ids sans remise
  résultat <- ids triés

  ÉCRIRE build_artifacts/echantillon_taxo.json :
     {graine, taille, construit_le, strates: {"<ecole>:<niv>": [ids...]},
      couverture: {ecoles: n, niveaux: n}}
```

## Logic Flow

1. Garde d'entrée : `preflight_corpus.py`, arrêt si KO.
2. Lire l'index, charger chaque sort, calculer sa strate.
3. Rapporter la distribution brute **avant** tirage — s'il existe des strates à
   0 ou 1 sort, le plancher de 2 est inapplicable et il faut le signaler plutôt
   que le contourner silencieusement.
4. Tirer avec graine fixe, écrire l'artefact trié.
5. Écrire un test qui exécute deux fois la construction et affirme l'égalité
   octet à octet des sorties.

## Implementation Notes

- Déterminisme : trier explicitement toutes les collections avant tirage. Un
  parcours de dictionnaire ou de `glob` n'est pas un ordre stable entre machines.
- Ne pas écrire dans `data/`. L'échantillon est un artefact de construction, sa
  place est `build_artifacts/`.
- La couverture prime sur la proportionnalité pure : mieux vaut 210 sorts avec
  toutes les strates représentées que 200 avec trois écoles absentes. Documenter
  l'écart réel dans l'artefact.
- Si une école n'a aucun sort de niveau 9, ce n'est pas un bug — c'est la
  distribution réelle. Le rapport doit le montrer, pas le corriger.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- `build_artifacts/echantillon_taxo.json` existe, contient entre 190 et 230 ids,
  tous présents dans `data/index/`.
- Toutes les écoles présentes dans le corpus apparaissent dans au moins une
  strate de l'échantillon ; l'écart éventuel est explicité dans le fichier.
- Deux exécutions successives produisent un fichier identique (test automatisé).
- Le test de stratification tourne hors ligne sur `mini_corpus` sans toucher au
  corpus complet.
- Aucun fichier de `data/` n'a été modifié : `git status data/` est vide.

## Git Handling

- Branche : `feat/enrichissement-llm/03-echantillon`.
- Commits :
  - `feat(taxo): construire l'échantillon stratifié reproductible`
  - `test(taxo): vérifier le déterminisme du tirage`
- L'artefact `build_artifacts/echantillon_taxo.json` **est committé** : l'étape
  04 doit pouvoir le rejouer à l'identique.
- Fusion `--no-ff` en fin de Vague 2.

## Expected Outcome

Un échantillon de ~200 sorts, couvrant toutes les écoles et toute la plage de
niveaux, reproductible à la graine près, prêt à alimenter la passe 0 de
proposition libre de tags.
