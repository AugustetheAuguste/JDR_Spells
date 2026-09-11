# Rapport — récupération des pages de classe

## Totaux

- Classes du registre : **42**
- Déjà en cache (aucune requête) : **39**
- Récupérées en direct : **1**
- Lacunes : **2**

## Throttle

5 requête(s) réseau, intervalle minimal mesuré entre deux requêtes : 1.000 s (throttle exigé : ≥ 1.0 s).

## Lacunes

| classe | url essayée | url de secours | motif |
|---|---|---|---|
| Cavalier | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Cavalier.ashx` | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Cavalier.ashx` | HTTP 404 |
| Clerc | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Clerc.ashx` | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Clerc.ashx` | HTTP 404 |

## Idempotence

Une seconde exécution ne fait aucune requête réseau : chaque page déjà en cache est servie sans y toucher, cf. `tests/regles/test_recuperer_pages_classes.py`.
