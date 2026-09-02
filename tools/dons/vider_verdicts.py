"""Vide le verdict d'éligibilité Python pour toute la matrice de personnages —
la référence du différentiel avec le futur moteur TypeScript (étape 14).

Un JSON compact par ligne (`verdicts.jsonl`), déterministe à l'octet :
aucune clé omise, `ensure_ascii=False`, LF, UTF-8 sans BOM, trié par
`(cle_personnage, nom_don)` en tri d'octets. Clés par ligne :

    cle_personnage  "<classe>|<niveau>|<race>" (classe en slug des 42)
    nom_don         nom exact du catalogue (astérisque des répétables comprise)
    statut          "eligible" | "manual_check" | "ineligible"
    motifs          string[], triés

`dons_acquis` vaut toujours `[]`, jamais `None` : `known_feats=None` ferait
valoir `None` (manual_check) à un prérequis de don non tranché, alors que
`known_feats=set()` le fait valoir `False` — c'est ce second comportement que
le différentiel doit vérifier, puisque la matrice ne modélise aucun don déjà
acquis.

Usage :
    python tools/dons/vider_verdicts.py --profil rapide -o web/public/data/dons/verdicts_rapide.jsonl
    python tools/dons/vider_verdicts.py --profil complet -o verdicts_complet.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "src"))

from pf_dons import classes_unifiees, data_loader, engine, paths  # noqa: E402

MATRICE = REPO_ROOT / "data" / "dons" / "matrice_personnages.json"


def _cle_personnage(profil: dict[str, Any]) -> str:
    return f"{profil['classe']}|{profil['niveau']}|{profil['race']}"


def _construire_character(
    profil: dict[str, Any], classes: dict[str, classes_unifiees.ClasseUnifiee]
) -> engine.Character:
    classe = classes.get(profil["classe"])
    nom_classe = classe.nom if classe is not None else profil["classe"]
    # `engine.py::evaluate_requirement` (ABILITY_SCORE) looks up
    # `character.ability_scores` by the *abbreviated, capitalized* key the
    # parser writes into `payload["ability"]` (`"For"`, `"Dex"`, …, see
    # `parser.py`'s `m.group(1).capitalize()`), never by the full French
    # ability name the matrix uses. Keying this dict by `"force"`/`"dexterite"`
    # made every ability-score lookup miss and fall back to `None`
    # ("manual_check"), silently disabling that whole requirement type for the
    # entire matrix.
    caracteristiques = {
        "For": profil["caracteristiques"]["force"],
        "Dex": profil["caracteristiques"]["dexterite"],
        "Con": profil["caracteristiques"]["constitution"],
        "Int": profil["caracteristiques"]["intelligence"],
        "Sag": profil["caracteristiques"]["sagesse"],
        "Cha": profil["caracteristiques"]["charisme"],
    }
    return engine.Character(
        character_class=nom_classe,
        level=profil["niveau"],
        race=profil["race"],
        ability_scores=caracteristiques,
        known_feats=set(profil.get("dons_acquis") or []),
        alignment=profil.get("alignement"),
        deity=profil.get("divinite"),
    )


def vider(profil: str, sortie: Path) -> int:
    """Écrit `sortie` en JSONL trié ; retourne le nombre de lignes écrites."""
    matrice = json.loads(MATRICE.read_text(encoding="utf-8"))
    if profil not in matrice:
        raise ValueError(
            f"profil {profil!r} inconnu dans {MATRICE.as_posix()} "
            f"(profils disponibles : {sorted(matrice)})"
        )

    catalog = data_loader.load_catalog()
    catalog_trie = sorted(catalog, key=lambda row: row.name)
    classes = classes_unifiees.charger_classes()

    lignes: list[tuple[str, str, str]] = []
    for entree_profil in matrice[profil]:
        character = _construire_character(entree_profil, classes)
        cle = _cle_personnage(entree_profil)
        for row in catalog_trie:
            resultat = engine.evaluate_feat(row, character)
            document = {
                "cle_personnage": cle,
                "nom_don": row.name,
                "statut": resultat.status,
                "motifs": sorted(resultat.reasons),
            }
            ligne = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            lignes.append((cle, row.name, ligne))

    lignes.sort(key=lambda t: (t[0].encode("utf-8"), t[1].encode("utf-8")))

    sortie.parent.mkdir(parents=True, exist_ok=True)
    with sortie.open("w", encoding="utf-8", newline="\n") as f:
        for _, _, ligne in lignes:
            f.write(ligne + "\n")

    return len(lignes)


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument("--profil", choices=["rapide", "complet"], default="rapide")
    parseur.add_argument("-o", "--sortie", default=None)
    args = parseur.parse_args(argv)

    sortie = Path(args.sortie) if args.sortie else REPO_ROOT / f"verdicts_{args.profil}.jsonl"

    try:
        nb_lignes = vider(args.profil, sortie)
    except (ValueError, FileNotFoundError) as erreur:
        print(f"ÉCHEC : {erreur}", file=sys.stderr)
        return 1

    print(f"{nb_lignes} ligne(s) écrite(s) dans {sortie.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
