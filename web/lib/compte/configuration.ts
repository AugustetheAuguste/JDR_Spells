/**
 * Whether accounts exist at all, decided at build time.
 *
 * The two variables are **optional**, and that is the load-bearing decision. A
 * clone with no `.env.local` still builds, still exports 2070 static pages, and
 * still keeps favourites in `localStorage` exactly as it did before accounts were
 * added — `/compte` simply says no service is configured. Without that, adding
 * accounts would have made the deployment depend on a secret, and CLAUDE.md § 11
 * is explicit that a deployment asking for a secret is the symptom, not the
 * configuration.
 *
 * Neither value is a secret: `NEXT_PUBLIC_*` is inlined into the client bundle at
 * build time, so both ship to every visitor. The publishable key opens only what
 * Row Level Security allows, which is why the schema puts a policy on all four
 * tables rather than trusting the client.
 */

export interface ConfigurationCompte {
  readonly url: string
  readonly cle: string
}

/**
 * Validate a candidate pair.
 *
 * Takes its two strings as arguments rather than reading `process.env` itself, so
 * the "half-configured" case is a test and not a hope — and because Next only
 * inlines `process.env.NEXT_PUBLIC_X` when it is written as a literal member
 * expression. An indexed lookup would compile to `undefined` in the browser.
 *
 * A URL present without a key is rejected rather than half-honoured: it would
 * produce a client that fails on every call, and a login screen that never works
 * is worse than a login screen that says it is not set up.
 */
export function lireConfiguration(
  url: string | undefined,
  cle: string | undefined,
): ConfigurationCompte | null {
  const urlNette = (url ?? '').trim()
  const cleNette = (cle ?? '').trim()
  if (urlNette === '' || cleNette === '') return null
  // Anything but https is refused: the key travels on every request, and a
  // mistyped `http://` would send it in clear. localhost is not excepted —
  // Supabase serves the hosted project over https in every environment.
  if (!urlNette.startsWith('https://')) return null
  return { url: urlNette.replace(/\/+$/, ''), cle: cleNette }
}

export const CONFIGURATION: ConfigurationCompte | null = lireConfiguration(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** True when this build has an account service behind it. Everything about the
 * interface that mentions a compte is gated on this. */
export const COMPTES_ACTIFS: boolean = CONFIGURATION !== null
