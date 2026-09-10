# 12 — Favoris, constats

Étape `12_FAVORIS` de la passe d'audit UI/UX 2026-09. Périmètre :
`web/components/favoris/*`, `web/lib/favoris/stockage.ts` (lu, non modifié).

## A — la phrase fausse

Vérification faite en lecture seule sur `web/components/Fournisseurs.tsx`,
`web/lib/synchro/*` (en réalité `web/lib/compte/synchro.ts`, `distant.ts`,
`SynchroFavoris.tsx`) et `docs/synchro_favoris_supabase.md`, sans y écrire une
ligne.

Ce que le code fait réellement : sans compte, les favoris restent dans le
`localStorage` de l'appareil, sans jamais parler à Supabase. Avec un compte, le
`user_id` de la session sert de clé dans les tables `listes` et `listes_sorts`,
et chaque appareil connecté pousse ses favoris et récupère ceux des autres par
`fusionner()` (union des sorts, tombstones de suppression). C'est exactement ce
que documente `docs/synchro_favoris_supabase.md`.

La phrase du brief est donc cohérente avec le code, pas seulement avec les
intentions : « Vos listes vivent dans ce navigateur. Connectez-vous pour les
retrouver sur vos autres appareils. » a été retenue mot pour mot. Aucun écart
constaté entre la formulation et le comportement vérifié.

Ancienne phrase, 158 caractères :

> « Vos listes sont enregistrées dans ce navigateur seulement : il n'y a ni
> compte ni serveur, donc aucune synchronisation entre appareils. Vider les
> données du site les efface — exportez le fichier pour les garder. »

Nouvelle phrase, 172 caractères (la longueur totale du paragraphe a
légèrement augmenté parce que le deux-points et le tiret cadratin sont
devenus des points, pas parce que du contenu a été ajouté) :

> « Vos listes vivent dans ce navigateur. Connectez-vous pour les retrouver sur
> vos autres appareils. Vider les données du site les efface. Exportez le
> fichier pour les garder. »

## B — la hiérarchie des huit boutons

### Table des huit contrôles, avant et après

| Contrôle | Avant | Après |
|---|---|---|
| `select` de liste | dans la rangée d'actions, mêlé aux boutons | sorti au-dessus, en contexte, ne compte plus comme bouton |
| Nouvelle liste | contour, même poids que les autres | accent plein **seulement quand `etat.listes.length === 0`** ; contour sinon |
| Renommer | contour | contour, inchangé |
| Exporter en JSON | contour | contour, regroupé visuellement avec Importer |
| Importer un fichier | contour | contour, regroupé visuellement avec Exporter |
| Supprimer la liste | contour `desaccord`, même rangée que les autres | contour `desaccord`, séparé (`sm:ml-auto`), confirmation inchangée (déjà présente) |
| Fusionner avec la liste active (dialogue import) | accent plein | inchangé, accent plein, dans son propre dialogue |
| Créer de nouvelles listes (dialogue import) | contour | inchangé |

### La décision sur l'action primaire par état — l'arbitrage demandé

```
aucune liste               -> primaire  « Nouvelle liste »          [tranché]
une liste choisie, vide    -> primaire  « Parcourir les sorts »     [déjà géré par EtatVide]
une liste choisie, pleine  -> AUCUNE action primaire                [ce constat tranche ici]
```

Le point que le brief demande de trancher explicitement : faut-il que
« Exporter en JSON » devienne l'action primaire quand une liste choisie contient
des sorts ?

**Décision : non.** Une fois une liste choisie et non vide, la tâche de cet
écran est de la consulter — la table en dessous. Exporter est une opération de
sécurité ponctuelle, pas le but de la visite : la majorité des visites sur
`/favoris` avec une liste pleine servent à relire ou retirer des sorts, pas à
exporter. Marquer « Exporter en JSON » en aplat accent laisserait croire que
c'est l'action attendue, alors que l'action réelle (ajouter/retirer un sort) se
fait depuis l'étoile sur une fiche ou une ligne de résultat, pas depuis cette
page. Aucun bouton n'est donc en aplat accent dans cet état ; les cinq actions
(Nouvelle liste, Renommer, Exporter, Importer, Supprimer) restent toutes en
contour, à poids égal entre elles, ce qui est correct puisqu'aucune n'est plus
urgente que les autres dans cet état précis.

Ce qui reste vrai dans les trois états, garanti par un test
(`favoris.test.tsx`, « rend exactement un bouton en aplat accent quand aucune
liste n'existe ») : jamais plus d'un bouton en aplat accent visible à la fois.

### Ce qui ne demandait pas d'arbitrage — vérifié

- **Supprimer la liste** est bien séparé visuellement (`sm:ml-auto`, couleur
  `desaccord`, jamais `bg-accent`) et **demandait déjà une confirmation** avant
  cette étape (`role="alertdialog"`, bouton « Supprimer définitivement » distinct
  d'« Annuler »). Aucun ajout de logique n'a donc été nécessaire ici — le constat
  du brief («si elle n'existe pas, l'ajouter est un changement de logique à
  signaler») ne s'applique pas : elle existait déjà et n'a pas été touchée dans
  son fonctionnement, seulement dans son placement visuel.
- **Exporter en JSON** et **Importer un fichier** sont désormais posés côte à
  côte dans la rangée, comme la paire qu'ils forment.
- Le `select` de liste est sorti de la rangée de boutons ; il ne compte plus
  dans le décompte de boutons de la rangée et se lit comme un contexte
  au-dessus des actions.

### « Supprimer la liste » désactivé — le cas qui ne se produit pas

Le brief demande de vérifier que « Supprimer la liste » est désactivé (avec
raison lisible) quand aucune liste n'est choisie. Après lecture de
`web/lib/favoris/stockage.ts` (`garantirActive`), l'invariant du module est :
**des listes existent implique qu'une est active.** Le seul état où
`active === null` est celui où `etat.listes.length === 0` — donc où il n'y a
tout simplement pas de bouton « Supprimer la liste » à afficher, puisqu'il n'y a
rien à supprimer. Le bouton est masqué dans ce cas plutôt que rendu désactivé,
ce qui est cohérent avec l'invariant : un état « une liste existe mais aucune
n'est choisie » n'est pas atteignable, donc une désactivation avec raison n'y a
pas sa place. Le seul bouton réellement désactivé-avec-raison de cette vue est
« Fusionner avec la liste active » dans le dialogue d'import, déjà porteur de
son `title` explicatif avant cette étape et inchangé.

## C — les pluriels entre parenthèses

Tous supprimés. Une fonction locale `accorder(n, singulier, pluriel)` a été
ajoutée dans `VueFavoris.tsx`, sans dépendance d'internationalisation, parce que
le motif se répétait plus de trois fois (sorts ajoutés, déjà présents, listes
lues, listes écartées, identifiants inconnus, sorts dans une liste).

| Avant | Après |
|---|---|
| `{rapport.ajoutes} id(s) ajouté(s)` | `{n} sort ajouté` / `{n} sorts ajoutés` |
| `{rapport.deja} déjà présent(s)` | `{n} déjà présent` / `{n} déjà présents` |
| `{rapport.listes_lues} liste(s) lue(s)` | `{n} liste lue` / `{n} listes lues` |
| `{rapport.listes_ecartees} écartée(s) comme malformée(s)` | `{n} écartée comme malformée` / `{n} écartées comme malformées` |
| `{inconnus.length} inconnu(s)` | `{n} identifiant inconnu` / `{n} identifiants inconnus` |
| `{active.sorts.length} sort(s)` | `{n} sort` / `{n} sorts` |
| `{incident.nombre} liste(s) enregistrée(s) … malformées` | `{n} liste enregistrée était malformée` / `{n} listes enregistrées étaient malformées` |
| `Import terminé : {n} ajoutés` | `Import terminé. {n} sorts ajoutés, …` |

Décompte : 7 sites de pluriel entre parenthèses supprimés, 0 restant dans
`web/components/favoris/` (`grep -rn "(s)" web/components/favoris/` ne renvoie
rien après ce travail).

## D — la charte et les états

- Deux-points et point-virgule retirés partout dans ce périmètre : « Fichier lu.
  Rien n'a encore changé. » remplace « … : que faut-il en faire ? » (le
  deux-points de la phrase suivante est resté une phrase séparée, la question
  reste une vraie interrogation, pas une étiquette).
- Tiret cadratin en prose retiré (« C'est définitif — exportez-la » devient deux
  phrases).
- `min-h-cible` posé sur tous les contrôles réels de la vue : les six boutons de
  la rangée d'actions, les trois boutons du dialogue de suppression, les trois
  boutons du dialogue d'import, le `select` de liste, le champ de renommage. Un
  espacement `gap-2` (8 px) sépare chaque paire de contrôles voisins.
- `Fusionner avec la liste active` reste désactivé avec sa raison en `title`
  quand aucune liste n'est active — inchangé, déjà conforme.
- Aucun spinner : l'état non prêt affiche un texte (« Lecture des favoris… »),
  pas une roue.
- L'état vide (`EtatVide`) propose déjà une action (« Parcourir les sorts »),
  inchangé.
- **`BoutonFavori.tsx` portait un `title` qui redisait exactement son propre
  libellé** (`title="Ajouter aux favoris"` sur un bouton qui affiche déjà
  « Ajouter aux favoris », puis « Retirer des favoris » une fois basculé). Retiré
  quand `pret` est vrai ; conservé uniquement pour l'état non prêt (« Lecture
  des favoris en cours »), qui n'a pas d'équivalent dans le libellé visible ou
  accessible. Le test qui vérifiait l'ancien `title` a été réécrit pour vérifier
  son absence.
- Aucun autre `title` ne redit un libellé de bouton dans ce périmètre.

## Vérification — `npm --prefix web run test`, `lint`, `typecheck`

- `favoris.test.tsx` complet : **26/26 tests verts** (24 préexistants adaptés +
  2 nouveaux sur la hiérarchie des boutons).
- `eslint` sur `components/favoris` et `lib/favoris` : aucun signalement.
- `tsc --noEmit` sur tout `web/` : aucune erreur.
- La suite complète (`vitest run` sans filtre, plusieurs centaines de
  fichiers) n'a pas pu être menée à terme dans cet environnement : plusieurs
  agents de la vague 2 tournent en parallèle sur la même machine et le pool de
  workers de `vitest` s'est arrêté sur `ENOMEM`/`spawn UNKNOWN` par contention
  mémoire, pas par un échec de test — confirmé en observant un worker d'un
  **autre** worktree (`agent-a741a8a6f00036e9a`) actif au même moment. Le
  fichier de tests de ce périmètre, lui, a été exécuté isolément avec succès à
  plusieurs reprises.

## E — les tests

- Le test qui affirmait l'ancienne phrase fausse a été réécrit pour affirmer la
  nouvelle et l'absence explicite de « aucune synchronisation ».
- Ajouté : aucun `(s)` dans le rendu d'une vue avec liste active non vide.
- Ajouté : exactement un bouton en aplat accent est rendu quand aucune liste
  n'existe (« Nouvelle liste »).
- Les tests existants sur la confirmation de suppression, déjà présents, sont
  restés inchangés — ils passaient déjà, cette étape n'a rien dû y ajouter.
- Les assertions de texte des rapports d'import ont été mises à jour sur la
  nouvelle formulation sans pluriel entre parenthèses.
- `web/lib/favoris/stockage.test.ts` n'a pas été touché : la logique de
  persistance n'a pas changé.

## Vérification par les outils — `web:typo` et `web:cibles`

`npm run web:typo` (`tsx scripts/verifier_typographie.ts`) : 37 écarts au total
sur le site, répartis sur 16 fichiers — **aucun dans
`web/components/favoris/` ni `web/lib/favoris/`**. Le périmètre de cette étape
est propre.

`npm run web:cibles` (`tsx scripts/verifier_cibles.ts`, après `next build`,
6 largeurs × 6 routes) : 3920 écarts au total sur le site. Sur la route
`favoris/` spécifiquement, après filtrage des faux amis :

- **Aucun bouton de la rangée d'actions** (Nouvelle liste, Renommer, Exporter
  en JSON, Importer un fichier, Supprimer la liste), **du dialogue de
  suppression** ni **du dialogue d'import** ne descend sous 44 px. `min-h-cible`
  tient sur les six largeurs. Critère 9 satisfait pour tout ce qui est dans le
  périmètre de cette étape.
- **Trois écarts restent sur `favoris/`, tous hors périmètre** de cette étape et
  déjà rattachés à d'autres étapes du plan :
  - `button.rounded-jeton « Parcourir les sorts » mesure 152×40 px` : c'est
    `EtatVide.tsx`, un primitif explicitement possédé par `09_TIROIR_NAVIGATION`
    (table des périmètres de `00_CONTEXT.md`), pas par cette étape. Non touché.
  - Les liens de navigation (« Sorts », « Explorer », « Comparer », « Favoris »,
    « Compte »), « consulter le wiki » et « Thème nuit » : ce sont l'en-tête et
    le pied de page de `app/layout.tsx`, communs aux six routes — le même écart
    apparaît identique sur `navigation/`, `fiche/`, `comparaison/`,
    `exploration/` et `compte/`. Hors périmètre (`07_CADRE`, `15_PRIMITIVES`).
  - `input a une police de 14.5 px, plancher 16 px` : `--text-corps` est un
    jeton global (`tokens.ts`/`theme.css`), défaut n°6 de l'audit, explicitement
    confié à l'étape `10_TABLEAU_DENSE`. Le champ de renommage de cette vue en
    hérite mais n'est pas la cause.
  - `documentElement.scrollWidth dépasse clientWidth` à 320 px : identique sur
    les **six** routes du site, donc un défaut de la mise en page globale, pas
    de cette vue. Non causé par cette étape, non corrigible dans son périmètre.

## Fichiers touchés

- `web/components/favoris/VueFavoris.tsx`
- `web/components/favoris/BoutonFavori.tsx` (un seul `title` redondant retiré)
- `web/components/favoris/favoris.test.tsx`
- `design/audit_ui/12_constats.md` (nouveau, ce fichier)

`web/lib/favoris/stockage.ts`, `web/lib/favoris/contexte.tsx`,
`web/components/Fournisseurs.tsx` et `web/lib/compte/*` ont été lus mais pas
modifiés.
