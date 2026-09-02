# Audit exhaustif des dons offerts à un Guerrier — catégories d'erreurs et règles ajoutées

## Périmètre

Personnage de référence : `Data/characters/Guerrier_type.json`
(Guerrier 3, Humain, For 18 / Dex 13 / Con 14 / Int 12 / Sag 10 / Cha 8).

Les **1290** dons du catalogue ont été passés en revue un par un, condition par
condition, via `scripts/audit_character_feats.py`. Le rapport complet et non
tronqué est `build/audit_guerrier_humain_complet.txt` (12 079 lignes) : pour
chaque don, son statut, le verdict de *chaque* prérequis (`OK`/`ECHEC`/`?`), la
chaîne `Conditions` brute du CSV et le `conditions_detail` de la page dédiée.

| | avant | après |
|---|---|---|
| dons proposés (eligible + manual_check) | 248 | **150** |
| dont `eligible` | 93 | 100 |
| dont `manual_check` | 155 | **50** |
| `ineligible` | 1042 | 1140 |

## Cause racine

`Data/class_ability_map.json` ne répond qu'à une seule question : « ce prérequis
désigne-t-il une capacité réservée à certaines classes ? ». Ses **341** entrées
`no_single_class` — traits raciaux, types de créature, anatomie, divinité,
alignement, historique, maniement d'armes, dons, incantation — retombaient donc
toutes en `manual_check`, ce qui noyait la liste de candidats.

La correction est une couche **orthogonale** et curée, `Data/prereq_gating.json`
(`scripts/curate_prereq_gating.py`), qui dit de *quelle nature* est chaque
prérequis, plus un répartiteur dans `engine.py::_gating_verdict` qui confronte
chaque nature bloquante aux données réelles du personnage.

Répartition des 341 entrées : incantation 65, divinité 48, maniement 31, trait
racial 30, don 25, capacité de classe 22, capacité de classe non attribuée 20,
anatomie 19, type de créature 19, fragment 19, générique 17, historique 13,
alignement 11, « aucun niveau dans » 1, mythique 1.

## Catégories d'erreurs trouvées, et règle ajoutée pour chacune

Les six exemples fournis par l'utilisateur sont tous retrouvés ci-dessous, avec
leur raison — ainsi que les catégories supplémentaires découvertes en balayant
le reste du catalogue.

### 1. Trait racial requis (`kind: racial_trait`)
Le prérequis nomme un trait racial que la race du personnage n'a pas.
- **Règle** : `Character.racial_trait_text` normalise « nom | description » de
  tous les traits de `Data/races.json` ; le trait requis y est cherché.
- Exemple utilisateur : **Arpenteur de pierres** → *« trait racial requis
  “connaissance de la pierre” ; la race Humain ne l'accorde pas »*.
- Découvert en plus : *Vision affûtée* (vision dans le noir), *Acrobate des
  corniches* (montagnard/stabilité — désormais **eligible** pour un nain, la
  race possédant bien « Stabilité »).

### 2. Type de créature requis (`kind: creature_type`)
- **Règle** : même confrontation aux traits raciaux, sur le type/sous-type.
- Exemple utilisateur : **Ailes fiélonnes** → *« type/race de créature requis
  “exterieur mal” ; la race Humain ne l'accorde pas »*.

### 3. Anatomie requise (`kind: anatomy`)
Attaque naturelle, aile, queue préhensile, armure naturelle…
- **Règle** : `_ANATOMY_SYNONYMS` (phrases **longues** et non ambiguës) cherchées
  dans les traits raciaux.
- Exemples utilisateur : **Arrachage sauvage** (attaque de morsure),
  **Armure naturelle supérieure** (armure naturelle).
- Découvert en plus : *Attaque en vol* (vitesse de vol).
- ⚠️ Piège corrigé : un synonyme court (`"langue"`) faisait passer *Langue
  puissante* pour éligible en s'accrochant au trait universel « Langues ».

### 4. Accès à la magie requis (`kind: spellcasting`, 65 entrées)
- **Règle** : réutilise `Data/class_caster_info.json` + les mots-clés magiques
  des traits raciaux.
- Exemple utilisateur : **Agilité dimensionnelle** → le Guerrier ne peut pas
  lancer *porte dimensionnelle*.
- Découvert en plus : *Dispense de composantes*, et surtout une famille de dons
  **sans aucune Condition dans le CSV** dont seule la description révèle la
  nature magique → trois mots-clés ajoutés à `scrappers/tag_feat_magic.py`
  (`"peut lancer des sorts"`, `"sorts lances par le personnage"`,
  `"contrer un sort"`, cf. Section B entrées 10–12 de
  `OUTPUT_vocab_and_markup_calibration.md`). Motif volontairement écarté : le
  plus large `"lancer des sorts"` attrapait les dons *anti*-lanceurs du guerrier
  (« Perturbateur », « Tir perturbateur »).

### 5. Capacité de classe attribuable (`kind: class_ability`, 22 entrées)
- **Règle** : `CLASS_ABILITY_OVERRIDES` dans `scripts/curate_prereq_gating.py`
  attribue explicitement la capacité aux classes qui la donnent ; une autre
  classe échoue.
- Exemple utilisateur : **Armure résiliente** → capacité de classe absente du
  Guerrier.
- Découvert en plus : *Bombes supplémentaires* (alchimiste), *Focalisation
  instrumentale* (occultiste). À l'inverse, *Entraînement aux armures avancé*
  reste `manual_check` : le Guerrier **a** bien la capacité, seul le détail
  interne reste non vérifié.

### 6. Niveau **dans une classe** lu comme niveau de personnage
`CLASS_LEVEL_RE` : « Magicien de niveau 1 » était compris comme « niveau 1 », donc
satisfait par tout le monde.
- Exemple : **Maîtrise des sorts** → *« requiert magicien niveau 1 ; Guerrier
  n'y correspond pas »*.

### 7. « niveau N uniquement » lu comme un plancher
Nouveau `RequirementType.LEVEL_EXACT`.
- Exemple : **Bébé féerique** — offert à un Guerrier 3 alors qu'il est réservé
  au niveau 1.

### 8. Point-virgule non traité comme séparateur
`_split_top_level` découpe désormais sur `[,;]`. Tout le segment tombait en
`UNPARSED` auparavant.
- Exemple : **Cri de guerre** — le `Cha 13` caché après le `;` était ignoré ; le
  Guerrier (Cha 8) est maintenant correctement `ineligible`.

### 9. Comparatif « ou plus » découpé comme une alternative
`COMPARATIVE_SUFFIX_RE` + `SIZE_MIN_RE`/`SIZE_MAX_RE` avant le découpage sur
« ou », et un `comparator` (`exact`/`min`/`max`) dans le payload de taille.
- Exemples : **Capture**, **Inaperçu** (taille) ; « Trois attaques naturelles ou
  plus » ne produit plus l'option-fragment « plus ».

### 10. Prérequis **négatif** inversé
`class_ability_map.json` classe « aucun niveau dans une classe dotée de panache »
comme `mapped ['bretteur']` — l'engine exigeait donc *d'être* bretteur, l'exact
contraire de la règle.
- **Règle** : branche `startswith("aucun niveau dans")` dans `_enrich_payload`,
  émettant un `kind: no_class_levels` avec la liste des classes **exclues**.
- Exemples : **Adversaire familier**, **Bretteur amateur** → `eligible` pour le
  Guerrier, `ineligible` pour un Rôdeur.

### 11. Taille non dérivée de la race
`Character.effective_size` : taille explicite, sinon la taille de la race lue
dans `Data/races.json`.

### 12. Options-fragments rendant un groupe OU indécidable
Les 19 mots-clés `kind: fragment` (« familier », « monture », « plus »…) sont des
artefacts de découpage ; `evaluate_or_group` les écarte des options (sauf si
toutes le sont).

### 13. Alignement et divinité (`kind: alignment` 11, `kind: deity` 48)
- **Règle** : `Character.alignment` / `Character.deity` (+ flags CLI
  `--alignement` / `--divinite`). Non renseignés → `manual_check` avec la raison
  exacte, jamais `eligible` silencieusement.

### 14. Caractéristiques implicitement parfaites
`cli.py` écrit désormais les six caractéristiques (`DEFAULT_ABILITY_SCORE = 10`)
au lieu d'en laisser certaines absentes, ce qui produisait des
« score de Dex non fourni » à répétition.

### 15. Sortie tronquée
`slots` affiche tout par défaut (`--limit 0`) et imprime
`(N dons candidats)`. Le test `test_cli.py` qui **verrouillait** l'ancien
« … et N autres » a été réécrit.

## Les 50 `manual_check` résiduels — et pourquoi ils le restent

Ce sont, volontairement, les prérequis qu'aucune donnée disponible ne permet de
trancher. Conformément à la philosophie du dépôt, ils sont exposés et non devinés.

**a. Maniement / formation à une arme ou armure choisie (13)** —
*Adepte du filet, Arme jetable, Armure de prédilection, Entraînement aux armures
renforcé, Fossoyeur épineux, Frondeur-fouetteur, Grande cible, Lâcher de
munition, Maîtrise du tir à bout portant, Rechargement rapide, Ingénieur de
siège, Éclats d'arme, Conducteur expérimenté.*
Levier futur identifié, **non implémenté** : les maniements d'armes conférés par
la classe ne sont pas modélisés. Un Guerrier étant formé à toutes les armes
courantes et de guerre, « Maniement de la fronde » est en réalité satisfait —
mais rien dans les données ne le dit encore, donc rien n'est deviné.

**b. Divinité non renseignée (17)** — *Esquive de l'ombre, Familier guêpe,
Glouton de potions, Guérison athée, Maître des vagues, Négociateur diabolique,
Obédience divine, Obédience fiélonne, Ombre druidique, Réaction pondérée,
Saignée, Technique de combat divine, Vengeance sanglante, Vigueur élémentaire…*
Se résolvent dès que `--divinite` est fourni.

**c. Alignement non renseigné (4)** — *Charge du vertueux, Esprit ordonné,
Familier guêpe, Ombre druidique.* Se résolvent avec `--alignement`.

**d. Capacités de classe encore non attribuées (7)** — *Attaque imprévisible
supplémentaire, Compréhension approfondie des sorts, Familier libéré, Initié du
chakra, Palpation curative supplémentaire, Entraînement aux armures avancé
(cas légitime), …* Correspond aux 20 entrées `class_ability_unmapped` : la
curation n'a pas pu déterminer avec certitude quelle classe accorde la capacité.

**e. Historique / décision du MJ (6)** — *Défenseur du royaume, Esclave de
galère, Euphorie du pesh, Guérison du pesh, Renouveau du pesh, Supporter la
douleur, Totem spirituel, Vagabond expérimenté, Émissaire de guilde.*
Non automatisables par nature.

**f. Choix ouvert de compétence ou de talent (5)** — *Compétence de marque
(« 5 rangs dans la compétence choisie »), Linguistique ésotérique, Orateur,
Rattrapage habile (Talent (X)), Ombres de la peur.*

**g. « voir spécial » / NLS (2)** — *Connaissances magiques étendues, Esprit
ordonné* : le niveau de lanceur de sorts reste non dérivable automatiquement.

## Régression

`tests/golden/cases.json` passe de 23 à **43** cas, dont les six exemples de
l'utilisateur et un cas par bug de parsing ci-dessus. Suite complète :
**98 tests passés**.
