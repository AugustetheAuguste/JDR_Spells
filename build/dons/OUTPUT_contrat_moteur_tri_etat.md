# Contrat du moteur (Wave 06) — sémantique du tri-état par `RequirementType`

Ce document accompagne `data/schemas/moteur_dons.schema.json` (clé
`semantique_none`) et `scripts/check_moteur_contract_dons.ts`. Il existe pour
qu'un futur évaluateur TypeScript (étape 09) ne retraite jamais un `None`
comme un `False` — l'erreur que `src/pf_dons/engine.py` évite déjà
systématiquement, et que ce contrat de données doit continuer d'exprimer une
fois porté hors de Python.

## Principe

**Une sous-attribution (`False` à tort → `ineligible`) est bien plus grave
qu'une sur-attribution (`None` à tort → `manual_check`).** Un don caché à
tort par un `ineligible` faux n'a aucun recours dans l'interface : le joueur
ne sait même pas qu'il aurait dû le voir. Un `manual_check` en trop n'est
qu'un clic de vérification supplémentaire.

## Les 13 `RequirementType`, ce que signifie `None` pour chacun

| type | `None` signifie... |
|---|---|
| `ability_score` | aucun score de caractéristique fourni pour le personnage — indéterminable, jamais faux |
| `bba` | toujours dérivable dès que classe+niveau sont connus — `None` n'arrive jamais en pratique |
| `level` | le niveau est toujours connu par construction — `None` n'arrive jamais en pratique |
| `level_exact` | idem `level` |
| `class_level` | niveau toujours connu, seule la classe est testée — déterministe, jamais `None` |
| `skill_ranks` | rangs non fournis pour cette compétence précise — indéterminable (NB : l'hypothèse optimiste "rangs = niveau" du moteur Python masque ce cas tant que `skill_ranks` n'est pas explicite) |
| `caster_level` | la VALEUR numérique du NLS n'est jamais dérivable — `None`, sauf le cas particulier ci-dessous |
| `size` | taille non fournie et race absente/inconnue — indéterminable |
| `feat` | liste des dons déjà connus non fournie — indéterminable |
| `race` | race non fournie — indéterminable |
| `class` | la classe est une donnée obligatoire — déterministe, jamais `None` |
| `class_feature_text` | détail de capacité de classe non automatisable — `None`, sauf échappatoires `implied_classes`/`gating` |
| `unparsed` | segment non reconnu par le parseur — `None`, mêmes échappatoires |

## Le cas `caster_level` : quand `None` devient `False`

`caster_level` ne résout à `False` que si **les deux conditions suivantes
sont réunies** :
1. la classe est **connue** de `lanceurs` (`class_caster_info.json`) **et**
   explicitement marquée non-lanceuse (`is_caster: false`) ;
2. la race ne donne pas accès à la magie (aucun des `magie_raciale_mots_cles`
   dans ses traits raciaux — `magie_innee: false` dans `races`, ou race
   absente/inconnue).

Une classe **absente** de `lanceurs` reste `None` — jamais devinée à
`False`. C'est le même garde-fou que `_proficiency_verdict` applique aux
maîtrises d'armes/boucliers : absence de donnée ≠ absence de capacité.

## `couvre_tout_le_segment`

Un hit de `gating` dont `couvre_tout_le_segment=true` **et** dont le verdict
est satisfait (`True`) rend l'exigence entière `True`, au lieu de retomber en
`manual_check` — mais seulement si ce hit est aussi `blocking=true`. C'est
une règle facile à perdre à la traduction : sans elle, un don entièrement
gated par un seul trait racial déjà vérifié resterait signalé "à vérifier"
alors que la vérification a déjà eu lieu.

## `proficiency` : bloquant vs non bloquant

Le champ qui porte la distinction est le `blocking` réel de
`gating.entries[]` (`data/conditions/prereq_gating.json`), pas une règle
inventée pour ce contrat : 18 des 31 entrées `proficiency` nomment une arme
ou un bouclier précis et valent `blocking: true` ; les 13 autres dépendent
d'un choix du joueur non tracé par `Character` et valent `blocking: false`,
donc restent en `manual_check` par construction.

## `chasseur de vampire`

Absente de `maitrises` (`class_proficiencies.json`) *et* présente dans
`lanceurs` (`class_caster_info.json`) : aucune classe officielle Pathfinder
1e de ce nom n'existe pour les maîtrises d'armes, mais elle a bien une entrée
côté incantation. Le contrat doit préserver cette absence — la traiter comme
"présente avec listes vides" transformerait un `manual_check` légitime en
`ineligible` faux.
