import type { Metadata } from 'next'
import { Syne, Space_Grotesk, Space_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { VibeSlider } from '@/components/VibeSlider'
import { GlobalPlayerBar } from '@/components/audio/GlobalPlayerBar'
import { ChromeFrame } from '@/components/ChromeFrame'
import { PaperGround } from '@/components/chrome/PaperGround'
import { VibeProvider } from '@/context/VibeContext'
import { OverlayProvider } from '@/components/overlay/useOverlay'
import { OverlayRouter } from '@/components/overlay/OverlayRouter'
import { AuthProvider } from '@/components/auth/useAuth'
import { LoginOverlay } from '@/components/auth/LoginOverlay'
import { PublishConfirmProvider } from '@/components/publish/usePublishConfirm'
import { PublishConfirmOverlay } from '@/components/publish/PublishConfirmOverlay'
import { PromptProvider } from '@/components/prompt/usePrompt'
import { PromptOverlay } from '@/components/prompt/PromptOverlay'
import { SearchProvider } from '@/components/search/useSearch'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { AudioPlayerProvider } from '@/components/audio/AudioPlayerProvider'
import { MobileNotice } from '@/components/MobileNotice'
import { FooterColophon } from '@/components/chrome/FooterColophon'

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
    default: 'GRADIENTE',
    template: '%s · GRADIENTE',
  },
  description:
    'Música electrónica, eventos, mixes y cultura desde adentro de la escena mexicana.',
  keywords: ['música electrónica', 'CDMX', 'techno', 'rave', 'underground México'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="bg-base text-primary">
        <AuthProvider>
        <PromptProvider>
        <PublishConfirmProvider>
        <VibeProvider>
          <OverlayProvider>
          <SearchProvider>
          <AudioPlayerProvider>
              <Suspense fallback={null}>
                {/* Ground flip — ONE mount, self-driving off PAPER_ROUTES. */}
                <PaperGround />
                <ChromeFrame>
                  <Navigation />
                  <VibeSlider />
                </ChromeFrame>
                <main className="mx-auto max-w-screen-2xl px-4 pb-24 pt-4 md:px-8">
                  {children}
                </main>
                {/* Bottom player faceplate — fixed bar + in-flow spacer; nulls on the
                    full-bleed routes via ChromeFrame and on /dashboard internally
                    (MiniTransport owns that surface). */}
                <ChromeFrame>
                  <GlobalPlayerBar />
                </ChromeFrame>
                {/* Footer — printed colophon (pliego register) */}
                <ChromeFrame>
                  <FooterColophon />
                </ChromeFrame>
                <OverlayRouter />
                <LoginOverlay />
                <PublishConfirmOverlay />
                <PromptOverlay />
                <SearchOverlay />
                <MobileNotice />
              </Suspense>
          </AudioPlayerProvider>
          </SearchProvider>
          </OverlayProvider>
        </VibeProvider>
        </PublishConfirmProvider>
        </PromptProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
