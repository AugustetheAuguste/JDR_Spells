---
name: pf-web-design-system
description: Jetons visuels, typographie, densité et états de l'interface web des sorts — valeurs concrètes (hex, polices, échelle) figées ici. À charger avant d'écrire ou de modifier du CSS, un composant ou une couleur dans web/.
---

# pf-web-design-system

## Quand charger ce Skill

Dans **toute** étape qui écrit ou modifie de l'apparence dans `web/` : un
composant, une classe Tailwind, un jeton, une couleur, une police, un espacement,
un état vide, un message d'erreur.

Ce Skill **décide**, il ne suggère pas. Les valeurs ci-dessous sont figées : elles
vivent dans `web/lib/design/tokens.ts` et nulle part ailleurs. Un hex écrit en dur
dans un composant est un défaut, et un test le refuse (étape 03). Si le code et ce
Skill divergent, **le Skill gagne et le code est corrigé**.

## La direction visuelle est Grimoire — décidée par arbitrage humain, pas négociable

**2026-08-31.** Ce Skill a documenté deux systèmes le même jour : d'abord Grimoire
(parchemin, Eczar/Lora, thème jour/nuit), puis, après une passe de convergence,
un système « plat minimal » de remplacement (palette neutre proche du blanc,
accent vert, Fraunces/Inter, un seul thème) sur le jugement que Grimoire était
trop chargé. **Ce second jugement a été renversé par arbitrage humain explicite**
plus tard le même jour : Grimoire est la direction adoptée. Le renversement porte
sur la conclusion (abandonner plutôt que parer), pas sur le diagnostic (le
prototype non paré — double cadre, filet d'or, glyphe `❖`, lettrine flottante de
44px — était effectivement trop chargé). Grimoire est donc adopté **paré** : la
palette, la typographie et le thème jour/nuit survivent ; l'ornement qui lisait
comme décoratif plutôt que fonctionnel est retiré ou réduit. Détail du
renversement et de son raisonnement : `design/DECISIONS.md` D7–D8.

Le brief fixe : **aucun dégradé, le plus simple au plus chargé quand un doute se
présente, une seule couleur d'accent, l'école en pastille de couleur plate, une
police d'affichage caractérisée pour les noms de sorts, une serif de lecture pour
le corps, la densité plutôt que la décoration.** Le thème nuit n'est pas requis
par ce brief, mais n'est pas non plus en conflit avec lui : une permutation plate
de palette, choisie explicitement par le lecteur, ne coûte ni dégradé ni charge
visuelle supplémentaire, donc il est conservé plutôt que retiré par précaution.

### Interdit, explicitement

| À ne pas faire | Pourquoi |
|---|---|
| Dégradés (`linear-gradient`, `radial-gradient`) | contredit « plat », sans exception pour aucune des deux directions |
| Ombres portées décoratives | idem ; une ombre n'est admise que pour un survol de menu, jamais sur une carte ou une ligne |
| Une deuxième couleur d'accent | une seule, sinon plus rien ne ressort |
| Animation d'entrée, apparition en fondu | 2070 lignes à parcourir : chaque animation est du délai |
| Un hex hors de `tokens.ts` | le jeton n'est un jeton que s'il est unique |
| Double cadre, ombre de cadre, filet d'or décoratif, glyphe `❖` | c'est précisément ce que le diagnostic « trop chargé » visait — retiré, pas paré, parce qu'aucune fonction ne s'y accroche |
| Lettrine flottante (boîte, hauteur 44px, retrait du texte autour) | idem, réduite à la première lettre en couleur d'accent — voir § Typographie |
| Bascule de thème liée à `prefers-color-scheme` | un choix explicite mémorisé (`localStorage`) ne doit pas être écrasé par un changement de préférence système |

## Jetons de couleur

### Parchemin et encre

| Jeton | Hex jour | Hex nuit | Emploi |
|---|---|---|---|
| `base` | `#F1E7D2` | `#1E1710` | fond de page |
| `surface` | `#F8F2E6` | `#26201A` | fond de table, de fiche, de carte (vélin) |
| `bord` | `#D9CBA8` | `#33291D` | filets de table, séparateurs |
| `bord_fort` | `#927C5D` | `#81735F` | bord d'un champ, d'un contrôle — 3,25:1/3,58:1 (jour) ou 3,84:1/3,49:1 (nuit) sur base/surface, plancher 3:1 d'un contour de contrôle (WCAG 1.4.11) |
| `encre` | `#2B2013` | `#ECE1C9` | texte principal — 12,97:1 (jour) / 13,65:1 (nuit) sur `base` |
| `encre_douce` | `#5C4A30` | `#C9BCA0` | texte secondaire, libellés — 6,90:1 / 9,44:1 sur `base` |
| `encre_faible` | `#776040` | `#997F5C` | métadonnée, mention de source — 4,84:1 / 4,68:1 sur `base` |

`encre_faible` est le plancher dans les deux thèmes : **rien de plus clair (jour)
ou de plus contrasté dans l'autre sens (nuit) ne porte de texte.** Recalculé
entièrement pour le parchemin — l'ancien plancher (`#736F67`, 4,79:1 sur un fond
`#FAFAF9` quasi-blanc) n'a pas de sens sur un fond `#F1E7D2` plus sombre : la
valeur a été retarée contre le vrai fond, pas héritée.

### L'accent, unique — oxblood en jour, plus clair en nuit

| Jeton | Hex jour | Hex nuit | Contraste |
|---|---|---|---|
| `accent` | `#7E2537` | `#D16170` | 7,75:1 sur `base` jour ; 4,77:1 sur `base` nuit |
| `accent_survol` | `#5F1C29` | `#D56D7B` | jour : plus sombre. Nuit : **plus clair** |
| `accent_voile` | `#F7E9EC` | `#34141A` | fond d'une ligne sélectionnée, d'une puce active |

**Pourquoi cet oxblood.** Même contrainte arithmétique que l'ancien vert : les
neuf pastilles d'école occupent les teintes 14°, 41°, 48°, 115°, 186°, 220°,
259°, 266°, 322°. Le plus large intervalle libre encadre 348° (entre
Enchantement, 322°, et Évocation, 14°, en comptant par le zéro) ; `#7E2537`
tombe exactement là, à 26° de la plus proche. Un accent posé ailleurs se
confondrait avec une pastille.

**Pourquoi `accent_survol` change de sens selon le thème.** « Survolé » veut dire
« plus loin du fond dans la direction où l'accent s'en éloigne déjà ». Sur un
fond clair, s'éloigner veut dire foncer ; sur un fond sombre, cela veut dire
éclaircir. La règle stable n'est donc pas « toujours plus sombre » mais « jamais
vers le fond ».

**Pourquoi le texte du bouton primaire change de couleur selon le thème.** En
jour, `accent` (`#7E2537`) est assez sombre pour porter `surface` (quasi-blanc)
en texte à 8,53:1. En nuit, `accent` a dû être éclairci (`#D16170`) pour tenir
4,77:1 sur le fond sombre — et à cette clarté, du blanc dessus retombe à 2,86:1,
sous AA. Le bouton primaire nuit porte donc `encre` nuit (texte sombre) sur
`accent` nuit (fond clair) : même règle (le texte doit tenir AA sur son fond),
appliquée à une paire de luminances qui s'est inversée.

### Les neuf pastilles d'école

Le plan en annonçait huit ; le corpus en produit **neuf** familles —
`normaliser_ecole` renvoie aussi `universel`, que le wiki écrit `Universel` et
`Universelle`. Neuf jetons, donc, sinon un sort universel n'a pas de pastille.

| École | Hex | Teinte | Contraste sur `base` (jour) |
|---|---|---|---|
| `abjuration` | `#3A5A9B` | 220° | 5,49:1 |
| `divination` | `#6B4FA8` | 259° | 5,17:1 |
| `enchantement` | `#A8377F` | 322° | 4,86:1 |
| `evocation` | `#A53D1D` | 14° | 5,21:1 |
| `illusion` | `#176E77` | 186° | 4,84:1 |
| `invocation` | `#2F6B2A` | 115° | 5,25:1 |
| `necromancie` | `#3D3646` | 266° | 9,42:1 |
| `transmutation` | `#866213` | 41° | 4,54:1 — le plancher |
| `universel` | `#5F5D55` | 48° | 5,37:1 |

Ces neuf valeurs ont été **recalculées contre le nouveau `base` parchemin**, pas
héritées de la palette précédente. Sept sur neuf n'ont pas eu besoin de changer ;
`evocation` (`#B3421F` → `#A53D1D`) et `transmutation` (`#8A6412` → `#866213`)
ont dû être assombries : le fond `base` a perdu ~0,14 de luminance relative en
passant au parchemin (0,94 → 0,805), et ces deux teintes, qui passaient AA de
justesse sur l'ancien fond, tombaient sous 4,5:1 sur le nouveau — `transmutation`
à 4,37:1, `evocation` à 4,60:1. Recalculer *toute* la table plutôt que supposer
que seules les deux teintes visiblement proches du problème avaient besoin d'une
retouche est ce qui a permis de trouver ces deux-là avec certitude, pas à l'œil.

Les neuf teintes **ne changent pas de thème** : elles sont un carré de couleur,
jamais du texte, donc le contraste qui compte est celui du libellé (`encre` sur
`base`) à côté, qui lui suit le thème.

Règles dures, inchangées :

- **Aplat, jamais un dégradé, jamais de texte directement dessus.** Le libellé de
  l'école n'est pas écrit en couleur claire sur le rectangle : sur certaines
  écoles, du blanc y tomberait sous AA. Le rectangle porte seulement la couleur,
  `aria-hidden`, et le libellé s'écrit à côté en `encre` sur `base` — c'est ce que
  fait `PastilleEcole.tsx`, à reproduire tel quel plutôt que réinventé. Le carré
  fait 12 px de côté, rayon 0 (Grimoire n'arrondit rien, § Densité).
- **Plancher de contraste 4,53:1** sur `base` jour (transmutation, mesuré à
  4,5359:1 — le Skill annonce 4,53 et non 4,54 pour que l'arrondi ne fasse pas
  échouer la garde contre la valeur même qu'elle décrit). Au-dessus de AA texte
  (4,5:1), avec une marge délibérément fine : ces neuf teintes sont déjà
  contraintes par la séparation de teinte entre elles et par la séparation de
  teinte avec l'accent, donc la marge de contraste est ce qui reste une fois ces
  deux contraintes satisfaites.
- **La couleur n'est jamais le seul porteur.** Le nom de l'école est toujours
  écrit dans la pastille ou juste à côté.
- Les clés sont exactement les valeurs de `ECOLES_CANONIQUES`
  (`src/pf_spells/web_pliage.py`) : sans accent, en minuscules.

### Sémantique

| Jeton | Hex jour | Hex nuit | Emploi |
|---|---|---|---|
| `desaccord` | `#82451C` | `#C46C31` | le marqueur de désaccord de niveau, et rien d'autre |
| `desaccord_voile` | `#F8EEE7` | `#1F150F` | fond de l'encart qui détaille le désaccord |

`desaccord` n'est **pas** une couleur d'erreur : un désaccord entre la liste de
classe et la page de sort est un fait du corpus, constaté et jamais corrigé
(CLAUDE.md § 9). Le marqueur informe, il n'accuse pas — pas de rouge d'alerte, pas
d'icône d'avertissement. En nuit, `desaccord_voile` (`#1F150F`) est délibérément
plus sombre que la teinte de parchemin nocturne « évidente » (`#302117`, la même
que les autres voiles) : à cette clarté-là, `#302117` ne tenait que 4,08:1 contre
le `desaccord` nuit éclairci — sous AA — alors que `#1F150F` tient 4,72:1. Un
voile qui « ressemble » aux autres voiles nocturnes mais ne tient pas AA contre
sa propre teinte au premier plan est le même mode de défaillance qu'un ton
choisi à l'œil plutôt que calculé.

## Typographie

| Rôle | Pile | Pourquoi |
|---|---|---|
| Affichage — noms de sorts, titres | `"Eczar", "Iowan Old Style", Georgia, serif` | Eczar est une serif à empattements marqués, dessinée pour le devanagari puis étendue au latin — elle porte l'identité « grimoire » sans dérive décorative, et reste lisible à 20 px dans un titre de section. Georgia en repli couvre tout Windows sans téléchargement. |
| Corps — description, interface | `"Lora", "Iowan Old Style", Georgia, serif` | Lora est une serif de lecture, dessinée pour l'écran ; son italique (utilisée pour les mentions de source et de citation) est une vraie fonte italique, pas une oblique synthétique. |
| Données — niveaux, sigles, tableaux | `"IBM Plex Mono", ui-monospace, monospace` | inchangée : les niveaux par classe s'alignent en colonne, une largeur fixe est ce qui rend la comparaison lisible d'un coup d'œil, et rien dans ce rôle n'est propre à une direction visuelle plutôt qu'à l'autre. |

Toutes les polices non système sont chargées en **`woff2`, sous-ensemble latin,
en local dans `web/public/fonts/`**, avec `font-display: swap`. Pas de Google
Fonts en CDN. Poids et licences exacts : `web/public/fonts/LICENCES.md`.

### Échelle de type — inchangée

Modulaire, raison 1,2, ancrée à 16 px. Fixe : rien ne se calcule à la volée. La
densité et l'échelle ne sont pas des choix d'identité visuelle — elles sont
restées identiques à travers les deux systèmes que ce dépôt a portés le même
jour, parce qu'aucun des deux garde-fous (dégradé, minimalisme) ne les concerne.

| Jeton | Taille / interligne | Graisse | Emploi |
|---|---|---|---|
| `t_micro` | 11 px / 16 px | 500 | sigle de composante, mention de source |
| `t_petit` | 12,5 px / 18 px | 400 | métadonnée, aide sous un champ |
| `t_base` | 14,5 px / 22 px | 400 | corps, cellule de table |
| `t_grand` | 17 px / 24 px | 400 | chapô, texte d'introduction |
| `t_titre3` | 20 px / 26 px | 600 | titre de section d'une fiche |
| `t_titre2` | 25 px / 30 px | 600 | nom de sort dans une liste dense |
| `t_titre1` | 34 px / 38 px | 600 | nom de sort sur sa fiche |

Corps à 14,5 px et non 16 px : c'est le compromis explicite de la densité. En
dessous de 14 px, on ne descend pas.

### La lettrine — parée, pas retirée

Le prototype Grimoire portait une lettrine flottante de 44px, en retrait du
texte environnant : l'ornement le plus « chargé » identifié dans l'audit. Elle
n'est pas supprimée, elle est réduite : la classe `.lettrine` (posée sur le `h1`
du nom de sort, sur la fiche) colore la première lettre en `accent` via
`::first-letter`, dans le même bloc, sans boîte, sans flottant, sans hauteur
distincte. Un lecteur perçoit une touche de couleur sur l'initiale, pas une
miniature enluminée — c'est la différence entre un ornement fonctionnel (une
identité visuelle qui coûte une règle CSS) et un ornement décoratif (une mise en
page qui coûte une exception au flux du texte).

## Densité

La contrainte chiffrée : **40 lignes de résultats lisibles sur un portable**
(1366 × 768, hors barre de navigation ≈ 620 px utiles). Inchangée.

| Jeton | Valeur | Note |
|---|---|---|
| `ligne_h` | 32 px | 40 lignes = 1280 px : on défile, mais la ligne reste cliquable au doigt |
| `ligne_h_dense` | 28 px | variante compacte, plancher absolu |
| `gouttiere` | 12 px | entre colonnes |
| `pad_cellule` | `6px 10px` | |
| `rayon` | **0 px** | partout — Grimoire n'arrondit rien ; une page de parchemin se lit comme du papier découpé, pas comme un chrome d'application |
| `filet` | 1 px `bord` | séparation horizontale seulement — **pas de quadrillage vertical** |
| `largeur_max_texte` | 68ch | une description de sort au-delà devient illisible |

`rayon: 0px` est le seul jeton où l'identité Grimoire et le garde-fou minimalisme
tombent d'accord sans arbitrage : angles droits, c'est à la fois du parchemin et
la valeur la plus simple possible pour un rayon.

Zébrage : **non.**

## États

| État | Règle |
|---|---|
| Focus clavier | **toujours visible**, `outline: 2px solid accent; outline-offset: 2px`. Jamais `outline: none` sans remplacement |
| Survol de ligne | fond `survol`, sans déplacement ni ombre |
| Ligne sélectionnée | fond `accent_voile` + filet gauche 2 px `accent` |
| Actif / puce de filtre posée | aplat `accent`, texte porté selon le thème (§ L'accent, unique), croix de retrait |
| Désactivé | `encre_faible` sur `base`, `cursor: not-allowed`, et **la raison écrite à côté** |
| Chargement | pas de spinner sur un site statique. Si un rendu tarde, le squelette de la table s'affiche avec ses filets |
| Bascule jour/nuit | bouton explicite, mémorisé dans `localStorage`, appliqué via `data-theme="nuit"` sur `<html>` par un script inline **avant peinture** (`app/layout.tsx`) — jamais `prefers-color-scheme` |

### État vide — il propose une action

> **Aucun sort ne correspond à « firebal ».**
> Trois filtres sont posés : Barde, niveau 0–2, école Évocation.
> [Retirer les filtres] [Chercher dans toutes les classes]

### Message d'erreur — il dit quoi faire

> **L'index des sorts n'a pas pu être chargé.**
> La page a besoin de `data/index.json`. Rechargez ; si l'erreur persiste, elle
> est dans le déploiement, pas dans votre navigateur.
> [Recharger]

## Vocabulaire d'interface

Un mot, un sens, d'un bout à l'autre. Ces libellés sont figés :

| On écrit | Jamais |
|---|---|
| **sort** | sortilège, spell |
| **niveau** (toujours relatif à une classe) | rang, tier |
| **classe** | profession |
| **école** | type, catégorie |
| **jet de sauvegarde** | JdS, save |
| **résistance à la magie** | RM (hors table dense), SR |
| **désaccord de niveau** | erreur, conflit, incohérence |
| **favoris** | signets, marque-pages, épinglés |
| **filtre posé** | filtre actif, filtre appliqué |
| **source : pathfinder-fr.org** | crédits, à propos |
| **Thème jour** / **Thème nuit** | mode sombre, dark mode, mode clair |

« Niveau » sans classe n'a pas de sens dans ce corpus (B4) : un sort est de niveau
2 **pour le barde**. Un libellé qui écrit « Niveau 2 » tout court est un défaut de
modélisation qui a fui jusqu'à l'écran.

## Plancher d'accessibilité

- **Responsive jusqu'au mobile.** En dessous de 640 px, la table dense devient une
  liste de cartes ; les colonnes qui tombent sont, dans cet ordre : composantes,
  portée, jet de sauvegarde. Le nom, l'école et le niveau par classe **restent**.
- **Contraste** : AA partout (4,5:1 texte, 3:1 éléments d'interface), **dans les
  deux thèmes**. Le test de l'étape 03 le vérifie sur les neuf pastilles et sur la
  palette nuit ; il n'est pas indicatif.
- **`prefers-reduced-motion: reduce`** → toute transition à `0s`.
- **Cible tactile** 32 px minimum en hauteur de ligne ; les contrôles réels
  (boutons, cases) à 40 px.
- **Zoom 200 %** sans perte de contenu ni défilement horizontal.
- La couleur n'est jamais seule porteuse d'information.
- **La nuit est un choix, jamais une déduction** : posée par un script inline qui
  lit `localStorage` avant peinture, jamais par `prefers-color-scheme` — un OS qui
  change de préférence sous le lecteur ne doit pas écraser le choix qu'il a fait
  la dernière fois qu'il a ouvert le site.

**Point non résolu.** `RAMPE_CATEGORIELLE` (le nuancier à huit teintes du
graphique d'exploration, `/explorer`) a été revérifiée contre le nouveau `base`
jour et tient (plancher 3,86:1) mais pas contre `COULEURS_NUIT.base`, où
plusieurs teintes tombent sous 3:1. `/explorer` ne lit pas encore `data-theme`,
donc ce n'est pas un défaut visible aujourd'hui — mais quiconque branche ce
composant sur la palette nuit doit revérifier le nuancier avant de le faire.

## Lien vers la source

B8 : le lien vers `pathfinder-fr.org` est un engagement, pas une mention légale.
Sur une fiche de sort il est **au-dessus du pli**, en `t_petit`, couleur `accent`,
souligné, libellé `Voir sur pathfinder-fr.org`. Il n'est ni en pied de page, ni en
gris clair, ni caché derrière une icône.
