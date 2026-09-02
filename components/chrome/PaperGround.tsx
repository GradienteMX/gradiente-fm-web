'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { isPaperRoute } from '@/lib/chrome/paperRoutes'

// Toggles html.paper-route on the paper routes — the ground flip.
// Mirror of the dashboard's dash-route mechanism: the class (not the page
// wrapper) paints documentElement/body so overscroll never flashes charcoal.
// The scoped rules live in globals.css under `html.paper-route`.
//
// FASE F: this used to be mounted BY EACH PAPER PAGE, which meant the route
// list in lib/chrome/paperRoutes.ts and nine <PaperGround/> call sites had to
// be edited together — a documented maintenance trap that fase F would have
// widened to seventeen call sites. It is now mounted ONCE in the root layout
// and drives itself off `isPaperRoute(pathname)`, so PAPER_ROUTES is the
// single source of truth and adding a route is a one-line change.
export function PaperGround() {
  const pathname = usePathname()
  const paper = isPaperRoute(pathname ?? '')
  useEffect(() => {
    if (!paper) return
    document.documentElement.classList.add('paper-route')
    return () => document.documentElement.classList.remove('paper-route')
  }, [paper])
  return null
}
