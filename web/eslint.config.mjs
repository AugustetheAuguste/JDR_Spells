/*
 * Flat config, imported directly: `eslint-config-next` 16 ships flat-config
 * arrays, so it needs no `FlatCompat` bridge — routing it through one produces a
 * circular-structure crash rather than a lint result.
 */
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  ...typescript,
]

export default config
