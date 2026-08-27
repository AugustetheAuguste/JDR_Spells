'use client'

import type { ReactNode } from 'react'

/**
 * The three pieces every account form is made of.
 *
 * Extracted because there are four forms — sign in, sign up, request a reset, set a
 * password — and four hand-written labels drift into four different focus rings and
 * three different ways of announcing an error. The design system fixes the
 * appearance; this file is what makes the four forms actually share it.
 *
 * No colour is written here. `rounded-jeton`, `border-bord-fort`, `text-corps` and
 * the rest resolve to `styles/theme.css`, which mirrors `lib/design/tokens.ts`.
 */

/**
 * A labelled text field.
 *
 * `id` is required rather than generated: the label needs `htmlFor`, the help text
 * needs to be referenced by `aria-describedby`, and a generated id would make the
 * association untestable by accessible name.
 *
 * `autoComplete` is required too, and that is deliberate. A password field without
 * it is the difference between a password manager that works and one that silently
 * saves the wrong thing — and getting `new-password` versus `current-password`
 * wrong is exactly the mistake nobody notices until a friend cannot sign in.
 */
export function ChampTexte({
  id,
  etiquette,
  type,
  valeur,
  surChangement,
  autoComplete,
  aide,
  requis = true,
  minLongueur,
}: {
  readonly id: string
  readonly etiquette: string
  readonly type: 'email' | 'password'
  readonly valeur: string
  readonly surChangement: (valeur: string) => void
  readonly autoComplete: string
  readonly aide?: string
  readonly requis?: boolean
  readonly minLongueur?: number
}) {
  const idAide = `${id}-aide`
  return (
    <div className="flex flex-col gap-1">
      <label className="text-petit font-medium text-encre-douce" htmlFor={id}>
        {etiquette}
      </label>
      <input
        aria-describedby={aide === undefined ? undefined : idAide}
        autoComplete={autoComplete}
        className="w-full rounded-jeton border border-bord-fort bg-surface px-2.5 py-1.5 text-corps text-encre placeholder:text-encre-faible"
        id={id}
        minLength={minLongueur}
        onChange={(evenement) => surChangement(evenement.target.value)}
        required={requis}
        spellCheck={false}
        type={type}
        value={valeur}
      />
      {aide === undefined ? null : (
        <p className="m-0 text-petit text-encre-faible" id={idAide}>
          {aide}
        </p>
      )}
    </div>
  )
}

/**
 * Something the interface has to say about what just happened.
 *
 * `role="alert"` for a failure and `role="status"` for a success, which is not
 * cosmetic: `alert` interrupts a screen reader and `status` waits its turn, and a
 * "compte créé" that interrupts is as wrong as an "adresse incorrecte" that does
 * not.
 *
 * A failure borrows `desaccord`, the only warm token there is. The design system is
 * explicit that it is not an error colour — but it is the one hue reserved for
 * "read this", and inventing a red would add the second accent the system forbids.
 */
export function Annonce({
  ton,
  children,
}: {
  readonly ton: 'echec' | 'succes'
  readonly children: ReactNode
}) {
  const echec = ton === 'echec'
  return (
    <div
      className={[
        'rounded-panneau border px-3 py-2 text-corps',
        echec
          ? 'border-desaccord bg-desaccord-voile text-encre'
          : 'border-accent bg-accent-voile text-encre',
      ].join(' ')}
      role={echec ? 'alert' : 'status'}
    >
      <p className="m-0">{children}</p>
    </div>
  )
}

/**
 * A button that knows it is busy.
 *
 * `enAttente` disables it *and* rewrites its label, because a disabled button whose
 * text has not changed reads as broken rather than as working. The design system
 * bans spinners on this site; a changed verb is what replaces them.
 */
export function Bouton({
  children,
  type = 'button',
  primaire = false,
  enAttente = false,
  libelleAttente,
  surClic,
}: {
  readonly children: ReactNode
  readonly type?: 'button' | 'submit'
  readonly primaire?: boolean
  readonly enAttente?: boolean
  readonly libelleAttente?: string
  readonly surClic?: () => void
}) {
  return (
    <button
      className={[
        'rounded-jeton border px-3 py-2 text-corps font-medium disabled:cursor-not-allowed disabled:border-bord disabled:text-encre-faible',
        primaire
          ? 'border-accent bg-accent font-semibold text-white hover:bg-accent-survol disabled:bg-survol'
          : 'border-bord-fort bg-surface text-encre hover:bg-survol',
      ].join(' ')}
      disabled={enAttente}
      onClick={surClic}
      type={type}
    >
      {enAttente && libelleAttente !== undefined ? libelleAttente : children}
    </button>
  )
}
