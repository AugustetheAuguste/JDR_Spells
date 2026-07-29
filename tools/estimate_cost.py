"""Price a batch of assembled prompts before it is ever sent.

Stage 08 writes one JSON file per spell into a prompt directory; stage 09 sends
them. Between the two, somebody has to answer "how much will this cost?" — and
answer it offline, from the files on disk, with no API call and no credentials.
That is all this module does.

It is deliberately an *estimator*, not a meter. Input length is approximated from
character counts (see `CARACTERES_PAR_TOKEN`) and output length is unknown until
the model has answered, so the result is reported as a low/high bracket plus the
batch-discounted variant. The authoritative token counts come from the `usage`
block of each API response and are recorded by stage 09, not here.

No network, no boto3: this must run on a laptop with no AWS configuration at all.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def forcer_stdout_utf8() -> None:
    """Emit UTF-8 on stdout even where the console codepage is not UTF-8.

    Same reason as in `preflight_corpus.py`: the rendered estimate contains
    accented French, and win32 wires stdout to cp1252, which mangles it. Every
    output of this repo is UTF-8 on every platform.
    """
    flux = getattr(sys.stdout, "reconfigure", None)
    if flux is not None:
        flux(encoding="utf-8", newline="\n")

outil_version = "1.0.0"

# French prose runs at roughly 3.6 characters per token for Claude's tokenizer.
# This is a **heuristic for budgeting**, not a tokenizer: it is measured on French
# text, it ignores JSON punctuation density, and it will be off by a few percent
# either way. The real count is the `usage.input_tokens` the API returns.
CARACTERES_PAR_TOKEN = 3.6

# Fraction of `max_tokens` a well-behaved structured answer actually consumes.
# The low estimate assumes this; the high estimate assumes the model fills
# `max_tokens` on every record, which is the worst case worth budgeting for.
FRACTION_SORTIE_BASSE = 0.35

# Bedrock batch inference is priced at about half the on-demand rate.
REMISE_BATCH_DEFAUT = 0.5

# Tariffs are quoted per 1000 tokens everywhere in this module.
TOKENS_PAR_UNITE_TARIF = 1000

# Stage 08 drops a run manifest next to the prompts; it is not a prompt record.
FICHIER_MANIFESTE = "_manifeste.json"

# Keys a stage-08 prompt record carries. Only the two text fields feed the count,
# but the list documents the contract this tool reads.
CLES_PROMPT: tuple[str, ...] = (
    "id",
    "slug",
    "hash_source",
    "version_prompt",
    "version_taxonomie",
    "systeme",
    "utilisateur",
    "max_tokens",
)

CHAMPS_TEXTE: tuple[str, ...] = ("systeme", "utilisateur")


@dataclass(frozen=True, slots=True)
class Estimation:
    """The bracket. Costs are in the currency the tariffs were given in."""

    nb_enregistrements: int
    nb_caracteres: int
    tokens_entree: int
    tokens_sortie_bas: int
    tokens_sortie_haut: int
    cout_bas: float
    cout_haut: float
    cout_bas_batch: float
    cout_haut_batch: float
    fraction_sortie: float
    remise_batch: float

    def to_json(self) -> dict[str, Any]:
        return {
            "nb_enregistrements": self.nb_enregistrements,
            "nb_caracteres": self.nb_caracteres,
            "tokens_entree": self.tokens_entree,
            "tokens_sortie_bas": self.tokens_sortie_bas,
            "tokens_sortie_haut": self.tokens_sortie_haut,
            "cout_bas": self.cout_bas,
            "cout_haut": self.cout_haut,
            "cout_bas_batch": self.cout_bas_batch,
            "cout_haut_batch": self.cout_haut_batch,
            "fraction_sortie": self.fraction_sortie,
            "remise_batch": self.remise_batch,
        }


def tokens_approximatifs(nb_caracteres: int) -> int:
    """Characters → tokens, rounded up: never under-budget a run."""
    return math.ceil(nb_caracteres / CARACTERES_PAR_TOKEN)


def fichiers_de_prompts(chemin_prompts: Path) -> list[Path]:
    """The prompt records in a directory, sorted, manifest excluded."""
    return [
        c
        for c in sorted(chemin_prompts.glob("*.json"))
        if c.name != FICHIER_MANIFESTE
    ]


def estimer(
    chemin_prompts: Path,
    tarif_entree: float,
    tarif_sortie: float,
    max_tokens: int,
    remise_batch: float = REMISE_BATCH_DEFAUT,
    fraction_sortie: float = FRACTION_SORTIE_BASSE,
) -> Estimation:
    """Bracket the cost of every prompt record under `chemin_prompts`.

    `max_tokens` given here is the cap used for records that do not carry their
    own: a record's own `max_tokens` wins, since that is what stage 09 will send.
    An empty or absent directory is not an error — it is zero records, and the
    caller decides whether that is a problem.
    """
    nb_caracteres = 0
    tokens_sortie_haut = 0
    nb = 0

    for chemin in fichiers_de_prompts(chemin_prompts):
        enregistrement = json.loads(chemin.read_text(encoding="utf-8", errors="strict"))
        nb += 1
        nb_caracteres += sum(
            len(enregistrement.get(champ) or "") for champ in CHAMPS_TEXTE
        )
        plafond = enregistrement.get("max_tokens")
        tokens_sortie_haut += int(plafond) if plafond else max_tokens

    tokens_entree = tokens_approximatifs(nb_caracteres)
    tokens_sortie_bas = math.ceil(tokens_sortie_haut * fraction_sortie)

    def cout(tokens_sortie: int) -> float:
        return (
            tokens_entree * tarif_entree + tokens_sortie * tarif_sortie
        ) / TOKENS_PAR_UNITE_TARIF

    cout_bas = cout(tokens_sortie_bas)
    cout_haut = cout(tokens_sortie_haut)
    return Estimation(
        nb_enregistrements=nb,
        nb_caracteres=nb_caracteres,
        tokens_entree=tokens_entree,
        tokens_sortie_bas=tokens_sortie_bas,
        tokens_sortie_haut=tokens_sortie_haut,
        cout_bas=cout_bas,
        cout_haut=cout_haut,
        cout_bas_batch=cout_bas * remise_batch,
        cout_haut_batch=cout_haut * remise_batch,
        fraction_sortie=fraction_sortie,
        remise_batch=remise_batch,
    )


def rendre(estimation: Estimation, chemin_prompts: Path) -> str:
    """Human-readable summary. Says "0 enregistrement" out loud when empty."""
    if not estimation.nb_enregistrements:
        return (
            f"0 enregistrement de prompt dans `{chemin_prompts.as_posix()}` — "
            "rien à estimer, coût nul."
        )
    return "\n".join(
        [
            f"Répertoire        : {chemin_prompts.as_posix()}",
            f"Enregistrements   : {estimation.nb_enregistrements}",
            f"Caractères        : {estimation.nb_caracteres}",
            f"Tokens d'entrée   : {estimation.tokens_entree} "
            f"(≈ chars / {CARACTERES_PAR_TOKEN}, heuristique française)",
            f"Tokens de sortie  : {estimation.tokens_sortie_bas} (bas, "
            f"{estimation.fraction_sortie:.0%} de max_tokens) … "
            f"{estimation.tokens_sortie_haut} (haut, max_tokens plein)",
            f"Coût à la demande : {estimation.cout_bas:.4f} … "
            f"{estimation.cout_haut:.4f}",
            f"Coût en batch     : {estimation.cout_bas_batch:.4f} … "
            f"{estimation.cout_haut_batch:.4f} "
            f"(remise {1 - estimation.remise_batch:.0%})",
        ]
    )


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Estime hors ligne le coût d'un lot de prompts assemblés. "
            "Les tarifs sont exprimés PAR 1000 TOKENS, dans la devise de votre "
            "choix : le résultat sort dans cette même devise. Aucun accès "
            "réseau, aucun identifiant AWS requis."
        )
    )
    parseur.add_argument(
        "--prompts", required=True, help="répertoire des prompts de l'étage 08"
    )
    parseur.add_argument(
        "--tarif-entree",
        type=float,
        required=True,
        help="prix des tokens d'entrée, pour 1000 tokens",
    )
    parseur.add_argument(
        "--tarif-sortie",
        type=float,
        required=True,
        help="prix des tokens de sortie, pour 1000 tokens",
    )
    parseur.add_argument(
        "--max-tokens",
        type=int,
        default=1024,
        help="plafond de sortie pour les enregistrements qui n'en portent pas "
        "(défaut : %(default)s)",
    )
    parseur.add_argument(
        "--remise-batch",
        type=float,
        default=REMISE_BATCH_DEFAUT,
        help="multiplicateur du tarif batch (défaut : %(default)s)",
    )
    parseur.add_argument(
        "--fraction-sortie",
        type=float,
        default=FRACTION_SORTIE_BASSE,
        help="part de max_tokens supposée consommée dans l'estimation basse "
        "(défaut : %(default)s)",
    )
    parseur.add_argument(
        "--json", action="store_true", help="sortie JSON au lieu du résumé"
    )
    args = parseur.parse_args(argv)
    forcer_stdout_utf8()

    chemin_prompts = Path(args.prompts)
    if not chemin_prompts.is_dir():
        # Absent directory is a usage error: the caller pointed at nothing and
        # would otherwise read "coût nul" as good news.
        print(f"répertoire de prompts introuvable : {chemin_prompts.as_posix()}")
        return 2

    estimation = estimer(
        chemin_prompts,
        args.tarif_entree,
        args.tarif_sortie,
        args.max_tokens,
        remise_batch=args.remise_batch,
        fraction_sortie=args.fraction_sortie,
    )
    if args.json:
        print(json.dumps(estimation.to_json(), ensure_ascii=False, indent=2))
    else:
        print(rendre(estimation, chemin_prompts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
