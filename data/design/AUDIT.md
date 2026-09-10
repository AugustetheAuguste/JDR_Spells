# Audit — design/ vs web/ (2026-08-31)

Portée : `design/`, `web/`. N'a pas touché `data/`, `cache/`, `src/`.

## 1. Carte vitrine → composant réel

| Vitrine | Route réelle | Composants réels |
|---|---|---|
| `design/vitrines/index.html` | (sommaire, pas de route produit) | — |
| `design/vitrines/liste.html` | `/` | `web/app/page.tsx`, `web/components/navigation/{VueNavigation,PanneauFiltres,TableSorts,FiltreConditions,FiltreTags,GroupeDepliant}.tsx`, `web/components/primitives/{TableDense,PastilleEcole,Badge,ChampRecherche,EtatVide}.tsx` |
| `design/vitrines/fiche.html` | `/sorts/[slug]` | `web/app/sorts/**`, `web/components/fiche/{BlocTechnique,NiveauxParClasse,Description,LienSource,CoucheEnrichissement}.tsx`, `web/components/primitives/{PastilleEcole,MarqueurDesaccord,Badge}.tsx` |
| `design/vitrines/comparaison.html` | `/comparaison` | `web/app/comparaison/**`, `web/components/comparaison/VueComparaison.tsx` |
| `design/vitrines/favoris.html` | `/favoris` | `web/app/favoris/**`, `web/components/favoris/{VueFavoris,BoutonFavori}.tsx`, `web/components/primitives/EtatVide.tsx` |
| `design/vitrines/jetons.html` | pas de route produit ; le banc d'essai le plus proche est `web/lib/design/tokens.ts` + `tokens.test.ts` (pas de page `/_design` dans le dépôt) | `web/lib/design/tokens.ts` |
| `design/vitrines/tokens.css` | — | `web/lib/design/tokens.ts` (source), `web/styles/theme.css` (miroir Tailwind 4 forcé) |

Composants supplémentaires sans vitrine dédiée, découverts en explorant `web/components/` : `exploration/*` (graphes, `/explorer`), `compte/*` (`/compte`, connexion Supabase), `Fournisseurs.tsx` (pile de contextes). Non couverts par une vitrine, non modifiés par cette passe au-delà des jetons partagés qu'ils importent déjà de `tokens.ts`.

## 2. Constat central — deux systèmes divergents, un seul construit

`design/GRIMOIRE_DESIGN_SYSTEM.md` (v2, « Grimoire ») et `design/vitrines/*` documentent et
implémentent un système **différent** de celui réellement construit dans `web/` :

| | GRIMOIRE_DESIGN_SYSTEM.md + vitrines (v2) | `web/lib/design/tokens.ts` + `web/styles/theme.css` (implémenté) |
|---|---|---|
| Fond | parchemin `#F1E7D2` | neutre `#FAFAF9` |
| Police titre | Eczar (serif à empattements marqués) | Fraunces |
| Police corps | Lora (serif) | Inter (sans) |
| Police données | Eczar `tabular-nums` (pas de police de code) | IBM Plex Mono |
| Thèmes | jour **et** nuit, bascule complète | un seul thème — `tokens.test.ts` interdit explicitement `prefers-color-scheme` |
| Rayons | 0 px partout | 4 px (jetons), 6 px (panneaux) |
| Décor | double encadrement, filet doré 3 px, séparateur `❖`, lettrine 44 px | aucun de ces éléments — pas de cadre décoratif, pas de glyphe, pas de lettrine |
| Pastille d'école | texte blanc sur aplat | aplat + libellé en encre, dans un carré séparé (voir §4) |
| Hauteur de ligne | 28 px fixe | 32 px (ou 28 px « dense ») |

Ce n'est pas une petite dérive de valeurs : c'est **deux directions visuelles**. La Skill
(`pf-web-design-system`) documente la colonne de droite, et c'est elle que `web/` construit et que
`tokens.test.ts` fait respecter (622+ tests, dont l'assertion explicite « mode sombre absent »).
`GRIMOIRE_DESIGN_SYSTEM.md` v2 n'a **jamais été porté** dans `web/` — aucun `data-theme`, aucun
fichier `eczar-*.woff2` ou `lora-*.woff2` dans `public/fonts/`, aucun composant n'importe une valeur
de `tokens.css` des vitrines.

Au regard des garde-fous de cette tâche (« pas de dégradé », « préférer le plus simple/minimal au
plus chargé ») : la colonne de gauche (v2) est plus chargée que la colonne de droite (v1
implémenté) — double cadre, lettrine, glyphe ornemental, deux thèmes à maintenir. Elle ne contredit
pas la règle « pas de dégradé » (aucune des deux n'en a), mais elle contredit « minimal ». Voir
`DECISIONS.md`.

## 3. Contraste WCAG — vérifié par calcul, pas à l'œil

Recalculé indépendamment (luminance relative WCAG 2.1) pour chaque paire texte/fond du système
implémenté (`web/lib/design/tokens.ts`) :

| Paire | Ratio | Seuil | Résultat |
|---|---|---|---|
| `encre` / `base` | 16,48:1 | 4,5:1 (texte) | conforme |
| `encreDouce` / `base` | 7,22:1 | 4,5:1 | conforme |
| `encreFaible` / `base` | 4,79:1 | 4,5:1 | conforme, de justesse — c'est le plancher documenté |
| `accent` / `base` | 6,21:1 | 4,5:1 | conforme |
| blanc / `accent` | 6,48:1 | 4,5:1 | conforme (bouton primaire) |
| blanc / `evocation` (école la plus claire) | 5,65:1 | 4,5:1 | conforme |
| `transmutation` / `base` (plancher des écoles) | 5,14:1 | 4,5:1 | conforme (documenté 5,13:1, arrondi vers le bas à dessein) |
| `desaccord` / `base` | 7,46:1 | 4,5:1 | conforme |
| **`bordFort` / `base`** | **1,63:1** | **3:1 (limite d'un contrôle, WCAG 1.4.11)** | **NON conforme — défaut réel** |
| **`bordFort` / `surface`** | **1,70:1** | **3:1** | **NON conforme** |

Le seul défaut réel trouvé : `bordFort` (`#C9C6C0`) sert de contour de champ, de contrôle, de
panneau (grep : `bord-fort` apparaît dans 21 fichiers de composants, dont `ChampRecherche.tsx`,
`PanneauFiltres.tsx`, `BoutonFavori.tsx`). Un contour de contrôle est un élément d'interface, donc
soumis au plancher 3:1 de la SC 1.4.11 — pas au plancher texte 4,5:1, mais 1,63:1 est en dessous des
deux. Aucun test existant ne le vérifiait : `tokens.test.ts` teste le texte et les écoles, jamais les
contours. **Corrigé** dans cette passe (§ DECISIONS, § CHANGES) : `#8F8B82`, qui mesure 3,25:1 sur
`base` et 3,40:1 sur `surface`, et un test est ajouté pour que la régression soit visible.

## 4. Drift documentation ↔ code, au-delà de v1/v2

`pf-web-design-system` (la Skill) décrit la pastille d'école comme « aplat, texte blanc dessus ».
Le code réel (`web/components/primitives/PastilleEcole.tsx`) fait autre chose, en mieux : un carré
de couleur à part (`aria-hidden`, 12 px) suivi du libellé en encre — parce que le texte blanc
directement sur certaines écoles (Transmutation notamment) tombe entre 2,7:1 et 3,9:1, sous AA. Le
commentaire du composant l'explicite. C'est une amélioration silencieuse : correcte dans le code,
jamais remontée dans la Skill. Corrigé dans cette passe.

## 5. Accessibilité — au-delà du contraste

- Focus clavier : `theme.css` pose `:focus-visible` avec anneau 2 px `accent`, jamais désactivé sans
  remplacement ; testé (`tokens.test.ts` « le focus clavier est défini et jamais supprimé »).
  Conforme.
- `prefers-reduced-motion` : géré globalement dans `theme.css`, testé. Conforme.
- Couleur non seule porteuse : `PastilleEcole` (libellé toujours présent), `MarqueurDesaccord`
  (texte complet, pas de couleur seule). Conforme.
- Cible tactile : la Skill fixe 32 px de hauteur de ligne minimum et 40 px pour les contrôles réels ;
  non vérifié par un test automatisé (mesure DOM), seulement par convention documentée — noté en
  `FOLLOWUPS.md`.
- Zoom 200 % : non vérifiable hors navigateur réel dans cette session — noté en `FOLLOWUPS.md`.

## 6. Cohérence espacement/typographie

L'échelle de type (`ECHELLE`) et la densité (`DENSITE`) de `tokens.ts` sont internes cohérentes et
protégées par `tokens.test.ts` (miroir CSS, absence de collision de nom `text-<x>`/`color-<x>`,
budget de densité 40 lignes). Aucun défaut trouvé dans ce sous-système. Les vitrines, elles,
utilisent une échelle et une densité **différentes** (28 px fixe, tailles Eczar/Lora) — encore la
divergence v1/v2 du §2, pas un défaut indépendant.
