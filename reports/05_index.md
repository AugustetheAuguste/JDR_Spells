# Rapport étape 05 — index des sorts uniques

- Généré le : `2026-07-28T22:31:05.603211+00:00`
- Version du constructeur : `1.0.0`

## Totaux

| Métrique | Valeur |
|---|---|
| Entrées de liste lues (19 fichiers) | 8927 |
| Sorts uniques (`id` distincts) | 2070 |
| Ratio uniques / entrées | 0.232 |
| Sorts partagés (`nb_classes` > 1) | 1774 |
| Sorts exclusifs (`nb_classes` == 1) | 296 |
| Sorts à niveaux divergents | 678 |

Contrôle de partition : 1774 + 296 = 2070 (attendu 2070) — OK

## Par classe : total contre exclusifs

| Classe | slug | entrées de liste | sorts exclusifs | part exclusive |
|---|---|---|---|---|
| Alchimiste | `alchimiste` | 275 | 18 | 6.5% |
| Antipaladin | `antipaladin` | 151 | 2 | 1.3% |
| Arcaniste/Ensorceleur/Magicien | `arcaniste-ensorceleur-magicien` | 1225 | 64 | 5.2% |
| Barde | `barde` | 548 | 42 | 7.7% |
| Chaman | `chaman` | 395 | 2 | 0.5% |
| Chasseur | `chasseur` | 512 | 12 | 2.3% |
| Conjurateur | `conjurateur` | 277 | 15 | 5.4% |
| Druide | `druide` | 494 | 11 | 2.2% |
| Hypnotiseur | `hypnotiseur` | 432 | 0 | 0.0% |
| Inquisiteur | `inquisiteur` | 435 | 15 | 3.4% |
| Magus | `magus` | 325 | 1 | 0.3% |
| Médium | `medium` | 287 | 0 | 0.0% |
| Occultiste | `occultiste` | 511 | 1 | 0.2% |
| Paladin | `paladin` | 199 | 30 | 15.1% |
| Prêtre/Prêtre combattant/Oracle | `pretre-pretre-combattant-oracle` | 693 | 31 | 4.5% |
| Psychiste | `psychiste` | 872 | 46 | 5.3% |
| Sanguin | `sanguin` | 243 | 1 | 0.4% |
| Sorcière | `sorciere` | 733 | 4 | 0.5% |
| Spirite | `spirite` | 320 | 1 | 0.3% |

## Distribution du partage

| nb de classes | nb de sorts | |
|---|---|---|
| 1 | 296 | `#####################################` |
| 2 | 284 | `###################################` |
| 3 | 324 | `########################################` |
| 4 | 324 | `########################################` |
| 5 | 258 | `################################` |
| 6 | 189 | `#######################` |
| 7 | 143 | `##################` |
| 8 | 94 | `############` |
| 9 | 68 | `########` |
| 10 | 39 | `#####` |
| 11 | 24 | `###` |
| 12 | 15 | `##` |
| 13 | 5 | `#` |
| 14 | 2 | `#` |
| 15 | 3 | `#` |
| 17 | 2 | `#` |

## Les 25 sorts les plus partagés

| # | sort | nb de classes |
|---|---|---|
| 1 | Dissipation de la magie (`dissipation-de-la-magie`) | 17 |
| 2 | Lecture de la magie (`lecture-de-la-magie`) | 17 |
| 3 | Détection de la magie (`detection-de-la-magie`) | 15 |
| 4 | Détection de la magie suprême (`detection-de-la-magie-supreme`) | 15 |
| 5 | Lumière (`lumiere`) | 15 |
| 6 | Résistance (`resistance`) | 14 |
| 7 | Vision lucide (`vision-lucide`) | 14 |
| 8 | Aperçu lucide (`apercu-lucide`) | 13 |
| 9 | Dissipation suprême (`dissipation-supreme`) | 13 |
| 10 | Force de taureau (`force-de-taureau`) | 13 |
| 11 | Frayeur (`frayeur`) | 13 |
| 12 | Résistance aux énergies destructives (`resistance-aux-energies-destructives`) | 13 |
| 13 | Annulation d'enchantement (`annulation-d-enchantement`) | 12 |
| 14 | Compréhension des langages (`comprehension-des-langages`) | 12 |
| 15 | Détection des charmes (`detection-des-charmes`) | 12 |
| 16 | Détection du poison (`detection-du-poison`) | 12 |
| 17 | Don des langues (`don-des-langues`) | 12 |
| 18 | Hébétement (`hebetement`) | 12 |
| 19 | Immobilisation de personne (`immobilisation-de-personne`) | 12 |
| 20 | Invisibilité (`invisibilite`) | 12 |
| 21 | Invisibilité suprême (`invisibilite-supreme`) | 12 |
| 22 | Protection contre les énergies destructives (`protection-contre-les-energies-destructives`) | 12 |
| 23 | Repli expéditif (`repli-expeditif`) | 12 |
| 24 | Scrutation (`scrutation`) | 12 |
| 25 | Splendeur de l'aigle (`splendeur-de-l-aigle`) | 12 |

## Anomalies

### Doublons intra-classe : 0

Aucun : aucune classe ne liste le même sort à deux niveaux différents.

### Désaccords d'URL : 0

Aucun : chaque `id` porte une URL identique dans tous les fichiers.

## Notes de lecture

- Le champ `ecoles` est un **indice** dérivé du regroupement `<h3>` des pages
  de liste ; il est vide pour les classes dont la page ne regroupe pas par
  école. Ce n'est **pas** une donnée manquante : l'école faisant autorité est
  le champ `École` de la page du sort, extrait à l'étape 07, qui supplante
  cet indice.
- `niveaux_divergents` est une liste de revue, pas une liste d'erreurs : un
  même sort n'a normalement pas le même niveau pour toutes les classes.
- Les libellés multi-classes (`Arcaniste/Ensorceleur/Magicien`,
  `Prêtre/Prêtre combattant/Oracle`) restent **une seule** entrée de classe,
  conformément à la décision consignée dans `00_CONTEXT.md`.
