# 09 — TS MOTEUR : porter l'évaluateur tri-état en TypeScript

**Vague 3.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/09-ts-moteur`.

## Objectives

Écrire `web/lib/dons/moteur.ts` : l'évaluateur d'éligibilité côté client, **fidèle
au tri-état de `engine.py`**, plus les cinq dérivations du graphe. Et
`web/lib/dons/verdicts.ts`, qui vide le même `verdicts.jsonl` que le Python pour
que l'étape 14 les compare.

**Le parseur n'est pas porté.** Ses 337 lignes de regex française restent en
Python ; le moteur TS consomme les conditions **déjà analysées** de `moteur.json`.

## Dependencies & Parallelization

- **Vague 3.** Dépend de :
  - **06_ENGINE_DATA_CONTRACT** — `data/schemas/moteur_dons.schema.json` et
    `web/fixtures/moteur_dons.json`, contre lesquels tout est écrit et testé.
  - **02_TOOLS** — le contrat `verdicts.jsonl` et `data/dons/matrice_personnages.json`.
- **Ne dépend PAS de 08.** C'est l'objet même du contrat : l'exporteur et le
  moteur sont écrits simultanément contre la fixture, et confrontés en 14.
- Parallèle à **08**, **10**, **11**, **12** : écrit uniquement sous
  `web/lib/dons/`.

## Inherited Context from Dependencies

### Ce qui est porté, et ce qui ne l'est pas

`src/pf_dons/engine.py` fait 621 lignes et contient **exactement une** regex —
`_DEITY_PREFIX_RE`, un retrait de préfixe (`^suivant\s+(?:de\s+la\s+|de\s+l'|
de\s+|du\s+|des\s+|d')`). Tout le reste est consultation de dictionnaires,
recherche de sous-chaîne et logique tri-état. C'est ce qui rend le portage
tractable, et c'est la raison pour laquelle **`parser.py` reste en Python**.

Fonctions à porter (ordre de `engine.py`) : `class_grants_magic`,
`race_grants_magic`, `creature_affinity_allows`, `_proficiency_verdict`,
`_normalize`, `magie_inaccessible`, `_gating_verdict`, `evaluate_requirement`,
`evaluate_or_group`, `evaluate_feat`, `filter_feats`.

Dérivations à porter depuis `tools/dons/exporter_arbre_dons.py` :
`calculer_vagues`, `calculer_couts`, `construire_graphe`, `calculer_leviers`,
`calculer_voies`.

### Le tri-état — la règle dont tout dépend

`evaluate_requirement` renvoie `true` (satisfait), `false` (non satisfait) ou
**`null` (indéterminable)**. `null` n'est **jamais** « faux ».

- `OrGroup` : satisfait si une option est `true` ; sinon `null` si au moins une
  option est `null` ; sinon `false`. Les options `payload.fragment` sont écartées
  **d'abord**, **sauf si toutes** les options sont des fragments.
- `evaluate_feat` court-circuite en `ineligible` au **premier** `false` ; sinon
  accumule les motifs `null` et renvoie `manual_check` s'il y en a, sinon
  `eligible`.
- Un hit de gating qui couvre **tout** le segment et est satisfait rend l'exigence
  `true` au lieu de retomber en `manual_check` (`couvre_tout_le_segment`).
- Un `false` de gating court-circuite l'exigence entière ; sinon les motifs
  pendants l'emportent sur les satisfaits.

En TypeScript : `type Verdict = true | false | null` — **pas** `boolean | undefined`.
`undefined` et `null` se confondent trop facilement à travers un `?.` ou un
`JSON.parse`, et confondre `null` avec « faux » produit un `ineligible` faux.

### Les cas particuliers qui sont des correctifs, à ne pas « simplifier »

- **`implied_classes`** : classe du personnage absente → `false` ; présente →
  `null` (le détail interne de la capacité reste non vérifié).
- **`no_class_levels`** : un segment `aucun niveau dans …` produit un hit dont le
  `param` liste les classes **exclues**. Le traiter comme `implied_classes`
  inverserait la règle (« aucun niveau dans une classe dotée de panache » ferait
  *exiger* d'être bretteur).
- **`caster_level`** : `false` — et non `null` — quand `magie_inaccessible`. Ce
  helper est volontairement conservateur : vrai seulement si la classe est
  **connue et explicitement non-lanceuse** **et** que la race n'accorde pas la
  magie. La valeur numérique du NLS reste non dérivable.
- **Classe inconnue ≠ aucune maîtrise.** `chasseur de vampire` est absente de
  `class_proficiencies.json` exprès → `null`, jamais `ineligible`.
- **`RACE_WEAPON_RECLASSIFICATION`** : le nain traite toute arme « naine » comme
  arme de guerre au lieu d'exotique, **à condition** que la classe ait les armes
  martiales. Sans ce mécanisme, un Guerrier nain était refusé à tort sur « Frappe
  de la vipère jaillissante ». Ces deux tables raciales sont publiées comme
  données par l'étape 06 : **les lire**, ne pas les recopier dans le TS.
- **`_ANATOMY_SYNONYMS` en phrases longues** (« attaque de morsure ») : un synonyme
  court comme « langue » matchait le trait universel « Langues ». Ne pas raccourcir.

### `known_feats` : la nuance sémantique qui décale une vague entière

`calculer_vagues` passe un `known_feats` **explicite**, jamais `null` : un
prérequis de don non possédé vaut alors `false` au lieu de `null`, donc un don
gated sur un don non pris est rangé dans une vague ultérieure au lieu d'être
annoncé accessible. Pour un Guerrier 6 : **234** accessibles immédiatement contre
482 vus par `filter_feats`. Reproduire exactement ce comportement.

### `cout` n'est pas la vague

La vague est une **borne inférieure**. Un don exigeant deux prérequis distincts de
vague 1 coûte **3**, pas 2. `calculer_couts` calcule la fermeture des prérequis
manquants en dédupliquant les branches partagées, et retient l'alternative la
moins chère pour un OU.

### `construire_graphe` est appelée **deux fois** — l'invariant à préserver

Sur le catalogue (1 417) **et** sur le sous-ensemble atteignable (≈459). Calculer
les leviers sur l'un et les afficher à côté de l'autre produisait 94 nœuds à levier
surévalué, 13 nœuds sans arête et 2 voies nommées d'après un don non retenu —
désormais 0/0/0. `levier` (dans la vue) et `levier_catalogue` sont **deux champs
distincts**, et l'écart est affiché comme information, pas caché.

### Le `Character` à reproduire

```
character_class: string; level: number; race?: string; size?: string
ability_scores?: Record<string, number>; known_feats?: Set<string>
skill_ranks?: Record<string, number>; alignment?: string; deity?: string
// dérivés : bba, effective_size (taille explicite, sinon celle de la race),
//           racial_trait_text ("nom | description" normalisé, null si race inconnue)
```

**`skill_rank` est optimiste** : sans `skill_ranks` explicite, il renvoie `level`,
donc tous les prérequis de rangs passent. Défendable pour un dépistage (« ce
personnage *pourrait*-il qualifier ? »), PF1 n'ayant pas de malus hors-classe.
**Porter ce comportement tel quel** — le changer ferait diverger le différentiel
sans qu'aucune décision ait été prise. L'arbitrage explicite est l'étape 16.

### Le contrat `verdicts.jsonl` (de 02)

Un JSON compact par ligne, aucune clé omise, LF, UTF-8 sans BOM, trié par
`(cle_personnage, nom_don)` en octets. Clés : `cle_personnage`
(`"<classe>|<niveau>|<race>"`), `nom_don`, `statut`, `motifs` (triés).

### Budget de performance

22 µs/don en Python ; une fermeture 3 vagues sur 1 417 dons coûte **95 ms** en
Python, estimée **10-40 ms en JS**. Aucune optimisation prématurée : mesurer
d'abord. Pas de budget chiffré opposable — le dépôt les a retirés.

## Pseudo-code

```
# web/lib/dons/types.ts     — types du contrat 06, aucun `any`
type Verdict = true | false | null
type Statut  = 'eligible' | 'manual_check' | 'ineligible'

# web/lib/dons/moteur.ts
evaluerExigence(exigence, perso, tables) -> {verdict, motif?}
    switch exigence.type:   # les 13 RequirementType
      ability_score: score absent -> null ; sinon comparaison
      bba, level, level_exact, class_level, size, skill_ranks, feat, race, class
      caster_level: magieInaccessible(perso) ? false : null
      class_feature_text | unparsed:
          verdictsDeGating(...)  puis  implied_classes  puis  null
evaluerGroupeOu(groupe, ...)   # fragments écartés sauf si tous
evaluerDon(don, perso, tables) -> {statut, motifs}
    court-circuit au premier false
filtrerDons(catalogue, perso) -> groupé et trié par statut

# web/lib/dons/graphe.ts
calculerVagues(catalogue, perso, slots)   # known_feats EXPLICITE
calculerCouts(...)                        # fermeture dédupliquée, min sur les OU
construireGraphe(catalogue, restreintA?)  # appelée deux fois
calculerLeviers(...)                      # levier + levierCatalogue + debloque
calculerVoies(...)                        # voie + voieTaille

# web/lib/dons/verdicts.ts  (+ scripts/vider_verdicts_ts.ts)
viderVerdicts(matrice, moteurJson) -> JSONL au format de 02
```

## Logic Flow

1. Lire `engine.py` **en entier** avant d'écrire une ligne. Le porter fonction par
   fonction, dans l'ordre, en gardant les noms français.
2. Écrire les types depuis le schéma de 06, pas depuis le Python.
3. Tester chaque fonction contre `web/fixtures/moteur_dons.json`.
4. Porter les dérivations du graphe, tester l'invariant du double appel.
5. Écrire le vidage de verdicts. **Ne pas le comparer au Python ici** : c'est
   l'étape 14, et confondre les deux ferait ajuster le moteur jusqu'à ce qu'il
   passe au lieu de le rendre correct.

## Implementation Notes

- **Le tri-état d'abord.** Écrire les tests du tri-état avant l'implémentation :
  c'est le seul endroit du plan où une erreur produit silencieusement des
  `ineligible` faux, la panne que tout le dépôt combat.
- **`Set<string>` pour `known_feats`**, avec noms **normalisés** au même
  `_normalize` (NFKD, retrait des combinants, minuscules) que le Python. Une
  normalisation divergente fait rater une jointure de prérequis en silence.
- **Ne pas réimplémenter le parseur**, ni « juste un petit bout » pour un cas
  gênant. Si une condition manque, elle manque au contrat de 06 : le signaler.
- **Ne pas inventer de règle absente du Python.** Toute divergence, même
  manifestement « meilleure », casse le différentiel et sera à défaire.
- TypeScript strict, **aucun `any`**. Identifiants français pour le domaine,
  commentaires anglais disant **pourquoi**.
- Aucun `node:fs` dans le graphe client : la leçon de
  `web/lib/donnees/index-web.ts`, séparé de `lire-index.ts` précisément parce que
  `node:fs` dans le graphe client cassait le build. Le vidage de verdicts est un
  script `tsx` séparé, il peut lire le disque.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `npm --prefix web run typecheck` vert, **zéro `any`** — `grep -n ": any\|as any"`
   sur `web/lib/dons/` → zéro.
2. Un test par `RequirementType` — **13 tests**, chacun couvrant `true`, `false`
   et `null`. Un test compte les 13 et échoue à 12.
3. Tests dédiés, un par cas particulier ci-dessus : `implied_classes` absent →
   `false` / présent → `null` · `no_class_levels` non inversé · `caster_level`
   `false` seulement si la classe est connue non-lanceuse **et** la race sans
   magie · classe absente de `maitrises` → `null` et **jamais** `ineligible` ·
   reclassement des armes naines (Guerrier nain accepté sur une arme naine) ·
   fragment écarté sauf si tous · `couvre_tout_le_segment` satisfait → `true`.
4. `evaluerDon` court-circuite : un test avec deux exigences dont la première vaut
   `false` assert que la seconde **n'est pas évaluée** (espion).
5. `calculerVagues` avec `known_feats` explicite donne **strictement moins** de
   dons en vague 1 que `filtrerDons` sur le même personnage — un test l'assert,
   parce que c'est la différence sémantique que le plan repose dessus.
6. Un don à deux prérequis distincts de vague 1 a un `cout` de **3**, pas 2.
7. Invariant du double appel : sur la fixture, **zéro** nœud à levier supérieur à
   son degré sortant dans le graphe restreint, **zéro** nœud sans arête dans le
   graphe, **zéro** voie nommée d'après un don non retenu.
8. `npx tsx scripts/vider_verdicts_ts.ts --profil rapide` produit un JSONL trié,
   relançable à l'octet identique, au **format exact** de 02 (un test valide les
   quatre clés et l'ordre de tri).
9. `npm run web:test` vert, **662 tests existants toujours passants**.

## Git Handling

Branche `fusion/09-ts-moteur` depuis `feat/fusion-dons`. Quatre commits :

```
feat(web): types du moteur des dons, dérivés du contrat de données
feat(web): évaluateur tri-état des dons porté depuis engine.py
feat(web): dérivations du graphe — vagues, coûts, leviers, voies
feat(outils): vidage TS des verdicts au format du différentiel
```

Le corps du deuxième commit doit énoncer que `null` signifie « indéterminable » et
jamais « faux », et pourquoi le parseur n'est pas porté : 337 lignes de regex
française contre 621 lignes d'évaluateur qui n'en contiennent qu'une.

## Expected Outcome

L'éligibilité se calcule dans le navigateur, sans serveur ni base, et son
équivalence au Python est **mesurable** par l'étape 14 plutôt que supposée.
