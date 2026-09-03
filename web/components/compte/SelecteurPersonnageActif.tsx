'use client'

import Link from 'next/link'

import { usePersonnageActif } from '@/lib/compte/contexte-personnages'
import { useSession, type StatutSession } from '@/lib/compte/session'

/**
 * The one selector shared by `/sorts` and `/dons` — proof, per the plan's
 * verification criterion 2, that the two pages read the SAME active
 * character: this component holds no state of its own, it only reads and
 * writes `usePersonnageActif()`, which is declared once in
 * `Fournisseurs.tsx`.
 *
 * Used to render nothing when there is no roster to pick from — silence,
 * not just an empty dropdown. That hid the whole feature: a signed-out
 * visitor or a signed-in account with no character yet saw no button, no
 * link, nothing pointing at `/compte/personnages`. The two guards below
 * replace that silence with an explicit call to action, reusing the exact
 * `statut === 'connecte'` gate `VuePersonnages.tsx` already applies rather
 * than inventing a second one (CLAUDE.md §14's parity concern, same
 * register even though the registry here is components, not engines).
 */
export function SelecteurPersonnageActif() {
  const { personnages, personnageActifId, selectionnerPersonnage } = usePersonnageActif()

  // `useSession()` throws outside `FournisseurSession` by design (see its own
  // docstring), unlike `usePersonnageActif()`'s inert default — and
  // `navigation.test.tsx`/`VueDons.test.tsx` mount this component without
  // that provider. The try/catch is the same shape of degradation
  // `contexte-personnages.tsx` already applies to `useRouter`/
  // `useSearchParams`: a missing provider falls back to the pre-existing
  // behaviour (dropdown if there is a roster, silence otherwise) instead of
  // crashing the page.
  let statut: StatutSession | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    statut = useSession().statut
  } catch {
    statut = null
  }

  if (statut === 'connecte' && personnages.length === 0) {
    return (
      <p className="text-corps text-encre-douce">
        Aucun personnage encore créé.{' '}
        <Link className="text-accent underline" href="/compte/personnages">
          Créer un personnage
        </Link>
      </p>
    )
  }

  if (statut === 'deconnecte') {
    return (
      <p className="text-corps text-encre-douce">
        Connectez-vous pour créer un personnage et filtrer les dons par éligibilité.{' '}
        <Link className="text-accent underline" href="/compte">
          Se connecter
        </Link>
      </p>
    )
  }

  // `statut === 'inconnu'` (session restoring), `statut === 'hors_service'`
  // (no accounts service configured at all — "se connecter" would be a dead
  // end, exactly as `VuePersonnages.tsx` treats it as a distinct case rather
  // than folding it into "deconnecte"), or a residual, practically
  // unreachable case (statut === 'connecte' with a stale empty roster read):
  // none of these is worth a call to action here.
  if (personnages.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-corps text-encre-douce">
      <label className="font-medium" htmlFor="selecteur-personnage-actif">
        Personnage
      </label>
      <select
        className="rounded-jeton border border-bord-fort bg-surface px-2 py-1 text-corps text-encre"
        id="selecteur-personnage-actif"
        onChange={(evenement) => selectionnerPersonnage(evenement.target.value === '' ? null : evenement.target.value)}
        value={personnageActifId ?? ''}
      >
        <option value="">— aucun —</option>
        {personnages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nom}
          </option>
        ))}
      </select>
      <Link className="text-petit text-accent underline" href="/compte/personnages">
        modifier ses champs
      </Link>
    </div>
  )
}
