"""Stage 10 driver: prove every enrichment against the source it claims to describe.

Stage 09 asks a model to answer in a closed vocabulary and to justify three of its
answers by **copying exact substrings** of the text it was shown. This module is
the other half of that contract: it re-reads the same text and re-checks each
substring with `preuve in texte`. The schema proves a claim is *well-formed*; only
this check proves it is *grounded*. Either alone protects nothing — a confabulated
`type_degats` is perfectly schema-valid.

Three properties are deliberate and load-bearing:

* **Nothing is repaired.** A record that fails is reported and rejected, never
  rewritten. `data/enrichissements/` is regenerable (`pf-enrichment-conventions`):
  a wrong record is fixed upstream — prompt, taxonomy, source text — and the pass
  is re-run. Patching the output here would hide the defect that produced it.
* **Nothing under `data/` is written**, opened for writing, or created. The only
  output is a JSON report under `build_artifacts/rapports/`.
* **Errors aggregate by type.** "200 records failed" drives no decision; "190
  failed on `preuve_absente_du_source`" names the fix. Every verdict carries a
  machine-readable error code, and the report counts them.

There is no human-review key and no lock. The contract is 16 machine-produced
keys (schema, `additionalProperties: false`), so this stage validates *every*
record in full, with no exemption path — a `verifie_par_humain` branch would
contradict the schema it validates against.

Output:
    build_artifacts/rapports/validation_enrichissement.json

Exit code 0 always, unless `--strict`, which returns 1 when any record failed, so
it can gate CI or a merge the way `validate_corpus` does.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from pf_spells.enrichissement_schema import charger_schema_resolu, etiquette_taxonomie
from pf_spells.texte_source import (
    TexteSourceError,
    hash_source,
    texte_source_canonique,
)

validate_enrichment_version = "1.0.0"

DEFAULT_ENRICHISSEMENTS = "data/enrichissements"
DEFAULT_SORTS = "data/sorts"
DEFAULT_RAPPORTS = "build_artifacts/rapports"
FICHIER_RAPPORT = "validation_enrichissement.json"
CHEMIN_INDEX = Path("data") / "index" / "sorts_uniques.jsonl"

# The Skill is the written authority these checks encode; the path is reported so
# a reader knows which revision the run was judged against.
SKILL_PATH = Path(".claude/skills/pf-enrichment-conventions/SKILL.md")

# `notes_ambiguite` non-null share above this means the closed lists lack a case
# the corpus really contains. The response is to cut a new taxonomy version — hence
# a reported flag, not an automatic correction.
#
# Raised from 0.05 to 0.50 on 2026-07-31 by human arbitrage, after the 950 notes of
# the p1.4/p1.5 pass were reviewed one by one and accepted. The count in
# `docs/enrichissement.md` § 4.1 is why: 891 of the 950 are glose on an otherwise
# valid choice, so the measure was reading prompt wording, not a gap in the lists.
# The reviewed conclusion was that the records are sound as they stand.
#
# What this costs, stated because it is the reason the old value was called
# non-negotiable: at 0.50 the flag no longer detects a *regression* in ambiguity
# until the rate nearly doubles. Anyone re-tightening the field wording should
# lower this in the same commit, so the measure regains its edge.
SEUIL_AMBIGUITE = 0.50

# U+FFFD by codepoint: spelling it literally would make this file trip the
# encoding check it exists to enforce.
_REMPLACEMENT = chr(0xFFFD)

# U+2019 RIGHT SINGLE QUOTATION MARK vs U+0027 APOSTROPHE. See `_plier`.
_APOSTROPHE_TYPO = chr(0x2019)
_APOSTROPHE_ASCII = chr(0x27)

# Every error code this module can emit. Enumerated because the report's
# `par_type_erreur` is read by humans tuning the prompt, and a typo in a code
# string would silently split one bucket into two. `test_validate_enrichment`
# asserts that no verdict carries a code absent from this tuple.
CODES_ERREUR: tuple[str, ...] = (
    "json_illisible",
    "encodage_corrompu",
    "schema_invalide",
    "hors_taxonomie",
    "sort_absent",
    "id_hors_index",
    "id_ne_correspond_pas_au_fichier",
    "texte_source_indisponible",
    "preuve_absente_du_source",
    "preuve_pour_valeur_nulle",
    "preuve_manquante",
    "derive_source",
)


class ValidateEnrichmentError(RuntimeError):
    """A premise of the run is wrong, so no report is written."""


def _maintenant() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class EncodageCorrompu(ValueError):
    """A U+FFFD was found. It is never a content character, only ever corruption."""


def _lire_json(chemin: Path) -> Any:
    """Decode UTF-8 explicitly; a U+FFFD anywhere is corruption, never content."""
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        # A dedicated type, not a substring sniff on the message: the caller must
        # distinguish corruption from bad syntax, and matching on message text
        # would break the moment the wording changes.
        raise EncodageCorrompu(f"U+FFFD dans {chemin} : corruption d'encodage")
    return json.loads(texte)


def ecrire_atomique(document: Any, chemin: Path) -> Path:
    """Write via a temp file and `os.replace` so no reader sees a partial report."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    temporaire = chemin.with_name(f"{chemin.name}.{os.getpid()}.tmp")
    texte = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    try:
        temporaire.write_text(texte, encoding="utf-8", newline="\n")
        os.replace(temporaire, chemin)
    except BaseException:
        temporaire.unlink(missing_ok=True)
        raise
    return chemin


def _plier(texte: str) -> str:
    """Fold the two differences of *representation* that are not differences of content.

    The evidence rule is a literal substring match, and it stays literal: accents,
    case, spacing, wording and the wiki's own typos are all compared as-is, because
    loosening any of those is precisely what would let a reworded confabulation
    through. Two exceptions, both provably representational rather than semantic:

    1. **Unicode NFC** on both sides. `é` as one codepoint and as `e`+U+0301 are the
       same character differently encoded.
    2. **The typographic apostrophe.** The wiki writes `d’énergie` with U+2019; the
       model reliably answers `d'énergie` with U+0027. Measured over the real
       corpus: 292 of 2 792 evidence strings failed the literal test, **276 of them
       differ by nothing but this codepoint**, and NFC folds exactly zero of them
       (NFC does not map U+2019 to U+0027 — they are distinct characters, not two
       encodings of one). Without this fold, 9.9 % of evidence would be rejected as
       confabulation while quoting the source correctly, which would bury the 16
       real paraphrases underneath the noise and make the report useless for the
       one job it has: telling a prompt problem from a taxonomy problem.

    The fold is applied to BOTH sides, so it can only ever accept a quote that is
    right about every character that carries meaning. It cannot accept a
    substitution, an omission, or a rewording. Notably it does NOT rescue
    `'est etourdi'` for `est étourdi` — dropping an accent is still a rejection.
    """
    return unicodedata.normalize("NFC", texte).replace(
        _APOSTROPHE_TYPO, _APOSTROPHE_ASCII
    )


def _atteste(preuve: str, source_pliee: str) -> bool:
    """True when `preuve` really occurs in the source text."""
    return _plier(preuve) in source_pliee


@dataclass
class Verdict:
    """The outcome for one enrichment record. `ok` iff `erreurs` is empty."""

    id: str
    ok: bool
    erreurs: list[dict[str, Any]] = field(default_factory=list)
    notes_ambiguite: bool = False
    derive_source: bool = False

    def en_json(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "ok": self.ok,
            "erreurs": self.erreurs,
            "notes_ambiguite": self.notes_ambiguite,
            "derive_source": self.derive_source,
        }


def _erreur(code: str, message: str, **details: Any) -> dict[str, Any]:
    return {"code": code, "message": message, **details}


def charger_index(racine: Path) -> set[str] | None:
    """Return the authoritative id set, or None when the index is absent.

    An enrichment whose id is not in the index is an orphan, and the Skill calls
    that an error rather than a warning. The index is optional here only so the
    validator can run against a fixture tree that has no `data/index/`; when it is
    present it is enforced.
    """
    chemin = racine / CHEMIN_INDEX
    if not chemin.is_file():
        return None
    ids: set[str] = set()
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if ligne.strip():
            ids.add(json.loads(ligne)["id"])
    return ids


def _valider_taxonomie(
    enr: dict[str, Any], schema: dict[str, Any]
) -> list[dict[str, Any]]:
    """Re-check the closed-list membership of every enumerated field.

    The resolved schema already rejects an out-of-vocabulary value, but it reports
    it as a generic `enum` violation buried in a JSON Pointer. This pass restates
    the same truth with a dedicated code and the field name, because "which closed
    list is short of a case" is the single most actionable line of the report — it
    is what decides whether to cut a taxonomy v3.

    Reading the enums back out of the resolved schema keeps
    `data/conventions/vocabulaires/` the only home of each list: no list is hard-coded
    here, and a widened list needs no edit in this module.
    """
    defs = schema["$defs"]
    scalaires = (
        ("categorie_principale", "vocabulaire_categories"),
        ("cible_typique", "vocabulaire_cibles"),
        ("type_degats", "vocabulaire_types_degats"),
    )
    listes = (
        ("tags", "vocabulaire_tags"),
        ("roles_tactiques", "vocabulaire_roles_tactiques"),
        ("condition_infligee", "vocabulaire_conditions"),
    )
    erreurs: list[dict[str, Any]] = []
    for champ, nom_def in scalaires:
        valeur = enr.get(champ)
        # None is the corpus's "absent from the source", a legal value for
        # type_degats; it is not a vocabulary member and is not checked as one.
        if valeur is None:
            continue
        if valeur not in defs[nom_def]["enum"]:
            erreurs.append(
                _erreur(
                    "hors_taxonomie",
                    f"{champ} : {valeur!r} hors de la liste close",
                    champ=champ,
                    valeur=valeur,
                )
            )
    for champ, nom_def in listes:
        valeurs = enr.get(champ)
        if not isinstance(valeurs, list):
            continue
        for valeur in valeurs:
            if valeur not in defs[nom_def]["enum"]:
                erreurs.append(
                    _erreur(
                        "hors_taxonomie",
                        f"{champ} : {valeur!r} hors de la liste close",
                        champ=champ,
                        valeur=valeur,
                    )
                )
    return erreurs


def _valider_preuves(enr: dict[str, Any], source: str) -> list[dict[str, Any]]:
    """The anti-confabulation check: every claim must be quotable from the source.

    Runs on a record whose *shape* may already have failed the schema, so every
    access is defensive — a malformed `preuves` must produce an evidence error, not
    a TypeError that aborts the whole run on one bad file.
    """
    erreurs: list[dict[str, Any]] = []
    preuves = enr.get("preuves")
    if not isinstance(preuves, dict):
        # Shape is the schema's business; there is simply nothing to attest here.
        return erreurs
    pliee = _plier(source)

    # --- type_degats: a non-null value REQUIRES an attested quote.
    type_degats = enr.get("type_degats")
    preuve_degats = preuves.get("type_degats")
    if type_degats is not None:
        if not isinstance(preuve_degats, str) or not preuve_degats:
            erreurs.append(
                _erreur(
                    "preuve_manquante",
                    f"type_degats vaut {type_degats!r} sans preuve",
                    champ="preuves.type_degats",
                )
            )
        elif not _atteste(preuve_degats, pliee):
            erreurs.append(
                _erreur(
                    "preuve_absente_du_source",
                    "preuves.type_degats ne se trouve pas dans le texte source",
                    champ="preuves.type_degats",
                    preuve=preuve_degats,
                )
            )
    elif preuve_degats is not None:
        # Quoting the source to justify "the source says nothing" is incoherent,
        # and it corrupts the null-policy statistics the taxonomy cut depends on.
        erreurs.append(
            _erreur(
                "preuve_pour_valeur_nulle",
                "type_degats est null mais preuves.type_degats est renseignée",
                champ="preuves.type_degats",
                preuve=preuve_degats,
            )
        )

    # --- condition_infligee: attested quotes, but NOT a positional 1:1 pairing.
    #
    # The rule enforced is "a non-empty condition list must be backed by at least
    # one attested quote", not "exactly one quote per condition". A strict 1:1
    # pairing is not in the schema and is wrong about how the source reads: one
    # sentence can establish two conditions ("devient sourde ou aveugle" grounds
    # both `assourdi` and `aveugle`), and one condition can be worth quoting from
    # two places. Measured on the real corpus, 1:1 rejected exactly 2 records whose
    # evidence was in fact correct — a false rejection of the kind that teaches
    # readers to distrust the report.
    conditions = enr.get("condition_infligee")
    preuves_conditions = preuves.get("condition_infligee")
    if isinstance(conditions, list) and isinstance(preuves_conditions, list):
        if conditions and not preuves_conditions:
            erreurs.append(
                _erreur(
                    "preuve_manquante",
                    f"{len(conditions)} condition(s) sans aucune preuve",
                    champ="preuves.condition_infligee",
                )
            )
        if preuves_conditions and not conditions:
            # Quoting the source to justify an empty list is the same incoherence
            # as evidence for a null `type_degats`.
            erreurs.append(
                _erreur(
                    "preuve_pour_valeur_nulle",
                    "condition_infligee est vide mais des preuves sont fournies",
                    champ="preuves.condition_infligee",
                )
            )
        for rang, preuve in enumerate(preuves_conditions):
            if not isinstance(preuve, str) or not preuve:
                erreurs.append(
                    _erreur(
                        "preuve_manquante",
                        f"preuves.condition_infligee[{rang}] vide",
                        champ=f"preuves.condition_infligee[{rang}]",
                    )
                )
            elif not _atteste(preuve, pliee):
                erreurs.append(
                    _erreur(
                        "preuve_absente_du_source",
                        f"preuves.condition_infligee[{rang}] ne se trouve pas "
                        "dans le texte source",
                        champ=f"preuves.condition_infligee[{rang}]",
                        preuve=preuve,
                    )
                )

    # --- cible_typique: always non-null in the contract, so always attested.
    preuve_cible = preuves.get("cible_typique")
    if not isinstance(preuve_cible, str) or not preuve_cible:
        erreurs.append(
            _erreur(
                "preuve_manquante",
                "preuves.cible_typique absente ou vide",
                champ="preuves.cible_typique",
            )
        )
    elif not _atteste(preuve_cible, pliee):
        erreurs.append(
            _erreur(
                "preuve_absente_du_source",
                "preuves.cible_typique ne se trouve pas dans le texte source",
                champ="preuves.cible_typique",
                preuve=preuve_cible,
            )
        )
    return erreurs


def valider_un(
    chemin: Path,
    *,
    sorts: Path,
    schema: dict[str, Any],
    validateur: Any,
    index: set[str] | None = None,
) -> Verdict:
    """Validate one enrichment file end to end. Never raises, never writes."""
    identifiant = chemin.stem
    try:
        enr = _lire_json(chemin)
    except EncodageCorrompu as exc:
        return Verdict(identifiant, False, [_erreur("encodage_corrompu", str(exc))])
    except ValueError as exc:
        return Verdict(identifiant, False, [_erreur("json_illisible", str(exc))])
    if not isinstance(enr, dict):
        return Verdict(
            identifiant,
            False,
            [_erreur("json_illisible", "le document n'est pas un objet JSON")],
        )

    erreurs: list[dict[str, Any]] = []

    # 1. Shape. Sorted by path so two runs over the same file report identically.
    for faute in sorted(validateur.iter_errors(enr), key=lambda e: list(e.absolute_path)):
        chemin_champ = "/".join(str(p) for p in faute.absolute_path)
        erreurs.append(
            _erreur(
                "schema_invalide",
                faute.message,
                champ=chemin_champ or "(racine)",
                validateur=faute.validator,
            )
        )

    # 2. Closed vocabularies, restated with an actionable code.
    erreurs.extend(_valider_taxonomie(enr, schema))

    # 3. Join integrity. `id` is never recomputed here — it is the join key, and
    #    the filename must agree with it or the join breaks silently.
    identifiant_declare = enr.get("id")
    if isinstance(identifiant_declare, str) and identifiant_declare != identifiant:
        erreurs.append(
            _erreur(
                "id_ne_correspond_pas_au_fichier",
                f"id {identifiant_declare!r} dans {chemin.name}",
                attendu=identifiant,
            )
        )
    if index is not None and identifiant not in index:
        erreurs.append(
            _erreur(
                "id_hors_index",
                f"{identifiant!r} absent de data/index/ : enrichissement orphelin",
            )
        )

    # 4. Evidence and drift, both of which need the source text.
    chemin_sort = sorts / f"{identifiant}.json"
    if not chemin_sort.is_file():
        erreurs.append(
            _erreur("sort_absent", f"source introuvable : {chemin_sort.as_posix()}")
        )
        return _verdict(identifiant, erreurs, enr)
    try:
        sort = _lire_json(chemin_sort)
        source = texte_source_canonique(sort)
    except (ValueError, TexteSourceError) as exc:
        erreurs.append(_erreur("texte_source_indisponible", str(exc)))
        return _verdict(identifiant, erreurs, enr)

    erreurs.extend(_valider_preuves(enr, source))

    # Drift is REPORTED, never fixed: the stored record correctly describes a text
    # that has since changed, and only a re-run of stage 09 can make it current.
    derive = False
    attendu = hash_source(source)
    if enr.get("hash_source") != attendu:
        derive = True
        erreurs.append(
            _erreur(
                "derive_source",
                "le texte source a changé depuis la génération : régénérer "
                "l'enrichissement (étage 09), ne pas corriger ce fichier",
                hash_stocke=enr.get("hash_source"),
                hash_courant=attendu,
            )
        )
    return _verdict(identifiant, erreurs, enr, derive=derive)


def _verdict(
    identifiant: str,
    erreurs: list[dict[str, Any]],
    enr: dict[str, Any],
    *,
    derive: bool = False,
) -> Verdict:
    note = enr.get("notes_ambiguite")
    return Verdict(
        identifiant,
        not erreurs,
        erreurs,
        notes_ambiguite=isinstance(note, str) and bool(note.strip()),
        derive_source=derive,
    )


def fichiers_d_enrichissements(repertoire: Path) -> list[Path]:
    if not repertoire.is_dir():
        raise ValidateEnrichmentError(
            f"répertoire d'enrichissements absent : {repertoire.as_posix()} — "
            "lancer d'abord `python -m pf_spells.enrich_llm`"
        )
    return sorted(repertoire.glob("*.json"))


def construire_resume(verdicts: list[Verdict], *, taxonomie: str) -> dict[str, Any]:
    """Aggregate verdicts into the report body.

    `par_type_erreur` counts *error occurrences*, `echecs_par_type` counts
    *records* touched by each type. Both are needed and they differ: one record
    quoting three bad evidence strings is three occurrences of one problem, and
    reading either number as the other misjudges how widespread a defect is.
    """
    total = len(verdicts)
    ok = sum(1 for v in verdicts if v.ok)
    occurrences: Counter[str] = Counter()
    par_enregistrement: Counter[str] = Counter()
    for verdict in verdicts:
        codes = [erreur["code"] for erreur in verdict.erreurs]
        occurrences.update(codes)
        par_enregistrement.update(set(codes))
    ambigus = sum(1 for v in verdicts if v.notes_ambiguite)
    taux = (ambigus / total) if total else 0.0
    return {
        "total": total,
        "ok": ok,
        "echecs": total - ok,
        "par_type_erreur": dict(sorted(occurrences.items())),
        "echecs_par_type": dict(sorted(par_enregistrement.items())),
        "notes_ambiguite": ambigus,
        "taux_notes_ambiguite": round(taux, 4),
        "seuil_ambiguite": SEUIL_AMBIGUITE,
        "taxonomie_incomplete": taux > SEUIL_AMBIGUITE,
        "derive_source": [v.id for v in verdicts if v.derive_source],
        "echoues": [v.en_json() for v in verdicts if not v.ok],
        "version_taxonomie": taxonomie,
        "skill": SKILL_PATH.as_posix(),
        "validate_enrichment_version": validate_enrichment_version,
        "termine_le": _maintenant(),
    }


def run(
    racine: Path,
    *,
    enrichissements: str | Path = DEFAULT_ENRICHISSEMENTS,
    sorts: str | Path = DEFAULT_SORTS,
    racine_conventions: str | Path | None = None,
    only: Iterable[str] | None = None,
) -> tuple[dict[str, Any], list[Verdict]]:
    """Validate every present record and return the summary plus the verdicts.

    The absence of an enrichment is NOT an error of this stage — a spell with no
    record is the joined view's concern (its `sans_enrichissement` status), not a
    validation failure. This stage judges what exists.

    `racine` is the corpus root and may be a fixture; `racine_conventions` holds
    the schema and the frozen vocabularies, which are shared by every root. Same
    split, and the same default (`.`), as stages 08 and 09 and the view builder:
    a fixture must never need its own copy of the closed lists, because a second
    copy is a second answer to "what may this field contain".
    """

    def _resoudre(valeur: str | Path) -> Path:
        chemin = Path(valeur)
        return chemin if chemin.is_absolute() else racine / chemin

    conventions = (
        Path(racine_conventions) if racine_conventions is not None else Path(".")
    )
    repertoire = _resoudre(enrichissements)
    repertoire_sorts = _resoudre(sorts)
    schema = charger_schema_resolu(conventions)
    taxonomie = etiquette_taxonomie(conventions)
    index = charger_index(racine)

    from jsonschema import Draft202012Validator

    validateur = Draft202012Validator(schema)

    fichiers = fichiers_d_enrichissements(repertoire)
    if only is not None:
        voulus = set(only)
        fichiers = [c for c in fichiers if c.stem in voulus]

    verdicts = [
        valider_un(
            chemin,
            sorts=repertoire_sorts,
            schema=schema,
            validateur=validateur,
            index=index,
        )
        for chemin in fichiers
    ]
    return construire_resume(verdicts, taxonomie=taxonomie), verdicts


def _forcer_stdout_utf8() -> None:
    """Emit UTF-8 on stdout even where the console codepage is not (win32: cp1252)."""
    flux = getattr(sys.stdout, "reconfigure", None)
    if flux is not None:
        flux(encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Étage 10 : valide data/enrichissements/ contre le schéma, les "
            "vocabulaires clos et le texte source — chaque preuve doit être une "
            "sous-chaîne réelle du source. Hors ligne. N'écrit jamais dans data/ "
            "et ne corrige rien."
        ),
        allow_abbrev=False,
    )
    parseur.add_argument("--racine", default=".", help="racine du dépôt")
    parseur.add_argument("--enrichissements", default=DEFAULT_ENRICHISSEMENTS)
    parseur.add_argument("--sorts", default=DEFAULT_SORTS)
    parseur.add_argument("--rapports", default=DEFAULT_RAPPORTS)
    parseur.add_argument(
        "--racine-conventions",
        default=None,
        help=(
            "racine du schéma et des vocabulaires clos (défaut : le dépôt "
            "courant). À laisser tel quel : ces artefacts sont gelés et partagés, "
            "y compris quand --racine pointe sur une fixture"
        ),
    )
    parseur.add_argument(
        "--only", nargs="+", metavar="ID", help="ne valider que ces ids"
    )
    parseur.add_argument(
        "--strict",
        action="store_true",
        help="sortir en code 1 si au moins un enregistrement échoue (CI)",
    )
    args = parseur.parse_args(argv)
    _forcer_stdout_utf8()

    racine = Path(args.racine).resolve()
    try:
        resume, _ = run(
            racine,
            enrichissements=args.enrichissements,
            sorts=args.sorts,
            racine_conventions=args.racine_conventions,
            only=args.only,
        )
    except (ValidateEnrichmentError, ValueError, KeyError) as exc:
        print(f"ABANDON : {exc}", file=sys.stderr)
        return 2

    base = Path(args.rapports)
    chemin_rapport = ecrire_atomique(
        resume, (base if base.is_absolute() else racine / base) / FICHIER_RAPPORT
    )

    print(f"validés : {resume['total']}")
    print(f"  conformes : {resume['ok']}")
    print(f"  échecs    : {resume['echecs']}")
    for code, compte in resume["par_type_erreur"].items():
        print(f"    {code} : {compte}")
    print(
        f"  notes_ambiguite : {resume['notes_ambiguite']} "
        f"({resume['taux_notes_ambiguite']:.2%})"
    )
    if resume["taxonomie_incomplete"]:
        print(
            f"TAXONOMIE INCOMPLÈTE : {resume['taux_notes_ambiguite']:.2%} > "
            f"{SEUIL_AMBIGUITE:.0%} d'ambiguïté — élargir les listes closes et "
            "couper une nouvelle version, ne pas relâcher la validation",
            file=sys.stderr,
        )
    if resume["derive_source"]:
        print(
            f"DÉRIVE DU SOURCE : {len(resume['derive_source'])} enregistrement(s) "
            "décrivent un texte qui a changé — régénérer (étage 09)",
            file=sys.stderr,
        )
    print(f"rapport : {chemin_rapport.as_posix()}")
    return 1 if (args.strict and resume["echecs"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
