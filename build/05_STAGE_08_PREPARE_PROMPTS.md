# 05 — Étage 08 : assemblage des prompts (hors ligne)

## Objectives

Construire `src/pf_spells/prepare_prompts.py` : l'étage qui transforme chaque
sort en un prompt complet, prêt à envoyer, écrit sur disque. Aucun accès réseau.
Séparer l'assemblage de l'envoi est ce qui rend le run rejouable, diffable et
testable hors ligne (A10).

## Dependencies & Parallelization

- **Vague 4.** Dépend de : `02_SCHEMA_ENRICHISSEMENT` (la forme de sortie
  demandée au modèle) et `04_TAXONOMIE_PASSE0` (la taxonomie embarquée dans le
  prompt).
- Tourne en parallèle de `07_STAGE_10_VALIDATE`, qui consomme les mêmes contrats
  sans passer par ce module.
- Bloque `06_STAGE_09_ENRICH_LLM`.

## Inherited Context from Dependencies

De `02_SCHEMA_ENRICHISSEMENT` — champs exigés en sortie du modèle
(`additionalProperties: false`, tous requis) :
`id, slug, resume_court (<=160 car.), categorie_principale (enum),
tags[2..6], roles_tactiques[1..3] parmi combat|exploration|social|utilitaire,
cible_typique parmi soi|allie|ennemi|zone|objet, type_degats (enum|null),
condition_infligee[0..4], preuves{type_degats, condition_infligee[],
cible_typique}, notes_ambiguite (string|null)`.
Les champs de provenance (`verifie_par_humain, version_prompt,
version_taxonomie, modele, genere_le, hash_source`) ne sont **pas** demandés au
modèle : ils sont ajoutés par l'étage 09.

De `04_TAXONOMIE_PASSE0` :
- `conventions/vocabulaires/tags.json` en `version: "v1"`, 25–40 entrées avec
  `cle`, `definition_fr`, `exemples_positifs`, `exemples_negatifs`.
- Idem pour `categories.json`, `types_degats.json`, `conditions.json`.

De `01_SKILLS_AND_TOOLS` : `tools/preflight_corpus.py`,
`tests/fixtures/mini_corpus/`, `tools/estimate_cost.py`,
Skill `pf-enrichment-conventions`.

## Pseudo-code

```
FONCTION texte_source_canonique(sort) -> str
  # une seule définition, partagée avec l'étage 10 pour la vérification
  # des preuves : la même fonction doit produire la même chaîne
  concaténer, dans cet ordre fixe, avec un séparateur stable :
     nom, ecole, niveaux_par_classe, temps_incantation, composantes,
     portee, cible, duree, jet_de_sauvegarde, resistance_a_la_magie,
     description
  normaliser les fins de ligne, ne PAS retirer la ponctuation ni les accents
  RETOURNER la chaîne

FONCTION assembler(id):
  sort   <- data/sorts/<id>.json
  source <- texte_source_canonique(sort)
  hash   <- sha256(source)

  systeme <- gabarit_systeme.render(
      champs = schéma résumé,
      taxonomie = tags v1 avec définitions et exemples,
      categories = categories v1,
      regles = [
        "Ta SEULE source est le texte fourni.",
        "Toute affirmation non soutenue par ce texte est OMISE, jamais devinée.",
        "N'utilise aucune connaissance externe de Pathfinder ni du SRD anglais.",
        "Pour type_degats, condition_infligee et cible_typique, recopie dans
         preuves la sous-chaîne EXACTE du texte qui justifie la valeur.",
        "Si aucun tag de la liste ne convient, remplis notes_ambiguite.",
        "Réponds UNIQUEMENT par un objet JSON, sans texte autour."
      ])
  utilisateur <- source

  ÉCRIRE build_artifacts/prompts/<version_prompt>/<id>.json :
     {id, slug, hash_source, version_prompt, version_taxonomie,
      systeme, utilisateur, max_tokens}

FONCTION principale(--limit, --only, --version-prompt, --force):
  ids <- data/index/ filtré
  POUR chaque id : SI le prompt existe avec le même hash_source ET pas --force
                      -> sauter (reprise)
                   SINON assembler
  ÉCRIRE build_artifacts/prompts/<version>/_manifeste.json :
     {version_prompt, version_taxonomie, n, hashs: {id: hash_source},
      construit_le}
```

## Logic Flow

1. Préflight, puis chargement des vocabulaires v1. Échouer si `tags.json` est
   encore en `version: "v0"` — c'est le signe que l'étape 04 n'est pas fusionnée.
2. Assembler tous les prompts, un fichier par sort, écriture immédiate.
3. Écrire le manifeste avec la table des hashs — c'est lui qui donne la
   résumabilité à l'étage 09 et la détection de dérive à l'étage 10.
4. Lancer `tools/estimate_cost.py` sur le répertoire produit et afficher
   l'estimation avant de rendre la main.

## Implementation Notes

- `texte_source_canonique` est **la** fonction critique de la track : elle est
  importée telle quelle par l'étage 10 pour vérifier les preuves. Si les deux
  étages assemblent le texte différemment, toutes les preuves échouent. La
  définir une fois, dans un module partagé, et la couvrir par un test de
  stabilité (hash figé sur les 12 sorts de la fixture).
- `version_prompt` est dans le chemin, pas seulement dans le contenu : on veut
  pouvoir garder côte à côte `p1.0` et `p1.1` et les diffusionner. A8 prévoit
  5 à 10 re-runs de réglage ; cette arborescence est ce qui les rend supportables.
- Ne pas inclure le nom anglais du sort, même s'il est connu : c'est exactement
  le crochet qui ferait remonter le SRD anglais mémorisé (A5).
- Prompt système identique pour tous les sorts → il est le candidat naturel au
  cache de prompt si le chemin on-demand est utilisé. Ne pas y injecter de
  contenu spécifique au sort.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- `python -m pf_spells.prepare_prompts --limit 12` sur `mini_corpus` produit 12
  fichiers de prompt et un manifeste, **sans aucun accès réseau** (vérifié en
  coupant le réseau ou par un test qui interdit les sockets).
- Le test de stabilité de `texte_source_canonique` passe : hash figé inchangé.
- Chaque prompt contient la liste complète des tags v1 avec définitions, et la
  consigne « ta SEULE source est le texte fourni ».
- Aucun prompt ne contient de nom anglais de sort (test par grep sur une liste
  d'appâts connus).
- Relance sans `--force` : 0 fichier réécrit. Avec `--force` : 12 réécrits.
- Aucun U+FFFD dans les prompts produits.

## Git Handling

- Branche : `feat/enrichissement-llm/05-prepare-prompts`.
- Commits :
  - `feat(enrich): ajouter texte_source_canonique et sa garde de stabilité`
  - `feat(enrich): ajouter l'étage 08 d'assemblage des prompts`
  - `test(enrich): couvrir la reprise et l'absence de réseau`
- Les prompts assemblés sur le corpus complet sont committés à l'exécution
  (Vague 6) ; ici on committe le module, ses tests et les prompts de fixture.
- Fusion `--no-ff` en fin de Vague 4.

## Expected Outcome

Un étage hors ligne, idempotent, qui matérialise sur disque exactement ce qui
sera envoyé au modèle — auditable avant dépense, rejouable après.
