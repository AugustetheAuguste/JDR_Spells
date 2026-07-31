# Rapport 06 — Récupération de toutes les pages de sorts uniques

## Totaux

- Lignes lues dans `data/listes_classes/*.jsonl` : **8,927**
- URL de sorts distinctes : **2,070**
- Pages au manifeste : **2,070**
- Récupérées en direct (réseau) : **0**
- Servies depuis le cache : **2,070**
- Statut `ok` : **2,070** (100.00 %)
- Statut `erreur` : **0**
- Durée totale : **0.1 min** (8 s)

L'écart entre lignes lues et URL distinctes (8,927 → 2,070) est le partage inter-classes des sorts, déjà visible dans les listes de l'étape 04.

## Portes de validation appliquées

- taille du fichier ≥ 8,000 octets
- décodage UTF-8 explicite sans erreur
- présence de `id="PageContentDiv"`, `class="pagetitle"` et `Niveau`

## Échecs

**Aucun échec.** Les 2,070 pages sont en cache, décodables en UTF-8, ≥ 8,000 octets et portent les trois marqueurs.

## Idempotence

Une seconde exécution ne déclenche aucune requête réseau : `from_cache` vaut `true` sur toutes les lignes et `cache/index.jsonl` n'augmente pas (le journal n'est écrit que pour les fetch en direct).
