'use client'

import type { IndexWeb } from '@/lib/donnees/index-web'
import { grouperClasses } from '@/lib/navigation/groupes-classes'

/**
 * Step one: the class, before anything else.
 *
 * It is first because everything after it depends on it. A level only exists
 * relative to a class (B4) — the second question is « quel niveau », and asking it
 * without a class would be asking about a number that does not exist. So the choice
 * is not a filter among filters here, it is the door.
 *
 * A grid of buttons rather than the table view's `<select>`: this is the whole
 * screen at this step, there is room to show how many spells each class receives,
 * and that count is what tells a reader whether the corpus has what they came for
 * before they invest a click.
 *
 * « Toutes les classes » is offered, quietly, and not as a card: it leads to a
 * level axis that can only show the cross-class floor, which is a weaker place to
 * start. It stays available because a reader who wants to cut by school first has a
 * legitimate reason to skip the class.
 */
export function ChoixClasse({
  index,
  surClasse,
  surSansClasse,
}: {
  readonly index: IndexWeb
  readonly surClasse: (slug: string) => void
  readonly surSansClasse: () => void
}) {
  const compte = new Map<string, number>()
  for (const sort of index.sorts) {
    for (const slug of Object.keys(sort.niv)) {
      compte.set(slug, (compte.get(slug) ?? 0) + 1)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {grouperClasses(index).map((groupe) => (
        <section key={groupe.titre}>
          <h2 className="m-0 mb-2 text-petit font-semibold text-encre-douce">{groupe.titre}</h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2 p-0">
            {groupe.classes.map((classe) => (
              <li key={classe.slug}>
                <button
                  className="flex w-full items-baseline justify-between gap-2 rounded-panneau border border-bord bg-surface px-3 py-2.5 text-left hover:border-accent hover:bg-accent-voile"
                  onClick={() => surClasse(classe.slug)}
                  type="button"
                >
                  <span className="font-affichage text-grand text-encre">{classe.nom}</span>
                  <span className="font-donnees text-petit text-encre-faible">
                    {compte.get(classe.slug) ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

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
