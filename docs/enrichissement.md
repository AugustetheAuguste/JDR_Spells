# La couche d'enrichissement LLM — flux, réglage, correction

Ce document est la procédure d'exploitation de la track A : les quatre étages,
comment les rejouer, et surtout les **deux boucles** qu'on répète — le réglage du
prompt et la correction d'un enregistrement fautif. Les conventions de données
(clés, vocabulaires clos, politique des nulls, anti-patterns) ne sont pas ici :
elles ont une autorité unique, `.claude/skills/pf-enrichment-conventions/SKILL.md`.

Les commandes de ce fichier sont **littérales** : elles se copient telles quelles.
Toutes supposent `export PYTHONPATH=src` depuis la racine du dépôt.

## 1. Le flux : quatre étages, un seul sur le réseau

```
data/sorts/<id>.json  ──┐
conventions/vocabulaires/  (six listes closes, gelées)
                        │
      étage 08          ▼   prepare-prompts     HORS LIGNE, idempotent
      pf_spells.prepare_prompts
                        │   assemble un prompt complet par sort
                        ▼   build_artifacts/prompts/<version>/<id>.json
                            + _manifeste.json  (hashs, version_taxonomie)
      étage 09          │   enrich              RÉSEAU, PAYANT
      pf_spells.enrich_llm
                        ├─▶ data/enrichissements/<id>.json     (réponse conforme)
                        └─▶ build_artifacts/quarantaine/<id>.json  (réponse refusée)
                            + build_artifacts/rapports/run_<horodatage>.json
      étage 10          │   validate-enrich     HORS LIGNE
      pf_spells.validate_enrichment
                        ▼   build_artifacts/rapports/validation_enrichissement.json
                            (n'écrit RIEN sous data/, ne corrige RIEN)
      vue jointe        │   build-vues          HORS LIGNE, idempotent
      pf_spells.build_vues
                        ▼   data/vues/sorts_enrichis/<id>.json   (DÉRIVÉ)
                            + _rapport.json
```

Chaque étage passe d'abord la garde d'entrée `tools/preflight_corpus.py` :
structure du dépôt, nombre de sorts, échantillon de 20 fichiers décodés et
contrôlés clé par clé. Un verdict bloquant arrête tout avant le premier appel —
pour l'étage 09, c'est une garantie de dépense nulle.

L'entrée unique est `pf_spells.cli`. Les quatre sous-commandes transmettent leurs
options **telles quelles** à leur étage :

```
export PYTHONPATH=src
python -m pf_spells.cli                      # la liste des sous-commandes
python -m pf_spells.cli enrich --help        # l'aide réelle de l'étage 09
```

Chaque étage reste appelable directement (`python -m pf_spells.enrich_llm`) ;
c'est la même fonction `main`. La CLI ajoute la garde d'entrée et un journal de
run sur stderr — début, fin, durée, code de sortie.

### Codes de sortie

| Code | Sens |
|---|---|
| 0 | nominal |
| 1 | l'étage a fini mais quelque chose a échoué : `--strict` avec des rejets, une vue protégée, un appel en échec |
| 2 | abandon avant traitement : garde d'entrée en FAIL, arrêt budget, sous-commande inconnue |

## 2. Un run complet, de zéro

### 2.1 Prérequis réseau (étage 09 uniquement)

Le jeton porteur Bedrock passe par **l'environnement**, jamais par le dépôt.
`.env` est gitignoré et **aucun module ne le lit** — c'est un pense-bête humain.

```
export AWS_BEARER_TOKEN_BEDROCK=ABSK…
```

Ce jeton ouvre `bedrock-runtime` et le plan de contrôle `bedrock`, mais **pas S3
ni STS** : le mode batch, qui lit et écrit ses lots dans S3, est hors de portée.
D'où le chemin on-demand, et le prompt caching comme seul levier de coût.

### 2.2 Assembler les prompts, puis estimer avant de payer

```
export PYTHONPATH=src
python -m pf_spells.cli prepare-prompts
python tools/estimate_cost.py \
  --prompts build_artifacts/prompts/p1.5 \
  --tarif-entree 0.001 --tarif-sortie 0.005
python -m pf_spells.cli enrich --estimer-seulement
```

`--estimer-seulement` passe **toutes** les gardes et **tous** les filtres du run
réel, puis sort sans construire de client : le nombre affiché est le nombre qui
serait dépensé. Les tarifs de `estimate_cost.py` sont par 1000 tokens, dans la
devise qu'on veut ; ils ne sont pas codés en dur parce qu'ils changent.

> **Le piège à lire avant tout `enrich`.** L'état committé porte 1950
> enregistrements en `p1.4` et 98 en `p1.5`, alors que `VERSION_PROMPT` vaut
> `p1.5`. La reprise régénère tout enregistrement dont la version diffère, donc un
> `enrich` sans argument **repaierait 1972 appels** (~5 $) pour un corpus déjà
> couvert à 98,9 %. `--estimer-seulement` le dit — c'est la ligne
> « enregistrements : 1972 » contre « déjà à jour : 98 ». Deux réponses possibles,
> et le choix est humain :
>
> - la passe `p1.5` n'apporte rien de mesuré sur ces 1950 sorts : **ne pas
>   relancer**, l'écart de version est un fait de provenance, pas un défaut ;
> - on veut l'homogénéité en `p1.5` : la payer sciemment, après avoir vérifié le
>   gain sur `--limit 50` (§ 3).
>
> C'est exactement pourquoi `--estimer-seulement` existe et pourquoi la
> confirmation se déclenche au-delà de 100 enregistrements.

### 2.3 La passe

```
python -m pf_spells.cli enrich --oui
```

Ordre de grandeur mesuré : **2070 sorts pour ~5 $**, `eu.anthropic.claude-haiku-4-5`,
concurrence 8, ~40 min. Les garde-fous, tous actifs par défaut :

| Garde-fou | Comportement |
|---|---|
| Plafond d'appels (2100) | au-delà, le run **refuse de démarrer** — une boucle ou un `--force` distrait ne se facture pas |
| Confirmation au-delà de 100 enregistrements | invite interactive ; hors terminal, `--oui` est **requis** |
| Reprise sur `hash_source` | vérifiée **avant** l'appel : un enregistrement à jour n'est jamais repayé |
| Coupe-circuit | une rafale d'erreurs arrête le run au lieu de payer 2000 échecs |
| Concurrence | plafonnée à 8, une valeur supérieure est ramenée avec un avertissement |

**Surveiller la ligne « jetons ».** Le bloc système est identique pour les 2070
sorts et représente 88 % de l'entrée : c'est ce que le caching amortit. Si
`lus du cache` vaut 0, le run coûte environ le double — et le cache a un plancher
de 4096 tokens en dessous duquel il échoue **en silence**.

### 2.4 Valider, puis construire la vue

```
python -m pf_spells.cli validate-enrich
python -m pf_spells.cli validate-enrich --strict     # la même chose, en garde de CI
python -m pf_spells.cli build-vues
```

L'étage 10 ne corrige rien et n'écrit rien sous `data/` : il produit
`build_artifacts/rapports/validation_enrichissement.json`. Son contrôle central
est le champ `preuves` — chaque preuve doit être une **sous-chaîne réelle** du
texte source, ce qui rend la confabulation mécaniquement détectable. Seul pli
toléré : l'apostrophe typographique `’` (U+2019, celle du wiki) contre `'`
(U+0027, celle du modèle) — sans lui, 9,9 % des preuves seraient rejetées à tort.
Casse, espaces, accents et reformulations restent des rejets.

## 3. Boucle de réglage du prompt — la boucle qu'on répète

C'est la procédure la plus utile de ce fichier : on l'a parcourue de `p1.0` à
`p1.5`. **Ne jamais régler un prompt sur la passe complète** : chaque tentative
est une passe payée.

### 3.1 Les cinq commandes

```
export PYTHONPATH=src

# 1. Bump : éditer VERSION_PROMPT dans src/pf_spells/prepare_prompts.py
#    (p1.5 -> p1.6), puis corriger l'instruction dans le même fichier.

# 2. Réassembler sous la nouvelle version — hors ligne, quelques secondes.
python -m pf_spells.cli prepare-prompts --version-prompt p1.6

# 3. Un échantillon de 50, et rien de plus. Sortie et quarantaine à part :
#    la passe en production n'est pas touchée.
python -m pf_spells.cli enrich \
  --version-prompt p1.6 --limit 50 --oui \
  --sortie build_artifacts/essais/p1.6/enrichissements \
  --quarantaine build_artifacts/essais/p1.6/quarantaine \
  --rapports build_artifacts/essais/p1.6/rapports

# 4. Lire le rapport PAR TYPE D'ERREUR — c'est la ligne qui décide de la suite.
python -m pf_spells.cli validate-enrich \
  --enrichissements build_artifacts/essais/p1.6/enrichissements \
  --rapports build_artifacts/essais/p1.6/rapports

# 5. Satisfait : la passe complète, sur les chemins par défaut.
python -m pf_spells.cli enrich --version-prompt p1.6 --oui
```

Le bump de version n'est pas cosmétique : `version_prompt` est inscrit dans
chaque enregistrement, et l'étage 09 régénère tout enregistrement dont la version
diffère. Régler l'instruction **sans** bumper produit des enregistrements que la
reprise croit à jour.

### 3.2 Lire le rapport : quelle cause pour quel symptôme

Le rapport donne `par_type_erreur` (étage 10) et `raisons_quarantaine` (étage 09).
La lecture n'est pas la même :

| Symptôme | Cause probable | Action |
|---|---|---|
| `raisons_quarantaine: {schema: N}`, valeurs françaises justes mais hors liste (`epuisee`, `affaiblissement_de_capacite`) | **la liste close manque une case** | § 4, couper une nouvelle version de la liste |
| `preuve_absente_du_source` | le modèle **reformule** au lieu de recopier | durcir l'instruction de recopie littérale |
| `preuve_absente_du_source` sur beaucoup d'enregistrements après un changement du corpus | le source a bougé | `derive_source`, régénérer (§ 5.2) |
| tags/rôles/catégories interchangés | les six listes sont lues comme **un vocabulaire commun** | rappeler dans le prompt que chaque liste n'appartient qu'à son champ, dans les deux sens |
| trop de valeurs (7 tags pour une borne de 6) | borne non comprise | l'énoncer avec sa conséquence : le dépassement rejette tout l'enregistrement |

**La leçon qui a coûté le plus cher à diagnostiquer** : un taux de rejet qui ne
bouge pas quand on durcit l'instruction accuse **les listes closes**, pas le
prompt. Mesuré : 12 → 10 rejets sur 100 après reformulation. Reformuler ne crée
pas la case manquante. Compter les rejets **par clé manquante** d'abord :

```
python - <<'PY'
import json, glob, collections, re
compte = collections.Counter()
for chemin in glob.glob('build_artifacts/quarantaine/*.json'):
    raison = json.load(open(chemin, encoding='utf-8'))['raison']
    trouve = re.search(r"'([^']+)' is not one of", raison)
    if trouve:
        compte[trouve.group(1)] += 1
for cle, n in compte.most_common():
    print(f'{n:4}  {cle}')
PY
```

Une clé à masse réelle (des dizaines de sorts) est un manque de la taxonomie.
Une queue de 1 à 5 occurrences est le point d'arrêt : ces sorts ne partagent
aucun manque commun, et les laisser en quarantaine est la bonne réponse.

## 4. Quand le rapport lève `taxonomie_incomplete`

L'étage 10 pose `taxonomie_incomplete: true` quand plus de 5 % des
enregistrements portent un `notes_ambiguite` non nul. **La règle est : on corrige
la taxonomie, on ne desserre pas le seuil.**

### 4.1 D'abord, distinguer les deux causes

Le seuil mesure deux choses qui se ressemblent dans le chiffre et pas du tout
dans le remède : « les listes manquent d'une case » et « le prompt invite à
commenter ». La commande qui les sépare :

```
python - <<'PY'
import json, glob, re
motif = re.compile(
    r"liste (ferm|clos)|n'existe pas dans|n'appara[iî]t pas|absent[e]? de la liste",
    re.I,
)
accusent, commentent = 0, 0
for chemin in glob.glob('data/enrichissements/*.json'):
    note = json.load(open(chemin, encoding='utf-8'))['notes_ambiguite']
    if not note:
        continue
    if motif.search(note):
        accusent += 1
    else:
        commentent += 1
print(f'notes accusant une liste close : {accusent}')
print(f'notes de simple commentaire    : {commentent}')
PY
```

Sur la passe du 2026-07-31, ce compte donne **59 contre 891** : le taux de 46,4 %
est très majoritairement de la glose, pas un manque de taxonomie. Le remède est
alors dans le prompt (« une phrase si tu as hésité » invite à commenter chaque
choix), pas dans les listes — voir § 6, constat 2.

### 4.2 Si les listes sont bien en cause

1. Compter les rejets par clé manquante (§ 3.2).
2. N'ajouter que les manques à **masse réelle**. Le précédent : `coercition`,
   `metamorphose`, `dissipation` (32, 28, 9 sorts) dans `categories.json` ;
   `nauseeux`, `fatigue`, `epuise`, `fievreux` dans `conditions.json`.
3. Bumper le `version` du **fichier de vocabulaire** concerné (`v1` → `v2`).
   `version_taxonomie` se dérive de la plus haute des **six** listes, jamais de
   `tags.json` seule.
4. Ne ré-interroger **que** les sorts concernés :
   ```
   python -m pf_spells.cli enrich --only blaspheme --only compensation-retributive --oui
   ```
   Coût du précédent : 120 sorts pour ~0,35 $, +98 récupérés (2048/2070 = 98,9 %).

Trois interdits, chacun payé une fois :

- **Ne jamais remapper une réponse du modèle vers une clé valide** : c'est un
  jugement de jeu déguisé en sortie de modèle.
- **Deux listes closes ne partagent jamais une clé.** Le modèle voyait
  `charme_ou_coercition` dans les tags et en déduisait une catégorie homonyme —
  d'où `coercition`, délibérément distinct.
- **Le fourre-tout reste en dernier** (`utilitaire`) : l'ordre d'une liste est lu
  comme une précédence.

Élargir une énumération ne périme rien : les enregistrements v1 valident contre le
schéma v2. Seule la provenance les distingue.

## 5. Corriger un enregistrement

### 5.1 Il n'y a pas de verrou humain — et c'est délibéré

`data/enrichissements/` est **entièrement régénérable**. Le champ
`verifie_par_humain` du plan initial **n'existe pas** : le schéma porte 16 clés et
n'en admet pas une dix-septième, si bien qu'un enregistrement se déclarant relu
est **invalide**, pas exempté. Une édition à la main sera écrasée à la
régénération, et la CLI ne propose aucun `--force` qui la préserverait.

C'est le même principe que `data/sorts/` : **on corrige la cause, jamais
l'artefact.** L'ordre de résolution, du moins cher au plus cher :

| Ce qui est faux | Où corriger | Commande |
|---|---|---|
| une valeur juste mais hors liste | la liste close (§ 4) | `enrich --only <id> --oui` |
| une preuve reformulée, un champ mal rempli | l'instruction du prompt (§ 3) | bump `VERSION_PROMPT`, puis `--limit 50` |
| le texte source lui-même | `parse_spells` (Phase 1) | régénérer le sort, puis `enrich --only <id>` |
| une seule réponse aberrante, prompt et listes sains | ré-interroger ce sort | `enrich --only <id> --force --oui` |

`--force` **repaie** l'appel : c'est le seul moyen de régénérer un enregistrement
que la reprise juge à jour, et il n'y en a pas d'autre usage.

### 5.2 Après toute correction

```
export PYTHONPATH=src
python -m pf_spells.cli validate-enrich --only <id>
python -m pf_spells.cli validate-enrich --strict
python -m pf_spells.cli build-vues
python -m pytest tests -q
```

## 6. Quand le rapport liste `derive_source`

`derive_source` nomme les enregistrements dont le `hash_source` ne correspond plus
au texte source sur disque : **l'enrichissement décrit un sort qui a changé
depuis.** Cause quasi certaine : `parse_spells` a été corrigé et le corpus
régénéré. Ce n'est pas une erreur de l'étage 09 et rien ne se corrige à la main —
il faut régénérer les enregistrements concernés.

```
export PYTHONPATH=src
python -m pf_spells.cli validate-enrich
python - <<'PY'
import json
rapport = json.load(open(
    'build_artifacts/rapports/validation_enrichissement.json', encoding='utf-8'))
derive = rapport['derive_source']
print(f'{len(derive)} enregistrement(s) en dérive')
for identifiant in derive:
    print(f'  --only {identifiant}')
PY
```

Puis régénérer. La reprise sur `hash_source` **détecte la dérive d'elle-même** :
un `enrich` sans `--only` ni `--force` ne repaiera que ces enregistrements, ce qui
est presque toujours la commande à passer.

```
python -m pf_spells.cli enrich --oui
python -m pf_spells.cli validate-enrich --strict
python -m pf_spells.cli build-vues
```

## 7. Le reliquat, et ce qu'on n'a pas corrigé

État de la passe du 2026-07-31, `p1.4`/`p1.5` contre `taxonomie_v2` :

| Mesure | Valeur |
|---|---|
| Enregistrements produits | 2048 / 2070 (98,9 %) |
| Conformes à l'étage 10 | 2032 (99,2 % des produits) |
| Rejets `preuve_absente_du_source` | 16 (0,78 %) |
| En quarantaine | 22 (1,1 %) |
| `notes_ambiguite` non nul | 950 (46,4 %) — dont 59 accusent une liste close |
| Provenance | 1950 en `p1.4`, 98 en `p1.5` (les ré-interrogations de `taxonomie_v2`) |

Deux constats **remontés et non corrigés**, tous deux dans `reports/` :

1. **Les 16 rejets sont réels** : de vraies paraphrases, et un `est etourdi`
   désaccentué. La correction est en amont (prompt, puis régénérer). L'étage 10
   ne les blanchit pas, ce serait affaiblir le seul contrôle anti-confabulation
   du pipeline.
2. **Le seuil de 5 % sur `notes_ambiguite` est franchi à 46,4 %.** Le compte du
   § 4.1 l'attribue à la formulation du champ plutôt qu'aux listes : 891 des 950
   notes sont de la glose sur un choix par ailleurs valide. Le seuil **n'a pas
   été desserré** pour passer au vert, et l'étage continue de le signaler. La
   correction est identifiée et **chiffrée** : resserrer l'instruction du champ
   (« une phrase **seulement si** aucune valeur de la liste ne convient, sinon
   null ») et régénérer. C'est une passe complète, ~5 $, donc un arbitrage humain
   et non une correction à glisser dans cette étape.

## 8. Ce qui est committé, et ce qui ne l'est pas

| Chemin | Committé ? | Pourquoi |
|---|---|---|
| `data/enrichissements/` | oui | l'artefact de la track, cohérent avec `cache/html/` |
| `data/vues/sorts_enrichis/` | oui | **dérivé** ; jamais édité à la main, régénérable en quelques secondes |
| `build_artifacts/quarantaine/`, `build_artifacts/rapports/` | oui | trace d'appels **payants** : pièce d'audit |
| `build_artifacts/prompts/` | **non** | 22 Mo dont 88 % le même bloc système, régénérables hors ligne, aucun appel engagé |
| `.env` | **non** | porte un jeton en clair ; aucun module ne le lit |

## 9. Les tests

```
export PYTHONPATH=src
python -m pytest tests -q                    # la suite complète, Phase 1 comprise
python -m pytest tests/test_cli.py -q        # les quatre sous-commandes et la chaîne
```

Rien dans la suite n'ouvre de socket ni ne dépense : l'étage 09 est testé contre
un client `converse` factice qui **compte ses appels**, et plusieurs tests
affirment que ce compteur vaut exactement 0 — c'est ainsi qu'« ce garde-fou a
empêché une dépense » s'écrit sans facture réelle.
