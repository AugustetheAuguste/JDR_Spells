# 07 — REGISTRY INTEGRATION : brancher le registre de classes sur le Python

**Vague 2.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/07-registry-integration`.

## Objectives

Rendre `data/conventions/classes_unifiees.json` **exploitable par le moteur** et
prouvé cohérent avec les tables de gating déjà curées :

1. Renseigner le champ `lanceur` des 42 entrées depuis sa **seule** autorité,
   `data/classes/class_caster_info.json`.
2. Écrire un lecteur `src/pf_dons/classes_unifiees.py` (chargement + accès).
3. **Valider croisément** les 42 slugs contre les trois tables de classes qui
   existent déjà, et rapporter chaque écart au lieu de le combler.

Cette étape est la porte d'entrée de l'étape 12 (migration Supabase), qui a
besoin du vocabulaire de classes et de rien d'autre.

## Dependencies & Parallelization

- **Vague 2.** Dépend de :
  - **03_CLASS_REGISTRY** — le fichier `classes_unifiees.json` et son
    transcripteur `tools/curate_classes_unifiees.py`.
  - **04_MERGE_REPO** — sans le Python déplacé, les tables de classes ne sont pas
    lisibles depuis `src/pf_dons/paths.py`.
- Parallèle à **05** et **06** : ceux-ci écrivent des schémas et des fixtures
  sous `data/schemas/` et `web/fixtures/`, celle-ci écrit sous `src/pf_dons/` et
  modifie `classes_unifiees.json`. Aucun fichier commun.
- Aucune dépendance sur 01 (le Skill `pf-dons-conventions` est consommé s'il est
  fusionné, mais n'est pas requis) ni sur 02.

## Inherited Context from Dependencies

### Depuis 03 — le fichier à compléter

`data/conventions/classes_unifiees.json` :

```
{"version": 1, "classes": [
  {"slug": "magicien", "nom": "Magicien",
   "liste_sorts": "arcaniste-ensorceleur-magicien",
   "lanceur": null, "a_curer": false, "raison_curation": null} ]}
```

**42 entrées, `slug` clé primaire, triées.** Tous les `lanceur` valent `null` en
sortie de 03 — c'est précisément ce que cette étape corrige. Une entrée porte
`a_curer: true` : `clerc`, doublon suspecté de `pretre`, laissé non tranché.

`pretre combattant` porte **une espace**, pas un tiret. Ne pas « harmoniser ».

Le transcripteur `tools/curate_classes_unifiees.py` est **la seule** façon
d'écrire ce fichier. Ne pas l'éditer à la main : ajouter la table `lanceur`
dedans, comme `curate_prereq_gating.py` le fait dans `Dons`.

### Depuis 04 — les trois tables de classes existantes

| Fichier (`data/classes/`) | Contenu | Nb de classes |
|---|---|---|
| `class_caster_info.json` | accès à la magie, curé à la main, vérité terrain vérifiée pour 43 classes | 43 |
| `class_proficiencies.json` | `armes_simples` / `armes_martiales` / `armes_specifiques` / `boucliers` | 42 |
| `CLASS_BBA_PROGRESSION` (dans `src/pf_dons/class_progression.py`) | `good` / `medium` / `poor` | table Python, source de `KNOWN_CLASSES` |

`class_caster_info.json` est **hand-curated**, sur le patron de
`class_ability_map.json` : un draft best-effort, puis une relecture humaine
transcrite. Sa vérité terrain est consignée dans
`build/dons/OUTPUT_class_caster_ground_truth.md`, **y compris la correction du
scalde**, qui y était à tort marqué non-lanceur alors que sa progression scrapée
accorde « tours de magie » au niveau 1.

### Les deux faits qui gouvernent cette étape

**1. `lanceur` et `liste_sorts` sont indépendants.** Le scalde est
`lanceur: true, liste_sorts: null` : il lance des sorts et n'a pas de liste dans
le corpus des sorts. Un schéma à un seul champ rendait cet état inexprimable.
Ne pas « simplifier » en dérivant l'un de l'autre.

**2. Classe absente ≠ classe sans capacité.** `chasseur de vampire` est absente
de `class_proficiencies.json` **exprès** : aucune classe officielle PF1 de ce nom
n'existe, donc le moteur la traite en classe inconnue (`manual_check`), jamais en
« aucune maîtrise » (`ineligible`). Toute divergence de couverture relevée ici se
**rapporte**, elle ne se comble pas.

Principe qui arbitre chaque doute : **une sous-attribution est bien plus grave
qu'une sur-attribution.** Sur-attribuer coûte un `manual_check` ;
sous-attribuer produit un `ineligible` faux, qui cache le don au joueur sans
recours.

## Pseudo-code

```
# --- tools/curate_classes_unifiees.py  (étendu) ------------------------------
def lire_lanceurs() -> dict[str, bool]:
    # lecture de la SEULE autorité, jamais une table recopiée de mémoire
    info = charger(paths.CLASS_CASTER_INFO)
    retourner { normaliser(entree.classe): entree.lanceur pour entree dans info }

def construire():
    lanceurs = lire_lanceurs()
    pour chaque slug des 42:
        si slug dans lanceurs:  lanceur = lanceurs[slug]
        sinon:                  lanceur = None      # inconnu, PAS False
        ...
    écrire le JSON

# --- src/pf_dons/classes_unifiees.py ----------------------------------------
@dataclass ClasseUnifiee:  slug, nom, liste_sorts, lanceur, a_curer,
                           raison_curation
charger_classes()      -> dict[slug -> ClasseUnifiee]   # mémoïsé
get_classe(nom)        -> ClasseUnifiee | None   # via _normalize, comme le reste
                                                 # du paquet (NFKD + minuscules)
liste_sorts_de(nom)    -> str | None
classes_par_liste()    -> dict[liste -> [slug]]  # regroupement à la lecture,
                                                 # jamais une table inverse figée

# --- tools/dons/valider_registre_classes.py  (rapport, pas correction) ------
pour chacune des trois tables:
    manquantes = les 42 absentes de la table
    surnumeraires = les clés de la table absentes des 42
imprimer un tableau par table, puis le total
sortie 0 toujours : c'est un RAPPORT. Les assertions vivent dans les tests,
                    qui figent les écarts ATTENDUS et échouent sur un nouveau.
```

## Logic Flow

1. Lire `class_caster_info.json` et `class_progression.py` en entier avant
   d'écrire une ligne.
2. Étendre le transcripteur pour renseigner `lanceur` **depuis le fichier**.
   Relancer : `git diff` ne doit montrer que les 42 champs `lanceur`.
3. Écrire `src/pf_dons/classes_unifiees.py`.
4. Écrire le rapport de validation croisée, l'exécuter, **lire sa sortie**.
5. Transcrire les écarts constatés en un test qui les fige nommément.

## Implementation Notes

- **`lanceur = None` pour une classe absente de `class_caster_info.json`**, jamais
  `False`. `magie_inaccessible` du moteur est volontairement conservateur : il
  n'est vrai que si la classe est *connue et explicitement non-lanceuse*. Écrire
  `False` pour un inconnu rendrait `False` un prérequis `caster_level` et
  produirait des `ineligible` faux — l'erreur exacte que ce helper évite.
- **Ne pas modifier `class_caster_info.json`.** C'est une table curée à la main
  dont l'autorité est une note de relecture humaine. Si le registre révèle une
  classe manquante, le **rapporter** ; la corriger est une décision de curation,
  pas d'intégration.
- **Ne pas faire de `classes_unifiees.py` une dépendance de `engine.py` dans
  cette étape.** Le moteur doit rester à comportement identique jusqu'à
  l'étape 14 (différentiel) : brancher le registre dedans changerait la référence
  Python en même temps que la cible TS. Ce module est un **lecteur**, consommé
  par 08 et 12, pas par le moteur.
- Le nombre de classes diffère d'une table à l'autre (43 / 42 / la table BBA) : ce
  n'est **pas** une anomalie à corriger, c'est un fait à documenter. Le test fige
  les écarts constatés, de sorte qu'un futur ajout silencieux échoue.
- `_normalize` existe déjà dans `engine.py` et `parser.py` (NFKD, retrait des
  combinants, minuscules). **Le réutiliser**, ne pas en écrire une variante : deux
  normalisations divergentes font rater une jointure en silence.
- Python 3.11, `from __future__ import annotations`, types partout. Identifiants
  français pour le domaine, commentaires anglais disant **pourquoi**.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. Relancer `python tools/curate_classes_unifiees.py` deux fois de suite laisse
   `git diff` **vide** : idempotence à l'octet.
2. Les **42** entrées ont un `lanceur` valant `true`, `false` ou `null` ; **aucune
   ne reste à `null` par oubli** — le test exige que le nombre de `null` soit
   égal au nombre de classes réellement absentes de `class_caster_info.json`, et
   nomme ces classes en dur.
3. `scalde` porte `lanceur: true` **et** `liste_sorts: null`. Test dédié : c'est
   le cas qui justifie deux champs, et une régression de conception y échouerait.
4. Aucune valeur de `lanceur` n'est dérivée de `liste_sorts` : un test prend une
   classe à `liste_sorts: null` et `lanceur: true` (le scalde) et une à
   `liste_sorts` non nul, et assert que les deux champs varient indépendamment.
5. `get_classe("Prêtre combattant")`, `get_classe("pretre combattant")` et
   `get_classe("PRÊTRE COMBATTANT")` renvoient la **même** entrée : la
   normalisation accentuée fonctionne.
6. `classes_par_liste()` couvre les **19** slugs de liste, et
   `arcaniste-ensorceleur-magicien` y regroupe exactement
   `{arcaniste, ensorceleur, magicien}`.
7. `python tools/dons/valider_registre_classes.py` sort **0** et imprime, pour
   chacune des trois tables, les manquantes et les surnuméraires. Un test fige
   ces listes nommément (y compris `chasseur de vampire` en surnuméraire attendu
   côté `class_caster_info.json`) et échoue si un **nouvel** écart apparaît.
8. `grep -n "class_caster_info" tools/curate_classes_unifiees.py` → au moins un
   résultat : la preuve que `lanceur` est lu et non recopié.
9. `grep -rn "classes_unifiees" src/pf_dons/engine.py` → **zéro** : le moteur
   n'est pas touché dans cette étape.
10. `PYTHONPATH=src python -m pytest tests -q` vert, **139 tests des dons
    toujours collectés**, plus les nouveaux.
11. `python -m pf_dons.cli create Ctrl --class Guerrier --level 6 --race Humain`
    puis `slots Ctrl` produit une sortie **identique** à celle capturée en
    étape 04 : le comportement du moteur n'a pas bougé.

## Git Handling

Branche `fusion/07-registry-integration` depuis `feat/fusion-dons`. Trois
commits :

```
data(classes): renseigner « lanceur » depuis class_caster_info.json
feat(dons): lecteur du registre de classes unifié
test(classes): figer les écarts de couverture entre les trois tables de classes
```

Le corps du premier commit doit dire que `class_caster_info.json` est la **seule**
autorité du champ, et qu'une classe absente donne `null` et non `false` — sans
quoi un prérequis de NLS deviendrait un `ineligible` faux.

## Expected Outcome

Un `magicien` lit `arcaniste-ensorceleur-magicien` pour ses sorts, `magicien` pour
ses dons, et son accès à la magie depuis le même fichier. L'étape 12 dispose du
vocabulaire dont elle a besoin, l'étape 08 d'un lecteur pour l'exporter, et les
écarts entre les tables de classes sont **connus et figés** au lieu d'être
découverts en production.
