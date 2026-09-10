# Décisions — convergence du design system (2026-08-31)

Fait suite à `AUDIT.md`. Décisions prises, sans option à valider : le mandat de cette tâche est de
trancher, pas de proposer.

## D1 — Le système v2 « Grimoire » est abandonné ; v1 (déjà construit) devient la vérité unique

**Constat.** Deux systèmes coexistent dans le dépôt : v1, implémenté dans `web/` et documenté par
la Skill `pf-web-design-system` ; v2 « Grimoire », documenté par `GRIMOIRE_DESIGN_SYSTEM.md` et
matérialisé dans `design/vitrines/*`, jamais porté dans `web/`.

**Décision.** v1 gagne. v2 est retiré de `GRIMOIRE_DESIGN_SYSTEM.md` (qui devient la description de
v1, à jour) et les vitrines sont réécrites pour appliquer v1.

**Pourquoi, dans l'ordre.**

1. *Le garde-fou « minimal » de cette tâche l'exige.* v2 ajoute un double cadre décoratif, une
   ombre portée, un filet d'or de 3 px, un glyphe `❖` ornemental, une lettrine de 44 px et un thème
   nuit complet — soit une deuxième palette entière à maintenir en parallèle de la première, avec ses
   propres neuf couleurs d'école. Rien de tout cela n'est un dégradé (donc rien n'enfreint l'autre
   garde-fou), mais tout cela est plus chargé que v1, qui n'a aucun de ces éléments. Face à « préférer
   le plus simple au plus chargé », v2 perd sur sa direction même, indépendamment de son exécution.
2. *v1 est déjà construit, testé, et documenté comme faisant autorité.* `web/lib/design/tokens.ts`,
   `web/styles/theme.css` et 622+ tests (`tokens.test.ts`, `primitives.test.tsx`, `fiche.test.tsx`,
   `navigation.test.tsx`) appliquent v1. `tokens.test.ts` affirme explicitement l'absence du mode
   sombre (« le mode sombre est explicitement hors périmètre pour v1 »). Rejeter v1 au profit de v2
   signifierait réécrire l'intégralité de `web/` pour un système qui n'a jamais passé la phase de
   vitrine — c'est l'inverse du risque que cette tâche doit réduire, pas l'ampleur qu'elle doit
   ajouter.
3. *v1 est déjà conforme AA, mesuré, avec un seul défaut réel trouvé (D2).* v2 n'a jamais été vérifié
   par un test automatisé — ses ratios sont écrits dans `GRIMOIRE_DESIGN_SYSTEM.md` mais aucun
   `tokens.test.ts` équivalent n'existe pour lui.
4. *CLAUDE.md § 11 rappelle que le site est une fonction pure du dépôt, sans base ni route serveur ;
   un thème nuit avec bascule `localStorage` + script inline avant peinture est une fonctionnalité
   d'exécution supplémentaire, pas gratuite, pour un besoin non demandé par le brief de cette tâche.*

**Ce qui est conservé de v2, parce que ce n'est pas propre à l'ornementation rejetée :**
- le principe du marqueur de désaccord *sans couleur d'alerte dédiée* (v1 le fait déjà, différemment
  — voile `desaccordVoile`, pas de rouge) ;
- le vocabulaire figé (§10 de v2 ≈ `MOTS` de v1, déjà identique) ;
- la règle « niveau jamais nu, toujours relatif à une classe » (déjà appliquée dans `web/`).

Rien d'autre de v2 ne survit : ni la palette parchemin, ni Eczar/Lora, ni le rayon 0, ni le double
thème.

## D2 — `bordFort` est corrigé : `#C9C6C0` → `#8F8B82`

**Constat** (`AUDIT.md` §3) : `bordFort` sert de contour de contrôle réel (champ de recherche, panneau
de filtre, bouton favori — 21 fichiers). Un contour de contrôle est un élément d'interface (WCAG
SC 1.4.11, plancher 3:1), et `#C9C6C0` mesure 1,63:1 sur `base`, 1,70:1 sur `surface` : sous le
plancher applicable, dans les deux cas.

**Décision.** Nouvelle valeur `#8F8B82` : 3,25:1 sur `base`, 3,40:1 sur `surface` — tient le plancher
avec une marge, sans virer au gris foncé qui aurait concurrencé `encreFaible`. Un test est ajouté
(`tokens.test.ts`, « bordFort tient le plancher 3:1 ») pour qu'une régression future soit détectée
au lieu d'être seulement documentée.

**Pourquoi cette valeur n'a jamais été détectée avant** : `tokens.test.ts` vérifiait le contraste
texte (4,5:1) et les écoles, jamais les contours. `bordFort` n'est pas du texte, donc aucune des
assertions existantes ne le couvrait. C'est un point mort de couverture, pas une faute de jugement au
moment du choix initial — le même mode de défaillance que celui déjà noté pour `encreFaible` dans le
Skill (« la première valeur essayée... c'est le test qui l'a dit »), mais côté contour plutôt que
côté texte.

## D3 — La Skill est corrigée sur la pastille d'école, pour suivre le code (déjà correct)

**Constat** (`AUDIT.md` §4) : la Skill documente « aplat, texte blanc dessus » ; le code réel fait
un carré de couleur séparé + libellé en encre, parce que le blanc sur certaines écoles (Transmutation)
tombe à 2,7–3,9:1, sous AA.

**Décision.** La Skill est corrigée pour décrire le code, pas l'inverse : le code est le comportement
correct et vérifié (`PastilleEcole.tsx`, commentaire en place), la Skill était simplement en retard.
Aucun changement de composant n'est nécessaire.

## D4 — Aucun autre changement de valeur dans `web/lib/design/tokens.ts`

Le reste de la palette, l'échelle typographique, la densité et la police passent l'audit sans
défaut : contrastes mesurés indépendamment et conformes (`AUDIT.md` §3), pas de dégradé, focus
toujours visible, `prefers-reduced-motion` respecté, couleur jamais seule porteuse d'information.
Aucune retouche « parce qu'on refait une passe » sans defect identifié — modifier une valeur qui
passe déjà tous les planchers pour le plaisir de la nouveauté casserait la traçabilité des choix
déjà justifiés dans la Skill (l'historique de `encreFaible` et de l'accent, notamment).

## D5 — `GRIMOIRE_DESIGN_SYSTEM.md` est réécrit en place comme description de v1

Il cesse de décrire v2 et devient le document maître de v1 : mêmes valeurs que `tokens.ts` /
`theme.css` / la Skill, une seule fois, sans « v1 vs v2 » à trancher pour le lecteur suivant. La
Skill reste l'autorité en cas de divergence future (CLAUDE.md §5) ; ce document en est la vue
d'ensemble narrative, pas une deuxième source.

## D6 — Les vitrines sont réécrites pour appliquer v1, pas synthétisées à partir de v2

Les six fichiers de `design/vitrines/` sont retouchés en place (mêmes noms de fichiers, mêmes rôles)
pour montrer la palette, la typographie et la densité de v1 telles que `web/` les construit déjà.
Elles perdent : le thème nuit et sa bascule, le double cadre, le filet d'or, la lettrine, le glyphe
ornemental. Elles gardent : la structure de mise en page (colonnes de filtres, grille de tableau,
disposition de fiche), qui n'est pas spécifique à v2.

---

## D7 — D1 est renversée : Grimoire est la direction adoptée, par arbitrage humain explicite (2026-08-31, plus tard le même jour)

**Constat.** D1 a fait un choix de direction, pas un calcul : le prototype Grimoire non paré
(double cadre, ombre de cadre, filet d'or 3px, glyphe `❖`, lettrine flottante de 44px, thème
jour/nuit complet) a été jugé plus chargé que v1, et abandonné pour cette raison. `FOLLOWUPS.md`
notait explicitement que ce jugement restait « un arbitrage humain, pas un fait technique »,
révisable. Il a été révisé : **un humain a explicitement demandé que Grimoire soit la direction
adoptée**, en réponse directe au raisonnement de D1.

**Décision.** Grimoire remplace v1 dans `web/`. Ce n'est pas un retour au prototype non paré : le
renversement porte sur la *conclusion* de D1 (abandonner plutôt que parer), pas sur son
*diagnostic* (le prototype non paré était effectivement plus chargé que nécessaire). Grimoire est
donc adopté sous une forme parée, tenue aux deux garde-fous de cette tâche :

1. **Aucun dégradé.** Le prototype n'en avait pas — vérifié à nouveau, aucun n'a été introduit par
   cette passe (`grep -r gradient web/ design/` après coup, zéro résultat hors ce document).
2. **Le plus simple au plus chargé.** C'est ici que le prototype perd, et c'est ce qui est retiré
   ou réduit, terme à terme :
   - **Double cadre + ombre de cadre** → un seul filet de 1px `bord`/`bord_fort`, comme les
     composants réels le faisaient déjà pour un panneau. Retiré entièrement, rien ne le remplace :
     aucune fonction ne s'accrochait au second cadre.
   - **Filet d'or 3px décoratif** → retiré ; l'accent oxblood porte la fonction (ligne sélectionnée,
     lien, focus), le filet ne portait qu'une fonction esthétique.
   - **Glyphe ornemental `❖`** → retiré, sans remplacement. Aucun texte alternatif ne le décrivait
     dans le prototype ; un glyphe purement décoratif et non annoncé aux lecteurs d'écran est
     exactement le type d'ornement que « préférer le simple » vise.
   - **Lettrine flottante 44px** → réduite à la première lettre du nom de sort en couleur `accent`
     via `::first-letter` (classe `.lettrine`), dans le même bloc de texte : pas de boîte, pas de
     retrait de texte, pas de hauteur distincte. C'est un ornement fonctionnel (identité visuelle,
     coût nul en mise en page) et non plus un ornement décoratif (coût réel en mise en page).
   - **Thème jour/nuit** → **conservé**. Ce n'est pas un ornement à parer : c'est une permutation
     plate de palette (aucune valeur n'est un dégradé), choisie explicitement par le lecteur et
     mémorisée (`localStorage`), appliquée par un script inline avant peinture — pas de flash, pas
     de dépendance serveur, compatible avec `output: 'export'` (CLAUDE.md § 11). Le coût de
     maintenance que D1 citait (« une deuxième palette entière ») est réel mais n'est pas, en soi,
     de la charge visuelle — les deux garde-fous de cette tâche portent sur le rendu, pas sur la
     taille du fichier de jetons.
   - **Rayon 0 (angles droits)** → conservé sans changement : c'est le seul point où l'identité
     Grimoire et le garde-fou minimalisme s'accordent sans arbitrage, un rayon de 0 étant à la fois
     l'esthétique du prototype et la valeur la plus simple possible.
3. **Palette et typographie (Eczar/Lora, parchemin, oxblood) survivent intégralement** : rien dans
   une police ou une couleur de fond n'est, en soi, un ornement « chargé » — la charge que D1
   pointait venait des éléments listés ci-dessus, pas de la palette.

**Ce qui n'est pas repris de v1** : la palette neutre proche du blanc, l'accent vert, Fraunces/Inter.
Le seul survivant de v1 au-delà de la structure DOM des composants (qui n'était de toute façon
spécifique à aucune des deux directions) est IBM Plex Mono, neutre par rapport aux deux — les
niveaux par classe ont besoin d'une police à chiffres tabulaires quelle que soit la direction
visuelle retenue autour.

## D8 — Recomputation complète des jetons de contraste contre le nouveau fond parchemin

**Constat.** Le fond `base` change de `#FAFAF9` (luminance relative 0,94, quasi-blanc) à `#F1E7D2`
(luminance relative 0,805, parchemin). C'est une baisse de ~14 points de luminance : toute valeur
tarée pour tenir un plancher de contraste contre l'ancien fond doit être **recalculée**, pas
supposée tenir encore, parce qu'un plancher tenu de justesse sur un fond plus clair peut tomber sous
un fond plus sombre.

**Ce qui a été recalculé, par calcul (luminance relative WCAG 2.1), pas à l'œil** — méthode : script
Node autonome, indépendant de `tokens.test.ts`, pour éviter de vérifier une valeur avec le calcul
qui l'a produite :

- **Les neuf pastilles d'école**, une par une, contre le nouveau `base`. Sept sur neuf tenaient déjà
  (`abjuration` 5,49:1 … `necromancie` 9,42:1) ; deux non — `evocation` (`#B3421F`, retombait à
  4,60:1) et `transmutation` (`#8A6412`, retombait à 4,37:1, sous AA). Assombries à `#A53D1D`
  (5,21:1) et `#866213` (4,54:1, le nouveau plancher). Le plancher annoncé par le Skill passe de
  5,13:1 à 4,53:1 en conséquence — pas une régression choisie, la valeur réelle de ce que le
  parchemin permet une fois les deux teintes limites corrigées.
- **`encre_faible`** (le plancher de lisibilité), retaré contre le nouveau fond : `#776040`,
  4,84:1 — la même marge relative que l'ancien `#736F67` à 4,79:1 sur l'ancien fond, pas la même
  valeur héritée.
- **`bord_fort`**, retaré de la même façon : `#927C5D`, 3,25:1/3,58:1 (base/surface) — l'ancienne
  valeur corrigée par D2 (`#8F8B82`) n'a pas été réutilisée, parce qu'elle était calibrée contre
  l'ancien `base` et n'a aucune raison de retomber juste sous le nouveau.
- **L'accent** : nouvelle couleur (oxblood, `#7E2537`) plutôt que retarage de l'ancien vert, parce
  que la teinte elle-même n'a plus de raison d'être — le vert n'avait pas de valeur intrinsèque hors
  de la contrainte « à 25° de toute école », qui se recalcule de zéro avec la même méthode.
- **La palette nuit**, entièrement neuve (aucun équivalent dans le système précédent) : chaque paire
  encre/fond, bord/fond et accent/fond vérifiée séparément. Deux ajustements ont été nécessaires
  après une première passe de valeurs « évidentes » : `accent_survol` nuit devait être **plus
  clair** que `accent` nuit (pas plus sombre — la direction s'inverse sur fond sombre, voir Skill
  § L'accent) ; `desaccord_voile` nuit devait être plus sombre que la teinte de parchemin nocturne
  utilisée pour les autres voiles (`#302117` ne tenait que 4,08:1 contre le `desaccord` nuit
  éclairci, sous AA — `#1F150F` tient 4,72:1).
- **`RAMPE_CATEGORIELLE`** (nuancier du graphique d'exploration) : revérifiée contre le nouveau
  `base` jour et tient (plancher 3,86:1, `#6B7A1E`) sans retouche. **Non** revérifiée avec succès
  contre `COULEURS_NUIT.base` — plusieurs teintes tombent sous 3:1 (jusqu'à 2,33:1). Noté en
  `FOLLOWUPS.md` plutôt que masqué : `/explorer` ne lit pas encore `data-theme`, donc rien n'est
  cassé en pratique, mais le nuancier n'est pas prêt pour la nuit tel quel.

**Pourquoi recalculer plutôt que retester.** `tokens.test.ts` vérifie que les valeurs *choisies*
tiennent leurs planchers — il ne dit rien sur *quelle* valeur choisir. Un script de calcul
indépendant, exploré par balayage de teinte/luminosité jusqu'au premier point qui tient le plancher
avec une marge raisonnable, est ce qui a produit les hex ci-dessus ; `tokens.test.ts` les vérifie
ensuite, une deuxième fois, avec une méthode de calcul écrite indépendamment. Les deux s'accordent.
