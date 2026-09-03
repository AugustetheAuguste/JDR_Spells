'use client'

import { useEffect, useMemo, useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { usePersonnageActif } from '@/lib/compte/contexte-personnages'
import type { Caracteristiques, ChampsPersonnage, LignePersonnage } from '@/lib/compte/distant'
import type { Resultat } from '@/lib/compte/session'
import type { ValeurPersonnages } from '@/lib/compte/personnages'

const CLES_CARACTERISTIQUES = ['for', 'dex', 'con', 'int', 'sag', 'cha'] as const
const ETIQUETTES_CARACTERISTIQUES: Readonly<Record<(typeof CLES_CARACTERISTIQUES)[number], string>> = {
  for: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  sag: 'Sagesse',
  cha: 'Charisme',
}

interface DonneesEmplacementsBrutes {
  readonly classes: Readonly<Record<string, unknown>>
  readonly races: Readonly<Record<string, unknown>>
}

/**
 * The fields the feat-eligibility engine actually reads, for whichever
 * character is currently active (`usePersonnageActif`): class, level, race,
 * the six ability scores, alignment, deity, size.
 *
 * Alignment and deity are free text and can be left empty — `Character`
 * treats an absent one as "non renseigné" (`manual_check`, never a guessed
 * `ineligible`), so this editor warns rather than inventing a default the
 * way `create` in the Python CLI refuses to either.
 *
 * This editor deliberately has NO field for skill ranks. `Character.skill_rank`
 * (`moteur.ts`, ported unchanged from `engine.py`) stays optimistic — absent
 * `skill_ranks`, it answers every rank prerequisite as satisfied — and this
 * step does not add a way to override that, on purpose: making it pessimistic
 * would turn every rank-gated feat `ineligible` on a mere assumption the moment
 * this editor shipped, diverging the parity harness (`npm run dons:parite`)
 * without a single product decision having been made about it first. The one
 * change this step DOES make is visible, not behavioural:
 * `ColonneStatut.tsx` labels a rank-gated `eligible` verdict "optimiste" and
 * links back here — not because ranks can be entered here, but because
 * `une sous-attribution est bien plus grave qu'une sur-attribution`: hiding
 * the assumption behind a silent `eligible` would be the sub-attribution this
 * whole repository's sibling (`pf1_dons`) exists to prevent.
 */
export function EditeurPersonnage() {
  const { personnageActif, ...roster } = usePersonnageActif()

  if (personnageActif === null) {
    return (
      <p className="text-corps text-encre-douce" role="status">
        Sélectionnez un personnage pour modifier ses champs d’éligibilité.
      </p>
    )
  }

  // Keyed on the character's id: switching characters must reset every
  // field to the new one's saved values, and a `key` remount does that for
  // free — no effect needed to resynchronize state that already has a
  // correct initial value on every fresh mount.
  return <FormulaireEditeur key={personnageActif.id} modifier={roster.modifier} personnage={personnageActif} />
}

function FormulaireEditeur({
  personnage,
  modifier,
}: {
  readonly personnage: LignePersonnage
  readonly modifier: ValeurPersonnages['modifier']
}) {
  const [classes, setClasses] = useState<readonly string[]>([])
  const [races, setRaces] = useState<readonly string[]>([])

  useEffect(() => {
    let vivant = true
    fetch('/data/emplacements.json')
      .then((reponse) => reponse.json() as Promise<DonneesEmplacementsBrutes>)
      .then((donnees) => {
        if (!vivant) return
        setClasses(Object.keys(donnees.classes).sort())
        setRaces(Object.keys(donnees.races).sort())
      })
      .catch(() => {
        /* Les listes déroulantes restent vides ; les champs restent des
         * champs texte pour classe/race dans ce cas via `optionsOuTexte`. */
      })
    return () => {
      vivant = false
    }
  }, [])

  const [classe, setClasse] = useState(personnage.classe ?? '')
  const [niveau, setNiveau] = useState(personnage.niveau === null ? '' : String(personnage.niveau))
  const [race, setRace] = useState(personnage.race ?? '')
  const [taille, setTaille] = useState(personnage.taille ?? '')
  const [alignement, setAlignement] = useState(personnage.alignement ?? '')
  const [divinite, setDivinite] = useState(personnage.divinite ?? '')
  const [caracteristiques, setCaracteristiques] = useState<Record<string, string>>(
    personnage.caracteristiques === null
      ? {}
      : Object.fromEntries(
          CLES_CARACTERISTIQUES.map((cle) => [
            cle,
            String((personnage.caracteristiques as Caracteristiques)[cle]),
          ]),
        ),
  )
  const [annonce, setAnnonce] = useState<Resultat | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  const avertissementManualCheck = useMemo(() => {
    const manques: string[] = []
    if (alignement.trim() === '') manques.push('alignement')
    if (divinite.trim() === '') manques.push('divinité')
    return manques
  }, [alignement, divinite])

  async function surEnregistrer(): Promise<void> {
    setEnregistrement(true)
    const caracsCompletes = CLES_CARACTERISTIQUES.every(
      (cle) => caracteristiques[cle] !== undefined && caracteristiques[cle] !== '',
    )
    const champs: ChampsPersonnage = {
      race: race === '' ? null : race,
      taille: taille === '' ? null : taille,
      alignement: alignement === '' ? null : alignement,
      divinite: divinite === '' ? null : divinite,
      caracteristiques: caracsCompletes
        ? (Object.fromEntries(
            CLES_CARACTERISTIQUES.map((cle) => [cle, Number(caracteristiques[cle])]),
          ) as unknown as Caracteristiques)
        : null,
    }
    const resultat = await modifier(
      personnage.id,
      personnage.nom,
      classe === '' ? null : classe,
      niveau === '' ? null : Number(niveau),
      champs,
    )
    setAnnonce(resultat)
    setEnregistrement(false)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void surEnregistrer()
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-petit font-medium text-encre-douce" htmlFor="editeur-classe">
          Classe
        </label>
        {classes.length > 0 ? (
          <select
            className="w-full rounded-jeton border border-bord-fort bg-surface px-2.5 py-1.5 text-corps text-encre"
            id="editeur-classe"
            onChange={(evenement) => setClasse(evenement.target.value)}
            value={classe}
          >
            <option value="">— non renseignée —</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <ChampTexte
            autoComplete="off"
            etiquette="Classe"
            id="editeur-classe"
            requis={false}
            surChangement={setClasse}
            type="text"
            valeur={classe}
          />
        )}
      </div>

      <ChampTexte
        autoComplete="off"
        etiquette="Niveau"
        id="editeur-niveau"
        requis={false}
        surChangement={setNiveau}
        type="number"
        valeur={niveau}
      />

      <div className="flex flex-col gap-1">
        <label className="text-petit font-medium text-encre-douce" htmlFor="editeur-race">
          Race
        </label>
        {races.length > 0 ? (
          <select
            className="w-full rounded-jeton border border-bord-fort bg-surface px-2.5 py-1.5 text-corps text-encre"
            id="editeur-race"
            onChange={(evenement) => setRace(evenement.target.value)}
            value={race}
          >
            <option value="">— non renseignée —</option>
            {races.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <ChampTexte
            autoComplete="off"
            etiquette="Race"
            id="editeur-race"
            requis={false}
            surChangement={setRace}
            type="text"
            valeur={race}
          />
        )}
      </div>

      <ChampTexte
        autoComplete="off"
        etiquette="Taille"
        id="editeur-taille"
        requis={false}
        surChangement={setTaille}
        type="text"
        valeur={taille}
      />

      <fieldset className="flex flex-col gap-3 rounded-panneau border border-bord p-3">
        <legend className="px-1 text-petit font-medium text-encre-douce">Caractéristiques</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CLES_CARACTERISTIQUES.map((cle) => (
            <ChampTexte
              autoComplete="off"
              etiquette={ETIQUETTES_CARACTERISTIQUES[cle]}
              id={`editeur-carac-${cle}`}
              key={cle}
              requis={false}
              surChangement={(valeur) => setCaracteristiques((c) => ({ ...c, [cle]: valeur }))}
              type="number"
              valeur={caracteristiques[cle] ?? ''}
            />
          ))}
        </div>
        <p className="m-0 text-petit text-encre-faible">
          Les six scores doivent être renseignés ensemble : incomplets, ils sont ignorés plutôt
          qu’envoyés à moitié — un score manquant produirait un « manual_check » silencieux au
          lieu d’un score deviné.
        </p>
      </fieldset>

      <ChampTexte
        aide="Un don à gating d’alignement affichera « manual_check » tant que ce champ est vide."
        autoComplete="off"
        etiquette="Alignement"
        id="editeur-alignement"
        requis={false}
        surChangement={setAlignement}
        type="text"
        valeur={alignement}
      />

      <ChampTexte
        aide="Un don à gating de divinité affichera « manual_check » tant que ce champ est vide."
        autoComplete="off"
        etiquette="Divinité"
        id="editeur-divinite"
        requis={false}
        surChangement={setDivinite}
        type="text"
        valeur={divinite}
      />

      {avertissementManualCheck.length > 0 ? (
        <Annonce ton="echec">
          Champ(s) non renseigné(s) : {avertissementManualCheck.join(', ')}. Certains dons
          resteront affichés en « à vérifier » (manual_check) tant qu’ils sont vides — c’est
          délibéré : un défaut inventé produirait un verdict faux, une absence produit un motif
          lisible.
        </Annonce>
      ) : null}

      {annonce !== null ? <Annonce ton={annonce.ok ? 'succes' : 'echec'}>{annonce.message}</Annonce> : null}

      <Bouton
        enAttente={enregistrement}
        libelleAttente="Enregistrement…"
        primaire
        type="submit"
      >
        Enregistrer
      </Bouton>
    </form>
  )
}
