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

/**
 * The one client, or null when this build has no account service.
 *
 * Returns null rather than throwing: "accounts are not configured" is a normal
 * state of this site, not an error, and every caller has a sensible thing to do
 * with it — stay local.
 */
export async function obtenirClient(): Promise<SupabaseClient | null> {
  if (CONFIGURATION === null) return null
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
}
