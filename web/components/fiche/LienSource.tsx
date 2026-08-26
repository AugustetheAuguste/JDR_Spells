import { MOTS } from '@/lib/design/tokens'

/**
 * The link home to pathfinder-fr.org.
 *
 * B8: this is a commitment, not a decoration. The corpus is a scrape of a wiki
 * kept by volunteers, this site only makes it searchable, and the honest form of
 * that is a link that cannot be missed and that says the origin page is the
 * authority. So it is a full-width block with a button-weight link, on every
 * single spell page — not an icon in a corner.
 *
 * `url_source` is absolute and points at the wiki; the assertion lives in
 * `fiche.test.tsx` over the whole export rather than being trusted here.
 */
export function LienSource({ url }: { readonly url: string }) {
  return (
    <section
      aria-labelledby="titre-source"
      className="rounded-panneau border border-bord bg-surface px-4 py-3"
    >
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-source">
        Source
      </h2>
      <p className="mt-1 mb-3 max-w-[68ch] text-corps text-encre-douce">
        Ce sort est décrit sur <strong>pathfinder-fr.org</strong>, wiki communautaire
        tenu par des bénévoles. Cette page n&apos;en est qu&apos;un index de
        consultation : la page d&apos;origine fait foi, et c&apos;est elle qui est tenue
        à jour.
      </p>
      <a
        className="inline-flex items-center rounded-jeton border border-accent bg-accent-voile px-3 py-2 text-corps font-medium text-accent underline hover:bg-survol"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {MOTS.voirSurLeWiki}
      </a>
    </section>
  )
}
