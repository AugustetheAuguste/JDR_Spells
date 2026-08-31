# Le texte d'avantage comme signal de restriction de classe

Document de calibration pour `scripts/curate_feat_class_restriction.py` →
`Data/feat_class_restriction.json`.

## Question posée

Certains dons n'ont **aucune Condition** (ou seulement des Conditions
numériques : caractéristique, BBA, autre don) mais leur *avantage* ne veut rien
dire pour une classe donnée. Exemple déclencheur, signalé par l'utilisateur :

> **Ombre druidique** — Conditions : « Alignement Neutre Mauvais, suivant du
> Zon-Kuthon ». Avantage : « Le personnage ajoute les sorts suivants à sa liste
> de druide. »

Un roublard neutre mauvais adorateur de Zon-Kuthon satisfait littéralement les
Conditions, et le moteur le déclarait donc éligible — alors que le don ne fait
que réécrire la liste de sorts du druide.

D'où l'hypothèse à tester : **la mention d'une classe dans le texte d'avantage
est-elle un signal fiable de restriction de classe ?**

## Méthode

`scripts/curate_feat_class_restriction.py --candidats` génère la population de
départ en croisant `Data/feat_details.json` avec `CLASS_MENTION_PATTERNS`
(« liste de sorts du <classe> », « à sa liste de <classe> », « niveau de
<classe> », « capacité de classe de <classe> », …), puis retire les dons déjà
gatés en amont par `implied_classes` ou `Data/prereq_gating.json`.

- 51 dons mentionnent une classe dans leur avantage.
- 2 sont écartés d'office par les `GRANTING_PATTERNS` (voir ci-dessous).
- **49 candidats** restent à examiner à la main.
- **1 seul** est retenu comme restriction : *Ombre druidique*.

## Pourquoi 1 sur 49 — les deux contre-motifs

### 1. Le don *accorde* la capacité au lieu de l'exiger

Encodé dans `GRANTING_PATTERNS`. Formulations : « comme un pouvoir magique »,
« comme avec la capacité <X> », « en utilisant son niveau de personnage comme
niveau de <classe> ».

| Don | Avantage | Verdict |
|---|---|---|
| Adepte psychique | lance le sort « comme un pouvoir magique » | **ne pas gater** — le don *donne* la magie |
| Familier guêpe | « obtient un familier comme avec la capacité pacte magique, en utilisant son niveau de personnage comme niveau de magicien » | **ne pas gater** — le don *donne* le familier |

Gater ces deux dons aurait été un vrai bug : ils existent précisément pour
ouvrir une capacité à une classe qui ne l'a pas.

### 2. La classe citée n'est qu'une *référence de calcul*

Discriminant retenu : **si les Conditions du don sont purement numériques
(caractéristique, BBA, autre don), la classe nommée dans l'avantage n'est qu'une
échelle de progression, pas un prérequis.** Le texte dit « … comme un moine de
niveau égal à son niveau de personnage » : c'est une formule, ouverte à tous.

Exemples écartés pour cette raison : *Coup étourdissant*, *Coup parfait*, *Poing
élémentaire*, *Toucher de la sérénité* (« niveau de moine »), *Maître des
bâtons*, *Apprendre un piège de rôdeur*, *Polyvalence martiale* (« niveau de
guerrier »).

## Conclusion

Le signal est **réel mais très peu spécifique** : 1 vrai positif pour 48 faux.
Il ne peut donc **pas** être appliqué automatiquement. `Data/feat_class_restriction.json`
est en conséquence une table **entièrement curée à la main** (même patron que
`Data/class_ability_map.json` et `Data/class_caster_info.json`) : le générateur
`--candidats` sert seulement à produire la liste à réviser.

Principe de sûreté appliqué tout du long : **une sous-attribution est bien plus
grave qu'une sur-attribution.** Sur-attribuer une classe à un don ne coûte qu'un
`manual_check` ; sous-attribuer produit un `ineligible` faux, qui *cache* le don
au joueur sans recours. En cas de doute, on n'ajoute pas d'entrée.

## Chaque entrée retenue

### Ombre druidique → `["druide"]`

- Preuve (`evidence`) : « Le personnage ajoute les sorts suivants à sa liste de
  druide ».
- Le don ne produit aucun autre effet : hors de la liste de sorts du druide, il
  est littéralement vide.
- Cas de régression : `ombre_druidique_guerrier_ineligible` (refusé) et
  `ombre_druidique_druide_manual` (proposé, à vérifier) dans
  `tests/golden/cases.json`.
