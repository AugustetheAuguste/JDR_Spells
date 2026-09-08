# 16 LIAISON CORPUS — rapport

## Résumé

Rattachement de sorts et de dons du corpus depuis la fiche : recherche +
rattachement pour les deux corpus, vérification tri-état des dons en mode
avertissement seulement (jamais de blocage), panneau latéral qui restitue le
texte intégral d'un sort ou d'un don sans jamais bouger le défilement de la
fiche, et un carnet de sorts purement descriptif (trois modes, aucun
compteur). `web/lib/dons/` n'a été touché à aucun endroit.

## Incident d'environnement, avant tout code

Le worktree était sur `feat/fiche-personnage/16-liaison-corpus`, mais ce
pointeur était identique à `main` (fusion des dons), **sans** l'étape 15
(`feat/fiche-personnage/15-interface-fiche`) dessous — `web/app/personnages/`
et `web/lib/fiche_personnage/schema.ts` etc. n'existaient pas dans le
worktree, contrairement à ce que le contexte hérité annonçait. Corrigé par
`git merge feat/fiche-personnage/15-interface-fiche` dans le worktree, sans
conflit. `npm install` (racine et `web/`) a aussi été nécessaire, le worktree
n'avait aucun `node_modules`.

## Fichiers créés

- `web/lib/fiche_personnage/vers-character.ts` + `.test.ts` —
  `ficheVersCharacter(fiche) -> Personnage | null`.
- `web/lib/fiche_personnage/charger-corpus.ts` — `chargerPropsSort`,
  `chargerPropsDon` : fetch client de `/data/sorts/<slug>.json` et
  `/data/dons/<slug>.json`, seule façon d'atteindre les props complètes
  (texte verbatim) depuis un composant client, `lirePropsSort`/`lirePropsDon`
  étant `node:fs` côté serveur.
- `web/components/fiche_personnage/PanneauLateral.tsx` + `.test.tsx`.
- `web/components/fiche_personnage/LectureCorpus.tsx` — le contenu du
  panneau, réutilise `BlocTechnique`, `Description`, `BlocConditions`,
  `NiveauxParClasse`, `LienSource` tels quels.
- `web/components/fiche_personnage/RechercheCorpus.tsx` + `.test.tsx`.
- `web/components/fiche_personnage/SectionDons.tsx` + `.test.tsx`.
- `web/components/fiche_personnage/CarnetSorts.tsx` + `.test.tsx`.

## Fichiers modifiés

- `web/lib/fiche_personnage/schema.ts` — `EntreeCorpus` porte désormais
  `note: string` (spec § « champs à ajouter »), en plus de `nom`, `source`,
  `ref` déjà présents depuis l'étape 15.
- `web/components/fiche_personnage/VueFiche.tsx` — la section Dons délègue à
  `SectionDons`, la section Sorts délègue le choix de mode et les listes de
  sorts à `CarnetSorts` (le reste — caractéristique d'incantation, niveau de
  lanceur, emplacements, degré de difficulté — inchangé, toujours calculé par
  `lib/fiche_personnage/sorts.ts`, étape 11). Un seul `PanneauLateral` partagé
  pour toute la fiche, ouvert par les deux sections via deux fonctions
  fermées sur leur corpus (`ouvrirLectureSorts`/`ouvrirLectureDons`).
- `web/lib/design/tokens.ts` — libellés `corpus*`, `panneauFermer`,
  `sortsMode*`, `sortsConnusTitre`, `sortsPreparesTitre`,
  `sortsAucunSortRattache` ajoutés à `MOTS`.

Aucun fichier sous `web/lib/dons/` n'a été modifié — confirmé par
`git status --short web/lib/dons/` (vide) à la fin du travail.

## Décisions notables

- **Accès au moteur de dons** : `RechercheCorpus` et `SectionDons` appellent
  `chargerContratMoteurDons()` (`web/lib/dons/charger-contrat.ts`, existant,
  non modifié) puis `evaluerDon()` (`web/lib/dons/moteur.ts`, existant, non
  modifié). Aucun wrapper n'a été nécessaire : le contrat de ces deux
  fonctions suffisait tel quel.
- **Recherche** : `RechercheCorpus` réutilise `sourceSorts`/`sourceDons` de
  `web/lib/recherche/sources-globales.ts` (déjà écrites pour la recherche
  d'en-tête) plutôt que de reconstruire un second moteur — le slug (`ref`)
  est extrait du dernier segment de `resultat.href` (`/sorts/<slug>/`,
  `/dons/<slug>/`), qui porte déjà cette information.
- **Verdict jamais mémorisé** : ni `SectionDons` ni `RechercheCorpus` ne
  stockent un statut ; `evaluerDon` est appelé à chaque rendu, à partir de
  `ficheVersCharacter(fiche)` recalculé à chaque rendu. Un changement de
  niveau change donc l'affichage sans action supplémentaire (critère 6).
- **`ficheVersCharacter`** rend `null` seulement si aucune classe n'est
  saisie ou si la première classe n'a pas de niveau — les autres champs
  (caractéristiques, race, taille, alignement, divinité) restent chacun
  absents individuellement plutôt que de faire échouer toute la conversion.
- **Panneau latéral** : `position: fixed`, jamais de `overflow: hidden` sur
  `<body>` (qui bougerait la gouttière de défilement). Tout `focus()` posé
  par le composant passe `{ preventScroll: true }`. La position de
  défilement est mémorisée à l'ouverture et restaurée à la fermeture par
  garde-fou, mais le mécanisme principal est l'absence de tout ce qui
  bougerait le défilement en premier lieu.
- **`react-hooks/set-state-in-effect`** (règle ESLint stricte du dépôt) a
  demandé de retravailler trois effets (`PanneauLateral`, `RechercheCorpus`,
  `LectureCorpus`) pour ne jamais appeler `setState` de façon synchrone en
  tête d'effet — valeur initiale calculée dans l'initialiseur de `useState`
  pour la détection d'écran, et suppression des remises à zéro redondantes
  ailleurs (l'état initial ou le rendu conditionnel suffisaient déjà).

## Vérification en exécution (Skill `verify`)

Build (`npm run web:build`, 3502 pages) puis serveur statique maison
(`build/verify_harness/serve.mjs`, jetable, non committé) piloté par
Playwright (`playwright-core`, Chromium déjà présent sur la machine,
`build/verify_harness/drive_16.mjs`, jetable, non committé).

Scénario : une fiche `verif-16` (Guerrier niveau 6) semée dans
`localStorage` (`pf-fiche:verif-16`), trois sorts rattachés (Boule de feu,
Charme, Invisibilité — recherche réelle sur les 2070 sorts publiés), deux
dons rattachés dont un inéligible (« Abondance des révélations », réservée à
l'Oracle) parmi les 24 dons couverts par le `moteur_dons.json` actuellement
publié dans ce dépôt (voir « Limite connue » ci-dessous). Panneau ouvert
depuis le bas de la fiche, en thème jour et nuit (bascule réelle via le
bouton de l'en-tête, pas un `localStorage` pré-semé — `BasculeTheme` ne lit
son état initial qu'au montage), à 1280 px et 320 px.

Résultat mesuré (`window.scrollY` avant ouverture / après ouverture / après
fermeture par Échap) pour les quatre combinaisons thème × largeur : **les
trois valeurs sont strictement identiques dans les quatre cas**
(`scrollStable: true`), le focus revient au déclencheur, et le don inéligible
affiche bien la bordure en tirets, le « ! Condition non remplie » et son
motif, avec les boutons « Détacher » et « Rattacher » toujours actifs.
Captures dans `build/verify_harness/preuves/` (non committé, `build/` est
gitignoré) : `panneau-ouvert-{jour,nuit}-{1280,320}.png`,
`fiche-{jour,nuit}-{1280,320}.png`, `dons-verdicts-{jour,nuit}-{1280,320}.png`.

## Critères de vérification (plan § « Critères de vérification »)

1. `npm run web:test` (`web/`) : **passe** — 93 fichiers, 1179 tests, `eslint`
   et `tsc --noEmit` compris, aucun `any`.
2. `npm run dons:parite` : **passe** — 0 régression, 0 relâchement (profil
   « rapide », 42 personnages × 1417 dons, 59 514 cellules). 14 571 lignes de
   bruit signalées, toutes une casse de classe (`Alchimiste` vs `alchimiste`)
   dans les motifs — pré-existantes, hors périmètre, aucun fichier de
   `web/lib/dons/` modifié par cette étape (`git status --short` vide).
3. Testé (`RechercheCorpus.test.tsx`, `SectionDons.test.tsx`) : un don
   `ineligible` reste rattachable, bouton ni désactivé ni masqué. Confirmé en
   exécution réelle (§ ci-dessus).
4. Testé : un don `manual_check` est visible, motifs indéterminés listés sous
   « Points à vérifier soi-même ».
5. Testé, explicitement distingué : `manual_check` affiche « À vérifier » +
   « Points à vérifier soi-même » ; `ineligible` affiche « Condition non
   remplie » + « Ce que le personnage ne remplit pas ». Jamais le même
   libellé pour les deux.
6. Testé (`RechercheCorpus.test.tsx`, `SectionDons.test.tsx`) : le verdict
   change après un changement de la fiche (niveau, ou fiche insuffisante),
   sans mémorisation.
7. Testé (`PanneauLateral.test.tsx`) : ouverture puis fermeture laissent
   `window.scrollY` inchangé au pixel, focus rendu au déclencheur. Confirmé
   en exécution réelle sur les quatre combinaisons thème × largeur.
8. Testé (`PanneauLateral.test.tsx`) : le lien `Voir sur pathfinder-fr.org`
   est présent quand une URL source est fournie ; en usage réel c'est
   `LectureCorpus`/`LienSource` qui le porte, confirmé par capture.
9. Testé (`CarnetSorts.test.tsx`) : le niveau d'un sort rattaché s'affiche
   par classe (`NiveauxParClasse`, réutilisé tel quel), aucun en-tête
   « Niveau » nu. Confirmé en exécution réelle (capture du panneau, table
   « Classe / Niveau »).
10. Testé (`vers-character.test.ts`) : `ficheVersCharacter` sur une fiche
    sans classe rend `null` ; `RechercheCorpus`/`SectionDons` affichent
    « La vérification n'est pas possible avec cette fiche. » sans masquer ni
    désactiver le rattachement.
11. Testé (`CarnetSorts.test.tsx`) : aucun `role="checkbox"`, aucun texte de
    dénombrement (« reste », compteur) dans le rendu.
12. `npm run web:typo` : échoue sur **25 écarts, tous dans `web/lib/dons/`,
    `web/components/dons/` et `web/app/dons/[slug]/page.tsx`**, confirmés
    pré-existants (aucun de ces fichiers n'a été touché par cette étape).
    Aucun écart dans les fichiers livrés ici. `npm run web:verifier` :
    **passe à l'écart connu près** — `defilement-horizontal` sur `navigation`
    à 320 px (CLAUDE.md § 11, non corrigé par consigne explicite) ; les dix
    routes×thèmes passent l'audit axe-core, dont `fiche`.
13. Vérification en exécution détaillée ci-dessus : trois sorts et deux dons
    (dont un inéligible) rattachés, panneau ouvert depuis le bas de la fiche,
    défilement inchangé au pixel en thème jour et nuit, à 1280 px et 320 px.
    Preuves capturées dans `build/verify_harness/preuves/` (jetable, non
    committé — `build/` est gitignoré ; les chemins sont documentés ici pour
    qui voudrait rejouer le scénario).

## Limite connue, assumée

Le fichier `web/public/data/moteur_dons.json` actuellement publié dans ce
dépôt ne porte que 24 dons de conditions analysées (`conditions`,
`_fixture_slugs`), pas les 1417 du catalogue complet — un état antérieur à
l'export complet de l'étage « dons » (le même motif que
`lire-index-dons.ts`/`don-page.ts` documentent déjà pour leur propre bascule
fixture/réel). Conséquence pour cette étape : un don rattaché qui n'est pas
dans ce sous-ensemble de 24 s'affiche **sans verdict** (ni avertissement ni
signe discret) — `SectionDons`/`RechercheCorpus` rendent alors `null` pour la
ligne de verdict, ce qui est le comportement sûr (jamais un verdict inventé)
mais qui limite l'utilité pratique de l'avertissement tant que l'export
complet n'a pas été régénéré (`npm run dons:export`, hors périmètre de cette
étape). Le mécanisme lui-même (recherche, rattachement, recalcul,
non-blocage) a été vérifié en exécution avec les dons effectivement couverts.

## Suivi Git

Branche `feat/fiche-personnage/16-liaison-corpus`, avancée par un `merge` de
`feat/fiche-personnage/15-interface-fiche` (incident d'environnement,
ci-dessus) puis par les commits de cette étape.

Message de commit :

```
feat(fiche) rattacher les sorts et les dons du corpus
```
