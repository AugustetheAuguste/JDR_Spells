# 02 — TOOLS : outillage de vérification, construit avant tout code fonctionnel

**Vague 1.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/02-tools`.

## Objectives

Construire les quatre outils dont les étapes 08, 09 et 14 dépendent, **et
surtout figer le contrat `verdicts.jsonl`** : c'est lui qui permet au producteur
Python (08) et au moteur TS (09) d'être écrits **en parallèle**, sans se
connaître, puis comparés en 14.

1. `tools/matrice_personnages.py` — génère la matrice de personnages de test.
2. Le format **`verdicts.jsonl`** — le vidage de verdicts, émis par les deux
   moteurs.
3. `scripts/comparer_verdicts.ts` — le différentiel **asymétrique** (I3).
4. `tools/verifier_derive_dons.py` — garde anti-péremption d'artefact (I7).

## Dependencies & Parallelization

- **Vague 1. Aucune dépendance.** Les quatre outils opèrent sur des formats
  déclarés ici, pas sur du code existant.
- `matrice_personnages.py` **n'importe pas** `pf_dons` : il écrit un JSON depuis
  la liste de classes inlinée ci-dessous. C'est ce qui le rend indépendant de
  l'étape 03 (registre) et 04 (déplacement du Python).
- `comparer_verdicts.ts` est une fonction pure JSONL → rapport : il ne connaît
  ni Python, ni TypeScript côté moteur.
- Aucune dépendance cachée : aucun de ces fichiers n'est touché par 01, 03 ou 04.

## Inherited Context from Dependencies

Aucune étape amont. Tout ce qui suit est la source de vérité.

### Les 42 classes (vocabulaire primaire, inliné exprès)

```
alchimiste, antipaladin, arcaniste, barbare, barde, bretteur, cavalier, chaman,
chasseur, chevalier, cinetiste, clerc, conjurateur, druide, enqueteur,
ensorceleur, guerrier, hypnotiseur, inquisiteur, justicier, lutteur, magicien,
magus, medium, metamorphe, moine, ninja, occultiste, oracle, paladin, pistolier,
pretre, pretre combattant, psychiste, rodeur, roublard, samourai, sanguin,
scalde, sorciere, spirite, tueur
```

### Échantillon de races (6, choisi pour couvrir les mécaniques de gating)

`humain` (neutre, aucun trait exotique) · `elfe` (arc long racial) ·
`nain` (marteau de guerre **et** reclassement des armes naines) ·
`tengu` (attaque de morsure → gating `anatomy`) ·
`aasimar` (magie innée → gating `spellcasting` par la race) ·
`gnome` (taille P → gating `size`).

### Contrat `verdicts.jsonl` — **à figer, consommé par 08, 09 et 14**

Un enregistrement JSON compact par ligne, **aucune clé omise**, `ensure_ascii`
faux, LF, UTF-8 sans BOM. Ordre de tri **imposé** pour que deux vidages soient
comparables ligne à ligne : `(cle_personnage, nom_don)`, tri par octets.

| Clé | Type | Sens |
|---|---|---|
| `cle_personnage` | `string` | `<classe>|<niveau>|<race>`, la classe en slug des 42 |
| `nom_don` | `string` | nom exact du catalogue, astérisque des dons répétables compris |
| `statut` | `"eligible" \| "manual_check" \| "ineligible"` | le verdict |
| `motifs` | `string[]` | motifs, **triés**, tels que le moteur les produit |

`motifs` est comparé **en second** et n'est jamais bloquant à lui seul : un
libellé de motif qui diffère est un avertissement, un `statut` qui diffère est
une erreur. Sans cette asymétrie, une reformulation de message ferait échouer la
CI et le garde serait désactivé au premier agacement.

### La règle asymétrique (I3) — le cœur de `comparer_verdicts.ts`

Le dépôt `Dons` tient que *une sous-attribution est bien plus grave qu'une
sur-attribution*. Ce n'est pas une phrase de documentation : c'est une règle de
CI. Trois classes de divergence, **rapportées séparément** :

| Classe | Python → TS | Verdict CI |
|---|---|---|
| **RÉGRESSION** | `eligible`/`manual_check` → `ineligible` | **échec dur.** Le don disparaît de la vue du joueur, sans recours. |
| **RELÂCHEMENT** | `ineligible` → `eligible`/`manual_check` | échec, rapporté à part |
| **BRUIT** | `motifs` seuls diffèrent | avertissement, sortie 0 |

Le seuil est **zéro** pour les deux premières. Ne pas proposer de tolérance.

## Pseudo-code

```
# --- tools/matrice_personnages.py -------------------------------------------
CLASSES = [les 42 ci-dessus]
NIVEAUX = [1, 5, 10, 15, 20]
RACES   = [humain, elfe, nain, tengu, aasimar, gnome]

def engendrer(profil="complet"):
    si profil == "complet":   -> produit cartésien           # 42*5*6 = 1260
    si profil == "rapide":    -> 42 classes x niveau 6 x humain  # 42, pour la boucle locale
    chaque entrée porte:
        classe, niveau, race,
        caracteristiques = {for,dex,con,int,sag,cha} = 14  # valeur fixe, jamais aléatoire
        alignement = "Neutre", divinite = None
        dons_acquis = []                                   # ensemble vide EXPLICITE
    écrire data/dons/matrice_personnages.json  (trié, indent=2, LF)

# --- scripts/comparer_verdicts.ts -------------------------------------------
lire(referenceJsonl, candidatJsonl)
    indexer par (cle_personnage, nom_don)
    si les ensembles de clés diffèrent -> échec dur « couverture divergente »
    pour chaque clé:
        classer en REGRESSION | RELACHEMENT | BRUIT | identique
    imprimer par classe, les 20 premiers exemples, puis les totaux
    imprimer la couverture: nb personnages, nb dons, nb cellules
    sortie 1 si REGRESSION > 0 ou RELACHEMENT > 0
    sortie 0 si seulement BRUIT (mais l'imprimer)

# --- tools/verifier_derive_dons.py -----------------------------------------
empreinte = sha256 trié de (chemin relatif, sha256 du contenu) pour data/dons/**,
            data/classes/**, data/conditions/**, data/races/**,
            data/conventions/classes_unifiees.json
comparer à l'empreinte enregistrée dans web/public/data/dons/DERIVE.json
si différente -> sortie 1, message nommant les fichiers changés
                 et la commande de réexport à lancer
```

## Logic Flow

1. Écrire `matrice_personnages.py` et engendrer les deux profils. Committer la
   matrice : c'est une fixture, elle doit être stable d'un run à l'autre.
2. Écrire `comparer_verdicts.ts`. **Le tester sur des vidages fabriqués à la
   main** (voir ci-dessous) — c'est le seul moment du plan où on peut prouver
   que le différentiel détecte ce qu'il doit détecter, avant que les vrais
   moteurs existent.
3. Écrire `verifier_derive_dons.py`. À ce stade `web/public/data/dons/` n'existe
   pas : l'outil doit sortir **1 avec un message clair** (« artefact absent »),
   jamais planter sur une trace d'exception.
4. Ne pas encore brancher dans `verifier:tout` — c'est l'étape 14 qui le fait,
   quand les deux moteurs existent et que le garde peut passer.

## Implementation Notes

- **`comparer_verdicts.ts` doit être testé contre des fixtures adverses**, pas
  seulement contre un cas identique. Créer sous
  `web/fixtures/verdicts/` quatre paires minuscules (3 lignes chacune) :
  `identique`, `une_regression`, `un_relachement`, `bruit_de_motif`. Un test
  vitest assert le code de sortie **et** la classe rapportée pour chacune.
  Un différentiel qui ne détecte rien passe une CI verte en silence : c'est
  exactement le mode de panne que ce plan doit exclure.
- **Les caractéristiques de la matrice sont fixes à 14, jamais aléatoires.** Un
  générateur aléatoire rendrait un échec de CI non reproductible.
- **`dons_acquis = []` explicitement**, jamais `None`/absent. La sémantique
  diffère : `known_feats=None` fait valoir `None` (manual_check) à un prérequis
  de don, `known_feats=set()` fait valoir `False`. `exporter_arbre_dons.py`
  passe déjà un ensemble explicite pour cette raison ; la matrice doit faire
  pareil, sinon 08 et 09 mesureront deux sémantiques différentes.
- `verifier_derive_dons.py` suit le patron de `tools/verifier_derive.py` existant
  (le lire d'abord), mais sur l'arborescence des dons.
- Python 3.11, `from __future__ import annotations`, types annotés partout.
  Identifiants français pour le domaine, commentaires en anglais expliquant
  **pourquoi**. TypeScript strict, aucun `any`.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `python tools/matrice_personnages.py` écrit `data/dons/matrice_personnages.json`
   contenant **1 260** entrées pour le profil complet (42 × 5 × 6) et **42** pour
   le profil rapide. Relancer deux fois produit un fichier **identique à
   l'octet**.
2. `npx tsx scripts/comparer_verdicts.ts <a> <b>` sur les quatre fixtures :
   - `identique` → sortie **0**, rapport « 0 régression, 0 relâchement ».
   - `une_regression` → sortie **1**, la ligne fautive nommée, classée
     **RÉGRESSION**.
   - `un_relachement` → sortie **1**, classée **RELÂCHEMENT** (et *pas*
     régression).
   - `bruit_de_motif` → sortie **0**, avertissement imprimé.
3. Une couverture divergente (une clé présente d'un côté seulement) → sortie 1
   avec le message « couverture divergente », **pas** un rapport de 0 divergence.
4. `python tools/verifier_derive_dons.py` sort **1** avec « artefact absent »
   (`web/public/data/dons/` n'existe pas encore), sans trace d'exception.
5. `npm --prefix web run typecheck` et `lint` verts. `npm run web:test` vert,
   incluant les nouveaux tests des fixtures adverses.
6. `git diff --stat` ne touche que `tools/`, `scripts/`, `web/fixtures/verdicts/`,
   `data/dons/matrice_personnages.json` et le test associé.

## Git Handling

Branche `fusion/02-tools` depuis `feat/fusion-dons`. Quatre commits :

```
feat(outils): matrice de personnages de test, déterministe et committée
feat(outils): contrat verdicts.jsonl et différentiel asymétrique Python/TS
test(outils): fixtures adverses — un différentiel non testé passe en silence
feat(outils): garde anti-péremption des artefacts dérivés des dons
```

Le corps du deuxième commit doit énoncer la règle asymétrique et pourquoi une
régression est un échec dur là où un relâchement est seulement une erreur.

## Expected Outcome

Le contrat `verdicts.jsonl` est figé, donc **08 et 09 peuvent être écrites en
parallèle sans se lire**. Le différentiel est prouvé capable de détecter les trois
classes de divergence *avant* qu'un seul moteur existe — l'ordre qui compte, car
un garde écrit après coup est un garde ajusté jusqu'à ce qu'il passe.
