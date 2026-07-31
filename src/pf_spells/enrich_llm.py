"""Stage 09: send the assembled prompts to the model. The only network stage.

Reads `build_artifacts/prompts/<version>/`, writes one record per spell into
`data/enrichissements/<id>.json`. It records what the model answered plus the
provenance, and **judges nothing**: stage 10 judges. Mixing the two would make
the prompt's real failure rate unmeasurable, because a record rejected for bad
content would be indistinguishable from one never generated.

**On-demand only.** The plan foresaw a Bedrock batch path at half price; it is not
buildable with this account. RELEVÉ 2026-07-30: the bearer token opens
`bedrock-runtime` and the control plane, but `s3` and `sts` both answer
`NoCredentialsError` — and a batch job reads its input lot from a bucket and
writes its output to one. There is no batch without S3, so `--mode batch` is not
offered rather than offered and broken.

**Money is the hazard here, so spending is bounded by construction.** This is the
only module in the repo whose bugs cost money, and a runaway loop is worse than a
crash. Hence, in order of how much they save:

- `PLAFOND_APPELS_DEFAUT` caps calls per run. Reaching it stops the run cleanly
  rather than continuing; there is no flag that removes the cap, only one that
  raises it, and raising it is a typed number, not a `--yes`.
- Prompt caching is on. The system block is 88 % of input characters and is
  identical for every spell, so a cache read replaces it at a tenth of the price:
  measured ~$9.90 → ~$4.97 for the full corpus. `resume["cache"]` reports reads
  and writes; if reads stay at zero the cache is broken and the run is silently
  paying double, which is why the summary prints them.
- Resume is checked *before* the call, on `hash_source` — never pay twice for a
  record already on disk and current.
- Above `SEUIL_CONFIRMATION` records, an interactive run refuses to start without
  a typed confirmation, after printing the offline estimate. Non-interactive runs
  require `--oui` instead, so cron cannot spend by default.
- A failure rate above `SEUIL_ARRET_ECHECS` trips a circuit breaker and aborts.
  A bad model id or a revoked token fails every call identically; without this,
  2 070 doomed calls get paid for one at a time.

**Nothing dubious enters `data/`.** A malformed answer, a mismatched id or a
schema violation goes to `build_artifacts/quarantaine/<id>.json` with the raw text
and the reason. Writes are atomic (temp + `os.replace`), so an interrupted run
leaves no truncated JSON behind.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import random
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from pf_spells.enrichissement_schema import charger_schema_resolu, etiquette_taxonomie

enrich_llm_version = "1.0.0"

DEFAULT_RACINE = "."
DEFAULT_PROMPTS = "build_artifacts/prompts"
DEFAULT_SORTIE = "data/enrichissements"
DEFAULT_QUARANTAINE = "build_artifacts/quarantaine"
DEFAULT_RAPPORTS = "build_artifacts/rapports"

# RELEVÉ 2026-07-30: an ACTIVE inference profile. The bare model id supports only
# `INFERENCE_PROFILE` and fails validation — a coding error, not an outage.
MODELE = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
REGION = "eu-central-1"
VARIABLE_JETON = "AWS_BEARER_TOKEN_BEDROCK"

TEMPERATURE = 0.0

# Politeness and budget. Eight is the plan's floor; the prompts are large, and
# there is nothing to win by hammering the endpoint harder.
CONCURRENCE = 8
TENTATIVES = 3
ATTENTE_BASE = 2.0

# --- The spending guards. Every one of these is deliberately conservative. ---

# Hard ceiling on calls in a single run. 2 070 covers exactly one full corpus
# pass; anything above it means a loop, a bad filter, or a `--force` nobody meant.
PLAFOND_APPELS_DEFAUT = 2100

# Above this, a run must be confirmed. Chosen so the whole tuning loop the track
# expects — a 12-spell fixture, a 50-spell smoke run — stays friction-free, while
# a full pass never starts by accident.
SEUIL_CONFIRMATION = 100

# Circuit breaker: once this many calls have been made and this fraction failed,
# stop. A revoked token or a wrong model id fails 100 % identically.
MINIMUM_AVANT_ARRET = 10
SEUIL_ARRET_ECHECS = 0.5

# Provenance keys this stage adds. The model is never asked for them: requesting
# its own model id or a timestamp invites it to invent both.
CHAMPS_PROVENANCE: tuple[str, ...] = (
    "version_prompt",
    "version_taxonomie",
    "modele",
    "genere_le",
    "hash_source",
)

FICHIER_MANIFESTE = "_manifeste.json"

_REMPLACEMENT = chr(0xFFFD)


class EnrichLLMError(RuntimeError):
    """A blocking condition: the run cannot proceed honestly or affordably."""


class ArretBudget(EnrichLLMError):
    """A spending guard fired. Distinct so tests can tell it from a real fault."""


class ClientConverse(Protocol):
    """The one method this module needs — so tests can hand it a fake."""

    def converse(self, **kwargs: Any) -> dict[str, Any]: ...


def _maintenant() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _lire_json(chemin: Path) -> Any:
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise EnrichLLMError(f"U+FFFD dans {chemin} : corruption d'encodage")
    return json.loads(texte)


def ecrire_atomique(document: Any, chemin: Path) -> Path:
    """Write via a temp file and `os.replace`, so readers never see a partial file.

    Mandatory here: a run interrupted mid-write must not leave truncated JSON in
    `data/enrichissements/`, where the next run would read it back as authoritative
    and stage 10 would report it as a model failure.
    """
    chemin.parent.mkdir(parents=True, exist_ok=True)
    temporaire = chemin.with_name(f"{chemin.name}.{os.getpid()}.tmp")
    texte = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    try:
        temporaire.write_text(texte, encoding="utf-8", newline="\n")
        os.replace(temporaire, chemin)
    except BaseException:
        # Includes KeyboardInterrupt: an aborted run must not leave debris either.
        temporaire.unlink(missing_ok=True)
        raise
    return chemin


def charger_manifeste(repertoire: Path) -> dict[str, Any]:
    chemin = repertoire / FICHIER_MANIFESTE
    if not chemin.is_file():
        raise EnrichLLMError(
            f"manifeste de prompts absent : {chemin} — lancer d'abord "
            "`python -m pf_spells.prepare_prompts`"
        )
    return _lire_json(chemin)


def verifier_taxonomie(racine: Path, manifeste: dict[str, Any]) -> None:
    """Entry guard: refuse to generate against a taxonomy the prompts predate.

    The prompts embed the closed lists as they stood when assembled. If the
    vocabularies have moved since, every answer would be validated at stage 10
    against lists the model was never shown — a full paid pass invalidated by a
    mismatch that costs nothing to detect here.
    """
    try:
        courante = etiquette_taxonomie(racine)
    except ValueError as exc:
        # An unreadable list is a refusal, not a traceback: this runs before the
        # first paid call and must say plainly why nothing was sent.
        raise EnrichLLMError(f"taxonomie illisible : {exc}") from exc
    attendue = manifeste.get("version_taxonomie")
    if courante != attendue:
        raise EnrichLLMError(
            f"les prompts ont été assemblés contre {attendue}, la taxonomie "
            f"courante est {courante} : réassembler les prompts (étage 08) avant "
            "de payer des appels"
        )


def fichiers_de_prompts(repertoire: Path) -> list[Path]:
    if not repertoire.is_dir():
        raise EnrichLLMError(f"répertoire de prompts absent : {repertoire}")
    return [c for c in sorted(repertoire.glob("*.json")) if c.name != FICHIER_MANIFESTE]


def a_faire(
    prompts: list[Path],
    sortie: Path,
    *,
    force: bool = False,
) -> tuple[list[Path], int]:
    """Split the prompts into (to send, already current).

    Resume is keyed on `hash_source` and `version_prompt`, not on file presence:
    a record whose spell text moved must be redone, and one whose text did not
    must never be paid for twice. Checked BEFORE any call, for that reason.
    """
    reste: list[Path] = []
    a_jour = 0
    for chemin in prompts:
        prompt = _lire_json(chemin)
        cible = sortie / f"{prompt['id']}.json"
        if not force and cible.is_file():
            try:
                existant = _lire_json(cible)
            except (json.JSONDecodeError, EnrichLLMError):
                # Unreadable means a previous run died mid-write; redo it.
                reste.append(chemin)
                continue
            if (
                existant.get("hash_source") == prompt["hash_source"]
                and existant.get("version_prompt") == prompt["version_prompt"]
            ):
                a_jour += 1
                continue
        reste.append(chemin)
    return reste, a_jour


def extraire_json(brut: str) -> dict[str, Any]:
    """Pull the JSON object out of an answer, tolerating a preamble or a fence.

    Tolerant about wrapping, strict about content: a fence or a stray sentence is
    a formatting quirk, but invalid JSON is quarantined rather than repaired.
    Guessing at a broken object would fabricate data and hide the prompt defect
    that stage 10's failure rate exists to measure.
    """
    texte = brut.strip()
    if texte.startswith("```"):
        # ```json … ``` — drop the fence line and anything after the closing one.
        lignes = texte.splitlines()
        lignes = lignes[1:]
        if lignes and lignes[-1].strip().startswith("```"):
            lignes = lignes[:-1]
        texte = "\n".join(lignes).strip()
    debut = texte.find("{")
    fin = texte.rfind("}")
    if debut == -1 or fin == -1 or fin <= debut:
        raise ValueError("aucun objet JSON dans la réponse")
    return json.loads(texte[debut : fin + 1])


def construire_client(region: str = REGION) -> ClientConverse:
    """Build the bedrock-runtime client. At run time, never at import.

    Fails loudly on a missing token rather than letting boto3 raise an opaque
    credentials error three layers down, mid-run, after some calls were paid for.
    """
    if not os.environ.get(VARIABLE_JETON):
        raise EnrichLLMError(
            f"{VARIABLE_JETON} absente de l'environnement : aucun appel n'est "
            "tenté. Le jeton passe par l'environnement, jamais par le dépôt."
        )
    import boto3  # local import: importing this module must cost nothing

    return boto3.client("bedrock-runtime", region_name=region)


def appeler(
    client: ClientConverse,
    prompt: dict[str, Any],
    modele: str = MODELE,
    *,
    tentatives: int = TENTATIVES,
    dormir: Any = time.sleep,
) -> dict[str, Any]:
    """One `converse` call, with the system block marked cacheable.

    The `cachePoint` after the system text is the cost lever, not an optimisation
    detail: that block is identical for all 2 070 spells and 88 % of the input, so
    a cache read replaces it at a tenth of the input price. Measured working
    2026-07-30 (`cacheWriteInputTokens` then `cacheReadInputTokens`). It only holds
    if the block is byte-identical across calls — which is stage 08's contract.

    Retries only on transient conditions: a validation error is a bug and must
    surface at once instead of being paid for three more times.
    """
    derniere: Exception | None = None
    for essai in range(tentatives):
        try:
            return client.converse(
                modelId=modele,
                system=[
                    {"text": prompt["systeme"]},
                    {"cachePoint": {"type": "default"}},
                ],
                messages=[
                    {"role": "user", "content": [{"text": prompt["utilisateur"]}]}
                ],
                inferenceConfig={
                    "maxTokens": prompt["max_tokens"],
                    "temperature": TEMPERATURE,
                },
            )
        except Exception as exc:  # noqa: BLE001 - the class is botocore's, not ours
            transitoire = any(
                marque in f"{type(exc).__name__} {exc}"
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
    raise EnrichLLMError(f"appel épuisé sans réponse : {derniere}")  # pragma: no cover


def mettre_en_quarantaine(
    prompt: dict[str, Any],
    brut: str,
    raison: str,
    quarantaine: Path,
) -> Path:
    """Park a non-conforming answer outside `data/`, with what it takes to judge it.

    The raw text is kept, not just the reason: tuning the prompt over the planned
    5-10 passes means reading what the model actually said, and a discarded answer
    is a lesson paid for and thrown away.
    """
    return ecrire_atomique(
        {
            "id": prompt["id"],
            "raison": raison,
            "hash_source": prompt["hash_source"],
            "version_prompt": prompt["version_prompt"],
            "reponse_brute": brut,
            "mis_en_quarantaine_le": _maintenant(),
        },
        quarantaine / f"{prompt['id']}.json",
    )


def valider_forme(enrichi: dict[str, Any], validateur: Any) -> str | None:
    """Return a reason to quarantine, or None. Shape only — stage 10 judges content.

    The line is deliberate: this catches a record `data/` could not hold honestly
    (missing key, value outside a closed list). Whether the evidence actually
    supports the claim is stage 10's question, and answering it here would make the
    prompt's true failure rate unmeasurable.
    """
    erreurs = sorted(validateur.iter_errors(enrichi), key=lambda e: list(e.path))
    if not erreurs:
        return None
    premiere = erreurs[0]
    chemin = "/".join(str(p) for p in premiere.path) or "(racine)"
    return f"schéma : {chemin} — {premiere.message}"


def traiter_un(
    client: ClientConverse,
    chemin_prompt: Path,
    sortie: Path,
    quarantaine: Path,
    validateur: Any,
    manifeste: dict[str, Any],
    modele: str = MODELE,
) -> dict[str, Any]:
    """Send one prompt, then write exactly one file: the record or its quarantine."""
    prompt = _lire_json(chemin_prompt)
    reponse = appeler(client, prompt, modele)
    brut = "".join(
        bloc.get("text", "") for bloc in reponse["output"]["message"]["content"]
    )
    usage = reponse.get("usage") or {}
    issue: dict[str, Any] = {
        "id": prompt["id"],
        "usage": {
            "inputTokens": usage.get("inputTokens") or 0,
            "outputTokens": usage.get("outputTokens") or 0,
            "cacheReadInputTokens": usage.get("cacheReadInputTokens") or 0,
            "cacheWriteInputTokens": usage.get("cacheWriteInputTokens") or 0,
        },
    }

    try:
        objet = extraire_json(brut)
    except (ValueError, json.JSONDecodeError) as exc:
        mettre_en_quarantaine(prompt, brut, f"JSON illisible : {exc}", quarantaine)
        return {**issue, "etat": "quarantaine", "raison": "json"}

    if objet.get("id") != prompt["id"]:
        # Identity mismatch: the answer may describe another spell entirely, and
        # filing it under this id would corrupt the corpus silently.
        mettre_en_quarantaine(
            prompt,
            brut,
            f"identité incohérente : le modèle a répondu {objet.get('id')!r}",
            quarantaine,
        )
        return {**issue, "etat": "quarantaine", "raison": "identite"}

    enrichi = {
        **objet,
        "slug": prompt["slug"],
        "version_prompt": prompt["version_prompt"],
        "version_taxonomie": manifeste["version_taxonomie"],
        "modele": modele,
        "genere_le": _maintenant(),
        "hash_source": prompt["hash_source"],
    }
    raison = valider_forme(enrichi, validateur)
    if raison is not None:
        mettre_en_quarantaine(prompt, brut, raison, quarantaine)
        return {**issue, "etat": "quarantaine", "raison": "schema"}

    ecrire_atomique(enrichi, sortie / f"{prompt['id']}.json")
    return {**issue, "etat": "ecrit"}


class Budget:
    """The spending guards, in one place, thread-safe.

    Shared across the worker pool, so both counters must be taken under the lock:
    eight threads racing on the call cap is exactly how a "bounded" run overshoots.
    """

    def __init__(self, plafond: int) -> None:
        self.plafond = plafond
        self.appels = 0
        self.echecs = 0
        self._verrou = threading.Lock()

    def reserver(self) -> None:
        """Claim one call, or refuse. Called before spending, never after."""
        with self._verrou:
            if self.appels >= self.plafond:
                raise ArretBudget(
                    f"plafond de {self.plafond} appels atteint : le run s'arrête "
                    "proprement. Relancer reprend où il s'est arrêté."
                )
            self.appels += 1

    def signaler_echec(self) -> None:
        """Trip the breaker when failures dominate — a systemic fault, not bad luck."""
        with self._verrou:
            self.echecs += 1
            assez = self.appels >= MINIMUM_AVANT_ARRET
            if assez and self.echecs / self.appels >= SEUIL_ARRET_ECHECS:
                raise ArretBudget(
                    f"{self.echecs} échecs sur {self.appels} appels "
                    f"(≥ {SEUIL_ARRET_ECHECS:.0%}) : panne systémique probable "
                    "(jeton, modèle, région). Le run s'arrête avant de payer plus."
                )


_NOM_MODULE_ESTIMATEUR = "_pf_estimate_cost"


def _caracteres_par_token() -> float:
    """The character→token heuristic, read from `tools/estimate_cost.py`.

    Read rather than restated: a second copy of the constant would drift from the
    estimator the operator checks prices with, and the two would only be found to
    disagree while money was being spent. `tools/` is not a package (house rule:
    no `__init__.py`), so it is loaded by path — and registered in `sys.modules`
    before execution, because its `@dataclass` resolves its own module by name and
    fails obscurely on `None` otherwise.
    """
    import importlib.util

    connu = sys.modules.get(_NOM_MODULE_ESTIMATEUR)
    if connu is not None:
        return float(connu.CARACTERES_PAR_TOKEN)

    chemin = Path(__file__).resolve().parents[2] / "tools" / "estimate_cost.py"
    specification = importlib.util.spec_from_file_location(
        _NOM_MODULE_ESTIMATEUR, chemin
    )
    if specification is None or specification.loader is None:
        raise EnrichLLMError(f"estimateur introuvable : {chemin}")
    module = importlib.util.module_from_spec(specification)
    sys.modules[_NOM_MODULE_ESTIMATEUR] = module
    try:
        specification.loader.exec_module(module)
    except BaseException:
        del sys.modules[_NOM_MODULE_ESTIMATEUR]
        raise
    return float(module.CARACTERES_PAR_TOKEN)


def estimer_run(prompts: list[Path], max_tokens_defaut: int = 1024) -> dict[str, Any]:
    """Offline cost bracket for exactly the records this run would send.

    Reuses the estimator's heuristic rather than a second one, and reports
    `part_cacheable` because that fraction IS the saving: the system block is
    counted once per call, and a cache read bills it at roughly a tenth.
    """
    par_token = _caracteres_par_token()
    caracteres_systeme = 0
    caracteres_utilisateur = 0
    sortie_haute = 0
    for chemin in prompts:
        prompt = _lire_json(chemin)
        caracteres_systeme = max(caracteres_systeme, len(prompt["systeme"]))
        caracteres_utilisateur += len(prompt["utilisateur"])
        sortie_haute += int(prompt.get("max_tokens") or max_tokens_defaut)
    n = len(prompts)
    tokens_systeme = int(caracteres_systeme / par_token)
    tokens_utilisateur = int(caracteres_utilisateur / par_token)
    systeme_total = tokens_systeme * n
    entree_totale = systeme_total + tokens_utilisateur
    return {
        "n": n,
        "tokens_systeme_par_appel": tokens_systeme,
        "tokens_systeme_total": systeme_total,
        "tokens_utilisateur": tokens_utilisateur,
        "tokens_sortie_haut": sortie_haute,
        "part_cacheable": (systeme_total / entree_totale) if entree_totale else 0.0,
    }


def rendre_estimation(estimation: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"  enregistrements     : {estimation['n']}",
            f"  tokens système      : {estimation['tokens_systeme_par_appel']} par "
            f"appel × {estimation['n']} = {estimation['tokens_systeme_total']}",
            f"  tokens de sorts     : {estimation['tokens_utilisateur']}",
            f"  tokens de sortie    : ≤ {estimation['tokens_sortie_haut']}",
            f"  part cacheable      : {estimation['part_cacheable']:.0%} de l'entrée",
            "  (tarifs : python tools/estimate_cost.py --prompts <rép> …)",
        ]
    )


def demander_confirmation(
    estimation: dict[str, Any],
    *,
    oui: bool,
    entree: Any = None,
) -> None:
    """Gate a large run behind an explicit human yes — or `--oui`, stated up front.

    Non-interactive runs (cron, CI) do NOT fall through to "assume yes": with no
    tty and no `--oui`, the run refuses. A scheduler must not be able to spend by
    default, and the failure mode of guessing wrong here is a real invoice.
    """
    if estimation["n"] <= SEUIL_CONFIRMATION or oui:
        return
    flux = entree if entree is not None else sys.stdin
    interactif = bool(getattr(flux, "isatty", lambda: False)())
    if not interactif:
        raise ArretBudget(
            f"{estimation['n']} enregistrements (> {SEUIL_CONFIRMATION}) et pas de "
            "terminal pour confirmer : relancer avec --oui, ou réduire avec "
            "--limit. Aucun appel n'est tenté."
        )
    print(f"\nCe run va émettre {estimation['n']} appels payants :")
    print(rendre_estimation(estimation))
    reponse = (flux.readline() or "").strip().lower()
    if reponse not in {"oui", "o", "yes", "y"}:
        raise ArretBudget("run non confirmé : aucun appel n'est tenté.")


def run(
    racine: str | Path = DEFAULT_RACINE,
    *,
    client: ClientConverse | None = None,
    prompts: str | Path = DEFAULT_PROMPTS,
    sortie: str | Path = DEFAULT_SORTIE,
    quarantaine: str | Path = DEFAULT_QUARANTAINE,
    version_prompt: str | None = None,
    racine_conventions: str | Path | None = None,
    modele: str = MODELE,
    region: str = REGION,
    limite: int | None = None,
    seulement: list[str] | None = None,
    force: bool = False,
    concurrence: int = CONCURRENCE,
    plafond: int = PLAFOND_APPELS_DEFAUT,
    oui: bool = False,
    entree: Any = None,
) -> dict[str, Any]:
    """Generate the enrichments. Returns the run summary; writes the report itself.

    `racine` is the corpus root and may be a fixture. `racine_conventions` holds
    the frozen vocabularies, shared by every root — same split as stage 08, for the
    same reason: the fixture must not need its own copy of the taxonomy.
    """
    racine = Path(racine)
    conventions = Path(racine_conventions) if racine_conventions is not None else Path(".")
    base_prompts = Path(prompts)
    if not base_prompts.is_absolute():
        base_prompts = racine / base_prompts
    if version_prompt is None:
        from pf_spells.prepare_prompts import VERSION_PROMPT

        version_prompt = VERSION_PROMPT
    repertoire = base_prompts / version_prompt

    chemin_sortie = Path(sortie) if Path(sortie).is_absolute() else racine / sortie
    chemin_quarantaine = (
        Path(quarantaine) if Path(quarantaine).is_absolute() else racine / quarantaine
    )

    manifeste = charger_manifeste(repertoire)
    verifier_taxonomie(conventions, manifeste)
    tous = fichiers_de_prompts(repertoire)

    if seulement:
        voulus = set(seulement)
        connus = {c.stem for c in tous}
        inconnus = sorted(voulus - connus)
        if inconnus:
            raise EnrichLLMError(f"--only hors des prompts assemblés : {inconnus}")
        tous = [c for c in tous if c.stem in voulus]

    restants, a_jour = a_faire(tous, chemin_sortie, force=force)
    if limite is not None:
        restants = restants[:limite]

    resume: dict[str, Any] = {
        "demandes": len(tous),
        "a_jour": a_jour,
        "tentes": len(restants),
        "ecrits": 0,
        "quarantaine": 0,
        "echecs": [],
        "raisons_quarantaine": {},
        "usage": {
            "inputTokens": 0,
            "outputTokens": 0,
            "cacheReadInputTokens": 0,
            "cacheWriteInputTokens": 0,
        },
        "modele": modele,
        "version_prompt": version_prompt,
        "version_taxonomie": manifeste["version_taxonomie"],
        "plafond": plafond,
        "arret_budget": None,
    }
    if not restants:
        return resume

    if len(restants) > plafond:
        raise ArretBudget(
            f"{len(restants)} enregistrements à traiter dépasse le plafond de "
            f"{plafond} appels. Ce garde-fou existe pour qu'une boucle ou un "
            "--force involontaire ne se facture pas : relancer avec --limit, ou "
            "relever --plafond en connaissance de cause."
        )

    estimation = estimer_run(restants)
    demander_confirmation(estimation, oui=oui, entree=entree)

    # Client built only now: after every guard has passed, so a refused run never
    # even needs a token.
    if client is None:
        client = construire_client(region)

    validateur_classe = _validateur(conventions)
    budget = Budget(plafond)

    def travailler(chemin: Path) -> dict[str, Any]:
        budget.reserver()
        return traiter_un(
            client,
            chemin,
            chemin_sortie,
            chemin_quarantaine,
            validateur_classe,
            manifeste,
            modele,
        )

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, min(concurrence, CONCURRENCE))
    ) as pool:
        futurs = {pool.submit(travailler, c): c for c in restants}
        for futur in concurrent.futures.as_completed(futurs):
            chemin = futurs[futur]
            try:
                issue = futur.result()
            except ArretBudget as arret:
                # A guard fired. Record it once and stop scheduling; results
                # already written stay written, and a re-run resumes from them.
                if resume["arret_budget"] is None:
                    resume["arret_budget"] = str(arret)
                for autre in futurs:
                    autre.cancel()
                continue
            except Exception as exc:  # noqa: BLE001 - reported, never swallowed
                resume["echecs"].append(
                    {"id": chemin.stem, "erreur": f"{type(exc).__name__}: {exc}"}
                )
                try:
                    budget.signaler_echec()
                except ArretBudget as arret:
                    if resume["arret_budget"] is None:
                        resume["arret_budget"] = str(arret)
                    for autre in futurs:
                        autre.cancel()
                continue
            for cle, valeur in issue["usage"].items():
                resume["usage"][cle] += valeur
            if issue["etat"] == "ecrit":
                resume["ecrits"] += 1
            else:
                resume["quarantaine"] += 1
                raison = issue["raison"]
                resume["raisons_quarantaine"][raison] = (
                    resume["raisons_quarantaine"].get(raison, 0) + 1
                )

    resume["echecs"].sort(key=lambda e: e["id"])
    resume["appels"] = budget.appels
    return resume


def _validateur(conventions: Path) -> Any:
    """Build the shape validator from the resolved schema.

    Imported here rather than at module import: `jsonschema` is only needed by a
    run, and importing this module must stay free.
    """
    from jsonschema import Draft202012Validator

    return Draft202012Validator(charger_schema_resolu(conventions))


def ecrire_rapport(resume: dict[str, Any], racine: Path, rapports: str | Path) -> Path:
    """Persist the run summary, including what it cost and whether caching worked."""
    base = Path(rapports) if Path(rapports).is_absolute() else racine / rapports
    horodatage = _maintenant().replace(":", "").replace("-", "")
    return ecrire_atomique(
        {**resume, "enrich_llm_version": enrich_llm_version, "termine_le": _maintenant()},
        base / f"run_{horodatage}.json",
    )


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Étage 09 : envoie les prompts assemblés au modèle et écrit "
            "data/enrichissements/<id>.json. Seul étage réseau. Chemin on-demand "
            "avec prompt caching ; dépense bornée par plafond, confirmation et "
            "coupe-circuit. Ne juge pas le contenu : c'est l'étage 10."
        ),
        # Abbreviations off, deliberately. The plan documented a `--mode
        # batch|ondemand` that this module does not implement (batch needs S3, and
        # S3 is shut with this token). With abbreviations on, `--mode batch` is a
        # unique prefix of `--modele` and would silently set the MODEL ID to
        # "batch" — 2 070 paid validation errors from a flag that looks accepted.
        allow_abbrev=False,
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE)
    parseur.add_argument("--prompts", default=DEFAULT_PROMPTS)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    parseur.add_argument("--quarantaine", default=DEFAULT_QUARANTAINE)
    parseur.add_argument("--rapports", default=DEFAULT_RAPPORTS)
    parseur.add_argument("--racine-conventions", default=None)
    parseur.add_argument("--version-prompt", default=None)
    parseur.add_argument("--modele", default=MODELE)
    parseur.add_argument("--region", default=REGION)
    parseur.add_argument("--limit", type=int, default=None)
    parseur.add_argument("--only", action="append", default=None)
    parseur.add_argument("--concurrence", type=int, default=CONCURRENCE)
    parseur.add_argument(
        "--plafond",
        type=int,
        default=PLAFOND_APPELS_DEFAUT,
        help="nombre maximum d'appels payants pour ce run (défaut : %(default)s)",
    )
    parseur.add_argument(
        "--force",
        action="store_true",
        help="régénère même les enregistrements à jour — REPAIE les appels",
    )
    parseur.add_argument(
        "--oui",
        action="store_true",
        help=(
            f"confirme d'avance un run de plus de {SEUIL_CONFIRMATION} "
            "enregistrements ; requis hors terminal"
        ),
    )
    parseur.add_argument(
        "--estimer-seulement",
        action="store_true",
        help="affiche l'estimation et le nombre d'appels, puis sort sans rien payer",
    )
    args = parseur.parse_args(argv)
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    if args.concurrence > CONCURRENCE:
        print(
            f"ATTENTION : --concurrence {args.concurrence} ramenée à {CONCURRENCE}",
            file=sys.stderr,
        )
        args.concurrence = CONCURRENCE

    racine = Path(args.racine)
    if args.estimer_seulement:
        # The dry run: every guard and every filter, no client, no spending.
        return _estimer_seulement(args, racine)

    try:
        resume = run(
            racine,
            prompts=args.prompts,
            sortie=args.sortie,
            quarantaine=args.quarantaine,
            version_prompt=args.version_prompt,
            racine_conventions=args.racine_conventions,
            modele=args.modele,
            region=args.region,
            limite=args.limit,
            seulement=args.only,
            force=args.force,
            concurrence=args.concurrence,
            plafond=args.plafond,
            oui=args.oui,
        )
    except ArretBudget as arret:
        print(f"ARRÊT BUDGET : {arret}", file=sys.stderr)
        return 2

    chemin_rapport = ecrire_rapport(resume, racine, args.rapports)
    usage = resume["usage"]
    print(
        f"étage 09 : {resume['demandes']} demandés, {resume['a_jour']} déjà à "
        f"jour, {resume['tentes']} tentés, {resume['ecrits']} écrits, "
        f"{resume['quarantaine']} en quarantaine, {len(resume['echecs'])} en échec"
    )
    print(
        f"jetons : {usage['inputTokens']} entrée, {usage['outputTokens']} sortie, "
        f"{usage['cacheReadInputTokens']} lus du cache, "
        f"{usage['cacheWriteInputTokens']} écrits au cache"
    )
    if resume["tentes"] and not usage["cacheReadInputTokens"]:
        # Not fatal, but it doubles the bill, so it must not pass unremarked.
        print(
            "ATTENTION : aucune lecture de cache — le bloc système n'est pas "
            "amorti et ce run coûte environ le double. Vérifier que les prompts "
            "partagent un bloc système identique (étage 08).",
            file=sys.stderr,
        )
    for raison, compte in sorted(resume["raisons_quarantaine"].items()):
        print(f"  quarantaine {raison} : {compte}")
    for echec in resume["echecs"]:
        print(f"ÉCHEC {echec['id']} : {echec['erreur']}", file=sys.stderr)
    if resume["arret_budget"]:
        print(f"ARRÊT BUDGET : {resume['arret_budget']}", file=sys.stderr)
    print(f"rapport : {chemin_rapport.as_posix()}")
    print("valider ensuite : python -m pf_spells.validate_enrichment")
    return 1 if (resume["echecs"] or resume["arret_budget"]) else 0


def _estimer_seulement(args: argparse.Namespace, racine: Path) -> int:
    """`--estimer-seulement`: answer "what would this cost?" without a client.

    Deliberately runs the same filters and the same resume logic as a real run, so
    the number shown is the number that would be spent — an estimate computed by a
    different code path would be reassuring and wrong.
    """
    base = Path(args.prompts)
    if not base.is_absolute():
        base = racine / base
    version = args.version_prompt
    if version is None:
        from pf_spells.prepare_prompts import VERSION_PROMPT

        version = VERSION_PROMPT
    repertoire = base / version
    conventions = Path(args.racine_conventions) if args.racine_conventions else Path(".")
    manifeste = charger_manifeste(repertoire)
    verifier_taxonomie(conventions, manifeste)
    tous = fichiers_de_prompts(repertoire)
    if args.only:
        tous = [c for c in tous if c.stem in set(args.only)]
    chemin_sortie = (
        Path(args.sortie) if Path(args.sortie).is_absolute() else racine / args.sortie
    )
    restants, a_jour = a_faire(tous, chemin_sortie, force=args.force)
    if args.limit is not None:
        restants = restants[: args.limit]
    estimation = estimer_run(restants)
    print("estimation sèche — aucun appel émis, rien n'est payé")
    print(f"  déjà à jour         : {a_jour}")
    print(rendre_estimation(estimation))
    if len(restants) > args.plafond:
        print(
            f"  ATTENTION : {len(restants)} > plafond {args.plafond} — un run "
            "réel refuserait de démarrer",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
