# JDR_Spells — corpus de sorts Pathfinder 1e (français)

## Ce que c'est

2070 fichiers JSON, un par sort, plus les index et les listes de classes qui
permettent de répondre à « quels sorts un Paladin de niveau 2 peut-il lancer ? »
sans jamais retourner sur le web. Tout est en clair, lisible, et **entièrement
régénérable depuis le cache HTML committé**.

| Mesure | Valeur |
|---|---:|
| Classes lanceuses couvertes | 19 |
| Entrées de listes de classes | 8927 |
| Sorts uniques | 2070 |
| Fichiers `data/sorts/*.json` | 2070 |
| Pages HTML en cache | 2089 |
| Sorts avec un bloc `mythique` | 287 |
| Sorts avec des `variantes` | 196 |

Ces chiffres sont recomptés depuis le disque à chaque exécution de
`python -m pf_spells.build_manifest`, qui les inscrit dans `data/MANIFEST.json`.
Ce manifeste est un **recensement indépendant** : il ne recopie aucun chiffre des
rapports d'étapes, de sorte qu'un désaccord se voie.

## Source et attribution

Contenu extrait du wiki communautaire <https://www.pathfinder-fr.org/>.
Le matériel officiel Pathfinder appartient à **Black Book Editions** et **Paizo
Publishing**, conformément à la mention portée en pied des pages du wiki.
Ce corpus est constitué pour un **usage personnel** ; aucune licence n'est
accordée ici. Le crawl est volontairement lent (**1 requête/seconde maximum,
4 workers maximum**) : le wiki est tenu par des bénévoles.

## Carte du dépôt

```
elements_to_do.json                 entrée : 20 entrées brutes (classe + URL), jamais modifiée
pages/                              6 pages HTML d'échantillon, socle des tests
CLAUDE.md                           instructions permanentes pour les sessions d'agent
.claude/skills/pf-corpus-conventions/SKILL.md    l'autorité sur les conventions
schemas/sort.schema.json            contrat d'un fichier de sort
schemas/liste_classe.schema.json    contrat d'une ligne de liste de classe
src/pf_spells/                      le pipeline (un module par étape + les utilitaires)
tests/                              pytest, adossé à pages/ et au corpus committé
cache/html/<sha1>.html              HTML brut committé : corriger un parseur sans re-crawler
cache/index.jsonl                   journal de récupération (url, fichier, statut, date)
data/classes.json                   19 classes : libellé, slug, URL, fichier de cache
data/listes_classes/<slug>.jsonl    une ligne par entrée de liste de classe
data/spell_pages.jsonl              url de sort ↔ fichier de cache, statut
data/index/sorts_uniques.jsonl      un sort unique par ligne, classes et niveaux agrégés
data/index/carte_doublons.json      distribution du partage entre classes
data/index/sorts_exclusifs.json     par classe, ses sorts exclusifs
data/sorts/<id>.json                LE corpus : un fichier par sort
data/MANIFEST.json                  inventaire recompté de tout ce qui précède
reports/                            un rapport markdown par étape
build/                              les plans d'implémentation, un fichier par étape
```

L'`id` (le slug du nom du sort) est la **clé de jointure** entre
`listes_classes/`, `index/` et `sorts/`. Son algorithme est décrit dans
`CLAUDE.md` § 4 et dans la Skill ; l'implémentation est `src/pf_spells/slugs.py`.

## Lire un fichier de sort

Exemple réel et complet, copié tel quel depuis
`data/sorts/armes-contre-le-mal.json` :

```json
{
  "id": "armes-contre-le-mal",
  "nom": "Armes contre le mal",
  "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Armes%20contre%20le%20mal.ashx",
  "ecole": "Transmutation",
  "descripteurs": [],
  "niveaux": {
    "Inq": 1,
    "Pal": 1,
    "Prê": 1
  },
  "temps_incantation": "1 action simple",
  "composantes": "V, FD",
  "portee": "courte (7,50 m + 1,50 m/2 niveaux) (5 c + 1 c/2 niveaux)",
  "cible": "une arme/niveau, éloignées les unes des autres au maximum de 6 m",
  "duree": "1 round/niveau",
  "jet_de_sauvegarde": "Vigueur, annule (inoffensif, objet)",
  "resistance_magie": "oui (inoffensif, objet)",
  "description": "Les armes affectées par ce sort brillent d’une lueur pâle qui éclaire faiblement une case de 1,50m de côté. Ces armes ignorent également la RD des créatures Mauvaises si celles-ci ont une RD 5 ou inférieure et tant que ce n’est pas une RD/épique.",
  "description_html": "<br/><br/>Les armes affectées par ce sort brillent d’une lueur pâle qui éclaire faiblement une case de 1,50m de côté. Ces armes ignorent également la <a class=\"pagelink\" href=\"Pathfinder-RPG.RD.ashx\" title=\"RD\">RD</a> des créatures Mauvaises si celles-ci ont une RD 5 ou inférieure et tant que ce n’est pas une <a class=\"pagelink\" href=\"Pathfinder-RPG.RD%c3%a9pique.ashx\" title=\"RDépique\">RD/épique</a>.",
  "mythique": null,
  "variantes": [],
  "sources": [
    "Inner Sea Gods/Dieux de la mer Intérieure",
    "Gods and Magic, Faiths of Purity, Faiths of Balance, Faiths of Corruption/Dieux et magie"
  ],
  "autres": {
    "restriction_divinite": "Option plus\ncommune chez\nles fidèles\nde Iomédae."
  },
  "classes": [
    {
      "classe": "Inquisiteur",
      "slug": "inquisiteur",
      "niveau": 1,
      "niveau_page": 1,
      "concordance": true
    },
    {
      "classe": "Paladin",
      "slug": "paladin",
      "niveau": 1,
      "niveau_page": 1,
      "concordance": true
    },
    {
      "classe": "Prêtre/Prêtre combattant/Oracle",
      "slug": "pretre-pretre-combattant-oracle",
      "niveau": 1,
      "niveau_page": 1,
      "concordance": true
    }
  ],
  "meta": {
    "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Armes%20contre%20le%20mal.ashx",
    "cache_fichier": "cache/html/ee6efe568a9c4f82d75f7ec0a0993c1c98d9791c.html",
    "recupere_le": "2026-07-28T22:41:55.490394+00:00",
    "parser_version": "1.0.0"
  }
}
```

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
| `mythique` | `null`, ou `{description, description_html}` | `null` |
| `variantes` | sorts « qui fonctionnent comme », **imbriqués**, chacun avec son bloc technique | `[]` |
| `sources` | ouvrages sources | 2 entrées |
| `autres` | libellés du bloc technique non reconnus — **jamais écartés** | `restriction_divinite` |
| `classes` | remplie à l'étape 08 depuis les listes de classes, recoupée avec `niveaux` | 3 entrées |
| `meta` | provenance : `url`, `cache_fichier`, `recupere_le`, `parser_version` | — |

Les 21 clés sont **toujours présentes**, même vides (`null`, `[]`, `{}`) : un
humain qui parcourt les fichiers voit toujours la même forme.

### `niveaux` contre `classes` — deux sources, pas une redondance

`niveaux` vient de la **page du sort** ; `classes` vient des **listes de
classes**. L'étape 08 rapproche les deux et pose `concordance` :

| `concordance` | Sens |
|---|---|
| `true` | les deux sources donnent le même niveau |
| `false` | elles divergent — **constaté, jamais corrigé automatiquement** |
| `null` | la page du sort ne mentionne aucune abréviation de cette classe : non comparable |

Ici les trois entrées valent `true` : `niveau` (liste) et `niveau_page` (page) sont
à 1 pour l'Inquisiteur, le Paladin et le Prêtre. Sur l'ensemble du corpus, 8409
paires comparables sur 8409 concordent (cf. `reports/08_enrich.md`).

## Lire une ligne de liste de classe

Première ligne de `data/listes_classes/paladin.jsonl` — un objet JSON compact par
ligne :

```json
{"id":"appel-du-chevalier","nom":"Appel du chevalier","url":"https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Appel%20du%20chevalier.ashx","classe":"Paladin","niveau":1,"ecole":null,"description_courte":"Oblige la cible à s'avancer vers le personnage et à le combattre.","sources":["MJRA"],"ligne_html":"<b><i><a class=\"pagelink\" href=\"Pathfinder-RPG.Appel%20du%20chevalier.ashx\" title=\"Appel du chevalier\">Appel du chevalier</a></i></b> <i>(MJRA)</i>. Oblige la cible à s'avancer vers le personnage et à le combattre."}
```

| Clé | Contenu |
|---|---|
| `id` | le slug, joint vers `data/sorts/<id>.json` |
| `nom` | nom d'affichage tel qu'imprimé sur la page de liste |
| `url` | URL absolue de la page du sort |
| `classe` / `niveau` | la classe de cette liste, et le niveau auquel elle obtient le sort |
| `ecole` | l'école, **quand** la page groupe par école (`null` sinon — la page Paladin ne groupe pas) |
| `description_courte` | le blurb qui suit le lien |
| `sources` | les étiquettes d'ouvrage entre parenthèses (`(MJRA)` ici) |
| `ligne_html` | le `<li>` d'origine, pour rejuger un cas douteux sans re-crawler |

## Les trois fichiers d'index — une question chacun

| Fichier | Question à laquelle il répond |
|---|---|
| `data/index/sorts_uniques.jsonl` | « quel est l'ensemble des sorts, et pour chacun quelles classes le donnent, à quel niveau ? » — une ligne par sort, avec `nb_classes`, `niveau_min`, `niveau_max`, `partage` |
| `data/index/carte_doublons.json` | « à quel point les sorts sont-ils partagés ? » — distribution du nombre de classes par sort et palmarès des plus partagés |
| `data/index/sorts_exclusifs.json` | « quels sorts n'appartiennent qu'à cette classe ? » — par classe, ses sorts exclusifs |

`data/spell_pages.jsonl` répond à une quatrième question, purement technique :
« cette page a-t-elle été récupérée, et dans quel fichier de cache ? »

## Rejouer le pipeline

```
export PYTHONPATH=src
python -m pf_spells.fetch_classes      # étape 03 - en cache, idempotent
python -m pf_spells.parse_lists        # étape 04 - hors ligne
python -m pf_spells.build_index        # étape 05 - hors ligne
python -m pf_spells.fetch_spells       # étape 06 - en cache, idempotent, ~1 h à froid
python -m pf_spells.parse_spells       # étape 07 - hors ligne ; --overwrite explicite
python -m pf_spells.enrich_spells      # étape 08 - hors ligne, idempotent
python -m pf_spells.validate_corpus    # étape 09 - hors ligne, sortie 1 si FAIL
python -m pf_spells.build_manifest     # étape 10 - hors ligne
```

Sur un dépôt cloné tel quel, **aucune de ces commandes ne touche au réseau** :
`cache/html/` est committé, donc les étapes 03 et 06 sont des lectures de cache,
pas des re-crawls. Le crawl à froid (~1 h) n'a lieu que si le cache est vidé.
Suite de tests : `PYTHONPATH=src python -m pytest tests -q`.

## Corriger les données

`data/sorts/*.json` est **régénéré par le pipeline**, et c'est le pipeline qui
fait foi :

- **Une édition manuelle n'a aucun statut particulier** et sera écrasée à la
  première régénération. Corriger une valeur fausse se fait dans `parse_spells`,
  puis on régénère : la correction vaut alors pour les 2 070 sorts, pas pour un
  seul. `cache/html/` étant committé, régénérer ne recrawle rien.
- `parse_spells` exige quand même `--overwrite` pour réécrire un fichier
  existant. C'est un garde-fou contre l'accident — une relance distraite ne doit
  pas réécrire 2 070 fichiers committés — pas une garantie d'autorité sur le
  contenu.
- `enrich_spells` ne réécrit **que** la clé `classes`, parce que c'est la seule
  qu'il calcule ; le reste du fichier est conservé tel qu'il a été lu.

Si une retouche ponctuelle est malgré tout nécessaire, conserver l'`indent=2`,
les retours à la ligne LF, l'UTF-8 sans BOM et le retour à la ligne final — les
accents restent en clair. Puis vérifier :

```
export PYTHONPATH=src
python -m pf_spells.validate_corpus
python -m pytest tests -q
```

Ne pas renommer un `id` : c'est la clé de jointure, et les slugs sont stables par
convention. Si une valeur vient du bloc technique, `meta.cache_fichier` indique la
page HTML exacte dont elle a été tirée.

## Limites connues

| Limite | Détail |
|---|---|
| Périmètre des classes | 19 classes issues de `elements_to_do.json` ; Pathfinder 1e en compte davantage. Des abréviations hors périmètre (`Réd`, …) apparaissent donc dans `niveaux` sans entrée `classes` correspondante : c'est normal, pas une anomalie. |
| `Alchimiste` en double | présent deux fois dans l'entrée (URLs différant par la casse) ; dédoublonné par URL percent-décodée et minusculisée, 20 → 19, dédoublonnage journalisé. |
| Blocs `Mythique` | capturés et isolés dans la clé `mythique` (287 sorts) ; **suppression prévue dans une phase ultérieure** — la clé existe pour rendre l'opération triviale. |
| Variantes | les sorts « qui fonctionnent comme » sont **imbriqués** dans leur parent (`variantes`) et n'ont pas de fichier propre. |
| Paires non comparables | 518 paires (sort, classe) ont `concordance: null` : la page du sort ne nomme pas la classe. Détail dans `reports/08_enrich.md`. |
| Étiquettes de source | conservées telles que le wiki les écrit, non normalisées vers une table d'ouvrages. |
| Audit complet | l'état de validation du corpus est dans **`reports/09_validation.md`** ; les rapports par étape vont de `reports/03_fetch_classes.md` à `reports/08_enrich.md`. |

## Conventions

Les conventions du projet (règles UTF-8, algorithme de slug, vocabulaire des clés
JSON, table des classes, règles de format, anti-patterns) ont une **autorité
unique** : `.claude/skills/pf-corpus-conventions/SKILL.md`. `CLAUDE.md` en résume
les non-négociables et y renvoie ; ce README ne les redéfinit pas davantage.
