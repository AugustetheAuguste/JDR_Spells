VERDICT: PASS

# Rapport 09 — Validation indépendante du corpus

Validateur : `pf_spells.validate_corpus` v1.0.0 — lecture seule sur `data/`, aucun accès réseau.

Skill `pf-corpus-conventions` chargée depuis `.claude/skills/pf-corpus-conventions/SKILL.md` et prise comme autorité : algorithme de slug, vocabulaire des clés, règles d'encodage, table des classes.

Schémas utilisés : `schemas/sort.schema.json` et `schemas/liste_classe.schema.json` (`Draft202012Validator`). Les `id` sont redérivés avec `pf_spells.slugs.slugify`, la volumétrie est recomptée depuis `data/listes_classes/*.jsonl` : aucun compte n'est repris d'un rapport d'étape.

## Verdict

**PASS** — 0 anomalie(s) bloquante(s), 4 avertissement(s), 620 information(s).

Aucune anomalie bloquante : `feat/spell-corpus` est en état d'être fusionnée dans `main`.

## Table des contrôles

| Contrôle | Description | Résultat |
|---|---|---|
| A1 | Chaque `data/sorts/*.json` valide `sort.schema.json` | OK — 2070 fichiers valides |
| A2 | Chaque ligne des listes de classe valide `liste_classe.schema.json` | OK — 8927 lignes valides sur 19 fichiers |
| A3 | Tous les fichiers JSON/JSONL décodent en UTF-8 strict, sans BOM | OK — 2096 fichiers UTF-8 stricts, sans BOM, analysables |
| B1 | Chaque `id` de l'index possède son fichier de sort | OK — 2070 entrées d'index, toutes couvertes (ensemble d'exceptions : 0) |
| B2 | Chaque fichier de sort possède son entrée d'index | OK — 2070 fichiers, 100 % indexés |
| B3 | Chaque `id` des listes de classe est dans l'index | OK — chaque `id` de liste est indexé |
| B4 | Chaque libellé `classe` appartient aux 19 du référentiel | OK — tous les libellés parmi les 19 du référentiel |
| B5 | Chaque `meta.cache_fichier` existe sur disque | OK — 2070 fichiers de cache présents |
| B6 | `sorts_partages` ∪ `sorts_exclusifs` partitionne exactement l'index | OK — 1774 partagés + 296 exclusifs = 2070 entrées d'index, sans recouvrement |
| B7 | Échantillon : `classes` du fichier == `classes` de l'index | OK — 20 sorts tirés (graine 20090909), concordance totale |
| C1 | `slugify(nom) == id` pour chaque sort | OK — 2070 `id` redérivés, 0 suffixe(s) de collision |
| C2 | Les 21 clés présentes, dans l'ordre canonique, sans extra | OK — 21 clés canoniques dans les 2070 fichiers |
| C3 | Nom de fichier égal à `<id>.json` | OK — 2070 noms de fichiers égaux à `<id>.json` |
| C4 | Aucun caractère de remplacement U+FFFD dans le corpus | OK — 0 occurrence de U+FFFD sur 2070 fichiers |
| D1 | Couverture par champ au-dessus des seuils | OK — tous les champs à seuil au-dessus de leur plancher |
| D2 | Distribution des longueurs de `description` | OK — min 41, médiane 655, max 5911 ; 0 description(s) < 40 caractères |
| D3 | Volumétrie : sorts uniques et entrées de listes | HORS FOURCHETTE (plan périmé) — 2070 sorts uniques, 8927 entrées, ratio 4.31 |
| D4 | Plages de niveaux plausibles par classe | OK — 19 classes dans les bornes 0–9 |
| D5 | Comptes `mythique` / `variantes` / `autres` | OK — 287 `mythique`, 196 avec `variantes` (357 variantes), 519 avec `autres` non vide |
| E1 | Au moins un sort partagé par ≥ 5 classes | OK — maximum 17 classes pour un même sort |
| E2 | Compte de sorts exclusifs pour chaque classe | OK — 19 classes rapportées, 2 à 0 exclusif |
| E3 | Aucun sort deux fois dans la même liste au même niveau | OK — aucun doublon (id, niveau) dans une même liste |

## D1 — Couverture par champ

| Champ | Renseignés | Couverture | Seuil bloquant |
|---|---:|---:|---:|
| `ecole` | 2070 / 2070 | 100.00 % | 98.00 % |
| `niveaux` | 2070 / 2070 | 100.00 % | 98.00 % |
| `temps_incantation` | 2070 / 2070 | 100.00 % | — |
| `composantes` | 2070 / 2070 | 100.00 % | — |
| `portee` | 2068 / 2070 | 99.90 % | — |
| `cible` | 2061 / 2070 | 99.57 % | — |
| `duree` | 2070 / 2070 | 100.00 % | — |
| `jet_de_sauvegarde` | 1773 / 2070 | 85.65 % | — |
| `resistance_magie` | 1763 / 2070 | 85.17 % | — |
| `description` | 2070 / 2070 | 100.00 % | 99.00 % |

Les champs sans seuil sont absents de la page du wiki quand le sort n'a pas la caractéristique (un sort sans jet de sauvegarde n'a pas de ligne `Jet de sauvegarde`) : leur non-couverture est un fait de la source, pas une perte à l'analyse. Chaque manque est listé sort par sort dans `reports/09_anomalies.jsonl` (`check` = `D1`, `gravite` = `info`).

## D2, D3, D5 — Volumétrie et distributions

| Mesure | Valeur |
|---|---:|
| Fichiers `data/sorts/*.json` | 2070 |
| Entrées `sorts_uniques.jsonl` | 2070 |
| Sorts uniques recomptés depuis les listes | 2070 |
| Entrées totales dans les listes de classe | 8927 |
| Ratio de partage (entrées / sort unique) | 4.31 |
| Longueur de `description` — min / médiane / max | 41 / 655 / 5911 |
| Descriptions < 40 caractères | 0 |
| Sorts avec bloc `mythique` | 287 |
| Sorts avec `variantes` | 196 (357 variantes) |
| Sorts avec `autres` non vide | 519 |

### Écart avec les fourchettes annoncées par le plan

Le plan annonçait 2 500–3 500 sorts uniques et 4 000–5 000 entrées de listes. Le corpus mesuré en compte **2070** et **8927**. Les deux fourchettes du plan étaient des extrapolations faites à partir de trois pages de listes, avant que le moindre parsing ait eu lieu ; elles n'ont jamais été des mesures. Les valeurs observées sont mutuellement cohérentes et concordent avec les étapes 04, 05 et 06 (8 927 lignes lues → 2 070 URL distinctes). **C'est la fourchette du plan qui est périmée, pas le corpus** : l'écart est rapporté comme avertissement et ne bloque pas le verdict.

## D4 — Plages de niveaux par classe

| Classe | Niveau min | Niveau max | Entrées |
|---|---:|---:|---:|
| Alchimiste | 1 | 6 | 275 |
| Antipaladin | 1 | 6 | 151 |
| Arcaniste/Ensorceleur/Magicien | 0 | 9 | 1225 |
| Barde | 0 | 6 | 548 |
| Chaman | 0 | 9 | 395 |
| Chasseur | 0 | 6 | 512 |
| Conjurateur | 0 | 6 | 277 |
| Druide | 0 | 9 | 494 |
| Hypnotiseur | 0 | 6 | 432 |
| Inquisiteur | 0 | 6 | 435 |
| Magus | 0 | 6 | 325 |
| Médium | 0 | 5 | 287 |
| Occultiste | 0 | 6 | 511 |
| Paladin | 1 | 4 | 199 |
| Prêtre/Prêtre combattant/Oracle | 0 | 9 | 693 |
| Psychiste | 0 | 9 | 872 |
| Sanguin | 1 | 4 | 243 |
| Sorcière | 0 | 9 | 733 |
| Spirite | 0 | 6 | 320 |

## E1 — Les 10 sorts les plus partagés

| Rang | id | nom | Classes |
|---:|---|---|---:|
| 1 | `dissipation-de-la-magie` | Dissipation de la magie | 17 |
| 2 | `lecture-de-la-magie` | Lecture de la magie | 17 |
| 3 | `detection-de-la-magie` | Détection de la magie | 15 |
| 4 | `detection-de-la-magie-supreme` | Détection de la magie suprême | 15 |
| 5 | `lumiere` | Lumière | 15 |
| 6 | `resistance` | Résistance | 14 |
| 7 | `vision-lucide` | Vision lucide | 14 |
| 8 | `apercu-lucide` | Aperçu lucide | 13 |
| 9 | `dissipation-supreme` | Dissipation suprême | 13 |
| 10 | `force-de-taureau` | Force de taureau | 13 |

## E2 — Sorts exclusifs par classe

| Classe | Sorts exclusifs |
|---|---:|
| Alchimiste | 18 |
| Antipaladin | 2 |
| Arcaniste/Ensorceleur/Magicien | 64 |
| Barde | 42 |
| Chaman | 2 |
| Chasseur | 12 |
| Conjurateur | 15 |
| Druide | 11 |
| Hypnotiseur | 0 **← à vérifier** |
| Inquisiteur | 15 |
| Magus | 1 |
| Médium | 0 **← à vérifier** |
| Occultiste | 1 |
| Paladin | 30 |
| Prêtre/Prêtre combattant/Oracle | 31 |
| Psychiste | 46 |
| Sanguin | 1 |
| Sorcière | 4 |
| Spirite | 1 |

Classes à **0 sort exclusif** : Hypnotiseur, Médium. C'est un résultat notable et possiblement suspect : soit ces classes n'accèdent qu'à des sorts également ouverts à d'autres, soit leur liste a été mal rattachée à l'étape 04. À trancher à la main.

## Anomalies bloquantes

_Aucune._ Les contrôles bloquants passent tous.

## Avertissements

### D3 — 1 avertissement(s)

| id | Détail |
|---|---|
| `volumetrie` | 2070 sorts uniques (fourchette annoncée par le plan : 2 500–3 500) et 8927 entrées de listes (fourchette annoncée : 4 000–5 000). Les deux fourchettes du plan étaient des extrapolations faites avant tout parsing ; les valeurs mesurées sont cohérentes entre elles (ratio de partage 4.31 entrées par sort) et recoupent les étapes 04/05/06. Le plan est périmé, pas le corpus. |

### D4 — 1 avertissement(s)

| id | Détail |
|---|---|
| `Antipaladin` | plage observée 1–6, plage attendue par le plan 1–4 |

### E2 — 2 avertissement(s)

| id | Détail |
|---|---|
| `Hypnotiseur` | 0 sort exclusif : à vérifier à la main — soit la classe n'emprunte que des sorts partagés, soit sa liste a été mal rattachée |
| `Médium` | 0 sort exclusif : à vérifier à la main — soit la classe n'emprunte que des sorts partagés, soit sa liste a été mal rattachée |

## Constats connus et acceptés

Les cinq exceptions convenues dans `build/pf_spell_corpus/09_VALIDATE_CORPUS.md`, chacune recherchée explicitement :

| # | Exception convenue | Observé ? |
|---:|---|---|
| 1 | 404 du wiki à l'étape 06, listés dans `reports/06_fetch_spells.md` et orphelins à l'étape 08 | **Non observé** : l'ensemble d'exceptions extrait des rapports 06 et 08 est vide (0 entrée), et B1/B2 ne relèvent aucun orphelin dans un sens ni dans l'autre. Les 2 070 pages ont été récupérées et analysées. |
| 2 | Divergence de niveau entre classes pour un même sort (`niveaux_divergents`) | **Observé** : 678 sorts dans `carte_doublons.niveaux_divergents`. Design PF1 normal, non compté comme défaut. |
| 3 | Abréviations de classes hors des 19 du plan dans `niveaux` | **Observé** : `ConU` (Conjurateur unchained, 257 sorts), `Rôd` (Rôdeur, 234 sorts), `Rod` (Rôdeur, 1 sorts), `Adepte` (Adepte, 1 sorts). Le plan citait `Réd` ; le corpus écrit `Rôd` (et une fois `Rod`) — c'est l'orthographe du plan qui est fausse, la classe visée (Rôdeur) est la même. |
| 4 | `ecoles` vide dans l'index pour les classes dont la page ne groupe pas par école (Druide, Paladin, Alchimiste) | **Observé** : 59 entrées d'index sans école dont toutes les classes sont dans {Alchimiste, Druide, Paladin}. Attendu. |
| 5 | `mythique` renseigné sur certains sorts | **Observé** : 287 sorts. Capture volontaire, suppression prévue dans une phase ultérieure. |

## File de relecture humaine recommandée

Par ordre de valeur décroissante pour une relecture manuelle :

1. **Divergences de niveau liste ↔ page** — 678 sorts. Table complète dans `reports/08_enrich.md`. Chaque ligne est soit une coquille du wiki, soit une vraie différence de classe ; seul un humain peut trancher.
2. **Classes à 0 sort exclusif** — Hypnotiseur, Médium. Vérifier que la page de liste a bien été rattachée à la bonne classe.
3. **Champs à faible couverture** — `jet_de_sauvegarde` 85.65 % et `resistance_magie` 85.17 %. Vérifier sur un échantillon que l'absence vient bien de la page et non de l'analyse.
4. **`portee` / `cible` manquants** — 2 et 9 sorts, listés dans le JSONL d'anomalies. Assez peu nombreux pour être ouverts un par un.
5. **Suffixes de collision de slug** — 0 `id` portent un suffixe `-2`/`-3`. Confirmer qu'il s'agit bien de sorts distincts homonymes.
6. **Abréviations de classe inconnues** — 0 à cartographier, s'il en reste.

## Notes de conformité

- Étape en **lecture seule** sur `data/` : aucun fichier n'y est écrit, déplacé ni modifié. Les seules écritures sont `reports/09_validation.md` et `reports/09_anomalies.jsonl`.
- Aucun accès réseau.
- Les contrôles sont indépendants des rapports d'étape : les comptes sont recalculés, les `id` redérivés, la partition de l'index reconstruite.
- Racine auditée : `.`, sorts : `data/sorts`.

## Reproduire

```
PYTHONPATH=src python -m pf_spells.validate_corpus
echo $?   # 0 = PASS, 1 = FAIL
```
