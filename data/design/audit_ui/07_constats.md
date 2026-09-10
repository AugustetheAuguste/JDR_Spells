# 07 — Constats, le cadre du site

Périmètre : `web/app/layout.tsx`, `web/app/layout.test.tsx`.

## A — le pied de page

| | Avant | Après |
|---|---|---|
| Texte visible | « Contenu de **pathfinder-fr.org**, wiki communautaire tenu par des bénévoles. Ce site n'en est qu'un index de consultation ; les pages d'origine font foi. » | « Les sorts viennent de [pathfinder-fr.org](https://www.pathfinder-fr.org/). » |
| Caractères (hors balises) | 149 | 40 |
| Phrases | 2 | 1 |
| Lien vers `pathfinder-fr.org` | présent | **présent** — inchangé, engagement CLAUDE.md §11 |

Suppression de 109 caractères. Les deux phrases retirées répétaient : la première,
« wiki communautaire tenu par des bénévoles », un fait déjà porté par le lien
lui-même et par la description de la page ; la seconde, « Ce site n'en est qu'un
index de consultation, les pages d'origine font foi », le même message que le
lien du bandeau (`Voir sur pathfinder-fr.org` sur chaque fiche) redit une
troisième fois. Le point-virgule de la deuxième phrase disparaît avec elle —
c'était de toute façon un écart de charte.

Le lien de pied de page porte `min-h-cible` (44 px de haut) et un espacement de
8 px avec le texte qui le précède (`gap-2` sur le conteneur du `<p>` et du lien).

## B — le bandeau aux six largeurs

Cinq liens de navigation, la mention de source et la bascule de thème portent
`min-h-cible min-w-cible` (44 px). `BasculeTheme.tsx` reste hors périmètre
(étape 15) : le bouton lui-même continue de mesurer 85×28 px, mesuré par
`npm run web:cibles` (`compte @ 320 px — button.border « Thème nuit » mesure
85×28 px, plancher 44 px`, répété sur les six routes et six largeurs). Le
conteneur qui l'entoure dans `layout.tsx` porte la cible, mais un conteneur ne
grandit pas la zone cliquable réelle d'un bouton plus petit à l'intérieur —
**signalé pour l'étape 15**, qui doit porter le `<button>` lui-même à 44 px
minimum et 8 px d'espacement avec ses voisins.

### Stratégie retenue

**Option 1**, le bandeau passe sur deux rangées sous 640 px : les cinq liens
sur une rangée, la source et la bascule sur l'autre. Raison inchangée du
brief — aucun état nouveau, aucun clic supplémentaire ; l'option 3 (bouton de
menu) coûte un tap de plus sur la navigation la plus fréquente du site, l'option
2 (défilement horizontal) cache des destinations derrière un geste qui ne
s'annonce pas.

### Hauteur mesurée, réellement

Mesure Playwright/Chromium sur `web/out/` construit, route `/`, thème jour.

| Largeur | Hauteur du bandeau | Hauteur du pied |
|---|---|---|
| 320 px | **259 px** | 77 px |
| 375 px | **155 px** | 77 px |

Le nombre de 88 px anticipé par le brief (deux rangées à 44 px) suppose que
chaque rangée elle-même tient sur une ligne. Ce n'est vrai qu'à partir de
375 px : à cette largeur, le bandeau se résout en titre (26 px) + rangée de
liens (44 px) + rangée source/bascule (44 px) + paddings et espacements, soit
155 px. **À 320 px, les cinq liens de navigation ne tiennent pas non plus sur
une seule ligne** à 44 px de cible chacun : la rangée de liens elle-même se
replie en deux lignes (96 px de haut), et la rangée source/bascule aussi
(96 px), parce que « Source pathfinder-fr.org, consulter le wiki » plus la
bascule de thème ne tiennent pas sur 320 px de large même sur leur propre
rangée. Total mesuré à 320 px : 259 px de bandeau, soit trois rangées
effectives (titre, deux lignes de liens, deux lignes de source/bascule) plutôt
que les deux rangées visées par le brief.

C'est du contenu perdu en haut de chaque page sur les téléphones les plus
étroits (320–360 px), plus que les 88 px que l'option 1 annonçait pour le cas
général. Aucune correction supplémentaire n'a été tentée dans ce périmètre
(pas de sticky, pas de bouton de menu, pas de réduction sous 44 px) : le
chiffre est mesuré et remonté tel quel, la décision de le réduire davantage
revient à l'arbitrage humain plutôt qu'à un rétrécissement des cibles.

Aucune des six routes ne présente de défilement horizontal à aucune des six
largeurs (`npm run web:cibles`, 0 occurrence de type `defilement-horizontal`
dans la sortie complète).

## C — la charte

### Divergence signalée pour l'étape 16

`MOTS.source` (`web/lib/design/tokens.ts`) porte le libellé figé
« source : pathfinder-fr.org », deux-points inclus — vocabulaire d'interface
gelé par le Skill dans une table qui, elle-même, écrit ce deux-points en toutes
lettres. La charte typographique du même Skill interdit le deux-points en
prose sans exception pour ce libellé. `layout.tsx` tranche en faveur de la
charte : le deux-points part, le mot « source » se lit en minuscule au début
d'une phrase plutôt qu'en étiquette — « Source pathfinder-fr.org, consulter le
wiki » — sans toucher à `MOTS` (`tokens.ts` est hors périmètre, propriété de
l'étape 04). **L'étape 16 doit répercuter cette décision dans la table du
vocabulaire du Skill**, en retirant le deux-points de `MOTS.source` ou en
documentant l'exception.

Aucune autre chaîne du fichier ne porte de deux-points, de point-virgule, de
tiret cadratin ou de pluriel entre parenthèses. `npm run web:typo` ne signale
aucun écart dans `web/app/layout.tsx` (les 40 écarts restants du dépôt sont
tous dans d'autres fichiers, hors périmètre de cette étape).

## D — les tests, `web/app/layout.test.tsx`

Le fichier n'existait pas, créé pour cette étape. `layout.tsx` rend
`<html>`/`<body>` lui-même, ce que React Testing Library ne peut pas monter
sans dupliquer ces balises dans le `document` que jsdom possède déjà — les
assertions lisent donc le fichier comme texte, avec les mêmes critères que les
`grep` du brief (`pathfinder-fr.org` dans le pied, absence de `Provider` ou de
`Fournisseur` hors `Fournisseurs`, les 5 `href` de la nav, `min-h-cible` sur
chaque contrôle). 10 tests, tous verts.

## Vérifications exécutées

| Commande | Résultat |
|---|---|
| `npm --prefix web run test` | 30 fichiers, 709 tests, tous verts (4 fichiers ont dû être relancés isolément après des timeouts de démarrage de worker liés à la charge de la machine, pas à ce changement) |
| `npm --prefix web run lint` sur `app/layout.tsx`, `app/layout.test.tsx` | 0 écart |
| `npm --prefix web run typecheck` | 0 erreur |
| `npm run web:typo` | 40 écarts, 0 dans `web/app/layout.tsx` (baseline inchangée) |
| `npm run web:build` | 2081 pages générées (2070 sorts + 11 routes statiques), inchangé |
| `npm run web:cibles` | 3722 écarts pré-existants, 0 nouveau dans le bandeau ou le pied de page (le seul écart de cible touchant ce périmètre, la bascule de thème à 85×28 px, est antérieur et hors périmètre — signalé pour l'étape 15) ; 0 défilement horizontal sur les six routes et six largeurs |
| `npm run web:verifier` (`verifier_a11y.ts`) | `OK — aucune violation WCAG A/AA sur 5 routes` |
| Lien d'évitement | vérifié dans le navigateur (route `/` construite, 320 px) : au focus, il devient visible, porte `min-h-cible` et mesure au moins 44 px de haut |

## `git diff --name-only`

```
design/audit_ui/07_constats.md
web/app/layout.test.tsx
web/app/layout.tsx
```

Trois fichiers, tous du périmètre de cette étape. `Fournisseurs.tsx`,
`BasculeTheme.tsx` et `tokens.ts` ne sont pas touchés.
