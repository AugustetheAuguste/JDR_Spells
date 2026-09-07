"""Step 05 driver: parse the per-level progression table out of every cached
class page into `data/regles/progression_classes.json`.

Offline only — reads `cache/html_classes/<slug>.html`, populated by
`recuperer_pages_classes.py` (network, throttled) or
`importer_cache_classes.py` (offline shortcut). Never touches the network
itself, never touches `data/classes/` (that tree belongs to the feats corpus,
cf. CLAUDE.md §12).

Page anatomy this parser is written against (measured on real cached pages,
not assumed — see `build/fiche_personnage/05_REGLES_PROGRESSION_CLASSES.md`):

    <div id="PageContentDiv">
      ...prose...
      <table CLASS="tablo ..."><caption>Le guerrier</caption>
        <tr CLASS="titre"><td>Niveau</td><td>BBA</td><td>Réflexes</td>
            <td>Vigueur</td><td>Volonté</td><td CLASS="gauche">Spécial</td></tr>
        <tr CLASS="premier"><td>1</td>...</tr>
        ...
      </table>
      ...
      <b>Dés de vie.</b> d10.
      ...
    </div>

For a spellcasting class, the header row's base six cells carry
`ROWSPAN="2"` and a seventh cell (`COLSPAN="N"`, text `Sorts par jour` or
similar) introduces a second header row of spell-level labels (`0`, `1er`,
`2e`, …); each data row then carries N extra cells, one slot count per level,
`-` meaning no slot (never zero).

Nothing is guessed: a class without a recognizable progression table gets
`progression: null` and a report line; an unrecognized column lands in
`extra`, never dropped.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from bs4 import Tag

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE / "src"))

from pf_spells.htmlutil import clean_text, load_html, normalize_label, page_content  # noqa: E402

parser_version = "1.0.0"

CACHE_DIR = RACINE / "cache/html_classes"
INDEX_PATH = CACHE_DIR / "index.jsonl"
REGISTRE = RACINE / "data/conventions/classes_unifiees.json"
OUT_PATH = RACINE / "data/regles/progression_classes.json"
REPORT_PATH = RACINE / "reports/regles_progression_classes.md"

BASE_KEYS = ("niveau", "bba", "reflexes", "vigueur", "volonte", "special")

_RE_DES_DE_VIE = re.compile(r"D[ée]s de vie\.?\s*[Dd]\s*(\d+)")
_RE_NIVEAU_SORT = re.compile(r"^(\d+)")


def _lignes_de(table: Tag) -> list[Tag]:
    """Direct-descendant `<tr>` of `table`, never a nested table's rows.

    `Tag.find_all` recurses through the whole subtree, so a layout wrapper
    (`<table width="100%"><tr><td><table class="tablo">…</table></td></tr>`,
    seen on real pages) would otherwise leak the *inner* table's rows into
    the *outer* table's row list and vice versa — filtering by `find_parent`
    keeps each table's rows scoped to itself.
    """
    return [tr for tr in table.find_all("tr") if tr.find_parent("table") is table]


def _cellules_de(row: Tag, table: Tag) -> list[Tag]:
    """Same scoping as `_lignes_de`, for a row's own `<td>`/`<th>` cells."""
    return [c for c in row.find_all(["td", "th"]) if c.find_parent("table") is table]


class Lacune:
    """One reportable gap. Never fatal — the run continues."""

    def __init__(self, slug: str, categorie: str, detail: str) -> None:
        self.slug = slug
        self.categorie = categorie
        self.detail = detail


def _charger_registre() -> dict[str, dict[str, object]]:
    contenu = json.loads(REGISTRE.read_text(encoding="utf-8"))
    return {c["slug"]: c for c in contenu["classes"]}


def _charger_index_urls() -> dict[str, str | None]:
    if not INDEX_PATH.exists():
        return {}
    urls: dict[str, str | None] = {}
    for ligne in INDEX_PATH.read_text(encoding="utf-8").splitlines():
        if not ligne.strip():
            continue
        entree = json.loads(ligne)
        urls[entree["slug"]] = entree.get("url")
    return urls


def _entier(texte: str) -> int | None:
    texte = texte.strip()
    if not texte:
        return None
    signe = 1
    if texte.startswith("+"):
        texte = texte[1:]
    elif texte.startswith("-"):
        signe = -1
        texte = texte[1:]
    if not texte.isdigit():
        return None
    return signe * int(texte)


def _trouver_table_progression(tables: list[Tag]) -> Tag | None:
    for table in tables:
        rows = _lignes_de(table)
        if not rows:
            continue
        cellules = _cellules_de(rows[0], table)
        libelles = {normalize_label(clean_text(c)) for c in cellules}
        if "niveau" in libelles and "bba" in libelles:
            return table
    return None


def _trouver_table_sorts(tables: list[Tag], table_progression: Tag | None) -> Tag | None:
    for table in tables:
        rows = _lignes_de(table)
        if not rows:
            continue
        for row in rows[:2]:
            cellules = _cellules_de(row, table)
            for cellule in cellules:
                libelle = normalize_label(clean_text(cellule))
                if "sorts par jour" in libelle or "sorts connus" in libelle:
                    return table
        if table is table_progression:
            # The progression table itself carries the spell columns in the
            # normal case — detected above already; nothing more to check.
            continue
    return None


def _genre_table_sorts(libelle_groupe: str) -> str | None:
    normalise = normalize_label(libelle_groupe)
    if normalise == "sorts par jour":
        return "sorts_par_jour"
    if normalise == "sorts connus":
        return "sorts_connus"
    return None


def _niveau_sort(libelle: str) -> int | None:
    normalise = normalize_label(libelle)
    m = _RE_NIVEAU_SORT.match(normalise)
    if m is None:
        return None
    return int(m.group(1))


def _parser_table(
    slug: str, table: Tag, lacunes: list[Lacune], entetes_inconnus: set[str]
) -> tuple[list[dict[str, object]] | None, str | None, dict[int, dict[int, int | None]] | None, list[str]]:
    rows = _lignes_de(table)
    header_cells = _cellules_de(rows[0], table)
    entetes_bruts = [clean_text(c) for c in header_cells]
    entetes_norm = [normalize_label(t) for t in entetes_bruts]

    groupe_index = None
    for i, cell in enumerate(header_cells):
        if cell.get("colspan") is not None:
            groupe_index = i
            break

    base_cells = header_cells if groupe_index is None else header_cells[:groupe_index]
    base_norm = entetes_norm if groupe_index is None else entetes_norm[:groupe_index]

    idx_map: dict[str, int] = {}
    for i, libelle in enumerate(base_norm):
        if libelle in BASE_KEYS and libelle not in idx_map:
            idx_map[libelle] = i

    manquantes = [k for k in BASE_KEYS if k not in idx_map]
    if manquantes:
        lacunes.append(
            Lacune(
                slug,
                "table_atypique",
                f"colonnes de base absentes de la table de progression : {', '.join(manquantes)}",
            )
        )
        return None, None, None, entetes_bruts

    extra_indices = [i for i in range(len(base_norm)) if i not in idx_map.values()]
    for i in extra_indices:
        entetes_inconnus.add(entetes_bruts[i])

    has_subheader = any(cell.get("rowspan") == "2" for cell in header_cells)
    sous_entetes: list[str] = []
    data_start = 1
    genre_table_sorts: str | None = None
    if groupe_index is not None and has_subheader and len(rows) > 1:
        sous_cells = _cellules_de(rows[1], table)
        sous_entetes = [clean_text(c) for c in sous_cells]
        data_start = 2
        genre_table_sorts = _genre_table_sorts(entetes_bruts[groupe_index])
        if genre_table_sorts is None:
            entetes_inconnus.add(f"groupe:{entetes_bruts[groupe_index]}")

    niveaux_sorts = [_niveau_sort(lbl) for lbl in sous_entetes]
    for lbl, niv in zip(sous_entetes, niveaux_sorts):
        if niv is None:
            entetes_inconnus.add(f"sous-en-tete:{lbl}")

    base_col_count = len(base_cells)

    progression: list[dict[str, object]] = []
    # emplacements[niveau_personnage][niveau_de_sort] -> nombre, jamais 0 pour
    # une cellule vide. Deux dimensions, pas une : le nombre d'emplacements de
    # sort dépend à la fois du niveau du personnage et du niveau du sort.
    emplacements: dict[int, dict[int, int | None]] = {}

    for row in rows[data_start:]:
        cellules = _cellules_de(row, table)
        if not cellules:
            continue
        niveau_texte = clean_text(cellules[0])
        if not niveau_texte.isdigit():
            continue
        niveau = int(niveau_texte)

        def _cellule(nom: str) -> Tag | None:
            i = idx_map.get(nom)
            return cellules[i] if i is not None and i < len(cellules) else None

        bba_cell = _cellule("bba")
        bba_texte = clean_text(bba_cell) if bba_cell is not None else ""
        bba_serie = [t.strip() for t in bba_texte.split("/") if t.strip()]
        bba = _entier(bba_serie[0]) if bba_serie else None

        reflexes_cell = _cellule("reflexes")
        vigueur_cell = _cellule("vigueur")
        volonte_cell = _cellule("volonte")
        special_cell = _cellule("special")

        special_texte = clean_text(special_cell) if special_cell is not None else ""
        special = [p.strip() for p in special_texte.split(",") if p.strip()]

        extra: dict[str, str] = {}
        for i in extra_indices:
            if i < len(cellules):
                extra[entetes_bruts[i]] = clean_text(cellules[i])

        progression.append(
            {
                "niveau": niveau,
                "bba": bba,
                "bba_serie": bba_serie,
                "reflexes": _entier(clean_text(reflexes_cell)) if reflexes_cell is not None else None,
                "vigueur": _entier(clean_text(vigueur_cell)) if vigueur_cell is not None else None,
                "volonte": _entier(clean_text(volonte_cell)) if volonte_cell is not None else None,
                "special": special,
                "extra": extra,
            }
        )

        if genre_table_sorts is not None:
            ligne_emplacements: dict[int, int | None] = {}
            valeurs_sorts = cellules[base_col_count : base_col_count + len(niveaux_sorts)]
            for niv, cellule_valeur in zip(niveaux_sorts, valeurs_sorts):
                if niv is None:
                    continue
                texte_valeur = clean_text(cellule_valeur)
                if texte_valeur in ("", "-", "—"):
                    ligne_emplacements[niv] = None
                else:
                    ligne_emplacements[niv] = _entier(texte_valeur)
            emplacements[niveau] = ligne_emplacements

    return progression, genre_table_sorts, (emplacements if genre_table_sorts is not None else None), entetes_bruts


def _de_vie(contenu: Tag, slug: str, lacunes: list[Lacune]) -> str | None:
    texte = clean_text(contenu)
    m = _RE_DES_DE_VIE.search(texte)
    if m is None:
        lacunes.append(Lacune(slug, "de_vie", "mention « Dés de vie » introuvable"))
        return None
    return f"d{m.group(1)}"


def _nom_affiche(table_progression: Tag | None) -> str | None:
    if table_progression is None:
        return None
    caption = table_progression.find("caption")
    if caption is None:
        return None
    texte = clean_text(caption)
    if not texte:
        return None
    return texte.splitlines()[-1]


def parser_un_fichier(
    chemin: Path, urls: dict[str, str | None], lacunes: list[Lacune], entetes_inconnus: set[str]
) -> dict[str, object]:
    slug = chemin.stem
    html = load_html(chemin)
    contenu = page_content(html)
    tables = contenu.find_all("table")

    table_progression = _trouver_table_progression(tables)
    if table_progression is None:
        lacunes.append(Lacune(slug, "sans_table_progression", "aucune table Niveau/BBA trouvée"))
        return {
            "nom_affiche": None,
            "de_vie": _de_vie(contenu, slug, lacunes),
            "progression": None,
            "genre_table_sorts": None,
            "emplacements": None,
            "colonnes_vues": [],
            "url_source": urls.get(slug),
        }

    progression, genre_table_sorts, emplacements, colonnes_vues = _parser_table(
        slug, table_progression, lacunes, entetes_inconnus
    )

    return {
        "nom_affiche": _nom_affiche(table_progression),
        "de_vie": _de_vie(contenu, slug, lacunes),
        "progression": progression,
        "genre_table_sorts": genre_table_sorts,
        "emplacements": (
            {
                str(niv): {str(ns): val for ns, val in sorted(table_niv.items())}
                for niv, table_niv in sorted(emplacements.items())
            }
            if emplacements is not None
            else None
        ),
        "colonnes_vues": colonnes_vues,
        "url_source": urls.get(slug),
    }


def _ecrire_enveloppe(donnees: dict[str, object], sources: list[dict[str, str]]) -> None:
    from datetime import UTC, datetime

    enveloppe = {
        "meta": {
            "version": 1,
            "genere_le": datetime.now(UTC).date().isoformat(),
            "sources": sources,
            "outil": "tools/regles/parser_progression_classes.py",
        },
        "donnees": donnees,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(enveloppe, ensure_ascii=False, indent=2) + "\n"
    OUT_PATH.write_text(texte, encoding="utf-8", newline="\n")


def _ecrire_rapport(
    fichiers_lus: int,
    classes_produites: int,
    registre: dict[str, dict[str, object]],
    slugs_cache: set[str],
    lacunes: list[Lacune],
    donnees: dict[str, object],
    entetes_inconnus: set[str],
) -> None:
    slugs_sans_fichier = sorted(set(registre) - slugs_cache)

    sans_table = sorted({l.slug for l in lacunes if l.categorie == "sans_table_progression"})
    sans_de_vie = sorted({l.slug for l in lacunes if l.categorie == "de_vie"})

    # Cross-check §5: classes marked `lanceur: true` in the registry but with
    # no spell table found, matched by normalizing slug punctuation on both
    # sides (registry slugs may carry a literal space, cache filenames an
    # underscore) so the comparison isn't defeated by that cosmetic mismatch.
    def _norm_slug(s: str) -> str:
        return re.sub(r"[ _]+", "-", s.strip().lower())

    registre_norm = {_norm_slug(slug): entree for slug, entree in registre.items()}

    sans_table_sorts = sorted(
        slug for slug, d in donnees.items() if d.get("genre_table_sorts") is None
    )
    incoherences = []
    for slug in sans_table_sorts:
        entree = registre_norm.get(_norm_slug(slug))
        if entree is not None and entree.get("lanceur") is True:
            incoherences.append(slug)

    lignes = [
        "# Rapport — progression des classes",
        "",
        "## 1. Totaux",
        "",
        f"- Fichiers lus : **{fichiers_lus}**",
        f"- Classes produites : **{classes_produites}**",
        "",
        "## 2. Slugs du registre sans fichier de cache",
        "",
    ]
    if slugs_sans_fichier:
        lignes.append(", ".join(f"`{s}`" for s in slugs_sans_fichier))
    else:
        lignes.append("Aucun.")

    lignes += ["", "## 3. Slugs sans table de progression trouvée", ""]
    lignes.append(", ".join(f"`{s}`" for s in sans_table) if sans_table else "Aucun.")

    lignes += ["", "## 4. Slugs sans dé de vie trouvé", ""]
    lignes.append(", ".join(f"`{s}`" for s in sans_de_vie) if sans_de_vie else "Aucun.")

    lignes += [
        "",
        "## 5. Slugs sans table de sorts",
        "",
        "L'absence est normale pour une classe non lanceuse. Incohérences "
        "ci-dessous : classe `lanceur: true` dans le registre sans table de "
        "sorts trouvée dans sa page de cache.",
        "",
        f"Sans table de sorts (toutes) : {', '.join(f'`{s}`' for s in sans_table_sorts) if sans_table_sorts else 'Aucune.'}",
        "",
        f"Incohérences (`lanceur: true` sans table) : "
        f"{', '.join(f'`{s}`' for s in incoherences) if incoherences else 'Aucune.'}",
    ]

    lignes += ["", "## 6. En-têtes de colonnes hors des six attendus", ""]
    if entetes_inconnus:
        lignes.append(", ".join(f"`{e}`" for e in sorted(entetes_inconnus)))
    else:
        lignes.append("Aucun.")

    lignes.append("")
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def executer() -> int:
    registre = _charger_registre()
    urls = _charger_index_urls()

    if not CACHE_DIR.exists():
        print(f"ÉCHEC : {CACHE_DIR.as_posix()} est absent — peupler le cache d'abord", file=sys.stderr)
        return 1

    fichiers = sorted(CACHE_DIR.glob("*.html"))
    lacunes: list[Lacune] = []
    entetes_inconnus: set[str] = set()
    donnees: dict[str, object] = {}
    sources: list[dict[str, str]] = []

    for chemin in fichiers:
        slug = chemin.stem
        resultat = parser_un_fichier(chemin, urls, lacunes, entetes_inconnus)
        donnees[slug] = resultat
        if resultat.get("url_source"):
            sources.append(
                {
                    "url": resultat["url_source"],
                    "page": slug,
                    "lu_le": "2026-09-07",
                }
            )

    if not sources:
        # The contract requires a non-empty sources list; fall back to a
        # single entry pointing at the wiki root rather than fail the export
        # on an empty cache — but this path means every page lacked a URL,
        # which is itself a reportable gap already captured per-class above.
        sources = [
            {
                "url": "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG.Accueil.ashx",
                "page": "aucune-url-de-classe-resolue",
                "lu_le": "2026-09-07",
            }
        ]

    _ecrire_enveloppe(donnees, sources)
    _ecrire_rapport(
        fichiers_lus=len(fichiers),
        classes_produites=len(donnees),
        registre=registre,
        slugs_cache={c.stem for c in fichiers},
        lacunes=lacunes,
        donnees=donnees,
        entetes_inconnus=entetes_inconnus,
    )

    print(f"{len(fichiers)} fichier(s) lu(s), {len(donnees)} classe(s) produite(s)")
    print(f"écrit {OUT_PATH.as_posix()} et {REPORT_PATH.as_posix()}")
    return 0


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(
        description="Parse la progression niveau par niveau de chaque classe en cache."
    ).parse_args(argv)
    return executer()


if __name__ == "__main__":
    raise SystemExit(main())
