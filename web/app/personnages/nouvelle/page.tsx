/**
 * Waiting page for the new character sheet flow.
 *
 * Same purpose as `app/personnages/page.tsx` — see that file's docstring.
 */
export const metadata = {
  title: 'Nouvelle fiche',
  description: 'La création de fiche de personnage arrive dans une étape suivante.',
}

export default function PageNouvellePersonnage() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="font-affichage text-titre2 font-semibold text-encre">Nouvelle fiche</h1>
      <p className="mt-3 text-corps text-encre-douce">
        Cette section arrive dans une étape suivante. Elle proposera de créer une fiche de
        personnage.
      </p>
    </div>
  )
}
