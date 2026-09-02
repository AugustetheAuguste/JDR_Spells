# CLAUDE.md — JDR_Spells

## 1. Objet du dépôt et modèle de données à deux étages

Corpus de sorts Pathfinder 1e en français extrait du wiki communautaire
**pathfinder-fr.org** (`README.md` = entrée humaine). Phase 1 = *scraper et
organiser* : pas de logique de jeu, pas d'UI, pas de recherche. Le wiki expose deux
étages, d'où tout le pipeline : la **liste de classe** (une par classe) donne quels
sorts la classe reçoit, à quel niveau, et les URLs de l'étage 2 ; la **page de sort**
donne le bloc technique et la description. Les deux portent le même fait « qui lance
quoi, à quel niveau » et sont recoupés à l'étape 08 (`classes`.`concordance`).

## 2. Périmètre et autorité des artefacts

Inventaire recompté : **`data/MANIFEST.json`** (`python -m pf_spells.build_manifest`).

| Chemin | Étape | Fait autorité pour |
|---|---|---|
| `elements_to_do.json` | — | la liste d'entrée (20 entrées brutes) — **jamais modifié** |
| `data/classes.json` | 03 | libellé de classe ↔ slug ↔ URL de liste (19 classes) |
| `data/listes_classes/<slug>.jsonl` | 04 | quels sorts une classe reçoit, à quel niveau (8927) |
| `data/spell_pages.jsonl` | 06 | url de sort ↔ fichier HTML en cache, statut |
| `data/index/sorts_uniques.jsonl` | 05 | l'ensemble des sorts uniques (2070) |
| `data/index/carte_doublons.json` | 05 | le partage des sorts entre classes |
| `data/index/sorts_exclusifs.json` | 05 | les sorts exclusifs à une classe |
| `data/sorts/<id>.json` | 07+08 | **le sort lui-même** (2070 fichiers, 21 clés) |
| `cache/html/<sha1>.html`, `cache/index.jsonl` | 03, 06 | les octets source bruts + le journal de récupération — **non committés depuis la clôture du scraping** (§9), régénérés localement par une relance de 03/06 |
| `data/schemas/*.json` | 02 | les contrats de sortie (+ `enrichissement.schema.json` § 10, `web_index.schema.json`, l'export web) |
| `data/conventions/vocabulaires/*.json` | 04 | les six listes **closes** de l'enrichissement |
| `data/enrichissements/<id>.json` | étage 09 | la couche LLM d'un sort (2048 fichiers, 16 clés) |
| `data/vues/sorts_enrichis/<id>.json` | — | **rien** : vue dérivée du join sur `id` (§ 10) |
| `reports/*.md` | 03–09 | le résultat et les anomalies de chaque étape (dont `09_validation.md`) |
| `build_artifacts/rapports/`, `.../quarantaine/` | 09, 10 | la trace des appels **payants** et les réponses refusées |
| `web/` | interface | le site consultable (§ 11) — code applicatif, fait autorité sur lui-même |
| `web/public/data/` | export web | **rien** : dérivé du corpus, committé, jamais édité (§ 11) |
| `web/data_sources/alias_manuel.tsv` | — | la table d'alias anglais→français, **éditée à la main** |

## 3. Règles dures — non négociables

- Le HTML du wiki est **UTF-8**, à décoder **explicitement** : pas de
  `<meta charset>`, toute détection automatique donne du mojibake.
- Toute analyse commence par **découper sur `<div id="PageContentDiv">`** (jusqu'à
  `<div id="PageAttachmentsDiv"`), sinon la navigation du site passe pour des sorts.
- **Clés** JSON françaises, `snake_case`, **sans accent** (`portee`) ; **valeurs**
  accentuées **verbatim**. Le retrait d'accents n'a lieu **que** dans le slug `id`.
- **`unidecode` n'est pas installé** — `unicodedata.normalize('NFKD', …)`, stdlib.
- Sorties UTF-8 sans BOM, **LF** (win32 inclus), `ensure_ascii=False` ; `.json` en
  `indent=2` + newline final, `.jsonl` compact. Aucune clé n'est omise : scalaire
  absent → `null`, liste absente → `[]`. Rien n'est écarté silencieusement — lacunes,
  libellés inconnus, collisions de slug → `reports/`.

## 4. L'algorithme de slug `id` — la clé de jointure

Un seul `id` relie `listes_classes/`, `index/` et `sorts/`. Calcul **unique** :
(1) nom d'affichage exact du wiki ; (2) pré-mapper les ligatures `œ`/`Œ`→`oe`,
`æ`/`Æ`→`ae` — NFKD ne les décompose pas, donc **avant** ; (3)
`unicodedata.normalize('NFKD', nom)` puis retirer tout caractère où
`unicodedata.combining(ch)` est vrai ; (4) minuscules ; (5) chaque suite hors
`[a-z0-9]` → un seul `-` ; (6) élaguer les `-` de tête et de queue. Collision →
suffixe `-2`, `-3`, … dans l'ordre de rencontre, journalisée dans `reports/`. **Un
slug attribué est stable : jamais renuméroté.** Réf. `src/pf_spells/slugs.py`.

## 5. L'autorité sur les conventions : la Skill

`Skill(skill="pf-corpus-conventions")` — `.claude/skills/pf-corpus-conventions/SKILL.md`.
**Charger cette Skill dans toute session qui lit ou écrit des données du corpus.**
Elle détient le détail : clés JSON, normalisation des libellés du bloc technique,
table des 19 classes et abréviations, formats, anti-patterns de la source. Deux
Skills la complètent sur la couche LLM (§ 10) : `pf-enrichment-conventions` (les
16 clés, les vocabulaires clos, `preuves`) — **à charger avant de toucher à
`data/enrichissements/`, `data/vues/` ou `data/conventions/vocabulaires/`** — et
`pf-bedrock-batch` (le client, le jeton, le caching). Ce fichier n'en recopie rien
— des règles dupliquées divergent. **Code et Skill divergents : la Skill gagne.**

## 6. Relancer le pipeline — les relances tapent le cache, elles ne re-crawlent pas

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
python -m pf_spells.prepare_prompts    # étage 08 - hors ligne, idempotent
python -m pf_spells.enrich_llm         # étage 09 - RÉSEAU, PAYANT (docs/enrichissement.md)
python -m pf_spells.validate_enrichment  # étage 10 - hors ligne, 1 si --strict échoue
python -m pf_spells.build_vues         # vue jointe - hors ligne, dérivée
```

Les quatre derniers ont une entrée unique, garde d'entrée comprise :
`python -m pf_spells.cli` (`prepare-prompts`, `enrich`, `validate-enrich`,
`build-vues`). Procédures de réglage et de correction : **`docs/enrichissement.md`**.

`cache/html/` n'est **plus committé** depuis la clôture du scraping (§9) : un
dépôt fraîchement cloné n'a pas de cache, et 03/06 refont toutes les requêtes
réseau au prochain lancement, dans les limites de throttle du §7. Sur un dépôt où
`cache/` existe déjà (poste de travail n'ayant jamais purgé le cache local), 03 et
06 continuent de le lire et de ne refaire aucune requête — d'où la correction d'un
parseur sans retoucher au wiki, quand le cache est disponible. Tests :
`PYTHONPATH=src python -m pytest tests -q`.

## 7. Les quatre modules qui sortent sur le réseau

**Wiki** (`fetch_classes`, `fetch_spells`) : ne jamais monter le throttle au-dessus
de 1 requête/seconde, ni les workers au-dessus de 4 — pathfinder-fr.org est tenu
par des bénévoles, ce n'est pas un réglage de performance. **Bedrock, facturé**
(`taxo_passe0`, `enrich_llm`) : on-demand seulement, le jeton porteur n'ouvrant pas
S3. Dépense bornée *par construction* : plafond d'appels, reprise sur `hash_source`
vérifiée avant l'appel, confirmation au-delà de 100 enregistrements (`--oui` hors
terminal), coupe-circuit, `--estimer-seulement`. Le bloc système, identique pour les
2070 sorts, est ce que le prompt caching amortit (88 % de l'entrée) ; zéro lecture de
cache = coût doublé, et le cache a un plancher de 4096 tokens sous lequel il échoue
**en silence**. Jeton : `AWS_BEARER_TOKEN_BEDROCK`, **variable d'environnement
uniquement** — jamais dans le dépôt, `.env` est gitignoré et aucun module ne le lit.
**Vérifier le plafond de dépense (`--estimer-seulement`) avant toute passe
complète.** Ces quatre modules sont les seules exceptions : tout le reste, étage 10
et vues compris, est hors ligne.

## 8. `data/sorts/*.json` est un artefact de machine — le pipeline fait foi

- L'autorité est celle du parseur sur le HTML en cache : une retouche manuelle
  **sera écrasée** à la régénération. Corriger `parse_spells`, puis régénérer.
- Garde-fous contre l'accident, pas garanties d'autorité : `--overwrite` exigé pour
  réécrire, `enrich_spells` limité à la clé `classes`. Provenance dans `meta`.

## 9. Anomalies connues, permanentes

| Sujet | État |
|---|---|
| `Alchimiste` en double dans `elements_to_do.json` (casse de l'URL) | dédoublonné par URL percent-décodée + minuscule, 20 → 19 ; toujours journalisé |
| Blocs `Mythique` (`mythique` non nul, 287 sorts) | capturés, isolés dans leur clé ; **suppression prévue en phase ultérieure** |
| Libellés multi-classes (`Arcaniste/Ensorceleur/Magicien`, `Prêtre/Prêtre combattant/Oracle`) | une page, un libellé combiné — **jamais scindés** (règle inchangée depuis l'origine ; son *objet* a changé, cf. note ci-dessous) |
| Abréviations hors des 19 classes (`Réd`, …) | normales dans `niveaux`, listées dans `reports/08_enrich.md` |
| Concordance liste ↔ page | 100 % des paires comparables ; divergences **constatées, jamais corrigées** |
| `cache/html/` et `cache/index.jsonl` supprimés du dépôt (scraping clos, 2026-08-27) | non committés désormais ; `data/MANIFEST.json` ne les recense plus, régénérables par une relance de 03/06 |

**Note (fusion des dons, étape 17) — l'objet du libellé combiné a changé, la
règle non.** Depuis la fusion du corpus des dons (§13-§15), un libellé combiné
comme `Arcaniste/Ensorceleur/Magicien` n'identifie plus « la classe du
personnage » : cette responsabilité est passée au registre des 42 classes
(`data/conventions/classes_unifiees.json`, §14), qui est la clé de jointure
avec le corpus des dons. Le libellé combiné redevient ce qu'il a toujours été
dans le corpus des sorts pris seul : **l'identité d'une liste de sorts** — une
page du wiki, pas une classe de joueur. La règle « jamais scindés » tient donc
toujours, mais elle porte sur un objet plus étroit qu'avant la fusion ; ne pas
la lire comme « le libellé combiné = la classe ».

## 10. Enrichissement LLM — `data/enrichissements/` et la vue jointe

- **Arbre parallèle, entièrement régénérable**, joint par `id` et rien d'autre ;
  `data/sorts/` n'est jamais touché. 16 clés closes, aucune omise.
- **Aucun verrou humain, délibérément** : `verifie_par_humain` n'existe pas, le
  schéma refuse une 17ᵉ clé — se déclarer relu rend *invalide*, pas exempté. Une
  retouche à la main **sera écrasée** : corriger la liste close ou le prompt, ou
  ré-interroger (`enrich --only <id> --force`, qui **repaie**). La reprise vérifie
  `hash_source` et `version_prompt` avant l'appel ; `--force` seul repaie.
- **`data/vues/sorts_enrichis/` est DÉRIVÉ : jamais édité à la main.** Idempotent à
  l'octet. `sans_enrichissement` (non couvert) ≠ `enrichissement_invalide` (couvert,
  réponse rejetée) : deux statuts, jamais confondus.
- **`preuves` = le contrôle anti-confabulation** : sous-chaîne littérale du source,
  vérifiée à l'étage 10. Seul pli toléré : `’` (U+2019) contre `'` — ne pas
  l'élargir pour faire passer un rejet.
- **Seuil sur `notes_ambiguite`, à 50 % depuis le 2026-07-31** : au-delà on élargit
  les listes closes et on coupe une version, **on ne desserre pas le seuil pour
  passer au vert**. Il a été porté de 5 % à 50 % une fois, par arbitrage humain et
  après relecture des 950 notes une à une — pas pour faire taire l'alerte : 891 des
  950 étaient de la glose sur un choix valide (`docs/enrichissement.md` § 4.1). Le
  prix en est écrit dans `SEUIL_AMBIGUITE` : à 50 % la mesure ne détecte plus une
  régression avant que le taux ne double. Un taux de rejet qui ne bouge pas quand on
  durcit l'instruction accuse les listes, pas le prompt.
- Détail : `pf-enrichment-conventions`. Procédures : `docs/enrichissement.md`.

## 11. Interface web — `web/`, un site qui est une fonction du dépôt

Next.js App Router, TypeScript, Tailwind, `output: 'export'` : **aucune base,
aucune route d'API, rien à l'exécution**. Le site est une fonction pure du dépôt,
et `output: 'export'` le rend structurel — une dépendance serveur accidentelle
devient une erreur de build, pas une fonction déployée que personne n'a voulue.
Si le déploiement réclame un secret, c'est le symptôme, pas la configuration.

- **`web/public/data/` est DÉRIVÉ et committé** : `index.json` (2070 sorts,
  82 kB gzip), `alias.json`, `sorts/<slug>.json`. Le déploiement ne dépend donc
  pas de Python. Une retouche à la main **sera écrasée** — corriger `data/`, puis
  réexporter. Le seul fichier de `web/` édité à la main côté données est
  `web/data_sources/alias_manuel.tsv`.
- **Le niveau est relatif à la classe, toujours.** `niv` est une table
  classe→niveau, jamais un scalaire : un sort est de niveau 2 *pour le barde* et 3
  *pour le magicien*, « le » niveau d'un sort n'existe pas. Tout nombre affiché
  porte la classe à laquelle il appartient ; aucun en-tête « Niveau » nu. Le
  niveau **0 est réel** (les oraisons), donc une absence est un tiret cadratin,
  jamais un 0. `check_data_contract.ts` échoue sur un `niv` scalaire.
- **La pile de contextes vit dans `web/components/Fournisseurs.tsx`, et nulle part
  ailleurs.** Un provider oublié ne casse rien : `useSynchro()` retombe sur un
  contexte par défaut inerte, et la synchronisation des favoris a ainsi été livrée
  **sans être montée** — login à 200, zéro requête `/rest/v1/`, bouton mort, 622
  tests verts, parce que chaque test montait le provider lui-même. D'où la règle : la
  composition est un composant testable, et `fournisseurs.test.tsx` assert le critère
  réseau (un `select` **puis** un `upsert` sur `listes`), jamais la fusion — que
  `synchro.test.ts` couvre déjà. Ne pas recomposer les providers dans `layout.tsx`.
  Détail et procédure de vérification : `docs/synchro_favoris_supabase.md`.
- **`signOut` est `scope: 'local'`, jamais le défaut.** Le défaut de Supabase est
  global : il révoque les jetons de tous les appareils, donc se déconnecter du PC
  ferme la session du téléphone, qui n'affiche rien et cesse simplement de
  synchroniser. Se déconnecter est une affirmation sur *cet* appareil.
- **Le slug est l'URL publique.** `/sorts/<slug>/` vient de l'algorithme § 4 : le
  changer casse des liens externes et n'est pas une opération de confort. Les
  favoris tiennent des `id`, pas des slugs, pour cette raison exactement.
- L'état des filtres vit dans l'URL et **nulle part ailleurs** — pas de `useState`
  parallèle qui puisse diverger. Corollaire : toute écriture d'état passe par le
  routeur, donc **toujours `{ scroll: false }`** sur `router.push`/`replace` —
  sinon chaque clic sur une facette remonte en haut du document et poser trois
  filtres devient trois allers-retours. Les tests l'assertent (`SANS_SAUT`). Le lien de retour vers pathfinder-fr.org est un
  engagement, pas une décoration : il est sur chaque fiche et dans le pied de page.

```
npm run data:export     # corpus -> web/public/data/ + contrat  (hors ligne)
npm run data:derive     # échoue si le corpus a changé sans réexport
npm run web:test        # vitest + eslint + tsc dans web/
npm run web:build       # next build -> web/out/ (2070 pages, ~2 min)
npm run web:verifier    # budgets bloquants + axe-core sur 4 routes
npm run verifier:tout   # la chaîne complète, dans l'ordre où la CI la lance
```

**Aucun budget de poids, nulle part — retirés le 2026-08-26 par arbitrage humain.**
Les performances sont explicitement secondaires ici : il n'y a plus de plafond sur
`index.json` (ni dans `export_web.py`, ni dans le contrat), plus de plafond de JS
client par route, et plus d'assertion de durée dans `moteur.test.ts`. Les poids sont
**mesurés et imprimés, jamais opposés à un seuil** — 82 kB gzip pour `index.json`,
170 kB brotli de JS sur la navigation, dont 161 de framework. La dérive que ces
budgets attrapaient n'est donc plus attrapée, **délibérément** ; ne pas les
réintroduire au motif qu'un chiffre a monté. Ce qui reste bloquant ne concerne pas
le poids mais la complétude : pages générées == `|index.sorts|`, `alias.json`
présent, `/data/index.json` publié et identique à sa source. Le moteur de recherche
reste chargé à la demande parce que c'est gratuit, non parce qu'on le mesure.
`web/out/` n'est pas committé. Déploiement Vercel : racine `web/`, `web/vercel.json`,
`immutable` sur `/_next/static/` et `/fonts/` mais **pas** sur `/data/*.json`, dont
l'URL est stable d'un export au suivant.

## 13. Le corpus des dons — `src/pf_dons/`, `data/dons/`, `data/classes/`, `data/conditions/`

Deuxième corpus fusionné dans ce dépôt à l'étape 17 : les dons (feats)
Pathfinder 1e, importés du dépôt autonome `Dons` (`pf1_dons` → `pf_dons`).
Pipeline : **CSV → conditions analysées → évaluation → résultats groupés.**
`data/dons/Dons.csv` (1417 dons) est analysé par `src/pf_dons/parser.py` en
`ParsedConditions` structurées, puis `src/pf_dons/engine.py` les évalue contre
un `Character` donné. **`src/pf_dons/paths.py` est le seul endroit où
l'emplacement d'un fichier de données des dons est écrit** — tout module,
scraper ou test y importe ses chemins plutôt que de coder une chaîne relative.

### Pourquoi Python analyse et TypeScript évalue

Ce corpus est le seul du dépôt où l'évaluation elle-même s'exécute côté
`web/` en TypeScript (`web/lib/dons/moteur.ts`), et non côté Python. Ce n'est
pas une préférence de langage : **44 520 combinaisons classe × niveau × race**
rendaient un précalcul intégral de tous les verdicts indisponible (~35 h de
calcul, ~33 Go de sortie) — le web statique (§11) ne peut pas se permettre de
committer ça, ni d'attendre 35 h à chaque export. `src/pf_dons/parser.py` ne
voit donc jamais le personnage (il n'analyse que le texte `Conditions` du CSV,
une fois, hors ligne) ; `src/pf_dons/engine.py` — qui, lui, voit le
personnage — tient en 621 lignes pour **une seule** regex, l'essentiel du
gating étant des tables de données curées à la main plutôt que du texte
libre à ré-analyser à l'exécution. Le moteur TypeScript (`web/lib/dons/moteur.ts`)
est un port fidèle de `engine.py`, gardé fidèle par le garde de parité (§15),
et c'est lui qui tourne réellement dans le navigateur.

### Le tri-état, jamais binaire

Chaque exigence s'évalue en tri-état : `true` (satisfaite), `false` (non
satisfaite), ou **`null` — « indéterminable », jamais « faux »**. Traiter `null`
comme `false` produit une **régression** au sens du garde de parité (§15) :
c'est exactement le bug injecté puis réparé pour prouver que ce garde
fonctionne. Un don `manual_check` (au moins une exigence `null`, aucune
`false`) reste **toujours visible** au joueur — le filtrer par défaut serait
supprimer un don potentiellement accessible, contraire à la maxime ci-dessous.

### Les cinq couches de gating curées à la main, plus un signal non retenu

Les couches suivantes existent parce que le texte libre `Conditions` du CSV ne
suffit pas à trancher automatiquement une classe de prérequis — chacune est
une table de données relue et curée à la main, jamais dérivée par heuristique
seule :

1. **`data/classes/class_ability_map.json`** — quels mots-clés de capacité de
   classe impliquent quelle(s) classe(s) (`implied_classes`), pour refuser
   plutôt que laisser en `manual_check` un don d'une autre classe.
2. **`data/conditions/prereq_gating.json`** — la nature de chaque prérequis
   non attribuable à une seule classe : **9 genres bloquants**
   (`racial_trait`, `creature_type`, `anatomy`, `spellcasting`, `deity`,
   `alignment`, `mythic`, `class_ability`, `no_class_levels`) et **6 genres non
   bloquants** (`class_ability_unmapped`, `proficiency`, `feat`, `background`,
   `fragment`, `generic`) qui retombent en `manual_check`.
3. **`data/classes/class_caster_info.json`** — quelles classes ont accès à la
   magie (43 classes, hybrides/occultes incluses), pour refuser un don
   magique de confiance haute à une classe non lanceuse et non couverte par un
   trait racial.
4. **`data/dons/feat_class_restriction.json`** — restriction de classe visible
   uniquement dans le texte d'*avantage* d'un don, jamais dans ses
   *Conditions* (cas d'école : « Ombre druidique »). Signal **très peu
   spécifique** (1 vrai positif pour 49 candidats) : jamais appliqué
   automatiquement, table entièrement curée à la main.
5. **`data/classes/class_proficiencies.json`** — les 31 entrées `proficiency`
   de la couche 2 (« maniement de X ») se répartissent en **18 bloquantes**
   (arme ou bouclier nommé — « maniement du cimeterre ») et **13 non
   bloquantes** (dépendent d'un choix du joueur que `Character` ne trace pas —
   « l'arme choisie », « l'arme du dieu » — limite **assumée**, pas lacune).

Deux tables de `class_proficiencies.json` sont recopiées des traits « Armes
familières » déjà scrapés dans `data/races/races.json` :
`RACE_WEAPON_PROFICIENCY` (l'elfe a l'arc long, le nain le marteau de guerre,
indépendamment de la classe) et **`RACE_WEAPON_RECLASSIFICATION`** — le nain
traite toute arme « naine » (ex. la dorn-dergar naine) comme une arme de
guerre au lieu d'exotique, à condition que la classe ait les armes martiales ;
sans ce mécanisme un Guerrier nain aurait été refusé à tort sur « Frappe de la
vipère jaillissante ». Dans le même esprit de précision délibérée,
`_ANATOMY_SYNONYMS` (couche 2, genre `anatomy`) n'utilise que des phrases
**longues et non ambiguës** (« attaque de morsure ») plutôt que des synonymes
courts (« langue » aurait faussement matché le trait universel « Langues »).

**`chasseur de vampire` est absente de `class_proficiencies.json` : aucune
classe officielle Pathfinder 1e de ce nom n'existe.** Le moteur la traite donc
comme une classe **inconnue** (`manual_check`), jamais comme « aucune
maîtrise » (`ineligible`) — une classe inconnue n'est pas une preuve d'absence.

### `repair_benefits` — le CSV réparé avant filtrage

127 des 1417 lignes du CSV portaient `#ERROR!` dans `Avantages` (jamais lu par
le moteur) alors que leurs `Conditions` étaient intactes. Les filtrer aurait
amputé 10 % du catalogue et troué le graphe de prérequis à ses nœuds les plus
structurels. `repair_benefits` les répare depuis `data/dons/feat_details.json`
avant tout filtrage : catalogue à **1417 dons, zéro prérequis de don
pendant**, chaînes de profondeur 2 passées de 123 à **177**, de profondeur 3
de 25 à **48**.

### La maxime de sûreté

> **Une sous-attribution est bien plus grave qu'une sur-attribution.**
> Sur-attribuer ne coûte qu'un `manual_check` ; sous-attribuer produit un
> `ineligible` faux, qui cache le don au joueur sans recours.

Chaque couche de gating ci-dessus est gouvernée par cette maxime : en cas de
doute entre bloquer et laisser en `manual_check`, on laisse en `manual_check`.

### Limites connues, assumées et non des lacunes

- **`Character.skill_rank` est optimiste** : sans rangs explicites il renvoie
  le niveau du personnage, donc tous les prérequis de rangs de compétence
  passent simultanément. Défendable pour un dépistage « ce personnage
  *pourrait*-il qualifier ? » (PF1 n'a pas de malus hors-classe), mais cela
  gonfle la liste des dons universels.
- **6 entrées `class_ability_unmapped`** dans `prereq_gating.json` : capacité
  de classe dont la curation n'a pas pu déterminer la classe.
- **`polyvalence` vaut `conditionnel` pour 61 % des dons** (étiquetage
  sémantique LLM) — une facette faible, à ne pas présenter comme discriminante.

### Le double appel à `construireGraphe` — le correctif du bug d'origine

L'explorateur de dons calcule ses trois grandeurs dérivées (`levier`, `voie`,
`debloque`) **deux fois** : une fois sur le catalogue entier, une fois sur le
sous-graphe atteignable affiché. Avant ce correctif, les trois étaient
calculées sur le catalogue puis affichées à côté d'un graphe plus petit : tout
ce que l'une comptait et que l'autre ne montrait pas devenait un mensonge à
l'écran — **94 nœuds à levier surévalué, 13 nœuds sans arête affichée, 2 voies
nommées d'après un don non retenu**. Le double appel les a ramenés à **0 / 0 /
0** ; l'écart entre `levier` et `levier_catalogue` n'est plus caché mais
affiché comme information. Raisonnement complet :
`build/dons/OUTPUT_defauts_du_graphe.md`.

Pour le raisonnement détaillé, couche par couche, avec les cas concrets
corrigés (dont l'audit multi-classes qui a révélé le scalde marqué non-lanceur
à tort, cf. §14) : `build/dons/OUTPUT_guerrier_audit_rules.md`,
`build/dons/OUTPUT_multiclasse_niveau6.md`, `build/dons/OUTPUT_class_proficiencies_ground_truth.md`,
`build/dons/OUTPUT_class_caster_ground_truth.md`, `build/dons/OUTPUT_taxonomie_semantique.md`,
et `build/dons/OUTPUT_prerequis_de_la_page.md`. `build/dons/CLAUDE_dons_origine.md`
est le `CLAUDE.md` du dépôt d'origine, conservé pour référence historique — ce
§13 en est l'absorption dans l'architecture actuelle, pas une simple copie.

## 14. Les deux corpus et leur clé de jointure

Le corpus des sorts (§1-§11) a **19 classes** (`data/classes.json`, §1) comme
ensemble canonique interne. Le corpus des dons distingue des classes plus
nombreuses et plus fines (hybrides, occultes, variantes de source…).
**`data/conventions/classes_unifiees.json` est le registre unifié des 42
classes** qui sert de clé de jointure entre les deux corpus, lu par
`src/pf_dons/classes_unifiees.py` (lecture seule — la seule façon légitime de
l'écrire est l'outil de curation dédié, jamais une édition à la main ni une
dérivation automatique dans `engine.py`).

Chaque entrée porte, **indépendamment l'une de l'autre** : `lanceur` (bool,
accès à la magie) et `liste_sorts` (le slug de la liste de sorts du corpus
sorts, ou `null`). **Le scalde en est la preuve vivante** :
`lanceur: true`, `liste_sorts: null` — il a accès à la magie (« tours de
magie » dès le niveau 1, révélé par l'audit multi-classes du corpus des dons,
qui avait initialement marqué le scalde à tort comme non-lanceur) sans pour
autant posséder de liste de sorts dédiée dans le corpus des sorts. Ne jamais
dériver l'un de l'autre : un module qui déduirait `lanceur` de la présence
d'une `liste_sorts` (ou l'inverse) réintroduirait précisément le bug que le
scalde a servi à détecter.

**`clerc` est explicitement laissée `a_curer: true`, non tranchée.** Le
corpus des dons contient à la fois `clerc`, `pretre` et `pretre combattant`
alors qu'en Pathfinder 1e francophone le clerc est usuellement le prêtre ;
aucune classe officielle « clerc » distincte du prêtre n'est confirmée. Plutôt
que de deviner un mappage, l'entrée reste marquée à curer à la main
(`raison_curation` porte l'explication) — conforme à la maxime de sûreté du
§13 : deviner ici risquerait une sous-attribution silencieuse.

## 15. Le garde de parité Python/TypeScript — `npm run dons:parite`

Le corpus des dons est le seul du dépôt où la même logique existe
**délibérément deux fois** : `src/pf_dons/engine.py` (référence) et
`web/lib/dons/moteur.ts` (ce qui tourne réellement, §13). Le garde de parité
les compare pour empêcher toute divergence silencieuse.

`npm run dons:parite` (`scripts/dons_parite.ts`) vide les verdicts Python
(`tools/dons/vider_verdicts.py`) et TypeScript (`scripts/vider_verdicts_ts.ts`)
sur la même matrice de personnages, produit deux journaux **`verdicts.jsonl`**
(un par moteur), puis les compare (`scripts/comparer_verdicts.ts`) selon une
règle **asymétrique**, reflet direct de la maxime de sûreté du §13 :

- **RÉGRESSION** (`eligible`/`manual_check` → `ineligible`) : échec dur,
  **seuil zéro**.
- **RELÂCHEMENT** (`ineligible` → `eligible`/`manual_check`) : échec, **seuil
  zéro**.
- **BRUIT** (seuls les motifs cités diffèrent, même statut final) :
  avertissement, sortie 0 — jamais lissé pour faire passer le garde.

Deux profils : `rapide` par défaut en local (42 personnages × 1417 dons,
59 514 cellules), `complet` posé par la CI (`PROFIL=complet`, 1260 × 1417,
1 785 420 cellules). Les deux tournent actuellement à 0 régression, 0
relâchement. Détail, cause de divergence trouvée et corrigée (une conversion
de clé de caractéristique dans le producteur Python, jamais dans
`engine.py`/`parser.py`), et preuves d'échec/de couverture du garde :
`build/dons/OUTPUT_parite_python_ts.md`.

## 16. Interdictions de style

- **Ne jamais peupler un `__init__.py`** ni ajouter d'`__all__`, où que ce soit.
- Pas de compatibilité ascendante à maintenir.
- Python 3.11, `from __future__ import annotations`, types annotés partout ;
  identifiants français pour le domaine, docstrings et commentaires en anglais
  expliquant **pourquoi**, pas quoi.
- Côté `web/` : TypeScript strict, aucun `any`, aucune couleur en dur hors
  `lib/design/tokens.ts`, vocabulaire d'interface figé dans `MOTS` — un seul verbe
  d'un bout à l'autre.
