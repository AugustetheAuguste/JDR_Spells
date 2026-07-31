# Fixture web — 24 sorts, 3 classes

Corpus miniature **gelé**, dérivé du corpus réel par
`python tools/build_web_fixture.py`. Il permet aux cinq étapes de la Vague 3 de
travailler en parallèle contre un jeu de données figé conforme au même contrat,
sans attendre l'export réel.

**Gelé veut dire gelé.** Ce dossier ne se régénère pas pendant les tests. Un
test qui casse parce que le wiki a changé est un mauvais test : il signale un
événement extérieur, pas une régression du code. Le script existe pour que la
sélection soit reproductible et auditable, pas pour être rejoué en intégration
continue.

## Ce que la fixture couvre, et pourquoi

| Cas | Pourquoi il est là |
|---|---|
| 24 sorts, 3 classes (`barde`, `druide`, `occultiste`) | trio choisi pour se recouper assez (33 sorts communs dans le corpus réel) pour que la vue de comparaison ait du sens, tout en gardant des exclusifs à chacun |
| 4 sorts partagés par les 3 classes | l'intersection de la vue de comparaison |
| 15 sorts accordés par une seule classe | les sections d'exclusifs |
| niveau 0 et niveau 9 | les deux bornes du filtre de niveau |
| noms avec apostrophe (`Aire de l'aigle`) | le cas d'en-tête du contrat de pliage |
| noms accentués (`Affaiblissement des énergies destructives`) | le pliage des diacritiques |
| un nom de 53 caractères | la pression de mise en page sur la table dense |
| 14 sorts sans jet de sauvegarde | le rendu d'un `null` qui n'est pas un `—` |
| les 9 familles d'école | la pastille d'école a plus d'une couleur à rendre |
| 20 sorts enrichis sur 24 | une fiche sans enrichissement ne doit rendre **aucune** section vide |
| **1 désaccord de niveau** | voir ci-dessous |

## Le désaccord de niveau est SYNTHÉTIQUE

`detection-de-la-magie` porte, pour le barde, un `niveau_page` supérieur d'un
cran au `niveau` de la liste de classe, et `concordance: false`. **Cette valeur
a été fabriquée par le script d'assemblage.**

Le corpus réel ne peut pas la fournir : ses 8 409 paires classe/page
comparables concordent toutes, les 518 restantes n'étant pas comparables (la
page ne donne pas de niveau pour cette classe). C'est l'anomalie connue
consignée dans `CLAUDE.md` § 9 — divergences **constatées, jamais corrigées**,
et ici il n'y en a aucune à constater.

L'interface doit pourtant rendre ce cas : c'est le différenciateur du site face
au wiki, et une fixture sans ligne `d: true` laisserait ce chemin de code
partir en production sans test. Le désaccord est donc injecté ici, et nulle
part ailleurs — `data/` n'est jamais modifié.

## Régénérer

```
python tools/build_web_fixture.py
PYTHONPATH=src python -m pf_spells.export_web \
    --racine tests/fixtures/web_corpus --sortie web/fixtures \
    --sans-preflight --genere-le "2026-07-31T00:00:00+00:00"
```

À ne faire que délibérément, en committant le résultat et en relisant ce que la
sélection a changé. `--sans-preflight` est nécessaire : la garde d'entrée vérifie
la forme du dépôt complet, pas celle d'un corpus de 24 sorts.
