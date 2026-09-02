---
name: pf-dons-taxonomie
description: Les 12 vocabulaires clos de l'étiquetage sémantique des dons (tag_feat_semantics.py), leurs libellés français figés, et la règle de séparation des espaces de noms avec les tags de sorts (?dons_* jamais ?tags=, sauf bonus_chiffre partagé) — à charger avant d'ajouter une facette de dons, un libellé, ou de connecter une URL de filtre côté dons.

---

# pf-dons-taxonomie

## Quand charger ce Skill

Charger ce Skill dans **toute** étape qui lit ou affiche
`Data/dons/feat_semantics.json`, qui construit une facette de l'explorateur de
dons, qui choisit une clé d'URL de filtre côté dons, ou qui rapproche un
vocabulaire de dons d'un vocabulaire de sorts (namespace, fusion d'UI, panneau
combiné).

Ce Skill est la référence **humaine** sur ce que ces 12 champs signifient et
comment ils s'affichent. L'autorité **machine** reste
`Data/dons/feat_semantics.json` (les valeurs réelles par don) et le code qui
les produit (`scrappers/tag_feat_semantics.py` dans le dépôt Dons) ainsi que la
table `LIBELLES` de `web/explorateur_dons.js` (dépôt Dons) pour la traduction
d'affichage. **Si le code et ce Skill divergent, le Skill gagne et le code est
corrigé.** Les clés du JSON restent les identifiants stables ; **seul
l'affichage est traduit**, ce qui garde le contrat de données indépendant de
la langue de l'interface.

Ce fichier ne recopie aucune règle du gating d'éligibilité — voir
`pf-dons-conventions` pour les cinq couches de gating, qui sont un sujet
orthogonal (ce qu'un don *exige*, pas ce qu'il *donne*).

Côté `JDR_Spells`, §13 de `CLAUDE.md` (racine du dépôt) situe ce corpus dans
l'architecture fusionnée ; ce Skill n'y ajoute que la taxonomie sémantique.

## Les 12 champs et leurs vocabulaires clos

Produits par un LLM (Bedrock) via `tag_feat_semantics.py`, jamais dérivés d'une
heuristique de mots-clés — c'est ce qui les distingue des couches de gating.

| Champ | Rôle |
|---|---|
| `effet_principal` | l'axe d'organisation **primaire** de l'explorateur — 18 valeurs, voir table ci-dessous |
| `effets_secondaires` | axes additionnels, même vocabulaire qu'`effet_principal` |
| `cible_du_bonus` | ce que le don améliore (jet d'attaque, dégâts, CA…) |
| `valeur_bonus` | magnitude du bonus, quand chiffrable |
| `contexte` | situation de jeu où le don s'applique (mêlée, social, exploration…) |
| `activation` | passif / réaction / actif illimité / actif limité / hors combat long |
| `utilisations` | nombre d'usages, quand borné |
| `polyvalence` | polyvalent / conditionnel / de niche — **facette faible**, voir plus bas |
| `resume_court` | phrase libre, pas un vocabulaire clos |
| `mots_cles` | libres, pas un vocabulaire clos |
| `categorie_officielle` | catégorie éditoriale Pathfinder (combat, métamagie…) |
| `confiance` | confiance du modèle sur l'étiquetage, pas un vocabulaire d'affichage |

### `effet_principal` — les 18 valeurs, avec leur libellé français

Copiées verbatim depuis la table `LIBELLES.effet_principal` de
`web/explorateur_dons.js` (dépôt Dons) — ne jamais retraduire à la main
ailleurs, cette table-là fait foi pour l'affichage.

| Clé | Libellé français |
|---|---|
| `bonus_chiffre` | Bonus chiffré |
| `nouvelle_action` | Nouvelle action |
| `manoeuvre` | Manœuvre de combat |
| `defense` | Défense |
| `mobilite` | Mobilité |
| `economie_action` | Économie d'action |
| `ressource` | Ressource / usages |
| `magie_amelioree` | Magie améliorée |
| `magie_nouvelle` | Magie nouvelle |
| `creation` | Création d'objet |
| `competence` | Compétences |
| `social` | Social |
| `compagnon` | Compagnon / monture |
| `soin` | Soins |
| `debuff` | Affaiblir l'adversaire |
| `equipe` | Travail d'équipe |
| `prerequis_assoupli` | Prérequis assoupli |
| `meta_don` | Méta-don |

### `cible_du_bonus` — libellés

| Clé | Libellé |
|---|---|
| `jet_attaque` | Jet d'attaque |
| `degats` | Dégâts |
| `CA` | CA |
| `jets_de_sauvegarde` | Jets de sauvegarde |
| `initiative` | Initiative |
| `competence` | Compétence |
| `DD_des_sorts` | DD des sorts |
| `NLS` | NLS |
| `PV` | Points de vie |
| `vitesse` | Vitesse |
| `DMD` | DMD (défense de manœuvre) |
| `DMO` | DMO (offense de manœuvre) |
| `confirmation_critique` | Confirmation de critique |

### `contexte` — libellés

| Clé | Libellé |
|---|---|
| `melee` | Mêlée |
| `distance` | À distance |
| `lancer_de_sorts` | Lancer de sorts |
| `exploration` | Exploration |
| `social` | Social |
| `furtivite` | Furtivité |
| `monture` | Monté |
| `aquatique_ou_aerien` | Aquatique ou aérien |
| `hors_combat` | Hors combat |

### `activation` — libellés

| Clé | Libellé |
|---|---|
| `passif` | Passif |
| `reaction` | Réaction |
| `actif_illimite` | Actif, illimité |
| `actif_limite` | Actif, usages limités |
| `long` | Hors combat (long) |

### `polyvalence` — libellés

| Clé | Libellé |
|---|---|
| `polyvalent` | Polyvalent |
| `conditionnel` | Conditionnel |
| `niche` | De niche |

### `categorie_officielle` — libellés

| Clé | Libellé |
|---|---|
| `combat` | Combat |
| `metamagie` | Métamagie |
| `creation_objet` | Création d'objet |
| `heritage` | Héritage |
| `monstre` | Monstre |
| `spectacle` | Spectacle |
| `style` | Style |
| `troupe` | Troupe |
| `mythique` | Mythique |
| `aucune` | Aucune |

### `statut` (dérivé du moteur, pas de la sémantique) — libellés

| Clé | Libellé |
|---|---|
| `eligible` | Éligible sans réserve |
| `manual_check` | À vérifier à la main |
| `acquis` | Déjà pris |

## Renormalisation côté client — hors-vocabulaire devient `None`

**Les vocabulaires fermés sont renormalisés côté client** (`normaliser_fiche`
dans `tag_feat_semantics.py`), parce que les `enum` du schéma d'outil **ne
sont pas appliqués** sur le chemin Bedrock utilisé pour cette production. Une
valeur reçue hors vocabulaire devient `None`, **jamais** une valeur inventée
qui polluerait une facette — le même principe que la politique des nulls des
autres tracks de ce dépôt : silence explicite plutôt que confabulation.

## Séparation des espaces de noms — la règle non négociable

Les tags de sorts (35, gelés en `v1`, autorité `pf-corpus-conventions`/
`pf-enrichment-conventions`) et les facettes de dons ci-dessus sont des
vocabulaires **disjoints**, produits par deux pipelines différents sur deux
corpus différents. Ils ne partagent **aucune** clé, à une exception unique :
**`bonus_chiffre`**, présent à l'identique dans les deux vocabulaires, avec le
**même sens** (un bonus numérique explicite).

Conséquence directe sur les URL de filtre : les clés de requête des dons sont
**préfixées `dons_`** — `?dons_effet=`, `?dons_cible=`, `?dons_contexte=` — et
ne doivent **jamais** utiliser une clé générique comme `?tags=`, qui
collisionnerait silencieusement avec le vocabulaire des sorts si les deux
panneaux de filtre coexistent un jour sur la même page. Une URL qui mélange
les deux espaces sans préfixe est un bug de conception, pas un raccourci
acceptable.

## `polyvalence` est une facette faible

`polyvalence` vaut `conditionnel` pour **61 %** des dons du catalogue. Ne pas
la présenter comme un filtre principal ou une facette à mettre en avant dans
une vue par défaut : à cette concentration, elle ne discrimine presque rien et
gonflerait un panneau de filtres sans aider un joueur à réduire sa liste.
