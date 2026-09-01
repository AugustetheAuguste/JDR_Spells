# 13 — UI DONS LIST : la liste à facettes, `/dons`

**Vague 4.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/13-ui-dons-list`.

## Objectives

Créer `web/app/dons/page.tsx` et ses composants : la **navigation à facettes** des
1 417 dons, en réutilisant les primitives existantes du dépôt plutôt qu'en portant
les 1 040 lignes de `explorateur_dons.js`.

Cette vue passe **devant** le graphe, et c'est un choix mesuré : un joueur demande
d'abord « quels dons me donnent un bonus aux dégâts pour deux emplacements » ; le
graphe ne répond qu'à « d'où vient ce don ».

## Dependencies & Parallelization

- **Vague 4.** Dépend de :
  - **10_LIB_FACETS_URL** — `EtatUrl` étendu, `FiltresDons`, `filtrerDons`,
    `compterOptions`. Toute la logique de filtrage est là ; cette étape ne fait que
    rendre.
  - **05_WEB_INDEX_CONTRACT** — la forme de `index.json` et la fixture de 24 dons.
  - **01_SKILLS** — `pf-dons-taxonomie` (libellés) et `pf-web-design-system`.
- Parallèle à **14** (harnais différentiel) : disjoint, 14 ne touche pas `web/app/`.
- **Ne dépend pas de 08** : développée contre la fixture. Ni de 09 : le statut
  d'éligibilité n'apparaît qu'avec un personnage, étape 16 — mais **la primitive de
  statut est écrite ici**, avec ses trois états, pour que 16 n'ait qu'à la brancher.

## Inherited Context from Dependencies

### Depuis 10 — l'API à consommer

```
lireEtatDons(searchParams) -> EtatUrlDons
ecrireEtatDons(etat) -> URLSearchParams
filtrerDons(entrees, filtres) -> entrees retenues
compterOptions(entrees, filtres, saufFacette) -> Map<option, nombre>
FILTRES_DONS_VIDES ; MULTIVALUEES
```

Clés d'URL, toutes préfixées : `dons_effet`, `dons_effet2`, `dons_cible`,
`dons_contexte`, `dons_activation`, `dons_polyvalence`, `dons_categorie`,
`dons_cout`, `dons_statut`, `dons_q`.

Cycle à trois états : `nom` = OU, `-nom` = NON, `!nom` = ET (**`!` et non `+`**,
qui décoderait en espace).

**L'état vit dans l'URL et nulle part ailleurs**, écrit avec `{scroll: false}`.
**Aucun `useState` miroir.**

### Les primitives à réutiliser — ne rien réécrire

| Composant existant | Usage ici |
|---|---|
| `primitives/TableDense.tsx` (185) | le tableau des dons |
| `primitives/ChampRecherche.tsx` (107) | `dons_q` |
| `primitives/EtatVide.tsx` (56) | zéro résultat |
| `primitives/Badge.tsx` (40) | facettes d'une ligne |
| `navigation/PanneauFiltres.tsx` (295) | le panneau latéral |
| `navigation/GroupeDepliant.tsx` (69) | une facette repliable |
| `navigation/FiltreTags.tsx` (156) | le contrôle à trois états |

`components/navigation/navigation.test.tsx` (522 lignes) est le modèle de test à
suivre. `components/navigation/VueNavigation.tsx` (313) est le patron d'ensemble.

Si une primitive doit changer pour accueillir les dons, **l'étendre** sans
régresser les sorts : ses tests existants doivent passer inchangés.

### Le comptage — l'invariant qui est le bug d'origine

**OU dans une facette, ET entre facettes.** Chaque option est comptée sous toutes
les *autres* facettes, de sorte que **le compteur d'une option prédit exactement le
résultat du clic**, et les options à zéro disparaissent. `compterOptions` le fait
déjà (étape 10) ; l'UI doit s'en servir **et ne jamais recompter à sa façon**.

Le bug historique : oublier de déclarer un champ multivalué (`categorie_officielle`)
faisait annoncer 249 dons pour un filtre qui n'en gardait aucun.

### Le coût, et le statut tri-état — deux règles de design déjà arbitrées

- **Le coût est une magnitude ordinale** → rampe **séquentielle bleue à une seule
  teinte**, validée par `validate_palette.js --ordinal` dans les **deux** modes.
  `COUTS_MAX = 5`. Ne pas prendre une palette divergente ni un dégradé multi-teinte.
- **`manual_check` passe par la bordure en tirets plus un « ! » textuel**, jamais
  par la teinte seule. Précédent du dépôt : `MarqueurDesaccord.tsx` (68 lignes) fait
  déjà exactement ce genre de chose — **le lire d'abord**.

Le statut porte **trois** valeurs et `manual_check` doit rester visible et
sélectionnable. Le filtrer par défaut cacherait au joueur précisément les dons que
le moteur n'a pas su trancher — la sous-attribution que tout le dépôt combat, et
dont la maxime est : *une sous-attribution est bien plus grave qu'une
sur-attribution*.

### Les dons isolés

**165 dons pour un Guerrier 6 n'ont aucune arête.** Ils sont **listés dans la vue
liste** et **exclus du graphe** (étape 15) : sans arête ils ne forment qu'un nuage
de points. Cette vue est donc la seule qui les montre — ne pas les filtrer.

### La dégradation attendue

Sans `feat_semantics.json`, les facettes sémantiques sont **masquées** (le dépôt
d'origine se fie à `resume.dons_etiquetes === 0`). L'index reste valide et la liste
fonctionne. Ce comportement est testé, pas facultatif.

Note mesurée : `polyvalence` vaut `conditionnel` pour **61 %** des dons — facette
faible, à ne pas mettre en avant.

### Le design system

`web/lib/design/tokens.ts` : `COULEURS` (thème Grimoire, parchemin `#F1E7D2`,
luminance 0,805), `MOUVEMENT` (**120 ms ease-out**), `MOTS`. Tailwind 4 CSS-first
`@theme`. **Toute couleur vient des tokens.** Thème sombre = mode à part entière.

`output: 'export'` + `typedRoutes` + `trailingSlash: true` : la page est un
composant client sous une coquille statique, aucune donnée récupérée à l'exécution
autrement que par `fetch` de `/data/dons/index.json` (que `vercel.json` sert en
`must-revalidate`, contrairement aux assets immuables).

## Pseudo-code

```
# web/app/dons/page.tsx      (coquille statique)
charger /data/dons/index.json  -> passe à <VueDons/>

# web/components/dons/VueDons.tsx   (client)
etat    = lireEtatDons(useSearchParams())         # source unique
filtres = versFiltres(etat)
retenus = filtrerDons(entrees, filtres)
comptes = pour chaque facette: compterOptions(entrees, filtres, facette)

rendre:
  <ChampRecherche>                       -> dons_q
  <PanneauFiltresDons>                   -> une <GroupeDepliant> par facette,
                                            <FiltreTags> à 3 états, comptes affichés
  curseur de coût (1..5)                 -> dons_cout
  <FiltreStatut> 3 états                 -> dons_statut
  <TableDense> des retenus               -> nom (lien /dons/<slug>/), effet, cible,
                                            coût (rampe bleue), statut (marqueur)
  <EtatVide> si zéro                     -> propose de retirer le dernier filtre

# web/components/dons/MarqueurStatut.tsx
'eligible' -> plein ; 'manual_check' -> bordure en tirets + « ! » ;
'ineligible' -> atténué + libellé textuel
# jamais la teinte seule

# web/components/dons/PastilleCout.tsx
1..COUTS_MAX -> rampe séquentielle bleue une teinte + le chiffre en texte
```

## Logic Flow

1. Lire `VueNavigation.tsx`, `PanneauFiltres.tsx`, `FiltreTags.tsx`,
   `MarqueurDesaccord.tsx`, `navigation.test.tsx`, `tokens.ts`.
2. Écrire `MarqueurStatut` et `PastilleCout` d'abord, avec leurs tests : ce sont
   les deux endroits où une règle de design déjà arbitrée peut être perdue.
3. Écrire `VueDons` en **branchant** l'API de 10, sans recompter.
4. Écrire les tests, **en commençant par l'invariant du compteur dans l'UI**.
5. Étendre `verifier_a11y.ts` à `/dons`.

## Implementation Notes

- **Ne pas porter `explorateur_dons.js`.** Ses 1 040 lignes sont un composant
  vanilla autonome ; le dépôt cible a déjà des primitives testées. En reprendre les
  **décisions** (documentées ici), pas le code.
- **Ne recompter aucune facette dans l'UI.** Un second algorithme de comptage
  divergerait de `filtrerDons` — c'est exactement le bug d'origine.
- **Ne pas paginer sans mesure.** 1 417 lignes dans `TableDense` peuvent suffire ;
  mesurer avant d'ajouter de la virtualisation. Pas de budget chiffré opposable (le
  dépôt les a retirés le 2026-08-26) : mesurer et rapporter.
- **`EtatVide` doit proposer une action.** « Zéro don » sans issue est un cul-de-sac ;
  proposer de retirer le filtre le plus restrictif.
- Aucun `useState` miroir de l'URL ; `{scroll: false}` à chaque écriture.
- Ne pas afficher de statut si aucun personnage n'est sélectionné : la colonne est
  absente, pas remplie de `manual_check`. Le branchement est l'étape 16.
- TypeScript strict, **aucun `any`**. Ne créer **aucun** fichier `__init__` et
  n'ajouter **aucun** `__all__`.

## Verification Criteria

1. **L'invariant du compteur, testé à travers l'UI** : pour chaque option affichée,
   le nombre rendu à côté d'elle égale le nombre de lignes après clic. Un test
   parcourt toutes les options de la fixture. C'est le bug d'origine, et aucune
   relecture de code ne l'attrape.
2. **Ce que le panneau annonce, il le montre** : aucun libellé d'option ne subsiste
   avec un compteur à zéro.
3. Le cycle à trois états est atteignable **au clavier** et annoncé par
   `aria-pressed` (ou équivalent) : trois clics ramènent à l'état initial.
4. `manual_check` est visible **et** sélectionnable par défaut : un test assert
   qu'il **n'est pas** exclu de l'état vide.
5. `MarqueurStatut` distingue les trois états **sans couleur** : test en désactivant
   la teinte, le libellé textuel et la bordure en tirets suffisent.
6. `PastilleCout` utilise la rampe **séquentielle une teinte**, et
   `node scripts/validate_palette.js --ordinal` passe en clair **et** en sombre.
7. Les **165** dons isolés (sans arête) apparaissent bien dans la liste : test sur
   un don isolé connu de la fixture.
8. Dégradation : avec un index dont tous les champs sémantiques sont `null`, les
   facettes sémantiques sont **masquées** et la page rend sans erreur.
9. Aucune couleur littérale : `grep -n "#[0-9a-fA-F]\{3,6\}"` sur les nouveaux
   fichiers → **zéro**.
10. `verifier_a11y.ts` étendu à `/dons` : **zéro violation axe-core**, en clair et
    en sombre.
11. `npm run web:build` réussit ; `typecheck`, `lint`, `npm run web:test` verts,
    **662 tests existants toujours passants et non modifiés**.

## Git Handling

Branche `fusion/13-ui-dons-list` depuis `feat/fusion-dons`. Quatre commits :

```
feat(web): marqueur de statut tri-état et pastille de coût ordinale
feat(web): vue à facettes des dons, branchée sur l'état d'URL
test(web): l'invariant du compteur, vérifié à travers le rendu
test(web): a11y de /dons dans les deux thèmes
```

Le corps du premier commit doit dire pourquoi `manual_check` passe par la bordure
en tirets et un « ! » textuel et jamais par la teinte seule, et pourquoi le coût
prend une rampe séquentielle à une seule teinte (magnitude ordinale).

## Expected Outcome

Un joueur peut poser à la liste la question qu'il se pose vraiment, par une URL
partageable, et les compteurs ne lui mentent pas. Les étapes 15 (graphe) et 16
(personnage) se branchent sur cette vue plutôt que d'en créer une autre.
