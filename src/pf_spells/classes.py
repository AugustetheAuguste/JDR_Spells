"""Load and deduplicate the class list, plus the wiki abbreviation table."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import TypedDict
from urllib.parse import unquote

from pf_spells.slugs import slugify

DEFAULT_PATH = "elements_to_do.json"


class ClasseEntry(TypedDict):
    label: str
    slug: str
    url: str
    url_key: str


# Wiki abbreviation -> class slug. Confirmed: Bard, Cham, Inq, Occ, Pal, Pre,
# Magus, Red. The rest are provisional; lookup_abbrev returns None on unknown.
CLASS_ABBREV: dict[str, str] = {
    "Bard": "barde",
    "Cham": "chaman",
    "Inq": "inquisiteur",
    "Occ": "occultiste",
    "Pal": "paladin",
    "Prê": "pretre-pretre-combattant-oracle",
    "Magus": "magus",
    "Réd": "redempteur",
    "Alch": "alchimiste",
    "Antipal": "antipaladin",
    "Conj": "conjurateur",
    "Chass": "chasseur",
    "Druide": "druide",
    "Ens": "arcaniste-ensorceleur-magicien",
    "Mag": "arcaniste-ensorceleur-magicien",
    "Arc": "arcaniste-ensorceleur-magicien",
    "Prê/Ora": "pretre-pretre-combattant-oracle",
    "Ora": "pretre-pretre-combattant-oracle",
    "Sorc": "sorciere",
    "Sang": "sanguin",
    "Hyp": "hypnotiseur",
    "Méd": "medium",
    "Psy": "psychiste",
    "Spi": "spirite",
}


def lookup_abbrev(abbrev: str) -> str | None:
    """Return the class slug for a wiki abbreviation, or None if unknown."""
    return CLASS_ABBREV.get(abbrev.strip())


def _url_key(url: str) -> str:
    return unquote(url).strip().lower()


def load_classes(
    path: str | Path = DEFAULT_PATH,
) -> tuple[list[ClasseEntry], list[dict]]:
    """Return (deduped class entries, dropped duplicates).

    Deduplication is on the percent-decoded lowercased URL; the first
    occurrence's label wins. Dropped entries are returned, never swallowed.
    """
    brut = json.loads(Path(path).read_text(encoding="utf-8"))
    entrees: list[ClasseEntry] = []
    abandons: list[dict] = []
    vus: dict[str, ClasseEntry] = {}
    for element in brut:
        label = element["class"].strip()
        url = element["link"].strip()
        cle = _url_key(url)
        if cle in vus:
            abandons.append(
                {
                    "label": label,
                    "url": url,
                    "url_key": cle,
                    "conserve": vus[cle]["label"],
                    "raison": "url_key en doublon",
                }
            )
            continue
        entree: ClasseEntry = {
            "label": label,
            "slug": slugify(label),
            "url": url,
            "url_key": cle,
        }
        vus[cle] = entree
        entrees.append(entree)
    return entrees, abandons


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(description="Rapport de dédoublonnage des classes.")
    parseur.add_argument("--path", default=DEFAULT_PATH, help="chemin de elements_to_do.json")
    parseur.add_argument("--report", action="store_true", help="afficher le rapport")
    args = parseur.parse_args(argv)

    entrees, abandons = load_classes(args.path)
    print(f"{len(entrees)} kept / {len(abandons)} dropped duplicate(s)")
    if args.report:
        for entree in entrees:
            print(f"  kept    {entree['label']}  ->  {entree['slug']}")
        for abandon in abandons:
            print(
                f"  dropped {abandon['label']}  (doublon de {abandon['conserve']}) "
                f"{abandon['url']}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
