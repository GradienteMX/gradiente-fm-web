'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Wraps the main chrome (Navigation, VibeSlider, footer) so the /welcome
// landing renders full-bleed without the regular site chrome bleeding in.
// The welcome page is the only route that wants this; everything else is
// behind auth and gets the full chrome.
export function ChromeFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/welcome') return null
  return <>{children}</>
}
