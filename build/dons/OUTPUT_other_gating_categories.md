# Autres axes de gating généralisables (analyse Step 09)

## 1. Méthode

L'analyse part de `Data/feat_details.json` (1417 entrées, produit par Step 06 :
`description`, `conditions_detail`, `avantages_detail`, `special`, `normal`,
`raw_text` par don) et de `Data/feat_categories.json` (1139 dons y sont tagués
`needs_manual_check: true`) comme filtre de priorité, sur l'hypothèse que ces
dons sont les plus susceptibles de cacher un prérequis non structuré. Comme
référence de comparaison, `Data/feat_magic_info.json` (Step 08) est l'exemple
d'un axe déjà traité : une information de gating (capacité magique innée)
présente dans le texte mais absente de `Conditions` a été extraite dans un
fichier séparé pour durcir `manual_check` → `ineligible`/`eligible`.

Concrètement, pour chaque piste candidate :
1. recherche de motifs textuels (mots-clés en français, insensibles à la casse)
   dans `conditions_detail`, `description`, `avantages_detail`, `special`,
   `normal` de `Data/feat_details.json` ;
2. pour chaque don trouvé, comparaison avec la colonne `Conditions` réelle de
   `Data/Dons.csv` pour vérifier si l'information est déjà présente et déjà
   structurée, déjà présente mais non reconnue par le parseur actuel, ou
   totalement absente du CSV ;
3. pour les cas ambigus, exécution réelle de `pf1_dons.parser.parse_conditions`
   sur le texte exact (lecture de code en isolation, aucune modification) pour
   confirmer empiriquement le `RequirementType` produit et si le don retombe
   bien en `UNPARSED`/`CLASS_FEATURE_TEXT` avec `needs_manual_check=True`.

Ce protocole a permis de distinguer, pour chaque catégorie ci-dessous, les cas
qui sont un vrai "trou" de gating (info présente dans le texte, absente ou mal
reconnue par le pipeline CSV → parser → engine) de simples effets narratifs
qui ne sont pas des prérequis (ex. « une créature de taille supérieure à la
sienne » qui décrit la *cible* d'une attaque, pas le personnage lui-même).

## 2. Catégorie « capacité raciale/de créature précise »

### Exemple d'ouverture : Adaptation aquatique

- `Data/Dons.csv` — `Conditions` : `Pouvoir retenir son souffle`
- `Data/feat_details.json` — `conditions_detail` : `"Capacité retenir son souffle"`
- `description` : *"Cette option est plus courante chez les hommes-lézards.
  Le personnage a développé une capacité étrange mais bien utile : il peut
  respirer sous l'eau."*

Vérification empirique (`parse_conditions("Pouvoir retenir son souffle", {})`)
: le segment tombe en `RequirementType.UNPARSED`,
`needs_manual_check=True` — aucun `implied_classes` n'est attaché, puisque
"retenir son souffle" ne nomme aucune classe ni mot-clé de
`Data/class_ability_map.json`. Résultat : **tout personnage**, y compris un
Guerrier humain qui ne peut absolument pas retenir son souffle plus que la
normale, reste en `manual_check` au lieu d'être franchement `ineligible` (à
moins d'avoir réellement le pouvoir extraordinaire correspondant, ce qui n'est
pas modélisé côté `Character`).

### Autres exemples réels du même motif

- **Vision affûtée** — CSV `Conditions` : `Vision dans le noir (18m)` ;
  `conditions_detail` : `"Vision dans le noir à au moins 18 mètres (12
  cases)."` Vérifié : `parse_conditions("Vision dans le noir (18m)", {})` →
  `UNPARSED`, `needs_manual_check=True`. C'est une capacité extraordinaire de
  race/créature (drow, nain, etc.), jamais de classe.
- **Yeux du crépuscule** — CSV `Conditions` : `Sens très affûtés, 7 rangs en
  Perception, trait racial sens aiguisés, vision nocturne`. Vérifié :
  `"Sens très affûtés"` → `UNPARSED`, `"trait racial sens aiguisés"` →
  `CLASS_FEATURE_TEXT`, `"vision nocturne"` → `UNPARSED` — trois segments sur
  quatre relèvent de ce même motif « capacité de créature précise », un seul
  (`7 rangs en Perception`) est déjà correctement structuré en
  `SKILL_RANKS`.
- **Rat des tunnels** (CSV `Conditions` : `Homme-rat, trait racial
  regroupement`) et **Regroupement précipité** (même profil) — ici la race
  *est* nommée (`homme-rat`), donc `implied_classes`-like matching pourrait en
  théorie s'appliquer si l'on étendait ce mécanisme aux races ; mais le trait
  qui l'accompagne (`trait racial regroupement`) reste, lui, un texte de
  capacité non structuré.

### Fréquence estimée dans le catalogue

Recherche de motifs `résistance`, `immunité`, `vision dans le noir`, `vision
nocturne`, `retenir son souffle`, `sang de`, `capacité raciale`, `sens
aiguisés`, `don racial`, `trait racial` dans les cinq champs textuels de
`Data/feat_details.json` (union, dons distincts) : **107 dons sur 1417**
(~7,5 % du catalogue) contiennent au moins une de ces expressions. C'est une
borne haute volontairement large (elle inclut aussi des effets narratifs qui
ne sont pas des prérequis, comme des dons qui *confèrent* une résistance sans
en exiger une) ; en excluant les mentions qui n'apparaissent que dans
`avantages_detail`/`special` (effet du don, pas condition d'accès), le nombre
de dons dont le **prérequis** lui-même nomme une capacité raciale/de créature
précise (comme les 5 exemples ci-dessus) se compte plutôt en dizaines, mais
reste significatif — largement plus fréquent qu'on ne le supposerait avant
d'avoir lu l'échantillon.

### Pourquoi c'est un axe différent de `implied_classes` et de la magie

- `implied_classes` (parser.py) résout des textes qui nomment ou impliquent
  une **classe** (via `KNOWN_CLASSES` ou `Data/class_ability_map.json` —
  mots-clés de capacités *de classe*, ex. « mystère », « domaine »). Il ne
  couvre pas les capacités **raciales/de créature** (vision dans le noir,
  retenir son souffle, résistance élémentaire innée, etc.), qui ne sont
  associées à aucune classe et pour lesquelles `Character` n'a de toute façon
  qu'un champ `race: Optional[str]` — pas de liste de traits raciaux
  possédés.
- Le gating magie (Step 08, `Data/feat_magic_info.json`) résout des
  prérequis de type « capacité à lancer un sort / niveau de lanceur de sorts
  / pouvoir magique inné », qui sont des capacités *magiques* évaluables via
  `character_class` + progression de sorts. Une capacité extraordinaire comme
  « retenir son souffle » ou « vision dans le noir » n'est ni magique ni liée
  à une classe : c'est un troisième axe, orthogonal aux deux premiers,
  organisé par **race/type de créature**, pas par classe ni par école de
  magie.

### Proposition de conception future : `Data/ability_owner_map.json`

Sur le modèle de `Data/class_ability_map.json`
(`{"entries": [{"keyword", "classes", "disposition", "reason",
"source_raw_examples", "confidence"}]}`), un futur `Data/ability_owner_map.json`
mapperait des mots-clés de capacité (normalisés, sans accent, en minuscule —
même normalisation que `_normalize` dans `parser.py`) vers les races/types de
créature qui les possèdent nativement, en s'appuyant sur `Data/races.json`
(Step scrapé par `scrape_races.py`) comme source de vérité plutôt que sur
`Data/class_features.json` :

```json
{
  "entries": [
    {
      "keyword": "retenir son souffle",
      "races": ["homme-lezard", "ondin", "triton"],
      "disposition": "mapped",
      "reason": "Pouvoir extraordinaire présent dans les traits raciaux standards.",
      "source_raw_examples": ["Pouvoir retenir son souffle"],
      "confidence": "high"
    },
    {
      "keyword": "vision dans le noir",
      "races": ["nain", "drow", "gobelin", "orque", "..."],
      "disposition": "no_single_race",
      "reason": "Trait partagé par un grand nombre de races ; gating par race unique risquerait des faux négatifs.",
      "source_raw_examples": ["Vision dans le noir (18m)"],
      "confidence": "medium"
    }
  ]
}
```

Comme `class_ability_map.json`, la `disposition: "no_single_race"` (pendant de
`no_single_class`) doit rester disponible : plusieurs races partagent la
vision dans le noir ou la résistance au froid, donc l'enrichissement ne
pourrait durcir en `ineligible` que si la race du personnage est absente de
*toutes* les races candidates — jamais l'inverse. Comme pour
`class_ability_map.json`, ce fichier serait **hand-curated**, pas
auto-régénéré, et alimenterait un nouveau payload (`implied_races`) sur le
modèle d'`implied_classes`, consommé par un futur `engine.py` qui devra aussi
gagner un champ structuré de traits raciaux sur `Character` (actuellement
seul `race: Optional[str]` existe, sans liste de capacités raciales
possédées) — donc cet axe a une dépendance de données plus lourde que
`implied_classes`, qui ne dépendait que du nom de classe déjà présent sur
`Character`.

## 3. Catégorie « taille »

Contrairement à l'hypothèse initiale (une taille mentionnée uniquement dans
la description mais absente de `Conditions`), aucun exemple réel de ce type
précis n'a été trouvé dans l'échantillon : chaque fois qu'un don a un vrai
prérequis de taille sur le personnage, celui-ci est bien présent dans
`Conditions`/`conditions_detail`. En revanche, la lecture a mis en évidence un
**vrai trou dans `RequirementType.SIZE` lui-même** : `SIZE_RE` dans
`parser.py` (`^taille (TP|P|M|G|TG)$`) ne reconnaît qu'une taille exacte, pas
les formulations comparatives (« ou plus petit », « ou plus grand », « ou
plus ») qui sont pourtant très courantes dans `Data/Dons.csv`.

Exemples réels et vérification empirique (`parse_conditions(...)`, lecture de
code en isolation) :

- **Inaperçu** — CSV `Conditions` : `Dex 13, taille P ou plus petit`. Le
  segment `"taille P ou plus petit"` est splitté par `" ou "` en `OrGroup`
  avec une option `SIZE(P)` correcte et une option
  `UNPARSED("plus petit")`, `needs_manual_check=True`. Résultat pour un
  personnage de taille TP (qui devrait être *eligible*, TP est « plus petit »
  que P) : la première option de l'`OrGroup` est `False`, la seconde est
  `None` → le groupe entier retombe en `manual_check` au lieu d'`eligible`.
- **Capture** — CSV `Conditions` : `Taille TG ou plus`. Même mécanisme :
  `OrGroup([SIZE(TG), UNPARSED("plus")])` — un personnage de taille
  Colossale (strictement plus grand que TG, donc éligible) retombe en
  `manual_check` au lieu d'`eligible`.
- Même motif confirmé sur **Profil bas**, **Raillerie**, **Sous les jambes**,
  **Par-dessus et par-dessous**, **Pieds emmêlés**, **Tour de passe-passe**,
  **Coup fabuleux** (`taille G ou plus`) — tous vérifiés dans
  `Data/Dons.csv` avec la même structure `taille X ou plus [petit/grand]`.

Ce n'est pas une nouvelle catégorie de prérequis (le type `SIZE` existe déjà
et le payload `{"size": ...}` est correct pour l'option exacte), mais un vrai
gap de reconnaissance du texte comparatif — la donnée est présente et déjà
qualifiée dans le CSV, le parseur ne sait simplement pas relier les deux
options de l'`OrGroup` en une seule contrainte "≤ P" / "≥ TG".

## 4. Catégorie « alignement »

Ici aussi, aucun don de l'échantillon n'a de prérequis d'alignement mentionné
*uniquement* dans la description (hors CSV) — chaque occurrence trouvée est
déjà dans `Conditions`. Le vrai trou est en aval : ces prérequis d'alignement,
bien que présents et bien formulés dans le CSV, ne sont reconnus par aucun
`RequirementType` existant et retombent systématiquement en `UNPARSED`.

- **Mains du croyant** — CSV `Conditions` : `Sag 13, Bienfait du croyant,
  doit être Loyal Bon, aligenement divergeant au maximum d'un cran de celui
  du dieu`. Vérifié : `parse_conditions("doit être Loyal Bon", {})` →
  `UNPARSED`, `needs_manual_check=True`. C'est un alignement absolu, fixe,
  entièrement déterminable si `Character` portait un champ `alignment` (il
  n'en a pas actuellement : voir `pf1_dons/engine.py`, dataclass `Character`,
  seuls `character_class`, `level`, `race`, `size`, `ability_scores`,
  `known_feats`, `skill_ranks` existent).
- **Bienfait du croyant** / **Frappe bénie** — CSV `Conditions` inclut
  `aligenement divergeant au maximum d'un cran de celui du dieu` (Frappe
  bénie : `BBA +11, capacité à lancer des sorts divins, aligenement
  divergeant au maximum d'un cran de celui du dieu`). Vérifié : ce segment
  tombe aussi en `UNPARSED`. C'est un second sous-motif, plus dur à
  automatiser que le premier car relatif (il faudrait connaître la divinité
  choisie par le personnage et l'alignement de cette divinité, information
  qui n'existe dans aucune structure de données du projet).

Deux sous-catégories distinctes se dégagent donc : alignement absolu
(« doit être Loyal Bon » — facilement automatisable dès qu'un champ
`alignment` existe sur `Character`) et alignement relatif à une divinité
(nécessite une table divinité → alignement, non présente dans `Data/`
actuellement, donc plus coûteux à traiter).

## 5. Autres catégories repérées

### 5a. Prérequis d'équipement/maîtrise d'arme précise non structuré

- **Bouclier contre les projectiles** — `avantages_detail` : *"Le personnage
  doit utiliser une rondache, un écu ou un pavois pour tirer parti de ce
  don."* — CSV `Conditions` ne mentionne aucune arme/bouclier ; c'est une
  condition d'usage (pas de gain) totalement absente du CSV, qui explique
  pourquoi le don serait utilisable "à vide" sans le bouclier requis.
- **Pistolier gobelin** — `normal` : *"Le gobelin reçoit un malus de -2
  lorsqu'il utilise une arme de taille inappropriée (taille M)."* Ici la
  condition raciale (`gobelin`) est bien dans `Conditions`, mais le fait que
  ce malus ne s'applique qu'aux armes à feu de taille M est une nuance
  d'équipement précise que ni `Conditions` ni aucun `RequirementType` ne
  capture (pas gênant pour l'éligibilité en soi, mais illustre que le motif
  « type d'arme/bouclier requis pour bénéficier de l'avantage » réapparaît
  dans le texte sans jamais remonter en `Conditions`).

Ce motif est plus proche d'une nuance d'application du don (utile pour un
futur moteur de simulation de combat) que d'un vrai prérequis d'éligibilité
manqué — à noter pour mémoire, mais moins prioritaire que les catégories 2-4.

### 5b. Prérequis de « pouvoir de classe » générique sans nom de classe unique

- **Abondance de révélations** — CSV `Conditions` : `Pouvoir de classe
  mystère` ; `conditions_detail` : `"Pouvoir de classe mystère"`. « mystère »
  est bien dans `Data/class_ability_map.json` et résout correctement vers
  Oracle via `implied_classes` (cas déjà couvert, cité dans
  `docs/...class-ability-map...` — voir commit `1bb8900`).
- **Filature télépathique** — `conditions_detail` : `"10 rangs en
  Psychologie, capacité à lancer détection de pensées ou télépathie comme un
  sort ou un pouvoir magique ou capacité surnaturelle télépathie"` — mélange
  un prérequis de compétence (déjà `SKILL_RANKS`), un prérequis magique
  (couvert par le Step 08 magic gating) et une capacité surnaturelle
  générique (« télépathie ») qui n'est ni une classe ni une race précise —
  ambiguïté à la frontière entre catégorie 2 (capacité de créature) et le
  gating magie, symptomatique du fait que certains dons empilent plusieurs
  axes dans un seul segment de `OrGroup`, ce qu'aucun mécanisme actuel ne
  décompose.

## 6. Recommandation de priorité

**Implémenter en priorité le fix de `RequirementType.SIZE` pour les
formulations comparatives (catégorie 3, « taille »).**

Raisons :
- **Risque de faux positifs minimal** : contrairement aux capacités
  raciales/de créature (catégorie 2) ou à l'alignement absolu (catégorie 4),
  la taille est un champ déjà structuré sur `Character` (`size:
  Optional[str]`) et une progression totalement ordonnée (TP < P < M < G < TG
  < Colossal) — pas d'ambiguïté "quelle race a cette capacité", juste une
  comparaison d'ordre à coder.
- **Périmètre de code minimal et bien identifié** : le seul point d'entrée à
  toucher serait `SIZE_RE`/`_classify_segment` dans `parser.py` pour
  reconnaître `"taille X ou plus petit"` / `"taille X ou plus"` /
  `"taille X ou plus grand"` comme un seul `Requirement` avec un payload
  `{"size": "X", "comparator": "<="/">="}`, plus l'ajout du comparateur dans
  `evaluate_requirement` (`engine.py`). Aucune nouvelle donnée externe
  (`Data/*.json`) n'est nécessaire, contrairement à la catégorie 2
  (`ability_owner_map.json`, qui suppose d'abord d'enrichir
  `Character`/`Data/races.json` avec une liste de traits raciaux possédés —
  chantier de données bien plus lourd) ou à la catégorie 4 relative-alignement
  (qui suppose une table divinité → alignement inexistante).
- **Fréquence non négligeable** : au moins 7 dons identifiés dans
  l'échantillon (Inaperçu, Profil bas, Sous les jambes, Par-dessus et
  par-dessous, Pieds emmêlés, Tour de passe-passe, Capture, Coup fabuleux)
  suivent ce motif exact, et ce sont tous des cas où le personnage est
  aujourd'hui laissé en `manual_check` alors que l'éligibilité est
  entièrement déterminable dès que `Character.size` est renseigné — un gain
  immédiat et sans ambiguïté pour la précision du moteur.

En second choix, l'alignement absolu (catégorie 4, sous-cas « doit être
Loyal Bon ») serait la prochaine cible naturelle : peu de dons concernés (4
identifiés) mais nécessite d'abord d'ajouter un champ `alignment` à
`Character`, un chantier de modélisation plus large qui touche
`character_profile.py`/`cli.py` en plus de `engine.py`/`parser.py`/
`models.py`. La catégorie 2 (capacités raciales/de créature) est la plus
riche en volume potentiel (~107 dons touchés au sens large) mais aussi la
plus coûteuse à bien faire : elle demande la création et la curation manuelle
d'un nouveau `Data/ability_owner_map.json` (travail éditorial comparable à
`class_ability_map.json`) avant même de toucher au code, donc à traiter dans
une itération dédiée plutôt qu'en même temps que le fix taille.
