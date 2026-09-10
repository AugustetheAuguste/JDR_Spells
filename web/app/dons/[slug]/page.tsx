/**
 * One statically generated page per don ("feat"), on the pattern of
 * `app/sorts/[slug]/page.tsx` — a pure server component, no character context,
 * no URL state.
 *
 * The reason this route exists as its own step (`11_UI_DONS_SHEET`): a don's
 * sheet must show `raw_conditions` and `conditions_ajoutees` in two separate,
 * clearly labelled blocks, never folded into one. See `BlocConditions.tsx` and
 * `don-page.ts` for why merging them would be dangerous rather than merely
 * untidy (the `variante_de_source` case: the page *contradicts* the CSV).
 *
 * Wave-3 note: developed against `fixtures/index_dons.json` /
 * `fixtures/dons/*.json` because the exporter (step 08) has not landed on this
 * branch yet. `lire-index-dons.ts` / `don-page.ts` pick the real export the
 * moment it appears under `public/data/dons/`, with no change here.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BlocConditions } from '@/components/fiche/BlocConditions'
import { BlocOptionnel } from '@/components/fiche/BlocOptionnel'
import { FacettesSemantiques } from '@/components/fiche/FacettesSemantiques'
import { LienSource } from '@/components/fiche/LienSource'
import { Badge } from '@/components/primitives/Badge'
import { lirePropsDon, type PropsDon } from '@/lib/donnees/don-page'
import {
  activationDe,
  ciblesBonusDe,
  contextesDe,
  categoriesDe,
  effetPrincipalDe,
  effetsSecondairesDe,
  trouverDon,
  type EntreeDon,
} from '@/lib/donnees/index-web-dons'
import { chargerIndexDons } from '@/lib/donnees/lire-index-dons'

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return chargerIndexDons().dons.map((don) => ({ slug: don.s }))
}

/** First sentence of a free-text field, for the meta description when there is
 * no short summary — same cut-on-the-sentence rule as `sorts/[slug]/page.tsx`,
 * so a tag never ends mid-word. */
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
  const don = lirePropsDon(slug)
  if (don === null) return { title: 'Don introuvable' }
  const index = chargerIndexDons()
  const entree = trouverDon(index, slug)
  const description = (entree === null ? undefined : entree.rc ?? undefined) ?? premierePhrase(don.avantages)
  return {
    title: don.nom,
    ...(description === undefined ? {} : { description }),
  }
}

/**
 * The repeatable-feat badge, with the prose explaining what the CSV's bare `*`
 * actually means — an asterisk alone tells a reader nothing.
 */
function BadgeRepetable({ repetable }: { readonly repetable: boolean }) {
  if (!repetable) return null
  return (
    <Badge
      ton="accent"
      titre="Ce don peut être pris plusieurs fois ; ses effets se cumulent à chaque prise."
    >
      répétable
    </Badge>
  )
}

export default async function PageDon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const don: PropsDon | null = lirePropsDon(slug)
  if (don === null) notFound()

  const index = chargerIndexDons()
  const entree: EntreeDon | null = trouverDon(index, slug)

  return (
    <article className="space-y-5">
      <header>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="lettrine m-0 font-affichage text-titre1 font-semibold">{don.nom}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {don.source === null ? null : <Badge ton="donnees">{don.source}</Badge>}
          <BadgeRepetable repetable={don.repetable} />
        </div>
      </header>

      <BlocConditions
        id="titre-conditions-source"
        texte={don.raw_conditions ?? 'Aucune condition : ce don est ouvert à tout personnage.'}
        titre="Conditions (source)"
        ton="source"
      />

      {don.conditions_ajoutees === null ? null : (
        <BlocConditions
          id="titre-conditions-ajoutees"
          texte={don.conditions_ajoutees}
          titre="Prérequis relevés sur la page"
          ton="curation"
        />
      )}

      <BlocOptionnel id="titre-avantage" texte={don.avantages} titre="Avantage" />

      <BlocOptionnel id="titre-special" texte={don.special} titre="Spécial" />

      <BlocOptionnel id="titre-normal" texte={don.normal} titre="Normal" />

      {entree === null ? null : (
        <FacettesSemantiques
          activation={activationDe(index, entree)}
          categories={categoriesDe(index, entree)}
          ciblesBonus={ciblesBonusDe(index, entree)}
          contextes={contextesDe(index, entree)}
          effetPrincipal={effetPrincipalDe(index, entree)}
          effetsSecondaires={effetsSecondairesDe(index, entree)}
          valeurBonus={entree.vb}
        />
      )}

      {don.url_source === null ? null : <LienSource url={don.url_source} />}
    </article>
  )
}
