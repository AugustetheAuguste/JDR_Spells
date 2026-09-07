# Rapport — récupération des pages de règles universelles

## Pages

| slug | nom | url | statut | sha1 |
|---|---|---|---|---|
| caracteristiques | Caractéristiques | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Caract%C3%A9ristiques.ashx` | cache | 6c71e21f889efbc08daf835f316e5c2cf8f9c427 |
| tableau-recapitulatif-des-armures | Tableau récapitulatif des armures | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20armures.ashx` | cache | b469be0aeec25f2a4d3d58145ddbbe7c1302934c |
| valeurs-de-combat | Valeurs de combat | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Valeurs%20de%20combat.ashx` | cache | 58928ee59d6b894b7a133f06000c8c587a09513a |
| vocabulaire-courant | Vocabulaire courant | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Vocabulaire%20courant.ashx` | cache | 7d3ee0a9501a51c3c78bfb1c501f223c64992087 |

## Throttle

0 requête réseau cette exécution — rien à mesurer.

## Lacunes

Aucune. Toutes les pages ont été obtenues.

## Idempotence

Une seconde exécution ne fait aucune requête réseau : chaque page déjà en cache est servie sans y toucher, cf. `tests/regles/test_recuperer_pages_regles.py`.
