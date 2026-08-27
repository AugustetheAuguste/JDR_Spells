'use client'

import { useState } from 'react'

import type { IndexWeb } from '@/lib/donnees/index-web'
import { grouperClasses } from '@/lib/navigation/groupes-classes'

/**
 * Step one: the class or classes, before anything else.
 *
 * It is first because everything after it depends on it. A level only exists
 * relative to a class (B4) — the second question is « quel niveau », and asking it
 * without a class would be asking about a number that does not exist. So the choice
 * is not a filter among filters here, it is the door.
 *
 * A grid of cards rather than the table view's `<select>`: this is the whole
 * screen at this step, there is room to show how many spells each class receives,
 * and that count is what tells a reader whether the corpus has what they came for
 * before they invest a click.
 *
 * Several cards can be ticked at once: picking barde and magicien means the union
 * of their two lists, not either alone. A tick is a draft, not a navigation, so it
 * lives in local state here rather than the URL — it becomes a criterion worth
 * sharing only once « Valider » turns it into one, exactly like a chart's ticks
 * further down the route.
 *
 * « Toutes les classes » is offered, quietly, and not as a card: it leads to a
 * level axis that can only show the cross-class floor, which is a weaker place to
 * start. It stays available because a reader who wants to cut by school first has a
 * legitimate reason to skip the class.
 */
export function ChoixClasse({
  index,
  surClasses,
  surSansClasse,
}: {
  readonly index: IndexWeb
  /** Called with every class ticked, primary first, once « Valider » is pressed. */
  readonly surClasses: (slugs: readonly string[]) => void
  readonly surSansClasse: () => void
}) {
  const [selection, setSelection] = useState<readonly string[]>([])

  const compte = new Map<string, number>()
  for (const sort of index.sorts) {
    for (const slug of Object.keys(sort.niv)) {
      compte.set(slug, (compte.get(slug) ?? 0) + 1)
    }
  }

  function basculer(slug: string): void {
    setSelection((avant) =>
      avant.includes(slug) ? avant.filter((autre) => autre !== slug) : [...avant, slug],
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {grouperClasses(index).map((groupe) => (
        <section key={groupe.titre}>
          <h2 className="m-0 mb-2 text-petit font-semibold text-encre-douce">{groupe.titre}</h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2 p-0">
            {groupe.classes.map((classe) => {
              const coche = selection.includes(classe.slug)
              return (
                <li key={classe.slug}>
                  <button
                    aria-checked={coche}
                    className={[
                      'flex w-full items-baseline justify-between gap-2 rounded-panneau border px-3 py-2.5 text-left',
                      coche
                        ? 'border-accent bg-accent-voile'
                        : 'border-bord bg-surface hover:border-accent hover:bg-accent-voile',
                    ].join(' ')}
                    onClick={() => basculer(classe.slug)}
                    role="checkbox"
                    type="button"
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        aria-hidden="true"
                        className={[
                          'inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border',
                          coche
                            ? 'border-accent bg-accent text-surface'
                            : 'border-bord-fort bg-surface',
                        ].join(' ')}
                      >
                        {coche ? '✓' : ''}
                      </span>
                      <span className="font-affichage text-grand text-encre">{classe.nom}</span>
                    </span>
                    <span className="font-donnees text-petit text-encre-faible">
                      {compte.get(classe.slug) ?? 0}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-bord pt-4">
        <button
          className="rounded-jeton bg-accent px-3 py-1.5 text-petit font-semibold text-surface enabled:hover:bg-accent-survol disabled:cursor-not-allowed disabled:bg-bord-fort disabled:text-encre-faible"
          disabled={selection.length === 0}
          onClick={() => surClasses(selection)}
          type="button"
        >
          Valider ce choix
        </button>
        <p className="m-0 text-petit text-encre-douce">
          {selection.length === 0
            ? 'Cochez une ou plusieurs classes ci-dessus, puis validez.'
            : selection.length === 1
              ? '1 classe cochée.'
              : `${selection.length} classes cochées — vous verrez l’union de leurs sorts.`}
        </p>
      </div>

      <p className="m-0 text-petit text-encre-douce">
        <button
          className="text-accent underline hover:text-accent-survol"
          onClick={surSansClasse}
          type="button"
        >
          Explorer sans choisir de classe
        </button>{' '}
        — les niveaux affichés seront alors le niveau le plus bas toutes classes
        confondues, qui n’est le niveau de personne en particulier.
      </p>
    </div>
  )
}
