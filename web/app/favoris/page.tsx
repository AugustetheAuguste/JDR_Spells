import { VueFavoris } from '@/components/favoris/VueFavoris'

/**
 * The favourites route.
 *
 * No `Suspense` boundary here, unlike `/` and `/comparaison`: this view reads no
 * query string. Its state comes from `localStorage`, which the provider reads in
 * an effect after mount, so the prerendered shell is already correct.
 */
export const metadata = {
  title: 'Favoris',
  description:
    'Vos listes de sorts, enregistrées dans ce navigateur seulement, exportables en JSON.',
}

export default function PageFavoris() {
  return <VueFavoris />
}
