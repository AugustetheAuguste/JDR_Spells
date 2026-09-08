'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { MOTS } from '@/lib/design/tokens'
import { useFiches } from '@/lib/fiche_personnage/contexte-fiches'
import { chargerRegles, type TablesRegles } from '@/lib/fiche_personnage/regles'
import { modificateurCaracteristique, valeurEffectiveCaracteristique } from '@/lib/fiche_personnage/caracteristiques'
import { initiative, manoeuvreDefensive, manoeuvreOffensive, pointsDeVieMaximum, resistanceMagie } from '@/lib/fiche_personnage/combat'
import { classeArmure, vitesse } from '@/lib/fiche_personnage/defense'
import { sauvegarde } from '@/lib/fiche_personnage/sauvegardes'
import { attaquesCompletes } from '@/lib/fiche_personnage/attaques'
import { totalCompetence } from '@/lib/fiche_personnage/competences'
import { degreDeDifficulte, emplacementsTotaux, niveauLanceur } from '@/lib/fiche_personnage/sorts'
import type {
  Attaque,
  Aptitude,
  Caracteristique,
  ClasseFiche,
  Competence,
  Equipement,
  Fiche,
  Sauvegarde,
} from '@/lib/fiche_personnage/schema'
import type { SegmentAriane } from '@/components/navigation/FilAriane'
import { FilAriane } from '@/components/navigation/FilAriane'

import { CarnetSorts } from './CarnetSorts'
import { ChampSaisi } from './ChampSaisi'
import { LectureCorpus } from './LectureCorpus'
import { PanneauLateral } from './PanneauLateral'
import { Section } from './Section'
import { SectionDons } from './SectionDons'
import { ValeurCalculee } from './ValeurCalculee'

/** L'état du panneau latéral partagé par la section Dons et la section
 * Sorts : un seul panneau à la fois pour toute la fiche, jamais un par
 * section (plan 16, § PanneauLateral). */
interface EtatPanneau {
  readonly corpus: 'sorts' | 'dons'
  readonly ref: string
  readonly titre: string
  readonly declencheur: HTMLElement | null
}

const NIVEAUX_DE_SORT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const CARACTERISTIQUES: readonly Caracteristique[] = ['force', 'dexterite', 'constitution', 'intelligence', 'sagesse', 'charisme']
const LIBELLES_CARACTERISTIQUES: Readonly<Record<Caracteristique, string>> = {
  force: 'Force',
  dexterite: 'Dextérité',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  sagesse: 'Sagesse',
  charisme: 'Charisme',
}
const SAUVEGARDES: readonly Sauvegarde[] = ['reflexes', 'vigueur', 'volonte']
const LIBELLES_SAUVEGARDES: Readonly<Record<Sauvegarde, string>> = {
  reflexes: 'Réflexes',
  vigueur: 'Vigueur',
  volonte: 'Volonté',
}

const NOMS_TABLES = ['types_bonus.json', 'modificateurs_caracteristiques.json', 'sorts_bonus.json', 'armures.json', 'progression_classes.json']

async function chargerTablesDepuisReseau(): Promise<TablesRegles> {
  const paires = await Promise.all(
    NOMS_TABLES.map(async (nom): Promise<readonly [string, string | null]> => {
      try {
        const reponse = await fetch(`/data/regles/${nom}`)
        if (!reponse.ok) return [nom, null]
        return [nom, await reponse.text()]
      } catch {
        return [nom, null]
      }
    }),
  )
  const table = new Map(paires)
  return chargerRegles((nom) => table.get(nom) ?? null)
}

/**
 * The single sheet route, `/personnages/fiche/?id=...` — a query parameter,
 * never a dynamic segment, because `output: 'export'` has no server to
 * resolve one at request time (plan 15 § contexte du dépôt).
 *
 * `useSearchParams` needs a Suspense boundary at build time under static
 * export, provided by `app/personnages/fiche/page.tsx`.
 */
export function VueFiche() {
  const parametres = useSearchParams()
  const id = parametres.get('id')

  if (id === null) {
    return <EtatIdentifiantAbsent />
  }

  return <VueFicheChargee ficheId={id} key={id} />
}

function EtatIdentifiantAbsent() {
  return (
    <section>
      <h1 className="m-0 font-affichage text-titre1 font-semibold text-encre">{MOTS.ficheIntrouvable}</h1>
      <p className="mt-3 text-grand text-encre-douce">
        Aucun identifiant de fiche n’a été fourni.
      </p>
      <Link className="text-accent underline hover:text-accent-survol" href={'/personnages/' as Route}>
        {MOTS.navPersonnages}
      </Link>
    </section>
  )
}

/**
 * Keyed by `ficheId` from the parent, so switching sheets through the
 * breadcrumb selector remounts this component rather than trying to
 * reconcile a new sheet's data into a draft seeded from the old one.
 */
function VueFicheChargee({ ficheId }: { readonly ficheId: string }) {
  const { chargement, fiches, modifier } = useFiches()

  if (chargement) {
    return (
      <section>
        <p className="text-grand text-encre-douce">{MOTS.ficheChargementTexte}</p>
      </section>
    )
  }

  const fiche = fiches.find((f) => f.id === ficheId) ?? null

  if (fiche === null) {
    return (
      <section>
        <h1 className="m-0 font-affichage text-titre1 font-semibold text-encre">{MOTS.ficheIntrouvable}</h1>
        <p className="mt-3 text-grand text-encre-douce">
          Aucune fiche n’existe sous cet identifiant sur cet appareil.
        </p>
        <Link className="text-accent underline hover:text-accent-survol" href={'/personnages/' as Route}>
          {MOTS.navPersonnages}
        </Link>
      </section>
    )
  }

  const autresFiches = fiches.filter((f) => f.id !== ficheId)

  return <VueFicheEditable autresFiches={autresFiches} fiche={fiche} modifier={modifier} />
}

function VueFicheEditable({
  fiche,
  autresFiches,
  modifier,
}: {
  readonly fiche: Fiche
  readonly autresFiches: readonly Fiche[]
  readonly modifier: (fiche: Fiche) => Promise<{ readonly ok: boolean; readonly motif?: string }>
}) {
  const [brouillon, setBrouillon] = useState<Fiche>(fiche)
  const [tables, setTables] = useState<TablesRegles | null>(null)
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null)
  const [panneau, setPanneau] = useState<EtatPanneau | null>(null)

  // Un seul panneau pour toute la fiche : les sections Dons et Sorts
  // reçoivent chacune une fonction close sur leur propre corpus, plutôt
  // qu'un paramètre supplémentaire que chaque appelant devrait répéter.
  function ouvrirLectureSorts(refCorpus: string, nom: string, declencheur: HTMLElement) {
    setPanneau({ corpus: 'sorts', ref: refCorpus, titre: nom, declencheur })
  }
  function ouvrirLectureDons(refCorpus: string, nom: string, declencheur: HTMLElement) {
    setPanneau({ corpus: 'dons', ref: refCorpus, titre: nom, declencheur })
  }

  useEffect(() => {
    let vivant = true
    chargerTablesDepuisReseau().then((chargees) => {
      if (vivant) setTables(chargees)
    })
    return () => {
      vivant = false
    }
  }, [])

  const premierRendu = useRef(true)
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false
      return
    }
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => {
      void modifier(brouillon).then((resultat) => {
        setErreurEnregistrement(resultat.ok ? null : resultat.motif ?? MOTS.ficheEnregistrementEchoue)
      })
    }, 400)
    return () => {
      if (minuterie.current) clearTimeout(minuterie.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brouillon])

  const nom = brouillon.meta.nomPersonnage.trim() === '' ? MOTS.ficheSansNom : brouillon.meta.nomPersonnage

  const segments: readonly SegmentAriane[] = useMemo(
    () => [
      { libelle: MOTS.navPersonnages, href: '/personnages/' },
      {
        libelle: nom,
        href: `/personnages/fiche/?id=${encodeURIComponent(brouillon.id)}`,
        choix: autresFiches.map((f) => ({
          cle: f.id,
          libelle: f.meta.nomPersonnage.trim() === '' ? MOTS.ficheSansNom : f.meta.nomPersonnage,
          href: `/personnages/fiche/?id=${encodeURIComponent(f.id)}`,
        })),
      },
    ],
    [autresFiches, brouillon.id, nom],
  )

  const tablesResolues = tables ?? { typesBonus: null, modificateursCarac: null, sortsBonus: null, armures: null, progressionClasses: null }

  return (
    <section>
      <FilAriane segments={segments} />

      <h1 className="mt-2 font-affichage text-titre1 font-semibold text-encre lettrine">{nom}</h1>

      {erreurEnregistrement && (
        <p className="mt-2 border border-bord-fort bg-surface p-2 text-petit text-encre" role="alert">
          {erreurEnregistrement}
        </p>
      )}

      <nav aria-label={MOTS.ficheAccesRapideTitre} className="mt-3 flex flex-wrap gap-2 text-petit">
        {SECTIONS.map((section) => (
          <a className="text-accent underline hover:text-accent-survol" href={`#section-${section.cle}`} key={section.cle}>
            {section.titre}
          </a>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-4">
        <SectionIdentite fiche={brouillon} setFiche={setBrouillon} />
        <SectionCaracteristiques fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionCombat fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionDefense fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionSauvegardes fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionAttaques fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionCompetences fiche={brouillon} setFiche={setBrouillon} tables={tablesResolues} />
        <Section cle="dons" ficheId={brouillon.id} titre={MOTS.sectionDons}>
          <SectionDons fiche={brouillon} ouvrirLecture={ouvrirLectureDons} setFiche={setBrouillon} />
        </Section>
        <SectionAptitudes fiche={brouillon} setFiche={setBrouillon} />
        <SectionSorts fiche={brouillon} ouvrirLecture={ouvrirLectureSorts} setFiche={setBrouillon} tables={tablesResolues} />
        <SectionEquipement fiche={brouillon} setFiche={setBrouillon} />
        <SectionNotes fiche={brouillon} setFiche={setBrouillon} />
      </div>

      <PanneauLateral
        declencheur={panneau?.declencheur ?? null}
        onFermer={() => setPanneau(null)}
        ouvert={panneau !== null}
        titre={panneau?.titre ?? ''}
        urlSource={null}
      >
        {panneau !== null && <LectureCorpus corpus={panneau.corpus} refCorpus={panneau.ref} />}
      </PanneauLateral>
    </section>
  )
}

const SECTIONS: readonly { readonly cle: string; readonly titre: string }[] = [
  { cle: 'identite', titre: MOTS.sectionIdentite },
  { cle: 'caracteristiques', titre: MOTS.sectionCaracteristiques },
  { cle: 'combat', titre: MOTS.sectionCombat },
  { cle: 'defense', titre: MOTS.sectionDefense },
  { cle: 'sauvegardes', titre: MOTS.sectionSauvegardes },
  { cle: 'attaques', titre: MOTS.sectionAttaques },
  { cle: 'competences', titre: MOTS.sectionCompetences },
  { cle: 'dons', titre: MOTS.sectionDons },
  { cle: 'aptitudes', titre: MOTS.sectionAptitudes },
  { cle: 'sorts', titre: MOTS.sectionSorts },
  { cle: 'equipement', titre: MOTS.sectionEquipement },
  { cle: 'notes', titre: MOTS.sectionNotes },
]

// ---------------------------------------------------------------------------
// Identité
// ---------------------------------------------------------------------------

function SectionIdentite({
  fiche,
  setFiche,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
}) {
  return (
    <Section cle="identite" deplieParDefaut ficheId={fiche.id} titre={MOTS.sectionIdentite}>
      <div className="flex flex-col gap-3">
        <ChampTexte
          libelle={MOTS.ficheChampNomPersonnage}
          onChange={(valeur) => setFiche((f) => ({ ...f, meta: { ...f.meta, nomPersonnage: valeur } }))}
          valeur={fiche.meta.nomPersonnage}
        />
        <ChampTexte
          libelle={MOTS.ficheChampNomJoueur}
          onChange={(valeur) => setFiche((f) => ({ ...f, meta: { ...f.meta, nomJoueur: valeur } }))}
          valeur={fiche.meta.nomJoueur}
        />
        <ChampTexte
          libelle={MOTS.ficheChampRace}
          onChange={(valeur) =>
            setFiche((f) => ({
              ...f,
              identite: { ...f.identite, race: valeur.trim() === '' ? null : { nom: valeur, source: 'maison', ref: null } },
            }))
          }
          valeur={fiche.identite.race?.nom ?? ''}
        />
        <ChampTexte
          libelle={MOTS.ficheChampAlignement}
          onChange={(valeur) => setFiche((f) => ({ ...f, identite: { ...f.identite, alignement: valeur } }))}
          valeur={fiche.identite.alignement}
        />
        <ChampTexte
          libelle={MOTS.ficheChampDivinite}
          onChange={(valeur) => setFiche((f) => ({ ...f, identite: { ...f.identite, divinite: valeur } }))}
          valeur={fiche.identite.divinite}
        />
        <ChampTexte
          libelle={MOTS.ficheChampTaille}
          onChange={(valeur) => setFiche((f) => ({ ...f, identite: { ...f.identite, taille: valeur } }))}
          valeur={fiche.identite.taille}
        />
        <ChampTexte
          libelle={MOTS.ficheChampLangues}
          onChange={(valeur) =>
            setFiche((f) => ({
              ...f,
              identite: {
                ...f.identite,
                langues: valeur
                  .split(',')
                  .map((v) => v.trim())
                  .filter((v) => v !== ''),
              },
            }))
          }
          valeur={fiche.identite.langues.join(', ')}
        />

        <div>
          <p className="m-0 text-petit text-encre-douce">{MOTS.ficheChampClasse}</p>
          <ul className="m-0 flex flex-col gap-2 p-0">
            {fiche.identite.classes.map((classeFiche, indice) => (
              <li className="flex flex-wrap items-end gap-2" key={indice}>
                <ChampTexte
                  libelle={MOTS.ficheChampClasse}
                  onChange={(valeur) =>
                    setFiche((f) => ({
                      ...f,
                      identite: { ...f.identite, classes: remplacerIndex(f.identite.classes, indice, { ...classeFiche, nom: valeur }) },
                    }))
                  }
                  valeur={classeFiche.nom}
                />
                <ChampSaisi
                  libelle={MOTS.ficheChampNiveau}
                  surChangement={(valeur) =>
                    setFiche((f) => ({
                      ...f,
                      identite: { ...f.identite, classes: remplacerIndex(f.identite.classes, indice, { ...classeFiche, niveau: valeur }) },
                    }))
                  }
                  valeur={classeFiche.niveau}
                />
                <BoutonRetirer
                  onClick={() =>
                    setFiche((f) => ({ ...f, identite: { ...f.identite, classes: retirerIndex(f.identite.classes, indice) } }))
                  }
                />
              </li>
            ))}
          </ul>
          <BoutonAjouter
            libelle="Ajouter une classe"
            onClick={() =>
              setFiche((f) => ({
                ...f,
                identite: {
                  ...f.identite,
                  classes: [...f.identite.classes, { nom: '', niveau: null, archetype: null, source: 'maison', ref: null } as ClasseFiche],
                },
              }))
            }
          />
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Caractéristiques
// ---------------------------------------------------------------------------

function SectionCaracteristiques({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  return (
    <Section cle="caracteristiques" deplieParDefaut ficheId={fiche.id} titre={MOTS.sectionCaracteristiques}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARACTERISTIQUES.map((carac) => {
          const entree = fiche.caracteristiques[carac]
          const effective = valeurEffectiveCaracteristique(entree, tables.typesBonus)
          const modificateur =
            effective.total === null ? { total: null, detail: [], manquants: effective.manquants } : modificateurCaracteristique(effective.total, tables.modificateursCarac)
          return (
            <div className="flex flex-col gap-2 border border-bord p-2" key={carac}>
              <ChampSaisi
                libelle={LIBELLES_CARACTERISTIQUES[carac]}
                surChangement={(valeur) =>
                  setFiche((f) => ({
                    ...f,
                    caracteristiques: { ...f.caracteristiques, [carac]: { ...f.caracteristiques[carac], base: valeur } },
                  }))
                }
                valeur={entree.base}
              />
              <ValeurCalculee libelle="Valeur effective" resultat={effective} />
              <ValeurCalculee libelle="Modificateur" resultat={modificateur} />
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

function SectionCombat({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  return (
    <Section cle="combat" deplieParDefaut ficheId={fiche.id} titre={MOTS.sectionCombat}>
      <div className="flex flex-col gap-3">
        <ChampSaisi
          libelle="Bonus de base à l’attaque"
          surChangement={(valeur) => setFiche((f) => ({ ...f, combat: { ...f.combat, bbaBase: valeur } }))}
          valeur={fiche.combat.bbaBase}
        />
        <ChampSaisi
          libelle="Points de vie maximum"
          surChangement={(valeur) => setFiche((f) => ({ ...f, combat: { ...f.combat, pvMax: valeur } }))}
          valeur={fiche.combat.pvMax}
        />
        <ChampSaisi
          libelle="Vitesse de base"
          surChangement={(valeur) => setFiche((f) => ({ ...f, combat: { ...f.combat, vitesseBase: valeur } }))}
          valeur={fiche.combat.vitesseBase}
        />
        <ChampSaisi
          libelle={MOTS.resistanceMagie}
          surChangement={(valeur) => setFiche((f) => ({ ...f, combat: { ...f.combat, resistanceMagie: valeur } }))}
          valeur={fiche.combat.resistanceMagie}
        />

        <ValeurCalculee libelle="Initiative" resultat={initiative(fiche, tables)} />
        <ValeurCalculee libelle="Manoeuvre offensive" resultat={manoeuvreOffensive(fiche, tables)} />
        <ValeurCalculee libelle="Manoeuvre défensive" resultat={manoeuvreDefensive(fiche, tables)} />
        <ValeurCalculee libelle="Points de vie maximum" resultat={pointsDeVieMaximum(fiche)} />
        <ValeurCalculee libelle={MOTS.resistanceMagie} resultat={resistanceMagie(fiche)} />
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Défense
// ---------------------------------------------------------------------------

function SectionDefense({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  const ca = classeArmure(fiche, tables)
  return (
    <Section cle="defense" deplieParDefaut ficheId={fiche.id} titre={MOTS.sectionDefense}>
      <div className="flex flex-col gap-3">
        <ChampTexte
          libelle="Nom de l’armure"
          onChange={(valeur) =>
            setFiche((f) => ({
              ...f,
              defense: {
                ...f.defense,
                armure:
                  valeur.trim() === ''
                    ? null
                    : { nom: valeur, bonusCA: f.defense.armure?.bonusCA ?? null, bonusDexMax: f.defense.armure?.bonusDexMax ?? null, malusTests: f.defense.armure?.malusTests ?? null, categorie: f.defense.armure?.categorie ?? '' },
              },
            }))
          }
          valeur={fiche.defense.armure?.nom ?? ''}
        />
        {fiche.defense.armure && (
          <>
            <ChampSaisi
              libelle="Bonus de classe d’armure de l’armure"
              surChangement={(valeur) =>
                setFiche((f) => ({ ...f, defense: { ...f.defense, armure: f.defense.armure ? { ...f.defense.armure, bonusCA: valeur } : null } }))
              }
              valeur={fiche.defense.armure.bonusCA}
            />
            <ChampSaisi
              libelle="Bonus de Dextérité maximum"
              surChangement={(valeur) =>
                setFiche((f) => ({ ...f, defense: { ...f.defense, armure: f.defense.armure ? { ...f.defense.armure, bonusDexMax: valeur } : null } }))
              }
              valeur={fiche.defense.armure.bonusDexMax}
            />
            <ChampTexte
              libelle="Catégorie d’armure"
              onChange={(valeur) =>
                setFiche((f) => ({ ...f, defense: { ...f.defense, armure: f.defense.armure ? { ...f.defense.armure, categorie: valeur } : null } }))
              }
              valeur={fiche.defense.armure.categorie}
            />
          </>
        )}

        <ChampTexte
          libelle="Nom du bouclier"
          onChange={(valeur) =>
            setFiche((f) => ({
              ...f,
              defense: {
                ...f.defense,
                bouclier: valeur.trim() === '' ? null : { nom: valeur, bonusCA: f.defense.bouclier?.bonusCA ?? null, malusTests: f.defense.bouclier?.malusTests ?? null },
              },
            }))
          }
          valeur={fiche.defense.bouclier?.nom ?? ''}
        />
        {fiche.defense.bouclier && (
          <ChampSaisi
            libelle="Bonus de classe d’armure du bouclier"
            surChangement={(valeur) =>
              setFiche((f) => ({ ...f, defense: { ...f.defense, bouclier: f.defense.bouclier ? { ...f.defense.bouclier, bonusCA: valeur } : null } }))
            }
            valeur={fiche.defense.bouclier.bonusCA}
          />
        )}

        <ValeurCalculee libelle="Classe d’armure totale" resultat={ca.totale} />
        <ValeurCalculee libelle="Classe d’armure en contact" resultat={ca.contact} />
        <ValeurCalculee libelle="Classe d’armure, pris au dépourvu" resultat={ca.prisAuDepourvu} />
        <ValeurCalculee libelle="Vitesse selon l’armure portée" resultat={vitesse(fiche, tables)} />
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Sauvegardes
// ---------------------------------------------------------------------------

function SectionSauvegardes({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  return (
    <Section cle="sauvegardes" ficheId={fiche.id} titre={MOTS.sectionSauvegardes}>
      <div className="flex flex-col gap-3">
        {SAUVEGARDES.map((quelle) => (
          <div className="flex flex-col gap-2 border border-bord p-2" key={quelle}>
            <ChampSaisi
              libelle={`${LIBELLES_SAUVEGARDES[quelle]}, bonus de base`}
              surChangement={(valeur) =>
                setFiche((f) => ({ ...f, sauvegardes: { ...f.sauvegardes, [quelle]: { ...f.sauvegardes[quelle], base: valeur } } }))
              }
              valeur={fiche.sauvegardes[quelle].base}
            />
            <ValeurCalculee libelle={LIBELLES_SAUVEGARDES[quelle]} resultat={sauvegarde(fiche, quelle, tables)} />
          </div>
        ))}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Attaques
// ---------------------------------------------------------------------------

function SectionAttaques({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  const completes = attaquesCompletes(fiche, tables)

  return (
    <Section cle="attaques" ficheId={fiche.id} titre={MOTS.sectionAttaques}>
      <ul className="m-0 flex flex-col gap-4 p-0">
        {fiche.attaques.map((attaque, indice) => (
          <li className="flex flex-col gap-2 border border-bord p-2" key={indice}>
            <ChampTexte
              libelle="Nom de l’attaque"
              onChange={(valeur) => setFiche((f) => ({ ...f, attaques: remplacerIndex(f.attaques, indice, { ...attaque, nom: valeur }) }))}
              valeur={attaque.nom}
            />
            <label className="flex flex-col gap-1 text-petit text-encre-douce">
              Type d’attaque
              <select
                className="min-h-cible border border-bord-fort bg-surface px-2 text-encre"
                onChange={(evenement) =>
                  setFiche((f) => ({
                    ...f,
                    attaques: remplacerIndex(f.attaques, indice, { ...attaque, type: evenement.target.value as Attaque['type'] }),
                  }))
                }
                value={attaque.type}
              >
                <option value="corpsACorps">Corps à corps</option>
                <option value="distance">Distance</option>
              </select>
            </label>
            <ChampTexte
              libelle="Dés de dégâts"
              onChange={(valeur) => setFiche((f) => ({ ...f, attaques: remplacerIndex(f.attaques, indice, { ...attaque, des: valeur }) }))}
              valeur={attaque.des}
            />
            <ChampTexte
              libelle="Portée"
              onChange={(valeur) => setFiche((f) => ({ ...f, attaques: remplacerIndex(f.attaques, indice, { ...attaque, portee: valeur }) }))}
              valeur={attaque.portee}
            />

            {completes[indice] && (
              <div className="flex flex-col gap-2">
                {completes[indice].bonusParAttaque.map((resultat, i) => (
                  <ValeurCalculee key={i} libelle={`Bonus d’attaque n°${i + 1}`} resultat={resultat} />
                ))}
                <ValeurCalculee libelle="Bonus de dégâts" resultat={completes[indice].degats} />
              </div>
            )}

            <BoutonRetirer onClick={() => setFiche((f) => ({ ...f, attaques: retirerIndex(f.attaques, indice) }))} />
          </li>
        ))}
      </ul>
      <BoutonAjouter
        libelle="Ajouter une attaque"
        onClick={() =>
          setFiche((f) => ({
            ...f,
            attaques: [
              ...f.attaques,
              {
                nom: '',
                type: 'corpsACorps',
                caracteristiqueAttaque: 'force',
                caracteristiqueDegats: 'force',
                des: '',
                critique: { plage: '20', multiplicateur: 2 },
                portee: '',
                modificateursAttaque: [],
                modificateursDegats: [],
                source: 'maison',
                ref: null,
              } as Attaque,
            ],
          }))
        }
      />
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Compétences
// ---------------------------------------------------------------------------

function SectionCompetences({
  fiche,
  setFiche,
  tables,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
}) {
  return (
    <Section cle="competences" ficheId={fiche.id} titre={MOTS.sectionCompetences}>
      <ul className="m-0 flex flex-col gap-3 p-0">
        {fiche.competences.map((competence, indice) => (
          <li className="flex flex-wrap items-end gap-2 border border-bord p-2" key={indice}>
            <ChampTexte
              libelle="Nom de la compétence"
              onChange={(valeur) => setFiche((f) => ({ ...f, competences: remplacerIndex(f.competences, indice, { ...competence, nom: valeur }) }))}
              valeur={competence.nom}
            />
            <label className="flex flex-col gap-1 text-petit text-encre-douce">
              Caractéristique
              <select
                className="min-h-cible border border-bord-fort bg-surface px-2 text-encre"
                onChange={(evenement) =>
                  setFiche((f) => ({
                    ...f,
                    competences: remplacerIndex(f.competences, indice, { ...competence, caracteristique: evenement.target.value as Caracteristique }),
                  }))
                }
                value={competence.caracteristique}
              >
                {CARACTERISTIQUES.map((carac) => (
                  <option key={carac} value={carac}>
                    {LIBELLES_CARACTERISTIQUES[carac]}
                  </option>
                ))}
              </select>
            </label>
            <ChampSaisi
              libelle="Rangs"
              surChangement={(valeur) => setFiche((f) => ({ ...f, competences: remplacerIndex(f.competences, indice, { ...competence, rangs: valeur }) }))}
              valeur={competence.rangs}
            />
            <label className="flex items-center gap-1 text-petit text-encre-douce">
              <input
                checked={competence.estDeClasse}
                onChange={(evenement) =>
                  setFiche((f) => ({
                    ...f,
                    competences: remplacerIndex(f.competences, indice, { ...competence, estDeClasse: evenement.target.checked }),
                  }))
                }
                type="checkbox"
              />
              Compétence de classe
            </label>
            <ValeurCalculee libelle="Total" resultat={totalCompetence(fiche, competence, tables)} />
            <BoutonRetirer onClick={() => setFiche((f) => ({ ...f, competences: retirerIndex(f.competences, indice) }))} />
          </li>
        ))}
      </ul>
      <BoutonAjouter
        libelle="Ajouter une compétence"
        onClick={() =>
          setFiche((f) => ({
            ...f,
            competences: [
              ...f.competences,
              { nom: '', caracteristique: 'force', rangs: null, estDeClasse: false, subitMalusArmure: false, modificateurs: [] } as Competence,
            ],
          }))
        }
      />
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Dons — cf. `./SectionDons.tsx` (rattachement au corpus, plan 16), importé
// plus haut et posé dans sa propre `<Section>` par l'appelant.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Aptitudes
// ---------------------------------------------------------------------------

function SectionAptitudes({
  fiche,
  setFiche,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
}) {
  return (
    <Section cle="aptitudes" ficheId={fiche.id} titre={MOTS.sectionAptitudes}>
      <ul className="m-0 flex flex-col gap-3 p-0">
        {fiche.aptitudes.map((aptitude, indice) => (
          <li className="flex flex-col gap-2 border border-bord p-2" key={indice}>
            <ChampTexte
              libelle="Nom de l’aptitude"
              onChange={(valeur) => setFiche((f) => ({ ...f, aptitudes: remplacerIndex(f.aptitudes, indice, { ...aptitude, nom: valeur }) }))}
              valeur={aptitude.nom}
            />
            <ChampTexte
              libelle="Origine"
              onChange={(valeur) => setFiche((f) => ({ ...f, aptitudes: remplacerIndex(f.aptitudes, indice, { ...aptitude, origine: valeur }) }))}
              valeur={aptitude.origine}
            />
            <ChampSaisi
              libelle="Usages par jour"
              surChangement={(valeur) => setFiche((f) => ({ ...f, aptitudes: remplacerIndex(f.aptitudes, indice, { ...aptitude, usagesParJour: valeur }) }))}
              valeur={aptitude.usagesParJour}
            />
            <label className="flex flex-col gap-1 text-petit text-encre-douce">
              Texte
              <textarea
                className="border border-bord-fort bg-surface p-2 text-encre"
                onChange={(evenement) =>
                  setFiche((f) => ({ ...f, aptitudes: remplacerIndex(f.aptitudes, indice, { ...aptitude, texte: evenement.target.value }) }))
                }
                value={aptitude.texte}
              />
            </label>
            <BoutonRetirer onClick={() => setFiche((f) => ({ ...f, aptitudes: retirerIndex(f.aptitudes, indice) }))} />
          </li>
        ))}
      </ul>
      <BoutonAjouter
        libelle="Ajouter une aptitude"
        onClick={() =>
          setFiche((f) => ({
            ...f,
            aptitudes: [...f.aptitudes, { nom: '', origine: '', usagesParJour: null, texte: '', source: 'maison', ref: null } as Aptitude],
          }))
        }
      />
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Sorts
// ---------------------------------------------------------------------------

function SectionSorts({
  fiche,
  setFiche,
  tables,
  ouvrirLecture,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
  readonly tables: TablesRegles
  readonly ouvrirLecture: (ref: string, nom: string, declencheur: HTMLElement) => void
}) {
  const emplacements = emplacementsTotaux(fiche, tables)
  const niveauLanceurResultat = niveauLanceur(fiche, tables)

  return (
    <Section cle="sorts" ficheId={fiche.id} titre={MOTS.sectionSorts}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-petit text-encre-douce">
          Caractéristique d’incantation
          <select
            className="min-h-cible border border-bord-fort bg-surface px-2 text-encre"
            onChange={(evenement) =>
              setFiche((f) => ({
                ...f,
                sorts: {
                  ...f.sorts,
                  caracteristiqueIncantation: evenement.target.value === '' ? null : (evenement.target.value as Caracteristique),
                },
              }))
            }
            value={fiche.sorts.caracteristiqueIncantation ?? ''}
          >
            <option value="">—</option>
            {CARACTERISTIQUES.map((carac) => (
              <option key={carac} value={carac}>
                {LIBELLES_CARACTERISTIQUES[carac]}
              </option>
            ))}
          </select>
        </label>

        <ChampSaisi
          libelle="Niveau de lanceur"
          saisieManuelle={fiche.sorts.niveauLanceur !== null}
          surChangement={(valeur) => setFiche((f) => ({ ...f, sorts: { ...f.sorts, niveauLanceur: valeur } }))}
          valeur={fiche.sorts.niveauLanceur}
        />
        <ValeurCalculee libelle="Niveau de lanceur" resultat={niveauLanceurResultat} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NIVEAUX_DE_SORT.map((niveauDeSort) => (
            <div className="flex flex-col gap-1 border border-bord p-2" key={niveauDeSort}>
              <p className="m-0 text-petit text-encre-douce">
                {MOTS.niveau} {niveauDeSort}
              </p>
              <ValeurCalculee libelle="Emplacements" resultat={emplacements.get(niveauDeSort) ?? { total: null, detail: [], manquants: [] }} />
              <ValeurCalculee libelle="Degré de difficulté" resultat={degreDeDifficulte(fiche, niveauDeSort, tables)} />
            </div>
          ))}
        </div>

        <CarnetSorts fiche={fiche} ouvrirLecture={ouvrirLecture} setFiche={setFiche} />
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Équipement
// ---------------------------------------------------------------------------

function SectionEquipement({
  fiche,
  setFiche,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
}) {
  return (
    <Section cle="equipement" ficheId={fiche.id} titre={MOTS.sectionEquipement}>
      <ul className="m-0 flex flex-col gap-2 p-0">
        {fiche.equipement.map((objet, indice) => (
          <li className="flex flex-wrap items-end gap-2" key={indice}>
            <ChampTexte
              libelle="Nom de l’objet"
              onChange={(valeur) => setFiche((f) => ({ ...f, equipement: remplacerIndex(f.equipement, indice, { ...objet, nom: valeur }) }))}
              valeur={objet.nom}
            />
            <ChampSaisi
              libelle="Quantité"
              surChangement={(valeur) => setFiche((f) => ({ ...f, equipement: remplacerIndex(f.equipement, indice, { ...objet, quantite: valeur }) }))}
              valeur={objet.quantite}
            />
            <ChampTexte
              libelle="Note"
              onChange={(valeur) => setFiche((f) => ({ ...f, equipement: remplacerIndex(f.equipement, indice, { ...objet, note: valeur }) }))}
              valeur={objet.note}
            />
            <BoutonRetirer onClick={() => setFiche((f) => ({ ...f, equipement: retirerIndex(f.equipement, indice) }))} />
          </li>
        ))}
      </ul>
      <BoutonAjouter
        libelle="Ajouter un objet"
        onClick={() =>
          setFiche((f) => ({ ...f, equipement: [...f.equipement, { nom: '', quantite: null, note: '', source: 'maison', ref: null } as Equipement] }))
        }
      />
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function SectionNotes({
  fiche,
  setFiche,
}: {
  readonly fiche: Fiche
  readonly setFiche: (mise: (f: Fiche) => Fiche) => void
}) {
  return (
    <Section cle="notes" ficheId={fiche.id} titre={MOTS.sectionNotes}>
      <label className="flex flex-col gap-1 text-petit text-encre-douce">
        {MOTS.sectionNotes}
        <textarea
          className="min-h-[8rem] border border-bord-fort bg-surface p-2 text-encre"
          onChange={(evenement) => setFiche((f) => ({ ...f, notes: evenement.target.value }))}
          value={fiche.notes}
        />
      </label>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Petits utilitaires partagés par les sections ci-dessus.
// ---------------------------------------------------------------------------

function ChampTexte({ libelle, valeur, onChange }: { readonly libelle: string; readonly valeur: string; readonly onChange: (valeur: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-petit text-encre-douce">
      {libelle}
      <input
        className="min-h-cible border border-bord-fort bg-surface px-2 text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onChange={(evenement) => onChange(evenement.target.value)}
        type="text"
        value={valeur}
      />
    </label>
  )
}

function BoutonRetirer({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      className="min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={onClick}
      type="button"
    >
      Retirer
    </button>
  )
}

function BoutonAjouter({ libelle, onClick }: { readonly libelle: string; readonly onClick: () => void }) {
  return (
    <button
      className="mt-2 min-h-cible border border-bord-fort px-3 text-petit text-encre hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={onClick}
      type="button"
    >
      {libelle}
    </button>
  )
}

function remplacerIndex<T>(liste: readonly T[], indice: number, valeur: T): readonly T[] {
  return liste.map((item, i) => (i === indice ? valeur : item))
}

function retirerIndex<T>(liste: readonly T[], indice: number): readonly T[] {
  return liste.filter((_, i) => i !== indice)
}
