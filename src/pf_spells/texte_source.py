"""The canonical source text of a spell, and its hash. One definition, shared.

This module exists to be imported by **both** the prompt assembly (stage 08) and
the enrichment validation (stage 10). Stage 09 asks the model to copy, into
`preuves`, exact substrings of the text it was given; stage 10 re-checks each one
with `preuve in texte`. That check is literal, so the two stages must build the
*same string, byte for byte*. Two nearly-identical implementations would not fail
loudly — they would fail as "100 % of evidence is invalid", which reads like a
model problem and is not one. Hence: one function, one module, one stability test.

Consequences of that contract, all deliberate:

- **The field order is frozen.** Changing it, or the separator, changes every
  `hash_source` in the corpus and invalidates every stored enrichment. That is a
  decision to take knowingly, not a refactor to slip in.
- **Nothing is normalised away.** Accents, punctuation, capitalisation and the
  wiki's own typos are kept verbatim, because the model is asked to quote this
  text exactly. Only line endings are normalised (to LF), since those vary by
  platform and would otherwise make the hash machine-dependent.
- **Absent fields are omitted, not rendered as `null`.** The corpus writes `null`
  for "absent from the source"; emitting the word `null` here would offer the
  model a string to quote as if it were content.

Two fields of the 21 are deliberately excluded. `variantes` holds whole nested
spells: including them would let the model quote a variant's text as evidence
about its parent. `mythique` is captured by Phase 1 but slated for removal
(CLAUDE.md § 9), so building it into a frozen hash would be self-defeating.
`descripteurs` **is** included — see `CHAMPS`.
"""

from __future__ import annotations

import hashlib
from typing import Any

# Frozen order. `descripteurs` sits right after `ecole` — a departure from the
# step's pseudo-code, made on purpose: the bracketed descriptors of the École line
# ([feu], [froid], [mental]…) are frequently the ONLY place the energy type is
# named. Without them a fire spell whose prose never says "feu" would force
# `type_degats: null` for want of a quotable substring, which would be an artefact
# of this assembly rather than a fact about the spell.
CHAMPS: tuple[str, ...] = (
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

# `champ: valeur`, one per line — the same shape the free-proposal pass used, so
# the two paid passes read alike to a human auditing them side by side.
SEPARATEUR_CHAMP = ": "
SEPARATEUR_LISTE = ", "

_REMPLACEMENT = chr(0xFFFD)


class TexteSourceError(ValueError):
    """The text cannot be built honestly, so nothing is sent and nothing written."""


def _rendre(valeur: Any) -> str:
    """Render one field value as the single line the model will read.

    `niveaux` is a mapping of class abbreviation to level and renders as
    `Ens/Mag 9, Prê 9`; lists join on a comma. Scalars are stringified as-is.
    """
    if isinstance(valeur, dict):
        return SEPARATEUR_LISTE.join(f"{cle} {val}" for cle, val in valeur.items())
    if isinstance(valeur, list):
        return SEPARATEUR_LISTE.join(str(element) for element in valeur)
    return str(valeur)


def _vide(valeur: Any) -> bool:
    """True when the corpus says "nothing here" — `null`, `[]`, `{}` or blank."""
    if valeur is None or valeur == [] or valeur == {}:
        return True
    return isinstance(valeur, str) and not valeur.strip()


def texte_source_canonique(sort: dict[str, Any]) -> str:
    """Assemble the exact text a model is shown for `sort`.

    THE shared definition: stage 08 hashes it and sends it, stage 10 re-reads it
    to verify evidence substrings. Do not reimplement, do not "improve" locally.

    The English spell name is never included — it is the single most effective
    hook for surfacing the memorised English SRD instead of reading the text
    provided, which is the confabulation this whole track is built to prevent.
    """
    lignes: list[str] = []
    for champ in CHAMPS:
        valeur = sort.get(champ)
        if _vide(valeur):
            continue
        lignes.append(f"{champ}{SEPARATEUR_CHAMP}{_rendre(valeur)}")

    description = sort.get("description")
    if not _vide(description):
        # Blank line before the prose: the stat block and the description are two
        # different kinds of text, and the model is told to quote from both.
        lignes.append("")
        lignes.append(str(description).strip())

    texte = "\n".join(lignes).replace("\r\n", "\n").replace("\r", "\n")
    if _REMPLACEMENT in texte:
        raise TexteSourceError(
            f"U+FFFD dans le texte source de {sort.get('id')!r} : corruption "
            "d'encodage, pas un caractère de contenu — rien n'est produit"
        )
    if not texte.strip():
        raise TexteSourceError(
            f"texte source vide pour {sort.get('id')!r} : aucun champ exploitable, "
            "il n'y a rien à faire annoter"
        )
    return texte


def hash_source(texte: str) -> str:
    """sha256 hex of the UTF-8 bytes of the canonical text.

    The resume key of stage 09 and the drift detector of stage 10: unchanged hash
    means the stored enrichment still describes this exact text.
    """
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()
