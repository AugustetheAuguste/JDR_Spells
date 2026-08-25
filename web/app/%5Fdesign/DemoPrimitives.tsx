'use client'

import { useState } from 'react'

import { Badge } from '@/components/primitives/Badge'
import { ChampRecherche } from '@/components/primitives/ChampRecherche'
import { EtatVide } from '@/components/primitives/EtatVide'
import { MarqueurDesaccord, type Desaccord } from '@/components/primitives/MarqueurDesaccord'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { TableDense, type ColonneDense } from '@/components/primitives/TableDense'
import { ECOLES, type Ecole } from '@/lib/design/tokens'

/**
 * The interactive half of the design demo.
 *
 * Two primitives need state to show their states at all — the search field's
 * empty/filled/cleared cycle, and the table's selected row — so they live in a
 * client component while the page itself stays server-rendered.
 */
export interface LigneDemo {
  readonly slug: string
  readonly nom: string
  readonly ecole: Ecole | null
  readonly niveaux: readonly { readonly nom: string; readonly niveau: number }[]
  readonly composantes: readonly string[]
  readonly portee: string | null
  readonly jet: string | null
  readonly desaccords: readonly Desaccord[]
}

export function DemoPrimitives({ lignes }: { readonly lignes: readonly LigneDemo[] }) {
  const [requete, setRequete] = useState('')
  const [active, setActive] = useState<string | undefined>(lignes[1]?.slug)
  const [vide, setVide] = useState(false)

  const filtrees = lignes.filter((ligne) =>
    ligne.nom.toLowerCase().includes(requete.toLowerCase()),
  )
  const affichees = vide ? [] : filtrees

  const colonnes: readonly ColonneDense<LigneDemo>[] = [
    {
      cle: 'nom',
      entete: 'Sort',
      cellule: (ligne) => (
        <span className="flex items-center gap-2">
          <span className="font-affichage">{ligne.nom}</span>
          {ligne.desaccords.length > 0 ? (
            <MarqueurDesaccord desaccords={ligne.desaccords} variante="puce" />
          ) : null}
        </span>
      ),
    },
    {
      cle: 'ecole',
      entete: 'École',
      cellule: (ligne) => <PastilleEcole ecole={ligne.ecole} />,
      largeur: '9.5rem',
    },
    {
      cle: 'niveaux',
      entete: 'Niveau par classe',
      cellule: (ligne) => (
        <span className="flex flex-wrap gap-1">
          {ligne.niveaux.map((niveau) => (
            <Badge key={niveau.nom} titre={`${niveau.nom} : niveau ${niveau.niveau}`} ton="donnees">
              {niveau.nom} {niveau.niveau}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      cle: 'composantes',
      entete: 'Composantes',
      cellule: (ligne) =>
        ligne.composantes.length === 0 ? (
          <span className="text-encre-faible">—</span>
        ) : (
          <span className="font-donnees text-petit">{ligne.composantes.join(' ')}</span>
        ),
      secondaire: true,
    },
    {
      cle: 'portee',
      entete: 'Portée',
      cellule: (ligne) => ligne.portee ?? <span className="text-encre-faible">—</span>,
      secondaire: true,
    },
    {
      cle: 'jet',
      entete: 'Jet de sauvegarde',
      cellule: (ligne) => ligne.jet ?? <span className="text-encre-faible">—</span>,
      secondaire: true,
    },
  ]

  return (
    <>
      <Bloc
        id="pastille"
        titre="PastilleEcole"
        note="Neuf écoles, aplat plus libellé. La couleur n'est jamais seule porteuse : neuf teintes ne se mémorisent pas, et deux d'entre elles se lisent comme un même violet sombre."
      >
        <div className="flex flex-wrap gap-2">
          {ECOLES.map((ecole) => (
            <PastilleEcole ecole={ecole} key={ecole} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-petit text-encre-douce">
          <span className="flex items-center gap-1.5">
            variante puce : {ECOLES.map((ecole) => <PastilleEcole ecole={ecole} key={ecole} variante="puce" />)}
          </span>
          <span className="flex items-center gap-1.5">
            école absente : <PastilleEcole ecole={null} />
          </span>
        </div>
      </Bloc>

      <Bloc
        id="badge"
        titre="Badge"
        note="Quatre tons, pas plus. L'accent est unique, donc il veut dire une seule chose : actif, ou choisi par vous."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>neutre</Badge>
          <Badge ton="accent">accent — filtre posé</Badge>
          <Badge ton="alerte">alerte — désaccord</Badge>
          <Badge ton="donnees">Barde 3</Badge>
        </div>
      </Bloc>

      <Bloc
        id="champ"
        titre="ChampRecherche"
        note="Contrôlé. « / » donne le focus depuis n'importe où — sauf déjà dans un champ, sinon « / » devient intypable ailleurs. Échap efface."
      >
        <div className="max-w-md">
          <ChampRecherche
            aide="Tapez « / » pour revenir ici. Échap efface."
            nbResultats={filtrees.length}
            surChangement={setRequete}
            valeur={requete}
          />
        </div>
      </Bloc>

      <Bloc
        id="table"
        titre="TableDense"
        note="En-tête collant, lignes de 32 px — la cible chiffrée est 40 lignes lisibles sur un portable. Pas de zébrage : un filet de 1 px suffit et le zébrage entre en conflit avec le voile de la ligne sélectionnée. Sous 640 px, composantes, portée et jet tombent ; nom, école et niveau restent."
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-petit">
          <button
            className="rounded-jeton border border-bord-fort bg-surface px-2 py-1 hover:bg-survol"
            onClick={() => setVide((valeur) => !valeur)}
            type="button"
          >
            {vide ? 'Rendre les lignes' : "Forcer l'état vide"}
          </button>
          <span className="text-encre-douce">
            ligne active : <code className="font-donnees">{active ?? 'aucune'}</code>
          </span>
        </div>
        {affichees.length === 0 ? (
          <EtatVide
            actions={[
              {
                libelle: 'Retirer les filtres',
                primaire: true,
                surClic: () => {
                  setVide(false)
                  setRequete('')
                },
              },
              { libelle: 'Chercher dans toutes les classes', surClic: () => setRequete('') },
            ]}
            explication={
              <>
                {requete === '' ? null : (
                  <>
                    Aucun sort ne correspond à «&nbsp;<strong>{requete}</strong>&nbsp;».{' '}
                  </>
                )}
                Trois filtres sont posés : Barde, niveau 0–2, école Évocation.
              </>
            }
            titre="Aucun sort ne correspond"
          />
        ) : (
          <TableDense
            cleDe={(ligne) => ligne.slug}
            colonnes={colonnes}
            legende="Démonstration de la table dense sur la fixture gelée"
            lignes={affichees}
            {...(active === undefined ? {} : { ligneActive: active })}
            surLigneActivee={(ligne) => setActive(ligne.slug)}
          />
        )}
      </Bloc>

      <Bloc
        id="etat-vide"
        titre="EtatVide"
        note="Jamais « Aucun résultat » seul : ce qui a été cherché, pourquoi c'est vide, et un bouton qui en sort. Le type exige au moins une action — un état vide sans issue est justement le défaut que cette primitive existe pour empêcher."
      >
        <EtatVide
          actions={[
            { libelle: 'Retirer les filtres', primaire: true, surClic: () => undefined },
            { libelle: 'Chercher dans toutes les classes', surClic: () => undefined },
          ]}
          explication={
            <>
              Aucun sort ne correspond à «&nbsp;<strong>firebal</strong>&nbsp;». Trois
              filtres sont posés : Barde, niveau 0–2, école Évocation.
            </>
          }
          titre="Aucun sort ne correspond à « firebal »"
        />
      </Bloc>
    </>
  )
}

function Bloc({
  id,
  titre,
  note,
  children,
}: {
  readonly id: string
  readonly titre: string
  readonly note: string
  readonly children: React.ReactNode
}) {
  return (
    <section className="mt-8" id={id}>
      <h2 className="m-0 font-affichage text-titre2 font-semibold">{titre}</h2>
      <p className="mt-1 mb-3 max-w-[68ch] text-petit text-encre-douce">{note}</p>
      {children}
    </section>
  )
}
