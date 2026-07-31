import type { Metadata } from 'next'

import { DemoPrimitives, type LigneDemo } from '@/app/%5Fdesign/DemoPrimitives'
import { MarqueurDesaccord } from '@/components/primitives/MarqueurDesaccord'
import {
  CHEMIN_INDEX_FIXTURE,
  chargerIndex,
  ecoleDe,
  niveauxOrdonnes,
} from '@/lib/donnees/index-web'
import { COULEURS, COULEURS_ECOLES, ECHELLE, POLICES } from '@/lib/design/tokens'

export const metadata: Metadata = {
  title: 'Démonstration des primitives',
  // Not a public page: it is a workbench for the primitives, and indexing it
  // would put a page of swatches into search results for a spell corpus.
  robots: { index: false, follow: false },
}

/**
 * The design workbench.
 *
 * It renders every primitive in every state, on the frozen fixture rather than on
 * invented data — a primitive that only works on hand-written props has not met
 * the corpus's shapes: an absent school, a spell with no saving throw, three
 * classes granting one spell at three different levels.
 */
export default function PageDesign() {
  const index = chargerIndex(CHEMIN_INDEX_FIXTURE)

  const lignes: readonly LigneDemo[] = index.sorts.slice(0, 12).map((sort) => ({
    slug: sort.s,
    nom: sort.n,
    ecole: ecoleDe(index, sort.e),
    niveaux: niveauxOrdonnes(index, sort).map(({ nom, niveau }) => ({ nom, niveau })),
    composantes: sort.c.map((code) => index.composantes[code] ?? '?'),
    portee: sort.p === null ? null : (index.portees[sort.p] ?? null),
    jet: sort.j === null ? null : (index.jets[sort.j] ?? null),
    // The fixture's one synthetic disagreement, so the marker has something real
    // to render. The real corpus has none: all 8409 comparable pairs concord.
    desaccords: sort.d
      ? [{ classe: 'Barde', slug: 'barde', niveau_liste: 0, niveau_page: 1 }]
      : [],
  }))

  return (
    <div>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">
        Primitives et jetons
      </h1>
      <p className="mt-2 max-w-[68ch] text-grand text-encre-douce">
        Rendu sur la fixture gelée de 24 sorts. Cette page n&apos;est pas publiée :
        c&apos;est le banc d&apos;essai des primitives.
      </p>

      <section className="mt-8">
        <h2 className="m-0 font-affichage text-titre2 font-semibold">Jetons</h2>
        <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">
          Toutes ces valeurs viennent de <code className="font-donnees">lib/design/tokens.ts</code>,
          seul endroit du dépôt où un hexadécimal peut être écrit. Un test le vérifie.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(COULEURS).map(([nom, valeur]) => (
            <figure className="m-0 w-32" key={nom}>
              <div
                className="h-10 rounded-jeton border border-bord"
                style={{ backgroundColor: valeur }}
              />
              <figcaption className="mt-1 text-micro text-encre-douce">
                {nom}
                <br />
                <code className="font-donnees">{valeur}</code>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(COULEURS_ECOLES).map(([nom, valeur]) => (
            <figure className="m-0 w-32" key={nom}>
              <div
                className="flex h-10 items-center justify-center rounded-jeton text-micro text-surface"
                style={{ backgroundColor: valeur }}
              >
                AA
              </div>
              <figcaption className="mt-1 text-micro text-encre-douce">
                {nom}
                <br />
                <code className="font-donnees">{valeur}</code>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="m-0 font-affichage text-titre2 font-semibold">Typographie</h2>
        <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">
          Échelle fixe, raison 1,2, ancrée à 16 px. Le corps est à 14,5 px : c&apos;est
          le prix explicite de la densité demandée.
        </p>
        <div className="rounded-panneau border border-bord bg-surface p-4">
          {Object.entries(ECHELLE).map(([nom, cran]) => (
            <p
              className="my-1"
              key={nom}
              style={{
                fontSize: cran.taille,
                lineHeight: cran.interligne,
                fontWeight: cran.graisse,
                fontFamily: nom.startsWith('titre') ? POLICES.affichage : POLICES.corps,
              }}
            >
              {nom} — Convocation de monstres&nbsp;IX ({cran.taille}/{cran.interligne})
            </p>
          ))}
          <p className="my-1 font-donnees">donnees — Barde 3 · Druide 5 · V, G, M</p>
        </div>
      </section>

      <DemoPrimitives lignes={lignes} />

      <section className="mt-8" id="marqueur">
        <h2 className="m-0 font-affichage text-titre2 font-semibold">
          MarqueurDesaccord
        </h2>
        <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">
          Le différenciateur du site face au wiki. Il informe, il n&apos;accuse pas :
          un désaccord entre la liste de classe et la page du sort est un fait du
          corpus, constaté et jamais corrigé. Zéro cas dans le corpus réel — le cas
          rendu ici est celui, synthétique, de la fixture.
        </p>
        <div className="flex max-w-2xl flex-col gap-3">
          <MarqueurDesaccord
            desaccords={[
              { classe: 'Barde', slug: 'barde', niveau_liste: 0, niveau_page: 1 },
            ]}
          />
          <MarqueurDesaccord
            desaccords={[
              { classe: 'Barde', slug: 'barde', niveau_liste: 0, niveau_page: 1 },
              { classe: 'Druide', slug: 'druide', niveau_liste: 3, niveau_page: null },
            ]}
          />
          <p className="m-0 text-petit text-encre-douce">
            Sans désaccord, la primitive ne rend rien du tout — pas un encart vide :{' '}
            <MarqueurDesaccord desaccords={[]} />
          </p>
        </div>
      </section>
    </div>
  )
}
