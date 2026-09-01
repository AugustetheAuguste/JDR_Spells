# 17 — DOCS AND DECOMMISSION : une seule documentation, un seul dépôt

**Vague 6.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/17-docs-and-decommission`.

## Objectives

Clore la fusion :

1. Absorber `Dons/CLAUDE.md` dans `JDR_Spells/CLAUDE.md`, sans perdre une règle.
2. Réconcilier les Skills des deux dépôts.
3. Consigner les décisions dans `DECISIONS.md`.
4. Supprimer `Dons/web/` (l'explorateur vanilla, remplacé).
5. Archiver le dépôt `Dons` — **après** confirmation humaine, pas avant.

## Dependencies & Parallelization

- **Vague 6.** Dépend de **toutes** les étapes précédentes : elle documente ce qui
  existe. C'est la seule étape du plan dont la dépendance « tout ce qui précède »
  est légitime, parce que son objet *est* l'ensemble.
- Aucune parallélisation : elle est seule dans sa vague.

## Inherited Context from Dependencies

### Les deux `CLAUDE.md`

`JDR_Spells/CLAUDE.md` (16 694 octets) est le fichier **hôte**. Ses sections
load-bearing, à ne pas diluer :

- **§11** — « Next.js App Router, TypeScript, Tailwind, `output: 'export'` : *aucune
  base, aucune route d'API, rien à l'exécution*… Si le déploiement réclame un
  secret, c'est le symptôme, pas la configuration. »
- **§4** — l'algorithme de slug (`œ`/`æ` pré-mappés **avant** NFKD).
- **§9** — les libellés combinés « jamais scindés ». **À amender** : l'étape 03 les a
  rétrogradés en *identité de liste de sorts* ; ils cessent d'être la classe du
  personnage, tout en restant une page du wiki. La règle tient, son objet a changé.
- **B4** — `niv` est **toujours** une table classe → niveau, jamais un scalaire.
- **§12** — interdiction de peupler `__init__.py` et d'ajouter `__all__`.
- La pile de fournisseurs vit **uniquement** dans `Fournisseurs.tsx` ; `signOut` est
  **`scope: 'local'`** ; l'état des filtres vit dans l'URL et nulle part ailleurs
  avec `{scroll: false}` ; **aucun budget de poids** (retirés le 2026-08-26 par
  arbitrage humain — le poids est mesuré et imprimé, jamais opposé à un seuil).

`build/dons/CLAUDE_dons_origine.md` (déposé par l'étape 04) est la source à
absorber. Son contenu essentiel, à faire vivre dans l'hôte :

- Le pipeline **CSV → conditions analysées → évaluation → résultats groupés**.
- **`paths.py` est le seul endroit où l'emplacement d'un fichier de données est
  écrit.**
- Les **cinq couches de gating** curées à la main, plus le signal de restriction par
  texte d'avantage (6ᵉ, jamais appliqué automatiquement : **1 vrai positif pour
  49 candidats**).
- Les **9 genres bloquants** / **6 non bloquants**, et les 31 entrées `proficiency`
  réparties en **18** bloquantes (arme nommée) / **13** non bloquantes (choix du
  joueur non tracé — limite **assumée**, pas lacune).
- Le **tri-état** : `null` = « indéterminable », jamais « faux ».
- **`repair_benefits`** : 127 lignes réparées, 1 417 dons, **zéro** prérequis de don
  pendant ; chaînes de profondeur 2 passées de 123 à 177, de profondeur 3 de 25 à 48.
- **La maxime** : *une sous-attribution est bien plus grave qu'une
  sur-attribution* — sur-attribuer coûte un `manual_check`, sous-attribuer produit un
  `ineligible` faux qui cache le don au joueur sans recours.
- Les limites connues : `skill_rank` **optimiste**, les 6 entrées
  `class_ability_unmapped`, `polyvalence` à `conditionnel` pour **61 %** des dons.
- Le principe du double appel à `construire_graphe` (94/13/2 → 0/0/0).
- `chasseur de vampire` : classe inconnue ≠ aucune maîtrise.

### Ce qui a changé et doit être **réécrit**, pas recopié

| Dans l'ancien | Dans le nouveau |
|---|---|
| `pf1_dons/` | `src/pf_dons/` |
| `Data/` | `data/` |
| `python -m pf1_dons.cli` | `python -m pf_dons.cli` |
| `scripts/*.py` | `tools/dons/` |
| `scrappers/` | `scrappers/dons/` |
| `web/explorateur_dons.js` + `web/index.html` | `/dons` et `/dons/<slug>` (Next.js) |
| `web/test_explorateur.js` (jsdom) | les tests vitest des étapes 10, 13, 15 |
| l'export par personnage (`exporter_arbre_dons.py`) | l'index global + le moteur TS |

**L'architecture a changé** : Python analyse et exporte, TypeScript évalue. Le
`CLAUDE.md` fusionné doit énoncer cette frontière et **pourquoi** : 44 520
combinaisons classe × niveau × race (~35 h, ~33 Go) rendaient la précalcul
indisponible, tandis que `parser.py` ne voit jamais le personnage et `engine.py`
ne contient **qu'une seule** regex sur 621 lignes.

### Les Skills à réconcilier

Existants dans `JDR_Spells` : `pf-bedrock-batch`, `pf-corpus-conventions`,
`pf-enrichment-conventions`, `pf-web-design-system`, `verify`.
Créés par l'étape 01 : `pf-dons-conventions`, `pf-dons-taxonomie`,
`verify-dons-python` (la collision de nom avec `verify` y a été résolue).

Clause de tous les Skills du dépôt, à conserver : « Si le code et ce Skill
divergent, le Skill gagne et le code est corrigé. »

### L'artefact périmé (I7) — la raison d'être de la suppression

`Dons/web/exemple_guerrier.json` (757 443 octets) était committé et **périmé** : il
annonçait 459 retenus / 234 accessibles / 225 à planifier / 178 isolés, là où une
exécution fraîche aux mêmes paramètres donne **445 / 229 / 216 / 176**. C'est
exactement ce que `tools/verifier_derive_dons.py` (étape 02) empêche désormais.
Le supprimer avec le reste de `Dons/web/`.

## Pseudo-code

```
# 1. CLAUDE.md fusionné — structure
   garder les sections de JDR_Spells dans leur ordre
   amender §9  : les libellés combinés = identité de LISTE DE SORTS
   ajouter §13 : « Le corpus des dons »
        pipeline, paths.py, les 6 couches de gating, le tri-état,
        la frontière Python/TypeScript et sa justification chiffrée,
        les limites connues, la maxime de sous-attribution
   ajouter §14 : « Les deux corpus et leur clé de jointure »
        classes_unifiees.json, 42 -> 19, lanceur et liste_sorts indépendants,
        « clerc » marqué à curer
   ajouter §15 : « Le garde de parité »
        verdicts.jsonl, la règle asymétrique, seuil zéro, profils rapide/complet

# 2. DECISIONS.md — une entrée par arbitrage, datée, avec l'alternative écartée
   - architecture statique + évaluateur TS (contre : Python à l'exécution)
   - 42 classes clé primaire (contre : 19)
   - parseur non porté
   - manual_check jamais filtré par défaut
   - skill_rank laissé optimiste, déclaré à l'utilisateur
   - « clerc » non tranché
   - aucun budget de poids (rappel, décision antérieure)

# 3. Skills
   vérifier que chaque Skill nommé dans les étapes 01-16 existe
   vérifier qu'aucun nom n'est en collision
   ajouter à chaque Skill des dons un pointeur vers §13 du CLAUDE.md

# 4. Suppression
   git rm -r Dons/web/      (dans l'ancien dépôt) — ou simplement ne jamais l'avoir
                             déplacé, cf. étape 04 : il n'existe pas dans la cible
   vérifier qu'aucun fichier de JDR_Spells ne référence explorateur_dons.js

# 5. Archivage du dépôt Dons — NE PAS EXÉCUTER SANS ACCORD EXPLICITE
   produire la CHECKLIST, l'afficher, s'arrêter
```

## Logic Flow

1. Lire les deux `CLAUDE.md` **en entier**, et les notes
   `build/dons/OUTPUT_*.md` (elles portent le raisonnement, avec les bugs concrets
   corrigés).
2. Rédiger le fichier fusionné. Vérifier règle par règle qu'aucune n'a disparu.
3. Rédiger `DECISIONS.md`.
4. Auditer les Skills.
5. Vérifier l'absence de référence à l'ancien explorateur.
6. Produire la checklist d'archivage et **s'arrêter là**.

## Implementation Notes

- **Absorber, pas concaténer.** Deux documents collés produisent des règles
  contradictoires que personne ne remarque. Chaque règle des dons doit trouver sa
  place dans la structure de l'hôte, réécrite au présent de l'architecture actuelle.
- **Ne pas perdre une règle en la « simplifiant ».** Les passages qui semblent
  verbeux — `_ANATOMY_SYNONYMS` en phrases longues, le reclassement des armes
  naines, `chasseur de vampire` — sont chacun la trace d'un bug réel. Un
  `CLAUDE.md` qui les résume en « le gating est curé à la main » perd exactement ce
  qui sert.
- **Conserver `build/dons/OUTPUT_*.md`.** Ce sont les notes de raisonnement, pas de
  la documentation périmée. Le `CLAUDE.md` doit y **pointer**, non les remplacer.
- **L'archivage du dépôt `Dons` est une action irréversible et hors du dépôt
  cible : la préparer, l'expliquer, et demander confirmation.** Ne pas la commettre
  au nom du plan.
- Ne pas modifier de code fonctionnel dans cette étape. Si la documentation révèle
  un écart avec le code, le **signaler** ; le corriger est une autre étape.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `CLAUDE.md` fusionné : un test de couverture documentaire (script simple) vérifie
   la présence de chaque terme load-bearing — `output: 'export'`, `scope: 'local'`,
   `paths.py`, les **9** genres bloquants nommés, les **6** non bloquants,
   `manual_check`, « sous-attribution », `repair_benefits`, `chasseur de vampire`,
   `classes_unifiees.json`, `verdicts.jsonl`, `skill_rank`. Un terme manquant fait
   échouer.
2. **Aucune référence obsolète** : `grep -rn "pf1_dons\|explorateur_dons\|exemple_guerrier\|Data/"`
   sur tout le dépôt hors `build/dons/` → **zéro**.
3. §9 est **amendé** et non supprimé : les libellés combinés restent « jamais
   scindés » en tant qu'identité de liste de sorts. Un test cherche les deux notions.
4. `DECISIONS.md` porte **au moins sept** entrées datées, chacune nommant
   l'alternative écartée. Une décision sans alternative écartée n'est pas une
   décision documentée.
5. Chaque Skill nommé dans les étapes 01-16 **existe** sous
   `.claude/skills/<nom>/SKILL.md` : un script les énumère depuis les fichiers de
   plan et vérifie. **Aucune collision de nom.**
6. Chaque Skill porte la clause « Si le code et ce Skill divergent, le Skill gagne
   et le code est corrigé ».
7. `Dons/web/` n'existe pas dans le dépôt cible, et aucun fichier n'y renvoie.
8. La **checklist d'archivage** est écrite dans `build/dons/OUTPUT_archivage.md`,
   avec ce qui doit être vérifié avant (historique git préservé par les `git mv` de
   l'étape 04, `git log --follow src/pf_dons/engine.py` remonte avant la fusion,
   139 tests collectés, parité verte), et **elle n'est pas exécutée**.
9. `npm run verifier:tout` **entièrement vert** : `check:data`, les deux contrats de
   dons, `web:build`, `web:verifier`, `web:test` (662 + nouveaux),
   `dons:parite` (profil complet), plus
   `PYTHONPATH=src python -m pytest tests -q` (139 dons collectés).
10. `python tools/verifier_derive_dons.py` sort **0** : les artefacts web sont à jour
    avec les données. C'est la clôture de I7.

## Git Handling

Branche `fusion/17-docs-and-decommission` depuis `feat/fusion-dons`. Quatre
commits :

```
docs: absorber la documentation des dons dans CLAUDE.md
docs: consigner les sept arbitrages de la fusion dans DECISIONS.md
docs(skills): réconcilier les Skills des deux dépôts et leurs pointeurs
docs(dons): checklist d'archivage du dépôt d'origine, à exécuter sur accord
```

Puis la **PR unique** `feat/fusion-dons` → `main`, avec `npm run verifier:tout`
vert. Son corps doit résumer : la frontière Python/TypeScript et sa justification
chiffrée, la couverture du garde de parité, et les trois limites assumées
(`skill_rank` optimiste, les 13 `proficiency` dépendant d'un choix du joueur, les 6
`class_ability_unmapped`).

## Expected Outcome

Un dépôt, deux corpus, une documentation qui dit la vérité sur l'architecture
actuelle et **conserve** la raison d'être de chaque règle héritée. Les décisions
sont datées avec leur alternative écartée, les Skills ne se contredisent pas, et
l'archivage du dépôt d'origine attend une décision humaine plutôt que de se faire
au nom d'un plan.
