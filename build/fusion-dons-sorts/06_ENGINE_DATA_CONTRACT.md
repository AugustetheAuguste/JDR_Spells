# 06 — ENGINE DATA CONTRACT : figer ce que le moteur TS reçoit

**Vague 2.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/06-engine-data-contract`.

## Objectives

Figer le contrat des **données d'éligibilité** — les conditions analysées, les
tables de gating, le graphe de prérequis — et livrer leurs fixtures.

C'est ce contrat qui permet d'écrire l'évaluateur TypeScript (09) **sans attendre
l'exporteur Python (08)**, et c'est lui qui matérialise la décision centrale du
plan : **le parseur reste en Python et sa regex n'est jamais portée.**

## Dependencies & Parallelization

- **Vague 2.** Dépend de :
  - **04_MERGE_REPO** — pour lire `src/pf_dons/models.py` (la forme réelle de
    `Requirement` / `OrGroup` / `ParsedConditions`) et les cinq tables de gating.
  - **03_CLASS_REGISTRY** — les slugs de classe référencés par le gating.
- Parallèle à **05** (index web) et **07** (intégration du registre) : fichiers
  disjoints.
- Aucune dépendance sur 01 ni 02.

## Inherited Context from Dependencies

### Le fait qui justifie cette étape

`src/pf_dons/parser.py` (337 lignes) est une **fonction pure du CSV et des
suppléments** : il ne voit jamais le personnage. Le
personnage n'entre que dans `engine.py`, dont `grep` de `re\.` sur 621 lignes ne
renvoie **qu'un seul résultat** (`_DEITY_PREFIX_RE`, un retrait de préfixe).

Donc : on précalcule la sortie du parseur, on ne porte que l'évaluateur.

### Depuis 04 — la forme réelle à sérialiser (`src/pf_dons/models.py`)

```
RequirementType = ability_score | bba | level | level_exact | class_level
                | skill_ranks | caster_level | size | feat | race | class
                | class_feature_text | unparsed
Requirement       : type, payload, needs_manual_check, (texte brut du segment)
OrGroup           : options: [Requirement]
ParsedConditions  : liste de (Requirement | OrGroup)
```

`payload` porte, selon les cas : la valeur numérique, le nom de don/race/classe,
et pour les segments inclassables les enrichissements de `_enrich_payload` :

- `payload["implied_classes"]` — liste triée de classes normalisées. Si la classe
  du personnage n'y est pas → **`False`** (et non `None`). Si elle y est → `None`,
  le détail interne restant non vérifié.
- `payload["gating"]` — liste de *hits*, chacun `{keyword, kind, param, blocking,
  couvre_tout_le_segment}`.
- `payload["fragment"] = True` — artefact de découpage (« familier », « monture »,
  « plus »). Écarté des `OrGroup`, **sauf si toutes** les options sont des
  fragments.
- Cas **négatif** : un segment commençant par `aucun niveau dans` produit un
  unique hit `{"kind": "no_class_levels", "param": [classes exclues]}` et
  **jamais** `implied_classes` — sinon la règle est inversée.

### Les 9 genres bloquants et les 6 non bloquants

Bloquants : `racial_trait`, `creature_type`, `anatomy`, `spellcasting`, `deity`,
`alignment`, `mythic`, `class_ability`, `no_class_levels`.
Non bloquants (restent `manual_check`) : `class_ability_unmapped`, `proficiency`,
`feat`, `background`, `fragment`, `generic`.

**Sur les 31 entrées `proficiency` : 18 nomment une arme ou un bouclier précis et
sont bloquantes ; 13 dépendent d'un choix du joueur et restent non bloquantes par
décision, pas par lacune.** Le contrat doit distinguer les deux, sinon 09 ne peut
pas honorer la limite.

### Les tables à publier telles quelles

`data/conditions/prereq_gating.json` (341 entrées) ·
`data/classes/class_ability_map.json` · `data/classes/class_caster_info.json` ·
`data/classes/class_proficiencies.json` (42 classes) ·
`data/dons/feat_class_restriction.json` · `data/dons/feat_magic_info.json` ·
`data/dons/feat_creature_affinity.json` · `data/races/races.json` (pour
`racial_trait_text`).

Plus les deux tables **recopiées en dur dans `engine.py`**, à extraire vers des
données pour que 09 les lise au lieu de les redupliquer :
`RACE_WEAPON_PROFICIENCY` (l'elfe a l'arc long, le nain le marteau de guerre,
l'halfelin la fronde) et `RACE_WEAPON_RECLASSIFICATION` (le nain traite toute
arme « naine » comme arme de guerre au lieu d'exotique, **à condition** que la
classe ait les armes martiales). Sans la seconde, un Guerrier nain était refusé à
tort sur « Frappe de la vipère jaillissante ».

### Charge utile mesurée (pour dimensionner, pas pour arbitrer)

Tables de gating 34 kB gz + `races.json` 17 kB gz. Pas de budget de poids : le
dépôt les a retirés le 2026-08-26.

## Pseudo-code

```
# data/schemas/moteur_dons.schema.json  -> web/public/data/dons/moteur.json
{
  version, genere_le,
  # 1. conditions analysées, par don
  conditions: { <slug du don>: {
        brut: string,             # raw_conditions : le texte du CSV, ce qu'un audit cite
        effectif: string,         # effective_conditions : + feat_prereq_supplements
        exigences: [ Exigence | GroupeOu ]
  } },
  # 2. graphe, indépendant du personnage
  aretes: [ {de: <slug>, vers: <slug>} ],          # de = prérequis, vers = dépendant
  prerequis_dons: { <slug>: [[<nom>]] },           # liste d'alternatives (OU)
  # 3. tables de gating, verbatim
  gating: {...}, capacites_de_classe: {...}, lanceurs: {...},
  maitrises: {...}, magie_des_dons: {...}, affinite_creature: {...},
  restriction_de_classe: {...},
  # 4. race
  races: { <slug>: {taille, texte_traits, magie_innee: bool} },
  armes_raciales: {...}, reclassement_racial: {...},
  # 5. constantes
  progression_bba: { <classe>: "good"|"medium"|"poor" },
  genres_bloquants: [...9...], genres_non_bloquants: [...6...]
}

# Exigence
{ type: <RequirementType>, charge: {...}, verif_manuelle: bool, segment: string }
# GroupeOu
{ options: [Exigence] }

# fixtures
web/fixtures/moteur_dons.json   # restreint aux 24 dons de la fixture de l'étape 05
```

## Logic Flow

1. Lire `models.py`, `parser.py::_enrich_payload`, et `engine.py::_gating_verdict`
   pour relever la forme **réelle** des charges utiles — ne rien supposer.
2. Écrire le schéma, en documentant chaque `type` d'exigence par ce que
   l'évaluateur doit en faire (`True` / `False` / `None`).
3. Écrire la fixture à la main pour les mêmes 24 dons que l'étape 05, de façon que
   les deux fixtures se joignent par slug.
4. Écrire `scripts/check_moteur_contract_dons.ts` et le prouver sur fixtures
   cassées.

## Implementation Notes

- **Le tri-état est le cœur du contrat.** Documenter explicitement, pour chaque
  `RequirementType`, ce que signifie `None` : « indéterminable », pas « faux ».
  Un `None` traité comme faux produit un `ineligible` — la sous-attribution que
  tout le dépôt cherche à éviter.
- **`caster_level`** : `False` (et non `None`) quand la magie est inaccessible,
  mais ce helper est **volontairement conservateur** — vrai seulement si la classe
  est *connue et explicitement non-lanceuse* (donc jamais pour une classe absente
  de `class_caster_info.json`) **et** que la race n'accorde pas la magie. La
  valeur numérique du NLS reste non dérivable. Le contrat doit rendre cette
  nuance exprimable, pas la lisser.
- **Classe inconnue ≠ aucune maîtrise.** `chasseur de vampire` est absente de
  `class_proficiencies.json` exprès. Le contrat doit distinguer « absent » de
  « présent avec listes vides », sinon 09 renverra `ineligible` là où Python dit
  `manual_check`.
- **`_ANATOMY_SYNONYMS` en phrases longues** (« attaque de morsure ») : un
  synonyme court comme « langue » matchait le trait universel « Langues ». Publier
  la table telle quelle, sans « nettoyage ».
- `couvre_tout_le_segment` doit être publié : un hit qui couvre le segment entier
  **et** est satisfait rend l'exigence `True`, au lieu de retomber en
  `manual_check`. C'est une règle facile à perdre à la traduction.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `npx tsx scripts/check_moteur_contract_dons.ts web/fixtures/moteur_dons.json`
   → sortie 0.
2. Les **13** `RequirementType` sont tous représentés dans le schéma, chacun avec
   la sémantique de son `None` documentée. Un test compte 13 et échoue à 12.
3. Les **9** genres bloquants et les **6** non bloquants sont énumérés dans le
   schéma **et** dans la fixture, avec la séparation
   `proficiency` **bloquante (arme nommée)** vs **non bloquante (choix du
   joueur)** exprimable — un test crée un cas de chaque.
4. La fixture couvre : un `OrGroup` · un `payload.fragment` · un
   `implied_classes` · un `no_class_levels` · un hit
   `couvre_tout_le_segment: true` satisfait · une classe absente de
   `maitrises` (cas `chasseur de vampire`) · un don à `caster_level`.
5. `brut` ≠ `effectif` pour au moins un don de la fixture (un don augmenté par
   `feat_prereq_supplements.json`), et un test assert que les deux champs sont
   **tous deux présents** : les confondre est l'erreur que le contrat prévient.
6. Les slugs de `web/fixtures/moteur_dons.json` sont **exactement** ceux de
   `web/fixtures/index_dons.json` (jointure prouvée) — si l'étape 05 n'est pas
   encore fusionnée, l'assert est écrit et marqué `skip` avec un commentaire, puis
   activé à la fusion de la vague.
7. Aucune regex n'apparaît dans le schéma ni dans la fixture : le parseur reste en
   Python. `grep` de `\\\\` et de `(?:` dans les deux fichiers → zéro.
8. `npm --prefix web run typecheck`, `lint`, `web:test` verts.

## Git Handling

Branche `fusion/06-engine-data-contract` depuis `feat/fusion-dons`. Trois commits :

```
feat(dons): contrat des données du moteur — conditions analysées, gating, graphe
test(dons): fixture du moteur couvrant OU, fragment, classes implicites, négation
docs(dons): documenter la sémantique du tri-état, type d'exigence par type
```

Le corps du premier commit doit dire **pourquoi** le parseur reste en Python :
337 lignes de regex française jamais portées, contre 621 lignes d'évaluateur qui
n'en contiennent qu'une.

## Expected Outcome

L'évaluateur TypeScript (09) peut être écrit intégralement contre ce contrat et
cette fixture, en parallèle de l'exporteur (08) qui produira le même format. La
frontière est explicite : **Python analyse, TypeScript évalue.**
