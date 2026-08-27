"""Tests for the web index's folding and facet normalization.

`TestVecteursGeles` is the important class: those exact pairs are duplicated in
`web/lib/recherche/pliage.test.ts`. The Python exporter writes `nf` and the
TypeScript client folds the query, so the two implementations must agree
character for character — and when they drift, search does not raise, it just
silently stops matching accented words. Frozen vectors on both sides are the
only mechanism that turns that silence into a red test.

`TestSurLeCorpusReel` runs the normalizers over all 2070 committed spells. A
normalizer that only works on hand-picked examples is not a normalizer, and the
corpus is the artifact these facets have to survive.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pf_spells.web_pliage import (
    ECOLES_CANONIQUES,
    extraire_composantes,
    normaliser_ecole,
    normaliser_jet,
    normaliser_portee,
    normaliser_resistance,
    normaliser_temps_incantation,
    plier,
    sans_diacritiques,
)

REPO_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def sorts() -> list[dict]:
    """Every committed spell, decoded explicitly as UTF-8."""
    dossier = REPO_ROOT / "data" / "sorts"
    fichiers = sorted(dossier.glob("*.json"))
    assert fichiers, "aucun sort sur disque : dépôt partiel ?"
    return [json.loads(f.read_text(encoding="utf-8")) for f in fichiers]


class TestVecteursGeles:
    """The pinned pairs, mirrored in the TypeScript port. Do not relax these."""

    # Each vector encodes one rule, so a failure names the rule that broke.
    VECTEURS = [
        ("Éclair", "eclair"),  # diacritic + case
        ("Mur d'épines", "mur d epines"),  # straight apostrophe -> space
        ("Mur d’épines", "mur d epines"),  # U+2019 -> space, same result
        ("Cœur incassable", "coeur incassable"),  # ligature via NFKD path
        ("  Boule   de   FEU  ", "boule de feu"),  # whitespace runs collapse
        ("Détection de la magie", "detection de la magie"),
        ("Convocation de monstres I", "convocation de monstres i"),
        ("", ""),  # empty stays empty, never None
    ]

    @pytest.mark.parametrize("entree,attendu", VECTEURS)
    def test_vecteur(self, entree: str, attendu: str) -> None:
        assert plier(entree) == attendu

    def test_les_deux_apostrophes_convergent(self) -> None:
        """U+2019 and U+0027 must fold identically or search splits in two."""
        assert plier("Mur d'épines") == plier("Mur d’épines")

    def test_l_apostrophe_devient_espace_pas_rien(self) -> None:
        """Folding to "" would make "mur depines" unreachable from the real name.

        Someone typing fast omits the apostrophe; both spellings have to land on
        the same token run.
        """
        assert plier("Mur d'épines") == "mur d epines"
        assert plier("Mur depines") == "mur depines"

    def test_le_pliage_est_idempotent(self) -> None:
        """Folding an already-folded string changes nothing.

        The client folds the query, and may fold a value that came back already
        folded; a non-idempotent fold would corrupt the second pass.
        """
        for entree, attendu in self.VECTEURS:
            assert plier(attendu) == attendu, entree

    def test_sans_diacritiques_ne_touche_pas_la_casse(self) -> None:
        """The two operations are separable; only `plier` lowercases."""
        assert sans_diacritiques("Éclair") == "Eclair"


class TestNormaliserEcole:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("Abjuration", "abjuration"),
            ("abjuration", "abjuration"),  # case variants exist in the corpus
            ("Évocation", "evocation"),
            ("Invocation (création)", "invocation"),  # sub-school -> family
            ("Invocation (convocation) (voir texte)", "invocation"),
            ("Nécromancie (métamorphose)", "necromancie"),
            ("Enchantement (coercition) (effet mental)", "enchantement"),
            ("Universel", "universel"),
            ("Universelle", "universel"),  # one school, two spellings
            (None, None),
        ],
    )
    def test_famille(self, entree: str | None, attendu: str | None) -> None:
        assert normaliser_ecole(entree) == attendu

    def test_une_ecole_inconnue_est_une_erreur_pas_un_silence(self) -> None:
        """Bucketing an unknown school would hide a parser regression."""
        with pytest.raises(ValueError, match="huit canoniques"):
            normaliser_ecole("Technomancie")

    def test_les_familles_sont_dans_la_liste_close(self) -> None:
        for ecole in ("Transmutation (eau)", "Illusion (ombre)", "Divination"):
            assert normaliser_ecole(ecole) in ECOLES_CANONIQUES


class TestNormaliserPortee:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("contact", "contact"),
            ("personnelle", "personnelle"),
            ("courte (7,50 m + 1,50 m/2 niveaux) (5 c + 1 c/2 niveaux)", "courte"),
            ("courte (7,5 m + 1,5 m/2 niveaux)", "courte"),  # comma variant
            ("moyenne (30 m + 3 m/niveau)", "moyenne"),
            ("longue (120 m + 12 m/niveau)", "longue"),
            ("9 m (6 c)", "autre"),  # a bare distance is not a family
            ("voir description", "autre"),
            (None, None),
        ],
    )
    def test_famille(self, entree: str | None, attendu: str | None) -> None:
        assert normaliser_portee(entree) == attendu


class TestNormaliserJet:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("aucun", "aucun"),
            ("non", "aucun"),  # the wiki uses both for "no save"
            ("Volonté, annule", "volonte"),
            ("Volonté pour annuler (inoffensif)", "volonte"),
            ("Vigueur, annule", "vigueur"),
            ("Réflexes, 1/2 dégâts", "reflexes"),
            ("voir texte", "special"),
            ("spécial", "special"),
            (None, None),
        ],
    )
    def test_caracteristique(self, entree: str | None, attendu: str | None) -> None:
        assert normaliser_jet(entree) == attendu


class TestNormaliserResistance:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("oui", True),
            ("oui (inoffensif)", True),
            ("oui (objet)", True),
            ("Oui", True),  # capitalised variants exist
            ("non", False),
            ("Non", False),
            ("non (voir texte)", False),
            (None, None),
        ],
    )
    def test_booleen(self, entree: str | None, attendu: bool | None) -> None:
        assert normaliser_resistance(entree) is attendu

    @pytest.mark.parametrize(
        "entree",
        [
            "non et oui (cf. texte)",
            "oui ou non (objet)",
            "non ou oui (inoffensif, objet)",
            "voir description",
            "voir texte",
            "spécial, voir plus bas",
        ],
    )
    def test_un_cas_conditionnel_reste_nul(self, entree: str) -> None:
        """Forcing a boolean here would assert what the source declines to say."""
        assert normaliser_resistance(entree) is None


class TestNormaliserTempsIncantation:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("1 action simple", "action_simple"),
            ("1 action immédiate", "action_immediate"),
            ("1 action rapide", "action_rapide"),
            ("1 action complexe", "action_complexe"),
            ("1 round", "round"),
            ("3 rounds", "round"),
            ("10 minutes", "minute"),
            ("1 heure", "heure"),
            ("1 semaine", "semaine"),
            ("voir description", "special"),
            ("voir texte", "special"),
            ("1 action complexe ; spécial, voir ci-dessous.", "action_complexe"),
            (None, None),
        ],
    )
    def test_famille(self, entree: str | None, attendu: str | None) -> None:
        assert normaliser_temps_incantation(entree) == attendu


class TestExtraireComposantes:
    @pytest.mark.parametrize(
        "entree,attendu",
        [
            ("V, G, M", ["G", "M", "V"]),
            ("V", ["V"]),
            ("V, G, FD", ["FD", "G", "V"]),
            ("M/FD", ["FD", "M"]),
            ("F/DF", ["F", "FD"]),  # DF and FD are the same component
            ("V ou G", ["G", "V"]),
            ("S, M (un petit carillon)", ["M", "S"]),
            (None, []),
        ],
    )
    def test_sigles(self, entree: str | None, attendu: list[str]) -> None:
        assert extraire_composantes(entree) == attendu

    def test_une_glose_ne_produit_pas_de_faux_sigle(self) -> None:
        """"créature de taille M" is a size, not a material component.

        This exact string is in the corpus; it is the reason glosses are stripped
        before matching rather than after.
        """
        assert extraire_composantes(
            "V, G, F (le crâne ou le fémur d'une créature de taille M), FD"
        ) == ["F", "FD", "G", "V"]

    def test_un_sigle_apres_une_glose_est_conserve(self) -> None:
        """Cutting at the first "(" instead of dropping glosses would lose the FD."""
        assert extraire_composantes("V, G, M (une fiole d'eau bénite), FD") == [
            "FD",
            "G",
            "M",
            "V",
        ]

    def test_le_resultat_est_trie_et_sans_doublon(self) -> None:
        resultat = extraire_composantes("M, M/FD, FD, V")
        assert resultat == sorted(set(resultat))


class TestSurLeCorpusReel:
    """The normalizers must hold on all 2070 committed spells, not just samples."""

    def test_toutes_les_ecoles_du_corpus_sont_reconnues(self, sorts: list[dict]) -> None:
        """No spell may raise: a raise here means an unmapped school shipped."""
        familles = {normaliser_ecole(s["ecole"]) for s in sorts}
        assert familles - {None} <= ECOLES_CANONIQUES
        # The corpus spells 8 schools 60 ways; the fold must actually collapse them.
        assert len(familles - {None}) <= len(ECOLES_CANONIQUES)

    def test_les_soixante_orthographes_se_replient_sur_neuf_familles(
        self, sorts: list[dict]
    ) -> None:
        """The whole point of the fold, asserted as a ratio rather than a count."""
        brutes = {s["ecole"] for s in sorts if s["ecole"] is not None}
        familles = {normaliser_ecole(s["ecole"]) for s in sorts} - {None}
        assert len(brutes) > 40, "le corpus a changé : moins de variantes qu'attendu"
        assert len(familles) <= 9

    def test_chaque_portee_tombe_dans_une_famille(self, sorts: list[dict]) -> None:
        attendues = {"contact", "personnelle", "courte", "moyenne", "longue", "autre"}
        familles = {normaliser_portee(s["portee"]) for s in sorts}
        assert familles - {None} <= attendues

    def test_chaque_jet_tombe_dans_une_caracteristique(self, sorts: list[dict]) -> None:
        attendus = {"aucun", "volonte", "vigueur", "reflexes", "special"}
        familles = {normaliser_jet(s["jet_de_sauvegarde"]) for s in sorts}
        assert familles - {None} <= attendus

    def test_chaque_temps_d_incantation_tombe_dans_une_famille(
        self, sorts: list[dict]
    ) -> None:
        attendues = {
            "action_simple",
            "action_immediate",
            "action_rapide",
            "action_complexe",
            "round",
            "minute",
            "heure",
            "semaine",
            "special",
        }
        familles = {normaliser_temps_incantation(s["temps_incantation"]) for s in sorts}
        assert familles - {None} <= attendues

    def test_la_resistance_est_booleenne_ou_nulle(self, sorts: list[dict]) -> None:
        valeurs = {normaliser_resistance(s["resistance_magie"]) for s in sorts}
        assert valeurs <= {True, False, None}

    def test_les_sigles_de_composantes_sont_clos(self, sorts: list[dict]) -> None:
        """A sigil outside this set means the field grew a form we do not model."""
        attendus = {"V", "G", "M", "F", "FD", "S"}
        vus: set[str] = set()
        for sort in sorts:
            vus.update(extraire_composantes(sort["composantes"]))
        assert vus <= attendus, f"sigles inattendus : {sorted(vus - attendus)}"

    def test_aucun_nom_plie_n_est_vide(self, sorts: list[dict]) -> None:
        """An empty `nf` would make a real spell unreachable by search."""
        vides = [s["id"] for s in sorts if not plier(s["nom"])]
        assert vides == []

    def test_le_pliage_ne_laisse_aucun_diacritique(self, sorts: list[dict]) -> None:
        """Any surviving accent is a token the folded query can never match."""
        for sort in sorts:
            plie = plier(sort["nom"])
            assert plie == sans_diacritiques(plie), sort["id"]

    def test_aucun_u_fffd_dans_les_noms_plies(self, sorts: list[dict]) -> None:
        """U+FFFD would prove the corpus was decoded as anything but UTF-8."""
        remplacement = chr(0xFFFD)
        for sort in sorts:
            assert remplacement not in plier(sort["nom"]), sort["id"]
