# 15 — UI GRAPH : la vue arbre des prérequis

**Vague 5.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/15-ui-graph`.

## Objectives

Ajouter à `/dons` un onglet **arbre** : le graphe des prérequis rendu par Cytoscape
+ dagre, découpé en **voies**, et qui **ne montre jamais un nombre qu'il ne montre
pas**.

C'est la vue secondaire, délibérément : elle répond à « d'où vient ce don », pas à
« quels dons me donnent un bonus aux dégâts ». Et elle porte le correctif du bug
d'origine du dépôt.

## Dependencies & Parallelization

- **Vague 5.** Dépend de **13_UI_DONS_LIST** — la vue existante, dont l'arbre
  devient un onglet, et l'état d'URL qu'il partage.
- **Ne dépend pas de 16** : l'arbre se rend sans personnage (graphe du catalogue).
  Un personnage sélectionné le restreint, mais n'est pas requis.
- Parallèle à **16_CHARACTER_BINDING** : 16 touche `web/lib/compte/`,
  `components/compte/` et la liaison au personnage ; celle-ci touche
  `components/dons/Arbre*`. Le seul point de contact est l'onglet, déclaré ici.
- Dépend indirectement du moteur TS (les dérivations `calculerLeviers`,
  `calculerVoies`, `construireGraphe` de l'étape **09**), déjà fusionné en vague 4.

## Inherited Context from Dependencies

### Le bug d'origine — la raison d'être de cette étape

Le symptôme, dans le dépôt `Dons` : *« des groupes de 1 qui annoncent débloquer
2 dons sans les montrer »*. La cause : les trois grandeurs (`levier`, `voie`,
`debloque`) étaient calculées sur le **catalogue** (1 417 dons) puis affichées à
côté d'un graphe ne montrant que le **sous-ensemble atteignable** (459 pour un
Guerrier 6). Tout ce que l'une comptait et que l'autre ne montrait pas devenait un
mensonge à l'écran : **94 nœuds à levier surévalué, 13 nœuds sans arête, 2 voies
nommées d'après un don non retenu** — désormais **0/0/0**.

Le correctif : `construire_graphe(catalogue, restreint_a=None)` est appelée **deux
fois**, sur le catalogue et sur le sous-ensemble affiché. `levier` (dans la vue) et
`levier_catalogue` sont **deux champs distincts**, et l'écart n'est plus caché mais
**affiché comme information** : « ce don ouvre plus loin que tu ne vois d'ici ».

Raisonnement complet et mesures avant/après :
`build/dons/OUTPUT_defauts_du_graphe.md`.

### Les grandeurs, et ce qu'elles ne sont pas

- **`cout`** — nombre exact d'emplacements, prérequis compris. La vague n'en est
  qu'une **borne inférieure** : un don exigeant deux prérequis distincts de vague 1
  coûte **3**, pas 2. `COUTS_MAX = 5`.
- **`levier` / `levier_catalogue` / `debloque`** — nombre de dons débloqués
  transitivement, dans la vue et dans le catalogue, plus la **liste** des enfants
  directs. C'est le proxy de valeur le plus honnête disponible : le CSV ne dit
  **rien** de la puissance d'un don, mais « Expertise du combat » en ouvrant **65**
  est un fait structurel. **Ne jamais présenter ce classement comme une mesure de
  puissance** — l'écrire dans l'interface, pas seulement dans le code.
- **`voie` / `voie_taille`** — le hub racine dont le don descend, et la taille de
  cette voie. Sans ce découpage la composante géante s'affiche d'un bloc et
  n'apprend rien ; avec lui on retrouve les familles qu'un joueur a en tête (voie de
  l'Expertise du combat, de l'Attaque en puissance…). `voie_taille` permet de
  **replier les voies de taille 1-2** sans rien redériver. `VOIE_MINIMALE = 3`.

### Les dons isolés

**165 pour un Guerrier 6.** Ils sont **listés dans la vue liste** (étape 13) et
**exclus du graphe** : sans arête, ils ne forment qu'un nuage de points. L'onglet
arbre doit **dire combien il en exclut** et renvoyer vers la liste — un nœud absent
sans explication est le même mensonge que le levier surévalué.

### Cytoscape n'interprète pas les variables CSS

Le dépôt d'origine résout ce point par `lireRoles()`, qui lit les variables depuis
**l'élément racine via `global.getComputedStyle`** — jamais le global implicite du
navigateur, afin que le composant reste rendable sous jsdom. La feuille de style
reste l'**unique source de vérité des couleurs**, thème sombre compris
(`rafraichirTheme()`).

Ici, la source de vérité est `web/lib/design/tokens.ts` (`COULEURS`, `MOUVEMENT` à
**120 ms ease-out**, `MOTS`). Donc : lire les tokens, les passer à Cytoscape en
valeurs résolues, et **réappliquer au changement de thème**.

`ZOOM_LISIBLE = 0.8` : en dessous, les libellés cessent d'être lisibles et le
dépôt d'origine les masque.

### Le coût, en couleur

Magnitude **ordinale** → rampe **séquentielle bleue à une seule teinte**, validée
par `node scripts/validate_palette.js --ordinal` dans les **deux** modes. La
primitive existe déjà : `PastilleCout` (étape 13). **La réutiliser**, pas en
refaire une variante pour Cytoscape — recalculer la rampe ailleurs la fera diverger.

### Le statut `manual_check`

**Bordure en tirets plus un « ! » textuel**, jamais la teinte seule. Dans un graphe,
cela signifie un style de bordure `dashed` **et** un caractère dans le libellé du
nœud.

### La dégradation attendue

Sans Cytoscape chargé, **l'onglet arbre est désactivé** (pas absent, pas planté) —
état testé dans le dépôt d'origine, à reproduire. La liste reste pleinement
utilisable : le graphe est un supplément.

### Plateforme

`output: 'export'` : Cytoscape et dagre sont chargés **côté client**, en import
dynamique, jamais dans le graphe serveur. `typedRoutes` fait échouer un `href`
invalide. L'état de l'onglet vit dans l'URL comme le reste (`{scroll: false}`,
aucun `useState` miroir).

## Pseudo-code

```
# web/components/dons/VueArbre.tsx   (client, import dynamique de cytoscape)
props: { entrees, filtres, perso? }

retenus  = filtrerDons(entrees, filtres)          # la vue courante
grapheCatalogue = construireGraphe(entrees)       # 1er appel
grapheVue       = construireGraphe(entrees, retenus)  # 2e appel  <-- le correctif
leviers = calculerLeviers(grapheVue, grapheCatalogue)  # levier + levierCatalogue
voies   = calculerVoies(grapheVue)

isoles = retenus sans arête dans grapheVue
rendre:
  bandeau : « N dons isolés ne figurent pas ici » -> lien vers l'onglet liste
  une section repliable par voie, triée par voieTaille décroissante
       voies de taille < VOIE_MINIMALE repliées d'office
  cytoscape:
      layout dagre, de haut (prérequis) vers bas (dépendants)
      couleur de nœud = rampe de coût, résolue depuis les tokens
      bordure dashed + « ! » si manual_check
      libellés masqués sous ZOOM_LISIBLE
  panneau de détail au clic:
      nom, coût, levier (dans la vue), levierCatalogue, liste `debloque`
      si levierCatalogue > levier: le dire explicitement, en français
      mention : « nombre de dons ouverts, pas une mesure de puissance »

# web/lib/dons/roles-graphe.ts
lireRoles(racine, getComputedStyle) -> couleurs résolues depuis les tokens
# paramètres explicites : le composant doit rester rendable sous jsdom
```

## Logic Flow

1. Lire `web/explorateur_dons.js` (lignes 856-1039 : `cytoscape`, layout dagre,
   `lireRoles`, `rafraichirTheme`) pour les **décisions**, et `tokens.ts` pour les
   couleurs. Ne pas porter le code.
2. Écrire `roles-graphe.ts` avec `getComputedStyle` **injecté**, et son test jsdom.
3. Écrire `VueArbre` avec le **double appel** à `construireGraphe`.
4. Écrire les trois tests d'invariant (0/0/0) **avant** de peaufiner le rendu.
5. Brancher l'onglet dans la vue de l'étape 13, avec sa désactivation propre.

## Implementation Notes

- **Le double appel n'est pas un doublon à optimiser.** Quiconque le « factorise »
  réintroduit le bug d'origine. Le commenter en ce sens dans le code.
- **Ne jamais afficher un nombre sans pouvoir montrer ce qu'il compte.** C'est
  l'invariant du dépôt : *ce que le panneau de détail annonce, il le montre*. Le
  seul écart admis est `levierCatalogue`, et il est **nommé** comme tel.
- **`getComputedStyle` est un paramètre**, pas un global implicite : sinon le
  composant devient irrendable sous jsdom et cesse d'être testé.
- **Réutiliser `PastilleCout`** pour la rampe, et `MarqueurStatut` pour le tri-état.
  Deux définitions de la même échelle divergeront.
- **Ne pas rendre le graphe entier d'un bloc.** 1 417 nœuds sans découpage en voies
  n'apprennent rien — c'est le constat qui a produit `voie`. Mesurer le temps de
  layout et le rapporter ; pas de budget chiffré opposable.
- Import **dynamique** de Cytoscape et dagre : leur présence dans le graphe serveur
  casserait `output: 'export'`.
- TypeScript strict, **aucun `any`** (y compris aux frontières de Cytoscape :
  écrire les types minimaux nécessaires plutôt qu'un `any`).
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. **Les trois invariants du correctif, à zéro** : sur la vue courante, **zéro**
   nœud dont le `levier` affiché dépasse ce que le graphe de la vue montre
   réellement · **zéro** nœud sans arête présent dans le graphe · **zéro** voie
   nommée d'après un don non retenu. Un test les compte tous les trois. Ce sont les
   94/13/2 d'origine.
2. `construireGraphe` est appelée **deux fois** : un test avec espion l'assert. Une
   « optimisation » à un seul appel doit faire échouer la suite.
3. Quand `levierCatalogue > levier`, le panneau de détail **le dit** : test sur un
   don connu de la fixture.
4. Le panneau **montre** la liste `debloque` qu'il annonce : comparé sur au moins
   **24 dons** de la fixture (l'invariant que le test jsdom d'origine gardait sur
   38 dons réels).
5. Le bandeau nomme le nombre exact de dons **isolés** exclus et lie vers la liste.
6. Un don à deux prérequis distincts de vague 1 affiche un coût de **3**, pas 2.
7. Les voies de taille `< VOIE_MINIMALE` sont repliées d'office ; les voies sont
   triées par taille décroissante.
8. Les libellés sont masqués sous `ZOOM_LISIBLE`.
9. **Sans Cytoscape** (module absent en test), l'onglet est **désactivé** et la
   liste reste utilisable : aucun plantage, message explicite.
10. `rafraichirTheme` : un test bascule en sombre et assert que les couleurs des
    nœuds changent, résolues depuis les tokens. `grep -n "#[0-9a-fA-F]\{3,6\}"` sur
    les nouveaux fichiers → **zéro**.
11. `node scripts/validate_palette.js --ordinal` passe en clair et en sombre.
12. `verifier_a11y.ts` : la vue arbre ne dégrade pas l'accessibilité de `/dons`
    (le canevas n'est pas navigable au clavier — fournir donc la **liste** comme
    équivalent accessible et le déclarer).
13. `npm run web:build` réussit ; `typecheck`, `lint`, `web:test` verts, **662
    tests existants toujours passants**.

## Git Handling

Branche `fusion/15-ui-graph` depuis `feat/fusion-dons`. Quatre commits :

```
feat(web): résolution des couleurs du graphe depuis les tokens, injectable
feat(web): vue arbre des prérequis, découpée en voies
fix(web): calculer les leviers sur la vue ET sur le catalogue, jamais l'un pour l'autre
test(web): les trois invariants du graphe — 94/13/2 devenus 0/0/0
```

Le corps du troisième commit doit citer le symptôme d'origine (« des groupes de 1
qui annoncent débloquer 2 dons sans les montrer ») et les mesures avant/après, afin
que personne ne « factorise » le double appel.

## Expected Outcome

Le joueur voit d'où vient un don, par famille, et **aucun nombre affiché n'est
invérifiable à l'écran**. L'écart entre ce que le don ouvre ici et ce qu'il ouvre
dans tout le catalogue est devenu une information au lieu d'un mensonge.
