"""Tests for the data-drift guard.

The test that matters here is the negative one. A drift check that passes is
indistinguishable from a drift check that does nothing at all — the plan asks for
proof that it bites, and « I ran it once by hand » is not a proof that survives to
the next change. So a spell is edited in a throwaway copy of the corpus and the
checker is required to fail *and* to name the spell: a bare « ça diverge » over
2070 files is unactionable.

Everything happens in `tmp_path`. The real `web/public/data/` is never touched,
which is also the contract the checker itself claims.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from tools.verifier_derive import DeriveError, verifier

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "web_corpus"
HORODATAGE = "2026-07-31T00:00:00+00:00"


def _ecrire_json(chemin: Path, contenu: object) -> None:
    """House format: UTF-8, LF, indent 2, trailing newline."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with chemin.open("w", encoding="utf-8", newline="\n") as flux:
        json.dump(contenu, flux, ensure_ascii=False, indent=2)
        flux.write("\n")


@pytest.fixture
def depot(tmp_path: Path) -> Path:
    """A self-contained repo: the fixture corpus plus a freshly exported
    `web/public/data/`, so the starting point is by construction in agreement."""
    racine = tmp_path / "depot"
    shutil.copytree(FIXTURE / "data", racine / "data")
    for chemin in ("src/pf_spells", "data/schemas", "tools", "tests"):
        source = REPO_ROOT / chemin
        cible = racine / chemin
        cible.parent.mkdir(parents=True, exist_ok=True)
        if chemin == "tests":
            # Only the marker `preflight` looks for; copying the suite would copy
            # this file and recurse.
            cible.mkdir()
            (cible / "__init__.py").write_text("", encoding="utf-8")
        else:
            shutil.copytree(source, cible, dirs_exist_ok=True)
    skill = REPO_ROOT / ".claude" / "skills" / "pf-corpus-conventions" / "SKILL.md"
    if skill.exists():
        cible = racine / ".claude" / "skills" / "pf-corpus-conventions" / "SKILL.md"
        cible.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(skill, cible)

    from pf_spells.export_web import construire

    construire(
        racine,
        racine / "web" / "public" / "data",
        avec_preflight=False,
        genere_le=HORODATAGE,
    )

    # The alias table, so the checker's alias branch has something real to rebuild.
    table = racine / "web" / "data_sources" / "alias_manuel.tsv"
    table.parent.mkdir(parents=True, exist_ok=True)
    # At least one real pair: the builder rejects an empty table, on the grounds
    # that an alias file nobody filled in is a mistake, not a valid empty case.
    table.write_text(
        "abondance-de-munitions\tabundant ammunition\n", encoding="utf-8", newline="\n"
    )
    from pf_spells.build_alias import construire as construire_alias

    construire_alias(racine, avec_preflight=False, genere_le=HORODATAGE)
    return racine


class TestAccord:
    def test_un_depot_a_jour_ne_signale_rien(self, depot: Path) -> None:
        assert verifier(depot) == []

    def test_la_verification_ne_modifie_pas_les_artefacts(self, depot: Path) -> None:
        donnees = depot / "web" / "public" / "data"
        avant = {
            chemin.relative_to(donnees).as_posix(): chemin.read_bytes()
            for chemin in donnees.rglob("*.json")
        }
        verifier(depot)
        apres = {
            chemin.relative_to(donnees).as_posix(): chemin.read_bytes()
            for chemin in donnees.rglob("*.json")
        }
        # Notably `alias.json`, which the checker rebuilds *in place* and restores.
        assert apres == avant


class TestDerive:
    """The negative cases: the check must bite, and say where."""

    def test_un_sort_corrige_sans_reexport_est_detecte_et_nomme(
        self, depot: Path
    ) -> None:
        chemin = depot / "data" / "sorts" / "abondance-de-munitions.json"
        sort = json.loads(chemin.read_text(encoding="utf-8"))
        sort["portee"] = "portée falsifiée"
        _ecrire_json(chemin, sort)

        divergences = verifier(depot)
        assert divergences != [], "un corpus modifié doit faire échouer la vérification"
        assert any(divergence.artefact == "sorts/" for divergence in divergences)
        # Named, not merely counted: « ça diverge » sur 2070 fichiers est inactionnable.
        details = " ".join(divergence.detail for divergence in divergences)
        assert "abondance-de-munitions" in details

    def test_un_artefact_publie_retouche_a_la_main_est_detecte(
        self, depot: Path
    ) -> None:
        # The other direction: nobody touched the corpus, someone edited the
        # derived file. Same verdict — the corpus is the authority.
        chemin = depot / "web" / "public" / "data" / "sorts" / "abondance-de-munitions.json"
        props = json.loads(chemin.read_text(encoding="utf-8"))
        props["nom"] = "Abondance retouchée à la main"
        _ecrire_json(chemin, props)

        divergences = verifier(depot)
        assert any(divergence.artefact == "sorts/" for divergence in divergences)

    def test_un_nom_corrige_fait_aussi_diverger_l_index(self, depot: Path) -> None:
        # `portee` only lives in the per-spell props; `nom` reaches the index too.
        # Both sides must be compared, or half the published surface goes unchecked.
        chemin = depot / "data" / "sorts" / "abondance-de-munitions.json"
        sort = json.loads(chemin.read_text(encoding="utf-8"))
        sort["nom"] = "Abondance de munitions corrigée"
        _ecrire_json(chemin, sort)

        artefacts = {divergence.artefact for divergence in verifier(depot)}
        assert artefacts == {"index.json", "sorts/"}

    def test_un_fichier_de_props_disparu_est_detecte(self, depot: Path) -> None:
        (
            depot / "web" / "public" / "data" / "sorts" / "abondance-de-munitions.json"
        ).unlink()
        divergences = verifier(depot)
        assert any(
            "non committé" in divergence.detail for divergence in divergences
        ), divergences

    def test_un_alias_reconstruit_differemment_est_detecte(self, depot: Path) -> None:
        publie = depot / "web" / "public" / "data" / "alias.json"
        contenu = json.loads(publie.read_text(encoding="utf-8"))
        # An alias the manual table does not contain: rebuilding drops it, which is
        # exactly the case where the published file has drifted from its source.
        contenu["alias"] = {"munitions galore": ["abondance-de-munitions"]}
        _ecrire_json(publie, contenu)
        divergences = verifier(depot)
        assert any(divergence.artefact == "alias.json" for divergence in divergences)
        # And the file is put back the way it was found, drift or not.
        assert json.loads(publie.read_text(encoding="utf-8"))["alias"] == {
            "munitions galore": ["abondance-de-munitions"]
        }


class TestDefauts:
    def test_un_index_absent_leve_une_erreur_distincte_de_la_derive(
        self, tmp_path: Path
    ) -> None:
        # Not being able to run the check is not the same as finding no drift, and
        # must not be reported as success.
        with pytest.raises(DeriveError, match="absent"):
            verifier(tmp_path)

    def test_un_index_sans_horodatage_leve_une_erreur(self, depot: Path) -> None:
        chemin = depot / "web" / "public" / "data" / "index.json"
        contenu = json.loads(chemin.read_text(encoding="utf-8"))
        del contenu["genere_le"]
        _ecrire_json(chemin, contenu)
        with pytest.raises(DeriveError, match="genere_le"):
            verifier(depot)
