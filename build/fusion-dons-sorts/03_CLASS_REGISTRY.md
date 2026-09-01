# 03 — CLASS REGISTRY : un seul vocabulaire de classes pour les deux corpus

**Vague 1.** Dépôt cible : `C:\Users\adoyet\Desktop\JDR_Spells`.
Branche : `fusion/03-class-registry`.

## Objectives

Créer `data/conventions/classes_unifiees.json` : la clé de jointure entre les
deux corpus (I2). **Les 42 classes du corpus de dons sont la clé primaire** ;
chacune porte, séparément, son accès à la magie et sa liste de sorts.

Décision humaine actée : les libellés combinés du corpus de sorts sont
rétrogradés en **identité de liste de sorts** et cessent d'être la classe du
personnage. « Jamais scindés » (`JDR_Spells/CLAUDE.md` §9) continue de tenir : le
libellé combiné reste une page du wiki, il n'est simplement plus une classe.

## Dependencies & Parallelization

- **Vague 1. Aucune dépendance.** Toutes les listes nécessaires sont inlinées
  ci-dessous ; cette étape n'a pas besoin que le Python soit déplacé (04) ni que
  les Skills existent (01).
- La **validation croisée** contre `class_caster_info.json` et
  `class_proficiencies.json` n'a pas lieu ici mais en **07** : elle exige le
  Python déplacé. Cette étape écrit le fichier et sa validation **interne**.
- Aucune dépendance cachée : écrit un seul fichier neuf plus son test.

## Inherited Context from Dependencies

Aucune étape amont. Le tableau ci-dessous **est** la source.

### Les 19 slugs de liste de sorts (corpus des sorts, inchangés)

```
alchimiste · antipaladin · arcaniste-ensorceleur-magicien · barde · chaman
chasseur · conjurateur · druide · hypnotiseur · inquisiteur · magus · medium
occultiste · paladin · pretre-pretre-combattant-oracle · psychiste · sanguin
sorciere · spirite
```

### La table de correspondance — 42 entrées

`liste_sorts` = le slug des 19, ou `null`. **`null` signifie « aucune liste dans
ce corpus », jamais « cette classe ne lance pas de sorts »** : les deux faits
sont indépendants et vivent dans deux champs.

| slug (42) | `liste_sorts` |
|---|---|
| alchimiste | alchimiste |
| antipaladin | antipaladin |
| arcaniste | arcaniste-ensorceleur-magicien |
| ensorceleur | arcaniste-ensorceleur-magicien |
| magicien | arcaniste-ensorceleur-magicien |
| barde | barde |
| chaman | chaman |
| chasseur | chasseur |
| conjurateur | conjurateur |
| druide | druide |
| hypnotiseur | hypnotiseur |
| inquisiteur | inquisiteur |
| magus | magus |
| medium | medium |
| occultiste | occultiste |
| paladin | paladin |
| oracle | pretre-pretre-combattant-oracle |
| pretre | pretre-pretre-combattant-oracle |
| pretre combattant | pretre-pretre-combattant-oracle |
| psychiste | psychiste |
| sanguin | sanguin |
| sorciere | sorciere |
| spirite | spirite |
| barbare · bretteur · cavalier · chevalier · guerrier · justicier · lutteur · moine · ninja · pistolier · roublard · samourai · tueur | `null` (classes sans sorts) |
| cinetiste · enqueteur · metamorphe · rodeur · scalde | `null` (**lance des sorts, liste absente du corpus**) |
| clerc | **`null` + `a_curer: true`** — voir ci-dessous |

### Le point qui exige un arbitrage humain : `clerc`

`Data/classes/class_proficiencies.json` contient **`clerc` *et* `pretre` *et*
`pretre combattant`**. En Pathfinder 1e francophone, le clerc *est* le prêtre :
`clerc` est très probablement un **alias** ou un doublon d'extraction, pas une
42ᵉ classe distincte.

**Ne pas trancher.** Le dépôt `Dons` ne devine jamais une entrée de table de
gating : chacune de ses cinq couches est curée à la main, et `chasseur de
vampire` est le précédent exact — une classe inexistante y est laissée absente,
donc `manual_check`, plutôt que devinée. Écrire donc `clerc` avec
`"a_curer": true` et `"raison_curation"` expliquant le doublon suspecté, et
l'inscrire dans les questions ouvertes du rapport final.

### Le cas qui valide la conception du schéma : `scalde`

`Dons/CLAUDE.md` consigne que le scalde était **à tort marqué non-lanceur** dans
`class_caster_info.json`, et que la correction est vérité terrain vérifiée. Or le
scalde n'a **pas** de liste dans le corpus des sorts. Il est donc
`lanceur: true, liste_sorts: null` — état parfaitement licite qu'un schéma à un
seul champ rendrait inexprimable. C'est la raison d'être des deux champs.

### Forme du fichier

`data/conventions/classes_unifiees.json`, UTF-8 sans BOM, LF, `indent=2`,
`ensure_ascii` faux, newline final. Clés françaises, `snake_case`, sans accent.
Aucune clé omise : scalaire absent → `null`.

```
{
  "version": 1,
  "classes": [
    {
      "slug": "magicien",                  # clé primaire, l'un des 42
      "nom": "Magicien",                   # libellé d'affichage, accentué verbatim
      "liste_sorts": "arcaniste-ensorceleur-magicien",   # ou null
      "lanceur": null,                     # renseigné en 07 depuis class_caster_info.json
      "a_curer": false,
      "raison_curation": null
    }
  ]
}
```

**`lanceur` est laissé à `null` ici, exprès.** Sa seule autorité est
`Data/classes/class_caster_info.json`, qui n'est présent qu'après l'étape 04.
Le remplir de mémoire ici serait recopier une table de gating curée à la main —
précisément ce que les Skills interdisent. L'étape 07 le renseigne et le vérifie.

## Pseudo-code

```
# tools/curate_classes_unifiees.py  — transcripteur, pas dériveur
TABLE = { les 42 paires (slug -> liste_sorts) ci-dessus }        # écrite en dur
NOMS  = { slug -> libellé accentué }                             # écrite en dur
A_CURER = { "clerc": "doublon suspecté de « pretre » ; aucune classe officielle
                      « clerc » distincte du prêtre en PF1 francophone" }

def construire():
    entrees = []
    pour slug trié dans TABLE:
        entrees.append({slug, nom=NOMS[slug], liste_sorts=TABLE[slug],
                        lanceur=None,
                        a_curer=slug in A_CURER,
                        raison_curation=A_CURER.get(slug)})
    écrire data/conventions/classes_unifiees.json
```

Comme `curate_prereq_gating.py` dans `Dons`, ce script **transcrit** une table
relue ; il ne la redérive pas. Le relancer doit être idempotent à l'octet.

## Logic Flow

1. Écrire le transcripteur avec les deux tables en dur.
2. L'exécuter, obtenir le JSON.
3. Écrire le test de validation **interne** (`tests/test_classes_unifiees.py`).
4. Vérifier l'idempotence : relancer, `git diff` vide.

## Implementation Notes

- **Direction de la correspondance** : 42 → 19 est une fonction totale ; 19 → 42
  n'en est pas une. C'est pourquoi 42 est la clé primaire, et pas un choix de
  goût. Une fonction inverse ne doit pas être écrite ; un consommateur qui a
  besoin de « quelles classes partagent cette liste » regroupe à la lecture.
- `pretre combattant` porte **une espace**, pas un tiret : c'est la forme
  normalisée du corpus de dons, et la changer casserait la jointure avec
  `class_proficiencies.json`. Ne pas « harmoniser » en slug à tirets. Si un slug
  d'URL est nécessaire plus tard, il est **dérivé** au dernier moment, jamais
  substitué ici.
- Les 19 slugs de liste, eux, sont déjà à tirets : ne pas les toucher, ce sont
  les URLs publiques du corpus de sorts.
- Aucune valeur inventée. Si un libellé d'affichage n'est pas connu avec
  certitude, prendre le slug capitalisé et le signaler — pas de fantaisie.
- Ne créer **aucun** fichier `__init__` et n'ajouter **aucun** `__all__`.

## Verification Criteria

1. `data/conventions/classes_unifiees.json` existe et contient exactement **42**
   entrées.
2. Les `slug` sont **uniques** et **triés**.
3. Chaque `liste_sorts` non nul appartient aux **19** slugs listés ci-dessus —
   aucun autre. Le test énumère les 19 en dur et l'assert.
4. Les 19 slugs de liste sont **tous couverts** par au moins une des 42 classes :
   aucun corpus de sorts orphelin. (Test bidirectionnel : c'est celui qui attrape
   une faute de frappe dans un libellé combiné.)
5. `arcaniste`, `ensorceleur`, `magicien` pointent tous trois vers
   `arcaniste-ensorceleur-magicien` ; `oracle`, `pretre`, `pretre combattant`
   tous trois vers `pretre-pretre-combattant-oracle`.
6. `clerc` porte `a_curer: true` et une `raison_curation` non vide. **Exactement
   une** entrée porte `a_curer: true` ; le test l'assert, pour qu'un futur ajout
   silencieux d'entrée douteuse échoue.
7. Tous les `lanceur` valent `null` (ils sont renseignés en 07, pas ici).
8. `pretre combattant` contient une espace et aucun tiret.
9. Relancer le transcripteur laisse `git diff` **vide** (idempotence à l'octet).
10. `python -m pytest tests/test_classes_unifiees.py -q` vert.

## Git Handling

Branche `fusion/03-class-registry` depuis `feat/fusion-dons`. Deux commits :

```
data(classes): registre unifié — les 42 classes des dons sont la clé primaire
test(classes): couverture bidirectionnelle 42 <-> 19 et curation de « clerc »
```

Le corps du premier commit doit dire pourquoi 42 → 19 et pas l'inverse (seule
direction qui soit une fonction totale), et que `lanceur` et `liste_sorts` sont
indépendants — le scalde en est la preuve.

## Expected Outcome

Une clé de jointure existe. Un personnage `magicien` lit
`arcaniste-ensorceleur-magicien` pour ses sorts et `magicien` pour ses dons,
depuis un seul fichier. Le multiclassage devient exprimable sans code
supplémentaire. Et le seul point réellement douteux du vocabulaire — `clerc` — est
**marqué** au lieu d'être tranché par un agent qui n'avait pas l'autorité pour le
faire.
