import { Badge } from '@/components/primitives/Badge'

/**
 * The don's semantic facets — effet principal, cible du bonus, contexte,
 * activation, valeur du bonus, catégorie officielle — each hidden individually
 * when its code resolved to `null`/`[]`, the whole section hidden when every
 * one of them did (the "don entièrement non étiqueté" case,
 * `05_WEB_INDEX_CONTRACT`'s fixture grid).
 *
 * `polyvalence` is read off the index (`EntreeDon.pv`) but never surfaced here
 * on purpose: it is `conditionnel` for 61 % of the catalogue
 * (`OUTPUT_taxonomie_semantique.md`), a weak facet by measurement, not by
 * oversight.
 *
 * No eligibility status appears anywhere in this section, or on this page: the
 * sheet describes a don, not a character's access to it (that lands in step
 * 16).
 */
export function FacettesSemantiques({
  effetPrincipal,
  effetsSecondaires,
  ciblesBonus,
  contextes,
  activation,
  valeurBonus,
  categories,
}: {
  readonly effetPrincipal: string | null
  readonly effetsSecondaires: readonly string[]
  readonly ciblesBonus: readonly string[]
  readonly contextes: readonly string[]
  readonly activation: string | null
  readonly valeurBonus: string | null
  readonly categories: readonly string[]
}) {
  const rien =
    effetPrincipal === null &&
    effetsSecondaires.length === 0 &&
    ciblesBonus.length === 0 &&
    contextes.length === 0 &&
    activation === null &&
    valeurBonus === null &&
    categories.length === 0

  // No empty section: an entirely unlabelled don (the LLM enrichment layer
  // never reached it) shows nothing here at all, not a heading over a blank —
  // same convention as `CoucheEnrichissement`.
  if (rien) return null

  return (
    <section aria-labelledby="titre-facettes">
      <h2 className="m-0 font-affichage text-titre3 font-semibold" id="titre-facettes">
        Classement
      </h2>
      <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">
        Étiquetage automatique par un modèle de langage, pour rendre le catalogue
        filtrable — pas une lecture de la source elle-même.
      </p>
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {effetPrincipal === null ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Effet principal</dt>
            <dd className="m-0 mt-1 text-corps">{effetPrincipal}</dd>
          </div>
        )}
        {effetsSecondaires.length === 0 ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Effets secondaires</dt>
            <dd className="m-0 mt-1 flex flex-wrap gap-1">
              {effetsSecondaires.map((valeur) => (
                <Badge key={valeur}>{valeur}</Badge>
              ))}
            </dd>
          </div>
        )}
        {ciblesBonus.length === 0 ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Cible du bonus</dt>
            <dd className="m-0 mt-1 flex flex-wrap gap-1">
              {ciblesBonus.map((valeur) => (
                <Badge key={valeur} ton="donnees">
                  {valeur}
                </Badge>
              ))}
            </dd>
          </div>
        )}
        {contextes.length === 0 ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Contexte</dt>
            <dd className="m-0 mt-1 flex flex-wrap gap-1">
              {contextes.map((valeur) => (
                <Badge key={valeur}>{valeur}</Badge>
              ))}
            </dd>
          </div>
        )}
        {activation === null ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Activation</dt>
            <dd className="m-0 mt-1 text-corps">{activation}</dd>
          </div>
        )}
        {valeurBonus === null ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Valeur du bonus</dt>
            <dd className="m-0 mt-1 font-donnees text-corps">{valeurBonus}</dd>
          </div>
        )}
        {categories.length === 0 ? null : (
          <div>
            <dt className="text-petit font-semibold text-encre-douce">Catégorie officielle</dt>
            <dd className="m-0 mt-1 flex flex-wrap gap-1">
              {categories.map((valeur) => (
                <Badge key={valeur} ton="accent">
                  {valeur}
                </Badge>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
