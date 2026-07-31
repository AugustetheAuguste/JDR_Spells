'use client'

import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { TableDense, type ColonneDense } from '@/components/primitives/TableDense'
import { ecoleDe, type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { libelleNiveau, niveauAffiche } from '@/lib/navigation/niveaux'

/**
 * The results table.
 *
 * Every level shown here goes through `niveauAffiche`, never through `sort.niv`
 * directly: the column header names the class when one is chosen and says
 * « Niveau le plus bas, toutes classes » when none is, and the cell tooltip
 * always states what the number means. That is the whole of B4 on screen.
 *
 * The disagreement marker sits in the name cell rather than in a column of its
 * own. It is the one thing this site says that the wiki does not, so it is not
 * relegated to a column that falls off on a narrow screen — but it is a discreet
 * badge, because a divergence is a recorded fact, not an error.
 */
export function TableSorts({
  index,
  sorts,
  classe,
  viaAlias,
}: {
  readonly index: IndexWeb
  readonly sorts: readonly EntreeSort[]
  readonly classe: string | null
  /** Ids reached through an English alias, flagged so the reader knows why. */
  readonly viaAlias?: ReadonlySet<string>
}) {
  const colonnes: readonly ColonneDense<EntreeSort>[] = [
    {
      cle: 'nom',
      entete: 'Sort',
      cellule: (sort) => (
        <span className="inline-flex items-center gap-1.5">
          <Link
            className="text-encre underline decoration-bord-fort underline-offset-2 hover:text-accent"
            // The object form, because `typedRoutes` cannot check an interpolated
            // string against `/sorts/[slug]` — and the slug IS the URL, so the
            // path is built from data rather than from a literal.
            href={{ pathname: `/sorts/${sort.s}/` }}
          >
            {sort.n}
          </Link>
          {sort.d ? (
            <Badge
              titre="Les deux sources du corpus donnent des niveaux différents pour ce sort. Détail sur la fiche."
              ton="alerte"
            >
              désaccord
            </Badge>
          ) : null}
          {viaAlias?.has(sort.id) === true ? (
            <Badge titre="Trouvé par son nom anglais." ton="neutre">
              alias
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      cle: 'niveau',
      entete: libelleNiveau(index, classe),
      alignement: 'droite',
      largeur: '11rem',
      cellule: (sort) => {
        const niveau = niveauAffiche(index, sort, classe)
        return (
          <span
            className={niveau.relatifAUneClasse ? 'font-donnees' : 'font-donnees text-encre-douce'}
            title={niveau.titre}
          >
            {niveau.valeur ?? '—'}
          </span>
        )
      },
    },
    {
      cle: 'ecole',
      entete: 'École',
      largeur: '9rem',
      cellule: (sort) => <PastilleEcole ecole={ecoleDe(index, sort.e)} />,
    },
    {
      cle: 'composantes',
      entete: 'Comp.',
      secondaire: true,
      largeur: '7rem',
      cellule: (sort) =>
        sort.c.length === 0 ? (
          <span className="text-encre-faible">—</span>
        ) : (
          <span className="font-donnees text-petit">
            {sort.c.map((code) => index.composantes[code] ?? '?').join(' ')}
          </span>
        ),
    },
    {
      cle: 'portee',
      entete: 'Portée',
      secondaire: true,
      largeur: '8rem',
      cellule: (sort) =>
        sort.p === null ? (
          <span className="text-encre-faible">—</span>
        ) : (
          (index.portees[sort.p] ?? '—')
        ),
    },
    {
      cle: 'jet',
      entete: 'Sauvegarde',
      secondaire: true,
      largeur: '8rem',
      cellule: (sort) =>
        sort.j === null ? (
          <span className="text-encre-faible">—</span>
        ) : (
          (index.jets[sort.j] ?? '—')
        ),
    },
  ]

  return (
    <TableDense
      cleDe={(sort) => sort.s}
      colonnes={colonnes}
      legende={
        classe === null
          ? 'Sorts, toutes classes confondues ; le niveau affiché est le plus bas parmi les classes qui reçoivent le sort'
          : `Sorts de la classe ${index.classes.find((c) => c.slug === classe)?.nom ?? classe}, avec leur niveau pour cette classe`
      }
      lignes={sorts}
    />
  )
}
