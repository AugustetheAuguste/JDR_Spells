/**
 * Spell page — reserved. Filled by step 07, which generates one static page per
 * spell via `generateStaticParams`.
 *
 * The single slug below is a placeholder, and it comes from the frozen fixture
 * rather than being invented: `output: 'export'` refuses a dynamic route whose
 * `generateStaticParams` yields nothing, so an empty list fails the build
 * outright. Step 07 replaces this with the 2070 real slugs.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [{ slug: 'abondance-de-munitions' }]
}

export default async function PageSort({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <article>
      <h1 className="m-0 font-affichage text-titre1 font-semibold">{slug}</h1>
      <p className="mt-2 max-w-[68ch] text-grand text-encre-douce">
        La fiche de sort — bloc technique, description, niveaux par classe, lien
        vers la source — est posée à l&apos;étape 07.
      </p>
    </article>
  )
}
