import { COULEURS_ECOLES, LIBELLES_ECOLES, type Ecole } from '@/lib/design/tokens'

/**
 * A school as a flat colour pastille with its name.
 *
 * The name is not optional decoration. Nine hues are not memorable, and
 * `necromancie` and `divination` read as the same dark violet to a colourblind
 * reader — colour is never the sole carrier of information. `variante="puce"`
 * shows the square alone and is only legitimate where the name is written
 * immediately beside it; it therefore still carries an accessible label.
 *
 * `ecole` may be null: the corpus does not give every spell a school, and an
 * absent school renders as an em dash rather than as a guess.
 */
export function PastilleEcole({
  ecole,
  variante = 'complete',
}: {
  readonly ecole: Ecole | null
  readonly variante?: 'complete' | 'puce'
}) {
  if (ecole === null) {
    return (
      <span className="text-encre-faible" title="École non renseignée par la source">
        —
      </span>
    )
  }

  const libelle = LIBELLES_ECOLES[ecole]
  const fond = COULEURS_ECOLES[ecole]

  if (variante === 'puce') {
    return (
      <span
        aria-label={libelle}
        className="inline-block size-3 shrink-0 rounded-jeton align-middle"
        role="img"
        style={{ backgroundColor: fond }}
        title={libelle}
      />
    )
  }

  // The chip carries the colour and the label carries the text, rather than white
  // text sitting on the fill. No text on this site is white; ink on the fill would
  // have measured 2.7:1 to 3.9:1 depending on the school and failed AA, so the
  // colour moved into a square of its own where contrast is not a text problem.
  return (
    <span className="inline-flex items-center gap-1.5 text-micro font-medium text-encre">
      <span
        aria-hidden="true"
        className="inline-block size-3 shrink-0 rounded-jeton align-middle"
        style={{ backgroundColor: fond }}
      />
      {libelle}
    </span>
  )
}
