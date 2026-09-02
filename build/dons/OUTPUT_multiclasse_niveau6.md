# Audit multi-classes niveau 6 — deuxième vague

Suite de `OUTPUT_guerrier_audit_rules.md`. Là où la première vague n'auditait
qu'un guerrier, celle-ci **teste 11 classes de base simultanément** au niveau 6
(le niveau réel des joueurs), ce qui permet de détecter la classe d'erreurs que
l'audit mono-classe ne peut pas voir : *un don refusé à la classe qui possède
justement la capacité requise.*

## Banc d'essai

`scripts/creer_fiches_classes_de_base.py` crée 11 fiches niveau 6, **toutes de
race humaine** pour isoler la variable « classe ». Caractéristiques standard
orientées vers la caractéristique maîtresse ; alignement et divinité renseignés
pour les classes qui en dépendent (paladin, prêtre, druide, moine, barbare) afin
que ces prérequis se **résolvent** au lieu de rester en vérification manuelle.

`scripts/comparer_classes.py` produit ensuite le tableau croisé
`build/audit_classes_de_base/TABLEAU_CROISE.txt` : une ligne par don, une colonne
par classe, `O` / `?` / `.` — **sortie complète, jamais tronquée** — suivie de la
liste des dons proposés à toutes les classes et de celle des dons exclusifs à une
seule.

## Résultats

| Classe | BBA | éligibles | à vérifier | inéligibles | proposés |
|---|---|---|---|---|---|
| Barbare | 6 | 117 | 57 | 1116 | 174 |
| Barde | 4 | 141 | 104 | 1045 | 245 |
| Druide | 4 | 131 | 75 | 1084 | 206 |
| Ensorceleur | 3 | 134 | 88 | 1068 | 222 |
| Guerrier | 6 | 119 | 47 | 1124 | 166 |
| Magicien | 3 | 130 | 97 | 1063 | 227 |
| Moine | 4 | 117 | 43 | 1130 | 160 |
| Paladin | 6 | 141 | 100 | 1049 | 241 |
| Prêtre | 4 | 130 | 91 | 1069 | 221 |
| Rôdeur | 6 | 139 | 83 | 1068 | 222 |
| Roublard | 4 | 114 | 58 | 1118 | 172 |

Les lanceurs de sorts reçoivent nettement plus d'offres que les non-lanceurs,
ce qui est le comportement attendu. **97 dons** sont éligibles pour les 11
classes (dont une cinquantaine n'ont aucune Condition). **~90 dons** sont
exclusifs à une seule classe, et le contrôle par échantillon confirme que chacun
tombe bien dans la bonne classe (formes animales → druide, imposition des mains →
paladin, chakras/ki → moine, représentations → barde, rage → barbare, pièges →
rôdeur, talents → roublard, entraînement aux armes → guerrier).

## Les six dons signalés — quatre causes racines distinctes

| Don | Cause racine | Correctif |
|---|---|---|
| Attaque imprévisible supplémentaire | capacité de classe non mappée | `CLASS_ABILITY_OVERRIDES` → roublard/ninja/tueur |
| Connaissances magiques étendues | `NLS 1` traité comme non dérivable | **nouvelle règle CASTER_LEVEL** (voir ci-dessous) |
| Familier libéré | idem + `capacité de classe familier` non mappée | règle CASTER_LEVEL + override (5 classes à familier) |
| Lecture des résidus magiques | avantage magique sans mot-clé connu | mot-clé fort « tout autre sort d'un niveau plus eleve » |
| Ombre druidique | restriction visible seulement dans l'avantage | nouvelle couche `Data/feat_class_restriction.json` |
| Palpation curative supplémentaire | capacité de classe non mappée | `CLASS_ABILITY_OVERRIDES` → paladin/hypnotiseur |

### La règle à plus fort levier : CASTER_LEVEL

Un prérequis « NLS *n* » exige d'*être lanceur de sorts*. La valeur exacte reste
non dérivable — mais l'**absence totale** d'accès à la magie, elle, tranche : un
guerrier n'aura jamais de NLS 1. `engine.py::evaluate_requirement` renvoie
désormais `False` (au lieu de `None`) quand `magie_inaccessible(character)`.

`magie_inaccessible()` est volontairement conservateur : il n'est vrai que si la
classe est **connue et explicitement non-lanceuse** (`class_grants_magic() is
False`, donc jamais pour une classe absente de `Data/class_caster_info.json`)
**et** que la race n'accorde pas la magie.

### La nouvelle couche : `Data/feat_class_restriction.json`

Restriction lisible uniquement dans le *texte d'avantage* du don. Le signal
s'est révélé très peu spécifique (1 vrai positif sur 49 candidats) : la table est
donc entièrement curée à la main. Analyse complète et contre-motifs dans
`OUTPUT_benefit_text_class_signal.md`.

## Trois erreurs de données révélées par le test multi-classes

Aucune n'était visible en n'auditant qu'un guerrier.

1. **Le scalde était marqué non-lanceur.** Détecté en recroisant
   `Data/class_caster_info.json` avec les marqueurs magiques de
   `Data/class_features.json` : le scalde était la seule classe incohérente (sa
   progression scrapée accorde « tours de magie » et « écriture de parchemins »
   au niveau 1, exactement comme le barde). Corrigé **à la source**, dans le
   tableau de vérité terrain `OUTPUT_class_caster_ground_truth.md`
   (`| scalde | true | arcane | complet |`), puis `scripts/curate_class_caster_info.py`
   ré-exécuté → 43 classes.

2. **« Forme animale » n'était attribuée qu'au métamorphe.** Sous-attribution
   grave : elle rendait le **druide** inéligible à tous les dons de sa propre
   capacité signature (niveau 4). Corrigé en `["druide", "metamorphe"]`, et
   « ennemi juré et forme animale » en `["druide", "metamorphe", "rodeur"]`.

3. **Extraction de divinité cassée par `lstrip`.** `keyword.split(" ", 1)[1].lstrip("de'u ")`
   traite son argument comme un *ensemble de caractères* : « suivant de dahak »
   devenait « ahak », « suivant d'un des quatre cavaliers » devenait « n des
   quatre cavaliers ». Remplacé par un retrait de préfixe explicite
   (`_DEITY_PREFIX_RE`), vérifié sur les sept formes rencontrées.

## Motifs rejetés (faux positifs évités de justesse)

- « ou tout autre sort » comme mot-clé magique : attrape *Serviteur céleste*,
  dont les Conditions (« Aasimar, compagnon animal, familier **ou aptitude de
  classe monture** ») sont satisfaites par un **cavalier** aasimar sans magie.
- « de ses sorts » : attrape *Signes secrets*, qui conserve un avantage
  entièrement non magique (+4 en Bluff pour messages secrets) et reste donc utile
  à un non-lanceur. Impossible de le rattraper par `EXCLUSION_PHRASES`, puisqu'un
  mot-clé fort court-circuite `classify()`. Remplacé par deux mots-clés étroits.
- La classe citée dans un avantage comme signal automatique de restriction : voir
  `OUTPUT_benefit_text_class_signal.md`.

Chacun de ces rejets est verrouillé par un cas de régression (par exemple
`signes_secrets_guerrier_eligible`, qui échouerait si le motif large revenait).

## Régression

`Data/prereq_gating.json` : `class_ability_unmapped` **20 → 6**, `class_ability`
22 → 33. `tests/golden/cases.json` : **43 → 61 cas**, chaque correctif étant
accompagné d'un contre-test (la classe qui *possède* la capacité doit rester
proposée). Suite complète : **116 tests passés**.

## Limites connues, volontairement non modifiées

1. **`Character.skill_rank` est optimiste** : sans `skill_ranks` explicite, il
   renvoie `level`, donc *tous* les prérequis de rangs de compétence passent
   simultanément. C'est documenté comme intentionnel dans `CLAUDE.md` et
   défendable pour un dépistage (« ce personnage *pourrait*-il qualifier ? »,
   PF1 n'ayant pas de malus de rangs hors-classe), mais cela gonfle la liste des
   dons universels. C'est le principal levier restant.
2. **Les maîtrises d'armes et d'armures de classe ne sont pas modélisées** : un
   magicien reste proposé pour des dons exigeant une arme de guerre.
