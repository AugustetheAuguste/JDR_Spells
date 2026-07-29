# 02 — Contrat : schéma et vocabulaires de l'enrichissement

## Objectives

Geler l'ensemble **clos** des champs produits par le LLM, sous forme d'un JSON
Schema et de fichiers de vocabulaire séparés. Ce contrat est ce que les étapes
05 (assemblage des prompts), 07 (validation) et 08 (vue jointe) consomment ;
aucune d'elles ne redéfinit un champ localement.

## Dependencies & Parallelization

- **Vague 2.** Dépend de : `01_SKILLS_AND_TOOLS` (Skill
  `pf-enrichment-conventions`, fixture `tests/fixtures/mini_corpus/`).
- Aucune dépendance sur `03_ECHANTILLON_STRATIFIE`, qui tourne en parallèle.
- Le **contenu** des vocabulaires clos est provisoire ici (v0) et sera remplacé
  par l'étape 04. La **forme** du schéma, elle, est définitive : c'est
  pourquoi les listes vivent dans des fichiers séparés référencés par `$ref`,
  et pas en dur dans le schéma.

## Inherited Context from Dependencies

De `01_SKILLS_AND_TOOLS` :
- Skill `pf-enrichment-conventions` : politique des nulls (`null` = absent du
  source, `[]` = vérifié et vide), règle du champ `preuves` (sous-chaîne exacte),
  sémantique de `verifie_par_humain`, liste des champs de provenance.
- Fixture `tests/fixtures/mini_corpus/` : 12 sorts figés, 21 clés chacun.
- Skill existant `pf-corpus-conventions` : algorithme de slug, snake_case
  français, encodage UTF-8 strict, U+FFFD interdit.

Chemins imposés :
- schéma : `schemas/enrichissement.schema.json`
- vocabulaires : `conventions/vocabulaires/{categories,tags,roles_tactiques,
  cibles,types_degats,conditions}.json`
- données futures : `data/enrichissements/<id>.json`

## Pseudo-code

```
SCHEMA enrichissement (objet, additionalProperties = false, tous requis) :

  id                  string, doit exister dans data/index/
  slug                string, dérivé par l'algorithme de pf-corpus-conventions
  resume_court        string, 1 phrase, longueur <= 160
  categorie_principale enum <- vocabulaires/categories.json   (valeur unique)
  tags                array[enum <- vocabulaires/tags.json], 2..6, uniques
  roles_tactiques     array[enum: combat|exploration|social|utilitaire], 1..3
  cible_typique       enum: soi|allie|ennemi|zone|objet
  type_degats         enum <- vocabulaires/types_degats.json  OU null
  condition_infligee  array[enum <- vocabulaires/conditions.json], 0..4
  preuves             objet {
                        type_degats:       string OU null,
                        condition_infligee: array[string],
                        cible_typique:     string
                      }
  notes_ambiguite     string OU null
  verifie_par_humain  boolean, défaut false
  version_prompt      string, ex "p1.0"
  version_taxonomie   string, ex "taxonomie_v1"
  modele              string, identifiant complet du modèle
  genere_le           string, date-time ISO 8601 UTC
  hash_source         string, sha256 hex du texte source canonique

VOCABULAIRE categories.json  (v0 provisoire, ~12 entrées, remplacé en 04) :
  attaque_directe, controle_de_zone, entrave, protection, amelioration,
  affaiblissement, soin, divination, deplacement, invocation, illusion,
  utilitaire

VOCABULAIRE types_degats.json (v0) :
  feu, froid, acide, electricite, son, force, negatif, positif, perforant,
  tranchant, contondant, precision, autre

FORMAT d'un fichier de vocabulaire :
  { "version": "v0", "valeurs": [
      {"cle": "...", "definition_fr": "...", "exemples_positifs": ["...","..."],
       "exemples_negatifs": ["...","..."]} ] }
```

## Logic Flow

1. Écrire les six fichiers de vocabulaire en v0, avec définition et exemples
   pour chaque entrée. Les exemples viennent de la fixture, pas de mémoire.
2. Écrire `schemas/enrichissement.schema.json`, en `$ref` vers les vocabulaires
   (ou en génération d'un schéma résolu à la volée si le validateur du dépôt ne
   suit pas les `$ref` externes — choisir ce que fait déjà la Phase 1).
3. Écrire trois enregistrements d'exemple valides et cinq invalides (un par mode
   d'échec : tag inconnu, resume trop long, preuve absente, clé en trop,
   `type_degats` non nul sans preuve) sous `tests/fixtures/enrichissements/`.
4. Écrire les tests qui affirment que les valides passent et que chaque invalide
   échoue **pour la bonne raison**, pas juste « échoue ».

## Implementation Notes

- `additionalProperties: false` est indispensable : c'est ce qui empêche le
  modèle d'ajouter un champ que personne n'a demandé.
- `preuves` n'est pas décoratif : c'est le mécanisme anti-confabulation de A5.
  Le schéma exige sa présence ; l'étape 07 vérifie que les sous-chaînes existent
  réellement dans le source. Les deux moitiés sont nécessaires.
- Distinguer `type_degats: null` (le sort ne fait pas de dégâts) de
  `notes_ambiguite` (le modèle n'a pas su trancher). Ce ne sont pas les mêmes
  informations et les confondre pollue les statistiques de l'étape 04.
- Ne rien ajouter au schéma existant `schemas/sort.schema.json`.
- Ne pas peupler de fichier `__init__` ni déclarer `__all__`.

## Verification Criteria

- `schemas/enrichissement.schema.json` est un JSON Schema valide (draft aligné
  sur celui déjà utilisé dans `schemas/`).
- Les six fichiers de vocabulaire existent, chacun avec `version`, et chaque
  entrée porte définition + 2 exemples positifs + 2 négatifs.
- `pytest tests/ -k enrichissement_schema` passe hors ligne : 3 valides
  acceptés, 5 invalides rejetés avec le message d'erreur attendu.
- Un grep confirme qu'aucune liste de valeurs closes n'est dupliquée en dur
  ailleurs que dans `conventions/vocabulaires/`.
- Le Skill `pf-enrichment-conventions` est cité dans l'en-tête du schéma comme
  source de la politique des nulls.

## Git Handling

- Branche : `feat/enrichissement-llm/02-schema`, depuis `feat/enrichissement-llm`
  (après fusion de la Vague 1).
- Commits :
  - `feat(schema): geler le contrat d'enrichissement JSON Schema`
  - `feat(schema): ajouter les vocabulaires clos v0`
  - `test(schema): couvrir les cas valides et les cinq modes d'échec`
- Fusion `--no-ff` en fin de Vague 2.

## Expected Outcome

Un contrat gelé et testé. À partir de là, l'étape 05 sait exactement quoi
demander au modèle, l'étape 07 sait exactement quoi refuser, et l'étape 08 sait
exactement quoi joindre — sans qu'aucune des trois n'ait à se coordonner avec
les autres.
