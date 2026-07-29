# 08 — Vue dérivée : sorts + enrichissements joints

## Objectives

Produire `data/vues/sorts_enrichis/<id>.json` : la jointure sur `id` du sort
Phase 1 et de son enrichissement. C'est un artefact **dérivé**, jamais édité à
la main, destiné aux Tracks B (export web) et C (documents à vectoriser), pour
qu'aucune des deux n'ait à réimplémenter la jointure.

## Dependencies & Parallelization

- **Vague 3.** Dépend de : `02_SCHEMA_ENRICHISSEMENT` (forme du schéma
  d'enrichissement) et de `01_SKILLS_AND_TOOLS` (fixture, préflight).
- Ne dépend **pas** de l'existence d'enrichissements réels : la vue se construit
  et se teste sur des enregistrements fixtures, et gère nativement le cas
  « enrichissement absent ». C'est ce qui permet de la faire en Vague 3, avant
  toute génération.
- Tourne en parallèle de `04_TAXONOMIE_PASSE0`.

## Inherited Context from Dependencies

De `02_SCHEMA_ENRICHISSEMENT` :
- `schemas/enrichissement.schema.json`, champs :
  `id, slug, resume_court, categorie_principale, tags[], roles_tactiques[],
  cible_typique, type_degats|null, condition_infligee[], preuves{},
  notes_ambiguite|null, verifie_par_humain, version_prompt, version_taxonomie,
  modele, genere_le, hash_source`.
- Enregistrements d'exemple : `tests/fixtures/enrichissements/`.
- Emplacement source : `data/enrichissements/<id>.json`.

De `01_SKILLS_AND_TOOLS` :
- `tests/fixtures/mini_corpus/` (12 sorts, 21 clés).
- Skill `pf-enrichment-conventions` : `data/vues/` est dérivé, jamais éditable.

Du dépôt : `data/sorts/<id>.json` (21 clés, toutes présentes),
`data/index/` (liste faisant autorité des ids).

## Pseudo-code

```
FONCTION construire_vue(seulement=None, force=False):
  ids <- data/index/  (ou l'ensemble passé en --only)
  POUR chaque id :
     sort <- charger data/sorts/<id>.json           # obligatoire
     enr  <- charger data/enrichissements/<id>.json # facultatif

     SI enr est absent :
        enrichissement <- null
        statut <- "sans_enrichissement"
     SINON SI enr échoue la validation de schéma :
        enrichissement <- null
        statut <- "enrichissement_invalide"
        consigner l'erreur, NE PAS interrompre la construction
     SINON :
        enrichissement <- enr
        statut <- "ok"

     vue <- { **sort,                       # les 21 clés, inchangées
              "enrichissement": enrichissement,
              "statut_enrichissement": statut,
              "construit_le": <horodatage>,
              "hash_sort": sha256(sort canonique) }
     ÉCRIRE data/vues/sorts_enrichis/<id>.json  (JSON trié, UTF-8, sans échappement)

  ÉCRIRE data/vues/sorts_enrichis/_rapport.json :
     {total, ok, sans_enrichissement, enrichissement_invalide, ids_invalides[]}
```

## Logic Flow

1. Garde d'entrée : préflight ; refuser de tourner si `data/sorts/` est absent.
2. Refuser d'écrire si un fichier de vue existant a été modifié à la main —
   détectable en comparant `hash_sort` et en vérifiant l'horodatage git. Message
   explicite : « `data/vues/` est dérivé, vos modifications seraient perdues ».
3. Construire chaque vue, écrire immédiatement (pas d'accumulation en mémoire).
4. Écrire le rapport agrégé en dernier.
5. Vérifier l'absence de U+FFFD sur l'ensemble produit avant de sortir en 0.

## Implementation Notes

- **Les 21 clés du sort sont recopiées telles quelles.** Pas de renommage, pas
  d'aplatissement, pas de fusion de l'enrichissement au premier niveau : la vue
  doit rester lisiblement « le sort, plus une boîte à part ».
- Un enrichissement invalide ne fait pas échouer la construction. Il produit une
  vue avec `statut_enrichissement: "enrichissement_invalide"` et une ligne au
  rapport. Les consommateurs en aval savent alors qu'ils ont un sort utilisable
  sans couche LLM, ce qui est très différent d'une absence de fichier.
- Idempotence : deux exécutions consécutives sans changement de source doivent
  produire des fichiers identiques hors `construit_le`. Rendre ce champ
  optionnel derrière un `--horodater` si le test d'idempotence devient pénible.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- Sur `mini_corpus` + fixtures d'enrichissement : 12 vues produites, dont au
  moins une `ok`, une `sans_enrichissement` et une `enrichissement_invalide`.
- `_rapport.json` contient des totaux cohérents avec les fichiers produits.
- Un test affirme que les 21 clés d'origine sont présentes et non modifiées dans
  chaque vue (comparaison clé à clé avec le fichier source).
- Deux exécutions successives produisent des fichiers identiques (hors
  horodatage) — test d'idempotence.
- Aucun fichier de `data/sorts/` ni `data/enrichissements/` n'est écrit :
  vérifié par `git status` après exécution.
- Aucun U+FFFD dans la sortie.

## Git Handling

- Branche : `feat/enrichissement-llm/08-vue-jointe`.
- Commits :
  - `feat(vues): construire la vue jointe sorts + enrichissements`
  - `test(vues): couvrir les trois statuts et l'idempotence`
- Les fichiers de `data/vues/` produits sur le corpus complet sont committés
  lors de l'exécution finale (Vague 6), pas ici : ici on committe le
  constructeur et ses tests sur fixtures.
- Fusion `--no-ff` en fin de Vague 3.

## Expected Outcome

Un constructeur de vue testé, tolérant à l'absence et à l'invalidité des
enrichissements, prêt à être exécuté sur le corpus complet dès que l'étape 06
aura produit des enregistrements réels.
