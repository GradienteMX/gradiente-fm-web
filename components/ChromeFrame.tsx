'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Wraps the main chrome (Navigation, VibeSlider, footer) so the anonymous
// full-bleed pages render without the regular site chrome bleeding in.
// /welcome and /espera (the public waitlist) are the anonymous cases;
// /mapa is the experimental Spatial Identity Canvas, which is full-viewport
// terrain with its own minimal chrome (see components/mapa/MapaCanvas.tsx).
export function ChromeFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/welcome' || pathname === '/espera' || pathname === '/mapa')
    return null
  return <>{children}</>
}
