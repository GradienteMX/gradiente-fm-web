'use client'

import { useMemo } from 'react'
import type { ContentItem } from '@/lib/types'
import { useItems, useNow } from '@/lib/store/world'
import { franjaCatalog, frequencyAt, sortByLastSignal, type FranjaCatalog } from './catalog'

/** The franja's catalog, recomputed when the world changes (and hourly, as nights pass). */
export function useFranjaCatalog(franja: ContentItem): FranjaCatalog {
  const items = useItems()
  const now = useNow()
  const hour = Math.floor(now.getTime() / 3_600_000)
  return useMemo(() => franjaCatalog(franja, items, new Date(hour * 3_600_000)), [franja, items, hour])
}

/** Where this station sits on the home Dial (same order, same numbers). */
export function useFrequency(franjaId: string): { freq: number; index: number; n: number } {
  const items = useItems()
  return useMemo(() => {
    const dial = sortByLastSignal(items.filter((i) => i.type === 'franja'))
    const index = Math.max(0, dial.findIndex((f) => f.id === franjaId))
    return { freq: frequencyAt(index, dial.length), index, n: dial.length }
  }, [items, franjaId])
}

/** A franja by slug (null until it exists in this world). */
export function useFranjaBySlug(slug: string | null | undefined): ContentItem | null {
  const items = useItems()
  return useMemo(() => (slug ? items.find((i) => i.type === 'franja' && i.slug === slug) ?? null : null), [items, slug])
}
