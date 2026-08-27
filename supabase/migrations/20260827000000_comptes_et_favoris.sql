-- Comptes, personnages et favoris synchronisés.
--
-- Ce schéma reflète `web/lib/favoris/stockage.ts`, il ne le réinvente pas : une
-- liste de favoris y est un objet nommé et horodaté, pas un simple ensemble
-- d'identifiants, et la synchronisation ne peut pas être plus pauvre que le
-- format local sans perdre des données à la première montée.
--
-- Trois décisions portent tout le reste :
--
--  1. `id_liste` est généré par le client (`l<base36>`), donc unique par
--     utilisateur seulement. La clé primaire est composite : deux comptes
--     peuvent produire la même graine dans la même milliseconde, et un
--     `id_liste` seul en clé les ferait entrer en collision.
--
--  2. Les horodatages sont NULLABLE. `validerListe` traite une date absente
--     comme une métadonnée qu'on remplit plutôt que comme une perte, et une
--     liste locale valide porte `''`. Un `not null` ici rendrait cette liste
--     impossible à synchroniser — le distant ne doit jamais être plus strict
--     que le local.
--
--  3. `supprime_le` est un marqueur, pas une suppression. Sans lui, une liste
--     effacée sur le téléphone réapparaît depuis le serveur indéfiniment : une
--     absence ne se distingue pas d'un appareil qui n'a jamais vu la liste. La
--     suppression est donc une écriture datée, et c'est la seule colonne qui
--     n'existe que pour la synchronisation.

-- --------------------------------------------------------------------------
-- profils
-- --------------------------------------------------------------------------
-- `auth.users` est géré par Supabase et ne doit pas être étendu : tout ce qui
-- nous appartient vit ici. Le pseudo est facultatif — un compte utilisable sans
-- avoir à se nommer.

create table public.profils (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null default '',
  cree_le timestamptz not null default now()
);

alter table public.profils enable row level security;

create policy "profil lisible par son propriétaire"
  on public.profils for select using (user_id = auth.uid());
create policy "profil créé par son propriétaire"
  on public.profils for insert with check (user_id = auth.uid());
create policy "profil modifié par son propriétaire"
  on public.profils for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "profil supprimé par son propriétaire"
  on public.profils for delete using (user_id = auth.uid());

-- Le profil naît avec le compte. En trigger et non côté client : un client qui
-- oublie l'insertion laisse un compte sans profil, et c'est un état qu'aucune
-- lecture ne sait réparer.
create function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger creer_profil_apres_inscription
  after insert on auth.users
  for each row execute function public.creer_profil();

-- --------------------------------------------------------------------------
-- personnages
-- --------------------------------------------------------------------------
-- Vide pour l'instant : l'interface ne l'utilise pas encore. La table existe
-- dès maintenant parce que `listes.personnage_id` la référence, et parce
-- qu'ajouter une table est gratuit là où migrer des données ne l'est pas.

create table public.personnages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  classe text,
  niveau integer,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create index personnages_par_utilisateur on public.personnages (user_id);

alter table public.personnages enable row level security;

create policy "personnages lisibles par leur propriétaire"
  on public.personnages for select using (user_id = auth.uid());
create policy "personnages créés par leur propriétaire"
  on public.personnages for insert with check (user_id = auth.uid());
create policy "personnages modifiés par leur propriétaire"
  on public.personnages for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "personnages supprimés par leur propriétaire"
  on public.personnages for delete using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- listes
-- --------------------------------------------------------------------------
-- Exactement `ListeFavoris`, plus son propriétaire et les deux colonnes de
-- synchronisation. `personnage_id` porte l'appartenance à un personnage sur la
-- LISTE et non sur le sort : « la liste de sorts de mon magicien » est la façon
-- dont ça se dira, et la mettre ici évite une migration plus tard.

create table public.listes (
  user_id uuid not null references auth.users (id) on delete cascade,
  id_liste text not null,
  nom text not null default '',
  cree_le timestamptz,
  modifie_le timestamptz,
  supprime_le timestamptz,
  personnage_id uuid references public.personnages (id) on delete set null,
  primary key (user_id, id_liste),
  constraint id_liste_non_vide check (length(id_liste) > 0)
);

alter table public.listes enable row level security;

create policy "listes lisibles par leur propriétaire"
  on public.listes for select using (user_id = auth.uid());
create policy "listes créées par leur propriétaire"
  on public.listes for insert with check (user_id = auth.uid());
create policy "listes modifiées par leur propriétaire"
  on public.listes for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "listes supprimées par leur propriétaire"
  on public.listes for delete using (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- listes_sorts
-- --------------------------------------------------------------------------
-- `spell_id` est l'`id` du corpus (l'algorithme de slug de CLAUDE.md § 4), pas
-- le slug d'URL : c'est déjà le choix de `stockage.ts`, pour la raison qui y est
-- écrite — un id est stable, un slug est une fonction du nommage.
--
-- Aucune clé étrangère vers le corpus : le corpus n'est pas dans cette base, et
-- un id que le corpus ne connaît plus doit être CONSERVÉ et signalé, jamais
-- supprimé (`idsInconnus`). Une contrainte référentielle ici transformerait une
-- correction de corpus en perte de favoris.
--
-- `position` préserve l'ordre d'insertion que le format local garantit : un
-- `order by` sans elle rendrait les favoris dans un ordre arbitraire.

create table public.listes_sorts (
  user_id uuid not null,
  id_liste text not null,
  spell_id text not null,
  position integer not null default 0,
  primary key (user_id, id_liste, spell_id),
  foreign key (user_id, id_liste)
    references public.listes (user_id, id_liste) on delete cascade
);

create index listes_sorts_par_liste on public.listes_sorts (user_id, id_liste);

alter table public.listes_sorts enable row level security;

create policy "sorts lisibles par leur propriétaire"
  on public.listes_sorts for select using (user_id = auth.uid());
create policy "sorts créés par leur propriétaire"
  on public.listes_sorts for insert with check (user_id = auth.uid());
create policy "sorts modifiés par leur propriétaire"
  on public.listes_sorts for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "sorts supprimés par leur propriétaire"
  on public.listes_sorts for delete using (user_id = auth.uid());
