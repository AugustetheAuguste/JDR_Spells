# Étape 08 — Vue dérivée `sorts_enrichis` : rapport d'exécution

Branche `feat/enrichissement-llm/08-vue-jointe`, deux commits (`67dbb74`,
`a2074dd`). Suite complète : **908 tests, 0 échec** (`PYTHONPATH=src python -m
pytest tests -q`, 431 s), dont **58 nouveaux** dans `tests/test_build_vues.py`.

## Ce qui a été livré

| Fichier | Rôle |
|---|---|
| `src/pf_spells/build_vues.py` | le constructeur de vue |
| `tests/test_build_vues.py` | 58 tests, 12 classes |

Rien n'a été ajouté à `data/`. Le constructeur a été exécuté sur les 2 070 sorts
vers un répertoire temporaire, pas dans le dépôt : l'étape prescrit que la
génération committée relève de la Vague 6. `git status` est propre en dehors des
deux fichiers ci-dessus.

## Lancer

```
export PYTHONPATH=src
python -m pf_spells.build_vues                      # corpus complet -> data/vues/sorts_enrichis/
python -m pf_spells.build_vues --only arc-baton     # un sort
python -m pf_spells.build_vues --sortie /tmp/vues   # à blanc, hors du dépôt
python -m pf_spells.build_vues --horodater          # renseigne `construit_le`
python -m pf_spells.build_vues --force              # écrase une vue retouchée à la main
```

Sur la fixture, la garde d'entrée doit être sautée et les conventions restent
celles du dépôt :

```
python -m pf_spells.build_vues --racine tests/fixtures/mini_corpus \
  --sortie /tmp/vues --racine-conventions . --sans-preflight
```

Codes de sortie : `0` nominal, `1` si au moins une vue existante avait été
modifiée à la main (elle est alors laissée intacte), `2` sur abandon.

## Résultat sur le corpus réel

```
vues : 2070 sorts, 2070 écrites
  ok                      : 2048
  sans_enrichissement     :   22
  enrichissement_invalide :    0
version_taxonomie : taxonomie_v2
```

Les 2 048 enregistrements produits par l'étage 09 valident **tous** contre le
schéma gelé résolu en v2 : `enrichissement_invalide` est à 0, ce qui est le
résultat attendu et non un contrôle inerte — la classe
`TestTaxonomieLueDepuisLesConventions` prouve qu'un tag hors liste close, lui,
bascule bien en `enrichissement_invalide`. Les 22 sans couche sont les
quarantaines restantes de l'étape 08 précédente (2070 − 2048), le reliquat de
1,1 % que la Skill documente comme point d'arrêt.

## Forme d'une vue

```
les 21 clés du sort, verbatim, dans leur ordre d'origine
"enrichissement":         l'objet à 16 clés, ou null
"statut_enrichissement":  ok | sans_enrichissement | enrichissement_invalide
"construit_le":           null, sauf --horodater
"hash_sort":              sha256 du sort, indépendant de l'ordre des clés
"hash_vue":               sha256 de la vue, hors hash_vue et construit_le
```

## Décisions prises, et pourquoi

**La sortie n'est pas `sort_keys=True`.** Écart délibéré au pseudo-code de
l'étape, qui écrit « JSON trié ». Trier intercalerait `enrichissement`,
`hash_sort` et `statut_enrichissement` au milieu des 21 clés scrapées, et
détruirait la seule chose que le fichier sert à lire d'un coup d'œil : ce qui
vient du wiki d'un côté, ce qui vient du modèle de l'autre. L'ordre est donc
« les 21 clés du sort, puis la boîte dérivée », et un test l'affirme. Le tri
existe là où il est juste — dans `_hash_canonique`, où une empreinte qui bouge
quand une clé se déplace serait un faux positif.

**`hash_vue` remplace la vérification d'horodatage git.** L'étape propose de
détecter une retouche manuelle « en comparant `hash_sort` et en vérifiant
l'horodatage git ». Une mtime ne dit rien du contenu et est fausse pour tous les
fichiers juste après un clone ; et `hash_sort` seul ne couvre pas la couche
enrichie ni le statut. L'empreinte retenue couvre tout le document sauf elle-même
et `construit_le`, donc une retouche de n'importe quel champ est vue, et
`--horodater` reste sans effet sur elle. Une vue sans `hash_vue` — un fichier que
ce constructeur n'a pas écrit — est traitée comme retouchée, jamais écrasée en
silence.

**La vue ne revérifie pas les preuves.** Un enregistrement dont la preuve est
inventée est valide au schéma et se joint donc en `ok`. C'est voulu : y ajouter la
vérification de sous-chaîne mettrait une seconde implémentation de cette règle à
côté de celle de l'étage 10, ce qui est l'anti-pattern nº 4 de la Skill et le
défaut que toute la track existe pour prévenir. La vue dit « bien formé »,
`validate_enrichment --strict` dit « fondé ». Un test rend ce partage explicite
plutôt que de le laisser deviner, et un autre affirme que
`texte_source_canonique`, `CHAMPS` et `SEPARATEUR` n'apparaissent pas dans le
module.

**Absence et invalidité ne sont pas fusionnées.** Les deux laissent
`enrichissement: null`, mais les confondre masquerait un défaut de génération en
lacune de couverture. Le rapport porte les deux comptes et les deux listes d'ids.

**Un orphelin est un abandon.** Un `id` présent dans `data/enrichissements/` mais
absent de `data/index/` arrête la construction : la Skill en fait une erreur, pas
un avertissement, et une vue partagée qui se construit sur une jointure
silencieusement incomplète est pire qu'une absence de vue. Vérifié à 0 orphelin
sur le corpus réel.

## Critères de vérification de l'étape

| Critère | Résultat | Test |
|---|---|---|
| 12 vues sur `mini_corpus`, dont ≥ 1 de chaque statut | OK | `TestLesTroisStatutsSurLeMiniCorpus` (6 tests) |
| `_rapport.json` cohérent avec les fichiers produits | OK | `TestRapport` (4 tests) |
| les 21 clés présentes et non modifiées, clé à clé | OK | `TestLesVingtEtUneClesSontIntactes` (4 tests) |
| deux exécutions produisent des fichiers identiques | OK, octet à octet | `TestIdempotence` (7 tests), + sur les 2 070 |
| aucune écriture dans `data/sorts/` ni `data/enrichissements/` | OK, `git status` inchangé | `TestNEcritQueDansLArbreDeLaVue` (4 tests) |
| aucun U+FFFD dans la sortie | OK, vérifié sur les octets écrits | `TestEncodage` (5 tests) |

L'idempotence est plus forte que demandée : `construit_le` étant nul par défaut,
l'égalité est octet à octet sans avoir à exclure de champ. `--horodater` existe
pour le cas où l'horodatage est voulu, et un test montre qu'il ne touche à rien
d'autre — y compris à l'empreinte.

Deux tests vont au-delà des critères et méritent d'être signalés :
`test_la_verification_finale_relit_les_octets_produits` corrompt une vue *après*
écriture pour prouver que la garde U+FFFD lit bien la sortie et pas l'entrée, et
`test_le_module_n_ecrit_que_par_ecrire` est un garde statique — toute écriture
passe par `ecrire`, appelé exactement deux fois — parce qu'un run qui n'écrit
rien ne prouve rien sur ce que le code *peut* écrire.

## Ce qui reste à faire, hors périmètre de cette étape

- Générer et committer `data/vues/sorts_enrichis/` sur le corpus complet
  (Vague 6, comme l'étape le prescrit).
- Exposer `pf-spells build-vues` et documenter l'arbre dérivé dans `CLAUDE.md` :
  c'est l'étape 09, qui référence déjà ce module.
- Fusion `--no-ff` en fin de Vague 3.

Aucune Skill ni outil non anticipé n'a été nécessaire : la garde d'entrée
`tools/preflight_corpus.py` et le schéma résolu de
`pf_spells.enrichissement_schema` existaient et ont été réutilisés tels quels.
