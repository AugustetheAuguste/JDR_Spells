import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import type { SortCompare } from '@/lib/comparaison/ensembles'
import { ecoleDe, type IndexWeb } from '@/lib/donnees/index-web'

/**
 * The comparison table: one level column per selected class, plus the spread.
 *
 * One column per class is not a layout preference, it is the same rule as
 * everywhere else in this interface (B4): a level belongs to a class, so it is
 * shown under that class's name. A single « niveau » column here would be
 * meaningless — that is precisely the number this view exists to break apart.
 *
 * The spread column is the point of the whole page. It is the only number here
 * the wiki cannot give you, since it requires cross-referencing nineteen class
 * lists.
 */
export function TableComparaison({
  index,
  sorts,
  classes,
  legende,
}: {
  readonly index: IndexWeb
  readonly sorts: readonly SortCompare[]
  readonly classes: readonly string[]
  readonly legende: string
}) {
  const noms = new Map(index.classes.map((classe) => [classe.slug, classe.nom]))

  return (
    <div className="overflow-x-auto rounded-panneau border border-bord bg-surface">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr>
            <th
              className="sticky top-0 z-10 border-b border-bord bg-surface px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce"
              scope="col"
            >
              Sort
            </th>
            <th
              className="sticky top-0 z-10 hidden border-b border-bord bg-surface px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce sm:table-cell"
              scope="col"
            >
              École
            </th>
            {classes.map((classe) => (
              <th
                className="sticky top-0 z-10 border-b border-bord bg-surface px-2.5 py-1.5 text-right text-petit font-semibold text-encre-douce"
                key={classe}
                scope="col"
              >
                {noms.get(classe) ?? classe}
              </th>
            ))}
            <th
              className="sticky top-0 z-10 border-b border-bord bg-surface px-2.5 py-1.5 text-right text-petit font-semibold text-encre-douce"
              scope="col"
              title="Différence entre le niveau le plus haut et le plus bas parmi les classes comparées"
            >
              Écart
            </th>
          </tr>
        </thead>
        <tbody>
          {sorts.map(({ sort, niveaux, ecart }) => (
            <tr className="h-ligne border-b border-bord last:border-b-0 hover:bg-survol" key={sort.id}>
              <td className="px-2.5 py-1.5">
                <Link
                  className="text-encre no-underline hover:text-accent hover:underline"
                  // The object form: `typedRoutes` cannot check an interpolated
                  // string against `/sorts/[slug]`, and the slug IS the URL.
                  href={{ pathname: `/sorts/${sort.s}/` }}
                >
                  {sort.n}
                </Link>
              </td>
              <td className="hidden px-2.5 py-1.5 sm:table-cell">
                <PastilleEcole ecole={sort.e === null ? null : ecoleDe(index, sort.e)} />
              </td>
              {classes.map((classe) => {
                const niveau = niveaux[classe]
                return (
                  <td className="px-2.5 py-1.5 text-right font-donnees" key={classe}>
                    {niveau === undefined ? (
                      // An em dash, never a 0: this class does not get the spell,
                      // and 0 is a real level (orisons).
                      <span
                        className="text-encre-faible"
                        title={`${noms.get(classe) ?? classe} ne reçoit pas ce sort`}
                      >
                        —
                      </span>
                    ) : (
                      niveau
                    )}
                  </td>
                )
              })}
              <td className="px-2.5 py-1.5 text-right">
                {ecart === null ? (
                  <span
                    className="font-donnees text-encre-faible"
                    title="Une seule des classes comparées reçoit ce sort : il n’y a pas d’écart à mesurer."
                  >
                    —
                  </span>
                ) : ecart === 0 ? (
                  <span className="font-donnees text-encre-faible" title="Même niveau partout">
                    0
                  </span>
                ) : (
                  <Badge titre={`${ecart} niveau(x) d’écart entre les classes comparées`} ton="accent">
                    +{ecart}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
