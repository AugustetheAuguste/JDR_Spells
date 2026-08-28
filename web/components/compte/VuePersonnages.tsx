'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Annonce, Bouton, ChampTexte } from '@/components/compte/elements'
import { EtatVide } from '@/components/primitives/EtatVide'
import type { LignePersonnage } from '@/lib/compte/distant'
import { usePersonnages } from '@/lib/compte/personnages'
import { useSession, type Resultat } from '@/lib/compte/session'
import { MOTS } from '@/lib/design/tokens'

/**
 * The character roster: create, rename, retire, or delete.
 *
 * Account-only, unlike favourites — `personnages` has no local existence, so
 * the whole page is gated on `statut === 'connecte'` rather than degrading to a
 * browser-only mode. That is a real limit, not an oversight, and each of the
 * other three states says so instead of rendering an empty form nobody can use.
 */
export function VuePersonnages() {
  const { statut } = useSession()

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Personnages</h1>
      <p className="mt-1 mb-5 max-w-[68ch] text-corps text-encre-douce">
        Un personnage porte un nom, une {MOTS.classe} et un {MOTS.niveau} — et peut être
        attaché à une liste de {MOTS.favoris}, pour retrouver « les sorts de mon barde »
        plutôt qu’une liste sans nom. Contrairement aux {MOTS.favoris}, les personnages
        n’existent que sur le {MOTS.compte} : il n’y a pas de repli hors connexion.
      </p>

      {statut === 'hors_service' ? (
        <Annonce ton="echec">
          Aucun service de {MOTS.compte} n’est configuré pour ce site, il n’y a donc pas
          de personnage possible.
        </Annonce>
      ) : statut === 'inconnu' ? (
        <p className="text-corps text-encre-douce" role="status">
          Lecture de la session en cours…
        </p>
      ) : statut === 'connecte' ? (
        <PanneauPersonnages />
      ) : (
        <div className="flex flex-col gap-3">
          <Annonce ton="echec">
            Les personnages demandent d’être connecté à un {MOTS.compte}.
          </Annonce>
          <p className="m-0">
            <Link className="text-corps text-accent underline hover:text-accent-survol" href="/compte">
              Aller au {MOTS.compte}
            </Link>
          </p>
        </div>
      )}
    </section>
  )
}

function PanneauPersonnages() {
  const { chargement, personnages, erreur, creer, modifier, supprimer } = usePersonnages()
  const [creation, setCreation] = useState(false)
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [annonce, setAnnonce] = useState<Resultat | null>(null)

  async function surCreer(nom: string, classe: string | null, niveau: number | null): Promise<void> {
    const resultat = await creer(nom, classe, niveau)
    setAnnonce(resultat)
    if (resultat.ok) setCreation(false)
  }

  async function surModifier(
    id: string,
    nom: string,
    classe: string | null,
    niveau: number | null,
  ): Promise<void> {
    const resultat = await modifier(id, nom, classe, niveau)
    setAnnonce(resultat)
    if (resultat.ok) setEnEdition(null)
  }

  async function surSupprimer(id: string): Promise<void> {
    const resultat = await supprimer(id)
    setAnnonce(resultat)
    setASupprimer(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur === null ? null : <Annonce ton="echec">{erreur}</Annonce>}
      {annonce === null ? null : (
        <Annonce ton={annonce.ok ? 'succes' : 'echec'}>{annonce.message ?? 'Terminé.'}</Annonce>
      )}

      {chargement ? (
        <p className="text-corps text-encre-douce" role="status">
          Lecture des personnages…
        </p>
      ) : personnages.length === 0 && !creation ? (
        <EtatVide
          actions={[{ libelle: 'Créer un personnage', primaire: true, surClic: () => setCreation(true) }]}
          explication="Aucun personnage sur ce compte pour l’instant."
          titre="Aucun personnage"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {personnages.map((personnage) =>
            enEdition === personnage.id ? (
              <FormulairePersonnage
                annuler={() => setEnEdition(null)}
                initial={personnage}
                key={personnage.id}
                soumettre={(nom, classe, niveau) => surModifier(personnage.id, nom, classe, niveau)}
              />
            ) : (
              <LignePersonnageVue
                demanderSuppression={() => setASupprimer(personnage.id)}
                editer={() => setEnEdition(personnage.id)}
                key={personnage.id}
                personnage={personnage}
              />
            ),
          )}

          {aSupprimer === null ? null : (
            <div
              aria-label="Confirmer la suppression"
              className="rounded-panneau border border-desaccord bg-surface px-3 py-2"
              role="alertdialog"
            >
              <p className="m-0 text-corps">
                Supprimer « {personnages.find((p) => p.id === aSupprimer)?.nom} » ? Les
                listes de {MOTS.favoris} qui lui sont attachées restent, sans personnage.
              </p>
              <div className="mt-2 flex gap-2">
                <Bouton primaire surClic={() => void surSupprimer(aSupprimer)}>
                  Supprimer définitivement
                </Bouton>
                <Bouton surClic={() => setASupprimer(null)}>Annuler</Bouton>
              </div>
            </div>
          )}
        </div>
      )}

      {creation ? (
        <FormulairePersonnage
          annuler={() => setCreation(false)}
          initial={null}
          soumettre={surCreer}
        />
      ) : personnages.length === 0 ? null : (
        <div>
          <Bouton surClic={() => setCreation(true)}>Nouveau personnage</Bouton>
        </div>
      )}
    </div>
  )
}

function LignePersonnageVue({
  personnage,
  editer,
  demanderSuppression,
}: {
  readonly personnage: LignePersonnage
  readonly editer: () => void
  readonly demanderSuppression: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-panneau border border-bord bg-surface px-4 py-3">
      <div>
        <p className="m-0 font-affichage text-titre3 font-semibold">{personnage.nom}</p>
        <p className="mt-0.5 mb-0 text-petit text-encre-douce">
          {personnage.classe === null && personnage.niveau === null
            ? 'Sans classe ni niveau renseignés'
            : [
                personnage.classe,
                personnage.niveau === null ? null : `${MOTS.niveau} ${personnage.niveau}`,
              ]
                .filter((partie) => partie !== null)
                .join(' — ')}
        </p>
      </div>
      <div className="flex gap-2">
        <Bouton surClic={editer}>Modifier</Bouton>
        <Bouton surClic={demanderSuppression}>Supprimer</Bouton>
      </div>
    </div>
  )
}

function FormulairePersonnage({
  initial,
  soumettre,
  annuler,
}: {
  readonly initial: LignePersonnage | null
  readonly soumettre: (nom: string, classe: string | null, niveau: number | null) => Promise<void>
  readonly annuler: () => void
}) {
  const [nom, setNom] = useState(initial?.nom ?? '')
  const [classe, setClasse] = useState(initial?.classe ?? '')
  const [niveau, setNiveau] = useState(initial?.niveau?.toString() ?? '')
  const [enAttente, setEnAttente] = useState(false)

  async function surSoumission(): Promise<void> {
    if (nom.trim() === '') return
    setEnAttente(true)
    const niveauNombre = niveau.trim() === '' ? null : Number.parseInt(niveau, 10)
    await soumettre(
      nom.trim(),
      classe.trim() === '' ? null : classe.trim(),
      niveauNombre !== null && Number.isNaN(niveauNombre) ? null : niveauNombre,
    )
    setEnAttente(false)
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-panneau border border-bord-fort bg-surface px-4 py-3"
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void surSoumission()
      }}
    >
      <ChampTexte etiquette="Nom" id="personnage-nom" surChangement={setNom} type="text" valeur={nom} />
      <ChampTexte
        aide="Facultatif — texte libre, pas une des classes du corpus."
        etiquette="Classe"
        id="personnage-classe"
        requis={false}
        surChangement={setClasse}
        type="text"
        valeur={classe}
      />
      <ChampTexte
        aide="Facultatif."
        etiquette="Niveau"
        id="personnage-niveau"
        requis={false}
        surChangement={setNiveau}
        type="number"
        valeur={niveau}
      />
      <div className="flex gap-2">
        <Bouton enAttente={enAttente} libelleAttente="Enregistrement…" primaire type="submit">
          {initial === null ? 'Créer' : 'Enregistrer'}
        </Bouton>
        <Bouton surClic={annuler}>Annuler</Bouton>
      </div>
    </form>
  )
}
