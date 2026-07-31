/**
 * The spell detail page, rendered.
 *
 * Two corpora again, and the split is not incidental:
 *
 *   - the frozen fixture, because it is the ONLY place a disagreement exists.
 *     On the corpus as committed all 8409 comparable pairs concord
 *     (`reports/08_enrich.md`), so `desaccords` is `[]` on all 2070 real spells.
 *     The fixture's synthetic « Détection de la magie » case is what keeps the
 *     disagreement block from being code that ships untested until the day the
 *     first real divergence appears.
 *   - the real export, for the claims that must hold across the whole artefact:
 *     every `url_source` absolute and on pathfinder-fr.org, every index slug
 *     backed by a props file.
 *
 * The page component itself is not mounted here: it is an async server component
 * that reads the filesystem, and the pieces it composes are what carry the
 * behaviour. `verifier-props.test.ts` covers the enumeration, and the built
 * output is counted against the index in the report.
 */

import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BlocTechnique, lignesTechniques } from '@/components/fiche/BlocTechnique'
import { CoucheEnrichissement } from '@/components/fiche/CoucheEnrichissement'
import { Description } from '@/components/fiche/Description'
import { LienSource } from '@/components/fiche/LienSource'
import { NiveauxParClasse } from '@/components/fiche/NiveauxParClasse'
import { MarqueurDesaccord } from '@/components/primitives/MarqueurDesaccord'
import {
  DOSSIER_SORTS_FIXTURE,
  lirePropsSort,
  type Enrichissement,
  type PropsSort,
} from '@/lib/donnees/sort-page'

function fixture(slug: string): PropsSort {
  const sort = lirePropsSort(slug, DOSSIER_SORTS_FIXTURE)
  if (sort === null) throw new Error(`fixture sans ${slug}`)
  return sort
}

/** The one spell in the corpus, real or fixture, whose two sources disagree. */
const DETECTION = fixture('detection-de-la-magie')
/** No enrichment at all — the section must not appear. */
const SANS_ENRICHISSEMENT = fixture('abondance-de-munitions')
/** All seven stat-block fields present, and an accented saving throw. */
const DEGOUT = fixture('degout')

describe('les niveaux par classe', () => {
  it('affiche une ligne par classe qui reçoit le sort', () => {
    // The criterion asks for a spell held by three classes. « Dégoût » is held by
    // exactly three in the fixture — bard, druid, occultist — and it is real data
    // rather than a case contrived for the count.
    const attendu = Object.keys(DEGOUT.niveaux_par_classe).length
    expect(attendu).toBe(3)
    render(<NiveauxParClasse niveaux={DEGOUT.niveaux_par_classe} />)
    expect(screen.getAllByRole('row')).toHaveLength(attendu + 1) // + l'en-tête
  })

  it('nomme la classe en clair, jamais par son slug', () => {
    // `pretre-pretre-combattant-oracle` is a join key, not something to show a
    // reader. The pair comes from the real export, where that class is common.
    render(
      <NiveauxParClasse
        niveaux={{
          'pretre-pretre-combattant-oracle': {
            nom: 'Prêtre/Prêtre combattant/Oracle',
            niveau: 1,
          },
        }}
      />,
    )
    expect(screen.getByRole('rowheader', { name: 'Prêtre/Prêtre combattant/Oracle' })).toBeTruthy()
    expect(screen.queryByText(/pretre-pretre/)).toBeNull()
  })

  it('donne à chaque classe SON niveau, pas un niveau unique', () => {
    // The B4 assertion on this page. Two classes, two different numbers, both
    // rendered — a single figure here would be a lie about the data.
    render(
      <NiveauxParClasse
        niveaux={{
          barde: { nom: 'Barde', niveau: 2 },
          druide: { nom: 'Druide', niveau: 3 },
        }}
      />,
    )
    for (const [classe, niveau] of [
      ['Barde', '2'],
      ['Druide', '3'],
    ] as const) {
      const ligne = screen.getByRole('rowheader', { name: classe }).closest('tr') as HTMLElement
      expect(within(ligne).getByRole('cell').textContent).toBe(niveau)
    }
  })

  it('trie par niveau puis par nom collationné en français', () => {
    render(
      <NiveauxParClasse
        niveaux={{
          z: { nom: 'Zone', niveau: 3 },
          e: { nom: 'Éclair', niveau: 1 },
          a: { nom: 'Eau', niveau: 1 },
        }}
      />,
    )
    expect(screen.getAllByRole('rowheader').map((cellule) => cellule.textContent)).toEqual([
      'Eau',
      'Éclair',
      'Zone',
    ])
  })

  it('le dit franchement quand aucune classe ne reçoit le sort', () => {
    render(<NiveauxParClasse niveaux={{}} />)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Aucune liste de classe/)).toBeTruthy()
  })

  it('énonce que le niveau dépend de la classe', () => {
    render(<NiveauxParClasse niveaux={DEGOUT.niveaux_par_classe} />)
    // `&apos;` renders as U+0027, not as the typographic apostrophe the source
    // file shows — matching on `’` here would fail on text that is on screen.
    expect(screen.getByText(/il n'y a pas un niveau, il y en a un par classe/)).toBeTruthy()
  })
})

describe('le désaccord de sources', () => {
  it('rend classe, niveau de la liste et niveau de la page en toutes lettres', () => {
    // The criterion, and the wording matters: an alert icon with no text tells a
    // reader nothing about which source said what.
    expect(DETECTION.desaccords).toEqual([
      { classe: 'Barde', slug: 'barde', niveau_liste: 0, niveau_page: 1 },
    ])
    render(<MarqueurDesaccord desaccords={DETECTION.desaccords} />)
    const bloc = screen.getByRole('region', { name: /Désaccord de niveau/ })
    expect(bloc.textContent).toContain('Barde')
    expect(bloc.textContent).toMatch(/la liste de classe dit\s+0/)
    expect(bloc.textContent).toMatch(/la page\s+du sort dit\s+1/)
  })

  it('dit que la source fait foi et n’accuse personne', () => {
    render(<MarqueurDesaccord desaccords={DETECTION.desaccords} />)
    const bloc = screen.getByRole('region', { name: /Désaccord de niveau/ })
    expect(bloc.textContent).toMatch(/jamais corrigé/)
    expect(bloc.textContent).not.toMatch(/erreur|faute|incorrect/i)
  })

  it('ne rend rien du tout quand les sources concordent', () => {
    // Which is every real spell: 0 disagreements over 2070.
    const { container } = render(<MarqueurDesaccord desaccords={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('le bloc technique', () => {
  it('rend les sept champs du bloc du wiki, aucun omis', () => {
    render(<BlocTechnique lignes={lignesTechniques(DEGOUT)} />)
    for (const libelle of [
      "Temps d'incantation",
      'Composantes',
      'Portée',
      'Cible, effet ou zone',
      'Durée',
      'Jet de sauvegarde',
      'Résistance à la magie',
    ]) {
      expect(screen.getByText(libelle)).toBeTruthy()
    }
  })

  it('rend les valeurs verbatim, accents compris', () => {
    render(<BlocTechnique lignes={lignesTechniques(DEGOUT)} />)
    expect(screen.getByText(DEGOUT.jet_de_sauvegarde as string)).toBeTruthy()
    expect(DEGOUT.jet_de_sauvegarde).toMatch(/Volonté/)
  })

  it('ne porte PAS de champ « Niveau »', () => {
    // Because there is no such value. The level lives in the per-class table.
    render(<BlocTechnique lignes={lignesTechniques(DEGOUT)} />)
    expect(screen.queryByText(/^Niveau$/)).toBeNull()
  })

  it('rend un champ absent en tiret cadratin, sans inventer', () => {
    render(<BlocTechnique lignes={[{ libelle: 'Portée', valeur: null }]} />)
    const valeur = screen.getByTitle('Non renseigné par la source')
    expect(valeur.textContent).toBe('—')
  })

  it('distingue une chaîne vide d’une valeur absente', () => {
    // The wiki writes an empty value where it means "none"; folding that into
    // « — » would report a gap in the source where there is none.
    render(<BlocTechnique lignes={[{ libelle: 'Cible', valeur: '' }]} />)
    expect(screen.getByTitle('Renseigné vide par la source').textContent).toBe('(vide)')
    expect(screen.queryByTitle('Non renseigné par la source')).toBeNull()
  })
})

describe('la description', () => {
  it('découpe en paragraphes sur les sauts de ligne du parseur', () => {
    render(<Description id="t" texte={'Premier.\nSecond.'} titre="Description" />)
    expect(screen.getByText('Premier.')).toBeTruthy()
    expect(screen.getByText('Second.')).toBeTruthy()
  })

  it('ne produit pas de paragraphe vide sur des sauts consécutifs', () => {
    const { container } = render(
      <Description id="t" texte={'Un.\n\n\n  \nDeux.'} titre="Description" />,
    )
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('traite le texte comme du texte : aucun HTML du corpus n’est interprété', () => {
    // `description_html` exists in the props and is deliberately never rendered.
    // The corpus is a scrape of a site anyone can edit.
    const { container } = render(
      <Description id="t" texte={'<script>alert(1)</script><b>gras</b>'} titre="Description" />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>gras<\/b>/)).toBeTruthy()
  })

  it('le dit quand la source ne porte pas de description', () => {
    render(<Description id="t" texte={null} titre="Description" />)
    expect(screen.getByText(/ne porte pas de texte de description/)).toBeTruthy()
  })
})

describe('la couche d’enrichissement', () => {
  it('ne rend AUCUNE section quand le sort n’est pas enrichi', () => {
    // 22 real spells are in this case; a heading over a blank would be worse
    // than nothing.
    expect(SANS_ENRICHISSEMENT.enrichissement).toBeNull()
    const { container } = render(
      <CoucheEnrichissement enrichissement={SANS_ENRICHISSEMENT.enrichissement} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('s’annonce comme écrite par un modèle, et non relue', () => {
    // The honest form of the plan's "labelled as auto-generated": there is no
    // human-verified flag to show, so the block says so outright.
    const enrichissement = DETECTION.enrichissement as Enrichissement
    render(<CoucheEnrichissement enrichissement={enrichissement} />)
    const bloc = screen.getByRole('region', { name: 'Classement automatique' })
    expect(bloc.textContent).toContain('pas')
    expect(bloc.textContent).toMatch(/tirée du wiki/)
    expect(bloc.textContent).toMatch(/modèle de langage/)
    expect(bloc.textContent).toMatch(/n'a pas été relue par un humain/)
    expect(bloc.textContent).toContain(enrichissement.modele)
  })

  it('nomme la date de génération, sans l’heure', () => {
    render(<CoucheEnrichissement enrichissement={DETECTION.enrichissement} />)
    expect(screen.getByRole('region', { name: 'Classement automatique' }).textContent).toContain(
      '2026-07-30',
    )
  })

  it('rend le résumé, la catégorie et les tags', () => {
    const enrichissement = DETECTION.enrichissement as Enrichissement
    render(<CoucheEnrichissement enrichissement={enrichissement} />)
    expect(screen.getByText(enrichissement.resume_court as string)).toBeTruthy()
    expect(screen.getByText('divination')).toBeTruthy()
    expect(screen.getByText('divination information')).toBeTruthy()
  })

  it('n’affiche pas de badge « vérifié par un humain » : le champ n’existe pas', () => {
    // The step plan asks for one. The enrichment schema admits exactly sixteen
    // keys and refuses a seventeenth, so declaring a record reviewed makes it
    // invalid rather than trusted (CLAUDE.md § 10). Showing such a badge would
    // mean inventing the field it reads.
    const enrichissement = DETECTION.enrichissement as Enrichissement
    expect(Object.keys(enrichissement)).toHaveLength(16)
    expect(Object.keys(enrichissement)).not.toContain('verifie_par_humain')
    render(<CoucheEnrichissement enrichissement={enrichissement} />)
    expect(screen.queryByText(/vérifié|relu par/i)).toBeNull()
  })

  it('omet une liste vide plutôt que d’afficher un titre nu', () => {
    render(<CoucheEnrichissement enrichissement={DETECTION.enrichissement} />)
    expect(DETECTION.enrichissement?.condition_infligee).toEqual([])
    expect(screen.queryByText('Conditions infligées')).toBeNull()
  })

  it('montre la note d’ambiguïté quand le modèle en a posé une', () => {
    // The model saying it had to choose. A reader weighing the category deserves
    // to know that, so it is shown and not hidden.
    const base = DETECTION.enrichissement as Enrichissement
    render(
      <CoucheEnrichissement
        enrichissement={{ ...base, notes_ambiguite: 'Deux catégories plausibles.' }}
      />,
    )
    expect(screen.getByText(/Deux catégories plausibles/)).toBeTruthy()
  })
})

describe('le lien vers la source (B8)', () => {
  it('est présent, absolu, et pointe vers pathfinder-fr.org', () => {
    render(<LienSource url={DETECTION.url_source} />)
    const lien = screen.getByRole('link', { name: 'Voir sur pathfinder-fr.org' })
    expect(lien.getAttribute('href')).toBe(DETECTION.url_source)
    expect(DETECTION.url_source).toMatch(/^https:\/\/www\.pathfinder-fr\.org\//)
  })

  it('dit que la page d’origine fait foi', () => {
    render(<LienSource url={DETECTION.url_source} />)
    const bloc = screen.getByRole('region', { name: 'Source' })
    expect(bloc.textContent).toMatch(/fait foi/)
    expect(bloc.textContent).toMatch(/wiki communautaire/)
  })

  it('sort en nouvel onglet sans fuite de référent', () => {
    render(<LienSource url={DETECTION.url_source} />)
    const lien = screen.getByRole('link', { name: 'Voir sur pathfinder-fr.org' })
    expect(lien.getAttribute('target')).toBe('_blank')
    expect(lien.getAttribute('rel')).toContain('noreferrer')
  })
})

describe('sur les 2070 sorts réellement exportés', () => {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), 'public', 'data', 'index.json'), 'utf8'),
  ) as { readonly sorts: readonly { readonly s: string }[] }

  /**
   * Read the 2070 files ONCE for the whole block.
   *
   * Four tests each re-reading the export took long enough to trip the 5 s
   * default under a full-suite run — where a dozen workers contend for the same
   * disk — while passing in isolation. Reading once is both faster and honest:
   * the claims are about one snapshot of the export, not four.
   */
  const props = index.sorts.map((sort) => ({ s: sort.s, p: lirePropsSort(sort.s) }))

  it('chaque slug de l’index a un fichier de props lisible', () => {
    // The failure this catches is a slug that would 404 in production. A 404 is
    // indistinguishable from a bad hand-typed URL, so it has to fail here.
    expect(props.filter((e) => e.p === null).map((e) => e.s)).toEqual([])
  })

  it('chaque url_source est absolue et sur pathfinder-fr.org', () => {
    const fautifs = props
      .map((e) => e.p as PropsSort)
      .filter((sort) => !sort.url_source.startsWith('https://www.pathfinder-fr.org/'))
    expect(fautifs.map((sort) => sort.slug)).toEqual([])
  })

  it('le slug du fichier est exactement le slug de l’index : le slug EST l’URL', () => {
    expect(props.filter((e) => e.p?.slug !== e.s).map((e) => e.s)).toEqual([])
  })

  it('aucun sort ne porte de désaccord — 100 % de concordance, constaté', () => {
    // Pinning the state of the corpus, not asserting it must stay so. The day a
    // divergence appears this test names it, and the block that renders it is
    // already proven against the fixture.
    const avecDesaccord = props
      .map((e) => e.p as PropsSort)
      .filter((sort) => sort.desaccords.length > 0)
    expect(avecDesaccord.map((sort) => sort.slug)).toEqual([])
  })

  it('un slug inconnu n’a pas de props : la page répondra 404', () => {
    expect(lirePropsSort('sort-qui-n-existe-pas')).toBeNull()
  })
})
