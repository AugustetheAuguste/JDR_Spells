# 04 — MERGE REPO : faire entrer le Python des dons, sans rien refactoriser

**Vague 1.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/04-merge-repo`.

## Objectives

Faire vivre le paquet `pf1_dons` et ses données dans `JDR_Spells`, **à
comportement rigoureusement identique**, avec ses 139 tests verts.

Cette étape ne change **aucune** logique. C'est un déplacement, et sa seule
mesure de succès est que rien ne bouge.

## Dependencies & Parallelization

- **Vague 1. Aucune dépendance.** N'a besoin ni des Skills (01), ni des outils
  (02), ni du registre (03).
- Aucune dépendance cachée : n'écrit dans aucun fichier touché par 01, 02 ou 03.
  Le seul recouvrement possible est `requirements.txt` / `pyproject.toml`, que
  personne d'autre dans la vague 1 ne touche.
- **Interdiction explicite** : ne pas anticiper les étapes 05–17. Pas d'exporteur,
  pas de schéma, pas de renommage « tant qu'on y est ».

## Inherited Context from Dependencies

Aucune étape amont. Voici la cartographie complète du déplacement.

### Origine → destination

| Origine (`Dons/`) | Destination (`JDR_Spells/`) |
|---|---|
| `pf1_dons/*.py` | `src/pf_dons/*.py` |
| `Data/dons/` | `data/dons/` |
| `Data/classes/` | `data/classes/` |
| `Data/conditions/` | `data/conditions/` |
| `Data/races/` | `data/races/` |
| `Data/characters/` | `data/characters/` (**gitignoré**, comme aujourd'hui) |
| `tests/*.py`, `tests/golden/cases.json` | `tests/dons/` |
| `scrappers/` | `scrappers/dons/` |
| `scripts/*.py` | `tools/dons/` |
| `build/*/OUTPUT_*.md` | `build/dons/` (traçabilité du raisonnement, à conserver) |
| `Dons/web/` | **rien — non déplacé.** Supprimé en étape 17. |

`src/pf_spells/` n'est pas touché. Les deux paquets coexistent sous `src/`.

### Le fichier qui rend ce déplacement bon marché

`pf1_dons/paths.py` (63 lignes) est **le seul endroit où l'emplacement d'un
fichier de données est écrit**. Tous les modules, scrapers, scripts et tests
l'importent au lieu de coder un chemin en dur. Les chemins sont ancrés sur la
racine du dépôt, déduite de l'emplacement de `paths.py` lui-même.

Déplacer les données = **éditer une ligne par fichier dans `paths.py`**. Si vous
vous trouvez à corriger un chemin ailleurs, c'est un chemin en dur qui a échappé
à cette discipline : le rapatrier dans `paths.py`, ne pas le rustiner sur place.

Attention : `paths.RACINE` est déduite par remontée depuis `paths.py`. En passant
de `Dons/pf1_dons/paths.py` à `JDR_Spells/src/pf_dons/paths.py`, la profondeur
change de **un niveau** (`src/` s'intercale). C'est la seule subtilité du
déplacement, et un `paths.RACINE` faux fait échouer les 139 tests d'un coup avec
un `FileNotFoundError` — panne bruyante, donc sans danger.

### Renommage du paquet

`pf1_dons` → `pf_dons`, pour s'aligner sur `pf_spells`. Conséquences :
`python -m pf1_dons.cli` → `python -m pf_dons.cli`, et
`monkeypatch` de `pf1_dons.persistence.DEFAULT_CHARACTERS_DIR` →
`pf_dons.persistence.DEFAULT_CHARACTERS_DIR` dans les tests.

### Dépendances Python à fusionner

`Dons/requirements.txt` apporte notamment **pandas** (`data_loader.load_raw`
lit le CSV via pandas) et `pytest`. `JDR_Spells/requirements.txt` et
`pyproject.toml` existent déjà. Fusionner sans dégrader une borne de version
existante ; en cas de conflit de borne, **ne pas trancher seul** : le signaler.

### Convention de test

`JDR_Spells` lance `PYTHONPATH=src python -m pytest tests -q`. Les tests des dons
doivent passer sous cette invocation, depuis la racine, sans `PYTHONPATH`
supplémentaire.

## Pseudo-code

```
git switch -c fusion/04-merge-repo

# 1. déplacement pur, committé SEUL (sinon git log --follow casse)
pour chaque paire (origine, destination) de la table:
    git mv  (ou copie + git add si inter-dépôts)
git commit -m "chore(fusion): déplacer le paquet des dons sous src/pf_dons"

# 2. reciblage
éditer src/pf_dons/paths.py:
    RACINE = remonter d'un niveau de plus qu'avant   # src/ s'intercale
    chaque constante -> data/<sous-dossier>/<fichier>
renommer pf1_dons -> pf_dons dans tous les imports, tests, docstrings
fusionner requirements.txt et pyproject.toml
git commit -m "fix(dons): recibler paths.py et le nom du paquet"

# 3. preuve
PYTHONPATH=src python -m pytest tests -q     # 139 + les tests des sorts
```

## Logic Flow

1. Créer la branche depuis `feat/fusion-dons`.
2. **Déplacer, committer.** Rien d'autre dans ce commit.
3. Recibler `paths.py`. Lancer les tests : ils échouent en masse ou passent en
   masse — le mode intermédiaire n'existe pas, ce qui est confortable.
4. Renommer le paquet, refaire passer les tests.
5. Fusionner les dépendances Python, relancer **les deux** suites.
6. Vérifier que `python -m pf_dons.cli list` fonctionne depuis la racine.

## Implementation Notes

- **Ne refactoriser rien.** Pas de renommage de fonction, pas d'ajout de type,
  pas de « pendant qu'on y est ». Toute modification de comportement dans cette
  étape rend l'étape 14 (différentiel) inexploitable, puisque la référence Python
  aurait changé en même temps que la cible TS.
- **Ne pas peupler `src/pf_dons/__init__.py`** et n'ajouter **aucun** `__all__` :
  interdiction de style du dépôt (`CLAUDE.md` §12), et `pf1_dons/__init__.py`
  fait déjà 0 ligne — le garder ainsi.
- `data/characters/` reste **gitignoré** : ce sont des fiches locales.
- `Data/` majuscule → `data/` minuscule. Sur Windows, un `git mv` qui ne change
  que la casse peut être ignoré : vérifier avec `git ls-files` que les chemins
  committés sont bien en minuscules, sinon passer par un renommage en deux temps.
- Conserver `build/dons/OUTPUT_*.md`. Ces notes portent le raisonnement des cinq
  couches de gating avec les bugs concrets qu'elles corrigent ; c'est la matière
  que l'étape 01 transcrit en Skill et qu'un futur relecteur voudra.
- `Dons/CLAUDE.md` n'est **pas** copié tel quel : son absorption dans
  `JDR_Spells/CLAUDE.md` est l'étape 17. Le déposer temporairement en
  `build/dons/CLAUDE_dons_origine.md` pour que 17 y puise.

## Verification Criteria

1. `PYTHONPATH=src python -m pytest tests -q` → **139 tests des dons verts**,
   plus la suite des sorts, aucun échec, aucun `skip` nouveau. Le compte de 139
   est vérifié explicitement, pas seulement « vert » : un test silencieusement
   non collecté (mauvais chemin de dossier) passerait pour un succès.
2. `python -m pf_dons.cli list` s'exécute depuis la racine sans erreur.
3. `python -m pf_dons.cli create Test --class Guerrier --level 6 --race Humain`
   puis `slots Test` produit la même sortie qu'avant déplacement (comparer à une
   capture prise dans `Dons` **avant** de commencer).
4. `grep -rn "pf1_dons"` sur tout le dépôt → **zéro** résultat hors
   `build/dons/` (les notes historiques peuvent le mentionner).
5. `grep -rn "Data/"` dans `src/pf_dons/` → zéro résultat : plus aucun chemin en
   dur, tout passe par `paths.py`.
6. Le test d'invariant existant sur le catalogue passe toujours : **1 417 dons,
   zéro prérequis de don pendant** (`tests/dons/test_data_loader.py`).
7. `npm run web:test` (662 tests) toujours vert — cette étape ne touche pas à
   `web/`.
8. `git log --follow src/pf_dons/engine.py` montre l'historique d'avant
   déplacement.
9. Charger `Skill(skill="verify-dons-python")` si l'étape 01 est déjà fusionnée,
   et suivre sa recette de bout en bout (`create` → `slots --open-only` →
   `assign` → `unassign`). Si 01 n'est pas encore fusionnée, exécuter la même
   séquence à la main et le noter.

## Git Handling

Branche `fusion/04-merge-repo` depuis `feat/fusion-dons`. Trois commits, **dans
cet ordre**, le premier strictement pur :

```
chore(fusion): déplacer le paquet des dons sous src/pf_dons, sans retouche
fix(dons): recibler paths.py sur data/ et renommer pf1_dons en pf_dons
chore(fusion): fusionner les dépendances Python des deux pipelines
```

Le premier commit ne doit contenir **que** des renommages : `git show --stat`
doit ne montrer que des `R`.

## Expected Outcome

Un dépôt, deux corpus, deux pipelines Python côte à côte, et 139 + 662 tests
verts. Aucun comportement modifié — ce qui est exactement la condition pour que
le différentiel de l'étape 14 ait une référence digne de foi.
