# 06 — Constats sur la fiche de sort

Étape `06_FICHE`, vague 2 de la passe « audit UI, UX et textes »
(`build/audit_ui_ux_2026_09/`). Périmètre : `web/components/fiche/*` et
`web/app/sorts/[slug]/page.tsx`.

## Table des constats

| # | Axe | Sévérité | Fichier et ligne | Constat | Correctif |
|---|---|---|---|---|---|
| 1 | A | majeur | `CoucheEnrichissement.tsx:87-92` (avant) | 300 caractères d'avertissement de provenance LLM sur chaque fiche enrichie, un lecteur presse ne les exploite jamais. | Paragraphe retiré en entier. Le titre « Classement automatique » et la bordure en tirets portent désormais seuls le cloisonnement. Arbitrage humain du 2026-09-01. |
| 2 | C | mineur | `LienSource.tsx` monté en dernier dans `page.tsx:167` (avant) | Le Skill (B8) impose le lien source au-dessus du pli, en `t_petit` accentué souligné ; il n'était qu'en pied de fiche. | Un second lien identique ajouté sous le `h1` et sa rangée de badges, avant le bloc technique. |
| 3 | B | majeur | `CoucheEnrichissement.tsx:109` (avant) | « Choix signalé comme ambigu : » porte un deux-points étiquette/valeur. | Scindé en un titre `<strong>Choix ambigu</strong>` et la note sur sa propre ligne (technique 3, titre suivi du contenu). |
| 4 | B | majeur | `LienSource.tsx:24-28` (avant) | Trois propositions dont un deux-points, « … index de consultation : la page d'origine fait foi… ». | Ramené à une phrase sans deux-points, comme demandé par le pseudo-code B. |
| 5 | D | majeur | `LienSource.tsx` (lien bas de fiche), `page.tsx` (lien haut de fiche, lien « Tous les sorts ») | Aucun des trois n'atteignait 44 px de haut ou de large sur un contrôle réel. | `min-h-cible` (et `min-w-cible` pour le lien bordé) ajoutés aux trois. Vérifié par `npm run web:cibles` sur `sorts/detection-de-la-magie/` : plus aucun écart de cible sur ces trois contrôles, aux six largeurs. |
| 6 | D | signalé, hors périmètre | `app/layout.tsx` (nav « Sorts/Explorer/Comparer/Favoris/Compte », lien « consulter le wiki » du pied de page) | `npm run web:cibles` continue de signaler ces contrôles sous 44 px sur la route fiche, comme sur les cinq autres routes — c'est un défaut global du cadre, pas de la fiche. | Hors périmètre de cette étape (fichier de `07_CADRE`). Signalé, pas corrigé ici. |
| 7 | D | signalé, hors périmètre | `web/components/primitives/BasculeTheme.tsx` (« Thème nuit », 85×28 px) | Sous 44 px sur la route fiche, comme sur toute route qui la monte. | Hors périmètre (fichier de `15_PRIMITIVES`). Signalé, pas corrigé ici. |
| 8 | D | signalé, hors périmètre | `web/components/favoris/BoutonFavori.tsx` (variante non compacte, 170×40 px) | 4 px sous le plancher de 44 px sur la fiche. Le fichier appartient à `12_FAVORIS`, en cours en parallèle ; le toucher créerait un conflit de fusion garanti. | Hors périmètre. Signalé pour `12_FAVORIS`. |
| 9 | E | signalé, hors périmètre | route fiche à 320 px | `documentElement.scrollWidth` dépasse `clientWidth`, comme sur les cinq autres routes à 320 px — un défaut de cadre partagé, pas propre à la fiche. | Hors périmètre. Signalé pour `07_CADRE`. |

## Table des chaînes

| Emplacement | Texte actuel | Texte proposé | Raison |
|---|---|---|---|
| `CoucheEnrichissement.tsx` | « Cette section n'est pas tirée du wiki : elle a été rédigée par un modèle de langage ({modele}) le {date}, pour rendre le corpus filtrable. Elle n'a pas été relue par un humain. En cas d'écart, c'est la description ci-dessus qui fait foi. » | *(retiré)* | Arbitrage humain 2026-09-01 : le titre « Classement automatique » suffit. |
| `CoucheEnrichissement.tsx` | « Choix signalé comme ambigu : {notes} » | « Choix ambigu » (titre) puis {notes} | Deux-points étiquette/valeur interdit ; titre suivi du contenu. |
| `LienSource.tsx` | « Ce sort est décrit sur pathfinder-fr.org, wiki communautaire tenu par des bénévoles. Cette page n'en est qu'un index de consultation : la page d'origine fait foi, et c'est elle qui est tenue à jour. » | « La page d'origine sur pathfinder-fr.org, wiki communautaire tenu par des bénévoles, fait foi. » | Une phrase, sans deux-points, sens conservé. |
| `page.tsx` | *(absent)* | Lien « Voir sur pathfinder-fr.org », sous le `h1`, `t_petit`, `text-accent`, souligné | B8 : le lien apparaît deux fois, la seconde au-dessus du pli. |

## Compte de caractères supprimés

- Paragraphe de provenance LLM retiré : 243 caractères par fiche enrichie.
- « Choix signalé comme ambigu : » → « Choix ambigu » : 16 caractères de moins par
  note d'ambiguïté affichée.
- Paragraphe de `LienSource.tsx` ramené à une phrase : 105 caractères de moins,
  sur les 2070 fiches.

**Total, par fiche enrichie : 364 caractères.** Sur 2048 fiches enrichies
(§ 10 CLAUDE.md), le paragraphe de provenance et la note d'ambiguïté
(quand présente) disparaissent ; la réduction du bloc source s'applique aux
2070 fiches. L'étape 16 additionne ce compte à celui des autres surfaces.

## Vérification

- `npm run web:typo` : 0 écart sur les 7 fichiers du périmètre (40 écarts
  restent ailleurs, hors périmètre).
- `npm --prefix web run test` : 700 tests verts, y compris les 34 de
  `fiche.test.tsx` (pool `threads` — le pool `forks` par défaut échoue à
  démarrer ses workers dans cet environnement, panne d'infrastructure locale
  sans rapport avec le code).
- `npx eslint .`, `npx tsc --noEmit` : aucune sortie.
- `npm run web:build` : 2081 pages générées, dont 2070 fiches de sort — le
  compte n'a pas bougé.
- `npm run web:cibles` : sur la route `sorts/detection-de-la-magie/`, les trois
  contrôles du périmètre (lien source du haut, lien source du bas, lien
  « Tous les sorts ») ne sont plus signalés sous 44 px, aux six largeurs.
  Les écarts restants sur cette route viennent de `layout.tsx`, de
  `BasculeTheme.tsx` et de `BoutonFavori.tsx`, hors périmètre.
- `npm run web:verifier` : `fiche : OK` sur la passe axe-core (aucune violation
  WCAG A/AA bloquante). La passe `verifier_cibles.ts` intégrée à `web:verifier`
  échoue globalement à cause des écarts hors périmètre listés ci-dessus.
- `grep -rn "modèle de langage" web/components/ --include='*.tsx' | grep -v .test.tsx`
  et le même pour « relue par un humain » : aucune occurrence hors du test qui
  en vérifie l'absence.
- Le lien vers `pathfinder-fr.org` apparaît deux fois dans
  `web/out/sorts/detection-de-la-magie/index.html`, la première occurrence
  avant la chaîne « Bloc technique » dans l'ordre du document (vérifié par
  position d'octet dans le HTML prérendu).
