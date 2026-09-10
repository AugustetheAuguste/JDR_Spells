'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { MOTS } from '@/lib/design/tokens'
import { SOURCES_PAR_DEFAUT, type ResultatGlobal, type SourceGlobale } from '@/lib/recherche/sources-globales'

/** Debounce before searching. Not raised above 200ms (spec) — long enough to
 * avoid re-running every source on every keystroke, short enough that the
 * field still feels live. */
const DELAI_REPOS = 150

/** Per-group result cap. A sixth result is a link to the corpus page instead. */
const LIMITE_PAR_GROUPE = 5

interface GroupeResultats {
  readonly source: SourceGlobale
  readonly resultats: readonly ResultatGlobal[]
}

/**
 * The header's unified search field: one box, results grouped by corpus.
 *
 * Deliberately not a `<form>` — there is no results route for it to submit
 * to, and the static export would not serve one if there were. Every
 * navigation out of this component (a result, or the group's "see all" link)
 * goes through the router directly.
 *
 * Loads nothing beyond the sources array at mount. Each `SourceGlobale`
 * decides for itself when to fetch its index and, for spells, when to pull
 * MiniSearch in — this component only calls `chercher`, once per source per
 * debounced keystroke, and never before the first one.
 */
export function RechercheGlobale({
  sources = SOURCES_PAR_DEFAUT,
}: {
  readonly sources?: readonly SourceGlobale[]
}) {
  const router = useRouter()
  const [requete, setRequete] = useState('')
  const [groupes, setGroupes] = useState<readonly GroupeResultats[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [aCherche, setACherche] = useState(false)
  const [indexActif, setIndexActif] = useState(-1)

  const champRef = useRef<HTMLInputElement>(null)
  const idListe = useId()
  const idChamp = useId()

  const sourcesTriees = useMemo(
    () => [...sources].sort((a, b) => a.ordre - b.ordre),
    [sources],
  )

  // Flat list of every visible result, in render order, so the arrow keys can
  // walk across group boundaries without knowing about groups at all.
  const plats = useMemo(
    () => groupes.flatMap((groupe) => groupe.resultats.map((resultat) => ({ groupe, resultat }))),
    [groupes],
  )

  // Clearing the field is a pure, synchronous reset — it needs no effect, and
  // running it from one (`if (requete === '') { setState... }`) is exactly
  // the cascading-render pattern the lint rule below exists to catch. Every
  // caller that sets `requete` to `''` (the change handler, the second
  // Escape) calls this directly instead.
  function reinitialiser() {
    setGroupes([])
    setOuvert(false)
    setACherche(false)
    setIndexActif(-1)
  }

  useEffect(() => {
    if (requete === '') return
    let vivant = true
    const minuteur = setTimeout(() => {
      Promise.all(
        sourcesTriees.map(async (source) => ({
          source,
          resultats: await source.chercher(requete, LIMITE_PAR_GROUPE),
        })),
      )
        .then((tous) => {
          if (!vivant) return
          const nonVides = tous.filter((groupe) => groupe.resultats.length > 0)
          setGroupes(nonVides)
          setACherche(true)
          setOuvert(true)
          setIndexActif(-1)
        })
        .catch(() => {
          if (!vivant) return
          setGroupes([])
          setACherche(true)
          setOuvert(true)
          setIndexActif(-1)
        })
    }, DELAI_REPOS)
    return () => {
      vivant = false
      clearTimeout(minuteur)
    }
    // `sourcesTriees` is derived from a prop that is stable in practice
    // (`SOURCES_PAR_DEFAUT` by default); including it as-is would re-run the
    // search on every render if a caller ever passed an inline array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requete])

  // The barre oblique shortcut. Removed on unmount — a listener left on
  // `document` by an unmounted component is a navigation bug, not a feature.
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key !== '/') return
      if (evenement.ctrlKey || evenement.altKey || evenement.metaKey) return
      const cible = evenement.target
      const dansUnChamp =
        cible instanceof HTMLInputElement ||
        cible instanceof HTMLTextAreaElement ||
        cible instanceof HTMLSelectElement ||
        (cible instanceof HTMLElement && cible.isContentEditable)
      if (dansUnChamp) return
      evenement.preventDefault()
      champRef.current?.focus()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [])

  // `router.push` wants its own branded `Route` type under `typedRoutes`,
  // which a template-literal cast against `/sorts/[slug]`/`/dons/[slug]`
  // cannot satisfy the way `<Link href={{ pathname }}>` can (`TableSorts.tsx`)
  // — `next build`'s stricter check (not plain `tsc`) rejects the literal
  // cast the rest of the codebase uses for query strings (`VueNavigation.tsx`,
  // `VueDons.tsx`). `Route` itself is opaque by design, so this is the one
  // place a result's or a group's href is asserted into it directly.
  function naviguer(href: string) {
    setOuvert(false)
    setIndexActif(-1)
    router.push(href as Route, { scroll: false })
  }

  function surToucheChamp(evenement: React.KeyboardEvent<HTMLInputElement>) {
    if (evenement.key === 'ArrowDown') {
      if (plats.length === 0) return
      evenement.preventDefault()
      setOuvert(true)
      setIndexActif((i) => (i >= plats.length - 1 ? 0 : i + 1))
    } else if (evenement.key === 'ArrowUp') {
      if (plats.length === 0) return
      evenement.preventDefault()
      setOuvert(true)
      setIndexActif((i) => (i <= 0 ? plats.length - 1 : i - 1))
    } else if (evenement.key === 'Enter') {
      const actif = plats[indexActif]
      if (actif === undefined) return
      evenement.preventDefault()
      naviguer(actif.resultat.href)
    } else if (evenement.key === 'Escape') {
      if (ouvert) {
        evenement.preventDefault()
        setOuvert(false)
        setIndexActif(-1)
      } else if (requete !== '') {
        evenement.preventDefault()
        setRequete('')
        reinitialiser()
      }
    }
  }

  const idActif = indexActif >= 0 && indexActif < plats.length ? `${idListe}-option-${indexActif}` : undefined
  const nbResultats = plats.length

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={idChamp}>
        {MOTS.rechercheGlobaleEtiquette}
      </label>
      <div className="relative flex items-center">
        <input
          aria-activedescendant={idActif}
          aria-autocomplete="list"
          aria-controls={idListe}
          aria-expanded={ouvert}
          autoComplete="off"
          // `text-grand` (17px) stays the default because below a 16px floor,
          // Safari and Chrome on iOS/Android zoom the page on focus — the same
          // floor `ChampRecherche.tsx`'s field already respects. That floor is
          // a touch-input rule, not a typographic one, so `pointer-fine`
          // drops the field back to `text-corps` on a mouse-driven viewport,
          // where it has to read as the same size as the nav links beside it.
          className="min-h-cible w-40 border border-bord-fort bg-surface px-2.5 py-1.5 pr-8 text-grand text-encre placeholder:text-encre-faible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:w-64 lg:w-80 pointer-fine:text-corps"
          id={idChamp}
          onChange={(evenement) => {
            const valeur = evenement.target.value
            setRequete(valeur)
            if (valeur === '') reinitialiser()
          }}
          onKeyDown={surToucheChamp}
          placeholder={MOTS.rechercheGlobalePlaceholder}
          ref={champRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={requete}
        />
        {requete === '' && (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-2 border border-bord px-1 font-donnees text-micro text-encre-faible"
          >
            /
          </kbd>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {aCherche ? `${nbResultats} ${nbResultats === 1 ? 'résultat' : 'résultats'}.` : ''}
      </p>

      {ouvert && (
        <ul
          className="absolute right-0 top-full z-20 max-h-[70vh] w-72 overflow-y-auto border border-bord bg-surface py-1 text-corps shadow-none md:w-96"
          id={idListe}
          role="listbox"
        >
          {groupes.length === 0 ? (
            <li className="px-3 py-2 text-petit text-encre-douce" role="presentation">
              {MOTS.rechercheGlobaleAucunResultat}
            </li>
          ) : (
            groupes.map((groupe) => {
              const debutGroupe = plats.findIndex((p) => p.groupe === groupe)
              return (
                <li key={groupe.source.type} role="group" aria-label={groupe.source.libelle}>
                  <p className="m-0 px-3 pt-1.5 text-micro font-medium uppercase text-encre-faible">
                    {groupe.source.libelle}
                  </p>
                  <ul>
                    {groupe.resultats.map((resultat, i) => {
                      const indexPlat = debutGroupe + i
                      const actif = indexPlat === indexActif
                      return (
                        <li key={resultat.cle}>
                          <button
                            aria-selected={actif}
                            className={`flex min-h-cible w-full items-center px-3 text-left text-encre hover:bg-accent-voile hover:text-accent ${
                              actif ? 'bg-accent-voile text-accent' : ''
                            }`}
                            id={`${idListe}-option-${indexPlat}`}
                            onClick={() => naviguer(resultat.href)}
                            onMouseEnter={() => setIndexActif(indexPlat)}
                            role="option"
                            type="button"
                          >
                            {resultat.titre}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <button
                    className="flex min-h-cible w-full items-center px-3 text-left text-petit text-accent hover:underline"
                    onClick={() => naviguer(groupe.source.hrefTousLesResultats(requete))}
                    type="button"
                  >
                    {groupe.source.libelleTousLesResultats}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
