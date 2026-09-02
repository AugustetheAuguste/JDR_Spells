# Étape 14 — harnais de parité Python/TypeScript des verdicts d'éligibilité aux dons

## Ce que le garde vérifie

`npm run dons:parite` (orchestré par `scripts/dons_parite.ts`) vide les verdicts
Python (`tools/dons/vider_verdicts.py`) et TypeScript
(`scripts/vider_verdicts_ts.ts`) sur le même profil de la matrice de
personnages, puis les compare avec `scripts/comparer_verdicts.ts` selon la
règle asymétrique :

- **RÉGRESSION** (eligible/manual_check → ineligible) : échec dur, seuil zéro.
- **RELÂCHEMENT** (ineligible → eligible/manual_check) : échec, seuil zéro.
- **BRUIT** (motifs seuls diffèrent) : avertissement, sortie 0.

Profil `rapide` par défaut en local (42 personnages × 1417 dons) ; profil
`complet` posé par la CI (`PROFIL=complet`, 1260 × 1417).

## Couverture (premier run vert)

| Profil    | Personnages | Dons | Cellules comparées |
|-----------|-------------|------|---------------------|
| rapide    | 42          | 1417 | 59 514              |
| complet   | 1260        | 1417 | 1 785 420           |

Les deux runs affichent :

```
RÉGRESSION (eligible/manual_check -> ineligible) : 0
RELÂCHEMENT (ineligible -> eligible/manual_check) : 0
```

Profil complet, totaux finaux :

```
totaux : 0 régression(s), 0 relâchement(s), 424913 bruit(s)
couverture : 1260 personnage(s), 1417 don(s), 1785420 cellule(s) comparée(s)
```

Profil rapide, totaux finaux :

```
totaux : 0 régression(s), 0 relâchement(s), 14571 bruit(s)
couverture : 42 personnage(s), 1417 don(s), 59514 cellule(s) comparée(s)
```

## Cause de divergence rencontrée et corrigée

**Une seule cause racine** expliquait la totalité des 485 régressions
observées lors du premier run (profil rapide) — pas dans le moteur TS, mais
dans le producteur Python de cette même vague,
`tools/dons/vider_verdicts.py::_construire_character` :

> `engine.py::evaluate_requirement` (type `ABILITY_SCORE`) lit
> `character.ability_scores` avec la clé **abrégée et capitalisée** que le
> parser écrit dans `payload["ability"]` (`"For"`, `"Dex"`, `"Con"`, `"Int"`,
> `"Sag"`, `"Cha"` — voir `parser.py`, `m.group(1).capitalize()`). Le
> producteur construisait ce dictionnaire avec les noms français complets
> (`"force"`, `"dexterite"`, …), qui ne correspondent à aucune clé jamais
> interrogée. Chaque prérequis de score de caractéristique retombait donc
> systématiquement sur `None` (`manual_check`), pour les 42×1417 (puis
> 1260×1417) cellules de la matrice — silencieusement, puisque `manual_check`
> ne fait pas planter la CI.
>
> `verdicts.ts::construirePersonnage` fait, lui, cette conversion
> (`ABREVIATION_PAR_CARACTERISTIQUE`) depuis le début. En comparant les deux
> dumps, le moteur TS — qui évalue *correctement* le score fourni (14 dans
> toute la matrice) contre le seuil du don — se retrouvait à trancher
> (`true`/`false`) des cellules que le producteur Python de référence ne
> tranchait jamais, d'où 485 « régressions » apparentes en profil rapide
> (bien plus en profil complet).

**Corrigé dans `tools/dons/vider_verdicts.py` uniquement** (jamais dans
`src/pf_dons/engine.py` ni `src/pf_dons/parser.py`, tous deux byte-identiques
à avant cette vague — `git diff src/pf_dons/` est vide) : le dictionnaire
`caracteristiques` passé à `engine.Character` utilise désormais les mêmes
clés abrégées que le moteur attend. Cette correction a fait passer le
différentiel de 485 régressions à 0, sans toucher un seul octet du moteur
d'éligibilité de référence.

Cellules concernées par cette cause : 485 (profil rapide) — la totalité des
régressions observées à ce stade. Aucune autre cause de régression ou de
relâchement n'a été trouvée à aucun des deux profils.

Aucun bug n'a été trouvé dans `src/pf_dons/engine.py` ou `src/pf_dons/parser.py`
eux-mêmes ; le moteur TS (`web/lib/dons/moteur.ts`) s'est avéré, dès le
premier différentiel véritablement comparable (après la correction du
producteur), déjà fidèle à sa référence sur les deux profils.

## Le bruit restant (14 571 / 424 913 cellules, non bloquant)

Deux formes de bruit, jamais « lissées » pour faire passer le garde :

1. **Casse du nom de classe dans les motifs** — Python capitalise
   `character.character_class` (`"Alchimiste"`) via
   `classes_unifiees.charger_classes()`, quand le dump TS utilise le slug brut
   de la matrice (`"alchimiste"`). Même verdict, texte différent — c'est
   exactement la définition du bruit du contrat (I3), pas une divergence de
   logique.
2. **Ordre d'évaluation des exigences** — quand plusieurs exigences sont
   chacune `false` indépendamment (ex. « Appel à la trêve » : un don
   prérequis absent ET un score de Cha insuffisant), les deux moteurs
   court-circuitent sur la première `false` rencontrée, mais l'ordre dans
   lequel les exigences sont énumérées côté JSON du contrat (TS) peut différer
   de l'ordre du texte `Conditions` brut (Python). Le statut final (`ineligible`)
   est identique dans tous les cas observés ; seul le motif cité change.

## Preuve d'échec du garde (critère de vérification #3)

Le garde a été volontairement cassé puis réparé, sans laisser de trace dans
l'historique :

1. Dans `web/lib/dons/moteur.ts::evaluerDon`, la ligne qui accumule un
   verdict `null` dans `motifsManuel` a été temporairement remplacée par un
   retour immédiat `{ statut: 'ineligible', ... }` — une inversion tri-état
   directe (`null` traité comme `false`).
2. `npm run dons:parite` (profil rapide) a alors produit :
   ```
   RÉGRESSION (eligible/manual_check -> ineligible) : 3883
   RELÂCHEMENT (ineligible -> eligible/manual_check) : 0
   totaux : 3883 régression(s), 0 relâchement(s), 15785 bruit(s)
   ```
   Sortie du process : **1**.
3. Le fichier a été restauré à l'identique (`cp` depuis une sauvegarde prise
   avant la modification). Re-run : `0 régression(s), 0 relâchement(s)`,
   sortie **0**. `git diff web/lib/dons/moteur.ts` est vide après restauration.

## Preuve de la garde de couverture (critère #4)

Une ligne a été retirée d'un vrai dump TS complet (`tail` inversé, `head -n
-1`), puis comparée au dump Python complet (tailles différentes, 59514 vs
59513 lignes). Résultat :

```
ÉCHEC — couverture divergente — 1 clé(s) présentes seulement côté référence
(ex: tueur|6|humain / Œil mystique)
```

Sortie du process : **1**. Le différentiel ne rapporte jamais faussement
« 0 divergence » sur une couverture trouée — la garde de couverture (I3, avant
tout calcul de divergence) se déclenche avant même de comparer une seule
cellule.

## Preuve du bruit non bloquant (critère #5)

Paire fabriquée, même statut, motifs différents :

```json
{"cle_personnage":"a|1|b","nom_don":"X","statut":"eligible","motifs":[]}
{"cle_personnage":"a|1|b","nom_don":"X","statut":"eligible","motifs":["motif reformulé"]}
```

```
BRUIT (motifs seuls diffèrent) : 1
totaux : 0 régression(s), 0 relâchement(s), 1 bruit(s)
```

Sortie du process : **0**.

## Suites de tests

- `PYTHONPATH=src python -m pytest tests/dons -q` : **165 passed** (le chiffre
  de « 139 tests » du plan était celui d'un état antérieur du dépôt ; la
  suite `tests/dons/` a grandi depuis).
- `PYTHONPATH=src python -m pytest tests -q` (suite complète du dépôt,
  `pf_spells` inclus) : 1309 passed, 24 skipped, 14 failed, 7 errors — les
  échecs et erreurs sont tous dans `tests/test_build_manifest.py`,
  `tests/test_classes.py`, `tests/test_docs.py` et `tests/test_fetch_classes.py`
  (côté `pf_spells`, `FileNotFoundError` sur des caches HTML absents de ce
  worktree) : **aucun rapport avec `pf_dons`** ni avec ce chantier ; `tests/dons/`
  seul est vert.
- `npm run web:test` : 37 fichiers, **805 tests passed**, lint et typecheck
  verts.

## `git diff src/pf_dons/`

Vide — confirmé après chaque étape de ce chantier, y compris après la
preuve d'échec du garde (qui n'a modifié que `web/lib/dons/moteur.ts`, jamais
`src/pf_dons/`).
