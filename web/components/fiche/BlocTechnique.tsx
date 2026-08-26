import { MOTS } from '@/lib/design/tokens'

/**
 * The stat block, as a description list.
 *
 * A `<dl>` and not a table: these are label/value pairs about one subject, which
 * is what a definition list is for, and it degrades to something readable when
 * the viewport is narrow.
 *
 * The null policy is the corpus's own and is visible here: `null` means the
 * source did not state the field, rendered as an em dash with a title saying so.
 * An empty string is NOT the same thing and is not folded into it — the wiki
 * writes an empty value where it means "none", and turning that into « — » would
 * report a gap in the source where there is none. No field is omitted, because a
 * missing row reads as "not applicable" when it means "absent".
 */
export interface LigneTechnique {
  readonly libelle: string
  readonly valeur: string | null
}

function Valeur({ valeur }: { readonly valeur: string | null }) {
  if (valeur === null) {
    return (
      <span className="text-encre-faible" title="Non renseigné par la source">
        —
      </span>
    )
  }
  if (valeur === '') {
    // Distinguished from null on purpose: the source wrote a value, and it was
    // empty. Saying "not stated" here would put words in the wiki's mouth.
    return (
      <span className="text-encre-faible" title="Renseigné vide par la source">
        (vide)
      </span>
    )
  }
  return <span>{valeur}</span>
}

export function BlocTechnique({ lignes }: { readonly lignes: readonly LigneTechnique[] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,11rem)_1fr]">
      {lignes.map((ligne) => (
        <div className="contents" key={ligne.libelle}>
          <dt className="text-petit font-semibold text-encre-douce sm:text-right">
            {ligne.libelle}
          </dt>
          <dd className="m-0 text-corps">
            <Valeur valeur={ligne.valeur} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The seven fields of the wiki's stat block, in the order the wiki writes them.
 * School and level are not among them: the school is in the header pastille, and
 * the level does not exist as a single value (B4). */
export function lignesTechniques(sort: {
  readonly temps_incantation: string | null
  readonly composantes: string | null
  readonly portee: string | null
  readonly cible: string | null
  readonly duree: string | null
  readonly jet_de_sauvegarde: string | null
  readonly resistance_magie: string | null
}): LigneTechnique[] {
  return [
    { libelle: "Temps d'incantation", valeur: sort.temps_incantation },
    { libelle: 'Composantes', valeur: sort.composantes },
    { libelle: 'Portée', valeur: sort.portee },
    { libelle: 'Cible, effet ou zone', valeur: sort.cible },
    { libelle: 'Durée', valeur: sort.duree },
    { libelle: 'Jet de sauvegarde', valeur: sort.jet_de_sauvegarde },
    { libelle: MOTS.resistanceMagie[0]!.toUpperCase() + MOTS.resistanceMagie.slice(1), valeur: sort.resistance_magie },
  ]
}
