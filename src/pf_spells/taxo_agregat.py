"""Step 04, stage 2: aggregate the free-proposal labels into a curator's CSV.

Strictly offline and re-runnable: it reads `build_artifacts/taxo_passe0/*.json`
and writes `build_artifacts/taxo_passe0_agrege.csv`. Kept in a separate module
from `taxo_passe0` on purpose — the network run is paid for once, the grouping is
a judgement that will be redone several times, and the two must not share a fate.

What the pass 0 actually produced, and why the grouping looks like this: 200
spells yielded **1163 distinct raw labels** for 1278 label uses. The model
invents a fresh compound for nearly every spell
(`confusion_temporaire_allie_ennemi`, `prise_en_tenailles_facilitee`), so the
most frequent raw label occurs **10 times** and the median occurs once. A cut
applied to raw labels would therefore retain almost nothing. The real signal is
in the *concepts* the compounds are built from, which is what
`data/conventions/taxo_groupes.json` names:
each group is a regex over the accent-folded label, and a group's coverage is the
number of **sampled spells** at least one of whose labels matches it. That count
— spells, not label uses — is what the >= 10 cut of the step is applied to.

Normalisation folds accents and case and brings singular/plural together **for
grouping only** (corpus rule: values stay verbatim, `unicodedata` stdlib, never
`unidecode`). `etiquette_brute` in the CSV is the untouched label.

Labels that match no group are still clustered, by `difflib` similarity, so a
curator sees the leftovers as families rather than as 700 orphan lines. A cluster
is named after its most frequent member, prefixed `hors_groupe:`.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import functools
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

agregat_version = "1.0.0"

DEFAULT_ENTREE = "build_artifacts/taxo_passe0"
DEFAULT_SORTIE = "build_artifacts/taxo_passe0_agrege.csv"

COLONNES = ("etiquette_brute", "occurrences", "groupe_propose", "exemples_ids")

# Coverage floor of the step: a group is only worth curating if it applies to at
# least this many spells **of the sample**.
SEUIL_COUVERTURE = 10

# How many ids the CSV shows per label. Enough to go and look, not a dump.
MAX_EXEMPLES = 5

# Similarity above which two ungrouped labels are considered the same family.
SEUIL_SIMILARITE = 0.72

class AgregatError(RuntimeError):
    """A blocking condition: the aggregate cannot honestly be built."""


# The grouping vocabulary lives in `data/conventions/taxo_groupes.json`, not here.
# Two reasons, both hard: the retained group names become the v1 tag keys, and a
# closed list of values must have exactly one home (`data/conventions/`), never a
# second one in code; and a curator re-running the grouping differently edits a
# data file, not a module.
CHEMIN_GROUPES = Path("data") / "conventions" / "taxo_groupes.json"


def charger_groupes(racine: str | Path = ".") -> dict[str, str]:
    """Read the candidate concept groups: name -> regex over the folded label."""
    chemin = Path(racine) / CHEMIN_GROUPES
    if not chemin.is_file():
        raise AgregatError(f"vocabulaire de regroupement absent : {chemin}")
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    groupes = doc["groupes"]
    if not groupes:
        raise AgregatError(f"aucun groupe dans {chemin}")
    return dict(groupes)


@functools.lru_cache(maxsize=8)
def _compiles(racine: str = ".") -> tuple[tuple[str, re.Pattern[str]], ...]:
    """The compiled groups, in file order. Cached: read once, matched 60 000 times."""
    return tuple(
        (nom, re.compile(motif)) for nom, motif in charger_groupes(racine).items()
    )

# Function words and shared scaffolding: present in half the labels, they carry
# no concept and would dominate any token statistic.
MOTS_VIDES = frozenset(
    {
        "de", "du", "des", "la", "le", "les", "a", "au", "aux", "et", "ou", "en",
        "par", "pour", "sur", "un", "une", "d", "l", "possible", "applicable",
        "requise", "requis", "requises", "cible", "sort", "sorts", "effet",
        "effets",
    }
)

_REMPLACEMENT = chr(0xFFFD)


def plier(etiquette: str) -> str:
    """Fold one label to a grouping key. Never used as output.

    Ligatures first — NFKD does not decompose them — then NFKD, then drop the
    combining marks, lowercase, and collapse anything else to a single `_`.
    Corpus rule: accents are removed **only** in a key, never in a value.
    """
    prepare = etiquette.replace("œ", "oe").replace("Œ", "oe")
    prepare = prepare.replace("æ", "ae").replace("Æ", "ae")
    decompose = unicodedata.normalize("NFKD", prepare)
    sans_accent = "".join(c for c in decompose if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", sans_accent.lower()).strip("_")


def singulariser(mot: str) -> str:
    """Bring singular and plural together: `degats` and `degat` are one word.

    Crude on purpose. Words of 4 letters or less and words in `-ss` are left
    alone, but a genuine singular in `-s` such as `bonus` is still trimmed (to
    `bonu`). That is harmless — the trim is applied to every occurrence, so the
    grouping key stays consistent — and it is never shown: the CSV displays the
    raw label verbatim. Only ever call this to build a key.
    """
    if len(mot) > 4 and mot.endswith("s") and not mot.endswith("ss"):
        return mot[:-1]
    return mot


def cle_de_regroupement(etiquette: str) -> str:
    """The key under which two labels count as the same raw label.

    Folded, function words dropped, each word singularised, words sorted:
    `coercition_enchantement` and `enchantement_coercition` are one label.
    """
    mots = [
        singulariser(mot)
        for mot in plier(etiquette).split("_")
        if mot and mot not in MOTS_VIDES
    ]
    return "_".join(sorted(mots)) or plier(etiquette)


def charger_passe0(entree: str | Path) -> dict[str, list[str]]:
    """Read every pass-0 file: id -> its labels, in the model's order."""
    entree = Path(entree)
    if not entree.is_dir():
        raise AgregatError(f"répertoire de passe 0 absent : {entree}")
    par_sort: dict[str, list[str]] = {}
    for chemin in sorted(entree.glob("*.json")):
        texte = chemin.read_text(encoding="utf-8")
        if _REMPLACEMENT in texte:
            raise AgregatError(f"U+FFFD dans {chemin} : corruption d'encodage")
        doc = json.loads(texte)
        par_sort[doc["id"]] = list(doc["etiquettes"])
    if not par_sort:
        raise AgregatError(f"aucun fichier de passe 0 dans {entree}")
    return par_sort


def groupes_d_une_etiquette(etiquette: str, racine: str | Path = ".") -> list[str]:
    """Every concept group the label is evidence for, in file order."""
    plie = plier(etiquette)
    return [nom for nom, motif in _compiles(str(racine)) if motif.search(plie)]


def couverture_par_groupe(
    par_sort: dict[str, list[str]], racine: str | Path = "."
) -> dict[str, list[str]]:
    """group -> sorted ids of the sampled spells it covers.

    Coverage is counted in **spells**, not label uses: a spell whose three labels
    all mention damage is one spell of evidence for `degats_directs`.

    `racine` is threaded explicitly rather than left to the default: the groups
    are read from `<racine>/data/conventions/taxo_groupes.json`, and defaulting it
    deeper down would silently match against the *current directory's* groups
    whatever root the caller passed.
    """
    couverture: dict[str, set[str]] = defaultdict(set)
    for sid, etiquettes in par_sort.items():
        for etiquette in etiquettes:
            for nom in groupes_d_une_etiquette(etiquette, racine):
                couverture[nom].add(sid)
    return {nom: sorted(ids) for nom, ids in couverture.items()}


def groupes_retenus(
    par_sort: dict[str, list[str]],
    racine: str | Path = ".",
    seuil: int = SEUIL_COUVERTURE,
) -> list[str]:
    """The groups that clear the coverage floor, most covered first."""
    couverture = couverture_par_groupe(par_sort, racine)
    retenus = [nom for nom, ids in couverture.items() if len(ids) >= seuil]
    return sorted(retenus, key=lambda nom: (-len(couverture[nom]), nom))


def _grappes_hors_groupe(
    cles: list[str], occurrences: Counter[str]
) -> dict[str, str]:
    """Cluster the leftover labels by string similarity, greedily.

    Greedy on decreasing frequency so a cluster is always named after its most
    frequent member; `difflib` is enough here and keeps the dependency set empty.
    """
    ordre = sorted(cles, key=lambda c: (-occurrences[c], c))
    representants: list[str] = []
    affectation: dict[str, str] = {}
    for cle in ordre:
        proches = difflib.get_close_matches(
            cle, representants, n=1, cutoff=SEUIL_SIMILARITE
        )
        if proches:
            affectation[cle] = proches[0]
        else:
            representants.append(cle)
            affectation[cle] = cle
    return affectation


def construire_lignes(
    par_sort: dict[str, list[str]], racine: str | Path = "."
) -> list[dict[str, object]]:
    """Build the CSV rows, sorted by occurrences descending then label.

    One row per raw label as the model wrote it; `occurrences` counts the spells
    that produced it (a label repeated inside one answer was already deduplicated
    upstream), and `groupe_propose` names every concept group it feeds.
    """
    occurrences: Counter[str] = Counter()
    exemples: dict[str, list[str]] = defaultdict(list)
    formes: dict[str, Counter[str]] = defaultdict(Counter)
    for sid, etiquettes in sorted(par_sort.items()):
        for etiquette in dict.fromkeys(etiquettes):
            cle = cle_de_regroupement(etiquette)
            occurrences[cle] += 1
            formes[cle][etiquette] += 1
            exemples[cle].append(sid)

    retenus = set(groupes_retenus(par_sort, racine))
    sans_groupe = [
        cle
        for cle in occurrences
        if not (set(groupes_d_une_etiquette(next(iter(formes[cle])), racine)) & retenus)
    ]
    grappes = _grappes_hors_groupe(sans_groupe, occurrences)

    lignes: list[dict[str, object]] = []
    for cle, nombre in occurrences.items():
        # The raw label shown is the most frequent surface form, verbatim.
        brute = formes[cle].most_common(1)[0][0]
        noms = [nom for nom in groupes_d_une_etiquette(brute, racine) if nom in retenus]
        if noms:
            groupe = "|".join(noms)
        else:
            groupe = f"hors_groupe:{grappes.get(cle, cle)}"
        lignes.append(
            {
                "etiquette_brute": brute,
                "occurrences": nombre,
                "groupe_propose": groupe,
                "exemples_ids": " ".join(exemples[cle][:MAX_EXEMPLES]),
            }
        )
    lignes.sort(key=lambda l: (-int(l["occurrences"]), str(l["etiquette_brute"])))
    return lignes


def ecrire_csv(lignes: list[dict[str, object]], chemin: str | Path) -> Path:
    """Write UTF-8, LF, trailing newline — readable by a human, diffable by git."""
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as flux:
        graveur = csv.DictWriter(flux, fieldnames=list(COLONNES), lineterminator="\n")
        graveur.writeheader()
        graveur.writerows(lignes)
    return chemin


def lire_csv(chemin: str | Path) -> list[dict[str, str]]:
    """Read the aggregate back — the coverage test reads it, not the raw files."""
    chemin = Path(chemin)
    if not chemin.is_file():
        raise AgregatError(f"agrégat absent : {chemin}")
    with chemin.open(encoding="utf-8", newline="") as flux:
        return list(csv.DictReader(flux))


def couverture_depuis_csv(chemin: str | Path) -> dict[str, set[str]]:
    """group -> ids of the sampled spells covered, recomputed from the CSV.

    The union of `exemples_ids` is a **lower bound** on coverage, since the CSV
    truncates the id list; the test that needs an exact count uses
    `couverture_par_groupe` on the pass-0 files. This reading exists so the CSV
    itself can be checked for internal consistency.
    """
    couverture: dict[str, set[str]] = defaultdict(set)
    for ligne in lire_csv(chemin):
        groupe = ligne["groupe_propose"]
        if groupe.startswith("hors_groupe:"):
            continue
        for nom in groupe.split("|"):
            couverture[nom].update(ligne["exemples_ids"].split())
    return dict(couverture)


def run(
    entree: str | Path = DEFAULT_ENTREE,
    sortie: str | Path = DEFAULT_SORTIE,
    racine: str | Path = ".",
) -> dict[str, object]:
    par_sort = charger_passe0(entree)
    lignes = construire_lignes(par_sort, racine)
    ecrire_csv(lignes, sortie)
    couverture = couverture_par_groupe(par_sort, racine)
    retenus = groupes_retenus(par_sort, racine)
    return {
        "sorts": len(par_sort),
        "usages": sum(len(v) for v in par_sort.values()),
        "etiquettes_distinctes": len(lignes),
        "groupes_candidats": len(charger_groupes(racine)),
        "groupes_retenus": retenus,
        "couverture": {nom: len(couverture.get(nom, [])) for nom in retenus},
        "seuil": SEUIL_COUVERTURE,
    }


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Agrège les étiquettes brutes de la passe 0 en un CSV destiné à la "
            "la coupe déterministe de taxonomie_v1, et lisible à l'œil. Hors "
            "ligne, rejouable, n'écrit rien sous data/."
        )
    )
    parseur.add_argument("--entree", default=DEFAULT_ENTREE)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    args = parseur.parse_args(argv)
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    resume = run(args.entree, args.sortie)
    print(
        f"{resume['sorts']} sorts, {resume['usages']} usages d'étiquette, "
        f"{resume['etiquettes_distinctes']} étiquettes brutes distinctes"
    )
    print(
        f"{resume['groupes_candidats']} groupes candidats, "
        f"{len(resume['groupes_retenus'])} au-dessus du seuil de "
        f"{resume['seuil']} sorts"
    )
    print(f"écrit : {args.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
