/**
 * The storage contract, tested with no index and no browser.
 *
 * The plan's last criterion — « fonctionne sans que l'index soit chargé » — is
 * why this file imports nothing from `lib/donnees`: favourites hold opaque ids,
 * and if this suite needed the corpus to pass, the module would have a dependency
 * it should not have.
 *
 * The rest is one theme: never lose someone's data. Corruption is rescued,
 * imports never overwrite, unknown ids are reported and kept.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CLE_SAUVEGARDE,
  CLE_STOCKAGE,
  ETAT_FAVORIS_VIDE,
  VERSION_FAVORIS,
  activerListe,
  ajouterListe,
  assignerPersonnage,
  basculer,
  charger,
  enregistrer,
  estFavori,
  exporter,
  idsInconnus,
  importer,
  listeActive,
  nomFichierExport,
  nouvelleListe,
  personnageInconnu,
  renommerListe,
  supprimerListe,
  valider,
  type EtatFavoris,
} from './stockage'

const T0 = '2026-07-31T10:00:00.000Z'
const T1 = '2026-07-31T11:00:00.000Z'

/** A minimal in-memory Storage, so the corruption path is exercised rather than
 * assumed. `jsdom` provides one, but a hand-rolled one can also be made to throw. */
function stockageFaux(initial: Record<string, string> = {}): Storage {
  const donnees = new Map(Object.entries(initial))
  return {
    get length() {
      return donnees.size
    },
    clear: () => donnees.clear(),
    getItem: (cle: string) => donnees.get(cle) ?? null,
    key: (indice: number) => [...donnees.keys()][indice] ?? null,
    removeItem: (cle: string) => donnees.delete(cle),
    setItem: (cle: string, valeur: string) => {
      donnees.set(cle, valeur)
    },
  } as Storage
}

function avecUneListe(sorts: readonly string[] = []): EtatFavoris {
  return {
    version: VERSION_FAVORIS,
    listes: [{ ...nouvelleListe('Ma liste', T0, 'l1'), sorts }],
    liste_active: 'l1',
  }
}

describe('charger', () => {
  it('rend l’état vide quand rien n’a jamais été enregistré', () => {
    expect(charger(stockageFaux())).toEqual({
      etat: ETAT_FAVORIS_VIDE,
      incident: { type: 'aucun' },
    })
  })

  it('relit ce qui a été enregistré : le favori persiste au rechargement', () => {
    const stockage = stockageFaux()
    const etat = basculer(avecUneListe(), 'degout', T1)
    expect(enregistrer(stockage, etat)).toBe(true)
    // A fresh `charger` is exactly what a page reload does.
    expect(charger(stockage).etat).toEqual(etat)
    expect(estFavori(charger(stockage).etat, 'degout')).toBe(true)
  })

  it('ne lève rien sur du JSON invalide et met le brut à l’abri AVANT tout', () => {
    const stockage = stockageFaux({ [CLE_STOCKAGE]: '{ceci n’est pas du json' })
    const chargement = charger(stockage)
    expect(chargement.etat).toEqual(ETAT_FAVORIS_VIDE)
    expect(chargement.incident).toEqual({ type: 'illisible', sauvegarde: true })
    // The original bytes, retrievable, character for character.
    expect(stockage.getItem(CLE_SAUVEGARDE)).toBe('{ceci n’est pas du json')
  })

  it('ne détruit pas non plus une version inconnue', () => {
    const brut = JSON.stringify({ version: 99, listes: [] })
    const stockage = stockageFaux({ [CLE_STOCKAGE]: brut })
    const chargement = charger(stockage)
    expect(chargement.incident).toEqual({ type: 'version', trouvee: 99 })
    expect(stockage.getItem(CLE_SAUVEGARDE)).toBe(brut)
    // And the live key is untouched until a real save happens: closing the tab
    // now leaves both copies intact.
    expect(stockage.getItem(CLE_STOCKAGE)).toBe(brut)
  })

  it('écarte une liste malformée sans deviner, et le dit', () => {
    const stockage = stockageFaux({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        listes: [
          { id_liste: 'a', nom: 'Bonne', sorts: ['degout'], cree_le: T0, modifie_le: T0 },
          { id_liste: 'b', nom: 'Sorts non tableau', sorts: 'degout' },
          { nom: 'Sans id', sorts: [] },
          { id_liste: 'd', nom: 'Ids non chaînes', sorts: [1, 2] },
        ],
        liste_active: 'a',
      }),
    })
    const chargement = charger(stockage)
    expect(chargement.etat.listes.map((liste) => liste.id_liste)).toEqual(['a'])
    expect(chargement.incident).toEqual({ type: 'listes_ecartees', nombre: 3 })
  })

  it('remplace une liste_active qui ne désigne rien plutôt que de rendre l’état inutilisable', () => {
    const stockage = stockageFaux({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        listes: [{ id_liste: 'a', nom: 'A', sorts: [], cree_le: T0, modifie_le: T0 }],
        liste_active: 'disparue',
      }),
    })
    expect(charger(stockage).etat.liste_active).toBe('a')
  })

  it('survit à un stockage qui refuse de répondre', () => {
    const casse = {
      getItem: () => {
        throw new Error('accès refusé')
      },
      setItem: () => {
        throw new Error('accès refusé')
      },
    } as unknown as Storage
    expect(() => charger(casse)).not.toThrow()
    expect(charger(casse).etat).toEqual(ETAT_FAVORIS_VIDE)
    expect(enregistrer(casse, ETAT_FAVORIS_VIDE)).toBe(false)
  })

  it('signale une sauvegarde impossible plutôt que de la prétendre faite', () => {
    const lectureSeule = {
      getItem: () => '{invalide',
      setItem: () => {
        throw new Error('quota')
      },
    } as unknown as Storage
    expect(charger(lectureSeule).incident).toEqual({ type: 'illisible', sauvegarde: false })
  })

  it('replie un id présent deux fois : deux fois le même sort est un bug d’écriture', () => {
    const stockage = stockageFaux({
      [CLE_STOCKAGE]: JSON.stringify({
        version: 1,
        listes: [
          { id_liste: 'a', nom: 'A', sorts: ['degout', 'degout'], cree_le: T0, modifie_le: T0 },
        ],
        liste_active: 'a',
      }),
    })
    expect(charger(stockage).etat.listes[0]?.sorts).toEqual(['degout'])
  })
})

describe('valider', () => {
  it.each([[null], [42], ['texte'], [{}], [{ version: 1 }], [{ version: 2, listes: [] }]])(
    'refuse %j',
    (brut) => {
      expect(valider(brut)).toBeNull()
    },
  )

  it('écarte un id_liste en doublon', () => {
    const valide = valider({
      version: 1,
      listes: [
        { id_liste: 'a', nom: 'A', sorts: [] },
        { id_liste: 'a', nom: 'A bis', sorts: [] },
      ],
      liste_active: 'a',
    })
    expect(valide?.etat.listes).toHaveLength(1)
    expect(valide?.ecartees).toBe(1)
  })
})

describe('basculer', () => {
  it('ajoute puis retire, et horodate', () => {
    const ajoute = basculer(avecUneListe(), 'degout', T1)
    expect(ajoute.listes[0]?.sorts).toEqual(['degout'])
    expect(ajoute.listes[0]?.modifie_le).toBe(T1)
    expect(basculer(ajoute, 'degout', T1).listes[0]?.sorts).toEqual([])
  })

  it('conserve l’ordre d’ajout', () => {
    let etat = avecUneListe()
    for (const id of ['c', 'a', 'b']) etat = basculer(etat, id, T1)
    expect(etat.listes[0]?.sorts).toEqual(['c', 'a', 'b'])
  })

  it('ne fait rien sans liste active, plutôt que d’en inventer une', () => {
    // Creating one here would hide the decision; the caller makes it explicitly.
    expect(basculer(ETAT_FAVORIS_VIDE, 'degout', T1)).toEqual(ETAT_FAVORIS_VIDE)
  })

  it('ne touche pas aux autres listes', () => {
    const deux = ajouterListe(avecUneListe(['a']), nouvelleListe('Autre', T0, 'l2'))
    const apres = basculer(deux, 'b', T1)
    expect(apres.listes[0]?.sorts).toEqual(['a'])
    expect(apres.listes[1]?.sorts).toEqual(['b'])
  })
})

describe('les listes', () => {
  it('active la liste créée', () => {
    const etat = ajouterListe(ETAT_FAVORIS_VIDE, nouvelleListe('Neuve', T0, 'l9'))
    expect(etat.liste_active).toBe('l9')
    expect(listeActive(etat)?.nom).toBe('Neuve')
  })

  it('renomme sans toucher au contenu', () => {
    const etat = renommerListe(avecUneListe(['a']), 'l1', 'Mon barde', T1)
    expect(etat.listes[0]?.nom).toBe('Mon barde')
    expect(etat.listes[0]?.sorts).toEqual(['a'])
    expect(etat.listes[0]?.modifie_le).toBe(T1)
  })

  it('reporte l’activité sur une liste restante après suppression', () => {
    const deux = ajouterListe(avecUneListe(['a']), nouvelleListe('Autre', T0, 'l2'))
    const apres = supprimerListe(activerListe(deux, 'l1'), 'l1')
    expect(apres.listes.map((liste) => liste.id_liste)).toEqual(['l2'])
    expect(apres.liste_active).toBe('l2')
  })

  it('retombe sur aucune liste active quand la dernière part', () => {
    expect(supprimerListe(avecUneListe(), 'l1').liste_active).toBeNull()
  })

  it('ignore une activation vers une liste inexistante', () => {
    const etat = avecUneListe()
    expect(activerListe(etat, 'fantome')).toEqual(etat)
  })
})

describe('exporter / importer', () => {
  it('fait un aller-retour exact : exporter puis importer restitue la même liste', () => {
    const depart = basculer(basculer(avecUneListe(), 'a', T1), 'b', T1)
    const fichier = exporter(depart)
    // Re-imported into an empty state as a new list: the ids must survive intact.
    const rapport = importer(ETAT_FAVORIS_VIDE, JSON.parse(fichier), 'nouvelle', T1, () => 'l1')
    expect(rapport?.etat.listes).toHaveLength(1)
    expect(rapport?.etat.listes[0]?.sorts).toEqual(depart.listes[0]?.sorts)
    expect(rapport?.etat.listes[0]?.nom).toBe(depart.listes[0]?.nom)
    expect(rapport?.ajoutes).toBe(2)
  })

  it('écrit un JSON indenté avec saut de ligne final, comme tout le dépôt', () => {
    const contenu = exporter(avecUneListe(['a']))
    expect(contenu.endsWith('\n')).toBe(true)
    expect(contenu).toContain('\n  "version": 1')
  })

  it('« fusionner » ne perd aucun id préexistant', () => {
    const cible = basculer(avecUneListe(), 'deja', T0)
    const source = { version: 1, listes: [{ id_liste: 'x', nom: 'X', sorts: ['neuf', 'deja'] }] }
    const rapport = importer(cible, source, 'fusionner', T1, () => 'l2')
    expect(rapport?.etat.listes[0]?.sorts).toEqual(['deja', 'neuf'])
    expect(rapport?.ajoutes).toBe(1)
    expect(rapport?.deja).toBe(1)
    // One list, still: merging adds ids, never lists.
    expect(rapport?.etat.listes).toHaveLength(1)
  })

  it('« nouvelle liste » ne modifie pas la liste active', () => {
    const cible = basculer(avecUneListe(), 'deja', T0)
    const rapport = importer(
      cible,
      { version: 1, listes: [{ id_liste: 'x', nom: 'Importée', sorts: ['neuf'] }] },
      'nouvelle',
      T1,
      () => 'l2',
    )
    expect(rapport?.etat.liste_active).toBe('l1')
    expect(listeActive(rapport?.etat as EtatFavoris)?.sorts).toEqual(['deja'])
    expect(rapport?.etat.listes.map((liste) => liste.nom)).toEqual(['Ma liste', 'Importée'])
  })

  it('« nouvelle liste » sur un état vide laisse une liste active', () => {
    // The restore-on-another-device flow: nothing stored yet, so there is no
    // active list to protect. Importing lists and activating none produces a
    // state `valider` itself refuses — lists present, nothing selected — which
    // the view can only render as empty.
    const rapport = importer(
      ETAT_FAVORIS_VIDE,
      { version: 1, listes: [{ id_liste: 'x', nom: 'Importée', sorts: ['neuf'] }] },
      'nouvelle',
      T1,
      () => 'l1',
    )
    expect(rapport?.etat.liste_active).toBe('l1')
    expect(listeActive(rapport?.etat as EtatFavoris)?.sorts).toEqual(['neuf'])
  })

  it('active la première liste du fichier quand il en apporte plusieurs', () => {
    const rapport = importer(
      ETAT_FAVORIS_VIDE,
      {
        version: 1,
        listes: [
          { id_liste: 'a', nom: 'Première', sorts: ['un'] },
          { id_liste: 'b', nom: 'Seconde', sorts: ['deux'] },
        ],
      },
      'nouvelle',
      T1,
      (indice) => `l${indice}`,
    )
    expect(rapport?.etat.liste_active).toBe('l0')
    expect(listeActive(rapport?.etat as EtatFavoris)?.nom).toBe('Première')
  })

  it('n’active rien quand le fichier n’apporte aucune liste', () => {
    // Rule 3: there is nothing to activate, so the null is honest. The interface
    // owes the user a sentence saying the file was empty — see the view test.
    const rapport = importer(ETAT_FAVORIS_VIDE, { version: 1, listes: [] }, 'nouvelle', T1, () => 'l1')
    expect(rapport?.listes_lues).toBe(0)
    expect(rapport?.etat.listes).toEqual([])
    expect(rapport?.etat.liste_active).toBeNull()
  })

  it('ne rend jamais un état où des listes existent sans liste active', () => {
    // The invariant `valider` enforces on the read path, asserted on the write
    // path: this is the class of defect, not one instance of it.
    for (const depart of [ETAT_FAVORIS_VIDE, avecUneListe(['deja'])]) {
      for (const mode of ['nouvelle', 'fusionner'] as const) {
        const rapport = importer(
          depart,
          { version: 1, listes: [{ id_liste: 'x', nom: 'X', sorts: ['neuf'] }] },
          mode,
          T1,
          () => 'l2',
        )
        if (rapport === null) continue
        if (rapport.etat.listes.length > 0) expect(rapport.etat.liste_active).not.toBeNull()
        expect(listeActive(rapport.etat)).not.toBeNull()
      }
    }
  })

  it('réattribue les id_liste à l’import pour ne pas écraser une liste existante', () => {
    const cible = avecUneListe(['deja'])
    const rapport = importer(
      cible,
      // Same id_liste as the existing list: a file exported from this very browser.
      { version: 1, listes: [{ id_liste: 'l1', nom: 'Clone', sorts: ['neuf'] }] },
      'nouvelle',
      T1,
      (indice) => `neuf${indice}`,
    )
    expect(rapport?.etat.listes.map((liste) => liste.id_liste)).toEqual(['l1', 'neuf0'])
    expect(rapport?.etat.listes[0]?.sorts).toEqual(['deja'])
  })

  it('refuse un fichier qui n’est pas une v1, sans rien changer', () => {
    const cible = avecUneListe(['deja'])
    expect(importer(cible, { version: 7, listes: [] }, 'fusionner', T1, () => 'x')).toBeNull()
    expect(importer(cible, 'nawak', 'nouvelle', T1, () => 'x')).toBeNull()
  })

  it('refuse une fusion sans liste active plutôt que d’en créer une en douce', () => {
    expect(
      importer(
        ETAT_FAVORIS_VIDE,
        { version: 1, listes: [{ id_liste: 'x', nom: 'X', sorts: ['a'] }] },
        'fusionner',
        T1,
        () => 'l1',
      ),
    ).toBeNull()
  })

  it('compte les listes écartées du fichier importé', () => {
    const rapport = importer(
      avecUneListe(),
      { version: 1, listes: [{ id_liste: 'x', nom: 'X', sorts: ['a'] }, { nom: 'cassée' }] },
      'fusionner',
      T1,
      () => 'l2',
    )
    expect(rapport?.listes_ecartees).toBe(1)
    expect(rapport?.ajoutes).toBe(1)
  })
})

describe('nomFichierExport', () => {
  it.each([
    ['Ma liste', 'ma-liste-2026-07-31.json'],
    ['Mon barde à l’œuvre', 'mon-barde-a-l-oeuvre-2026-07-31.json'],
    ['   ', 'favoris-2026-07-31.json'],
    ['!!!', 'favoris-2026-07-31.json'],
  ])('plie %j en %j', (nom, attendu) => {
    expect(nomFichierExport(nom, '2026-07-31')).toBe(attendu)
  })
})

describe('idsInconnus', () => {
  it('signale les ids absents du corpus et ne les retire pas', () => {
    const liste = { ...nouvelleListe('A', T0, 'l1'), sorts: ['degout', 'sort-renomme'] }
    expect(idsInconnus(liste, new Set(['degout']))).toEqual(['sort-renomme'])
    // The list itself is untouched — the function reports, it does not prune.
    expect(liste.sorts).toEqual(['degout', 'sort-renomme'])
  })

  it('ne signale rien quand tout est connu', () => {
    const liste = { ...nouvelleListe('A', T0, 'l1'), sorts: ['degout'] }
    expect(idsInconnus(liste, new Set(['degout', 'autre']))).toEqual([])
  })
})

describe('assignerPersonnage', () => {
  it('attache un personnage et met à jour modifie_le', () => {
    const apres = assignerPersonnage(avecUneListe(), 'l1', 'perso-1', T1)
    expect(apres.listes[0]?.personnage_id).toBe('perso-1')
    expect(apres.listes[0]?.modifie_le).toBe(T1)
  })

  it('détache avec null', () => {
    const avecPerso = assignerPersonnage(avecUneListe(), 'l1', 'perso-1', T0)
    const apres = assignerPersonnage(avecPerso, 'l1', null, T1)
    expect(apres.listes[0]?.personnage_id).toBeNull()
  })
})

describe('personnageInconnu', () => {
  it('signale un personnage_id que le compte ne connaît plus', () => {
    const liste = { ...nouvelleListe('A', T0, 'l1'), personnage_id: 'perso-supprime' }
    expect(personnageInconnu(liste, new Set(['perso-1']))).toBe(true)
  })

  it('ne signale rien pour une liste sans personnage', () => {
    const liste = nouvelleListe('A', T0, 'l1')
    expect(personnageInconnu(liste, new Set())).toBe(false)
  })

  it('ne signale rien quand le personnage existe', () => {
    const liste = { ...nouvelleListe('A', T0, 'l1'), personnage_id: 'perso-1' }
    expect(personnageInconnu(liste, new Set(['perso-1']))).toBe(false)
  })
})

describe('immuabilité', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('aucune opération ne mute l’état reçu', () => {
    const depart = avecUneListe(['a'])
    const gele = JSON.stringify(depart)
    basculer(depart, 'b', T1)
    renommerListe(depart, 'l1', 'X', T1)
    supprimerListe(depart, 'l1')
    ajouterListe(depart, nouvelleListe('N', T0, 'l2'))
    importer(depart, { version: 1, listes: [] }, 'fusionner', T1, () => 'z')
    expect(JSON.stringify(depart)).toBe(gele)
  })
})
