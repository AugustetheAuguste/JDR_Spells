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
}

export default nextConfig
