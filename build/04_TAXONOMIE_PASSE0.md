# 04 — Passe 0 : construction et gel de la taxonomie de tags

## Objectives

Passer d'une proposition libre de tags par le modèle sur ~200 sorts à une liste
close de 25 à 40 tags, curée à la main, avec définition et exemples. Geler le
résultat comme `taxonomie_v1` et remplacer les vocabulaires v0 de l'étape 02.

C'est la seule étape du plan qui touche le réseau en dehors de `09_enrich_llm`,
et pour un volume marginal (~200 appels).

## Dependencies & Parallelization

- **Vague 3.** Dépend de : `03_ECHANTILLON_STRATIFIE` (l'artefact
  d'échantillon) et de `01_SKILLS_AND_TOOLS` (Skills, préflight).
- Ne dépend **pas** de `02_SCHEMA_ENRICHISSEMENT` pour s'exécuter : elle écrit
  dans `conventions/vocabulaires/`, dont la forme est fixée par 02 et connue de
  ce fichier. En cas de lancement strictement parallèle avec 02, respecter le
  format de vocabulaire inline ci-dessous.
- Tourne en parallèle de `08_VUE_SORTS_ENRICHIS`.
- Bloque `05_STAGE_08_PREPARE_PROMPTS` et `07_STAGE_10_VALIDATE`.

## Inherited Context from Dependencies

De `03_ECHANTILLON_STRATIFIE` :
- `build_artifacts/echantillon_taxo.json` :
  `{graine, taille, construit_le, strates: {"<ecole>:<niveau>": [ids…]}, couverture}`.
  Les ids référencent `data/sorts/<id>.json`.

De `01_SKILLS_AND_TOOLS` :
- Skill `pf-bedrock-batch` : modèle
  `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, minimum d'enregistrements par
  job batch (relevé, à respecter — 200 records peut être sous le minimum du
  compte, auquel cas cette passe utilise le chemin **on-demand**).
- Skill `pf-enrichment-conventions` : format des vocabulaires.

Format d'un fichier de vocabulaire (contrat de l'étape 02) :
```
{ "version": "v1", "valeurs": [
   {"cle": "controle_de_zone", "definition_fr": "…",
    "exemples_positifs": ["mur de feu", "toile d'araignée"],
    "exemples_negatifs": ["projectile magique", "détection de la magie"]} ] }
```

## Pseudo-code

```
ÉTAPE 1 — proposition libre
  POUR chaque id de l'échantillon :
     texte <- texte source canonique du sort (description + bloc technique)
     prompt <- "Propose 3 à 7 étiquettes courtes en français décrivant ce que
                fait ce sort en jeu. Uniquement du snake_case. Aucune
                explication. Une étiquette par ligne."
     appeler le modèle, écrire build_artifacts/taxo_passe0/<id>.json
  (résumable : sauter les fichiers déjà présents)

ÉTAPE 2 — agrégation
  compter les occurrences de chaque étiquette brute
  normaliser : minuscules, accents pliés pour le regroupement seulement,
               singulier/pluriel rapprochés
  regrouper les quasi-doublons par similarité de chaîne + co-occurrence
  ÉCRIRE build_artifacts/taxo_passe0_agrege.csv
     colonnes : etiquette_brute, occurrences, groupe_propose, exemples_ids

ÉTAPE 3 — curation HUMAINE
  un humain lit le CSV et produit la liste close
  cible : 25 à 40 tags, chacun avec définition + 2 exemples + 2 contre-exemples
  règle de coupe : un tag retenu doit s'appliquer à >= 10 sorts de l'échantillon
                   ET être distinguable des autres par sa définition seule

ÉTAPE 4 — gel
  ÉCRIRE conventions/vocabulaires/tags.json en version "v1"
  RELIRE conventions/vocabulaires/categories.json : la passe 0 révèle souvent
     que la liste v0 de catégories est mal découpée → l'amender ici, en v1
  AJOUTER au Skill pf-enrichment-conventions une section taxonomie_v1 :
     la liste, la date de gel, la règle des 5 % de notes_ambiguite
```

## Logic Flow

1. Garde d'entrée : l'échantillon existe et son hash correspond à celui committé.
2. Passe 0 en appels unitaires, un fichier par sort, reprise par présence.
3. Agrégation en CSV — **sortie lisible par un humain**, c'est le livrable réel
   de l'automatisation ici.
4. Curation manuelle. Ne pas automatiser cette étape : le point de A3 est
   précisément qu'un humain tranche.
5. Gel dans `tags.json` v1 + section de Skill. Bump `version_taxonomie` partout.

## Implementation Notes

- La passe 0 est volontairement **non contrainte**. Lui donner déjà une liste
  reviendrait à mesurer sa capacité à obéir, pas à découvrir le vocabulaire réel
  du corpus.
- Le seuil des 5 % de `notes_ambiguite` (A3) est un critère de la passe 1, pas
  de celle-ci — mais la règle doit être écrite dans le Skill dès maintenant, avec
  la conséquence : au-delà, on coupe une `taxonomie_v2`, on ne laisse pas le
  modèle improviser.
- Écrire dans le CSV les ids d'exemples, pas seulement les compteurs : le
  curateur a besoin d'aller voir les sorts concernés.
- ~200 appels Haiku sur des textes courts : quelques dizaines de centimes.
  Aucune raison d'optimiser, beaucoup de raisons de rendre la reprise triviale.
- Aucune écriture dans `data/`.

## Verification Criteria

- `build_artifacts/taxo_passe0/` contient un fichier par id de l'échantillon.
- `build_artifacts/taxo_passe0_agrege.csv` existe et est trié par occurrences.
- `conventions/vocabulaires/tags.json` est en `version: "v1"`, contient entre 25
  et 40 entrées, chacune avec définition + 2 exemples positifs + 2 négatifs.
- Chaque tag retenu est justifié par >= 10 sorts de l'échantillon ; un test
  vérifie cette couverture contre le CSV agrégé.
- Le Skill `pf-enrichment-conventions` contient une section `taxonomie_v1` avec
  la date de gel et la règle des 5 %.
- Les fichiers de vocabulaire restent valides au regard du contrat de l'étape 02
  (`pytest -k enrichissement_schema` passe toujours).

## Git Handling

- Branche : `feat/enrichissement-llm/04-taxonomie`.
- Commits :
  - `feat(taxo): exécuter la passe 0 de proposition libre sur l'échantillon`
  - `feat(taxo): agréger et regrouper les étiquettes brutes`
  - `feat(taxo): geler taxonomie_v1 et amender les catégories`
  - `docs(skills): documenter taxonomie_v1 dans pf-enrichment-conventions`
- Les sorties brutes de la passe 0 sont committées : elles justifient la
  curation et permettent de rejouer le regroupement autrement.
- Fusion `--no-ff` en fin de Vague 3.

## Expected Outcome

Une taxonomie close, définie, exemplifiée et gelée, dérivée du corpus réel
plutôt que de l'intuition — et une trace committée de la façon dont elle a été
obtenue.
