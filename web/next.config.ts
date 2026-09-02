import type { NextConfig } from 'next'

/**
 * Static export, no runtime.
 *
 * The site is a pure function of the repository: the index and the per-spell
 * props are committed build artefacts, so there is no database, no API route and
 * nothing to run at request time. `output: 'export'` makes that structural
 * rather than merely true today — an accidental server dependency becomes a
 * build error instead of a Vercel function nobody meant to deploy.
 */
const nextConfig: NextConfig = {
  output: 'export',
  // Trailing slashes keep the exported tree self-consistent when served as plain
  // files: /sorts/boule-de-feu/ resolves to its index.html without a rewrite.
  trailingSlash: true,
  images: { unoptimized: true },
  // Typed links: a `href` to a route that does not exist becomes a type error
  // rather than a 404 discovered in production.
  typedRoutes: true,
  turbopack: {
    // The repo root also has a package.json (the data-contract checker runs from
    // there), so Turbopack infers the wrong workspace root and warns. `web/` is
    // the application root; saying so is not a preference, it decides where
    // module resolution starts.
    root: import.meta.dirname,
  },
  // `web/lib/dons/*.ts` (ported from `src/pf_dons/*.py` in step 09) imports its
  // siblings with an explicit `.js` extension — the step-06/09 contract's own
  // convention, unrelated to this app, and never worth diverging from since a
  // Python->TS parity script (`scripts/vider_verdicts_ts.ts`) also runs that
  // module graph directly under Node's own ESM resolver, which requires it.
  // `tsc`'s `moduleResolution: "bundler"` already accepts a `.js` specifier
  // resolving to a `.ts` file; webpack (the engine `next build` uses even
  // though `next dev` defaults to Turbopack) does not, unless told to — this
  // step is the first to pull that module graph into an actual page
  // (`app/compte/personnages/page.tsx` -> `Emplacements.tsx` -> `moteur.ts`),
  // so the gap was latent until now.
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
