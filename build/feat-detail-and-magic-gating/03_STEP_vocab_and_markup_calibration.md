# 03_STEP — Calibration du vocabulaire magique et du balisage HTML des pages de don

## Objectives

Produire un document de calibration figé,
`build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md`,
qui élimine tout jugement d'implémentation improvisé dans **Step 06**
(structure HTML des rubriques Conditions/Avantages/Spécial/Normal), dans
**Step 08** (vocabulaire magique français exact permettant de distinguer un
don réellement dépendant de la magie d'un don qui mentionne juste "magique"
en passant), et dans **Step 10** (vocabulaire indiquant qu'une race donne un
accès inné à la magie, via ses traits déjà scrapés dans `Data/races.json`).
Ce step existe précisément parce que le plan initial laissait ces
calibrations "à faire pendant l'implémentation" — l'utilisateur a demandé
qu'elles soient tranchées en amont, par une analyse dédiée, et non
improvisées par le subagent d'implémentation.

## Dependencies & Parallelization

- Wave 1. Aucune dépendance sur un autre step fonctionnel — ce step télécharge
  son propre petit échantillon de pages (voir ci-dessous), il n'a pas besoin
  d'attendre `Data/feat_links.json` complet (Step 02). La Section C (races)
  lit directement `Data/races.json`, déjà présent dans le repo.
- Consommé par **Step 06** (structure HTML, Section A), **Step 08**
  (vocabulaire magique des dons, Section B), et **Step 10** (vocabulaire
  magique des races, Section C). Les trois doivent citer explicitement ce
  document dans leur Inherited Context et s'y conformer à la lettre plutôt
  que redéfinir leurs propres règles.

## Inherited Context from Dependencies

Aucune dépendance de fichier. Réutilise uniquement le contrat déjà validé
dans `01_SKILLS_AND_TOOLS.md` pour retrouver un petit échantillon de dons
réels sans dépendre de la sortie complète de Step 02 :
- Télécharger la même page de tableau récapitulatif que Step 02
  (`https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20dons.ashx`),
  en extraire uniquement 20-25 liens `<a class="pagelink" href="...">` de la
  colonne "Dons" (premier `<td>` de chaque `<tr>`, voir `01_SKILLS_AND_TOOLS.md`
  pour le contrat exact) — pas besoin de dédupliquer/couvrir tout le tableau,
  juste un échantillon volontairement diversifié (voir Implementation Notes).

## Pseudo-code

```
CONST SAMPLE_SIZE_MIN = 20

FUNCTION pick_diverse_sample(all_rows) -> list[(name, url)]:
    # Choisir à la main, pas au hasard, pour garantir la diversité :
    # - au moins 3 dons connus 100% magiques sans ambiguïté
    #   (ex. dons de métamagie, "Acolyte de la Nature")
    # - au moins 3 dons connus 100% non-magiques (dons de combat purs,
    #   ex. "Attaque en puissance", "Esquive")
    # - au moins 3 dons qui MENTIONNENT "magique"/"magie" sans être
    #   magiques au sens du gating (ex. dons portant sur les objets
    #   magiques, la résistance à la magie, l'identification d'objets)
    # - au moins 3 dons avec une rubrique "Spécial" visible sur leur page
    # - au moins 3 dons avec une rubrique "Normal" visible sur leur page
    # - au moins 3 dons "atypiques" (nom répétable *, plusieurs sources,
    #   description narrative longue façon "Adaptation aquatique")
    RETURN the picked list (>= SAMPLE_SIZE_MIN entries total)

FUNCTION fetch_and_read(url) -> raw_html:
    GET url with User-Agent header (voir 01_SKILLS_AND_TOOLS.md, même
    convention), aucune mise en cache nécessaire pour ce step ponctuel

FOR (name, url) IN pick_diverse_sample(...):
    html = fetch_and_read(url)
    READ html manually (le subagent lit le HTML brut, pas d'automatisation
    devinée) pour repérer :
      - le balisage exact entourant "Source :", "Conditions.", "Avantages.",
        "Spécial.", "Normal." (balise, classe CSS le cas échéant, séparateur
        exact avant/après chaque libellé)
      - le vocabulaire français exact employé quand le don EXIGE de la magie
        pour être utile (verbes/expressions récurrentes)
      - le vocabulaire employé quand le don MENTIONNE la magie sans
        l'exiger (faux positifs potentiels à exclure)

FONCTION SECTION_C — races à magie innée (pour Step 10) :
    READ Data/races.json (déjà présent dans le repo)
    POUR CHAQUE race connue de PF1e ayant, dans les règles réelles, une
    capacité magique innée (au minimum vérifier : Aasimar, Tieffelin, Ifrit,
    Ondin, Sylphe, Oreade, Drow, Duergar — races classiquement dotées d'un
    sort-like utilisable X fois/jour) :
        lire race_info.traits[*].description réel dans Data/races.json
        noter le libellé exact employé pour décrire cette capacité
    EN DÉDUIRE une liste RACE_MAGIC_KEYWORDS figée, chaque entrée citant la
    race et l'extrait de texte réel qui la justifie.
    NOTER explicitement toute race de cette liste dont
    Data/races.json ne contient PAS le texte attendu (ex. traits non
    scrapés/absents) — Step 10 doit alors savoir que race_grants_magic
    renverra False pour cette race par manque de donnée, pas par verdict
    PF1e réel, et ne pas le lui laisser deviner.

WRITE OUTPUT_vocab_and_markup_calibration.md avec trois sections figées :
  SECTION A — "Contrat HTML des rubriques" (pour Step 06) : pour chaque
    rubrique (Source/Conditions/Avantages/Spécial/Normal), le motif exact
    observé (extrait HTML réel cité verbatim) + la regex/logique
    d'extraction recommandée.
  SECTION B — "Vocabulaire magique des dons" (pour Step 08) : trois listes
    figées et justifiées par des citations réelles :
    - STRONG_MAGIC_KEYWORDS (haute confiance, is_magic=true)
    - WEAK_MAGIC_KEYWORDS (ambigu -> needs_manual_check=true)
    - EXCLUSION_PHRASES (mentionne la magie mais ne l'exige pas)
    Chaque entrée de chaque liste doit citer au moins un don réel de
    l'échantillon comme preuve.
  SECTION C — "Vocabulaire magique des races" (pour Step 10) :
    RACE_MAGIC_KEYWORDS figée, chaque entrée citant la race et l'extrait de
    `Data/races.json` qui la justifie, plus la liste des races attendues
    mais non trouvées dans les données scrapées actuelles.
```

## Logic Flow

1. Récupérer un échantillon volontairement diversifié d'au moins 20 pages de
   don réelles (pas un tirage aléatoire — un choix guidé pour couvrir tous
   les cas listés dans `pick_diverse_sample`).
2. Lire chaque page brute manuellement (le subagent doit réellement
   inspecter le HTML, pas supposer sa structure par analogie avec d'autres
   scrapers du repo).
3. En déduire et figer par écrit le contrat HTML des rubriques (Section A),
   les trois listes de vocabulaire magique des dons (Section B), et la
   liste de vocabulaire magique des races (Section C, à partir de
   `Data/races.json` déjà présent), chacune justifiée par des citations
   vérifiables.
4. Ce document devient la source de vérité verbatim pour Step 06, Step 08 et
   Step 10 — ces steps ne doivent plus recalibrer quoi que ce soit eux-mêmes,
   juste implémenter ce qui est écrit ici.

## Implementation Notes

- Ne pas se limiter à des dons "faciles" : inclure explicitement au moins un
  don avec une longue description narrative libre avant les rubriques (type
  "Adaptation aquatique", le cas rapporté par l'utilisateur) pour valider
  que la logique de découpage "tout ce qui précède la première rubrique
  connue = description" fonctionne aussi sur ce genre de page.
- Pour le vocabulaire magique, être explicite sur les pièges identifiés
  pendant le planning initial : "résistance à la magie", "objet magique",
  "identifier un objet magique" sont des exemples de phrases d'exclusion à
  vérifier/confirmer ou corriger avec de vrais exemples plutôt que les
  recopier tels quels sans vérification.
- Ce step ne modifie aucun fichier `Data/*.json` ni aucun script — sortie
  = un seul document markdown de calibration.

## Verification Criteria

- `OUTPUT_vocab_and_markup_calibration.md` existe, contient les deux
  sections (A et B), chaque règle citant au moins un don réel avec un
  extrait de texte vérifiable (pas une règle "à l'instinct" sans preuve).
- La Section A couvre les 5 rubriques (Source/Conditions/Avantages/
  Spécial/Normal) même si certaines n'apparaissent que sur une minorité de
  pages — documenter explicitement leur absence sur les autres comme un cas
  normal (rubrique optionnelle), pas une erreur.
- La Section B contient au moins 8 entrées `STRONG_MAGIC_KEYWORDS`, au moins
  4 `WEAK_MAGIC_KEYWORDS`, et au moins 3 `EXCLUSION_PHRASES`, chacune sourcée.
- La Section C couvre au moins les 8 races listées dans le pseudo-code
  (Aasimar, Tieffelin, Ifrit, Ondin, Sylphe, Oreade, Drow, Duergar), avec
  pour chacune soit une citation réelle de `Data/races.json` justifiant
  `RACE_MAGIC_KEYWORDS`, soit une note explicite que le texte scrapé actuel
  ne contient pas l'information attendue.

## Git Handling

- Branche : `feature/feat-details-vocab-markup-calibration` (worktree dédié,
  Wave 1).
- Commit : uniquement `OUTPUT_vocab_and_markup_calibration.md`.
- Message : `docs: calibrate feat/race HTML markup and magic vocabulary`

## Expected Outcome

Step 06, Step 08 et Step 10 n'ont plus aucune calibration à deviner : ils
implémentent littéralement ce que ce document fige, avec des preuves citées.
