"""Export the corpus into the two build artefacts the web app consumes.

This is the only seam between the Python pipeline and the site, and it runs
offline: it reads `data/` and writes `web/public/data/`, never the reverse.

Two artefacts, because they have opposite access patterns:

  - `index.json` is loaded once by every visitor, so it is coded to integers via
    head tables and carries only what search, filters and a table row need. No
    descriptions (B1).
  - `sorts/<slug>.json` is read for one spell at a time, so it stays rich and
    verbatim: the 21 scraped keys untouched, plus the derived box.

Determinism is a hard requirement, not a nicety: step 10 re-runs this exporter in
CI and fails if the output differs from what is committed, which is what catches
a corpus corrected without a re-export. Everything is therefore sorted, and
`genere_le` is the single field allowed to vary between two runs.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pf_spells.web_pliage import (
    extraire_composantes,
    normaliser_ecole,
    normaliser_jet,
    normaliser_portee,
    normaliser_resistance,
    normaliser_temps_incantation,
    plier,
)

# Bumped for `temps_incantation`/`ti`: a new required field is an incompatible
# shape change, not a data update (§2 of the contract's own preamble).
VERSION_CONTRAT = 2

DEFAULT_RACINE = "."
DEFAULT_SORTIE = "web/public/data"

CHEMIN_INDEX_CORPUS = Path("data") / "index" / "sorts_uniques.jsonl"
CHEMIN_CLASSES = Path("data") / "classes.json"
DOSSIER_SORTS = Path("data") / "sorts"
DOSSIER_LISTES = Path("data") / "listes_classes"
DOSSIER_ENRICHISSEMENTS = Path("data") / "enrichissements"

# The 21 scraped keys are copied through verbatim, in canonical order, so a human
# comparing a props file to `data/sorts/<id>.json` sees the same shape. `id` leads
# because it is the join key.
CLES_SORT = (
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
    "classes",
    "meta",
)

_REMPLACEMENT = chr(0xFFFD)


class ExportWebError(RuntimeError):
    """A blocking export defect. Nothing is written when one is raised."""


def _lire_json(chemin: Path) -> Any:
    """Decode UTF-8 explicitly; a U+FFFD anywhere is corruption, never content."""
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise ExportWebError(
            f"U+FFFD dans {chemin.as_posix()} : corruption d'encodage, pas une donnée"
        )
    return json.loads(texte)


def serialiser(document: Any) -> str:
    """Pretty on-disk text for a human-readable artefact: indent 2, LF, final NL."""
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def serialiser_compact(document: Any) -> str:
    """Compact text for `index.json`, which is shipped over the wire, not read.

    `sort_keys` is on: this artefact's key order carries no meaning, and a stable
    order is what makes the byte-for-byte drift check of step 10 possible.
    """
    return (
        json.dumps(
            document, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        + "\n"
    )


def ecrire(texte: str, chemin: Path) -> None:
    """Write UTF-8, no BOM, LF — on win32 too."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, encoding="utf-8", newline="\n")


def lancer_preflight(racine: Path) -> None:
    """Entry guard, loaded by path — `tools/` is deliberately not a package."""
    import importlib.util

    chemin = racine / "tools" / "preflight_corpus.py"
    if not chemin.is_file():
        raise ExportWebError(f"garde d'entrée introuvable : {chemin.as_posix()}")
    spec = importlib.util.spec_from_file_location("preflight_corpus", chemin)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise ExportWebError(f"garde d'entrée non chargeable : {chemin.as_posix()}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["preflight_corpus"] = module
    spec.loader.exec_module(module)
    rapport = module.preflight(racine)
    if rapport.bloquantes:
        details = "\n".join(f"  - {c.id} : {c.detail}" for c in rapport.bloquantes)
        raise ExportWebError(f"préflight bloquant, export refusé :\n{details}")


def lire_index_corpus(racine: Path) -> list[dict[str, Any]]:
    """The authoritative list of unique spells, sorted by id for determinism."""
    chemin = racine / CHEMIN_INDEX_CORPUS
    if not chemin.is_file():
        raise ExportWebError(f"index du corpus absent : {chemin.as_posix()}")
    entrees: list[dict[str, Any]] = []
    with chemin.open(encoding="utf-8") as flux:
        for ligne in flux:
            ligne = ligne.strip()
            if ligne:
                entrees.append(json.loads(ligne))
    if not entrees:
        raise ExportWebError(f"index du corpus vide : {chemin.as_posix()}")
    return sorted(entrees, key=lambda e: e["id"])


def lire_niveaux_par_classe(racine: Path) -> dict[str, dict[str, int]]:
    """Build id -> {class slug: level} from the class lists.

    The class list is the authority on *which* class grants a spell at *what*
    level; the spell page is cross-checked against it at step 08. Reading the
    lists here rather than the spell's own `niveaux` keeps the site's level model
    anchored to the same source the audit used.
    """
    dossier = racine / DOSSIER_LISTES
    if not dossier.is_dir():
        raise ExportWebError(f"listes de classes absentes : {dossier.as_posix()}")
    niveaux: dict[str, dict[str, int]] = {}
    for chemin in sorted(dossier.glob("*.jsonl")):
        slug_classe = chemin.stem
        with chemin.open(encoding="utf-8") as flux:
            for ligne in flux:
                ligne = ligne.strip()
                if not ligne:
                    continue
                entree = json.loads(ligne)
                niveau = entree.get("niveau")
                if niveau is None:
                    continue
                # A spell can appear twice in one class list; the lowest level wins,
                # because that is the level at which the class actually gains it.
                par_classe = niveaux.setdefault(entree["id"], {})
                precedent = par_classe.get(slug_classe)
                if precedent is None or niveau < precedent:
                    par_classe[slug_classe] = niveau
    return niveaux


def _table_de_codes(valeurs: set[str]) -> tuple[list[str], dict[str, int]]:
    """Sort the collected values, then index them. Sorted = deterministic codes."""
    table = sorted(valeurs)
    return table, {valeur: code for code, valeur in enumerate(table)}


def desaccords_de(sort: dict[str, Any]) -> list[dict[str, Any]]:
    """The per-class level disagreements the corpus recorded, in detail.

    `concordance is False` means the class list and the spell page each named a
    level and the two differed. `None` means the pair was not comparable (the page
    gave no level for that class) — that is a gap, not a disagreement, and
    conflating the two would invent an audit finding.

    On the corpus as committed this returns [] for all 2070 spells: 8409 of 8409
    comparable pairs concord. The feature is still built and rendered, because it
    is the probe that makes the first real divergence visible.
    """
    ecarts = []
    for classe in sort.get("classes") or []:
        if classe.get("concordance") is False:
            ecarts.append(
                {
                    "classe": classe.get("classe"),
                    "slug": classe.get("slug"),
                    "niveau_liste": classe.get("niveau"),
                    "niveau_page": classe.get("niveau_page"),
                }
            )
    return sorted(ecarts, key=lambda e: (e["slug"] or ""))


def construire(
    racine: Path,
    sortie: Path,
    *,
    avec_preflight: bool = True,
    genere_le: str | None = None,
) -> dict[str, Any]:
    """Write both artefacts and return a report. Raises before writing on defect."""
    if avec_preflight:
        lancer_preflight(racine)

    index_corpus = lire_index_corpus(racine)
    niveaux_listes = lire_niveaux_par_classe(racine)
    roster = _lire_json(racine / CHEMIN_CLASSES)
    noms_de_classe = {c["slug"]: c["classe"] for c in roster}

    dossier_enr = racine / DOSSIER_ENRICHISSEMENTS
    # The LLM layer is strictly optional: absent, `tags` stays empty, every `t` is
    # [], and the UI hides the tag filter rather than showing an empty section.
    couche_enrichissement = dossier_enr.is_dir()

    # Pass one: read every spell, collect facet values, stage the entries. The code
    # tables cannot be assigned until all values are known and sorted.
    stagiaires: list[dict[str, Any]] = []
    ecoles: set[str] = set()
    portees: set[str] = set()
    jets: set[str] = set()
    composantes: set[str] = set()
    tags: set[str] = set()
    temps: set[str] = set()
    classes_vues: set[str] = set()
    nb_desaccords = 0
    nb_enrichis = 0

    for entree_index in index_corpus:
        id_sort = entree_index["id"]
        chemin_sort = racine / DOSSIER_SORTS / f"{id_sort}.json"
        if not chemin_sort.is_file():
            raise ExportWebError(
                f"sort de l'index absent du disque : {chemin_sort.as_posix()}"
            )
        sort = _lire_json(chemin_sort)

        enrichissement: dict[str, Any] | None = None
        if couche_enrichissement:
            chemin_enr = dossier_enr / f"{id_sort}.json"
            if chemin_enr.is_file():
                enrichissement = _lire_json(chemin_enr)
                nb_enrichis += 1

        ecole = normaliser_ecole(sort["ecole"])
        portee = normaliser_portee(sort["portee"])
        jet = normaliser_jet(sort["jet_de_sauvegarde"])
        sigles = extraire_composantes(sort["composantes"])
        resistance = normaliser_resistance(sort["resistance_magie"])
        temps_incantation = normaliser_temps_incantation(sort["temps_incantation"])

        # The class lists are the authority. A spell in the index with no list entry
        # would have an empty `niv`, which the contract forbids (minProperties 1) —
        # so it is a hard error, not a spell rendered with no level.
        niveaux = niveaux_listes.get(id_sort, {})
        if not niveaux:
            raise ExportWebError(
                f"{id_sort} : aucun niveau de classe — l'index et les listes de "
                "classes divergent"
            )

        ecarts = desaccords_de(sort)
        if ecarts:
            nb_desaccords += 1

        if ecole is not None:
            ecoles.add(ecole)
        if portee is not None:
            portees.add(portee)
        if jet is not None:
            jets.add(jet)
        if temps_incantation is not None:
            temps.add(temps_incantation)
        composantes.update(sigles)
        classes_vues.update(niveaux)
        etiquettes = sorted(enrichissement.get("tags") or []) if enrichissement else []
        tags.update(etiquettes)

        stagiaires.append(
            {
                "sort": sort,
                "id": id_sort,
                # The slug *is* the URL, and it is the corpus id — no second mapping.
                "slug": id_sort,
                "ecole": ecole,
                "portee": portee,
                "jet": jet,
                "sigles": sigles,
                "resistance": resistance,
                "temps_incantation": temps_incantation,
                "niveaux": niveaux,
                "ecarts": ecarts,
                "enrichissement": enrichissement,
                "etiquettes": etiquettes,
            }
        )

    table_ecoles, code_ecole = _table_de_codes(ecoles)
    table_portees, code_portee = _table_de_codes(portees)
    table_jets, code_jet = _table_de_codes(jets)
    table_composantes, code_composante = _table_de_codes(composantes)
    table_tags, code_tag = _table_de_codes(tags)
    table_temps, code_temps = _table_de_codes(temps)

    # Only classes that actually grant a spell are listed: a filter offering a class
    # with no spells is a dead end. Sorted by slug for determinism.
    classes = [
        {"slug": slug, "nom": noms_de_classe.get(slug, slug)}
        for slug in sorted(classes_vues)
    ]

    # Pass two: encode entries and write the per-spell props as we go, keeping only
    # the index in memory.
    entrees: list[dict[str, Any]] = []
    dossier_props = sortie / "sorts"
    for i, stagiaire in enumerate(stagiaires):
        sort = stagiaire["sort"]
        entrees.append(
            {
                "i": i,
                "id": stagiaire["id"],
                "s": stagiaire["slug"],
                "n": sort["nom"],
                "nf": plier(sort["nom"]),
                "e": code_ecole.get(stagiaire["ecole"])
                if stagiaire["ecole"] is not None
                else None,
                "niv": stagiaire["niveaux"],
                "c": sorted(code_composante[s] for s in stagiaire["sigles"]),
                "p": code_portee.get(stagiaire["portee"])
                if stagiaire["portee"] is not None
                else None,
                "j": code_jet.get(stagiaire["jet"])
                if stagiaire["jet"] is not None
                else None,
                "rm": stagiaire["resistance"],
                "t": sorted(code_tag[t] for t in stagiaire["etiquettes"]),
                "ti": code_temps.get(stagiaire["temps_incantation"])
                if stagiaire["temps_incantation"] is not None
                else None,
                "d": bool(stagiaire["ecarts"]),
            }
        )

        props: dict[str, Any] = {cle: sort.get(cle) for cle in CLES_SORT}
        props["slug"] = stagiaire["slug"]
        # The link back to the wiki is a commitment (B8), so it is a first-class
        # field of every props file rather than something the page recomputes.
        props["url_source"] = sort["url"]
        props["niveaux_par_classe"] = {
            slug: {"nom": noms_de_classe.get(slug, slug), "niveau": niveau}
            for slug, niveau in sorted(stagiaire["niveaux"].items())
        }
        props["desaccords"] = stagiaire["ecarts"]
        props["enrichissement"] = stagiaire["enrichissement"]
        ecrire(serialiser(props), dossier_props / f"{stagiaire['slug']}.json")

    index = {
        "version": VERSION_CONTRAT,
        "genere_le": genere_le
        or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ecoles": table_ecoles,
        "classes": classes,
        "portees": table_portees,
        "jets": table_jets,
        "composantes": table_composantes,
        "tags": table_tags,
        "temps_incantation": table_temps,
        "sorts": entrees,
    }
    texte_index = serialiser_compact(index)
    chemin_index = sortie / "index.json"
    ecrire(texte_index, chemin_index)

    octets = texte_index.encode("utf-8")
    # mtime=0 so the gzip header carries no timestamp: the size is reported, and a
    # reported number that moves when nothing changed is a number nobody trusts.
    # Reported only — there is no weight ceiling in this repository, by decision:
    # performance is explicitly secondary here, and an export that fails on a size
    # nobody intends to defend blocks work for a reason its author does not hold.
    taille_gzip = len(gzip.compress(octets, mtime=0))

    return {
        "nb_sorts": len(entrees),
        "nb_classes": len(classes),
        "nb_desaccords": nb_desaccords,
        "nb_enrichis": nb_enrichis,
        "couche_enrichissement": couche_enrichissement,
        "nb_ecoles": len(table_ecoles),
        "nb_tags": len(table_tags),
        "nb_temps_incantation": len(table_temps),
        "taille_index_octets": len(octets),
        "taille_index_gzip": taille_gzip,
        "chemin_index": chemin_index.as_posix(),
        "chemin_props": dossier_props.as_posix(),
    }


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Exporte le corpus vers les artefacts de build du site web."
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE, help="racine du dépôt")
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE, help="dossier de sortie")
    parseur.add_argument(
        "--sans-preflight",
        action="store_true",
        help="sauter la garde d'entrée (tests sur corpus miniature uniquement)",
    )
    parseur.add_argument(
        "--genere-le",
        default=None,
        help="horodatage figé, pour un export reproductible à l'octet",
    )
    args = parseur.parse_args(argv)

    try:
        rapport = construire(
            Path(args.racine),
            Path(args.sortie),
            avec_preflight=not args.sans_preflight,
            genere_le=args.genere_le,
        )
    except ExportWebError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    print(serialiser(rapport), end="")
    return 0


if __name__ == "__main__":  # pragma: no cover - entry point
    raise SystemExit(main())
