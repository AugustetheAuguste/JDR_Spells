"""Stage 08: turn each spell into a complete, ready-to-send prompt on disk.

Strictly offline. Separating assembly from sending is what makes the paid run
auditable *before* it costs anything: the prompts are diffable, replayable, and
priceable by `tools/estimate_cost.py` without a single API call. Nothing here
touches the network, and nothing here writes under `data/`.

Three things this module gets deliberately right:

**The system prompt is identical for every spell.** It carries the schema summary,
the closed vocabularies and the rules; the per-spell text goes in the user
message. That is not tidiness — it is what makes prompt caching work. Over ~2 070
spells it is the single largest cost lever available on the on-demand path, and it
evaporates the moment anything spell-specific is injected into the system block.
Do not put the spell there.

**Caching has a floor, and it fails silently.** Haiku will not cache a prefix
shorter than 4 096 tokens: below it, `cachePoint` is accepted, ignored, and the run
simply costs double with no error anywhere. Measured on `bedrock-runtime`
2026-07-30: `p1.0` sat at ~3 216 tokens and reported `cacheWriteInputTokens: 0` on
every call; from `p1.1` on the block writes, then reads, in full. Shortening this
block is therefore a *cost* decision, not an editorial one —
`test_le_bloc_systeme_reste_cacheable` guards the floor.

**The vocabularies are read, never retyped.** Tags, categories, damage types and
conditions come from `conventions/vocabulaires/*.json` at assembly time, with
their definitions and examples. A list duplicated into a prompt template would
drift from the schema that validates against it, and the drift would show up as
mysterious rejections at stage 10.

**Resume is keyed on `hash_source`, not on file presence.** A prompt whose spell
text has not changed is left untouched; one whose text moved is rebuilt. This is
the same key stage 09 and stage 10 use, so "is this artefact current?" has one
answer everywhere.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from pf_spells.enrichissement_schema import (
    VOCABULAIRES,
    charger_vocabulaire,
    etiquette_taxonomie,
)
from pf_spells.texte_source import hash_source, texte_source_canonique

prepare_prompts_version = "1.0.0"

DEFAULT_RACINE = "."
DEFAULT_SORTIE = "build_artifacts/prompts"

# Bumped whenever the assembled text changes in a way that would change answers.
# It is part of the output PATH, not just the content: `p1.0` and `p1.1` must be
# able to sit side by side and be diffed, because tuning means several re-runs.
VERSION_PROMPT = "p1.5"

# Ceiling for one enrichment record. The answer is a small fixed-shape JSON
# object; this leaves room for a verbose `notes_ambiguite` without inviting prose.
MAX_TOKENS = 1024

FICHIER_MANIFESTE = "_manifeste.json"

# The closed lists whose definitions are spelled out in the system prompt, and the
# key each fills in the answer. Read from disk — never written here.
VOCABULAIRES_DU_PROMPT: tuple[tuple[str, str], ...] = (
    ("categorie_principale", "categories.json"),
    ("tags", "tags.json"),
    ("roles_tactiques", "roles_tactiques.json"),
    ("cible_typique", "cibles.json"),
    ("type_degats", "types_degats.json"),
    ("condition_infligee", "conditions.json"),
)

# The eleven keys the model is asked to produce. The six provenance fields
# (`version_prompt`, `version_taxonomie`, `modele`, `genere_le`, `hash_source`,
# plus `slug`) are added by stage 09 and are NOT requested here: asking the model
# for its own model id or a timestamp invites it to invent both.
CHAMPS_DEMANDES: tuple[tuple[str, str], ...] = (
    ("id", "l'identifiant fourni, recopié tel quel"),
    ("resume_court", "une seule phrase, 160 caractères maximum"),
    (
        "categorie_principale",
        "une seule valeur de la liste `categorie_principale` — jamais un tag",
    ),
    ("tags", "de 2 à 6 valeurs distinctes de la liste `tags`, 6 au maximum"),
    (
        "roles_tactiques",
        "de 1 à 3 valeurs de la liste `roles_tactiques`, qui n'en compte que 4",
    ),
    ("cible_typique", "une seule valeur de la liste `cible_typique`"),
    ("type_degats", "une valeur de la liste `type_degats`, ou null"),
    ("condition_infligee", "de 0 à 4 valeurs de la liste `condition_infligee`"),
    (
        "preuves",
        "un objet {type_degats, condition_infligee, cible_typique}. "
        "`preuves.type_degats` : une chaîne, ou null si type_degats est null. "
        "`preuves.condition_infligee` : un TABLEAU de chaînes, une par condition "
        "retenue, dans le même ordre — tableau vide `[]` si condition_infligee est "
        "vide. Jamais une chaîne, jamais null. "
        "`preuves.cible_typique` : une chaîne, toujours présente. "
        "Chaque chaîne est la sous-chaîne EXACTE du texte qui justifie ta valeur",
    ),
    ("notes_ambiguite", "une phrase si tu as hésité, sinon null"),
)

REGLES: tuple[str, ...] = (
    "Le texte fourni est ta SEULE source.",
    "Toute affirmation que ce texte ne soutient pas est omise, jamais devinée.",
    "N'utilise aucune connaissance externe de Pathfinder, ni du SRD anglais, ni "
    "d'un nom anglais de sort.",
    "Pour type_degats, condition_infligee et cible_typique, recopie dans "
    "`preuves` la sous-chaîne EXACTE du texte qui justifie la valeur : sans "
    "reformuler, sans paraphraser, sans corriger les accents ni les espaces.",
    "Si le texte ne justifie pas type_degats, écris null et mets null dans "
    "`preuves.type_degats`. Une valeur sans preuve est un rejet.",
    "`condition_infligee` et `preuves.condition_infligee` sont deux TABLEAUX de "
    "même longueur : la n-ième preuve justifie la n-ième condition. Aucune "
    "condition retenue ⇒ les deux valent `[]`.",
    "Chaque valeur est recopiée CARACTÈRE POUR CARACTÈRE depuis la liste close du "
    "champ qu'elle remplit. Les clés sont sans accent et en snake_case : un mot "
    "français juste mais absent de la liste (`fievreuse`, `degats`) invalide tout "
    "l'enregistrement. Ne forge jamais de clé nouvelle.",
    "Chaque liste n'appartient qu'à SON champ, dans LES DEUX SENS. Les six listes ne "
    "sont pas un vocabulaire commun : `allie` est une cible et n'est pas un tag ; "
    "`social` est un rôle et n'est pas un tag. Avant d'écrire une valeur, retrouve-la "
    "dans la liste de CE champ précis, et nulle part ailleurs.",
    "Certaines listes contiennent des clés PROCHES sans être identiques : une clé de "
    "tag et une clé de catégorie peuvent désigner la même idée sous deux noms. Ce "
    "n'est pas une invitation à les échanger — la valeur écrite doit figurer, "
    "littéralement, dans la liste du champ qu'elle remplit.",
    "Respecte les cardinalités : `tags` de 2 à 6 valeurs — 7 est un rejet, coupe aux "
    "6 plus pertinentes ; `roles_tactiques` de 1 à 3 ; `condition_infligee` de 0 à 4.",
    "Si aucune clé de `categorie_principale` ne nomme le procédé du sort, classe-le "
    "par son EFFET sur le sujet — y gagne-t-il, y perd-il, est-il gêné, ou est-ce un "
    "simple outil ? — et porte le procédé dans les tags. N'invente jamais de "
    "catégorie, et ne rends jamais l'enregistrement incomplet pour autant.",
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, "
    "sans bloc de code.",
)

# Two worked examples, on spells that DO NOT EXIST. The names are invented on
# purpose: the system block must not contain a corpus spell name, or the model may
# carry an annotation from the example over to the record actually being judged.
#
# They earn their tokens twice. First, the shape: the 20-record trial run of
# 2026-07-30 quarantined 6 records, and half of those wrote a bare string into
# `preuves.condition_infligee` where the schema demands an array — prose describing
# the shape had not sufficed, an example showing it is unambiguous. Second, the
# threshold: Haiku only caches a prefix of 4096 tokens or more, and the block sat at
# ~3216, so `cachePoint` was silently a no-op and the pass cost double. Padding for
# the sole purpose of crossing that line would be indefensible; two examples that
# fix the observed failures and happen to cross it are not.
EXEMPLES: tuple[tuple[str, str, dict[str, Any]], ...] = (
    (
        "Exemple 1 — un sort offensif, avec dégâts et une condition",
        "Flamme du sourcier : un trait de feu jaillit de la main du personnage vers "
        "une créature située à portée courte. La cible subit 1d6 points de dégâts "
        "de feu par niveau de lanceur de sorts (maximum 10d6) et doit réussir un "
        "jet de Réflexes, sans quoi elle est éblouie pendant 1 round.",
        {
            "id": "exemple-un",
            "resume_court": (
                "Un trait de feu qui blesse une créature à portée courte et peut "
                "l'éblouir."
            ),
            "categorie_principale": "attaque_directe",
            "tags": ["degats_directs", "rayon_ou_projectile", "jet_de_sauvegarde"],
            "roles_tactiques": ["combat"],
            "cible_typique": "ennemi",
            "type_degats": "feu",
            "condition_infligee": ["ebloui"],
            "preuves": {
                "type_degats": "points de dégâts de feu",
                "condition_infligee": ["elle est éblouie pendant 1 round"],
                "cible_typique": "vers une créature située à portée courte",
            },
            "notes_ambiguite": None,
        },
    ),
    (
        "Exemple 2 — un sort utilitaire : ni dégâts, ni condition",
        "Lueur du cartographe : pendant 10 minutes par niveau, le personnage "
        "perçoit l'orientation exacte des galeries qu'il a déjà parcourues et ne "
        "peut pas se perdre sous terre.",
        {
            "id": "exemple-deux",
            "resume_court": (
                "Le lanceur retient l'orientation des galeries parcourues et ne se "
                "perd plus sous terre."
            ),
            "categorie_principale": "utilitaire",
            "tags": ["perception_amelioree", "duree_prolongee"],
            "roles_tactiques": ["exploration"],
            "cible_typique": "soi",
            "type_degats": None,
            "condition_infligee": [],
            "preuves": {
                "type_degats": None,
                "condition_infligee": [],
                "cible_typique": "le personnage perçoit",
            },
            "notes_ambiguite": None,
        },
    ),
)

_REMPLACEMENT = chr(0xFFFD)


class PreparePromptsError(RuntimeError):
    """A blocking condition: the prompts would be wrong, so none are written."""


# The four rejections actually observed on the p1.0 trial run of 2026-07-30, shown
# wrong-then-right. Named failures are what the model can check its own draft
# against; an abstract rule it has already read once is not.
ERREURS_A_EVITER = """Erreurs constatées, à ne pas reproduire :

1. `preuves.condition_infligee` en chaîne ou en null.
   FAUX : "preuves": {"condition_infligee": "la cible est aveuglée"}
   FAUX : "preuves": {"condition_infligee": null}
   JUSTE : "preuves": {"condition_infligee": ["la cible est aveuglée"]}
   JUSTE, si aucune condition : "preuves": {"condition_infligee": []}

2. Une valeur prise dans la liste d'un AUTRE champ. C'est l'erreur la plus
   fréquente, et elle va dans les deux sens.
   FAUX : "tags": ["allie"] — `allie` est une valeur de `cible_typique`.
   FAUX : "tags": ["social"] — `social` est un rôle tactique.
   FAUX : "categorie_principale": "transformation_du_sujet" — c'est un TAG.
   FAUX : "categorie_principale": "charme_ou_coercition" — c'est un TAG.
   FAUX : "categorie_principale": "dissipation_ou_contresort" — c'est un TAG.
   FAUX : "roles_tactiques": ["deplacement"] — `deplacement` est une catégorie.
   FAUX : "roles_tactiques": ["controle"] — n'existe dans aucune liste.
   JUSTE : la catégorie vient de la liste `categorie_principale`, et
   `transformation_du_sujet` reste dans `tags`.
   `categorie_principale` ne peut valoir que l'une des 12 clés de SA liste, et
   `roles_tactiques` que l'une des 4 clés de la sienne.

3. Trop de valeurs.
   FAUX : 7 tags — la borne est 6, et le dépassement rejette tout
   l'enregistrement. Garde les 6 plus pertinentes.

4. Un mot français inventé, hors liste.
   FAUX : "condition_infligee": ["fievreuse"] — absent de la liste.
   JUSTE : la clé la plus proche de la liste, avec une note dans notes_ambiguite.

5. Une preuve reformulée.
   FAUX : preuve "dégâts de feu" quand le texte porte « dégats de feu ».
   JUSTE : la sous-chaîne copiée telle quelle, fautes et accents de la source
   compris — la preuve est vérifiée par recherche littérale dans le texte."""


def _lire_json(chemin: Path) -> Any:
    texte = chemin.read_text(encoding="utf-8")
    if _REMPLACEMENT in texte:
        raise PreparePromptsError(f"U+FFFD dans {chemin} : corruption d'encodage")
    return json.loads(texte)


def verifier_taxonomie_gelee(racine: Path) -> str:
    """Entry guard: refuse to assemble prompts around a placeholder taxonomy.

    `tags.json` still at `v0` means step 04 is not merged in this tree. Prompts
    built on the provisional list would look perfectly valid, cost a full paid run,
    and produce tags the frozen schema then rejects wholesale — a failure that is
    cheap to prevent here and expensive to diagnose at stage 10.

    The returned label is the *highest* version across all six closed lists, not
    `tags.json` alone: widening `categories.json` to v2 changes what an answer may
    legally contain, so two passes run against different lists must not both claim
    the same `version_taxonomie` — that provenance is the only thing that tells a
    v1 record from a v2 one once they sit side by side in `data/enrichissements/`.
    """
    doc = _lire_json(racine / "conventions" / "vocabulaires" / "tags.json")
    version = doc.get("version")
    if version == "v0":
        raise PreparePromptsError(
            "conventions/vocabulaires/tags.json est encore en version v0 : la "
            "taxonomie n'est pas gelée (étape 04 non fusionnée). Aucun prompt "
            "n'est assemblé — ils seraient bâtis sur une liste provisoire."
        )
    if not version:
        raise PreparePromptsError("tags.json sans clé `version`")
    try:
        return etiquette_taxonomie(racine)
    except ValueError as exc:
        raise PreparePromptsError(str(exc)) from exc


def charger_ids(racine: Path) -> list[str]:
    """The corpus ids, from the index, sorted.

    The index is the authority on "which spells exist"; globbing `data/sorts/`
    would silently include a stray file. Sorted so a `--limit` run covers a
    predictable prefix rather than whatever order the filesystem offers.
    """
    chemin = racine / "data" / "index" / "sorts_uniques.jsonl"
    if not chemin.is_file():
        raise PreparePromptsError(f"index absent : {chemin}")
    ids: set[str] = set()
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if ligne.strip():
            ids.add(json.loads(ligne)["id"])
    if not ids:
        raise PreparePromptsError(f"index vide : {chemin}")
    return sorted(ids)


def _bloc_vocabulaire(racine: Path, nom_champ: str, nom_fichier: str) -> str:
    """Render one closed list with its definitions, read from disk.

    Definitions are included, not just keys: a bare key list makes the model guess
    what `effet_mental` means, and it guesses from English priors. The negative
    examples are omitted here on purpose — they are spell names, and naming other
    spells in the system prompt invites cross-contamination between records.
    """
    doc = _lire_json(racine / "conventions" / "vocabulaires" / nom_fichier)
    lignes = [f"Liste `{nom_champ}` (valeurs admissibles, closes) :"]
    for entree in doc["valeurs"]:
        definition = " ".join(str(entree["definition_fr"]).split())
        lignes.append(f"- `{entree['cle']}` : {definition}")
    return "\n".join(lignes)


def construire_systeme(racine: Path) -> str:
    """Build the system prompt: identical for every spell, hence cacheable.

    Nothing spell-specific may enter this string. See the module docstring: this
    block is what prompt caching amortises across the whole corpus.
    """
    parties: list[str] = [
        "Tu annotes des sorts du jeu de rôle Pathfinder 1e, en français, à "
        "partir du seul texte qu'on te donne.",
        "",
        "Règles, dans cet ordre de priorité :",
        *(f"{n}. {regle}" for n, regle in enumerate(REGLES, start=1)),
        "",
        "Champs attendus dans l'objet JSON, tous obligatoires :",
        *(f"- `{cle}` : {desc}" for cle, desc in CHAMPS_DEMANDES),
        "",
        "Les listes closes ci-dessous sont les seules valeurs admissibles. Une "
        "valeur hors liste rend l'enregistrement invalide.",
    ]
    for nom_champ, nom_fichier in VOCABULAIRES_DU_PROMPT:
        parties.append("")
        parties.append(_bloc_vocabulaire(racine, nom_champ, nom_fichier))
    # Examples come last, after the lists: they are read as a shape to imitate, and
    # imitating a shape whose vocabulary has not yet been read produces guesses.
    parties.append("")
    parties.append(
        "Exemples de réponses attendues. Ces deux sorts sont inventés et "
        "n'appartiennent pas au corpus : n'en réutilise ni le nom, ni les valeurs — "
        "seule la FORME est à imiter."
    )
    for titre, texte, reponse in EXEMPLES:
        parties.append("")
        parties.append(titre)
        parties.append(f"Texte fourni : {texte}")
        parties.append("Réponse :")
        parties.append(json.dumps(reponse, ensure_ascii=False, indent=2))
    parties.append("")
    parties.append(ERREURS_A_EVITER)
    return "\n".join(parties)


def construire_utilisateur(sid: str, texte: str) -> str:
    """The per-spell message: the id to echo, and the canonical text, delimited.

    The delimiters matter: the model is asked for exact substrings, and a fence
    makes "the text" unambiguous — quoting the instructions instead of the spell
    is a failure mode that fences prevent.
    """
    return f"id: {sid}\n\n--- DÉBUT DU TEXTE ---\n{texte}\n--- FIN DU TEXTE ---"


def assembler(
    racine: Path,
    sid: str,
    systeme: str,
    version_taxonomie: str,
    version_prompt: str = VERSION_PROMPT,
) -> dict[str, Any]:
    """Build one prompt record. Pure: no writing, no network."""
    chemin = racine / "data" / "sorts" / f"{sid}.json"
    if not chemin.is_file():
        raise PreparePromptsError(f"sort de l'index sans fichier : {chemin}")
    sort = _lire_json(chemin)
    texte = texte_source_canonique(sort)
    return {
        "id": sid,
        "slug": sort["id"],
        "hash_source": hash_source(texte),
        "version_prompt": version_prompt,
        "version_taxonomie": version_taxonomie,
        "systeme": systeme,
        "utilisateur": construire_utilisateur(sid, texte),
        "max_tokens": MAX_TOKENS,
    }


def serialiser(document: Any) -> str:
    return json.dumps(document, ensure_ascii=False, indent=2) + "\n"


def ecrire(document: Any, chemin: Path) -> Path:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(serialiser(document), encoding="utf-8", newline="\n")
    return chemin


def run(
    racine: str | Path = DEFAULT_RACINE,
    sortie: str | Path = DEFAULT_SORTIE,
    *,
    racine_conventions: str | Path | None = None,
    version_prompt: str = VERSION_PROMPT,
    limite: int | None = None,
    seulement: list[str] | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Assemble the prompts and the manifest. Offline; writes only under `sortie`.

    Two roots, deliberately separable. `racine` is where the *corpus* lives, and
    `tests/fixtures/mini_corpus` is a drop-in for it. `racine_conventions` is where
    the closed vocabularies live, and the fixture has none of its own — they are
    repo-level artefacts, frozen, shared by every root. Defaulting the second to
    the first would make the fixture need a copy of the taxonomy, which is exactly
    the duplication `conventions/vocabulaires/` exists to prevent.

    `sortie` gains a `<version_prompt>/` level so several prompt versions coexist.
    """
    racine = Path(racine)
    conventions = Path(racine_conventions) if racine_conventions is not None else Path(".")
    base = Path(sortie)
    if not base.is_absolute():
        base = racine / base
    repertoire = base / version_prompt

    version_taxonomie = verifier_taxonomie_gelee(conventions)
    ids = charger_ids(racine)
    if seulement:
        inconnus = sorted(set(seulement) - set(ids))
        if inconnus:
            raise PreparePromptsError(f"--only hors de l'index : {inconnus}")
        ids = [sid for sid in ids if sid in set(seulement)]
    if limite is not None:
        ids = ids[:limite]

    systeme = construire_systeme(conventions)
    resume: dict[str, Any] = {
        "demandes": len(ids),
        "ecrits": 0,
        "inchanges": 0,
        "version_prompt": version_prompt,
        "version_taxonomie": version_taxonomie,
        "repertoire": repertoire.as_posix(),
        "hashs": {},
    }

    for sid in ids:
        enregistrement = assembler(racine, sid, systeme, version_taxonomie, version_prompt)
        resume["hashs"][sid] = enregistrement["hash_source"]
        chemin = repertoire / f"{sid}.json"
        if not force and chemin.is_file():
            # Resume on hash, not presence: same text means the file on disk is
            # already exactly what we would write, so leave it (and its mtime).
            existant = _lire_json(chemin)
            if existant.get("hash_source") == enregistrement["hash_source"] and existant.get(
                "systeme"
            ) == enregistrement["systeme"]:
                resume["inchanges"] += 1
                continue
        ecrire(enregistrement, chemin)
        resume["ecrits"] += 1

    # The manifest is what gives stage 09 its resume table and stage 10 its drift
    # detector. `construit_le` is deliberately absent: a wall clock would make the
    # file differ on every run and drown the real diff. The hash table IS the date.
    ecrire(
        {
            "version_prompt": version_prompt,
            "version_taxonomie": version_taxonomie,
            "prepare_prompts_version": prepare_prompts_version,
            "n": len(ids),
            "max_tokens": MAX_TOKENS,
            "hash_systeme": hash_source(systeme),
            "hashs": dict(sorted(resume["hashs"].items())),
        },
        repertoire / FICHIER_MANIFESTE,
    )
    return resume


def main(argv: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(
        description=(
            "Étage 08 : assemble un prompt complet par sort dans "
            "build_artifacts/prompts/<version>/. Hors ligne, idempotent, "
            "reprise sur hash_source. N'écrit rien sous data/."
        )
    )
    parseur.add_argument("--racine", default=DEFAULT_RACINE)
    parseur.add_argument("--sortie", default=DEFAULT_SORTIE)
    parseur.add_argument(
        "--racine-conventions",
        default=None,
        help=(
            "racine des vocabulaires clos (défaut : le dépôt courant). À laisser "
            "tel quel : les listes closes sont gelées et partagées, y compris "
            "quand --racine pointe sur une fixture"
        ),
    )
    parseur.add_argument("--version-prompt", default=VERSION_PROMPT)
    parseur.add_argument("--limit", type=int, default=None)
    parseur.add_argument("--only", action="append", default=None)
    parseur.add_argument(
        "--force",
        action="store_true",
        help="réécrit même les prompts dont le hash_source est inchangé",
    )
    args = parseur.parse_args(argv)
    for flux in (sys.stdout, sys.stderr):
        reconfigurer = getattr(flux, "reconfigure", None)
        if reconfigurer is not None:
            reconfigurer(encoding="utf-8", newline="\n")

    resume = run(
        args.racine,
        args.sortie,
        racine_conventions=args.racine_conventions,
        version_prompt=args.version_prompt,
        limite=args.limit,
        seulement=args.only,
        force=args.force,
    )
    print(
        f"prompts : {resume['demandes']} demandés, {resume['ecrits']} écrits, "
        f"{resume['inchanges']} inchangés"
    )
    print(
        f"{resume['version_prompt']} / {resume['version_taxonomie']} — "
        f"{resume['repertoire']}"
    )
    print(
        "estimer le coût : python tools/estimate_cost.py --prompts "
        f"{resume['repertoire']} --tarif-entree <prix/1k> --tarif-sortie <prix/1k>"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
