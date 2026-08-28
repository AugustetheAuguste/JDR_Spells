"""Step 07 driver: parse every cached spell page into one JSON file per spell.

Offline only — the HTML comes from `cache/html/` via `data/spell_pages.jsonl`.
The output files are the deliverable a human reads, audits and hand-corrects, so
an existing file is never overwritten unless `--overwrite` is passed.

Page anatomy this parser is written against (measured over all 2070 cached
pages, not assumed):

    <div id="PageContentDiv">
      <script>…</script>                      optional, dropped
      <div class="presentation navmenudroite"> optional deity sidebar -> autres
      <a><img title="Source : …"></a>…         source-book logos -> sources
      <b>École</b> … ; <b>Niveau</b> …<br>     flat <b>/<br> stat-block run
      …description prose…                      after the last stat label
      <h2>Mythique</h2> …                      optional, isolated in `mythique`
      <div class="box"> … </div>               optional sub-blocks, see below
    </div>

A `div.box` is one of two things, distinguished by its inner `div.voiraussi`:

* with a "Sorts qui « fonctionnent comme » X" `voiraussi` heading -> the box
  holds **variant** spells, one per direct-child `<h1 class="separator">`, each
  with a complete stat block of its own. These land in `variantes`.
* without it -> the box reproduces the **base** spell this page is a variant of
  (e.g. `action-interdite-superieure` reproduces `action interdite`). Those are
  not variants of the current spell, so only their names are kept, in
  `autres["sorts_lies"]`; the block never leaks into `description`.

Outputs:
    data/sorts/<id>.json          one pretty-printed file per spell
    reports/07_parse_spells.md    coverage, unknown labels, failures
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from jsonschema import Draft202012Validator

from pf_spells.htmlutil import clean_text, inner_html, load_html, normalize_label
from pf_spells.slugs import slugify

parser_version = "1.0.0"

MANIFEST_PATH = Path("data/spell_pages.jsonl")
SORTS_DIR = Path("data/sorts")
SCHEMA_PATH = Path("data/schemas/sort.schema.json")
REPORT_PATH = Path("reports/07_parse_spells.md")

CACHE_INDEX_PATH = Path("cache/index.jsonl")

# Canonical top-level key order — the Skill's JSON key vocabulary, in order.
KEY_ORDER = (
    "id",
    "nom",
    "url",
    "ecole",
    "descripteurs",
    "niveaux",
    "temps_incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet_de_sauvegarde",
    "resistance_magie",
    "description",
    "description_html",
    "mythique",
    "variantes",
    "sources",
    "autres",
    "classes",
    "meta",
)

# Same order, restricted to what a nested variant carries.
VARIANTE_KEY_ORDER = (
    "nom",
    "id",
    "ecole",
    "descripteurs",
    "niveaux",
    "temps_incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet_de_sauvegarde",
    "resistance_magie",
    "description",
    "description_html",
    "mythique",
)

# Normalized stat-block label -> output key. Straight from the Skill's label map;
# the plural/compound target labels are the ones actually present in the corpus.
LABEL_MAP: dict[str, str] = {
    "ecole": "ecole",
    "niveau": "niveaux",
    "temps d'incantation": "temps_incantation",
    "composantes": "composantes",
    "portee": "portee",
    "cible": "cible",
    "cibles": "cible",
    "effet": "cible",
    "zone": "cible",
    "zone d'effet": "cible",
    "cible ou cibles": "cible",
    "cible ou zone d'effet": "cible",
    "cible, effet ou zone d'effet": "cible",
    "cible ou effet": "cible",
    "cible et zone d'effet": "cible",
    "zone d'effet ou cible": "cible",
    "duree": "duree",
    "jet de sauvegarde": "jet_de_sauvegarde",
    "resistance a la magie": "resistance_magie",
}

# The nine stat-block fields, for coverage reporting.
CHAMPS_STATBLOC = (
    "ecole",
    "niveaux",
    "temps_incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet_de_sauvegarde",
    "resistance_magie",
)

# Tags that end a stat value or the stat-block run.
_COUPURES = ("br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "div", "table", "ul", "ol", "p")
# Tags that end the description region.
_FIN_DESCRIPTION = ("h1", "h2", "h3", "h4", "h5", "h6")

_DESCRIPTEURS = re.compile(r"\[([^\]]*)\]")
_NIVEAU_PAIRE = re.compile(r"^(.+?)\s+(\d+)(?:\s*\(.*\))?$")
# `Toucher de combustion` reads `magus 1 Ens/Mag 1` — the wiki author dropped a
# comma. A run of `abbrev level` pairs inside one comma-chunk is split on this,
# which requires the abbreviation part to be digit-free so it can't swallow the
# level of the pair before it.
_NIVEAUX_COLLES = re.compile(r"([^\d,()]+?)\s+(\d+)")
_SOURCE_PREFIXE = re.compile(r"^\s*Source\s*:\s*", re.IGNORECASE)
_FONCTIONNENT_COMME = re.compile(r"sorts qui .*fonctionnent comme")
_PILCROW = "¶"

# On exactly one page (`cercle-magique-contre-le-bien`) the description follows
# the last stat value across a bare newline, with no <br> and no <hr>. A newline
# only ends the value when what follows it is long enough to be prose.
SEUIL_PROSE = 200


def _is_tag(node: object, *noms: str) -> bool:
    return isinstance(node, Tag) and node.name in noms


def _classes_of(node: object) -> tuple[str, ...]:
    if not isinstance(node, Tag):
        return ()
    valeur = node.get("class") or []
    return tuple(valeur) if isinstance(valeur, list) else (str(valeur),)


def heading_text(node: Tag) -> str:
    """Return a heading's text without the wiki's section-anchor pilcrow."""
    return clean_text(node).replace(_PILCROW, "").strip()


def est_bloc_box(node: object) -> bool:
    return _is_tag(node, "div") and "box" in _classes_of(node)


def est_titre_mythique(node: object) -> bool:
    return _is_tag(node, "h2", "h3") and "mythique" in normalize_label(
        heading_text(node)
    )


def est_logo_source(node: object) -> bool:
    """True for the `<a><img title="Source : …"></a>` source-book logo anchors."""
    if not _is_tag(node, "a"):
        return False
    return any(
        _SOURCE_PREFIXE.match(img.get("title") or "") for img in node.find_all("img")
    )


def est_encart_divinite(node: object) -> bool:
    return _is_tag(node, "div") and "navmenudroite" in _classes_of(node)


def render(noeuds: list[object]) -> str:
    """Return the verbatim HTML of a node run, untouched."""
    return "".join(
        node.decode() if isinstance(node, Tag) else str(node) for node in noeuds
    )


def texte(noeuds: list[object]) -> str:
    """Return the clean visible text of a node run."""
    if not noeuds:
        return ""
    return clean_text(BeautifulSoup(f"<div>{render(noeuds)}</div>", "lxml").div)


def extraire_sources(noeuds: list[object]) -> list[str]:
    """Return the source-book names from the logo anchors in a node run."""
    trouvees: list[str] = []
    for node in noeuds:
        if not isinstance(node, Tag):
            continue
        images = [node] if node.name == "img" else node.find_all("img")
        for img in images:
            titre = img.get("title") or ""
            if _SOURCE_PREFIXE.match(titre):
                nom = _SOURCE_PREFIXE.sub("", titre).strip()
                if nom and nom not in trouvees:
                    trouvees.append(nom)
    return trouvees


def _valeur_de(noeuds: list[object]) -> str:
    """Clean a stat value: drop the ` ;` that joins two labels on one line."""
    valeur = texte(noeuds).strip()
    return valeur.rstrip(" ;\xa0").strip() or ""


def _decouper_valeur_finale(
    noeuds: list[object],
) -> tuple[list[object], list[object]]:
    """Split a run into (stat value, description) on a prose-carrying newline.

    Only fires when the text after the newline is long enough to be prose, so a
    value legitimately wrapped across lines (`oui\\n(inoffensif)`) stays whole.
    """
    for i, node in enumerate(noeuds):
        if not isinstance(node, NavigableString) or "\n" not in node:
            continue
        tete, _, queue = str(node).partition("\n")
        reste = [queue, *noeuds[i + 1 :]]
        if len(texte(reste)) < SEUIL_PROSE:
            continue
        return [*noeuds[:i], tete], reste
    return noeuds, []


def parse_statbloc(noeuds: list[object]) -> tuple[dict, dict, list[object]]:
    """Parse the flat `<b>Label</b> value` run at the head of a node list.

    Returns `(champs, autres, reste)`: the mapped stat fields, the unrecognized
    `<b>`-labelled fields, and the nodes that begin the description.
    """
    champs: dict[str, str] = {}
    autres: dict[str, str] = {}
    dernier_connu = -1
    ancres: list[tuple[int, str, str, list[object]]] = []

    i = 0
    while i < len(noeuds):
        node = noeuds[i]
        if not _is_tag(node, "b"):
            i += 1
            continue
        brut = clean_text(node)
        label = normalize_label(brut)
        cle = LABEL_MAP.get(label)
        valeur: list[object] = []
        j = i + 1
        while j < len(noeuds):
            suivant = noeuds[j]
            if _is_tag(suivant, "b") or _is_tag(suivant, *_COUPURES):
                break
            valeur.append(suivant)
            j += 1
        ancres.append((i, cle or "", brut, valeur))
        if cle is not None:
            dernier_connu = len(ancres) - 1
        i = j

    if dernier_connu < 0:
        return champs, autres, noeuds

    # Everything past the last recognized label's value is description; `<b>`
    # runs beyond it are prose emphasis, not stat labels.
    for rang, (_, cle, brut, valeur) in enumerate(ancres[: dernier_connu + 1]):
        if rang == dernier_connu:
            valeur, _ = _decouper_valeur_finale(valeur)
        propre = _valeur_de(valeur)
        if cle:
            champs.setdefault(cle, propre)
        else:
            autres.setdefault(brut.rstrip(" :.").strip() or brut, propre or None)

    _, _, _, valeur_finale = ancres[dernier_connu]
    _, apres = _decouper_valeur_finale(valeur_finale)
    debut = ancres[dernier_connu][0] + 1
    fin = debut
    while fin < len(noeuds):
        node = noeuds[fin]
        if _is_tag(node, "b") or _is_tag(node, *_COUPURES):
            break
        fin += 1
    reste = [*apres, *noeuds[fin:]]
    return champs, autres, reste


def separer_ecole(valeur: str | None) -> tuple[str | None, list[str]]:
    """Split `Évocation [Bien, feu, lumière]` into school and descriptors."""
    if not valeur:
        return None, []
    descripteurs: list[str] = []
    for groupe in _DESCRIPTEURS.findall(valeur):
        descripteurs.extend(
            morceau.strip() for morceau in groupe.split(",") if morceau.strip()
        )
    ecole = _DESCRIPTEURS.sub("", valeur).strip().rstrip(";").strip()
    return (ecole or None), descripteurs


def parse_niveaux(valeur: str | None) -> tuple[dict[str, int], list[str]]:
    """Parse `Bard 2, Cham 2, Pal 1` into `{abbrev: level}` plus rejects.

    Abbreviations stay verbatim, accents intact — mapping them to class labels
    is step 08's job.
    """
    if not valeur:
        return {}, []
    niveaux: dict[str, int] = {}
    rejets: list[str] = []
    for morceau in valeur.split(","):
        morceau = morceau.strip().rstrip(";").strip()
        if not morceau:
            continue
        paire = _NIVEAU_PAIRE.match(morceau)
        if paire is None:
            rejets.append(morceau)
            continue
        abbrev = paire.group(1).strip()
        if any(c.isdigit() for c in abbrev):
            # Two pairs share one chunk: a missing comma on the wiki side.
            collees = _NIVEAUX_COLLES.findall(morceau)
            if len(collees) > 1:
                for nom, niveau in collees:
                    niveaux.setdefault(nom.strip(), int(niveau))
                continue
        niveaux.setdefault(abbrev, int(paire.group(2)))
    return niveaux, rejets


def decouper_regions(noeuds: list[object]) -> dict[str, list]:
    """Split a page's node run into description, mythic and box regions.

    Walks the run once, in document order, so a `Mythique` heading is isolated
    wherever it sits — before a box, after it, or alone.
    """
    description: list[object] = []
    mythique: list[object] = []
    autres_sections: list[tuple[str, list[object]]] = []
    boxes: list[Tag] = []
    courant = description
    titre_courant: str | None = None

    for node in noeuds:
        if est_bloc_box(node):
            boxes.append(node)
            courant = []
            titre_courant = None
            continue
        if _is_tag(node, *_FIN_DESCRIPTION):
            if est_titre_mythique(node):
                courant = mythique
                titre_courant = None
            else:
                titre_courant = heading_text(node)
                courant = []
                autres_sections.append((titre_courant, courant))
            continue
        courant.append(node)

    return {
        "description": description,
        "mythique": mythique,
        "sections": autres_sections,
        "boxes": boxes,
    }


def _bloc_texte(noeuds: list[object]) -> dict[str, str] | None:
    contenu = [
        node
        for node in noeuds
        if not (_is_tag(node, "script", "style") or est_logo_source(node))
    ]
    propre = texte(contenu)
    if not propre:
        return None
    return {"description": propre, "description_html": render(contenu).strip()}


def parse_variante(titre: Tag, noeuds: list[object]) -> dict:
    """Parse one `<h1 class="separator">`-titled variant block inside a box."""
    nom = heading_text(titre)
    champs, extra, reste = parse_statbloc(
        [node for node in noeuds if not _is_tag(node, "script", "style")]
    )
    regions = decouper_regions(reste)
    ecole, descripteurs = separer_ecole(champs.get("ecole"))
    niveaux, _ = parse_niveaux(champs.get("niveaux"))
    corps = _bloc_texte(regions["description"])
    variante = {
        "nom": nom,
        "id": slugify(nom),
        "ecole": ecole,
        "descripteurs": descripteurs,
        "niveaux": niveaux,
        "temps_incantation": champs.get("temps_incantation") or None,
        "composantes": champs.get("composantes") or None,
        "portee": champs.get("portee") or None,
        "cible": champs.get("cible") or None,
        "duree": champs.get("duree") or None,
        "jet_de_sauvegarde": champs.get("jet_de_sauvegarde") or None,
        "resistance_magie": champs.get("resistance_magie") or None,
        "description": corps["description"] if corps else "",
        "description_html": corps["description_html"] if corps else "",
        "mythique": _bloc_texte(regions["mythique"]),
    }
    return {cle: variante[cle] for cle in VARIANTE_KEY_ORDER}


def _decouper_box(box: Tag) -> list[tuple[Tag, list[object]]]:
    """Return the `(h1 title, nodes)` blocks a box is made of."""
    blocs: list[tuple[Tag, list[object]]] = []
    courant: list[object] | None = None
    for node in box.children:
        if _is_tag(node, "h1"):
            courant = []
            blocs.append((node, courant))
            continue
        if courant is not None:
            courant.append(node)
    return blocs


def parse_boxes(boxes: list[Tag]) -> tuple[list[dict], list[str]]:
    """Split the boxes into nested variants and merely-referenced base spells."""
    variantes: list[dict] = []
    lies: list[str] = []
    for box in boxes:
        voiraussi = box.find("div", class_="voiraussi")
        est_variante = voiraussi is not None and _FONCTIONNENT_COMME.search(
            normalize_label(clean_text(voiraussi))
        )
        for titre, noeuds in _decouper_box(box):
            if est_variante:
                variantes.append(parse_variante(titre, noeuds))
            else:
                nom = heading_text(titre)
                if nom and nom not in lies:
                    lies.append(nom)
    return variantes, lies


def parse_page(html: str, entree: dict) -> tuple[dict, dict]:
    """Parse one spell page into its output document plus parse diagnostics."""
    soup = BeautifulSoup(html, "lxml")
    racine = soup.find(id="PageContentDiv")
    if racine is None:
        raise ValueError('aucun <div id="PageContentDiv"> dans la page')
    attachements = racine.find(id="PageAttachmentsDiv")
    if attachements is not None:
        attachements.decompose()

    titre_page = soup.find("h1", class_="pagetitle")
    nom = entree["nom"]
    if titre_page is not None:
        candidat = heading_text(titre_page)
        # Keep the manifest name when the page title would break the id join.
        if candidat and slugify(candidat) == entree["id"]:
            nom = candidat

    enfants = list(racine.children)
    sources = extraire_sources(enfants)
    restriction = next(
        (clean_text(node) for node in enfants if est_encart_divinite(node)), None
    )
    utiles = [
        node
        for node in enfants
        if not (
            _is_tag(node, "script", "style")
            or est_encart_divinite(node)
            or est_logo_source(node)
        )
    ]

    champs, extra, reste = parse_statbloc(utiles)
    regions = decouper_regions(reste)
    ecole, descripteurs = separer_ecole(champs.get("ecole"))
    niveaux, rejets = parse_niveaux(champs.get("niveaux"))
    variantes, lies = parse_boxes(regions["boxes"])
    corps = _bloc_texte(regions["description"])

    autres: dict[str, str | None] = {}
    if restriction:
        autres["restriction_divinite"] = restriction
    for cle, valeur in extra.items():
        autres.setdefault(cle, valeur)
    for titre, noeuds in regions["sections"]:
        propre = texte(noeuds)
        if titre:
            autres.setdefault(f"section:{titre}", propre or None)
    if lies:
        autres.setdefault("sorts_lies", " ; ".join(lies))
    if rejets:
        autres.setdefault("niveaux_non_analyses", " ; ".join(rejets))

    doc = {
        "id": entree["id"],
        "nom": nom,
        "url": entree["url"],
        "ecole": ecole,
        "descripteurs": descripteurs,
        "niveaux": niveaux,
        "temps_incantation": champs.get("temps_incantation") or None,
        "composantes": champs.get("composantes") or None,
        "portee": champs.get("portee") or None,
        "cible": champs.get("cible") or None,
        "duree": champs.get("duree") or None,
        "jet_de_sauvegarde": champs.get("jet_de_sauvegarde") or None,
        "resistance_magie": champs.get("resistance_magie") or None,
        "description": corps["description"] if corps else "",
        "description_html": corps["description_html"] if corps else "",
        "mythique": _bloc_texte(regions["mythique"]),
        "variantes": variantes,
        "sources": sources,
        "autres": autres,
        "classes": [],
        "meta": {
            "url": entree["url"],
            "cache_fichier": entree["cache_fichier"],
            "recupere_le": entree.get("recupere_le"),
            "parser_version": parser_version,
        },
    }
    diagnostics = {
        "labels_inconnus": list(extra),
        "niveaux_rejetes": rejets,
        "sections_inconnues": [titre for titre, _ in regions["sections"]],
    }
    return {cle: doc[cle] for cle in KEY_ORDER}, diagnostics


def write_json(chemin: Path, doc: dict) -> None:
    """Write a pretty-printed UTF-8 JSON file with LF newlines, no BOM."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")


def charger_manifeste(chemin: Path) -> list[dict]:
    if not chemin.exists():
        raise SystemExit(f"{chemin} absent — l'étape 06 doit tourner d'abord")
    return [
        json.loads(ligne)
        for ligne in chemin.read_text(encoding="utf-8").splitlines()
        if ligne.strip()
    ]


def charger_dates_cache(chemin: Path) -> dict[str, str]:
    """Map url -> fetched_at from the fetch journal, for `meta.recupere_le`."""
    if not chemin.exists():
        return {}
    dates: dict[str, str] = {}
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if not ligne.strip():
            continue
        enregistrement = json.loads(ligne)
        if enregistrement.get("fetched_at"):
            dates[enregistrement["url"]] = enregistrement["fetched_at"]
    return dates


def _pourcentage(n: int, total: int) -> str:
    return f"{(100.0 * n / total):.2f} %" if total else "n/a"


def build_report(stats: dict) -> str:
    total = stats["total_ok"]
    lignes = [
        "# Rapport 07 — Analyse des pages de sorts",
        "",
        f"Parser : `pf_spells.parse_spells` v{parser_version} — aucun accès réseau.",
        "",
        "## Totaux",
        "",
        "| Mesure | Valeur |",
        "|---|---:|",
        f"| Lignes `data/spell_pages.jsonl` | {stats['total_lignes']} |",
        f"| Lignes `statut == \"ok\"` traitées | {total} |",
        f"| Lignes ignorées (statut ≠ ok) | {stats['ignorees']} |",
        f"| Fichiers écrits | {stats['ecrits']} |",
        f"| Fichiers préservés (déjà présents) | {stats['preserves']} |",
        f"| Échecs (aucun fichier écrit) | {len(stats['echecs'])} |",
        f"| Sorts avec bloc `mythique` | {stats['avec_mythique']} |",
        f"| Sorts avec `variantes` | {stats['avec_variantes']} "
        f"({stats['total_variantes']} variantes) |",
        f"| Sorts avec `autres` non vide | {stats['avec_autres']} |",
        "",
        "## Couverture par champ",
        "",
        "| Champ | Renseignés | Couverture |",
        "|---|---:|---:|",
    ]
    for champ in (*CHAMPS_STATBLOC, "description", "sources"):
        n = stats["couverture"][champ]
        lignes.append(f"| `{champ}` | {n} | {_pourcentage(n, total)} |")
    n40 = stats["description_40"]
    lignes += [
        f"| `description` ≥ 40 caractères | {n40} | {_pourcentage(n40, total)} |",
        "",
        "## Étiquettes inconnues (rangées dans `autres`, jamais perdues)",
        "",
    ]
    if stats["labels_inconnus"]:
        lignes += [
            "| Étiquette | Occurrences | Exemples |",
            "|---|---:|---|",
        ]
        for label, n in stats["labels_inconnus"].most_common():
            exemples = ", ".join(f"`{e}`" for e in stats["exemples_labels"][label][:3])
            court = label if len(label) <= 70 else label[:67] + "…"
            lignes.append(f"| {court} | {n} | {exemples} |")
    else:
        lignes.append("_Aucune._")

    lignes += ["", "## Abréviations de niveau non analysées", ""]
    if stats["niveaux_rejetes"]:
        lignes += ["| Fragment | Occurrences |", "|---|---:|"]
        for fragment, n in stats["niveaux_rejetes"].most_common():
            lignes.append(f"| `{fragment}` | {n} |")
    else:
        lignes.append("_Aucune._")

    lignes += ["", "## Abréviations de classe rencontrées", ""]
    lignes += ["| Abréviation | Sorts |", "|---|---:|"]
    for abbrev, n in stats["abbrevs"].most_common():
        lignes.append(f"| `{abbrev}` | {n} |")

    lignes += ["", "## Échecs", ""]
    if stats["echecs"]:
        lignes += ["| id | url | erreur |", "|---|---|---|"]
        for echec in stats["echecs"]:
            lignes.append(
                f"| `{echec['id']}` | {echec['url']} | {echec['erreur']} |"
            )
    else:
        lignes.append("_Aucun._")

    lignes += [
        "",
        "## Notes de conformité",
        "",
        "- Le champ `classes` vaut `[]` partout : il est rempli par l'étape 08.",
        "- Les blocs `Mythique` / `Version mythique` sont isolés dans `mythique` "
        "et n'apparaissent jamais dans `description`.",
        "- Les variantes (sections « Sorts qui « fonctionnent comme » X ») sont "
        "imbriquées dans `variantes` ; aucune ne reçoit de fichier propre écrit "
        "par cette étape.",
        "- Les blocs `div.box` qui reproduisent le sort de base (et non des "
        "variantes) ne sont pas recopiés : seuls leurs noms sont notés dans "
        "`autres[\"sorts_lies\"]`.",
        "- Les fichiers existants ne sont jamais réécrits sans `--overwrite` : "
        "les corrections humaines font foi.",
        "",
        "## Reproduire",
        "",
        "```",
        "PYTHONPATH=src python -m pf_spells.parse_spells",
        "```",
        "",
    ]
    return "\n".join(lignes)


def executer(
    limite: int | None,
    overwrite: bool,
    seulement: str | None,
    dossier: Path,
    rapport: Path | None,
) -> dict:
    entrees = charger_manifeste(MANIFEST_PATH)
    dates = charger_dates_cache(CACHE_INDEX_PATH)
    validateur = Draft202012Validator(
        json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    )

    ok = [e for e in entrees if e.get("statut") == "ok"]
    ignorees = len(entrees) - len(ok)
    if seulement:
        ok = [e for e in ok if e["id"] == seulement]
        if not ok:
            raise SystemExit(f"aucune entrée « ok » avec id={seulement!r}")
    if limite is not None:
        ok = ok[:limite]

    stats = {
        "total_lignes": len(entrees),
        "total_ok": len(ok),
        "ignorees": ignorees,
        "ecrits": 0,
        "preserves": 0,
        "echecs": [],
        "avec_mythique": 0,
        "avec_variantes": 0,
        "total_variantes": 0,
        "avec_autres": 0,
        "description_40": 0,
        "couverture": Counter(),
        "labels_inconnus": Counter(),
        "exemples_labels": {},
        "niveaux_rejetes": Counter(),
        "abbrevs": Counter(),
    }

    for entree in ok:
        entree = {**entree, "recupere_le": dates.get(entree["url"])}
        chemin = dossier / f"{entree['id']}.json"
        try:
            html = load_html(entree["cache_fichier"])
            doc, diagnostics = parse_page(html, entree)
            erreurs = sorted(
                validateur.iter_errors(doc), key=lambda e: list(e.absolute_path)
            )
            if erreurs:
                raise ValueError(
                    "schéma : "
                    + " | ".join(
                        f"{'/'.join(str(p) for p in e.absolute_path) or '<racine>'}: "
                        f"{e.message}"
                        for e in erreurs[:3]
                    )
                )
        except Exception as exc:  # noqa: BLE001 — every failure is reported, none raised
            stats["echecs"].append(
                {
                    "id": entree["id"],
                    "url": entree["url"],
                    "erreur": str(exc).replace("\n", " ")[:300],
                }
            )
            continue

        for champ in CHAMPS_STATBLOC:
            valeur = doc[champ]
            if valeur not in (None, "", {}, []):
                stats["couverture"][champ] += 1
        if doc["description"]:
            stats["couverture"]["description"] += 1
        if len(doc["description"]) >= 40:
            stats["description_40"] += 1
        if doc["sources"]:
            stats["couverture"]["sources"] += 1
        if doc["mythique"]:
            stats["avec_mythique"] += 1
        if doc["variantes"]:
            stats["avec_variantes"] += 1
            stats["total_variantes"] += len(doc["variantes"])
        if doc["autres"]:
            stats["avec_autres"] += 1
        for abbrev in doc["niveaux"]:
            stats["abbrevs"][abbrev] += 1
        for label in diagnostics["labels_inconnus"]:
            cle = normalize_label(label)
            stats["labels_inconnus"][cle] += 1
            stats["exemples_labels"].setdefault(cle, []).append(doc["id"])
        for fragment in diagnostics["niveaux_rejetes"]:
            stats["niveaux_rejetes"][fragment] += 1

        if chemin.exists() and not overwrite:
            stats["preserves"] += 1
            continue
        write_json(chemin, doc)
        stats["ecrits"] += 1

    if rapport is not None:
        rapport.parent.mkdir(parents=True, exist_ok=True)
        rapport.write_text(build_report(stats), encoding="utf-8", newline="\n")
    return stats


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Analyse les pages de sorts en cache vers data/sorts/<id>.json."
    )
    parseur.add_argument("--limit", type=int, default=None, help="ne traiter que N sorts")
    parseur.add_argument(
        "--overwrite",
        action="store_true",
        help="réécrire les fichiers existants (désactivé par défaut : "
        "les corrections humaines font foi)",
    )
    parseur.add_argument("--only", default=None, help="ne traiter qu'un id de sort")
    parseur.add_argument(
        "--out-dir", default=str(SORTS_DIR), help="dossier de sortie des JSON"
    )
    parseur.add_argument(
        "--no-report", action="store_true", help="ne pas écrire le rapport"
    )
    args = parseur.parse_args(argv)

    stats = executer(
        limite=args.limit,
        overwrite=args.overwrite,
        seulement=args.only,
        dossier=Path(args.out_dir),
        rapport=None if args.no_report else REPORT_PATH,
    )
    print(
        f"{stats['total_ok']} sorts traités : {stats['ecrits']} écrits, "
        f"{stats['preserves']} préservés, {len(stats['echecs'])} échecs"
    )
    for echec in stats["echecs"][:10]:
        print(f"  échec {echec['id']}: {echec['erreur']}")
    return 1 if stats["echecs"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
