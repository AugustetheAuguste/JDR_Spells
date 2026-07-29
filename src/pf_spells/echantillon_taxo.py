"""Step 03 driver: draw the reproducible stratified sample that feeds the taxonomy.

Writes `build_artifacts/echantillon_taxo.json` — never anything under `data/`.
No network, no HTML: this module reads JSONL and JSON only.

Three decisions this module makes explicitly, because each one has a defensible
alternative and a silent failure mode:

**The level of a spell.** A Pathfinder spell has no single level; it has one level
per class (`niveaux` in the spell file is a mapping of class abbreviation ->
level). The convention adopted here is **`niveau_min`, the minimum over every
class that lists the spell** — the level at which the spell first becomes
reachable by anyone. It is recomputed from `data/sorts/<id>.json` rather than read
from the index's `niveau_min`, and the two are cross-checked: disagreements are
recorded in the artifact under `desaccords_niveau_min` instead of one source
being silently trusted.

**The school of a spell.** The index's `ecoles` field is a *hint* derived from the
`<h3>` grouping of the class-list pages and is empty for 737 of the 2070 spells,
so stratifying on it would dump 36 % of the corpus into a null school. The
authoritative school is the `ecole` key of the spell file, always non-empty, but
it carries 60 distinct raw spellings: parenthesised sub-schools and descriptors
(`Invocation (convocation)`, `Évocation (froid)`), lowercase variants
(`invocation`, `évocation`), one stray bracket (`Enchantement (coercition)
]émotion, effet mental]`) and the `Universel`/`Universelle` pair. Grouping needs a
base school, so `ecole_de_base` keeps the part before the first `(`, drops a
trailing stray bracket, and re-cases it as `Titlecase` — collapsing `Universel`
and `Universelle` onto `Universelle`. That yields the nine canonical schools:
Abjuration, Divination, Enchantement, Évocation, Illusion, Invocation,
Nécromancie, Transmutation, Universelle. Accents are **never** stripped: the
corpus rule is that values stay verbatim, and the normalisation is for grouping
only. The full raw -> base mapping is written into the artifact
(`ecoles_normalisation`) so the collapse is auditable rather than folklore.

**`construit_le` without a wall clock.** Step 04 requires the key, but a timestamp
would make the committed artifact impossible to reproduce byte for byte, which is
the actual verification criterion. So `construit_le` carries no wall clock: it
defaults to `empreinte:<16 hex>`, derived from a SHA-256 over the sorted
(id, ecole, niveau_min) triples of the corpus. It changes when — and only when —
the sampled corpus changes, which is the only thing the field was ever useful
for. `--construit-le` overrides it for callers that want their own marker.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

builder_version = "1.0.0"

DEFAULT_RACINE = "."
DEFAULT_SORTIE = "build_artifacts/echantillon_taxo.json"

TAILLE_CIBLE = 200
GRAINE = 20240101

# Coverage beats strict proportionality: the step accepts this band around the
# target rather than a single figure.
BANDE_MIN = 190
BANDE_MAX = 230

# Every stratum contributes at least this many spells — unless it is smaller,
# in which case it contributes all of its members. Never sampling with
# replacement, never padding.
PLANCHER = 2

# The nine base schools the normalisation is expected to yield. Not a filter: a
# tenth school would be a real finding, and is reported, not dropped.
ECOLES_ATTENDUES: tuple[str, ...] = (
    "Abjuration",
    "Divination",
    "Enchantement",
    "Illusion",
    "Invocation",
    "Nécromancie",
    "Transmutation",
    "Universelle",
    "Évocation",
)


class EchantillonError(RuntimeError):
    """A blocking condition: the sample cannot honestly be built."""


@dataclass(frozen=True, slots=True)
class Sort:
    """The three facts stratification needs about one spell."""

    id: str
    ecole_brute: str
    ecole_base: str
    niveau_min: int


def ecole_de_base(brute: str) -> str:
    """Collapse a raw `ecole` value onto one of the nine base schools.

    Grouping key only — the raw value is preserved in the artifact. Accents are
    kept: `Évocation` stays `Évocation`, it never becomes `Evocation`.
    """
    tete = brute.split("(")[0]
    # One source value reads `Enchantement (coercition) ]émotion, effet mental]`;
    # a stray bracket must not survive into a group name.
    tete = tete.replace("]", " ").replace("[", " ").strip()
    if not tete:
        raise EchantillonError(f"école illisible : {brute!r}")
    base = tete[:1].upper() + tete[1:].lower()
    # `Universel` (5 spells) and `Universelle` (2) are the same school spelled
    # two ways; the feminine form is the one the Skill uses.
    if base.startswith("Univers"):
        return "Universelle"
    return base


def charger_index(racine: Path) -> list[dict]:
    """Read `data/index/sorts_uniques.jsonl` — the authority on which ids exist."""
    chemin = racine / "data" / "index" / "sorts_uniques.jsonl"
    if not chemin.is_file():
        raise EchantillonError(f"index absent : {chemin}")
    entrees = [
        json.loads(ligne)
        for ligne in chemin.read_text(encoding="utf-8").splitlines()
        if ligne.strip()
    ]
    if not entrees:
        raise EchantillonError(f"index vide : {chemin}")
    return entrees


def charger_sorts(racine: Path, entrees: list[dict]) -> tuple[list[Sort], list[dict]]:
    """Build one `Sort` per index entry, plus the niveau_min disagreement list.

    Iterates the index in sorted id order, never `glob` order: a filesystem
    ordering is not stable between machines and this list seeds every draw.
    """
    sorts: list[Sort] = []
    desaccords: list[dict] = []
    for entree in sorted(entrees, key=lambda e: e["id"]):
        sid = entree["id"]
        chemin = racine / "data" / "sorts" / f"{sid}.json"
        if not chemin.is_file():
            raise EchantillonError(f"sort de l'index sans fichier : {chemin}")
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        niveaux = doc.get("niveaux") or {}
        if not niveaux:
            raise EchantillonError(f"{sid} : `niveaux` vide, niveau_min indéfini")
        niveau_min = min(int(v) for v in niveaux.values())
        # Cross-check against the index rather than trusting either source.
        if entree.get("niveau_min") != niveau_min:
            desaccords.append(
                {
                    "id": sid,
                    "niveau_min_sort": niveau_min,
                    "niveau_min_index": entree.get("niveau_min"),
                    "retenu": niveau_min,
                }
            )
        brute = doc.get("ecole") or ""
        if not brute:
            raise EchantillonError(f"{sid} : clé `ecole` vide ou absente")
        sorts.append(Sort(sid, brute, ecole_de_base(brute), niveau_min))
    return sorts, sorted(desaccords, key=lambda d: d["id"])


def grouper(sorts: list[Sort]) -> dict[tuple[str, int], list[str]]:
    """Group into strata, each id list sorted — the draw must not see dict order."""
    strates: dict[tuple[str, int], list[str]] = defaultdict(list)
    for s in sorts:
        strates[(s.ecole_base, s.niveau_min)].append(s.id)
    return {cle: sorted(strates[cle]) for cle in sorted(strates)}


def allouer(
    strates: dict[tuple[str, int], list[str]], taille_cible: int
) -> dict[tuple[str, int], int]:
    """Proportional allocation with a floor of `PLANCHER`, then a stable trim.

    A stratum smaller than the floor is capped at its own size: all of its
    members are taken and nothing is invented. The adjustment walks the strata in
    a fully ordered way — by residual against the ideal share, then by key — so
    the same corpus always lands on the same quotas.
    """
    total = sum(len(v) for v in strates.values())
    ideal = {cle: taille_cible * len(v) / total for cle, v in strates.items()}
    quotas = {
        cle: min(len(v), max(PLANCHER, round(ideal[cle])))
        for cle, v in strates.items()
    }

    def rang(cle: tuple[str, int]) -> tuple[float, str, int]:
        return (quotas[cle] - ideal[cle], cle[0], cle[1])

    # Trim the most over-served strata first; grow the most under-served.
    while sum(quotas.values()) > taille_cible:
        candidats = [
            cle
            for cle, v in strates.items()
            if quotas[cle] > min(PLANCHER, len(v))
        ]
        if not candidats:
            break
        quotas[max(candidats, key=rang)] -= 1
    while sum(quotas.values()) < taille_cible:
        candidats = [cle for cle, v in strates.items() if quotas[cle] < len(v)]
        if not candidats:
            break
        quotas[min(candidats, key=rang)] += 1
    return quotas


def tirer(
    strates: dict[tuple[str, int], list[str]],
    quotas: dict[tuple[str, int], int],
    graine: int,
) -> dict[str, list[str]]:
    """Draw each stratum without replacement from a sorted list, one seeded RNG.

    A single `random.Random(graine)` consumed in sorted stratum order is what
    makes the whole artifact reproducible; a per-stratum RNG or a dict traversal
    would both break it.
    """
    rng = random.Random(graine)
    tirage: dict[str, list[str]] = {}
    for cle in sorted(strates):
        membres = strates[cle]
        quota = min(quotas[cle], len(membres))
        tirage[f"{cle[0]}:{cle[1]}"] = sorted(rng.sample(membres, quota))
    return tirage


def empreinte_corpus(sorts: list[Sort]) -> str:
    """SHA-256 over the sorted (id, école brute, niveau_min) triples.

    The stable stand-in for a build timestamp: it moves when the sampled corpus
    moves and stays put otherwise, which is exactly what reproducibility needs.
    """
    h = hashlib.sha256()
    for s in sorted(sorts, key=lambda s: s.id):
        h.update(f"{s.id}\t{s.ecole_brute}\t{s.niveau_min}\n".encode())
    return h.hexdigest()


def construire_echantillon(
    racine: str | Path = DEFAULT_RACINE,
    taille_cible: int = TAILLE_CIBLE,
    graine: int = GRAINE,
    *,
    construit_le: str | None = None,
) -> dict:
    """Build and return the sample artifact dict. Writes nothing."""
    racine = Path(racine)
    entrees = charger_index(racine)
    sorts, desaccords = charger_sorts(racine, entrees)
    strates = grouper(sorts)
    quotas = allouer(strates, taille_cible)
    tirage = tirer(strates, quotas, graine)

    taille = sum(len(v) for v in tirage.values())
    ecoles_corpus = sorted({s.ecole_base for s in sorts})
    ecoles_tirees = sorted({cle.rsplit(":", 1)[0] for cle in tirage})

    # A stratum below the floor is a fact of the distribution, not a bug — but it
    # is never allowed to pass unnoticed.
    sous_plancher = [
        {
            "strate": f"{cle[0]}:{cle[1]}",
            "taille_strate": len(membres),
            "plancher": PLANCHER,
            "tires": len(tirage[f"{cle[0]}:{cle[1]}"]),
        }
        for cle, membres in sorted(strates.items())
        if len(membres) < PLANCHER
    ]

    normalisation: dict[str, str] = {}
    for s in sorts:
        normalisation[s.ecole_brute] = s.ecole_base
    distribution_brute = {
        f"{cle[0]}:{cle[1]}": len(membres) for cle, membres in sorted(strates.items())
    }

    artefact = {
        "graine": graine,
        "taille": taille,
        "construit_le": construit_le or f"empreinte:{empreinte_corpus(sorts)[:16]}",
        "strates": tirage,
        "couverture": {
            "ecoles": len(ecoles_tirees),
            "niveaux": len({int(cle.rsplit(":", 1)[1]) for cle in tirage}),
        },
        # --- audit keys, beyond the shape step 04 consumes -------------------
        "builder_version": builder_version,
        "convention_niveau": (
            "niveau_min : minimum de `niveaux` sur toutes les classes qui listent "
            "le sort (un sort n'a pas un niveau, il en a un par classe)"
        ),
        "convention_ecole": (
            "école lue dans data/sorts/<id>.json clé `ecole` (jamais l'indice "
            "`ecoles` de l'index, vide pour 737 sorts), puis réduite à l'école de "
            "base : partie avant la première parenthèse, casse normalisée, "
            "Universel/Universelle fusionnés ; accents conservés"
        ),
        "empreinte_corpus": empreinte_corpus(sorts),
        "taille_cible": taille_cible,
        "ecart_taille_cible": taille - taille_cible,
        "bande_acceptee": [BANDE_MIN, BANDE_MAX],
        "dans_la_bande": BANDE_MIN <= taille <= BANDE_MAX,
        "plancher_par_strate": PLANCHER,
        "nb_sorts_corpus": len(sorts),
        "nb_strates": len(strates),
        "distribution_brute": distribution_brute,
        "strates_sous_plancher": sous_plancher,
        "ecoles_corpus": ecoles_corpus,
        "ecoles_absentes_de_l_echantillon": sorted(
            set(ecoles_corpus) - set(ecoles_tirees)
        ),
        "ecoles_inattendues": sorted(set(ecoles_corpus) - set(ECOLES_ATTENDUES)),
        "ecoles_normalisation": {
            brute: normalisation[brute] for brute in sorted(normalisation)
        },
        "desaccords_niveau_min": desaccords,
    }
    return artefact


def serialiser(artefact: dict) -> str:
    """The exact committed text: sorted keys, indent 2, verbatim accents, LF."""
    return json.dumps(artefact, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def ecrire(artefact: dict, chemin: str | Path) -> Path:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(serialiser(artefact), encoding="utf-8", newline="\n")
    return chemin


def lancer_preflight(racine: Path) -> None:
    """Entry guard. Non-zero verdict stops the build, with the reasons named.

    `tools/preflight_corpus.py` is deliberately not a package, so it is loaded by
    path the way `tests/test_preflight_corpus.py` does.
    """
    import importlib.util

    chemin = racine / "tools" / "preflight_corpus.py"
    if not chemin.is_file():
        raise EchantillonError(f"garde d'entrée introuvable : {chemin}")
    spec = importlib.util.spec_from_file_location("preflight_corpus", chemin)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise EchantillonError(f"garde d'entrée non chargeable : {chemin}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["preflight_corpus"] = module
    spec.loader.exec_module(module)

    rapport = module.preflight(racine)
    if rapport.bloquantes:
        details = "\n".join(
            f"  - [{a.controle}] {a.id} : {a.detail}" for a in rapport.bloquantes
        )
        raise EchantillonError(
            f"préflight {rapport.verdict} sur {racine} : "
            f"{len(rapport.bloquantes)} anomalie(s) bloquante(s)\n{details}"
        )


def run(
    racine: str | Path = DEFAULT_RACINE,
    taille_cible: int = TAILLE_CIBLE,
    graine: int = GRAINE,
    sortie: str | Path = DEFAULT_SORTIE,
    *,
    preflight: bool = True,
    construit_le: str | None = None,
) -> dict:
    racine = Path(racine)
    if preflight:
        lancer_preflight(racine)
    artefact = construire_echantillon(
        racine, taille_cible, graine, construit_le=construit_le
    )
    ecrire(artefact, sortie)
    return artefact


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Construit l'échantillon stratifié reproductible (école de base × "
            "niveau_min) qui alimente la passe 0 de taxonomie. N'écrit rien "
            "sous data/."
        )
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE)
    parseur.add_argument("--taille-cible", type=int, default=TAILLE_CIBLE)
    parseur.add_argument("--graine", type=int, default=GRAINE)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    parseur.add_argument(
        "--construit-le",
        default=None,
        help=(
            "marqueur de construction ; par défaut `empreinte:<hash>`, dérivé du "
            "contenu du corpus pour rester reproductible octet à octet"
        ),
    )
    parseur.add_argument(
        "--sans-preflight",
        action="store_true",
        help=(
            "saute la garde d'entrée. Réservé aux tests hors ligne sur "
            "tests/fixtures/mini_corpus, qui n'est pas un dépôt complet (ni "
            "src/, ni schemas/, ni la Skill) et sur lequel le préflight "
            "échouerait légitimement."
        ),
    )
    args = parseur.parse_args(argv)
    # The summary carries accented French verbatim; on win32 both streams are
    # wired to the console codepage (cp1252), which mangles it.
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    artefact = run(
        args.racine,
        args.taille_cible,
        args.graine,
        args.sortie,
        preflight=not args.sans_preflight,
        construit_le=args.construit_le,
    )

    print(
        f"{artefact['nb_sorts_corpus']} sorts -> {artefact['nb_strates']} strates "
        f"(école de base × niveau_min) ; échantillon de {artefact['taille']} ids "
        f"(cible {artefact['taille_cible']}, écart "
        f"{artefact['ecart_taille_cible']:+d}, bande "
        f"{BANDE_MIN}-{BANDE_MAX} : "
        f"{'OK' if artefact['dans_la_bande'] else 'HORS BANDE'})"
    )
    print(
        f"couverture : {artefact['couverture']['ecoles']} écoles, "
        f"{artefact['couverture']['niveaux']} niveaux ; "
        f"construit_le = {artefact['construit_le']}"
    )
    print(f"écrit : {args.sortie}")

    sous = artefact["strates_sous_plancher"]
    if sous:
        print(
            f"ATTENTION : {len(sous)} strate(s) sous le plancher de {PLANCHER} — "
            "elles contribuent tous leurs membres, sans remise ni remplissage : "
            + ", ".join(f"{s['strate']} ({s['taille_strate']})" for s in sous),
            file=sys.stderr,
        )
    absentes = artefact["ecoles_absentes_de_l_echantillon"]
    if absentes:
        print(
            f"ATTENTION : école(s) du corpus absente(s) de l'échantillon : {absentes}",
            file=sys.stderr,
        )
    if artefact["ecoles_inattendues"]:
        print(
            "ATTENTION : école(s) de base hors des 9 attendues : "
            f"{artefact['ecoles_inattendues']}",
            file=sys.stderr,
        )
    desaccords = artefact["desaccords_niveau_min"]
    if desaccords:
        print(
            f"ATTENTION : {len(desaccords)} désaccord(s) niveau_min entre "
            "data/sorts/ et data/index/ — le fichier de sort fait foi, "
            "le détail est dans l'artefact",
            file=sys.stderr,
        )
    return 0 if artefact["dans_la_bande"] and not absentes else 1


if __name__ == "__main__":
    raise SystemExit(main())
