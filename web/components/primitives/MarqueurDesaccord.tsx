import { Badge } from '@/components/primitives/Badge'

/**
 * The site's differentiator against the wiki: it says when the corpus's two
 * sources disagree about a spell's level.
 *
 * It informs, it does not accuse. A divergence between a class list and a spell
 * page is a recorded fact of the corpus, never corrected (CLAUDE.md § 9) — so no
 * red, no warning triangle, no "error". The wording names both sources and lets
 * the reader decide, because this site is not the authority on which one is right.
 *
 * On the corpus as committed there are zero of these: all 8409 comparable pairs
 * concord. This component is the probe that makes the first real divergence
 * visible, and it is tested against a synthetic case in the frozen fixture.
 */
export interface Desaccord {
  readonly classe: string | null
  readonly slug: string | null
  readonly niveau_liste: number | null
  readonly niveau_page: number | null
}

export function MarqueurDesaccord({
  desaccords,
  variante = 'complete',
}: {
  readonly desaccords: readonly Desaccord[]
  readonly variante?: 'complete' | 'puce'
}) {
  if (desaccords.length === 0) return null

  if (variante === 'puce') {
    return (
      <Badge
        titre={`Les deux sources du corpus donnent des niveaux différents pour ${desaccords.length} classe(s).`}
        ton="alerte"
      >
        désaccord
      </Badge>
    )
  }

  return (
    <section
      aria-label="Désaccord de niveau entre les sources"
      className="rounded-panneau border border-desaccord/25 bg-desaccord-voile px-3 py-2.5"
    >
      <p className="m-0 text-petit font-semibold text-desaccord">
        {desaccords.length === 1
          ? 'Les deux sources ne donnent pas le même niveau'
          : `Les deux sources ne donnent pas le même niveau (${desaccords.length} classes)`}
      </p>
      <ul className="mt-1.5 mb-0 list-none space-y-1 p-0 text-base">
        {desaccords.map((desaccord) => (
          <li key={desaccord.slug ?? desaccord.classe ?? ''}>
            <strong>{desaccord.classe ?? desaccord.slug ?? 'classe inconnue'}</strong> :
            la liste de classe dit{' '}
            <span className="font-donnees">{desaccord.niveau_liste ?? '—'}</span>, la page
            du sort dit <span className="font-donnees">{desaccord.niveau_page ?? '—'}</span>.
          </li>
        ))}
      </ul>
      <p className="mt-1.5 mb-0 text-petit text-encre-douce">
        Constaté tel quel dans la source, jamais corrigé ici. La page du wiki fait foi.
      </p>
    </section>
  )
}
