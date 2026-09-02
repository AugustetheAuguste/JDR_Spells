---
name: pf-dons-conventions
description: Autorité humaine sur les cinq couches de gating curées à la main du moteur d'éligibilité pf_dons (class_ability_map, prereq_gating et ses BLOCKING_KINDS, class_caster_info, feat_class_restriction, class_proficiencies), le principe de sûreté qui les gouverne et les pièges concrets qu'elles corrigent — à charger avant de lire ou d'écrire quoi que ce soit sous Data/dons/, Data/classes/, Data/conditions/ ou dans le moteur d'éligibilité (parser.py/engine.py/models.py) du dépôt Dons.

---

# pf-dons-conventions

## Quand charger ce Skill

Charger ce Skill dans **toute** étape qui lit, écrit, fusionne ou porte vers
`JDR_Spells` une donnée issue du dépôt `pf1_dons` (« Dons ») : import d'un
fichier `Data/**/*.json`, adaptation du parser ou du moteur, écriture d'une
facette dérivée d'une couche de gating, audit d'éligibilité, ou toute décision
sur ce qu'un don « exige » par opposition à ce qu'il « donne ».

Ce Skill est la référence **humaine**. L'autorité **machine** reste dans les
fichiers de données eux-mêmes (`Data/classes/class_ability_map.json`,
`Data/conditions/prereq_gating.json`, `Data/classes/class_caster_info.json`,
`Data/dons/feat_class_restriction.json`, `Data/classes/class_proficiencies.json`)
et dans le code qui les consomme (`pf1_dons/parser.py`, `pf1_dons/engine.py`).
**Si le code et ce Skill divergent, le Skill gagne et le code est corrigé.**
Pour les valeurs closes elles-mêmes (quelle classe a quelle maîtrise, quel
mot-clé implique quelle classe…), c'est l'inverse : le fichier de données fait
foi, ce Skill n'en recopie aucune valeur — seulement la règle qui les régit.

Ce fichier n'en recopie rien de ce que détient déjà un autre document du dépôt
Dons (`CLAUDE.md`, `build/*/OUTPUT_*.md`) : ce sont les sources primaires, ce
Skill en est la synthèse portable. En cas de doute sur un détail non repris
ici, y retourner plutôt que d'inventer une règle par analogie.

Côté `JDR_Spells`, l'absorption de cette documentation vit au §13 (« Le corpus
des dons »), §14 et §15 de `CLAUDE.md` (racine du dépôt) : ce Skill en est la
synthèse humaine, `CLAUDE.md` en est l'architecture actuelle fusionnée.

## Principe de sûreté

> **Une sous-attribution est bien plus grave qu'une sur-attribution.**

Sur-attribuer un don ne coûte qu'un `manual_check` : le joueur voit le don,
avec un doute affiché, et vérifie lui-même. Sous-attribuer produit un
`ineligible` **faux** : le don disparaît de la liste sans aucun recours, et
rien à l'écran ne signale qu'une décision automatique s'est trompée. Toute
règle ci-dessous qui semble « trop permissive » l'est **volontairement** dans
ce sens précis — resserrer une règle de gating doit toujours être justifié par
un cas concret vérifié, jamais par prudence générique.

## Les cinq couches de gating — toutes curées à la main

Aucune de ces cinq couches n'est dérivée automatiquement depuis le CSV brut ou
depuis une heuristique : chacune est une table de correspondance relue par un
humain, puis transcrite en JSON par un script de curation qui ne fait que
recopier, jamais réinterpréter.

### 1. `Data/classes/class_ability_map.json` — mot-clé → classe(s)

Associe un mot-clé de capacité de classe (français, normalisé) aux classes qui
la donnent. C'est ce qui permet à `parser.py::_find_implied_classes` d'attacher
`implied_classes` à un segment `CLASS_FEATURE_TEXT`/`UNPARSED`, et à
`engine.py` de refuser (`ineligible`, pas `manual_check`) un personnage dont la
classe n'y figure pas — par exemple un Guerrier pour « Abondance de
révélations » (réservé à l'Oracle).

**Négation à ne pas inverser.** Un segment qui commence par
« aucun niveau dans » doit produire `{"kind": "no_class_levels", "param": [...]}`
et **jamais** `implied_classes` : `class_ability_map.json` mappe
« aucun niveau dans une classe dotée de panache » vers `['bretteur']`, et lire
ce mot-clé comme un `implied_classes` classique aurait **inversé la règle** —
le moteur aurait *exigé* d'être bretteur au lieu de l'exclure. C'est
`_enrich_payload` (`parser.py`) qui porte cette distinction.

### 2. `Data/conditions/prereq_gating.json` — nature de 341 prérequis « no_single_class »

Là où la couche 1 répond « ce prérequis est-il réservé à certaines classes ? »,
celle-ci dit de **quelle nature** est chacune des entrées qui n'ont pas trouvé
de classe unique. Format : `{"entries": [{"keyword", "kind", "param",
"blocking", "source_raw_examples"}]}`.

**`BLOCKING_KINDS`** (bloquant — peut renvoyer `False`/`ineligible`) :
`racial_trait`, `creature_type`, `anatomy`, `spellcasting`, `deity`,
`alignment`, `mythic`, `class_ability`, `no_class_levels`.

**Non bloquants** (restent en `manual_check`, jamais un verdict tranché) :
`class_ability_unmapped`, `proficiency`, `feat`, `background`, `fragment`,
`generic`.

Sans cette couche, ces 341 prérequis — traits raciaux, types de créature,
anatomie, divinité, alignement… — retombaient tous en `manual_check` et
noyaient la liste de candidats sous du bruit non discriminant.

**`_ANATOMY_SYNONYMS` doit rester en phrases longues, jamais en mots isolés.**
« attaque de morsure » est sûr ; un synonyme court comme « langue » matchait le
trait universel « Langues » (que possède toute race) et produisait des faux
positifs massifs — exactement le genre de sur-généralisation que ce fichier
existe pour éviter.

### 3. `Data/classes/class_caster_info.json` — 43 classes, accès à la magie

Indique par classe si elle a accès à la magie (lanceur/non-lanceur), vérité
terrain vérifiée manuellement classe par classe, hybrides et occultes inclus.
**Le scalde y était à tort marqué non-lanceur** alors que sa progression
scrapée accorde des tours de magie dès le niveau 1 — corrigé après un audit
multi-classes qui a comparé le même don candidat à toutes les classes de base
et repéré l'incohérence qu'un audit mono-classe ne peut pas voir.

Un prérequis `CASTER_LEVEL` (« NLS n ») ne renvoie `False` que si
`magie_inaccessible(character)` est **positivement vérifié** : classe connue
et explicitement non-lanceuse **et** race qui n'accorde pas la magie. Une
classe absente de ce fichier n'est jamais traitée comme non-lanceuse — c'est
le principe de sûreté qui s'applique ici aussi.

### 4. `Data/dons/feat_class_restriction.json` — restriction visible seulement dans l'avantage

Pour les dons dont la restriction de classe n'apparaît **que dans le texte
d'avantage**, jamais dans les Conditions — cas d'école : « Ombre druidique »,
dont les Conditions (alignement + divinité) sont satisfiables par un roublard
alors que son avantage ajoute des sorts « à sa liste de druide ».

**Ce signal est très peu spécifique** (1 vrai positif pour 49 candidats) et
n'est donc **jamais appliqué automatiquement** : la table entière est curée à
la main. Les deux contre-motifs documentés qui rendent le signal trompeur :
le don qui *accorde* la capacité plutôt que d'en exiger l'accès préalable
(motif `GRANTING_PATTERNS`), et la classe citée comme simple référence de
calcul quand les Conditions sont purement numériques.

### 5. `Data/classes/class_proficiencies.json` — 42 classes, maniement d'armes/boucliers

Sur les 31 entrées `proficiency` de la couche 2 (toutes non bloquantes par
défaut), **18** nomment une arme ou un bouclier précis (« maniement du
cimeterre », « maniement de l'arc long »…) et sont devenues **bloquantes** :
un Guerrier a d'office toutes les armes courantes et de guerre, refuser de le
lui reconnaître aurait été une sous-attribution pure. Les **13** restantes
dépendent d'un choix du joueur que `Character` ne trace pas (« l'arme
choisie », « le bouclier utilisé », « l'arme du dieu »…) et restent
**volontairement non bloquantes** — **par décision, pas par lacune.** Les
résoudre en supposant que le joueur choisira toujours dans son champ de
compétence aurait été une inférence, pas une lecture directe ; ne pas franchir
cette limite en ajoutant une heuristique « raisonnable ».

`_proficiency_verdict` (`engine.py`) résout chaque entrée bloquante contre
`class_proficiencies.json` **et** contre la race, via deux tables recopiées des
traits « Armes familières » déjà scrapés dans `races.json`.

## Classe inconnue ≠ aucune maîtrise

**`chasseur de vampire` est absente de `class_proficiencies.json`** parce
qu'aucune classe officielle Pathfinder 1e de ce nom n'existe (vérifié
indépendamment). Le moteur la traite comme une classe **inconnue**
(`manual_check`), **jamais** comme « aucune maîtrise » (`ineligible`). Toute
classe absente d'une des cinq tables suit cette même règle : absence de donnée
≠ preuve d'absence de capacité.

## Pièges qui ont mordu — à ne pas reproduire

| Piège | Erreur produite | Garde-fou |
|---|---|---|
| Négation lue comme `implied_classes` | le moteur *exige* d'être bretteur au lieu de l'exclure | `"aucun niveau dans"` → `no_class_levels`, jamais `implied_classes` |
| Synonyme d'anatomie trop court (« langue ») | faux positif sur le trait universel « Langues » | `_ANATOMY_SYNONYMS` en phrases longues et non ambiguës |
| Classe absente d'une table de gating | traitée comme « aucune maîtrise/capacité » | absence = `manual_check`, jamais `ineligible` |
| Race non consultée pour les maîtrises d'armes | un Guerrier nain refusé à tort sur un don exigeant une arme naine (« Frappe de la vipère jaillissante ») | `RACE_WEAPON_PROFICIENCY` + `RACE_WEAPON_RECLASSIFICATION` complètent `class_proficiencies.json` |
| `filter_valid_rows` avant réparation des avantages | 127 lignes `#ERROR!` dans `Avantages` (jamais lu par le moteur) filtrées, amputant 10 % du catalogue et cassant le graphe à ses nœuds structurels (`Endurance`, 15 dons dépendants) | `repair_benefits` tourne **avant** `filter_valid_rows` ; invariant testé : zéro prérequis-don pendant |
| Confondre `raw_conditions` et `effective_conditions` | audit citant une source fausse | `raw_conditions` = texte CSV, source à citer ; `effective_conditions` inclut `feat_prereq_supplements.json`, jamais confondus à l'affichage |

## `RACE_WEAPON_PROFICIENCY` et `RACE_WEAPON_RECLASSIFICATION`

Deux tables recopiées des traits « Armes familières » déjà scrapés dans
`races.json` : la première donne une maîtrise raciale indépendante de la
classe (l'elfe a l'arc long, le nain le marteau de guerre, l'halfelin la
fronde) ; la seconde reclasse, pour la race concernée, une arme « ethnique »
exotique en arme de guerre (le nain traite toute arme naine, ex. la
dorn-dergar naine, comme une arme de guerre — à condition que la classe ait
déjà les armes martiales). Sans la seconde, une classe qui a les armes
martiales mais pas les armes exotiques refuse à tort un don qui exige
justement cette arme ethnique.

## Ce qui reste non modélisé, exprès

- **Les 13 entrées `proficiency`** dépendant d'un choix de joueur non tracé
  (couche 5). Ne jamais leur assigner une classe par défaut « raisonnable ».
- **Les 6 entrées `class_ability_unmapped`** de `prereq_gating.json` : capacité
  de classe dont la curation n'a pas su déterminer la classe. Gisement de
  `manual_check` résiduel connu, pas un bug à corriger par une supposition.
- **`Character.skill_rank` optimiste.** Sans `skill_ranks` explicite il
  renvoie `level` (aucun malus hors-classe en PF1, donc défendable pour un
  dépistage « ce personnage pourrait-il qualifier »), mais cela gonfle
  mécaniquement la liste des dons candidats universels. Ne pas le lire comme
  une valeur réelle de personnage sans vérifier qu'un `skill_ranks` explicite a
  été fourni.
