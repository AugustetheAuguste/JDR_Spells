"""Derived view: one file per spell holding the Phase 1 record plus its LLM layer.

Track B (web export) and Track C (documents to vectorise) both need "the spell,
with its enrichment". Left to themselves each would re-implement the join, and two
implementations of a join drift — one would fall back on the filename, the other on
`nom`, and the corpus would quietly acquire two answers to "which enrichment
belongs to this spell". So the join is done once, here, on `id` alone, and written
out as an artefact both tracks read.

Strictly offline. Nothing under `data/sorts/` or `data/enrichissements/` is opened
for writing; the only output tree is `data/vues/sorts_enrichis/`.

Four properties are load-bearing:

* **The 21 spell keys are copied verbatim, in their source order**, and the
  enrichment sits beside them under a single key. Not merged, not flattened, not
  renamed: the file must still read as "the spell, plus a box on the side", so that
  a consumer can tell a scraped fact from a generated one at a glance. This is why
  the output is NOT `sort_keys=True` (a departure from the step's pseudo-code,
  taken deliberately): sorting would interleave `enrichissement` among the scraped
  keys and destroy exactly that distinction.

* **A missing enrichment and an invalid one are different statuses.** Both leave
  `enrichissement: null`, but `sans_enrichissement` means "stage 09 has not covered
  this spell" and `enrichissement_invalide` means "it did, and the answer does not
  hold". A downstream consumer treats them differently, and collapsing them into
  one would hide a generation defect as a coverage gap.

* **An invalid record never aborts the build.** It is reported and its layer
  dropped. A 2 070-file build that dies on file 900 leaves a half-written tree that
  looks complete to whoever globs it.

* **Idempotence is byte-level.** `construit_le` is `null` unless `--horodater` is
  passed, so two runs over unchanged sources produce identical files. A wall clock
  written by default would make every file differ on every run and drown the real
  diff — the same reasoning as stage 08's manifest.

Validity is judged against `schemas/enrichissement.schema.json` with the closed
vocabularies injected (`enrichissement_schema.charger_schema_resolu`), so a widened
list needs no edit here. That is *shape and vocabulary* only: whether each `preuve`
is really a substring of the source is stage 10's check, and this module does not
duplicate it — see `run`'s note on why the view must not become a second validator.

Output:
    data/vues/sorts_enrichis/<id>.json
    data/vues/sorts_enrichis/_rapport.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from pf_spells.enrichissement_schema import charger_schema_resolu, etiquette_taxonomie

build_vues_version = "1.0.0"

DEFAULT_RACINE = "."
DEFAULT_SORTIE = "data/vues/sorts_enrichis"
DEFAULT_SORTS = "data/sorts"
DEFAULT_ENRICHISSEMENTS = "data/enrichissements"

FICHIER_RAPPORT = "_rapport.json"
CHEMIN_INDEX = Path("data") / "index" / "sorts_uniques.jsonl"

# The three statuses, exhaustive and mutually exclusive. Enumerated because the
# report counts them by name and a typo would silently split one bucket in two.
STATUT_OK = "ok"
STATUT_SANS = "sans_enrichissement"
STATUT_INVALIDE = "enrichissement_invalide"
STATUTS: tuple[str, ...] = (STATUT_OK, STATUT_SANS, STATUT_INVALIDE)

# View keys appended after the spell's own 21. `hash_vue` is what makes a hand edit
# detectable: it covers the whole view except itself and `construit_le`, so a run
# can tell "this file is what I would write" from "someone changed it".
CLES_VUE: tuple[str, ...] = (
    "enrichissement",
    "statut_enrichissement",
    "construit_le",
    "hash_sort",
    "hash_vue",
)

_REMPLACEMENT = chr(0xFFFD)


class BuildVuesError(RuntimeError):
    """A premise of the run is wrong, so the tree is not touched."""


def _maintenant() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _lire_json(chemin: Path) -> Any:
    """Decode UTF-8 explicitly; a U+FFFD anywhere is corruption, never content."""
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise BuildVuesError(
            f"U+FFFD dans {chemin.as_posix()} : corruption d'encodage, pas une "
            "donnée — rien n'est écrit"
        )
    return json.loads(texte)


def serialiser(document: Any) -> str:
    """The exact on-disk text: indent 2, verbatim accents, LF, final newline.

    `sort_keys` is deliberately absent. See the module docstring: the reading order
    "the 21 scraped keys, then the generated box" is the point of the artefact.
    """
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def _hash_canonique(document: Any) -> str:
    """sha256 hex of a key-order-independent rendering of `document`.

    `sort_keys=True` *here* — this is a fingerprint, not the artefact, and a
    fingerprint that changes when a key moves would report a reordering as a
    content change.
    """
    texte = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()


def hash_vue(vue: dict[str, Any]) -> str:
    """Fingerprint of a view, excluding the two fields that must not enter it.

    `hash_vue` cannot cover itself, and `construit_le` is a wall clock: including it
    would make the fingerprint differ between two runs that produced identical
    content, which would report every file as hand-edited.
    """
    return _hash_canonique(
        {cle: valeur for cle, valeur in vue.items() if cle not in ("hash_vue", "construit_le")}
    )


def charger_ids(racine: Path) -> list[str]:
    """The corpus ids, from `data/index/`, sorted.

    The index is the authority on "which spells exist"; globbing `data/sorts/`
    would silently promote a stray file to a spell. Sorted so a `--only` or a
    partial run reads predictably.
    """
    chemin = racine / CHEMIN_INDEX
    if not chemin.is_file():
        raise BuildVuesError(
            f"index absent : {chemin.as_posix()} — la vue se construit sur "
            "l'ensemble faisant autorité, jamais sur un glob de data/sorts/"
        )
    ids: set[str] = set()
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if ligne.strip():
            ids.add(json.loads(ligne)["id"])
    if not ids:
        raise BuildVuesError(f"index vide : {chemin.as_posix()}")
    return sorted(ids)


def lancer_preflight(racine: Path) -> None:
    """Entry guard. A blocking verdict stops the build, with every reason named.

    `tools/preflight_corpus.py` is deliberately not a package (it must import with
    no PYTHONPATH), so it is loaded by path — the same way `echantillon_taxo` does.
    """
    import importlib.util

    chemin = racine / "tools" / "preflight_corpus.py"
    if not chemin.is_file():
        raise BuildVuesError(f"garde d'entrée introuvable : {chemin.as_posix()}")
    spec = importlib.util.spec_from_file_location("preflight_corpus", chemin)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise BuildVuesError(f"garde d'entrée non chargeable : {chemin.as_posix()}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["preflight_corpus"] = module
    spec.loader.exec_module(module)

    rapport = module.preflight(racine)
    if rapport.bloquantes:
        details = "\n".join(
            f"  - [{a.controle}] {a.id} : {a.detail}" for a in rapport.bloquantes
        )
        raise BuildVuesError(
            f"préflight {rapport.verdict} sur {racine.as_posix()} : "
            f"{len(rapport.bloquantes)} anomalie(s) bloquante(s)\n{details}"
        )


def _erreurs_de_schema(enr: Any, validateur: Any) -> list[dict[str, Any]]:
    """Schema faults, sorted by path so two runs report a file identically."""
    if not isinstance(enr, dict):
        return [{"champ": "(racine)", "message": "le document n'est pas un objet JSON"}]
    return [
        {
            "champ": "/".join(str(p) for p in faute.absolute_path) or "(racine)",
            "message": faute.message,
        }
        for faute in sorted(
            validateur.iter_errors(enr), key=lambda e: list(e.absolute_path)
        )
    ]


def construire_vue(
    sort: dict[str, Any],
    enrichissement: Any,
    *,
    validateur: Any,
    horodatage: str | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Join one spell with one enrichment. Pure: no reading, no writing.

    Returns the view and the schema faults that downgraded it, so the caller can
    report *why* a layer was dropped rather than merely that it was.
    """
    erreurs: list[dict[str, Any]] = []
    if enrichissement is None:
        statut = STATUT_SANS
        couche: Any = None
    else:
        erreurs = _erreurs_de_schema(enrichissement, validateur)
        if erreurs:
            # Dropped, never repaired: a record that does not hold is fixed upstream
            # (prompt, taxonomy, source) and the pass re-run. Serving a patched copy
            # here would hide the defect that produced it.
            statut = STATUT_INVALIDE
            couche = None
        else:
            statut = STATUT_OK
            couche = enrichissement

    vue: dict[str, Any] = {
        **sort,  # the 21 keys, verbatim, in source order
        "enrichissement": couche,
        "statut_enrichissement": statut,
        "construit_le": horodatage,
        "hash_sort": _hash_canonique(sort),
    }
    vue["hash_vue"] = hash_vue(vue)
    return vue, erreurs


def _detecter_edition_manuelle(chemin: Path) -> bool:
    """True when an existing view is not what a build would have written.

    Self-consistency, not a git timestamp: `hash_vue` covers the whole document, so
    an edit to any field is caught, whereas a mtime says nothing about content and
    is wrong for every file right after a fresh clone. A view whose `hash_vue` is
    absent or stale was touched by something other than this builder.
    """
    try:
        existant = _lire_json(chemin)
    except (BuildVuesError, ValueError):
        # Unreadable or corrupt: not a file whose content we may silently discard.
        return True
    if not isinstance(existant, dict) or "hash_vue" not in existant:
        return True
    return existant["hash_vue"] != hash_vue(existant)


def ecrire(document: Any, chemin: Path) -> Path:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(serialiser(document), encoding="utf-8", newline="\n")
    return chemin


def run(
    racine: str | Path = DEFAULT_RACINE,
    *,
    sortie: str | Path = DEFAULT_SORTIE,
    sorts: str | Path = DEFAULT_SORTS,
    enrichissements: str | Path = DEFAULT_ENRICHISSEMENTS,
    racine_conventions: str | Path | None = None,
    seulement: Iterable[str] | None = None,
    force: bool = False,
    horodater: bool = False,
    preflight: bool = True,
) -> dict[str, Any]:
    """Build every view and the aggregate report. Offline; writes only under `sortie`.

    Two roots, deliberately separable — the same split stage 08 makes. `racine` is
    where the *corpus* lives, and `tests/fixtures/mini_corpus` is a drop-in for it.
    `racine_conventions` is where the schema and the closed vocabularies live; the
    fixture has none of its own, because those are repo-level frozen artefacts and
    giving the fixture a copy is precisely the duplication they exist to prevent.

    This stage judges an enrichment's *shape and vocabulary*, not the truth of its
    evidence. Re-checking `preuves` here would mean a second implementation of the
    substring rule living next to stage 10's, and two implementations of that rule
    is the failure the whole track is built to avoid. The `statut_enrichissement`
    therefore says "well-formed", and `python -m pf_spells.validate_enrichment
    --strict` remains what says "grounded".
    """
    racine = Path(racine)
    conventions = Path(racine_conventions) if racine_conventions is not None else Path(".")

    def _resoudre(valeur: str | Path) -> Path:
        chemin = Path(valeur)
        return chemin if chemin.is_absolute() else racine / chemin

    repertoire_sorts = _resoudre(sorts)
    repertoire_enr = _resoudre(enrichissements)
    repertoire_sortie = _resoudre(sortie)

    if preflight:
        lancer_preflight(racine)
    if not repertoire_sorts.is_dir():
        raise BuildVuesError(
            f"répertoire des sorts absent : {repertoire_sorts.as_posix()} — la "
            "Phase 1 est l'entrée de cette vue, il n'y a rien à joindre"
        )

    from jsonschema import Draft202012Validator

    schema = charger_schema_resolu(conventions)
    validateur = Draft202012Validator(schema)
    version_taxonomie = etiquette_taxonomie(conventions)

    ids_index = charger_ids(racine)
    ids = ids_index
    if seulement is not None:
        voulus = set(seulement)
        inconnus = sorted(voulus - set(ids_index))
        if inconnus:
            raise BuildVuesError(f"--only hors de l'index : {inconnus}")
        ids = [sid for sid in ids_index if sid in voulus]

    horodatage = _maintenant() if horodater else None
    comptes = {statut: 0 for statut in STATUTS}
    ids_invalides: list[dict[str, Any]] = []
    ids_sans: list[str] = []
    protegees: list[str] = []
    ecrits = 0

    # An id present in data/enrichissements/ but absent from the index is an orphan,
    # and the Skill calls that an error rather than a warning: the join would be
    # silently incomplete, which is the one failure mode a shared view must not have.
    if repertoire_enr.is_dir():
        orphelins = sorted(
            {c.stem for c in repertoire_enr.glob("*.json")} - set(ids_index)
        )
        if orphelins:
            raise BuildVuesError(
                f"{len(orphelins)} enrichissement(s) orphelin(s), hors de "
                f"data/index/ : {orphelins[:10]} — la jointure ne se fait que sur "
                "`id`, un id inconnu de l'index est une erreur"
            )

    for sid in ids:
        chemin_sort = repertoire_sorts / f"{sid}.json"
        if not chemin_sort.is_file():
            raise BuildVuesError(
                f"sort de l'index sans fichier : {chemin_sort.as_posix()}"
            )
        sort = _lire_json(chemin_sort)

        chemin_enr = repertoire_enr / f"{sid}.json"
        enr: Any = None
        if chemin_enr.is_file():
            try:
                enr = _lire_json(chemin_enr)
            except ValueError as exc:
                # Unparseable JSON is a defect of the record, not of the corpus: the
                # view still describes a perfectly usable spell without its layer.
                enr = {"__illisible__": str(exc)}

        vue, erreurs = construire_vue(
            sort, enr, validateur=validateur, horodatage=horodatage
        )
        statut = vue["statut_enrichissement"]
        comptes[statut] += 1
        if statut == STATUT_INVALIDE:
            ids_invalides.append({"id": sid, "erreurs": erreurs})
        elif statut == STATUT_SANS:
            ids_sans.append(sid)

        chemin_vue = repertoire_sortie / f"{sid}.json"
        if not force and chemin_vue.is_file() and _detecter_edition_manuelle(chemin_vue):
            protegees.append(sid)
            continue
        # Written immediately, one file at a time: accumulating 2 070 joined
        # documents in memory buys nothing and makes a partial failure worse.
        ecrire(vue, chemin_vue)
        ecrits += 1

    rapport = {
        "total": len(ids),
        "ok": comptes[STATUT_OK],
        "sans_enrichissement": comptes[STATUT_SANS],
        "enrichissement_invalide": comptes[STATUT_INVALIDE],
        "ecrits": ecrits,
        "ids_invalides": ids_invalides,
        "ids_sans_enrichissement": ids_sans,
        "vues_protegees": protegees,
        "version_taxonomie": version_taxonomie,
        "build_vues_version": build_vues_version,
        "repertoire": repertoire_sortie.as_posix(),
        "construit_le": horodatage,
    }
    # Last, and only once every view is on disk: a report that exists while the
    # tree is half-written is a report that lies.
    ecrire(rapport, repertoire_sortie / FICHIER_RAPPORT)
    _verifier_absence_de_remplacement(repertoire_sortie, ids)
    return rapport


def _verifier_absence_de_remplacement(repertoire: Path, ids: list[str]) -> None:
    """Re-read what was produced and refuse to exit 0 on a U+FFFD.

    Checking the inputs is not enough: the failure this guards against is a decode
    or encode slip somewhere in the middle, and the only place it is observable is
    the bytes actually written.
    """
    coupables = [
        chemin.as_posix()
        for chemin in [repertoire / f"{sid}.json" for sid in ids]
        + [repertoire / FICHIER_RAPPORT]
        if chemin.is_file() and _REMPLACEMENT in chemin.read_text(encoding="utf-8")
    ]
    if coupables:
        raise BuildVuesError(
            f"U+FFFD dans {len(coupables)} vue(s) produite(s) : {coupables[:5]} — "
            "corruption d'encodage, la sortie n'est pas exploitable"
        )


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Construit la vue dérivée data/vues/sorts_enrichis/<id>.json : le sort "
            "de la Phase 1 joint sur `id` à son enrichissement. Hors ligne, "
            "idempotent. N'écrit ni dans data/sorts/ ni dans "
            "data/enrichissements/. Arbre DÉRIVÉ : ne jamais l'éditer à la main."
        ),
        allow_abbrev=False,
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    parseur.add_argument("--sorts", default=DEFAULT_SORTS)
    parseur.add_argument("--enrichissements", default=DEFAULT_ENRICHISSEMENTS)
    parseur.add_argument(
        "--racine-conventions",
        default=None,
        help=(
            "racine du schéma et des vocabulaires clos (défaut : le dépôt "
            "courant). À laisser tel quel : ces artefacts sont gelés et partagés, "
            "y compris quand --racine pointe sur une fixture"
        ),
    )
    parseur.add_argument("--only", nargs="+", metavar="ID", default=None)
    parseur.add_argument(
        "--force",
        action="store_true",
        help=(
            "réécrit même une vue modifiée à la main. Sans ce drapeau, une telle "
            "vue est laissée intacte et signalée"
        ),
    )
    parseur.add_argument(
        "--horodater",
        action="store_true",
        help=(
            "renseigne `construit_le` avec l'heure courante. Par défaut null, pour "
            "que deux exécutions produisent des fichiers identiques octet à octet"
        ),
    )
    parseur.add_argument(
        "--sans-preflight",
        action="store_true",
        help=(
            "saute la garde d'entrée. Réservé aux exécutions sur "
            "tests/fixtures/mini_corpus, qui porte des données valides mais n'est "
            "pas un dépôt complet (ni src/, ni schemas/, ni la Skill)"
        ),
    )
    args = parseur.parse_args(argv)
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    try:
        rapport = run(
            args.racine,
            sortie=args.sortie,
            sorts=args.sorts,
            enrichissements=args.enrichissements,
            racine_conventions=args.racine_conventions,
            seulement=args.only,
            force=args.force,
            horodater=args.horodater,
            preflight=not args.sans_preflight,
        )
    except (BuildVuesError, ValueError, KeyError) as exc:
        print(f"ABANDON : {exc}", file=sys.stderr)
        return 2

    print(f"vues : {rapport['total']} sorts, {rapport['ecrits']} écrites")
    print(f"  {STATUT_OK} : {rapport['ok']}")
    print(f"  {STATUT_SANS} : {rapport['sans_enrichissement']}")
    print(f"  {STATUT_INVALIDE} : {rapport['enrichissement_invalide']}")
    print(f"rapport : {(Path(rapport['repertoire']) / FICHIER_RAPPORT).as_posix()}")
    if rapport["vues_protegees"]:
        print(
            f"{len(rapport['vues_protegees'])} vue(s) modifiée(s) à la main, "
            "laissée(s) intacte(s) : "
            f"{rapport['vues_protegees'][:10]}\n"
            "data/vues/ est dérivé, vos modifications seraient perdues — corriger "
            "en amont (texte source, prompt, taxonomie) puis régénérer, ou passer "
            "--force pour les écraser",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
