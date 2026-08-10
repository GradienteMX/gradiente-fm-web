'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Wraps the main chrome (Navigation, VibeSlider, footer) so the anonymous
// full-bleed pages render without the regular site chrome bleeding in.
// /welcome and /espera (the public waitlist) are the only routes that want
// this; everything else is behind auth and gets the full chrome.
export function ChromeFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/welcome' || pathname === '/espera') return null
  return <>{children}</>
}
