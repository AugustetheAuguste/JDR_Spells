# 02_STEP — Scraper des liens de dons (tableau récapitulatif)

## Objectives

Créer `scrappers/scrape_feat_links.py`, script autonome (non importé par le
package `pf1_dons`, même patron que `scrappers/scrape_races.py`) qui
télécharge la page du tableau récapitulatif des dons et produit
`Data/feat_links.json` : `{ "<nom de don nettoyé>": "<url absolue de la page dédiée>" }`.

## Dependencies & Parallelization

- Wave 1. Dépend uniquement de `01_SKILLS_AND_TOOLS.md` (le contrat HTML,
  inliné ci-dessous en entier — ce fichier est autosuffisant).
- Aucune dépendance sur un autre step fonctionnel. Peut tourner en parallèle
  de Step 03, Step 04 et Step 05 dans un worktree séparé.

## Inherited Context from Dependencies

Contrat HTML complet (vérifié manuellement, ne pas re-vérifier) :

- URL source : `https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20dons.ashx`
- Toute la table est sur une seule ligne physique de HTML très longue —
  parser le texte intégral, pas ligne par ligne.
- Chaque don = une balise `<tr>` avec un attribut `CLASS` (majuscules) valant
  une combinaison de : `premier`, `alt`, `donprincipal`, `donprérequis0`,
  `donprérequis1`, `donprérequis2`. Toutes ces lignes sont déjà présentes
  dans le HTML statique (le masquage est purement CSS/JS côté client) — un
  simple GET HTTP suffit, ne pas simuler de clic ni de JS.
- Structure d'une ligne (4 `<td>` dans l'ordre `Dons,Src,Conditions,Avantages`,
  identique aux colonnes de `Data/Dons.csv`) :
  ```html
  <tr CLASS="premier donprincipal"><td><a class="pagelink" href="Pathfinder-RPG.<slug>.ashx" title="<Nom>"><Nom></a>[*]</td><td><sup><Src></sup></td><td>...</td><td>...</td></tr>
  ```
- Le lien à extraire par ligne = le **premier** `<a class="pagelink" href="...">` du **premier** `<td>` : son `href` (relatif au wiki, préfixer avec `https://www.pathfinder-fr.org/Wiki/`) et le texte du lien (nom du don, sans le `*` de répétabilité qui est hors du `<a>`).
- Les lignes `donprérequis*` répètent des dons déjà présents ailleurs comme
  ligne "principale" — dédoublonner par nom nettoyé, mais parser toutes les
  classes de ligne (garantie de complétude).

## Pseudo-code

```
CONST URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Tableau%20r%C3%A9capitulatif%20des%20dons.ashx"
CONST HTML_DIR = "feat_table_html/"
CONST HTML_FILE = HTML_DIR + "tableau_recapitulatif.html"
CONST OUT_PATH = "Data/feat_links.json"
CONST BASE = "https://www.pathfinder-fr.org/Wiki/"

FUNCTION download(force=False):
    IF HTML_FILE exists AND NOT force: RETURN
    GET URL with User-Agent header (comme scrape_races.py)
    write bytes to HTML_FILE

FUNCTION extract_row_blocks(html_text):
    # regex non-gourmande sur <tr CLASS="...(donprincipal|donprérequis[0-2])...">...</tr>
    # insensible à la casse sur l'attribut CLASS
    RETURN list of raw <tr>...</tr> strings

FUNCTION extract_first_link(row_html):
    # dans le PREMIER <td>...</td> du row, chercher le premier
    # <a class="pagelink" href="...">texte</a>
    href = ...
    name_raw = strip_tags(texte du <a>)
    # vérifier s'il y a un "*" juste après la fermeture du </a> et avant </td>,
    # le rattacher au nom pour cohérence d'affichage mais nettoyer ensuite
    # avec la même logique que data_loader.clean_feat_name (strip + rstrip("*") + strip)
    RETURN (clean_name, absolute_url)

FUNCTION main():
    download()
    html_text = read HTML_FILE
    rows = extract_row_blocks(html_text)
    out = {}
    ambiguous = []
    FOR row IN rows:
        (name, url) = extract_first_link(row)
        IF name already in out AND out[name] != url:
            ambiguous.append(name)   # signal, ne doit normalement jamais arriver
        out[name] = url
    write JSON(out, sort_keys=True, ensure_ascii=False, indent=2) to OUT_PATH
    print count + any ambiguous names
```

## Logic Flow

1. Télécharger (avec cache) la page unique du tableau récapitulatif.
2. Extraire toutes les lignes de don (principales + les 3 niveaux imbriqués).
3. Pour chaque ligne, isoler le premier `<td>` et en tirer le nom + l'URL
   absolue de la page dédiée du don.
4. Nettoyer le nom exactement comme `pf1_dons/data_loader.py::clean_feat_name`
   (`name.strip().rstrip("*").strip()`) pour que les clés matchent celles du
   CSV.
5. Dédoublonner par nom nettoyé ; écrire le JSON trié.

## Implementation Notes

- Réutiliser le patron `download_pages`/cache de `scrappers/scrape_races.py`
  (User-Agent `"Mozilla/5.0"`, `urllib.request`, pas de librairie HTML tierce
  — le repo n'a pas de dépendance BeautifulSoup, rester cohérent en regex).
- Ne pas dépendre du package `pf1_dons` (script autonome, comme les autres
  scrapers) — recopier `clean_feat_name` localement si besoin, comme le fait
  déjà `scrappers/tag_feat_categories.py` pour `_normalize`.
- Le nombre de dons attendu doit être **supérieur ou égal** au nombre de
  lignes valides de `Data/Dons.csv` (`len(filter_valid_rows(load_raw()))` +
  les lignes `#ERROR!` exclues, car le tableau récapitulatif peut contenir
  des dons absents du CSV ou vice-versa — ne pas forcer une correspondance
  1:1, juste logger les noms du CSV qui n'ont pas de lien trouvé).
- Ne pas committer `feat_table_html/` (ajouter au `.gitignore` si absent, à
  vérifier — cohérent avec `races_html/`/`classes_html/`, vérifier s'ils sont
  ignorés ou committés dans ce repo avant de décider, et suivre la même
  convention).

## Verification Criteria

- `python scrappers/scrape_feat_links.py` s'exécute sans erreur et produit
  `Data/feat_links.json`.
- Charger `Data/Dons.csv` (colonne `Dons`, nettoyée) et vérifier que le taux
  de couverture (noms du CSV trouvés comme clé dans `feat_links.json`) est
  > 95% ; toute absence doit être listée dans la sortie console du script.
- Vérifier manuellement 3 entrées connues, ex. `"Absorption rageuse"` doit
  mapper vers une URL contenant `Absorption%20rageuse` (ou équivalent décodé).
- Confirme l'usage correct du contrat HTML hérité : aucune requête vers un
  second endpoint AJAX, aucune dépendance à un navigateur headless.

## Git Handling

- Branche : `feature/feat-details-scrape-links` (worktree dédié, Wave 1).
- Commit unique : script + `Data/feat_links.json` généré + éventuelle mise à
  jour de `.gitignore` pour `feat_table_html/`.
- Message : `scrape: fetch feat detail-page links from the recap table`

## Expected Outcome

`Data/feat_links.json` existe, couvre la quasi-totalité des dons du CSV, et
sert d'entrée à Step 06.
