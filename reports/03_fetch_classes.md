# Rapport 03 — Récupération des pages de listes de sorts par classe

## Totaux

- Classes uniques traitées : **19**
- Récupérées en direct (réseau) : **0**
- Servies depuis le cache : **19**
- En échec : **0**
- Doublons écartés à l'entrée : **1**

## Roster

| classe | slug | statut | taille (octets) | from_cache |
|---|---|---|---|---|
| Alchimiste | `alchimiste` | ok | 129,864 | oui |
| Antipaladin | `antipaladin` | ok | 100,113 | oui |
| Arcaniste/Ensorceleur/Magicien | `arcaniste-ensorceleur-magicien` | ok | 373,000 | oui |
| Barde | `barde` | ok | 189,242 | oui |
| Chaman | `chaman` | ok | 154,019 | oui |
| Chasseur | `chasseur` | ok | 188,138 | oui |
| Conjurateur | `conjurateur` | ok | 127,608 | oui |
| Druide | `druide` | ok | 183,393 | oui |
| Hypnotiseur | `hypnotiseur` | ok | 159,072 | oui |
| Inquisiteur | `inquisiteur` | ok | 167,591 | oui |
| Magus | `magus` | ok | 141,329 | oui |
| Médium | `medium` | ok | 125,792 | oui |
| Occultiste | `occultiste` | ok | 188,546 | oui |
| Paladin | `paladin` | ok | 112,932 | oui |
| Prêtre/Prêtre combattant/Oracle | `pretre-pretre-combattant-oracle` | ok | 236,035 | oui |
| Psychiste | `psychiste` | ok | 262,015 | oui |
| Sanguin | `sanguin` | ok | 121,113 | oui |
| Sorcière | `sorciere` | ok | 238,982 | oui |
| Spirite | `spirite` | ok | 133,974 | oui |

## Entrées dédoublonnées

Le fichier d'entrée `elements_to_do.json` contient 20 entrées pour 19 pages uniques. Dédoublonnage par URL percent-décodée et minusculée, la première occurrence gagne :

| label écarté | conservé à la place | raison | url écartée |
|---|---|---|---|
| Alchimiste | Alchimiste | url_key en doublon | `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Liste%20des%20formules%20dalchimiste.ashx` |

## Échecs

Aucun échec. Les 19 pages sont en cache, décodables en UTF-8, ≥ 20 000 octets et contiennent `id="PageContentDiv"`.

## Idempotence

Une seconde exécution de cette étape ne déclenche aucune requête réseau : `from_cache` vaut `oui` pour les 19 classes et `cache/index.jsonl` reste inchangé.
