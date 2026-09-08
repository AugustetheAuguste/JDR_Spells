# Synchronisation des fiches de personnage — étape 18

Ce document renvoie à `docs/synchro_favoris_supabase.md` plutôt que de le
dupliquer : le schéma général (deux appareils, un compte, Supabase comme
point de rendez-vous), la panne du 2026-08-31 et la leçon qui en découle
(« la composition est un composant testable ») s'appliquent tels quels aux
fiches. Ce fichier ne porte que ce qui diffère.

## Ce qui diffère des favoris

Une liste de favoris fusionne sans intervention humaine, une fiche non :
c'est un document édité en profondeur, et fusionner deux versions champ par
champ produirait un personnage que personne n'a écrit. `web/lib/fiche_personnage/fusion.ts`
refuse donc de choisir entre deux contenus qui diffèrent — il rapporte un
**conflit** (`Conflit`), jamais une résolution automatique.

| Règle | Fiches (`fusion.ts`) | Favoris (`synchro.ts`) |
|---|---|---|
| Contenu présent des deux côtés, différent | conflit, zéro écriture | fusion automatique (union des sorts) |
| Existence (tombstone) | dernier écrit gagne, comme les favoris | dernier écrit gagne |
| Schéma trop récent | ignorée, rapportée (`ignorees`) | pas de notion de version de schéma |

## Le piège spécifique aux fiches : ne jamais monter automatiquement une fiche jamais vue du compte

Une fiche créée hors ligne, avant la toute première connexion, ne doit
jamais partir vers le compte sans un geste explicite — sinon la règle 1 de
la fusion (« présente d'un seul côté, part de l'autre côté sans question »)
enverrait silencieusement tout ce qu'un lecteur a écrit hors ligne avant
même d'avoir ouvert `/compte`.

`web/lib/fiche_personnage/SynchroFiches.tsx` résout ceci en ne passant
jamais la liste complète des fiches locales à `fusionner()`. Il la scinde
d'abord :

- **connues** : présentes parmi les lignes distantes déjà lues (donc déjà
  parties d'un appareil, ou déjà proposées puis envoyées) — celles-ci vont
  dans `fusionner()`, avec le comportement normal des six règles.
- **jamais proposées** : tout le reste. Exposées comme `propositions` dans
  le contexte, jamais écrites nulle part sans un clic explicite sur
  « Envoyer » (`PropositionMontee.tsx`).

« Ignorer » une proposition l'ajoute à un ensemble d'ids persistant dans
`localStorage`, sous la clé `pf-fiche-propositions-ignorees` — délibérément
hors des préfixes `pf-fiche:` et `pf-fiche-secours:` de `magasin.ts`, pour
qu'un balayage du préfixe de fiche ne la ramasse jamais par erreur. Sans
cette persistance, les mêmes fiches reviendraient en proposition à chaque
rechargement.

## Référence code

| Rôle | Fichier |
|---|---|
| Le seul fichier qui parle à la table `fiches` | `web/lib/fiche_personnage/distant.ts` (`lireFichesDistantes`, `ecrireFichesDistantes`, `marquerSupprimee`) |
| La fusion, pure, sans réseau | `web/lib/fiche_personnage/fusion.ts` (`fusionner`) |
| Le déclenchement, l'état, les propositions et les conflits | `web/lib/fiche_personnage/SynchroFiches.tsx` (`FournisseurSynchroFiches`, `useSynchroFiches`) |
| La pile de contextes qui le monte | `web/components/Fournisseurs.tsx` |
| L'interface de proposition | `web/components/fiche_personnage/PropositionMontee.tsx` |
| L'interface de résolution de conflit | `web/components/fiche_personnage/DialogueConflit.tsx` |
| Le schéma SQL | `supabase/migrations/20260908000000_fiches_de_personnage.sql` |

## Vérifier que ça marche, sans lire le code

Même critère que les favoris (§ « Vérifier que ça marche » de
`docs/synchro_favoris_supabase.md`) : réseau, pas visuel. DevTools → Réseau,
filtre `rest/v1`.

1. **Créer une fiche hors ligne, puis se connecter sur `/compte`** → un
   `GET .../fiches?select=…`, et **aucun** `POST .../fiches` tant que la
   fiche n'a pas été explicitement proposée. La fiche apparaît dans la
   section « Fiches créées hors ligne ».
2. **Cliquer « Envoyer »** sur cette proposition → un `POST .../fiches`
   (upsert), et la fiche disparaît de la liste des propositions.
3. **Se connecter sur un second appareil avec le même compte** → la fiche
   envoyée à l'étape 2 apparaît directement dans ses fiches, sans étape de
   proposition sur ce second appareil (elle est désormais « connue »).
4. **Modifier la même fiche des deux côtés, puis resynchroniser** → le
   dialogue de conflit s'affiche, sans choix présélectionné, et ne se ferme
   pas seul.
5. **Se déconnecter** → `POST /auth/v1/logout?scope=local`, comme pour les
   favoris. Les fiches restent lisibles localement après la déconnexion.

## Ce qui a été simulé, honnêtement

Aucune instance Supabase réelle n'était accessible dans l'environnement où
cette étape a été construite. La vérification runtime a donc été faite avec
le client Supabase mocké (le même patron que `web/components/fournisseurs.test.tsx`
utilise pour les favoris), pas contre une base réelle. Le rapport de l'étape
(`build/fiche_personnage/reports/18_SYNCHRO_COMPTE_report.md`) détaille
précisément quels appels ont été observés en mock plutôt qu'en direct.
