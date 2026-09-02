'use client'

import { useEffect, useMemo, useState } from 'react'

import { Annonce, Bouton } from '@/components/compte/elements'
import { usePersonnageActif } from '@/lib/compte/contexte-personnages'
import { chargerContratMoteurDons, type ContratCharge } from '@/lib/dons/charger-contrat'
import { calculerEmplacements, type DonneesEmplacements, type Emplacement } from '@/lib/dons/emplacements'
import { evaluerDon, nettoyerNomDon, normaliser } from '@/lib/dons/moteur'
import { versCharacter } from '@/lib/dons/vers-character'

/** A feat is repeatable when its catalog name ends with `*` — the same
 * marker `data_loader.py::clean_feat_name` strips. Assigning one a second
 * time is refused deliberately (mirrors the Python CLI's own limitation,
 * see `16_CHARACTER_BINDING.md`), not silently worked around. */
function estRepetable(nomDon: string): boolean {
  return nomDon.trim().endsWith('*')
}

/**
 * Feat slots for the active character, and their assignment.
 *
 * There is no server-side slot table (`personnages.dons_acquis` is a flat
 * array of feat names, per the step-12 migration) — so which slot holds
 * which feat is derived client-side, deterministically, by greedily filling
 * slots in `calculerEmplacements`'s own order with whatever the character
 * already holds. Only `dons_acquis` itself is the persisted fact; the
 * slot/feat mapping is a presentation of it, recomputed on every render, so
 * it can never drift from what is actually saved.
 */
export function Emplacements() {
  const { personnageActif, modifier } = usePersonnageActif()
  const [donnees, setDonnees] = useState<DonneesEmplacements | null>(null)
  const [contrat, setContrat] = useState<ContratCharge | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    Promise.all([
      fetch('/data/emplacements.json').then((r) => r.json() as Promise<DonneesEmplacements>),
      chargerContratMoteurDons(),
    ])
      .then(([donneesChargees, contratCharge]) => {
        if (!vivant) return
        setDonnees(donneesChargees)
        setContrat(contratCharge)
      })
      .catch((cause: unknown) => {
        if (vivant) setErreur(cause instanceof Error ? cause.message : 'chargement impossible')
      })
    return () => {
      vivant = false
    }
  }, [])

  const emplacements: readonly Emplacement[] = useMemo(() => {
    if (personnageActif === null || donnees === null) return []
    return calculerEmplacements(
      personnageActif.classe ?? '',
      personnageActif.niveau ?? 0,
      personnageActif.race,
      donnees,
    )
  }, [personnageActif, donnees])

  // Greedy, deterministic slot/feat mapping — see the module doc above.
  const assignationsParSlot: Readonly<Record<string, string>> = useMemo(() => {
    if (personnageActif === null) return {}
    const mapping: Record<string, string> = {}
    const restants = [...personnageActif.dons_acquis]
    for (const emplacement of emplacements) {
      const nom = restants.shift()
      if (nom !== undefined) mapping[emplacement.slot_id] = nom
    }
    return mapping
  }, [personnageActif, emplacements])

  if (personnageActif === null) {
    return (
      <p className="text-corps text-encre-douce" role="status">
        Sélectionnez un personnage pour voir ses emplacements de dons.
      </p>
    )
  }

  if (erreur !== null) {
    return <Annonce ton="echec">{erreur}</Annonce>
  }

  if (donnees === null || contrat === null) {
    return (
      <p className="text-corps text-encre-douce" role="status">
        Chargement des emplacements…
      </p>
    )
  }

  const perso = versCharacter(personnageActif)

  // Candidates are recomputed from the WHOLE catalogue every render — never a
  // cached list from before the last assignment, since assigning one feat
  // can change what else becomes eligible through prerequisite chains.
  const candidatsParSlot = new Map<string, readonly string[]>()
  for (const emplacement of emplacements) {
    if (assignationsParSlot[emplacement.slot_id] !== undefined) continue
    const candidats: string[] = []
    for (const [nomDon, conditions] of contrat.catalogue) {
      const resultat = evaluerDon(nomDon, conditions, perso, contrat.tables)
      if (resultat.statut === 'eligible' || resultat.statut === 'manual_check') {
        candidats.push(nomDon)
      }
    }
    candidatsParSlot.set(emplacement.slot_id, candidats.sort((a, b) => a.localeCompare(b)))
  }

  async function assigner(slotId: string, nomDon: string): Promise<void> {
    if (assignationsParSlot[slotId] !== undefined) {
      setErreur(`Emplacement déjà occupé : ${slotId}.`)
      return
    }
    const dejaPris = personnageActif!.dons_acquis.some(
      (n) => normaliser(nettoyerNomDon(n)) === normaliser(nettoyerNomDon(nomDon)),
    )
    if (dejaPris) {
      setErreur(
        estRepetable(nomDon)
          ? `« ${nomDon} » est un don répétable, mais cet éditeur ne permet pas de l’assigner deux fois — limite connue et assumée, comme dans le CLI Python.`
          : `« ${nomDon} » est déjà attribué à un autre emplacement.`,
      )
      return
    }
    setErreur(null)
    const suivant = [...personnageActif!.dons_acquis, nomDon]
    const resultat = await modifier(
      personnageActif!.id,
      personnageActif!.nom,
      personnageActif!.classe,
      personnageActif!.niveau,
      { dons_acquis: suivant },
    )
    if (!resultat.ok) setErreur(resultat.message)
  }

  async function desassigner(nomDon: string): Promise<void> {
    setErreur(null)
    const suivant = personnageActif!.dons_acquis.filter(
      (n) => normaliser(nettoyerNomDon(n)) !== normaliser(nettoyerNomDon(nomDon)),
    )
    const resultat = await modifier(
      personnageActif!.id,
      personnageActif!.nom,
      personnageActif!.classe,
      personnageActif!.niveau,
      { dons_acquis: suivant },
    )
    if (!resultat.ok) setErreur(resultat.message)
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur !== null ? <Annonce ton="echec">{erreur}</Annonce> : null}
      <ul className="flex flex-col gap-3">
        {emplacements.map((emplacement) => {
          const attribue = assignationsParSlot[emplacement.slot_id]
          const candidats = candidatsParSlot.get(emplacement.slot_id) ?? []
          return (
            <li className="rounded-panneau border border-bord p-3" key={emplacement.slot_id}>
              <p className="m-0 text-petit text-encre-douce">
                {emplacement.slot_id} · {emplacement.source} · niveau {emplacement.level_gained}
                {emplacement.category_restriction !== null
                  ? ` · restreint à ${emplacement.category_restriction}`
                  : ''}
              </p>
              {attribue !== undefined ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-corps text-encre">{attribue}</span>
                  <Bouton surClic={() => void desassigner(attribue)}>Retirer</Bouton>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`emplacement-${emplacement.slot_id}`}>
                    Don pour {emplacement.slot_id}
                  </label>
                  <select
                    className="rounded-jeton border border-bord-fort bg-surface px-2 py-1 text-corps text-encre"
                    defaultValue=""
                    id={`emplacement-${emplacement.slot_id}`}
                    onChange={(evenement) => {
                      const valeur = evenement.target.value
                      if (valeur !== '') void assigner(emplacement.slot_id, valeur)
                      evenement.target.value = ''
                    }}
                  >
                    <option value="">
                      — {candidats.length} don(s) candidat(s), éligibles et à vérifier —
                    </option>
                    {candidats.map((nomDon) => (
                      <option key={nomDon} value={nomDon}>
                        {nomDon}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
