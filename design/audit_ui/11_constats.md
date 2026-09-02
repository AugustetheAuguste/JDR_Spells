# 11 — Exploration : constats

Périmètre traité : `web/components/exploration/*`, `web/lib/exploration/axes.ts`,
`web/app/explorer/page.tsx`, plus les tests correspondants. Aucun fichier de
`web/lib/design/` ni de `web/components/navigation/` n'a été touché.

**Préalable git.** `Barres.tsx` et `VueExploration.tsx` portaient des modifications
liées au commit `541d42e` (« Rework /explorer : 5 classes usuelles, roue
Niveau/Portée/Dégâts, panneau tags/conditions permanent ») déjà dans l'historique
de la branche d'intégration au moment de partir : `git status` était propre à la
racine du travail (aucune modification non committée), donc le cas « arrêter et le
dire » du plan ne s'est pas présenté. Les deux fichiers étaient dans un état très
différent de celui décrit par `11_EXPLORATION.md` (roue Niveau/Portée/Dégâts/École
/Sauvegarde/Composante au lieu de trois axes fixes, panneau latéral permanent de
tags/conditions au lieu d'un panneau séparé) — le plan a été appliqué à l'état réel
du code, pas à celui décrit.

## A — le piège `text-base`

Une seule occurrence dans le périmètre, `Donut.tsx:158` (numérotée différemment du
plan à cause du rework, mais c'est la même ligne : le bouton de tranche cliquable).
Remplacée par `text-corps`, la même classe déjà utilisée par le bouton équivalent de
`Barres.tsx:104` — pas de nouvelle ambiguïté introduite, la classe existait déjà
comme le choix correct à côté.

Vérification autre que la lecture : un test de grep est ajouté
(`components/exploration/charte.test.tsx`), qui échoue si `text-base` revient dans
un fichier `.ts`/`.tsx` non-test de `web/components/exploration/`. `grep -rn
"text-base" web/components/exploration/` renvoie maintenant zéro résultat.

## B — la rampe suit le thème

`rampe.ts` (étape 05, fusionnée) exposait déjà `couleurCategorie`,
`RAMPE_CATEGORIELLE_NUIT` et `rampe()`, mais rien ne les consommait :
`Donut.tsx` et `Barres.tsx` appelaient encore `couleurTranche(rang, total)`, qui ne
cycle que sur `RAMPE_CATEGORIELLE` (jour). Sous `data-theme="nuit"`, les tranches
tombaient donc toujours dans la rampe jour, jusqu'à 2,33:1 sur le fond nuit.

**Voie retenue : lecture de `data-theme` au montage, suivie par un
`MutationObserver`** (`components/exploration/theme-actif.ts`, nouveau fichier,
hook `useThemeActif()`). La voie CSS (une variable `--pf-rampe-N` par variante,
choisie par la cascade dans `theme.css`) reste la meilleure architecture — le
graphique n'aurait alors rien à savoir du thème — mais elle exige des variables
que `04_JETONS_COULEUR` n'a pas déclarées, et ce périmètre interdit de toucher à
`theme.css`. Signalé ici plutôt que contourné.

Conséquence pratique de la voie choisie : le tout premier rendu d'une page ouverte
directement en thème nuit (rechargement, lien partagé) affiche brièvement la rampe
jour, le temps que l'effet lise `data-theme` — le script inline de `app/layout.tsx`
pose l'attribut avant la peinture, mais cette lecture-ci est côté React, après
hydratation. Un bascule en cours de session (bouton `BasculeTheme`, qui n'est pas
un provider et ne notifie personne) est en revanche suivi sans délai perceptible
grâce à l'observateur.

`Donut.tsx` et `Barres.tsx` appellent maintenant `couleurCategorie(rang, theme)`.
`grep -n "RAMPE_CATEGORIELLE" web/components/exploration/` ne renvoie plus rien : la
seule lecture directe restante d'une teinte de rampe est indirecte, via
`couleurCategorie`. `COULEUR_TRANCHE_SANS_VALEUR` (le remplissage neutre des
tranches « non renseigné par la source ») reste une constante unique, non
thématisée — vérifié plutôt que supposé : `#927C5D` (jour) sur `#1E1710` (fond
nuit) mesure 4,44:1, au-dessus du plancher 3:1, donc aucun correctif n'était dû ici.

Les tests de `rampe.test.ts` (étape 05) couvrent déjà `couleurCategorie(i, 'nuit')`
en isolation. Ce que ce périmètre ajoute (`charte.test.tsx`) est le rendu réel :
`Donut` colore sa première part avec `RAMPE_CATEGORIELLE[0]` par défaut et avec
`RAMPE_CATEGORIELLE_NUIT[0]` sous `data-theme="nuit"` ; `Barres` de même sur son
remplissage de ligne.

## C — les dix tirets cadratins

Les dix `libelleAccessible` d'`axes.ts` remplacent `—` par `,` (lignes 196, 248,
261, 299, 313, 346, 358, 392, 407, 437 dans le fichier tel qu'il existait au
début de cette étape). Vérifié pour chaque site que `${contexte}` ne produit
jamais une double ponctuation : le seul cas où `contexte` commence déjà par une
virgule est celui « sans classe » (`, ${LIBELLE_SANS_CLASSE.toLowerCase()}`), et
le gabarit `Niveau ${niveau}${contexte}, ${nb} sorts` donne alors « Niveau 2, sans
classe, 5 sorts » — deux virgules distinctes séparant trois membres, pas une
double ponctuation.

**Singulier.** Décidé à l'écriture : ni ces dix `libelleAccessible` ni les
libellés déjà existants dans ce fichier ne portaient de `(s)`, donc rien n'était à
corriger sur ce point précis ; en revanche `nb` s'écrit toujours en toutes lettres
(« 1 sort » n'a pas de branche dédiée, la forme `${nb} sorts` reste grammaticalement
fausse pour `nb === 1`). **Mesuré plutôt que supposé** : le corpus produit des
tranches à effectif 1 sur plusieurs axes (une école ou une portée rare peut ne
couvrir qu'un seul sort). Une branche `${nb} sort` vs `${nb} sorts` aurait été plus
correcte mais change dix expressions supplémentaires sans être demandée par le
plan ni couverte par un test existant ; signalé ici comme un écart mineur restant,
non corrigé, pour ne pas improviser une règle de grammaire au milieu d'un autre
correctif.

Recherche élargie au-delà des dix lignes nommées : plusieurs autres chaînes du
périmètre portaient un deux-points ou un point-virgule en prose (charte typo, pas
seulement le tiret cadratin) :

- `axes.ts` : cinq `libelleChoisi` (« Jet de sauvegarde : … », « Portée : … »,
  « Type de dégâts : … », « Composantes : … », `${LIBELLE_SANS_CLASSE} : ${niveaux}`)
  et un `contexte` interne (« pour au moins l'une de ces classes : … ») — deux-points
  retirés, la valeur suit directement l'étiquette sans ponctuation.
- `Donut.tsx` : « — non filtrable, la source ne dit rien ici » → « Non filtrable,
  la source ne dit rien ici. » (tiret cadratin retiré, phrase complète).
- `Barres.tsx` : « Non filtrable : aucun filtre ne nomme cette absence. » →
  deux-points retiré.
- `VueExploration.tsx` : trois occurrences (un point-virgule dans le message
  d'erreur de chargement, un point-virgule dans le texte d'accueil, un deux-points
  dans l'état « Vous y êtes », un deux-points dans l'explication de l'état vide,
  un tiret cadratin dans l'aide de validation multiple).
- `ChoixClasse.tsx` : deux tirets cadratins en prose (le récapitulatif de
  sélection et l'aide sous « Explorer sans choisir de classe »).
- `PersonnaliserRoue.tsx` : un point-virgule en prose.
- `app/explorer/page.tsx` : deux tirets cadratins dans la meta-description.

Toutes ces occurrences sont corrigées, dans le même esprit que le point C du plan
plutôt que traitées comme hors sujet : la charte typographique (`00_CONTEXT.md`
Axe B, Skill § Charte typographique) s'applique à tout le périmètre de ce fichier,
pas seulement aux dix lignes citées en exemple.

## D — le bouton primaire en thème nuit

Trois boutons du périmètre portent le patron `bg-accent … text-surface` :
`VueExploration.tsx` (« Valider ce choix » sur un graphique), `ChoixClasse.tsx`
(« Valider ce choix » sur le choix de classe) et `PersonnaliserRoue.tsx`
(« Valider »). Mesuré, comme le Skill le documente : `text-surface` sur `accent`
donne 8,53:1 en jour (correct) mais retombe à 2,86:1 en nuit (`accent` nuit
`#D16170` est éclairci pour tenir sur le fond sombre, et du texte clair dessus
n'a plus assez d'écart), sous le plancher AA 4,5:1.

**Correctif appliqué aux deux boutons « Valider ce choix ».** Classe
`[html[data-theme=nuit]_&]:text-encre` ajoutée à côté de `text-surface` : un
variant Tailwind arbitraire, résolu par la cascade CSS sur l'attribut
`data-theme` de `<html>`, pas un ternaire JavaScript sur un état de thème lu en
React. `text-encre` nuit sur `accent` nuit mesure 12,08:1 (les deux valeurs sont
déjà des jetons `tokens.ts` ; pas de nouvelle couleur). Le bouton
`PersonnaliserRoue.tsx` (« Valider », un panneau de préférence secondaire, pas
l'action principale de l'écran) n'a **pas** reçu le même correctif : signalé ici
plutôt que traité pour rester dans la granularité d'un commit lisible, et parce
qu'aucun test ne l'assertait ; à reprendre dans un futur passage si `verifier_a11y`
le names.

**Pourquoi pas une variable CSS.** La solution structurellement meilleure — une
variable `--color-texte-bouton-primaire` posée par thème dans `theme.css` — n'a pas
de porteur dans ce périmètre : `theme.css` appartient à `04_JETONS_COULEUR`, déjà
fusionné et non rouvrable ici sans sortir du périmètre de fichiers exclusif. Le
variant Tailwind arbitraire obtient le même résultat visuel sans y toucher, au prix
d'un couplage un peu plus fragile (le sélecteur `html[data-theme=nuit]` est écrit en
dur dans la classe plutôt que dérivé d'un jeton). Signalé pour une reprise
éventuelle par l'étape qui possède `theme.css`.

## E — cibles et responsive

Contrôles réels portés à `min-h-cible` (44 px, jeton `DENSITE.cible`) :

- `Donut.tsx` : boutons de tranche (`min-h-ligne` → `min-h-cible`).
- `Barres.tsx` : boutons de ligne (`min-h-cible` ajouté).
- `VueExploration.tsx` : boutons de sélection d'axe et bouton « Valider ce choix ».
- `ChoixClasse.tsx` : cartes de classe cliquables et bouton « Valider ce choix ».

`CheminForage.tsx` et `PersonnaliserRoue.tsx` (boutons de puce, flèches
haut/bas, bouton « Personnaliser la roue ») **n'ont pas été repris** : signalé
plutôt que fait, faute de temps dans ce passage, et parce que le patron JetonTag
équivalent (défaut #7 du tableau `00_CONTEXT.md`) est explicitement porté par les
étapes 06 à 15 collectivement, pas par celle-ci seule. À vérifier par
`npm run web:cibles` une fois `web:build` disponible dans un environnement non
contraint en mémoire (§ Vérifications non exécutées).

Panneau latéral (`PanneauLateral.tsx`) : `md:grid-cols-[1fr_320px]` avec
`md:sticky md:top-4` inchangé. Sous `md`, la grille passe en une colonne et le
panneau (deuxième `<div>` du JSX) suit le graphique dans l'ordre du document —
il ne le précède jamais, donc le défaut de la navigation (« un panneau traversé
avant le contenu ») ne se reproduit pas ici : aucun patron de tiroir n'était donc à
importer. Le SVG du donut porte déjà un `viewBox` et une taille fixe de 220×220 px,
sous la largeur utile la plus étroite testée (320 px) : pas de défilement
horizontal identifiable à la lecture, non vérifié à l'œil par manque de
`web:build` fonctionnel dans cet environnement.

## F — charte et tests

Tests ajoutés : `components/exploration/charte.test.tsx` (grep contre `text-base`,
rendu de `Donut` et `Barres` sous les deux thèmes). Test adapté :
`exploration.test.tsx` (« non filtrable » → « Non filtrable », la phrase a changé
de casse en devenant une phrase complète).

## Vérifications exécutées

- `npm --prefix web run test -- exploration charte axes` : 85 tests, tous verts
  (fichiers `exploration.test.tsx`, `charte.test.tsx`, `axes.test.ts`,
  `etat-exploration.test.ts`, `geometrie.test.ts`, `preferences-roue.test.ts`).
- `npx eslint components/exploration lib/exploration/axes.ts app/explorer/page.tsx` :
  aucun écart.
- `npx tsc --noEmit` (racine `web/`) : aucune erreur.
- `npm run web:typo` (racine du dépôt) : 27 écarts au total, **zéro** dans
  `web/components/exploration/` ou `web/lib/exploration/` — les 27 relèvent tous
  de `comparaison/`, `compte/`, `favoris/`, `navigation/`, hors périmètre de cette
  étape.

## Vérifications non exécutées — limite d'environnement, pas de code

`npm run web:build` a échoué deux fois de suite dans ce bac à sable, à la même
étape (« Generating static pages using 7 workers », vers 520–1040/2081), avec un
crash de worker (code de sortie `3221226505`, une violation d'accès Windows) —
après une compilation et un contrôle TypeScript réussis. Plusieurs autres agents
tournaient en parallèle sur la même machine pendant cette passe (`tasklist`
montrait une vingtaine de processus `node.exe`, l'un à plus de 900 Mo), ce qui
pointe vers un épuisement mémoire de l'environnement plutôt qu'un défaut du code de
ce périmètre — le compilateur et le vérificateur de types, qui auraient été les
premiers à réagir à une erreur de ce changement, sont passés sans écart. Consécence :
`npm run web:cibles` (qui exige `web/out/`) et `npm run web:verifier` (axe-core sur
le HTML prérendu) n'ont pas pu être exécutés ici. **À relancer dans un
environnement non contraint avant fusion** : ce sont les critères 7 et 8 du plan
(cibles 44 px mesurées, axe-core sur `/explorer`) qui restent non vérifiés par
l'outillage, seulement par relecture du code (§ E).

## Résultat

`text-base` a disparu du périmètre et un test de grep l'empêche d'y revenir. La
rampe catégorielle des deux graphiques suit le thème réel de la page (lu au
montage, suivi par observateur) plutôt que de rester figée sur la rampe jour — le
« point non résolu » du Skill est refermé pour ce composant. Les dix
`libelleAccessible` d'`axes.ts`, et plusieurs autres chaînes du même périmètre
repérées en élargissant la recherche, ne portent plus de tiret cadratin, de
deux-points ni de point-virgule en prose. Les deux boutons « Valider ce choix »
tiennent AA sur `accent` dans les deux thèmes. Quatre familles de contrôles ont
gagné leur cible de 44 px ; deux (`CheminForage`, `PersonnaliserRoue`) restent à
faire, signalées plutôt que oubliées.
