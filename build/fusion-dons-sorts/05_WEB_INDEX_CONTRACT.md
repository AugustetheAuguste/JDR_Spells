# 05 — WEB INDEX CONTRACT : figer l'index des dons et sa fixture

**Vague 2.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/05-web-index-contract`.

## Objectives

Figer le contrat de `web/public/data/dons/index.json` — les champs **indépendants
du personnage** (identité, facettes sémantiques, catégorie) — **et livrer une
fixture écrite à la main**.

C'est, avec l'étape 06, le **déverrouillage du parallélisme du plan** : dès que le
contrat et la fixture existent, le producteur (08) et les consommateurs (10, 11,
13) travaillent simultanément sans attendre l'export réel.

Aucun code de production n'est écrit ici : un schéma, une fixture, un vérificateur.

## Dependencies & Parallelization

- **Vague 2.** Dépend de :
  - **03_CLASS_REGISTRY** — pour le vocabulaire de classes référencé par l'index.
  - **04_MERGE_REPO** — pour lire `data/dons/feat_semantics.json` et
    `Dons.csv` afin de connaître les valeurs réelles des vocabulaires.
- Peut tourner en parallèle de **06** (contrat du moteur) et **07** (intégration
  du registre) : les trois écrivent des fichiers disjoints. 05 écrit
  `web_index_dons.schema.json` + `web/fixtures/index_dons.json` ; 06 écrit
  `moteur_dons.schema.json` + ses fixtures ; 07 écrit dans `src/pf_dons/`.
- Aucune dépendance sur 01 ni 02.

## Inherited Context from Dependencies

### Depuis 03 — le registre de classes

`data/conventions/classes_unifiees.json` : `{version, classes: [{slug, nom,
liste_sorts, lanceur, a_curer, raison_curation}]}`, **42 entrées**, `slug` étant
la clé primaire. Les slugs contiennent parfois une espace (`pretre combattant`).

### Depuis 04 — emplacement des données

`data/dons/Dons.csv` (1 417 dons, colonnes `Dons`, `Src`, `Conditions`,
`Avantages`), `data/dons/feat_semantics.json` (couche LLM, 12 champs),
`data/dons/feat_categories.json`, `data/dons/feat_details.json`.

### Le patron à suivre : `data/schemas/web_index.schema.json`

Le contrat des sorts. **Le lire d'abord.** Ses décisions à reproduire :

- **Tout est codé en entiers** via des tables de tête. C'est ce qui empêche
  1 417 copies de la chaîne « bonus_chiffre ». Ne pas « simplifier » en
  réinsérant les libellés dans chaque entrée.
- Champs à une ou deux lettres, **chacun documenté** dans le schéma pour que
  personne n'ait à devenir.
- `additionalProperties: false` — un champ ajouté est un changement de contrat
  délibéré, avec `version` incrémentée, pas une dérive.
- **Aucune clé omise** : scalaire absent → `null`, liste absente → `[]`.
- Les libellés verbatim et non normalisés vivent dans les props par entité
  (`web/public/data/dons/<slug>.json`), chargées à l'ouverture d'une fiche.

### Depuis `pf-dons-taxonomie` (Skill de l'étape 01, à charger si fusionnée)

Vocabulaires clos à coder : `effet_principal` (18 valeurs), `effets_secondaires`,
`cible_du_bonus`, `contexte`, `activation`, `polyvalence`,
`categorie_officielle`. Plus `valeur_bonus` (chaîne libre, ex. `"+2"`),
`resume_court`, `mots_cles`.

**Règle de séparation des espaces de noms** : ces vocabulaires sont disjoints des
35 tags de sorts, **sauf `bonus_chiffre`**, présent dans les deux. Les deux index
sont deux fichiers séparés, donc la collision est inoffensive **ici** ; elle
devient dangereuse à l'étape 10 (clés d'URL). Le noter dans le schéma.

## Pseudo-code

```
# data/schemas/web_index_dons.schema.json
{
  version, genere_le,                       # comme l'index des sorts
  effets_principaux: [string],              # tables de tête, 18 entrées
  cibles_bonus: [string],
  contextes: [string],
  activations: [string],
  polyvalences: [string],
  categories: [string],
  sources: [string],                        # colonne Src du CSV, très répétitive
  dons: [ {
      i:  int,      # index dense 0..n-1, identifiant court des vues
      id: string,   # identifiant stable
      s:  string,   # le slug, qui EST l'URL publique
      n:  string,   # nom d'affichage, accentué verbatim, astérisque comprise
      nf: string,   # nom plié = clé de recherche ; doit égaler plier(n)
      r:  bool,     # répétable (le nom du CSV finit par '*')
      ep: int|null, # code effet_principal
      es: [int],    # codes effets_secondaires
      cb: [int],    # codes cible_du_bonus
      cx: [int],    # codes contexte
      ac: int|null, # code activation
      pv: int|null, # code polyvalence
      cat:[int],    # codes categorie_officielle
      src:int|null, # code source
      vb: string|null,  # valeur_bonus, chaîne libre
      rc: string|null,  # resume_court
      mc: [string]      # mots_cles, non codés (queue longue, peu répétitive)
  } ]
}
# PAS dans ce contrat : statut, vague, cout, levier, voie, prerequis.
# Tous dépendent du personnage ou du graphe -> étape 06.

# web/fixtures/index_dons.json  — 24 dons choisis à la main
choisir en couvrant:  un don sans prérequis (Endurance)
                      un don à chaîne profonde (>= 3 niveaux)
                      un don répétable (nom finissant par '*')
                      un don à OrGroup dans ses Conditions
                      un don magique de confiance haute
                      un don à gating racial / anatomie / divinité / alignement
                      un don non étiqueté par la couche LLM (tous champs sém. nuls)
                      un don à catégorie officielle multiple
                      un don dont la source est rare

# scripts/check_data_contract_dons.ts
valider contre le schéma via ajv 2020
puis les contrôles qu'un schéma n'exprime pas:
    slugs uniques           (le slug EST l'URL : un doublon = deux dons pour une page)
    i dense sans trou       (les vues indexent des tableaux avec)
    tout code < len(table)  (un code hors table rend une puce vide, invisible)
    nf == plier(n)          (sinon la recherche rate silencieusement l'entrée)
    imprimer le poids gzip  (MESURÉ, jamais opposé à un seuil)
```

## Logic Flow

1. Lire `web_index.schema.json` et `check_data_contract.ts` en entier.
2. Extraire de `feat_semantics.json` les valeurs **réellement présentes** de
   chaque vocabulaire clos ; ne pas recopier une liste théorique.
3. Écrire le schéma, chaque champ documenté par sa `description`.
4. Choisir les 24 dons de la fixture dans le vrai catalogue, à la main, selon la
   grille ci-dessus. Les renseigner à la main, cohérents avec le schéma.
5. Écrire le vérificateur, le lancer sur la fixture : il doit passer.
6. **Le lancer sur des fixtures cassées** (voir critères) : il doit échouer.

## Implementation Notes

- **Le slug est l'URL publique.** L'algorithme est celui du §4 de
  `JDR_Spells/CLAUDE.md`, détenu par `pf-corpus-conventions` : pré-mapper `œ`/`æ`
  **avant** NFKD, retirer les combinants, minuscules, tout hors `[a-z0-9]` → un
  seul `-`, élaguer. Collision → suffixe `-2`. **Réutiliser le code existant de
  `pf_spells/slugs.py`, ne pas en réécrire une variante** : deux algorithmes de
  slug qui divergent produisent des liens morts.
- **Les dons répétables portent un `*` dans `Dons.csv`.** Le `*` fait partie du
  nom (`n`), pas du slug. Le champ `r` le rend lisible sans faire analyser une
  chaîne au client. `character_profile.assign_feat` s'appuie déjà sur ce marqueur.
- **Aucun budget de poids.** Le dépôt les a retirés le 2026-08-26 par arbitrage
  humain : le poids est **mesuré et imprimé, jamais opposé à un seuil**. Ne pas
  en réintroduire un au motif que l'index des dons est plus gros que celui des
  sorts. Charge attendue : ~90 kB gz pour les facettes.
- Ne pas coder `mots_cles` en entiers : c'est une queue longue peu répétitive,
  et une table de tête y coûterait plus qu'elle ne rend.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `npx tsx scripts/check_data_contract_dons.ts web/fixtures/index_dons.json`
   → sortie **0**, poids gzip imprimé.
2. Le schéma porte `additionalProperties: false` **à tous les niveaux d'objet**,
   et chaque propriété a une `description` non vide.
3. **Le vérificateur échoue** sur cinq fixtures volontairement cassées (dérivées
   de la bonne, dans `web/fixtures/dons_casses/`) : slug dupliqué · `i` troué ·
   code `ep` hors table · `nf` ≠ `plier(n)` · champ inconnu ajouté. Un test
   vitest assert le code de sortie **1** pour les cinq. Un vérificateur qu'on n'a
   pas vu échouer ne vérifie rien.
4. La fixture contient **24** dons, et couvre les 9 cas de la grille — un test
   l'assert cas par cas (au moins un don sans prérequis, au moins un répétable,
   au moins un entièrement non étiqueté…).
5. Le don non étiqueté a **tous** ses champs sémantiques à `null`/`[]`, jamais
   absents : c'est le cas qui prouve que l'UI peut masquer les facettes
   sémantiques sans planter.
6. Aucun champ dépendant du personnage (`statut`, `vague`, `cout`, `levier`,
   `voie`) n'apparaît dans le schéma — un `grep` de ces cinq mots dans le schéma
   renvoie zéro. Ils appartiennent à l'étape 06.
7. `npm --prefix web run typecheck` et `lint` verts ; `npm run web:test` vert.

## Git Handling

Branche `fusion/05-web-index-contract` depuis `feat/fusion-dons`. Trois commits :

```
feat(dons): contrat de l'index web des dons, codé en entiers
test(dons): fixture de 24 dons couvrant les neuf cas limites du catalogue
test(dons): cinq fixtures cassées — un vérificateur jamais vu échouer ne vérifie rien
```

## Expected Outcome

Le contrat de l'index est figé et prouvé, et une fixture réaliste existe. Les
étapes 10, 11 et 13 peuvent écrire de l'interface **avant** que l'exporteur (08)
ait produit une seule ligne, et 08 sait exactement ce qu'il doit produire.
