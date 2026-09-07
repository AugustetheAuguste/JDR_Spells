# 07 SCHÉMA — rapport

## Réalisé

- `web/lib/fiche_personnage/schema.ts` : les interfaces du schéma, toutes en
  `readonly`, `VERSION_SCHEMA = 1`, les types `Caracteristique`, `Sauvegarde`,
  `Source`, et `Modificateur` à sept clés exactement (`libelle`, `valeur`,
  `type`, `origine`, `sourceUrl`, `saisieManuelle`, plus la clé implicite de
  la Skill déjà comptée dans les six énumérées).
- `web/lib/fiche_personnage/fiche-vide.ts` : `creerFicheVide(id, maintenant)`,
  pure, aucune date ni aléatoire générés dans la fonction, toutes les valeurs
  numériques à `null`, les six caractéristiques et les trois sauvegardes
  présentes, `sorts.mode` à `null` (aucun défaut inventé).
- `web/lib/fiche_personnage/valider.ts` : `valider(entree: unknown)` accumule
  tous les refus, juge la forme et jamais la plausibilité d'une valeur de
  jeu, refuse toute clé inconnue à la racine (nommée), tout modificateur dont
  les six clés ne sont pas exactement présentes, toute valeur numérique
  passée en chaîne, et toute clé contenant `poids`, `charge`, `encombrement`,
  `actuel`, `restant` ou `depense` n'importe où dans l'arbre.
- `web/lib/fiche_personnage/migrer.ts` : `migrer(entree)` refuse une version
  absente (jamais supposée à 1), refuse une version supérieure à la version
  connue sans tenter de la lire, applique `MIGRATIONS` (vide) palier par
  palier, refuse en nommant le palier manquant si la chaîne est rompue.
- Tests, `schema.test.ts`, `valider.test.ts`, `migrer.test.ts` — 15 tests,
  couvrant les neuf critères de vérification de
  `build/fiche_personnage/07_SCHEMA_FICHE.md`.
- Motifs de refus ajoutés à `MOTS` (`web/lib/design/tokens.ts`) plutôt que des
  chaînes en dur dans le validateur, cf. § 50 de la spécification.

## Vérifications faites

1. `npx vitest run web/lib/fiche_personnage` : 15/15 tests passent.
2. `npx tsc --noEmit` (dans `web/`) : aucune erreur, mode strict, aucun `any`
   introduit.
3. `npx eslint web/lib/fiche_personnage` : 0 erreur, 0 avertissement après
   correction des deux variables de déstructuration non utilisées dans les
   tests.
4. `npm run web:test` (racine) et une exécution isolée de `npx vitest run`
   dans `web/` : la suite complète du dépôt (977 tests) passe, à l'exception
   de 3 échecs par run, tous d'infrastructure (timeouts de worker
   `vitest-pool` sur des fichiers sans rapport, différents à chaque relance —
   `etat-url.test.ts`, `comparaison.test.tsx`, `VueArbre.test.tsx`,
   `verdicts.test.ts` selon la relance). Aucun de ces échecs ne touche
   `fiche_personnage`, confirmé par deux exécutions successives où les
   fichiers en échec changent.
5. `npx tsx scripts/verifier_typographie.ts` : 25 écarts préexistants, tous
   dans `web/lib/dons/moteur.ts`, `web/components/dons/*` et
   `web/app/dons/[slug]/page.tsx` — aucun dans `web/lib/fiche_personnage/`.
6. Recherche manuelle de `poids`, `charge`, `encombrement`, `actuel`,
   `restant`, `depense` sous `web/lib/fiche_personnage/` : les seules
   occurrences sont les chaînes du blocage de `valider.ts`
   (`MOTS_INTERDITS`) et le test qui vérifie ce blocage — aucune de ces
   chaînes n'est un nom de champ du schéma lui-même
   (`schema.ts`, `fiche-vide.ts`, `migrer.ts` en sont exempts).

## Hors périmètre, respecté

- Aucune fonction de calcul écrite.
- Aucun composant d'interface écrit.
- `data/regles/`, le header, le corpus : non touchés.
- Le registre `personnages` de compte : non touché, `personnageId` reste un
  champ optionnel jamais dérivé.

## Traçabilité

Sourcé
- Aucune page de pathfinder-fr.org lue à cette étape : le schéma ne porte
  aucune valeur de règle.

Déduit
- La forme des types depuis `build/fiche_personnage/07_SCHEMA_FICHE.md` et
  les invariants du Skill `pf-fiche-personnage`.

Inventé
- Les six libellés de motif de refus ajoutés à `MOTS`, texte d'interface
  destiné à l'affichage futur de l'import de fichier, jamais une valeur de
  règle.

Lacunes assumées
- Aucune. Le périmètre de cette étape ne comporte pas de recherche de règle.
