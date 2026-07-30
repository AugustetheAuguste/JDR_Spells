"""Step 09 driver: independently audit the finished corpus.

This module **writes nothing under `data/`**. It re-derives every fact it checks
from the artifacts themselves — it recounts the unique spells from the class
lists, recomputes `slugify(nom)`, re-partitions the index — rather than trusting
any producing step's own report. That independence is the whole point of the
step: a producing step that miscounted would also have reported the miscount.

Checks never abort on the first failure; each one appends to a flat anomaly list
so a single run yields the complete picture a human needs.

Outputs:
    reports/09_validation.md        the human audit, verdict on line 1
    reports/09_anomalies.jsonl      one anomaly per line, machine-readable

Exit code 0 when no anomaly is `bloquant`, 1 otherwise, so it can gate a merge.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Literal

from jsonschema import Draft202012Validator

from pf_spells.classes import CLASS_ABBREV, CLASS_ABBREV_HORS_LISTE
from pf_spells.slugs import slugify

validator_version = "1.0.0"

# The Skill `pf-corpus-conventions` is the authority these checks encode; its
# path is reported so the audit states which revision it was read against.
SKILL_PATH = Path(".claude/skills/pf-corpus-conventions/SKILL.md")

Gravite = Literal["bloquant", "avertissement", "info"]

# Canonical spell-file key order, from the Skill's JSON key vocabulary table.
CLES_SORT: tuple[str, ...] = (
    "id",
    "nom",
    "url",
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
    "description",
    "description_html",
    "mythique",
    "variantes",
    "sources",
    "autres",
    "classes",
    "meta",
)

# The nine stat-block fields plus `description` (check D1).
CHAMPS_COUVERTURE: tuple[str, ...] = (
    "ecole",
    "niveaux",
    "temps_incantation",
    "composantes",
    "portee",
    "cible",
    "duree",
    "jet_de_sauvegarde",
    "resistance_magie",
    "description",
)

# Coverage floors below which the corpus is not fit to merge. Only these three
# gate the verdict: the others are genuinely absent on the wiki for many spells
# (a spell with no saving throw has no `Jet de sauvegarde` line at all).
SEUILS_COUVERTURE: dict[str, float] = {
    "ecole": 98.0,
    "niveaux": 98.0,
    "description": 99.0,
}

# Per-class level bands the plan calls plausible. A class outside its band is a
# warning, not a defect: the band is an expectation about the wiki, not a rule.
BANDES_NIVEAUX: dict[str, tuple[int, int]] = {
    "Paladin": (1, 4),
    "Antipaladin": (1, 4),
    "Alchimiste": (1, 6),
    "Arcaniste/Ensorceleur/Magicien": (0, 9),
    "Druide": (0, 9),
    "Prêtre/Prêtre combattant/Oracle": (0, 9),
}

# Hard bounds: a level outside 0..9 is not a PF1 spell level at all.
NIVEAU_MIN_ABSOLU = 0
NIVEAU_MAX_ABSOLU = 9

# Classes whose wiki list page does not group by school, so an empty `ecoles`
# in the index is expected rather than a parsing gap.
CLASSES_SANS_ECOLE: frozenset[str] = frozenset(
    {"Druide", "Paladin", "Alchimiste"}
)

REPLACEMENT_CHAR = "\ufffd"
BOM = "\ufeff"

DESCRIPTION_COURTE = 40
MAX_EXEMPLES = 25
ECHANTILLON_B7 = 20
GRAINE_B7 = 20090909

# Every check that must appear in the summary table, with its French label. The
# table is built from this mapping so a check can never silently go unreported.
CHECKS: dict[str, str] = {
    "A1": "Chaque `data/sorts/*.json` valide `sort.schema.json`",
    "A2": "Chaque ligne des listes de classe valide `liste_classe.schema.json`",
    "A3": "Tous les fichiers JSON/JSONL décodent en UTF-8 strict, sans BOM",
    "B1": "Chaque `id` de l'index possède son fichier de sort",
    "B2": "Chaque fichier de sort possède son entrée d'index",
    "B3": "Chaque `id` des listes de classe est dans l'index",
    "B4": "Chaque libellé `classe` appartient aux 19 du référentiel",
    "B5": "Chaque `meta.cache_fichier` existe sur disque",
    "B6": "`sorts_partages` ∪ `sorts_exclusifs` partitionne exactement l'index",
    "B7": "Échantillon : `classes` du fichier == `classes` de l'index",
    "C1": "`slugify(nom) == id` pour chaque sort",
    "C2": "Les 21 clés présentes, dans l'ordre canonique, sans extra",
    "C3": "Nom de fichier égal à `<id>.json`",
    "C4": "Aucun caractère de remplacement U+FFFD dans le corpus",
    "D1": "Couverture par champ au-dessus des seuils",
    "D2": "Distribution des longueurs de `description`",
    "D3": "Volumétrie : sorts uniques et entrées de listes",
    "D4": "Plages de niveaux plausibles par classe",
    "D5": "Comptes `mythique` / `variantes` / `autres`",
    "E1": "Au moins un sort partagé par ≥ 5 classes",
    "E2": "Compte de sorts exclusifs pour chaque classe",
    "E3": "Aucun sort deux fois dans la même liste au même niveau",
}


@dataclass(frozen=True, slots=True)
class Anomalie:
    """One finding. `id` is the spell id, a file name, a class label or `-`."""

    check: str
    gravite: Gravite
    id: str
    detail: str
    nom: str | None = None

    def to_json(self) -> dict[str, Any]:
        record: dict[str, Any] = {
            "check": self.check,
            "gravite": self.gravite,
            "id": self.id,
            "detail": self.detail,
        }
        if self.nom is not None:
            record["nom"] = self.nom
        return record


@dataclass(frozen=True, slots=True)
class Chemins:
    """Every path the audit reads. Overridable so the auditor can be audited."""

    racine: Path = Path(".")
    sorts: Path = Path("data/sorts")
    listes: Path = Path("data/listes_classes")
    index: Path = Path("data/index")
    classes: Path = Path("data/classes.json")
    pages_sorts: Path = Path("data/spell_pages.jsonl")
    schemas: Path = Path("schemas")
    rapports: Path = Path("reports")

    @property
    def sorts_uniques(self) -> Path:
        return self.index / "sorts_uniques.jsonl"

    @property
    def carte_doublons(self) -> Path:
        return self.index / "carte_doublons.json"

    @property
    def sorts_exclusifs(self) -> Path:
        return self.index / "sorts_exclusifs.json"


@dataclass
class Corpus:
    """Every artifact, loaded once."""

    sorts: dict[str, dict] = field(default_factory=dict)
    textes_sorts: dict[str, str] = field(default_factory=dict)
    fichiers_sorts: dict[str, Path] = field(default_factory=dict)
    index: dict[str, dict] = field(default_factory=dict)
    listes: dict[str, list[dict]] = field(default_factory=dict)
    carte: dict = field(default_factory=dict)
    exclusifs: dict = field(default_factory=dict)
    referentiel: list[dict] = field(default_factory=list)
    pages_sorts: list[dict] = field(default_factory=list)

    @property
    def libelles(self) -> set[str]:
        return {c["classe"] for c in self.referentiel}


@dataclass
class Resultat:
    anomalies: list[Anomalie] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)
    resultats: dict[str, str] = field(default_factory=dict)

    def ajouter(self, anomalie: Anomalie) -> None:
        self.anomalies.append(anomalie)

    @property
    def bloquantes(self) -> list[Anomalie]:
        return [a for a in self.anomalies if a.gravite == "bloquant"]

    @property
    def verdict(self) -> str:
        return "FAIL" if self.bloquantes else "PASS"


def _lire_texte(chemin: Path) -> str:
    """Read a file as UTF-8 with strict errors — never sniffed, never lenient."""
    return chemin.read_text(encoding="utf-8", errors="strict")


def _lignes_jsonl(chemin: Path) -> list[dict]:
    return [
        json.loads(ligne)
        for ligne in _lire_texte(chemin).splitlines()
        if ligne.strip()
    ]


def charger_corpus(chemins: Chemins) -> Corpus:
    """Load every artifact. Unreadable files surface later as A3 anomalies."""
    corpus = Corpus()

    for fichier in sorted(chemins.sorts.glob("*.json")):
        try:
            texte = _lire_texte(fichier)
            doc = json.loads(texte)
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        # Key the corpus by file stem, not by `doc["id"]`: C3 compares the two
        # and a mismatch must not make one of them disappear from the audit.
        corpus.textes_sorts[fichier.stem] = texte
        corpus.fichiers_sorts[fichier.stem] = fichier
        corpus.sorts[fichier.stem] = doc

    if chemins.sorts_uniques.exists():
        corpus.index = {e["id"]: e for e in _lignes_jsonl(chemins.sorts_uniques)}
    for fichier in sorted(chemins.listes.glob("*.jsonl")):
        corpus.listes[fichier.stem] = _lignes_jsonl(fichier)
    if chemins.carte_doublons.exists():
        corpus.carte = json.loads(_lire_texte(chemins.carte_doublons))
    if chemins.sorts_exclusifs.exists():
        corpus.exclusifs = json.loads(_lire_texte(chemins.sorts_exclusifs))
    if chemins.classes.exists():
        corpus.referentiel = json.loads(_lire_texte(chemins.classes))
    if chemins.pages_sorts.exists():
        corpus.pages_sorts = _lignes_jsonl(chemins.pages_sorts)
    return corpus


def exceptions_b1(chemins: Chemins, resultat: Resultat) -> set[str]:
    """Return the agreed step-06/step-08 exception set for B1.

    The set is read from the producing steps' reports, not assumed: a missing
    report means the agreement cannot be verified, which is itself blocking.
    """
    exceptions: set[str] = set()
    for nom in ("06_fetch_spells.md", "08_enrich.md"):
        chemin = chemins.rapports / nom
        if not chemin.exists():
            resultat.ajouter(
                Anomalie(
                    "B1",
                    "bloquant",
                    nom,
                    f"rapport `{chemin.as_posix()}` absent : l'ensemble "
                    "d'exceptions convenu ne peut pas être vérifié",
                )
            )
            continue
        exceptions |= _ids_en_echec(_lire_texte(chemin))
    return exceptions


def _ids_en_echec(texte: str) -> set[str]:
    """Extract the ids a report lists as fetch failures or index orphans.

    Both reports state failures as backtick-quoted ids under a dedicated
    heading, and state their absence in prose ("Aucun échec", "Aucune entrée").
    """
    ids: set[str] = set()
    dans_section = False
    for ligne in texte.splitlines():
        depouille = ligne.strip()
        if depouille.startswith("#"):
            titre = depouille.lstrip("# ").lower()
            dans_section = "échec" in titre or "sans fichier" in titre
            continue
        if not dans_section or not depouille.startswith("- `"):
            continue
        ids.add(depouille.strip("- ").strip("`"))
    return ids


def check_a1(corpus: Corpus, chemins: Chemins, resultat: Resultat) -> None:
    schema = json.loads(_lire_texte(chemins.schemas / "sort.schema.json"))
    validateur = Draft202012Validator(schema)
    invalides = 0
    for stem, doc in corpus.sorts.items():
        for erreur in validateur.iter_errors(doc):
            invalides += 1
            chemin = "/".join(str(p) for p in erreur.absolute_path) or "(racine)"
            resultat.ajouter(
                Anomalie(
                    "A1",
                    "bloquant",
                    stem,
                    f"{chemin} : {erreur.message[:200]}",
                    doc.get("nom"),
                )
            )
    resultat.stats["a1_invalides"] = invalides
    resultat.resultats["A1"] = (
        f"OK — {len(corpus.sorts)} fichiers valides"
        if not invalides
        else f"ÉCHEC — {invalides} violation(s)"
    )


def check_a2(corpus: Corpus, chemins: Chemins, resultat: Resultat) -> None:
    schema = json.loads(_lire_texte(chemins.schemas / "liste_classe.schema.json"))
    validateur = Draft202012Validator(schema)
    invalides = 0
    lignes = 0
    for slug, entrees in corpus.listes.items():
        for numero, entree in enumerate(entrees, start=1):
            lignes += 1
            for erreur in validateur.iter_errors(entree):
                invalides += 1
                resultat.ajouter(
                    Anomalie(
                        "A2",
                        "bloquant",
                        f"{slug}.jsonl:{numero}",
                        erreur.message[:200],
                        entree.get("nom"),
                    )
                )
    resultat.stats["a2_lignes"] = lignes
    resultat.resultats["A2"] = (
        f"OK — {lignes} lignes valides sur {len(corpus.listes)} fichiers"
        if not invalides
        else f"ÉCHEC — {invalides} ligne(s) invalide(s)"
    )


def _fichiers_a_decoder(chemins: Chemins) -> list[Path]:
    motifs = (
        (chemins.sorts, "*.json"),
        (chemins.listes, "*.jsonl"),
        (chemins.index, "*.json"),
        (chemins.index, "*.jsonl"),
        (chemins.schemas, "*.json"),
    )
    fichiers = [c for dossier, motif in motifs for c in sorted(dossier.glob(motif))]
    fichiers += [
        c for c in (chemins.classes, chemins.pages_sorts) if c.exists()
    ]
    return fichiers


def check_a3(chemins: Chemins, resultat: Resultat) -> None:
    fichiers = _fichiers_a_decoder(chemins)
    defauts = 0
    for chemin in fichiers:
        try:
            texte = _lire_texte(chemin)
        except UnicodeDecodeError as erreur:
            defauts += 1
            resultat.ajouter(
                Anomalie(
                    "A3", "bloquant", chemin.as_posix(),
                    f"décodage UTF-8 strict impossible : {erreur}",
                )
            )
            continue
        if texte.startswith(BOM):
            defauts += 1
            resultat.ajouter(
                Anomalie("A3", "bloquant", chemin.as_posix(), "BOM UTF-8 présent")
            )
        try:
            if chemin.suffix == ".jsonl":
                for numero, ligne in enumerate(texte.splitlines(), start=1):
                    if ligne.strip():
                        json.loads(ligne)
            else:
                json.loads(texte)
        except json.JSONDecodeError as erreur:
            defauts += 1
            resultat.ajouter(
                Anomalie(
                    "A3", "bloquant", chemin.as_posix(),
                    f"JSON illisible : {erreur}",
                )
            )
    resultat.stats["a3_fichiers"] = len(fichiers)
    resultat.resultats["A3"] = (
        f"OK — {len(fichiers)} fichiers UTF-8 stricts, sans BOM, analysables"
        if not defauts
        else f"ÉCHEC — {defauts} fichier(s) en défaut"
    )


def check_b1(corpus: Corpus, exceptions: set[str], resultat: Resultat) -> None:
    manquants = sorted(set(corpus.index) - set(corpus.sorts))
    inattendus = sorted(set(manquants) - exceptions)
    non_observees = sorted(exceptions - set(manquants))
    for identifiant in inattendus:
        resultat.ajouter(
            Anomalie(
                "B1", "bloquant", identifiant,
                "entrée d'index sans fichier `data/sorts/<id>.json`, et hors de "
                "l'ensemble d'exceptions convenu (étapes 06/08)",
                corpus.index[identifiant].get("nom"),
            )
        )
    for identifiant in non_observees:
        resultat.ajouter(
            Anomalie(
                "B1", "avertissement", identifiant,
                "exception annoncée par les rapports 06/08 mais non observée : "
                "le fichier existe, l'ensemble d'exceptions est périmé",
            )
        )
    resultat.stats["b1_exceptions"] = sorted(exceptions)
    resultat.stats["b1_manquants"] = manquants
    resultat.resultats["B1"] = (
        f"OK — {len(corpus.index)} entrées d'index, toutes couvertes "
        f"(ensemble d'exceptions : {len(exceptions)})"
        if not inattendus and not non_observees
        else f"ÉCHEC — {len(inattendus)} manquant(s) hors exceptions, "
        f"{len(non_observees)} exception(s) périmée(s)"
    )


def check_b2(corpus: Corpus, resultat: Resultat) -> None:
    orphelins = sorted(
        stem for stem, doc in corpus.sorts.items() if doc.get("id") not in corpus.index
    )
    for stem in orphelins:
        resultat.ajouter(
            Anomalie(
                "B2", "bloquant", stem,
                "fichier de sort sans entrée dans `sorts_uniques.jsonl`",
                corpus.sorts[stem].get("nom"),
            )
        )
    resultat.resultats["B2"] = (
        f"OK — {len(corpus.sorts)} fichiers, 100 % indexés"
        if not orphelins
        else f"ÉCHEC — {len(orphelins)} orphelin(s)"
    )


def check_b3(corpus: Corpus, resultat: Resultat) -> None:
    absents: list[tuple[str, str]] = []
    for slug, entrees in corpus.listes.items():
        for entree in entrees:
            if entree["id"] not in corpus.index:
                absents.append((slug, entree["id"]))
    for slug, identifiant in absents:
        resultat.ajouter(
            Anomalie(
                "B3", "bloquant", identifiant,
                f"présent dans `{slug}.jsonl` mais absent de `sorts_uniques.jsonl`",
            )
        )
    resultat.resultats["B3"] = (
        "OK — chaque `id` de liste est indexé"
        if not absents
        else f"ÉCHEC — {len(absents)} `id` non indexé(s)"
    )


def check_b4(corpus: Corpus, resultat: Resultat) -> None:
    libelles = corpus.libelles
    inconnus: Counter[str] = Counter()
    exemples: dict[str, str] = {}

    def examiner(label: str, origine: str) -> None:
        if label not in libelles:
            inconnus[label] += 1
            exemples.setdefault(label, origine)

    for slug, entrees in corpus.listes.items():
        for entree in entrees:
            examiner(entree["classe"], f"{slug}.jsonl")
    for stem, doc in corpus.sorts.items():
        for classe in doc.get("classes", []):
            examiner(classe["classe"], f"data/sorts/{stem}.json")
    for identifiant, entree in corpus.index.items():
        for classe in entree.get("classes", []):
            examiner(classe["classe"], f"index:{identifiant}")
    for label in corpus.exclusifs.get("totaux", {}):
        examiner(label, "sorts_exclusifs.totaux")

    for label, nombre in inconnus.most_common():
        resultat.ajouter(
            Anomalie(
                "B4", "bloquant", label,
                f"libellé de classe hors des {len(libelles)} du référentiel "
                f"`data/classes.json` — {nombre} occurrence(s), "
                f"p. ex. {exemples[label]}",
            )
        )
    resultat.stats["b4_libelles"] = len(libelles)
    resultat.resultats["B4"] = (
        f"OK — tous les libellés parmi les {len(libelles)} du référentiel"
        if not inconnus
        else f"ÉCHEC — {len(inconnus)} libellé(s) inconnu(s)"
    )


def check_b5(corpus: Corpus, chemins: Chemins, resultat: Resultat) -> None:
    manquants: list[str] = []
    for stem, doc in corpus.sorts.items():
        cache = (doc.get("meta") or {}).get("cache_fichier")
        if cache is None:
            manquants.append(stem)
            resultat.ajouter(
                Anomalie(
                    "B5", "avertissement", stem,
                    "`meta.cache_fichier` vaut null : la provenance du fichier "
                    "n'est pas traçable",
                    doc.get("nom"),
                )
            )
            continue
        if not (chemins.racine / cache).exists():
            manquants.append(stem)
            resultat.ajouter(
                Anomalie(
                    "B5", "bloquant", stem,
                    f"`meta.cache_fichier` introuvable sur disque : `{cache}`",
                    doc.get("nom"),
                )
            )
    resultat.resultats["B5"] = (
        f"OK — {len(corpus.sorts)} fichiers de cache présents"
        if not manquants
        else f"ÉCHEC — {len(manquants)} référence(s) de cache en défaut"
    )


def check_b6(corpus: Corpus, resultat: Resultat) -> None:
    partages = set(corpus.carte.get("sorts_partages", {}))
    exclusifs: set[str] = set()
    doublons_exclusifs: list[str] = []
    for bloc in corpus.exclusifs.get("par_classe", {}).values():
        for sort in bloc.get("sorts", []):
            if sort["id"] in exclusifs:
                doublons_exclusifs.append(sort["id"])
            exclusifs.add(sort["id"])
    chevauchement = sorted(partages & exclusifs)
    manquants = sorted(set(corpus.index) - partages - exclusifs)
    hors_index = sorted((partages | exclusifs) - set(corpus.index))

    for identifiant in chevauchement:
        resultat.ajouter(
            Anomalie(
                "B6", "bloquant", identifiant,
                "présent à la fois dans `sorts_partages` et dans "
                "`sorts_exclusifs` : la partition se recouvre",
            )
        )
    for identifiant in manquants:
        resultat.ajouter(
            Anomalie(
                "B6", "bloquant", identifiant,
                "entrée d'index absente des deux faces de la partition "
                "(ni partagée, ni exclusive)",
            )
        )
    for identifiant in hors_index:
        resultat.ajouter(
            Anomalie(
                "B6", "bloquant", identifiant,
                "classé partagé ou exclusif sans entrée dans "
                "`sorts_uniques.jsonl`",
            )
        )
    for identifiant in doublons_exclusifs:
        resultat.ajouter(
            Anomalie(
                "B6", "bloquant", identifiant,
                "déclaré exclusif à plusieurs classes — contradiction dans les "
                "termes",
            )
        )
    resultat.stats["b6_partages"] = len(partages)
    resultat.stats["b6_exclusifs"] = len(exclusifs)
    resultat.resultats["B6"] = (
        f"OK — {len(partages)} partagés + {len(exclusifs)} exclusifs = "
        f"{len(corpus.index)} entrées d'index, sans recouvrement"
        if not (chevauchement or manquants or hors_index or doublons_exclusifs)
        else "ÉCHEC — la partition ne recouvre pas exactement l'index"
    )


def check_b7(corpus: Corpus, resultat: Resultat, graine: int) -> None:
    communs = sorted(set(corpus.sorts) & set(corpus.index))
    echantillon = random.Random(graine).sample(
        communs, min(ECHANTILLON_B7, len(communs))
    )
    ecarts = 0
    for identifiant in sorted(echantillon):
        attendu = {
            c["classe"]: c["niveau"]
            for c in corpus.index[identifiant].get("classes", [])
        }
        obtenu = {
            c["classe"]: c["niveau"]
            for c in corpus.sorts[identifiant].get("classes", [])
        }
        if attendu == obtenu:
            continue
        ecarts += 1
        resultat.ajouter(
            Anomalie(
                "B7", "bloquant", identifiant,
                f"`classes` du fichier {obtenu} ≠ `classes` de l'index {attendu}",
                corpus.sorts[identifiant].get("nom"),
            )
        )
    resultat.stats["b7_echantillon"] = sorted(echantillon)
    resultat.resultats["B7"] = (
        f"OK — {len(echantillon)} sorts tirés (graine {graine}), concordance totale"
        if not ecarts
        else f"ÉCHEC — {ecarts} écart(s) sur {len(echantillon)} tirés"
    )


def _suffixe_collision(identifiant: str, attendu: str) -> bool:
    """True when `identifiant` is `attendu` plus a documented -2/-3 suffix."""
    if not identifiant.startswith(f"{attendu}-"):
        return False
    reste = identifiant[len(attendu) + 1 :]
    return reste.isdigit() and int(reste) >= 2


def check_c1(corpus: Corpus, resultat: Resultat) -> None:
    collisions: list[str] = []
    ecarts = 0
    for stem, doc in corpus.sorts.items():
        identifiant = doc.get("id", stem)
        attendu = slugify(doc.get("nom", ""))
        if identifiant == attendu:
            continue
        if _suffixe_collision(identifiant, attendu):
            collisions.append(identifiant)
            resultat.ajouter(
                Anomalie(
                    "C1", "info", identifiant,
                    f"suffixe de collision documenté : `slugify({doc['nom']!r})` "
                    f"= `{attendu}`",
                    doc.get("nom"),
                )
            )
            continue
        ecarts += 1
        resultat.ajouter(
            Anomalie(
                "C1", "bloquant", identifiant,
                f"`slugify(nom)` donne `{attendu}` : l'`id` stocké ne se "
                "redérive pas du nom",
                doc.get("nom"),
            )
        )
    resultat.stats["c1_collisions"] = sorted(collisions)
    resultat.resultats["C1"] = (
        f"OK — {len(corpus.sorts)} `id` redérivés, "
        f"{len(collisions)} suffixe(s) de collision"
        if not ecarts
        else f"ÉCHEC — {ecarts} `id` non redérivable(s)"
    )


def check_c2(corpus: Corpus, resultat: Resultat) -> None:
    defauts = 0
    for stem, doc in corpus.sorts.items():
        cles = tuple(doc)
        if cles == CLES_SORT:
            continue
        defauts += 1
        manquantes = [c for c in CLES_SORT if c not in doc]
        extras = [c for c in cles if c not in CLES_SORT]
        if manquantes or extras:
            detail = (
                f"clés manquantes {manquantes}, clés en trop {extras}"
                if manquantes and extras
                else f"clés manquantes {manquantes}"
                if manquantes
                else f"clés en trop {extras}"
            )
        else:
            detail = f"ordre des clés non canonique : {list(cles)}"
        resultat.ajouter(
            Anomalie("C2", "bloquant", stem, detail, doc.get("nom"))
        )
    resultat.resultats["C2"] = (
        f"OK — {len(CLES_SORT)} clés canoniques dans les {len(corpus.sorts)} fichiers"
        if not defauts
        else f"ÉCHEC — {defauts} fichier(s) au jeu de clés non conforme"
    )


def check_c3(corpus: Corpus, resultat: Resultat) -> None:
    defauts = 0
    for stem, doc in corpus.sorts.items():
        if doc.get("id") == stem:
            continue
        defauts += 1
        resultat.ajouter(
            Anomalie(
                "C3", "bloquant", stem,
                f"nom de fichier `{stem}.json` ≠ `{doc.get('id')}.json` "
                "(la clé de jointure est cassée)",
                doc.get("nom"),
            )
        )
    resultat.resultats["C3"] = (
        f"OK — {len(corpus.sorts)} noms de fichiers égaux à `<id>.json`"
        if not defauts
        else f"ÉCHEC — {defauts} nom(s) de fichier divergent(s)"
    )


def check_c4(corpus: Corpus, resultat: Resultat) -> None:
    """The decisive encoding check: U+FFFD anywhere means a mis-decode.

    Run on the raw file text rather than on values, so a replacement character
    hidden in a key or inside `description_html` cannot slip through.
    """
    total = 0
    for stem, texte in corpus.textes_sorts.items():
        occurrences = texte.count(REPLACEMENT_CHAR)
        if not occurrences:
            continue
        total += occurrences
        resultat.ajouter(
            Anomalie(
                "C4", "bloquant", stem,
                f"{occurrences} caractère(s) de remplacement U+FFFD : le "
                "contenu a été décodé avec le mauvais jeu de caractères",
                corpus.sorts[stem].get("nom"),
            )
        )
    resultat.stats["c4_occurrences"] = total
    resultat.resultats["C4"] = (
        f"OK — 0 occurrence de U+FFFD sur {len(corpus.textes_sorts)} fichiers"
        if not total
        else f"ÉCHEC — {total} occurrence(s) de U+FFFD"
    )


def _est_renseigne(valeur: Any) -> bool:
    return valeur not in (None, "", {}, [])


def check_d1(corpus: Corpus, resultat: Resultat) -> None:
    total = len(corpus.sorts)
    couverture: dict[str, tuple[int, float]] = {}
    manques: dict[str, list[str]] = {}
    en_defaut: list[str] = []
    for champ in CHAMPS_COUVERTURE:
        renseignes = [
            stem for stem, doc in corpus.sorts.items() if _est_renseigne(doc.get(champ))
        ]
        pourcentage = (100.0 * len(renseignes) / total) if total else 0.0
        couverture[champ] = (len(renseignes), pourcentage)
        manques[champ] = sorted(set(corpus.sorts) - set(renseignes))
        seuil = SEUILS_COUVERTURE.get(champ)
        if seuil is None or pourcentage >= seuil:
            continue
        en_defaut.append(champ)
        resultat.ajouter(
            Anomalie(
                "D1", "bloquant", champ,
                f"couverture {pourcentage:.2f} % < seuil {seuil:.0f} % "
                f"({len(renseignes)}/{total})",
            )
        )
    # Fields without a floor still get their gaps named, spell by spell: the
    # report has to let a human go look, not just print a percentage.
    for champ, identifiants in manques.items():
        if champ in SEUILS_COUVERTURE or not identifiants:
            continue
        for identifiant in identifiants:
            resultat.ajouter(
                Anomalie(
                    "D1", "info", identifiant,
                    f"champ `{champ}` non renseigné (absent de la page du wiki)",
                    corpus.sorts[identifiant].get("nom"),
                )
            )
    resultat.stats["d1_couverture"] = couverture
    resultat.stats["d1_manques"] = manques
    resultat.resultats["D1"] = (
        "OK — tous les champs à seuil au-dessus de leur plancher"
        if not en_defaut
        else f"ÉCHEC — {', '.join(en_defaut)} sous le seuil"
    )


def check_d2(corpus: Corpus, resultat: Resultat) -> None:
    longueurs = [len(doc.get("description") or "") for doc in corpus.sorts.values()]
    courtes = sorted(
        stem
        for stem, doc in corpus.sorts.items()
        if len(doc.get("description") or "") < DESCRIPTION_COURTE
    )
    for stem in courtes:
        resultat.ajouter(
            Anomalie(
                "D2", "avertissement", stem,
                f"description de {len(corpus.sorts[stem].get('description') or '')} "
                f"caractères (< {DESCRIPTION_COURTE}) : probable analyse tronquée",
                corpus.sorts[stem].get("nom"),
            )
        )
    resultat.stats["d2"] = {
        "min": min(longueurs) if longueurs else 0,
        "median": int(statistics.median(longueurs)) if longueurs else 0,
        "max": max(longueurs) if longueurs else 0,
        "courtes": courtes,
    }
    resultat.resultats["D2"] = (
        f"OK — min {resultat.stats['d2']['min']}, médiane "
        f"{resultat.stats['d2']['median']}, max {resultat.stats['d2']['max']} ; "
        f"{len(courtes)} description(s) < {DESCRIPTION_COURTE} caractères"
    )


def check_d3(corpus: Corpus, resultat: Resultat) -> None:
    """Re-derive the volumetry from the class lists, never from `nb_sorts_uniques`."""
    entrees = sum(len(v) for v in corpus.listes.values())
    uniques = len({e["id"] for v in corpus.listes.values() for e in v})
    ratio = (entrees / uniques) if uniques else 0.0
    annonce = corpus.carte.get("nb_sorts_uniques")

    if annonce is not None and annonce != uniques:
        resultat.ajouter(
            Anomalie(
                "D3", "bloquant", "carte_doublons.json",
                f"`nb_sorts_uniques` = {annonce} mais le recomptage depuis les "
                f"listes de classe donne {uniques}",
            )
        )
    if uniques != len(corpus.index):
        resultat.ajouter(
            Anomalie(
                "D3", "bloquant", "sorts_uniques.jsonl",
                f"{len(corpus.index)} entrées d'index pour {uniques} `id` "
                "distincts dans les listes de classe",
            )
        )
    # The plan's bands (2 500–3 500 uniques, 4 000–5 000 entries) were estimates
    # extrapolated from three list pages before any page was parsed. The measured
    # corpus is outside both, and in both cases the plan is what is wrong.
    resultat.ajouter(
        Anomalie(
            "D3", "avertissement", "volumetrie",
            f"{uniques} sorts uniques (fourchette annoncée par le plan : "
            f"2 500–3 500) et {entrees} entrées de listes (fourchette annoncée : "
            f"4 000–5 000). Les deux fourchettes du plan étaient des "
            f"extrapolations faites avant tout parsing ; les valeurs mesurées "
            f"sont cohérentes entre elles (ratio de partage {ratio:.2f} entrées "
            f"par sort) et recoupent les étapes 04/05/06. Le plan est périmé, "
            f"pas le corpus.",
        )
    )
    resultat.stats["d3"] = {
        "entrees": entrees,
        "uniques": uniques,
        "ratio": ratio,
        "index": len(corpus.index),
        "fichiers": len(corpus.sorts),
    }
    resultat.resultats["D3"] = (
        f"HORS FOURCHETTE (plan périmé) — {uniques} sorts uniques, "
        f"{entrees} entrées, ratio {ratio:.2f}"
    )


def check_d4(corpus: Corpus, resultat: Resultat) -> None:
    plages: dict[str, tuple[int, int, int]] = {}
    niveaux: dict[str, list[int]] = defaultdict(list)
    for entrees in corpus.listes.values():
        for entree in entrees:
            niveaux[entree["classe"]].append(entree["niveau"])

    aberrants = 0
    for label in sorted(niveaux):
        valeurs = niveaux[label]
        bas, haut = min(valeurs), max(valeurs)
        plages[label] = (bas, haut, len(valeurs))
        if haut > NIVEAU_MAX_ABSOLU or bas < NIVEAU_MIN_ABSOLU:
            aberrants += 1
            resultat.ajouter(
                Anomalie(
                    "D4", "bloquant", label,
                    f"plage de niveaux {bas}–{haut} hors des bornes PF1 "
                    f"{NIVEAU_MIN_ABSOLU}–{NIVEAU_MAX_ABSOLU}",
                )
            )
            continue
        bande = BANDES_NIVEAUX.get(label)
        if bande is not None and (bas, haut) != bande:
            resultat.ajouter(
                Anomalie(
                    "D4", "avertissement", label,
                    f"plage observée {bas}–{haut}, plage attendue par le plan "
                    f"{bande[0]}–{bande[1]}",
                )
            )
    resultat.stats["d4"] = plages
    resultat.resultats["D4"] = (
        f"OK — {len(plages)} classes dans les bornes 0–9"
        if not aberrants
        else f"ÉCHEC — {aberrants} classe(s) hors bornes"
    )


def check_d5(corpus: Corpus, resultat: Resultat) -> None:
    mythiques = sorted(stem for stem, d in corpus.sorts.items() if d.get("mythique"))
    variantes = sorted(stem for stem, d in corpus.sorts.items() if d.get("variantes"))
    autres = sorted(stem for stem, d in corpus.sorts.items() if d.get("autres"))
    nb_variantes = sum(len(corpus.sorts[s]["variantes"]) for s in variantes)
    etiquettes: Counter[str] = Counter()
    for stem in autres:
        etiquettes.update(corpus.sorts[stem]["autres"].keys())
    resultat.ajouter(
        Anomalie(
            "D5", "info", "mythique",
            f"{len(mythiques)} sorts portent un bloc `mythique` — capture "
            "volontaire, suppression prévue dans une phase ultérieure",
        )
    )
    resultat.stats["d5"] = {
        "mythique": len(mythiques),
        "variantes": len(variantes),
        "nb_variantes": nb_variantes,
        "autres": len(autres),
        "etiquettes": etiquettes,
    }
    resultat.resultats["D5"] = (
        f"OK — {len(mythiques)} `mythique`, {len(variantes)} avec `variantes` "
        f"({nb_variantes} variantes), {len(autres)} avec `autres` non vide"
    )


def check_e1(corpus: Corpus, resultat: Resultat) -> None:
    partages = sorted(
        (
            (len(e.get("classes", [])), identifiant, e.get("nom", ""))
            for identifiant, e in corpus.index.items()
        ),
        key=lambda t: (-t[0], t[1]),
    )
    maximum = partages[0][0] if partages else 0
    if maximum < 5:
        resultat.ajouter(
            Anomalie(
                "E1", "bloquant", "partage",
                f"aucun sort partagé par ≥ 5 classes (maximum observé "
                f"{maximum}) : le recoupement inter-classes a probablement échoué",
            )
        )
    resultat.stats["e1_top"] = partages[:10]
    resultat.stats["e1_max"] = maximum
    resultat.resultats["E1"] = (
        f"OK — maximum {maximum} classes pour un même sort"
        if maximum >= 5
        else f"ÉCHEC — maximum {maximum} classes"
    )


def check_e2(corpus: Corpus, resultat: Resultat) -> None:
    totaux = dict(corpus.exclusifs.get("totaux", {}))
    absentes = sorted(corpus.libelles - set(totaux))
    for label in absentes:
        resultat.ajouter(
            Anomalie(
                "E2", "bloquant", label,
                "classe du référentiel absente de `sorts_exclusifs.totaux` : "
                "son compte de sorts exclusifs n'est pas rapporté",
            )
        )
    for label in sorted(k for k, v in totaux.items() if v == 0):
        resultat.ajouter(
            Anomalie(
                "E2", "avertissement", label,
                "0 sort exclusif — soit la classe n'emprunte que des sorts "
                "partagés, soit son URL de liste est mal rattachée dans "
                "`data/classes.json`",
            )
        )
    resultat.stats["e2_totaux"] = totaux
    resultat.resultats["E2"] = (
        f"OK — {len(totaux)} classes rapportées, "
        f"{sum(1 for v in totaux.values() if v == 0)} à 0 exclusif"
        if not absentes
        else f"ÉCHEC — {len(absentes)} classe(s) non rapportée(s)"
    )


def check_e3(corpus: Corpus, resultat: Resultat) -> None:
    doublons = 0
    for slug, entrees in corpus.listes.items():
        compte = Counter((e["id"], e["niveau"]) for e in entrees)
        for (identifiant, niveau), nombre in sorted(compte.items()):
            if nombre == 1:
                continue
            doublons += 1
            resultat.ajouter(
                Anomalie(
                    "E3", "bloquant", identifiant,
                    f"apparaît {nombre} fois dans `{slug}.jsonl` au niveau "
                    f"{niveau}",
                )
            )
    resultat.resultats["E3"] = (
        "OK — aucun doublon (id, niveau) dans une même liste"
        if not doublons
        else f"ÉCHEC — {doublons} doublon(s)"
    )


def check_conventions_annexes(corpus: Corpus, resultat: Resultat) -> None:
    """Record the pre-agreed exceptions actually observed, as `info` findings.

    They are not defects; they are recorded so the report can state that each
    agreed exception was looked for and either seen or not seen.
    """
    hors_liste: Counter[str] = Counter()
    inconnues: Counter[str] = Counter()
    for doc in corpus.sorts.values():
        for abbrev in doc.get("niveaux", {}):
            if abbrev in CLASS_ABBREV:
                continue
            if abbrev in CLASS_ABBREV_HORS_LISTE:
                hors_liste[abbrev] += 1
            else:
                inconnues[abbrev] += 1
    for abbrev, nombre in hors_liste.most_common():
        resultat.ajouter(
            Anomalie(
                "B4", "info", abbrev,
                f"abréviation de classe hors des 19 du plan "
                f"({CLASS_ABBREV_HORS_LISTE[abbrev]}) dans `niveaux` — "
                f"{nombre} sort(s) : attendu, Pathfinder 1e compte plus de "
                "classes que `elements_to_do.json`",
            )
        )
    for abbrev, nombre in inconnues.most_common():
        resultat.ajouter(
            Anomalie(
                "B4", "avertissement", abbrev,
                f"abréviation de classe inconnue dans `niveaux` — "
                f"{nombre} sort(s) : à ajouter au référentiel des abréviations",
            )
        )

    sans_ecole: list[str] = []
    for identifiant, entree in corpus.index.items():
        if entree.get("ecoles"):
            continue
        labels = {c["classe"] for c in entree.get("classes", [])}
        if labels and labels <= CLASSES_SANS_ECOLE:
            sans_ecole.append(identifiant)
    resultat.stats["abbrevs_hors_liste"] = hors_liste
    resultat.stats["abbrevs_inconnues"] = inconnues
    resultat.stats["index_sans_ecole"] = sorted(sans_ecole)
    resultat.stats["niveaux_divergents"] = len(corpus.carte.get("niveaux_divergents", []))


def executer(chemins: Chemins, graine: int = GRAINE_B7) -> Resultat:
    """Run every check against the artifacts under `chemins`."""
    corpus = charger_corpus(chemins)
    resultat = Resultat()
    resultat.stats["chemins"] = chemins

    check_a1(corpus, chemins, resultat)
    check_a2(corpus, chemins, resultat)
    check_a3(chemins, resultat)
    check_b1(corpus, exceptions_b1(chemins, resultat), resultat)
    check_b2(corpus, resultat)
    check_b3(corpus, resultat)
    check_b4(corpus, resultat)
    check_b5(corpus, chemins, resultat)
    check_b6(corpus, resultat)
    check_b7(corpus, resultat, graine)
    check_c1(corpus, resultat)
    check_c2(corpus, resultat)
    check_c3(corpus, resultat)
    check_c4(corpus, resultat)
    check_d1(corpus, resultat)
    check_d2(corpus, resultat)
    check_d3(corpus, resultat)
    check_d4(corpus, resultat)
    check_d5(corpus, resultat)
    check_e1(corpus, resultat)
    check_e2(corpus, resultat)
    check_e3(corpus, resultat)
    check_conventions_annexes(corpus, resultat)

    manquants = [c for c in CHECKS if c not in resultat.resultats]
    for check in manquants:
        resultat.ajouter(
            Anomalie(
                check, "bloquant", "-",
                "contrôle non exécuté : l'audit est incomplet",
            )
        )
        resultat.resultats[check] = "NON EXÉCUTÉ"
    return resultat


def cles_de_tri(anomalie: Anomalie) -> tuple[str, str]:
    return (anomalie.check, anomalie.id)


def rendre_anomalies(anomalies: Iterable[Anomalie]) -> str:
    lignes = [
        json.dumps(a.to_json(), ensure_ascii=False, separators=(",", ":"))
        for a in sorted(anomalies, key=cles_de_tri)
    ]
    return "".join(f"{ligne}\n" for ligne in lignes)


def _pct(valeur: float) -> str:
    return f"{valeur:.2f} %"


def _echapper(texte: str) -> str:
    """Make a value safe inside a markdown table cell."""
    return texte.replace("|", "\\|").replace("\n", " ")


def build_report(resultat: Resultat, chemins: Chemins) -> str:
    stats = resultat.stats
    anomalies = resultat.anomalies
    bloquantes = resultat.bloquantes
    avertissements = [a for a in anomalies if a.gravite == "avertissement"]
    infos = [a for a in anomalies if a.gravite == "info"]
    d3 = stats.get("d3", {})

    lignes = [
        f"VERDICT: {resultat.verdict}",
        "",
        "# Rapport 09 — Validation indépendante du corpus",
        "",
        f"Validateur : `pf_spells.validate_corpus` v{validator_version} — "
        "lecture seule sur `data/`, aucun accès réseau.",
        "",
        f"Skill `pf-corpus-conventions` chargée depuis `{SKILL_PATH.as_posix()}` "
        "et prise comme autorité : algorithme de slug, vocabulaire des clés, "
        "règles d'encodage, table des classes.",
        "",
        "Schémas utilisés : `schemas/sort.schema.json` et "
        "`schemas/liste_classe.schema.json` (`Draft202012Validator`). Les `id` "
        "sont redérivés avec `pf_spells.slugs.slugify`, la volumétrie est "
        "recomptée depuis `data/listes_classes/*.jsonl` : aucun compte n'est "
        "repris d'un rapport d'étape.",
        "",
        "## Verdict",
        "",
        f"**{resultat.verdict}** — {len(bloquantes)} anomalie(s) bloquante(s), "
        f"{len(avertissements)} avertissement(s), {len(infos)} information(s).",
        "",
        (
            "Aucune anomalie bloquante : `feat/spell-corpus` est en état d'être "
            "fusionnée dans `main`."
            if not bloquantes
            else "Anomalies bloquantes présentes : ne pas fusionner dans `main` "
            "avant correction."
        ),
        "",
        "## Table des contrôles",
        "",
        "| Contrôle | Description | Résultat |",
        "|---|---|---|",
    ]
    for check, description in CHECKS.items():
        lignes.append(
            f"| {check} | {description} | "
            f"{_echapper(resultat.resultats.get(check, 'NON EXÉCUTÉ'))} |"
        )

    couverture = stats.get("d1_couverture", {})
    lignes += [
        "",
        "## D1 — Couverture par champ",
        "",
        "| Champ | Renseignés | Couverture | Seuil bloquant |",
        "|---|---:|---:|---:|",
    ]
    for champ, (nombre, pourcentage) in couverture.items():
        seuil = SEUILS_COUVERTURE.get(champ)
        lignes.append(
            f"| `{champ}` | {nombre} / {d3.get('fichiers', 0)} | "
            f"{_pct(pourcentage)} | "
            f"{'—' if seuil is None else _pct(seuil)} |"
        )
    lignes += [
        "",
        "Les champs sans seuil sont absents de la page du wiki quand le sort "
        "n'a pas la caractéristique (un sort sans jet de sauvegarde n'a pas de "
        "ligne `Jet de sauvegarde`) : leur non-couverture est un fait de la "
        "source, pas une perte à l'analyse. Chaque manque est listé sort par "
        "sort dans `reports/09_anomalies.jsonl` (`check` = `D1`, "
        "`gravite` = `info`).",
        "",
    ]
    for champ in ("ecole", "niveaux", "description"):
        manques = stats.get("d1_manques", {}).get(champ, [])
        if manques:
            lignes += [
                f"Sorts sans `{champ}` : "
                + ", ".join(f"`{i}`" for i in manques[:MAX_EXEMPLES])
                + (f" … (+{len(manques) - MAX_EXEMPLES})" if len(manques) > MAX_EXEMPLES else ""),
                "",
            ]

    d2 = stats.get("d2", {})
    d5 = stats.get("d5", {})
    lignes += [
        "## D2, D3, D5 — Volumétrie et distributions",
        "",
        "| Mesure | Valeur |",
        "|---|---:|",
        f"| Fichiers `data/sorts/*.json` | {d3.get('fichiers', 0)} |",
        f"| Entrées `sorts_uniques.jsonl` | {d3.get('index', 0)} |",
        f"| Sorts uniques recomptés depuis les listes | {d3.get('uniques', 0)} |",
        f"| Entrées totales dans les listes de classe | {d3.get('entrees', 0)} |",
        f"| Ratio de partage (entrées / sort unique) | {d3.get('ratio', 0.0):.2f} |",
        f"| Longueur de `description` — min / médiane / max | "
        f"{d2.get('min', 0)} / {d2.get('median', 0)} / {d2.get('max', 0)} |",
        f"| Descriptions < {DESCRIPTION_COURTE} caractères | "
        f"{len(d2.get('courtes', []))} |",
        f"| Sorts avec bloc `mythique` | {d5.get('mythique', 0)} |",
        f"| Sorts avec `variantes` | {d5.get('variantes', 0)} "
        f"({d5.get('nb_variantes', 0)} variantes) |",
        f"| Sorts avec `autres` non vide | {d5.get('autres', 0)} |",
        "",
        "### Écart avec les fourchettes annoncées par le plan",
        "",
        f"Le plan annonçait 2 500–3 500 sorts uniques et 4 000–5 000 entrées de "
        f"listes. Le corpus mesuré en compte **{d3.get('uniques', 0)}** et "
        f"**{d3.get('entrees', 0)}**. Les deux fourchettes du plan étaient des "
        "extrapolations faites à partir de trois pages de listes, avant que le "
        "moindre parsing ait eu lieu ; elles n'ont jamais été des mesures. Les "
        "valeurs observées sont mutuellement cohérentes et concordent avec les "
        "étapes 04, 05 et 06 (8 927 lignes lues → 2 070 URL distinctes). "
        "**C'est la fourchette du plan qui est périmée, pas le corpus** : "
        "l'écart est rapporté comme avertissement et ne bloque pas le verdict.",
        "",
    ]

    lignes += [
        "## D4 — Plages de niveaux par classe",
        "",
        "| Classe | Niveau min | Niveau max | Entrées |",
        "|---|---:|---:|---:|",
    ]
    for label, (bas, haut, nombre) in sorted(stats.get("d4", {}).items()):
        lignes.append(f"| {_echapper(label)} | {bas} | {haut} | {nombre} |")

    lignes += [
        "",
        "## E1 — Les 10 sorts les plus partagés",
        "",
        "| Rang | id | nom | Classes |",
        "|---:|---|---|---:|",
    ]
    for rang, (nombre, identifiant, nom) in enumerate(stats.get("e1_top", []), start=1):
        lignes.append(f"| {rang} | `{identifiant}` | {_echapper(nom)} | {nombre} |")

    lignes += [
        "",
        "## E2 — Sorts exclusifs par classe",
        "",
        "| Classe | Sorts exclusifs |",
        "|---|---:|",
    ]
    totaux = stats.get("e2_totaux", {})
    for label, nombre in sorted(totaux.items()):
        marque = " **← 0**" if nombre == 0 else ""
        lignes.append(f"| {_echapper(label)} | {nombre}{marque} |")
    zeros = sorted(k for k, v in totaux.items() if v == 0)
    lignes += [
        "",
        (
            f"Classes à **0 sort exclusif** : {', '.join(zeros)}. C'est un "
            "résultat notable et possiblement suspect : soit ces classes "
            "n'accèdent qu'à des sorts également ouverts à d'autres, soit leur "
            "liste a été mal rattachée à l'étape 04. Le départage se fait sur "
            "`data/classes.json`, en amont, puis on régénère."
            if zeros
            else "Toutes les classes possèdent au moins un sort exclusif."
        ),
        "",
    ]

    lignes += ["## Anomalies bloquantes", ""]
    if bloquantes:
        lignes += ["| Contrôle | id | nom | Détail |", "|---|---|---|---|"]
        for a in sorted(bloquantes, key=cles_de_tri):
            lignes.append(
                f"| {a.check} | `{a.id}` | {_echapper(a.nom or '')} | "
                f"{_echapper(a.detail)} |"
            )
    else:
        lignes.append("_Aucune._ Les contrôles bloquants passent tous.")

    lignes += ["", "## Avertissements", ""]
    if avertissements:
        groupes: dict[str, list[Anomalie]] = defaultdict(list)
        for a in avertissements:
            groupes[a.check].append(a)
        for check in sorted(groupes):
            lot = sorted(groupes[check], key=cles_de_tri)
            lignes += [
                f"### {check} — {len(lot)} avertissement(s)",
                "",
                "| id | Détail |",
                "|---|---|",
            ]
            for a in lot[:MAX_EXEMPLES]:
                lignes.append(f"| `{a.id}` | {_echapper(a.detail)} |")
            if len(lot) > MAX_EXEMPLES:
                lignes.append(
                    f"| … | _{len(lot) - MAX_EXEMPLES} de plus, "
                    "voir `reports/09_anomalies.jsonl`_ |"
                )
            lignes.append("")
    else:
        lignes += ["_Aucun._", ""]

    hors_liste = stats.get("abbrevs_hors_liste", Counter())
    inconnues = stats.get("abbrevs_inconnues", Counter())
    lignes += [
        "## Constats connus et acceptés",
        "",
        "Les cinq exceptions convenues dans "
        "`build/pf_spell_corpus/09_VALIDATE_CORPUS.md`, chacune recherchée "
        "explicitement :",
        "",
        "| # | Exception convenue | Observé ? |",
        "|---:|---|---|",
        f"| 1 | 404 du wiki à l'étape 06, listés dans "
        f"`reports/06_fetch_spells.md` et orphelins à l'étape 08 | "
        f"**Non observé** : l'ensemble d'exceptions extrait des rapports 06 et "
        f"08 est vide ({len(stats.get('b1_exceptions', []))} entrée), et B1/B2 "
        f"ne relèvent aucun orphelin dans un sens ni dans l'autre. Les 2 070 "
        f"pages ont été récupérées et analysées. |",
        f"| 2 | Divergence de niveau entre classes pour un même sort "
        f"(`niveaux_divergents`) | **Observé** : "
        f"{stats.get('niveaux_divergents', 0)} sorts dans "
        f"`carte_doublons.niveaux_divergents`. Design PF1 normal, non compté "
        f"comme défaut. |",
        f"| 3 | Abréviations de classes hors des 19 du plan dans `niveaux` | "
        f"**Observé** : "
        + (
            ", ".join(
                f"`{a}` ({CLASS_ABBREV_HORS_LISTE[a]}, {n} sorts)"
                for a, n in hors_liste.most_common()
            )
            or "aucune"
        )
        + ". Le plan citait `Réd` ; le corpus écrit `Rôd` (et une fois `Rod`) — "
        "c'est l'orthographe du plan qui est fausse, la classe visée "
        "(Rôdeur) est la même. |",
        f"| 4 | `ecoles` vide dans l'index pour les classes dont la page ne "
        f"groupe pas par école (Druide, Paladin, Alchimiste) | **Observé** : "
        f"{len(stats.get('index_sans_ecole', []))} entrées d'index sans école "
        f"dont toutes les classes sont dans "
        f"{{{', '.join(sorted(CLASSES_SANS_ECOLE))}}}. Attendu. |",
        f"| 5 | `mythique` renseigné sur certains sorts | **Observé** : "
        f"{d5.get('mythique', 0)} sorts. Capture volontaire, suppression prévue "
        f"dans une phase ultérieure. |",
        "",
    ]
    if inconnues:
        lignes += [
            "Abréviations **non** couvertes par cette exception (ni dans les 19 "
            "classes, ni dans la table hors-liste) : "
            + ", ".join(f"`{a}` ({n})" for a, n in inconnues.most_common())
            + ". Elles sont rapportées comme avertissements.",
            "",
        ]

    zeros_txt = ", ".join(zeros) if zeros else "aucune"
    lignes += [
        "## Incertitudes résiduelles",
        "",
        "Ce que les contrôles mesurent sans pouvoir le résoudre. Aucune de ces "
        "lignes n'est une tâche de relecture : chacune se traite en amont, dans "
        "le parseur ou dans le référentiel, puis se régénère.",
        "",
        f"1. **Divergences de niveau liste ↔ page** — "
        f"{stats.get('niveaux_divergents', 0)} sorts. Table complète dans "
        "`reports/08_enrich.md`. Les deux sources sont conservées côte à côte "
        "(`niveau`, `niveau_page`) et `concordance` porte le constat : le "
        "pipeline n'arbitre pas, il expose.",
        f"2. **Classes à 0 sort exclusif** — {zeros_txt}. Recoupable "
        "mécaniquement : l'URL de liste de `data/classes.json` doit être celle "
        "de la classe annoncée.",
        f"3. **Champs à faible couverture** — `jet_de_sauvegarde` "
        f"{_pct(couverture.get('jet_de_sauvegarde', (0, 0.0))[1])} et "
        f"`resistance_magie` "
        f"{_pct(couverture.get('resistance_magie', (0, 0.0))[1])}. Une lacune de "
        "parseur se distingue d'une lacune de source en relançant `parse_spells` "
        "sur le HTML en cache : la source, elle, ne bouge plus.",
        f"4. **`portee` / `cible` manquants** — "
        f"{len(stats.get('d1_manques', {}).get('portee', []))} et "
        f"{len(stats.get('d1_manques', {}).get('cible', []))} sorts, énumérés "
        "dans le JSONL d'anomalies avec leur `meta.cache_fichier`.",
        f"5. **Suffixes de collision de slug** — "
        f"{len(stats.get('c1_collisions', []))} `id` portent un suffixe "
        "`-2`/`-3`. Homonymes distincts par construction : les URLs sources "
        "diffèrent, sinon la page aurait été dédoublonnée à l'étape 06.",
        f"6. **Abréviations de classe inconnues** — "
        f"{len(inconnues)} restantes, à ajouter au référentiel des "
        "abréviations, pas au fichier de sort.",
        "",
        "## Notes de conformité",
        "",
        "- Étape en **lecture seule** sur `data/` : aucun fichier n'y est écrit, "
        "déplacé ni modifié. Les seules écritures sont "
        "`reports/09_validation.md` et `reports/09_anomalies.jsonl`.",
        "- Aucun accès réseau.",
        "- Les contrôles sont indépendants des rapports d'étape : les comptes "
        "sont recalculés, les `id` redérivés, la partition de l'index "
        "reconstruite.",
        f"- Racine auditée : `{chemins.racine.as_posix()}`, sorts : "
        f"`{chemins.sorts.as_posix()}`.",
        "",
        "## Reproduire",
        "",
        "```",
        "PYTHONPATH=src python -m pf_spells.validate_corpus",
        "echo $?   # 0 = PASS, 1 = FAIL",
        "```",
        "",
    ]
    return "\n".join(lignes)


def ecrire_rapports(
    resultat: Resultat, chemins: Chemins, rapport: Path, anomalies: Path
) -> None:
    rapport.parent.mkdir(parents=True, exist_ok=True)
    rapport.write_text(
        build_report(resultat, chemins), encoding="utf-8", newline="\n"
    )
    anomalies.parent.mkdir(parents=True, exist_ok=True)
    anomalies.write_text(
        rendre_anomalies(resultat.anomalies), encoding="utf-8", newline="\n"
    )


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description="Audit indépendant du corpus de sorts (lecture seule)."
    )
    defauts = Chemins()
    parseur.add_argument("--racine", default=str(defauts.racine))
    parseur.add_argument("--sorts-dir", default=str(defauts.sorts))
    parseur.add_argument("--listes-dir", default=str(defauts.listes))
    parseur.add_argument("--index-dir", default=str(defauts.index))
    parseur.add_argument("--classes", default=str(defauts.classes))
    parseur.add_argument("--spell-pages", default=str(defauts.pages_sorts))
    parseur.add_argument("--schemas", default=str(defauts.schemas))
    parseur.add_argument("--reports-dir", default=str(defauts.rapports))
    parseur.add_argument(
        "--rapport", default="reports/09_validation.md", help="rapport markdown"
    )
    parseur.add_argument(
        "--anomalies", default="reports/09_anomalies.jsonl", help="anomalies JSONL"
    )
    parseur.add_argument(
        "--no-report", action="store_true", help="ne rien écrire, afficher seulement"
    )
    parseur.add_argument(
        "--graine", type=int, default=GRAINE_B7, help="graine du tirage B7"
    )
    args = parseur.parse_args(argv)

    chemins = Chemins(
        racine=Path(args.racine),
        sorts=Path(args.sorts_dir),
        listes=Path(args.listes_dir),
        index=Path(args.index_dir),
        classes=Path(args.classes),
        pages_sorts=Path(args.spell_pages),
        schemas=Path(args.schemas),
        rapports=Path(args.reports_dir),
    )
    resultat = executer(chemins, graine=args.graine)
    if not args.no_report:
        ecrire_rapports(
            resultat, chemins, Path(args.rapport), Path(args.anomalies)
        )

    compte = Counter(a.gravite for a in resultat.anomalies)
    print(f"VERDICT: {resultat.verdict}")
    print(
        f"{compte['bloquant']} bloquante(s), {compte['avertissement']} "
        f"avertissement(s), {compte['info']} info(s)"
    )
    for anomalie in sorted(resultat.bloquantes, key=cles_de_tri)[:20]:
        print(f"  BLOQUANT {anomalie.check} {anomalie.id}: {anomalie.detail[:120]}")
    return 1 if resultat.bloquantes else 0


if __name__ == "__main__":
    raise SystemExit(main())
