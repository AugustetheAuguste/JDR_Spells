import { describe, expect, it } from 'vitest'

import { lireConfiguration } from '@/lib/compte/configuration'

/**
 * The point of these cases is that "no accounts" is a supported build, not a
 * failure. If `lireConfiguration` ever started throwing or half-honouring a pair,
 * a clone without `.env.local` would stop building — and CLAUDE.md § 11 is explicit
 * that the deployment must not depend on a secret.
 */
describe('lireConfiguration', () => {
  it('rend null quand rien n’est configuré : c’est un build valide, pas une panne', () => {
    expect(lireConfiguration(undefined, undefined)).toBeNull()
    expect(lireConfiguration('', '')).toBeNull()
  })

  it('refuse une paire à moitié remplie plutôt que de la moitié honorer', () => {
    // Un client construit sur une URL sans clé échouerait à chaque appel : un
    // écran de connexion qui ne marche jamais est pire qu'un écran qui dit qu'il
    // n'est pas configuré.
    expect(lireConfiguration('https://x.supabase.co', undefined)).toBeNull()
    expect(lireConfiguration(undefined, 'sb_publishable_x')).toBeNull()
  })

  it('refuse une URL non https : la clé part à chaque requête', () => {
    expect(lireConfiguration('http://x.supabase.co', 'sb_publishable_x')).toBeNull()
  })

  it('accepte une paire complète et retire le slash final', () => {
    expect(lireConfiguration('https://x.supabase.co/', ' sb_publishable_x ')).toEqual({
      url: 'https://x.supabase.co',
      cle: 'sb_publishable_x',
    })
  })
})
