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
 *
 * This is Grimoire — the adopted direction (human override, 2026-08-31, see
 * `design/DECISIONS.md` D7), superseding the earlier "flat minimal" system (v1)
 * that a previous pass had chosen instead. Grimoire keeps its parchment identity
 * and its day/night pair, adapted to the two guardrails that still hold: no
 * gradient anywhere, and the ornament is pared back wherever it read as busy —
 * no double frame, no ornamental glyph, no 44px floating drop cap.
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

/** Flat pastille fills, recomputed against the parchment `base` (`#F1E7D2`,
 * relative luminance 0.805) rather than the old near-white `#FAFAF9` (0.94).
 * A darker page background lowers every one of these ratios, so two of the nine
 * — `evocation` and `transmutation` — needed a darker shade to hold the 4.5:1
 * text floor; the other seven cleared it unchanged. See `design/DECISIONS.md` D8
 * for the recomputation and `design/GRIMOIRE_DESIGN_SYSTEM.md` §3 for the table. */
export const COULEURS_ECOLES: Readonly<Record<Ecole, string>> = {
  abjuration: '#3A5A9B',
  divination: '#6B4FA8',
  enchantement: '#A8377F',
  evocation: '#A53D1D',
  illusion: '#176E77',
  invocation: '#2F6B2A',
  necromancie: '#3D3646',
  transmutation: '#866213',
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

/**
 * The day palette (default, no `data-theme` attribute). Parchment, warm ink,
 * a single oxblood accent — flat fills throughout, no gradient anywhere.
 */
export const COULEURS = {
  /** Parchment page background. */
  base: '#F1E7D2',
  /** Lighter vellum tone for a card, a table, a panel. */
  surface: '#F8F2E6',
  bord: '#D9CBA8',
  /** Any control outline (field, panel border) is a UI boundary under WCAG
   * 1.4.11, floor 3:1 — not the 4.5:1 text floor. 3.25:1 on `base`, 3.58:1 on
   * `surface`. */
  bordFort: '#927C5D',
  encre: '#2B2013',
  encreDouce: '#5C4A30',
  /** The floor. Nothing lighter carries text — 4.84:1 on `base`, AA with a
   * deliberate margin (the v1 floor sat at 4.79:1; this is the same shape of
   * rule, recomputed for the new background). */
  encreFaible: '#776040',
  survol: '#EDE2CC',

  /** The single accent — oxblood/wine, hue 348°, 26° clear of the nearest
   * school hue (`enchantement`, 322°, and `evocation`, 14°). Placed anywhere
   * closer it would read as a school rather than as "active". Dark enough to
   * carry `surface` (near-white vellum) as button text at 8.53:1. */
  accent: '#7E2537',
  accentSurvol: '#5F1C29',
  accentVoile: '#F7E9EC',

  /** The level-disagreement marker, and nothing else. Deliberately not an error
   * colour: a disagreement between a class list and a spell page is a fact of
   * the corpus, recorded and never corrected. The marker informs, it does not
   * accuse. */
  desaccord: '#82451C',
  desaccordVoile: '#F8EEE7',
} as const

/**
 * The night palette, applied under `[data-theme="nuit"]` in `theme.css`. A flat
 * palette swap only — dark ink page, parchment-toned text, no gradient, same
 * nine school fills (they are a swatch + label, not text-on-fill, so they carry
 * over unchanged; see `PastilleEcole.tsx`).
 *
 * Kept because it costs nothing at runtime the static export doesn't already
 * pay for: a `data-theme` attribute set by an inline script before paint, and a
 * second `@theme` block. No server, no route, no base — CLAUDE.md §11's
 * constraint on the export is about server dependencies, not about a second flat
 * palette switched client-side.
 */
export const COULEURS_NUIT = {
  base: '#1E1710',
  surface: '#26201A',
  bord: '#33291D',
  /** 3.84:1 on `base`, 3.49:1 on `surface` — clears the 3:1 UI-boundary floor. */
  bordFort: '#81735F',
  encre: '#ECE1C9',
  encreDouce: '#C9BCA0',
  /** 4.68:1 on `base` — the same floor shape as the day palette. */
  encreFaible: '#997F5C',
  survol: '#2A2318',

  /** Lighter than the day accent, not darker: on a dark ground, "further from
   * the background" means lighter, and a hover state that darkened would sink
   * toward the page rather than stand out. 4.77:1 on `base`; the button text
   * that sits on it is `encre`-on-light, i.e. dark ink, not white — white-on-
   * `accent` fails here (2.86:1) precisely because the accent had to be lifted
   * to clear the background floor. */
  accent: '#D16170',
  accentSurvol: '#D56D7B',
  accentVoile: '#34141A',

  desaccord: '#C46C31',
  /** Darker than the day pairing's `desaccordVoile`, and for the same reason
   * `accentSurvol` moved lighter here: the marker must clear 4.5:1 against its
   * own voile, and `#302117` (the "obvious" dark parchment shade) only reached
   * 4.08:1 — `#1F150F` reaches 4.72:1. */
  desaccordVoile: '#1F150F',
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
 *
 * Re-verified against the Grimoire `base` (`#F1E7D2`): every step still clears
 * the 3:1 graphical-object floor (minimum 3.86:1, `#6B7A1E`). Not re-verified
 * against `COULEURS_NUIT.base` — several steps fall under 3:1 on the dark
 * background (as low as 2.33:1). The exploration route does not yet read
 * `data-theme`, so this is latent rather than shipped; see `design/FOLLOWUPS.md`.
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

/**
 * The dons cost ramp — five steps, one hue, ascending lightness→darkness.
 *
 * Cost (slots to unlock a feat, prerequisites included) is an ORDINAL
 * magnitude: 3 is not "a different kind of thing" from 2, it is simply more of
 * the same thing. A categorical/multi-hue ramp (`RAMPE_CATEGORIELLE` above)
 * would imply the opposite — that step 3 has nothing to do with step 2 — so
 * this is deliberately a single hue (blue, clear of both the accent's wine hue
 * and every school pastille) walked down in lightness, step 1 lightest / step 5
 * darkest. `scripts/validate_palette.js --ordinal` enforces the monotonic
 * order and the 3:1 graphical-object floor against both `COULEURS.surface` and
 * `COULEURS_NUIT.surface`, in both palettes below — a chip is small text-on-fill,
 * never a full-width bar, so the graphical floor applies, not the 4.5:1 text one.
 */
export const RAMPE_COUT = [
  '#5B8CBB',
  '#4472A0',
  '#2F5A87',
  '#1D466E',
  '#0E3252',
] as const

/** Night counterpart: the same hue, re-anchored so step 1 still reads as
 * "least" and step 5 as "most" against the dark `COULEURS_NUIT.surface`
 * (`#26201A`) — lightening every step relative to the day ramp, the same
 * correction `COULEURS_NUIT.accent` makes for the same reason (on a dark
 * ground, "further from the background" means lighter, not darker). */
export const RAMPE_COUT_NUIT = [
  '#4A7291',
  '#5D84A2',
  '#7CA6C1',
  '#9EC1D9',
  '#C4DDEB',
] as const

/**
 * Eczar for display (spell names, titles), Lora for body copy, IBM Plex Mono
 * unchanged for tabular data. This is the one part of Grimoire's identity that
 * cannot be "flattened" — a typeface is not a gradient — so it carries over from
 * the prototype unchanged, still local `woff2`, still no CDN.
 */
export const POLICES = {
  affichage: '"Eczar", "Iowan Old Style", Georgia, serif',
  corps: '"Lora", "Iowan Old Style", Georgia, serif',
  donnees: '"IBM Plex Mono", ui-monospace, monospace',
} as const

/** Modular scale, ratio 1.2, anchored at 16px. Fixed: nothing is computed at
 * render time. Body sits at 14.5px rather than 16px — the explicit price of the
 * density the brief asks for. Below 14px we do not go. Sizes are unchanged from
 * v1: Grimoire's identity is the palette and the typeface, not a different
 * density budget, and the 40-row target below is independent of either. */
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
  /** Grimoire keeps sharp corners, `0px` — not a v1-vs-v2 compromise, a genuine
   * agreement between the two guardrails: a parchment page reads as cut paper,
   * not as a rounded app chrome, and `0px` is also the most minimal radius there
   * is. */
  rayon: '0px',
  rayonPanneau: '0px',
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
  themeJour: 'Thème jour',
  themeNuit: 'Thème nuit',
} as const
