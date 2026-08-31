/**
 * The Supabase client, loaded on demand and only once.
 *
 * `import()` and not a static import, for the same reason the search engine is
 * lazy: most visits never touch an account, and the SDK is the largest single
 * dependency the site has. There is no weight budget to satisfy any more
 * (CLAUDE.md § 11) — this is done because it is free, not because it is measured.
 *
 * The promise is memoised rather than the client, so two components asking at the
 * same moment share one download and one client. Two clients would each keep their
 * own refresh timer against the same stored session, and race to rotate the
 * refresh token — which logs the user out.
 */

import { CONFIGURATION } from '@/lib/compte/configuration'

import type { SupabaseClient } from '@supabase/supabase-js'

let promesse: Promise<SupabaseClient> | null = null
let deja_averti = false

/**
 * Say out loud, once, that this build has no account service.
 *
 * The interface already says it on `/compte`, which is the honest place for it. The
 * console line is for the other case: a deployment where the two variables were
 * added to Vercel *after* the build that is live. `NEXT_PUBLIC_*` is inlined at
 * compile time, so the running bundle still has none, every account feature is a
 * silent no-op, and the only way to tell from the outside is that no request ever
 * leaves for `supabase.co`. Diagnosing an absence costs an hour; reading a line
 * costs none.
 *
 * Once, not per call: `obtenirClient` is called by every account action, and a
 * warning that repeats is a warning that gets filtered out.
 */
function avertirSansService(): void {
  if (deja_averti) return
  deja_averti = true
  console.warn(
    '[compte] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absentes de ' +
      'ce build : aucune synchronisation ne partira, les favoris restent locaux. ' +
      'Ces variables sont figées à la compilation — les ajouter à l’hébergeur ' +
      'exige un nouveau build, pas seulement un redéploiement.',
  )
}

/**
 * The one client, or null when this build has no account service.
 *
 * Returns null rather than throwing: "accounts are not configured" is a normal
 * state of this site, not an error, and every caller has a sensible thing to do
 * with it — stay local.
 */
export async function obtenirClient(): Promise<SupabaseClient | null> {
  if (CONFIGURATION === null) {
    avertirSansService()
    return null
  }
  if (promesse === null) {
    const configuration = CONFIGURATION
    promesse = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(configuration.url, configuration.cle, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The password-reset and email-confirmation links come back with their
          // token in the URL. This is what turns that URL into a session, and it
          // is why `/compte/reinitialiser/` needs no server: the exchange happens
          // in the browser.
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }),
    )
  }
  return promesse
}

/** Test-only reset: the memo is module-level, so it outlives a component tree. */
export function reinitialiserClient(): void {
  promesse = null
  deja_averti = false
}
