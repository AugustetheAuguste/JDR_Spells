/**
 * Local favourite lists: the format, and the rules for never losing them.
 *
 * Everything here is pure or takes its `Storage` as an argument, so the whole
 * contract is testable without a browser and without the index. That matters
 * because favourites hold **ids and nothing else**: an id is stable, a slug is a
 * function of the naming algorithm and could change. So this module never needs
 * to know what a spell is, and an id it cannot resolve is reported rather than
 * removed.
 *
 * The one rule that outranks the others: **never destroy someone's data
 * silently.** Malformed JSON is copied aside under a second key before anything
 * is overwritten, an import always asks merge-or-new, and an unknown id stays put.
 */

import { plier } from '@/lib/recherche/pliage'

export const CLE_STOCKAGE = 'pf-sorts-favoris'
/** Where a payload we could not read is preserved, verbatim, before reset. */
export const CLE_SAUVEGARDE = 'pf-sorts-favoris-corrompu'
export const VERSION_FAVORIS = 1

export interface ListeFavoris {
  readonly id_liste: string
  readonly nom: string
  readonly cree_le: string
  readonly modifie_le: string
  /** Spell ids, in insertion order. */
  readonly sorts: readonly string[]
}

export interface EtatFavoris {
  readonly version: number
  readonly listes: readonly ListeFavoris[]
  readonly liste_active: string | null
}

/** What `charger` had to do to the payload, so the interface can say it out loud
 * instead of the user discovering it by losing a list. */
export type Incident =
  | { readonly type: 'aucun' }
  | { readonly type: 'illisible'; readonly sauvegarde: boolean }
  | { readonly type: 'version'; readonly trouvee: unknown }
  | { readonly type: 'listes_ecartees'; readonly nombre: number }

export interface Chargement {
  readonly etat: EtatFavoris
  readonly incident: Incident
}

export const ETAT_FAVORIS_VIDE: EtatFavoris = {
  version: VERSION_FAVORIS,
  listes: [],
  liste_active: null,
}

/**
 * Validate one list, dropping it rather than guessing at it.
 *
 * A list missing its name could be repaired with a default, but a list whose
 * `sorts` is not an array of strings cannot be repaired at all — and a
 * half-guessed list is worse than a reported loss, because the user believes it
 * is intact. Timestamps are the one exception: they are metadata, not content,
 * so an absent one is filled rather than costing the list.
 */
function validerListe(brut: unknown): ListeFavoris | null {
  if (typeof brut !== 'object' || brut === null) return null
  const objet = brut as Record<string, unknown>
  if (typeof objet['id_liste'] !== 'string' || objet['id_liste'] === '') return null
  if (typeof objet['nom'] !== 'string') return null
  if (!Array.isArray(objet['sorts'])) return null
  if (!objet['sorts'].every((sort) => typeof sort === 'string' && sort !== '')) return null
  const horodatage = (cle: string): string =>
    typeof objet[cle] === 'string' ? (objet[cle] as string) : ''
  return {
    id_liste: objet['id_liste'],
    nom: objet['nom'],
    cree_le: horodatage('cree_le'),
    modifie_le: horodatage('modifie_le'),
    // Duplicates collapse: the same id twice is a write bug, never intent.
    sorts: [...new Set(objet['sorts'] as string[])],
  }
}

/** Validate a whole payload. Returns null when it is not a v1 envelope at all. */
export function valider(brut: unknown): { readonly etat: EtatFavoris; readonly ecartees: number } | null {
  if (typeof brut !== 'object' || brut === null) return null
  const objet = brut as Record<string, unknown>
  if (objet['version'] !== VERSION_FAVORIS) return null
  if (!Array.isArray(objet['listes'])) return null

  const listes: ListeFavoris[] = []
  let ecartees = 0
  for (const candidate of objet['listes']) {
    const liste = validerListe(candidate)
    if (liste === null) ecartees += 1
    else if (listes.some((autre) => autre.id_liste === liste.id_liste)) ecartees += 1
    else listes.push(liste)
  }

  const demandee = objet['liste_active']
  const active =
    typeof demandee === 'string' && listes.some((liste) => liste.id_liste === demandee)
      ? demandee
      : (listes[0]?.id_liste ?? null)

  return { etat: { version: VERSION_FAVORIS, listes, liste_active: active }, ecartees }
}

/**
 * The one invariant of this module: **lists present, so one of them is active.**
 *
 * `valider` has always enforced it on the read path, which is why a reload used
 * to repair a state that an import had left unselected. Enforcing it here too
 * means the write path cannot produce a state the read path would refuse — the
 * asymmetry was the defect, not the null itself.
 *
 * A list already active is never stolen: this only ever fills a hole. When there
 * is no list at all there is nothing to activate, and the null is honest — the
 * caller owes the user a sentence saying so rather than a success message.
 */
export function garantirActive(etat: EtatFavoris): EtatFavoris {
  if (listeActive(etat) !== null) return etat
  const premiere = etat.listes[0]?.id_liste ?? null
  return premiere === etat.liste_active ? etat : { ...etat, liste_active: premiere }
}

/**
 * Read the state out of a storage.
 *
 * Takes the `Storage` rather than reaching for `localStorage`, so the corruption
 * path is a test and not a hope. Nothing is written here except the rescue copy:
 * reset happens on the next real save, which means a user who closes the tab
 * still has their bytes under `CLE_SAUVEGARDE`.
 */
export function charger(stockage: Storage): Chargement {
  let brut: string | null = null
  try {
    brut = stockage.getItem(CLE_STOCKAGE)
  } catch {
    // Storage can throw outright — Safari private mode, a disabled cookie policy.
    return { etat: ETAT_FAVORIS_VIDE, incident: { type: 'aucun' } }
  }
  if (brut === null || brut === '') {
    return { etat: ETAT_FAVORIS_VIDE, incident: { type: 'aucun' } }
  }

  let analyse: unknown
  try {
    analyse = JSON.parse(brut)
  } catch {
    return {
      etat: ETAT_FAVORIS_VIDE,
      incident: { type: 'illisible', sauvegarde: sauvegarder(stockage, brut) },
    }
  }

  const version = (analyse as Record<string, unknown> | null)?.['version']
  if (version !== VERSION_FAVORIS) {
    // No migration exists yet because no other version was ever written. Saying
    // so beats a silent reset, and the bytes are kept either way.
    sauvegarder(stockage, brut)
    return { etat: ETAT_FAVORIS_VIDE, incident: { type: 'version', trouvee: version } }
  }

  const valide = valider(analyse)
  if (valide === null) {
    return {
      etat: ETAT_FAVORIS_VIDE,
      incident: { type: 'illisible', sauvegarde: sauvegarder(stockage, brut) },
    }
  }
  return {
    etat: valide.etat,
    incident:
      valide.ecartees === 0
        ? { type: 'aucun' }
        : { type: 'listes_ecartees', nombre: valide.ecartees },
  }
}

function sauvegarder(stockage: Storage, brut: string): boolean {
  try {
    stockage.setItem(CLE_SAUVEGARDE, brut)
    return true
  } catch {
    return false
  }
}

/** Persist. Returns false when the storage refused — a full quota is not silent. */
export function enregistrer(stockage: Storage, etat: EtatFavoris): boolean {
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(etat))
    return true
  } catch {
    return false
  }
}

/** An id derived from the clock, which is passed in: a module that calls
 * `Date.now()` itself cannot be tested for equality. */
export function nouvelleListe(nom: string, maintenant: string, graine: string): ListeFavoris {
  return { id_liste: graine, nom, cree_le: maintenant, modifie_le: maintenant, sorts: [] }
}

function majListe(
  etat: EtatFavoris,
  id_liste: string,
  transformer: (liste: ListeFavoris) => ListeFavoris,
): EtatFavoris {
  return {
    ...etat,
    listes: etat.listes.map((liste) =>
      liste.id_liste === id_liste ? transformer(liste) : liste,
    ),
  }
}

export function ajouterListe(etat: EtatFavoris, liste: ListeFavoris): EtatFavoris {
  return { ...etat, listes: [...etat.listes, liste], liste_active: liste.id_liste }
}

export function supprimerListe(etat: EtatFavoris, id_liste: string): EtatFavoris {
  const listes = etat.listes.filter((liste) => liste.id_liste !== id_liste)
  return {
    ...etat,
    listes,
    liste_active:
      etat.liste_active === id_liste ? (listes[0]?.id_liste ?? null) : etat.liste_active,
  }
}

export function renommerListe(
  etat: EtatFavoris,
  id_liste: string,
  nom: string,
  maintenant: string,
): EtatFavoris {
  return majListe(etat, id_liste, (liste) => ({ ...liste, nom, modifie_le: maintenant }))
}

export function activerListe(etat: EtatFavoris, id_liste: string): EtatFavoris {
  return etat.listes.some((liste) => liste.id_liste === id_liste)
    ? { ...etat, liste_active: id_liste }
    : etat
}

export function listeActive(etat: EtatFavoris): ListeFavoris | null {
  return etat.listes.find((liste) => liste.id_liste === etat.liste_active) ?? null
}

/** Toggle one spell in the active list. A no-op when there is no active list —
 * the caller creates one first; inventing one here would hide the decision. */
export function basculer(
  etat: EtatFavoris,
  id_sort: string,
  maintenant: string,
): EtatFavoris {
  const active = listeActive(etat)
  if (active === null) return etat
  const dedans = active.sorts.includes(id_sort)
  return majListe(etat, active.id_liste, (liste) => ({
    ...liste,
    modifie_le: maintenant,
    sorts: dedans
      ? liste.sorts.filter((autre) => autre !== id_sort)
      : [...liste.sorts, id_sort],
  }))
}

export function estFavori(etat: EtatFavoris, id_sort: string): boolean {
  return listeActive(etat)?.sorts.includes(id_sort) ?? false
}

/**
 * The exported file name: folded, then dated.
 *
 * `plier` is reused rather than a second fold written here — a second fold is a
 * second thing to drift. It leaves accents and ligatures handled correctly; all
 * that remains is turning what is left into filename-safe runs.
 */
export function nomFichierExport(nom: string, date: string): string {
  const plie = plier(nom)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${plie === '' ? 'favoris' : plie}-${date}.json`
}

/** The exported bytes. Indented, with a trailing newline, like every other JSON
 * in this repository: a human will open this file. */
export function exporter(etat: EtatFavoris): string {
  return `${JSON.stringify(etat, null, 2)}\n`
}

export type ModeImport = 'fusionner' | 'nouvelle'

export interface RapportImport {
  readonly etat: EtatFavoris
  /** Ids that were not already in the target list. */
  readonly ajoutes: number
  /** Ids already present, so not added twice. */
  readonly deja: number
  readonly listes_lues: number
  readonly listes_ecartees: number
}

/**
 * Import a payload. Never overwrites: the caller must have chosen a mode.
 *
 * `fusionner` adds to the active list and cannot lose a pre-existing id — it is
 * a union. `nouvelle` appends the imported lists untouched and never steals an
 * active list, which is why it is safe to offer as the default when nothing is
 * selected — but it does fill the hole when there was nothing active at all
 * (`garantirActive`): the restore-into-a-fresh-browser case, where leaving the
 * selection empty means importing lists nobody can see.
 */
export function importer(
  etat: EtatFavoris,
  brut: unknown,
  mode: ModeImport,
  maintenant: string,
  graine: (indice: number) => string,
): RapportImport | null {
  const valide = valider(brut)
  if (valide === null) return null

  const entrantes = valide.etat.listes
  if (mode === 'nouvelle') {
    const listes = entrantes.map((liste, indice) => ({
      ...liste,
      id_liste: graine(indice),
      modifie_le: maintenant,
    }))
    return {
      // An active list is never moved; an absent one is chosen. Both halves of
      // the rule are `garantirActive`, so the write path cannot emit a state the
      // read path would repair behind the user's back.
      etat: garantirActive({ ...etat, listes: [...etat.listes, ...listes] }),
      ajoutes: listes.reduce((total, liste) => total + liste.sorts.length, 0),
      deja: 0,
      listes_lues: listes.length,
      listes_ecartees: valide.ecartees,
    }
  }

  const active = listeActive(etat)
  if (active === null) return null
  const entrants = [...new Set(entrantes.flatMap((liste) => liste.sorts))]
  const nouveaux = entrants.filter((id) => !active.sorts.includes(id))
  return {
    etat: majListe(etat, active.id_liste, (liste) => ({
      ...liste,
      modifie_le: maintenant,
      sorts: [...liste.sorts, ...nouveaux],
    })),
    ajoutes: nouveaux.length,
    deja: entrants.length - nouveaux.length,
    listes_lues: entrantes.length,
    listes_ecartees: valide.ecartees,
  }
}

/**
 * Ids in a list that the current corpus does not know.
 *
 * This happens after a corpus correction renames a spell. They are shown and
 * kept, never deleted: the user put them there, and a deletion the user did not
 * ask for is the failure mode this whole module is built against.
 */
export function idsInconnus(
  liste: ListeFavoris,
  connus: ReadonlySet<string>,
): readonly string[] {
  return liste.sorts.filter((id) => !connus.has(id))
}
