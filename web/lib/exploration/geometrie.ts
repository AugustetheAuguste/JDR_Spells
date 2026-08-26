/**
 * The donut's arcs, computed rather than drawn by a library.
 *
 * No charting dependency: the navigation route already sits at 192,5 kB of the
 * 200 kB budget, and the smallest chart library is several times what this file
 * costs. A donut is four path commands, so the arithmetic is cheaper than the
 * dependency — and it stays a pure function, testable without a DOM.
 *
 * Conventions, fixed once so nothing recomputes them: the centre is (0, 0), the
 * first slice starts at twelve o'clock, and slices run clockwise. Coordinates are
 * rounded to three decimals so the same data always yields byte-identical paths.
 */

export interface Secteur {
  /** The `d` attribute of the wedge. */
  readonly d: string
  /** The share of the whole, 0..1 — what the label states in words. */
  readonly part: number
  /** Mid-angle in degrees from twelve o'clock, for placing a leader label. */
  readonly angleMilieu: number
}

export interface ReglagesDonut {
  readonly rayon: number
  readonly rayonInterne: number
  /** The gap between two wedges, in degrees, drawn in the page colour. It is what
   * keeps two neighbouring ramp steps from reading as one wedge. */
  readonly ecartDegres: number
}

const DECIMALES = 3

function arrondir(valeur: number): number {
  const facteur = 10 ** DECIMALES
  return Math.round(valeur * facteur) / facteur
}

/** A point on a circle, angle measured in degrees from twelve o'clock, clockwise. */
export function point(rayon: number, angleDegres: number): readonly [number, number] {
  const radians = ((angleDegres - 90) * Math.PI) / 180
  return [arrondir(rayon * Math.cos(radians)), arrondir(rayon * Math.sin(radians))]
}

function anneauComplet(rayon: number, rayonInterne: number): string {
  // A 360° arc has identical start and end points, and SVG then draws nothing at
  // all. So a single-slice donut is two half arcs — the case that appears the
  // moment a filter leaves one school standing, which is often.
  const [hautX, hautY] = point(rayon, 0)
  const [basX, basY] = point(rayon, 180)
  const [hautIX, hautIY] = point(rayonInterne, 0)
  const [basIX, basIY] = point(rayonInterne, 180)
  return (
    `M ${hautX} ${hautY} A ${rayon} ${rayon} 0 0 1 ${basX} ${basY}` +
    ` A ${rayon} ${rayon} 0 0 1 ${hautX} ${hautY} Z` +
    ` M ${hautIX} ${hautIY} A ${rayonInterne} ${rayonInterne} 0 0 0 ${basIX} ${basIY}` +
    ` A ${rayonInterne} ${rayonInterne} 0 0 0 ${hautIX} ${hautIY} Z`
  )
}

function secteur(
  debut: number,
  fin: number,
  { rayon, rayonInterne }: ReglagesDonut,
): string {
  const grand = fin - debut > 180 ? 1 : 0
  const [debutX, debutY] = point(rayon, debut)
  const [finX, finY] = point(rayon, fin)
  const [finIX, finIY] = point(rayonInterne, fin)
  const [debutIX, debutIY] = point(rayonInterne, debut)
  return (
    `M ${debutX} ${debutY} A ${rayon} ${rayon} 0 ${grand} 1 ${finX} ${finY}` +
    ` L ${finIX} ${finIY} A ${rayonInterne} ${rayonInterne} 0 ${grand} 0 ${debutIX} ${debutIY} Z`
  )
}

/**
 * The wedges for `valeurs`, in the order given.
 *
 * Zero-valued entries yield no wedge but keep their place in the returned array,
 * so the caller can zip the result against its own labels without re-indexing. A
 * total of zero yields no wedge at all rather than a full ring of nothing.
 *
 * The gap is not applied to a wedge too narrow to survive it: eating 1° out of a
 * 1,5° slice would leave a sliver, and a slice that exists must be visible.
 */
export function secteurs(
  valeurs: readonly number[],
  reglages: ReglagesDonut,
): readonly Secteur[] {
  const total = valeurs.reduce((somme, valeur) => somme + Math.max(0, valeur), 0)
  if (total <= 0) return valeurs.map(() => ({ d: '', part: 0, angleMilieu: 0 }))

  const positives = valeurs.filter((valeur) => valeur > 0).length
  if (positives === 1) {
    return valeurs.map((valeur) =>
      valeur > 0
        ? {
            d: anneauComplet(reglages.rayon, reglages.rayonInterne),
            part: 1,
            angleMilieu: 0,
          }
        : { d: '', part: 0, angleMilieu: 0 },
    )
  }

  let angle = 0
  return valeurs.map((valeur) => {
    const part = Math.max(0, valeur) / total
    const etendue = part * 360
    const debut = angle
    angle += etendue
    if (valeur <= 0) return { d: '', part: 0, angleMilieu: 0 }
    const marge = etendue > reglages.ecartDegres * 3 ? reglages.ecartDegres / 2 : 0
    return {
      d: secteur(debut + marge, debut + etendue - marge, reglages),
      part,
      angleMilieu: debut + etendue / 2,
    }
  })
}

/** « 23 % ». Rounded to the unit, and never to 0 % for a slice that exists: a
 * wedge the reader can see labelled 0 % reads as a rendering bug. */
export function formaterPart(part: number): string {
  if (part <= 0) return '0 %'
  const pourcent = part * 100
  return `${pourcent < 1 ? '< 1' : Math.round(pourcent)} %`
}
