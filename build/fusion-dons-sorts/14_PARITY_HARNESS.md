# 14 — PARITY HARNESS : prouver que le moteur TS dit la même chose que le Python

**Vague 4.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/14-parity-harness`.

## Objectives

Brancher les trois pièces des étapes 02, 08 et 09 en **un garde bloquant** :
le Python vide ses verdicts, le TS vide les siens, le différentiel asymétrique
compare, et `npm run verifier:tout` échoue sur la moindre régression.

C'est l'étape qui transforme « le portage a l'air bon » en fait mesuré. Sans elle,
le plan aurait deux moteurs et aucune raison de croire qu'ils s'accordent.

## Dependencies & Parallelization

- **Vague 4.** Dépend de :
  - **08_EXPORTER** — `tools/dons/vider_verdicts.py` (référence Python) et
    `web/public/data/dons/moteur.json`.
  - **09_TS_MOTEUR** — `scripts/vider_verdicts_ts.ts` (candidat TS).
  - **02_TOOLS** — `scripts/comparer_verdicts.ts` et
    `data/dons/matrice_personnages.json`.
- Parallèle à **13** : disjoint, 13 ne touche pas `tools/`, `scripts/` ni
  `package.json` au-delà de ses propres besoins de test.
- **Ne dépend ni de 10, ni de 11, ni de 12** : la parité est une propriété des
  moteurs, pas de l'interface.

## Inherited Context from Dependencies

### Le contrat `verdicts.jsonl` (figé en 02)

Un JSON compact par ligne, **aucune clé omise**, `ensure_ascii` faux, LF, UTF-8
sans BOM. Ordre de tri **imposé** : `(cle_personnage, nom_don)`, par octets.

| Clé | Type | Sens |
|---|---|---|
| `cle_personnage` | `string` | `"<classe>\|<niveau>\|<race>"`, classe en slug des 42 |
| `nom_don` | `string` | nom exact du catalogue, astérisque comprise |
| `statut` | `"eligible" \| "manual_check" \| "ineligible"` | le verdict |
| `motifs` | `string[]` | **triés** |

### La règle asymétrique — le cœur du garde

| Classe | Python → TS | Verdict CI |
|---|---|---|
| **RÉGRESSION** | `eligible`/`manual_check` → `ineligible` | **échec dur** |
| **RELÂCHEMENT** | `ineligible` → `eligible`/`manual_check` | échec, rapporté à part |
| **BRUIT** | `motifs` seuls diffèrent | avertissement, sortie **0** |

Le seuil est **zéro** pour les deux premières. Cette asymétrie n'est pas une
commodité : *une sous-attribution est bien plus grave qu'une sur-attribution* —
sur-attribuer coûte un `manual_check`, sous-attribuer produit un `ineligible` faux
qui cache le don au joueur **sans recours**.

Et le bruit est délibérément non bloquant : si une reformulation de message faisait
échouer la CI, le garde serait désactivé au premier agacement.

### La matrice

`data/dons/matrice_personnages.json` : **1 260** entrées en profil complet
(42 classes × 5 niveaux `[1,5,10,15,20]` × 6 races), **42** en profil rapide
(42 classes × niveau 6 × humain). Caractéristiques **fixes à 14, jamais
aléatoires** — un générateur aléatoire rendrait un échec non reproductible.
`dons_acquis = []` **explicitement** : `known_feats=None` fait valoir `null` à un
prérequis de don, `known_feats=set()` fait valoir `false`.

Les 6 races couvrent les mécaniques de gating : `humain` (neutre) · `elfe` (arc
long racial) · `nain` (marteau **et** reclassement des armes naines) · `tengu`
(morsure → `anatomy`) · `aasimar` (magie innée → `spellcasting` racial) · `gnome`
(taille P → `size`).

### Ce que `comparer_verdicts.ts` fait déjà (étape 02)

Indexe par `(cle_personnage, nom_don)` ; **échec dur si les ensembles de clés
diffèrent** (« couverture divergente ») ; classe chaque cellule ; imprime par
classe les 20 premiers exemples puis les totaux et la couverture ; sortie 1 si
régression ou relâchement, 0 si seulement du bruit. Il est déjà prouvé contre
quatre fixtures adverses sous `web/fixtures/verdicts/`.

### Coût mesuré

Python : 22 µs/don. Profil complet = 1 260 × 1 417 ≈ **1,8 M** évaluations ≈ 40 s
côté Python, estimé plus rapide côté JS. Profil rapide = 42 × 1 417 = **59 514**
lignes, quelques secondes.

### `npm run verifier:tout`

La cible agrégée existante (racine `package.json`, aux côtés de `check:data`,
`data:export`, `data:derive`, `web:build`, `web:verifier`, `web:test`). **C'est ici
et seulement ici** que le garde est branché — l'étape 02 l'avait explicitement
laissé débranché, parce qu'un garde qui ne peut pas passer se fait désactiver.

## Pseudo-code

```
# package.json (racine)
"dons:verdicts:py" : "python tools/dons/vider_verdicts.py --profil $PROFIL -o build/verdicts/python.jsonl"
"dons:verdicts:ts" : "tsx scripts/vider_verdicts_ts.ts --profil $PROFIL -o build/verdicts/ts.jsonl"
"dons:parite"      : "npm run dons:verdicts:py && npm run dons:verdicts:ts
                      && tsx scripts/comparer_verdicts.ts build/verdicts/python.jsonl
                                                          build/verdicts/ts.jsonl"
"verifier:tout"    : "... existant ... && npm run dons:parite"

# profil par défaut = rapide (local) ; complet en CI
# build/verdicts/ est GITIGNORÉ : ce sont des artefacts, pas des fixtures.
# La seule chose committée est le RAPPORT de la première exécution verte.

# tools/dons/rapport_parite.py   (lisibilité du diagnostic)
lire le rapport du différentiel
grouper les divergences par (classe de personnage, type d'exigence en cause)
    # une divergence portant sur 400 cellules a en général UNE cause
imprimer les groupes du plus gros au plus petit
```

## Logic Flow

1. Produire les deux vidages en profil **rapide**, lancer le différentiel, **lire la
   sortie**.
2. Grouper les divergences par cause avec `rapport_parite.py`. Ne pas corriger
   cellule par cellule : une divergence de 400 cellules a d'ordinaire une cause
   unique dans `evaluerExigence` ou dans un genre de gating.
3. Corriger **le TypeScript**, jamais le Python (voir Notes).
4. Itérer jusqu'à zéro régression et zéro relâchement.
5. Passer en profil **complet** (1 260 personnages), réitérer.
6. Brancher dans `verifier:tout`. Committer le rapport de la première exécution
   verte sous `build/dons/OUTPUT_parite_python_ts.md`.

## Implementation Notes

- **Corriger le TS, jamais le Python.** Le Python est la référence : il est couvert
  par 139 tests, par cinq couches de gating curées à la main et par un banc d'essai
  multi-classes. Si une divergence révèle un **vrai bug côté Python**, ce n'est plus
  cette étape : c'est une décision de curation, à rapporter, pas à trancher ici.
  Modifier la référence pour faire passer le candidat vide le garde de son sens.
- **Ne jamais ajuster le seuil.** Zéro régression, zéro relâchement. Si le compte ne
  tombe pas à zéro, le portage est incomplet — c'est l'information utile.
- **Ne pas « lisser » les motifs.** Le bruit de libellé est admis par construction ;
  réécrire les messages Python pour qu'ils coïncident avec le TS serait travailler
  pour le garde au lieu de travailler pour le joueur.
- **Vérifier la couverture avant les verdicts.** Deux vidages de tailles différentes
  peuvent afficher « 0 divergence » et ne rien comparer. `comparer_verdicts.ts`
  échoue déjà sur une couverture divergente — s'assurer que ce chemin est exercé
  ici, pas seulement testé sur fixture.
- **Le profil rapide en local, le complet en CI.** 40 s à chaque commit local rend
  le garde odieux, donc désactivé. Mais un profil rapide seul ne couvre qu'un niveau
  et une race : la CI doit passer le complet.
- Les causes de divergence les plus probables, à examiner d'abord : la confusion
  `null`/`false` du tri-état · `_normalize` divergent (NFKD) · une classe absente
  d'une table traitée comme « aucune capacité » au lieu d'« inconnue » ·
  `no_class_levels` inversé · le reclassement des armes naines · un
  `couvre_tout_le_segment` non honoré.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `npm run dons:parite` en profil **rapide** → sortie **0**, rapport « 0
   régression, 0 relâchement », couverture **42 personnages × 1 417 dons =
   59 514 cellules** imprimée.
2. Idem en profil **complet** → sortie 0, couverture **1 260 × 1 417 =
   1 785 420 cellules** imprimée. Le nombre est vérifié, pas seulement le succès :
   une couverture silencieusement réduite serait un garde vide.
3. **Le garde est prouvé capable d'échouer** : introduire temporairement une
   inversion dans `evaluerExigence` (par exemple traiter `null` comme `false`) fait
   sortir **1** avec des **RÉGRESSIONS** nommées ; le retirer refait passer. Le
   consigner dans le rapport.
4. Une couverture divergente artificielle (retirer une ligne d'un vidage) → sortie
   **1** avec « couverture divergente », **et non** un rapport de 0 divergence.
5. Une différence de `motifs` seule → sortie **0** avec avertissement. Un test le
   prouve sur une paire fabriquée.
6. `npm run verifier:tout` inclut `dons:parite` et passe de bout en bout.
7. `build/verdicts/` est **gitignoré** ; `git status` est propre après exécution.
8. `build/dons/OUTPUT_parite_python_ts.md` existe et porte : les deux couvertures,
   le compte final par classe de divergence, la preuve d'échec du point 3, et la
   liste des causes de divergence rencontrées **et corrigées** pendant l'étape —
   c'est la note qu'un futur relecteur voudra.
9. `PYTHONPATH=src python -m pytest tests -q` vert (139 dons collectés) ;
   `npm run web:test` vert (662 existants).
10. `git diff` sur `src/pf_dons/` → **zéro** : la référence Python n'a pas bougé.
    C'est le critère qui garantit que le garde mesure quelque chose.

## Git Handling

Branche `fusion/14-parity-harness` depuis `feat/fusion-dons`. Trois commits :

```
feat(outils): harnais de parité Python/TypeScript sur les verdicts d'éligibilité
fix(web): aligner le moteur TS sur la référence Python
docs(dons): rapport de parité — couverture, causes rencontrées, preuve d'échec
```

Le deuxième commit peut être scindé autant que nécessaire : **une cause de
divergence par commit**, jamais un « tout aligné ». Son corps doit nommer la cause
et le nombre de cellules qu'elle expliquait.

Le troisième commit doit rappeler que le seuil est zéro et pourquoi une régression
est un échec dur là où un relâchement est seulement une erreur.

## Expected Outcome

L'équivalence des deux moteurs est **mesurée sur 1,8 million de cellules**, et le
garde est branché dans la cible agrégée avant que l'interface ne s'appuie dessus.
Toute divergence future — un réexport, une table de gating curée, un refactor du
TS — échoue bruyamment au lieu de cacher des dons au joueur.
