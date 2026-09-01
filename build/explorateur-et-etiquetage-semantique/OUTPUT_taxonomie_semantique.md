# Étiqueter ce qu'un don *donne* : les quatre axes, et ce que la passe a appris

## Le trou dans les données

Tout ce que le dépôt sait d'un don porte sur ses **prérequis** : la colonne
`Conditions` du CSV, `conditions_detail` des pages scrapées, les quatre couches de
gating. Rien n'y décrit son **effet**. C'est une asymétrie de source, pas un oubli :
pathfinder-fr.org normalise les conditions en une ligne, et laisse l'avantage en
prose libre.

Conséquence directe sur la navigation : la seule question qu'on pouvait poser au
catalogue était « ce personnage y a-t-il droit ? », jamais « qu'est-ce que ça me
rapporte ? ». Or c'est la seconde qu'un joueur pose en premier. Le graphe des
prérequis, lui, ne répond qu'à « d'où vient ce don » — utile, mais en troisième.

Aucune heuristique par mots-clés ne franchit ce pas. Les taggers existants
(`tag_feat_categories.py`, `tag_feat_magic.py`) fonctionnent parce qu'ils cherchent
un mot dans un champ court et normalisé. Décider si « vous pouvez tenter une
manœuvre de bousculade en lieu et place d'une attaque de corps à corps » est un
bonus chiffré, une option d'action ou une exception à une règle demande de lire une
phrase. D'où le recours au LLM, et d'où la condition posée en amont par
l'utilisateur : d'abord scraper la donnée complète (1417/1417, 0 échec de parsing),
ensuite étiqueter.

## Les quatre axes, et pourquoi ceux-là

Un axe unique aurait produit une facette à 18 options dont l'utilisateur devrait
devenir expert. Quatre axes **orthogonaux** décrivent le don comme un joueur y
pense, et se combinent en ET :

| Axe | Champs | Question à laquelle il répond |
|---|---|---|
| Effet | `effet_principal`, `effets_secondaires`, `cible_du_bonus`, `valeur_bonus` | Qu'est-ce que ça me donne, et sur quoi ? |
| Contexte d'usage | `contexte` | Quand est-ce que ça sert ? |
| Économie d'action | `activation`, `utilisations` | Qu'est-ce que ça me coûte à jouer ? |
| Polyvalence | `polyvalence` | Est-ce que ça sert tout le temps ou dans un cas précis ? |

`effet_principal` est l'axe primaire (choix de l'utilisateur) parce qu'il est
**mono-valué et exhaustif** : chaque don en a un et un seul, donc il partitionne le
catalogue — ce qu'aucun des autres ne fait. `cible_du_bonus` le raffine ensuite sans
le contredire : « bonus chiffré » puis « portant sur les dégâts ».

Trois champs sortent de cette grille et sont là pour l'interface, pas pour le
filtrage : `resume_court` (1417/1417) rend une ligne de liste lisible sans ouvrir le
détail ; `mots_cles` alimente la recherche plein-texte ; `categorie_officielle`
récupère le type officiel du don, dont la rubrique n'existe que sur 543 des 1417
pages — l'export fait donc primer la valeur attestée sur la valeur déduite
(`_categorie_officielle`).

Une seule passe, un seul appel par don pour tous les axes : les axes se déduisent du
même paragraphe, et les séparer aurait multiplié le coût par quatre en relisant
quatre fois le même texte.

## Vocabulaires fermés — et le fait qu'ils ne sont pas appliqués

Chaque champ énuméré a un vocabulaire fermé, déclaré dans le schéma de l'outil.
**Les `enum` de ce schéma ne sont pas appliqués sur ce chemin Bedrock.** Constaté,
pas supposé : `activation: conditionnel` (4 dons), `polyvalence: null` (4),
`contexte: mobilite` (1), `effets_secondaires: furtivite` (5).

Le volume est faible ; l'effet ne l'est pas. Une valeur hors-vocabulaire crée une
**option de facette supplémentaire** portée par 1 à 5 dons, à côté de l'option
légitime qui aurait dû les contenir. La liste se remplit d'options quasi vides,
c'est-à-dire précisément le piège à clics que la mécanique des compteurs cherche à
éliminer. `normaliser_fiche` remet donc tout champ hors-vocabulaire à `None` et
filtre les listes, côté client ; `--normaliser` rejoue l'opération hors-ligne sur un
fichier déjà produit, pour ne pas payer une seconde passe LLM.

Règle générale à retenir : **un vocabulaire fermé déclaré dans un schéma doit être
revalidé chez l'appelant.** Le schéma documente l'intention ; il ne la garantit pas.

## Les échecs sont une propriété du lot, pas du don

Après la passe complète, 20 dons manquaient. Deux indices concordants : ils
formaient **deux plages alphabétiques contiguës**, et ces plages coïncidaient avec
des frontières de lots. Vérification décisive — les 20 repassés en `--lot 1` ont
tous réussi du premier coup.

Le script se complète donc lui-même : après la passe principale, tout don manquant
est repris seul. Un cas particulier d'un principe plus large déjà appliqué à
`traiter` : **isoler l'unité qui peut échouer.** La version initiale laissait
`verifier_lot` hors du `try`, si bien qu'un neuvième lot malformé
(`AttributeError: 'str' object has no attribute 'get'`) détruisait huit lots réussis.

## Distributions observées

- `confiance: haute` — 97,5 %. La tâche est facile pour le modèle ; c'est le texte
  source qui manquait, pas le raisonnement.
- `effet_principal` — les 18 clés sont toutes peuplées, la plus grosse
  (`bonus_chiffre`) à 20,4 %. Une facette utilisable : aucune option ne domine.
- `valeur_bonus` — 906 dons. Renseigné quand le texte donne un nombre, absent sinon.
- `polyvalence` — `conditionnel` pour 61,1 % des dons. **Facette faible**, à ne pas
  mettre en avant : ce n'est pas une erreur d'étiquetage mais un fait sur PF1, où la
  majorité des dons sont situationnels. L'axe reste dans les données pour l'inverse
  du filtre (isoler les dons *toujours* actifs), pas comme entrée de navigation.

## Ce qui n'est délibérément pas fait

`Data/dons/feat_semantics_review.json` (86 dons) recense les prérequis lus sur la
page mais **absents du CSV** — « Attaque au galop » exige 1 rang en Équitation, que
`Conditions` ne mentionne pas ; « Aspect bestial » porte une clause d'échappement
sur la lycanthropie qu'aucun moteur ne peut évaluer. La liste contient aussi du
bruit (des auto-références : un don listé comme son propre prérequis).

Elle n'est **jamais** appliquée au moteur d'éligibilité, et ce n'est pas de la
prudence de principe. L'appliquer ne pourrait qu'*ajouter* des conditions, donc
transformer des `eligible` en `ineligible` sur la foi d'une lecture non relue — soit
exactement la sous-attribution que le principe de sûreté du projet interdit
(cf. CLAUDE.md : « une sous-attribution est bien plus grave qu'une sur-attribution »).
Le chemin d'intégration, s'il a lieu un jour, passe par une relecture manuelle et
une table curée à la main, comme `prereq_gating.json` et ses voisines.
