-- Étendre `personnages` pour qu'il porte assez d'état pour `evaluate_feat`.
--
-- Purement additive : aucune colonne supprimée, aucun type changé, aucune
-- valeur par défaut rétroactive sur les colonnes existantes. Des lignes
-- existent déjà (`nom`, `classe`, `niveau`) ; elles restent lisibles, avec
-- leurs nouveaux champs à `null`.
--
-- `dons_acquis` est la seule exception délibérée à « tout nullable » : côté
-- moteur, `known_feats` distingue `null` (« on ne sait pas », un prérequis de
-- don devient `manual_check`) de l'ensemble VIDE (« aucun don », le prérequis
-- devient `false`). Un personnage qui n'a encore pris aucun don a *zéro* don,
-- pas « on ne sait pas » — donc `not null default '[]'::jsonb`, jamais `null`.
-- Toutes les autres colonnes restent nullables sans défaut inventé : un
-- alignement ou une divinité par défaut produirait un verdict de gating faux
-- au lieu d'un `manual_check` honnête (« non renseigné »).

-- --------------------------------------------------------------------------
-- 1. Les nouvelles colonnes
-- --------------------------------------------------------------------------

alter table public.personnages
  add column if not exists race text,
  add column if not exists caracteristiques jsonb,
  add column if not exists alignement text,
  add column if not exists divinite text,
  add column if not exists taille text,
  add column if not exists dons_acquis jsonb not null default '[]'::jsonb;
-- --------------------------------------------------------------------------
-- 3. Forme de `caracteristiques` : les six clés, entières, ou null
-- --------------------------------------------------------------------------
-- Les six caractéristiques que `Character.ability_scores` attend
-- (`for,dex,con,int,sag,cha`), et rien de plus ni de moins : un objet à cinq
-- clés (une caractéristique oubliée) ou à sept (un intrus) est refusé — la
-- forme complète ou rien, jamais une forme partielle qui ferait passer une
-- caractéristique manquante pour absente au niveau de la colonne plutôt
-- qu'au niveau de la clé.

alter table public.personnages
  drop constraint if exists personnages_caracteristiques_valides;

alter table public.personnages
  add constraint personnages_caracteristiques_valides
  check (
    caracteristiques is null or (
      jsonb_typeof(caracteristiques) = 'object'
      and (select array_agg(k order by k) from jsonb_object_keys(caracteristiques) as k)
          = array['cha', 'con', 'dex', 'for', 'int', 'sag']
      and jsonb_typeof(caracteristiques->'for') = 'number'
      and jsonb_typeof(caracteristiques->'dex') = 'number'
      and jsonb_typeof(caracteristiques->'con') = 'number'
      and jsonb_typeof(caracteristiques->'int') = 'number'
      and jsonb_typeof(caracteristiques->'sag') = 'number'
      and jsonb_typeof(caracteristiques->'cha') = 'number'
    )
  );

-- --------------------------------------------------------------------------
-- 4. `dons_acquis` est un tableau JSON de chaînes
-- --------------------------------------------------------------------------

alter table public.personnages
  drop constraint if exists personnages_dons_acquis_tableau;

alter table public.personnages
  add constraint personnages_dons_acquis_tableau
  check (
    jsonb_typeof(dons_acquis) = 'array'
    and not exists (
      select 1 from jsonb_array_elements(dons_acquis) as element
      where jsonb_typeof(element) <> 'string'
    )
  );

-- --------------------------------------------------------------------------
-- 5. RLS : rien de nouveau à écrire
-- --------------------------------------------------------------------------
-- Les politiques posées par 20260827000000_comptes_et_favoris.sql portent sur
-- la LIGNE (`user_id = auth.uid()`) et non sur une liste de colonnes ; elles
-- couvrent donc déjà `race`, `caracteristiques`, `alignement`, `divinite`,
-- `taille` et `dons_acquis` sans qu'aucune politique supplémentaire soit
-- nécessaire. Vérifié, pas supposé — voir le test d'intégration RLS à deux
-- utilisateurs sous `supabase/tests/`.
