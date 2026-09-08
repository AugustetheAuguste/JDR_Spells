'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { FilAriane } from '@/components/navigation/FilAriane'
import { MOTS } from '@/lib/design/tokens'
import { useFiches } from '@/lib/fiche_personnage/contexte-fiches'
import { plier } from '@/lib/recherche/pliage'
import type { Fiche } from '@/lib/fiche_personnage/schema'

import { BoutonImport } from './BoutonImport'
import { CarteFiche } from './CarteFiche'
import { DialogueSuppression } from './DialogueSuppression'

/** Asserted on every URL write — a facet or a search keystroke must never
 * scroll the reader back to the top of a page they are already looking at
 * (CLAUDE.md § 11). */
const SANS_SAUT = { scroll: false }

/** Same debounce as `VueDons`'s own name field. */
const DELAI_FRAPPE = 200

function nomAffiche(fiche: Fiche): string {
  return fiche.meta.nomPersonnage.trim() === '' ? MOTS.ficheSansNom : fiche.meta.nomPersonnage
}

/**
 * The sheet index: a searchable grid of cards, sorted by last-modified
 * descending — a sort `useFiches()` already guarantees (`magasin.lister`),
 * never re-derived here.
 *
 * The name search lives in the URL (`?q=`) and nowhere else, written through
 * the router with `{ scroll: false }` (§ SANS_SAUT above), matched with
 * `plier` so it folds accents and case exactly like every other search box in
 * this repository.
 */
export function VueIndexFiches() {
  const router = useRouter()
  const parametres = useSearchParams()
  const { chargement, fiches, illisibles, dupliquer, supprimer, restaurer } = useFiches()

  const requete = parametres.get('q') ?? ''
  const [ficheASupprimer, setFicheASupprimer] = useState<Fiche | null>(null)
  const [ficheRestaurable, setFicheRestaurable] = useState<{ readonly id: string; readonly nom: string } | null>(
    null,
  )
  const refDeclencheur = useRef<HTMLElement | null>(null)

  // The one local copy of URL state, one-directional like `VueDons`'s own
  // name field: the box holds raw keystrokes so typing stays responsive
  // while the URL — the only place this filter actually lives — catches up
  // on a short debounce. Reconciled from the URL during render (not an
  // effect, which would flash the stale value for one frame on a back
  // button) whenever the URL itself changed from something else, e.g. the
  // breadcrumb's own navigation.
  const [saisie, setSaisie] = useState(requete)
  const [requeteVue, setRequeteVue] = useState(requete)
  if (requeteVue !== requete) {
    setRequeteVue(requete)
    setSaisie(requete)
  }

  function ecrireRequete(valeur: string): void {
    const params = new URLSearchParams(parametres.toString())
    if (valeur === '') params.delete('q')
    else params.set('q', valeur)
    const chaine = params.toString()
    router.replace((chaine === '' ? '/personnages/' : `/personnages/?${chaine}`) as Route, SANS_SAUT)
  }

  useEffect(() => {
    if (saisie === requete) return
    const minuteur = setTimeout(() => ecrireRequete(saisie), DELAI_FRAPPE)
    return () => clearTimeout(minuteur)
    // `ecrireRequete` closes over `router`/`parametres` only, both stable
    // enough in practice not to need listing here — matches `VueDons.tsx`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie, requete])

  const filtrees = useMemo(() => {
    const q = plier(requete)
    if (q === '') return fiches
    return fiches.filter((fiche) => plier(fiche.meta.nomPersonnage).includes(q))
  }, [fiches, requete])

  function surSupprimerDemande(fiche: Fiche, evenement: React.MouseEvent<HTMLElement>): void {
    refDeclencheur.current = evenement.currentTarget
    setFicheASupprimer(fiche)
  }

  async function surConfirmerSuppression(): Promise<void> {
    if (ficheASupprimer === null) return
    const cible = ficheASupprimer
    const resultat = await supprimer(cible.id)
    setFicheASupprimer(null)
    if (resultat.ok) {
      setFicheRestaurable({ id: cible.id, nom: nomAffiche(cible) })
    }
  }

  async function surRestaurer(id: string): Promise<void> {
    await restaurer(id)
    setFicheRestaurable(null)
  }

  const segments = [
    {
      libelle: MOTS.personnages,
      href: '/personnages/',
      choix: fiches.map((fiche) => ({
        cle: fiche.id,
        libelle: nomAffiche(fiche),
        href: `/personnages/fiche/?id=${encodeURIComponent(fiche.id)}`,
      })),
    },
  ]

  if (chargement) {
    return (
      <div className="max-w-[80ch]">
        <FilAriane segments={[{ libelle: MOTS.personnages, href: '/personnages/' }]} />
        <p className="mt-3 text-corps text-encre-douce">{MOTS.ficheChargementTexte}</p>
      </div>
    )
  }

  return (
    <div className="max-w-[80ch]">
      <FilAriane segments={segments} />
      <h1 className="mt-2 font-affichage text-titre2 font-semibold text-encre">{MOTS.mesFiches}</h1>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Link
          className="flex min-h-cible min-w-cible items-center bg-accent px-3 text-petit text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={{ pathname: '/personnages/nouvelle/' }}
        >
          {MOTS.nouvelleFiche}
        </Link>
        <BoutonImport />
        <div>
          <label className="sr-only" htmlFor="fiche-recherche">
            {MOTS.ficheRechercheEtiquette}
          </label>
          <input
            className="min-h-cible border border-bord-fort bg-surface px-2.5 text-corps text-encre placeholder:text-encre-faible focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            id="fiche-recherche"
            onChange={(evenement) => setSaisie(evenement.target.value)}
            placeholder={MOTS.ficheRecherchePlaceholder}
            type="text"
            value={saisie}
          />
        </div>
      </div>

      {ficheRestaurable !== null && (
        <div className="mt-3 border border-bord bg-accent-voile p-3" role="status">
          <p className="text-corps text-encre">{MOTS.ficheSuppressionConfirmeeTexte}</p>
          <button
            className="mt-1 min-h-cible min-w-cible text-petit text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => {
              void surRestaurer(ficheRestaurable.id)
            }}
            type="button"
          >
            {MOTS.ficheActionRestaurer}
          </button>
        </div>
      )}

      {illisibles.length > 0 && (
        <div className="mt-3 border border-bord p-3">
          <p className="text-corps font-medium text-encre">{MOTS.ficheIllisiblesTitre}</p>
          <ul className="mt-1 list-disc pl-4 text-petit text-encre-douce">
            {illisibles.map((illisible) => (
              <li key={illisible.cle}>
                {illisible.cle}, {illisible.motif}
              </li>
            ))}
          </ul>
        </div>
      )}

      {filtrees.length === 0 ? (
        <div className="mt-6">
          <p className="text-corps text-encre-douce">{MOTS.ficheEtatVideTexte}</p>
          <Link
            className="mt-2 flex min-h-cible min-w-cible w-fit items-center bg-accent px-3 text-petit text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={{ pathname: '/personnages/nouvelle/' }}
          >
            {MOTS.nouvelleFiche}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrees.map((fiche) => (
            <CarteFiche
              fiche={fiche}
              key={fiche.id}
              onDupliquer={(id) => {
                void dupliquer(id)
              }}
              onSupprimerDemande={surSupprimerDemande}
            />
          ))}
        </ul>
      )}

      <DialogueSuppression
        declencheur={refDeclencheur.current}
        nomFiche={ficheASupprimer === null ? '' : nomAffiche(ficheASupprimer)}
        onAnnuler={() => setFicheASupprimer(null)}
        onConfirmer={() => {
          void surConfirmerSuppression()
        }}
        ouvert={ficheASupprimer !== null}
      />
    </div>
  )
}
