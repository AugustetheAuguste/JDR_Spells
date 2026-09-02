import type { StatutDon } from '@/lib/recherche/filtres'

/**
 * The tri-state eligibility verdict, on `MarqueurDesaccord.tsx`'s precedent.
 *
 * `manual_check` — the engine could not decide — is NEVER told apart from the
 * other two by colour alone: it carries a dashed border and a literal "!" plus
 * the word "à vérifier", exactly as `MarqueurDesaccord` marks a level
 * disagreement with wording rather than a warning colour. The reason is the
 * same maxim that governs every gating layer in the source repository: **une
 * sous-attribution est bien plus grave qu'une sur-attribution.** A colourblind
 * reader, or anyone with the theme's colour turned off, must still be able to
 * tell a feat the engine refused (`ineligible`) from one it could not decide
 * (`manual_check`) — conflating the two hides exactly the feats a player is
 * allowed to attempt.
 *
 * `manual_check` stays visible and selectable everywhere this marker is used;
 * nothing here excludes it from a default view.
 */
export function MarqueurStatut({ statut }: { readonly statut: StatutDon }) {
  if (statut === 'eligible') {
    return (
      <span className="inline-flex items-center rounded-jeton border border-accent bg-accent-voile px-1.5 py-0.5 text-micro font-medium text-accent">
        éligible
      </span>
    )
  }

  if (statut === 'manual_check') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-jeton border border-dashed border-bord-fort bg-surface px-1.5 py-0.5 text-micro font-medium text-encre"
        title="Le moteur n’a pas pu trancher ce prérequis — à vérifier à la table."
      >
        <span aria-hidden="true">!</span>
        à vérifier
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-jeton border border-bord bg-base px-1.5 py-0.5 text-micro font-medium text-encre-faible">
      inéligible
    </span>
  )
}
