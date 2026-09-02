/**
 * `BasculeTheme` had no dedicated test (`design/FOLLOWUPS.md`, audit étape 15).
 * It is the one control that guarantees "la nuit est un choix, jamais une
 * déduction" (CLAUDE.md §11, Skill) is an assertion and not just a sentence in
 * documentation.
 *
 * The grep against `prefers-color-scheme` is the only guard possible for that
 * claim: a `matchMedia('(prefers-color-scheme: dark)')` call is trivially
 * mocked in jsdom, so a test that stubbed it would prove the mock works, not
 * that the component reads the OS preference. Reading the module source is
 * uglier than a behavioural assertion, but it is the only check that cannot be
 * faked by a convenient mock.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BasculeTheme } from '@/components/primitives/BasculeTheme'
import { MOTS } from '@/lib/design/tokens'

const CLE_STOCKAGE = 'pf-theme'

afterEach(() => {
  window.localStorage.removeItem(CLE_STOCKAGE)
  delete document.documentElement.dataset.theme
})

describe('BasculeTheme', () => {
  it('rend « Thème jour » ou « Thème nuit », jamais un autre libellé', () => {
    render(<BasculeTheme />)
    const bouton = screen.getByRole('button')
    expect([MOTS.themeJour, MOTS.themeNuit]).toContain(bouton.textContent)
  })

  it('expose son état en aria-pressed', () => {
    // `aria-pressed` rather than `aria-checked`: this is a plain toggle button
    // (one control, one boolean), not a member of a `switch` or `radiogroup`
    // role — the WAI-ARIA "button (pressed)" pattern is the one that fits a
    // bare `<button>` with no group around it.
    render(<BasculeTheme />)
    const bouton = screen.getByRole('button')
    expect(bouton.getAttribute('aria-pressed')).not.toBeNull()
  })

  it('le clic écrit pf-theme dans localStorage', () => {
    render(<BasculeTheme />)
    fireEvent.click(screen.getByRole('button'))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toBe('nuit')
    fireEvent.click(screen.getByRole('button'))
    expect(window.localStorage.getItem(CLE_STOCKAGE)).toBe('jour')
  })

  it('le clic pose data-theme sur documentElement', () => {
    render(<BasculeTheme />)
    expect(document.documentElement.dataset.theme).toBeUndefined()
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.dataset.theme).toBe('nuit')
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('ne lit jamais prefers-color-scheme — une préférence système ne doit pas écraser un choix mémorisé', () => {
    const chemin = join(process.cwd(), 'components/primitives/BasculeTheme.tsx')
    const source = readFileSync(chemin, 'utf8')
    expect(source).not.toContain('prefers-color-scheme')
    expect(source).not.toContain('matchMedia')
  })
})
