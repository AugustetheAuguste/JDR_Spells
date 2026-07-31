# Étape 09 — CLI, documentation d'exploitation, CLAUDE.md

Branche `feat/enrichissement-llm/09-cli-docs`. Quatre commits, aucune fusion
(l'étape la diffère explicitement à « une fois les six vagues fusionnées »).

| Commit | Objet |
|---|---|
| `558c451` | `src/pf_spells/cli.py` + `tests/test_cli.py` (37 tests) ; correction de cohérence sur l'étage 10 |
| `3bf162c` | `docs/enrichissement.md` + `tests/test_docs_enrichissement.py` (27 tests) |
| `0727071` | CLAUDE.md § 10, exception réseau, table des artefacts ; README et `test_docs.py` alignés |
| `fcdd597` | `data/vues/sorts_enrichis/` — 2070 fichiers |

## 1. Critères de vérification

| # | Critère | Verdict |
|---|---|---|
| 1 | Quatre sous-commandes, `--help` répond, chaîne de bout en bout sur `mini_corpus` avec client simulé | **PASS** — `TestChaineDeBoutEnBout`, 12 sorts, 0 socket, 0 $ |
| 2 | `docs/enrichissement.md` porte les commandes littérales des deux procédures | **PASS** — et chaque drapeau est vérifié contre le vrai parseur de son étage |
| 3 | CLAUDE.md nomme les étages 08/09/10, `data/enrichissements/`, `data/vues/`, les deux Skills, l'exception réseau | **PASS** — épinglé par `TestCLAUDEmdCoucheEnrichissement` |
| 4 | `pytest tests/` passe, aucune régression | **PASS** — cf. § 4 |
| 5 | `validate-enrich --strict` : < 5 % d'échecs **et** < 5 % de `notes_ambiguite` | **échecs 0,78 % : PASS. `notes_ambiguite` 46,4 % : ÉCHEC** — cf. § 2 |
| 6 | `data/vues/sorts_enrichis/` contient un fichier par sort de `data/index/` | **PASS** — 2070 = 2070, égalité d'ensembles vérifiée, pas seulement le compte |

## 2. Le critère rouge, et pourquoi il n'a pas été forcé au vert

`notes_ambiguite` non nul sur **950 / 2048 (46,4 %)**, neuf fois le seuil.

Le remède que le plan prescrit — élargir les listes closes — ne bougerait pas ce
chiffre. Classement par expression régulière des 950 notes (commande publiée en
`docs/enrichissement.md` § 4.1, reproductible) :

- **59** accusent réellement une liste close (« ne figure pas dans la liste
  fermée… ») ;
- **891** sont de la glose sur un choix par ailleurs valide.

La cause est donc la formulation du champ dans le prompt — « une phrase si tu as
hésité » invite à commenter chaque décision — et non un manque de taxonomie.

Remède identifié et **chiffré** : resserrer l'instruction (« une phrase
**seulement si** aucune valeur ne convient, sinon null »), bumper
`VERSION_PROMPT`, valider sur `--limit 50`, puis passe complète. C'est ~5 $ sur
un corpus déjà couvert à 98,9 % : un arbitrage humain, hors du périmètre d'une
étape de CLI et de documentation.

**Le seuil n'a pas été desserré** et l'étage continue de le signaler. Le desserrer
aurait rendu le critère vert en supprimant la mesure qui le rend utile.

## 3. Deux découvertes qui n'étaient pas au plan

**Un défaut réel dans l'étage 10, révélé par le test de chaîne.**
`validate_enrichment` était le seul des quatre étages sans `--racine-conventions`
et ne pouvait donc pas valider un corpus de fixture : il cherchait schéma et
vocabulaires sous `--racine`. Corrigé dans le module (le schéma et la taxonomie
viennent des conventions, l'index reste sur la racine du corpus), pas contourné
dans le test.

**Un piège à dépense, en l'état committé.** 1950 enregistrements sont en `p1.4`
et 98 en `p1.5`, alors que `VERSION_PROMPT` vaut `p1.5`. La reprise régénérant
tout enregistrement de version différente, un `enrich` sans argument
**repaierait 1972 appels (~5 $)**. Documenté en encadré avec les deux réponses
légitimes ; `--estimer-seulement` l'annonce avant de payer.

## 4. Tests

Suite complète : **982 passés, 0 échec**, en 643 s. Référence Phase 1 relevée
avant toute modification : 945 passés — aucune régression. Les tests de cette
étape :

| Fichier | Tests |
|---|---|
| `tests/test_cli.py` | 37 (nouveau) |
| `tests/test_docs_enrichissement.py` | 27 (nouveau) |
| `tests/test_docs.py` | 44, dont 11 ajoutés |

Ce qu'ils couvrent :

- `tests/test_cli.py` — transmission d'argv **verbatim** (dont `--mode batch`
  et `--rac`, qu'aucune couche ne doit abréger), garde d'entrée avant l'étage,
  code de sortie rendu tel quel, chaîne de bout en bout et sa relance gratuite.
  Le test qui compte : un verdict bloquant sur `enrich` laisse le compteur
  d'appels du client factice à **0** — « ce garde-fou a empêché une dépense »
  écrit sans facture.
- `tests/test_docs_enrichissement.py` — chaque drapeau documenté est lu sur
  le parseur réellement construit par l'étage, pas sur sa chaîne d'aide. Vérifié
  mordant : un `--dry-run` inséré dans le document fait échouer le test avec un
  message précis. Les chiffres cités sont comparés au rapport sur disque.
- `tests/test_docs.py` — le contenu que l'étape exige de CLAUDE.md, dont
  l'absence de la phrase « tout le reste est hors ligne. », qu'une relecture
  distraite réintroduirait.

## 5. Écarts assumés

- La CLI n'est pas un `console_scripts` : il n'y a ni `pyproject.toml` ni
  `setup.py` dans ce dépôt, et en créer un dépasse le périmètre. L'entrée est
  `python -m pf_spells.cli`, cohérente avec les dix autres commandes du dépôt.
- `data/vues/` est committé (18 Mo). Dérivé et idempotent au bit près
  (`construit_le` nul sans `--horodater`, vérifié par hash sur les 2071 fichiers) ;
  la raison est celle de `cache/html/` — un consommateur clone et lit.
- Aucune Skill nouvelle n'a été nécessaire : les deux que l'étape cite existent.
