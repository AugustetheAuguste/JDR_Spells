# Les trois défauts du rendu en graphe, et ce qui les causait

Point de départ, formulé par l'utilisateur : « there are some groups that are just
1 but that say that they unlock 2 feats but don't show them ».

Cette observation, qui ressemble à un détail d'affichage, désignait en fait **une
seule erreur de conception commise trois fois** : trois grandeurs dérivées étaient
calculées sur le **catalogue entier** (1417 dons) puis affichées à côté d'un graphe
qui ne montrait que le **sous-ensemble atteignable** par le personnage (459 dons
pour un Guerrier 6). Tout ce que l'une comptait et que l'autre ne montrait pas
devenait un mensonge à l'écran.

## Mesures sur l'ancien export (`web/exemple_guerrier.json`, Guerrier 6, humain)

| Symptôme | Avant | Après |
|---|---:|---:|
| Nœuds annonçant un `levier` supérieur au nombre d'enfants affichés | 94 | 0 |
| Nœuds placés dans le graphe avec zéro arête (les « groupes de 1 ») | 13 | 0 |
| Voies nommées d'après un don non retenu (`Prestige`, `Sahir-afiyun`) | 2 | 0 |
| Voies au total / dont de taille 1 | 67 / 14 | 55 / 5 |

Les 5 voies de taille 1 restantes ne sont **pas** un résidu du même défaut : leur
racine a bien des enfants dans la vue (`Combat en aveugle` → `Assaut mystique`),
mais ces enfants descendent aussi d'une racine à plus fort levier, qui les
revendique. Un don n'ayant qu'une voie, le graphe étant un DAG multi-parents, ce
choix est arbitraire mais nécessaire. Le rendu les replie donc sous « petites
voies » grâce à `voie_taille`, plutôt que de les lister comme de vraies familles.

## Le correctif

`construire_graphe(catalog, restreint_a=None)` : un seul constructeur, appelé deux
fois. Sans restriction il donne le graphe du catalogue ; avec l'ensemble des dons
retenus il donne celui de la vue — et un don dont le prérequis n'est pas retenu
n'y a alors pas de parent, ce qui est exactement ce qu'il faut.

L'export porte désormais les deux mesures et ne les confond plus :

- `levier` — ce que le don débloque **dans cette vue**, donc ce que le graphe
  montre effectivement ;
- `levier_catalogue` — le fait structurel, toutes portées confondues ;
- `debloque` — **la liste** des enfants, pas seulement leur nombre.

Ce dernier point est le plus important, et c'est une règle générale : un compte
qu'on ne peut pas déplier n'est pas vérifiable par l'utilisateur, donc un compte
faux y reste invisible. En publiant la liste, l'incohérence devient impossible à
ne pas voir — et le test `web/test_explorateur.js` la vérifie sur 38 dons réels en
comparant l'annonce (« Débloque directement (29) ») au nombre d'entrées rendues.

L'écart entre les deux leviers n'est pas caché mais affiché : pour un Guerrier 6,
94 dons ouvrent plus loin dans les règles que ce personnage ne peut atteindre
(`Expertise du combat` : 36 dans la vue, 65 dans le catalogue). C'est une
information utile — « ce don ouvre plus que tu ne vois d'ici » — là où c'était
auparavant la source du bug.

## Pourquoi la navigation à facettes passe devant le graphe

Le graphe répond à « d'où vient ce don ». Un joueur demande d'abord « quels dons
me donnent un bonus aux dégâts pour deux emplacements ». Ce sont deux questions
différentes et la seconde est la plus fréquente ; en faire une conséquence de la
première imposait de parcourir 55 voies pour trouver un effet. L'arbre reste
disponible, comme une des trois vues, sur le même état de filtres.

Deux invariants tenus par `web/test_explorateur.js` :

1. **Le compteur d'une option prédit exactement le résultat du clic.** Chaque
   option est comptée sous toutes les autres facettes sauf la sienne (sinon toute
   option non cochée afficherait zéro), et les options à zéro disparaissent — une
   liste de 18 effets dont 14 sont vides est un piège à clics.
2. **Ce que le panneau de détail annonce, il le montre.** C'est la reformulation
   directe du défaut d'origine, testée là où il se voyait.

## Limite connue

Les 165 à 178 dons **isolés** (sans aucune arête) sont exclus du graphe mais pas
de la liste : sans arête ils ne forment qu'un nuage de points dans le premier,
alors qu'ils sont des candidats comme les autres dans la seconde. Le compte
affiché le dit explicitement quand la vue « arbre » est active, faute de quoi un
total qui baisse en changeant de vue passerait pour un bug.
