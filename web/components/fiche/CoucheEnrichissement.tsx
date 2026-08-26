import { Badge } from '@/components/primitives/Badge'
import type { Enrichissement } from '@/lib/donnees/sort-page'

/**
 * The LLM layer, fenced off and labelled as machine-written.
 *
 * The separation is the whole point. Mixing this into the wiki's own text would
 * blur what came from the source with what came from a model, and the reader
 * would have no way to tell — which is worse than not showing it at all. So it
 * sits in its own bordered block, after the description, under a heading that
 * says where it comes from, and it names the model and the date.
 *
 * There is no "verified by a human" badge, and there cannot be: the enrichment
 * schema admits exactly sixteen keys and `verifie_par_humain` is not one of them.
 * Its absence is a decision, not an oversight — declaring a record reviewed makes
 * it *invalid* rather than trusted (CLAUDE.md § 10). The step plan asks for such
 * a badge; showing one would mean inventing the field it reads, so the block
 * states what is actually knowable instead.
 *
 * `notes_ambiguite`, when present, is shown rather than hidden: it is the model
 * saying it had to choose, and a reader deciding whether to trust a category
 * deserves to know that.
 */

/** Taxonomy keys are machine slugs (`divination_information`); the closed lists
 * ship definitions but no display labels, so the slug is unfolded rather than
 * dressed up with a mapping this module would have to keep in step. */
function lisible(cle: string): string {
  return cle.replace(/_/g, ' ')
}

function ListeJetons({
  titre,
  valeurs,
}: {
  readonly titre: string
  readonly valeurs: readonly string[]
}) {
  if (valeurs.length === 0) return null
  return (
    <div>
      <dt className="text-petit font-semibold text-encre-douce">{titre}</dt>
      <dd className="m-0 mt-1 flex flex-wrap gap-1">
        {valeurs.map((valeur) => (
          <Badge key={valeur}>{lisible(valeur)}</Badge>
        ))}
      </dd>
    </div>
  )
}

function LigneTexte({
  titre,
  valeur,
}: {
  readonly titre: string
  readonly valeur: string | null
}) {
  if (valeur === null) return null
  return (
    <div>
      <dt className="text-petit font-semibold text-encre-douce">{titre}</dt>
      <dd className="m-0 mt-1 text-corps">{lisible(valeur)}</dd>
    </div>
  )
}

export function CoucheEnrichissement({
  enrichissement,
}: {
  readonly enrichissement: Enrichissement | null
}) {
  // No empty section: a spell without an enrichment shows nothing here at all,
  // rather than a heading over a blank.
  if (enrichissement === null) return null

  const date = enrichissement.genere_le.slice(0, 10)

  return (
    <section
      aria-labelledby="titre-enrichissement"
      className="rounded-panneau border border-dashed border-bord-fort bg-base px-4 py-3"
    >
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-enrichissement">
        Classement automatique
      </h2>
      <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">
        Cette section n&apos;est <strong>pas</strong> tirée du wiki : elle a été rédigée
        par un modèle de langage ({enrichissement.modele}) le {date}, pour rendre le
        corpus filtrable. Elle n&apos;a pas été relue par un humain. En cas d&apos;écart,
        c&apos;est la description ci-dessus qui fait foi.
      </p>

      {enrichissement.resume_court === null ? null : (
        <p className="mt-0 mb-3 max-w-[68ch] text-corps">{enrichissement.resume_court}</p>
      )}

      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LigneTexte titre="Catégorie" valeur={enrichissement.categorie_principale} />
        <LigneTexte titre="Cible typique" valeur={enrichissement.cible_typique} />
        <LigneTexte titre="Type de dégâts" valeur={enrichissement.type_degats} />
        <ListeJetons titre="Rôles tactiques" valeurs={enrichissement.roles_tactiques} />
        <ListeJetons titre="Conditions infligées" valeurs={enrichissement.condition_infligee} />
        <ListeJetons titre="Tags" valeurs={enrichissement.tags} />
      </dl>

      {enrichissement.notes_ambiguite === null ? null : (
        <p className="mt-3 mb-0 max-w-[68ch] text-petit text-encre-douce">
          <strong>Choix signalé comme ambigu :</strong> {enrichissement.notes_ambiguite}
        </p>
      )}
    </section>
  )
}
