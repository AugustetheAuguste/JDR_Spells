"""Exporte le catalogue de dons vers les artefacts web (une fois pour tout le
catalogue, jamais pour un personnage précis).

Produit, sous ``web/public/data/dons/`` :

  - ``index.json``    — index de facettes, contrat de l'étape 05.
  - ``moteur.json``    — conditions analysées + gating + graphe, contrat de
    l'étape 06.
  - ``<slug>.json``    — les props verbatim par don (nom, Src, Conditions
    brutes, Avantages, description et rubriques Spécial/Normal).
  - ``DERIVE.json``    — l'empreinte que ``tools/verifier_derive_dons.py``
    contrôle.

Ligne de partage (la décision centrale du plan 08) : aucun champ dépendant
d'un personnage (``vague``, ``cout``, ``levier`` DANS LA VUE, ``voie``,
``statut``) n'est exporté ici. Il y a 42 classes × 20 niveaux × 53 races =
44 520 personnages possibles avant même de compter les caractéristiques,
l'alignement, la divinité et les 2^1417 ensembles de dons acquis :
précalculer pour chacun est mathématiquement indisponible. Ces grandeurs sont
recalculées côté client, en TypeScript, à l'exécution (étape 09). Seul
``levier_catalogue`` (indépendant du personnage : un fait structurel du
graphe de prérequis complet) est exporté.

Usage :
    python tools/dons/exporter_web.py [--sortie web/public/data/dons] [--sans-validation]
"""

from __future__ import annotations

import argparse
import gzip
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "src"))
sys.path.insert(0, str(REPO_ROOT / "scripts"))
# `tools/dons` lui-même : exporter_arbre_dons.py y vit, `tools/` n'est
# délibérément pas un paquet (même patron que `pf_spells.export_web`).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from pf_dons import data_loader, paths  # noqa: E402
from pf_spells.slugs import dedupe_slug, slugify  # noqa: E402
from pf_spells.web_pliage import plier  # noqa: E402

import build_moteur_dons_contract as moteur_contract  # noqa: E402
import exporter_arbre_dons  # noqa: E402
from verifier_derive_dons import calculer_empreinte  # noqa: E402

# `build_moteur_dons_contract.slugify` ne gère pas les ligatures (œ/æ) : sur 1417
# dons, 4 noms ("Œil du juge", "Manœuvre hydraulique"...) divergeraient alors de
# l'algorithme public `pf_spells.slugs.slugify` utilisé par l'index et les props
# par don. On force donc le module à utiliser le MÊME slugify, avant tout appel —
# deux algorithmes de slug divergents produisent des liens morts.
moteur_contract.slugify = slugify

VERSION_INDEX = 1

SORTIE_DEFAULT = REPO_ROOT / "web" / "public" / "data" / "dons"

_REMPLACEMENT = chr(0xFFFD)


class ExportDonsError(RuntimeError):
    """Un défaut bloquant. Rien n'est écrit sur disque quand une exception est levée."""


def _lire_json_optionnel(chemin: Path) -> dict[str, Any]:
    """Fichier de données absent = dégradation propre, jamais une exception."""
    if not chemin.exists():
        return {}
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise ExportDonsError(
            f"U+FFFD dans {chemin.as_posix()} : corruption d'encodage, pas une donnée"
        )
    return json.loads(texte)


def _serialiser_joli(document: Any) -> str:
    return json.dumps(document, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def _serialiser_compact(document: Any) -> str:
    return (
        json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    )


def _ecrire(texte: str, chemin: Path) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, encoding="utf-8", newline="\n")


def _gzip_taille(texte: str) -> int:
    return len(gzip.compress(texte.encode("utf-8"), mtime=0))


def _valider_avec_tsx(script: str, chemin: Path) -> None:
    """Valide un artefact déjà écrit sur disque via un script tsx du dépôt.

    `check_data_contract_dons.ts` / `check_moteur_contract_dons.ts` prennent un
    chemin en argument ; on les lance donc contre le fichier tel qu'il vient
    d'être écrit, AVANT de considérer l'export réussi (« valider avant d'écrire,
    pas après » — mais un artefact qu'on refuserait de publier ne doit pas non
    plus rester le dernier sur disque : on écrit dans un répertoire temporaire,
    on valide, et on ne recopie vers la destination finale qu'en cas de succès).
    """
    try:
        resultat = subprocess.run(
            ["npx", "tsx", script, str(chemin)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            shell=(sys.platform == "win32"),
        )
    except FileNotFoundError as erreur:  # pragma: no cover - environnement sans npx
        raise ExportDonsError(f"npx introuvable pour lancer {script} : {erreur}") from erreur

    sys.stdout.write(resultat.stdout)
    sys.stderr.write(resultat.stderr)
    if resultat.returncode != 0:
        raise ExportDonsError(
            f"{script} a refusé {chemin.as_posix()} (code {resultat.returncode})"
        )


# --- Index de facettes (contrat 05) -----------------------------------------


def construire_index(
    catalog: list[data_loader.FeatRow], *, genere_le: str | None = None
) -> dict[str, Any]:
    semantics = _lire_json_optionnel(paths.FEAT_SEMANTICS)
    categories_map = _lire_json_optionnel(paths.FEAT_CATEGORIES)

    effets: set[str] = set()
    cibles: set[str] = set()
    contextes: set[str] = set()
    activations: set[str] = set()
    polyvalences: set[str] = set()
    categories: set[str] = set()
    sources: set[str] = set()

    stagiaires: list[dict[str, Any]] = []
    slugs_vus: set[str] = set()

    for row in catalog:
        sem = semantics.get(row.name) or {}
        cat_entry = categories_map.get(row.name) or {}

        ep = sem.get("effet_principal")
        es = sorted(set(sem.get("effets_secondaires") or []))
        cb = sorted(set(sem.get("cible_du_bonus") or []))
        cx = sorted(set(sem.get("contexte") or []))
        ac = sem.get("activation")
        pv = sem.get("polyvalence")
        cat_list = sorted(set(cat_entry.get("categories") or []))

        if ep:
            effets.add(ep)
        effets.update(es)
        cibles.update(cb)
        contextes.update(cx)
        if ac:
            activations.add(ac)
        if pv:
            polyvalences.add(pv)
        categories.update(cat_list)
        if row.source:
            sources.add(row.source)

        slug = dedupe_slug(slugify(row.name), slugs_vus)
        stagiaires.append(
            {
                "row": row,
                "slug": slug,
                "sem": sem,
                "ep": ep,
                "es": es,
                "cb": cb,
                "cx": cx,
                "ac": ac,
                "pv": pv,
                "cat_list": cat_list,
            }
        )

    table_effets = sorted(effets)
    table_cibles = sorted(cibles)
    table_contextes = sorted(contextes)
    table_activations = sorted(activations)
    table_polyvalences = sorted(polyvalences)
    table_categories = sorted(categories)
    table_sources = sorted(sources)

    idx_effets = {v: i for i, v in enumerate(table_effets)}
    idx_cibles = {v: i for i, v in enumerate(table_cibles)}
    idx_contextes = {v: i for i, v in enumerate(table_contextes)}
    idx_activations = {v: i for i, v in enumerate(table_activations)}
    idx_polyvalences = {v: i for i, v in enumerate(table_polyvalences)}
    idx_categories = {v: i for i, v in enumerate(table_categories)}
    idx_sources = {v: i for i, v in enumerate(table_sources)}

    dons = []
    for i, st in enumerate(stagiaires):
        row: data_loader.FeatRow = st["row"]
        nom = row.display_name  # verbatim, astérisque des répétables comprise
        dons.append(
            {
                "i": i,
                "id": st["slug"],
                "s": st["slug"],
                "n": nom,
                "nf": plier(nom),
                "r": nom.rstrip().endswith("*"),
                "ep": idx_effets[st["ep"]] if st["ep"] else None,
                "es": sorted(idx_effets[e] for e in st["es"]),
                "cb": sorted(idx_cibles[c] for c in st["cb"]),
                "cx": sorted(idx_contextes[c] for c in st["cx"]),
                "ac": idx_activations[st["ac"]] if st["ac"] else None,
                "pv": idx_polyvalences[st["pv"]] if st["pv"] else None,
                "cat": sorted(idx_categories[c] for c in st["cat_list"]),
                "src": idx_sources[row.source] if row.source in idx_sources else None,
                "vb": st["sem"].get("valeur_bonus"),
                "rc": st["sem"].get("resume_court"),
                "mc": list(st["sem"].get("mots_cles") or []),
            }
        )

    return {
        "version": VERSION_INDEX,
        "genere_le": genere_le or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "effets_principaux": table_effets,
        "cibles_bonus": table_cibles,
        "contextes": table_contextes,
        "activations": table_activations,
        "polyvalences": table_polyvalences,
        "categories": table_categories,
        "sources": table_sources,
        "dons": dons,
    }


# --- Moteur (contrat 06) : conditions analysées, gating, arêtes -------------


def construire_moteur(catalog: list[data_loader.FeatRow]) -> dict[str, Any]:
    """Réutilise `build_moteur_dons_contract.build_full_contract` telle quelle
    (elle sérialise `parse_conditions` verbatim et recopie les tables de gating
    déjà curées ; aucune règle d'éligibilité n'est réimplémentée ici) puis y
    ajoute `levier_catalogue`, la seule grandeur dérivée du graphe qui NE
    dépend PAS d'un personnage (cf. `tools/dons/exporter_arbre_dons.py`).
    """
    schema, _catalogue_interne = moteur_contract.build_full_contract()

    enfants_catalogue, _parents = exporter_arbre_dons.construire_graphe(catalog)
    leviers_par_nom = exporter_arbre_dons.calculer_leviers(
        {f.name for f in catalog}, enfants_catalogue
    )
    # Reclé sur le slug (clé de jointure de `conditions`), pas sur le nom, pour
    # que le TS n'ait besoin d'aucune seconde table de correspondance.
    schema["levier_catalogue"] = {
        slugify(feat.name): leviers_par_nom.get(feat.name, 0) for feat in catalog
    }
    return schema


# --- Props par don -----------------------------------------------------------


def construire_props(
    row: data_loader.FeatRow, slug: str, details_map: dict[str, Any]
) -> dict[str, Any]:
    detail = details_map.get(row.name) or {}
    return {
        "id": slug,
        "slug": slug,
        "nom": row.display_name,  # verbatim, astérisque comprise
        "source": row.source,
        "raw_conditions": row.raw_conditions,
        "effective_conditions": row.effective_conditions,
        "conditions_ajoutees": list(row.prereq_supplements),
        "avantages": row.benefits,
        "description": detail.get("description"),
        "special": detail.get("special"),
        "normal": detail.get("normal"),
        "source_detail": detail.get("source_detail"),
    }


# --- Empreinte de dérivation --------------------------------------------------


def construire_empreinte() -> dict[str, str]:
    return {"empreinte": calculer_empreinte(REPO_ROOT)}


# --- Orchestration ------------------------------------------------------------


def exporter(
    sortie: Path = SORTIE_DEFAULT,
    *,
    valider: bool = True,
    genere_le: str | None = None,
) -> dict[str, Any]:
    catalog = data_loader.load_catalog()
    if len(catalog) != 1417:
        raise ExportDonsError(
            f"catalogue attendu à 1417 dons, obtenu {len(catalog)} — l'exporteur "
            "refuse d'écrire un artefact sur un catalogue inattendu."
        )

    index = construire_index(catalog, genere_le=genere_le)
    moteur = construire_moteur(catalog)

    details_map = _lire_json_optionnel(paths.FEAT_DETAILS)
    # `id` de l'index EST le slug (voir construire_index) : reconstruire la
    # correspondance nom -> slug depuis les mêmes entrées, pas un second calcul.
    slug_de: dict[str, str] = {}
    for row, entree in zip(catalog, index["dons"]):
        slug_de[row.name] = entree["s"]

    sortie.mkdir(parents=True, exist_ok=True)
    tmp_dir = sortie.parent / ".export_dons_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    texte_index = _serialiser_compact(index)
    texte_moteur = _serialiser_joli(moteur)

    if valider:
        tmp_index = tmp_dir / "index.json"
        tmp_moteur = tmp_dir / "moteur.json"
        _ecrire(texte_index, tmp_index)
        _ecrire(texte_moteur, tmp_moteur)
        _valider_avec_tsx("scripts/check_data_contract_dons.ts", tmp_index)
        _valider_avec_tsx("scripts/check_moteur_contract_dons.ts", tmp_moteur)

    _ecrire(texte_index, sortie / "index.json")
    _ecrire(texte_moteur, sortie / "moteur.json")

    for row in catalog:
        slug = slug_de[row.name]
        props = construire_props(row, slug, details_map)
        _ecrire(_serialiser_joli(props), sortie / f"{slug}.json")

    empreinte = construire_empreinte()
    _ecrire(_serialiser_joli(empreinte), sortie / "DERIVE.json")

    rapport = {
        "dons": len(catalog),
        "chemin_index": (sortie / "index.json").as_posix(),
        "chemin_moteur": (sortie / "moteur.json").as_posix(),
        "chemin_derive": (sortie / "DERIVE.json").as_posix(),
        "taille_index_octets": len(texte_index.encode("utf-8")),
        "taille_index_gzip": _gzip_taille(texte_index),
        "taille_moteur_octets": len(texte_moteur.encode("utf-8")),
        "taille_moteur_gzip": _gzip_taille(texte_moteur),
    }
    return rapport


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--sortie", default=str(SORTIE_DEFAULT))
    parseur.add_argument(
        "--sans-validation",
        action="store_true",
        help="ne pas lancer les validateurs tsx (tests hors ligne uniquement)",
    )
    parseur.add_argument(
        "--genere-le",
        default=None,
        help="horodatage figé, pour un export reproductible à l'octet",
    )
    args = parseur.parse_args(argv)

    try:
        rapport = exporter(
            Path(args.sortie),
            valider=not args.sans_validation,
            genere_le=args.genere_le,
        )
    except ExportDonsError as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    ko = lambda n: f"{(n / 1024):.1f} kB"  # noqa: E731
    print(f"dons             : {rapport['dons']}")
    print(f"index.json       : {rapport['chemin_index']}")
    print(
        f"  brut={ko(rapport['taille_index_octets'])} "
        f"gzip={ko(rapport['taille_index_gzip'])}"
    )
    print(f"moteur.json      : {rapport['chemin_moteur']}")
    print(
        f"  brut={ko(rapport['taille_moteur_octets'])} "
        f"gzip={ko(rapport['taille_moteur_gzip'])}"
    )
    print(f"DERIVE.json      : {rapport['chemin_derive']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
