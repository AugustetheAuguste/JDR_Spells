# 15 — Constats, les quatre primitives

## A — `PastilleEcole.tsx`, le carré d'école en thème nuit

Défaut #18 (00_CONTEXT.md), décidé par l'étape 04 et posé ici. Un contour 1px
`bordFort` a été ajouté sur le carré `aria-hidden`, dans les deux variantes
(`complete` et `puce`), dans les deux thèmes. Aucune des 9 valeurs de
`COULEURS_ECOLES` n'a bougé — `git diff web/lib/design/tokens.ts` reste vide,
c'est vérifié.

`necromancie` sous `data-theme="nuit"` était le cas le plus dur : le carré
mesurait environ 1,5:1 sur le fond nuit, quasi invisible. `bordFort` tient
3,84:1 sur `base` nuit (WCAG 1.4.11, plancher 3:1 d'un contour de contrôle),
donc le contour rend le carré visible sans retarer un seul aplat. Vérifié à
l'œil sous `data-theme="nuit"` : le rectangle se détache nettement du fond une
fois le contour posé, y compris pour `necromancie`.

**Le carré n'obéit pas à la règle des 44 px.** Il fait 12 px de côté, il est
`aria-hidden` et rien n'y est cliquable. Le commentaire du composant l'écrit
explicitement, pour qu'une session suivante ne le grossisse pas — cela
casserait la densité de la table dense (40 lignes à 32 px).

## B — `BasculeTheme.tsx`, le test dédié qui manquait

Le composant n'avait aucun test (`design/FOLLOWUPS.md`). Un fichier
`BasculeTheme.test.tsx` est ajouté, cinq assertions.

1. Le libellé rendu est « Thème jour » ou « Thème nuit », jamais un autre mot.
2. L'état est exposé par `aria-pressed`. Choix documenté en commentaire dans
   le test : c'est un bouton simple isolé (une case, un booléen), pas un
   membre d'un groupe `switch`/`radiogroup` — le motif WAI-ARIA « button
   (pressed) » est celui qui correspond à un `<button>` nu sans groupe autour.
3. Le clic écrit `pf-theme` dans `localStorage` (`nuit` puis `jour`).
4. Le clic pose et retire `data-theme` sur `documentElement`.
5. `prefers-color-scheme` et `matchMedia` n'apparaissent jamais dans le
   fichier source (lu par le test, pas mocké) — la seule garde possible pour
   « jamais lu », puisqu'un `matchMedia` moqué en jsdom ne prouverait rien.
   La limite de ce garde-fou (laid, mais le seul possible) est écrite en
   commentaire dans le test.

Le bouton porte désormais `min-h-cible min-w-cible` (44px, `DENSITE.cible`) —
défaut #7 le nommait explicitement. Aucune transition n'est attachée au
composant, donc `prefers-reduced-motion` n'a rien à neutraliser ici.

Le script inline de `app/layout.tsx` (étape 07, hors périmètre) n'a pas été
touché.

## C — `MarqueurDesaccord.tsx`

Vérifié, aucun changement nécessaire.

- Vocabulaire : le composant écrit « Désaccord de niveau entre les sources »
  (`aria-label`) et « Les deux sources ne donnent pas le même niveau » dans le
  corps. `grep -rniE "erreur|conflit|incohérence"` ne trouve rien dans les
  chaînes affichées.
- Il informe, il n'accuse pas : pas de rouge d'alerte, pas d'icône
  d'avertissement. Le fond `desaccord-voile` est un lavis parchemin, pas un
  aplat vif.
- Le désaccord se lit sans la couleur : le mot « désaccord » (variante puce)
  et la phrase « ne donnent pas le même niveau » (variante complète) portent
  l'information en texte, indépendamment de toute couleur. Vérifié à l'œil en
  niveaux de gris (simulation mentale par retrait de la couleur du texte) : le
  lecteur comprend la nature du désaccord sans la couleur `desaccord`.
- Contraste du texte sur `desaccord-voile` : 6,52:1 jour, 4,72:1 nuit (calculé,
  `tokens.test.ts`, déjà couvert). Le voile nuit (`#1F150F`) reste
  délibérément plus sombre que la teinte parchemin nocturne « évidente », pour
  tenir AA contre le `desaccord` nuit éclairci — non « harmonisé » avec les
  autres voiles.

## D — `Badge.tsx`, les fonds réellement reçus

Appelants lus en lecture seule : `CoucheEnrichissement.tsx`,
`TableComparaison.tsx`, `MarqueurDesaccord.tsx`, `VueFavoris.tsx`,
`PanneauFiltres.tsx`, `TableSorts.tsx`. Chaque tonalité de `Badge` porte son
propre `bg-*` opaque, donc le fond que le texte reçoit est exactement celui du
ton, jamais celui de la page qui l'entoure. Quatre fonds, deux thèmes, huit
mesures.

| Ton | Texte | Fond | Jour | Nuit |
|---|---|---|---|---|
| `neutre` | `encre-douce` | `base` | 6,90:1 | 9,44:1 |
| `accent` | `encre-douce` (corrigé, voir ci-dessous) | `accent-voile` | 7,19:1 | 8,87:1 |
| `alerte` | `desaccord` | `desaccord-voile` | 6,52:1 | 4,72:1 |
| `donnees` | `encre` | `surface` | 14,28:1 | 12,41:1 |

Toutes les huit mesures tiennent AA (≥ 4,5:1), avec le test qui les calcule
(`primitives.test.tsx`, formule WCAG 2.1 locale — dupliquée depuis
`tokens.test.ts` plutôt qu'importée, ce fichier étant le territoire de
l'étape 04).

**Un fond a échoué avant correction.** Le ton `accent` utilisait `text-accent`
sur `bg-accent-voile`. En thème nuit, `accent` (`#D16170`) sur `accentVoile`
nuit (`#34141A`) mesure **4,48:1** — sous le plancher 4,5:1, par une marge
fine que `tokens.test.ts` n'avait jamais mesurée (ce fichier ne teste
`accent` que contre `base`, jamais contre `accentVoile`). Le jour tient
(8,08:1), seule la nuit échoue.

Correctif posé **dans `Badge.tsx`**, pas dans `tokens.ts` : le ton `accent`
garde `border-accent` (la bordure porte encore la teinte d'accent) mais son
texte passe à `encre-douce`, un jeton déjà existant, qui tient 7,19:1 jour et
8,87:1 nuit sur `accent-voile`. Aucun jeton nouveau n'était nécessaire, donc
aucune modification de `web/lib/design/tokens.ts` (hors périmètre, étape 04) —
`git diff web/lib/design/tokens.ts` reste vide.

Aucune couleur en dur, aucune couleur Tailwind par défaut dans `Badge.tsx` —
les quatre tons ne référencent que des classes `bord-*`, `bg-*`, `text-*`
issues des jetons.

## E — charte et cibles, résumé

- `npm run web:typo` : aucun écart signalé dans `web/components/primitives/`
  (40 écarts au total sur le dépôt, tous dans des fichiers hors périmètre —
  d'autres étapes de la vague 2 encore en cours).
- `npm run web:cibles` : 3908 écarts au total sur le dépôt, tous des champs
  `<input>` sous le plancher de police 16px (défaut #6, territoire de
  `ChampRecherche.tsx`, étape 10) — aucun écart ne cite `BasculeTheme` ou un
  bouton sous 44px dans ce périmètre.
- Focus clavier : aucun `outline-none` dans les quatre fichiers. Le focus
  global `outline: 2px solid accent; outline-offset: 2px` (`theme.css`, hors
  périmètre) s'applique tel quel à `BasculeTheme`, seul élément interactif du
  lot.
- Parcours clavier de `BasculeTheme` : `Tab` l'atteint, `Espace` et `Entrée`
  l'activent (comportement natif d'un `<button type="button">`, sans
  `onKeyDown` personnalisé qui pourrait l'empêcher).
- `prefers-reduced-motion` : aucune des quatre primitives ne porte de
  transition, donc rien à neutraliser.
- `rayon: 0px` inchangé (`rounded-jeton` résout à `0px` dans `theme.css`),
  aucun dégradé, aucune ombre décorative, aucune animation d'entrée.

## Avant / après

| Critère | Avant | Après |
|---|---|---|
| `necromancie` en thème nuit | ~1,5:1, quasi invisible | contour `bordFort` 1px, visible aux deux thèmes |
| Test dédié `BasculeTheme` | absent | 5 assertions, `BasculeTheme.test.tsx` |
| Cible tactile `BasculeTheme` | ≈26px (`px-2 py-1 text-petit`) | `min-h-cible min-w-cible` (44px) |
| Texte `Badge` ton `accent` sur son fond, nuit | 4,48:1, sous AA | `encre-douce`, 8,87:1 |
| `MarqueurDesaccord` | déjà conforme | inchangé |
