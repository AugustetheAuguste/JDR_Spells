/**
 * Colour roles for the prerequisite-tree view (Cytoscape), resolved from the
 * CSS custom properties `styles/theme.css` already declares — never a
 * literal hex here (`lib/design/tokens.test.ts` greps for that everywhere
 * but `tokens.ts`/`theme.css`, and this module is not on that exception
 * list).
 *
 * Cytoscape does not interpret CSS variables itself (it draws to a canvas),
 * so its styles need plain resolved colour strings — the decision this ports
 * from `web/explorateur_dons.js`'s `lireRoles()` (lines ~856-1039), NOT the
 * code. There, and here, `getComputedStyle` is an explicit PARAMETER, never
 * the implicit browser global: reading `window.getComputedStyle` directly
 * would make the component that calls this un-renderable under jsdom, and
 * therefore untested.
 */

/** The minimal surface this module needs from a `CSSStyleDeclaration` — kept
 * narrow so a test can inject a fake without implementing the whole
 * interface. */
export type LecteurStyle = (element: Element) => Pick<CSSStyleDeclaration, 'getPropertyValue'>

export interface RolesGraphe {
  /** Node fill — `--color-surface`. */
  readonly fond: string
  /** Node label ink — `--color-encre`. */
  readonly texte: string
  /** Edge line — `--color-encre-douce`. */
  readonly arete: string
  /** Node border — `--color-bord-fort`. */
  readonly bord: string
  /** Selection / detail highlight — `--color-accent`. */
  readonly accent: string
}

/**
 * Resolve the five roles this view needs against `racine` (the component's
 * own root element, so a theme override scoped there — or on `<html>`, which
 * `racine` inherits from — is picked up without this module knowing where
 * the theme lives).
 */
export function lireRoles(racine: Element, lireStyle: LecteurStyle): RolesGraphe {
  const style = lireStyle(racine)
  const variable = (nom: string): string => style.getPropertyValue(`--color-${nom}`).trim()
  return {
    fond: variable('surface'),
    texte: variable('encre'),
    arete: variable('encre-douce'),
    bord: variable('bord-fort'),
    accent: variable('accent'),
  }
}

/** Whether `racine` sits under the night theme — a DOM attribute lookup
 * (`data-theme`, set on `<html>` before paint by the theme toggle), not a
 * style computation, so it needs no injected `getComputedStyle` of its own.
 * `VueArbre` uses this to pick `RAMPE_COUT` vs `RAMPE_COUT_NUIT` for node
 * fills, and to know when to re-resolve `lireRoles` after a toggle. */
export function themeNuit(racine: Element): boolean {
  return racine.closest('[data-theme="nuit"]') !== null
}
