# 14 — Constats, routes de compte

Étape 14 de l'audit UI/UX 2026-09. Périmètre : `web/components/compte/*`,
`web/app/compte/**`, plus un fichier de test nouveau.

## A — Le bouton primaire, le bloquant

Défaut n°1 (`00_CONTEXT.md`) : `elements.tsx:151` portait
`border-accent bg-accent font-semibold text-white hover:bg-accent-survol`.

Contrastes mesurés (fonction `contraste` de `tokens.test.ts`, WCAG 2.1) :

| Paire | Jour | Nuit |
|---|---|---|
| `text-surface` sur `accent` | 8,53:1 | **4,34:1 — échec AA** |
| `text-base` sur `accent` | 7,75:1 | **4,77:1 — passe AA** |
| `text-encre` sur `accent` | 1,67:1 — échec | 2,86:1 — échec |

Le brief anticipait `text-surface` comme réponse probable en nuit. Mesuré et
faux : `COULEURS_NUIT.surface` (`#26201A`) est trop proche de `COULEURS_NUIT.accent`
(`#D16170`) pour tenir 4,5:1, il retombe à 4,34:1. `COULEURS_NUIT.base` (`#1E1710`,
le fond de page, plus sombre que `surface`) est le seul jeton texte qui tient AA
dans les deux thèmes. Corrigé en `text-base`, une classe qui résout la variable de
thème `--color-base`, donc le texte change de couleur avec le thème sans ternaire
JavaScript. Aucun jeton nouveau n'a été nécessaire.

## B — Le balayage global des couleurs Tailwind par défaut

Grep large du brief lancé sur tout `web/` (`app/`, `components/`, `lib/`, `styles/`) :
aucune occurrence restante après la correction du point A. Le seul `text-white` du
dépôt était celui du point A.

Garde ajoutée : `web/lib/design/couleurs-tailwind.test.ts`, fichier nouveau. Il
liste récursivement tout `.ts`/`.tsx`/`.css` sous `web/` et échoue si un utilitaire
`text-`, `bg-`, `border-`, `ring-`, `decoration-`, `divide-`, `outline-` ou
`shadow-` porte une couleur Tailwind par défaut (blanc, noir, ou une des familles
nommées). Il n'est pas `skip` : le balayage n'a rien trouvé hors du point A, donc
rien à porter à l'étape 16.

## C — Les 1130 lignes, ligne par ligne

Audit exhaustif des cinq vues et des cinq routes. Chaque ligne est un défaut
observé, jamais un regroupement.

| Fichier | Ligne | Constat | Sévérité | Statut |
|---|---|---|---|---|
| `elements.tsx` | 63 | Champ `ChampTexte`, hauteur réelle ≈ 34 px, sous 44 px, et `text-corps` (14,5 px) sous 16 px, zoom iOS au focus | majeur | **corrigé** — `min-h-cible`, `text-grand` (17 px) |
| `elements.tsx` | 147-153 | `Bouton`, hauteur réelle ≈ 34 px, sous 44 px, racine du défaut répété dans les autres fichiers | majeur | **corrigé** — `min-h-cible` |
| `elements.tsx` | 151 | Bouton primaire `text-white`, échec AA 2,86:1 en nuit | bloquant | **corrigé** — voir point A |
| `VueChangerEmail.tsx` | 62 | « actuelle : » deux-points en prose | majeur | **corrigé** — virgule |
| `VueChangerEmail.tsx` | 54, 96 | Liens stylés en texte inline, sans `min-h-cible`, zone cliquable sous 44 px | majeur | **corrigé** — `inline-flex min-h-cible items-center` |
| `VueChangerEmail.tsx` | 50-56 | Message d'échec dit la cause, l'action corrective est un lien séparé plutôt que dans la phrase | mineur | non corrigé, présentation jugée suffisante, le lien reste visible et associé |
| `VueCompte.tsx` | 57-59 | Titre de `HorsService` en `<p>`, pas de heading : casse la hiérarchie pour un lecteur d'écran | majeur | **corrigé** — `<h2>` |
| `VueCompte.tsx` | 31-33 | « Un compte : » deux-points, « n'ajoute qu'une chose — retrouver » tiret cadratin en prose | majeur | **corrigé** — reformulé sans deux-points ni tiret |
| `VueCompte.tsx` | 61, 65-66 | « pas une panne : » deux-points, « ANON_KEY — voir » tiret cadratin en prose | majeur | **corrigé** |
| `VueCompte.tsx` | 160, 163, 166, 169 | Pluriels entre parenthèses `liste(s)`, `sort(s)`, `fusionnée(s)`, etc. | majeur | **corrigé** — accord conditionnel sur le nombre réel |
| `VueCompte.tsx` | 186, 202 | Liens stylés bouton, `px-3 py-2` sans `min-h-cible`, sous 44 px | majeur | **corrigé** |
| `VueCompte.tsx` | 225, 227-228 | « ferme la session ; » point-virgule, « reste actif — pour le retirer » tiret cadratin en prose | majeur | **corrigé** — deux phrases |
| `VueCompte.tsx` | 286 | « lui-même : vous ne pourrez plus » deux-points en prose | majeur | **corrigé** |
| `VueCompte.tsx` | 396, 409 | Boutons de bascule de mode, `px-3 py-2` sans `min-h-cible` | majeur | **corrigé** |
| `VueCompte.tsx` | 481 | « par e-mail : ouvrez le lien » deux-points en prose | majeur | **corrigé** |
| `VueCompte.tsx` | 123-127, 473-476 | Liens « Changer d'adresse » et « Mot de passe oublié ? », sous 44 px | majeur | **corrigé** |
| `VueCompte.tsx` | 232 | Texte de confirmation dynamique (« Effacer les listes… ? ») sans `role`/`aria-live` propre | mineur | non corrigé — le bouton « Oui, effacer » qui suit immédiatement porte l'action, le texte est visuellement adjacent et le focus reste dans la zone |
| `VueCompte.tsx` | 152-178 | Rapport de fusion affiché sans conteneur `aria-live`/`role="status"` propre (contrairement à `Annonce`) | mineur | non corrigé — porté ici pour l'étape 16 ou une passe ultérieure, changer le comportement d'annonce touche au flux de synchro, hors présentation pure |
| `VuePersonnages.tsx` | 28-31 | « niveau — et peut être » tiret cadratin, « compte : il n'y a pas de repli » deux-points en prose | majeur | **corrigé** |
| `VuePersonnages.tsx` | 51 | Lien « Aller au compte », sous 44 px | majeur | **corrigé** |
| `VuePersonnages.tsx` | 185 | `.join(' — ')`, tiret cadratin dans un libellé affiché (« barde — niveau 4 ») | majeur | **corrigé** — `.join(', ')`, `personnages.test.tsx:103` mis à jour en conséquence |
| `VuePersonnages.tsx` | 232 | Aide « Facultatif — texte libre » tiret cadratin en prose | majeur | **corrigé** — virgule |
| `VuePersonnages.tsx` | 47-53 | Message d'échec, action corrective portée par un lien séparé plutôt que dans la phrase | mineur | non corrigé, même raisonnement que `VueChangerEmail` |
| `VueReinitialiser.tsx` | 76-79 | « un nouveau : rien n'a été modifié » deux-points en prose | majeur | **corrigé** — deux phrases |
| `VueReinitialiser.tsx` | 82, 97 | Liens « Demander un nouveau lien », « Aller au compte », sous 44 px | majeur | **corrigé** |
| `VueMotDePasseOublie.tsx` | 76 | Lien « Retour au compte », sous 44 px | majeur | **corrigé** |

Points vérifiés sans défaut trouvé, donc absents du tableau ci-dessus : label
associé sur chaque champ (`ChampTexte` impose `htmlFor`/`id`), `autoComplete`
correct sur chaque champ mot de passe (`new-password` à l'inscription et à la
réinitialisation, `current-password` à la connexion), absence de spinner, ordre
de tabulation, absence de piège au clavier, un seul `h1` par route, information
jamais portée par la seule couleur, absence de texte alternatif faux ou vide.

**Hors périmètre, porté pour l'étape 16.** `web/lib/compte/client.ts:41-42` et
`web/lib/compte/session.tsx:111,121,248` portent 5 écarts de charte typographique
(deux-points, tiret cadratin) détectés par `npm run web:typo`. Ces deux fichiers
ne sont listés dans le périmètre d'aucune étape de la vague 2 ; ils ne sont donc
pas touchés ici pour ne pas casser un worktree parallèle sans mandat explicite.

## D — Cibles et responsive

Chaque bouton, lien et champ des cinq routes porte désormais `min-h-cible`
(44 px, via `--spacing-cible` de `theme.css`, étape 04). Les champs de saisie
(`ChampTexte`) sont passés de `text-corps` (14,5 px) à `text-grand` (17 px) pour
rester au-dessus du seuil de 16 px qui déclenche le zoom automatique au focus
sur iOS.

**Vérification runtime non concluante — contrainte d'environnement.** `npm run
web:cibles` exige `web/out/` (`next build`, 2081 pages). Trois tentatives de
`next build` dans ce worktree ont échoué par épuisement mémoire du processus
Node (`FATAL ERROR: ... out of memory`, y compris avec
`NODE_OPTIONS=--max-old-space-size=4096`), et une tentative a échoué au niveau
du shell lui-même (`fork: retry: Resource temporarily unavailable`). Plusieurs
étapes de cet audit tournent en parallèle sur la même machine, chacune dans son
propre worktree, et plusieurs semblent construire en même temps : la contention
mémoire est celle de la machine partagée, pas un défaut introduit par cette
étape. `npm run web:cibles` n'a donc pas pu être exécuté jusqu'au bout dans cette
session. Ce qui a pu être vérifié sans navigateur réel :

- `npm --prefix web run test` : 700 tests verts, dont les 136 des routes de
  compte et de `lib/design/`.
- `npm --prefix web run lint` : aucun écart.
- `npm --prefix web run typecheck` : aucun écart.
- `npm run web:typo` : aucun écart sur `web/components/compte/` ni
  `web/app/compte/` (33 écarts restants, tous hors périmètre).
- Lecture manuelle du CSS généré : `min-h-cible` résout `min-height: 44px` via
  `--spacing-cible: 44px` (`theme.css:191`), déjà utilisé et vérifié par
  d'autres jetons de la palette.

**À refaire avant la fusion finale ou par l'étape 16** : relancer `npm run
web:cibles` sur ce worktree une fois la contention mémoire retombée, et
confirmer qu'aucun contrôle de `compte/` ne mesure sous 44 px aux six largeurs.

## E — Parcours clavier, les cinq routes

Vérifié par lecture du DOM et de la logique de focus plutôt qu'en pilotage
Playwright réel (indisponible pour la même raison que D). Chaque champ et
bouton est un élément natif (`input`, `button`, `a`), aucun `tabIndex` positif
ni négatif n'est posé nulle part dans `web/components/compte/`, et l'ordre du
DOM suit l'ordre visuel sur les cinq vues (`h1`, texte d'introduction, formulaire
ou état, liens de sortie). Aucun `onKeyDown` ne consomme `Tab` ou `Escape`, donc
aucun piège au clavier n'est possible depuis ce code. Les deux boîtes de
confirmation (`VuePersonnages`, suppression de personnage ; `VueCompte`,
suppression de compte) restent dans le flux normal du document, sans `focus()`
programmatique qui déplacerait le focus hors de la zone visible.

## F — Charte et registre

Toutes les chaînes affichées des cinq routes ont été relues pour l'impératif
vouvoyé, l'absence de deux-points, de point-virgule, de tiret cadratin en prose
et de pluriel entre parenthèses. Les écarts trouvés sont listés dans la table du
point C ; ils sont tous corrigés dans ce périmètre. Aucun `title` redondant avec
le libellé visible de son contrôle n'a été trouvé dans `compte/`.
