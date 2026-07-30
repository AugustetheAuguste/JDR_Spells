# Rapport 08 — Enrichissement classes / niveaux

Enrichisseur : `pf_spells.enrich_spells` v1.0.0 — aucun accès réseau, aucune analyse HTML.

## Totaux

| Mesure | Valeur |
|---|---:|
| Fichiers `data/sorts/*.json` | 2070 |
| Fichiers enrichis (`classes` non vide) | 2070 (100.00 %) |
| Entrées dans `sorts_uniques.jsonl` | 2070 |
| Orphelins sur disque (fichier sans entrée d'index) | 0 |
| Orphelins d'index (entrée sans fichier) | 0 |
| Paires (sort, classe) examinées | 8927 |

## Concordance entre liste de classe et page du sort

Les deux sources sont indépendantes : la liste de classe donne le niveau, la page du sort le redonne via ses abréviations. Un désaccord est un **constat**, jamais corrigé automatiquement.

| Résultat | Paires | Part |
|---|---:|---:|
| Concordantes | 8409 | 94.20 % |
| Divergentes | 0 | 0.00 % |
| Niveau de page inconnu (`niveau_page: null`) | 518 | 5.80 % |

**Taux de concordance sur les paires comparables : 100.00 %** (8409 / 8409).

## Orphelins

Aucun fichier `data/sorts/*.json` sans entrée d'index — les `id` des étapes 04/05/07 sont cohérents.

Aucune entrée d'index sans fichier : l'étape 06 n'a signalé aucun échec de récupération, et l'étape 07 aucun échec d'analyse — les deux ensembles d'exceptions sont donc vides et concordent.

## Divergences de niveau

0 paire(s) où la liste de classe et la page du sort ne donnent pas le même niveau. Table complète :

_Aucune._

## Abréviations inconnues

Abréviations rencontrées sur une page de sort sans correspondance dans `pf_spells.classes.CLASS_ABBREV` ni dans la table hors-liste.

_Aucune._

## Abréviations hors des 19 classes du plan — attendues, pas des erreurs

`elements_to_do.json` couvre 19 classes ; Pathfinder 1e en compte davantage. Les abréviations ci-dessous désignent des classes absentes de la liste d'entrée : leur présence dans `niveaux` est **normale et attendue**, ce ne sont pas des anomalies. Elles n'alimentent aucune entrée `classes`, faute de classe correspondante dans le périmètre.

| Abréviation | Classe | Sorts |
|---|---|---:|
| `ConU` | Conjurateur unchained | 257 |
| `Rôd` | Rôdeur | 234 |
| `Rod` | Rôdeur | 1 |
| `Adepte` | Adepte | 1 |

## Classes sans abréviation sur les pages de sorts

Une classe du périmètre dont aucune abréviation n'apparaît sur les pages ne peut jamais être recoupée : toutes ses paires ont `niveau_page: null` et `concordance: null`.

| Classe | Paires non comparables |
|---|---:|
| Chasseur | 512 |

## Classes revendiquées par la liste mais absentes de la page

La classe possède bien une abréviation ailleurs dans le corpus, mais aucune de ses abréviations n'apparaît sur cette page-ci : la liste de classe revendique le sort, la page ne le confirme pas. Ce n'est ni une concordance ni une divergence — `concordance: null` — et le pipeline s'arrête là : les deux sources sont conservées côte à côte, sans qu'un arbitrage soit rendu ni attendu.

| id | nom | classe | niveau liste | abréviations de la page |
|---|---|---|---:|---|
| `adaptation-culturelle` | Adaptation culturelle | Médium | 1 | `Bard`, `Ens/Mag`, `Prê` |
| `adaptation-culturelle` | Adaptation culturelle | Occultiste | 1 | `Bard`, `Ens/Mag`, `Prê` |
| `adaptation-culturelle` | Adaptation culturelle | Psychiste | 1 | `Bard`, `Ens/Mag`, `Prê` |
| `protection-contre-les-sorts` | Protection contre les sorts | Psychiste | 8 | `Conj`, `Ens/Mag` |
| `rejeter-la-faute` | Rejeter la faute | Sorcière | 3 | `Bard`, `Ens/Mag`, `Hyp`, `Psy` |
| `toucher-de-combustion` | Toucher de combustion | Sanguin | 1 | `Dru`, `Ens/Mag`, `Inq`, `Psy`, `Sor`, `magus` |

## Écarts internes aux libellés combinés

_Aucun._

## Notes de conformité

- Seule la clé `classes` est réécrite ; tout le reste du fichier est conservé tel quel, les corrections humaines font foi.
- L'étape est idempotente : relancée, elle recalcule la même valeur et laisse les fichiers octet pour octet identiques.
- Les libellés combinés (`Arcaniste/Ensorceleur/Magicien`, `Prêtre/Prêtre combattant/Oracle`) sont résolus depuis n'importe laquelle de leurs abréviations membres : `Ens 3` **concorde** avec `Arcaniste/Ensorceleur/Magicien 3`.
- Les divergences ne sont jamais corrigées automatiquement.
- Table d'abréviations chargée depuis `pf_spells.classes`, non redéclarée ici.

## Reproduire

```
PYTHONPATH=src python -m pf_spells.enrich_spells --dry-run
PYTHONPATH=src python -m pf_spells.enrich_spells
```
