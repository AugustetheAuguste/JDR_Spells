-- Tests pgTAP pour la migration `20260902000000_personnages_pour_les_dons.sql`.
--
-- Lancé via `supabase test db` (nécessite Docker ; non exécutable dans un
-- environnement sans conteneurs — voir le rapport de l'étape). Chaque section
-- correspond à un critère numéroté de `12_SUPABASE_MIGRATION.md`.
--
-- Deux utilisateurs de `auth.users` sont créés directement (contournant
-- l'inscription normale) pour isoler le test de tout flux d'authentification :
-- seule la RLS sur `personnages` est sous test ici.

begin;

select plan(20);

-- --------------------------------------------------------------------------
-- Prépare deux comptes distincts.
-- --------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test');

-- --------------------------------------------------------------------------
-- Critère 6 : dons_acquis vaut [] et non null, y compris pour une ligne
-- ancienne qui n'a jamais renseigné le champ.
-- --------------------------------------------------------------------------

set local role postgres;
insert into public.personnages (id, user_id, nom, classe, niveau)
  values ('a0000000-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Ancien personnage', 'guerrier', 5);

select is(
  (select dons_acquis from public.personnages
   where id = 'a0000000-0000-0000-0000-000000000001'),
  '[]'::jsonb,
  'une ligne insérée sans dons_acquis reçoit [] et non null'
);

select isnt(
  (select dons_acquis from public.personnages
   where id = 'a0000000-0000-0000-0000-000000000001'),
  null::jsonb,
  'dons_acquis n''est jamais null'
);

-- --------------------------------------------------------------------------
-- Critère 9 : alignement/divinite restent nullables sans défaut.
-- --------------------------------------------------------------------------

insert into public.personnages (id, user_id, nom)
  values ('a0000000-0000-0000-0000-000000000002',
          '11111111-1111-1111-1111-111111111111', 'Sans alignement ni divinité');

select is(
  (select alignement from public.personnages where id = 'a0000000-0000-0000-0000-000000000002'),
  null::text,
  'alignement absent à l''insertion reste null'
);
select is(
  (select divinite from public.personnages where id = 'a0000000-0000-0000-0000-000000000002'),
  null::text,
  'divinite absente à l''insertion reste null'
);

-- --------------------------------------------------------------------------
-- Critère 7 : caracteristiques refuse un objet à cinq clés, accepte null.
-- --------------------------------------------------------------------------

select lives_ok(
  $$insert into public.personnages (user_id, nom, caracteristiques)
    values ('11111111-1111-1111-1111-111111111111', 'Caractéristiques null', null)$$,
  'caracteristiques null est accepté'
);

select throws_ok(
  $$insert into public.personnages (user_id, nom, caracteristiques)
    values ('11111111-1111-1111-1111-111111111111', 'Cinq clés',
            '{"for":10,"dex":10,"con":10,"int":10,"sag":10}'::jsonb)$$,
  23514,
  null,
  'un objet à cinq clés (cha manquant) est rejeté par personnages_caracteristiques_valides'
);

select lives_ok(
  $$insert into public.personnages (user_id, nom, caracteristiques)
    values ('11111111-1111-1111-1111-111111111111', 'Six clés complètes',
            '{"for":10,"dex":10,"con":10,"int":10,"sag":10,"cha":10}'::jsonb)$$,
  'un objet aux six clés exactes est accepté'
);

-- --------------------------------------------------------------------------
-- Critère 3/4 : personnages_classe_connue, valeur par valeur.
-- --------------------------------------------------------------------------

select lives_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Nul', null)$$,
  'classe null est acceptée'
);

select lives_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Guerrier ok', 'guerrier')$$,
  'un des 42 slugs (guerrier) est accepté'
);

select lives_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Prêtre combattant espace',
     'pretre combattant')$$,
  '« pretre combattant » avec une espace (et non un tiret) est accepté'
);

select throws_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Majuscule', 'Magicien')$$,
  23514,
  null,
  '« Magicien » (majuscule) est rejeté'
);

select throws_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Tiret', 'pretre-combattant')$$,
  23514,
  null,
  '« pretre-combattant » (tiret) est rejeté'
);

select throws_ok(
  $$insert into public.personnages (user_id, nom, classe) values
    ('11111111-1111-1111-1111-111111111111', 'Chasseur de vampire',
     'chasseur de vampire')$$,
  23514,
  null,
  '« chasseur de vampire » est rejeté'
);

-- --------------------------------------------------------------------------
-- Critère 6 (suite) : dons_acquis doit être un tableau JSON.
-- --------------------------------------------------------------------------

select throws_ok(
  $$insert into public.personnages (user_id, nom, dons_acquis) values
    ('11111111-1111-1111-1111-111111111111', 'Objet au lieu de tableau', '{}'::jsonb)$$,
  23514,
  null,
  'dons_acquis doit être un tableau JSON, un objet est rejeté'
);

select lives_ok(
  $$insert into public.personnages (user_id, nom, dons_acquis) values
    ('11111111-1111-1111-1111-111111111111', 'Tableau de dons',
     '["Endurance", "Attaque en puissance"]'::jsonb)$$,
  'dons_acquis accepte un tableau de chaînes'
);

-- --------------------------------------------------------------------------
-- Critère 8 : RLS sur les colonnes nouvelles, à deux utilisateurs.
-- --------------------------------------------------------------------------

insert into public.personnages
  (id, user_id, nom, classe, race, caracteristiques, alignement, divinite, dons_acquis)
values
  ('b0000000-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Personnage d''Alice', 'guerrier',
   'humain', '{"for":16,"dex":12,"con":14,"int":10,"sag":10,"cha":8}'::jsonb,
   'loyal bon', 'Iomédae', '["Endurance"]'::jsonb),
  ('b0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Personnage de Bob', 'roublard',
   'halfelin', '{"for":8,"dex":18,"con":10,"int":10,"sag":10,"cha":10}'::jsonb,
   'chaotique neutre', null, '["Esquive"]'::jsonb);

-- Alice ne lit pas les nouvelles colonnes de Bob.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*) from public.personnages
   where id = 'b0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Alice ne voit pas la ligne de Bob (donc ni race, ni caracteristiques, ni alignement, ni divinite, ni dons_acquis de Bob)'
);

select is(
  (select race from public.personnages where id = 'b0000000-0000-0000-0000-000000000001'),
  'humain',
  'Alice lit bien sa propre colonne race'
);

-- Alice ne peut pas écrire les nouvelles colonnes de Bob.
select throws_ok(
  $$update public.personnages set dons_acquis = '["Vol"]'::jsonb
    where id = 'b0000000-0000-0000-0000-000000000002'$$,
  null,
  null,
  'la tentative d''Alice de modifier dons_acquis du personnage de Bob ne modifie rien (RLS)'
);

-- Vérifie explicitement que la ligne de Bob n'a pas changé.
reset role;
select is(
  (select dons_acquis from public.personnages
   where id = 'b0000000-0000-0000-0000-000000000002'),
  '["Esquive"]'::jsonb,
  'dons_acquis du personnage de Bob est resté intact après la tentative d''Alice'
);

-- Bob, de son côté, lit et modifie bien sa propre ligne.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select divinite from public.personnages where id = 'b0000000-0000-0000-0000-000000000002'),
  null::text,
  'Bob lit correctement sa propre divinite (null, jamais renseignée)'
);

select lives_ok(
  $$update public.personnages set dons_acquis = '["Esquive", "Vol"]'::jsonb
    where id = 'b0000000-0000-0000-0000-000000000002'$$,
  'Bob peut modifier son propre dons_acquis'
);

reset role;
select * from finish();

rollback;
