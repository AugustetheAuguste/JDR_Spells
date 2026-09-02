"""Lecteur du registre unifié (`pf_dons.classes_unifiees`). Ne teste pas le
contenu curé du fichier (déjà couvert par `tests/test_classes_unifiees.py`,
côté sorts) mais le comportement du lecteur Python : normalisation, lookup,
et l'indépendance lanceur/liste_sorts que le scalde est censé prouver.
"""

from pf_dons.classes_unifiees import charger_classes, classes_par_liste, get_classe, liste_sorts_de


def test_charge_les_42_classes():
    assert len(charger_classes()) == 42


def test_aucun_lanceur_reste_null_par_oubli():
    # Les 42 slugs du registre sont tous présents dans
    # data/classes/class_caster_info.json (seule « chasseur de vampire », qui
    # n'appartient pas aux 42, y est absente) : le nombre de `lanceur is None`
    # attendu est donc exactement 0. Une classe FUTURE ajoutée aux 42 sans
    # entrée dans class_caster_info.json redeviendrait `None` (jamais
    # `False`) et cette assertion nommerait alors explicitement les classes
    # concernées via ce message, au lieu de laisser passer un oubli silencieux.
    classes_absentes_du_registre_mais_null = [
        c.slug for c in charger_classes().values() if c.lanceur is None
    ]
    assert classes_absentes_du_registre_mais_null == []


def test_scalde_lanceur_sans_liste_de_sorts():
    scalde = charger_classes()["scalde"]
    assert scalde.lanceur is True
    assert scalde.liste_sorts is None


def test_lanceur_independant_de_liste_sorts():
    # Le scalde : lanceur=True, liste_sorts=None.
    scalde = charger_classes()["scalde"]
    assert scalde.lanceur is True and scalde.liste_sorts is None
    # Le magicien : lanceur=True, liste_sorts non nul. Si lanceur était
    # dérivé de liste_sorts, ces deux cas ne pourraient pas coexister avec
    # des liste_sorts aussi différents (None vs une valeur) pour la même
    # valeur de lanceur : la variation est bien indépendante.
    magicien = charger_classes()["magicien"]
    assert magicien.lanceur is True and magicien.liste_sorts is not None


def test_get_classe_insensible_aux_accents_et_a_la_casse():
    reference = get_classe("pretre combattant")
    assert reference is not None
    assert get_classe("Prêtre combattant") == reference
    assert get_classe("PRÊTRE COMBATTANT") == reference


def test_get_classe_inconnue_renvoie_none():
    assert get_classe("classe qui n'existe pas") is None


def test_liste_sorts_de():
    assert liste_sorts_de("Magicien") == "arcaniste-ensorceleur-magicien"
    assert liste_sorts_de("Guerrier") is None


def test_classes_par_liste_couvre_les_19_listes():
    regroupement = classes_par_liste()
    assert len(regroupement) == 19


def test_classes_par_liste_arcaniste_ensorceleur_magicien():
    regroupement = classes_par_liste()
    assert set(regroupement["arcaniste-ensorceleur-magicien"]) == {
        "arcaniste",
        "ensorceleur",
        "magicien",
    }
