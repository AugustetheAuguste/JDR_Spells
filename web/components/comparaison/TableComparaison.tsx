'use client'

import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import type { EtatTriTable } from '@/components/primitives/TableDense'
import { colonneNiveauDe, type SortCompare } from '@/lib/comparaison/ensembles'
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
 *
 * Every header is sortable, the per-class ones included — « which of these does
 * the bard get earliest » is the same question as « sort the bard's column », and
 * a column key names the class rather than its position so that a shared link
 * cannot end up sorting by whichever class happens to sit second.
 */
/**
 * A header cell: plain text, or a button when the caller can sort on it.
 *
 * Module level and not nested in `TableComparaison`: a component created during
 * render is a new type on every render, so React would remount every header — and
 * with it drop the focus a keyboard user had on the sort button.
 */
function Entete({
  cle,
  libelle,
  alignement = 'gauche',
  classeSupp = '',
  titre,
  tri,
}: {
  readonly cle: string
  readonly libelle: string
  readonly alignement?: 'gauche' | 'droite'
  readonly classeSupp?: string
  readonly titre?: string
  /** Omitted: the header stays plain text. */
  readonly tri?: EtatTriTable
}) {
  const actif = tri !== undefined && tri.colonne === cle
  const sens = actif ? tri.sens : null
  return (
    <th
      {...(tri === undefined
        ? {}
        : {
            'aria-sort': (actif
              ? sens === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none') as 'ascending' | 'descending' | 'none',
          })}
      className={[
        'sticky top-0 z-10 border-b border-bord bg-surface px-2.5 py-1.5 text-petit font-semibold text-encre-douce',
        alignement === 'droite' ? 'text-right' : 'text-left',
        classeSupp,
      ].join(' ')}
      scope="col"
      {...(titre === undefined || tri !== undefined ? {} : { title: titre })}
    >
      {tri === undefined ? (
        libelle
      ) : (
        <button
          className={[
            'inline-flex w-full cursor-pointer items-center gap-1 bg-transparent p-0 text-petit font-semibold hover:text-accent',
            actif ? 'text-encre' : 'text-encre-douce',
            alignement === 'droite' ? 'justify-end' : 'justify-start',
          ].join(' ')}
          onClick={() => tri.surColonne(cle)}
          title={
            titre === undefined
              ? actif
                ? `Trié par ${libelle}. Cliquez pour changer.`
                : `Trier par ${libelle}`
              : `${titre} — cliquez pour trier.`
          }
          type="button"
        >
          {libelle}
          <span
            aria-hidden="true"
            className={sens === null ? 'text-encre-faible' : 'text-accent'}
          >
            {sens === null ? '↕' : sens === 'asc' ? '↑' : '↓'}
          </span>
        </button>
      )}
    </th>
  )
}

export function TableComparaison({
  index,
  sorts,
  classes,
  legende,
  tri,
}: {
  readonly index: IndexWeb
  readonly sorts: readonly SortCompare[]
  readonly classes: readonly string[]
  readonly legende: string
  /** Omitted: the headers stay plain text. */
  readonly tri?: EtatTriTable
}) {
  const noms = new Map(index.classes.map((classe) => [classe.slug, classe.nom]))

  return (
    <div className="overflow-x-auto rounded-panneau border border-bord bg-surface">
      <table className="w-full border-collapse text-corps">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr>
            <Entete cle="nom" libelle="Sort" {...(tri === undefined ? {} : { tri })} />
            <Entete
              classeSupp="hidden sm:table-cell"
              cle="ecole"
              libelle="École"
              {...(tri === undefined ? {} : { tri })}
            />
            {classes.map((classe) => (
              <Entete
                alignement="droite"
                cle={colonneNiveauDe(classe)}
                key={classe}
                libelle={noms.get(classe) ?? classe}
                titre={`Niveau du sort pour ${noms.get(classe) ?? classe}`}
                {...(tri === undefined ? {} : { tri })}
              />
            ))}
            <Entete
              alignement="droite"
              cle="ecart"
              libelle="Écart"
              titre="Différence entre le niveau le plus haut et le plus bas parmi les classes comparées"
              {...(tri === undefined ? {} : { tri })}
            />
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
