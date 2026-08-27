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
 * The slice ramp of the exploration chart — eight hues, one per slice.
 *
 * Revision: the single-hue ramp (the accent walked down in lightness) read as
 * five shades of the same green regardless of what was being cut — level,
 * saving throw, component. Overridden by explicit human decision: a chart's
 * slices now get a genuinely distinct hue each, at the cost of the property the
 * single-hue ramp bought for free — that a slice's colour was never mistaken for
 * a school pastille. These eight hues sit close to a school hue in a few cases
 * (`#8C6E1E` and transmutation, notably), which is accepted rather than solved
 * because the two never appear in the same chart: the exploration route shows
 * one axis at a time, and the school axis draws with `COULEURS_ECOLES`, never
 * with this ramp.
 *
 * Colour still names nothing here but a slice's rank in this one chart — the
 * label and the count are what identify it, in the chart and in the list beside
 * it, exactly as before.
 *
 * Eight steps because the exploration's widest partition axis (level) commonly
 * has more slices than the old ramp's five; beyond eight, `couleurTranche`
 * cycles rather than interpolates — seven distinguishable hues repeating reads
 * better than an infinite gradient inventing new ones.
 */
export const RAMPE_CATEGORIELLE = [
  '#1F6F8B',
  '#A8501C',
  '#8C6E1E',
  '#6B7A1E',
  '#8A3A8C',
  '#7A3E9E',
  '#4A4E8C',
  '#B03060',
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
  // Named `corps` and not `base`: the colour scale already owns `base`, and
  // Tailwind resolves a single `text-corps` utility from both `--color-base` and
  // `--text-corps` — it picked the colour, so every body cell was rendered in the
  // page background on a white surface. Invisible text, and no test could see it.
  corps: { taille: '14.5px', interligne: '22px', graisse: 400 },
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
  compte: 'compte',
  synchronisation: 'synchronisation',
  synchroniserMaintenant: 'Synchroniser maintenant',
  seDeconnecter: 'Se déconnecter',
  adresseEmail: 'adresse e-mail',
  motDePasse: 'mot de passe',
  creerUnCompte: 'Créer un compte',
  seConnecter: 'Se connecter',
  motDePasseOublie: 'Mot de passe oublié',
} as const
