import { EditeurPersonnage } from '@/components/compte/EditeurPersonnage'
import { SelecteurPersonnageActif } from '@/components/compte/SelecteurPersonnageActif'
import { VuePersonnages } from '@/components/compte/VuePersonnages'
import { Emplacements } from '@/components/dons/Emplacements'

export const metadata = {
  title: 'Personnages',
  description: 'Créer et gérer les personnages attachés à un compte.',
}

/**
 * `VuePersonnages` (the roster: create/rename/retire/delete) is untouched —
 * it neither reads nor writes the active-character context, and
 * `personnages.test.tsx` exercises it standalone with no provider mounted.
 * The active-character panel below it is what step 16 adds: pick one, edit
 * the fields feat eligibility reads, fill its slots. All three read the same
 * `usePersonnageActif()` declared once in `Fournisseurs.tsx`.
 */
export default function PagePersonnages() {
  return (
    <>
      <VuePersonnages />
      <section className="mt-8 flex flex-col gap-6">
        <h2 className="m-0 font-affichage text-titre2 font-semibold">Personnage actif</h2>
        <SelecteurPersonnageActif />
        <div>
          <h3 className="m-0 mb-2 font-affichage text-titre3 font-semibold">
            Champs d’éligibilité
          </h3>
          <EditeurPersonnage />
        </div>
        <div>
          <h3 className="m-0 mb-2 font-affichage text-titre3 font-semibold">
            Emplacements de dons
          </h3>
          <Emplacements />
        </div>
      </section>
    </>
  )
}
