/**
 * The design tokens, transcribed from `.claude/skills/pf-web-design-system`.
 *
 * This file is the ONLY place a colour value may be written. A hex anywhere else
 * is a defect, and `lib/design/tokens.test.ts` greps for it. The reason is not
 * tidiness: nine school pastilles with a contrast floor are only verifiable if
 * there is one list to verify, and a second copy is a second thing to forget.
 *
 * The Skill remains the authority. If a value here and a value there disagree,
 * the Skill wins and this file is corrected — never the reverse.
 *
 * `styles/theme.css` mirrors these values into Tailwind 4's `@theme`, because
 * Tailwind 4 is CSS-first and no longer reads a JS config. That duplication is
 * forced by the framework, so a test asserts the two never drift apart.
 */

/** The nine school families. Keys are exactly `ECOLES_CANONIQUES` from
 * `src/pf_spells/web_pliage.py`: unaccented, lowercase, so the index's school
 * code table indexes straight into this object. */
export const ECOLES = [
  'abjuration',
  'divination',
  'enchantement',
  'evocation',
  'illusion',
  'invocation',
  'necromancie',
  'transmutation',
  'universel',
] as const

export type Ecole = (typeof ECOLES)[number]

/** Flat pastille fills. Each is dark enough to carry white text at AA.
 *
 * The contrast floor is 5.13:1 against `base`, above the 4.5:1 AA threshold for
 * text. Lightening any of these breaks the floor and fails
 * `tokens.test.ts` — and the test is the one that is right. */
export const COULEURS_ECOLES: Readonly<Record<Ecole, string>> = {
  abjuration: '#3A5A9B',
  divination: '#6B4FA8',
  enchantement: '#A8377F',
  evocation: '#B3421F',
  illusion: '#176E77',
  invocation: '#2F6B2A',
  necromancie: '#3D3646',
  transmutation: '#8A6412',
  universel: '#5F5D55',
} as const

/** Display labels for the pastille. The colour is never the sole carrier of
 * information: nine hues are not memorable, and two of them read as the same
 * dark violet to a colourblind reader. */
export const LIBELLES_ECOLES: Readonly<Record<Ecole, string>> = {
  abjuration: 'Abjuration',
  divination: 'Divination',
  enchantement: 'Enchantement',
  evocation: 'Évocation',
  illusion: 'Illusion',
  invocation: 'Invocation',
  necromancie: 'Nécromancie',
  transmutation: 'Transmutation',
  universel: 'Universel',
} as const

export const COULEURS = {
  base: '#FAFAF9',
  surface: '#FFFFFF',
  bord: '#E4E2DE',
  bordFort: '#C9C6C0',
  encre: '#1C1B19',
  encreDouce: '#57544E',
  /** The floor. Nothing lighter carries text — 4.79:1, AA by a hair. The first
   * value tried, `#78746C`, measured 4.455:1 and would have shipped below AA
   * unnoticed; the contrast test is what caught it. */
  encreFaible: '#736F67',
  survol: '#F2F1EF',

  /** The single accent. Hue 161°, 25° clear of the nearest school hue: placed
   * anywhere else it would read as a school rather than as "active". */
  accent: '#116B4F',
  accentSurvol: '#0D5741',
  accentVoile: '#E8F1ED',

  /** The level-disagreement marker, and nothing else. Deliberately not an error
   * colour: a disagreement between a class list and a spell page is a fact of
   * the corpus, recorded and never corrected. The marker informs, it does not
   * accuse. */
  desaccord: '#8A3A12',
  desaccordVoile: '#FBEFE6',
} as const

/**
 * The slice ramp of the exploration chart — one hue, five steps.
 *
 * A chart needs its slices told apart, and the brief allows exactly one accent
 * colour. So the ramp is not a second palette: it is the accent's own hue (161°)
 * walked down in lightness, which keeps the school pastilles the only place on
 * the site where a colour *names* something. A slice's colour therefore carries
 * its rank in the chart and nothing else — which is why every slice is labelled
 * with its own name and count, in the chart and in the list beside it.
 *
 * Ordered darkest first, because the slices are ordered largest first and the
 * biggest share should read as the heaviest.
 *
 * Five steps and not nine: below ~1,25:1 between neighbours two steps read as one
 * colour, and a ramp that lies about being distinguishable is worse than a ramp
 * that repeats. Beyond five slices, `couleurTranche` interpolates between the
 * ends — see `lib/design/rampe.ts` for why that is acceptable there.
 */
export const RAMPE_TRANCHES = [
  '#0E5840',
  '#11694D',
  '#147B5A',
  '#178C67',
  '#1A9E74',
] as const

export const POLICES = {
  affichage: '"Fraunces", "Iowan Old Style", Georgia, serif',
  corps: '"Inter", "Segoe UI", system-ui, sans-serif',
  donnees: '"IBM Plex Mono", ui-monospace, monospace',
} as const

/** Modular scale, ratio 1.2, anchored at 16px. Fixed: nothing is computed at
 * render time. Body sits at 14.5px rather than 16px — the explicit price of the
 * density the brief asks for. Below 14px we do not go. */
export const ECHELLE = {
  micro: { taille: '11px', interligne: '16px', graisse: 500 },
  petit: { taille: '12.5px', interligne: '18px', graisse: 400 },
  base: { taille: '14.5px', interligne: '22px', graisse: 400 },
  grand: { taille: '17px', interligne: '24px', graisse: 400 },
  titre3: { taille: '20px', interligne: '26px', graisse: 600 },
  titre2: { taille: '25px', interligne: '30px', graisse: 600 },
  titre1: { taille: '34px', interligne: '38px', graisse: 600 },
} as const

/** The density budget, stated as a number: 40 result rows readable on a laptop
 * (1366×768, ≈620px usable). 40 × 32px = 1280px — you scroll, but the row stays
 * a comfortable touch target. */
export const DENSITE = {
  ligneHauteur: '32px',
  ligneHauteurDense: '28px',
  gouttiere: '12px',
  padCellule: '6px 10px',
  rayon: '4px',
  rayonPanneau: '6px',
  filet: '1px',
  largeurMaxTexte: '68ch',
  /** The stated target, kept next to the value it justifies. */
  lignesVisiblesCible: 40,
} as const

export const MOUVEMENT = {
  /** Short enough not to be felt on a list of 2070 rows, and zeroed entirely
   * under `prefers-reduced-motion: reduce`. */
  duree: '120ms',
  courbe: 'ease-out',
} as const

/** Interface vocabulary, frozen by the Skill. One word, one meaning, throughout.
 *
 * "Niveau" alone is meaningless in this corpus (B4): a spell is level 2 *for the
 * bard*. A label reading plain "Niveau 2" is a modelling defect that leaked all
 * the way to the screen. */
export const MOTS = {
  sort: 'sort',
  sorts: 'sorts',
  niveau: 'niveau',
  classe: 'classe',
  ecole: 'école',
  jetSauvegarde: 'jet de sauvegarde',
  resistanceMagie: 'résistance à la magie',
  desaccordNiveau: 'désaccord de niveau',
  favoris: 'favoris',
  filtrePose: 'filtre posé',
  source: 'source : pathfinder-fr.org',
  voirSurLeWiki: 'Voir sur pathfinder-fr.org',
} as const
