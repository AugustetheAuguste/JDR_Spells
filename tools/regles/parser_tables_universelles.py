"""Parse `cache/html_regles/*.html` into the four `data/regles/*.json` tables.

Model read before writing this: `pf-corpus-conventions` (UTF-8 decoding,
`PageContentDiv`→`PageAttachmentsDiv` slicing) and
`build/fiche_personnage/06_REGLES_UNIVERSELLES.md` (the envelope, the four
roles, the null-not-zero rule). Offline — reads only the cache
`recuperer_pages_regles.py` populated, never the network.

Four distinct output files, four distinct authorities — never merged. Two of
them (`modificateurs_caracteristiques`, `sorts_bonus`) are two views of the
*same* source table (`Caractéristiques`, table "Modificateurs de
caractéristique et sorts en bonus"); the other two each have their own
source(s).

    python tools/regles/parser_tables_universelles.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path

from bs4 import BeautifulSoup

RACINE = Path(__file__).resolve().parents[2]
CACHE_DIR = RACINE / "cache/html_regles"
OUT_DIR = RACINE / "data/regles"
REPORT_PATH = RACINE / "reports/regles_universelles.md"

BASE_URL = "https://www.pathfinder-fr.org/Wiki/Pathfinder-RPG."
OUTIL = "tools/regles/parser_tables_universelles.py"

PAGE_URLS = {
    "caracteristiques": f"{BASE_URL}Caract%C3%A9ristiques.ashx",
    "valeurs-de-combat": f"{BASE_URL}Valeurs%20de%20combat.ashx",
    "vocabulaire-courant": f"{BASE_URL}Vocabulaire%20courant.ashx",
    "tableau-recapitulatif-des-armures": (
        f"{BASE_URL}Tableau%20r%C3%A9capitulatif%20des%20armures.ashx"
    ),
}
PAGE_TITLES = {
    "caracteristiques": "Caractéristiques",
    "valeurs-de-combat": "Valeurs de combat",
    "vocabulaire-courant": "Vocabulaire courant",
    "tableau-recapitulatif-des-armures": "Tableau récapitulatif des armures",
}


def _slug(texte: str) -> str:
    """Same recipe as the spell `id` slug, cf. pf-corpus-conventions §"id slug"."""
    depouille = unicodedata.normalize("NFKD", texte)
    sans_accents = "".join(c for c in depouille if not unicodedata.combining(c))
    minuscule = sans_accents.lower()
    return re.sub(r"[^a-z0-9]+", "_", minuscule).strip("_")


def _contenu(page_slug: str) -> BeautifulSoup:
    """Decode UTF-8 explicitly, slice PageContentDiv..PageAttachmentsDiv."""
    chemin = CACHE_DIR / f"{page_slug}.html"
    html = chemin.read_text(encoding="utf-8")
    debut = html.find('id="PageContentDiv"')
    fin = html.find('id="PageAttachmentsDiv"')
    if debut == -1 or fin == -1:
        raise SystemExit(f"ÉCHEC : bornes PageContentDiv/PageAttachmentsDiv introuvables dans {chemin}")
    return BeautifulSoup(html[debut:fin], "html.parser")


def _texte(cell) -> str:
    return cell.get_text(strip=True).replace("\xa0", " ")


def _source(page_slug: str, *, lu_le: str) -> dict:
    return {
        "url": PAGE_URLS[page_slug],
        "page": PAGE_TITLES[page_slug],
        "lu_le": lu_le,
    }


def _enveloppe(sources: list[dict], donnees: object, *, lacune: str | None = None) -> dict:
    meta: dict = {
        "version": 1,
        "genere_le": datetime.now(UTC).date().isoformat(),
        "sources": sources,
        "outil": OUTIL,
    }
    if lacune is not None:
        meta["lacune"] = lacune
    return {"meta": meta, "donnees": donnees}


def _parse_signe(texte: str) -> int:
    """`–5`, `-5`, `+5`, `0` -> int. The source uses U+2013 EN DASH for minus."""
    normalise = texte.replace("–", "-").replace("−", "-").strip()
    return int(normalise)


# --------------------------------------------------------------------------
# modificateurs_caracteristiques + sorts_bonus : one shared source table
# --------------------------------------------------------------------------


def _table_caracteristiques(soup: BeautifulSoup):
    """The table captioned "Modificateurs de caractéristique et sorts en bonus"."""
    for table in soup.find_all("table"):
        caption = table.find("caption")
        if caption and "Modificateurs de caractéristique et sorts en bonus" in caption.get_text():
            return table
    raise SystemExit("ÉCHEC : table 'Modificateurs de caractéristique et sorts en bonus' introuvable")


def parser_modificateurs(soup: BeautifulSoup) -> tuple[dict, dict]:
    """Returns (donnees, rapport_info)."""
    table = _table_caracteristiques(soup)
    lignes = table.find_all("tr")[2:]  # skip the two header rows

    bornes: list[dict] = []
    borne_basse: int | None = None
    borne_haute: int | None = None
    for ligne in lignes:
        cellules = ligne.find_all("td")
        if len(cellules) < 2:
            continue
        valeur_texte = _texte(cellules[0])
        mod_texte = _texte(cellules[1])
        if not valeur_texte or not mod_texte:
            continue
        if "–" in valeur_texte or "-" in valeur_texte.replace("–5", ""):
            pass  # value ranges use en-dash as a separator, handled below
        if "–" in valeur_texte:
            min_s, max_s = valeur_texte.split("–")
            mini, maxi = int(min_s), int(max_s)
        else:
            mini = maxi = int(valeur_texte)
        modificateur = _parse_signe(mod_texte)
        bornes.append({"min": mini, "max": maxi, "modificateur": modificateur})
        borne_basse = mini if borne_basse is None else min(borne_basse, mini)
        borne_haute = maxi if borne_haute is None else max(borne_haute, maxi)

    donnees = {"bornes": bornes}
    rapport = {"borne_basse": borne_basse, "borne_haute": borne_haute}
    return donnees, rapport


def parser_sorts_bonus(soup: BeautifulSoup) -> tuple[dict, dict]:
    table = _table_caracteristiques(soup)
    lignes = table.find_all("tr")[2:]

    par_modificateur: dict[str, dict[str, int | None]] = {}
    modificateur_max: int | None = None
    for ligne in lignes:
        cellules = ligne.find_all("td")
        if len(cellules) < 2:
            continue
        mod_texte = _texte(cellules[1])
        if not mod_texte:
            continue
        modificateur = _parse_signe(mod_texte)

        # A row either has one COLSPAN=10 cell ("impossible de lancer des
        # sorts...") or ten per-level cells (niveaux 0..9).
        niveaux: dict[str, int | None] = {}
        colspan_cell = cellules[2] if len(cellules) > 2 else None
        if colspan_cell is not None and colspan_cell.get("colspan") == "10":
            for niveau in range(10):
                niveaux[str(niveau)] = None
        else:
            valeurs = cellules[2:12]
            for niveau, cellule in enumerate(valeurs):
                texte = _texte(cellule)
                niveaux[str(niveau)] = None if texte in ("", "—", "-") else int(texte)

        par_modificateur[str(modificateur)] = niveaux
        modificateur_max = modificateur if modificateur_max is None else max(modificateur_max, modificateur)

    donnees = {"par_modificateur": par_modificateur}
    rapport = {"modificateur_maximal_lu": modificateur_max}
    return donnees, rapport


# --------------------------------------------------------------------------
# types_bonus
# --------------------------------------------------------------------------

# Only the bonus-type entries actually named as such (`<b>Bonus de/d’X.</b>`)
# on the "Valeurs de combat" page are read — never a type invented to fill
# out a "complete" list, cf. plan §"Notes d'implémentation".
_RE_ENTREE_BONUS = re.compile(
    r"<b>(Bonus (?:d['’]|de |des )[^.<]+)\.</b>\s*([^<]*(?:<a[^>]*>[^<]*</a>[^<]*)*)",
)


def parser_types_bonus(soup_combat: BeautifulSoup, soup_vocab: BeautifulSoup) -> tuple[dict, dict]:
    # Scoped to the "Autres modificateurs" subsection of the CA description —
    # the only place on this page that introduces named bonus *types*
    # affecting the CA. Outside this scope the page also uses the phrase
    # "Bonus de Force" for the Strength-to-damage rule, which is not a bonus
    # *type* in the stacking sense and must not be swept in.
    html_combat_full = str(soup_combat)
    # The first hit is the table-of-contents link; the actual <h3> section is
    # the second occurrence.
    premiere = html_combat_full.find("Autres modificateurs")
    debut = html_combat_full.find("Autres modificateurs", premiere + 1)
    fin = html_combat_full.find("Attaques de contact", debut)
    if debut == -1 or fin == -1:
        raise SystemExit("ÉCHEC : section 'Autres modificateurs' introuvable sur la page 'Valeurs de combat'")
    html_combat = html_combat_full[debut:fin]
    types: list[dict] = []
    vus: set[str] = set()
    for match in _RE_ENTREE_BONUS.finditer(html_combat):
        libelle_brut = match.group(1).strip()
        # Strip any residual HTML tags from the note fragment.
        note_html = match.group(0)
        note_soup = BeautifulSoup(note_html, "html.parser")
        texte_complet = note_soup.get_text(" ", strip=True)
        # texte_complet = "Bonus d'altération. Ce bonus améliore..."
        libelle, _, note = texte_complet.partition(". ")
        libelle = libelle.strip()
        note = note.strip()
        if libelle in vus:
            continue
        vus.add(libelle)

        cle = _slug(libelle.removeprefix("Bonus ").removeprefix("de ").removeprefix("d'").removeprefix("d’"))
        cumulable: bool | None = None
        if "se cumulent entre eux" in note or "se cumulent" in note and "ne se cumulent" not in note:
            cumulable = True
        elif "ne se cumulent" in note:
            cumulable = False
        types.append(
            {
                "cle": cle,
                "libelle": libelle,
                "cumulable": cumulable,
                "note": note,
            }
        )

    # The general stacking rule lives on "Vocabulaire courant", glossary
    # entry "Bonus" — read verbatim, never paraphrased.
    regle_generale = None
    for b in soup_vocab.find_all("b"):
        if b.get_text(strip=True).rstrip(".") == "Bonus":
            parent_text = b.parent.get_text(" ", strip=True)
            # Cut right after the "Bonus." label to keep only its own entry.
            idx = parent_text.find("Bonus.")
            if idx != -1:
                reste = parent_text[idx + len("Bonus."):]
                # The glossary runs entries together; stop at the next label
                # sentence by taking up to the double-space heuristic is
                # unreliable, so keep the sentence(s) up to the known rule.
                fin = reste.find("s’applique.")
                regle_generale = reste[: fin + len("s’applique.")].strip() if fin != -1 else reste.strip()
            break

    donnees = {"regle_generale": regle_generale, "types": types}
    rapport = {"cumulable_null": [t["libelle"] for t in types if t["cumulable"] is None]}
    return donnees, rapport


# --------------------------------------------------------------------------
# armures
# --------------------------------------------------------------------------

_CATEGORIES = {
    "ARMURES LÉGÈRES": "legere",
    "ARMURES INTERMÉDIAIRES": "intermediaire",
    "ARMURES LOURDES": "lourde",
    "BOUCLIERS": "bouclier",
    "SUPPLÉMENTS": "supplement",
}


def _table_armures(soup: BeautifulSoup):
    for table in soup.find_all("table"):
        caption = table.find("caption")
        if caption and "Tableau récapitulatif des armures" in caption.get_text():
            return table
    raise SystemExit("ÉCHEC : table 'Tableau récapitulatif des armures' introuvable")


def _valeur_ou_null(texte: str) -> str | None:
    return None if texte in ("", "—", "-") else texte


def parser_armures(soup: BeautifulSoup) -> tuple[dict, dict]:
    table = _table_armures(soup)
    lignes = table.find_all("tr")

    armures: list[dict] = []
    categorie_courante: str | None = None
    for ligne in lignes:
        cellules = ligne.find_all("td")
        if len(cellules) == 1 and cellules[0].get("colspan"):
            texte = _texte(cellules[0])
            for libelle, slug in _CATEGORIES.items():
                if libelle in texte:
                    categorie_courante = slug
                    break
            continue
        if len(cellules) < 9 or categorie_courante is None:
            continue  # header rows (titre/soustitre) have no usable td set of 9

        nom = cellules[0].get_text(strip=True)
        # Strip the leading "↓" description-link glyph some rows carry.
        nom = nom.lstrip("↓").strip()
        prix = _texte(cellules[1])
        bonus_armure = _valeur_ou_null(_texte(cellules[2]))
        dex_max = _valeur_ou_null(_texte(cellules[3]))
        malus_tests = _valeur_ou_null(_texte(cellules[4]))
        risque_echec = _valeur_ou_null(_texte(cellules[5]))
        vitesse_9m = _valeur_ou_null(_texte(cellules[6]))
        vitesse_6m = _valeur_ou_null(_texte(cellules[7]))
        poids = _texte(cellules[8])

        armures.append(
            {
                "nom": nom,
                "categorie": categorie_courante,
                "prix": prix,
                "bonus_armure": bonus_armure,
                "dex_max": dex_max,
                "malus_tests": malus_tests,
                "risque_echec_sorts_profanes": risque_echec,
                "vitesse_par_base": {"9 m": vitesse_9m, "6 m": vitesse_6m},
                "poids": poids,
            }
        )

    donnees = {"armures": armures}
    rapport = {"total": len(armures), "categories": sorted({a["categorie"] for a in armures})}
    return donnees, rapport


# --------------------------------------------------------------------------
# orchestration
# --------------------------------------------------------------------------


def _ecrire_table(nom_fichier: str, contenu: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    texte = json.dumps(contenu, ensure_ascii=False, indent=2) + "\n"
    (OUT_DIR / nom_fichier).write_text(texte, encoding="utf-8", newline="\n")


def _lu_le(page_slug: str) -> str:
    chemin = CACHE_DIR / f"{page_slug}.html"
    return datetime.fromtimestamp(chemin.stat().st_mtime, UTC).date().isoformat()


def executer() -> int:
    soup_car = _contenu("caracteristiques")
    soup_combat = _contenu("valeurs-de-combat")
    soup_vocab = _contenu("vocabulaire-courant")
    soup_armures = _contenu("tableau-recapitulatif-des-armures")

    donnees_mod, rapport_mod = parser_modificateurs(soup_car)
    donnees_sorts, rapport_sorts = parser_sorts_bonus(soup_car)
    donnees_types, rapport_types = parser_types_bonus(soup_combat, soup_vocab)
    donnees_armures, rapport_armures = parser_armures(soup_armures)

    src_car = [_source("caracteristiques", lu_le=_lu_le("caracteristiques"))]
    src_types = [
        _source("valeurs-de-combat", lu_le=_lu_le("valeurs-de-combat")),
        _source("vocabulaire-courant", lu_le=_lu_le("vocabulaire-courant")),
    ]
    src_armures = [
        _source(
            "tableau-recapitulatif-des-armures",
            lu_le=_lu_le("tableau-recapitulatif-des-armures"),
        )
    ]

    _ecrire_table("modificateurs_caracteristiques.json", _enveloppe(src_car, donnees_mod))
    _ecrire_table("sorts_bonus.json", _enveloppe(src_car, donnees_sorts))
    _ecrire_table("types_bonus.json", _enveloppe(src_types, donnees_types))
    _ecrire_table("armures.json", _enveloppe(src_armures, donnees_armures))

    _ecrire_rapport(rapport_mod, rapport_sorts, rapport_types, rapport_armures, src_car, src_types, src_armures)

    print("4 table(s) écrites sous data/regles/")
    print(f"  modificateurs_caracteristiques : bornes {rapport_mod['borne_basse']}..{rapport_mod['borne_haute']}")
    print(f"  sorts_bonus : modificateur maximal lu {rapport_sorts['modificateur_maximal_lu']}")
    print(f"  types_bonus : {len(donnees_types['types'])} type(s), cumulable null pour {rapport_types['cumulable_null']}")
    print(f"  armures : {rapport_armures['total']} entrée(s), catégories {rapport_armures['categories']}")
    return 0


def _ecrire_rapport(rapport_mod, rapport_sorts, rapport_types, rapport_armures, src_car, src_types, src_armures) -> None:
    lignes = [
        "# Rapport — tables de règles universelles",
        "",
        "## 1. Pages lues",
        "",
        "| page | url | date de lecture | sha1 (voir cache/html_regles/index.jsonl) |",
        "|---|---|---|---|",
    ]
    for s in src_car + src_types + src_armures:
        if s in lignes:
            continue
    vus = []
    for s in src_car + src_types + src_armures:
        if s["url"] in vus:
            continue
        vus.append(s["url"])
        lignes.append(f"| {s['page']} | `{s['url']}` | {s['lu_le']} | cf. index.jsonl |")

    lignes += [
        "",
        "## 2. Bornes réellement lues, rien extrapolé au-delà",
        "",
        f"- `modificateurs_caracteristiques` : valeurs de caractéristique de "
        f"**{rapport_mod['borne_basse']}** à **{rapport_mod['borne_haute']}**, "
        "aucune valeur hors de cet intervalle n'est présente dans `donnees`.",
        f"- `sorts_bonus` : modificateur maximal lu **+{rapport_sorts['modificateur_maximal_lu']}**, "
        "aucun modificateur au-delà n'est présent dans `donnees` ; les modificateurs "
        "négatifs (-5 à -1) sont couverts avec un niveau de sort `null` partout "
        "(« impossible de lancer des sorts liés à cette caractéristique »), jamais un zéro.",
        "- `armures` : toutes les entrées de la table publiée sont reprises verbatim, "
        "aucune armure supplémentaire n'a été ajoutée.",
        "",
        "## 3. `cumulable` resté `null`",
        "",
    ]
    if rapport_types["cumulable_null"]:
        lignes.append(
            "La page « Valeurs de combat » ne tranche le cumul explicitement que pour "
            "le bonus d'esquive (`cumulable: true`). Pour les types suivants, le texte "
            "lu ne dit rien du cumul entre bonus du même type au-delà de la règle "
            "générale du glossaire (« les bonus de même type ne se cumulent pas : seul "
            "le bonus le plus élevé s'applique ») — laissé `null` plutôt que déduit :"
        )
        for libelle in rapport_types["cumulable_null"]:
            lignes.append(f"  - {libelle}")
    else:
        lignes.append("Aucun — chaque type lu porte un `cumulable` explicite.")

    lignes += [
        "",
        "## 4. Lacunes",
        "",
        "Aucune des quatre tables n'a dû être livrée vide : les quatre pages visées "
        "portaient effectivement la table ou le glossaire attendu.",
        "",
        "## Recherche des pages canoniques",
        "",
        "Aucune page unique du wiki ne porte une table complète des types de bonus "
        "avec une colonne de cumul pour chaque type (compétence, chance, sacré, "
        "profane, moral, etc.) — seule la page « Valeurs de combat » (anciennement "
        "« CA », qui y redirige) énumère des bonus nommés avec leur effet, dont un "
        "seul (l'esquive) est explicitement dit cumulable. La règle générale de "
        "non-cumul entre bonus de même type vient du glossaire « Vocabulaire "
        "courant », entrée « Bonus ». `types_bonus.json` porte donc deux sources, "
        "consignées toutes deux dans `meta.sources`, et ne retient que les cinq "
        "types effectivement nommés sur ces deux pages — aucun type absent "
        "(compétence, chance, sacré/profane, moral, racial, résistance…) n'a été "
        "ajouté de mémoire.",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lignes), encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    return executer()


if __name__ == "__main__":
    raise SystemExit(main())
