# 06_STEP — Scraper des pages détaillées de don

## Objectives

Créer `scrappers/scrape_feat_details.py` qui, pour chaque don listé dans
`Data/feat_links.json`, télécharge sa page dédiée (avec cache) et en extrait
le contenu structuré complet dans `Data/feat_details.json`.

## Dependencies & Parallelization

- Wave 2. Dépend de **Step 02** (`Data/feat_links.json`) et de **Step 03**
  (`OUTPUT_vocab_and_markup_calibration.md`, Section A — contrat HTML des
  rubriques).
- Aucune autre dépendance. Ne bloque pas Step 05/07 (fichiers différents).

## Inherited Context from Dependencies

- Entrée : `Data/feat_links.json`, format `{ "<nom nettoyé>": "<url absolue>" }`,
  produit par Step 02 (`scrappers/scrape_feat_links.py`).
- Nettoyage de nom identique à `pf1_dons/data_loader.py::clean_feat_name`
  (`name.strip().rstrip("*").strip()`).
- **Contrat HTML des rubriques : ne pas le redéterminer ici.** Step 03
  (`OUTPUT_vocab_and_markup_calibration.md`, Section A) a déjà figé, à partir
  d'un échantillon réel de pages, le motif HTML exact entourant chaque
  rubrique (`Source.`/`Conditions.`/`Avantages.`/`Spécial.`/`Normal.`) avec
  des extraits HTML cités verbatim et la regex/logique d'extraction
  recommandée pour chacune. Ce step DOIT lire ce document et implémenter
  littéralement ce qu'il prescrit, plutôt que redécouvrir la structure par
  essai-erreur sur ses propres pages.
- Un rendu visuel de référence (exemple réel, "Adaptation aquatique", avant
  nettoyage des balises) pour se repérer, mais la structure HTML sous-jacente
  exacte est celle documentée par Step 03, pas celle déduite de ce rendu
  visuel :
  ```
  Adaptation aquatique
  Source : Codex monstrueux/Monster Codex
  Cette option est plus courante chez les hommes-lézards.
  Le personnage a développé une capacité étrange mais bien utile : il peut respirer sous l'eau.
  Conditions. Capacité retenir son souffle
  Avantages. Le personnage respire aussi bien dans l'air que dans l'eau.
  ```
- Reste de texte libre avant la première rubrique connue = description
  narrative complète du don (le texte perdu aujourd'hui, ex. "Cette option
  est plus courante chez les hommes-lézards.").

## Pseudo-code

```
CONST HTML_DIR = "feat_pages_html/"
CONST OUT_PATH = "Data/feat_details.json"

FUNCTION slug_for_cache(feat_name):
    RETURN normalized-ascii-safe filename, e.g. via same _normalize()
    pattern used elsewhere (NFKD strip accents, lower, replace non-alnum
    with "_"), to avoid filesystem-illegal characters from URL-decoded names.

FUNCTION download_all(links: dict, force=False):
    HTML_DIR.mkdir()
    FOR name, url IN links.items():
        dest = HTML_DIR / (slug_for_cache(name) + ".html")
        IF dest exists AND NOT force: CONTINUE
        GET url with User-Agent header, séquentiellement (pas de parallélisme
        agressif). Aucune limite de débit précise n'est imposée — rester
        simplement raisonnable, comme les autres scrapers du repo.
        write bytes to dest

FUNCTION parse_feat_page(html_text) -> dict:
    title = ... (premier <h1> ou équivalent, à vérifier)
    source = texte après "Source :" jusqu'à la fin de ligne/bloc
    # découper le corps en segments par rubrique connue (Conditions./Avantages./
    # Spécial./Normal.), le texte AVANT la première rubrique connue = description
    RETURN {
        "url": url,
        "source_detail": source,
        "description": texte narratif avant la première rubrique,
        "conditions_detail": texte de la rubrique Conditions (ou null),
        "avantages_detail": texte de la rubrique Avantages (ou null),
        "special": texte de la rubrique Spécial (ou null),
        "normal": texte de la rubrique Normal (ou null),
        "raw_text": texte intégral nettoyé (fallback pour Step 08 si le
                    découpage par rubrique échoue),
    }

FUNCTION main():
    links = load JSON Data/feat_links.json
    download_all(links)
    out = {}
    failures = []
    FOR name, url IN links.items():
        TRY:
            html_text = read cached file for name
            out[name] = parse_feat_page(html_text) merged with {"url": url}
        EXCEPT as e:
            failures.append(name)
            out[name] = {"url": url, "raw_text": None, "parse_error": str(e)}
    write JSON(out, sort_keys=True, ensure_ascii=False, indent=2) to OUT_PATH
    print count + failures
```

## Logic Flow

1. Charger `feat_links.json`.
2. Télécharger (avec cache par fichier, un fichier HTML par don) chaque page.
3. Parser chaque page en un dict structuré ; ne jamais faire planter tout le
   script sur une page malformée — logguer l'échec dans le champ
   `"parse_error"` de cette entrée et continuer (philosophie du projet :
   surfacer l'incertitude plutôt que planter ou deviner silencieusement).
4. Toujours conserver `raw_text` (texte intégral nettoyé des balises) même
   si le découpage par rubrique échoue, pour que Step 08 (détection magie
   par mots-clés) ait toujours quelque chose à analyser.

## Implementation Notes

- Les regex de découpage par rubrique sont celles figées par Step 03
  (`OUTPUT_vocab_and_markup_calibration.md`, Section A) — ne pas les
  redéterminer depuis zéro. Si une page réelle rencontrée pendant ce step ne
  correspond à aucun motif documenté par Step 03, traiter ce cas comme un
  échec de parsing capturé (`"parse_error"`), ne pas improviser une nouvelle
  règle non documentée.
- Cache dans `feat_pages_html/` (nouveau dossier, même convention que
  `races_html/`/`classes_html/` pour le `.gitignore`).
- ~1000+ pages à télécharger, séquentiellement. Aucune limite de débit
  précise n'est imposée par le projet — rester simplement raisonnable
  (pas de parallélisme agressif), même si l'exécution prend plusieurs
  minutes.
- Ne pas committer `feat_pages_html/`.

## Verification Criteria

- `python scrappers/scrape_feat_details.py` s'exécute sans exception fatale
  (les échecs par page sont capturés, pas fatals) et produit
  `Data/feat_details.json` avec une entrée par clé de `feat_links.json`.
- Spot-check : l'entrée `"Adaptation aquatique"` doit contenir
  `"conditions_detail"` mentionnant "retenir son souffle" et une
  `"description"` non vide mentionnant "hommes-lézards" (l'information
  actuellement perdue par le CSV — c'est le critère de succès direct du
  problème rapporté par l'utilisateur).
- Moins de 5% des entrées avec `"parse_error"` non nul (sinon revoir les
  regex de découpage avant de continuer).

## Git Handling

- Branche : `feature/feat-details-scrape-pages`, basée sur les branches
  mergées de Step 02 (a besoin de `Data/feat_links.json` committé) et
  Step 03 (a besoin de `OUTPUT_vocab_and_markup_calibration.md`).
- Commit : script + `Data/feat_details.json` généré + `.gitignore` si besoin.
- Message : `scrape: fetch full detail-page content for every feat`

## Expected Outcome

`Data/feat_details.json` contient, pour (quasi) chaque don du catalogue, sa
description narrative complète et ses rubriques détaillées — la donnée brute
que Step 08 et Step 09 vont exploiter.
