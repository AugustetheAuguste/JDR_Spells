import { VueReinitialiser } from '@/components/compte/VueReinitialiser'

/**
 * Where the reset e-mail lands.
 *
 * `noindex`: the page is only ever reached with a one-time token in its URL, so a
 * search result for it can only ever be a dead end — and an indexed reset page
 * invites bots to hammer it.
 */
export const metadata = {
  title: 'Nouveau mot de passe',
  description: 'Choisir un nouveau mot de passe après avoir suivi le lien reçu par e-mail.',
  robots: { index: false, follow: false },
}

export default function PageReinitialiser() {
  return <VueReinitialiser />
}
