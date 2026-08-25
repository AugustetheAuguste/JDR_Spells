"""Text folding and facet normalization for the web index.

Two distinct jobs live here because both are *derivations for machines*, never
rewrites of the corpus: values on disk stay verbatim and accented per
`pf-corpus-conventions`. What follows only ever produces search keys and filter
codes.

`plier` is the load-bearing one. The exporter folds every spell name into `nf`,
and the client folds every keystroke before matching. If those two folds ever
disagree, search fails *silently* on every accented word — half a French
corpus — with no error to notice. That is why the frozen vectors in
`tests/test_web_pliage.py` are mirrored character-for-character by the
TypeScript port's own test suite: the pair of tests is the only thing keeping
two languages' implementations honest.

The normalizers exist because the source is far messier than a filter can be.
The corpus carries 60 distinct spellings of 8 canonical schools, 103 ranges and
222 saving throws — each range embeds its own numeric formula, and case varies
freely. Filtering wants the family; the fiche keeps the verbatim string.
"""

from __future__ import annotations

import re
import unicodedata

# U+2019 (typographic) and U+02BC (modifier letter) both appear as apostrophes in
# wiki content. They fold to a space rather than to U+0027 so that "Mur d'épines"
# and "Mur depines" collapse onto the same token run: someone typing fast omits
# the apostrophe entirely, and a bare U+0027 would leave "d'epines" ≠ "d epines".
_APOSTROPHES = ("'", "’", "ʼ")

_ESPACES = re.compile(r"\s+")

# Ligatures must be mapped *before* NFKD, which does not decompose them: "Cœur"
# would otherwise keep its œ and never match a query typed "coeur". Same
# pre-mapping, and same reason, as step 4 of the `id` slug algorithm in
# `pf-corpus-conventions`.
_LIGATURES = {"œ": "oe", "Œ": "oe", "æ": "ae", "Æ": "ae"}

# The eight canonical schools, plus the two spellings of the universal school the
# corpus actually uses. Anything outside this set is reported, never silently
# folded into a neighbour: an unknown school is a parser question, not a filter one.
ECOLES_CANONIQUES = frozenset(
    {
        "abjuration",
        "divination",
        "enchantement",
        "evocation",
        "illusion",
        "invocation",
        "necromancie",
        "transmutation",
        "universel",
    }
)

# Range families. Keys are matched against the folded prefix of the source string,
# whose tail is a numeric formula ("courte (7,50 m + 1,50 m/2 niveaux)") that is
# irrelevant to filtering and belongs on the fiche.
_FAMILLES_PORTEE = ("contact", "personnelle", "courte", "moyenne", "longue")

# Saving-throw characteristics. The source spells out the whole clause ("Volonté,
# annule (inoffensif)"); only the characteristic is a filter facet.
_CARACTERISTIQUES_JET = ("volonte", "vigueur", "reflexes")

# Component sigils as the corpus actually writes them, counted over all 2070 files:
# V verbale, G gestuelle, M matérielle, F focaliseur, FD/DF focaliseur divin
# (both orderings occur), S somatique (5 spells, an older spelling of gestuelle).
# Two-letter sigils come first so `FD` is consumed whole and never split into a
# spurious `F` + `D`.
SIGLES_COMPOSANTES = ("FD", "DF", "V", "G", "M", "F", "S")

_SIGLE = re.compile(r"\b(" + "|".join(SIGLES_COMPOSANTES) + r")\b")

# Parenthesised glosses spell out *what* a component is and must be removed before
# sigils are matched: one spell reads "F (le crâne ou le fémur d'une créature de
# taille M), FD", where the M is a creature size, not a material component. The
# glosses are dropped rather than the string cut at the first "(", because sigils
# legitimately follow a gloss — "V, G, M (une fiole d'eau bénite), FD" would
# otherwise lose its FD.
_GLOSE = re.compile(r"\([^)]*\)")

# Both spellings of the divine focus collapse onto one code: FD and DF are the
# same component, and a filter offering them separately would split its own results.
_CANON_SIGLE = {"DF": "FD"}


def sans_diacritiques(texte: str) -> str:
    """Drop combining marks via NFKD — stdlib only, `unidecode` is not installed."""
    decompose = unicodedata.normalize("NFKD", texte)
    return "".join(c for c in decompose if not unicodedata.combining(c))


def plier(texte: str) -> str:
    """Fold `texte` into a search key.

    Lowercase, strip diacritics, turn every apostrophe variant into a space,
    collapse whitespace. Ported verbatim to TypeScript in
    `web/lib/recherche/pliage.ts`; the two are pinned by identical test vectors.
    """
    resultat = texte
    for ligature, remplacement in _LIGATURES.items():
        resultat = resultat.replace(ligature, remplacement)
    for apostrophe in _APOSTROPHES:
        resultat = resultat.replace(apostrophe, " ")
    resultat = sans_diacritiques(resultat).lower()
    return _ESPACES.sub(" ", resultat).strip()


def _radical(valeur: str) -> str:
    """The folded head of a source value, before any parenthesised qualifier.

    Sub-schools (`Invocation (convocation)`) and inline formulas both live in
    parentheses, so cutting there yields the family for every facet at once.
    """
    return plier(valeur.split("(")[0])


def normaliser_ecole(ecole: str | None) -> str | None:
    """Return the canonical school family, or None when the source has none.

    Raises on an unrecognised school: silently bucketing it would hide a parser
    regression behind a filter that merely looks complete.
    """
    if ecole is None:
        return None
    radical = _radical(ecole)
    if not radical:
        return None
    # `Universelle` and `Universel` are one school under two spellings.
    if radical.startswith("universel"):
        return "universel"
    if radical not in ECOLES_CANONIQUES:
        raise ValueError(f"école hors des huit canoniques : {ecole!r} → {radical!r}")
    return radical


def normaliser_portee(portee: str | None) -> str | None:
    """Return the range family, or `autre` for the genuinely irregular tail."""
    if portee is None:
        return None
    radical = _radical(portee)
    if not radical:
        return None
    for famille in _FAMILLES_PORTEE:
        if radical.startswith(famille):
            return famille
    return "autre"


def normaliser_jet(jet: str | None) -> str | None:
    """Return the saving-throw characteristic, `aucun`, or `special`."""
    if jet is None:
        return None
    plie = plier(jet)
    if not plie:
        return None
    # "aucun" and "non" both mean no save; the wiki uses them interchangeably.
    if plie.startswith("aucun") or plie == "non":
        return "aucun"
    for caracteristique in _CARACTERISTIQUES_JET:
        if caracteristique in plie:
            return caracteristique
    # "voir texte", "spécial" and friends: a real value, just not a filterable one.
    return "special"


def normaliser_resistance(resistance: str | None) -> bool | None:
    """Reduce spell resistance to a filterable boolean, or None when conditional.

    The corpus carries 45 distinct strings here, including "non et oui (cf.
    texte)" and "oui ou non (objet)". A conditional value stays `None` on
    purpose: collapsing it to a boolean would assert something the source
    declines to say. The verbatim string is rendered on the fiche.
    """
    if resistance is None:
        return None
    plie = plier(resistance)
    if not plie:
        return None
    dit_oui = plie.startswith("oui")
    dit_non = plie.startswith("non")
    # Both polarities present ("non et oui", "oui ou non") → not a boolean.
    if ("oui" in plie and "non" in plie) or not (dit_oui or dit_non):
        return None
    return dit_oui


def extraire_composantes(composantes: str | None) -> list[str]:
    """Return the sorted component sigils present in the source phrase.

    The field is prose ("V, G, M (une fiole d'eau bénite), FD"), so glosses are
    dropped first and sigils then matched on word boundaries — otherwise a word
    inside a gloss lands in the filter as a component.
    """
    if composantes is None:
        return []
    # Uppercase so the sigil pattern is case-insensitive without losing boundaries.
    hors_glose = sans_diacritiques(_GLOSE.sub(" ", composantes)).upper()
    trouves = {_CANON_SIGLE.get(s, s) for s in _SIGLE.findall(hors_glose)}
    return sorted(trouves)
