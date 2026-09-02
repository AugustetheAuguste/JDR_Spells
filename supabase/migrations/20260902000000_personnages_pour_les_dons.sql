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
-- 2. Le vocabulaire de classes : contrainte NOMMÉE sur les 42 slugs
-- --------------------------------------------------------------------------
-- Les valeurs ci-dessous sont transcrites verbatim depuis les 42 `slug` de
-- `data/conventions/classes_unifiees.json` (jamais tapées de mémoire) —
-- `tools/verifier_vocabulaire_classes.py` garde les deux alignés. Notez
-- `pretre combattant` : une ESPACE, pas un tiret — c'est la forme du corpus
-- des dons, un tiret casserait la jointure avec `class_proficiencies.json`.
--
-- `classe` reste nullable : la contrainte tolère explicitement `null`, un
-- personnage incomplet étant un état légitime (le moteur répond
-- `manual_check` sur une classe inconnue, jamais `ineligible`).
--
-- Les valeurs existantes de `classe` qui ne correspondent à aucun des 42
-- slugs (même après normalisation espaces/casse) sont mises à `null` avant
-- la pose de la contrainte, plutôt que devinées : le précédent est
-- `chasseur de vampire` (pf1_dons) — le dépôt laisse absent ce qu'il ne sait
-- pas, parce qu'un `ineligible` faux cache le don au joueur sans recours.
-- Cette normalisation ne couvre que les correspondances CERTAINES (casse et
-- espaces superflus) ; toute autre valeur ancienne est simplement rapportée
-- via une `notice`, jamais réécrite par supposition.

do $$
declare
  slugs_connus text[] := array[
    'alchimiste',
    'antipaladin',
    'arcaniste',
    'barbare',
    'barde',
    'bretteur',
    'cavalier',
    'chaman',
    'chasseur',
    'chevalier',
    'cinetiste',
    'clerc',
    'conjurateur',
    'druide',
    'enqueteur',
    'ensorceleur',
    'guerrier',
    'hypnotiseur',
    'inquisiteur',
    'justicier',
    'lutteur',
    'magicien',
    'magus',
    'medium',
    'metamorphe',
    'moine',
    'ninja',
    'occultiste',
    'oracle',
    'paladin',
    'pistolier',
    'pretre',
    'pretre combattant',
    'psychiste',
    'rodeur',
    'roublard',
    'samourai',
    'sanguin',
    'scalde',
    'sorciere',
    'spirite',
    'tueur'
  ];
  ligne record;
  correspondance text;
begin
  for ligne in
    select id, classe from public.personnages
    where classe is not null and classe <> all (slugs_connus)
  loop
    -- Correspondance certaine : la même valeur une fois la casse et les
    -- espaces de bord normalisés. Toute autre différence (accent, tiret pour
    -- une espace, orthographe) n'est PAS une correspondance certaine et est
    -- laissée à `null`, rapportée en `notice`.
    select s into correspondance
      from unnest(slugs_connus) as s
      where lower(trim(s)) = lower(trim(ligne.classe))
      limit 1;

    if correspondance is not null then
      update public.personnages set classe = correspondance where id = ligne.id;
      raise notice 'personnages.classe % -> % (id %) : correspondance certaine (casse/espaces)',
        ligne.classe, correspondance, ligne.id;
    else
      update public.personnages set classe = null where id = ligne.id;
      raise notice 'personnages.classe % (id %) : hors vocabulaire des 42 slugs, mis à null (non deviné)',
        ligne.classe, ligne.id;
    end if;
  end loop;
end;
$$;

alter table public.personnages
  drop constraint if exists personnages_classe_connue;

alter table public.personnages
  add constraint personnages_classe_connue
  check (
    classe is null or classe in (
      'alchimiste',
      'antipaladin',
      'arcaniste',
      'barbare',
      'barde',
      'bretteur',
      'cavalier',
      'chaman',
      'chasseur',
      'chevalier',
      'cinetiste',
      'clerc',
      'conjurateur',
      'druide',
      'enqueteur',
      'ensorceleur',
      'guerrier',
      'hypnotiseur',
      'inquisiteur',
      'justicier',
      'lutteur',
      'magicien',
      'magus',
      'medium',
      'metamorphe',
      'moine',
      'ninja',
      'occultiste',
      'oracle',
      'paladin',
      'pistolier',
      'pretre',
      'pretre combattant',
      'psychiste',
      'rodeur',
      'roublard',
      'samourai',
      'sanguin',
      'scalde',
      'sorciere',
      'spirite',
      'tueur'
    )
  );

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
