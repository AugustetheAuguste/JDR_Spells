# 08 — EXPORTER : le Python qui produit les artefacts web des dons

**Vague 3.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/08-exporter`.

## Objectives

Écrire l'exporteur Python qui produit, **une fois pour tout le catalogue et pour
aucun personnage en particulier** :

1. `web/public/data/dons/index.json` — l'index de facettes (contrat de l'étape 05).
2. `web/public/data/dons/moteur.json` — conditions analysées + gating + graphe
   (contrat de l'étape 06).
3. `web/public/data/dons/<slug>.json` — les props par don (libellés verbatim,
   description, avantages, rubriques Spécial/Normal).
4. `web/public/data/dons/DERIVE.json` — l'empreinte que
   `tools/verifier_derive_dons.py` contrôle.
5. Le **vidage `verdicts.jsonl` côté Python** — la référence du différentiel (14).

## Dependencies & Parallelization

- **Vague 3.** Dépend de :
  - **05_WEB_INDEX_CONTRACT** — le schéma `data/schemas/web_index_dons.schema.json`
    et son vérificateur.
  - **06_ENGINE_DATA_CONTRACT** — le schéma `data/schemas/moteur_dons.schema.json`.
  - **07_REGISTRY_INTEGRATION** — `src/pf_dons/classes_unifiees.py`.
  - **02_TOOLS** — le contrat `verdicts.jsonl` et `data/dons/matrice_personnages.json`.
- **Ne dépend PAS de 09.** Les deux écrivent contre les mêmes schémas sans se
  lire ; c'est tout l'objet des étapes 05 et 06.
- Parallèle à **09**, **10**, **11**, **12** : écrit uniquement sous `tools/dons/`,
  `web/public/data/dons/` et `package.json` (une entrée de script).

## Inherited Context from Dependencies

### Le code à réutiliser, pas à réécrire

`tools/dons/exporter_arbre_dons.py` (424 lignes, déplacé en étape 04) contient
déjà les cinq dérivations du graphe. **Les réutiliser telles quelles** :

| Fonction | Ce qu'elle produit |
|---|---|
| `calculer_vagues(catalog, character, slots)` | fermeture itérative de l'atteignabilité |
| `calculer_couts` | nombre exact d'emplacements, prérequis compris |
| `construire_graphe(catalog, restreint_a=None)` | nœuds + arêtes |
| `calculer_leviers` | `levier`, `levier_catalogue`, `debloque` |
| `calculer_voies` | `voie`, `voie_taille` |

`src/pf_dons/data_loader.py::load_catalog()` est **le** point d'entrée du
catalogue (pas `load_feats`, qui n'existe pas). Il renvoie 1 417 dons, zéro
prérequis de don pendant.

### La ligne de partage, qui est la décision centrale du plan

Le graphe et les dérivations dépendantes du personnage (`vague`, `cout`,
`levier`, `voie`) sont calculées **en TypeScript** à l'exécution, par l'étape 09.
L'exporteur **n'exporte pas de vagues, ni de coûts, ni de voies** : elles
dépendent du personnage, et il y a 42 × 20 × 53 = 44 520 personnages possibles
avant même de compter les caractéristiques, l'alignement, la divinité et les
2^1417 ensembles de dons acquis. Précalculer était mathématiquement indisponible
(~35 h, ~33 Go) — c'est le fait qui a fixé l'architecture.

Ce que l'exporteur émet est **indépendant du personnage** : les conditions
analysées (le parseur ne voit jamais le personnage), les tables de gating, et les
arêtes brutes de prérequis.

### `construire_graphe` est appelée deux fois — et c'est un correctif, pas un doublon

Les leviers doivent être calculés **et** sur le catalogue entier **et** sur le
sous-ensemble affiché. Les calculer sur 1 417 dons puis les afficher à côté d'un
graphe de 459 produisait 94 nœuds à levier surévalué, 13 nœuds sans arête et
2 voies nommées d'après un don non retenu. L'écart entre `levier` et
`levier_catalogue` n'est plus caché mais **affiché**. Comme l'exporteur n'émet
plus le graphe élagué, il n'émet que le **levier catalogue** ; le levier « dans la
vue » est recalculé par 09.

### Le contrat `verdicts.jsonl` (de 02, à respecter à la lettre)

Un JSON compact par ligne, aucune clé omise, `ensure_ascii` faux, LF, UTF-8 sans
BOM, trié par `(cle_personnage, nom_don)` en octets.

| Clé | Type |
|---|---|
| `cle_personnage` | `"<classe>|<niveau>|<race>"`, classe en slug des 42 |
| `nom_don` | nom exact du catalogue, astérisque des répétables comprise |
| `statut` | `"eligible" \| "manual_check" \| "ineligible"` |
| `motifs` | `string[]`, **triés** |

La matrice à parcourir est `data/dons/matrice_personnages.json` : 1 260 entrées
en profil complet, 42 en rapide. Caractéristiques fixes à 14.
**`dons_acquis = []` explicitement**, jamais `None` : `known_feats=None` fait
valoir `None` à un prérequis de don, `known_feats=set()` fait valoir `False`.

### Performance mesurée (pour dimensionner, pas pour optimiser)

`import 0,83 s | load+parse 1,21 s | 4 251 évaluations 0,095 s = 22 µs/don`.
Une matrice complète (1 260 × 1 417 ≈ 1,8 M évaluations) coûte donc ~40 s.
Acceptable pour un outil hors ligne ; ne pas paralléliser sans nécessité mesurée.

## Pseudo-code

```
# tools/dons/exporter_web.py
def exporter(sortie="web/public/data/dons"):
    catalog = load_catalog()                       # 1417 dons
    classes = charger_classes()                    # étape 07

    # --- index de facettes (contrat 05) ---
    semantique = charger(paths.FEAT_SEMANTICS)     # absent -> champs à null/[]
    construire les tables de tête, coder en entiers, dense sur i
    slug via pf_spells.slugs (le MÊME code, jamais une variante)
    valider contre web_index_dons.schema.json AVANT d'écrire

    # --- moteur (contrat 06) ---
    pour chaque don:
        sérialiser parse_conditions(...) tel quel   # Requirement | OrGroup
        brut = row.raw_conditions                   # le texte du CSV
        effectif = row.effective_conditions         # + feat_prereq_supplements
    aretes = _prereqs_dons(catalog) aplaties en (de=prérequis, vers=dépendant)
    recopier verbatim les 8 tables de gating + races + les 2 tables d'armes
        raciales extraites de engine.py
    valider contre moteur_dons.schema.json AVANT d'écrire

    # --- props par don ---
    pour chaque don: écrire <slug>.json  (nom verbatim, Src, Conditions brutes,
        Avantages, description et rubriques de feat_details.json,
        conditions_ajoutees issues de feat_prereq_supplements.json)

    # --- empreinte ---
    écrire DERIVE.json = empreinte attendue par verifier_derive_dons.py

# tools/dons/vider_verdicts.py
def vider(profil, sortie):
    catalog = load_catalog()
    pour chaque entrée de la matrice (triée):
        perso = Character(character_class=..., level=..., race=...,
                          ability_scores={...14...}, known_feats=set(),
                          alignment="Neutre", deity=None)
        pour chaque don trié par nom:
            statut, motifs = evaluate_feat(don, perso)
            écrire la ligne JSONL
```

## Logic Flow

1. Lire les deux schémas et les deux fixtures des étapes 05 et 06. **Les fixtures
   sont la spécification exécutable** : viser à produire un sur-ensemble
   structurellement identique.
2. Écrire l'index, le valider avec `scripts/check_data_contract_dons.ts`.
3. Écrire le moteur, le valider avec `scripts/check_moteur_contract_dons.ts`.
4. Écrire les props par don et `DERIVE.json`.
5. Écrire le vidage de verdicts, produire le profil **rapide** (42 lignes ×
   1 417 dons) et le committer comme référence.
6. Ajouter les entrées `dons:export` et `dons:verdicts` à `package.json`.

## Implementation Notes

- **Valider avant d'écrire, pas après.** Un artefact invalide déjà sur disque est
  un artefact qu'un consommateur peut charger.
- **Réutiliser l'algorithme de slug de `pf_spells`.** Deux algorithmes divergents
  produisent des liens morts, et le slug **est** l'URL publique.
- **Ne pas normaliser les noms de dons.** L'astérisque des répétables fait partie
  du nom ; `character_profile.assign_feat` s'appuie sur ce marqueur.
- **`raw_conditions` et `effective_conditions` sont deux champs distincts**, tous
  deux exportés. `raw_conditions` est la source qu'un audit cite ;
  `effective_conditions` est ce qui a été réellement évalué. Les confondre rendrait
  intraçable la couche `feat_prereq_supplements`.
- Fichier de données absent = dégradation propre, jamais une exception : sans
  `feat_semantics.json` l'index sort avec les champs sémantiques à `null`/`[]` et
  l'explorateur masque les facettes. C'est un invariant du dépôt d'origine.
- **Aucun budget de poids.** Le poids gzip est **mesuré et imprimé**, jamais opposé
  à un seuil (retirés le 2026-08-26 par arbitrage humain).
- Ne pas toucher à `engine.py` ni à `parser.py`. L'étape 14 a besoin d'une
  référence Python inchangée.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `python tools/dons/exporter_web.py` écrit les quatre familles d'artefacts et
   imprime le poids gzip de chacune.
2. `npx tsx scripts/check_data_contract_dons.ts web/public/data/dons/index.json`
   → sortie **0**. Idem `check_moteur_contract_dons.ts` sur `moteur.json`.
3. `index.json` contient **1 417** dons ; `i` est dense sans trou ; les slugs sont
   uniques. Un don répétable y porte `r: true` et un `*` dans `n`.
4. `moteur.json` contient **1 417** entrées de conditions et **zéro prérequis de
   don pendant** : chaque nom cité en prérequis existe comme clé. C'est
   l'invariant que `repair_benefits` garantit côté Python ; le perdre à l'export
   rendrait des chaînes entières invisibles.
5. Les **9** genres bloquants et les **6** non bloquants apparaissent dans
   `moteur.json`, et les 31 entrées `proficiency` s'y répartissent en **18**
   bloquantes (arme nommée) et **13** non bloquantes (choix du joueur).
6. Un don de la fixture de l'étape 05 est comparé champ à champ à sa contrepartie
   dans l'export réel : **structure identique**. Un test le fait pour les 24.
7. `python tools/verifier_derive_dons.py` sort **0** juste après un export, et
   **1** après avoir touché un octet de `data/dons/Dons.csv`.
8. `python tools/dons/vider_verdicts.py --profil rapide` produit un JSONL trié,
   de **42 × 1 417 = 59 514** lignes, **identique à l'octet** en le relançant.
9. Aucun champ dépendant du personnage (`vague`, `cout`, `levier` *dans la vue*,
   `voie`, `statut`) n'apparaît dans `index.json` ni `moteur.json` — `grep` → zéro.
10. `PYTHONPATH=src python -m pytest tests -q` vert ; `npm run web:test` vert.

## Git Handling

Branche `fusion/08-exporter` depuis `feat/fusion-dons`. Quatre commits :

```
feat(dons): exporteur de l'index web des dons, validé avant écriture
feat(dons): exporter les conditions analysées, le gating et les arêtes
feat(dons): props par don et empreinte de dérivation
feat(outils): vidage Python des verdicts, référence du différentiel
```

Le corps du deuxième commit doit dire pourquoi rien de dépendant du personnage
n'est exporté : 44 520 combinaisons de classe × niveau × race, avant même les
caractéristiques et les 2^1417 ensembles de dons.

## Expected Outcome

Le site statique dispose de tout ce qu'il faut pour évaluer l'éligibilité **côté
client**, sans serveur, sans base et sans route d'API — conformément à
`CLAUDE.md` §11. Et le différentiel de l'étape 14 dispose de sa référence.
