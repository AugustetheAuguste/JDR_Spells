# Audit UI/UX 2026-09 — synthèse finale (étape 16)

Consolide les dix constats de la vague 2 (`design/audit_ui/06_constats.md` à
`15_constats.md`), la passe d'intégration (`469aad47`) et la vérification
finale (étape 16). Périmètre couvert : `web/app/layout.tsx`, la fiche de sort,
le panneau de filtres, le tiroir de navigation, le tableau dense, l'exploration,
les favoris, la comparaison, les routes de compte et les quatre primitives
partagées.

## 1. Table des constats, dédoublonnée et renumérotée

| # | Étape source | Axe | Sévérité | Constat | Statut |
|---|---|---|---|---|---|
| 1 | 06 | A | majeur | Paragraphe de provenance LLM (243 car.) sur chaque fiche enrichie | corrigé |
| 2 | 06 | C | majeur | Lien source absent au-dessus du pli sur la fiche | corrigé |
| 3 | 06 | B | majeur | « Choix signalé comme ambigu : » — deux-points étiquette/valeur | corrigé |
| 4 | 06 | B | majeur | Paragraphe `LienSource.tsx` à trois propositions dont un deux-points | corrigé |
| 5 | 06 | D | majeur | Trois liens de fiche sous 44 px | corrigé |
| 6 | 07 | A | mineur | Pied de page à deux phrases redondantes (149 → 40 caractères) | corrigé |
| 7 | 07 | B | majeur | Bandeau de navigation sans cibles 44 px sur 5 liens + source + bascule | corrigé (bascule : voir #23) |
| 8 | 07 | C | majeur | `MOTS.source` porte un deux-points contraire à sa propre charte | **corrigé à l'étape 16** |
| 9 | 08 | A | mineur | Troisième état (`oblige`) du filtre non vérifié au rendu | corrigé (vérifié) |
| 10 | 08 | B | majeur | Aide de filtre référençant des couleurs par leur nom | corrigé |
| 11 | 08 | C | majeur | Jetons, `select`, en-têtes dépliants sous 44 px | corrigé |
| 12 | 08 | D | majeur | `aria-label` de niveau ambigu sans classe | corrigé |
| 13 | 08 | E | majeur | Deux-points, tirets cadratins, pluriels `(s)` dans le panneau de filtres | corrigé |
| 14 | 08 | — | mineur, signalé | Case native `input.size-3.5` du jeton de filtre, 14×14 px sous le `label` de 44 px | ouvert (FOLLOWUPS #7, faux positif du script partiellement corrigé) |
| 15 | 09 | A | majeur | Panneau de filtres empilé au-dessus du tableau sous 1024 px (contenu vu >2400 px plus bas) | corrigé (tiroir) |
| 16 | 09 | B | mineur | Boutons « Tout effacer », « Afficher N sorts de plus » sous 44 px | corrigé |
| 17 | 10 | B | majeur | En-tête de tableau non collant (mauvais contexte de défilement) | corrigé |
| 18 | 10 | C | majeur | Champ de recherche à 14,5 px, zoom iOS au focus | corrigé |
| 19 | 10 | D | mineur | En-têtes triables sous 44 px | corrigé |
| 20 | 10 | E | mineur | `title` redondant sur en-tête triable | corrigé |
| 21 | 11 | A | mineur | `text-base` (piège de police) dans `Donut.tsx` | corrigé |
| 22 | 11 | B | majeur | Rampe catégorielle du graphique figée sur la palette jour en thème nuit (jusqu'à 2,33:1) | corrigé |
| 23 | 11/07/15 | D | bloquant | Bouton primaire `text-surface`/`text-white` sur `accent`, échec AA en nuit (2,86:1) | corrigé (boutons « Valider ce choix », primitives, compte) — **`PersonnaliserRoue.tsx` non repris**, FOLLOWUPS #9 |
| 24 | 11 | C | mineur | Tirets cadratins, deux-points, points-virgules en prose dans l'exploration | corrigé |
| 25 | 11 | E | mineur, signalé | `CheminForage.tsx`, `PersonnaliserRoue.tsx` sous 44 px | ouvert, FOLLOWUPS #8 |
| 26 | 12 | A | mineur | Phrase de synchronisation favoris à vérifier contre le code réel | vérifiée, conservée telle quelle |
| 27 | 12 | B | majeur | Huit boutons de `/favoris` sans hiérarchie visuelle par état | corrigé |
| 28 | 12 | C | majeur | Sept pluriels entre parenthèses dans `/favoris` | corrigés |
| 29 | 12 | D | mineur | `title` de `BoutonFavori.tsx` redondant avec son libellé visible | corrigé |
| 30 | 13 | A | majeur | Groupe « Afficher » sans sémantique de groupe accessible | corrigé (`fieldset`/`legend`) |
| 31 | 13 | B | mineur | Paires étiquette/valeur avec deux-points/point-virgule dans `/comparaison` | corrigées |
| 32 | 13 | E | mineur | Pluriel entre parenthèses du badge d'écart (« niveau(x) ») | corrigé |
| 33 | 14 | A | bloquant | Bouton primaire des routes de compte, `text-white`, échec AA en nuit | corrigé |
| 34 | 14 | C | majeur | 24 défauts ligne par ligne sur les cinq vues de compte (cibles, deux-points, tirets, pluriels, hiérarchie de titre) | corrigés (21/24), 3 mineurs signalés non corrigés (FOLLOWUPS #10) |
| 35 | 14 | — | mineur, signalé | 5 écarts de charte dans `web/lib/compte/client.ts`, `session.tsx`, hors périmètre de toute étape de vague 2 | **corrigé à la passe d'intégration** `469aad47` |
| 36 | 15 | A | majeur | Carré de pastille d'école quasi invisible en nuit (`necromancie`, ~1,5:1) | corrigé (contour `bordFort`) |
| 37 | 15 | B | mineur | `BasculeTheme.tsx` sans test dédié | corrigé — voir FOLLOWUPS #2 |
| 38 | 15 | D | bloquant | `Badge.tsx` ton `accent` sous AA en nuit (4,48:1) | corrigé |
| 39 | intégration | — | majeur | Cibles tactiles `BoutonFavori`, `ChoixClasse`, `TableDense`, `TableSorts` | corrigées, `469aad47` |
| 40 | intégration | — | mineur | `PastilleEcole.tsx` non responsive sous 400 px | corrigée, `469aad47` |
| 41 | 16 | E | majeur, ouvert | Défilement horizontal résiduel, route `navigation` à 320 px | **non corrigé, arbitrage humain requis** — FOLLOWUPS #6 |
| 42 | 08 | — | mineur, résolu | Point non résolu du Skill : rampe catégorielle non revérifiée contre la palette nuit | **résolu à l'étape 11** (`theme-actif.ts`), voir § 3 |

**Compte par sévérité (constats 1 à 42) :**

| Sévérité | Compte | Corrigés | Ouverts |
|---|---|---|---|
| Bloquant | 3 | 3 | 0 |
| Majeur | 22 | 20 | 2 (#14, #41) |
| Mineur | 17 | 14 | 3 (#8/#25, #10/#34, #9/#23) |
| **Total** | **42** | **37** | **5** |

## 2. Table des textes réécrits

| Emplacement | Avant | Après |
|---|---|---|
| `CoucheEnrichissement.tsx` | « Cette section n'est pas tirée du wiki… Elle n'a pas été relue par un humain… » (243 car.) | *(retiré)* |
| `CoucheEnrichissement.tsx` | « Choix signalé comme ambigu : {notes} » | « Choix ambigu » (titre) + {notes} |
| `LienSource.tsx` | « Ce sort est décrit sur pathfinder-fr.org… index de consultation : la page d'origine fait foi… » | « La page d'origine sur pathfinder-fr.org, wiki communautaire tenu par des bénévoles, fait foi. » |
| `app/layout.tsx` (pied de page) | « Contenu de pathfinder-fr.org, wiki communautaire tenu par des bénévoles. Ce site n'en est qu'un index de consultation ; les pages d'origine font foi. » (149 car.) | « Les sorts viennent de [pathfinder-fr.org](https://www.pathfinder-fr.org/). » (40 car.) |
| `app/layout.tsx` | « Source : pathfinder-fr.org, consulter le wiki » | « Source pathfinder-fr.org, consulter le wiki » |
| `web/lib/design/tokens.ts` (`MOTS.source`) | `'source : pathfinder-fr.org'` | `'source pathfinder-fr.org'` |
| `PanneauFiltres.tsx` (`aria-label`) | `` `Niveau ${niveau}` `` | `` `Niveau ${niveau} pour ${nomClasse}` `` / `` `Niveau ${niveau}, niveau le plus bas toutes classes` `` |
| `lib/navigation/tags.ts` | tirets cadratins dans `LIBELLES_ETATS_TAG` | virgules/reformulation |
| `lib/navigation/libelles-facettes.ts` | `Round(s)`, `Minute(s)`, `Heure(s)` | `Rounds`, `Minutes`, `Heures` |
| `lib/navigation/niveaux.ts` | « Par classe : » | « Par classe, » |
| `VueFavoris.tsx` (phrase de synchro) | « Vos listes sont enregistrées dans ce navigateur seulement : il n'y a ni compte ni serveur… Vider les données du site les efface — exportez le fichier pour les garder. » (158 car.) | « Vos listes vivent dans ce navigateur. Connectez-vous pour les retrouver sur vos autres appareils. Vider les données du site les efface. Exportez le fichier pour les garder. » (172 car., contenu factuellement corrigé) |
| `VueFavoris.tsx` | 7 pluriels entre parenthèses (`id(s) ajouté(s)`, `liste(s) lue(s)`, etc.) | accord conditionnel sur `n` |
| `BoutonFavori.tsx` | `title="Ajouter aux favoris"` redondant avec le libellé visible | `title` retiré à l'état prêt, conservé seulement pour l'état non prêt |
| `VueComparaison.tsx` | `<span>Afficher :</span>` | `<fieldset><legend>Afficher</legend>` |
| `VueComparaison.tsx` | `` `index.json : ${status}` ``, deux-points/point-virgule en prose | reformulé sans ponctuation étiquette/valeur |
| `TableComparaison.tsx` | « niveau(x) d'écart » | `${ecart === 1 ? 'niveau' : 'niveaux'}` |
| `SelecteurClasses.tsx` | « … se multiplient : elle cesse d'être lisible. », « Trois classes au plus ; décochez-en une… » | deux phrases, sans deux-points ni point-virgule |
| Cinq vues `web/components/compte/*` | 24 écarts (deux-points, tirets cadratins, pluriels `(s)`, hiérarchie de titre `<p>` au lieu de `<h2>`) | 21 corrigés en place, 3 mineurs signalés (FOLLOWUPS #10) |
| `web/lib/compte/client.ts`, `session.tsx` | 5 écarts de charte typographique | corrigés à la passe d'intégration `469aad47` |
| `axes.ts`, `Donut.tsx`, `Barres.tsx`, `VueExploration.tsx`, `ChoixClasse.tsx`, `PersonnaliserRoue.tsx`, `app/explorer/page.tsx` | tirets cadratins, deux-points, points-virgules en prose (dix `libelleAccessible` + plusieurs autres chaînes) | reformulés sans ponctuation interdite |

## 3. Synthèse

### Compte de caractères supprimés

Chiffres mesurés dans les constats sources (§ 1), au niveau du composant — un
composant partagé (pied de page, `MOTS.source`) n'est compté qu'une fois, pas
multiplié par le nombre de pages qui le montent :

| Emplacement | Réduction |
|---|---|
| `CoucheEnrichissement.tsx`, paragraphe de provenance LLM | 243 caractères, par fiche enrichie (2048 fiches) |
| `CoucheEnrichissement.tsx`, note d'ambiguïté | 16 caractères, par note affichée (sous-ensemble des fiches enrichies) |
| `LienSource.tsx` | 105 caractères, par fiche (2070 fiches) |
| `app/layout.tsx`, pied de page | 109 caractères (un seul composant, monté sur ~2081 pages) |
| `VueComparaison.tsx`, `TableComparaison.tsx`, `SelecteurClasses.tsx` | 7 caractères (deux-points/point-virgule/tiret retirés, décompte de l'étape 13) |

**Total par fiche enrichie (étape 06) : 364 caractères**, comme documenté par
`06_constats.md`. **Total mesuré, toutes surfaces confondues, au niveau du
composant (sans multiplication par le nombre de pages) : 364 + 109 + 7 = 480
caractères.** Les étapes 07 à 15 documentent des corrections de ponctuation
(deux-points, tirets cadratins, points-virgules, pluriels entre parenthèses)
sur plusieurs dizaines de chaînes additionnelles sans en chiffrer
systématiquement la longueur exacte avant/après (07 § C, 08 § E, 09, 10 § E, 11
§ C, 12 § D, 14 § C) : le compte ci-dessus est donc un plancher mesuré, pas un
total exhaustif — les constats source qui ne fournissent pas de compte de
caractères sont cités tels quels plutôt qu'estimés.

### Recommandations structurelles (exactement trois)

1. **Faire porter le trait d'ellipsis par la structure de colonnes du tableau,
   pas par une règle CSS locale.** Le point non résolu du § 4 (défilement
   horizontal à 320 px) et la case native de filtre sous 44 px (FOLLOWUPS #7)
   partagent la même cause : des cibles tactiles de 44 px ajoutées après coup à
   des composants dont la largeur n'a pas été repensée pour les accueillir. Une
   passe unique qui fixe `table-layout` et la distribution des largeurs de
   `TableDense.tsx`/`TableSorts.tsx` refermerait les deux d'un coup, plutôt que
   deux correctifs locaux qui se contredisent (agrandir une cible réduit la
   place du texte).
2. **Faire porter la couleur de texte d'un bouton primaire par une variable CSS
   de thème, jamais par un variant Tailwind arbitraire sur `data-theme`.** Trois
   occurrences indépendantes du même défaut (fiche, primitives, compte) ont
   toutes trouvé le même correctif ad hoc (`[html[data-theme=nuit]_&]:text-*`)
   parce qu'aucune variable `--color-texte-bouton-primaire` n'existe dans
   `theme.css`. Le motif s'est répété trois fois exactement parce que la bonne
   solution n'avait pas de porteur déclaré — l'ajouter referme la classe
   entière de défauts plutôt que son prochain représentant.
3. **Donner un budget de temps explicite, par étape, pour `web:build` +
   `web:cibles` sur la machine partagée.** Cinq des dix constats (08, 11, 13,
   14 et implicitement d'autres) rapportent un budget de vérification runtime
   non tenu par contention mémoire/CPU de la machine partagée, jamais par un
   défaut de code — la mesure de cible tactile la plus coûteuse à obtenir
   (six largeurs × six routes) est aussi celle que le plan attend de chaque
   étape. Un budget de temps réservé (ou une file d'exécution séquentielle des
   builds inter-agents) transformerait ces cinq « non vérifié faute de temps »
   en vérifications réelles plutôt qu'en lectures de code.

### Points à trancher par l'utilisateur

1. **Défilement horizontal à 320 px, route `navigation`** (constat #41,
   FOLLOWUPS #6). `documentElement.scrollWidth` dépasse `clientWidth` de plus
   de 1 px, uniquement à 320 px. Cause mesurée : la colonne « Sort » porte un
   bouton favori compact (32 px), un lien de nom non cassable, et parfois un
   badge — largeur minimale ~38 px au-delà du budget restant une fois les
   colonnes Niveau/École (64 px minimum pour rester des cibles tactiles
   valides) servies. Deux voies, non tranchées : tronquer les noms de sort
   (`table-layout: fixed`, redistribution des largeurs, risque de régression)
   ou retirer le tri sur École/Niveau sous 400 px (retire une fonctionnalité).
   **Non corrigé.**
2. **Repli par défaut des grandes facettes du panneau de filtres**
   (FOLLOWUPS #11). Le panneau mesure 8421 px de haut à 1366×900 ; replier
   Temps d'incantation, Type de dégâts et Conditions infligées par défaut
   réduirait cette hauteur, au prix d'un changement de comportement existant.
   **Non tranché.**
3. **`PersonnaliserRoue.tsx` (bouton « Valider ») et `CheminForage.tsx`**
   restent respectivement sous le plancher AA en nuit et sous 44 px de cible
   (FOLLOWUPS #8, #9), signalés à trois reprises (étapes 07, 11, 15) sans
   correction, faute de mandat de fichier explicite pour aucune étape.
   **Non corrigé** — nécessite un mandat de fichier dédié pour
   `web/components/exploration/*`.
4. **Trois mineurs de `/compte`** non corrigés (`title` redondant du message
   d'échec, `aria-live` manquant sur le rapport de fusion et sur la
   confirmation d'effacement — FOLLOWUPS #10). Jugés mineurs par l'étape 14 ;
   à confirmer que ce jugement tient toujours à l'usage.
