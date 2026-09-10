# FOLLOWUPS — audit UI/UX 2026-09

Registre des points ouverts, laissés par les étapes 06 à 16 de la passe d'audit
UI/UX (`design/audit_ui/NN_constats.md`). Une entrée est fermée avec un
commentaire et un chiffre à l'appui ; sinon elle reste ouverte et son origine est
citée.

## Fermées à l'étape 16

1. **Divergence `MOTS.source` vs charte typographique** (signalée par l'étape 07,
   `07_constats.md` § C). `web/lib/design/tokens.ts:320` portait
   `'source : pathfinder-fr.org'`, deux-points inclus, alors que la charte
   typographique du même Skill interdit le deux-points en prose sans exception.
   **Fermée** : le deux-points est retiré (`'source pathfinder-fr.org'`).
   `layout.tsx` n'affiche pas `MOTS.source` directement (vérifié,
   `layout.test.tsx:88-90` assure justement que ce libellé figé n'apparaît pas
   dans le pied de page rendu), donc ce correctif ne change aucun texte visible
   déjà vérifié par `verifier_typographie.ts` — il aligne uniquement la table du
   vocabulaire sur la décision déjà prise par l'étape 07 dans le rendu réel.

2. **Test manquant sur `BasculeTheme.tsx`** (`design/FOLLOWUPS.md` cité par
   `15_constats.md` § B, entrée pré-existante à cette passe). **Fermée** : cinq
   assertions dans `web/components/primitives/BasculeTheme.test.tsx` (libellé,
   `aria-pressed`, écriture `localStorage`, `data-theme`, absence de
   `prefers-color-scheme`/`matchMedia`).

3. **Cible tactile de `BasculeTheme.tsx`** sous 44 px (85×28 px avant, signalé
   par 07, 08, 09, 10, 15). **Fermée** par la passe d'intégration
   (`469aad47`) : `min-h-cible min-w-cible` posé directement sur le `<button>`,
   plus le carve-out `ligneMin` qui exemptait les `<button>` d'une ligne de
   tableau a été retiré. Vérifié par `npm run verifier:tout` (voir § écarts
   résiduels, §16_RAPPORT_report.md) : `BasculeTheme` n'apparaît plus dans la
   sortie de `verifier_cibles.ts`.

4. **Cibles tactiles diverses hors périmètre déclaré** (`BoutonFavori.tsx` 170×40
   et 23×17 ; `<summary>`/bouton « Explorer sans choisir de classe » dans
   `ChoixClasse.tsx` ; en-tête triable de `TableDense.tsx` ; lien de nom dans
   `TableSorts.tsx`). **Fermées** par la passe d'intégration `469aad47` :
   `min-h-cible`/`min-w-cible`/`min-h-ligne min-w-ligne` posés selon le cas,
   2515 des 2516 écarts de cible du run post-fusion résolus.

5. **Deux faux positifs de `scripts/verifier_cibles.ts`** — mesure de police sur
   des `input` checkbox/radio/file sans zoom iOS (signalé par `08_constats.md`
   § « Une seconde catégorie… »population `police-champ-mobile`), et
   double-mesure d'une case déjà enveloppée dans un `label` de 44 px (même
   fichier, § « Une catégorie reste attribuable »). **Fermées** par la passe
   d'intégration `469aad47` : le script ignore désormais un `input` de type
   `checkbox`/`radio`/`file` pour la règle de police mobile, et un `input` déjà
   enveloppé dans un `label:has(input)` qui satisfait lui-même le plancher de
   44 px n'est plus mesuré une seconde fois isolément.

## Ouvertes — à trancher par l'arbitrage humain

6. **Défilement horizontal résiduel, route `navigation` à 320 px** (unique
   écart restant de `npm run verifier:tout` après la passe d'intégration).
   `documentElement.scrollWidth` dépasse `clientWidth` de plus de 1 px à cette
   largeur, uniquement. Cause mesurée : la colonne « Sort » du tableau de
   résultats porte un bouton favori compact (32 px, plancher de ligne), un lien
   de nom au contenu non cassable (nom complet du sort, parfois long — ex.
   « Dissimulation d'objet »), et parfois un badge désaccord/alias — sa largeur
   minimale de contenu dépasse le budget disponible d'environ 38 px une fois
   que les colonnes Niveau et École (contraintes à 64 px minimum = 44 px de
   contrôle de tri + remplissage, pour rester des cibles tactiles valides) ont
   pris leur part. Deux corrections possibles, non tranchées :
   - tronquer les noms de sort avec ellipsis (exige `table-layout: fixed`,
     revoir toute la distribution des largeurs de colonnes, risque de
     régression) ;
   - retirer le tri sur École et/ou Niveau sous 400 px (retire une
     fonctionnalité).
   **Non corrigé délibérément.** Voir `design/AUDIT_UI_2026-09.md` § synthèse.

7. **Limite documentée de `scripts/verifier_cibles.ts` — à jour.** Les deux
   faux positifs listés au point 5 sont corrigés ; la limite restante du
   script est qu'il ne sait pas encore attribuer un écart de cible tactile à
   un composant précis quand plusieurs contrôles voisins partagent la même
   ligne mesurée (ex. bouton favori + lien de nom dans une même cellule de
   `TableSorts.tsx`) — c'est cette limite, combinée à la contrainte de largeur
   du point 6, qui rend le diagnostic du point 6 un calcul manuel plutôt qu'une
   ligne unique de la sortie du script.

8. **`CheminForage.tsx` et `PersonnaliserRoue.tsx`** (`11_constats.md` § E) —
   boutons de puce, flèches haut/bas, bouton « Personnaliser la roue » : cibles
   de 44 px non posées, signalé mais non corrigé faute de temps dans l'étape
   11. Non repris à l'étape 16 (hors du périmètre de fichiers de cette étape,
   `web/components/exploration/*` n'est pas dans son périmètre déclaré).

9. **Bouton « Valider » de `PersonnaliserRoue.tsx`** en thème nuit
   (`11_constats.md` § D) : contraste AA non corrigé sur ce bouton secondaire
   (seuls les deux boutons « Valider ce choix » l'ont été). Non repris à
   l'étape 16, même raison que le point 8.

10. **Deux `title` mineurs et un `aria-live` manquant sur `/compte`**
    (`14_constats.md` § C, lignes `VueCompte.tsx:152-178,232`,
    `VueChangerEmail.tsx:50-56`, `VuePersonnages.tsx:47-53`) : non corrigés à
    l'étape 14, signalés comme mineurs. Non repris à l'étape 16.

11. **Repli par défaut des grandes facettes du panneau de filtres**
    (`08_constats.md` § « Hauteur du panneau ») : le panneau mesure 8421 px de
    haut sur un viewport 1366×900 ; un repli par défaut de Temps d'incantation,
    Type de dégâts et Conditions infligées réduirait cette hauteur, mais change
    un comportement existant documenté comme un choix délibéré. Arbitrage
    humain requis, non tranché.
