# 00 — CONTEXT : fusion du corpus de dons dans l'application des sorts

## Project Overview

Deux dépôts Pathfinder 1e francophones, tous deux alimentés par
pathfinder-fr.org, doivent devenir **une seule application**.

| | `C:\Users\adoyet\Desktop\Dons` (source) | `C:\Users\adoyet\Desktop\JDR_Spells` (destination) |
|---|---|---|
| Domaine | 1 417 **dons** + moteur d'éligibilité | 2 070 **sorts** |
| Python | `pf1_dons/` 1 979 LOC, 139 tests pytest | `src/pf_spells/` pipeline 10 étapes |
| Web | `web/` 1 040 LOC JS vanille (IIFE), 1 test jsdom | Next.js 16 / React 19 / TS strict / Tailwind 4, **662 tests vitest** |
| Backend | aucun | Supabase : auth, `profils`, `personnages`, `listes` (RLS) |
| Déploiement | aucun (`python -m http.server`) | Vercel, `output: 'export'`, aucun runtime |

**`JDR_Spells` est la destination.** Elle porte l'application, les comptes, la
CI, le système de design et l'historique de déploiement. `Dons/web/` est
supprimé en fin de plan : tout ce qu'il fait, sauf le graphe Cytoscape, existe
déjà en mieux testé dans `JDR_Spells`.

**Ces fichiers de plan vivent dans `Dons/build/fusion-dons-sorts/`** (décision
humaine) alors que les étapes s'exécutent contre `JDR_Spells`. Chaque étape
nomme donc explicitement son dépôt cible.

## Objectives

1. Un seul dépôt, un seul déploiement, un seul système de design.
2. **Conserver `output: 'export'`** — aucun runtime, aucune route d'API.
3. Rendre les dons navigables avec les mêmes facettes, la même barre de
   recherche et le même état-dans-l'URL que les sorts.
4. Lier dons **et** sorts aux `personnages` Supabase existants : « les sorts de
   mon magicien » et « le plan de dons de mon guerrier » deviennent un objet.
5. Ne jamais dégrader l'éligibilité : **une sous-attribution est bien plus grave
   qu'une sur-attribution** (principe de sûreté du dépôt `Dons`).

## Current State Analysis

### Mesures prises sur les dépôts (pas des estimations)

- `139` tests pytest verts (`Dons`), `662` tests vitest verts (`JDR_Spells`).
- Découpage du coût du moteur Python :
  `import 0,83 s | chargement+parsing 1,21 s | **évaluation 22 µs/don**`.
  Une fermeture complète 3 vagues sur 1 417 dons = **95 ms en Python**,
  estimée **10–40 ms en JS**.
- Charge utile client mesurée : tables de gating 34 kB gz + `races.json` 17 kB gz
  + facettes sémantiques 87 kB gz ≈ **190 kB gz** tout compris.
- `web/exemple_guerrier.json` est **périmé** : committé 459 dons retenus / 234
  accessibles, régénéré à l'identique (`--slots 3`) → 445 / 229.
- Vocabulaires de classes **incompatibles** : 42 (Dons) contre 19 (Sorts), dont
  deux libellés combinés (`arcaniste-ensorceleur-magicien`,
  `pretre-pretre-combattant-oracle`) marqués « jamais scindés ».
- Recouvrement des taxonomies : **un seul mot commun**, `bonus_chiffre`.
- `manual_check` est l'état **majoritaire** : 236 / 459 pour un Guerrier 6.
- Collision de nom de Skill : `verify` existe dans les **deux** dépôts, avec des
  contenus différents (CLI Python vs interface web).

### Le fait architectural qui rend le plan possible

**`parser.py` ne voit jamais le personnage.** Ses 337 lignes de regex française
sont une fonction pure du CSV et des suppléments. Le personnage n'entre que dans
`engine.py`, et `grep` de `re\.` sur ses 621 lignes ne renvoie **qu'un seul
résultat** (`_DEITY_PREFIX_RE`, un retrait de préfixe).

D'où l'architecture retenue (**décision humaine, option A**) :

```
Python, au build (autoritaire, inchangé)
  ├─ parse les 1417 dons        → conditions analysées (JSON)   ← la regex n'est JAMAIS portée
  ├─ émet les 5 tables de gating verbatim
  ├─ émet le graphe de prérequis (indépendant du personnage)
  └─ émet la couche sémantique
                ↓ artefacts statiques committés
TypeScript, dans le navigateur (~600 LOC)
  ├─ evaluerDon()      — tri-état, lectures de tables, zéro regex
  ├─ verdictGating()   — les 9 genres bloquants
  └─ vagues / couts / leviers / voies — algorithmes de graphe purs
```

La précalcul exhaustif est **indisponible**, pas seulement coûteux :
42 classes × 20 niveaux × 53 races = 44 520 exports (~35 h, ~33 Go), et cela
ignore les six caractéristiques, l'alignement, la divinité et l'ensemble des
dons déjà pris (2^1417).

### Décisions humaines déjà prises

1. **Option A** : export statique + évaluateur TS, Python conservé.
2. **Les 42 classes de Dons sont la classe du personnage** ; les libellés
   combinés sont rétrogradés en simple *identité de liste de sorts*.
3. Périmètre : **jusqu'à la liaison aux personnages** (fusion complète).
4. Plan dans `Dons/build/`, code fusionné dans `JDR_Spells`.

## Feature / Issue List being addressed

| # | Sujet | Gravité | Traité en |
|---|---|---|---|
| I1 | Unité de publication incompatible (corpus vs personnage) | bloquant | 06, 08, 09 |
| I2 | Vocabulaire de classes irréconciliable (42 / 19) | bloquant | 03, 07, 12 |
| I3 | Divergence possible Python ↔ TS sur l'éligibilité | bloquant | 02, 14 |
| I4 | `manual_check` majoritaire, sans vocabulaire visuel | majeur | 01, 13 |
| I5 | Deux taxonomies fermées, collision sur `bonus_chiffre` | majeur | 01, 10 |
| I6 | Deux systèmes de design ; rampe bleue illisible sur parchemin | majeur | 01, 15 |
| I7 | Artefact `exemple_guerrier.json` périmé, aucun garde-fou | moyen | 02, 08 |
| I8 | Collision de Skill `verify` entre les deux dépôts | moyen | 01 |
| I9 | `Character.skill_rank` optimiste (renvoie `level`) | moyen | 16 (décision explicite) |
| I10 | `validate_palette.js` documenté mais absent du dépôt | mineur | 01 |
| I11 | 13 entrées `proficiency` dépendant d'un choix du joueur | mineur | 01 (limite figée, non franchie) |

## Skills & Tools Inventory

### Skills

| Skill | État | Construit en | Consommé par |
|---|---|---|---|
| `pf-dons-conventions` | **à créer** | 01 | 03, 06, 07, 08, 09, 12, 14, 16, 17 |
| `pf-dons-taxonomie` | **à créer** | 01 | 05, 10, 11, 13, 15 |
| `pf-web-design-system` | **à amender** (états tri-état, rampe de coût sur parchemin, rôles Cytoscape) | 01 | 11, 13, 15, 16 |
| `verify-dons-python` | **à créer** (renommage du `verify` de Dons, résout I8) | 01 | 04, 08, 14 |
| `verify` (web) | **à amender** (routes `/dons`) | 01 | 13, 15, 16 |
| `pf-corpus-conventions` | existe | — | 04, 11 (algorithme de slug) |
| `pf-enrichment-conventions` | existe | — | 05 (patron de vocabulaire clos) |
| `pf-bedrock-batch` | existe | — | aucun (hors périmètre) |

### Tools

| Outil | État | Construit en | Consommé par |
|---|---|---|---|
| `tools/matrice_personnages.py` | **à créer** | 02 | 08, 09, 14 |
| `scripts/comparer_verdicts.ts` (différentiel asymétrique) | **à créer** | 02 | 14 |
| Format `verdicts.jsonl` (contrat de vidage) | **à créer** | 02 | 08, 09, 14 |
| `tools/verifier_derive_dons.py` | **à créer** | 02 | 08, 17 |
| `scripts/check_data_contract_dons.ts` | **à créer** | 05 | 08, 13 |
| `scripts/check_data_contract.ts` | existe | — | 05 (patron) |
| `tools/exporter_web.py` | existe | — | 08 (patron) |
| `scripts/verifier_a11y.ts` | existe, **à étendre** | 13 | 13, 15 |
| `npm run verifier:tout` | existe, **à étendre** | 14 | 17 |

## Execution Plan (Waves)

**17 étapes, 6 vagues, 5 étapes en parallèle au plus large.**

| Vague | Étapes | Dépend de |
|---|---|---|
| **1** | `01_SKILLS` · `02_TOOLS` · `03_CLASS_REGISTRY` · `04_MERGE_REPO` | rien |
| **2** | `05_WEB_INDEX_CONTRACT` · `06_ENGINE_DATA_CONTRACT` · `07_REGISTRY_INTEGRATION` | 03, 04 |
| **3** | `08_EXPORTER` · `09_TS_MOTEUR` · `10_LIB_FACETS_URL` · `11_UI_DONS_SHEET` · `12_SUPABASE_MIGRATION` | 05, 06, 07 |
| **4** | `13_UI_DONS_LIST` · `14_PARITY_HARNESS` | 10 · 08+09 |
| **5** | `15_UI_GRAPH` · `16_CHARACTER_BINDING` | 13 · 13+12+09+14 |
| **6** | `17_DOCS_AND_DECOMMISSION` | toutes |

Précisions de dépendance — aucune n'est prudentielle :

- Vague 1 : les quatre étapes n'écrivent que des fichiers disjoints. `03` et
  `02` reçoivent **en ligne, dans leur propre fichier**, les constantes
  partagées (les 42 classes, les 19 listes, le format de vidage) : elles n'ont
  donc pas besoin l'une de l'autre.
- **`05` et `06` sont le déverrouillage du parallélisme** : ils figent les
  contrats de données *et livrent une fixture écrite à la main*. Producteur
  (`08`) et consommateurs (`09`, `10`, `11`, `13`) travaillent ensuite
  simultanément contre la fixture, sans attendre l'export réel.
- `09` ne dépend **pas** de `08` : il consomme le contrat de `06` et la fixture,
  pas l'artefact réel. C'est ce qui les met dans la même vague.
- `14` est le seul point de rendez-vous des deux moteurs.
- `12` ne dépend que de `07` (le vocabulaire de classes) : ni de l'UI, ni du
  moteur.

## Git & Branching Strategy

- **Base** : `main` de `JDR_Spells`. Branche d'intégration unique :
  `feat/fusion-dons` — créée avant la vague 1, jamais rebasée pendant le plan.
- **Une branche par étape**, nommée `fusion/NN-slug` (ex. `fusion/09-ts-moteur`),
  issue de `feat/fusion-dons`.
- **Toute étape lancée en parallèle s'exécute dans son propre git worktree**
  (`isolation: "worktree"`), pour que quatre ou cinq subagents ne se disputent
  ni l'index git ni `node_modules`.
- **Fusion** : à la fin de chaque vague, les branches de la vague sont fusionnées
  dans `feat/fusion-dons` **dans l'ordre croissant de numéro d'étape**, en
  `--no-ff` pour garder la vague lisible dans l'historique. La vague suivante
  part de `feat/fusion-dons` mise à jour.
- **Granularité de commit** : un commit par unité vérifiable (un contrat, un
  module, sa batterie de tests). Jamais un commit « fin d'étape » fourre-tout.
- **Convention de message** : Conventional Commits, sujet en français,
  impératif, ≤ 72 caractères, portée = le domaine touché.
  `feat(dons):`, `fix(web):`, `data(dons):`, `docs:`, `test(dons):`,
  `chore(fusion):`. Le corps dit **pourquoi**, jamais quoi.
- `04_MERGE_REPO` utilise `git mv` partout où c'est possible pour préserver
  l'historique, et **committe le déplacement séparément** de toute retouche de
  contenu — sinon `git log --follow` casse.
- `feat/fusion-dons` → `main` en une seule PR à la fin de l'étape 17, après
  `npm run verifier:tout` vert.

## CLAUDE.md Impact

`JDR_Spells/CLAUDE.md` (fichier qui survit ; celui de `Dons` est absorbé) :

- **§1–2** : le dépôt porte désormais **deux corpus**. Nouvelle table d'autorité
  pour `data/dons/`, `data/conventions/classes_unifiees.json`,
  `web/public/data/dons/`.
- **§5** : ajouter `pf-dons-conventions` et `pf-dons-taxonomie` à la liste des
  Skills autoritaires ; documenter le renommage `verify` → `verify-dons-python`.
- **§6** : ajouter les commandes du pipeline des dons.
- **§9** : ajouter les anomalies permanentes des dons — les 13 `proficiency`
  dépendant d'un choix du joueur, les 6 `class_ability_unmapped`, l'absence
  volontaire de `chasseur de vampire`, et les entrées de registre de classe
  laissées en curation humaine.
- **§11** : documenter que **l'éligibilité des dons est calculée côté client**,
  pourquoi (le précalcul est indisponible, pas seulement coûteux), et que le
  parseur reste en Python **exprès** pour que la regex ne soit jamais portée.
  Documenter le différentiel Python↔TS comme garde bloquant.
- **§12** : la contrainte « aucune couleur en dur hors `tokens.ts` » s'étend au
  rendu Cytoscape, qui ne lit pas les variables CSS et doit passer par
  `lireRoles()`.
- **Nouvelle section** : le principe de sûreté (`sous-attribution >
  sur-attribution`) et son encodage en règle de CI asymétrique.
- `design/DECISIONS.md` : deux décisions numérotées — le registre de classes à
  42 entrées, et l'évaluation côté client.
