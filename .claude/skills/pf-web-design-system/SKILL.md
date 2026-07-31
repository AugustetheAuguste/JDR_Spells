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

## La direction visuelle est imposée, pas négociable

Le brief (B5) fixe : **plat, sans dégradé, minimal, base neutre, une seule
couleur d'accent, l'école en pastille de couleur plate, une police d'affichage
caractérisée pour les noms de sorts, une sans lisible pour le corps, la densité
plutôt que la décoration.** Mode sombre non requis.

Ce Skill exécute cette direction. Les deux seuls choix ouverts étaient **les
polices** et **la valeur exacte de l'accent** : ils sont tranchés plus bas, avec
leur raison.

### Interdit, explicitement

| À ne pas faire | Pourquoi |
|---|---|
| Dégradés (`linear-gradient`, `radial-gradient`) | contredit « plat » |
| Ombres portées décoratives | idem ; une ombre n'est admise que pour un survol de menu, jamais sur une carte ou une ligne |
| Fond crème + serif contrasté + accent terracotta | c'est le défaut générique du moment, pas un choix pour un corpus de sorts |
| Une deuxième couleur d'accent | une seule, sinon plus rien ne ressort |
| Arrondis > 6 px, coins pilule | densité, pas douceur |
| Animation d'entrée, apparition en fondu | 2070 lignes à parcourir : chaque animation est du délai |
| Un hex hors de `tokens.ts` | le jeton n'est un jeton que s'il est unique |

## Jetons de couleur

### Base neutre et encre

| Jeton | Hex | Emploi |
|---|---|---|
| `base` | `#FAFAF9` | fond de page |
| `surface` | `#FFFFFF` | fond de table, de fiche, de carte |
| `bord` | `#E4E2DE` | filets de table, séparateurs |
| `bord_fort` | `#C9C6C0` | bord d'un champ, d'un contrôle |
| `encre` | `#1C1B19` | texte principal — 16,5:1 sur `base` |
| `encre_douce` | `#57544E` | texte secondaire, libellés — 7,4:1 sur `base` |
| `encre_faible` | `#78746C` | métadonnée, mention de source — 4,8:1 sur `base` |

`encre_faible` est le plancher : **rien de plus clair ne porte de texte.** 4,8:1
passe AA de justesse, et c'est déjà le prix de la hiérarchie.

### L'accent, unique

| Jeton | Hex | Contraste |
|---|---|---|
| `accent` | `#116B4F` | 6,21:1 sur `base` ; blanc dessus 6,48:1 |
| `accent_survol` | `#0D5741` | plus sombre, jamais plus clair |
| `accent_voile` | `#E8F1ED` | fond d'une ligne sélectionnée, d'une puce active |

**Pourquoi ce vert.** Le choix n'est pas thématique, il est arithmétique : les
neuf pastilles d'école occupent déjà les teintes 14°, 41°, 48°, 115°, 186°, 220°,
259°, 266° et 322°. Le plus large intervalle libre est entre invocation (115°) et
illusion (186°) ; `#116B4F` tombe à 161°, soit **25° de la teinte d'école la plus
proche**. Un accent posé ailleurs se confondrait avec une pastille, et l'utilisateur
lirait une école là où l'interface dit « actif ». Il est de plus assez sombre pour
porter du blanc, ce qu'exige un bouton primaire.

### Les neuf pastilles d'école

Le plan en annonçait huit ; le corpus en produit **neuf** familles —
`normaliser_ecole` renvoie aussi `universel`, que le wiki écrit `Universel` et
`Universelle`. Neuf jetons, donc, sinon un sort universel n'a pas de pastille.

| École | Hex | Teinte | Contraste sur `base` |
|---|---|---|---|
| `abjuration` | `#3A5A9B` | 220° | 6,45:1 |
| `divination` | `#6B4FA8` | 259° | 6,08:1 |
| `enchantement` | `#A8377F` | 322° | 5,72:1 |
| `evocation` | `#B3421F` | 14° | 5,41:1 |
| `illusion` | `#176E77` | 186° | 5,69:1 |
| `invocation` | `#2F6B2A` | 115° | 6,17:1 |
| `necromancie` | `#3D3646` | 266° | 11,08:1 |
| `transmutation` | `#8A6412` | 41° | 5,14:1 |
| `universel` | `#5F5D55` | 48° | 6,32:1 |

Règles dures sur ces neuf valeurs :

- **Aplat, texte blanc dessus.** Chacune est assez sombre pour que du blanc y
  passe AA. Une pastille est un rectangle de 4 px de rayon, jamais un dégradé.
- **Plancher de contraste 5,14:1** sur `base` — au-dessus de AA texte (4,5:1).
  Une valeur éclaircie casse le plancher : le test de contraste de l'étape 03
  échoue, et c'est le test qui a raison.
- **La couleur n'est jamais le seul porteur.** Le nom de l'école est toujours
  écrit dans la pastille ou juste à côté : neuf teintes ne se mémorisent pas, et un
  daltonien lit `necromancie` / `divination` comme deux violets sombres.
- Les clés sont exactement les valeurs de `ECOLES_CANONIQUES`
  (`src/pf_spells/web_pliage.py`) : sans accent, en minuscules. La table du jeton
  est donc indexable directement par le code d'école de l'index.

### Sémantique

| Jeton | Hex | Emploi |
|---|---|---|
| `desaccord` | `#8A3A12` | le marqueur de désaccord de niveau, et rien d'autre |
| `desaccord_voile` | `#FBEFE6` | fond de l'encart qui détaille le désaccord |

`desaccord` n'est **pas** une couleur d'erreur : un désaccord entre la liste de
classe et la page de sort est un fait du corpus, constaté et jamais corrigé
(CLAUDE.md § 9). Le marqueur informe, il n'accuse pas — pas de rouge d'alerte, pas
d'icône d'avertissement.

## Typographie

| Rôle | Pile | Pourquoi |
|---|---|---|
| Affichage — noms de sorts, titres | `"Fraunces", "Iowan Old Style", Georgia, serif` | Fraunces est un serif variable à axe `SOFT`/`WONK`, donc caractérisé sans être décoratif ; il donne au nom d'un sort une allure d'entrée de grimoire tout en restant lisible à 15 px dans une table dense. Georgia en repli couvre tout Windows sans téléchargement. |
| Corps — description, interface | `"Inter", "Segoe UI", system-ui, sans-serif` | Inter est dessinée pour l'écran, ses chiffres et son `l`/`I` se distinguent, et son x-height élevé tient la densité demandée. |
| Données — niveaux, sigles, tableaux | `"IBM Plex Mono", ui-monospace, monospace` | les niveaux par classe s'alignent en colonne : une largeur fixe est ce qui rend la comparaison lisible d'un coup d'œil. |

Les deux polices non système sont chargées en **`woff2`, sous-ensemble latin, en
local dans `web/public/fonts/`**, avec `font-display: swap`. Pas de Google Fonts en
CDN : une requête tierce pour un site qui est par ailleurs une fonction pure du
dépôt, et le premier rendu dépendrait d'un serveur qu'on ne tient pas.

### Échelle de type

Modulaire, raison 1,2, ancrée à 16 px. Fixe : rien ne se calcule à la volée.

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

## Densité

La contrainte chiffrée : **40 lignes de résultats lisibles sur un portable**
(1366 × 768, hors barre de navigation ≈ 620 px utiles).

| Jeton | Valeur | Note |
|---|---|---|
| `ligne_h` | 32 px | 40 lignes = 1280 px : on défile, mais la ligne reste cliquable au doigt |
| `ligne_h_dense` | 28 px | variante compacte, plancher absolu |
| `gouttiere` | 12 px | entre colonnes |
| `pad_cellule` | `6px 10px` | |
| `rayon` | 4 px | partout ; 6 px maximum pour un panneau |
| `filet` | 1 px `bord` | séparation horizontale seulement — **pas de quadrillage vertical** |
| `largeur_max_texte` | 68ch | une description de sort au-delà devient illisible |

Zébrage : **non.** Un filet de 1 px suffit et le zébrage entre en conflit avec le
voile de la ligne sélectionnée.

## États

Ils ne sont pas décoratifs : ils sont la moitié de l'utilisabilité.

| État | Règle |
|---|---|
| Focus clavier | **toujours visible**, `outline: 2px solid accent; outline-offset: 2px`. Jamais `outline: none` sans remplacement — la recherche se pilote au clavier |
| Survol de ligne | fond `#F2F1EF`, sans déplacement ni ombre |
| Ligne sélectionnée | fond `accent_voile` + filet gauche 2 px `accent` |
| Actif / puce de filtre posée | aplat `accent`, texte blanc, croix de retrait |
| Désactivé | `encre_faible` sur `base`, `cursor: not-allowed`, et **la raison écrite à côté** |
| Chargement | pas de spinner sur un site statique. Si un rendu tarde, le squelette de la table s'affiche avec ses filets |

### État vide — il propose une action

Jamais « Aucun résultat » seul. Toujours : ce qui a été cherché, pourquoi c'est
vide, **et un bouton qui en sort**.

> **Aucun sort ne correspond à « firebal ».**
> Trois filtres sont posés : Barde, niveau 0–2, école Évocation.
> [Retirer les filtres] [Chercher dans toutes les classes]

### Message d'erreur — il dit quoi faire

Pas d'excuse, pas de vague, pas de code technique brut.

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

« Niveau » sans classe n'a pas de sens dans ce corpus (B4) : un sort est de niveau
2 **pour le barde**. Un libellé qui écrit « Niveau 2 » tout court est un défaut de
modélisation qui a fui jusqu'à l'écran.

## Plancher d'accessibilité

- **Responsive jusqu'au mobile.** En dessous de 640 px, la table dense devient une
  liste de cartes ; les colonnes qui tombent sont, dans cet ordre : composantes,
  portée, jet de sauvegarde. Le nom, l'école et le niveau par classe **restent**.
- **Contraste** : AA partout (4,5:1 texte, 3:1 éléments d'interface). Le test de
  l'étape 03 le vérifie sur les neuf pastilles ; il n'est pas indicatif.
- **`prefers-reduced-motion: reduce`** → toute transition à `0s`. Comme il n'y a
  presque pas d'animation, le respecter coûte une règle.
- **Cible tactile** 32 px minimum en hauteur de ligne ; les contrôles réels
  (boutons, cases) à 40 px.
- **Zoom 200 %** sans perte de contenu ni défilement horizontal.
- La couleur n'est jamais seule porteuse d'information : pastille + nom,
  désaccord + texte, filtre posé + libellé.

## Lien vers la source

B8 : le lien vers `pathfinder-fr.org` est un engagement, pas une mention légale.
Sur une fiche de sort il est **au-dessus du pli**, en `t_petit`, couleur `accent`,
souligné, libellé `Voir sur pathfinder-fr.org`. Il n'est ni en pied de page, ni en
gris clair, ni caché derrière une icône.
