# 11 — UI DONS SHEET : la fiche d'un don, `/dons/<slug>`

**Vague 3.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/11-ui-dons-sheet`.

## Objectives

Créer la route `web/app/dons/[slug]/page.tsx` : la page d'un don, sur le modèle
exact de `web/app/sorts/[slug]/page.tsx`, exportée statiquement.

Sa contrainte propre, et la raison pour laquelle elle est une étape à part :
**afficher `raw_conditions` et `conditions_ajoutees` séparément**, jamais fondus.
Le premier est ce que dit la source ; le second ce que le moteur a réellement
évalué. Les confondre rend intraçable la couche `feat_prereq_supplements`.

## Dependencies & Parallelization

- **Vague 3.** Dépend de :
  - **05_WEB_INDEX_CONTRACT** — la forme de `index.json` et des props par don.
  - **01_SKILLS** — `pf-dons-taxonomie` (libellés) et `pf-web-design-system`.
- Parallèle à **08**, **09**, **10**, **12** : n'écrit que sous `web/app/dons/[slug]/`
  et, si besoin, une primitive nouvelle sous `web/components/primitives/`.
- **Ne dépend pas de 09** : la fiche n'évalue rien. Elle décrit un don, pas
  l'éligibilité d'un personnage. Le statut arrive en étape 16.
- **Ne dépend pas de 10** : elle ne lit pas l'état d'URL. Si un lien vers une liste
  filtrée est souhaité, il est ajouté après fusion de la vague.
- **Ne dépend pas de 08** : elle est développée contre la fixture de 05.

## Inherited Context from Dependencies

### Le patron à suivre, à lire avant toute chose

`web/app/sorts/[slug]/page.tsx`. En reproduire : `generateStaticParams`,
`generateMetadata`, la lecture des props par entité côté build, le composant
serveur sans état. `web/components/fiche/` contient les blocs de la fiche de sort —
**réutiliser ce qui se réutilise**, extraire vers `primitives/` seulement si le
besoin est réellement commun aux deux corpus.

### Les contraintes de plateforme, non négociables

`next.config.ts` porte `output: 'export'`, `typedRoutes`, `trailingSlash: true`
(`CLAUDE.md` §11) : **aucune base, aucune route d'API, rien à l'exécution.** Donc
`generateStaticParams` doit énumérer les **1 417** slugs au build. Pas de
`dynamicParams`, pas de `revalidate`, pas de `fetch` serveur.

`typedRoutes` fait échouer le build sur un `href` qui ne correspond à aucune route
— c'est une garantie, pas une gêne.

**Le slug EST l'URL publique.** L'algorithme est celui du §4 de `CLAUDE.md`, détenu
par `pf-corpus-conventions` : pré-mapper `œ`/`æ` **avant** NFKD, retirer les
combinants, minuscules, tout hors `[a-z0-9]` → un seul `-`, élaguer ; collision →
suffixe `-2`. **Réutiliser le code existant** (`pf_spells/slugs.py` côté Python,
son équivalent côté web) ; deux variantes divergentes produisent des liens morts.

### Les données de la fiche (props par don, contrat 05)

`web/public/data/dons/<slug>.json` porte les libellés **verbatim et non
normalisés** : nom accentué (astérisque des répétables comprise), source `Src`,
`raw_conditions`, `conditions_ajoutees`, `avantages`, description complète et
rubriques **Spécial** / **Normal** de `feat_details.json`, plus les champs
sémantiques déjà lisibles dans l'index.

Fixture de développement : `web/fixtures/index_dons.json` (24 dons, dont un
entièrement non étiqueté par la couche LLM, tous champs sémantiques à `null`/`[]`).

### Les deux faits de domaine à rendre visibles

**1. Les dons répétables.** Le nom porte un `*` dans `Dons.csv` ; le champ `r` le
dit. Le `*` fait partie du nom d'affichage, **pas du slug**. La fiche doit dire en
français que le don peut être pris plusieurs fois — un astérisque nu n'explique
rien à un lecteur.

**2. `raw_conditions` vs `conditions_ajoutees`.** 47 dons sont augmentés par
`data/dons/feat_prereq_supplements.json` (68 fragments), relecture curée à la main
de 86 dons dont la page mentionne un prérequis absent du CSV — par exemple
« Attaque au galop » exige 1 rang en Équitation. 39 autres ont été **entièrement
écartés**, avec un genre disant pourquoi (`self_reference`, `proficiency`,
`prose_permissive`, `variante_de_source`…). Le genre le plus instructif est
`variante_de_source` : la page **contredit** le CSV (« homme-lézard » contre
« homme-serpent »), et additionner les deux fabriquerait une condition impossible,
donc un `ineligible` universel.

La fiche affiche donc **deux blocs distincts et étiquetés** : « Conditions
(source) » et « Prérequis relevés sur la page ». Un lecteur doit pouvoir citer la
source sans citer notre curation.

### Le design system

`web/lib/design/tokens.ts` (281 lignes) : `COULEURS` (thème Grimoire, parchemin
`#F1E7D2`, luminance 0,805), `MOUVEMENT` (120 ms ease-out), `MOTS`. Tailwind 4
CSS-first `@theme`. **Toute couleur vient des tokens**, jamais une valeur littérale
dans un composant. Le thème sombre est un mode à part entière, pas un
après-coup — vérifier les deux.

## Pseudo-code

```
# web/app/dons/[slug]/page.tsx   (composant serveur, aucun état)
generateStaticParams() -> les 1417 slugs lus depuis index.json
generateMetadata({params}) -> titre = nom du don, description = resume_court

page({params}):
    don = lireProps(params.slug)      # <slug>.json ; introuvable -> notFound()
    rendre:
        en-tête   : nom verbatim, source, badge « répétable » si r
        bloc      : « Conditions (source) »            <- raw_conditions
        bloc      : « Prérequis relevés sur la page »  <- conditions_ajoutees
                    (absent si vide, jamais un bloc vide)
        bloc      : « Avantage »                       <- avantages
        blocs     : Spécial / Normal si présents
        facettes  : effet principal, cible, contexte, activation, coût, catégorie
                    (masqués individuellement si null)
        lien      : retour vers /dons/ (route de l'étape 13, si fusionnée)

# web/components/fiche/BlocConditions.tsx
props: { titre, texte, ton: 'source' | 'curation' }
# le ton distingue visuellement sans jamais reposer sur la seule teinte
```

## Logic Flow

1. Lire `app/sorts/[slug]/page.tsx`, `components/fiche/`, `tokens.ts`.
2. Écrire la route contre la **fixture** de 05, pas contre l'export réel.
3. Écrire `BlocConditions` avec ses deux tons.
4. Tester : rendu, absence de bloc vide, dégradation du don non étiqueté, a11y.
5. Vérifier le build statique (`npm run web:build`).

## Implementation Notes

- **Aucun bloc vide.** Un don sans `conditions_ajoutees` n'affiche pas un
  intertitre orphelin. Le don « Endurance » n'a aucune condition : la fiche doit
  dire « Aucune condition », pas laisser un trou.
- **La distinction source/curation ne passe pas par la seule teinte.** Précédent du
  dépôt : le statut `manual_check` passe par la **bordure en tirets plus un « ! »
  textuel**, jamais par la couleur seule. Reprendre ce principe (étiquette
  textuelle explicite), pour le daltonisme et pour l'impression.
- **Ne pas normaliser le nom affiché.** Accents et astérisque verbatim.
- **Le lien de retour vers `/dons/`** : si l'étape 13 n'est pas encore fusionnée,
  `typedRoutes` fera échouer le build. Dans ce cas, ne pas mettre le lien et le
  noter dans le commit — jamais désactiver `typedRoutes` pour contourner.
- Ne pas afficher `polyvalence` en évidence : elle vaut `conditionnel` pour **61 %**
  des dons, c'est une facette faible, mesurée comme telle.
- Ne pas afficher de statut d'éligibilité : cette page ne connaît pas de
  personnage. C'est l'étape 16.
- TypeScript strict, **aucun `any`**. Ne créer **aucun** fichier `__init__` et
  n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `npm run web:build` réussit et produit **1 417** pages sous `out/dons/`, chacune
   avec un `trailingSlash`. Le compte est vérifié, pas seulement le succès.
2. Un test de rendu par cas de la grille de la fixture : don sans condition ·
   don répétable · don augmenté par les suppléments · don **entièrement non
   étiqueté** (aucune facette affichée, aucun plantage) · don à catégorie multiple.
3. `raw_conditions` et `conditions_ajoutees` apparaissent dans **deux** blocs
   distincts, avec deux intertitres différents. Un test assert que le texte des
   suppléments **n'apparaît pas** dans le bloc source — la confusion que l'étape
   prévient.
4. Aucun intertitre n'est rendu au-dessus d'un contenu vide : un test le vérifie
   pour les cinq blocs optionnels.
5. La distinction source/curation est perceptible **sans couleur** : un test assert
   la présence d'un libellé textuel dans chaque bloc.
6. Un slug inconnu rend `notFound()`, pas une exception.
7. Aucune couleur littérale : `grep -n "#[0-9a-fA-F]\{3,6\}"` sur les nouveaux
   fichiers → **zéro**. Tout vient de `tokens.ts`.
8. `verifier_a11y.ts` (axe-core) passe sur la fiche, **en mode clair et en mode
   sombre**, zéro violation.
9. `npm --prefix web run typecheck` et `lint` verts ; `npm run web:test` vert, les
   **662** tests existants toujours passants.

## Git Handling

Branche `fusion/11-ui-dons-sheet` depuis `feat/fusion-dons`. Trois commits :

```
feat(web): route statique /dons/<slug>, sur le patron des fiches de sorts
feat(web): bloc de conditions distinguant la source de notre curation
test(web): rendu des cinq cas limites de la fiche, a11y dans les deux thèmes
```

Le corps du deuxième commit doit dire pourquoi les deux blocs ne sont jamais
fondus : 47 dons sont augmentés à la main, 39 délibérément écartés, et le genre
`variante_de_source` est un cas où la page **contredit** le CSV.

## Expected Outcome

Chaque don a une page statique, citable, où l'on distingue ce que dit la source de
ce que le dépôt en a fait — la traçabilité que les cinq couches de gating ont
maintenue côté données, désormais visible côté lecteur.
