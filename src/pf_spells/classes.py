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


# Wiki abbreviation -> class slug.
#
# Every row below is evidenced, not guessed: each abbreviation on a spell page's
# `Niveau` line is a link to its class page, and this table was derived from
# those hrefs across all 2070 cached spell pages. The corpus writes some
# abbreviations several ways (`Apal`/`Antipal`/`AntiPal`, `Méd`/`Med`,
# `Rôd`/`Rod`, and lowercase spellings) — all spellings observed are listed.
#
# `Ens` and `Mag` are two separate links usually rendered `Ens/Mag`; the joined
# token is kept as a key because that is what the stat block reads.
#
# Classes on spell pages but NOT in elements_to_do.json map to `None`: the plan
# covers 19 classes and PF1 has more. They are recognized so they can be
# reported as expected rather than as unknown.
CLASS_ABBREV: dict[str, str] = {
    "Alch": "alchimiste",
    "Antipal": "antipaladin",
    "AntiPal": "antipaladin",
    "Apal": "antipaladin",
    "Bard": "barde",
    "Cham": "chaman",
    "Con": "conjurateur",
    "Conj": "conjurateur",
    "Dru": "druide",
    "Ens": "arcaniste-ensorceleur-magicien",
    "Ens/Mag": "arcaniste-ensorceleur-magicien",
    "Hyp": "hypnotiseur",
    "Inq": "inquisiteur",
    "Mag": "arcaniste-ensorceleur-magicien",
    "Magus": "magus",
    "Med": "medium",
    "Méd": "medium",
    "Occ": "occultiste",
    "Pal": "paladin",
    "Prê": "pretre-pretre-combattant-oracle",
    "Psy": "psychiste",
    "San": "sanguin",
    "Sor": "sorciere",
    "Spi": "spirite",
    "ensorceleur": "arcaniste-ensorceleur-magicien",
    "ensorceleur/magicien": "arcaniste-ensorceleur-magicien",
    "magicien": "arcaniste-ensorceleur-magicien",
    "magus": "magus",
    "prêtre": "pretre-pretre-combattant-oracle",
    "sorcière": "sorciere",
}

# Recognized abbreviations for classes outside the 19-class roster. Present so
# `enrich_spells` can report them as expected findings, never as unknowns.
CLASS_ABBREV_HORS_LISTE: dict[str, str] = {
    "Adepte": "Adepte",
    "ConU": "Conjurateur unchained",
    "Rod": "Rôdeur",
    "Rôd": "Rôdeur",
}

# A roster label that names several classes at once resolves from any of its
# member abbreviations. Membership is evidenced by the `Niveau`-line hrefs:
# `Ens` -> Ensorceleur and `Mag` -> Magicien both point inside the combined
# Arcaniste/Ensorceleur/Magicien page. `Arcaniste` has no abbreviation of its
# own in the corpus, and neither `PrêC` nor `Ora` occurs — only `Prê`.
LABELS_COMBINES: dict[str, tuple[str, ...]] = {
    "Arcaniste/Ensorceleur/Magicien": (
        "Ens/Mag",
        "Ens",
        "Mag",
        "ensorceleur/magicien",
        "ensorceleur",
        "magicien",
    ),
    "Prêtre/Prêtre combattant/Oracle": ("Prê", "prêtre"),
}


def lookup_abbrev(abbrev: str) -> str | None:
    """Return the class slug for a wiki abbreviation, or None if unknown."""
    return CLASS_ABBREV.get(abbrev.strip())


def abbrevs_pour_slug(slug: str) -> tuple[str, ...]:
    """Return every abbreviation that resolves to `slug`, longest first.

    Longest-first so `Ens/Mag` is preferred over the bare `Ens` when both would
    match, which keeps level lookup deterministic.
    """
    trouvees = [a for a, cible in CLASS_ABBREV.items() if cible == slug]
    return tuple(sorted(trouvees, key=lambda a: (-len(a), a)))


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
