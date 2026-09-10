# 09 — Constats, tiroir de navigation et recherche collante

## Table A — ce qui change

| Fichier | Nature du changement |
|---|---|
| `web/components/navigation/TiroirFiltres.tsx` (nouveau) | Enveloppe le `PanneauFiltres` existant. Sous 1024 px, `hidden` par défaut, devient un tiroir plein écran (`fixed inset-0`) quand ouvert, avec un en-tête « Filtrer » et un bouton « Fermer ». À partir de 1024 px, redevient la colonne latérale statique d'origine (`lg:static lg:flex`), inchangée. |
| `web/components/navigation/VueNavigation.tsx` | Ajoute l'état local `tiroirOuvert` (`useState`, commenté comme état d'affichage et non de filtre). Ajoute le bouton « Filtrer » collant en bas d'écran, sous 1024 px, portant le nombre de filtres posés. Rend le champ de recherche collant (`sticky top-0`) et publie sa hauteur mesurée en `--pf-decalage-collant` sur le conteneur des résultats. Ajoute `min-h-cible` aux boutons « Tout effacer » et « Afficher N sorts de plus ». Corrige deux tirets cadratins en prose (état vide, compteur de résultats). |
| `web/components/primitives/EtatVide.tsx` | Les boutons d'action portent désormais `min-h-cible` (44 px). |
| `web/lib/navigation/etat-url.ts` | Ajoute `nombreFiltresPoses(etat)`, qui compte les catégories de filtres posées (hors `q` et `tri`) pour le libellé du bouton « Filtrer, N posés ». |
| `web/lib/navigation/niveaux.ts` | Corrige un deux-points en prose dans le `title` du niveau sans classe (« Par classe : » → « Par classe, »), défaut préexistant dans le périmètre de cette étape. |
| `web/app/page.tsx` | Inchangé — la garde `Suspense` reste valide, aucun contrat modifié. |

## Table B — ce qui ne change pas

| Élément | Pourquoi |
|---|---|
| `PanneauFiltres.tsx` | Monté tel quel, mêmes props (`etat`, `index`, `surClasse`, `surEtat`). Périmètre de l'étape 08. |
| `TableSorts.tsx`, `ChampRecherche.tsx`, `lib/navigation/tri.ts` | Périmètre de l'étape 10. |
| Les exports `LIBELLE_SANS_CLASSE` et `libelleNiveau` de `niveaux.ts` | Lus par l'étape 08 pour son `aria-label`, non renommés. |
| Les tests `SANS_SAUT` | Conservés à l'identique, aucune assertion modifiée. |

## Matrice des six largeurs, avant et après

### Position verticale de la première ligne de `<tbody>`, route `/`

| Largeur | Avant | Après |
|---|---|---|
| 320 px | y = 2606 px | y = 525 px |
| 375 px | y = 2422 px | y = 525 px |
| 768 px | y = 1822 px | y = 415 px |
| 1024 px | y = 361 px | y = 377 px |

Sous 1024 px, le panneau de 12 groupes de filtres n'est plus empilé au-dessus du
tableau. Le lecteur voit le premier sort bien avant 900 px, contre plus de
2400 px auparavant à 375 px.

### Écarts de cible tactile, route `/` (`npm run web:cibles`)

| Largeur | Avant | Après |
|---|---|---|
| 320 px | 580 | 369 |
| 375 px | 579 | 368 |
| 768 px | 583 | 372 |
| 1024 px | 524 | 523 |
| 1440 px | 525 | 524 |
| 1920 px | 525 | 524 |

La baisse sous 1024 px vient du panneau de filtres qui n'est plus visible
(donc plus mesuré) au chargement de la page. Les écarts restants, à toute
largeur, portent sur les liens de la barre de navigation globale (étape 07),
le champ de recherche à 14,5 px (étape 10, défaut #6) et les en-têtes de
colonne triables ainsi que la case favori de `TableSorts.tsx` (étape 10) —
aucun ne porte sur un contrôle du périmètre de cette étape. Vérifié par
`grep` sur le rapport complet : aucune occurrence de « Filtrer », « Fermer »,
« Tout effacer », « Retirer », « Voir tous les sorts » ou « sorts de plus ».

## Vérifications exécutées

- `npm --prefix web run test` — 703 tests verts (29 fichiers), y compris les
  quatre tests ajoutés pour le tiroir (`aria-expanded`, nombre de filtres
  sans « (s) », Échap ferme et rend le focus, aucune écriture dans l'URL à
  l'ouverture) et les tests `SANS_SAUT` inchangés.
- `npm --prefix web run lint` et `npm --prefix web run typecheck` — verts.
- `npm run web:typo` — aucun écart dans les fichiers du périmètre (le seul
  écart historique de `niveaux.ts` est corrigé au passage).
- `npm run web:build` puis `npm run web:cibles` — build complet (2081 pages),
  matrice ci-dessus.
- `npm run web:verifier` — `verifier_build.ts` (pages complètes) et
  `verifier_a11y.ts` (aucune violation WCAG A/AA sur 5 routes) verts.
  `verifier_cibles.ts` échoue globalement sur le site entier, comme avant
  cette étape : les écarts restants appartiennent aux étapes 07 et 10, jamais
  au périmètre ci-dessus.
- Mesure manuelle (Chromium local, `playwright-core`) : à 1024 px, le bouton
  « Filtrer » a une taille de boîte nulle (`width: 0, height: 0`), confirmant
  qu'il est bien absent du rendu au-delà du point de rupture `lg`, et non
  seulement masqué visuellement.

## Note sur l'environnement d'exécution

La machine de vérification était fortement chargée pendant une partie de
cette passe (échecs de `fork`, jobs `npm ci` avortés par erreurs disque,
workers Vitest tués par manque de mémoire lors d'une exécution parallèle
complète). Aucun de ces incidents n'est un défaut du code : rejoués un par
un une fois la charge retombée, tous les tests et scripts ci-dessus passent.
