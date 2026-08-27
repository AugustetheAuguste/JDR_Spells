import { VueCompte } from '@/components/compte/VueCompte'

/**
 * The account route.
 *
 * Statically exported like every other page: the shell is prerendered, and
 * everything about a session happens in the browser. No `Suspense` boundary — this
 * view reads no query string, and its asynchrony is a network call the client
 * component owns rather than a render the framework has to wait on.
 */
export const metadata = {
  title: 'Compte',
  description:
    'Créer un compte ou se connecter pour retrouver ses listes de favoris sur ' +
    'plusieurs appareils. Les favoris fonctionnent aussi sans compte.',
}

export default function PageCompte() {
  return <VueCompte />
}
