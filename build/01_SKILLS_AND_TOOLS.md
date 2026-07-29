# 01 — Skills & Outils (étape réservée)

## Objectives

Construire tout ce dont les étapes fonctionnelles dépendent, avant qu'aucune ne
démarre : deux Skills, un script de préflight, une fixture de mini-corpus, un
estimateur de coût. Rien ici ne produit de donnée enrichie.

## Dependencies & Parallelization

- **Vague 1.** Aucune dépendance sur une autre étape de ce plan.
- Dépend uniquement de l'état du dépôt en fin de Phase 1 et du Skill existant
  `pf-corpus-conventions`.
- Toutes les autres étapes du plan dépendent de celle-ci. Elle est fusionnée
  avant le lancement de la Vague 2.

## Inherited Context from Dependencies

Aucune étape amont. Contexte hérité du dépôt :

- Skill existant `pf-corpus-conventions` : algorithme de slug, vocabulaire des
  clés, règles d'encodage, politique des nulls. Ne pas le modifier ici ; le
  nouveau Skill s'y réfère par renvoi explicite.
- `data/sorts/<id>.json` : 21 clés françaises snake_case, toujours toutes
  présentes. `data/index/` contient l'index des sorts uniques et les cartes de
  partage inter-classes.
- Règle d'encodage : la présence de U+FFFD dans un fichier est une corruption ;
  tout outil qui lit le corpus doit échouer bruyamment dessus.

## Pseudo-code

### Skill `pf-enrichment-conventions`

```
SKILL.md décrit, en français :
  - arbre de sortie : data/enrichissements/<id>.json, même id, même slug
  - règle d'or : data/sorts/ n'est jamais écrit par cette track
  - vocabulaire des clés d'enrichissement (liste gelée, renvoi vers schemas/)
  - politique des nulls : null = « absent du source », [] = « vérifié, aucun »
  - champ preuves : sous-chaîne EXACTE du texte source, jamais reformulée
  - verifie_par_humain : true verrouille l'enregistrement ; le générateur
    refuse d'écrire sans --force ; le validateur, lui, continue de le contrôler
  - champs de provenance obligatoires : version_prompt, version_taxonomie,
    modele, genere_le, hash_source
  - hash_source = sha256 du texte source canonique assemblé à l'étage 08
  - emplacement des vocabulaires clos : conventions/vocabulaires/*.json
  - où vit taxonomie_v1 (rempli à l'étape 04, pas ici)
```

### Skill `pf-bedrock-batch`

```
SKILL.md décrit, en français :
  - format d'un enregistrement JSONL Bedrock batch :
      {"recordId": <=64 chars, "modelInput": {anthropic_version, max_tokens,
        system, messages}}
  - modelId retenu : anthropic.claude-haiku-4-5-20251001-v1:0
    profil d'inférence géo EU : eu.anthropic.claude-haiku-4-5-20251001-v1:0
  - CONTRAINTE DURE : un job batch a un nombre MINIMUM d'enregistrements
    (quota de compte, historiquement 100, relevé à 1 000 sur certains comptes).
    Vérifier le quota réel avant d'écrire le driver. Conséquence de conception :
    un run --limit 50 NE PEUT PAS passer par batch → chemin on-demand obligatoire
  - cycle de vie du job : Submitted → Validating → Scheduled → InProgress →
    Completed / Failed / Stopped ; pas de SLA, compter jusqu'à 24 h
  - entrée et sortie transitent par S3 en JSONL ; la sortie contient un
    enregistrement par recordId, avec les erreurs par enregistrement
  - tarif batch ≈ 50 % du tarif à la demande
  - politique de reprise : un recordId absent ou en erreur est rejoué dans un
    job de suivi, jamais par relance du job entier
  - jamais de secret dans le dépôt ; région et bucket en variables d'env
```

### Outil `tools/preflight_corpus.py`

```
FONCTION preflight(racine_depot) -> Rapport
  vérifier l'existence de : src/pf_spells/, data/sorts/, data/index/,
      data/classes.json, schemas/, tests/
  compter les fichiers de data/sorts/ ; avertir si hors de [1900, 2300]
  charger 20 fichiers au hasard ; vérifier : 21 clés, toutes présentes,
      aucun U+FFFD, décodage UTF-8 strict
  résoudre le Skill pf-corpus-conventions ; échouer s'il est introuvable
  émettre un rapport JSON sur stdout et un code de sortie non nul si KO
```

### Fixture `tests/fixtures/mini_corpus/`

```
12 fichiers de sorts figés, copiés du vrai corpus puis gelés, choisis pour
couvrir : niveau 0 et niveau 9, une école de chaque extrémité, un sort à dégâts,
un sort sans dégâts, un sort de zone, un sort personnel, un sort long
(tableau d'invocation), un sort avec un désaccord liste/page connu,
un sort dont le nom contient une apostrophe, un accent, un trait d'union.
Plus data/index/ et classes.json réduits, cohérents avec ces 12 sorts.
```

### Outil `tools/estimate_cost.py`

```
FONCTION estimer(chemin_prompts, tarif_entree, tarif_sortie, max_tokens)
  compter les tokens d'entrée approximativement (chars/3.6 pour le français)
  coût = n * (tokens_in * tarif_in + max_tokens * tarif_out) * remise_batch
  afficher : nb d'enregistrements, tokens estimés, coût haut et bas
```

## Logic Flow

1. Lancer `preflight_corpus.py` sur le dépôt réel. Si le rapport diverge de la
   structure supposée dans `00_CONTEXT.md`, **arrêter** et remonter l'écart : le
   reste du plan suppose ces chemins.
2. Écrire les deux Skills. Vérifier le quota Bedrock réel du compte
   (minimum d'enregistrements par job) et l'inscrire dans `pf-bedrock-batch`.
3. Construire la fixture ; s'assurer qu'elle passe le validateur Phase 1.
4. Écrire `estimate_cost.py` avec un test sur une entrée jouet.

## Implementation Notes

- Les Skills sont de la documentation, pas du code : pas de logique dedans.
- Le préflight est en lecture seule. Il n'écrit rien dans `data/`.
- La fixture est copiée puis **gelée** : un test qui casse parce que le vrai
  corpus a bougé est un mauvais test. Documenter qu'elle ne se régénère pas.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.
- Le quota batch est la seule information externe que ce plan ne peut pas
  garantir : la relever pour de vrai, ne pas la supposer.

## Verification Criteria

- `python tools/preflight_corpus.py` sort en 0 sur le dépôt réel et produit un
  rapport listant le nombre de sorts trouvés.
- Les deux Skills sont découvrables par le même mécanisme que
  `pf-corpus-conventions` et sont nommés à l'identique dans ce fichier.
- `pf-bedrock-batch` contient la valeur **relevée** du minimum d'enregistrements
  par job, pas une valeur recopiée de ce plan.
- `tests/fixtures/mini_corpus/` contient 12 sorts, passe le validateur Phase 1,
  et aucun fichier ne contient U+FFFD.
- `pytest tests/ -k "preflight or fixture or estimate"` passe hors ligne.

## Git Handling

- Branche : `feat/enrichissement-llm/01-skills-outils`, depuis
  `feat/enrichissement-llm`.
- Commits : un par livrable (`skills`, `tools`, `fixture`).
- Messages suggérés :
  - `feat(skills): ajouter pf-enrichment-conventions et pf-bedrock-batch`
  - `feat(tools): ajouter le préflight du corpus et l'estimateur de coût`
  - `test(fixture): geler un mini-corpus de 12 sorts`
- Fusion `--no-ff` dans `feat/enrichissement-llm` avant le lancement de la V2.

## Expected Outcome

Deux Skills publiés, un préflight qui confirme (ou infirme) les hypothèses de
structure du plan, une fixture hors ligne sur laquelle toutes les étapes
suivantes peuvent tester sans réseau ni corpus complet.
