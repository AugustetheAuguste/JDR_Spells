# 13 — Constats, la vue de comparaison

## A — « Afficher »

`web/components/comparaison/VueComparaison.tsx:257-275` (avant retouche). Le code
utilisait un `<div>` avec un `<span>Afficher :</span>` devant les trois boutons de
mode, aucune sémantique de groupe. Corrigé en `<fieldset>` avec `<legend>Afficher</legend>`,
legend visible (pas de `sr-only`).

Gain d'accessibilité, pas seulement typographique : un lecteur d'écran annonce
désormais « Afficher, groupe » puis chaque bouton, ce que le `<span>` ne faisait
pas. Le test `groupe les boutons d'affichage sous un nom accessible « Afficher »,
sans deux-points` (`comparaison.test.tsx`) vérifie le rôle `group` nommé
« Afficher » et l'absence du texte `Afficher :`.

## B — les paires libellé-valeur

| Avant | Après | Fichier |
|---|---|---|
| `` `index.json : ${reponse.status}` `` | `` `index.json a répondu ${reponse.status}` `` | `VueComparaison.tsx` |
| « … Il en faut une seconde : une comparaison a besoin de deux listes. » | « … Il en faut une seconde, une comparaison a besoin de deux listes. » | `VueComparaison.tsx` |
| « Aucun : toutes les autres classes comparées reçoivent aussi ces sorts. » | « Aucun. Toutes les autres classes comparées reçoivent aussi ces sorts. » | `VueComparaison.tsx` |
| `Afficher :` (span) | `Afficher` (legend de fieldset) | `VueComparaison.tsx` |
| `` `${titre} — cliquez pour trier.` `` (title, cadratin) | `` `${titre}. Cliquez pour trier.` `` | `TableComparaison.tsx` |
| « Une seule des classes comparées reçoit ce sort : il n'y a pas d'écart à mesurer. » (title) | « Une seule des classes comparées reçoit ce sort. Il n'y a pas d'écart à mesurer. » | `TableComparaison.tsx` |
| « niveau(x) d'écart » (pluriel entre parenthèses) | `${ecart === 1 ? 'niveau' : 'niveaux'}` (nombre toujours connu, ecart ≥ 1 sur ce badge) | `TableComparaison.tsx` |
| « … et les recoupements partiels se multiplient : elle cesse d'être lisible. » | « … et les recoupements partiels se multiplient, elle cesse d'être lisible. » | `SelecteurClasses.tsx` |
| « Trois classes au plus ; décochez-en une pour changer. » (point-virgule) | « Trois classes au plus. Décochez-en une pour changer. » | `SelecteurClasses.tsx` |

Aucune conversion en `<dl>` ou `<table>` n'a été nécessaire dans ce périmètre : les
occurrences trouvées sont soit un titre de groupe (A), soit des messages d'aide ou
de titre `title`/`aria` en prose courante, pas de véritable paire étiquette/valeur
répétée qui appelle une liste de définitions. La table de comparaison elle-même est
déjà une `<table>` — c'est la bonne structure, pas une chaîne recousue.

Les tirets cadratins de marqueur de donnée absente (`—` dans les cellules « pas de
niveau », « pas d'écart ») **restent**, conformément à l'exception unique de la
charte.

## C — la couleur seule

| Distinction | Porteur non chromatique |
|---|---|
| Présent pour une classe / absent pour une classe (colonnes de niveau) | Le nombre du niveau lui-même, ou un tiret cadratin `—` avec son `title` explicite (`"<classe> ne reçoit pas ce sort"`) — jamais un fond coloré seul |
| Écart de niveau entre classes | Un badge texte `+N`, `N` étant le nombre réel, avec un `title` en toutes lettres (`N niveau(x) d'écart`, corrigé au pluriel exact) ; la couleur d'accent du badge est un renfort, pas le seul signal |
| Aucun écart (même niveau partout) | Le chiffre `0` littéral, en `text-encre-faible`, avec `title="Même niveau partout"` |
| Mode d'affichage actif (Partagés / Exclusifs / Tout) | `aria-pressed` + `font-semibold` + le texte du libellé lui-même, jamais seulement `border-accent` |
| École d'un sort | `PastilleEcole`, déjà conforme au Skill : le nom de l'école est toujours écrit à côté du carré de couleur |

Aucune distinction de cette vue ne repose sur la seule teinte. Vérifié à l'œil sur
`/comparaison` avec les deux thèmes simulés en niveaux de gris (désaturation
mentale du rendu) : chaque état reste identifiable au texte ou au glyphe seul.

## D — les niveaux

Chaque nombre de niveau affiché dans `TableComparaison` est sous un en-tête nommé
par la classe (`<Entete libelle={noms.get(classe) ?? classe} titre="Niveau du sort
pour <classe>">`), jamais sous un en-tête « Niveau » nu. Le test existant
(`comparaison.test.tsx`, « porte une colonne de niveau par classe sélectionnée »)
vérifie déjà `queryByRole('columnheader', { name: /^Niveau$/ })).toBeNull()`, non
modifié.

Le niveau 0 (oraisons) s'affiche comme `0`, jamais confondu avec l'absence rendue
en `—` : couvert par le test « marque d'un tiret, jamais d'un 0, la classe qui ne
reçoit pas le sort ».

## E — les cibles et la charte

- Le groupe « Afficher » (désormais `fieldset`) et ses trois boutons de bascule
  portent `min-h-cible min-w-cible`.
- Le bouton « Afficher N sorts de plus » porte `min-h-cible`.
- Chaque case à cocher de `SelecteurClasses` est enveloppée dans un `<label>`
  `min-h-cible`, pour une cible tactile de 44 px sans agrandir la case native.
- Chaque en-tête triable de `TableComparaison` (le `<button>` dans le `<th>`)
  porte `min-h-cible`.
- Les lignes de `<tbody>` restent à `h-ligne` (32 px), non touchées.
- Aucun `(s)` : les pluriels de cette vue étaient déjà écrits en toutes lettres
  (`{n} {n === 1 ? 'sort' : 'sorts'}`), sauf le badge d'écart corrigé au point B.

## Compte de caractères supprimés

Deux-points supprimés du texte d'interface : 4 (`Afficher :`, `index.json : `,
`… seconde : …`, `Aucun : …`). Point-virgule supprimé : 1
(`SelecteurClasses.tsx`). Tiret cadratin supprimé d'un `title` : 1
(`TableComparaison.tsx`). Pluriel entre parenthèses supprimé : 1
(`niveau(x)` → `niveau`/`niveaux`). Total : 7 défauts typographiques retirés du
périmètre, sur 415 chaînes examinées par `npm run web:typo` (0 restant dans
`web/components/comparaison/` et `web/lib/comparaison/ensembles.ts`).

## Ce qui n'a pas été touché

`web/lib/comparaison/ensembles.ts` : aucune ligne de logique modifiée. Les
fonctions de calcul d'ensembles (`comparer`, `trierParEcart`, `filtrerParTags`,
`exclusifsAbsolus`, etc.) sont inchangées à l'octet ; leurs tests
(`ensembles.test.ts`, hors périmètre de fichiers de cette étape) n'ont pas été
exécutés pour modification, seulement pour non-régression.

`web/lib/comparaison/etat-comparaison.ts` n'est pas dans le périmètre de fichiers
de cette étape (seul `ensembles.ts` y figure) et ne portait de toute façon aucun
deux-points ni pluriel entre parenthèses dans ses chaînes d'interface
(`LIBELLES_MODES`) : rien n'y a été changé.

## Vérification

- `npm run web:typo` : 0 écart dans le périmètre (36 écarts subsistent ailleurs
  dans le dépôt, hors périmètre de cette étape — étapes 06 à 12 et 14, pas
  encore fusionnées à ce stade).
- `npm --prefix web run test -- comparaison` : 66 tests verts (64 existants + 2
  nouveaux : nom accessible du groupe « Afficher », porteur textuel de l'écart).
- `npm --prefix web run test` (suite complète) : 695/698 verts. Les 3 échecs
  (`components/navigation/navigation.test.tsx`, 2 timeouts, et un timeout de
  worker sur `components/compte/personnages.test.tsx`) sont hors périmètre
  (fichiers de navigation et de compte, non touchés par cette étape) et
  ressemblent à une saturation de la machine de vérification (mémoire
  insuffisante observée pendant la session), pas à une régression introduite
  ici — à confirmer sur une machine moins chargée avant la fusion finale.
- `npm --prefix web run lint` : vert.
- `npm --prefix web run typecheck` : vert.
- `npm run web:build`, `npm run web:cibles` et `npm run web:verifier` n'ont **pas
  pu être exécutés jusqu'au bout** dans cette session : l'installation de
  `web/node_modules` (absent dans ce worktree neuf) a saturé la mémoire de la
  machine (`bash: fork: Resource temporarily unavailable`, `Mémoire
  insuffisante`) après plusieurs tentatives. Aucune modification de cette étape
  n'affecte la construction (aucune dépendance ajoutée, aucun import cassé) ;
  `web:cibles` reste à confirmer sur les six largeurs pour les nouvelles classes
  `min-h-cible`/`min-w-cible` avant fusion.
