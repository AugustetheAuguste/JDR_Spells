'use client'

import { AXES, CLES_AXES, type CleAxe } from '@/lib/exploration/axes'
import type { EtatExploration } from '@/lib/exploration/etat-exploration'
import type { IndexWeb } from '@/lib/donnees/index-web'

/**
 * Where the reader is, and every way back out.
 *
 * The chips are in the order the questions were answered — that order lives in the
 * `parcours` key of the URL, because the filters alone cannot express it and
 * « remonter d'un cran » has to know which cran was last.
 *
 * Criteria that arrived with the link rather than through a click (a URL copied
 * from the table view, which knows nothing of a parcours) are shown after them,
 * labelled as such. They filter exactly the same and are removable exactly the
 * same; what they are not is a step the reader took, and a breadcrumb that claimed
 * they were would misdescribe the path.
 */
/** One posed criterion, with its cross. Hoisted out of `CheminForage` rather than
 * declared inside it: a component created during render is a new type on every
 * render, so React remounts it and the focus on the cross is lost — which is the
 * one thing a keyboard user is holding when they remove a chip. */
function Puce({
  libelle,
  surRetrait,
  titre,
}: {
  readonly libelle: string
  readonly surRetrait: () => void
  readonly titre: string
}) {
  return (
    <li className="inline-flex">
      <span className="inline-flex items-center gap-1.5 rounded-jeton bg-accent px-2 py-1 text-petit text-surface">
        {libelle}
        <button
          aria-label={`Retirer ${libelle}`}
          className="leading-none text-surface"
          onClick={surRetrait}
          title={titre}
          type="button"
        >
          ×
        </button>
      </span>
    </li>
  )
}

export function CheminForage({
  index,
  etat,
  surRetirerClasse,
  surRetirerAxe,
  surRemonter,
  surTout,
}: {
  readonly index: IndexWeb
  readonly etat: EtatExploration
  readonly surRetirerClasse: () => void
  readonly surRetirerAxe: (cle: CleAxe) => void
  readonly surRemonter: () => void
  readonly surTout: () => void
}) {
  const classe = etat.base.classe
  const nomClasse =
    classe === null
      ? null
      : (index.classes.find((entree) => entree.slug === classe)?.nom ?? classe)

  const dansLeParcours = etat.parcours.filter((cle) => AXES[cle].pose(etat))
  const repris = CLES_AXES.filter(
    (cle) => AXES[cle].pose(etat) && !etat.parcours.includes(cle),
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {nomClasse === null ? (
          <li className="text-petit text-encre-douce">Toutes les classes</li>
        ) : (
          <Puce
            libelle={nomClasse}
            surRetrait={surRetirerClasse}
            titre="Revenir au choix de la classe"
          />
        )}
        {dansLeParcours.map((cle) => {
          const libelle = AXES[cle].libelleChoisi(index, etat)
          if (libelle === null) return null
          return (
            <Puce
              key={cle}
              libelle={libelle}
              surRetrait={() => surRetirerAxe(cle)}
              titre={`Retirer ce ${AXES[cle].bouton.toLowerCase()}`}
            />
          )
        })}
        {repris.map((cle) => {
          const libelle = AXES[cle].libelleChoisi(index, etat)
          if (libelle === null) return null
          return (
            <Puce
              key={cle}
              libelle={`${libelle} (repris du lien)`}
              surRetrait={() => surRetirerAxe(cle)}
              titre={`Retirer ce ${AXES[cle].bouton.toLowerCase()}`}
            />
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        {etat.parcours.length > 0 ? (
          <button
            className="rounded-jeton border border-bord-fort bg-surface px-2.5 py-1 text-petit text-encre hover:bg-survol"
            onClick={surRemonter}
            type="button"
          >
            Remonter d’un cran
          </button>
        ) : null}
        <button
          className="rounded-jeton border border-bord-fort bg-surface px-2.5 py-1 text-petit text-encre hover:bg-survol"
          onClick={surTout}
          type="button"
        >
          Repartir de zéro
        </button>
      </div>
    </div>
  )
}
