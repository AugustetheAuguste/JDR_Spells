# Grimoire — design system (vérité actuelle, 2026-08-31)

Document unique et **normatif**. Destinataire : toute session qui écrit ou modifie de l'apparence
dans `web/`, dépôt `AugustetheAuguste/JDR_Spells`.

Ce document décrit **le système déjà construit** dans `web/lib/design/tokens.ts` et
`web/styles/theme.css`, tel qu'il est vérifié par `web/lib/design/tokens.test.ts`. C'est **Grimoire**
— parchemin, Eczar/Lora, thème jour/nuit, lettrine et cadre parés au minimum : la direction que la
passe précédente (2026-08-31, plus tôt le même jour) avait abandonnée au profit d'un système
« plat minimal » distinct, sur jugement que Grimoire était trop chargé pour le garde-fou
« préférer le simple au chargé ». Ce jugement a été **renversé par arbitrage humain explicite** :
Grimoire est la direction adoptée, à condition d'être elle-même parée pour tenir les deux
garde-fous — aucun dégradé, et le moins chargé possible sans perdre l'identité. Voir
`design/DECISIONS.md` D7 pour le renversement et D8 pour la recomputation des jetons qui en découle.
Si ce document et la Skill `pf-web-design-system` divergent un jour, **la Skill gagne** (CLAUDE.md
§ 5) ; ce document en est la vue d'ensemble narrative, pas une deuxième source de vérité.

---

## 0. Direction

Parchemin, encre chaude, un seul accent oxblood, l'école en pastille de couleur plate + libellé,
une police d'affichage à empattements marqués pour les noms de sorts, une serif de lecture pour le
corps, la densité plutôt que la décoration. **Deux thèmes — jour (défaut) et nuit — permutation
plate, choix explicite du lecteur, jamais lié à `prefers-color-scheme`.**

Interdit, explicitement : dégradés, ombres décoratives, une deuxième couleur d'accent, une
animation d'entrée, un hex écrit hors de `tokens.ts`, un double cadre, un glyphe ornemental, une
lettrine flottante de 44px, une bascule de thème asservie à la préférence système.

Conservé de l'identité Grimoire, paré pour le minimalisme : la palette parchemin et son pendant
nuit, Eczar/Lora, une lettrine réduite à la première lettre en couleur d'accent (pas de boîte, pas
de retrait de texte), des angles droits (`rayon: 0`, qui se lit comme du papier et non comme un
chrome d'application — l'identité et le minimalisme s'accordent ici sans compromis).

## 1. Parchemin et encre

| Jeton | Hex (jour) | Hex (nuit) | Emploi | Contraste jour sur `base` |
|---|---|---|---|---|
| `base` | `#F1E7D2` | `#1E1710` | fond de page | — |
| `surface` | `#F8F2E6` | `#26201A` | fond de table, de fiche, de carte (vélin) | — |
| `bord` | `#D9CBA8` | `#33291D` | filets de table, séparateurs (décoratif, hors plancher 3:1) | — |
| `bord_fort` | `#927C5D` | `#81735F` | bord d'un champ, d'un contrôle réel | 3,25:1 / 3,58:1 sur `surface` (jour) ; 3,84:1 / 3,49:1 (nuit) — plancher UI 3:1 (WCAG 1.4.11) |
| `encre` | `#2B2013` | `#ECE1C9` | texte principal | 12,97:1 (jour), 13,65:1 (nuit) |
| `encre_douce` | `#5C4A30` | `#C9BCA0` | texte secondaire, libellés | 6,90:1 (jour), 9,44:1 (nuit) |
| `encre_faible` | `#776040` | `#997F5C` | métadonnée, mention de source — **le plancher**, rien de plus clair ne porte de texte | 4,84:1 (jour), 4,68:1 (nuit) |
| `survol` | `#EDE2CC` | `#2A2318` | fond de ligne survolée | — |

`bord_fort` a de nouveau changé de valeur, pour une raison différente de celle de la passe
précédente (D2, `#C9C6C0` → `#8F8B82`, sous-plancher) : la parchemin `base` est plus sombre que
l'ancien fond quasi-blanc (`#FAFAF9`, luminance 0,94 → `#F1E7D2`, luminance 0,805), donc toute valeur
tarée sur l'ancien fond retombe sous 3:1 sur le nouveau. `#927C5D` a été recalculé directement contre
`#F1E7D2`, pas hérité de v1. Voir `design/DECISIONS.md` D8.

## 2. L'accent, unique

| Jeton | Hex (jour) | Hex (nuit) | Contraste |
|---|---|---|---|
| `accent` | `#7E2537` | `#D16170` | 7,75:1 sur `base` jour ; 4,77:1 sur `base` nuit |
| `accent_survol` | `#5F1C29` | `#D56D7B` | jour : plus sombre ; nuit : **plus clair** — la direction s'inverse, § 7 |
| `accent_voile` | `#F7E9EC` | `#34141A` | fond d'une ligne sélectionnée, d'une puce active |

Oxblood/vin, teinte 348°, à 26° de la teinte d'école la plus proche (Enchantement, 322°, et
Évocation, 14° — la distance se mesure dans les deux sens autour du cercle). C'est le remplaçant
direct du vert unique de l'ancien système : la même contrainte arithmétique (rester loin de toute
teinte d'école), une couleur différente parce que la palette de fond a changé du tout au tout.

**Le texte porté par le bouton primaire change de couleur selon le thème.** En jour, `accent` est
assez sombre pour porter `surface` (quasi-blanc) en texte, à 8,53:1. En nuit, `accent` a dû être
éclairci pour tenir 4,77:1 sur le fond sombre, et à cette clarté le blanc dessus tombe à 2,86:1 —
sous AA. Le bouton primaire nuit porte donc `encre` nuit (texte sombre) sur `accent` nuit (fond
clair), à 4,77:1. Ce n'est pas une incohérence : c'est la même règle — le texte du bouton doit tenir
AA sur son fond — appliquée aux deux directions de contraste que jour et nuit imposent chacun.

## 3. Les neuf pastilles d'école

Neuf, pas huit : `normaliser_ecole` renvoie aussi `universel`. Recalculées contre le nouveau `base`
(recalcul complet, pas seulement les deux qui ont changé) :

| École | Hex | Teinte | Contraste sur `base` jour |
|---|---|---|---|
| `abjuration` | `#3A5A9B` | 220° | 5,49:1 |
| `divination` | `#6B4FA8` | 259° | 5,17:1 |
| `enchantement` | `#A8377F` | 322° | 4,86:1 |
| `evocation` | `#A53D1D` | 14° | 5,21:1 — **assombrie** (était `#B3421F`, 4,60:1 sur l'ancien fond, insuffisant sur le parchemin) |
| `illusion` | `#176E77` | 186° | 4,84:1 |
| `invocation` | `#2F6B2A` | 115° | 5,25:1 |
| `necromancie` | `#3D3646` | 266° | 9,42:1 |
| `transmutation` | `#866213` | 41° | 4,54:1 — le plancher, **assombrie** (était `#8A6412`, 4,37:1 sur le parchemin, sous AA) |
| `universel` | `#5F5D55` | 48° | 5,37:1 |

Sept des neuf tiennent leur ancienne valeur ; `evocation` et `transmutation` ont dû être
assombries parce que le fond `base` a perdu ~0,14 de luminance relative (0,94 → 0,805) en passant
au parchemin, et deux écoles qui passaient AA de justesse sur l'ancien fond n'y passaient plus sur
le nouveau. Les sept autres avaient assez de marge pour absorber le même changement de fond sans
retouche. Recalculé indépendamment, pas seulement re-testé — voir `design/DECISIONS.md` D8.

**Rendu inchangé : un carré de couleur (12 px, rayon 0), `aria-hidden`, suivi du libellé en `encre`.**
Le carré n'est jamais un losange, jamais un texte blanc directement dessus : sur certaines écoles
le blanc tombe sous AA. `PastilleEcole.tsx` implémente ce rendu, en nuit comme en jour — les neuf
teintes ne changent pas de thème, seul l'`encre` du libellé change (le carré est une aire de couleur
posée sur `surface`, jamais du texte, donc le contraste carré-contre-fond n'est pas le contraste qui
compte ; c'est celui du libellé, en `encre`, qui l'est, et `encre` tient AA sur `base` dans les deux
thèmes).

## 4. Désaccord de niveau — informer, pas accuser

| Jeton | Hex (jour) | Hex (nuit) |
|---|---|---|
| `desaccord` | `#82451C` | `#C46C31` |
| `desaccord_voile` | `#F8EEE7` | `#1F150F` |

`desaccord` (6,07:1 sur `base` jour ; 4,67:1 sur `base` nuit) détaille un désaccord entre la liste de
classe et la page de sort — un fait du corpus, constaté et jamais corrigé (CLAUDE.md § 9). Pas de
rouge d'alerte, pas d'icône d'avertissement, pas de couleur seule : `MarqueurDesaccord.tsx` écrit le
texte complet des deux valeurs en désaccord. `desaccord` tient AA sur son propre voile dans les deux
thèmes (6,52:1 jour ; 4,72:1 nuit) — la valeur nuit du voile (`#1F150F`) est délibérément plus sombre
que le choix « évident » (`#302117`, la même teinte de parchemin sombre que les autres voiles
nocturnes), parce que `#302117` ne tenait que 4,08:1 contre le `desaccord` nuit éclairci.

## 5. Typographie

| Rôle | Pile |
|---|---|
| Affichage — noms de sorts, titres | `"Eczar", "Iowan Old Style", Georgia, serif` |
| Corps — description, interface | `"Lora", "Iowan Old Style", Georgia, serif` |
| Données — niveaux, sigles, tableaux | `"IBM Plex Mono", ui-monospace, monospace` |

Eczar et Lora sont l'identité visuelle de Grimoire — la seule partie du système que le garde-fou
« pas de dégradé » ne pouvait pas s'appliquer à (une police n'est pas un dégradé), et que le
garde-fou « minimal » n'exigeait pas de changer : rien dans une paire de polices n'est un ornement à
retirer. IBM Plex Mono reste la police de données, inchangée depuis l'ancien système — elle n'est
pas propre à une direction visuelle, seulement à la nécessité d'aligner des chiffres en colonne.

woff2, sous-ensemble latin, servi depuis `web/public/fonts/`, `font-display: swap`. Aucun CDN.
Licences et poids exacts dans `web/public/fonts/LICENCES.md`.

### Échelle — modulaire, raison 1,2, ancrée à 16 px

Inchangée depuis l'ancien système : la densité et l'échelle typographique ne sont pas des choix
d'identité Grimoire, elles sont indépendantes de la palette et de la police.

| Jeton | Taille / interligne | Graisse | Emploi |
|---|---|---|---|
| `t_micro` | 11 px / 16 px | 500 | sigle de composante, mention de source |
| `t_petit` | 12,5 px / 18 px | 400 | métadonnée, aide sous un champ |
| `t_base` (`corps`) | 14,5 px / 22 px | 400 | corps, cellule de table |
| `t_grand` | 17 px / 24 px | 400 | chapô |
| `t_titre3` | 20 px / 26 px | 600 | titre de section |
| `t_titre2` | 25 px / 30 px | 600 | nom de sort en liste dense |
| `t_titre1` | 34 px / 38 px | 600 | nom de sort sur sa fiche |

Plancher : 14,5 px. Le corps n'est pas à 16 px : c'est le prix explicite de la densité.

### Lettrine — parée, pas retirée

Le prototype portait une lettrine flottante de 44px, en retrait du texte qui l'entoure — l'ornement
le plus « chargé » du système. Elle survit sous une forme minimale : la première lettre du nom de
sort, sur sa fiche, en couleur `accent`, dans le même bloc de texte (`::first-letter`, classe
`.lettrine`). Pas de boîte, pas de flottant, pas de retrait de texte, pas de hauteur distincte : le
lecteur perçoit une touche de couleur sur l'initiale, pas une miniature enluminée.

## 6. Densité et géométrie

| Jeton | Valeur |
|---|---|
| `ligne_h` | 32 px (40 lignes lisibles sur un portable 1366×768) |
| `ligne_h_dense` | 28 px — plancher absolu |
| `gouttiere` | 12 px |
| `pad_cellule` | `6px 10px` |
| `rayon` (jeton) | **0 px** |
| `rayon_panneau` | **0 px** |
| `filet` | 1 px `bord` — horizontal seulement, pas de quadrillage vertical |
| `largeur_max_texte` | 68ch |

Angles droits partout : le prototype Grimoire les portait déjà (`rayon: 0`), pour une raison
esthétique (le parchemin se lit comme du papier découpé, pas comme un chrome d'application arrondi).
C'est aussi, sans l'avoir cherché, la valeur la plus minimale possible pour un rayon — les deux
garde-fous s'accordent ici sans arbitrage.

Zébrage : non. Un filet de 1 px suffit et n'entre pas en conflit avec le voile de la ligne
sélectionnée.

## 7. États

| État | Règle |
|---|---|
| Focus clavier | toujours visible : `outline: 2px solid accent; outline-offset: 2px` — jamais désactivé sans remplacement |
| Survol de ligne | fond `survol`, sans déplacement ni ombre |
| Ligne sélectionnée | fond `accent_voile` + filet gauche 2 px `accent` |
| Actif / puce de filtre posée | aplat `accent`, texte porté selon le thème (`surface` en jour, `encre` en nuit — § 2), croix de retrait |
| Désactivé | `encre_faible` sur `base`, `cursor: not-allowed`, raison écrite à côté |
| Chargement | pas de spinner ; squelette de table avec ses filets si le rendu tarde |
| `prefers-reduced-motion: reduce` | toute transition à `0s` |
| Bascule jour/nuit | bouton explicite, jamais lié à `prefers-color-scheme` — un OS qui change de préférence sous le lecteur ne doit pas écraser son choix mémorisé |

**Pourquoi `accent_survol` s'inverse entre les thèmes.** En jour, « survolé » veut dire « plus
sombre, jamais plus clair » (le fond est clair, s'éloigner de lui c'est foncer). En nuit, le fond est
sombre : s'en éloigner, c'est éclaircir. La règle stable n'est pas « toujours plus sombre », c'est
« toujours plus loin du fond dans la même direction que l'accent l'est déjà » — et cette direction
s'inverse avec le thème, mécaniquement.

### État vide — propose une action

> **Aucun sort ne correspond à « firebal ».** Trois filtres sont posés : Barde, niveau 0–2, école
> Évocation. [Retirer les filtres] [Chercher dans toutes les classes]

### Message d'erreur — dit quoi faire

> **L'index des sorts n'a pas pu être chargé.** La page a besoin de `data/index.json`. Rechargez ;
> si l'erreur persiste, elle est dans le déploiement, pas dans votre navigateur. [Recharger]

## 8. Vocabulaire d'interface — figé

`sort` · `niveau` (toujours relatif à une classe) · `classe` · `école` · `jet de sauvegarde` ·
`résistance à la magie` · `désaccord de niveau` · `favoris` · `filtre posé` ·
`source : pathfinder-fr.org` · `Thème jour` · `Thème nuit`. Jamais : sortilège, spell, rang, tier,
profession, type, catégorie, JdS, save, RM, SR, erreur, conflit, incohérence, signets,
marque-pages, mode sombre, dark mode.

## 9. Plancher d'accessibilité

- Responsive jusqu'au mobile ; rupture à définir par composant (colonnes qui tombent en premier :
  composantes, portée, jet de sauvegarde — nom, école et niveau par classe restent toujours).
- Contraste AA partout (4,5:1 texte, 3:1 éléments d'interface), **dans les deux thèmes** — vérifié
  par calcul dans `tokens.test.ts`, pas à l'œil.
- `prefers-reduced-motion: reduce` respecté.
- Cible tactile 32 px minimum en hauteur de ligne, 40 px pour un contrôle réel.
- Zoom 200 % sans perte de contenu ni défilement horizontal.
- La couleur n'est jamais seule porteuse d'information.
- La nuit est un choix, pas une déduction : `data-theme="nuit"` posé par un script inline avant
  peinture (lu depuis `localStorage`), jamais par `prefers-color-scheme`.

**Point non résolu, noté plutôt que masqué** : `RAMPE_CATEGORIELLE` (le nuancier du graphique
d'exploration, `/explorer`) a été revérifiée contre le nouveau `base` jour (plancher 3,86:1, tient) mais
**pas** contre `COULEURS_NUIT.base` — plusieurs teintes y tombent sous 3:1 (jusqu'à 2,33:1). La route
`/explorer` ne lit pas encore `data-theme`, donc rien n'est cassé en pratique aujourd'hui, mais le
nuancier n'est pas prêt pour la nuit tel quel. Voir `design/FOLLOWUPS.md`.

## 10. Lien vers la source

Le lien vers `pathfinder-fr.org` est un engagement, pas une mention légale : au-dessus du pli sur
une fiche de sort, `t_petit`, couleur `accent`, souligné, libellé « Voir sur pathfinder-fr.org ».
Jamais en pied de page seul, jamais en gris clair, jamais caché derrière une icône.

## 11. Historique

- **Grimoire, jour/nuit paré (cette version, 2026-08-31, tard)** — parchemin, encre chaude, un
  accent oxblood, Eczar/Lora, angles droits, lettrine réduite à la première lettre, aucun dégradé,
  aucun double cadre, aucun glyphe ornemental. Construite dans `web/`, testée par `tokens.test.ts`
  (650 tests). Adoptée par arbitrage humain explicite, superseding l'abandon plus tôt le même jour.
- **v1 « flat minimal » (2026-08-31, plus tôt le même jour, retirée)** — palette neutre proche du
  blanc, accent vert unique, Fraunces/Inter/IBM Plex Mono, aucun thème nuit. Avait elle-même
  remplacé Grimoire sur jugement que Grimoire était trop chargé ; ce jugement est renversé ici. Rien
  de v1 ne survit dans `web/` au-delà de la structure DOM des composants et de la police de données
  (IBM Plex Mono, neutre par rapport aux deux directions). Détail complet dans
  `design/DECISIONS.md` D7.
- **Grimoire, prototype non paré (2026, jamais construit dans `web/`)** — la version documentée
  avant la première passe de convergence : double cadre décoratif, ombre portée, filet d'or 3px,
  glyphe `❖`, lettrine flottante de 44px. C'est cette version, pas la version parée, qui avait été
  jugée trop chargée — un jugement qui reste valide sur le prototype tel qu'il était, seulement
  renversé sur la conclusion qu'il fallait l'abandonner plutôt que le parer.

## 12. Vitrines — implémentations de référence

`design/vitrines/` accompagne ce document : cinq pages HTML statiques qui appliquent Grimoire (paré,
jour/nuit), plus le fichier de jetons.

| fichier | montre | route visée |
|---|---|---|
| `tokens.css` | tous les jetons, jour et nuit, à porter dans `theme.css` / `tokens.ts` (déjà fait) | — |
| `liste.html` | filtres, tableau dense, pastilles d'école, bascule de thème | `/` |
| `fiche.html` | bloc technique, niveaux par classe, marqueur de désaccord, lettrine minimale | `/sorts/[slug]` |
| `comparaison.html` | une colonne par classe, absence marquée « — » | `/comparaison` |
| `favoris.html` | tableau de la liste + état vide | `/favoris` |
| `jetons.html` | banc d'essai : surfaces, 9 écoles, échelle, états, les deux thèmes | référence de contrôle |

Elles sont normatives pour le rendu, indicatives pour le code : la structure DOM et les noms de
classes sont à retraduire en composants React/Tailwind (déjà fait dans `web/` pour l'essentiel — ces
vitrines documentent ce qui existe, elles ne l'anticipent plus). Aucun hex n'est écrit dans les
pages : si une valeur manque dans `tokens.css`, c'est le jeton qui manque. Elles chargent Eczar et
Lora depuis Google Fonts pour être lisibles hors dépôt ; le produit les sert depuis `public/fonts/`.
Chaque page porte sa propre bascule jour/nuit (`onclick` inline, pas de dépendance JS externe) —
suffisant pour une vitrine statique, alors que le produit utilise un script avant peinture pour
éviter le flash de thème (`app/layout.tsx`).
