-- Fiches de personnage synchronisées sur le compte.
--
-- `fiches` est délibérément distincte de `personnages`
-- (20260902000000_personnages_pour_les_dons.sql). `personnages` sert
-- uniquement l'éligibilité des dons : nom, classe, niveau, quelques champs
-- structurés lus par le moteur pf_dons. Une fiche est un document de
-- référence entier (identité, caractéristiques, défense, sauvegardes,
-- attaques, compétences, dons, aptitudes, carnet de sorts, équipement,
-- notes — cf. `web/lib/fiche_personnage/schema.ts`), et son contenu est un
-- blob JSON opaque pour cette base : la forme interne appartient à
-- `valider.ts` côté client, jamais à une contrainte SQL. Les deux tables
-- coexistent sans dérivation dans un sens ou dans l'autre (Skill
-- `pf-fiche-personnage` § 2) : `fiches.personnage_id` est une clé étrangère
-- facultative vers `personnages`, jamais déduite automatiquement (ni par nom
-- identique, ni par toute autre heuristique), posée uniquement par un geste
-- explicite de l'utilisateur.
--
-- Les trois décisions de schéma de 20260827000000_comptes_et_favoris.sql
-- sont reproduites à l'identique, pour la même raison qu'elles y sont
-- écrites :
--
--  1. La clé primaire est composite (`user_id`, `id_fiche`). `id_fiche` est
--     engendré côté client (cf. `magasin.ts`, préfixe `f<base36>`), donc
--     unique par utilisateur seulement — deux comptes peuvent produire la
--     même graine à la même milliseconde.
--
--  2. Les horodatages sont NULLABLE. Le format local (`schema.ts`, `Meta`)
--     tolère une date absente ; un `not null` ici rendrait une fiche locale
--     valide impossible à synchroniser, ce qui violerait la règle « le
--     distant n'est jamais plus strict que le local ».
--
--  3. `supprime_le` est un marqueur, pas une suppression réelle. Sans lui,
--     une fiche effacée sur un appareil réapparaîtrait indéfiniment depuis
--     un autre qui ne l'a jamais vue disparaître : une absence ne se
--     distingue pas d'un appareil qui n'a jamais connu la fiche.

create table public.fiches (
  user_id uuid not null references auth.users (id) on delete cascade,
  id_fiche text not null,
  schema_version integer not null,
  contenu jsonb not null,
  nom text,
  cree_le timestamptz,
  modifie_le timestamptz,
  supprime_le timestamptz,
  personnage_id uuid references public.personnages (id) on delete set null,
  primary key (user_id, id_fiche),
  constraint id_fiche_non_vide check (length(id_fiche) > 0),
  -- Le contenu est un objet JSON, jamais un tableau ni un scalaire. Aucune
  -- contrainte sur sa forme interne : celle-ci appartient à `valider.ts`
  -- côté client (cf. commentaire d'en-tête), une contrainte SQL qui la
  -- dupliquerait divergerait tôt ou tard.
  constraint contenu_est_un_objet check (jsonb_typeof(contenu) = 'object'),
  constraint schema_version_positive check (schema_version > 0)
);

-- Le tri par date de modification, décroissant, est le premier besoin d'une
-- liste de fiches sur un compte — même index que `personnages_par_utilisateur`
-- l'aurait été si cette table portait une seule colonne de tri.
create index fiches_par_utilisateur on public.fiches (user_id, modifie_le desc);

alter table public.fiches enable row level security;

create policy "fiches lisibles par leur propriétaire"
  on public.fiches for select using (user_id = auth.uid());
create policy "fiches créées par leur propriétaire"
  on public.fiches for insert with check (user_id = auth.uid());
create policy "fiches modifiées par leur propriétaire"
  on public.fiches for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "fiches supprimées par leur propriétaire"
  on public.fiches for delete using (user_id = auth.uid());
