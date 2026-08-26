/**
 * The description, as text.
 *
 * `description_html` exists in the props and is deliberately NOT used: rendering
 * wiki HTML would mean either trusting it or sanitising it, and the corpus is a
 * scrape of a site anyone can edit. The clean-text field carries everything a
 * reader needs, so the choice costs nothing but removes the whole class of
 * injection through a spell description.
 *
 * Paragraphs come from the newlines the parser preserved; blank runs collapse
 * rather than producing empty paragraphs.
 */
export function Description({
  texte,
  titre,
  id,
}: {
  readonly texte: string | null
  readonly titre: string
  readonly id: string
}) {
  if (texte === null || texte.trim() === '') {
    return (
      <section aria-labelledby={id}>
        <h2 className="m-0 font-affichage text-titre3 font-semibold" id={id}>
          {titre}
        </h2>
        <p className="mt-2 mb-0 text-corps text-encre-faible">
          La page d&apos;origine ne porte pas de texte de description exploitable.
        </p>
      </section>
    )
  }

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
          // The index is the key because the text is static build output: it is
          // never reordered, inserted into, or filtered client-side.
          <p className="m-0" key={position}>
            {paragraphe}
          </p>
        ))}
      </div>
    </section>
  )
}
