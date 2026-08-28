"""Tests for stage 09 — the only network stage, and the only one that costs money.

Everything runs against a fake `converse` client: no network, no token, no cost.
The client counts its calls, and that counter is the real assertion in most of
these tests — "0 calls" is the statement that a guard held.

Weighted deliberately towards the spending guards. A bug in the parser produces a
bad record that stage 10 catches; a bug in the budget produces an invoice that
nothing catches. So the cap, the confirmation gate, the breaker and the resume path
are each tested for the case where they must NOT fire and the case where they must.
"""

from __future__ import annotations

import io
import json
import socket
import threading
from pathlib import Path
from typing import Any

import pytest

from pf_spells import enrich_llm as el
from pf_spells import prepare_prompts as pp

MINI = Path("tests") / "fixtures" / "mini_corpus"

# Every value here is a REAL key from data/conventions/vocabulaires/. Inventing
# plausible-looking ones instead would make the stub answers fail the schema gate,
# and the whole nominal path would read as broken when only the fixture was.
REPONSE_TYPE: dict[str, Any] = {
    "resume_court": "Un sort de test qui inflige des dégâts de feu.",
    "categorie_principale": "attaque_directe",
    "tags": ["degats_directs", "zone_d_effet"],
    "roles_tactiques": ["combat"],
    "cible_typique": "ennemi",
    "type_degats": "feu",
    "condition_infligee": [],
    "preuves": {
        "type_degats": "feu",
        "condition_infligee": [],
        "cible_typique": "une créature",
    },
    "notes_ambiguite": None,
}


class ClientFactice:
    """A `converse` stand-in that counts calls and simulates the cache.

    The call counter is the point: several tests assert it is exactly 0, which is
    how "this guard prevented spending" is expressed without a real invoice.
    """

    def __init__(
        self,
        reponse: Any = None,
        *,
        casse: bool = False,
        exception: Exception | None = None,
    ) -> None:
        self.appels = 0
        self.recus: list[dict[str, Any]] = []
        self.reponse = reponse
        self.casse = casse
        self.exception = exception
        self._systemes_vus: set[str] = set()
        self._verrou = threading.Lock()

    def _corps(self, kwargs: dict[str, Any]) -> str:
        if self.reponse is not None:
            if callable(self.reponse):
                return self.reponse(kwargs)
            return self.reponse
        sid = kwargs["messages"][0]["content"][0]["text"].splitlines()[0]
        sid = sid.removeprefix("id: ").strip()
        return json.dumps({"id": sid, **REPONSE_TYPE}, ensure_ascii=False)

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        with self._verrou:
            self.appels += 1
            self.recus.append(kwargs)
            # Cache hit on every system block seen before — what Bedrock does.
            texte_systeme = kwargs["system"][0]["text"]
            deja_vu = texte_systeme in self._systemes_vus
            self._systemes_vus.add(texte_systeme)
        if self.exception is not None:
            raise self.exception
        if self.casse:
            raise RuntimeError("ThrottlingException: simulé")
        return {
            "output": {"message": {"content": [{"text": self._corps(kwargs)}]}},
            "usage": {
                "inputTokens": 100,
                "outputTokens": 50,
                "cacheReadInputTokens": 9200 if deja_vu else 0,
                "cacheWriteInputTokens": 0 if deja_vu else 9200,
            },
            "stopReason": "end_turn",
        }


@pytest.fixture
def pas_de_reseau(monkeypatch: pytest.MonkeyPatch) -> None:
    """No socket may be opened, whatever the code thinks it is doing."""

    def interdit(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("aucun appel réseau réel n'est autorisé dans les tests")

    monkeypatch.setattr(socket, "socket", interdit)
    monkeypatch.setattr(socket, "create_connection", interdit)


@pytest.fixture
def prompts(repo_root: Path, tmp_path: Path, pas_de_reseau: None) -> Path:
    """12 assembled fixture prompts, in tmp_path. The input to every run below."""
    pp.run(
        repo_root / MINI,
        tmp_path / "prompts",
        racine_conventions=repo_root,
        limite=12,
    )
    return tmp_path / "prompts"


@pytest.fixture
def espace(tmp_path: Path) -> dict[str, Path]:
    return {
        "sortie": tmp_path / "enrichissements",
        "quarantaine": tmp_path / "quarantaine",
    }


def lancer(
    repo_root: Path,
    prompts: Path,
    espace: dict[str, Path],
    client: ClientFactice,
    **kw: Any,
) -> dict[str, Any]:
    return el.run(
        repo_root / MINI,
        client=client,
        prompts=prompts,
        sortie=espace["sortie"],
        quarantaine=espace["quarantaine"],
        racine_conventions=repo_root,
        **kw,
    )


class TestCheminNominal:
    def test_douze_prompts_donnent_douze_enregistrements(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice()
        resume = lancer(repo_root, prompts, espace, client)
        assert resume["ecrits"] == 12
        assert resume["quarantaine"] == 0
        assert resume["echecs"] == []
        assert client.appels == 12
        assert len(list(espace["sortie"].glob("*.json"))) == 12

    def test_les_six_champs_de_provenance_sont_corrects(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        lancer(repo_root, prompts, espace, ClientFactice())
        enrichi = json.loads(
            (espace["sortie"] / "arc-baton.json").read_text(encoding="utf-8")
        )
        prompt = json.loads(
            (prompts / pp.VERSION_PROMPT / "arc-baton.json").read_text(encoding="utf-8")
        )
        assert enrichi["hash_source"] == prompt["hash_source"]
        assert enrichi["version_prompt"] == prompt["version_prompt"]
        assert enrichi["version_taxonomie"] == "taxonomie_v2"
        assert enrichi["modele"] == el.MODELE
        assert enrichi["slug"] == prompt["slug"]
        assert enrichi["genere_le"].endswith("+00:00")

    def test_aucune_cle_de_relecture_humaine_n_est_ecrite(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        # The human-verification lock was deliberately removed from the pipeline.
        lancer(repo_root, prompts, espace, ClientFactice())
        for chemin in espace["sortie"].glob("*.json"):
            assert "verifie_par_humain" not in chemin.read_text(encoding="utf-8")

    def test_l_enregistrement_valide_le_schema_resolu(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        from jsonschema import Draft202012Validator

        from pf_spells.enrichissement_schema import charger_schema_resolu

        lancer(repo_root, prompts, espace, ClientFactice())
        validateur = Draft202012Validator(charger_schema_resolu(repo_root))
        for chemin in sorted(espace["sortie"].glob("*.json")):
            validateur.validate(json.loads(chemin.read_text(encoding="utf-8")))

    def test_le_bloc_systeme_est_envoye_avec_un_cachepoint(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        """The cache lever: without this the run costs about twice as much."""
        client = ClientFactice()
        lancer(repo_root, prompts, espace, client)
        for recu in client.recus:
            assert recu["system"][1] == {"cachePoint": {"type": "default"}}
            assert recu["system"][0]["text"]

    def test_le_cache_est_lu_apres_le_premier_appel(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        resume = lancer(repo_root, prompts, espace, ClientFactice(), concurrence=1)
        assert resume["usage"]["cacheWriteInputTokens"] == 9200  # écrit une fois
        assert resume["usage"]["cacheReadInputTokens"] == 9200 * 11  # relu ensuite

    def test_la_temperature_est_nulle(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice()
        lancer(repo_root, prompts, espace, client)
        assert all(r["inferenceConfig"]["temperature"] == 0.0 for r in client.recus)


class TestReprise:
    def test_la_relance_n_emet_aucun_appel(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        """The single most valuable guard: never pay twice for the same record."""
        lancer(repo_root, prompts, espace, ClientFactice())
        second = ClientFactice()
        resume = lancer(repo_root, prompts, espace, second)
        assert second.appels == 0
        assert resume["a_jour"] == 12
        assert resume["tentes"] == 0

    def test_un_hash_source_perime_est_regenere(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        lancer(repo_root, prompts, espace, ClientFactice())
        cible = espace["sortie"] / "arc-baton.json"
        doc = json.loads(cible.read_text(encoding="utf-8"))
        doc["hash_source"] = "0" * 64
        cible.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        second = ClientFactice()
        resume = lancer(repo_root, prompts, espace, second)
        assert second.appels == 1
        assert resume["a_jour"] == 11

    def test_une_version_de_prompt_perimee_est_regeneree(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        lancer(repo_root, prompts, espace, ClientFactice())
        cible = espace["sortie"] / "arc-baton.json"
        doc = json.loads(cible.read_text(encoding="utf-8"))
        doc["version_prompt"] = "p0.9"
        cible.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        second = ClientFactice()
        lancer(repo_root, prompts, espace, second)
        assert second.appels == 1

    def test_un_fichier_tronque_est_refait_et_non_lu(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        """A record left half-written by a killed run must not count as current."""
        espace["sortie"].mkdir(parents=True)
        (espace["sortie"] / "arc-baton.json").write_text(
            '{"id": "arc-baton", "hash_s', encoding="utf-8", newline="\n"
        )
        client = ClientFactice()
        lancer(repo_root, prompts, espace, client)
        assert client.appels == 12

    def test_force_repaie_tout(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        lancer(repo_root, prompts, espace, ClientFactice())
        second = ClientFactice()
        lancer(repo_root, prompts, espace, second, force=True)
        assert second.appels == 12


class TestGardesDeDepense:
    def test_le_plafond_refuse_le_run_sans_rien_payer(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice()
        with pytest.raises(el.ArretBudget, match="plafond"):
            lancer(repo_root, prompts, espace, client, plafond=5)
        assert client.appels == 0, "un plafond dépassé ne doit RIEN payer"

    def test_le_plafond_borne_la_depense_en_cours_de_run(self) -> None:
        """The cap is also enforced per call, not only up front."""
        budget = el.Budget(plafond=3)
        for _ in range(3):
            budget.reserver()
        with pytest.raises(el.ArretBudget, match="plafond"):
            budget.reserver()
        assert budget.appels == 3

    def test_le_plafond_tient_sous_concurrence(self) -> None:
        """Eight threads racing on the counter is how a bounded run overshoots."""
        budget = el.Budget(plafond=50)
        refuses = []

        def travail() -> None:
            for _ in range(20):
                try:
                    budget.reserver()
                except el.ArretBudget:
                    refuses.append(1)

        fils = [threading.Thread(target=travail) for _ in range(8)]
        for f in fils:
            f.start()
        for f in fils:
            f.join()
        assert budget.appels == 50, "le compteur a dérapé sous concurrence"

    def test_le_coupe_circuit_arrete_une_panne_systemique(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        """A revoked token fails 100 % of calls; stop, don't pay 2 070 times."""
        client = ClientFactice(exception=RuntimeError("AccessDeniedException"))
        resume = lancer(repo_root, prompts, espace, client, concurrence=1)
        assert resume["arret_budget"] is not None
        assert "systémique" in resume["arret_budget"]
        assert client.appels <= 12

    def test_le_coupe_circuit_ne_part_pas_sur_un_echec_isole(self) -> None:
        # Below the minimum, one failure is bad luck, not a systemic fault.
        budget = el.Budget(plafond=100)
        for _ in range(5):
            budget.reserver()
        budget.signaler_echec()  # ne doit pas lever
        assert budget.echecs == 1

    def test_au_dela_du_seuil_sans_tty_le_run_refuse(self) -> None:
        """Cron must not be able to spend by default."""
        estimation = {"n": el.SEUIL_CONFIRMATION + 1, "tokens_systeme_par_appel": 1,
                      "tokens_systeme_total": 1, "tokens_utilisateur": 1,
                      "tokens_sortie_haut": 1, "part_cacheable": 0.9}
        with pytest.raises(el.ArretBudget, match="pas de\\s+terminal|--oui"):
            el.demander_confirmation(estimation, oui=False, entree=io.StringIO("oui\n"))

    def test_oui_explicite_laisse_passer(self) -> None:
        estimation = {"n": 10_000, "tokens_systeme_par_appel": 1,
                      "tokens_systeme_total": 1, "tokens_utilisateur": 1,
                      "tokens_sortie_haut": 1, "part_cacheable": 0.9}
        el.demander_confirmation(estimation, oui=True)  # ne doit pas lever

    def test_sous_le_seuil_aucune_confirmation_n_est_demandee(self) -> None:
        # The tuning loop (12, 50 spells) must stay friction-free.
        estimation = {"n": el.SEUIL_CONFIRMATION, "tokens_systeme_par_appel": 1,
                      "tokens_systeme_total": 1, "tokens_utilisateur": 1,
                      "tokens_sortie_haut": 1, "part_cacheable": 0.9}
        el.demander_confirmation(estimation, oui=False)  # ne doit pas lever

    def test_un_refus_interactif_n_emet_aucun_appel(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Answering anything but yes at the prompt must cost exactly nothing."""

        class FauxTty(io.StringIO):
            def isatty(self) -> bool:
                return True

        # 12 fixture records sit below the real threshold, so lower it to exercise
        # the gate rather than rewrite the fixture to be expensive.
        monkeypatch.setattr(el, "SEUIL_CONFIRMATION", 2)
        client = ClientFactice()
        with pytest.raises(el.ArretBudget, match="non confirmé"):
            lancer(repo_root, prompts, espace, client, entree=FauxTty("non\n"))
        assert client.appels == 0

    def test_un_oui_interactif_laisse_passer(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        class FauxTty(io.StringIO):
            def isatty(self) -> bool:
                return True

        monkeypatch.setattr(el, "SEUIL_CONFIRMATION", 2)
        client = ClientFactice()
        resume = lancer(repo_root, prompts, espace, client, entree=FauxTty("oui\n"))
        assert resume["ecrits"] == 12
        assert client.appels == 12

    def test_limit_borne_les_appels(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice()
        resume = lancer(repo_root, prompts, espace, client, limite=3)
        assert client.appels == 3
        assert resume["ecrits"] == 3

    def test_la_concurrence_est_bornee_par_la_maison(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        # Politeness is not a performance setting.
        resume = lancer(repo_root, prompts, espace, ClientFactice(), concurrence=99)
        assert resume["ecrits"] == 12

    def test_le_client_n_est_pas_construit_si_une_garde_refuse(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A refused run must not even need a token."""
        def explose(*a: Any, **k: Any) -> Any:
            raise AssertionError("construire_client appelé alors qu'une garde refuse")

        monkeypatch.setattr(el, "construire_client", explose)
        with pytest.raises(el.ArretBudget):
            el.run(
                repo_root / MINI,
                prompts=prompts,
                sortie=espace["sortie"],
                quarantaine=espace["quarantaine"],
                racine_conventions=repo_root,
                plafond=2,
            )

    def test_sans_jeton_aucun_appel_n_est_tente(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv(el.VARIABLE_JETON, raising=False)
        with pytest.raises(el.EnrichLLMError, match=el.VARIABLE_JETON):
            el.construire_client()


class TestQuarantaine:
    def test_un_json_illisible_part_en_quarantaine(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice(reponse="ceci n'est pas du JSON du tout")
        resume = lancer(repo_root, prompts, espace, client)
        assert resume["ecrits"] == 0
        assert resume["quarantaine"] == 12
        assert not espace["sortie"].exists() or not list(
            espace["sortie"].glob("*.json")
        ), "rien de douteux n'entre dans data/"
        assert len(list(espace["quarantaine"].glob("*.json"))) == 12

    def test_la_quarantaine_conserve_la_reponse_brute(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        # The answer is a lesson paid for; discarding it wastes the money.
        lancer(repo_root, prompts, espace, ClientFactice(reponse="{cassé"))
        doc = json.loads(
            (espace["quarantaine"] / "arc-baton.json").read_text(encoding="utf-8")
        )
        assert doc["reponse_brute"] == "{cassé"
        assert doc["raison"]
        assert doc["hash_source"]

    def test_une_identite_incoherente_part_en_quarantaine(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        """Filing another spell's answer under this id corrupts the corpus."""
        client = ClientFactice(
            reponse=json.dumps({"id": "un-autre-sort", **REPONSE_TYPE})
        )
        resume = lancer(repo_root, prompts, espace, client)
        assert resume["quarantaine"] == 12
        assert resume["raisons_quarantaine"] == {"identite": 12}

    def test_une_valeur_hors_liste_close_part_en_quarantaine(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        def invente(kwargs: dict[str, Any]) -> str:
            sid = kwargs["messages"][0]["content"][0]["text"].splitlines()[0]
            sid = sid.removeprefix("id: ").strip()
            return json.dumps(
                {"id": sid, **{**REPONSE_TYPE, "tags": ["tag_completement_invente"]}}
            )

        client = ClientFactice(reponse=invente)
        resume = lancer(repo_root, prompts, espace, client)
        assert resume["raisons_quarantaine"] == {"schema": 12}
        assert resume["ecrits"] == 0

    def test_une_cle_manquante_part_en_quarantaine(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        ampute = {k: v for k, v in REPONSE_TYPE.items() if k != "resume_court"}

        def sans_resume(kwargs: dict[str, Any]) -> str:
            sid = kwargs["messages"][0]["content"][0]["text"].splitlines()[0]
            return json.dumps({"id": sid.removeprefix("id: ").strip(), **ampute})

        resume = lancer(repo_root, prompts, espace, ClientFactice(reponse=sans_resume))
        assert resume["raisons_quarantaine"] == {"schema": 12}

    def test_un_preambule_et_une_cloture_sont_tolerés(self) -> None:
        # Tolerant about wrapping, strict about content.
        assert el.extraire_json('Voici :\n```json\n{"a": 1}\n```')["a"] == 1
        assert el.extraire_json('{"a": 1}')["a"] == 1
        assert el.extraire_json('Bien sûr ! {"a": 1} Voilà.')["a"] == 1

    def test_un_json_invalide_n_est_jamais_reparé(self) -> None:
        with pytest.raises((ValueError, json.JSONDecodeError)):
            el.extraire_json('{"a": 1,,}')
        with pytest.raises(ValueError, match="aucun objet JSON"):
            el.extraire_json("désolé, je ne peux pas")


class TestGardesDEntree:
    def test_un_manifeste_absent_arrete_tout(
        self, repo_root: Path, tmp_path: Path, espace: dict[str, Path]
    ) -> None:
        with pytest.raises(el.EnrichLLMError, match="manifeste"):
            el.run(
                repo_root / MINI,
                client=ClientFactice(),
                prompts=tmp_path / "vide",
                sortie=espace["sortie"],
                racine_conventions=repo_root,
            )

    def test_une_taxonomie_divergente_arrete_tout(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path], tmp_path: Path
    ) -> None:
        """Answers validated against lists the model never saw would all fail."""
        faux = tmp_path / "conv"
        (faux / "data" / "conventions" / "vocabulaires").mkdir(parents=True)
        (faux / "data" / "conventions" / "vocabulaires" / "tags.json").write_text(
            json.dumps({"version": "v2", "valeurs": []}, ensure_ascii=False),
            encoding="utf-8",
            newline="\n",
        )
        client = ClientFactice()
        with pytest.raises(el.EnrichLLMError, match="taxonomie"):
            el.run(
                repo_root / MINI,
                client=client,
                prompts=prompts,
                sortie=espace["sortie"],
                racine_conventions=faux,
            )
        assert client.appels == 0

    def test_only_hors_prompts_est_refuse(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        client = ClientFactice()
        with pytest.raises(el.EnrichLLMError, match="hors des prompts"):
            lancer(repo_root, prompts, espace, client, seulement=["inexistant"])
        assert client.appels == 0

    def test_le_mode_batch_n_existe_pas(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """Not offered rather than offered and broken: batch needs S3, S3 is shut.

        Asserted on the parser itself rather than through `main`, so the test says
        "there is no --mode flag" instead of accidentally passing because some
        later guard happened to fire first.
        """
        with pytest.raises(SystemExit) as sortie:
            el.main(["--mode", "batch", "--estimer-seulement"])
        assert sortie.value.code == 2
        assert "unrecognized arguments: --mode" in capsys.readouterr().err


class TestEcritureAtomique:
    def test_une_interruption_ne_laisse_pas_de_fichier_tronque(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        cible = tmp_path / "sortie" / "x.json"
        vrai_replace = el.os.replace

        def replace_qui_casse(*a: Any, **k: Any) -> Any:
            raise KeyboardInterrupt

        monkeypatch.setattr(el.os, "replace", replace_qui_casse)
        with pytest.raises(KeyboardInterrupt):
            el.ecrire_atomique({"a": 1}, cible)
        monkeypatch.setattr(el.os, "replace", vrai_replace)
        assert not cible.exists(), "aucun fichier partiel"
        assert list(cible.parent.glob("*.tmp")) == [], "aucun débris temporaire"

    def test_le_fichier_ecrit_est_utf8_lf_indent2(self, tmp_path: Path) -> None:
        cible = el.ecrire_atomique({"accent": "dégâts"}, tmp_path / "a.json")
        octets = cible.read_bytes()
        assert not octets.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in octets
        assert octets.endswith(b"\n")
        assert "dégâts" in octets.decode("utf-8")

    def test_les_enregistrements_du_run_sont_conformes(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        lancer(repo_root, prompts, espace, ClientFactice())
        for chemin in sorted(espace["sortie"].glob("*.json")):
            octets = chemin.read_bytes()
            texte = octets.decode("utf-8")
            assert b"\r" not in octets, chemin
            assert octets.endswith(b"\n"), chemin
            assert chr(0xFFFD) not in texte, chemin
            attendu = json.dumps(json.loads(texte), ensure_ascii=False, indent=2)
            assert texte == attendu + "\n", chemin


class TestReessais:
    def test_le_throttling_est_reessayé(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path]
    ) -> None:
        appels = {"n": 0}

        class ClientLent:
            def converse(self, **kwargs: Any) -> dict[str, Any]:
                appels["n"] += 1
                if appels["n"] < 2:
                    raise RuntimeError("ThrottlingException: ralentis")
                return {
                    "output": {"message": {"content": [{"text": '{"a": 1}'}]}},
                    "usage": {},
                }

        prompt = json.loads(
            (prompts / pp.VERSION_PROMPT / "arc-baton.json").read_text(encoding="utf-8")
        )
        el.appeler(ClientLent(), prompt, dormir=lambda _: None)
        assert appels["n"] == 2

    def test_une_erreur_de_validation_n_est_pas_reessayée(
        self, repo_root: Path, prompts: Path
    ) -> None:
        """A bad model id is a bug: retrying it three times just costs more."""
        appels = {"n": 0}

        class ClientInvalide:
            def converse(self, **kwargs: Any) -> dict[str, Any]:
                appels["n"] += 1
                raise RuntimeError("ValidationException: modelId inconnu")

        prompt = json.loads(
            (prompts / pp.VERSION_PROMPT / "arc-baton.json").read_text(encoding="utf-8")
        )
        with pytest.raises(RuntimeError, match="ValidationException"):
            el.appeler(ClientInvalide(), prompt, dormir=lambda _: None)
        assert appels["n"] == 1


class TestEstimationEtRapport:
    def test_l_estimation_ne_paie_rien(
        self, repo_root: Path, prompts: Path
    ) -> None:
        fichiers = el.fichiers_de_prompts(prompts / pp.VERSION_PROMPT)
        estimation = el.estimer_run(fichiers)
        assert estimation["n"] == 12
        assert estimation["tokens_systeme_par_appel"] > 0
        assert 0.0 < estimation["part_cacheable"] < 1.0

    def test_la_part_cacheable_est_dominante(
        self, repo_root: Path, prompts: Path
    ) -> None:
        """If this ever drops, the caching design has stopped paying for itself."""
        fichiers = el.fichiers_de_prompts(prompts / pp.VERSION_PROMPT)
        assert el.estimer_run(fichiers)["part_cacheable"] > 0.75

    def test_l_estimation_d_un_lot_vide_ne_divise_pas_par_zero(self) -> None:
        assert el.estimer_run([])["part_cacheable"] == 0.0

    def test_le_rapport_de_run_est_ecrit(
        self, repo_root: Path, prompts: Path, espace: dict[str, Path], tmp_path: Path
    ) -> None:
        resume = lancer(repo_root, prompts, espace, ClientFactice())
        chemin = el.ecrire_rapport(resume, tmp_path, "rapports")
        doc = json.loads(chemin.read_text(encoding="utf-8"))
        assert doc["ecrits"] == 12
        assert doc["enrich_llm_version"] == el.enrich_llm_version
        assert doc["usage"]["cacheReadInputTokens"] > 0
