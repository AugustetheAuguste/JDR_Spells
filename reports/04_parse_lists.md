# Rapport 04 — Analyse des listes de sorts par classe

Parser : `pf_spells.parse_lists` v1.0.0 — aucun accès réseau.

**19 classes analysées, 8927 entrées au total.**

## Compte par classe

| Classe | Fichier | Entrées | Niveaux | Écoles |
|---|---|---:|---|---|
| Arcaniste/Ensorceleur/Magicien | `data/listes_classes/arcaniste-ensorceleur-magicien.jsonl` | 1225 | 0:29, 1:168, 2:208, 3:201, 4:175, 5:135, 6:100, 7:93, 8:60, 9:56 | 9 école(s), 0 ligne(s) sans école |
| Psychiste | `data/listes_classes/psychiste.jsonl` | 872 | 0:25, 1:121, 2:170, 3:122, 4:123, 5:93, 6:75, 7:60, 8:45, 9:38 | aucune (`ecole` = null partout) |
| Sorcière | `data/listes_classes/sorciere.jsonl` | 733 | 0:16, 1:106, 2:142, 3:126, 4:102, 5:71, 6:55, 7:51, 8:37, 9:27 | aucune (`ecole` = null partout) |
| Prêtre/Prêtre combattant/Oracle | `data/listes_classes/pretre-pretre-combattant-oracle.jsonl` | 693 | 0:17, 1:102, 2:136, 3:109, 4:98, 5:80, 6:53, 7:33, 8:35, 9:30 | aucune (`ecole` = null partout) |
| Barde | `data/listes_classes/barde.jsonl` | 548 | 0:21, 1:113, 2:148, 3:103, 4:72, 5:45, 6:46 | aucune (`ecole` = null partout) |
| Chasseur | `data/listes_classes/chasseur.jsonl` | 512 | 0:16, 1:122, 2:118, 3:102, 4:77, 5:38, 6:39 | aucune (`ecole` = null partout) |
| Occultiste | `data/listes_classes/occultiste.jsonl` | 511 | 0:25, 1:85, 2:107, 3:94, 4:96, 5:53, 6:51 | 8 école(s), 0 ligne(s) sans école |
| Druide | `data/listes_classes/druide.jsonl` | 494 | 0:16, 1:88, 2:88, 3:85, 4:66, 5:47, 6:42, 7:23, 8:19, 9:20 | aucune (`ecole` = null partout) |
| Inquisiteur | `data/listes_classes/inquisiteur.jsonl` | 435 | 0:15, 1:87, 2:103, 3:86, 4:76, 5:38, 6:30 | aucune (`ecole` = null partout) |
| Hypnotiseur | `data/listes_classes/hypnotiseur.jsonl` | 432 | 0:18, 1:87, 2:113, 3:82, 4:58, 5:44, 6:30 | aucune (`ecole` = null partout) |
| Chaman | `data/listes_classes/chaman.jsonl` | 395 | 0:17, 1:64, 2:63, 3:59, 4:58, 5:42, 6:30, 7:25, 8:21, 9:16 | aucune (`ecole` = null partout) |
| Magus | `data/listes_classes/magus.jsonl` | 325 | 0:15, 1:71, 2:68, 3:61, 4:47, 5:31, 6:32 | aucune (`ecole` = null partout) |
| Spirite | `data/listes_classes/spirite.jsonl` | 320 | 0:16, 1:45, 2:48, 3:65, 4:57, 5:55, 6:34 | aucune (`ecole` = null partout) |
| Médium | `data/listes_classes/medium.jsonl` | 287 | 0:20, 1:63, 2:101, 3:57, 4:45, 5:1 | aucune (`ecole` = null partout) |
| Conjurateur | `data/listes_classes/conjurateur.jsonl` | 277 | 0:12, 1:40, 2:48, 3:69, 4:44, 5:37, 6:27 | aucune (`ecole` = null partout) |
| Alchimiste | `data/listes_classes/alchimiste.jsonl` | 275 | 1:49, 2:71, 3:58, 4:43, 5:31, 6:23 | aucune (`ecole` = null partout) |
| Sanguin | `data/listes_classes/sanguin.jsonl` | 243 | 1:69, 2:58, 3:64, 4:52 | aucune (`ecole` = null partout) |
| Paladin | `data/listes_classes/paladin.jsonl` | 199 | 1:67, 2:53, 3:40, 4:39 | aucune (`ecole` = null partout) |
| Antipaladin | `data/listes_classes/antipaladin.jsonl` | 151 | 1:40, 2:48, 3:32, 4:30, 6:1 | aucune (`ecole` = null partout) |

## Anomalies

### Collisions de slug

_Aucun._

### Incohérences nom ↔ URL

_Aucun._

### `<li>` ignorés

285 au total — tous sont les puces de navigation du bandeau d'introduction commun à toutes les pages (aucune n'apparaît après un titre de niveau).

- 285 × aucun <b><i><a class=pagelink>

Échantillon de textes ignorés :

- `Action « Lancer un sort »`
- `Construire et modifier des créatures artificielles`
- `La magie divine`
- `La magie profane`
- `La magie psychique`
- `Lancer des sorts`
- `Les duels de sorts`
- `Les grimoires`
- `Les mots de pouvoir
Les mots cibles
Les mots effets
Les méta mots
Liste des mots de pouvoirs par classe`
- `Les pouvoirs spéciaux`
- `Lier un extérieur`
- `Liste alphabétique des sorts (de A à D, de E à O, de P à Z)`
- `Liste des sorts par registre`
- `Listes des sorts par classe
Alchimiste : 1 2 3 4 5 6
Antipaladin : 1 2 3 4
Arc/Ens/Mag : 0 1 2 3 4 5 6 7 8 9
Barde : 0 1 2 3 4 5 6
Chaman : 0 1 2 3 4 5 6 7 8 9
`
- `Présentation des sorts`
