# 16 — CHARACTER BINDING : lier les dons au personnage

**Vague 5.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/16-character-binding`.

## Objectives

Faire du personnage l'axe commun des deux corpus : sélectionner un personnage
filtre ses sorts **et** évalue ses dons. Concrètement :

1. Un sélecteur de personnage partagé, promu en **contexte**.
2. L'éditeur des champs que les dons exigent (race, caractéristiques, alignement,
   divinité).
3. Le statut tri-état affiché dans `/dons`, calculé par le moteur TS.
4. Les **emplacements de dons** : combien, lesquels sont ouverts, et l'assignation.
5. **L'arbitrage explicite de `Character.skill_rank`** (I9) — le dernier point
   ouvert du plan.

## Dependencies & Parallelization

- **Vague 5.** Dépend de :
  - **13_UI_DONS_LIST** — la vue à facettes où le statut s'affiche.
  - **12_SUPABASE_MIGRATION** — les colonnes `race`, `caracteristiques`,
    `alignement`, `divinite`, `dons_acquis`.
  - **09_TS_MOTEUR** — `evaluerDon`, `filtrerDons`, `calculerVagues`,
    `calculerCouts`.
  - **14_PARITY_HARNESS** — sans le garde de parité vert, afficher un statut serait
    afficher un verdict non vérifié. C'est une dépendance de **confiance**, pas de
    compilation, et elle est délibérée.
- Parallèle à **15_UI_GRAPH** : 15 touche `components/dons/Arbre*`, celle-ci touche
  `lib/compte/`, `components/compte/` et le branchement du statut.

## Inherited Context from Dependencies

### Depuis 12 — la base

`public.personnages` porte désormais `nom`, `classe` (slug des **42**, contraint par
`personnages_classe_connue`, nullable), `niveau`, `race`, `caracteristiques jsonb`
(les six clés `for,dex,con,int,sag,cha`), `alignement`, `divinite`, `taille`,
`dons_acquis jsonb not null default '[]'`.

**`dons_acquis` est `[]` et jamais `null`** : `null` fait valoir `null` à un
prérequis de don (`manual_check`), l'ensemble **vide** le fait valoir `false`. Un
personnage sans don a zéro don, pas « on ne sait pas ».

`alignement` et `divinite` sont **nullables sans défaut** : absents, les genres de
gating correspondants renvoient `null` avec un motif « non renseigné » — un
`manual_check` honnête plutôt qu'un verdict faux.

RLS couvre déjà les colonnes ajoutées (vérifié en 12).

### Depuis 09 — le moteur

```
evaluerDon(don, perso, tables) -> {statut, motifs}
filtrerDons(catalogue, perso)  -> groupé par statut
calculerVagues(catalogue, perso, slots)   # known_feats EXPLICITE
calculerCouts(...)
```

`Character` : `character_class, level, race?, size?, ability_scores?, known_feats?,
skill_ranks?, alignment?, deity?`. Dérivés : `bba`, `effective_size` (taille
explicite, sinon celle de la race), `racial_trait_text`.

### Le point à arbitrer : `skill_rank` est **optimiste** (I9)

Sans `skill_ranks` explicite, `Character.skill_rank` renvoie `level` — donc **tous
les prérequis de rangs de compétence passent simultanément**. C'est défendable pour
un dépistage (« ce personnage *pourrait*-il qualifier ? »), PF1 n'ayant pas de
malus hors-classe, **mais cela gonfle la liste des dons universels**.

Le dépôt d'origine a deux calculs distincts, exprès :
`skill_budget.py` calcule un **vrai** budget de points de compétence depuis la
`SkillPointsFormula` de la classe et les caractéristiques, plus le +3 de compétence
de classe ; `engine.py::Character.skill_rank` garde le placeholder optimiste. Le
flux de création CLI utilise les vrais nombres, l'éligibilité le placeholder.

**Décision de cette étape** : l'interface **affiche explicitement** qu'un statut
`eligible` reposant sur un prérequis de rangs est **optimiste**, et propose de
saisir les rangs réels. Elle **ne change pas** le comportement par défaut du
moteur — le changer ferait diverger le harnais de parité sans qu'aucune décision de
produit ait été prise, et ferait passer des dons en `ineligible` sur une hypothèse.
La maxime tranche : *une sous-attribution est bien plus grave qu'une
sur-attribution*. Sur-attribuer coûte un `manual_check` ; sous-attribuer cache le
don au joueur **sans recours**.

### Depuis 13 — la vue

`MarqueurStatut` existe avec ses trois états (`manual_check` = bordure en tirets
**plus** un « ! » textuel, jamais la teinte seule). La colonne statut est
actuellement **absente** faute de personnage ; cette étape la branche.

`dons_statut` est déjà une clé d'URL, et `manual_check` y est sélectionnable par
défaut. **Ne pas le filtrer d'office.**

### Les emplacements de dons — la logique existe déjà en Python

`src/pf_dons/feat_slots.py::compute_feat_slots(character_class, level, race_name,
races, class_bonus_feats)` renvoie tous les `FeatSlot` d'un personnage : un
emplacement général au niveau 1 et à chaque niveau impair, un emplacement racial si
`RaceInfo.has_bonus_feat`, un emplacement de classe par niveau listé dans
`data/classes/class_bonus_feats.json`. `category_restriction` d'un emplacement de
classe est **toujours `null`** aujourd'hui (non dérivée automatiquement) mais
**honorée si éditée à la main**.

`character_profile.py::assign_feat`/`unassign_feat` : l'emplacement doit exister et
être ouvert ; **un don ne peut pas occuper deux emplacements**, et les dons
répétables (nom finissant par `*`) **ne peuvent pas** être assignés plus d'une fois
via ce chemin. Reproduire cette limite telle quelle et la **dire** à l'utilisateur.

`eligible_feats_for_slot()` filtre par la restriction de catégorie de
l'emplacement (`data/dons/feat_categories.json`) puis par l'éligibilité, en gardant
**`eligible` et `manual_check`**. Ne pas restreindre à `eligible`.

Point important : **réévaluer à l'assignation**, jamais se fier à une liste
précédente — assigner un don change ce qui est éligible ailleurs par les chaînes de
prérequis. Le CLI le fait déjà pour cette raison.

### `usePersonnages` — la promotion en contexte

`web/lib/compte/personnages.ts` (153 lignes) est un **hook** et sa docstring dit
pourquoi : une seule page le consomme, *et un second consommateur justifierait un
contexte*. Cette étape **est** ce second consommateur (`/sorts` et `/dons`). Donc :
promouvoir en contexte, **et le déclarer dans `Fournisseurs.tsx`** — c'est le seul
endroit du dépôt où la pile de fournisseurs vit (`CLAUDE.md`). Ses tests existants
(`fournisseurs.test.tsx`, 238 lignes) doivent rester verts.

### Plateforme

`output: 'export'`, aucune route d'API : toutes les écritures passent par le client
Supabase sous RLS. `signOut` reste **`scope: 'local'`**. L'état de sélection du
personnage vit dans l'URL comme le reste, `{scroll: false}`, **aucun `useState`
miroir**.

## Pseudo-code

```
# web/lib/compte/contexte-personnages.tsx
ContextePersonnages = créer(ValeurPersonnages étendu)
    creer(nom, classe, niveau)            # signature conservée
    modifier(id, champs)                  # + race, caracteristiques, alignement,
                                          #   divinite, taille, dons_acquis
    personnageActif                       # lu depuis l'URL, pas d'état miroir
FournisseurPersonnages -> déclaré dans Fournisseurs.tsx

# web/lib/dons/vers-character.ts
versCharacter(personnage) -> Character
    known_feats = new Set(personnage.dons_acquis)     # EXPLICITE, jamais undefined
    ability_scores = personnage.caracteristiques ?? undefined
    # ne PAS inventer de défaut : absent -> manual_check honnête

# web/components/compte/EditeurPersonnage.tsx
champs: classe (les 42), niveau, race (53), six caractéristiques,
        alignement (texte libre), divinité (texte libre), taille
# alignement/divinité vides -> avertir que certains dons resteront en manual_check

# web/components/dons/ColonneStatut.tsx
statut = evaluerDon(don, versCharacter(perso), tables)
rendre <MarqueurStatut> + motifs en infobulle
si le don dépend d'un prérequis de rangs de compétence:
    marquer « optimiste » + lien vers la saisie des rangs

# web/components/dons/Emplacements.tsx
emplacements = calculerEmplacements(classe, niveau, race)   # portage de feat_slots
pour chaque emplacement ouvert:
    candidats = dons `eligible` OU `manual_check`, filtrés par category_restriction
    assigner(don) -> RÉÉVALUER tout, puis persister dons_acquis
désassigner(don) -> réévaluer, persister
refuser: emplacement inexistant/occupé, don déjà pris ailleurs, répétable deux fois
```

## Logic Flow

1. Promouvoir `usePersonnages` en contexte, le déclarer dans `Fournisseurs.tsx`,
   vérifier que `fournisseurs.test.tsx` reste vert.
2. Écrire l'éditeur de personnage et ses écritures Supabase.
3. Écrire `versCharacter`, avec le `Set` explicite.
4. Brancher la colonne statut dans la vue de 13.
5. Porter `compute_feat_slots` et l'UI d'assignation, **avec réévaluation**.
6. Ajouter la mention « optimiste » sur les rangs de compétence.

## Implementation Notes

- **`known_feats` explicite, toujours.** `undefined` change la sémantique d'un
  prérequis de don de `false` à `null` et décale une vague entière (234 accessibles
  contre 482 pour un Guerrier 6).
- **Réévaluer après chaque assignation.** Ne jamais réutiliser une liste de
  candidats calculée avant.
- **Ne pas inventer de valeurs par défaut** pour alignement, divinité ou
  caractéristiques. Un défaut produit un verdict faux ; l'absence produit un
  `manual_check` avec un motif lisible, ce qui est l'information juste.
- **Ne pas changer le comportement de `skill_rank`.** Le rendre pessimiste ferait
  apparaître des `ineligible` sur une hypothèse et ferait échouer le harnais de
  parité. L'afficher comme optimiste est la réponse.
- **Ne pas filtrer `manual_check` par défaut.** C'est précisément la liste des dons
  que le moteur n'a pas su trancher ; les cacher est la sous-attribution que tout le
  dépôt combat.
- La limite des dons répétables (une seule assignation) est **connue et assumée** :
  la dire à l'utilisateur, ne pas la contourner discrètement.
- `category_restriction` reste `null` pour les emplacements de classe : ne pas la
  **deviner**. Un emplacement sur-restreint cache des dons.
- TypeScript strict, **aucun `any`**. Ne créer **aucun** fichier `__init__` et
  n'ajouter **aucun** `__all__`.

## Verification Criteria

1. Le contexte est déclaré **dans `Fournisseurs.tsx`** et nulle part ailleurs ;
   `fournisseurs.test.tsx` (238 lignes) reste vert **sans modification**.
2. Deux consommateurs (`/sorts` et `/dons`) lisent le **même** personnage actif : un
   test assert qu'un changement se reflète dans les deux.
3. `versCharacter` produit toujours un `Set` pour `known_feats`, **même vide** : un
   test assert que ce n'est jamais `undefined`, et qu'un prérequis de don non
   possédé vaut donc `false`.
4. Un personnage sans alignement affiche un statut `manual_check` avec le motif
   « non renseigné » sur un don à gating d'alignement — **pas** `ineligible`.
5. Un personnage `guerrier` niveau 6 humain, dons acquis vides, produit **exactement
   les mêmes comptes** que le Python de référence sur le même profil : test
   d'intégration comparant à une sortie de `tools/dons/vider_verdicts.py`.
6. Les emplacements : un `guerrier` 6 a le bon nombre d'emplacements généraux
   (niveaux 1, 3, 5) plus ses emplacements de classe ; comparé au Python
   `compute_feat_slots` sur au moins **5 couples classe/niveau**.
7. Assigner un don qui est prérequis d'un autre fait passer ce dernier de
   `ineligible` à `eligible` **sans rechargement** : c'est le test qui prouve la
   réévaluation.
8. Un don déjà assigné ne peut pas l'être à un second emplacement ; un répétable ne
   peut pas être assigné deux fois — les deux refus sont **expliqués** à l'écran.
9. Les candidats d'un emplacement incluent les `manual_check`, pas seulement les
   `eligible`.
10. La mention « optimiste » apparaît sur un don à prérequis de rangs de compétence
    et **pas** sur un don sans.
11. `dons_acquis` persiste en base et se recharge : aller-retour testé. RLS : un
    utilisateur ne modifie pas les dons d'un autre.
12. `npm run dons:parite` (étape 14) **toujours vert** : cette étape ne doit pas
    avoir modifié le moteur. `git diff` sur `web/lib/dons/moteur.ts` → zéro.
13. `verifier_a11y.ts` sur `/dons` avec personnage sélectionné et sur l'éditeur :
    **zéro violation**, en clair et en sombre.
14. `npm run web:build`, `typecheck`, `lint`, `web:test` verts, **662 tests
    existants toujours passants** ; `PYTHONPATH=src python -m pytest tests -q` vert.

## Git Handling

Branche `fusion/16-character-binding` depuis `feat/fusion-dons`. Cinq commits :

```
refactor(web): promouvoir les personnages en contexte — un second consommateur existe
feat(base): éditeur des champs de personnage requis par l'éligibilité
feat(web): statut d'éligibilité des dons pour le personnage actif
feat(web): emplacements de dons et assignation, réévaluée à chaque changement
docs(web): assumer explicitement l'optimisme des rangs de compétence
```

Le corps du premier commit doit citer la docstring qui prévoyait cette promotion.
Le corps du dernier doit dire pourquoi le comportement du moteur **n'est pas**
changé : le rendre pessimiste ferait apparaître des `ineligible` sur une hypothèse,
et une sous-attribution est bien plus grave qu'une sur-attribution.

## Expected Outcome

Un personnage, un endroit : ses sorts et ses dons. L'éligibilité s'affiche avec ses
motifs, les emplacements se remplissent en réévaluant les chaînes de prérequis, et
la seule approximation restante — l'optimisme des rangs de compétence — est
**déclarée à l'utilisateur** au lieu d'être une note dans un fichier.
