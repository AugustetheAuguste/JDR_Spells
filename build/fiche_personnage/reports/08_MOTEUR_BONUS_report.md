# 08 MOTEUR, bonus typés — rapport

## Réalisé

- `web/lib/fiche_personnage/regles.ts` : `chargerRegles(lecteur)`, `lecteur`
  injecté (`LecteurTable = (nomFichier) => string | null`), lit les cinq
  tables publiées sous `web/public/data/regles/`, vérifie la présence de
  `meta` et `donnees` pour chacune, extrait et type `typesBonus` (`TypeBonus[]`)
  et `modificateursCarac` (union `{ bornes }` / `{ valeurs }`), porte
  `sortsBonus`, `armures` et `progressionClasses` tels que lus sous
  `donnees`, non interprétés à cette étape. Une table absente, illisible ou
  mal formée rend `null` — jamais une valeur de substitution — sans faire
  échouer les autres tables.
- `web/lib/fiche_personnage/resoudre.ts` : `resoudre(modificateurs, typesBonus)`,
  le contrat `{ total, detail, manquants }` et le type `Contribution` à cinq
  clés (`libelle`, `valeur`, `type`, `retenue`, `motifEcart`). Implémente la
  règle de non cumul par type lue dans `types_bonus.json` : type cumulable →
  tout retenu ; type non cumulable → le meilleur bonus (valeur ≥ 0) **et** le
  pire malus (valeur < 0) retenus ensemble, le reste écarté avec un motif
  nommant le modificateur supplantant ; type dont `cumulable` vaut `null` ou
  type inconnu de la table → tout retenu, le type ajouté à `manquants` (la
  maxime de sûreté du dépôt : un type non tranché ne bloque jamais). `typesBonus`
  à `null` → `total` `null`, aucune contribution retenue, `manquants` porte
  `types_bonus`. Liste de modificateurs vide → `total` `0`, seul zéro légitime
  de cette étape (commenté comme tel dans le code). Regroupement et calcul par
  identité d'objet (`Map<Modificateur, …>`), jamais par index numérique, pour
  rester conforme à `noUncheckedIndexedAccess` et pour que deux modificateurs
  de même libellé et de même valeur restent deux lignes distinctes du détail.
- `web/lib/fiche_personnage/caracteristiques.ts` : `modificateurCaracteristique(valeur, table)`
  lit la table sous sa forme `bornes` ou `valeurs`, jamais les deux, ne
  calcule aucune formule, rend `introuvable` (et le nom du champ manquant)
  pour une valeur `null`, une table `null`, ou une valeur hors des bornes
  lues — sans jamais extrapoler ni interpoler. `valeurEffectiveCaracteristique(entree, typesBonus)`
  additionne la base et le total résolu de `resoudre` sur les modificateurs de
  l'entrée, et propage `introuvable` depuis l'une ou l'autre source sans
  jamais produire une somme partielle.
- Trois motifs d'écart ajoutés à `MOTS` (`web/lib/design/tokens.ts`) :
  `ficheMoteurTypesBonusIntrouvable`, `ficheMoteurSupplantePar` (composé avec
  le libellé du modificateur retenu, entre guillemets français, jamais de
  deux-points), `ficheMoteurModificateurCaracteristique`.
- Tests : `regles.test.ts` (7 tests), `resoudre.test.ts` (12 tests),
  `caracteristiques.test.ts` (9 tests) — fixtures locales en dur dans les
  tests, jamais les vraies tables publiées, pour ne dépendre d'aucun export.

## Vérifications faites

1. `npm run web:test` (racine, `web:test` = `vitest run` + `eslint .` +
   `tsc --noEmit` dans `web/`) : **1017/1017 tests passent** (68 fichiers),
   **0 erreur ESLint** (2 avertissements préexistants et sans rapport, dans
   `migrer.test.ts`/`valider.test.ts`), **`tsc --noEmit` sans erreur**, mode
   strict, aucun `any` introduit. Les cinq lignes `ÉCHEC` imprimées par la
   suite sont la sortie console d'un test qui vérifie volontairement des
   fixtures de contrat en défaut (`endurance`, `index_dons`) — le compte final
   (`1017 passed`) confirme qu'aucun test n'a réellement échoué.
2. Critère 2 (deux bonus non cumulables, le plus élevé retenu, l'autre présent
   avec `retenue: false` et un `motifEcart` non vide) : `resoudre.test.ts`,
   « type non cumulable, deux bonus ».
3. Critère 3 (bonus et malus de même type non cumulable, les deux retenus) :
   `resoudre.test.ts`, « type non cumulable, bonus et malus » (deux cas, dont
   deux malus où le pire est retenu et le moindre écarté avec motif).
4. Critère 4 (deux bonus cumulables, somme) : `resoudre.test.ts`, « type
   cumulable ».
5. Critère 5 (type inconnu, retenu, ajouté à `manquants`) : `resoudre.test.ts`,
   « type inconnu de la table ».
6. Critère 6 (`cumulable` à `null`, tout retenu, ajouté à `manquants`) :
   `resoudre.test.ts`, « cumulable non tranché par la source ».
7. Critère 7 (`typesBonus` à `null`) : `resoudre.test.ts`, « table des types de
   bonus introuvable ».
8. Critère 8 (liste vide → `total` `0`, commenté) : `resoudre.test.ts`,
   « liste vide », avec le commentaire requis dans `resoudre.ts` lui-même.
9. Critère 9 (valeur hors des bornes lues → `null`, sans extrapolation) :
   `caracteristiques.test.ts`, « rend introuvable, sans extrapoler ».
10. Critère 10 (aucune contribution `retenue: false` avec `motifEcart: null`) :
    `resoudre.test.ts`, « contrat sur motifEcart », et vérifié par
    construction dans `resoudre.ts` (le motif n'est lu que dans la branche où
    `retenue` est fausse).
11. Aucune valeur de règle Pathfinder dans le code livré : recherche des
    littéraux numériques dans `regles.ts`, `resoudre.ts`, `caracteristiques.ts`
    — seules occurrences, des références de section (`§ 3`, `§ 6`), des
    littéraux structurels (`0` pour le total d'une liste vide, comparaisons
    `>= 0` / `< 0` pour distinguer bonus et malus). Aucune table de nombres.
12. `npm run web:typo` : 25 écarts, tous préexistants dans `web/lib/dons/`,
    `web/components/dons/`, `web/app/dons/[slug]/page.tsx` — confirmé par
    `git stash` (même 25 écarts sans les fichiers de cette étape). Aucun écart
    dans `web/lib/fiche_personnage/`.

## Hors périmètre, respecté

- Aucune fonction ne prend la `Fiche` entière — les fonctions de haut niveau
  restent aux étapes 09, 10 et 11.
- Aucune valeur de règle Pathfinder écrite dans le code ; les cinq tables
  arrivent en argument, jamais chargées par défaut ni codées en dur.
- `data/regles/`, le header, la persistance, l'étape 13 : non touchés.

## Traçabilité

Sourcé
- Aucune page de pathfinder-fr.org lue directement à cette étape : les
  valeurs de règle proviennent uniquement des tables déjà publiées par
  l'étape 06 (`types_bonus.json`, `modificateurs_caracteristiques.json`), que
  ce moteur lit sans les reproduire.

Déduit
- L'algorithme de non cumul (meilleur bonus et pire malus retenus ensemble
  pour un type non cumulable) depuis le pseudo-code de
  `build/fiche_personnage/08_MOTEUR_BONUS.md` et le contrat à sept clés du
  Skill `pf-fiche-personnage` § 6.
- Le regroupement par identité d'objet plutôt que par index, déduit de la
  contrainte `noUncheckedIndexedAccess` du `tsconfig.json` existant et de
  l'exigence « ne pas fusionner les contributions de même libellé ».

Inventé
- Les trois motifs d'écart ajoutés à `MOTS`, texte d'interface destiné à
  l'affichage futur du détail d'un calcul, jamais une valeur de règle.

Lacunes assumées
- Aucune. Le périmètre de cette étape ne comporte pas de recherche de règle
  supplémentaire ; `sortsBonus`, `armures` et `progressionClasses` sont portés
  sans interprétation, en attente des étapes qui en ont besoin.
