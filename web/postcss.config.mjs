/** Tailwind 4 passes through PostCSS only; no autoprefixer needed — Lightning CSS
 *  inside Tailwind handles prefixing. */
const config = {
  plugins: ['@tailwindcss/postcss'],
}

export default config
