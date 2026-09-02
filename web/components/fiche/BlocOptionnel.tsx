/**
 * A simple titled text block that renders nothing at all — no heading, no
 * empty panel — when its text is absent.
 *
 * Deliberately not `Description` (used on the spell sheet): that component
 * always renders its heading, falling back to an explanatory sentence when the
 * text is `null`, which is right for a spell (virtually every spell has real
 * description prose, so a missing one is worth calling out). A don's optional
 * blocks — "Spécial", "Normal" — are absent far more often and for an ordinary
 * reason (the wiki page simply has no such section), so an orphan heading over
 * "non renseigné" would be noise repeated across most of 1417 sheets rather
 * than a signal on the rare one. Hiding the whole block is what
 * "Ne pas afficher d'intertitre au-dessus d'un contenu vide" means here.
 */
export function BlocOptionnel({
  titre,
  texte,
  id,
}: {
  readonly titre: string
  readonly texte: string | null
  readonly id: string
}) {
  if (texte === null || texte.trim() === '') return null

  const paragraphes = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '')

  return (
    <section aria-labelledby={id}>
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id={id}>
        {titre}
      </h2>
      <div className="mt-2 max-w-[68ch] space-y-2.5 text-corps">
        {paragraphes.map((paragraphe, position) => (
          <p className="m-0" key={position}>
            {paragraphe}
          </p>
        ))}
      </div>
    </section>
  )
}
