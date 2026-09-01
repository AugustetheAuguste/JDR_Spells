# Les prérequis que la page énonce et que le CSV ignore : relecture des 86 dons

## Le problème

`scrappers/tag_feat_semantics.py` compare, pour chaque don, les `Conditions` du
CSV au texte de sa page dédiée, et relève dans
`Data/dons/feat_semantics_review.json` les prérequis présents dans la seconde et
absents des premières. 86 dons y figurent. Le fichier était explicitement
*non applicable* : appliquer un tel relevé en bloc ne peut qu'**ajouter** des
conditions, donc produire la sous-attribution que le principe de sûreté du dépôt
interdit (« sur-attribuer coûte un `manual_check` ; sous-attribuer cache le don
au joueur sans recours »).

Mais le relevé n'est pas homogène. Il mélange trois choses de natures très
différentes, et c'est ce mélange — non le risque de sous-attribution — qui le
rendait inexploitable :

- du **bruit de scraping** : 7 dons se voient listés comme leur propre prérequis
  (« Aptitude magique » exige « Aptitude magique »), le titre de la page ayant
  été relu comme une condition. Une condition insatisfiable par construction :
  jamais un vrai prérequis ;
- de la **prose** : un rituel de six mois, une trousse de chirurgien, une armure
  légère, « chacune d'elles doit être liée à un domaine que sa divinité lui
  accorde » ;
- de vrais **prérequis quantifiables**, que le CSV a simplement perdus :
  « Souplesse du serpent » exige Dex 13 sur sa page et rien dans le CSV,
  « Attaque au galop » exige 1 rang en Équitation, « Éventration à deux armes »
  exige Dex 17 et le don « Combat à deux armes ».

## La question posée à chaque fragment

**Est-il quantifiable ?** — c'est-à-dire : se réduit-il à une caractéristique, un
BBA, des rangs de compétence, ou un nom de don du catalogue, les quatre choses
que le parser sait déjà lire et le moteur déjà décider ?

Oui → le fragment est réécrit **dans la syntaxe de la colonne `Conditions`**
(« bonus de base à l'attaque +1 » → « BBA +1 ») et rangé dans `ajouts`.
`data_loader.py` les concatène aux conditions du CSV avant l'appel au parser :
aucune règle nouvelle, aucun `RequirementType` nouveau, pas une ligne de moteur
touchée. C'est la même économie que `repair_benefits` — on répare la donnée, pas
le code.

Non → le fragment est rangé dans `ignores` **avec le genre qui dit pourquoi**.
Rien n'est jeté en silence, exactement comme `prereq_gating.json` nomme
`fragment` ou `generic` ce qu'il ne sait pas décider.

## Résultat de la relecture

86 dons : **47 reçoivent des prérequis** (68 fragments), **39 sont entièrement
écartés**. Les 8 genres d'écart :

| genre | n | ce que c'est |
|---|---|---|
| `proficiency` | 8 | « maniement de l'arme choisie » — tout personnage choisit l'arme qu'il manie ; le dépôt ne modélise pas les maniements |
| `redondant` | 8 | déjà impliqué transitivement par une condition du CSV |
| `non_automatisable` | 8 | vrai prérequis, mais dépendant d'un choix interne au don (quelle technique, quel pouvoir, quelle caractéristique de DD) |
| `self_reference` | 7 | le don comme son propre prérequis |
| `contrainte_de_jeu` | 7 | matériel, encombrement, armure portée, rituel |
| `variante_de_source` | 5 | la page **contredit** le CSV au lieu de le compléter |
| `niveau_1_uniquement` | 2 | contrainte sur le *moment* du choix, pas sur l'état du personnage |
| `prose_permissive` | 2 | la phrase **élargit** l'accès |

### Les deux genres qu'il ne faut surtout pas confondre avec un complément

**`variante_de_source`.** « Attaque de queue » : le CSV exige *homme-serpent*, la
page *homme-lézard*. Additionner les deux fabrique une condition impossible — un
personnage ne peut pas être des deux races. Même schéma pour « Compression
ophidienne », « Magie innée », « Queue agrippeuse » (Tieffelin contre « doit
posséder une queue »), et pour « Maîtrise du combat défensif », dont le CSV décrit
la version non mythique tandis que la page ajoute « 4ᵉ grade mythique » : le grade
appartient à son homonyme mythique, et l'ajouter rendait le don inaccessible à
tout personnage non mythique. C'est le seul genre où l'ajout aurait produit un
`ineligible` **universel** — le pire cas possible.

**`prose_permissive`.** « Un personnage ayant contracté la lycanthropie peut
prendre ce don même s'il n'en remplit pas les conditions. » La phrase lève une
condition ; la transcrire en condition en inverse le sens.

## Le garde-fou qui compte

`scripts/curate_prereq_supplements.py --verifier` refuse d'écrire si un seul
ajout n'est pas reconnu par le parser. Un ajout retombant en `UNPARSED` ou en
`CLASS_FEATURE_TEXT` n'apporterait qu'un `manual_check` de plus — l'exact inverse
du but de la couche, qui est de *trancher*. C'est ce contrôle qui a écarté
« fidèle du Destructeur » (le gating `deity` ne reconnaît pas ce libellé) et
« avoir un seigneur démon comme divinité protectrice » (« un seigneur démon »
désigne un ensemble, pas une divinité nommée) vers `non_automatisable` plutôt que
vers `ajouts`.

Le second garde-fou est que `raw_conditions` **ne bouge pas** : c'est le texte du
CSV, la source qu'un audit doit pouvoir citer. Les ajouts vivent dans
`FeatRow.prereq_supplements`, et `effective_conditions` est la concaténation que
le moteur a réellement évaluée. `scripts/audit_character_feats.py` affiche
désormais les deux lignes côte à côte.

## Effet mesuré

Sur le catalogue, 47 dons voient leurs conditions augmentées. L'effet n'apparaît
que sur un personnage dont les dons connus sont renseignés : sans `known_feats`,
ces dons étaient déjà en `manual_check` à cause de leur prérequis-don, et un
`manual_check` absorbe l'ajout sans changer de statut.

Guerrier humain niveau 6, `known_feats = {Esquive, Combat monté, Attaque en
puissance, Expertise du combat}`, For 14 / Dex 12 / Int 10 :

| statut | avant | après |
|---|---|---|
| `eligible` | 113 | 109 |
| `manual_check` | 106 | 106 |
| `ineligible` | 1198 | 1202 |

Les quatre dons qui changent de camp sont exactement ceux dont la page portait la
caractéristique manquante : « Souplesse du serpent » (Dex 13), « Science de la
feinte », « Science du croc-en-jambe », « Science du désarmement » (Int 13). Quatre
faux `eligible` en moins, aucun `eligible` perdu à tort.

Et **aucun** don n'a été rendu *plus* accessible : par construction, cette couche
ne peut que retirer. C'est pourquoi la relecture a été conservatrice au point
d'écarter 39 dons sur 86.

## Piège rencontré, à ne pas reproduire

La première mesure avant/après n'a montré aucune différence — parce que le chemin
du fichier était lié comme **valeur par défaut** de `_prereq_supplements(chemin=...)`,
évaluée à l'import : rediriger `paths.FEAT_PREREQ_SUPPLEMENTS` n'avait aucun
effet, et les deux relevés « avant » et « après » étaient le même. Le dépôt
connaît déjà ce piège (`persistence.py` lit `DEFAULT_CHARACTERS_DIR` à l'appel,
pour la même raison). Le chemin est désormais résolu dans le corps de la
fonction ; `test_fichier_absent_laisse_le_catalogue_inchange` verrouille le
comportement.

## Boucle refermée

`tag_feat_semantics.py` compare désormais la page à `effective_conditions` et non
plus à `raw_conditions`. Sans cela, un nouveau passage aurait re-signalé
indéfiniment les 68 prérequis déjà intégrés au moteur. Corollaire assumé : un don
curé peut disparaître du relevé, donc l'inclusion testée est à sens unique — tout
don du relevé doit être tranché, l'inverse n'est pas exigé.
