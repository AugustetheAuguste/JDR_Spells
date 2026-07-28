"""Unit tests for the unique-spell index builder plus checks on its output."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pytest

from pf_spells import build_index

ROSTER = [
    {"classe": "Druide", "slug": "druide"},
    {"classe": "Barde", "slug": "barde"},
    {"classe": "Paladin", "slug": "paladin"},
]


def entree(sid, nom, classe, niveau, *, url=None, ecole=None, sources=None):
    return {
        "id": sid,
        "nom": nom,
        "url": url or f"https://example.test/{sid}",
        "classe": classe,
        "niveau": niveau,
        "ecole": ecole,
        "description_courte": "",
        "sources": sources or [],
        "ligne_html": "",
    }


def ecrire_corpus(tmp_path: Path, par_classe: dict[str, list[dict]]) -> tuple[Path, Path]:
    classes = tmp_path / "classes.json"
    classes.write_text(json.dumps(ROSTER, ensure_ascii=False), encoding="utf-8")
    listes = tmp_path / "listes_classes"
    listes.mkdir()
    slug = {c["classe"]: c["slug"] for c in ROSTER}
    for classe, lignes in par_classe.items():
        chemin = listes / f"{slug[classe]}.jsonl"
        with chemin.open("w", encoding="utf-8", newline="\n") as f:
            for ligne in lignes:
                f.write(json.dumps(ligne, ensure_ascii=False) + "\n")
    return classes, listes


def lancer(tmp_path: Path, par_classe: dict[str, list[dict]]):
    classes, listes = ecrire_corpus(tmp_path, par_classe)
    out = tmp_path / "index"
    resume = build_index.run(classes, listes, out, tmp_path / "rapport.md")
    uniques = [
        json.loads(l)
        for l in (out / "sorts_uniques.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    carte = json.loads((out / "carte_doublons.json").read_text(encoding="utf-8"))
    excl = json.loads((out / "sorts_exclusifs.json").read_text(encoding="utf-8"))
    return resume, uniques, carte, excl, out


# --- unit level -------------------------------------------------------------


def test_bijection_nom_vers_plusieurs_ids_bloque():
    with pytest.raises(build_index.IntegrityError, match="bijection"):
        build_index.check_bijection([entree("a", "Feu", "Druide", 1), entree("b", "Feu", "Barde", 1)])


def test_bijection_id_vers_plusieurs_noms_bloque():
    with pytest.raises(build_index.IntegrityError, match="bijection"):
        build_index.check_bijection([entree("a", "Feu", "Druide", 1), entree("a", "Eau", "Barde", 1)])


def test_classe_hors_roster_bloque():
    labels = {c["classe"]: c["slug"] for c in ROSTER}
    with pytest.raises(build_index.IntegrityError, match="absentes"):
        build_index.check_roster([entree("a", "Feu", "Moine", 1)], labels)


def test_agregation_partage_et_bornes_de_niveau():
    labels = {c["classe"]: c["slug"] for c in ROSTER}
    uniques, anomalies = build_index.aggregate(
        [
            entree("feu", "Feu", "Druide", 3, ecole="Évocation", sources=["RSE"]),
            entree("feu", "Feu", "Barde", 1, sources=["AM"]),
        ],
        labels,
    )
    u = uniques["feu"]
    assert u["nb_classes"] == 2
    assert u["partage"] is True
    assert (u["niveau_min"], u["niveau_max"]) == (1, 3)
    assert u["ecoles"] == ["Évocation"]
    assert u["sources"] == ["AM", "RSE"]
    # classes sorted by label, not by insertion order
    assert [c["classe"] for c in u["classes"]] == ["Barde", "Druide"]
    assert anomalies == {"doublons_intra_classe": [], "desaccords_url": []}


def test_doublon_intra_classe_garde_le_niveau_le_plus_bas():
    labels = {c["classe"]: c["slug"] for c in ROSTER}
    uniques, anomalies = build_index.aggregate(
        [entree("feu", "Feu", "Druide", 4), entree("feu", "Feu", "Druide", 2)], labels
    )
    assert uniques["feu"]["classes"] == [{"classe": "Druide", "slug": "druide", "niveau": 2}]
    assert uniques["feu"]["nb_classes"] == 1
    (anomalie,) = anomalies["doublons_intra_classe"]
    assert anomalie["niveaux"] == [2, 4]
    assert anomalie["conserve"] == 2


def test_repetition_identique_nest_pas_une_anomalie():
    labels = {c["classe"]: c["slug"] for c in ROSTER}
    uniques, anomalies = build_index.aggregate(
        [entree("feu", "Feu", "Druide", 2), entree("feu", "Feu", "Druide", 2)], labels
    )
    assert uniques["feu"]["nb_classes"] == 1
    assert anomalies["doublons_intra_classe"] == []


def test_desaccord_url_signale_et_majorite_conservee():
    labels = {c["classe"]: c["slug"] for c in ROSTER}
    uniques, anomalies = build_index.aggregate(
        [
            entree("feu", "Feu", "Druide", 1, url="https://a.test/x"),
            entree("feu", "Feu", "Barde", 1, url="https://a.test/x"),
            entree("feu", "Feu", "Paladin", 1, url="https://b.test/x"),
        ],
        labels,
    )
    assert uniques["feu"]["url"] == "https://a.test/x"
    (d,) = anomalies["desaccords_url"]
    assert d["urls"] == {"https://a.test/x": 2, "https://b.test/x": 1}


# --- end to end on a synthetic corpus --------------------------------------


def test_bout_en_bout(tmp_path: Path):
    resume, uniques, carte, excl, _ = lancer(
        tmp_path,
        {
            "Druide": [entree("feu", "Feu", "Druide", 3), entree("ronce", "Ronce", "Druide", 1)],
            "Barde": [entree("feu", "Feu", "Barde", 1), entree("chant", "Chant", "Barde", 2)],
            "Paladin": [entree("feu", "Feu", "Paladin", 2)],
        },
    )
    assert resume["nb_uniques"] == 3
    assert resume["nb_partages"] == 1
    assert resume["nb_exclusifs"] == 2
    # JSONL sorted by id, full contract key set on every line
    assert [u["id"] for u in uniques] == ["chant", "feu", "ronce"]
    for u in uniques:
        assert list(u) == list(build_index.KEY_ORDER)
    # partition
    assert carte["nb_sorts_partages"] + resume["nb_exclusifs"] == carte["nb_sorts_uniques"]
    assert set(carte["sorts_partages"]) == {"feu"}
    assert carte["distribution_partage"] == {"1": 2, "3": 1}
    # level divergence detected
    (div,) = carte["niveaux_divergents"]
    assert div["classes"] == {"Barde": 1, "Druide": 3, "Paladin": 2}
    # all roster classes are keys, including ones with zero exclusives
    assert set(excl["par_classe"]) == {"Druide", "Barde", "Paladin"}
    assert excl["totaux"] == {"Druide": 1, "Barde": 1, "Paladin": 0}
    assert excl["par_classe"]["Paladin"]["sorts"] == []


def test_determinisme_hors_genere_le(tmp_path: Path):
    corpus = {
        "Druide": [entree("feu", "Feu", "Druide", 3)],
        "Barde": [entree("feu", "Feu", "Barde", 1), entree("chant", "Chant", "Barde", 2)],
    }
    classes, listes = ecrire_corpus(tmp_path, corpus)
    out = tmp_path / "index"
    build_index.run(classes, listes, out, tmp_path / "r.md")
    premier = (out / "sorts_uniques.jsonl").read_bytes()
    carte1 = json.loads((out / "carte_doublons.json").read_text(encoding="utf-8"))
    build_index.run(classes, listes, out, tmp_path / "r.md")
    assert (out / "sorts_uniques.jsonl").read_bytes() == premier
    carte2 = json.loads((out / "carte_doublons.json").read_text(encoding="utf-8"))
    carte1.pop("genere_le"), carte2.pop("genere_le")
    assert carte1 == carte2


def test_formats_de_sortie(tmp_path: Path):
    _, _, _, _, out = lancer(tmp_path, {"Druide": [entree("feu", "Feu", "Druide", 1)]})
    brut = (out / "sorts_uniques.jsonl").read_bytes()
    assert b"\r\n" not in brut and brut.endswith(b"\n")
    assert b'", "' not in brut  # compact separators
    assert not brut.startswith(b"\xef\xbb\xbf")  # no BOM
    json_brut = (out / "carte_doublons.json").read_bytes()
    assert b"\r\n" not in json_brut and json_brut.endswith(b"\n")
    assert b'\n  "genere_le"' in json_brut  # indent=2


def test_accents_preserves_dans_les_valeurs(tmp_path: Path):
    _, uniques, _, _, out = lancer(
        tmp_path, {"Druide": [entree("m", "Métamorphose", "Druide", 4, ecole="Évocation")]}
    )
    assert uniques[0]["nom"] == "Métamorphose"
    assert "Métamorphose" in (out / "sorts_uniques.jsonl").read_text(encoding="utf-8")


def test_repertoire_vide_bloque(tmp_path: Path):
    classes, listes = ecrire_corpus(tmp_path, {})
    with pytest.raises(build_index.IntegrityError, match="aucune entrée"):
        build_index.run(classes, listes, tmp_path / "index", tmp_path / "r.md")


def test_no_network_no_html_dependency():
    source = Path(build_index.__file__).read_text(encoding="utf-8")
    for interdit in ("requests", "httpx", "BeautifulSoup", "bs4", "lxml"):
        assert interdit not in source


# --- checks on the committed corpus output ---------------------------------


@pytest.fixture(scope="module")
def corpus(repo_root: Path):
    index = repo_root / "data" / "index" / "sorts_uniques.jsonl"
    if not index.exists():
        pytest.skip("index non généré")
    uniques = [
        json.loads(l) for l in index.read_text(encoding="utf-8").splitlines() if l.strip()
    ]
    carte = json.loads(
        (repo_root / "data" / "index" / "carte_doublons.json").read_text(encoding="utf-8")
    )
    excl = json.loads(
        (repo_root / "data" / "index" / "sorts_exclusifs.json").read_text(encoding="utf-8")
    )
    roster = json.loads((repo_root / "data" / "classes.json").read_text(encoding="utf-8"))
    entrees = []
    for f in sorted((repo_root / "data" / "listes_classes").glob("*.jsonl")):
        entrees += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
    return uniques, carte, excl, roster, entrees


def test_corpus_compte_egale_les_ids_distincts(corpus):
    uniques, carte, _, _, entrees = corpus
    assert len(uniques) == len({e["id"] for e in entrees})
    assert carte["nb_sorts_uniques"] == len(uniques)
    assert len(uniques) < len(entrees)


def test_corpus_partition_exacte(corpus):
    uniques, carte, excl, _, _ = corpus
    seuls = [u for u in uniques if u["nb_classes"] == 1]
    assert carte["nb_sorts_partages"] + len(seuls) == len(uniques)
    assert sum(excl["totaux"].values()) == len(seuls)
    partages = set(carte["sorts_partages"])
    exclusifs = {s["id"] for b in excl["par_classe"].values() for s in b["sorts"]}
    assert partages.isdisjoint(exclusifs)
    assert partages | exclusifs == {u["id"] for u in uniques}


def test_corpus_aller_retour_classe_niveau(corpus):
    uniques, _, _, _, entrees = corpus
    attendu: dict[str, dict[str, int]] = defaultdict(dict)
    for e in entrees:
        courant = attendu[e["id"]].get(e["classe"])
        attendu[e["id"]][e["classe"]] = e["niveau"] if courant is None else min(courant, e["niveau"])
    for u in uniques:
        assert {c["classe"]: c["niveau"] for c in u["classes"]} == attendu[u["id"]]


def test_corpus_classes_toutes_du_roster(corpus):
    uniques, carte, excl, roster, _ = corpus
    labels = {c["classe"] for c in roster}
    slugs = {c["classe"]: c["slug"] for c in roster}
    assert len(labels) == 19
    for u in uniques:
        for c in u["classes"]:
            assert c["classe"] in labels
            assert c["slug"] == slugs[c["classe"]]
    for bloc in carte["sorts_partages"].values():
        assert set(bloc["classes"]) <= labels
    assert set(excl["par_classe"]) == labels


def test_corpus_niveaux_divergents_reels(corpus):
    _, carte, _, _, entrees = corpus
    assert carte["niveaux_divergents"]
    par_id = defaultdict(list)
    for e in entrees:
        par_id[e["id"]].append(e["niveau"])
    for d in carte["niveaux_divergents"]:
        assert len(set(d["classes"].values())) > 1
        assert len(set(par_id[d["id"]])) > 1


def test_corpus_jsonl_trie_et_cles_completes(corpus):
    uniques, _, _, _, _ = corpus
    assert [u["id"] for u in uniques] == sorted(u["id"] for u in uniques)
    for u in uniques:
        assert list(u) == list(build_index.KEY_ORDER)
        assert u["partage"] == (u["nb_classes"] > 1)
        niveaux = [c["niveau"] for c in u["classes"]]
        assert u["niveau_min"] == min(niveaux) and u["niveau_max"] == max(niveaux)
        assert [c["classe"] for c in u["classes"]] == sorted(c["classe"] for c in u["classes"])
