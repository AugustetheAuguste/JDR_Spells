# 12 — SUPABASE MIGRATION : un personnage qui porte assez d'état pour les dons

**Vague 3.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/12-supabase-migration`.

## Objectives

Étendre la table `public.personnages` pour qu'elle porte **tout ce dont
`evaluate_feat` a besoin** : race, six caractéristiques, alignement, divinité,
dons acquis. Et aligner `classe` sur le vocabulaire des **42 slugs** avec une
contrainte de vérification.

Aujourd'hui `personnages` porte `nom`, `classe text`, `niveau integer` : de quoi
filtrer une liste de sorts, pas de quoi évaluer un don.

## Dependencies & Parallelization

- **Vague 3.** Dépend de **07_REGISTRY_INTEGRATION** — et de rien d'autre. Elle a
  besoin du vocabulaire de classes (`data/conventions/classes_unifiees.json`,
  42 slugs) ; ni de l'UI, ni du moteur, ni de l'exporteur.
- Parallèle à **08**, **09**, **10**, **11** : écrit sous `supabase/migrations/`
  et `web/lib/compte/`. Aucun fichier commun.
- L'UI qui consomme ces champs est l'étape **16**.

## Inherited Context from Dependencies

### L'état existant, à lire avant d'écrire

`supabase/migrations/20260827000000_comptes_et_favoris.sql` :

```sql
create table public.personnages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  classe text,
  niveau integer,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
```

Le même fichier crée `profils` (avec un trigger `creer_profil`) et `listes` (clé
primaire composite `(user_id, id_liste)`, `personnage_id uuid references
personnages`, colonne tombstone `supprime_le`), et pose des **politiques RLS sur
les trois tables**.

`web/lib/compte/personnages.ts` (153 lignes) expose `usePersonnages()` renvoyant
`ValeurPersonnages` avec `creer(nom, classe, niveau)`, `modifier`, `supprimer`,
`recharger`. Sa docstring dit qu'il s'agit d'un hook et non d'un contexte parce
qu'**une seule page** le consomme aujourd'hui, et **qu'un second consommateur
justifierait un contexte**. L'étape 16 sera ce second consommateur : ne pas
convertir ici, mais laisser la note.

### Depuis 07 — le vocabulaire de classes

`data/conventions/classes_unifiees.json` : 42 entrées, `slug` clé primaire, dont
`pretre combattant` **avec une espace**. Une entrée porte `a_curer: true`
(`clerc`, doublon suspecté de `pretre`, non tranché).

`classe` doit désormais porter un **slug des 42**, et non un libellé de liste de
sorts. La lecture des sorts passe par `liste_sorts` du registre — c'est l'objet
même de l'étape 07 : un `magicien` lit `arcaniste-ensorceleur-magicien` pour ses
sorts et `magicien` pour ses dons.

### Ce que `Character` exige (côté moteur)

```
character_class, level, race?, size?, ability_scores?{for,dex,con,int,sag,cha},
known_feats?, skill_ranks?, alignment?, deity?
```

`alignment` et `deity` sont du **texte français libre** : ils débloquent les genres
de gating `alignment` et `deity`, qui renvoient `null` avec un motif explicite
« non renseigné » quand ils sont absents. Donc **nullable, jamais avec une valeur
par défaut inventée** : un alignement par défaut produirait un verdict faux au lieu
d'un `manual_check` honnête.

Les caractéristiques absentes produisaient « score de Dex non fourni » en cascade,
d'où le `DEFAULT_ABILITY_SCORE = 10` du CLI. Côté base, **nullable** : c'est l'UI
qui décidera d'un défaut, pas le schéma.

`known_feats` : la distinction sémantique compte. `null` fait valoir `null` à un
prérequis de don (`manual_check`) ; l'ensemble **vide** fait valoir `false`. Un
personnage qui n'a encore pris aucun don a **zéro don**, pas « on ne sait pas » →
la colonne est `not null default '[]'::jsonb`.

### Les contraintes de plateforme

`CLAUDE.md` §11 : site exporté statiquement, **aucune route d'API**. Toutes les
écritures passent par le client Supabase depuis le navigateur, protégées par
**RLS**. La seule exception du dépôt est `supabase/functions/supprimer-compte/`
(Deno/TS), justifiée par le besoin de la clé `service_role` — ne pas s'en servir
de précédent pour autre chose.

`signOut` est **`scope: 'local'`**, jamais le défaut global. Ne pas y toucher, mais
ne pas l'oublier si un chemin de déconnexion est effleuré.

## Pseudo-code

```sql
-- supabase/migrations/<horodatage>_personnages_pour_les_dons.sql

-- 1. les nouvelles colonnes, toutes nullables sauf dons_acquis
alter table public.personnages
  add column race text,
  add column caracteristiques jsonb,   -- {for,dex,con,int,sag,cha}
  add column alignement text,
  add column divinite text,
  add column taille text,
  add column dons_acquis jsonb not null default '[]'::jsonb;

-- 2. le vocabulaire de classes : contrainte NOMMÉE, valeurs des 42 slugs
--    (transcrites depuis classes_unifiees.json, jamais tapées de mémoire)
alter table public.personnages
  add constraint personnages_classe_connue
  check (classe is null or classe in ( ...les 42 slugs... ));

-- 3. forme des caractéristiques : les six clés, entiers, ou null
alter table public.personnages
  add constraint personnages_caracteristiques_valides
  check (caracteristiques is null or (
     caracteristiques ?& array['for','dex','con','int','sag','cha']
     and jsonb_typeof(caracteristiques->'for') = 'number' ... ));

-- 4. dons_acquis est un tableau JSON de chaînes
alter table public.personnages
  add constraint personnages_dons_acquis_tableau
  check (jsonb_typeof(dons_acquis) = 'array');

-- 5. RLS : aucune politique nouvelle à écrire, celles de personnages couvrent
--    déjà les colonnes ajoutées. VÉRIFIER, ne pas supposer.
```

```
# tools/verifier_vocabulaire_classes.py
lire les 42 slugs de data/conventions/classes_unifiees.json
extraire par regex les valeurs de la contrainte personnages_classe_connue
si les deux ensembles diffèrent -> sortie 1, nommer l'écart
# la contrainte SQL et le registre ne peuvent pas dériver l'un de l'autre :
# ce garde est la seule chose qui les tient ensemble
```

## Logic Flow

1. Lire la migration existante **en entier**, y compris les politiques RLS.
2. Écrire la migration additive. Un seul fichier, horodaté après l'existant.
3. Écrire le garde de vocabulaire, le lancer.
4. Étendre `personnages.ts` : les nouveaux champs dans le type et dans
   `creer`/`modifier`, **en gardant les signatures existantes compatibles**.
5. Vérifier RLS explicitement : un utilisateur ne lit ni n'écrit le personnage
   d'un autre, sur les colonnes **nouvelles** aussi.

## Implementation Notes

- **Migration purement additive.** Aucune colonne supprimée, aucun type changé,
  aucune valeur par défaut rétroactive. Des personnages existent déjà en base : ils
  doivent rester lisibles, avec leurs nouveaux champs à `null`.
- **`classe` reste nullable.** La contrainte tolère `null` : un personnage
  incomplet est un état légitime, et le moteur répond `manual_check` sur une classe
  inconnue plutôt que `ineligible`. Rendre `classe` obligatoire romprait la
  migration des lignes existantes.
- **Les valeurs anciennes de `classe` peuvent ne pas être des slugs des 42.** Si
  une ligne existante viole la contrainte, **ne pas deviner la correspondance** :
  écrire la migration de données pour les cas **certains** (correspondance exacte
  après normalisation) et laisser les autres à `null` en les **rapportant**. Le
  précédent est `chasseur de vampire` : le dépôt laisse absent ce qu'il ne sait pas,
  parce qu'un `ineligible` faux cache le don au joueur sans recours.
- **Ne pas convertir `usePersonnages` en contexte ici.** Sa docstring dit
  explicitement qu'un second consommateur le justifierait ; ce consommateur est
  l'étape 16, et la conversion lui appartient. Y laisser une note pointant l'étape.
- **`niv` est toujours une table classe → niveau, jamais un scalaire** (`CLAUDE.md`
  B4). Ne pas confondre avec `personnages.niveau`, qui est le niveau de personnage.
  Si le multiclassage arrive un jour, `niveau` deviendra une table — ne pas le
  préparer ici, mais ne pas écrire de code qui l'empêche.
- Contraintes **nommées**, toujours : une contrainte anonyme est impossible à
  référencer dans une migration ultérieure.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. La migration s'applique sur une base **vierge** et sur une base **portant déjà
   des lignes** de `personnages` : les deux réussissent.
2. Elle est **idempotente au niveau du dossier** : la relancer via l'outil de
   migration ne produit pas d'erreur (pas de double `add column`).
3. `personnages_classe_connue` accepte les **42** slugs, accepte `null`, et
   **rejette** `'Magicien'` (majuscule), `'pretre-combattant'` (tiret) et
   `'chasseur de vampire'`. Un test SQL le prouve valeur par valeur.
4. `pretre combattant` (avec **une espace**) est accepté : c'est la forme du
   corpus des dons, et un tiret casserait la jointure avec
   `class_proficiencies.json`.
5. `python tools/verifier_vocabulaire_classes.py` sort **0**, et sort **1** si l'on
   retire une valeur de la contrainte — prouvé en le faisant.
6. `dons_acquis` vaut `[]` et non `null` pour toute ligne, ancienne comprise. Test
   dédié : la distinction `null` / vide décale un verdict entier.
7. `caracteristiques` refuse un objet à cinq clés et accepte `null`.
8. **RLS vérifiée sur les colonnes nouvelles** : un test d'intégration avec deux
   utilisateurs assert qu'aucun ne lit ni n'écrit `race`, `caracteristiques`,
   `alignement`, `divinite`, `dons_acquis` de l'autre. Une colonne ajoutée sans
   revérifier RLS est le mode de fuite classique.
9. `alignement` et `divinite` restent **nullables sans défaut** : un test assert
   qu'un `insert` sans eux réussit et les laisse `null`.
10. `npm --prefix web run typecheck`, `lint`, `npm run web:test` verts, **662 tests
    existants toujours passants**.

## Git Handling

Branche `fusion/12-supabase-migration` depuis `feat/fusion-dons`. Trois commits :

```
feat(base): étendre personnages pour l'éligibilité aux dons
feat(base): contraindre « classe » au vocabulaire des 42 classes
feat(outils): garde de cohérence entre la contrainte SQL et le registre
```

Le corps du premier commit doit dire pourquoi `dons_acquis` est `not null
default '[]'` alors que tout le reste est nullable : `null` vaut « on ne sait pas »
et rend un prérequis de don `manual_check`, l'ensemble vide vaut « aucun don » et
le rend `false`.

## Expected Outcome

Un personnage persisté porte assez d'état pour que le moteur TS l'évalue sans rien
demander de plus, le vocabulaire de classes est contraint **en base** et non
seulement par convention, et l'étape 16 peut se consacrer à l'interface.
