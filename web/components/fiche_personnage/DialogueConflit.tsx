'use client'

import { useEffect, useRef } from 'react'

import { MOTS } from '@/lib/design/tokens'

import type { Conflit } from '@/lib/fiche_personnage/fusion'
import type { ChoixConflit } from '@/lib/fiche_personnage/SynchroFiches'
import type { Fiche } from '@/lib/fiche_personnage/schema'

/** Top-level sections compared side by side. Anything not named here (the
 * schema version, the id) is not something a human resolves by reading a
 * diff, so it is left out rather than shown as noise. */
const SECTIONS: readonly (readonly [string, keyof Fiche])[] = [
  [MOTS.sectionIdentite, 'identite'],
  [MOTS.sectionCaracteristiques, 'caracteristiques'],
  [MOTS.sectionCombat, 'combat'],
  [MOTS.sectionDefense, 'defense'],
  [MOTS.sectionSauvegardes, 'sauvegardes'],
  [MOTS.sectionAttaques, 'attaques'],
  [MOTS.sectionCompetences, 'competences'],
  [MOTS.sectionDons, 'dons'],
  [MOTS.sectionAptitudes, 'aptitudes'],
  [MOTS.sectionSorts, 'sorts'],
  [MOTS.sectionEquipement, 'equipement'],
  [MOTS.sectionNotes, 'notes'],
]

function memeValeur(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Shows a sheet that differs on both sides, section by section, and asks a
 * human to pick — this dialog never resolves anything on its own, on the
 * model of `fusion.ts`'s refusal to guess between two edited contents.
 *
 * No option is preselected, and the dialog never closes itself: a click on
 * one of the three buttons is the only way out, exactly as
 * `DialogueSuppression.tsx` never defaults its own confirmation.
 */
export function DialogueConflit({
  conflit,
  declencheur,
  onChoisir,
}: {
  readonly conflit: Conflit | null
  readonly declencheur: HTMLElement | null
  readonly onChoisir: (choix: ChoixConflit) => void
}) {
  const refBoite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (conflit === null) return

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key !== 'Tab') return
      const boite = refBoite.current
      if (boite === null) return
      const focusables = boite.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const premier = focusables[0]!
      const dernier = focusables[focusables.length - 1]!
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier.focus()
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }
    // No key closes the dialog and no element receives focus on open: an
    // unresolved conflict has no safe default, unlike a delete confirmation
    // whose safe default is "cancel". Escape is deliberately not wired here.
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [conflit])

  const etaitOuvert = useRef(false)
  useEffect(() => {
    const ouvert = conflit !== null
    if (etaitOuvert.current && !ouvert) {
      declencheur?.focus()
    }
    etaitOuvert.current = ouvert
  }, [conflit, declencheur])

  if (conflit === null) return null

  const distante = conflit.distante.contenu as unknown as Fiche

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-encre/40">
      <div
        aria-labelledby="dialogue-conflit-titre"
        aria-modal="true"
        className="max-h-[80vh] w-full max-w-[68ch] overflow-y-auto border border-bord bg-surface p-4"
        ref={refBoite}
        role="dialog"
      >
        <h2 className="font-affichage text-titre3 text-encre" id="dialogue-conflit-titre">
          {MOTS.ficheSynchroConflitTitre}
        </h2>
        <p className="mt-2 text-corps text-encre-douce">{MOTS.ficheSynchroConflitTexte}</p>

        <table className="mt-4 w-full border-collapse text-petit">
          <thead>
            <tr>
              <th className="border-b border-bord px-2 py-1 text-left text-encre-douce"> </th>
              <th className="border-b border-bord px-2 py-1 text-left text-encre-douce">
                {MOTS.ficheSynchroConflitColonneLocale}
              </th>
              <th className="border-b border-bord px-2 py-1 text-left text-encre-douce">
                {MOTS.ficheSynchroConflitColonneDistante}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="border-b border-bord px-2 py-1 text-left text-encre">Nom</th>
              <td className="border-b border-bord px-2 py-1 text-encre">
                {conflit.locale.meta.nomPersonnage}
              </td>
              <td className="border-b border-bord px-2 py-1 text-encre">
                {distante.meta.nomPersonnage}
              </td>
            </tr>
            <tr>
              <th className="border-b border-bord px-2 py-1 text-left text-encre">Modifiée</th>
              <td className="border-b border-bord px-2 py-1 text-encre">
                {conflit.locale.meta.modifieLe}
              </td>
              <td className="border-b border-bord px-2 py-1 text-encre">{distante.meta.modifieLe}</td>
            </tr>
            {SECTIONS.map(([libelle, cle]) => {
              const identiques = memeValeur(conflit.locale[cle], distante[cle])
              return (
                <tr key={cle}>
                  <th className="border-b border-bord px-2 py-1 text-left text-encre">{libelle}</th>
                  <td className="border-b border-bord px-2 py-1 text-encre">
                    {identiques ? MOTS.ficheSynchroConflitColonneLocale : 'différent'}
                  </td>
                  <td className="border-b border-bord px-2 py-1 text-encre">
                    {identiques ? MOTS.ficheSynchroConflitColonneDistante : 'différent'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            className="min-h-cible min-w-cible border border-bord-fort px-3 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onChoisir('locale')}
            type="button"
          >
            {MOTS.ficheSynchroConflitGarderLocale}
          </button>
          <button
            className="min-h-cible min-w-cible border border-bord-fort px-3 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onChoisir('distante')}
            type="button"
          >
            {MOTS.ficheSynchroConflitGarderDistante}
          </button>
          <button
            className="min-h-cible min-w-cible bg-accent px-3 text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onChoisir('les_deux')}
            type="button"
          >
            {MOTS.ficheSynchroConflitGarderLesDeux}
          </button>
        </div>
      </div>
    </div>
  )
}
