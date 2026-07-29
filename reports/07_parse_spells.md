# Rapport 07 — Analyse des pages de sorts

Parser : `pf_spells.parse_spells` v1.0.0 — aucun accès réseau.

## Totaux

| Mesure | Valeur |
|---|---:|
| Lignes `data/spell_pages.jsonl` | 2070 |
| Lignes `statut == "ok"` traitées | 2070 |
| Lignes ignorées (statut ≠ ok) | 0 |
| Fichiers écrits | 2070 |
| Fichiers préservés (déjà présents) | 0 |
| Échecs (aucun fichier écrit) | 0 |
| Sorts avec bloc `mythique` | 287 |
| Sorts avec `variantes` | 196 (357 variantes) |
| Sorts avec `autres` non vide | 519 |

## Couverture par champ

| Champ | Renseignés | Couverture |
|---|---:|---:|
| `ecole` | 2070 | 100.00 % |
| `niveaux` | 2070 | 100.00 % |
| `temps_incantation` | 2070 | 100.00 % |
| `composantes` | 2070 | 100.00 % |
| `portee` | 2068 | 99.90 % |
| `cible` | 2061 | 99.57 % |
| `duree` | 2070 | 100.00 % |
| `jet_de_sauvegarde` | 1773 | 85.65 % |
| `resistance_magie` | 1763 | 85.17 % |
| `description` | 2070 | 100.00 % |
| `sources` | 1684 | 81.35 % |
| `description` ≥ 40 caractères | 2070 | 100.00 % |

## Étiquettes inconnues (rangées dans `autres`, jamais perdues)

| Étiquette | Occurrences | Exemples |
|---|---:|---|
| cette option est plus courante chez les sahuagins | 3 | `don-des-profondeurs`, `eau-rouge`, `respiration-d-air` |
| cette option est plus courante chez les troglodytes | 3 | `marque-du-dieu-reptile`, `nuee-de-crocs`, `puanteur-amplifiee` |
| cette option est plus courante chez les hommes-serpents | 2 | `anneau-scinde`, `vol-de-sort` |
| cette option est plus courante chez les goules | 2 | `apparence-charnue`, `terre-affamee` |
| cette option est plus courante chez les trolls | 2 | `epreuve-de-l-acide-et-du-feu`, `transfert-de-regeneration` |
| ce sort est reserve aux personnages de la race bourbierin | 1 | `aura-de-cannibalisme` |
| cette option est plus courante chez les gobelours | 1 | `isoler` |
| ce sort est reserve aux personnages de la race geant du froid | 1 | `nappe-de-glace` |
| cette option est plus courante chez les hommes-lezards | 1 | `toucher-endothermique` |

## Abréviations de niveau non analysées

_Aucune._

## Abréviations de classe rencontrées

| Abréviation | Sorts |
|---|---:|
| `Ens/Mag` | 1221 |
| `Psy` | 877 |
| `Sor` | 733 |
| `Prê` | 692 |
| `Bard` | 548 |
| `Occ` | 513 |
| `Dru` | 494 |
| `Hyp` | 440 |
| `Inq` | 435 |
| `Cham` | 395 |
| `Magus` | 324 |
| `Spi` | 323 |
| `Méd` | 287 |
| `Con` | 276 |
| `Alch` | 275 |
| `ConU` | 257 |
| `San` | 242 |
| `Rôd` | 234 |
| `Pal` | 199 |
| `Apal` | 117 |
| `Antipal` | 33 |
| `Med` | 2 |
| `Mag` | 2 |
| `ensorceleur/magicien` | 1 |
| `prêtre` | 1 |
| `sorcière` | 1 |
| `Rod` | 1 |
| `AntiPal` | 1 |
| `Conj` | 1 |
| `magus 1 Ens/Mag` | 1 |
| `Adepte` | 1 |

## Échecs

_Aucun._

## Notes de conformité

- Le champ `classes` vaut `[]` partout : il est rempli par l'étape 08.
- Les blocs `Mythique` / `Version mythique` sont isolés dans `mythique` et n'apparaissent jamais dans `description`.
- Les variantes (sections « Sorts qui « fonctionnent comme » X ») sont imbriquées dans `variantes` ; aucune ne reçoit de fichier propre écrit par cette étape.
- Les blocs `div.box` qui reproduisent le sort de base (et non des variantes) ne sont pas recopiés : seuls leurs noms sont notés dans `autres["sorts_lies"]`.
- Les fichiers existants ne sont jamais réécrits sans `--overwrite` : les corrections humaines font foi.

## Reproduire

```
PYTHONPATH=src python -m pf_spells.parse_spells
```
