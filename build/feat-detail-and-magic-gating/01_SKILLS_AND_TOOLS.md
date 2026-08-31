# 01_SKILLS_AND_TOOLS — Contrat HTML du tableau récapitulatif des dons

Pas de nouveau Skill Claude Code requis. Ce fichier fige la spécification
technique (vérifiée manuellement pendant le planning, ne pas re-deviner) que
Step 02 doit implémenter tel quel.

## Objectives

Documenter, avant tout code, la structure HTML réelle de la page source afin
que Step 02 n'ait pas à re-découvrir ces faits par essai-erreur.

## Dependencies & Parallelization

Wave 0 (spec pure, aucune dépendance). Consommé par Step 02 uniquement.

## Faits vérifiés (source de vérité pour Step 02)

URL de la page :
```
https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20dons.ashx
```

- La page pèse ~1.3 Mo de HTML brut ; tout le tableau des dons est sur une
  seule ligne physique très longue (pas de retours ligne dans les `<tr>`) —
  ne pas se fier à un parsing ligne-par-ligne, travailler sur le texte
  intégral.
- Chaque don apparaît comme une ligne `<tr>` avec une classe CSS parmi :
  - `CLASS="premier donprincipal"` ou `CLASS="premier alt donprincipal"`
    (dons "principaux", visibles par défaut)
  - `CLASS="donprérequis0"` / `CLASS="alt donprérequis0"` (dons affichés
    seulement après un clic sur l'icône de la ligne parente — mais déjà
    présents dans le HTML statique, juste masqués en CSS via
    `$("tr.donprérequis0, ...").hide()` en JS)
  - `CLASS="donprérequis1"` / `CLASS="alt donprérequis1"`
  - `CLASS="donprérequis2"` / `CLASS="alt donprérequis2"`
  - Toutes ces classes doivent être parsées de façon identique — le niveau
    d'imbrication (`0`/`1`/`2`) ne change pas la structure interne de la
    ligne, seulement son affichage par défaut dans la hiérarchie visuelle du
    site. **Ne pas simuler de clic ni exécuter de JS : un simple GET HTTP
    suffit, toutes les lignes sont déjà dans la réponse.**
- Structure interne d'une ligne (4 `<td>`, dans cet ordre, identique aux
  colonnes `Dons,Src,Conditions,Avantages` du CSV existant) :
  ```html
  <tr CLASS="premier donprincipal">
    <td><a class="pagelink" href="Pathfinder-RPG.<slug>.ashx" title="<Nom>"><Nom></a>[*]</td>
    <td><sup><Src></sup></td>
    <td><Conditions HTML, peut contenir des <a class="pagelink"> imbriqués></td>
    <td><Avantages HTML, peut contenir des <a class="pagelink"> imbriqués></td>
  </tr>
  ```
  Exemple réel observé :
  ```html
  <tr CLASS="premier donprincipal"><td><a class="pagelink" href="Pathfinder-RPG.Absorption%20rageuse.ashx" title="Absorption rageuse">Absorption rageuse</a></td><td><sup>MCA</sup></td><td>Capacité à lancer des sorts de <a class="pagelink" href="Pathfinder-RPG.sanguin.ashx" title="Le sanguin">sanguin</a> de 2e niveau, capacité de classe <a class="pagelink" href="Pathfinder-RPG.sanguin.ashx#RAGESANGUINE" title="Le sanguin">rage sanguine</a></td><td>Le personnage absorbe l'énergie magique des sorts agressifs pour alimenter sa rage sanguine</td></tr>
  ```
- Le lien à extraire pour chaque don est le **premier** `<a class="pagelink" href="...">` du **premier** `<td>` de la ligne — son `href` (relatif, à préfixer par `https://www.pathfinder-fr.org/Wiki/`) et son texte (nom du don, éventuellement suivi d'un `*` littéral hors du `<a>` pour les dons répétables — cohérent avec la colonne `Dons` du CSV existant).
- Attention : la classe HTML est écrite en MAJUSCULES (`CLASS=`, pas
  `class=`) pour les `<tr>` du tableau de dons, alors que les liens internes
  utilisent `class="pagelink"` en minuscules — un parseur regex insensible à
  la casse sur l'attribut est plus sûr qu'un match exact.
- Les lignes `donprérequis*` sont une vue arborescente de dons qui **existent
  déjà** ailleurs dans le même tableau (un don prérequis d'un autre don) —
  ce ne sont pas des dons supplémentaires absents du CSV. Il faut néanmoins
  les parser toutes (dédoublonnage par nom de don final), au cas où un don
  n'apparaîtrait que niché et jamais comme ligne "principale" — c'est une
  garantie de complétude demandée explicitement, pas une optimisation.
- Cache attendu (même patron que `scrappers/scrape_races.py::download_pages`) :
  télécharger une seule fois dans un fichier `feat_table_html/tableau_recapitulatif.html`,
  ne pas re-télécharger sauf `force=True`.

## Verification Criteria

Step 02 est correctement informé par ce contrat si, après implémentation,
`Data/feat_links.json` contient au moins autant d'entrées que de lignes non
`#ERROR!` dans `Data/Dons.csv`, sans avoir eu besoin d'exécuter de JS ou
d'appeler un second endpoint AJAX.
