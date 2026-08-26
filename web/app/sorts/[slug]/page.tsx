/**
 * One statically generated page per spell — 2070 of them, no dynamic route.
 *
 * `generateStaticParams` enumerates the index and not the filesystem: the index
 * is the artefact that says which spells exist, and walking `public/data/sorts/`
 * instead would silently publish a stale file the index no longer lists. The
 * mismatch in the other direction — a slug in the index with no props file —
 * would fall through to `notFound()` and disappear as a 404, so
 * `verifier-props.test.ts` fails loudly on it instead.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BlocTechnique, lignesTechniques } from '@/components/fiche/BlocTechnique'
import { CoucheEnrichissement } from '@/components/fiche/CoucheEnrichissement'
import { Description } from '@/components/fiche/Description'
import { LienSource } from '@/components/fiche/LienSource'
import { NiveauxParClasse } from '@/components/fiche/NiveauxParClasse'
import { BoutonFavori } from '@/components/favoris/BoutonFavori'
import { Badge } from '@/components/primitives/Badge'
import { MarqueurDesaccord } from '@/components/primitives/MarqueurDesaccord'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { ecoleDe } from '@/lib/donnees/index-web'
import { chargerIndex } from '@/lib/donnees/lire-index'
import { lirePropsSort, type PropsSort } from '@/lib/donnees/sort-page'

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return chargerIndex().sorts.map((sort) => ({ slug: sort.s }))
}

/**
 * The props carry the accented French school label; the index's code table holds
 * the unaccented lowercase form. Folding here rather than adding a mapping keeps
 * one representation authoritative — and it is the same fold as everywhere else.
 */
function ecoleToken(sort: PropsSort) {
  if (sort.ecole === null) return null
  const index = chargerIndex()
  const plie = sort.ecole
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const code = index.ecoles.indexOf(plie)
  return code < 0 ? null : ecoleDe(index, code)
}

/** First sentence of the description, for the meta description when there is no
 * short summary. Cut on the sentence and not at N characters, so the tag never
 * ends mid-word. */
function premierePhrase(texte: string | null): string | undefined {
  if (texte === null) return undefined
  const phrase = texte.trim().split(/(?<=\.)\s/)[0]
  return phrase === undefined || phrase === '' ? undefined : phrase
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const sort = lirePropsSort(slug)
  if (sort === null) return { title: 'Sort introuvable' }
  const description = sort.enrichissement?.resume_court ?? premierePhrase(sort.description)
  return {
    title: sort.nom,
    ...(description === undefined ? {} : { description }),
  }
}

export default async function PageSort({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sort = lirePropsSort(slug)
  if (sort === null) notFound()

  const nbClasses = Object.keys(sort.niveaux_par_classe).length

  return (
    <article className="space-y-5">
      <header>
        <p className="m-0 text-petit text-encre-douce">
          <Link className="text-accent underline hover:text-accent-survol" href="/">
            Tous les sorts
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="m-0 font-affichage text-titre1 font-semibold">{sort.nom}</h1>
          {/* The id, not the slug: a slug is a function of the naming algorithm
              and could change, an id is the stable join key. */}
          <BoutonFavori id_sort={sort.id} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PastilleEcole ecole={ecoleToken(sort)} />
          {sort.descripteurs.map((descripteur) => (
            <Badge key={descripteur}>{descripteur}</Badge>
          ))}
          {sort.portee === null ? null : <Badge ton="donnees">{sort.portee}</Badge>}
          <Badge>{nbClasses === 1 ? '1 classe' : `${nbClasses} classes`}</Badge>
          <MarqueurDesaccord desaccords={sort.desaccords} variante="puce" />
        </div>
      </header>

      <MarqueurDesaccord desaccords={sort.desaccords} />

      <NiveauxParClasse niveaux={sort.niveaux_par_classe} />

      <section aria-labelledby="titre-technique">
        <h2 className="m-0 mb-2 font-affichage text-titre3 font-semibold" id="titre-technique">
          Bloc technique
        </h2>
        <BlocTechnique lignes={lignesTechniques(sort)} />
      </section>

      <Description id="titre-description" texte={sort.description} titre="Description" />

      {sort.mythique === null ? null : (
        <Description
          id="titre-mythique"
          texte={sort.mythique.description}
          titre="Version mythique"
        />
      )}

      {sort.variantes.length === 0 ? null : (
        <section aria-labelledby="titre-variantes">
          <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-variantes">
            {sort.variantes.length === 1 ? 'Sort apparenté' : 'Sorts apparentés'}
          </h2>
          <p className="mt-1 mb-2 max-w-[68ch] text-petit text-encre-douce">
            La page d&apos;origine décrit aussi{' '}
            {sort.variantes.length === 1 ? 'ce sort' : 'ces sorts'}, dont le bloc technique
            diffère.
          </p>
          <ul className="m-0 list-none space-y-3 p-0">
            {sort.variantes.map((variante) => (
              <li
                className="rounded-panneau border border-bord bg-surface px-3 py-2.5"
                key={variante.nom}
              >
                <p className="m-0 mb-1.5 font-affichage text-grand font-semibold">
                  {variante.nom}
                </p>
                <BlocTechnique lignes={lignesTechniques(variante)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {sort.sources.length === 0 ? null : (
        <section aria-labelledby="titre-ouvrages">
          <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-ouvrages">
            {sort.sources.length === 1 ? 'Ouvrage' : 'Ouvrages'}
          </h2>
          <ul className="mt-1.5 mb-0 list-none space-y-1 p-0 text-corps">
            {sort.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </section>
      )}

      <CoucheEnrichissement enrichissement={sort.enrichissement} />

      <LienSource url={sort.url_source} />
    </article>
  )
}
