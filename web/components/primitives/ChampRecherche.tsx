'use client'

import { useEffect, useRef } from 'react'

/**
 * The search field: controlled, focusable with `/`, clearable with Escape.
 *
 * `/` is bound because this is a keyboard tool used at the table during play —
 * reaching for a mouse to start typing is the thing being designed away. The
 * binding is suppressed while the user is already in a field, or `/` would be
 * untypable in any other input on the page.
 *
 * `type="search"` is deliberately avoided: browsers add their own clear button,
 * which duplicates ours at a different position and size.
 */
export function ChampRecherche({
  valeur,
  surChangement,
  etiquette = 'Chercher un sort',
  placeholder = 'Nom de sort…',
  aide,
  nbResultats,
}: {
  readonly valeur: string
  readonly surChangement: (valeur: string) => void
  readonly etiquette?: string
  readonly placeholder?: string
  readonly aide?: string
  /** Announced politely so a keyboard user hears the count change without the
   * focus leaving the field. */
  readonly nbResultats?: number
}) {
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key !== '/') return
      const cible = evenement.target
      const dansUnChamp =
        cible instanceof HTMLInputElement ||
        cible instanceof HTMLTextAreaElement ||
        (cible instanceof HTMLElement && cible.isContentEditable)
      if (dansUnChamp) return
      evenement.preventDefault()
      champ.current?.focus()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <label className="text-petit font-medium text-encre-douce" htmlFor="champ-recherche">
        {etiquette}
      </label>
      <div className="relative flex items-center">
        <input
          aria-describedby={aide === undefined ? undefined : 'aide-recherche'}
          autoComplete="off"
          className="w-full rounded-jeton border border-bord-fort bg-surface px-2.5 py-1.5 pr-16 text-base text-encre placeholder:text-encre-faible"
          id="champ-recherche"
          onChange={(evenement) => surChangement(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === 'Escape' && valeur !== '') {
              evenement.preventDefault()
              surChangement('')
            }
          }}
          placeholder={placeholder}
          ref={champ}
          spellCheck={false}
          type="text"
          value={valeur}
        />
        {valeur === '' ? (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 rounded-jeton border border-bord px-1 font-donnees text-micro text-encre-faible"
          >
            /
          </kbd>
        ) : (
          <button
            className="absolute right-1.5 rounded-jeton px-1.5 py-0.5 text-micro text-encre-douce hover:bg-survol"
            onClick={() => {
              surChangement('')
              champ.current?.focus()
            }}
            type="button"
          >
            Effacer
          </button>
        )}
      </div>
      {aide === undefined ? null : (
        <p className="m-0 text-petit text-encre-faible" id="aide-recherche">
          {aide}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {nbResultats === undefined
          ? ''
          : `${nbResultats} ${nbResultats === 1 ? 'sort' : 'sorts'} correspondent.`}
      </p>
    </div>
  )
}
