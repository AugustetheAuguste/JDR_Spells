'use client'

import { FournisseurSynchro } from '@/lib/compte/SynchroFavoris'
import { FournisseurPersonnageActif } from '@/lib/compte/contexte-personnages'
import { FournisseurSession } from '@/lib/compte/session'
import { FournisseurFavoris } from '@/lib/favoris/contexte'

import type { ReactNode } from 'react'

/**
 * The three providers, in the one order that works, and in a single place.
 *
 * They were composed inline in `app/layout.tsx`, and `FournisseurSynchro` was
 * simply left out of it. Nothing failed: `useSynchro()` fell through to its inert
 * default context, whose `resynchroniser` is a literal no-op, so the account signed
 * in and not one PostgREST request was ever sent. « Synchroniser maintenant »
 * called the default. Nothing in `lib/compte/` was broken — the tree never mounted
 * it, which is not the same thing and is far harder to see.
 *
 * Hence this file rather than a third line in the layout. The stack is now a
 * component that can be rendered on its own, so `fournisseurs.test.tsx` asserts the
 * wiring instead of asserting a provider the test mounted by hand. That distinction
 * is the whole lesson of the bug: 622 unit tests passed over a feature that had
 * never once run, because every one of them supplied the provider itself.
 *
 * The order is forced, not stylistic. `FournisseurSynchro` calls `useSession` and
 * `useFavoris`, so it has to sit inside both, and it has to sit inside rather than
 * beside them because both throw outside their provider. Favourites go inside the
 * session for the narrower reason: they do not read the session at all, so nesting
 * them keeps a sign-in from re-rendering more than it has to.
 *
 * `FournisseurPersonnageActif` (step 16) is the second consumer that
 * `personnages.ts`'s own docstring anticipated for promoting the character
 * roster into a context. It wraps `usePersonnages()` — left untouched, still
 * a plain hook, still exercised directly by `personnages.test.tsx` with no
 * provider — rather than replacing it, and sits inside `FournisseurSession`
 * for the same reason `FournisseurSynchro` does: it calls `usePersonnages()`,
 * which throws outside a session provider.
 */
export function Fournisseurs({ children }: { readonly children: ReactNode }) {
  return (
    <FournisseurSession>
      <FournisseurPersonnageActif>
        <FournisseurFavoris>
          <FournisseurSynchro>{children}</FournisseurSynchro>
        </FournisseurFavoris>
      </FournisseurPersonnageActif>
    </FournisseurSession>
  )
}
