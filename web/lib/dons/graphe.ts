/**
 * Graph derivations, ported from `tools/dons/exporter_arbre_dons.py`:
 * `calculerVagues`, `calculerCouts`, `construireGraphe`, `calculerLeviers`,
 * `calculerVoies`. Same French names, same order.
 *
 * No `node:fs` anywhere in this module — it is pure graph/eligibility code
 * over data already in memory, importable from a client component. Reading
 * `moteur_dons.json` off disk is `scripts/vider_verdicts_ts.ts`'s job (and,
 * server-side, whatever loads the JSON asset); this module never does it
 * itself. See `web/lib/donnees/index-web.ts` vs `lire-index.ts` for the
 * precedent this split follows.
 */

import { evaluerDon, nettoyerNomDon, normaliser } from './moteur.js'
import type { CatalogueDons } from './moteur.js'
import type { DonConditions, Personnage, ResultatEligibilite, TablesMoteur } from './types.js'
import { estGroupeOu } from './types.js'

const ACCESSIBLE = new Set(['eligible', 'manual_check'])

/** Prérequis de type don d'un don, en liste d'alternatives : un `GroupeOu`
 * dont toutes les options sont des dons donne une liste à plusieurs
 * éléments (au choix), une exigence simple une liste à un seul élément
 * (obligatoire). Mirrors `exporter_arbre_dons.py::_prereqs_dons`. */
export function prerequisDons(don: DonConditions): readonly (readonly string[])[] {
  const groupes: string[][] = []
  for (const item of don.exigences) {
    const options = estGroupeOu(item) ? item.options : [item]
    const noms = options
      .filter((o) => o.type === 'feat')
      .map((o) => (typeof o.charge['feat_name'] === 'string' ? nettoyerNomDon(o.charge['feat_name']) : null))
      .filter((n): n is string => n !== null)
    if (noms.length > 0) groupes.push(noms)
  }
  return groupes
}

function avecDons(perso: Personnage, dons: ReadonlySet<string>): Personnage {
  return { ...perso, dons_connus: dons }
}

/** Fermeture itérative : vague N = dons ouverts après N dons dépensés.
 *
 * `dons_connus` est passé EXPLICITEMENT à chaque tour (jamais `undefined`) :
 * un prérequis de don non possédé vaut alors `false` plutôt que `null`, donc
 * un don gated sur un don non pris est rangé dans une vague ultérieure au
 * lieu d'être annoncé accessible dès la vague 1. C'est la différence
 * sémantique délibérée avec `filtrerDons` (qui laisse `dons_connus`
 * `undefined` par défaut, donc `null`) : pour un Guerrier 6, 234 dons
 * accessibles immédiatement contre 482 vus par `filtrerDons`. */
export function calculerVagues(
  perso: Personnage,
  catalogue: CatalogueDons,
  slots: number,
  tables: TablesMoteur,
): { readonly vagueDe: ReadonlyMap<string, number>; readonly resultatDe: ReadonlyMap<string, ResultatEligibilite> } {
  // `evaluerExigence`'s `feat` branch compares `dons_connus` against a
  // NORMALIZED requirement name (`perso.dons_connus.has(normaliser(nomDon))`)
  // — so `acquis` must hold normalized names too, even though `catalogue`
  // (and `vagueDe`/`resultatDe`) stay keyed by the exact display name.
  const acquis = new Set([...(perso.dons_connus ?? [])].map((nom) => normaliser(nom)))
  const vagueDe = new Map<string, number>()
  const resultatDe = new Map<string, ResultatEligibilite>()

  for (let vague = 1; vague <= slots; vague += 1) {
    const courant = avecDons(perso, new Set(acquis))
    const nouveaux = new Map<string, ResultatEligibilite>()
    for (const [nom, don] of catalogue) {
      if (vagueDe.has(nom) || acquis.has(normaliser(nom))) continue
      const resultat = evaluerDon(nom, don, courant, tables)
      if (ACCESSIBLE.has(resultat.statut)) nouveaux.set(nom, resultat)
    }
    if (nouveaux.size === 0) break
    for (const [nom, resultat] of nouveaux) {
      vagueDe.set(nom, vague)
      resultatDe.set(nom, resultat)
      acquis.add(normaliser(nom))
    }
  }

  return { vagueDe, resultatDe }
}

/** Coût exact en emplacements : taille de l'ensemble minimal de dons à
 * prendre. La vague n'est qu'une borne inférieure — un don exigeant deux
 * prérequis distincts de vague 1 coûte 3 emplacements, pas 2. Calcule donc
 * la fermeture des prérequis manquants en dédupliquant les branches
 * partagées, et retient l'alternative la moins chère pour un OU. */
export function calculerCouts(
  catalogue: CatalogueDons,
  vagueDe: ReadonlyMap<string, number>,
  acquis: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const memo = new Map<string, ReadonlySet<string>>()

  function ensemble(nom: string, pile: ReadonlySet<string>): ReadonlySet<string> {
    if (acquis.has(nom)) return new Set()
    const enMemoire = memo.get(nom)
    if (enMemoire !== undefined) return enMemoire
    if (pile.has(nom) || !vagueDe.has(nom)) return new Set([nom]) // cycle, ou branche inatteignable

    let requis = new Set([nom])
    const don = catalogue.get(nom)
    if (don !== undefined) {
      const pileEtendue = new Set(pile)
      pileEtendue.add(nom)
      for (const alternatives of prerequisDons(don)) {
        const candidats = alternatives.filter((a) => acquis.has(a) || vagueDe.has(a))
        if (candidats.length === 0) continue
        let meilleure: ReadonlySet<string> | undefined
        for (const candidat of candidats) {
          const ens = ensemble(candidat, pileEtendue)
          if (meilleure === undefined || ens.size < meilleure.size) meilleure = ens
        }
        if (meilleure !== undefined) {
          const fusion = new Set(requis)
          for (const v of meilleure) fusion.add(v)
          requis = fusion
        }
      }
    }
    memo.set(nom, requis)
    return requis
  }

  const couts = new Map<string, number>()
  for (const nom of vagueDe.keys()) couts.set(nom, ensemble(nom, new Set()).size)
  return couts
}

/** Arêtes « prérequis -> don », éventuellement restreintes à un
 * sous-ensemble. `restreintA` distingue le graphe du CATALOGUE de celui de
 * la VUE : un don dont le prérequis n'est pas retenu n'a pas de parent
 * dans la vue, même s'il en a un dans le catalogue. */
export function construireGraphe(
  catalogue: CatalogueDons,
  restreintA?: ReadonlySet<string>,
): { readonly enfants: ReadonlyMap<string, ReadonlySet<string>>; readonly parents: ReadonlyMap<string, ReadonlySet<string>> } {
  const enfants = new Map<string, Set<string>>()
  const parents = new Map<string, Set<string>>()

  function ajouter(carte: Map<string, Set<string>>, cle: string, valeur: string): void {
    let ensemble = carte.get(cle)
    if (ensemble === undefined) {
      ensemble = new Set()
      carte.set(cle, ensemble)
    }
    ensemble.add(valeur)
  }

  for (const [nom, don] of catalogue) {
    if (restreintA !== undefined && !restreintA.has(nom)) continue
    for (const alternatives of prerequisDons(don)) {
      for (const prereq of alternatives) {
        if (restreintA !== undefined && !restreintA.has(prereq)) continue
        ajouter(enfants, prereq, nom)
        ajouter(parents, nom, prereq)
      }
    }
  }
  return { enfants, parents }
}

/** Levier d'un don = nombre de dons qu'il débloque, directement ou non.
 * N'a de sens que RELATIVEMENT au graphe dont il est tiré : sur le
 * catalogue entier il mesure la place du don dans les règles, sur la vue il
 * mesure ce que le personnage débloque vraiment. */
export function calculerLeviers(
  noms: ReadonlySet<string>,
  enfants: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, number> {
  const leviers = new Map<string, number>()
  for (const nom of noms) {
    const vus = new Set<string>()
    const pile = [nom]
    while (pile.length > 0) {
      const courant = pile.pop() as string
      for (const enfant of enfants.get(courant) ?? []) {
        if (!vus.has(enfant)) {
          vus.add(enfant)
          pile.push(enfant)
        }
      }
    }
    leviers.set(nom, vus.size)
  }
  return leviers
}

/** Étiquette chaque don par sa « voie » : le hub racine dont il descend.
 * Calculé SUR LE GRAPHE DE LA VUE, jamais sur le catalogue — une voie
 * nommée d'après un don non atteignable étiquetait des dons d'un nom
 * qui n'apparaissait nulle part à l'écran. */
export function calculerVoies(
  noms: ReadonlySet<string>,
  leviers: ReadonlyMap<string, number>,
  parents: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, string> {
  const voies = new Map<string, string>()
  for (const nom of noms) {
    const ancetres = new Set<string>()
    const pile = [nom]
    while (pile.length > 0) {
      const courant = pile.pop() as string
      for (const parent of parents.get(courant) ?? []) {
        if (!ancetres.has(parent)) {
          ancetres.add(parent)
          pile.push(parent)
        }
      }
    }
    const racines = [...ancetres].filter((a) => (parents.get(a)?.size ?? 0) === 0)
    if (racines.length > 0) {
      let meilleure = racines[0] as string
      for (const r of racines) {
        const lr = leviers.get(r) ?? 0
        const lm = leviers.get(meilleure) ?? 0
        if (lr > lm || (lr === lm && r > meilleure)) meilleure = r
      }
      voies.set(nom, meilleure)
    } else if ((leviers.get(nom) ?? 0) > 0) {
      voies.set(nom, nom) // racine elle-même, et elle a des descendants
    }
  }
  return voies
}
