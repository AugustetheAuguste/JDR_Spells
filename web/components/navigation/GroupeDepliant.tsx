'use client'

import { useState } from 'react'

/**
 * A foldable filter group: a `<fieldset>`/`<legend>` whose legend holds a
 * disclosure button instead of bare text.
 *
 * `fieldset`/`legend` is kept rather than a bare `<section>` because it is what
 * gives the checkboxes inside their accessible group name — a screen reader
 * announces "École, group" the moment focus enters it, which a `<div>` would
 * never do. Legends may hold interactive content, so the fold button lives there
 * without giving up that semantics.
 *
 * Opens by default: every facet here was always fully visible before this
 * component existed, and folding it away on first render would hide a filter
 * nobody asked to hide. Only the tag section — thirty-five tags, an inventory
 * rather than a filter — treats closed-by-default as the right call, and it makes
 * that choice explicitly by passing `ouvertParDefaut={false}` (or an equivalent
 * per-group default), not because this component defaults there.
 */
export function GroupeDepliant({
  titre,
  poses,
  total,
  ouvertParDefaut = true,
  aide,
  children,
}: {
  readonly titre: string
  /** How many values in this group are currently posed — shown as `poses/total`
   * once non-zero, so a folded group still tells you it isn't empty. */
  readonly poses: number
  readonly total: number
  readonly ouvertParDefaut?: boolean
  readonly aide?: string
  readonly children: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut)

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-0 block w-full p-0 text-petit font-semibold text-encre-douce">
        <button
          aria-expanded={ouvert}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-jeton border border-bord bg-surface px-2 py-1 text-left text-petit font-semibold text-encre hover:bg-survol"
          onClick={() => setOuvert((actuel) => !actuel)}
          type="button"
        >
          <span aria-hidden="true" className="font-donnees text-encre-faible">
            {ouvert ? '−' : '+'}
          </span>
          {titre}
          <span className="ml-auto font-normal text-encre-faible">
            {poses === 0 ? total : `${poses}/${total}`}
          </span>
        </button>
      </legend>
      {ouvert ? (
        <div className="mt-1.5">
          {aide === undefined ? null : (
            <p className="mt-0 mb-1.5 text-micro text-encre-faible">{aide}</p>
          )}
          <div className="flex flex-wrap gap-1.5 pl-1">{children}</div>
        </div>
      ) : null}
    </fieldset>
  )
}
