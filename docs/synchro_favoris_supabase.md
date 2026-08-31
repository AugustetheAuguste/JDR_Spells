# Synchronisation des favoris — rôle du compte et de Supabase

## Le schéma

```
  PC (navigateur)                                    Téléphone (navigateur)
 ┌───────────────────┐                              ┌───────────────────┐
 │ favoris stockés    │                              │ favoris stockés    │
 │ localement          │                              │ localement          │
 │ (localStorage)      │                              │ (localStorage)      │
 └─────────┬──────────┘                              └─────────┬──────────┘
           │                                                    │
           │  1. tu te connectes avec un compte                 │  1. tu te connectes
           │     (même email/mot de passe)                      │     avec le même compte
           ▼                                                    ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                     Supabase (base Postgres en ligne)              │
 │                                                                     │
 │   table "listes"        table "listes_sorts"                       │
 │   (tes listes de favoris, liées à ton user_id)                      │
 └───────────────────────────────────────────────────────────────────┘
           ▲                                                    ▲
           │  2. push : le PC envoie ses favoris                │  2. pull : le téléphone
           │     vers Supabase                                  │     récupère ce qui est
           │                                                     │     dans Supabase
           │  3. pull : le PC récupère aussi ce                 │  3. push : et envoie
           │     que Supabase a reçu d'ailleurs                 │     les siens en retour
           ▼                                                    ▼
      fusionner() combine local + distant, sans rien perdre (union des sorts, etc.)
```

## Ce que ça veut dire

- **Sans compte** : les favoris restent coincés dans le navigateur de l'appareil où ils ont été créés. Le PC ne parle jamais au téléphone.
- **Avec compte (ce projet)** : le compte donne un `user_id` qui sert de clé dans Supabase. Chaque appareil connecté pousse ses favoris vers Supabase et récupère ceux des autres appareils. Supabase est le point de rendez-vous commun.

Le compte n'est donc pas qu'un login décoratif : c'est ce qui donne accès à l'espace personnel dans Supabase, et Supabase est ce qui fait physiquement voyager les données entre les appareils. Les deux sont nécessaires — l'un sans l'autre ne suffit pas.

## Référence code

La logique de fusion (union des sorts, tombstones de suppression, résolution de conflits par date) vit dans `web/lib/compte/synchro.ts` (`fusionner()`, `versEtat()`, `versLignes()`).

Le seul fichier qui parle à la base est `web/lib/compte/distant.ts` (trois verbes :
`tirer`, `pousser`, `enterrer`). Le déclenchement, lui, est dans
`web/lib/compte/SynchroFavoris.tsx`, et la pile de contextes qui le monte est
`web/components/Fournisseurs.tsx`.

## La panne du 2026-08-31 : monté nulle part

Symptôme : login à 200, favoris jamais synchronisés entre deux appareils, bouton
« Synchroniser maintenant » sans effet. Un HAR de production montrait
`signInWithPassword` → 200 et **zéro requête `/rest/v1/`** dans toute la capture.

Cause : `FournisseurSynchro` était écrit, exporté, testé unitairement — et
`app/layout.tsx` composait `FournisseurSession` et `FournisseurFavoris` **sans lui**.
`useSynchro()` retombait donc sur son contexte par défaut inerte, dont
`resynchroniser` est littéralement `() => {}`. Rien n'échouait : le bouton appelait
le défaut. Les 622 tests passaient parce que chacun montait le provider lui-même.

Ce n'était **ni les variables d'environnement, ni la RLS, ni `synchro.ts`** — les
trois hypothèses qu'on épuise d'abord parce qu'elles sont les plus courantes. Le
diagnostic qui tranche est celui du HAR, et il tranche par une *absence* : une RLS qui
bloque produit quand même une requête (401/403), une clé absente produit quand même
un bundle qui n'appelle rien *et* une page `/compte` qui dit « aucun service
configuré ». Zéro requête avec une page `/compte` fonctionnelle ne laisse qu'une
lecture : le code de synchro n'a jamais démarré.

Leçon retenue en test : `web/components/fournisseurs.test.tsx` monte la pile réelle
et assert le critère du HAR — une session connectée doit produire un `select` **et**
un `upsert` sur `listes`, dans cet ordre. Un test qui fournit lui-même le provider ne
peut pas voir un provider manquant ; c'est précisément par là que le bug est passé.

## Le schéma réel

⚠️ **Aucune migration SQL n'est versionnée dans ce dépôt.** Le schéma n'existe que
dans le projet Supabase et, implicitement, dans les colonnes que `distant.ts`
nomme. C'est une lacune : un projet Supabase recréé de zéro n'est pas reconstituable
depuis le dépôt. Ce qui suit est le contrat **vérifié en direct contre la base**
(existence de chaque colonne, et cible de chaque `on_conflict`), pas une DDL relue
dans un fichier.

Les noms comptent, et ils ne sont pas ceux qu'on devinerait : la clé de liste est
`id_liste` (pas `id`, pas `liste_id`), le tombstone est `supprime_le` **sur `listes`
uniquement**, et `listes_sorts` porte son propre `user_id` — parce que la clé
primaire composite en a besoin pour qu'un upsert sache identifier sa propre ligne.

| Table | Colonnes utilisées par le code | Cible d'upsert |
|---|---|---|
| `listes` | `user_id`, `id_liste`, `nom`, `cree_le`, `modifie_le`, `supprime_le`, `personnage_id` | `user_id,id_liste` |
| `listes_sorts` | `user_id`, `id_liste`, `spell_id`, `position` | `user_id,id_liste,spell_id` |
| `personnages` | `user_id`, `id`, `nom`, `classe`, `niveau`, `cree_le`, `modifie_le` | — (insert/update) |

RLS : active et vérifiée sur les trois tables. Un `POST` anonyme est refusé en
`42501` (`new row violates row-level security policy`), ce qui est la bonne réponse —
et le contrôle négatif tient : une cible d'upsert inexistante répond `42P10`, une
colonne inexistante `42703`.

## Vérifier que ça marche, sans lire le code

Le critère est réseau, pas visuel : l'interface peut afficher « à jour » au-dessus
d'une synchro qui n'a rien envoyé. DevTools → Réseau, filtre `rest/v1`.

1. **Se connecter sur `/compte`** → au moins un `GET .../listes?select=…` puis un
   `POST .../listes` (upsert). Dans cet ordre : rien n'est poussé avant que le
   tirage ne soit fusionné, sinon on écrase le serveur avec un état qui n'a pas
   encore entendu parler des autres appareils.
2. **Cliquer « Synchroniser maintenant »** → les mêmes deux requêtes repartent.
3. **Basculer un favori** → un `POST .../listes_sorts` environ 800 ms plus tard
   (`DELAI_ENVOI_MS`, débouncé pour qu'une rafale de clics soit une requête).
4. **Quitter l'onglet, revenir après plus d'une minute** → un nouveau tirage.
   Moins d'une minute : rien, c'est le garde anti-rafale (`DELAI_REVISITE_MS`).
5. **Se déconnecter** → `POST /auth/v1/logout?scope=local`. Si on lit
   `scope=global`, c'est une régression : global révoque les jetons de *tous* les
   appareils, donc le téléphone perd sa session sans rien afficher.

Si aucune requête ne part vers `supabase.co` du tout, la console dit pourquoi : le
client journalise une fois que `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` manquent au build. Ces deux variables sont **figées à
la compilation** — les ajouter chez l'hébergeur exige un nouveau build, pas seulement
un redéploiement.
