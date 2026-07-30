"""Step 04, stage 1: the free-proposal pass over the stratified sample.

The ONLY network module this step adds, and the only one outside `09_enrich_llm`.
It asks the model, for each sampled spell and with no vocabulary imposed, for 3
to 7 short French labels. Deliberately unconstrained: handing it a list would
measure obedience, not discover the corpus's real vocabulary.

Three design points, each with a silent failure mode it avoids:

**On-demand, not batch.** RELEVÉ 2026-07-30, revu contre le compte réel : le
jeton porteur `AWS_BEARER_TOKEN_BEDROCK` ouvre `bedrock-runtime` **et** le plan de
contrôle (`list_model_invocation_jobs` répond). Ce n'est donc pas le plan de
contrôle qui bloque le batch — c'est **S3** : un job batch lit son lot d'entrée et
écrit sa sortie dans un bucket, et `s3` comme `sts` répondent
`NoCredentialsError` avec ce jeton. D'où l'appel direct à `converse`, sur un id de
**profil d'inférence** (`eu.…`) — l'id de modèle nu n'accepte que
`INFERENCE_PROFILE` et échoue à la validation : erreur de code, pas panne.

**Auditability over brevity.** Each output file records the exact text that was
sent, not just its hash. The cut that follows is made by a deterministic rule
rather than by a curator, so the raw pass *is* the justification: it must be
re-readable and replayable, or the taxonomy rests on nothing checkable.

**Resume by file presence, write immediately.** ~200 paid calls: losing progress
is losing money. A returned answer is on disk before the next call starts, and a
re-run skips every id that already has a file unless `--force` says otherwise.

`texte_source` here is deliberately local and modest. Step 05 defines *the*
shared canonical function used by the prompts and by evidence re-checking; this
pass predates it and must not pretend to be it — hence the recorded text.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

passe0_version = "1.0.0"

DEFAULT_RACINE = "."
DEFAULT_ECHANTILLON = "build_artifacts/echantillon_taxo.json"
DEFAULT_SORTIE = "build_artifacts/taxo_passe0"

# RELEVÉ 2026-07-29: an ACTIVE inference profile. The bare id cannot be invoked.
MODELE = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
REGION = "eu-central-1"
VARIABLE_JETON = "AWS_BEARER_TOKEN_BEDROCK"

MAX_TOKENS = 200
# Temperature 0: the pass is meant to be replayable, not creative.
TEMPERATURE = 0.0

# Politeness towards the endpoint, and towards the budget.
WORKERS = 4
TENTATIVES = 5
ATTENTE_BASE = 2.0

# The prompt, verbatim as the step words it, plus the A5 anti-confabulation
# clamp: the given text is the only admissible source. The English spell name is
# never sent — it is precisely the hook that would surface the memorised SRD.
CONSIGNE = (
    "Propose 3 à 7 étiquettes courtes en français décrivant ce que fait ce sort "
    "en jeu. Uniquement du snake_case. Aucune explication. Une étiquette par "
    "ligne."
)
GARDE_SOURCE = (
    "Le texte ci-dessous est ta SEULE source. N'utilise aucune connaissance "
    "externe de Pathfinder, ni du SRD anglais, ni d'un nom anglais de sort. "
    "Décris uniquement ce que ce texte dit."
)

# Order is fixed and part of what the output file records.
CHAMPS_BLOC = (
    "nom",
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
)

_REMPLACEMENT = chr(0xFFFD)


class Passe0Error(RuntimeError):
    """A blocking condition: the pass cannot honestly run or record its result."""


class ClientConverse(Protocol):
    """The one method this module needs — so tests can hand it a fake."""

    def converse(self, **kwargs: Any) -> dict[str, Any]: ...


def _maintenant() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def charger_echantillon(chemin: str | Path) -> list[str]:
    """Return the sampled ids, deduplicated, in sorted order.

    Sorted, not stratum order: the run order must not depend on dict traversal,
    so a partial run followed by a resume covers a predictable prefix.
    """
    chemin = Path(chemin)
    if not chemin.is_file():
        raise Passe0Error(f"échantillon absent : {chemin}")
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    ids = {sid for membres in doc["strates"].values() for sid in membres}
    if not ids:
        raise Passe0Error(f"échantillon vide : {chemin}")
    return sorted(ids)


def verifier_empreinte(racine: Path, chemin_echantillon: Path) -> str:
    """Entry guard: refuse to spend calls against a corpus the sample predates.

    The sample records the fingerprint of the corpus it was drawn from. If
    `data/sorts/` has moved since, the drawn ids no longer describe the corpus
    the taxonomy will be applied to, and paying for 200 calls on a stale draw
    buys evidence for a question nobody asked. Recomputed here rather than
    trusted, because a mismatch is cheap to detect and expensive to discover
    downstream.
    """
    from pf_spells import echantillon_taxo as et

    doc = json.loads(chemin_echantillon.read_text(encoding="utf-8"))
    attendue = doc.get("empreinte_corpus")
    if not attendue:
        raise Passe0Error(
            f"échantillon sans `empreinte_corpus` : {chemin_echantillon} — "
            "impossible de garantir qu'il décrit le corpus courant"
        )
    sorts, _ = et.charger_sorts(racine, et.charger_index(racine))
    obtenue = et.empreinte_corpus(sorts)
    if obtenue != attendue:
        raise Passe0Error(
            "le corpus a changé depuis le tirage de l'échantillon : empreinte "
            f"attendue {attendue[:16]}…, calculée {obtenue[:16]}… — retirer "
            "l'échantillon (étape 03) avant de repayer des appels"
        )
    return obtenue


def texte_source(sort: dict[str, Any]) -> str:
    """Assemble the stat block plus the description, one `champ: valeur` per line.

    Local and modest on purpose (see the module docstring). Accents and
    punctuation are kept verbatim; only line endings are normalised.
    """
    lignes: list[str] = []
    for champ in CHAMPS_BLOC:
        valeur = sort.get(champ)
        if valeur is None or valeur == [] or valeur == {}:
            continue
        if isinstance(valeur, dict):
            rendu = ", ".join(f"{k} {v}" for k, v in valeur.items())
        elif isinstance(valeur, list):
            rendu = ", ".join(str(v) for v in valeur)
        else:
            rendu = str(valeur)
        lignes.append(f"{champ}: {rendu}")
    description = (sort.get("description") or "").strip()
    if description:
        lignes.append("")
        lignes.append(description)
    texte = "\n".join(lignes).replace("\r\n", "\n").replace("\r", "\n")
    if _REMPLACEMENT in texte:
        raise Passe0Error(
            f"U+FFFD dans le texte source de {sort.get('id')!r} : corruption "
            "d'encodage, rien n'est envoyé"
        )
    return texte


def hash_texte(texte: str) -> str:
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()


def charger_sort(racine: Path, sid: str) -> dict[str, Any]:
    chemin = racine / "data" / "sorts" / f"{sid}.json"
    if not chemin.is_file():
        raise Passe0Error(f"sort de l'échantillon sans fichier : {chemin}")
    return json.loads(chemin.read_text(encoding="utf-8"))


def analyser_reponse(texte: str) -> list[str]:
    """Extract one label per line, keeping the model's order, dropping noise.

    The pass is unconstrained, so the answer is only *asked* to be snake_case.
    Lines that are plainly not a label (bullets, prose, empty) are dropped;
    anything kept is recorded raw so the aggregation sees what was really said.
    """
    etiquettes: list[str] = []
    for ligne in texte.replace("\r\n", "\n").splitlines():
        candidat = ligne.strip().strip("-*•\t ").strip()
        if not candidat or " " in candidat or len(candidat) > 60:
            continue
        if candidat.endswith((":", ".")):
            candidat = candidat.rstrip(":.")
        if not candidat:
            continue
        etiquettes.append(candidat)
    # Same label twice in one answer is one label for that spell.
    vus: set[str] = set()
    uniques = []
    for e in etiquettes:
        if e not in vus:
            vus.add(e)
            uniques.append(e)
    return uniques


def construire_client(region: str = REGION) -> ClientConverse:
    """Build the bedrock-runtime client. Called at run time, never at import.

    Fails loudly on a missing token rather than letting boto3 produce an opaque
    credentials error three layers down.
    """
    if not os.environ.get(VARIABLE_JETON):
        raise Passe0Error(
            f"{VARIABLE_JETON} absente de l'environnement : le plan de données "
            "bedrock-runtime est inatteignable, aucun appel n'est tenté"
        )
    import boto3  # local import: importing this module must cost nothing

    return boto3.client("bedrock-runtime", region_name=region)


def appeler(
    client: ClientConverse,
    texte: str,
    modele: str = MODELE,
    *,
    tentatives: int = TENTATIVES,
    dormir: Any = time.sleep,
) -> dict[str, Any]:
    """One `converse` call, retried with jittered backoff on throttling.

    Retries only on transient conditions; a validation error is a bug and must
    surface immediately instead of being hammered four more times.
    """
    message = f"{GARDE_SOURCE}\n\n{CONSIGNE}\n\n---\n{texte}\n---"
    derniere: Exception | None = None
    for essai in range(tentatives):
        try:
            return client.converse(
                modelId=modele,
                messages=[{"role": "user", "content": [{"text": message}]}],
                inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": TEMPERATURE},
            )
        except Exception as exc:  # noqa: BLE001 - the class is botocore's, not ours
            nom = type(exc).__name__
            transitoire = any(
                marque in f"{nom} {exc}"
                for marque in (
                    "Throttling",
                    "TooManyRequests",
                    "ServiceUnavailable",
                    "ModelTimeout",
                    "InternalServer",
                    "ConnectionError",
                    "ReadTimeout",
                )
            )
            derniere = exc
            if not transitoire or essai == tentatives - 1:
                raise
            dormir(ATTENTE_BASE * (2**essai) * (0.5 + random.random()))
    raise Passe0Error(f"appel épuisé sans réponse : {derniere}")  # pragma: no cover


def serialiser(enregistrement: dict[str, Any]) -> str:
    return json.dumps(enregistrement, ensure_ascii=False, indent=2) + "\n"


def ecrire(enregistrement: dict[str, Any], chemin: Path) -> Path:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(serialiser(enregistrement), encoding="utf-8", newline="\n")
    return chemin


def traiter_un(
    client: ClientConverse,
    racine: Path,
    sid: str,
    sortie: Path,
    modele: str = MODELE,
) -> dict[str, Any]:
    """Call the model for one id and write its file before returning."""
    sort = charger_sort(racine, sid)
    texte = texte_source(sort)
    reponse = appeler(client, texte, modele)
    brut = "".join(
        bloc.get("text", "") for bloc in reponse["output"]["message"]["content"]
    )
    usage = reponse.get("usage") or {}
    enregistrement = {
        "id": sid,
        "etiquettes": analyser_reponse(brut),
        "modele": modele,
        "genere_le": _maintenant(),
        "passe0_version": passe0_version,
        "hash_source": hash_texte(texte),
        "texte_envoye_hash": hash_texte(texte),
        "texte_envoye": texte,
        "consigne": CONSIGNE,
        "garde_source": GARDE_SOURCE,
        "reponse_brute": brut,
        "usage": {
            "inputTokens": usage.get("inputTokens"),
            "outputTokens": usage.get("outputTokens"),
        },
        "arret": reponse.get("stopReason"),
    }
    ecrire(enregistrement, sortie / f"{sid}.json")
    return enregistrement


def run(
    racine: str | Path = DEFAULT_RACINE,
    echantillon: str | Path = DEFAULT_ECHANTILLON,
    sortie: str | Path = DEFAULT_SORTIE,
    *,
    client: ClientConverse | None = None,
    modele: str = MODELE,
    region: str = REGION,
    limite: int | None = None,
    seulement: list[str] | None = None,
    force: bool = False,
    workers: int = WORKERS,
    empreinte: bool = True,
) -> dict[str, Any]:
    """Run the pass and return its summary. Writes only under `sortie`.

    `empreinte=False` skips the fingerprint guard: `tests/fixtures/mini_corpus`
    is a drop-in `racine` but carries its own sample, so the real corpus
    fingerprint legitimately does not apply there.
    """
    racine = Path(racine)
    sortie = Path(sortie)
    chemin_echantillon = (
        Path(echantillon)
        if Path(echantillon).is_absolute()
        else racine / echantillon
    )
    ids = charger_echantillon(chemin_echantillon)
    if empreinte:
        verifier_empreinte(racine, chemin_echantillon)
    if seulement:
        inconnus = sorted(set(seulement) - set(ids))
        if inconnus:
            raise Passe0Error(f"--only hors échantillon : {inconnus}")
        ids = [sid for sid in ids if sid in set(seulement)]

    a_faire = [sid for sid in ids if force or not (sortie / f"{sid}.json").is_file()]
    sautes = len(ids) - len(a_faire)
    if limite is not None:
        a_faire = a_faire[:limite]

    resume: dict[str, Any] = {
        "demandes": len(ids),
        "sautes": sautes,
        "tentes": len(a_faire),
        "reussis": 0,
        "echecs": [],
        "inputTokens": 0,
        "outputTokens": 0,
        "modele": modele,
    }
    if not a_faire:
        return resume

    if client is None:
        client = construire_client(region)

    # Modest concurrency, and every result on disk the moment it lands.
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futurs = {
            pool.submit(traiter_un, client, racine, sid, sortie, modele): sid
            for sid in a_faire
        }
        for futur in concurrent.futures.as_completed(futurs):
            sid = futurs[futur]
            try:
                enregistrement = futur.result()
            except Exception as exc:  # noqa: BLE001 - reported, never swallowed
                resume["echecs"].append({"id": sid, "erreur": f"{type(exc).__name__}: {exc}"})
                continue
            resume["reussis"] += 1
            resume["inputTokens"] += enregistrement["usage"]["inputTokens"] or 0
            resume["outputTokens"] += enregistrement["usage"]["outputTokens"] or 0
    resume["echecs"].sort(key=lambda e: e["id"])
    return resume


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Passe 0 de taxonomie : proposition libre d'étiquettes par le modèle "
            "sur l'échantillon stratifié. Chemin on-demand (bedrock-runtime "
            "converse), reprise par présence de fichier. N'écrit rien sous data/."
        )
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE)
    parseur.add_argument("--echantillon", default=DEFAULT_ECHANTILLON)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    parseur.add_argument("--modele", default=MODELE)
    parseur.add_argument("--region", default=REGION)
    parseur.add_argument("--limit", type=int, default=None)
    parseur.add_argument("--only", action="append", default=None)
    parseur.add_argument("--workers", type=int, default=WORKERS)
    parseur.add_argument(
        "--force",
        action="store_true",
        help="rappelle le modèle même si le fichier existe déjà (repaie l'appel)",
    )
    parseur.add_argument(
        "--sans-empreinte",
        action="store_true",
        help=(
            "saute la garde d'empreinte de corpus — réservé aux racines de test ; "
            "en production, une empreinte qui diverge signale un échantillon périmé"
        ),
    )
    args = parseur.parse_args(argv)
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    if args.workers > WORKERS:
        print(
            f"ATTENTION : --workers {args.workers} ramené à {WORKERS} — la "
            "politesse envers l'endpoint n'est pas un réglage de performance",
            file=sys.stderr,
        )
        args.workers = WORKERS

    resume = run(
        args.racine,
        args.echantillon,
        args.sortie,
        modele=args.modele,
        region=args.region,
        limite=args.limit,
        seulement=args.only,
        force=args.force,
        workers=args.workers,
        empreinte=not args.sans_empreinte,
    )

    print(
        f"passe 0 : {resume['demandes']} ids demandés, {resume['sautes']} déjà "
        f"présents, {resume['tentes']} tentés, {resume['reussis']} réussis, "
        f"{len(resume['echecs'])} en échec"
    )
    print(
        f"jetons : {resume['inputTokens']} en entrée, "
        f"{resume['outputTokens']} en sortie ; modèle {resume['modele']}"
    )
    print(f"écrit : {args.sortie}/<id>.json")
    for echec in resume["echecs"]:
        print(f"ÉCHEC {echec['id']} : {echec['erreur']}", file=sys.stderr)
    return 0 if not resume["echecs"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
