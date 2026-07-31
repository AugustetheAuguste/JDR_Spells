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
| `cache/html/<sha1>.html`, `cache/index.jsonl` | 03, 06 | les octets source bruts + le journal de récupération |
| `schemas/*.json` | 02 | les contrats de sortie (+ `enrichissement.schema.json` § 10, `web_index.schema.json`, l'export web) |
| `conventions/vocabulaires/*.json` | 04 | les six listes **closes** de l'enrichissement |
| `data/enrichissements/<id>.json` | étage 09 | la couche LLM d'un sort (2048 fichiers, 16 clés) |
| `data/vues/sorts_enrichis/<id>.json` | — | **rien** : vue dérivée du join sur `id` (§ 10) |
| `reports/*.md` | 03–09 | le résultat et les anomalies de chaque étape (dont `09_validation.md`) |
| `build_artifacts/rapports/`, `.../quarantaine/` | 09, 10 | la trace des appels **payants** et les réponses refusées |

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
`data/enrichissements/`, `data/vues/` ou `conventions/vocabulaires/`** — et
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

`cache/html/` est **committé** : relancées, 03 et 06 lisent le cache et ne refont
aucune requête — d'où la correction d'un parseur sans retoucher au wiki. Tests :
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
| Libellés multi-classes (`Arcaniste/Ensorceleur/Magicien`, `Prêtre/Prêtre combattant/Oracle`) | une page, un libellé combiné — **jamais scindés** |
| Abréviations hors des 19 classes (`Réd`, …) | normales dans `niveaux`, listées dans `reports/08_enrich.md` |
| Concordance liste ↔ page | 100 % des paires comparables ; divergences **constatées, jamais corrigées** |

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

## 11. Interdictions de style

- **Ne jamais peupler un `__init__.py`** ni ajouter d'`__all__`, où que ce soit.
- Pas de compatibilité ascendante à maintenir.
- Python 3.11, `from __future__ import annotations`, types annotés partout ;
  identifiants français pour le domaine, docstrings et commentaires en anglais
  expliquant **pourquoi**, pas quoi.
