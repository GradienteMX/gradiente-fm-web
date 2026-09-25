import type { Metadata } from 'next'
import { Puerta } from '@/components/puerta/Puerta'

export const metadata: Metadata = {
  title: 'La Puerta',
  description: 'Gradiente se abre por invitación: inicia sesión, entra con tu código o únete a la lista de espera.',
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** /welcome — La Puerta. `?codigo=` opens the code panel with it (links in invitations). */
export default async function WelcomePage({ searchParams }: Props) {
  const sp = await searchParams
  const raw = sp.codigo
  const codigo = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : ''
  // keyed by the code: a code handed over from Acceso opens the door afresh
  return <Puerta key={codigo} initialCode={codigo.slice(0, 64)} />
}
