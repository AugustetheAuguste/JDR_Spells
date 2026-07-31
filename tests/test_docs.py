"""Tests for the hand-authored root documentation.

`CLAUDE.md` is loaded into every future agent session and `README.md` is the human
entry point, so both are load-bearing artifacts and are tested like code. The two
tests that matter most: the pipeline command block may not name a module that does
not exist, and the README's worked example must be the *real* spell file — a
retyped-from-memory example is worse than none, because it teaches wrong shapes.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

BLOC_COMMANDES = re.compile(r"python -m pf_spells\.(\w+)")
BLOC_PIPELINE = re.compile(
    r"```\nexport PYTHONPATH=src\npython -m pf_spells\.fetch_classes(.*?)```",
    re.DOTALL,
)


def _bloc_pipeline(texte: str) -> list[str]:
    """Return the module names of the canonical pipeline command block."""
    blocs = BLOC_PIPELINE.findall(texte)
    assert len(blocs) == 1, "le bloc de commandes du pipeline doit être unique"
    return BLOC_COMMANDES.findall(blocs[0])


@pytest.fixture(scope="module")
def claude_md(repo_root: Path) -> Path:
    return repo_root / "CLAUDE.md"


@pytest.fixture(scope="module")
def readme_md(repo_root: Path) -> Path:
    return repo_root / "README.md"


@pytest.fixture(scope="module")
def claude_texte(claude_md: Path) -> str:
    return claude_md.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def readme_texte(readme_md: Path) -> str:
    return readme_md.read_text(encoding="utf-8")


class TestFormatDesDocs:
    @pytest.mark.parametrize("nom", ["CLAUDE.md", "README.md"])
    def test_utf8_lf_sans_bom_newline_final(self, repo_root: Path, nom: str) -> None:
        octets = (repo_root / nom).read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in octets
        assert octets.endswith(b"\n")
        octets.decode("utf-8")

    def test_claude_md_tient_dans_son_budget(self, claude_texte: str) -> None:
        """It is prepended to every session's context: rules and pointers only.

        Raised from 120 to 165 when the LLM-enrichment layer added § 10 — that
        layer has non-negotiables of its own (no human lock, `preuves`, the 5 %
        rule) and a session that has not read them will damage data. The budget
        exists to force deferral to the Skills, and § 10 does defer: it states the
        rules that must not be discovered the hard way, and points for the rest.
        """
        assert len(claude_texte.splitlines()) <= 165

    def test_claude_md_est_numerote_sans_trou(self, claude_texte: str) -> None:
        titres = [
            ligne for ligne in claude_texte.splitlines() if ligne.startswith("## ")
        ]
        assert len(titres) == 11
        for n, titre in enumerate(titres, start=1):
            assert titre.startswith(f"## {n}. "), titre


class TestCLAUDEmdContenu:
    def test_nomme_la_skill_et_lui_defere(self, claude_texte: str) -> None:
        assert 'Skill(skill="pf-corpus-conventions")' in claude_texte
        assert ".claude/skills/pf-corpus-conventions/SKILL.md" in claude_texte
        assert "la Skill gagne" in claude_texte

    def test_ne_recopie_pas_le_vocabulaire_des_cles(self, claude_texte: str) -> None:
        # Deferring means NOT restating the Skill's key table. A handful of keys is
        # fine as illustration; the whole vocabulary would be a duplicate to drift.
        cles = (
            "temps_incantation",
            "jet_de_sauvegarde",
            "resistance_magie",
            "descripteurs",
            "description_html",
            "variantes",
        )
        assert sum(cle in claude_texte for cle in cles) <= 2

    def test_ne_recopie_pas_la_table_des_classes(self, claude_texte: str) -> None:
        abbrevs = ("Antipal", "Hyp", "Occ", "Psy", "Spi", "Cham", "Magus")
        assert sum(a in claude_texte for a in abbrevs) <= 1

    def test_regle_de_politesse_1_req_s(self, claude_texte: str) -> None:
        assert "1 requête/seconde" in claude_texte
        assert "workers au-dessus de 4" in claude_texte

    def test_autorite_du_pipeline_sur_les_donnees(self, claude_texte: str) -> None:
        """`data/sorts/` est un artefact de machine, et le dit.

        L'ancienne version garantissait l'inverse (« l'humain fait foi »). Le
        garde-fou est conservé mais retourné : ce qui doit être écrit noir sur
        blanc, c'est qu'une édition manuelle sera écrasée, sinon quelqu'un
        corrigera un fichier en croyant que ça tient.
        """
        assert "artefact de machine" in claude_texte
        assert "sera écrasée" in claude_texte
        assert "--overwrite" in claude_texte
        assert "clé `classes`" in claude_texte
        # Et surtout : plus aucune promesse d'autorité humaine.
        assert "l'humain fait foi" not in claude_texte
        assert "éditions humaines" not in claude_texte

    def test_regles_dures(self, claude_texte: str) -> None:
        assert "UTF-8" in claude_texte
        assert 'PageContentDiv' in claude_texte
        assert "unidecode" in claude_texte
        assert "NFKD" in claude_texte

    def test_algorithme_de_slug_present(self, claude_texte: str) -> None:
        assert "unicodedata.combining" in claude_texte
        assert "[a-z0-9]" in claude_texte
        assert "jamais renuméroté" in claude_texte

    def test_anomalies_connues(self, claude_texte: str) -> None:
        assert "Alchimiste" in claude_texte
        assert "20 → 19" in claude_texte
        assert "Mythique" in claude_texte
        assert "phase ultérieure" in claude_texte

    def test_relances_en_cache(self, claude_texte: str) -> None:
        assert "ne refont\naucune requête" in claude_texte

    def test_interdictions_de_style(self, claude_texte: str) -> None:
        assert "__init__.py" in claude_texte
        assert "__all__" in claude_texte

    def test_autorite_des_artefacts(self, claude_texte: str) -> None:
        for chemin in (
            "data/classes.json",
            "data/listes_classes/<slug>.jsonl",
            "data/index/sorts_uniques.jsonl",
            "data/sorts/<id>.json",
            "cache/index.jsonl",
            "schemas/*.json",
        ):
            assert chemin in claude_texte, chemin


class TestCLAUDEmdCoucheEnrichissement:
    """§ 10 and the amendments the LLM layer forced elsewhere in the file."""

    def test_les_trois_etages_et_la_vue_sont_nommes(self, claude_texte: str) -> None:
        for attendu in ("étage 08", "étage 09", "étage 10", "data/vues/"):
            assert attendu in claude_texte, attendu

    def test_les_arbres_de_la_couche_font_partie_de_la_table(
        self, claude_texte: str
    ) -> None:
        for chemin in (
            "data/enrichissements/<id>.json",
            "data/vues/sorts_enrichis/<id>.json",
            "conventions/vocabulaires/*.json",
        ):
            assert chemin in claude_texte, chemin

    def test_les_deux_nouveaux_skills_sont_cites(self, claude_texte: str) -> None:
        assert "pf-enrichment-conventions" in claude_texte
        assert "pf-bedrock-batch" in claude_texte

    def test_la_regle_de_non_ecrasement_est_ecrite(self, claude_texte: str) -> None:
        assert "sera écrasée" in claude_texte
        assert "--force" in claude_texte

    def test_le_verrou_humain_est_declare_inexistant(self, claude_texte: str) -> None:
        """The semantics of `verifie_par_humain` are: it does not exist.

        The plan asked for the field's semantics to be stated. Its semantics turned
        out to be absence, and stating that is what matters — a session that thinks
        the field exists will write a key the schema rejects.
        """
        assert "`verifie_par_humain` n'existe pas" in claude_texte
        assert "17ᵉ clé" in claude_texte

    def test_la_vue_est_declaree_derivee(self, claude_texte: str) -> None:
        assert "DÉRIVÉ : jamais édité à la main" in claude_texte

    def test_l_exception_reseau_est_amendee_et_non_contournee(
        self, claude_texte: str
    ) -> None:
        """The file may no longer promise that everything but the wiki is offline.

        `enrich_llm` is a paid network stage; a CLAUDE.md that still said "tout le
        reste est hors ligne" full stop would be read as "this cannot cost money".
        """
        assert "tout le reste est hors ligne." not in claude_texte
        assert "RÉSEAU, PAYANT" in claude_texte
        assert "seules exceptions" in claude_texte

    def test_la_note_d_exploitation_aws_est_presente(self, claude_texte: str) -> None:
        assert "AWS_BEARER_TOKEN_BEDROCK" in claude_texte
        assert "variable d'environnement" in claude_texte
        assert "plafond de dépense" in claude_texte

    def test_renvoie_vers_la_documentation_de_procedure(
        self, repo_root: Path, claude_texte: str
    ) -> None:
        assert "docs/enrichissement.md" in claude_texte
        assert (repo_root / "docs" / "enrichissement.md").is_file()

    def test_le_seuil_des_cinq_pourcent_n_est_pas_relachable(
        self, claude_texte: str
    ) -> None:
        assert "on ne desserre pas le seuil" in claude_texte


class TestBlocDeCommandes:
    @pytest.mark.parametrize("nom", ["CLAUDE.md", "README.md"])
    def test_bloc_present_et_complet(self, repo_root: Path, nom: str) -> None:
        modules = BLOC_COMMANDES.findall((repo_root / nom).read_text(encoding="utf-8"))
        attendus = [
            "fetch_classes",
            "parse_lists",
            "build_index",
            "fetch_spells",
            "parse_spells",
            "enrich_spells",
            "validate_corpus",
            "build_manifest",
        ]
        for attendu in attendus:
            assert attendu in modules, f"{nom} : {attendu} absent du bloc"

    @pytest.mark.parametrize("nom", ["CLAUDE.md", "README.md"])
    def test_chaque_module_cite_existe(self, repo_root: Path, nom: str) -> None:
        texte = (repo_root / nom).read_text(encoding="utf-8")
        manquants = [
            module
            for module in set(BLOC_COMMANDES.findall(texte))
            if not (repo_root / "src" / "pf_spells" / f"{module}.py").is_file()
        ]
        assert manquants == []

    def test_les_deux_blocs_sont_identiques(
        self, claude_texte: str, readme_texte: str
    ) -> None:
        # Compare the pipeline block only: the README cites validate_corpus a
        # second time, in the hand-correction section, which is intentional.
        assert _bloc_pipeline(claude_texte) == _bloc_pipeline(readme_texte)


def _blocs_json(texte: str) -> list[str]:
    return re.findall(r"```json\n(.*?)```", texte, flags=re.DOTALL)


class TestExempleTravailleDuREADME:
    def test_le_readme_contient_deux_blocs_json(self, readme_texte: str) -> None:
        assert len(_blocs_json(readme_texte)) == 2

    def test_exemple_de_sort_identique_au_fichier_reel(
        self, repo_root: Path, readme_texte: str
    ) -> None:
        reel = (repo_root / "data" / "sorts" / "armes-contre-le-mal.json").read_text(
            encoding="utf-8"
        )
        assert _blocs_json(readme_texte)[0] == reel

    def test_exemple_de_sort_est_du_json_valide(self, readme_texte: str) -> None:
        doc = json.loads(_blocs_json(readme_texte)[0])
        assert doc["id"] == "armes-contre-le-mal"
        assert len(doc) == 21

    def test_exemple_de_liste_identique_a_la_premiere_ligne(
        self, repo_root: Path, readme_texte: str
    ) -> None:
        premiere = (
            repo_root / "data" / "listes_classes" / "paladin.jsonl"
        ).read_text(encoding="utf-8").splitlines(keepends=True)[0]
        assert _blocs_json(readme_texte)[1] == premiere

    def test_exemple_de_liste_est_du_json_valide(self, readme_texte: str) -> None:
        ligne = json.loads(_blocs_json(readme_texte)[1])
        assert ligne["classe"] == "Paladin"
        assert ligne["id"]

    def test_chaque_cle_du_sort_est_expliquee(
        self, repo_root: Path, readme_texte: str
    ) -> None:
        doc = json.loads(_blocs_json(readme_texte)[0])
        for cle in doc:
            assert f"| `{cle}` |" in readme_texte, cle


class TestREADMEContenu:
    def test_attribution_de_la_source(self, readme_texte: str) -> None:
        assert "pathfinder-fr.org" in readme_texte
        assert "Black Book Editions" in readme_texte
        assert "Paizo" in readme_texte
        assert "usage personnel" in readme_texte

    def test_totaux_annonces_correspondent_au_disque(
        self, repo_root: Path, readme_texte: str
    ) -> None:
        nb_sorts = len(list((repo_root / "data" / "sorts").glob("*.json")))
        nb_classes = len(
            json.loads(
                (repo_root / "data" / "classes.json").read_text(encoding="utf-8")
            )
        )
        assert f"| Sorts uniques | {nb_sorts} |" in readme_texte
        assert f"| Fichiers `data/sorts/*.json` | {nb_sorts} |" in readme_texte
        assert f"| Classes lanceuses couvertes | {nb_classes} |" in readme_texte

    def test_les_trois_index_ont_leur_question(self, readme_texte: str) -> None:
        for fichier in (
            "data/index/sorts_uniques.jsonl",
            "data/index/carte_doublons.json",
            "data/index/sorts_exclusifs.json",
        ):
            assert f"| `{fichier}` |" in readme_texte, fichier

    def test_dit_que_le_pipeline_fait_foi_et_non_l_editeur(
        self, readme_texte: str
    ) -> None:
        assert "aucun statut particulier" in readme_texte
        assert "--overwrite" in readme_texte
        assert "garde-fou" in readme_texte
        assert "Les éditions humaines font foi." not in readme_texte

    def test_regle_de_politesse(self, readme_texte: str) -> None:
        assert "1 requête/seconde" in readme_texte

    def test_lien_vers_le_rapport_de_validation(self, readme_texte: str) -> None:
        # Step 09 runs in parallel: the link is by path and must not be resolved.
        assert "reports/09_validation.md" in readme_texte

    def test_defere_a_la_skill(self, readme_texte: str) -> None:
        assert ".claude/skills/pf-corpus-conventions/SKILL.md" in readme_texte

    def test_chemins_de_la_carte_du_depot_existent(
        self, repo_root: Path, readme_texte: str
    ) -> None:
        concrets = [
            "elements_to_do.json",
            "pages/",
            "CLAUDE.md",
            ".claude/skills/pf-corpus-conventions/SKILL.md",
            "schemas/sort.schema.json",
            "schemas/liste_classe.schema.json",
            "src/pf_spells/",
            "tests/",
            "cache/index.jsonl",
            "data/classes.json",
            "data/spell_pages.jsonl",
            "data/index/sorts_uniques.jsonl",
            "data/index/carte_doublons.json",
            "data/index/sorts_exclusifs.json",
            "data/MANIFEST.json",
            "reports/",
        ]
        for chemin in concrets:
            assert chemin in readme_texte, f"{chemin} absent du README"
            assert (repo_root / chemin).exists(), f"{chemin} absent du disque"


class TestLeReadmeEstRendu:
    """`README.md` is generated by `tools/render_readme.py`, not hand-edited.

    The renderer exists so that the spliced blocks and the counted figures cannot
    drift from the corpus. That guarantee is worth nothing if someone edits the
    output instead of the template, so the check is that the committed file *is*
    the current render.
    """

    def test_le_readme_committe_est_le_rendu_courant(self, repo_root: Path) -> None:
        import importlib.util

        chemin = repo_root / "tools" / "render_readme.py"
        spec = importlib.util.spec_from_file_location("render_readme", chemin)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        attendu = module.rendre()
        reel = (repo_root / "README.md").read_text(encoding="utf-8")
        assert reel == attendu, (
            "README.md n'est pas le rendu de tools/readme_gabarit.md — "
            "éditer le gabarit puis relancer `python tools/render_readme.py`"
        )

    def test_le_gabarit_ne_porte_pas_les_chiffres_en_dur(self, repo_root: Path) -> None:
        """A figure typed into the template defeats the recount.

        Only the totals table is checked: prose elsewhere legitimately cites
        historical counts (the 20 → 19 dedup, the 8409 concordant pairs) that are
        not recomputed and must not be.
        """
        gabarit = (repo_root / "tools" / "readme_gabarit.md").read_text(
            encoding="utf-8"
        )
        nb_sorts = len(list((repo_root / "data" / "sorts").glob("*.json")))
        assert f"| Sorts uniques | {nb_sorts} |" not in gabarit
        assert "| Sorts uniques | {sorts} |" in gabarit
