# Maîtrises d'armes/de boucliers par classe — vérité terrain

Contexte : `Data/conditions/prereq_gating.json` contient 31 entrées de genre
`proficiency` (maîtrise d'arme/de bouclier), toutes non-bloquantes jusqu'ici —
elles retombaient systématiquement en `manual_check`, y compris pour un
Guerrier qui a d'office toutes les armes courantes et de guerre. 18 d'entre
elles nomment une arme ou un bouclier précis (pas un choix du joueur) et sont
donc résolubles automatiquement ; les 13 autres ("l'arme choisie", "le
bouclier utilisé", "l'arme du dieu"…) dépendent d'un choix que `Character` ne
trace pas et restent volontairement non-bloquantes.

Cette table donne, par classe, les seules maîtrises pertinentes pour ces 18
entrées résolubles : armes simples (bloc entier), armes martiales (bloc
entier), armes précises nommément accordées (recoupées avec le sous-ensemble
ci-dessous), et boucliers légers+lourds (le pavois n'est jamais un critère
ici, aucune des 18 entrées ne le requiert).

Sous-ensemble d'armes/boucliers concerné par cette curation (les seuls dont
l'identifiant peut apparaître dans `armes_specifiques`) : `fronde` (simple),
`marteau` = marteau léger (simple), `arc long` (martiale), `cimeterre`
(martiale), `marteau de guerre` (martiale), `fouet` (exotique), `chaine
cloutee` (exotique), `epee de duel` (exotique), `falcata` (exotique), `filet`
(exotique), `lasso` (exotique), `sabre dentele` (exotique), `arme a feu`
(exotique), `dorn-dergar naine` (exotique), `arme de siege` (exotique),
`targe` (bouclier léger, buckler — traité séparément de `boucliers` car
certaines classes n'ont que lui).

Sources : d20pfsrd.com / aonprd.com (pages de classe officielles Paizo, section
« Weapon and Armor Proficiency »), vérifiées le 2026-09-01. `chasseur de
vampire` est absente de cette table : aucune classe officielle PF1 de ce nom
n'existe (confirmé par recherche indépendante) ; le moteur doit la traiter
comme une classe inconnue (`None`, jamais deviner), pas comme "aucune
maîtrise".

| classe | armes_simples | armes_martiales | armes_specifiques | boucliers |
|---|---|---|---|---|
| alchimiste | true | false | | false |
| antipaladin | true | true | | true |
| arcaniste | true | false | | false |
| barbare | true | true | | true |
| barde | true | false | fouet | true |
| bretteur | true | true | targe | false |
| cavalier | true | true | | true |
| chaman | true | false | | false |
| chasseur | true | true | | true |
| chevalier | true | true | | true |
| cinetiste | true | false | | false |
| clerc | true | false | | true |
| conjurateur | true | false | | false |
| druide | false | false | cimeterre, fronde | true |
| enqueteur | true | false | | false |
| ensorceleur | true | false | | false |
| guerrier | true | true | | true |
| hypnotiseur | true | false | fouet | false |
| inquisiteur | true | false | arc long | true |
| justicier | true | true | | true |
| lutteur | true | false | | true |
| magicien | false | false | | false |
| magus | true | true | | false |
| medium | true | false | | false |
| metamorphe | false | false | cimeterre, fronde | true |
| moine | false | false | fronde | false |
| ninja | true | false | | false |
| occultiste | true | true | | true |
| oracle | true | false | | true |
| paladin | true | true | | true |
| pistolier | true | true | arme a feu | false |
| pretre | true | false | | true |
| pretre combattant | true | true | | true |
| psychiste | true | false | | false |
| rodeur | true | true | | true |
| roublard | true | false | | false |
| samourai | true | true | | true |
| sanguin | true | true | | true |
| scalde | true | true | | true |
| sorciere | true | false | | false |
| spirite | true | false | | false |
| tueur | true | true | | true |

Notes de curation :

- **antipaladin** : page officielle indisponible au moment de la recherche
  (404 sur d20pfsrd/aonprd) ; l'Antipaladin est le miroir exact du Paladin
  (APG), même paragraphe de maîtrise dans le livre source — repris du Paladin
  après vérification directe du texte du Paladin (« proficient with all
  simple and martial weapons, with all types of armor... and with shields
  (except tower shields) »).
- **bretteur** (Swashbuckler) : confirmé sur deux sources indépendantes —
  armes simples+martiales complètes, mais boucliers limités à la targe
  (buckler) seule, pas les boucliers légers/lourds standards.
- **druide** et **metamorphe** (Shifter) : liste d'armes fermée (pas "toutes
  les armes simples"), incluant nommément le cimeterre et la fronde — c'est
  la seule raison pour laquelle ces deux classes obtiennent ces armes malgré
  `armes_simples: false` / `armes_martiales: false`.
- **moine** : liste fermée également ; seule la fronde recoupe notre
  sous-ensemble (aucune des autres armes moine — bâton, sai, nunchaku... —
  n'est dans notre périmètre).
- **occultiste** : vérifié directement (aonprd.com) après une première
  estimation erronée — la classe a bien armes martiales + boucliers (sauf
  pavois), pas seulement les armes simples.
- **pistolier** = Gunslinger (« Pistolero » n'est qu'un archétype du
  Gunslinger, mêmes maîtrises de base) : armes à feu accordées automatiquement
  (exotique).
- **pretre** est un synonyme de Clerc (aucune classe distincte "Priest" en
  PF1 officiel) ; mêmes valeurs.
- **chevalier** est la clé sous laquelle ce dépôt catalogue le Cavalier (cf.
  `class_progression.py` et `OUTPUT_class_caster_ground_truth.md`) ; `cavalier`
  est conservé comme alias identique par prudence, les deux clés existant déjà
  dans `class_caster_info.json`.
