/**
 * Waiting page for the character sheet section.
 *
 * The header's « Personnages » menu already links here (step 03) so the
 * navigation never points at a 404 while the section itself waits for a
 * later step (14) to fill it in. Nothing else lives here yet.
 */
export const metadata = {
  title: 'Mes fiches',
  description: 'La section des fiches de personnage arrive dans une étape suivante.',
}

export default function PagePersonnages() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="font-affichage text-titre2 font-semibold text-encre">Mes fiches</h1>
      <p className="mt-3 text-corps text-encre-douce">
        Cette section arrive dans une étape suivante. Elle listera vos fiches de personnage.
      </p>
    </div>
  )
}
