import type { Metadata } from 'next'
import { Syne, Space_Grotesk, Space_Mono } from 'next/font/google'
import { Suspense } from 'react'
import Link from 'next/link'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { VibeSlider } from '@/components/VibeSlider'
import { CRTOverlay } from '@/components/CRTOverlay'
import { VibeProvider } from '@/context/VibeContext'
import { OverlayProvider } from '@/components/overlay/useOverlay'
import { OverlayRouter } from '@/components/overlay/OverlayRouter'
import { AuthProvider } from '@/components/auth/useAuth'
import { LoginOverlay } from '@/components/auth/LoginOverlay'
import { PublishConfirmProvider } from '@/components/publish/usePublishConfirm'
import { PublishConfirmOverlay } from '@/components/publish/PublishConfirmOverlay'
import { SearchProvider } from '@/components/search/useSearch'
import { SearchOverlay } from '@/components/search/SearchOverlay'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'GRADIENTE FM',
    template: '%s · GRADIENTE FM',
  },
  description:
    'Música electrónica, eventos, mixes y cultura desde adentro de la escena mexicana.',
  keywords: ['música electrónica', 'CDMX', 'techno', 'rave', 'underground México'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="bg-base text-primary">
        {/* Providers live ABOVE CRTOverlay so that when CRTOverlay's mode
            flips (A → B or vice versa) and the children get re-parented,
            VibeContext / OverlayContext / etc. don't remount and lose state. */}
        <AuthProvider>
        <PublishConfirmProvider>
        <VibeProvider>
          <OverlayProvider>
          <SearchProvider>
            <CRTOverlay>
              <Suspense fallback={null}>
                <Navigation />
                <VibeSlider />
                <main className="mx-auto max-w-screen-2xl px-4 pb-24 pt-4 md:px-8">
                  {children}
                </main>
                {/* Footer — SUBSISTEMA chrome strip */}
                <footer className="border-t border-border bg-black px-4 py-3 md:px-8">
                  <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-sys-orange" style={{ boxShadow: '0 0 4px #FF6600' }} />
                      <span className="font-mono text-[9px] tracking-[0.2em] text-sys-orange/70">
                        SUBSISTEMA·UNIT-10
                      </span>
                    </div>
                    <nav
                      aria-label="Identidad"
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] tracking-[0.18em] text-muted"
                    >
                      <Link href="/about" className="hover:text-sys-orange">/ABOUT</Link>
                      <span className="text-border">·</span>
                      <Link href="/manifesto" className="hover:text-sys-orange">/MANIFIESTO</Link>
                      <span className="text-border">·</span>
                      <Link href="/equipo" className="hover:text-sys-orange">/EQUIPO</Link>
                    </nav>
                    <p className="hidden font-mono text-[9px] tracking-[0.18em] text-muted md:block">
                      // GRADIENTE·FM · CULTURA ELECTRÓNICA DESDE MÉXICO · DESDE 2088
                    </p>
                    <div className="flex items-center gap-4 font-mono text-[9px] tabular-nums text-muted">
                      <span>LAT 19.4326</span>
                      <span className="text-border">·</span>
                      <span>LON -99.1332</span>
                    </div>
                  </div>
                </footer>
                <OverlayRouter />
                <LoginOverlay />
                <PublishConfirmOverlay />
                <SearchOverlay />
              </Suspense>
            </CRTOverlay>
          </SearchProvider>
          </OverlayProvider>
        </VibeProvider>
        </PublishConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
