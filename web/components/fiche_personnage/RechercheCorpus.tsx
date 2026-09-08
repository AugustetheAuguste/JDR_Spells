'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { MOTS } from '@/lib/design/tokens'
import { chargerContratMoteurDons } from '@/lib/dons/charger-contrat'
import { evaluerDon } from '@/lib/dons/moteur'
import type { CatalogueDons } from '@/lib/dons/moteur'
import type { Personnage, ResultatEligibilite, TablesMoteur } from '@/lib/dons/types'
import { sourceDons, sourceSorts, type ResultatGlobal } from '@/lib/recherche/sources-globales'
import type { EntreeCorpus } from '@/lib/fiche_personnage/schema'

const DELAI_REPOS = 150
const LIMITE_RESULTATS = 20

/** Le dernier segment non vide d'un href `/sorts/<slug>/` ou `/dons/<slug>/`
 * — les deux sources globales encodent déjà le slug dans l'URL, pas
 * d'aller-retour réseau supplémentaire pour l'obtenir. */
function slugDepuisHref(href: string): string {
  const segments = href.split('/').filter((segment) => segment !== '')
  return segments[segments.length - 1] ?? href
}

function extraireSlug(resultat: ResultatGlobal): string {
  return slugDepuisHref(resultat.href)
}

export interface EtatMoteurDons {
  readonly tables: TablesMoteur
  readonly catalogue: CatalogueDons
}

/**
 * Recherche dans le corpus des sorts ou des dons, avec bouton de
 * rattachement et bouton de lecture par résultat (plan 16, pseudo-code).
 *
 * Pour un don, un verdict tri-état s'affiche à côté du résultat — jamais
 * comme un refus : le bouton de rattachement reste actif quel que soit le
 * verdict, et il n'y a ni tri ni filtre ni désactivation fondés sur lui
 * (CLAUDE.md § 12, la maxime de sûreté). `personnage === null` signifie que
 * la fiche ne porte pas assez pour construire un `Personnage` : la
 * vérification elle-même n'est pas possible, ce qui n'empêche aucun
 * rattachement.
 */
export function RechercheCorpus({
  corpus,
  personnage,
  surRattachement,
  surLecture,
}: {
  readonly corpus: 'sorts' | 'dons'
  /** `null` : personnage non constructible depuis la fiche (vérification
   * impossible). `undefined` uniquement pour le corpus des sorts, qui n'a
   * pas de verdict à calculer. */
  readonly personnage?: Personnage | null
  readonly surRattachement: (entree: EntreeCorpus) => void
  readonly surLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  const [requete, setRequete] = useState('')
  const [resultats, setResultats] = useState<readonly ResultatGlobal[]>([])
  const [etatMoteurDons, setEtatMoteurDons] = useState<EtatMoteurDons | null>(null)

  const source = corpus === 'sorts' ? sourceSorts : sourceDons

  // Le contrat du moteur de dons (tables + catalogue) est chargé une seule
  // fois, jamais par résultat — mêmes raisons que `charger-contrat.ts`
  // (utilisé aussi par `/dons`) : refaire l'appel réseau à chaque ligne
  // serait quadratique pour rien. `chargerContratMoteurDons` cache elle-même
  // la promesse en cours, donc un second montage de ce composant ne refait
  // pas l'appel réseau.
  useEffect(() => {
    if (corpus !== 'dons') return
    let vivant = true
    chargerContratMoteurDons()
      .then((contrat) => {
        if (vivant) setEtatMoteurDons(contrat)
      })
      .catch(() => {
        if (vivant) setEtatMoteurDons(null)
      })
    return () => {
      vivant = false
    }
  }, [corpus])

  useEffect(() => {
    if (requete === '') return
    let vivant = true
    const minuteur = setTimeout(() => {
      source
        .chercher(requete, LIMITE_RESULTATS)
        .then((trouves) => {
          if (vivant) setResultats(trouves)
        })
        .catch(() => {
          if (vivant) setResultats([])
        })
    }, DELAI_REPOS)
    return () => {
      vivant = false
      clearTimeout(minuteur)
    }
  }, [requete, source])

  // `resultats` n'a pas besoin d'être remis à `[]` par un effet quand
  // `requete` redevient vide (ce que la garde `react-hooks/set-state-in-effect`
  // refuse) : le rendu ci-dessous ne l'affiche déjà que lorsque
  // `requete !== ''`, donc une valeur périmée qui traîne en mémoire ne
  // s'affiche jamais.
  const verdicts = useMemo<Readonly<Record<string, ResultatEligibilite>>>(() => {
    if (corpus !== 'dons' || etatMoteurDons === null || personnage === null || personnage === undefined) return {}
    const carte: Record<string, ResultatEligibilite> = {}
    for (const resultat of resultats) {
      const conditions = etatMoteurDons.catalogue.get(resultat.titre)
      if (conditions === undefined) continue
      carte[resultat.cle] = evaluerDon(resultat.titre, conditions, personnage, etatMoteurDons.tables)
    }
    return carte
  }, [corpus, etatMoteurDons, personnage, resultats])

  const libelleChamp = corpus === 'sorts' ? MOTS.corpusRechercherSorts : MOTS.corpusRechercherDons

  return (
    <div>
      <label className="flex flex-col gap-1 text-petit text-encre-douce" htmlFor={`recherche-corpus-${corpus}`}>
        {libelleChamp}
        <input
          className="min-h-cible border border-bord-fort bg-surface px-2 text-grand text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          id={`recherche-corpus-${corpus}`}
          onChange={(evenement) => setRequete(evenement.target.value)}
          placeholder={MOTS.corpusChampRecherche}
          type="text"
          value={requete}
        />
      </label>

      {corpus === 'dons' && personnage === null && (
        <p className="mt-2 text-petit text-encre-douce">
          {MOTS.corpusVerificationImpossible} {MOTS.corpusVerificationImpossibleDetail}
        </p>
      )}

      {requete !== '' && (
        <ul className="m-0 mt-2 flex flex-col gap-2 p-0">
          {resultats.length === 0 && <li className="text-petit text-encre-douce">{MOTS.corpusAucunResultat}</li>}
          {resultats.map((resultat) => (
            <ResultatLigne
              corpus={corpus}
              key={resultat.cle}
              resultat={resultat}
              surLecture={surLecture}
              surRattachement={surRattachement}
              verdict={verdicts[resultat.cle] ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ResultatLigne({
  corpus,
  resultat,
  verdict,
  surRattachement,
  surLecture,
}: {
  readonly corpus: 'sorts' | 'dons'
  readonly resultat: ResultatGlobal
  readonly verdict: ResultatEligibilite | null
  readonly surRattachement: (entree: EntreeCorpus) => void
  readonly surLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  const refLire = useRef<HTMLButtonElement>(null)
  const slug = extraireSlug(resultat)

  function rattacher() {
    surRattachement({ nom: resultat.titre, source: 'pathfinder-fr', ref: slug, note: '' })
  }

  function lire() {
    if (refLire.current) surLecture(slug, resultat.titre, refLire.current)
  }

  return (
    <li className="flex flex-wrap items-center gap-2 border border-bord p-2">
      <span className="min-w-[12ch] flex-1 text-corps text-encre">{resultat.titre}</span>

      {corpus === 'dons' && <VerdictDon verdict={verdict} />}

      <button
        className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={lire}
        ref={refLire}
        type="button"
      >
        {MOTS.corpusBoutonLire}
      </button>
      <button
        className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={rattacher}
        type="button"
      >
        {MOTS.corpusBoutonRattacher}
      </button>
    </li>
  )
}

/**
 * Le verdict d'un don, affiché comme un avertissement, jamais comme un
 * refus (plan 16). `eligible` porte un signe discret ; `manual_check` et
 * `ineligible` portent une bordure en tirets et un « ! » textuel, jamais la
 * couleur seule (Skill pf-web-design-system § Dons). Une exigence
 * indéterminable (`manual_check`) et une exigence non remplie
 * (`ineligible`) portent deux libellés distincts, jamais confondus.
 */
function VerdictDon({ verdict }: { readonly verdict: ResultatEligibilite | null }) {
  if (verdict === null) return null

  if (verdict.statut === 'eligible') {
    return <span className="text-petit text-encre-douce">{MOTS.corpusVerdictEligible}</span>
  }

  const estIneligible = verdict.statut === 'ineligible'

  return (
    <div className="border border-dashed border-bord-fort bg-base px-2 py-1 text-petit text-encre">
      <p className="m-0 font-semibold">
        <span aria-hidden="true">! </span>
        {estIneligible ? MOTS.corpusVerdictIneligible : MOTS.corpusVerdictManuel}
      </p>
      <p className="m-0 mt-1 text-encre-douce">{estIneligible ? MOTS.corpusMotifsNonRemplis : MOTS.corpusMotifsIndetermines}</p>
      <ul className="m-0 mt-1 list-disc pl-4">
        {verdict.motifs.map((motif, indice) => (
          <li key={indice}>{motif}</li>
        ))}
      </ul>
    </div>
  )
}
