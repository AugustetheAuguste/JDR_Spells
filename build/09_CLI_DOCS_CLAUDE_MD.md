# 09 — CLI, documentation et mise à jour de CLAUDE.md

## Objectives

Rendre la track exécutable de bout en bout par une personne qui n'a pas suivi
sa construction : entrées CLI cohérentes avec les étages Phase 1, un run complet
documenté, et CLAUDE.md à jour.

## Dependencies & Parallelization

- **Vague 6.** Dépend de : `05_STAGE_08_PREPARE_PROMPTS`,
  `06_STAGE_09_ENRICH_LLM`, `07_STAGE_10_VALIDATE`, `08_VUE_SORTS_ENRICHIS`.
- Dernière étape du plan. Rien ne tourne en parallèle.

## Inherited Context from Dependencies

Modules et artefacts à câbler :

| Étage | Module | Entrée | Sortie |
|---|---|---|---|
| 08 | `pf_spells.prepare_prompts` | `data/sorts/`, vocabulaires v1 | `build_artifacts/prompts/<v>/` |
| 09 | `pf_spells.enrich_llm` | prompts + manifeste | `data/enrichissements/` |
| 10 | `pf_spells.validate_enrichment` | enrichissements + sorts | `build_artifacts/rapports/` |
| — | constructeur de vue (étape 08) | sorts + enrichissements | `data/vues/sorts_enrichis/` |

Drapeaux communs déjà définis en amont : `--limit`, `--only <ids>`, `--force`,
`--version-prompt`, `--mode batch|ondemand` (étage 09 seulement),
`--strict` (étage 10 seulement).

Skills concernés : `pf-corpus-conventions` (existant),
`pf-enrichment-conventions` et `pf-bedrock-batch` (étape 01),
section `taxonomie_v1` (étape 04).

## Pseudo-code

```
CLI (aligné sur la convention Phase 1) :
  pf-spells prepare-prompts  [--limit N] [--only ID…] [--version-prompt V] [--force]
  pf-spells enrich           [--mode batch|ondemand] [--limit N] [--only ID…]
                             [--force] [--concurrence N]
  pf-spells validate-enrich  [--only ID…] [--strict]
  pf-spells build-vues       [--only ID…] [--force]

  chaque sous-commande :
     appelle preflight_corpus en garde d'entrée
     journalise début / fin / compteurs
     retourne un code de sortie non nul en cas d'échec sous --strict

DOCUMENTATION docs/enrichissement.md :
  - schéma du flux 08 -> 09 -> 10 -> vues
  - procédure de run complet, avec l'estimation de coût attendue
  - procédure de réglage de prompt : bump version_prompt, run --limit 50 en
    ondemand, lire le rapport 10 par type d'erreur, itérer, puis passe complète
  - procédure de correction humaine : éditer data/enrichissements/<id>.json,
    passer verifie_par_humain à true, relancer validate-enrich
  - que faire quand le rapport lève taxonomie_incomplete (> 5 % d'ambiguïté)
  - que faire quand le rapport liste derive_source
```

## Logic Flow

1. Câbler les quatre sous-commandes sur les modules existants. Aucune logique
   métier nouvelle ici — si une sous-commande a besoin de calculer quelque
   chose, c'est que ça manque dans son étage.
2. Exécuter la chaîne complète sur `mini_corpus` et vérifier les artefacts.
3. Écrire `docs/enrichissement.md`.
4. Mettre à jour CLAUDE.md :
   - nouvelle section « Enrichissement LLM » : arbre `data/enrichissements/`,
     règle de non-écrasement, sémantique de `verifie_par_humain` ;
   - table des étages étendue à 08, 09, 10, avec la mention que 09 est le seul
     étage réseau de la track ;
   - `data/vues/` marqué dérivé, jamais édité à la main ;
   - renvoi vers les deux nouveaux Skills ;
   - note d'exploitation AWS : credentials par variables d'environnement,
     plafond de dépense à vérifier avant tout run complet.
5. Exécution finale de production : run complet, puis commit des données.

## Implementation Notes

- Ne pas introduire de nouveaux noms de drapeaux : la valeur de cette étape est
  la cohérence avec ce qui existe. Si Phase 1 utilise `--limit`, cette track
  utilise `--limit`.
- La documentation du réglage de prompt est le morceau le plus utile : c'est la
  boucle qu'on répétera 5 à 10 fois. Y écrire les commandes exactes, pas des
  principes.
- Vérifier que CLAUDE.md ne promet pas que « tous les étages tournent hors
  ligne » — cette track introduit la première exception et la phrase doit être
  amendée, pas contournée.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- Les quatre sous-commandes existent, répondent à `--help`, et tournent de bout
  en bout sur `mini_corpus` (le run `enrich` en client simulé).
- `docs/enrichissement.md` contient les commandes littérales des deux
  procédures (réglage de prompt, correction humaine).
- CLAUDE.md mentionne les étages 08/09/10, `data/enrichissements/`,
  `data/vues/`, les deux nouveaux Skills, et l'exception réseau.
- La suite de tests complète passe : `pytest tests/` — Phase 1 comprise, aucune
  régression.
- Sur le corpus réel : `validate-enrich --strict` rapporte un taux d'échec
  < 5 % et un taux de `notes_ambiguite` < 5 %. Au-delà, ne pas clore la track :
  itérer sur le prompt, ou couper une `taxonomie_v2` (règle de l'étape 04).
- `data/vues/sorts_enrichis/` contient un fichier par sort de `data/index/`.

## Git Handling

- Branche : `feat/enrichissement-llm/09-cli-docs`.
- Commits :
  - `feat(cli): exposer les étages 08, 09, 10 et la construction des vues`
  - `docs: documenter le flux d'enrichissement et les procédures de réglage`
  - `docs(claude): déclarer les étages d'enrichissement et l'exception réseau`
  - `data(vues): générer la vue jointe complète`
- Fusion `--no-ff` de `feat/enrichissement-llm` vers la branche de base une fois
  les six vagues fusionnées et la suite complète au vert.

## Expected Outcome

La track est utilisable et transmissible : quatre commandes, une documentation
de la boucle de réglage, un CLAUDE.md qui dit la vérité sur ce que fait le
dépôt — et une vue jointe complète que les Tracks B et C peuvent consommer.
