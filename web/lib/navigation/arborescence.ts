import { MOTS } from '@/lib/design/tokens'

/**
 * The one tree the header reads, read by both the desktop dropdown menus and
 * the mobile burger — never duplicated between them. A link added here shows
 * up in both surfaces or in neither; there is no third place a header link
 * can live.
 *
 * Every label routes through `MOTS` rather than being written here in prose:
 * a hard-coded string in this file would be the same defect the vocabulary
 * table exists to catch, just one layer removed from the component.
 */
export type EntreeNav = {
  readonly cle: string
  readonly libelle: string
  readonly href: string
}

export type GroupeNav = {
  readonly cle: string
  readonly libelle: string
  readonly entrees: readonly EntreeNav[]
}

export type Arborescence = {
  readonly groupes: readonly GroupeNav[]
  readonly simples: readonly EntreeNav[]
}

export const ARBORESCENCE: Arborescence = {
  groupes: [
    {
      cle: 'corpus',
      libelle: MOTS.navCorpus,
      entrees: [
        { cle: 'sorts', libelle: 'Sorts', href: '/' },
        { cle: 'dons', libelle: 'Dons', href: '/dons' },
        { cle: 'explorer', libelle: 'Explorer', href: '/explorer' },
        { cle: 'comparer', libelle: 'Comparer', href: '/comparaison' },
      ],
    },
    {
      cle: 'personnages',
      libelle: MOTS.navPersonnages,
      entrees: [
        { cle: 'mes-fiches', libelle: MOTS.mesFiches, href: '/personnages/' },
        { cle: 'nouvelle-fiche', libelle: MOTS.nouvelleFiche, href: '/personnages/nouvelle/' },
      ],
    },
  ],
  simples: [{ cle: 'favoris', libelle: 'Favoris', href: '/favoris' }],
}
