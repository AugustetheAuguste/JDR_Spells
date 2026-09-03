'use client'

import { FiltreFacetteDon } from '@/components/dons/FiltreFacetteDon'
import { GroupeDepliant } from '@/components/navigation/GroupeDepliant'
import { PastilleCout } from '@/components/dons/PastilleCout'
import { type EtatUrlDons, type VocabulaireDons } from '@/lib/navigation/etat-url'
import { COUT_DONS_MAX, type FacetteDon } from '@/lib/recherche/filtres'

/**
 * The dons facet panel — one `FiltreFacetteDon` per semantic facet (built on
 * `FiltreTags`'s exact three-state control), plus the cost picker.
 *
 * `semantiqueMasquee` hides every facet section at once — the degradation the
 * plan requires when the index carries no semantic tagging at all: an index
 * with every semantic field null still renders a usable page, just without a
 * facet that has nothing to filter on. The search box and the table are
 * unaffected.
 */

const TITRES: Readonly<Record<FacetteDon, string>> = {
  effet: 'Effet principal',
  effet2: 'Effets secondaires',
  cible: 'Cible du bonus',
  contexte: 'Contexte',
  activation: 'Activation',
  categorie: 'Catégorie officielle',
  // Deliberately never given visual prominence: 61 % of dons carry
  // `conditionnel`, measured in `OUTPUT_taxonomie_semantique.md` — a weak
  // facet, listed last and folded closed by default rather than dropped.
  polyvalence: 'Polyvalence',
}

const ORDRE: readonly FacetteDon[] = [
  'effet',
  'effet2',
  'cible',
  'contexte',
  'activation',
  'categorie',
  'polyvalence',
]

interface SelectionFacette {
  readonly connus: readonly string[]
  readonly tags: readonly string[]
  readonly exclus: readonly string[]
  readonly obliges: readonly string[]
}

function selectionDe(vocabulaire: VocabulaireDons, etat: EtatUrlDons, facette: FacetteDon): SelectionFacette {
  switch (facette) {
    case 'effet':
      return { connus: vocabulaire.effets, tags: etat.effets, exclus: etat.effetsExclus, obliges: etat.effetsObliges }
    case 'effet2':
      return {
        connus: vocabulaire.effets2,
        tags: etat.effets2,
        exclus: etat.effets2Exclus,
        obliges: etat.effets2Obliges,
      }
    case 'cible':
      return { connus: vocabulaire.cibles, tags: etat.cibles, exclus: etat.ciblesExclues, obliges: etat.ciblesObligees }
    case 'contexte':
      return {
        connus: vocabulaire.contextes,
        tags: etat.contextes,
        exclus: etat.contextesExclus,
        obliges: etat.contextesObliges,
      }
    case 'activation':
      return {
        connus: vocabulaire.activations,
        tags: etat.activations,
        exclus: etat.activationsExclues,
        obliges: etat.activationsObligees,
      }
    case 'polyvalence':
      return {
        connus: vocabulaire.polyvalences,
        tags: etat.polyvalences,
        exclus: etat.polyvalencesExclues,
        obliges: etat.polyvalencesObligees,
      }
    case 'categorie':
      return {
        connus: vocabulaire.categories,
        tags: etat.categories,
        exclus: etat.categoriesExclues,
        obliges: etat.categoriesObligees,
      }
  }
}

function auChamp(
  facette: FacetteDon,
  tags: readonly string[],
  exclus: readonly string[],
  obliges: readonly string[],
): Partial<EtatUrlDons> {
  switch (facette) {
    case 'effet':
      return { effets: tags, effetsExclus: exclus, effetsObliges: obliges }
    case 'effet2':
      return { effets2: tags, effets2Exclus: exclus, effets2Obliges: obliges }
    case 'cible':
      return { cibles: tags, ciblesExclues: exclus, ciblesObligees: obliges }
    case 'contexte':
      return { contextes: tags, contextesExclus: exclus, contextesObliges: obliges }
    case 'activation':
      return { activations: tags, activationsExclues: exclus, activationsObligees: obliges }
    case 'polyvalence':
      return { polyvalences: tags, polyvalencesExclues: exclus, polyvalencesObligees: obliges }
    case 'categorie':
      return { categories: tags, categoriesExclues: exclus, categoriesObligees: obliges }
  }
}

export function PanneauFiltresDons({
  vocabulaire,
  etat,
  semantiqueMasquee,
  coutMasque,
  compteDe,
  surEtat,
}: {
  readonly vocabulaire: VocabulaireDons
  readonly etat: EtatUrlDons
  /** True when the index carries no semantic tagging at all. */
  readonly semantiqueMasquee: boolean
  /** True when no don in the corpus has a computed cost yet (step 15/16 not
   * wired) — showing the picker would only ever empty the list. */
  readonly coutMasque: boolean
  /** `compterOptions` for one facet, already computed by the caller — this
   * panel never recounts, it only reads. */
  readonly compteDe: (facette: FacetteDon) => ReadonlyMap<string, number>
  readonly surEtat: (etat: EtatUrlDons) => void
}) {
  if (semantiqueMasquee && coutMasque) return null

  return (
    <div className="flex flex-col gap-4">
      {semantiqueMasquee
        ? null
        : ORDRE.map((facette) => {
            const { connus, tags, exclus, obliges } = selectionDe(vocabulaire, etat, facette)
            if (connus.length === 0) return null
            const comptes = compteDe(facette)
            const poses = new Set([...tags, ...exclus, ...obliges])
            // Every option a click could produce (non-zero count), plus
            // whatever is already posed — a posed option never disappears
            // just because the current selection now excludes it elsewhere.
            const options = connus.filter((v) => (comptes.get(v) ?? 0) > 0 || poses.has(v))
            return (
              <FiltreFacetteDon
                comptes={comptes}
                key={facette}
                options={options}
                tags={tags}
                tagsExclus={exclus}
                tagsObliges={obliges}
                titre={TITRES[facette]}
                surTags={(t, e, o) => surEtat({ ...etat, ...auChamp(facette, t, e, o) })}
              />
            )
          })}

      {coutMasque ? null : (
        <GroupeDepliant
          aide="Nombre exact d'emplacements pour décrocher le don, prérequis compris."
          poses={etat.cout === null ? 0 : 1}
          titre="Coût maximum"
          total={COUT_DONS_MAX}
        >
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: COUT_DONS_MAX }, (_, i) => i + 1).map((n) => (
              <label
                className={[
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-jeton border px-2 py-1 text-petit',
                  etat.cout === n
                    ? 'border-accent bg-accent-voile text-encre'
                    : 'border-bord bg-surface text-encre-douce hover:bg-survol',
                ].join(' ')}
                key={n}
              >
                <input
                  aria-label={`Coût maximum ${n}`}
                  checked={etat.cout === n}
                  className="size-3.5 accent-[var(--color-accent)]"
                  onChange={() => surEtat({ ...etat, cout: etat.cout === n ? null : n })}
                  type="checkbox"
                />
                <PastilleCout cout={n} />
              </label>
            ))}
          </div>
        </GroupeDepliant>
      )}
    </div>
  )
}
