import type { Metadata } from 'next'
import { Perfil } from '@/components/credencial/PerfilPublico'

interface Props {
  params: Promise<{ username: string }>
}

function clean(raw: string): string {
  try {
    return decodeURIComponent(raw).replace(/^@/, '')
  } catch {
    return raw.replace(/^@/, '')
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const u = clean(username)
  return {
    title: `@${u}`,
    description: `La credencial pública de @${u} en Gradiente: rol o rango, trofeos, firma y la energía de sus piezas.`,
  }
}

/**
 * /u/[username] — an identity hub (one of the few surfaces that is a page,
 * not an overlay). The lookup happens in the client world (the server
 * snapshot every member shares, public profile fields only). Unknown names
 * get an honest «sin señal» state.
 */
export default async function UserPage({ params }: Props) {
  const { username } = await params
  return <Perfil username={clean(username)} />
}
