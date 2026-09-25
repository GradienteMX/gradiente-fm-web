import type { Metadata, Viewport } from 'next'
import { Anybody, Newsreader, Space_Grotesk, Space_Mono } from 'next/font/google'
import { WorldProvider } from '@/lib/store/world'
import { emptyPublicWorld, type PrivateWorld, type PublicWorld } from '@/lib/store/snapshot'
import { createClient } from '@/lib/supabase/server'
import { loadPrivateWorld, loadPublicWorld } from '@/lib/data/world'
import { getPublicStickers } from '@/lib/data/stickers'
import { isDevOpen } from '@/lib/devOpen'
import { Stage } from '@/components/stage/Stage'
import { Trama } from '@/components/trama/Trama'
import { Shell } from '@/components/shell/Shell'
import './globals.css'

const anybody = Anybody({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  variable: '--f-anybody',
  display: 'swap',
})

const grotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--f-grotesk',
  display: 'swap',
})

const mono = Space_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
  variable: '--f-mono',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--f-newsreader',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'GRADIENTE — energía, no género',
    template: '%s · GRADIENTE',
  },
  description:
    'Infraestructura y memoria para la escena underground de música y arte sonoro en México. Navegas por energía, no por género.',
}

export const viewport: Viewport = {
  themeColor: '#edebe3',
  colorScheme: 'light',
}

/**
 * Who is looking, and the world they may see. Signed in: the shared public
 * snapshot (cached server-side) plus their own rows (read as them, RLS).
 * Anonymous: nothing — they only reach La Puerta and La espera, which work
 * without a world. The development preview (lib/devOpen.ts) serves the
 * public world with nobody signed in.
 *
 * A database that can't be read never takes the site down: the page renders
 * with an empty world and the error goes to the server log.
 */
async function readWorld(): Promise<{ pub: PublicWorld; priv: PrivateWorld | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user && !isDevOpen()) return { pub: emptyPublicWorld(Date.now()), priv: null }
  const [pub, stickers, priv] = await Promise.all([
    loadPublicWorld().catch((err: unknown) => {
      console.error('[world] no se pudo leer la instantánea pública:', err)
      return emptyPublicWorld(Date.now())
    }),
    // Cached apart (tag 'stickers'): pressing a sticker doesn't rebuild the world.
    getPublicStickers().catch((err: unknown) => {
      console.error('[world] no se pudieron leer los calcos:', err)
      return { placements: [], stickerSerials: {} }
    }),
    user
      ? loadPrivateWorld(user.id).catch((err: unknown) => {
          console.error('[world] no se pudieron leer tus filas:', err)
          return null
        })
      : Promise.resolve(null),
  ])
  return { pub: { ...pub, ...stickers }, priv }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The client clock starts at this instant and walks on after hydration, so
  // the organism keeps aging in real time. A server component: read once per
  // render on the server, then passed down as data.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const { pub, priv } = await readWorld()
  return (
    <html lang="es" className={`${anybody.variable} ${grotesk.variable} ${mono.variable} ${newsreader.variable}`}>
      <body>
        <WorldProvider now={now} publicWorld={pub} privateWorld={priv}>
          <Stage />
          {/* Before the Shell so the engine is mounted when pages ask for gestures. */}
          <Trama />
          <Shell>{children}</Shell>
        </WorldProvider>
      </body>
    </html>
  )
}
