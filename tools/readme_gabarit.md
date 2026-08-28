# JDR_Spells — corpus de sorts Pathfinder 1e (français)

{sorts} sorts Pathfinder 1e en français, un fichier JSON par sort, plus les index
et les listes de classes qui permettent de répondre à « quels sorts un Paladin de
niveau 2 peut-il lancer ? » sans jamais retourner sur le web. Une couche
d'enrichissement générée par LLM (catégorie, résumé, tags, rôle tactique) vit à
côté, dans un arbre séparé. Tout est en clair, lisible, et **entièrement
régénérable depuis le wiki** — le scraping est clos et son cache HTML n'est plus
committé, donc une régénération complète repasse par le réseau (§7 de `CLAUDE.md`).

| Mesure | Valeur |
|---|---:|
| Classes lanceuses couvertes | {classes} |
| Entrées de listes de classes | {entrees} |
| Sorts uniques | {sorts} |
| Fichiers `data/sorts/*.json` | {sorts} |
| Sorts avec un bloc `mythique` | {mythiques} |
| Sorts avec des `variantes` | {variantes} |
| Sorts enrichis par LLM | {enrichis} |
| Fichiers de la vue jointe | {vues} |

Ces chiffres sont recomptés depuis le disque — par
`python -m pf_spells.build_manifest`, qui inscrit les sept premiers dans
`data/MANIFEST.json`, et par le rendu de ce README (voir *Modifier ce README* plus
bas). Le manifeste est un **recensement indépendant** : il ne recopie aucun chiffre
des rapports d'étapes, de sorte qu'un désaccord se voie.

## Démarrer

Python **3.11**. Trois dépendances seulement (`beautifulsoup4`, `jsonschema`,
`requests`) ; `pytest` pour les tests.

```
python -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

Vérifier que le corpus committé est sain — **hors ligne, aucune requête, aucune
dépense** :

```
export PYTHONPATH=src
python tools/preflight_corpus.py       # le corpus est-il là, complet, décodable ?
python -m pf_spells.validate_corpus    # l'audit de la Phase 1
pytest -q                              # la suite complète (~11 min)
```

`pytest` nu suffit : `pyproject.toml` déclare `pythonpath = ["src"]`. Rien dans la
suite n'ouvre de socket ni ne dépense — l'étage payant est testé contre un client
factice qui **compte ses appels**, et plusieurs tests affirment que ce compteur
vaut exactement 0.

Ensuite, selon ce qu'on veut faire :

| Objectif | Aller à |
|---|---|
| Lire les données, comprendre leur forme | *Le modèle à deux étages*, puis *Lire un fichier de sort* |
| Rejouer ou corriger le pipeline | *Rejouer le pipeline*, puis *Corriger les données* |
| Toucher à la couche LLM | **`docs/enrichissement.md`** — la procédure complète |
| Connaître les règles du dépôt | `.claude/skills/pf-corpus-conventions/SKILL.md` |
| Savoir ce qui reste ouvert | *Limites connues* et *État d'achèvement*, en fin de document |

## Source et attribution

Contenu extrait du wiki communautaire <https://www.pathfinder-fr.org/>.
Le matériel officiel Pathfinder appartient à **Black Book Editions** et **Paizo
Publishing**, conformément à la mention portée en pied des pages du wiki.
Ce corpus est constitué pour un **usage personnel** ; aucune licence n'est
accordée ici. Le crawl est volontairement lent (**1 requête/seconde maximum,
4 workers maximum**) : le wiki est tenu par des bénévoles, ce n'est pas un
réglage de performance.

## Le modèle à deux étages

Tout le pipeline découle de la forme du wiki, qui expose la même information à
deux endroits :

- la **liste de classe** (une page par classe) dit quels sorts la classe reçoit,
  à quel niveau, et donne les URLs des pages de sorts ;
- la **page de sort** donne le bloc technique et la description.

Les deux portent le fait « qui lance quoi, à quel niveau ». Le pipeline les
recoupe au lieu d'en choisir un, et publie le désaccord : c'est la clé
`concordance`, décrite plus bas.

L'`id` — le slug du nom du sort — est la **clé de jointure** unique entre
`listes_classes/`, `index/`, `sorts/`, `enrichissements/` et `vues/`. Son
algorithme est décrit dans `CLAUDE.md` § 4 et dans la Skill ; l'implémentation est
`src/pf_spells/slugs.py`. Un slug attribué est stable : **jamais renuméroté**.

## Carte du dépôt

```
elements_to_do.json                 entrée : 20 entrées brutes (classe + URL), jamais modifiée
pages/                              6 pages HTML d'échantillon, socle des tests
CLAUDE.md                           instructions permanentes pour les sessions d'agent
.claude/skills/pf-corpus-conventions/SKILL.md    l'autorité sur les conventions
docs/enrichissement.md              la procédure d'exploitation de la couche LLM
pyproject.toml, requirements.txt    dépendances et point d'entrée installable
data/schemas/sort.schema.json            contrat d'un fichier de sort
data/schemas/liste_classe.schema.json    contrat d'une ligne de liste de classe
data/schemas/enrichissement.schema.json  contrat d'un enrichissement LLM
data/conventions/vocabulaires/      les six listes CLOSES de l'enrichissement
src/pf_spells/                      le pipeline (un module par étape + les utilitaires)
tools/                              préflight, estimation de coût, rendu de ce README
tests/                              pytest, adossé à pages/ et au corpus committé
cache/html/, cache/index.jsonl      non committés (scraping clos) ; régénérables par 03/06
data/classes.json                   les classes : libellé, slug, URL, fichier de cache
data/listes_classes/<slug>.jsonl    une ligne par entrée de liste de classe
data/spell_pages.jsonl              url de sort ↔ fichier de cache, statut
data/index/sorts_uniques.jsonl      un sort unique par ligne, classes et niveaux agrégés
data/index/carte_doublons.json      distribution du partage entre classes
data/index/sorts_exclusifs.json     par classe, ses sorts exclusifs
data/sorts/<id>.json                LE corpus : un fichier par sort
data/enrichissements/<id>.json      la couche LLM : 16 clés closes, régénérable
data/vues/sorts_enrichis/<id>.json  vue DÉRIVÉE du join sorts × enrichissements
data/MANIFEST.json                  inventaire recompté de la Phase 1
reports/                            un rapport markdown par étape
build_artifacts/rapports/           la trace des appels payants — pièce d'audit
build_artifacts/quarantaine/        les réponses LLM refusées, conservées
```

## Lire un fichier de sort

Exemple réel et complet, **inséré à la génération** depuis
`data/sorts/armes-contre-le-mal.json` (un test vérifie l'égalité octet pour
octet) :

```json
{exemple_sort}```

Clé par clé :

| Clé | Contenu | Dans l'exemple |
|---|---|---|
| `id` | slug, clé de jointure, = le nom du fichier | `armes-contre-le-mal` |
| `nom` | nom d'affichage du wiki, accents **verbatim** | `Armes contre le mal` |
| `url` | URL absolue de la page source | …`Pathfinder-RPG.Armes%20contre%20le%20mal.ashx` |
| `ecole` | école de magie | `Transmutation` |
| `descripteurs` | descripteurs entre crochets de la ligne `École` | `[]` (aucun ici) |
| `niveaux` | abréviation de classe → niveau, **tel que la page du sort le dit** | `Inq 1`, `Pal 1`, `Prê 1` |
| `temps_incantation` | ligne `Temps d'incantation` | `1 action simple` |
| `composantes` | ligne `Composantes` | `V, FD` |
| `portee` | ligne `Portée` | `courte (7,50 m + 1,50 m/2 niveaux)…` |
| `cible` | `Cible` / `Effet` / `Zone d'effet`, fusionnés dans une seule clé | `une arme/niveau…` |
| `duree` | ligne `Durée` | `1 round/niveau` |
| `jet_de_sauvegarde` | ligne `Jet de sauvegarde` | `Vigueur, annule (inoffensif, objet)` |
| `resistance_magie` | ligne `Résistance à la magie` | `oui (inoffensif, objet)` |
| `description` | prose nettoyée, texte brut | le paragraphe de règles |
| `description_html` | même prose, HTML interne brut (liens conservés) | `<br/><br/>Les armes affectées…` |
| `mythique` | `null`, ou un bloc `description` + `description_html` | `null` |
| `variantes` | sorts « qui fonctionnent comme », **imbriqués**, chacun avec son bloc technique | `[]` |
| `sources` | ouvrages sources | 2 entrées |
| `autres` | libellés du bloc technique non reconnus — **jamais écartés** | `restriction_divinite` |
| `classes` | remplie à l'étape 08 depuis les listes de classes, recoupée avec `niveaux` | 3 entrées |
| `meta` | provenance : `url`, `cache_fichier`, `recupere_le`, `parser_version` | — |

Les 21 clés sont **toujours présentes**, même vides (`null`, `[]`) : un humain qui
parcourt les fichiers voit toujours la même forme. C'est une règle du dépôt, pas
une propriété de cet exemple.

### `niveaux` contre `classes` — deux sources, pas une redondance

`niveaux` vient de la **page du sort** ; `classes` vient des **listes de
classes**. L'étape 08 rapproche les deux et pose `concordance` :

| `concordance` | Sens |
|---|---|
| `true` | les deux sources donnent le même niveau |
| `false` | elles divergent — **constaté, jamais corrigé automatiquement** |
| `null` | la page du sort ne mentionne aucune abréviation de cette classe : non comparable |

Ici les trois entrées valent `true`. Sur l'ensemble du corpus, 8409 paires
comparables sur 8409 concordent (cf. `reports/08_enrich.md`).

## Lire une ligne de liste de classe

Première ligne de `data/listes_classes/paladin.jsonl`, insérée à la génération —
un objet JSON compact par ligne :

```json
{exemple_liste}```

| Clé | Contenu |
|---|---|
| `id` | le slug, joint vers `data/sorts/<id>.json` |
| `nom` | nom d'affichage tel qu'imprimé sur la page de liste |
| `url` | URL absolue de la page du sort |
| `classe` / `niveau` | la classe de cette liste, et le niveau auquel elle obtient le sort |
| `ecole` | l'école, **quand** la page groupe par école (`null` sinon — la page Paladin ne groupe pas) |
| `description_courte` | le blurb qui suit le lien |
| `sources` | les étiquettes d'ouvrage entre parenthèses |
| `ligne_html` | le `<li>` d'origine, pour rejuger un cas douteux sans re-crawler |

## Les trois fichiers d'index — une question chacun

| Fichier | Question à laquelle il répond |
|---|---|
| `data/index/sorts_uniques.jsonl` | « quel est l'ensemble des sorts, et pour chacun quelles classes le donnent, à quel niveau ? » — une ligne par sort, avec `nb_classes`, `niveau_min`, `niveau_max`, `partage` |
| `data/index/carte_doublons.json` | « à quel point les sorts sont-ils partagés ? » — distribution du nombre de classes par sort et palmarès des plus partagés |
| `data/index/sorts_exclusifs.json` | « quels sorts n'appartiennent qu'à cette classe ? » — par classe, ses sorts exclusifs |

`data/spell_pages.jsonl` répond à une quatrième question, purement technique :
« cette page a-t-elle été récupérée, et dans quel fichier de cache ? »

## La couche d'enrichissement LLM

Un **arbre parallèle**, joint par `id` et rien d'autre : `data/sorts/` n'est jamais
touché par cette couche. Chaque `data/enrichissements/<id>.json` porte 16 clés
closes — catégorie principale, résumé court, tags, rôles tactiques, cible typique,
type de dégâts, condition infligée, plus la provenance (`hash_source`,
`version_prompt`, `version_taxonomie`, `modele`).

Deux garde-fous en font une couche vérifiable plutôt qu'une couche crue :

- **`preuves` est le contrôle anti-confabulation.** Chaque champ dérivé du texte
  doit citer une **sous-chaîne littérale du source**, vérifiée mécaniquement.
  Seul pli toléré : `’` (U+2019) contre `'`.
- **Les six vocabulaires sont CLOS** (`data/conventions/vocabulaires/`). Le modèle
  choisit dedans ou déclare son embarras dans `notes_ambiguite` ; il n'invente pas
  de tag.

**Il n'y a aucun verrou humain, délibérément.** `verifie_par_humain` n'existe pas
et le schéma refuse une 17ᵉ clé : se déclarer relu rend un enregistrement
*invalide*, pas exempté. Une retouche à la main **sera écrasée** — on corrige la
liste close ou le prompt, puis on régénère.

`data/vues/sorts_enrichis/` est la vue jointe, **dérivée et jamais éditée à la
main**, idempotente à l'octet. Elle distingue deux statuts qu'il ne faut pas
confondre : `sans_enrichissement` (le sort n'est pas couvert) et
`enrichissement_invalide` (couvert, mais la réponse a été rejetée).

État de la passe committée :

| Mesure | Valeur |
|---|---|
| Enregistrements produits | {enrichis} / {sorts} |
| Conformes à l'étage de validation | {conformes} |
| Rejets `preuve_absente_du_source` | {rejets} |
| Sorts en quarantaine, non couverts | {quarantaine} |
| `notes_ambiguite` non nul | {notes_ambiguite} ({taux_ambiguite} %) — relues et acceptées |

Tout est détaillé dans **`docs/enrichissement.md`** : le flux, l'estimation de
coût, la boucle de réglage du prompt, et quoi faire de chaque alerte du rapport.
**Lire ce document avant de lancer l'étage payant.**

## Rejouer le pipeline

{pipeline}

Sur un dépôt cloné tel quel, `cache/html/` n'est **plus committé** (scraping
clos) : les étapes 03 et 06 refont toutes les requêtes au premier lancement,
dans les limites de throttle du §7 de `CLAUDE.md`. Sur un poste où le cache
existe déjà localement, 03 et 06 continuent de le lire sans re-crawler.

`enrich_llm` **facture des appels**. Sa dépense est bornée par construction :
plafond d'appels, reprise vérifiée sur `hash_source` avant l'appel, confirmation
au-delà de 100 enregistrements, coupe-circuit, et `--estimer-seulement` qui répond
« combien ça coûte » sans rien dépenser. Le jeton passe par la variable
d'environnement `AWS_BEARER_TOKEN_BEDROCK` et **jamais par le dépôt**.

> **Avertissement de dépense.** Les enregistrements committés sont en `p1.4` et
> `p1.5` alors que `VERSION_PROMPT` vaut `p1.5`. La reprise régénérant tout
> enregistrement de version différente, un `enrich` sans argument **repaierait
> ~1950 appels (~5 $)**. Lancer `--estimer-seulement` d'abord ; les deux réponses
> légitimes sont décrites dans `docs/enrichissement.md`.

Les quatre étages de la couche LLM ont une entrée unique, garde d'entrée
comprise : `python -m pf_spells.cli` (`prepare-prompts`, `enrich`,
`validate-enrich`, `build-vues`). Après un `pip install -e .`, la même chose
s'écrit `pf-spells <sous-commande>`.

## Corriger les données

`data/sorts/*.json` est **régénéré par le pipeline**, et c'est le pipeline qui
fait foi :

- **Une édition manuelle n'a aucun statut particulier** et sera écrasée à la
  première régénération. Corriger une valeur fausse se fait dans `parse_spells`,
  puis on régénère : la correction vaut alors pour les {sorts} sorts, pas pour un
  seul. `cache/html/` étant committé, régénérer ne recrawle rien.
- `parse_spells` exige quand même `--overwrite` pour réécrire un fichier
  existant. C'est un **garde-fou** contre l'accident — une relance distraite ne
  doit pas réécrire {sorts} fichiers committés — pas une garantie d'autorité sur
  le contenu.
- `enrich_spells` ne réécrit **que** la clé `classes`, parce que c'est la seule
  qu'il calcule ; le reste du fichier est conservé tel qu'il a été lu.

Si une retouche ponctuelle est malgré tout nécessaire, conserver l'`indent=2`, les
retours à la ligne LF, l'UTF-8 sans BOM et le retour à la ligne final — les
accents restent en clair. Puis vérifier :

```
export PYTHONPATH=src
python -m pf_spells.validate_corpus
pytest -q
```

Ne pas renommer un `id` : c'est la clé de jointure, et les slugs sont stables par
convention. Si une valeur vient du bloc technique, `meta.cache_fichier` indique la
page HTML exacte dont elle a été tirée.

## Modifier ce README

Ce fichier est **rendu**, pas édité à la main :

```
export PYTHONPATH=src
python tools/render_readme.py
```

Le gabarit est `tools/readme_gabarit.md`. Trois blocs sont insérés depuis le
disque à la génération — l'exemple de sort, la ligne de liste de classe, et le
bloc de commandes du pipeline (repris de `CLAUDE.md`, pour que les deux ne
puissent pas nommer des modules différents) — et les chiffres sont recomptés.
`tests/test_docs.py` vérifie ces égalités octet pour octet : un exemple retapé de
mémoire est pire qu'aucun exemple, parce qu'il enseigne des formes que le corpus
n'a pas.

## Limites connues

| Limite | Détail |
|---|---|
| Périmètre des classes | {classes} classes issues de `elements_to_do.json` ; Pathfinder 1e en compte davantage. Des abréviations hors périmètre (`Réd`, …) apparaissent donc dans `niveaux` sans entrée `classes` correspondante : c'est normal, pas une anomalie. |
| `Alchimiste` en double | présent deux fois dans l'entrée (URLs différant par la casse) ; dédoublonné par URL percent-décodée et minusculisée, 20 → 19, dédoublonnage journalisé. |
| Blocs `Mythique` | capturés et isolés dans la clé `mythique` ({mythiques} sorts) ; **suppression prévue dans une phase ultérieure** — la clé existe pour rendre l'opération triviale. |
| Variantes | les sorts « qui fonctionnent comme » sont **imbriqués** dans leur parent (`variantes`) et n'ont pas de fichier propre. |
| Paires non comparables | 518 paires (sort, classe) ont `concordance: null` : la page du sort ne nomme pas la classe. Détail dans `reports/08_enrich.md`. |
| Étiquettes de source | conservées telles que le wiki les écrit, non normalisées vers une table d'ouvrages. |
| Couverture de l'enrichissement | {sans_enrichissement} sorts ne sont pas couverts et restent en quarantaine ; la vue jointe les marque `sans_enrichissement`. |
| Portée du manifeste | `data/MANIFEST.json` recense la **Phase 1 seulement** : il ne compte ni `data/enrichissements/` ni `data/vues/`. Ces deux arbres ont leurs propres rapports. |
| Audit complet | l'état de validation du corpus est dans **`reports/09_validation.md`** ; les rapports par étape vont de `reports/03_fetch_classes.md` à `reports/08_enrich.md`. |

## État d'achèvement

Le corpus et les deux couches sont **complets et vérifiés** : la suite de tests
passe intégralement, et `validate_corpus` rend **PASS — 0 anomalie bloquante**,
avec 4 avertissements non bloquants (le volume réel s'écarte des fourchettes
qu'annonçait le plan initial, l'Antipaladin monte au niveau 6 et non 4, et deux
classes n'ont aucun sort exclusif). Détail dans `reports/09_validation.md` et
`reports/09_anomalies.jsonl`.

Ce qui reste ouvert, sciemment et sans blocage :

- **{rejets} enregistrements sont rejetés** par le contrôle de preuves : de vraies
  paraphrases du source. Ils sont **constatés, pas blanchis** — l'étage de
  validation refuse de les accepter, ce serait affaiblir le seul contrôle
  anti-confabulation du pipeline. `validate-enrich --strict` sort donc `1`, et
  c'est le comportement correct, pas un pipeline cassé. La correction est en
  amont : resserrer le prompt et régénérer ces {rejets} enregistrements.
- **Le seuil sur `notes_ambiguite` a été porté de 5 % à {seuil_ambiguite} %** le
  2026-07-31, après relecture une à une des {notes_ambiguite} notes, jugées
  saines. C'est un arbitrage humain assumé et documenté ; son coût — la mesure ne
  détecte plus une régression avant un quasi-doublement du taux — est écrit dans
  `docs/enrichissement.md` § 4 et dans le module.
- **Les blocs `mythique`** sont capturés mais leur retrait est prévu pour une
  phase ultérieure.

## Conventions

Les conventions du projet (règles UTF-8, algorithme de slug, vocabulaire des clés
JSON, table des classes, règles de format, anti-patterns) ont une **autorité
unique** : `.claude/skills/pf-corpus-conventions/SKILL.md`. Deux Skills la
complètent sur la couche LLM — `pf-enrichment-conventions` (les 16 clés, les
vocabulaires clos, `preuves`) et `pf-bedrock-batch` (le client, le jeton, le
caching). `CLAUDE.md` résume les non-négociables et y renvoie ; ce README ne les
redéfinit pas davantage. **Code et Skill divergents : la Skill gagne.**
