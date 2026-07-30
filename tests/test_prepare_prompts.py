"""Tests for stage 08 (prompt assembly) and the shared canonical source text.

Three layers, matching `test_taxo_passe0.py`:

- **unit** — the pure functions, on hand-built dicts;
- **wired** — full `run()` against `tests/fixtures/mini_corpus`, in `tmp_path`,
  with sockets forbidden so "offline" is enforced rather than asserted;
- **committed** — the real vocabularies, read-only.

The load-bearing test is `TestStabiliteDuHash`: `texte_source_canonique` is shared
with stage 10, which re-checks evidence substrings literally. If its output drifts,
every stored `hash_source` becomes wrong and every evidence check fails at once.
The frozen hashes below are the guard against a silent reformat.
"""

from __future__ import annotations

import json
import socket
from pathlib import Path
from typing import Any

import jsonschema
import pytest

from pf_spells import prepare_prompts as pp
from pf_spells import texte_source as ts
from pf_spells.enrichissement_schema import charger_schema_resolu

MINI = Path("tests") / "fixtures" / "mini_corpus"


@pytest.fixture(scope="module")
def mini_racine(repo_root: Path) -> Path:
    return repo_root / MINI


@pytest.fixture
def pas_de_reseau(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make any socket use a hard failure for the duration of one test.

    The step requires stage 08 to be provably offline. Asserting "we did not call
    boto3" would only cover the call we thought of; banning the socket covers the
    ones we did not.
    """

    def interdit(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("l'étage 08 est hors ligne : aucun socket autorisé")

    monkeypatch.setattr(socket, "socket", interdit)
    monkeypatch.setattr(socket, "create_connection", interdit)


SORT_MINIMAL: dict[str, Any] = {
    "id": "sort-test",
    "nom": "Sort de test",
    "ecole": "Évocation",
    "descripteurs": ["feu"],
    "niveaux": {"Ens/Mag": 3},
    "temps_incantation": "1 action simple",
    "composantes": "V, G",
    "portee": "courte",
    "cible": "une créature",
    "duree": "instantanée",
    "jet_de_sauvegarde": "Réflexes, 1/2",
    "resistance_magie": None,
    "description": "Inflige 3d6 points de dégâts de feu.",
    "variantes": [{"nom": "Variante piège", "description": "NE DOIT PAS APPARAÎTRE"}],
    "mythique": {"description": "NE DOIT PAS APPARAÎTRE NON PLUS"},
}


class TestTexteSourceCanonique:
    def test_les_champs_sortent_dans_l_ordre_gele(self) -> None:
        texte = ts.texte_source_canonique(SORT_MINIMAL)
        presents = [c for c in ts.CHAMPS if f"{c}: " in texte]
        positions = [texte.index(f"{c}: ") for c in presents]
        assert positions == sorted(positions), texte

    def test_un_champ_nul_est_omis_et_non_rendu_en_null(self) -> None:
        # The corpus writes null for "absent from source". Emitting the word would
        # hand the model a string it could quote as if it were content.
        texte = ts.texte_source_canonique(SORT_MINIMAL)
        assert "resistance_magie" not in texte
        assert "null" not in texte

    def test_les_accents_sont_verbatim(self) -> None:
        texte = ts.texte_source_canonique(SORT_MINIMAL)
        assert "Évocation" in texte
        assert "instantanée" in texte
        assert "dégâts" in texte

    def test_les_descripteurs_sont_inclus(self) -> None:
        """The bracketed descriptors are often the only place the energy is named.

        Excluding them would force `type_degats: null` on a fire spell whose prose
        never says "feu" — an artefact of this assembly, not a fact about the spell.
        """
        assert "descripteurs: feu" in ts.texte_source_canonique(SORT_MINIMAL)

    def test_les_variantes_et_le_mythique_sont_exclus(self) -> None:
        # A variant is a whole other spell; quoting it as evidence about the parent
        # would be undetectable at stage 10. `mythique` is slated for removal.
        texte = ts.texte_source_canonique(SORT_MINIMAL)
        assert "NE DOIT PAS APPARAÎTRE" not in texte

    def test_niveaux_rend_abreviation_et_niveau(self) -> None:
        assert "niveaux: Ens/Mag 3" in ts.texte_source_canonique(SORT_MINIMAL)

    def test_les_fins_de_ligne_sont_normalisees(self) -> None:
        # CRLF in the source must not make the hash platform-dependent.
        sort = {**SORT_MINIMAL, "description": "Ligne un.\r\nLigne deux.\rTrois."}
        texte = ts.texte_source_canonique(sort)
        assert "\r" not in texte
        assert "Ligne un.\nLigne deux.\nTrois." in texte

    def test_un_u_fffd_fait_echouer_bruyamment(self) -> None:
        sort = {**SORT_MINIMAL, "description": "d�g�ts"}
        with pytest.raises(ts.TexteSourceError, match="U\\+FFFD"):
            ts.texte_source_canonique(sort)

    def test_un_sort_sans_rien_d_exploitable_est_refuse(self) -> None:
        with pytest.raises(ts.TexteSourceError, match="vide"):
            ts.texte_source_canonique({"id": "creux"})

    def test_le_nom_anglais_n_est_jamais_present(self) -> None:
        # A5: the English name is the hook that surfaces the memorised English SRD.
        sort = {**SORT_MINIMAL, "nom_anglais": "Fireball", "url": "…Fireball.ashx"}
        assert "Fireball" not in ts.texte_source_canonique(sort)


class TestStabiliteDuHash:
    """The guard that keeps stage 08 and stage 10 building the same string.

    These hashes are frozen against the committed fixture. If one changes, either
    `texte_source_canonique` was modified — in which case EVERY stored
    `hash_source` is stale and every enrichment must be regenerated — or the
    fixture moved. Neither is a "just update the constant" situation: read the
    module docstring of `texte_source` before touching these numbers.
    """

    # First 16 hex of sha256, one per fixture spell. Truncated only for
    # readability: a 16-hex prefix collision is not a failure mode worth fearing,
    # and the full digest is what the artefacts carry.
    ATTENDUS: dict[str, str] = {
        "absorption-d-energie": "8ff66f32b589dd19",
        "alarme-d-invisibilite": "fe3db9e730d149a3",
        "animation-des-morts": "8890fd58277bf616",
        "arc-baton": "58e6d72bdd1f2c0f",
        "arret-du-temps": "f552ff83b872a451",
        "aura-d-avidite": "c0a9d1f0a88f7659",
        "controle-de-l-eau": "d8bb73406d13e7a7",
        "destruction-de-mort-vivant": "4aae2ac0048b769e",
        "lamentation-des-derniers-jours-d-ete": "6e60f3279fe66f5a",
        "resistance-a-l-age-mineure": "a67000b83d6b73b6",
        "resistance-a-l-age": "ea65c8f48b8b61fa",
        "voile-d-energie-positive": "d2e1492c04700fbd",
    }

    def test_les_hashs_de_la_fixture_sont_figes(self, mini_racine: Path) -> None:
        obtenus = {}
        for sid in self.ATTENDUS:
            sort = json.loads(
                (mini_racine / "data" / "sorts" / f"{sid}.json").read_text(
                    encoding="utf-8"
                )
            )
            obtenus[sid] = ts.hash_source(ts.texte_source_canonique(sort))[:16]
        assert obtenus == self.ATTENDUS, (
            "texte_source_canonique a changé : tous les hash_source stockés sont "
            "périmés et toutes les preuves de l'étage 10 échoueront d'un coup. "
            "Lire le docstring de pf_spells.texte_source avant de toucher à ces "
            "constantes."
        )

    def test_le_hash_est_stable_entre_deux_appels(self, mini_racine: Path) -> None:
        sort = json.loads(
            (mini_racine / "data" / "sorts" / "arret-du-temps.json").read_text(
                encoding="utf-8"
            )
        )
        texte = ts.texte_source_canonique(sort)
        assert ts.hash_source(texte) == ts.hash_source(ts.texte_source_canonique(sort))

    def test_une_modification_du_texte_change_le_hash(self) -> None:
        base = ts.hash_source(ts.texte_source_canonique(SORT_MINIMAL))
        bouge = ts.hash_source(
            ts.texte_source_canonique({**SORT_MINIMAL, "duree": "1 round"})
        )
        assert base != bouge

    def test_les_douze_sorts_de_la_fixture_ont_douze_hashs_distincts(
        self, mini_racine: Path
    ) -> None:
        empreintes = set()
        for chemin in sorted((mini_racine / "data" / "sorts").glob("*.json")):
            sort = json.loads(chemin.read_text(encoding="utf-8"))
            empreintes.add(ts.hash_source(ts.texte_source_canonique(sort)))
        assert len(empreintes) == 12


class TestGardeTaxonomie:
    def test_une_taxonomie_v0_bloque_l_assemblage(self, tmp_path: Path) -> None:
        """v0 means step 04 is not merged: the prompts would be built on a draft."""
        voc = tmp_path / "conventions" / "vocabulaires"
        voc.mkdir(parents=True)
        (voc / "tags.json").write_text(
            json.dumps({"version": "v0", "valeurs": []}, ensure_ascii=False),
            encoding="utf-8",
            newline="\n",
        )
        with pytest.raises(pp.PreparePromptsError, match="v0"):
            pp.verifier_taxonomie_gelee(tmp_path)

    def test_la_taxonomie_committee_est_gelee(self, repo_root: Path) -> None:
        """L'étiquette suit la plus haute des six listes, pas `tags.json` seule.

        `categories.json` et `conditions.json` sont en v2 : une passe menée contre
        elles doit se distinguer dans la provenance d'une passe menée contre la v1,
        sinon rien ne permet de dire laquelle des deux a produit un enregistrement.
        """
        assert pp.verifier_taxonomie_gelee(repo_root) == "taxonomie_v2"

    def test_une_version_hors_format_est_refusee(self, tmp_path: Path) -> None:
        """Une version libre ferait passer un ordre arbitraire pour un rang."""
        voc = tmp_path / "conventions" / "vocabulaires"
        voc.mkdir(parents=True)
        for nom in ("tags.json", "categories.json"):
            (voc / nom).write_text(
                json.dumps(
                    {"version": "v1" if nom == "tags.json" else "provisoire", "valeurs": []},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
                newline="\n",
            )
        with pytest.raises(pp.PreparePromptsError, match="hors du format"):
            pp.verifier_taxonomie_gelee(tmp_path)


class TestSystemeCacheable:
    @pytest.fixture(scope="class")
    def systeme(self, repo_root: Path) -> str:
        return pp.construire_systeme(repo_root)

    # Haiku's minimum cacheable prefix. Below it `cachePoint` is accepted and
    # silently ignored: nothing errors, and the pass just costs twice as much.
    PLANCHER_CACHE_TOKENS = 4096
    # Conservative chars-per-token for accented French. The real block measured 4249
    # tokens for 12356 chars (2.91) on 2026-07-30; 3.10 under-counts on purpose, so
    # this test fires *before* Bedrock stops caching rather than after.
    CARACTERES_PAR_TOKEN = 3.10

    def test_le_bloc_systeme_reste_cacheable(self, systeme: str) -> None:
        """Below 4096 tokens the cost lever disappears without any error.

        This is the failure that cost a real run double: `p1.0` sat at ~3216 tokens,
        reported `cacheWriteInputTokens: 0`, and nothing anywhere complained. The
        margin above the floor is thin (~150 tokens), so trimming this block — a
        vocabulary entry, an example, a rule — is a cost decision. If this test
        fails, either restore the length or accept ~2x on the next pass knowingly.
        """
        estime = len(systeme) / self.CARACTERES_PAR_TOKEN
        assert estime >= self.PLANCHER_CACHE_TOKENS, (
            f"bloc système ~{estime:.0f} tokens < plancher "
            f"{self.PLANCHER_CACHE_TOKENS} : le prompt caching ne mordra plus et "
            f"la passe coûtera le double, sans erreur pour le signaler"
        )

    def test_il_est_identique_pour_tous_les_sorts(self, repo_root: Path) -> None:
        """The whole point: one shared block, so prompt caching can amortise it.

        Measured 2026-07-30 on bedrock-runtime: the system block is cache-written
        once then cache-read per call. Any spell-specific content here would break
        the cache on every single record.
        """
        systeme = pp.construire_systeme(repo_root)
        ids = ["absorption-d-energie", "arret-du-temps", "aura-d-avidite"]
        racine = repo_root / MINI
        blocs = {
            pp.assembler(racine, sid, systeme, "taxonomie_v1")["systeme"] for sid in ids
        }
        assert len(blocs) == 1

    def test_il_impose_le_tableau_pour_preuves_condition_infligee(
        self, systeme: str, repo_root: Path
    ) -> None:
        """The exact defect that quarantined 3 of 20 records on the p1.0 trial run.

        The schema types `preuves.condition_infligee` as an array; p1.0 asked for
        "la sous-chaîne EXACTE" and the model quite reasonably answered with a bare
        string. Prose alone had not sufficed, so the worked examples must show the
        array — including the empty case, which is where a model reaches for null.
        """
        assert "TABLEAU" in systeme
        assert '"condition_infligee": []' in systeme
        assert '"condition_infligee": [' in systeme

    def test_les_exemples_respectent_le_schema(self, repo_root: Path) -> None:
        """An example that violates the contract teaches the violation.

        The examples are the most literally imitated part of the block, so a wrong
        one is worse than none: it would produce 2070 confidently invalid records.
        """
        schema = charger_schema_resolu(repo_root)
        bouchon = {
            "slug": "exemple",
            "version_prompt": pp.VERSION_PROMPT,
            "version_taxonomie": "taxonomie_v1",
            "modele": "modele-de-test",
            "genere_le": "2026-07-30T00:00:00+00:00",
            "hash_source": "a" * 64,
        }
        for _, _, reponse in pp.EXEMPLES:
            enregistrement = dict(reponse)
            # Stage 09 adds provenance; an example only shows the model's own part.
            for cle in schema.get("required", []):
                enregistrement.setdefault(cle, bouchon.get(cle))
            erreurs = list(
                jsonschema.Draft202012Validator(schema).iter_errors(enregistrement)
            )
            assert not erreurs, [e.message for e in erreurs]

    def test_les_exemples_n_utilisent_aucun_sort_reel(self, repo_root: Path) -> None:
        """Invented spells only — an example naming a real spell contaminates it.

        If an example annotated a corpus spell, that spell's own record would be
        graded against a pre-supplied answer instead of its text.
        """
        noms = set()
        chemin = repo_root / "data" / "index" / "sorts_uniques.jsonl"
        for ligne in chemin.read_text(encoding="utf-8").splitlines():
            if ligne.strip():
                noms.add(json.loads(ligne)["nom"])
        for titre, texte, _ in pp.EXEMPLES:
            nom_exemple = texte.split(" :")[0]
            assert nom_exemple not in noms, (titre, nom_exemple)

    def test_il_separe_les_listes_par_champ(self, systeme: str) -> None:
        # The other p1.0 quarantine cause: `allie` and `social` are real keys, but
        # of other fields. The model treated the six lists as one vocabulary.
        assert "n'appartient qu'à SON champ" in systeme

    def test_il_ne_contient_aucun_nom_de_sort_du_corpus(self, systeme: str) -> None:
        # Negative examples are spell names; naming spells in the shared block
        # would let one record's examples contaminate another's answer.
        for appat in ("Absorption", "Boule de feu", "Arrêt du temps", "Fireball"):
            assert appat not in systeme, appat

    def test_il_porte_la_consigne_de_source_unique(self, systeme: str) -> None:
        assert "ta SEULE source" in systeme

    def test_il_interdit_le_srd_anglais(self, systeme: str) -> None:
        assert "SRD anglais" in systeme

    def test_il_exige_la_sous_chaine_exacte(self, systeme: str) -> None:
        assert "EXACTE" in systeme

    def test_il_enumere_les_35_tags_v1_avec_definitions(
        self, systeme: str, repo_root: Path
    ) -> None:
        doc = json.loads(
            (repo_root / "conventions" / "vocabulaires" / "tags.json").read_text(
                encoding="utf-8"
            )
        )
        assert len(doc["valeurs"]) == 35
        for entree in doc["valeurs"]:
            assert f"`{entree['cle']}`" in systeme, entree["cle"]

    def test_les_six_vocabulaires_sont_tous_presents(
        self, systeme: str, repo_root: Path
    ) -> None:
        from pf_spells.enrichissement_schema import charger_vocabulaire

        for _, nom_fichier in pp.VOCABULAIRES_DU_PROMPT:
            for cle in charger_vocabulaire(repo_root, nom_fichier):
                assert f"`{cle}`" in systeme, (nom_fichier, cle)

    def test_il_ne_demande_pas_les_champs_de_provenance(self, systeme: str) -> None:
        # Asking the model for its own id or a timestamp invites it to invent both.
        demandes = {cle for cle, _ in pp.CHAMPS_DEMANDES}
        for interdit in ("modele", "genere_le", "hash_source", "version_prompt"):
            assert interdit not in demandes

    def test_aucune_cle_de_relecture_humaine_n_est_demandee(self, systeme: str) -> None:
        assert "verifie_par_humain" not in systeme


class TestRunSurLaFixture:
    def test_douze_prompts_et_un_manifeste_sans_reseau(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        resume = pp.run(
            repo_root / MINI,
            tmp_path / "prompts",
            racine_conventions=repo_root,
            limite=12,
        )
        assert resume["demandes"] == 12
        assert resume["ecrits"] == 12
        repertoire = tmp_path / "prompts" / pp.VERSION_PROMPT
        assert len(list(repertoire.glob("*.json"))) == 13  # 12 + manifeste
        assert (repertoire / pp.FICHIER_MANIFESTE).is_file()

    def test_la_relance_ne_reecrit_rien(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        commun = dict(racine_conventions=repo_root, limite=12)
        pp.run(repo_root / MINI, tmp_path / "p", **commun)
        second = pp.run(repo_root / MINI, tmp_path / "p", **commun)
        assert second["ecrits"] == 0
        assert second["inchanges"] == 12

    def test_force_reecrit_les_douze(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        commun = dict(racine_conventions=repo_root, limite=12)
        pp.run(repo_root / MINI, tmp_path / "p", **commun)
        forcee = pp.run(repo_root / MINI, tmp_path / "p", force=True, **commun)
        assert forcee["ecrits"] == 12
        assert forcee["inchanges"] == 0

    def test_un_hash_source_perime_est_reassemble(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        """Resume is keyed on the text, not on the file existing."""
        commun = dict(racine_conventions=repo_root, limite=12)
        pp.run(repo_root / MINI, tmp_path / "p", **commun)
        cible = tmp_path / "p" / pp.VERSION_PROMPT / "absorption-d-energie.json"
        doc = json.loads(cible.read_text(encoding="utf-8"))
        doc["hash_source"] = "0" * 64
        cible.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        rejoue = pp.run(repo_root / MINI, tmp_path / "p", **commun)
        assert rejoue["ecrits"] == 1
        assert rejoue["inchanges"] == 11
        assert json.loads(cible.read_text(encoding="utf-8"))["hash_source"] != "0" * 64

    def test_la_version_de_prompt_est_dans_le_chemin(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        # A8 plans several tuning re-runs; p1.0 and p1.1 must coexist and be diffed.
        commun = dict(racine_conventions=repo_root, limite=3)
        pp.run(repo_root / MINI, tmp_path / "p", version_prompt="p1.0", **commun)
        pp.run(repo_root / MINI, tmp_path / "p", version_prompt="p1.1", **commun)
        assert (tmp_path / "p" / "p1.0").is_dir()
        assert (tmp_path / "p" / "p1.1").is_dir()

    def test_only_hors_index_est_refuse(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        with pytest.raises(pp.PreparePromptsError, match="hors de l'index"):
            pp.run(
                repo_root / MINI,
                tmp_path / "p",
                racine_conventions=repo_root,
                seulement=["sort-qui-n-existe-pas"],
            )

    def test_le_manifeste_donne_la_table_des_hashs(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        pp.run(
            repo_root / MINI,
            tmp_path / "p",
            racine_conventions=repo_root,
            limite=12,
        )
        manifeste = json.loads(
            (tmp_path / "p" / pp.VERSION_PROMPT / pp.FICHIER_MANIFESTE).read_text(
                encoding="utf-8"
            )
        )
        assert manifeste["n"] == 12
        assert manifeste["version_taxonomie"] == "taxonomie_v2"
        assert len(manifeste["hashs"]) == 12
        assert manifeste["hash_systeme"]
        # Sorted keys: the manifest must diff cleanly between runs.
        assert list(manifeste["hashs"]) == sorted(manifeste["hashs"])

    def test_le_manifeste_ne_porte_pas_d_horloge(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        """A wall clock would make every run differ and drown the real diff."""
        commun = dict(racine_conventions=repo_root, limite=12)
        pp.run(repo_root / MINI, tmp_path / "a", **commun)
        pp.run(repo_root / MINI, tmp_path / "b", **commun)
        lire = lambda d: (  # noqa: E731 - local alias, reads better than a def here
            (tmp_path / d / pp.VERSION_PROMPT / pp.FICHIER_MANIFESTE).read_bytes()
        )
        assert lire("a") == lire("b")

    def test_data_n_est_jamais_touche(
        self, repo_root: Path, tmp_path: Path, pas_de_reseau: None
    ) -> None:
        racine = repo_root / MINI
        avant = {
            p.name: p.stat().st_mtime_ns for p in (racine / "data" / "sorts").glob("*.json")
        }
        pp.run(racine, tmp_path / "p", racine_conventions=repo_root, limite=12)
        apres = {
            p.name: p.stat().st_mtime_ns for p in (racine / "data" / "sorts").glob("*.json")
        }
        assert avant == apres


class TestFormatDesSorties:
    @pytest.fixture(scope="class")
    def repertoire(self, repo_root: Path, tmp_path_factory: pytest.TempPathFactory) -> Path:
        base = tmp_path_factory.mktemp("prompts")
        pp.run(repo_root / MINI, base, racine_conventions=repo_root, limite=12)
        return base / pp.VERSION_PROMPT

    def test_utf8_sans_bom_lf_newline_final(self, repertoire: Path) -> None:
        for chemin in sorted(repertoire.glob("*.json")):
            octets = chemin.read_bytes()
            assert not octets.startswith(b"\xef\xbb\xbf"), chemin
            assert b"\r" not in octets, chemin
            assert octets.endswith(b"\n"), chemin
            assert chr(0xFFFD) not in octets.decode("utf-8"), chemin

    def test_indent_2_et_ensure_ascii_false(self, repertoire: Path) -> None:
        for chemin in sorted(repertoire.glob("*.json")):
            texte = chemin.read_text(encoding="utf-8")
            attendu = json.dumps(json.loads(texte), ensure_ascii=False, indent=2)
            assert texte == attendu + "\n", chemin

    def test_chaque_prompt_porte_exactement_les_huit_cles(self, repertoire: Path) -> None:
        # The contract `tools/estimate_cost.py` reads. Kept in sync by this test.
        from tools import estimate_cost  # noqa: PLC0415 - only needed here

        for chemin in sorted(repertoire.glob("*.json")):
            if chemin.name == pp.FICHIER_MANIFESTE:
                continue
            doc = json.loads(chemin.read_text(encoding="utf-8"))
            assert set(doc) == set(estimate_cost.CLES_PROMPT), chemin

    def test_aucun_appat_anglais_dans_les_prompts(self, repertoire: Path) -> None:
        # A5 verification criterion, by grep over known English SRD hooks.
        appats = ("Fireball", "Energy Drain", "Time Stop", "Magic Missile", "SRD:")
        for chemin in sorted(repertoire.glob("*.json")):
            texte = chemin.read_text(encoding="utf-8")
            for appat in appats:
                assert appat not in texte, (chemin.name, appat)

    def test_le_cout_est_estimable_hors_ligne(self, repertoire: Path) -> None:
        from tools import estimate_cost  # noqa: PLC0415

        estimation = estimate_cost.estimer(repertoire, 0.001, 0.005, pp.MAX_TOKENS)
        assert estimation.nb_enregistrements == 12
        assert estimation.tokens_entree > 0
        assert estimation.cout_bas <= estimation.cout_haut
