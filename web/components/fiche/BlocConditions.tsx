/**
 * One of the two condition blocks a don's sheet shows — never the two folded
 * into one.
 *
 * `raw_conditions` (`ton="source"`) is the CSV `Conditions` column, verbatim:
 * what an audit cites as the source of truth. `conditions_ajoutees`
 * (`ton="curation"`) is the hand-curated supplement read off the don's detail
 * page (`Data/dons/feat_prereq_supplements.json`, 47 dons augmented, 68
 * fragments) — a prerequisite the CSV omits. They are rendered by two separate
 * calls to this component, under two different headings, because 39 dons whose
 * page also mentions a prerequisite were *excluded* from the supplement
 * (`self_reference`, `proficiency`, `prose_permissive`, `variante_de_source`…),
 * and for `variante_de_source` specifically the page text *contradicts* the CSV
 * ("homme-lézard" vs "homme-serpent"). Concatenating the two blocks into one
 * paragraph would erase that boundary and, for a `variante_de_source` don,
 * fabricate an impossible condition — one no character could ever satisfy.
 *
 * `ton` is never carried by colour alone — the same principle this repository
 * already applies to the `manual_check` status (dashed border *and* a literal
 * "!"). Here the source/curation distinction is a dashed border for
 * `curation`, plus an explicit text label in the paragraph itself
 * ("Relevé sur la page du don, absent de la source ci-dessus" /
 * "Tel qu'écrit dans le catalogue"): a colourblind reader, or a printed page,
 * still gets the distinction.
 */
export function BlocConditions({
  titre,
  texte,
  ton,
  id,
}: {
  readonly titre: string
  readonly texte: string
  readonly ton: 'source' | 'curation'
  readonly id: string
}) {
  const classesBordure =
    ton === 'curation'
      ? 'border-dashed border-bord-fort bg-base'
      : 'border-bord bg-surface'

  const etiquette =
    ton === 'curation'
      ? 'Relevé sur la page du don, absent du catalogue source ci-dessus.'
      : 'Tel qu’écrit dans le catalogue (colonne « Conditions »).'

  return (
    <section
      aria-labelledby={id}
      className={`rounded-panneau border px-4 py-3 ${classesBordure}`}
    >
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id={id}>
        {titre}
      </h2>
      <p className="mt-1 mb-2 text-petit font-semibold text-encre-douce">{etiquette}</p>
      <p className="m-0 max-w-[68ch] text-corps">{texte}</p>
    </section>
  )
}
