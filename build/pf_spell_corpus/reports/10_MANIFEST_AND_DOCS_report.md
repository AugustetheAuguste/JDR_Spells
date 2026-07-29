# Rapport 10 — Manifeste du corpus, CLAUDE.md et README

Skill `pf-corpus-conventions` **chargée** avant toute écriture
(`Skill(skill="pf-corpus-conventions")`). Aucun accès réseau. Le seul fichier
ajouté sous `data/` est `data/MANIFEST.json` ; aucune donnée existante n'a été
modifiée.

## Livrables

| Livrable | Nature |
|---|---|
| `src/pf_spells/build_manifest.py` | générateur du manifeste, recensement depuis le disque |
| `data/MANIFEST.json` | 12 artefacts + 7 totaux recomptés |
| `CLAUDE.md` | 120 lignes, 10 sections, une par point requis |
| `README.md` | 266 lignes, exemple travaillé copié à l'octet |
| `tests/test_build_manifest.py` | 29 tests |
| `tests/test_docs.py` | 35 tests |

## Totaux recomptés depuis le disque

Aucun chiffre n'est recopié d'un rapport d'étape : `build_manifest` relit
`data/sorts/*.json`, compte les lignes non vides des `.jsonl` et les fichiers des
répertoires. C'est ce qui fait du manifeste un **second recensement indépendant**.

| Total | Valeur | Recompte |
|---|---:|---|
| `nb_classes` | 19 | longueur du tableau `data/classes.json` |
| `nb_entrees_listes` | 8927 | somme des lignes des 19 `listes_classes/*.jsonl` |
| `nb_sorts_uniques` | 2070 | lignes de `data/index/sorts_uniques.jsonl` |
| `nb_fichiers_sorts` | 2070 | fichiers `data/sorts/*.json` |
| `nb_pages_cache` | 2089 | fichiers `cache/html/*.html` |
| `nb_sorts_avec_mythique` | 287 | fichiers avec `mythique != null` |
| `nb_sorts_avec_variantes` | 196 | fichiers avec `variantes` non vide |

Le recensement concorde avec `reports/08_enrich.md` (2070 fichiers, 2070 entrées
d'index, 8927 paires) — concordance **constatée après coup**, pas présupposée.
`cache/index.jsonl` compte 2107 lignes pour 2089 fichiers HTML : le journal est
append-only et une URL revisitée y ajoute une ligne. Ce n'est pas une anomalie et
c'est documenté dans la description de l'artefact.

## Critères de vérification

| # | Critère | Résultat |
|---|---|---|
| 1 | `MANIFEST.json` valide UTF-8, tous les chemins de l'inventaire, champs peuplés | **OK** — 12 artefacts, exactement ceux de la table du plan ; `nb_enregistrements`, `produit_par_etape` et `autorite` peuplés partout (`produit_par_etape: null` pour le seul `elements_to_do.json`, qui est une entrée, pas une sortie). Testé par `TestArtefacts::test_champs_obligatoires_peuples` et `test_inventaire_complet`. |
| 2 | Chaque `chemin` existe sur disque | **OK** — 0 manquant. Vérifié programmatiquement par `build_manifest.chemins_manquants()` (code de sortie 1 si non vide) et par `test_chaque_chemin_existe_sur_disque`. |
| 3 | `totaux` recomptés | **OK** — `nb_classes == 19`, `nb_fichiers_sorts == 2070` (= nombre réel de fichiers), `nb_sorts_uniques == 2070` (= lignes de l'index). Chiffres complets dans la table ci-dessus ; `TestTotauxRecomptes` recompte tout une troisième fois depuis le disque. |
| 4 | `CLAUDE.md` couvre les dix points | **OK** — une section numérotée par point (détail ci-dessous). `test_claude_md_couvre_les_dix_points` vérifie qu'il y a exactement 10 sections `## N.`. |
| 5 | `CLAUDE.md` nomme la Skill et lui défère | **OK** — § 5 : `Skill(skill="pf-corpus-conventions")`, chemin du SKILL.md, « la Skill gagne ». Deux tests interdisent la recopie : `test_ne_recopie_pas_le_vocabulaire_des_cles` (≤ 2 clés citées) et `test_ne_recopie_pas_la_table_des_classes` (≤ 1 abréviation citée). |
| 6 | Garantie de correction humaine + 1 req/s | **OK** — § 8 (« éditions humaines **autoritaires** », `parse_spells` n'écrase jamais sans `--overwrite`, `enrich_spells` ne réécrit que `classes`) et § 7 (« jamais monter le throttle au-dessus de 1 requête/seconde, ni les workers au-dessus de 4 »). Testé par `test_garantie_de_correction_humaine` et `test_regle_de_politesse_1_req_s`. |
| 7 | Exemple travaillé réel, diffé | **OK** — le bloc JSON du README est **identique octet pour octet** à `data/sorts/armes-contre-le-mal.json`. Il n'a pas été retapé : le README a été assemblé en lisant le fichier. Diff exécuté (`IDENTIQUE`, `bytes equal: True`) et figé en test : `test_exemple_de_sort_identique_au_fichier_reel`, plus `test_chaque_cle_du_sort_est_expliquee` qui exige une ligne de table pour chacune des 21 clés. Même traitement pour la première ligne de `data/listes_classes/paladin.jsonl`. |
| 8 | Bloc de commandes dans les deux docs, modules existants | **OK** — bloc identique dans `CLAUDE.md` § 6 et dans le README (§ « Rejouer le pipeline »), comparé par `test_les_deux_blocs_sont_identiques`. 7 des 8 modules sont vérifiés présents sous `src/pf_spells/` ; `validate_corpus` est l'exception documentée (voir ci-dessous). |
| 9 | `git status --porcelain` propre | **OK** — avant le second commit : `?? CLAUDE.md`, `?? README.md`, `?? tests/test_docs.py`. Avant le premier : `?? data/MANIFEST.json`, `?? src/pf_spells/build_manifest.py`, `?? tests/test_build_manifest.py`. Aucune modification d'un fichier `data/` existant : `data/MANIFEST.json` est le seul ajout sous `data/`. |
| 10 | Contexte hérité confirmé | **OK** — Skill chargée ; tous les chiffres viennent du disque (voir la table des totaux), aucun n'est recopié de `reports/05_index.md` ni de `reports/07_parse_spells.md` ; `reports/09_*` n'a été ni lu ni attendu, il est seulement lié par chemin. |

## Couverture des dix points requis de `CLAUDE.md`

| Point | Section |
|---|---|
| 1. Objet + modèle à deux étages | § 1, avec la table étage 1 / étage 2 |
| 2. Layout + autorité des artefacts | § 2, table de 11 lignes chemin → étape → autorité |
| 3. Règles dures (UTF-8, `PageContentDiv`, clés françaises, pas de translittération, pas d'`unidecode`) | § 3 |
| 4. Algorithme de slug `id`, clé de jointure | § 4, six étapes + règle de collision |
| 5. Pointeur vers la Skill comme autorité | § 5 |
| 6. Relancer le pipeline, relances = cache | § 6 |
| 7. Anomalies permanentes (`Alchimiste`, `Mythique`) | § 9 |
| 8. `data/sorts/*.json` corrigeable, l'humain fait foi | § 8 |
| 9. Politesse : 1 req/s, 4 workers | § 7 |
| 10. Jamais peupler `__init__`, jamais d'`__all__` | § 10 |

## Écarts entre le plan et la réalité

| Le plan dit | La réalité | Ce qui a été fait |
|---|---|---|
| « `data/sorts/<id>.json` ~3000 json », « naviguer ~3 000 fichiers de sorts » | **2070** fichiers | 2070 partout dans le manifeste, `CLAUDE.md` et le README. L'estimation de `00_CONTEXT.md` (« ~2 500–3 500 pages uniques ») était une fourchette a priori, jamais un fait. |
| `classes` = `[{classe, slug, niveau, niveau_page, concordance}]` | confirmé (5 clés) | documenté tel quel, avec la sémantique de `concordance` (`true`/`false`/`null`) |
| slugs via NFKD, `unidecode` absent | confirmé | `CLAUDE.md` § 3 et § 4 l'énoncent explicitement ; aucune dépendance ajoutée |
| bloc de commandes de 7 modules (03→09) | 7 modules existent sauf `validate_corpus` ; l'étape 10 en ajoute un 8e | bloc porté à 8 lignes en ajoutant `python -m pf_spells.build_manifest` (étape 10), sinon le pipeline documenté ne produirait pas le manifeste qu'il documente |
| `data/spell_pages.jsonl` produit par 06 | confirmé, 2070 lignes | inventorié |
| pseudo-code : `count = … | 1 (json)` pour les `.json` | compter 1 pour `classes.json` (19 classes) est inutile | `_nb_entrees_json` compte les éléments d'un tableau, les clés d'un mappage de fiches (`par_classe`), sinon 1 : `nb_enregistrements` reste ainsi interprétable pour chaque artefact |
| `reports/*.md` produits par « 03–09 » | 6 rapports présents (03–08) au moment de l'exécution | `nb_enregistrements: 6`, recompté ; le libellé `produit_par_etape` reste `03–09`, ce qui est la vérité du pipeline |

### `pf_spells.validate_corpus` — non vérifiable depuis ce worktree

`validate_corpus` est le livrable de l'étape 09, qui tourne **en parallèle** dans
un autre worktree. Il **n'existe pas** sous `src/pf_spells/` dans le worktree de
l'étape 10 et n'a pas été créé ici. Il est néanmoins documenté dans le bloc de
commandes des deux docs, parce qu'il fait partie du pipeline réel. Le test
`test_chaque_module_cite_existe` l'exempte explicitement via la constante
`MODULE_TOLERE`, commentée en conséquence ; le test compagnon
`test_le_module_tolere_est_bien_documente` garde l'exemption visible pour qu'elle
soit retirée quand l'étape 09 est fusionnée.

## Tests

`PYTHONPATH=src python -m pytest tests -q` → **263 passés** (199 sur le commit de
base + 29 `test_build_manifest.py` + 35 `test_docs.py`). Ce qui est réellement
vérifié, plutôt que simplement affirmé :

- chaque `chemin` du manifeste existe sur disque ;
- chaque total est recompté depuis le disque, indépendamment du manifeste ;
- format du manifeste : `indent=2`, `ensure_ascii=False` (aucune séquence `\\u`),
  LF, pas de BOM, retour à la ligne final, ordre des clés de haut niveau ;
- chaque entrée d'artefact a `nb_enregistrements` > 0, `produit_par_etape` et
  `autorite` peuplés, et son `schema` référencé existe ;
- idempotence : un manifeste régénéré donne les mêmes `artefacts` et `totaux` ;
- robustesse : sur une racine vide, le manifeste reste bien formé et le code de
  sortie passe à 1 ;
- `CLAUDE.md` ≤ 120 lignes, 10 sections, nomme la Skill, ne recopie ni son
  vocabulaire de clés ni sa table de classes, énonce la règle de 1 req/s et la
  garantie de non-écrasement ;
- chaque module du bloc de commandes existe (sauf l'exception commentée) ;
- l'exemple travaillé du README est du JSON valide **et** égal au fichier réel ;
  chacune des 21 clés a sa ligne d'explication ;
- chaque chemin concret de la carte du dépôt du README existe sur disque.

## Reproduire

```
export PYTHONPATH=src
python -m pf_spells.build_manifest
python -m pytest tests/test_build_manifest.py tests/test_docs.py -q
```
