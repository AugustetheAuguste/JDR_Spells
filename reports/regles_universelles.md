# Rapport — tables de règles universelles

## 1. Pages lues

| page | url | date de lecture | sha1 (voir cache/html_regles/index.jsonl) |
|---|---|---|---|
| Caractéristiques | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Caract%C3%A9ristiques.ashx` | 2026-09-07 | cf. index.jsonl |
| Valeurs de combat | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Valeurs%20de%20combat.ashx` | 2026-09-07 | cf. index.jsonl |
| Vocabulaire courant | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Vocabulaire%20courant.ashx` | 2026-09-07 | cf. index.jsonl |
| Tableau récapitulatif des armures | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20armures.ashx` | 2026-09-07 | cf. index.jsonl |

## 2. Bornes réellement lues, rien extrapolé au-delà

- `modificateurs_caracteristiques` : valeurs de caractéristique de **1** à **45**, aucune valeur hors de cet intervalle n'est présente dans `donnees`.
- `sorts_bonus` : modificateur maximal lu **+17**, aucun modificateur au-delà n'est présent dans `donnees` ; les modificateurs négatifs (-5 à -1) sont couverts avec un niveau de sort `null` partout (« impossible de lancer des sorts liés à cette caractéristique »), jamais un zéro.
- `armures` : toutes les entrées de la table publiée sont reprises verbatim, aucune armure supplémentaire n'a été ajoutée.

## 3. `cumulable` resté `null`

La page « Valeurs de combat » ne tranche le cumul explicitement que pour le bonus d'esquive (`cumulable: true`). Pour les types suivants, le texte lu ne dit rien du cumul entre bonus du même type au-delà de la règle générale du glossaire (« les bonus de même type ne se cumulent pas : seul le bonus le plus élevé s'applique ») — laissé `null` plutôt que déduit :
  - Bonus d’altération
  - Bonus de parade
  - Bonus d’armure naturelle
  - Bonus de taille

## 4. Lacunes

Aucune des quatre tables n'a dû être livrée vide : les quatre pages visées portaient effectivement la table ou le glossaire attendu.

## Recherche des pages canoniques

Aucune page unique du wiki ne porte une table complète des types de bonus avec une colonne de cumul pour chaque type (compétence, chance, sacré, profane, moral, etc.) — seule la page « Valeurs de combat » (anciennement « CA », qui y redirige) énumère des bonus nommés avec leur effet, dont un seul (l'esquive) est explicitement dit cumulable. La règle générale de non-cumul entre bonus de même type vient du glossaire « Vocabulaire courant », entrée « Bonus ». `types_bonus.json` porte donc deux sources, consignées toutes deux dans `meta.sources`, et ne retient que les cinq types effectivement nommés sur ces deux pages — aucun type absent (compétence, chance, sacré/profane, moral, racial, résistance…) n'a été ajouté de mémoire.
