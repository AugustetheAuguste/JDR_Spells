"""Récupère la page détaillée de chaque don sur pathfinder-fr.org et produit
Data/dons/feat_details.json.

Le contrat HTML des rubriques est celui figé par
build/feat-detail-and-magic-gating/OUTPUT_vocab_and_markup_calibration.md
(Section A) — ne pas le redéterminer ici.

Découpage des rubriques : **un seul passage de tokenisation**, et non une
batterie de regex indépendantes. Chaque marqueur ``<b>Libellé.</b>`` ouvre une
rubrique qui court jusqu'au marqueur suivant. C'est ce qui garantit qu'aucune
rubrique ne peut être perdue en silence : un libellé inconnu n'est pas ignoré,
il atterrit dans ``rubriques_autres``. L'ancienne version cherchait six
rubriques nommées et laissait tomber tout le reste — elle ne repérait
``Catégorie`` que pour couper la description, puis jetait sa valeur, alors que
c'est le **type officiel du don** (38 % des pages le portent), et elle manquait
la variante ``Conditions requises``.

Trois autres informations de la page, jusqu'ici détruites par ``strip_tags`` :

- ``liens`` — les liens internes du wiki (présents sur 100 % des pages) : sorts,
  compétences, classes, états préjudiciables cités par le don. C'est une couche
  de relations *attestée par la source*, pas devinée.
- ``tableaux`` — extraits en structure. Aplatis dans le texte ils devenaient une
  soupe de nombres (« 0 4 1 6 2 8… ») qui pollue toute lecture en aval.
- les **sauts de paragraphe**, désormais préservés.

``texte_pour_llm`` assemble ces éléments en un texte propre, c'est le champ
destiné à l'étiquetage sémantique par LLM.
"""

import html
import json
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

# Exécutable depuis la racine du dépôt : ce script n'est pas dans le paquet.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pf1_dons import paths

HTML_DIR = Path("feat_pages_html")
LINKS_PATH = Path(paths.FEAT_LINKS)
OUT_PATH = Path(paths.FEAT_DETAILS)
USER_AGENT = "Mozilla/5.0"
REQUEST_DELAY_SECONDS = 0.3

CONTENT_DIV_RE = re.compile(
    r'<div id="PageContentDiv"[^>]*>(.*?)<div id="PageAttachmentsDiv"',
    re.IGNORECASE | re.DOTALL,
)

SOURCE_RE = re.compile(r'title="Source\s*:\s*([^"]+)"', re.IGNORECASE)

# Un marqueur de rubrique est un <b> court, sans balise interne, dont le libellé
# n'est fait que de lettres et d'espaces — le ponctuation finale pouvant être
# à l'intérieur du <b> (« <b>Catégorie :</b> ») ou juste après.
RUBRIC_MARKER_RE = re.compile(
    r"<b>\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ ]{1,38}?)\s*[:.]?\s*</b>\s*[:.]?\s*"
)

TABLE_RE = re.compile(r"<table\b.*?</table>", re.IGNORECASE | re.DOTALL)
CAPTION_RE = re.compile(r"<caption\b[^>]*>(.*?)</caption>", re.IGNORECASE | re.DOTALL)
ROW_RE = re.compile(r"<tr\b.*?</tr>", re.IGNORECASE | re.DOTALL)
CELL_RE = re.compile(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", re.IGNORECASE | re.DOTALL)
LINK_RE = re.compile(
    r'<a\b[^>]*class="pagelink"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
TAG_RE = re.compile(r"<[^>]+>")
# <br><br> et </p> sont des frontières de paragraphe ; un <br> seul, un saut de ligne.
PARA_BREAK_RE = re.compile(r"(?:<br\s*/?>\s*){2,}|</p\s*>", re.IGNORECASE)
LINE_BREAK_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)

# Libellés de rubrique connus, en forme normalisée -> clé de sortie.
# Plusieurs libellés peuvent viser la même clé (singulier/pluriel, variantes).
RUBRIQUES_CONNUES = {
    "categorie": "categorie",
    "categories": "categorie",
    "condition": "conditions_detail",
    "conditions": "conditions_detail",
    "conditions requises": "conditions_detail",
    "condition requise": "conditions_detail",
    "prerequis": "conditions_detail",
    "avantage": "avantages_detail",
    "avantages": "avantages_detail",
    "special": "special",
    "speciale": "special",
    "normal": "normal",
}

# Rubriques qui ouvrent la partie mécanique : tout ce qui précède la première
# d'entre elles est la description narrative.
RUBRIQUES_APRES_DESCRIPTION = {"categorie", "conditions_detail", "avantages_detail"}


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return stripped.lower()


def slug_for_cache(feat_name: str) -> str:
    normalized = _normalize(feat_name)
    slug = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return slug or "unknown"


def strip_tags(text: str) -> str:
    """Texte sur une seule ligne — conservé pour ``raw_text`` et les cellules."""
    cleaned = TAG_RE.sub(" ", text)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def texte_structure(fragment: str) -> str:
    """Comme ``strip_tags``, mais en préservant les frontières de paragraphe.

    Un don dont l'avantage tient en quatre paragraphes (cas courant : la règle,
    puis ses exceptions) devenait un seul bloc où plus rien ne se rattachait à
    rien. Les paragraphes sont séparés par une ligne vide, les ``<br>`` isolés
    par un simple saut de ligne.
    """
    marque_para = "\x00PARA\x00"
    marque_ligne = "\x00LIGNE\x00"
    texte = PARA_BREAK_RE.sub(marque_para, fragment)
    texte = LINE_BREAK_RE.sub(marque_ligne, texte)
    texte = html.unescape(TAG_RE.sub(" ", texte))
    # Espaces réduits d'abord, marqueurs rétablis ensuite : sinon les sauts de
    # ligne qu'on vient de poser seraient à leur tour écrasés.
    lignes = [
        re.sub(r"[ \t]+", " ", bloc).strip()
        for bloc in texte.replace(marque_ligne, "\n").replace(marque_para, "\n\n").split("\n")
    ]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lignes)).strip()


def extraire_tableaux(fragment: str) -> list[dict]:
    """Tableaux en structure : légende, en-têtes, lignes de cellules."""
    tableaux = []
    for brut in TABLE_RE.findall(fragment):
        legende_match = CAPTION_RE.search(brut)
        lignes = [
            [strip_tags(cell) for cell in CELL_RE.findall(ligne)]
            for ligne in ROW_RE.findall(brut)
        ]
        lignes = [ligne for ligne in lignes if any(ligne)]
        if not lignes:
            continue
        tableaux.append(
            {
                "legende": strip_tags(legende_match.group(1)) if legende_match else None,
                "colonnes": lignes[0],
                "lignes": lignes[1:],
            }
        )
    return tableaux


def extraire_liens(fragment: str) -> list[dict]:
    """Liens internes du wiki, dédupliqués, dans l'ordre d'apparition.

    ``cible`` est le nom de page décodé (« Pathfinder-RPG.NLS.ashx » -> « NLS »),
    ``ancre`` la section visée quand il y en a une — c'est elle qui porte le type
    canonique d'un don (``dons.ashx#DONCOMBAT``).
    """
    vus = set()
    liens = []
    for href, interieur in LINK_RE.findall(fragment):
        href = html.unescape(href)
        cible, _, ancre = href.partition("#")
        cible = urllib.request.unquote(cible)
        cible = re.sub(r"^Pathfinder-RPG\.", "", cible)
        cible = re.sub(r"\.ashx$", "", cible, flags=re.IGNORECASE).strip()
        texte = strip_tags(interieur)
        if not cible and not ancre:
            continue
        cle = (cible, ancre, texte)
        if cle in vus:
            continue
        vus.add(cle)
        liens.append({"texte": texte, "cible": cible, "ancre": ancre or None})
    return liens


def decouper_rubriques(content_html: str) -> tuple[str, dict[str, str], dict[str, str]]:
    """Tokenise le contenu en rubriques successives.

    Renvoie ``(description_html, rubriques_connues, rubriques_inconnues)``. Un
    même libellé rencontré deux fois (deux ``Spécial.``, cas attesté) voit ses
    fragments concaténés plutôt qu'écrasés.
    """
    marqueurs = []
    for m in RUBRIC_MARKER_RE.finditer(content_html):
        libelle = re.sub(r"\s+", " ", m.group(1)).strip(" '’")
        marqueurs.append((m.start(), m.end(), libelle, _normalize(libelle)))

    # La description s'arrête au premier marqueur qui ouvre la partie mécanique.
    # Un <b> en gras au fil de la prose narrative ne doit pas la tronquer.
    debut_mecanique = len(content_html)
    for start, _, _, norme in marqueurs:
        if RUBRIQUES_CONNUES.get(norme) in RUBRIQUES_APRES_DESCRIPTION:
            debut_mecanique = start
            break

    connues: dict[str, list[str]] = {}
    inconnues: dict[str, list[str]] = {}
    for i, (start, end, libelle, norme) in enumerate(marqueurs):
        if start < debut_mecanique:
            continue
        fin = marqueurs[i + 1][0] if i + 1 < len(marqueurs) else len(content_html)
        fragment = content_html[end:fin]
        cle = RUBRIQUES_CONNUES.get(norme)
        cible = connues.setdefault(cle, []) if cle else inconnues.setdefault(libelle, [])
        cible.append(fragment)

    def assembler(d: dict[str, list[str]]) -> dict[str, str]:
        out = {}
        for cle, fragments in d.items():
            texte = "\n\n".join(t for t in (texte_structure(f) for f in fragments) if t)
            if texte:
                out[cle] = texte
        return out

    return content_html[:debut_mecanique], assembler(connues), assembler(inconnues)


def normaliser_categorie(texte: str | None, liens: list[dict]) -> list[str]:
    """Type officiel du don, en liste (« combat, spectacle » en donne deux).

    Les ancres des liens de la rubrique (``dons.ashx#DONCOMBAT``) sont la forme
    canonique, mais la rubrique n'est pas toujours liée : on retombe alors sur
    son texte.
    """
    if not texte:
        return []
    parties = [p.strip(" .;") for p in re.split(r"[,;/]| et ", texte) if p.strip(" .;")]
    return sorted({p.lower() for p in parties if p})


def rendre_tableau(tableau: dict) -> str:
    lignes = []
    if tableau["legende"]:
        lignes.append(f"Tableau — {tableau['legende']}")
    lignes.append(" | ".join(tableau["colonnes"]))
    lignes.extend(" | ".join(ligne) for ligne in tableau["lignes"])
    return "\n".join(lignes)


def composer_texte_llm(fiche: dict) -> str:
    """Texte propre et complet d'un don, destiné à l'étiquetage sémantique.

    Rubriques nommées et paragraphes préservés, tableaux rendus lisiblement —
    donc utilisable tel quel dans un prompt, sans nettoyage supplémentaire.
    """
    blocs = []
    if fiche.get("description"):
        blocs.append(fiche["description"])
    for cle, titre in (
        ("categorie", "Catégorie"),
        ("conditions_detail", "Conditions"),
        ("avantages_detail", "Avantage"),
        ("special", "Spécial"),
        ("normal", "Normal"),
    ):
        valeur = fiche.get(cle)
        if valeur:
            blocs.append(f"{titre}. {valeur}")
    for libelle, valeur in (fiche.get("rubriques_autres") or {}).items():
        blocs.append(f"{libelle}. {valeur}")
    for tableau in fiche.get("tableaux") or []:
        blocs.append(rendre_tableau(tableau))
    return "\n\n".join(blocs).strip()


def parse_feat_page(html_text: str, url: str) -> dict:
    content_match = CONTENT_DIV_RE.search(html_text)
    content_html = content_match.group(1) if content_match else html_text

    sources = SOURCE_RE.findall(content_html)
    source_detail = "; ".join(s.strip() for s in sources) if sources else None

    tableaux = extraire_tableaux(content_html)
    liens = extraire_liens(content_html)
    # Les tableaux sont retirés avant le découpage en rubriques : aplatis, ils
    # injecteraient leur soupe de nombres dans la rubrique qui les précède.
    sans_tableaux = TABLE_RE.sub(" ", content_html)

    description_html, connues, inconnues = decouper_rubriques(sans_tableaux)

    fiche = {
        "url": url,
        "source_detail": source_detail,
        "categorie": connues.get("categorie"),
        "categories": normaliser_categorie(connues.get("categorie"), liens),
        "description": texte_structure(description_html) or None,
        "conditions_detail": connues.get("conditions_detail"),
        "avantages_detail": connues.get("avantages_detail"),
        "special": connues.get("special"),
        "normal": connues.get("normal"),
        "rubriques_autres": inconnues or None,
        "tableaux": tableaux or None,
        "liens": liens or None,
        "raw_text": strip_tags(content_html),
        "parse_error": None,
    }
    fiche["texte_pour_llm"] = composer_texte_llm(fiche)
    return fiche


FICHE_VIDE = {
    "url": None,
    "source_detail": None,
    "categorie": None,
    "categories": [],
    "description": None,
    "conditions_detail": None,
    "avantages_detail": None,
    "special": None,
    "normal": None,
    "rubriques_autres": None,
    "tableaux": None,
    "liens": None,
    "raw_text": None,
    "texte_pour_llm": "",
    "parse_error": None,
}


def download_all(links: dict, force: bool = False) -> None:
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    total = len(links)
    for i, (name, url) in enumerate(links.items(), start=1):
        dest = HTML_DIR / f"{slug_for_cache(name)}.html"
        if dest.exists() and not force:
            continue
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req) as resp:
                dest.write_bytes(resp.read())
        except Exception as exc:  # noqa: BLE001 - logué, pas fatal
            print(f"[{i}/{total}] ECHEC telechargement {name!r}: {exc}")
        else:
            print(f"[{i}/{total}] {name}")
        time.sleep(REQUEST_DELAY_SECONDS)


def main() -> None:
    links = json.loads(LINKS_PATH.read_text(encoding="utf-8"))

    download_all(links)

    out: dict = {}
    failures: list[str] = []
    for name, url in links.items():
        dest = HTML_DIR / f"{slug_for_cache(name)}.html"
        try:
            html_text = dest.read_text(encoding="utf-8", errors="replace")
            out[name] = parse_feat_page(html_text, url)
        except Exception as exc:  # noqa: BLE001 - jamais fatal pour tout le run
            failures.append(name)
            out[name] = {**FICHE_VIDE, "url": url, "parse_error": str(exc)}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
    )

    print(f"Dons traités : {len(out)}")
    print(f"Echecs de parsing : {len(failures)}")
    for name in failures:
        print(" -", name)


if __name__ == "__main__":
    main()
