# DECISIONS.md

Journal des arbitrages humains sur ce dépôt. Chaque entrée est datée, nomme
l'alternative **écartée**, et n'est jamais réécrite après coup — une décision
révisée reçoit une nouvelle entrée qui référence l'ancienne, elle ne
remplace pas la précédente.

## 2026-08-26 — Aucun budget de poids côté `web/`

Les plafonds sur `index.json`, sur le JS client par route et l'assertion de
durée dans `moteur.test.ts` sont retirés. Les poids restent **mesurés et
imprimés**, jamais opposés à un seuil. **Alternative écartée : conserver des
budgets bloquants** — rejetée parce que les performances sont explicitement
secondaires pour ce dépôt, et qu'un budget bloquant transforme une mesure en
politique sans que quiconque ait tranché le seuil correct. (Rappelée ici pour
mémoire ; l'arbitrage d'origine est documenté au §11 du `CLAUDE.md`.)

## 2026-09-02 — Architecture statique + évaluateur TypeScript pour les dons

Le moteur d'éligibilité des dons évalue réellement côté client, en
TypeScript (`web/lib/dons/moteur.ts`), gardé fidèle à la référence Python par
le garde de parité (§15). **Alternative écartée : Python à l'exécution**
(un backend ou une fonction serverless qui évaluerait les 1417 dons à la
demande) — rejetée parce qu'elle aurait introduit la première dépendance
serveur du dépôt, en contradiction directe avec `output: 'export'` (§11) :
« aucune base, aucune route d'API, rien à l'exécution ». Le précalcul
intégral de toutes les combinaisons a été écarté séparément (voir entrée
suivante) : la seule option restante compatible avec un export statique est
un moteur qui s'exécute dans le navigateur.

## 2026-09-02 — 42 classes comme clé de jointure, pas comme clé primaire

`data/conventions/classes_unifiees.json` recense 42 classes pour servir de
**clé de jointure** entre le corpus des sorts (19 classes canoniques,
`data/classes.json`) et le corpus des dons. **Alternative écartée : réduire
les dons aux 19 classes canoniques des sorts (ou l'inverse, étendre les
sorts aux 42 des dons)** — rejetée parce que les deux corpus ne modélisent
pas le même grain : un hybride ou une variante de source peut exister côté
dons sans liste de sorts dédiée côté sorts (le scalde, §14) ou inversement.
Les 19 restent l'ensemble canonique interne du corpus des sorts ; les 42 ne
sont qu'une table de correspondance, jamais promue au rang de source de
vérité unique.

## 2026-09-02 — Précalcul intégral des verdicts écarté (44 520 combinaisons)

Précalculer et committer le verdict de chaque don pour chaque combinaison
classe × niveau × race (44 520 combinaisons) a été chiffré à ~35 h de calcul
et ~33 Go de sortie. **Alternative écartée : ce précalcul intégral**, qui
aurait permis de garder `engine.py` comme seule référence et de ne rien
porter en TypeScript — rejetée sur ces deux chiffres seuls, indépendamment
de toute préférence de langage : ni le temps de build ni la taille de
l'export n'étaient compatibles avec le reste du dépôt (build ~2 min, cf.
§11). C'est ce chiffrage qui a rendu nécessaire le port du moteur (entrée
ci-dessus), pas l'inverse.

## 2026-09-02 — Le parseur (`parser.py`) n'est pas porté en TypeScript

Seul `engine.py` (l'évaluateur) a un équivalent TypeScript
(`web/lib/dons/moteur.ts`) ; `parser.py` (l'analyse du texte `Conditions` du
CSV en `ParsedConditions` structurées) reste exclusivement Python, exécuté
hors ligne, son résultat exporté en JSON consommé par le web. **Alternative
écartée : porter aussi `parser.py`** — rejetée parce que le parseur ne voit
jamais le personnage (§13) : le porter aurait dupliqué de la logique de
texte libre (regex, désaccentuation NFKD, tables de mots-clés françaises)
sans aucun bénéfice d'exécution côté client, pour un risque de divergence
pur. Le parseur tourne une fois par changement de données, pas par visite.

## 2026-09-02 — `manual_check` jamais filtré par défaut

Un don dont au moins une exigence est indéterminable (`null`) reste
`manual_check` et **visible** dans toutes les vues, jamais masqué par
défaut. **Alternative écartée : filtrer `manual_check` du rendu par défaut**
(ne montrer que `eligible`) — rejetée en application directe de la maxime de
sûreté du §13 (« une sous-attribution est bien plus grave qu'une
sur-attribution ») : masquer un don indéterminable équivaudrait à le
déclarer inéligible sans preuve, ce qui est précisément l'erreur que le
tri-état existe pour empêcher.

## 2026-09-02 — `skill_rank` laissé optimiste, déclaré comme limite connue

`Character.skill_rank` renvoie le niveau du personnage quand aucun rang
explicite n'est fourni, donc tout prérequis de rangs de compétence passe par
défaut. **Alternative écartée : implémenter un suivi réel des rangs de
compétence** (budget de points, répartition par niveau, plafond
hors-classe) pour cette fusion — rejetée comme hors périmètre : la fusion
absorbe le corpus des dons tel qu'il existait dans le dépôt d'origine, elle
n'étend pas ses fonctionnalités. La limite est documentée (§13) plutôt que
masquée, conformément à la maxime de sûreté (sur-attribuer un don coûte un
`manual_check`, pas un `ineligible`).

## 2026-09-02 — « clerc » laissée `a_curer`, non tranchée

`data/conventions/classes_unifiees.json` marque l'entrée `clerc` comme à
curer plutôt que de la mapper au « prêtre » du corpus des sorts.
**Alternative écartée : mapper `clerc` → `pretre` par déduction** (le clerc
est usuellement le prêtre en Pathfinder 1e francophone) — rejetée parce que
le corpus des dons distingue déjà `clerc`, `pretre` et `pretre combattant`
comme trois entrées séparées dans `data/classes/class_proficiencies.json`,
sans qu'aucune source consultée ne confirme l'identité clerc = prêtre pour
ce corpus précis. Deviner ici aurait risqué une sous-attribution silencieuse
(§13) ; la table reste explicitement incomplète et signalée comme telle
plutôt que corrigée par inférence.
