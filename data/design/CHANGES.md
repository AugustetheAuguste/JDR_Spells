# Changements — convergence sur v1 (2026-08-31)

Journal tenu au fil de l'exécution, pas reconstruit après coup.

## web/ — le seul défaut réel trouvé

| Fichier | Jeton / règle | Avant | Après |
|---|---|---|---|
| `web/lib/design/tokens.ts` | `COULEURS.bordFort` | `#C9C6C0` (1,63:1 sur `base`, sous le plancher 3:1 d'un contour de contrôle) | `#8F8B82` (3,25:1 sur `base`, 3,40:1 sur `surface`) |
| `web/styles/theme.css` | `--color-bord-fort` | `#c9c6c0` | `#8f8b82` (commentaire de ratio ajouté) |
| `web/lib/design/tokens.test.ts` | nouveau test | — | `bordFort tient le plancher 3:1 d'un contour de contrôle (WCAG 1.4.11)`, deux assertions (`base`, `surface`) |

Aucun autre fichier de `web/` n'a été modifié : l'audit n'a trouvé aucun autre défaut de contraste,
de focus, de mouvement ou de vocabulaire dans le système déjà implémenté. Les composants
(`PastilleEcole.tsx`, `MarqueurDesaccord.tsx`, `TableSorts.tsx`, etc.) étaient déjà conformes à la
direction retenue par cette passe.

## `.claude/skills/pf-web-design-system/SKILL.md`

| Section | Avant | Après |
|---|---|---|
| `bord_fort` | `#C9C6C0` | `#8F8B82`, avec les deux ratios et la référence WCAG 1.4.11 |
| Pastilles d'école | « Aplat, texte blanc dessus » | Corrigé pour décrire le comportement réel et correct de `PastilleEcole.tsx` : carré `aria-hidden` + libellé en `encre` à côté, parce que le blanc direct sur certaines écoles tombe sous AA |

## `design/GRIMOIRE_DESIGN_SYSTEM.md`

Réécrit intégralement. Avant : décrivait « v2 — Grimoire » (parchemin, Eczar/Lora, thème jour/nuit,
cadre ornemental, lettrine, rayon 0), jamais construit dans `web/`. Après : décrit v1 — le système
réellement implémenté (`tokens.ts` / `theme.css`), avec la correction de `bordFort`, un historique
qui explique pourquoi v2 est abandonnée, et la carte des vitrines mise à jour.

## `design/AUDIT.md`, `design/DECISIONS.md` — nouveaux

Carte vitrine → composant réel, constat de la divergence v1/v2, contrastes recalculés
indépendamment, défaut de `bordFort` trouvé et qualifié, drift de documentation sur la pastille
d'école. Décisions D1–D6 : v2 abandonnée, `bordFort` corrigé, Skill corrigée, aucune autre valeur
retouchée sans défaut identifié, `GRIMOIRE_DESIGN_SYSTEM.md` et les vitrines réécrits pour
converger sur v1.

## `design/vitrines/tokens.css`

Réécrit intégralement : palette parchemin (`--parchemin`, `--velin`, `--velin-teinte`, `--or`,
`--or-clair`, `--encadrement`, `--chaud`, `--actif-fond`, `--actif-encre`) remplacée par la palette
v1 (`--base`, `--surface`, `--survol`, `--bord`, `--bord-fort` corrigé, `--accent`, `--accent-voile`,
`--desaccord`). Bloc `[data-theme="nuit"]` supprimé entièrement. Polices `Eczar`/`Lora` remplacées
par `Fraunces`/`Inter`/`IBM Plex Mono`. `--rayon`/`--rayon-panneau` réintroduits (0 px partout → 4 px
/ 6 px). `--ligne` 28 px → 32 px (`--ligne-dense` 28 px disponible). Classes `.cadre`/`.interieur`
(double encadrement + ombre), `.ornement` (glyphe `❖`), `.lettrine` supprimées ; `.losange` renommée
`.carre-ecole` et son `rotate(45deg)` retiré (carré, pas losange, cohérent avec `PastilleEcole.tsx`).
Ligne sélectionnée ajoutée (`.selectionnee`) sur le modèle du composant réel. Désaccord réécrit en
encart informatif (`.encart-desaccord`) au lieu du soulignement pointillé + glyphe doré.

## `design/vitrines/*.html` — les six fichiers

Pour chacun : suppression du script de bascule de thème, de l'attribut `data-theme`, du bouton de
bascule, du double cadre (`.cadre > .interieur`), du filet doré du bandeau, du glyphe ornemental
`❖`, et — sur `fiche.html` — de la lettrine. Renommage `--font-titre` → `--font-affichage`,
`--velin`/`--velin-teinte` → `--surface`/`--survol`, `--filet`/`--filet-fort` → `--bord`/`--bord-fort`,
`losange` → `carre-ecole`. Google Fonts pointe maintenant Fraunces + Inter au lieu d'Eczar + Lora.
`comparaison.html` : puces de classe choisie recolorées en `--accent`/blanc au lieu de
`--actif-fond`/`--actif-encre` (tokens supprimés). `fiche.html` : marqueur de désaccord remplacé par
un encart informatif reproduisant `MarqueurDesaccord.tsx` (texte complet des deux valeurs, pas de
glyphe ni de soulignement pointillé) ; lien source déplacé au-dessus du pli, sous le titre. `jetons.html` :
sections « Surfaces et encres » et « Échelle typographique » réécrites pour les jetons et polices
réels (retrait de `parchemin`/`encadrement`/`or`/`actif-fond`, description Fraunces/Inter/IBM Plex
Mono). `index.html` : description mise à jour (32 px, pas de lettrine, pas de bascule).

## Ce qui n'a pas changé

Rien dans `data/`, `cache/`, `src/`, ou ailleurs dans le dépôt hors `design/` et les trois fichiers
`web/` listés plus haut. La structure de mise en page des vitrines (grille de filtres, colonnes de
tableau, disposition de fiche) est conservée : elle n'était pas spécifique à v2.

---

# Deuxième passe — Grimoire adopté par arbitrage humain (2026-08-31, plus tard le même jour)

Renverse D1 (voir `design/DECISIONS.md` D7–D8). Journal tenu au fil de l'exécution.

## Polices — `web/public/fonts/`

| Avant | Après |
|---|---|
| `fraunces-latin-var.woff2`, `inter-latin-var.woff2` | retirés |
| — | `eczar-latin-400.woff2`, `eczar-latin-500.woff2`, `eczar-latin-600.woff2`, `eczar-latin-700.woff2` (Ek Type, OFL 1.1, v27) |
| — | `lora-latin-400.woff2`, `lora-latin-500.woff2`, `lora-latin-600.woff2`, `lora-latin-400-italic.woff2` (Cyreal, OFL 1.1, v37) |
| `ibm-plex-mono-latin-{400,500}.woff2` | inchangés |

`LICENCES.md` mis à jour avec les nouvelles origines/versions et une note datée sur le remplacement.

## `web/lib/design/tokens.ts`

| Jeton / export | Avant (v1) | Après (Grimoire) |
|---|---|---|
| `COULEURS.base` | `#FAFAF9` | `#F1E7D2` |
| `COULEURS.surface` | `#FFFFFF` | `#F8F2E6` |
| `COULEURS.bord` | `#E4E2DE` | `#D9CBA8` |
| `COULEURS.bordFort` | `#8F8B82` | `#927C5D` (retaré contre le nouveau `base`, pas hérité) |
| `COULEURS.encre` | `#1C1B19` | `#2B2013` |
| `COULEURS.encreDouce` | `#57544E` | `#5C4A30` |
| `COULEURS.encreFaible` | `#736F67` | `#776040` |
| `COULEURS.survol` | `#F2F1EF` | `#EDE2CC` |
| `COULEURS.accent` | `#116B4F` (vert) | `#7E2537` (oxblood) |
| `COULEURS.accentSurvol` | `#0D5741` | `#5F1C29` |
| `COULEURS.accentVoile` | `#E8F1ED` | `#F7E9EC` |
| `COULEURS.desaccord` | `#8A3A12` | `#82451C` |
| `COULEURS.desaccordVoile` | `#FBEFE6` | `#F8EEE7` |
| `COULEURS_ECOLES.evocation` | `#B3421F` | `#A53D1D` (4,60:1 → 5,21:1 sur le nouveau `base` ; l'ancienne valeur retombait sous AA) |
| `COULEURS_ECOLES.transmutation` | `#8A6412` | `#866213` (4,37:1 sous AA sur le nouveau `base` → 4,54:1) |
| `COULEURS_ECOLES.*` (les sept autres) | inchangées | inchangées — recalculées, pas retouchées, et tenaient déjà |
| `COULEURS_NUIT` | n'existait pas | nouveau : palette nuit complète, permutation plate (§ Skill) |
| `POLICES.affichage` | Fraunces | Eczar |
| `POLICES.corps` | Inter | Lora |
| `POLICES.donnees` | IBM Plex Mono | inchangé |
| `DENSITE.rayon` / `rayonPanneau` | `4px` / `6px` | `0px` / `0px` |
| `RAMPE_CATEGORIELLE` | inchangée | inchangée — revérifiée contre le nouveau `base` (tient), pas contre `COULEURS_NUIT.base` (ne tient pas partout, voir `FOLLOWUPS.md`) |
| `MOTS.themeJour` / `themeNuit` | n'existaient pas | nouveaux, pour la bascule |

## `web/styles/theme.css`

Miroir des valeurs ci-dessus. `@font-face` Eczar (4 graisses) et Lora (3 graisses + italique)
remplacent Fraunces/Inter. Nouveau bloc `[data-theme='nuit']` avec les dix propriétés de
`COULEURS_NUIT`. `color-scheme: light` → `light dark`. Nouvelle règle `.lettrine::first-letter`
(couleur `accent`) — la lettrine parée, voir `design/DECISIONS.md` D7.

## `web/lib/design/tokens.test.ts`

- Import de `COULEURS_NUIT` ajouté.
- « respecte le plancher annoncé par le Skill » : seuil `5.13` → `4.53`, commentaire mis à jour avec
  le nouveau calcul (transmutation, 4,5359:1 contre le nouveau `base`).
- « la transition est courte, et le mode sombre absent » renommée « ... et la nuit ne suit pas la
  préférence système » : l'assertion `not.toMatch(/prefers-color-scheme/)` est conservée (toujours
  vraie — la bascule est un choix explicite, pas une media query) et une assertion positive sur la
  présence du bloc `[data-theme="nuit"]` est ajoutée.
- Nouveau describe « palette nuit — permutation plate, elle aussi vérifiée par calcul » : AA sur
  `encre`/`encreDouce`/`encreFaible`/`accent`/`desaccord` nuit, plancher 3:1 de `bordFort` nuit,
  AA de `desaccord` nuit sur son voile, direction de `accentSurvol` nuit (plus clair, pas plus
  sombre).
- Nouveau describe imbriqué « le bloc `[data-theme="nuit"]` » sous « theme.css ne dérive pas de
  tokens.ts » : treize assertions, une par propriété nuit, sur le modèle des assertions jour
  existantes.

## Composants — `web/app/`, `web/components/`

| Fichier | Changement |
|---|---|
| `web/app/layout.tsx` | script inline `SCRIPT_THEME` dans `<head>` (lit `localStorage`, pose `data-theme` avant peinture) ; `<BasculeTheme />` ajoutée dans le bandeau, à côté du lien source |
| `web/components/primitives/BasculeTheme.tsx` | nouveau — bouton de bascule jour/nuit, état initial lu au montage (pas dans un effet, voir commentaire du fichier), pas un provider (la règle de composition de `Fournisseurs.tsx` ne s'applique pas : aucun état partagé) |
| `web/app/sorts/[slug]/page.tsx` | `h1` du nom de sort reçoit la classe `.lettrine` |

Aucun autre composant modifié : tous consomment déjà les jetons via les classes Tailwind
sémantiques (`text-encre`, `bg-surface`, `font-affichage`, …), donc la nouvelle palette et la
nouvelle typographie se propagent sans retouche composant par composant — c'est précisément ce que
la règle « aucun hex hors de `tokens.ts` » achète.

## `design/vitrines/tokens.css` et les six `.html`

`tokens.css` réécrit : palette Grimoire jour dans `:root`, bloc `[data-theme='nuit']` ajouté,
`--font-affichage`/`--font-corps` → Eczar/Lora, `--rayon`/`--rayon-panneau` → `0px`, règle
`.lettrine::first-letter` ajoutée, `.bascule-theme` ajoutée. Les six pages : lien Google Fonts
Eczar/Lora (au lieu de Fraunces/Inter), titre et étiquette « vitrine v1 » → « vitrine Grimoire »,
bouton de bascule de thème ajouté dans le bandeau (`onclick` inline, sans dépendance JS externe),
`fiche.html` et `jetons.html` reçoivent la classe `.lettrine` sur leur titre de démonstration,
`comparaison.html` : `color:#fff` en dur remplacé par `color:var(--surface)`.

## `.claude/skills/pf-web-design-system/SKILL.md`, `design/GRIMOIRE_DESIGN_SYSTEM.md`, `design/DECISIONS.md`

Réécrits pour documenter Grimoire comme vérité actuelle, avec le raisonnement du renversement de D1
(D7) et le détail de la recomputation de contraste (D8). `design/DECISIONS.md` D1–D6 conservées
sans suppression : elles restent le compte-rendu exact de la première passe, même si sa conclusion
est maintenant renversée.

## Ce qui n'a pas changé dans cette passe

`data/`, `cache/`, `src/`, l'échelle typographique (`ECHELLE`), la densité (`ligneHauteur`,
`gouttiere`, etc. — sauf `rayon`/`rayonPanneau`), `IBM Plex Mono`, la structure DOM des composants
et des vitrines, le vocabulaire `MOTS` existant (deux entrées ajoutées, aucune retirée).
