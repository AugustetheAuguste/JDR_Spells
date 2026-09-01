from pf1_dons.class_progression import get_bba


def test_guerrier_niveau_10():
    assert get_bba("Guerrier", 10) == 10


def test_magicien_niveau_10():
    assert get_bba("Magicien", 10) == 5


def test_roublard_niveau_10():
    assert get_bba("Roublard", 10) == 7
