import type { NiveauClasse } from '@/lib/donnees/sort-page'

/**
 * One row per class that gets the spell, class then level.
 *
 * This is the detail page's answer to B4, and it is the reason the page does not
 * carry a « Niveau » field in its technical block: there is no such number. A
 * spell is level 2 for the bard and 3 for the wizard, and both rows are shown
 * because both are true — reducing them to a single figure, or to a range, would
 * hide which class the number belongs to and mislead exactly at the table.
 *
 * Sorted by level and then by class name, French-collated: someone reading a
 * spell wants to know how early they get it, and the accented class names
 * (`Prêtre/Prêtre combattant/Oracle`) sort wrong by code point.
 */
export function NiveauxParClasse({
  niveaux,
}: {
  readonly niveaux: Readonly<Record<string, NiveauClasse>>
}) {
  const lignes = Object.entries(niveaux).sort(
    ([, a], [, b]) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, 'fr'),
  )

  if (lignes.length === 0) {
    return (
      <section aria-labelledby="titre-niveaux">
        <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-niveaux">
          Niveaux par classe
        </h2>
        <p className="mt-2 mb-0 max-w-[68ch] text-corps text-encre-douce">
          Aucune liste de classe du corpus ne revendique ce sort. Il est décrit par sa
          page, mais aucune classe ne l&apos;obtient d&apos;après les listes recensées.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="titre-niveaux">
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-niveaux">
        Niveaux par classe
      </h2>
      <p className="mt-1 mb-2 text-petit text-encre-douce">
        Le niveau d&apos;un sort dépend de la classe qui le lance : il n&apos;y a pas un
        niveau, il y en a un par classe.
      </p>
      <div className="overflow-x-auto rounded-panneau border border-bord bg-surface">
        <table className="w-full border-collapse text-corps">
          <caption className="sr-only">
            Niveau de ce sort pour chaque classe qui le reçoit
          </caption>
          <thead>
            <tr>
              <th
                className="border-b border-bord px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce"
                scope="col"
              >
                Classe
              </th>
              <th
                className="border-b border-bord px-2.5 py-1.5 text-right text-petit font-semibold text-encre-douce"
                scope="col"
                style={{ width: '6rem' }}
              >
                Niveau
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([slug, entree]) => (
              <tr className="h-ligne border-b border-bord last:border-b-0" key={slug}>
                <th className="px-2.5 py-1.5 text-left font-normal" scope="row">
                  {entree.nom}
                </th>
                <td className="px-2.5 py-1.5 text-right font-donnees">{entree.niveau}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
