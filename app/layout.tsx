import type { Metadata } from 'next'
import { Syne, Space_Grotesk, Space_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { VibeSlider } from '@/components/VibeSlider'
import { VibeProvider } from '@/context/VibeContext'
import { OverlayProvider } from '@/components/overlay/useOverlay'
import { OverlayRouter } from '@/components/overlay/OverlayRouter'

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
        <VibeProvider>
          <OverlayProvider>
            <Suspense fallback={null}>
              <Navigation />
              <VibeSlider />
              <main className="mx-auto max-w-screen-2xl px-4 pb-24 pt-4 md:px-8">
                {children}
              </main>
              {/* Footer */}
              <footer className="border-t border-border px-4 py-6 md:px-8">
                <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-sys-red">▶</span>
                    <span className="font-syne text-sm font-black text-primary">GRADIENTE·FM</span>
                  </div>
                  <p className="sys-label">
                    © 2026 · DESDE ADENTRO DE LA ESCENA MEXICANA
                  </p>
                  <span className="sys-label flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sys-green" />
                    ONLINE
                  </span>
                </div>
              </footer>
              <OverlayRouter />
            </Suspense>
          </OverlayProvider>
        </VibeProvider>
      </body>
    </html>
  )
}
