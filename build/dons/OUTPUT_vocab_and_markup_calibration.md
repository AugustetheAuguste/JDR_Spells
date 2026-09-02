# OUTPUT — Calibration du vocabulaire magique et du balisage HTML des pages de don

Ce document fige, à partir de la lecture manuelle du HTML brut de 26 pages
réelles de `pathfinder-fr.org` (même URL de tableau récapitulatif que Step 02,
échantillon volontairement diversifié, voir liste ci-dessous) et de
`Data/races.json` déjà présent dans le repo, les trois contrats attendus par
Step 06, Step 08 et Step 10. Aucun code n'est produit ni modifié par ce step.

Échantillon de dons réellement téléchargé et lu (nom → catégorie couverte) :

- Acolyte de la Nature — magique sans ambiguïté
- Métamagie spontanée — magique (don de métamagie appliqué à un sort)
- Extension d'effet, Incantation rapide, Sort éloigné, Augmentation
  d'intensité, etc. (lus via la page-index « Dons de métamagie ») — magiques
- Attaque en puissance — non-magique (combat pur)
- Esquive — non-magique (combat pur)
- Frappe puissante — non-magique (combat pur)
- Frappe décisive / Frappe décisive supérieure — non-magique (combat pur)
- Science de l'initiative — non-magique (combat pur)
- Utilisation d'objets magiques (page de compétence) — mentionne la magie
  sans exiger que le personnage la pratique lui-même
- Sabotage d'objet magique — mentionne/exploite un objet magique sans exiger
  de capacité de lancer des sorts (gating = rangs de compétence + Vigueur)
- Briseur d'objets — non-magique, mentionne « objets magiques ou non
  magiques » en passant
- Artisanat de groupe — mentionne « objets magiques » en passant
- Dons de maîtrise d'objets (page-index) : Maîtrise de caractéristique,
  Maîtrise de l'énergie, etc. — mentionnent des objets magiques/pouvoirs
  magiques mais gating = rangs UOM + Vigueur, pas capacité de lancer des sorts
- Adaptation aquatique — atypique, description narrative longue avant les
  rubriques
- Artisanat (page de compétence) — rubriques Spécial + Action + Nouvelles
  tentatives
- Frappe élémentaire — rubrique Spécial, condition raciale (Ifrit/Ondin/
  Oréade/Sylphe)
- Frappe magique — condition = capacité à lancer des sorts profanes
- Frappe du bouclier, Esquive acrobatique, Esquive anticipée, Vigueur
  élémentaire, Prodige — dons multi-sources / à version mythique
- Combat à deux armes — rubrique Normal (« Normal : »)
- Tir en mouvement — rubrique Normal (« Normal. »)
- Augure (page de sort, pas de don) — utilisée uniquement pour confirmer que
  le motif « École/Niveau/Composantes » des sorts est bien distinct du motif
  des dons, pas cité dans les listes ci-dessous.

---

## SECTION A — Contrat HTML des rubriques (pour Step 06)

Fait structurel commun à toutes les pages : le contenu utile est dans
`<div id="PageContentDiv"> ... </div>` (juste avant
`<div id="PageAttachmentsDiv">`). Tout ce qui précède la première rubrique
connue à l'intérieur de cette div est soit une image de source flottante
(`<img title="Source : ...">`), soit une phrase de description narrative en
italique (`<i>...</i>`), soit (rarement) une phrase d'accroche en gras hors
rubrique (ex. Adaptation aquatique : `<b>Cette option est plus courante
chez...</b>`). Extraction recommandée : tout texte de la div avant la
première occurrence d'un motif `<b>Catégorie` / `<b>Condition` (peu importe
la casse/l'accord) = description narrative libre à concaténer, pas une
rubrique.

### Source

Motif réel observé (`Attaque_en_puissance.html`, `Adaptation_aquatique.html`,
`Artisanat_de_groupe.html`) :
```html
<a href="/Wiki/Pathfinder-RPG.Pathfinder unchained (Contenu).ashx" style="float:right; padding: 4px 4px 2px 8px;">
<img title="Source : Pathfinder unchained" class="opachover" src="/Wiki/public/Upload/Illustrations/Logos/logoPU.png" style="opacity: 0.7" loop="infinite" />
</a>
```
Variante sans lien englobant (`Adaptation_aquatique.html`) :
```html
<div style="float:right; padding: 4px 4px 2px 8px;">
<img title="Source : Codex monstrueux/Monster Codex" class="opachover" src="/Wiki/public/Upload/Illustrations/Logos/logoMC.gif" style="opacity: 0.7" />
</div>
```
Extraction recommandée : regex sur l'attribut `title` de la balise `<img>`,
peu importe si elle est enveloppée dans `<a>` ou `<div>` :
```
title="Source\s*:\s*([^"]+)"
```
(prendre toutes les occurrences dans la page — un don peut avoir plusieurs
blocs Source, un par sous-section/source de livre, ex. Attaque en puissance a
3 blocs Source : Pathfinder unchained pour l'Astuce martiale, Campagnes
mythiques pour la Version mythique). Le texte capturé est du type
`"<Titre anglais>/<Titre français>"` ou juste `"<Titre français>"` — ne pas
supposer un séparateur `/` obligatoire (ex. `"Ultimate Combat/Art de la
Guerre"` vs juste un titre simple ailleurs).
Rubrique absente sur les pages n'affichant pas de logo de source visible
dans le corps (aucune page de l'échantillon n'en manque totalement, mais le
motif optionnel `<div style="float:right...">` sans `<a>` autour doit être
géré — voir variante ci-dessus) ; traiter l'absence de tout match comme
`source = None`, pas une erreur.

### Conditions (et « Condition » au singulier)

Motifs réels observés — le label varie en nombre et en ponctuation finale :
- `Esquive.html` : `<b>Condition.</b> <a class="pagelink" href="Pathfinder-RPG.Dext%c3%a9rit%c3%a9.ashx" title="La Dextérité">Dex</a> 13.`
- `Frappe_decisive.html` : `<b>Conditions.</b> <a class="pagelink" href="Pathfinder-RPG.BBA.ashx" title="BBA">Bonus de base à l'attaque</a> +6.`
- `Attaque_en_puissance.html` : `<b>Condition.</b> <a class="pagelink" ...>For</a> 13, <a class="pagelink" ...>BBA</a> +1.`
- `Combat_a_deux_armes.html` : `<b>Condition : </b><a class="pagelink" href="Pathfinder-RPG.Dext%c3%a9rit%c3%a9.ashx" title="La Dextérité">Dex</a> 15`
- Prodige/Métamagie spontanée : pas de rubrique Condition du tout (don sans
  prérequis) — rubrique optionnelle, traiter l'absence comme "aucune
  condition", pas une erreur de parsing.

Extraction recommandée (le label peut être `Condition`/`Conditions`, suivi
de `.`, `:` ou ` : `, en gras) :
```
<b>Conditions?\s*[:.]?\s*</b>(.*?)(?=<br\s*/?>\s*<br\s*/?>\s*<b>|$)
```
Le contenu s'arrête au prochain `<br /><br /><b>` (début de la rubrique
suivante) — c'est le séparateur constant entre rubriques observé sur toutes
les pages de don de l'échantillon (jamais de `<p>`, jamais de `<div>` entre
rubriques adjacentes).

### Avantages (et « Avantage » au singulier)

Même variation de nombre/ponctuation que Conditions :
- `Esquive.html` : `<b>Avantage.</b> Le personnage bénéficie d'un bonus d'esquive de +1 à la CA...`
- `Sabotage_objet_magique.html` : `<b>Avantages.</b> Le personnage peut effectuer un test d'Utilisation d'objets magiques...`
- `Attaque_en_puissance.html` : `<b>Avantage.</b> Le personnage peut appliquer un malus de -1...`
- `Briseur_dobjets.html` : `<b>Avantage.</b> Lorsque le personnage attaque un objet inanimé et abandonné...`

Extraction recommandée (identique au motif Conditions, label
`Avantages?`) :
```
<b>Avantages?\s*[:.]?\s*</b>(.*?)(?=<br\s*/?>\s*<br\s*/?>\s*<b>|<h[23]|$)
```
Le `<h[23]` supplémentaire dans le lookahead couvre le cas où Avantages est
la dernière rubrique avant une section `<h2 class="separator">Version
mythique</h2>` ou `<h3 class="separator">Astuce martiale...</h3>` (voir
`Attaque_en_puissance.html`, `Frappe_decisive.html`, `Frappe_bouclier.html` :
ces sous-sections sont des extensions optionnelles à part, pas à confondre
avec Avantages). C'est une rubrique **toujours présente** dans l'échantillon
(26/26 pages de don) — son absence sur une page de don réelle doit être
traitée comme suspecte plutôt que normale, à la différence de
Source/Spécial/Normal.

### Spécial

Présente uniquement sur une minorité de pages (rubrique optionnelle,
confirmée sur 4/26 pages de don de l'échantillon : `Briseur_dobjets.html`,
`Frappe_elementaire.html`, `Metamagie_spontanee.html`,
`Utilisation_objets_magiques.html` — sur cette dernière c'est un `<h2
class="separator">Spécial<a class="headeranchor"...` car c'est une page de
compétence, pas une page de don ; sur les pages de don c'est un `<b>Spécial.</b>` en ligne).

Motif réel (don, `Briseur_dobjets.html`) :
```html
<b>Spécial.</b> Les avantages de ce don ne s'appliquent pas aux tentatives de destruction d'objets ni aux attaques contre les créatures artificielles mais seulement aux attaques contre des objets inanimés et abandonnés.
```
Motif réel (don, `Frappe_elementaire.html`) :
```html
<b>Spécial.</b> Le personnage peut utiliser ce don à la place de <a class="pagelink" href="Pathfinder-RPG.Frappe%20magique.ashx" title="Frappe magique">Frappe magique</a> afin de remplir les conditions du ou d'utiliser le don ...
```
Motif réel (don, `Metamagie_spontanee.html`) :
```html
<b>Spécial.</b> Le personnage peut choisir ce don à plusieurs reprises. À chaque fois, il choisit un nouveau sort spontané qu'il peut lancer. Le don s'appliquera à ce sort.
```
Extraction recommandée pour les pages de don (`<b>` en ligne, même motif que
Conditions/Avantages) :
```
<b>Spécial\s*[:.]?\s*</b>(.*?)(?=<br\s*/?>\s*<br\s*/?>\s*<b>|<h[23]|$)
```
Sur une page de compétence (hors périmètre don, seulement mentionné ici pour
mémoire car `Utilisation_objets_magiques.html`/`Artisanat.html` en ont une
sous cette forme) le motif est un `<h2 class="separator">Spécial<a
class="headeranchor" id="Spécial_3" .../></h2>` suivi du texte jusqu'au
prochain `<h2` ou fin de div — non requis pour Step 06 (dons uniquement) mais
noté pour éviter une confusion si le scraper croise ce cas par erreur (ex. un
lien de don pointant par erreur vers une page de compétence).
Son absence sur les 22 autres pages de don de l'échantillon est un cas
normal (rubrique facultative), pas une erreur de parsing.

### Normal

Présente sur 2/26 pages de l'échantillon (`Combat_a_deux_armes.html`,
`Tir_en_mouvement.html`) — rubrique optionnelle qui décrit ce qui se passe
**sans** le don, typique des dons qui assouplissent une restriction connue.

Motif réel (`Combat_a_deux_armes.html`, label suivi de `: `) :
```html
<b>Normal : </b>Si le personnage manie une arme dans sa main non-directrice, il peut porter une attaque avec elle. Quand il se bat ainsi, il subit un malus de -6 aux attaques habituelles ou aux attaques portées avec la main directrice et un malus de -10 aux attaques portées avec la main non-directrice.
```
Motif réel (`Tir_en_mouvement.html`, label suivi de `.`) :
```html
<b>Normal.</b> Le personnage ne peut pas se déplacer avant et après une attaque avec une <a class="pagelink" href="Pathfinder-RPG.arme%20%c3%a0%20distance.ashx" title="arme à distance">arme à distance</a>.
```
Extraction recommandée (même famille de motif, ponctuation variable comme
pour Conditions/Avantages/Spécial) :
```
<b>Normal\s*[:.]?\s*</b>(.*?)(?=<br\s*/?>\s*<br\s*/?>\s*<b>|<h[23]|$)
```
Son absence sur 24/26 pages de l'échantillon est un cas normal (rubrique
facultative propre aux dons qui remplacent une règle par défaut), pas une
erreur.

### Note générale de découpage (cas « Adaptation aquatique »)

Sur `Adaptation_aquatique.html`, la div de contenu commence par un bloc
Source (`<div style="float:right;...">...</div>`), puis une phrase d'accroche
en gras hors rubrique (`<b>Cette option est plus courante chez les
hommes-lézards.</b>`), puis la description narrative en italique
(`<i>Le personnage a développé une capacité étrange...</i>`), et seulement
ensuite `<b>Conditions.</b>`. La logique « tout ce qui précède la première
rubrique connue (`Condition`/`Conditions`) = description » fonctionne
correctement ici à condition de ne déclencher la coupure que sur les labels
`Catégorie`/`Condition(s)` en gras — pas sur n'importe quel `<b>` (sinon la
phrase d'accroche « Cette option est plus courante... » serait faussement
identifiée comme une rubrique).

---

## SECTION B — Vocabulaire magique des dons (pour Step 08)

### STRONG_MAGIC_KEYWORDS (haute confiance, `is_magic=true`)

1. **« capacité à lancer des sorts »** — `Frappe_magique.html` :
   `<b>Condition.</b> Capacité à lancer des <a ...>sorts profanes</a>.`
2. **« sorts profanes »** — même citation que ci-dessus (`Frappe_magique.html`).
3. **« lancer des sorts spontanés »** — `Metamagie_spontanee.html` :
   `<b>Conditions.</b> Cha 13, un don de métamagie, capacité à lancer des sorts spontanés`
4. **« don de métamagie »** (comme condition, pas juste mention) —
   `Metamagie_spontanee.html`, même citation ci-dessus.
5. **« niveau de lanceur de sorts »** (utilisé pour faire évoluer l'effet du
   don en fonction du niveau de caster) — `Frappe_magique.html` : « Ce bonus
   augmente de +1 pour chaque tranche de cinq niveaux de lanceur de sorts,
   avec un maximum de +5 au niveau 20. » ; aussi `Acolyte_de_la_Nature.html` :
   « il bénéficie d'un niveau de lanceur de sorts supplémentaire. »
6. **« emplacement de sort »** (mécanique de métamagie, cf. règles
   générales de la page-index `Dons_de_metamagie.html`) : « ce qui les oblige
   à utiliser des emplacements de sorts de niveau supérieur. »
7. **« sorts de [Classe] de [n]e niveau »** comme condition de don — table
   de `Dons_de_metamagie.html`, don « Sale coup magique » : « Capacité à
   lancer des sorts de niveau 1, alignement Chaotique Neutre... »
9. **« lorsque le personnage lance un sort »** (ajouté après revue post-
   implémentation, motif non couvert par l'échantillon initial : la famille
   des dons d'amplification élémentaire déclenchés par le fait de lancer un
   sort) — `Amplification_brulante.html` : « Lorsque le personnage lance un
   sort possédant le registre feu, il peut choisir... » ; confirmé sans faux
   positif sur les 9 dons du catalogue correspondants (Amplification
   brûlante/foudroyante/refroidissante, Chaleur glorieuse, Dissimulation de
   sort, Enchantements subtiles, Magie des âmes, Scrutateur hors pair,
   Élément renforcé) — chacun exige réellement de lancer un sort comme
   déclencheur de son effet, contrairement à une simple mention en aside
   (ex. « Arme de prédilection » : « ...ou les rayons s'il lance des sorts »
   — écarté car ce n'est qu'une clause optionnelle, pas la condition
   principale du don, donc ce motif n'a pas été retenu sur ce cas-là).
8. **« Aptitude magique »** (nom de don pris comme condition/mention d'une
   aptitude explicitement liée au fait d'être lanceur de sorts) —
   `Sabotage_objet_magique.html` : `<b>Conditions.</b> Aptitude magique, 5
   rangs en Sabotage, 5 rangs en UOM` — noter toutefois que ce mot-clé seul
   NE garantit PAS `is_magic=true` pour Sabotage d'objet magique lui-même
   (voir EXCLUSION ci-dessous) : c'est un signal fort seulement quand le don
   *lui-même* confère un pouvoir magique conditionné par une capacité de
   lancer des sorts, pas quand il s'agit d'un simple prérequis parmi
   d'autres pour un don de compétence.

10. **« peut lancer des sorts »** (ajouté lors de l'audit guerrier : le don
    décrit ce que le personnage fait *en lançant* ses sorts, il n'a donc
    aucun sens sans incantation) — `Dispense_de_composantes_materielles.html`
    : « Le personnage peut lancer des sorts nécessitant une composante
    matérielle de 1 po ou moins sans utiliser cette composante. » ; 8 dons
    concernés dans le catalogue (Ajustement crânien, Couteau de sorcière,
    Dispense de composantes matérielles, Implantation crânienne, Incantation
    animale, Magie démentielle, Trépanation, Vision extrasensorielle), tous
    vérifiés comme réservés aux lanceurs de sorts.
11. **« sorts lancés par le personnage »** — `Sort_en_embuscade.html` : « les
    adversaires […] reçoivent un malus de -2 aux jets de sauvegarde contre
    les sorts lancés par le personnage. » ; 1 seul don concerné.
12. **« contrer un sort »** — `Science_du_contresort.html` : « Lorsque le
    personnage tente de contrer un sort, il peut remplacer le sort d'origine
    par n'importe quel sort de la même école… » ; 2 dons concernés
    (Parade de sorts, Science du contresort), tous deux réservés aux lanceurs.

13. **« à sa liste de sorts »** — 7 dons, dont 4 non tagués auparavant
    (Conduit émotionnel, Connaissances magiques étendues, Tours de magie ou
    oraisons supplémentaires, Études approfondies). Un don qui *ajoute* des
    sorts à la liste du personnage suppose qu'il en ait une.
14. **« sort de contact »** — 5 dons, dont 2 non tagués auparavant (Familier
    libéré, Transfert longue distance) : transmettre un sort de contact exige
    de le lancer.
15. **« quand le personnage lance un sort »** — variante en « quand » du
    mot-clé n° 9 (« lorsque le personnage lance un sort ») ; 10 dons, dont 4
    non tagués auparavant (Incantation rageuse, Maîtrise de l'armure magique,
    Sort mélodieux, École supérieure).
16. **« tout autre sort d'un niveau plus élevé »** — mot-clé délibérément
    hyper-spécifique (1 seul don) qui lève le « résidu connu » ci-dessous.
17. **« la véritable nature de ses sorts »** — `Bluff magique` : « quand il
    affronte un autre lanceur de sorts, il sait cacher la véritable nature de
    ses sorts » ; 1 seul don.
18. **« attaques de contact au corps à corps de ses sorts »** —
    `Contact magique bondissant` : « le personnage peut augmenter l'allonge des
    attaques de contact au corps à corps de ses sorts » ; 1 seul don.

**Motif écarté** : le motif large « de ses sorts », qui aurait couvert les
entrées 17 et 18 d'un coup, attrape 15 dons dont **« Signes secrets »** —
lequel conserve un avantage entièrement non magique (+4 aux tests de Bluff pour
faire passer des messages secrets) en plus de son volet d'incantation, et reste
donc légitimement utile à un non-lanceur. Comme les mots-clés forts
court-circuitent la liste d'exclusions dans `classify()`, on ne pouvait pas le
rattraper par une exclusion : d'où deux mots-clés étroits plutôt qu'un large.

**Motif écarté** : le mot-clé plus large « lancer des sorts » (sans « peut »)
capture 18 dons dont plusieurs sont au contraire des dons de guerrier
*anti*-lanceurs (« Perturbateur », « Tir perturbateur », qui gênent
l'incantation *adverse*) — non retenu.

**Motif écarté** : « ou tout autre sort », envisagé pour capturer « Lecture des
résidus magiques », attrape aussi « Serviteur céleste », dont les Conditions
(« Aasimar, compagnon animal, familier **ou aptitude de classe monture** ») sont
satisfaites par un cavalier aasimar, qui n'a aucune magie — non retenu au profit
du mot-clé n° 16, plus étroit.

**Résidu levé** (auparavant « Résidu connu ») : « Lecture des résidus magiques »
exige d'utiliser *identification* (donc de lancer un sort) mais le formule
d'une façon (« Lorsque le personnage utilise identification ou tout autre sort
d'un niveau plus élevé… ») qu'aucun mot-clé *général* ne capture sans faux
positifs. Tranché par le mot-clé ciblé n° 16 plutôt qu'en élargissant un motif.

### WEAK_MAGIC_KEYWORDS (ambigu → `needs_manual_check=true`)

1. **« objet magique » / « objets magiques » employé côté effet (pas côté
   condition)** — `Frappe_elementaire.html` (Spécial) et
   `Dons_de_maitrise_objets.html` (table, ex. Maîtrise de caractéristique :
   « Une armure magique ou un objet de transmutation confèrent un bonus de
   +2... ») : le don *utilise* la magie d'un objet sans que le personnage
   lance lui-même de sorts — ambigu selon la définition retenue pour
   `is_magic`.
2. **« pouvoir(s) magique(s) »** générique — `Dons_de_maitrise_objets.html` :
   « Tous les effets créés par les dons de maîtrise d'objets agissent comme
   des pouvoirs magiques... » — désigne ici une mécanique de règle (Mag),
   pas nécessairement un vrai besoin d'être lanceur de sorts.
3. **« pierre magique » / effet de sort nommé comme pouvoir racial** — voir
   Section C, ex. `oreade` : « Les oréades peuvent utiliser pierre magique
   comme un pouvoir magique 1/jour... » — ambigu quand un don de combat
   fait simplement référence à ce pouvoir racial sans exiger de vraie
   capacité de lanceur de sorts.
4. **« énergie magique » (au sens figuré, pas mécanique de sort)** —
   `Acolyte_de_la_Nature.html` : « Le personnage s'est entraîné à canaliser
   son énergie magique... » en tête de description narrative — le terme
   apparaît avant même la rubrique Conditions et pourrait faire croire à un
   gating magique alors que la vraie condition est « Fidèle de la Verte
   religion » (pas un test de capacité de lanceur de sorts explicite dans la
   rubrique Condition elle-même).
5. **« capacité de classe [nom de pouvoir] »** sans plus de précision — ex.
   `Dons_de_maitrise_objets.html`, don « Maîtrise instrumentale » :
   `<b>Conditions.</b> Capacités de classe instruments et focalisaiton
   mentale` — capacité de classe d'occultiste liée à la magie, mais énoncée
   sans le mot « sorts » ni « lanceur de sorts », donc pas assez fort pour
   `STRONG`.

### EXCLUSION_PHRASES (mentionne la magie mais ne l'exige pas)

1. **« objet(s) magique(s) »** utilisé comme objet cible d'une compétence
   (Utilisation d'objets magiques), pas comme preuve que le personnage est
   lui-même un lanceur de sorts — `Sabotage_objet_magique.html` :
   `<b>Conditions.</b> Aptitude magique, 5 rangs en Sabotage, 5 rangs en
   UOM` + `<b>Avantages.</b> Le personnage peut effectuer un test
   d'Utilisation d'objets magiques pour saboter un objet magique...` — le
   gating réel est *rangs de compétence*, pas capacité de lancer des sorts ;
   confirmé explicitement par la page de compétence
   `Utilisation_objets_magiques.html` : « Le personnage sait comment activer
   des objets magiques, **sans nécessairement être capable d'utiliser la
   magie par ailleurs**. »
2. **« objets magiques ou non magiques »** (formulation qui neutralise
   explicitement la magie comme critère) — `Artisanat_de_groupe.html` :
   « Le personnage peut aider un autre personnage à fabriquer des objets
   magiques ou non magiques. » — le don lui-même ne requiert que des rangs
   d'Artisanat/un don de création, pas une capacité de lanceur de sorts.
3. **« objet(s) magique(s) » comme cible d'attaque/de destruction**, pas
   comme source de pouvoir du personnage — `Briseur_dobjets.html` ne
   mentionne même pas « magique » dans son propre texte, mais la variante
   crédible à surveiller (confirmée par la table
   `Dons_de_maitrise_objets.html`) est bien celle du point 1 : posséder un
   objet magique/l'exploiter via UOM + Vigueur, sans jamais lancer de sorts.
4. **« résistance à la magie »** — non trouvée sur un don de l'échantillon
   (aucun don du tableau ne porte ce nom exact ni ne l'emploie comme
   condition), mais confirmée comme trait *racial défensif* sur
   `Data/races.json` (race Drow, voir Section C) : « Les drows ont une
   résistance à la magie de 6 + leur niveau de personnage. » — c'est une
   défense *contre* la magie, pas une preuve de pratique de la magie ; à
   traiter comme exclusion si un don venait à la mentionner comme condition
   raciale sans plus de précision.

---

## SECTION C — Vocabulaire magique des races (pour Step 10)

Lu directement dans `Data/races.json` (clés `aasimar`, `tieffelin`, `ifrit`,
`ondin`, `sylphe`, `oreade`, `drow`, `duergar`, toutes présentes — aucune des
8 races demandées n'est manquante dans le fichier scrapé actuel). Pour
chacune, le trait pertinent est nommé `"Pouvoir magique"` ou `"Pouvoirs
magiques"` dans `traits[*].name`, avec la description réelle citée
ci-dessous.

RACE_MAGIC_KEYWORDS (motif commun : `"comme un pouvoir magique"` /
`"comme des pouvoirs magiques"` + `"niveau de lanceur de sorts"`) :

- **Aasimar** — `traits` → `"Pouvoir magique"` : « Les aasimars peuvent
  utiliser lumière du jour comme un pouvoir magique une fois par jour
  (niveau de lanceur de sorts égal au niveau de personnage de l'aasimar). »
- **Tieffelin** — `traits` → `"Pouvoir magique"` : « Les tieffelins peuvent
  utiliser ténèbres comme un pouvoir magique une fois par jour (niveau de
  lanceur de sorts égal au niveau de personnage du tieffelin). »
- **Ifrit** — `traits` → `"Pouvoir magique"` : « Les ifrits peuvent
  utiliser mains brûlantes comme un pouvoir magique 1/jour (niveau de
  lanceur de sorts égal au niveau de personnage de l'ifrit ; DD 11 +
  modificateur de Charisme). »
- **Ondin** — `traits` → `"Pouvoir magique"` : « Les ondins peuvent
  utiliser poussée hydraulique comme un pouvoir magique 1/jour (niveau de
  lanceur de sorts égal au niveau de personnage de l'ondin). »
- **Sylphe** — `traits` → `"Pouvoir magique"` : « Les sylphes peuvent
  utiliser feuille morte comme un pouvoir magique 1/jour (niveau de lanceur
  de sorts égal au niveau de personnage du sylphe). »
- **Oréade** — `traits` → `"Pouvoir magique"` : « Les oréades peuvent
  utiliser pierre magique comme un pouvoir magique 1/jour (niveau de
  lanceur de sorts égal au niveau de personnage de l'oréade ; DD 11 +
  modificateur de Charisme). »
- **Drow** — `traits` → `"Pouvoirs magiques"` : « Un drow peut lancer lueur
  féerique, lumières dansantes et ténèbres comme des pouvoirs magiques,
  chacun une fois par jour, en utilisant son niveau total de personnage
  comme niveau de lanceur de sorts. » — noter par ailleurs un second trait
  distinct et **défensif**, `"Résistance à la magie"` : « Les drows ont une
  résistance à la magie de 6 + leur niveau de personnage. » — ce second
  trait ne doit PAS alimenter `RACE_MAGIC_KEYWORDS` pour un usage offensif
  (c'est une résistance contre les sorts adverses, pas une capacité
  magique innée utilisable par le personnage), voir aussi
  EXCLUSION_PHRASES #4 en Section B.
- **Duergar** — `traits` → `"Pouvoirs magiques"` : « Les duergars peuvent
  utiliser agrandissement et invisibilité comme des pouvoirs magiques
  chacun une fois par jour, utilisant son niveau de personnage comme
  niveau de lanceur de sorts, et uniquement sur lui-même. »

**Races manquantes / données absentes** : aucune. Les 8 races demandées
(Aasimar, Tieffelin, Ifrit, Ondin, Sylphe, Oréade, Drow, Duergar) sont
toutes présentes dans `Data/races.json` avec un trait `"Pouvoir
magique"`/`"Pouvoirs magiques"` explicite et exploitable tel que cité
ci-dessus. Step 10 n'a donc aucun cas de `race_grants_magic` devant
renvoyer `False` par manque de donnée pour ces 8 races précises — mais le
scraper `scrape_races.py` doit être considéré comme la source de vérité :
si une race future scrapée n'a pas de trait nommé `"Pouvoir magique"` ou
`"Pouvoirs magiques"`, Step 10 doit renvoyer `False` par absence de donnée
et ne pas déduire silencieusement une capacité magique innée à partir d'un
autre trait (ex. `"Affinité avec le feu"` chez l'Ifrit mentionne la magie
d'ensorceleur mais ne décrit pas un pouvoir magique inné utilisable par
n'importe quel Ifrit, quelle que soit sa classe — ne pas l'utiliser comme
preuve de `race_grants_magic`).
