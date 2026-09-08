/**
 * The global-search source for local character sheets.
 *
 * Unlike `sourceSorts`/`sourceDons` in `sources-globales.ts`, this source
 * reads no network index: sheets live in `localStorage`, on this device
 * only, and can be created, renamed or deleted between two keystrokes. There
 * is therefore nothing to cache — `lireFiches` (typically
 * `() => lister(window.localStorage).fiches`) is called fresh on every
 * `chercher`, deliberately, rather than memoised like the other two sources'
 * fetched indexes.
 *
 * `sourceFiches` is a factory rather than a ready-made constant so the
 * `localStorage` read stays out of this module's own import graph: it takes
 * the read function as a parameter, exactly as the plan specifies, so a test
 * can hand it an in-memory list without touching a real store.
 */

import { MOTS } from '@/lib/design/tokens'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { plier } from './pliage'
import type { ResultatGlobal, SourceGlobale } from './sources-globales'

function nomAffiche(fiche: Fiche): string {
  return fiche.meta.nomPersonnage.trim() === '' ? MOTS.ficheSansNom : fiche.meta.nomPersonnage
}

function detailAffiche(fiche: Fiche): string | null {
  const race = fiche.identite.race?.nom ?? null
  const classes = fiche.identite.classes.map((classeFiche) => classeFiche.nom)
  const morceaux = [race, ...classes].filter((valeur): valeur is string => valeur !== null && valeur !== '')
  return morceaux.length === 0 ? null : morceaux.join(', ')
}

export function sourceFiches(lireFiches: () => readonly Fiche[]): SourceGlobale {
  return {
    type: 'fiche',
    libelle: MOTS.rechercheGroupeFiches,
    // After sorts and dons, cf. `SOURCES_PAR_DEFAUT`.
    ordre: 2,
    libelleTousLesResultats: MOTS.rechercheVoirTousLesFiches,
    hrefTousLesResultats: (requete) => `/personnages/?q=${encodeURIComponent(requete)}`,
    async chercher(requete, limite) {
      const q = plier(requete)
      if (q === '') return []
      const fiches = lireFiches()
      const trouvees = fiches.filter((fiche) => plier(fiche.meta.nomPersonnage).includes(q)).slice(0, limite)
      return trouvees.map(
        (fiche): ResultatGlobal => ({
          type: 'fiche',
          cle: fiche.id,
          titre: nomAffiche(fiche),
          detail: detailAffiche(fiche),
          href: `/personnages/fiche/?id=${encodeURIComponent(fiche.id)}`,
        }),
      )
    },
  }
}
