'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/primitives/Badge'
import { EtatVide } from '@/components/primitives/EtatVide'
import { PastilleEcole } from '@/components/primitives/PastilleEcole'
import { ecoleDe, type EntreeSort, type IndexWeb } from '@/lib/donnees/index-web'
import { NOM_LISTE_DEFAUT, useFavoris } from '@/lib/favoris/contexte'
import {
  CLE_SAUVEGARDE,
  exporter,
  idsInconnus,
  nomFichierExport,
  type ModeImport,
  type RapportImport,
} from '@/lib/favoris/stockage'

/**
 * The favourites view.
 *
 * The index is fetched only to *display* names — the lists themselves hold ids
 * and nothing else, so this whole view degrades to a readable list of ids if the
 * index never arrives. That is why the fetch has no error branch that blocks:
 * losing the names is a cosmetic loss, losing the list would not be.
 *
 * Every destructive path asks first, and the one that cannot ask — a corrupted
 * payload found at load — is announced with the key its bytes were copied to.
 *
 * One accent-flat button per state, never more. No list at all makes
 * « Nouvelle liste » the primary action. Once a list is chosen, the primary
 * need is either handled by `EtatVide` (an empty list, § brief) or by nothing
 * at all (a full list — reviewing the table is the task, not pressing a
 * button, decided in `design/audit_ui/12_constats.md`).
 */

function horodatageCourt(iso: string): string {
  // Slicing rather than `toLocaleDateString`: the stored value is already an ISO
  // string and a locale-formatted date would differ between the prerender and
  // the browser.
  return iso === '' ? '—' : iso.slice(0, 10)
}

/** A small local pluraliser: the pattern « n singulier/pluriel » repeats more
 * than three times below (spells added, lists read, unknown ids…), each with
 * its own noun. No i18n dependency, just the one rule the Skill states: the
 * number is always known here, so a parenthesised « (s) » never is. */
function accorder(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n === 1 ? singulier : pluriel}`
}

const BOUTON_SECONDAIRE =
  'min-h-cible rounded-jeton border border-bord-fort bg-surface px-3 py-2 text-corps hover:bg-survol'
const BOUTON_PRIMAIRE =
  'min-h-cible rounded-jeton border border-accent bg-accent-voile px-3 py-2 text-corps font-semibold text-accent hover:bg-survol'
const BOUTON_DESACCORD =
  'min-h-cible rounded-jeton border border-desaccord bg-surface px-3 py-2 text-corps text-desaccord hover:bg-survol'
const BOUTON_DESACCORD_PLEIN =
  'min-h-cible rounded-jeton border border-desaccord bg-desaccord-voile px-3 py-2 text-corps font-semibold text-desaccord'

export function VueFavoris() {
  const routeur = useRouter()
  const {
    etat,
    pret,
    incident,
    active,
    creer,
    renommer,
    supprimer,
    activer,
    importerDepuis,
    oublierIncident,
  } = useFavoris()

  const [index, setIndex] = useState<IndexWeb | null>(null)
  const [renommage, setRenommage] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [importEnAttente, setImportEnAttente] = useState<unknown>(null)
  const [rapport, setRapport] = useState<RapportImport | null>(null)
  const [erreurImport, setErreurImport] = useState<string | null>(null)
  const fichier = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let vivant = true
    fetch('/data/index.json')
      .then(async (reponse) => (reponse.ok ? ((await reponse.json()) as IndexWeb) : null))
      .then((charge) => {
        if (vivant && charge !== null) setIndex(charge)
      })
      .catch(() => {
        // Deliberately silent: the names are a nicety, the ids are the data.
      })
    return () => {
      vivant = false
    }
  }, [])

  const parId = new Map<string, EntreeSort>(
    (index?.sorts ?? []).map((sort) => [sort.id, sort]),
  )
  const inconnus = active === null ? [] : idsInconnus(active, new Set(parId.keys()))

  function telecharger(): void {
    if (active === null) return
    const contenu = exporter(etat)
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
    lien.download = nomFichierExport(active.nom, new Date().toISOString().slice(0, 10))
    lien.click()
    URL.revokeObjectURL(lien.href)
  }

  async function lireFichier(entree: HTMLInputElement): Promise<void> {
    const choisi = entree.files?.[0]
    if (choisi === undefined) return
    setErreurImport(null)
    setRapport(null)
    try {
      setImportEnAttente(JSON.parse(await choisi.text()))
    } catch {
      setErreurImport('Ce fichier n’est pas du JSON lisible. Rien n’a été modifié.')
    }
    entree.value = ''
  }

  function confirmerImport(mode: ModeImport): void {
    const resultat = importerDepuis(importEnAttente, mode)
    setImportEnAttente(null)
    if (resultat === null) {
      setErreurImport(
        'Ce fichier n’est pas une liste de favoris en version 1. Rien n’a été modifié.',
      )
      return
    }
    setRapport(resultat)
  }

  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">Favoris</h1>
      <p className="mt-1 mb-4 max-w-[68ch] text-corps text-encre-douce">
        Vos listes vivent dans ce navigateur. Connectez-vous pour les retrouver
        sur vos autres appareils. Vider les données du site les efface. Exportez
        le fichier pour les garder.
      </p>

      {incident.type === 'aucun' ? null : (
        <div
          className="mb-4 rounded-panneau border border-desaccord bg-desaccord-voile px-3 py-2"
          role="alert"
        >
          {incident.type === 'illisible' ? (
            <p className="m-0 text-corps">
              Les favoris enregistrés étaient illisibles.{' '}
              {incident.sauvegarde ? (
                <>
                  Vos octets d’origine ont été conservés intacts sous la clé{' '}
                  <code className="font-donnees">{CLE_SAUVEGARDE}</code> du stockage
                  local. Rien n’a été détruit.
                </>
              ) : (
                <>Le stockage a refusé la copie de sauvegarde.</>
              )}
            </p>
          ) : incident.type === 'version' ? (
            <p className="m-0 text-corps">
              Ces favoris annoncent la version{' '}
              <code className="font-donnees">{String(incident.trouvee)}</code>, que cette
              version du site ne sait pas lire. Rien n’a été détruit. Les octets
              d’origine sont sous <code className="font-donnees">{CLE_SAUVEGARDE}</code>.
            </p>
          ) : (
            <p className="m-0 text-corps">
              {accorder(
                incident.nombre,
                'liste enregistrée était malformée',
                'listes enregistrées étaient malformées',
              )}
              . {incident.nombre === 1 ? 'Elle a été écartée' : 'Elles ont été écartées'}{' '}
              plutôt que devinée{incident.nombre === 1 ? '' : 's'}.
            </p>
          )}
          <button className={BOUTON_SECONDAIRE} onClick={oublierIncident} type="button">
            J’ai compris
          </button>
        </div>
      )}

      {!pret ? (
        <p aria-live="polite" className="text-grand text-encre-douce">
          Lecture des favoris…
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {etat.listes.length === 0 ? null : (
            <label className="flex min-h-cible items-center gap-1.5 text-corps">
              Liste
              <select
                className="min-h-cible rounded-jeton border border-bord-fort bg-surface px-2 py-1 text-corps"
                onChange={(evenement) => activer(evenement.target.value)}
                value={active?.id_liste ?? ''}
              >
                {etat.listes.map((liste) => (
                  <option key={liste.id_liste} value={liste.id_liste}>
                    {liste.nom} ({liste.sorts.length})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={etat.listes.length === 0 ? BOUTON_PRIMAIRE : BOUTON_SECONDAIRE}
              onClick={() => creer(`${NOM_LISTE_DEFAUT} ${etat.listes.length + 1}`)}
              type="button"
            >
              Nouvelle liste
            </button>
            {active === null ? null : (
              <>
                <button
                  className={BOUTON_SECONDAIRE}
                  onClick={() => setRenommage(active.nom)}
                  type="button"
                >
                  Renommer
                </button>
                <button className={BOUTON_SECONDAIRE} onClick={telecharger} type="button">
                  Exporter en JSON
                </button>
              </>
            )}
            <button
              className={BOUTON_SECONDAIRE}
              onClick={() => fichier.current?.click()}
              type="button"
            >
              Importer un fichier
            </button>
            <input
              accept="application/json,.json"
              aria-label="Fichier de favoris à importer"
              className="sr-only"
              onChange={(evenement) => void lireFichier(evenement.target)}
              ref={fichier}
              type="file"
            />
            {active === null ? null : (
              <button
                className={`${BOUTON_DESACCORD} sm:ml-auto`}
                onClick={() => setASupprimer(active.id_liste)}
                type="button"
              >
                Supprimer la liste
              </button>
            )}
          </div>

          {renommage === null ? null : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(evenement) => {
                evenement.preventDefault()
                if (active !== null && renommage.trim() !== '') {
                  renommer(active.id_liste, renommage.trim())
                }
                setRenommage(null)
              }}
            >
              <label className="flex min-h-cible items-center gap-1.5 text-corps">
                Nouveau nom
                <input
                  autoFocus
                  className="min-h-cible rounded-jeton border border-bord-fort bg-surface px-2 py-1 text-grand"
                  onChange={(evenement) => setRenommage(evenement.target.value)}
                  value={renommage}
                />
              </label>
              <button className={BOUTON_PRIMAIRE} type="submit">
                Renommer
              </button>
              <button
                className={BOUTON_SECONDAIRE}
                onClick={() => setRenommage(null)}
                type="button"
              >
                Annuler
              </button>
            </form>
          )}

          {aSupprimer === null ? null : (
            <div
              className="rounded-panneau border border-desaccord bg-surface px-3 py-2"
              role="alertdialog"
              aria-label="Confirmer la suppression"
            >
              <p className="m-0 text-corps">
                Supprimer « {etat.listes.find((l) => l.id_liste === aSupprimer)?.nom} » et
                ses {accorder(
                  etat.listes.find((l) => l.id_liste === aSupprimer)?.sorts.length ?? 0,
                  'sort',
                  'sorts',
                )}{' '}
                ? C’est définitif. Exportez-la d’abord si vous hésitez.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={BOUTON_DESACCORD_PLEIN}
                  onClick={() => {
                    supprimer(aSupprimer)
                    setASupprimer(null)
                  }}
                  type="button"
                >
                  Supprimer définitivement
                </button>
                <button
                  className={BOUTON_SECONDAIRE}
                  onClick={() => setASupprimer(null)}
                  type="button"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {importEnAttente === null ? null : (
            <div
              className="rounded-panneau border border-accent bg-surface px-3 py-2"
              role="alertdialog"
              aria-label="Choisir le mode d’import"
            >
              <p className="m-0 text-corps">
                Fichier lu. Rien n’a encore changé. Que faut-il en faire ?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={BOUTON_PRIMAIRE}
                  disabled={active === null}
                  onClick={() => confirmerImport('fusionner')}
                  title={
                    active === null
                      ? 'Aucune liste active à fusionner. Créez-en une ou importez comme nouvelle liste.'
                      : 'Ajoute les sorts à la liste active sans en retirer aucun'
                  }
                  type="button"
                >
                  Fusionner avec la liste active
                </button>
                <button
                  className={BOUTON_SECONDAIRE}
                  onClick={() => confirmerImport('nouvelle')}
                  title="Ajoute les listes du fichier sans toucher à la liste active"
                  type="button"
                >
                  Créer de nouvelles listes
                </button>
                <button
                  className={BOUTON_SECONDAIRE}
                  onClick={() => setImportEnAttente(null)}
                  type="button"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {erreurImport === null ? null : (
            <p className="m-0 text-corps text-desaccord" role="alert">
              {erreurImport}
            </p>
          )}

          {/* A file with no list is a legitimate read, not a successful import:
              announcing « Import terminé » above an empty panel is the
              contradiction this branch exists to prevent. */}
          {rapport === null || rapport.listes_lues > 0 ? null : (
            <p className="m-0 text-corps text-encre-douce" role="status">
              Ce fichier ne contenait aucune liste lisible
              {rapport.listes_ecartees > 0
                ? `. ${accorder(rapport.listes_ecartees, 'liste écartée comme malformée', 'listes écartées comme malformées')}`
                : ''}
              . Rien n’a été ajouté.
            </p>
          )}

          {rapport === null || rapport.listes_lues === 0 ? null : (
            <p className="m-0 text-corps text-encre-douce" role="status">
              Import terminé. {accorder(rapport.ajoutes, 'sort ajouté', 'sorts ajoutés')},{' '}
              {accorder(rapport.deja, 'déjà présent', 'déjà présents')},{' '}
              {accorder(rapport.listes_lues, 'liste lue', 'listes lues')}
              {rapport.listes_ecartees > 0
                ? `, ${accorder(rapport.listes_ecartees, 'écartée comme malformée', 'écartées comme malformées')}`
                : ''}
              .
            </p>
          )}

          {active === null || active.sorts.length === 0 ? (
            <EtatVide
              actions={[
                {
                  libelle: 'Parcourir les sorts',
                  // Primary only when a list is chosen and empty. With no list
                  // at all, « Nouvelle liste » above already carries the one
                  // accent-flat action this screen allows.
                  primaire: active !== null,
                  surClic: () => routeur.push('/'),
                },
              ]}
              explication={
                <>
                  Aucun sort dans {active === null ? 'aucune liste' : `« ${active.nom} »`}.
                  L’étoile sur une fiche de sort ou sur une ligne de résultat ajoute aux
                  favoris.
                </>
              }
              titre="Liste vide"
            />
          ) : (
            <>
              <p className="m-0 text-petit text-encre-douce">
                {accorder(active.sorts.length, 'sort', 'sorts')} dans « {active.nom} »,
                modifiée le {horodatageCourt(active.modifie_le)}
              </p>

              {inconnus.length === 0 ? null : (
                <p className="m-0 text-corps" role="status">
                  <Badge ton="alerte">
                    {accorder(inconnus.length, 'identifiant inconnu', 'identifiants inconnus')}
                  </Badge>{' '}
                  Ces identifiants ne sont plus dans le corpus. Après une correction, un
                  sort peut avoir changé d’identifiant. Ils sont <strong>conservés</strong>,
                  pas supprimés. C’est vous qui les avez mis là.
                </p>
              )}

              <div className="overflow-x-auto rounded-panneau border border-bord bg-surface">
                <table className="w-full border-collapse text-corps">
                  <caption className="sr-only">
                    Les sorts de la liste « {active.nom} »
                  </caption>
                  <thead>
                    <tr>
                      <th
                        className="border-b border-bord px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce"
                        scope="col"
                      >
                        Sort
                      </th>
                      <th
                        className="border-b border-bord px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce"
                        scope="col"
                      >
                        École
                      </th>
                      <th
                        className="border-b border-bord px-2.5 py-1.5 text-left text-petit font-semibold text-encre-douce"
                        scope="col"
                      >
                        Niveaux par classe
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.sorts.map((id) => {
                      const sort = parId.get(id)
                      return (
                        <tr
                          className="h-ligne border-b border-bord last:border-b-0"
                          key={id}
                        >
                          <td className="px-2.5 py-1.5">
                            {sort === undefined ? (
                              <span className="font-donnees text-encre-douce">
                                {id}{' '}
                                <Badge ton="alerte" titre="Identifiant absent du corpus">
                                  inconnu
                                </Badge>
                              </span>
                            ) : (
                              <Link
                                className="text-encre no-underline hover:text-accent hover:underline"
                                href={{ pathname: `/sorts/${sort.s}/` }}
                              >
                                {sort.n}
                              </Link>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {sort === undefined || index === null ? (
                              <span className="text-encre-faible">—</span>
                            ) : (
                              <PastilleEcole ecole={ecoleDe(index, sort.e)} />
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-petit text-encre-douce">
                            {sort === undefined || index === null ? (
                              <span className="text-encre-faible">—</span>
                            ) : (
                              // A level always carries its class (B4): no bare
                              // number here either.
                              Object.entries(sort.niv)
                                .map(([classe, niveau]) => {
                                  const nom =
                                    index.classes.find((c) => c.slug === classe)?.nom ??
                                    classe
                                  return `${nom} ${niveau}`
                                })
                                .sort((a, b) => a.localeCompare(b, 'fr'))
                                .join(' · ')
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
