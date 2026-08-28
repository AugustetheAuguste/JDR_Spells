import { VuePersonnages } from '@/components/compte/VuePersonnages'

export const metadata = {
  title: 'Personnages',
  description: 'Créer et gérer les personnages attachés à un compte.',
}

export default function PagePersonnages() {
  return <VuePersonnages />
}
