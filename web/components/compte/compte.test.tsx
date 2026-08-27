import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * The unconfigured build, which is a supported state and not a failure.
 *
 * The mock is explicit rather than relying on the absence of `.env.local`: vitest
 * does not load Next's env files today, and a test that passes because of something
 * it does not assert stops passing for reasons nobody can find.
 */
vi.mock('@/lib/compte/configuration', () => ({
  COMPTES_ACTIFS: false,
  CONFIGURATION: null,
  lireConfiguration: () => null,
}))

const { VueCompte } = await import('@/components/compte/VueCompte')
const { traduireErreur } = await import('@/lib/compte/session')
const { FournisseurSession } = await import('@/lib/compte/session')

describe('VueCompte sans service configuré', () => {
  it('dit qu’aucun service n’est configuré, sans présenter cela comme une panne', () => {
    render(
      <FournisseurSession>
        <VueCompte />
      </FournisseurSession>,
    )
    expect(screen.getByText(/Aucun service de compte n’est configuré/)).toBeTruthy()
    // Et surtout : aucun formulaire, donc rien qui puisse échouer silencieusement.
    expect(screen.queryByLabelText('Mot de passe')).toBeNull()
  })

  it('rappelle que les favoris fonctionnent quand même, avant toute autre chose', () => {
    render(
      <FournisseurSession>
        <VueCompte />
      </FournisseurSession>,
    )
    expect(screen.getByText(/Les favoris fonctionnent sans compte/)).toBeTruthy()
  })
})

describe('traduireErreur', () => {
  it('traduit les deux échecs qui arrivent vraiment', () => {
    expect(traduireErreur('Invalid login credentials')).toContain('incorrect')
    expect(traduireErreur('Email not confirmed')).toContain('confirmé')
  })

  it('nomme le captcha, parce que personne ne se souvient l’avoir activé', () => {
    const message = traduireErreur('captcha verification process failed')
    expect(message).toContain('Attack Protection')
  })

  it('conserve le texte d’origine d’une cause inconnue au lieu de l’aplatir', () => {
    // Une erreur inconnue reste diagnosticable : « une erreur est survenue » ne
    // laisse rien à chercher.
    expect(traduireErreur('some brand new failure')).toContain('some brand new failure')
  })
})
