---
name: pf-fiche-personnage
description: Autorité humaine sur la fiche de personnage interactive, la nature de document de référence du produit, le piège des deux entités homonymes (la table de compte `personnages` contre la fiche locale), le tri-état des valeurs et l'interdiction du zéro par défaut, la forme canonique en sept clés d'un modificateur, le contrat de retour du moteur, la discipline de fonctions pures, la règle de sourcing exclusif à pathfinder-fr.org et le gabarit de traçabilité en quatre parties, à charger avant de lire ou d'écrire quoi que ce soit sous `web/lib/fiche_personnage/`, `web/components/fiche_personnage/` ou `data/regles/`.

---

# pf-fiche-personnage

## Quand charger ce Skill

Charger ce Skill avant de lire ou d'écrire quoi que ce soit sous
`web/lib/fiche_personnage/`, `web/components/fiche_personnage/`,
`web/app/personnages/` ou `data/regles/`, et avant toute décision touchant à la
forme d'un modificateur, au contrat de retour d'une fonction de calcul, ou au
rattachement d'une fiche à un compte.

Ce Skill ne contient aucune valeur de règle Pathfinder. Les valeurs de règle
vivent dans `data/regles/`, produites par des étapes ultérieures du chantier.
Ce Skill tient les conventions, les invariants et les pièges, pour que les
étapes qui l'utilisent, exécutées par des agents sans contexte partagé entre
eux, ne puissent pas inventer des conventions divergentes.

## 1. Nature du produit, un document de référence

La fiche est un document de référence. Elle affiche des valeurs maximales et
des capacités disponibles, jamais un état de partie qui évolue coup après
coup. Sont explicitement interdits, une case d'emplacement de sort dépensé, un
champ de points de vie actuels, un bouton de repos, un décompte de munitions,
un état temporaire activable, une carte d'action, un calcul de charge ou de
poids. Cette liste est fermée. Ajouter une de ces fonctions à une étape
ultérieure serait sortir du périmètre de ce chantier, pas une omission de ce
Skill.

## 2. Les deux entités homonymes

Le piège central du chantier. `personnages` est la table de compte Supabase
qui sert l'éligibilité des dons, sans existence locale propre. Une **fiche**
est le document de référence défini au § 1, locale d'abord, avec son propre
identifiant. Le rattachement `personnageId` sur une fiche est optionnel et
n'est **jamais** dérivé automatiquement, ni de la fiche vers le compte, ni du
compte vers la fiche. Un module qui déduirait l'un de l'autre réintroduirait
une confusion que ce chantier existe pour éviter.

`web/components/fiche/` désigne déjà la fiche d'un sort. Ce nom est pris. La
fiche de personnage vit dans les emplacements suivants, et nulle part
ailleurs.

| Sujet | Emplacement |
|---|---|
| Schéma, moteur, magasin | `web/lib/fiche_personnage/` |
| Composants | `web/components/fiche_personnage/` |
| Routes | `web/app/personnages/` |
| Tables de règles, source | `data/regles/` |
| Tables de règles, export | `web/public/data/regles/` |

## 3. Le tri-état des valeurs, et l'interdiction du zéro par défaut

Toute valeur numérique de la fiche vaut un nombre, ou bien `null` accompagné
du drapeau `introuvable`. Le zéro est une valeur légitime de jeu et ne sert
jamais de valeur par défaut d'un champ vide. Une fonction de calcul dont une
entrée nécessaire est `introuvable` rend `introuvable` à son tour, elle ne
rend jamais un total partiel silencieux, et elle nomme l'entrée manquante
pour que l'interface puisse dire laquelle.

| Situation | Résultat |
|---|---|
| Toutes les entrées connues | un total, et son détail |
| Une entrée nécessaire absente | `introuvable`, plus la liste des entrées manquantes |
| Une entrée facultative absente | le total sans elle, et une contribution notée absente dans le détail |

## 4. Provenance, `source` et `saisieManuelle`

Tout objet issu d'un corpus porte `source` valant `pathfinder-fr` ou
`maison`, et une référence `ref` vers l'entrée du corpus. Toute valeur saisie
à la main porte `saisieManuelle: true`. Ce que le moteur calcule est
**déduit**, jamais **sourcé**. L'interface distingue visuellement les trois
états, sourcé, saisi à la main, déduit.

## 5. Forme canonique d'un modificateur

Une forme unique dans tout le chantier, sept clés, jamais six ni huit.

```
libelle        texte affichable
valeur         entier, jamais null
type           un des types de bonus de data/regles/types_bonus.json
origine        texte, d'où vient le bonus
sourceUrl      URL pathfinder-fr.org, ou null
saisieManuelle booleen
```

## 6. Contrat de retour du moteur

Toute fonction de calcul rend le même triplet, et l'interface n'a jamais à
recomposer un calcul à partir de morceaux.

```
{ total, detail, manquants }
total      nombre, ou null si introuvable
detail     liste de contributions { libelle, valeur, type, retenue, motifEcart }
manquants  liste de noms d'entrées nécessaires absentes
```

`retenue` est un booléen. `motifEcart` explique pourquoi une contribution n'a
pas compté, par exemple parce qu'un bonus de même type plus élevé l'a
supplantée. Écarter une contribution sans motif écrit est interdit.

## 7. Discipline du moteur

Le moteur est fait de fonctions pures. Aucun accès au DOM, aucun accès au
stockage, aucune dépendance vers un composant, aucune date, aucun aléatoire.
Le moteur reçoit la fiche et les tables de règles en arguments, il ne les
importe ni depuis le réseau ni depuis `localStorage`.

## 8. Sourcing, la règle non négociable

pathfinder-fr.org est la seule source de vérité pour toute valeur de règle.
Aucune source anglaise, ni d20pfsrd ni Archives of Nethys. Aucune valeur de
règle écrite de mémoire. Une lacune assumée, écrite `introuvable` avec
l'explication de la tentative réelle, est un résultat acceptable. Une
invention silencieuse est un échec.

## 9. Le livrable de traçabilité

Toute étape du chantier se termine par un bloc en quatre parties, sur le
gabarit suivant.

```
Sourcé
- URL de chaque page lue

Déduit
- méthode de calcul ou de dérivation employée

Inventé
- uniquement du texte narratif ou d'interface, jamais une valeur de règle

Lacunes assumées
- ce qui reste introuvable, et l'explication de la tentative réelle
```

## 10. Règles éditoriales

Le garde automatique est `scripts/verifier_typographie.ts`. Les quatre
interdits qu'il fait respecter, le tiret cadratin en prose, le tiret
demi-cadratin, le deux-points en prose, le point-virgule. Aucune valeur de
jeu du corpus n'est modifiée par une règle éditoriale, seule la présentation
change.

## 11. Références croisées

Pour toute couleur et tout composant, voir `pf-web-design-system`. Pour toute
écriture sous `data/`, voir `pf-corpus-conventions`. Pour la vérification des
conditions de dons, voir `pf-dons-conventions`. Pour la vérification en
exécution réelle, voir `verify`.
