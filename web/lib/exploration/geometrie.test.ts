/**
 * The donut's arithmetic.
 *
 * Two of these are load-bearing rather than pedantic: the single-slice ring, which
 * SVG draws as nothing at all if written as one 360° arc, and the gap that must not
 * eat a slice narrower than itself. Both are states the data reaches routinely —
 * one school left standing, one spell out of five hundred.
 */

import { describe, expect, it } from 'vitest'

import { formaterPart, point, secteurs } from '@/lib/exploration/geometrie'

const REGLAGES = { rayon: 100, rayonInterne: 58, ecartDegres: 1.6 }

describe('point', () => {
  it('part de midi et tourne dans le sens horaire', () => {
    expect(point(100, 0)).toEqual([0, -100])
    expect(point(100, 90)).toEqual([100, 0])
    expect(point(100, 180)).toEqual([0, 100])
  })
})

describe('secteurs', () => {
  it('donne une part par valeur, dans l’ordre reçu', () => {
    const arcs = secteurs([3, 1], REGLAGES)
    expect(arcs).toHaveLength(2)
    expect(arcs[0]?.part).toBeCloseTo(0.75)
    expect(arcs[1]?.part).toBeCloseTo(0.25)
  })

  it('les parts totalisent 1 — c’est ce qui autorise un camembert', () => {
    const arcs = secteurs([5, 3, 2, 1], REGLAGES)
    const somme = arcs.reduce((total, arc) => total + arc.part, 0)
    expect(somme).toBeCloseTo(1)
  })

  it('une seule tranche donne un anneau complet, et pas un chemin vide', () => {
    // Written as a single 360° arc, start and end points coincide and SVG draws
    // nothing. The case appears as soon as a filter leaves one school standing.
    const [arc] = secteurs([7], REGLAGES)
    expect(arc?.part).toBe(1)
    expect(arc?.d).not.toBe('')
    // Two outer arcs and two inner ones: the ring is drawn in halves.
    expect(arc?.d.match(/A /g)).toHaveLength(4)
  })

  it('une valeur nulle ne dessine rien mais garde sa place', () => {
    const arcs = secteurs([4, 0, 2], REGLAGES)
    expect(arcs).toHaveLength(3)
    expect(arcs[1]?.d).toBe('')
    expect(arcs[0]?.part).toBeCloseTo(4 / 6)
    expect(arcs[2]?.part).toBeCloseTo(2 / 6)
  })

  it('un total nul ne dessine pas un anneau de rien', () => {
    expect(secteurs([0, 0], REGLAGES).every((arc) => arc.d === '')).toBe(true)
  })

  it('l’écart n’ampute pas une tranche plus fine que lui', () => {
    // 1 out of 500 spans 0,72° : taking 0,8° off each side would leave a sliver,
    // and a slice that exists has to be visible.
    const arcs = secteurs([499, 1], REGLAGES)
    expect(arcs[1]?.d).not.toBe('')
    expect(arcs[1]?.d).toContain('A 100 100')
  })

  it('pose le drapeau du grand arc au-delà d’un demi-tour', () => {
    const arcs = secteurs([9, 1], REGLAGES)
    // « 0 1 » = petit arc, « 1 1 » = grand arc. 90 % du cercle est un grand arc.
    expect(arcs[0]?.d).toContain('0 1 1 ')
    expect(arcs[1]?.d).toContain('0 0 1 ')
  })

  it('est déterministe à l’octet — même données, même chemin', () => {
    expect(secteurs([3, 2, 1], REGLAGES)).toEqual(secteurs([3, 2, 1], REGLAGES))
  })
})

describe('formaterPart', () => {
  it('arrondit à l’unité', () => {
    expect(formaterPart(0.234)).toBe('23 %')
    expect(formaterPart(1)).toBe('100 %')
  })

  it('n’écrit jamais 0 % pour une tranche qui existe', () => {
    // A visible wedge labelled 0 % reads as a rendering bug.
    expect(formaterPart(0.002)).toBe('< 1 %')
    expect(formaterPart(0)).toBe('0 %')
  })
})
