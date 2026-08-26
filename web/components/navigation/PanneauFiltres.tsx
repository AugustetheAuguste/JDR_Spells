'use client'

import { FiltreTags } from '@/components/navigation/FiltreTags'
import { Badge } from '@/components/primitives/Badge'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { LIBELLES_ECOLES, type Ecole } from '@/lib/design/tokens'
import type { IndexWeb } from '@/lib/donnees/index-web'
import { type EtatUrl, NIVEAU_MAX } from '@/lib/navigation/etat-url'
import { grouperClasses } from '@/lib/navigation/groupes-classes'
import { libelleNiveau } from '@/lib/navigation/niveaux'

/**
 * The filter panel.
 *
 * Two things are deliberate about its layout. The class selector comes first and
 * is visually heavier than everything below it, because the level filter under it
 * only means anything relative to that choice — the hierarchy on screen has to
 * state the dependency in the data (B4). And the tag section is not rendered at
 * all when `index.tags` is empty: an empty filter section invites the user to
 * look for a control that is not there, which is worse than the absence.
 *
 * Filters are checkbox groups in `fieldset`s, not custom widgets. A native
 * checkbox is already keyboard-reachable, already announced with its group name,
 * and already understood; a div with `role="checkbox"` is three bugs waiting.
 */

function Groupe({
  legende,
  aide,
  children,
}: {
  readonly legende: string
  readonly aide?: string
  readonly children: React.ReactNode
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-petit font-semibold text-encre-douce">{legende}</legend>
      {aide === undefined ? null : (
        <p className="mt-0 mb-1.5 text-micro text-encre-faible">{aide}</p>
      )}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

function CaseJeton({
  coche,
  libelle,
  surChangement,
  children,
}: {
  readonly coche: boolean
  readonly libelle: string
  readonly surChangement: (coche: boolean) => void
  readonly children?: React.ReactNode
}) {
  return (
    <label
      className={[
        'inline-flex cursor-pointer items-center gap-1.5 rounded-jeton border px-2 py-1 text-petit',
        coche
          ? 'border-accent bg-accent-voile text-encre'
          : 'border-bord bg-surface text-encre-douce hover:bg-survol',
      ].join(' ')}
    >
      <input
        // The visible content may be a bare glyph — a level digit, a component
        // letter — which announces as "V" to a screen reader and means nothing.
        // `libelle` is the spoken name, and it is always set.
        aria-label={libelle}
        checked={coche}
        className="size-3.5 accent-[var(--color-accent)]"
        onChange={(evenement) => surChangement(evenement.target.checked)}
        type="checkbox"
      />
      {children ?? libelle}
    </label>
  )
}

export function PanneauFiltres({
  index,
  etat,
  surEtat,
  surClasse,
}: {
  readonly index: IndexWeb
  readonly etat: EtatUrl
  /** A filter adjustment: `router.replace`, no history entry. */
  readonly surEtat: (etat: EtatUrl) => void
  /** A class change: `router.push`, because it IS a navigation. */
  readonly surClasse: (classe: string | null) => void
}) {
  function basculer<C extends 'ecoles' | 'composantes' | 'sauvegarde'>(
    cle: C,
    valeur: string,
    coche: boolean,
    connus: readonly string[],
  ): void {
    const actuels = new Set(etat[cle])
    if (coche) actuels.add(valeur)
    else actuels.delete(valeur)
    // Re-ordered by the index's table so the URL is canonical whatever the click
    // order was — two users filtering the same way share the same link.
    surEtat({ ...etat, [cle]: connus.filter((connu) => actuels.has(connu)) })
  }

  const niveaux = Array.from({ length: NIVEAU_MAX + 1 }, (_, n) => n)
  const groupesClasses = grouperClasses(index)

  return (
    <div className="flex flex-col gap-4">
      {/* Primary. Heavier than the rest, and above the level filter, because
          the level below only means something relative to this choice. */}
      <div className="rounded-panneau border border-bord-fort bg-surface p-3">
        <label
          className="mb-1.5 block text-petit font-semibold text-encre"
          htmlFor="filtre-classe"
        >
          Classe
        </label>
        <select
          className="w-full rounded-jeton border border-bord-fort bg-surface px-2.5 py-1.5 text-corps text-encre"
          id="filtre-classe"
          onChange={(evenement) =>
            surClasse(evenement.target.value === '' ? null : evenement.target.value)
          }
          value={etat.classe ?? ''}
        >
          <option value="">Toutes les classes</option>
          {/* Two groups, the familiar ones first, and inside them an order by how
              commonly the class is played rather than by name: alphabetical put
              `Alchimiste` above `Barde` and buried the wizard at position three. */}
          {groupesClasses.map((groupe) => (
            <optgroup key={groupe.titre} label={groupe.titre}>
              {groupe.classes.map((classe) => (
                <option key={classe.slug} value={classe.slug}>
                  {classe.nom}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1.5 mb-0 text-micro text-encre-faible">
          {etat.classe === null
            ? 'Un sort n’a pas de niveau en soi : il est de niveau 2 pour le barde et 3 pour le magicien. Choisissez une classe pour lire un niveau qui veut dire quelque chose.'
            : 'Les niveaux affichés sont ceux de cette classe.'}
        </p>
      </div>

      <Groupe legende={libelleNiveau(index, etat.classe)}>
        {niveaux.map((niveau) => (
          <CaseJeton
            coche={etat.niveaux.includes(niveau)}
            key={niveau}
            libelle={`Niveau ${niveau}`}
            surChangement={(coche) => {
              const actuels = new Set(etat.niveaux)
              if (coche) actuels.add(niveau)
              else actuels.delete(niveau)
              surEtat({ ...etat, niveaux: [...actuels].sort((a, b) => a - b) })
            }}
          >
            <span aria-label={`Niveau ${niveau}`} className="font-donnees">
              {niveau}
            </span>
          </CaseJeton>
        ))}
      </Groupe>

      <Groupe legende="École">
        {index.ecoles.map((ecole) => (
          <CaseJeton
            coche={etat.ecoles.includes(ecole)}
            key={ecole}
            libelle={LIBELLES_ECOLES[ecole as Ecole] ?? ecole}
            surChangement={(coche) => basculer('ecoles', ecole, coche, index.ecoles)}
          >
            <span className="inline-flex items-center gap-1.5">
              <PastilleEcole ecole={ecole as Ecole} variante="puce" />
              {LIBELLES_ECOLES[ecole as Ecole] ?? ecole}
            </span>
          </CaseJeton>
        ))}
      </Groupe>

      <Groupe
        aide="Un sort doit porter toutes les composantes cochées."
        legende="Composantes"
      >
        {index.composantes.map((composante) => (
          <CaseJeton
            coche={etat.composantes.includes(composante)}
            key={composante}
            libelle={`Composante ${composante}`}
            surChangement={(coche) =>
              basculer('composantes', composante, coche, index.composantes)
            }
          >
            <span className="font-donnees">{composante}</span>
          </CaseJeton>
        ))}
      </Groupe>

      <Groupe legende="Jet de sauvegarde">
        {index.jets.map((jet) => (
          <CaseJeton
            coche={etat.sauvegarde.includes(jet)}
            key={jet}
            libelle={jet}
            surChangement={(coche) => basculer('sauvegarde', jet, coche, index.jets)}
          />
        ))}
      </Groupe>

      {/* Hidden entirely when the LLM layer is absent from the export. No empty
          section, no explanatory error — the filter simply does not exist. */}
      {/* Hidden entirely when the LLM layer is absent from the export. No empty
          section, no explanatory error — the filter simply does not exist. */}
      <FiltreTags
        surTags={(tags, tagsExclus) => surEtat({ ...etat, tags, tagsExclus })}
        tags={etat.tags}
        tagsConnus={index.tags}
        tagsExclus={etat.tagsExclus}
      />

      <Groupe legende="Signalements">
        <CaseJeton
          coche={etat.desaccords}
          libelle="Seulement les désaccords de niveau"
          surChangement={(coche) => surEtat({ ...etat, desaccords: coche })}
        >
          <span className="inline-flex items-center gap-1.5">
            Seulement les désaccords
            <Badge ton="alerte">niveau</Badge>
          </span>
        </CaseJeton>
      </Groupe>
    </div>
  )
}
