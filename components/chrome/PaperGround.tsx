'use client'

import { useEffect } from 'react'

// Toggles html.paper-route while mounted — the feed pages' ground flip.
// Mirror of the dashboard's dash-route mechanism: the class (not the page
// wrapper) paints documentElement/body so overscroll never flashes charcoal.
// The scoped rules live in globals.css under `html.paper-route`.
export function PaperGround() {
  useEffect(() => {
    document.documentElement.classList.add('paper-route')
    return () => document.documentElement.classList.remove('paper-route')
  }, [])
  return null
}
