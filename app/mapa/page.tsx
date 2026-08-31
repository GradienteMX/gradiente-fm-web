import type { Metadata } from 'next'
import { getItems } from '@/lib/data/items'
import { MOCK_ITEMS } from '@/lib/mockData'
import archiveSeedJson from '@/lib/data/archiveSeed.json'
import {
  franjaClusters,
  placeItems,
  type MapaLayout,
  type FranjaCluster,
} from '@/lib/mapa/layout'
import type { ContentItem } from '@/lib/types'
import { MapaCanvas } from '@/components/mapa/MapaCanvas'

// EXPERIMENTAL — Spatial Identity Canvas vertical slice.
// See wiki/70-Roadmap/Spatial Identity Canvas.md. This route is a prototype
// of the global honeycomb terrain; the production home/franja surfaces are
// untouched. Layout is computed ONCE server-side (deterministic pure
// functions in lib/mapa/) and hydrated as props, so server and client agree
// by construction.

// Reads from Supabase via the cookies()-aware server client → request-time
// dynamic, same as the home page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'MAPA // GRADIENTE FM',
  description:
    'Mapa global del ecosistema Gradiente — terreno hexagonal continuo organizado por afinidad.',
}

interface PageProps {
  searchParams: { focus?: string }
}

// Per-instance layout memo. The layout is deterministic per (dataset, now
// bucket), and prod runs ~380 terrain items ≈ 120ms of placement per compute
// — worth amortizing across the force-dynamic requests of one server
// instance. Key = now bucket + a cheap rolling hash over the fields that
// feed placement. Best-effort only (serverless instances are ephemeral).
const layoutCache = new Map<
  string,
  { layout: MapaLayout; clusters: FranjaCluster[] }
>()
const LAYOUT_CACHE_MAX = 3

// Synthetic HL injection (2026-08-18, Iker's call): real HP is nearly flat
// until the deferred hp_events writer ships, so the terrain reads as a field
// of single hexes. This turns on layout.ts's deterministic id-hashed tier
// promotion — mixed 1/3/7 slab texture, same layout for every viewer. Flip to
// false (or delete) once real HP signals flow.
const SYNTHETIC_HL = true

function datasetKey(items: readonly ContentItem[], nowMs: number): string {
  let h = 5381
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  for (const i of items) {
    mix(i.id)
    mix(i.hpLastUpdatedAt ?? '')
    mix(String(i.hp ?? ''))
    mix(i.franjaId ?? '')
  }
  return `${nowMs}:${items.length}:${h >>> 0}`
}

export default async function MapaPage({ searchParams }: PageProps) {
  const fetched = await getItems()
  // Dev-seed fallback: anonymous/unauthenticated contexts read zero rows
  // (RLS auth-gated reads, migration 0014). MOCK_ITEMS is the same dev seed
  // the rest of the app leans on — real Gradiente content, not invented
  // placeholder. In production authed sessions `fetched` is always non-empty
  // (real rows + visible seed rows).
  const all = fetched.length > 0 ? fetched : MOCK_ITEMS
  // Archivo Vivo 2005-2013 (living-archive pilot) — file-side seed built by
  // scripts/buildArchiveSeed.ts from the gradiente-ops dataset. Map-only for
  // now: the archive era rings the terrain periphery (its 2010-era dates are
  // fully decayed) and never enters the home feed. Every entry carries a
  // verified Wayback image and the visible-credit fields from MANUAL.md.
  const archiveItems = archiveSeedJson as unknown as ContentItem[]

  // Layout timestamp quantized to 10-minute buckets: HP decay is continuous,
  // so an un-quantized `now` could flip a near-tie between two renders and
  // shuffle the terrain on a soft refresh (e.g. the marketplace overlay's
  // router.replace). Within a bucket, every recompute is byte-identical —
  // the first hysteresis rule of the placement model (see wiki/70-Roadmap/
  // Mapa Placement Rules.md).
  const nowMs = Math.floor(Date.now() / 600_000) * 600_000
  const now = new Date(nowMs)
  // Terrain rules (wiki/70-Roadmap/Mapa Placement Rules.md): franja identity
  // rows are never terrain, and — per the image-only rule — neither is any
  // item without imagery. The map is a visual surface; imageless content
  // stays reachable through its section pages and search.
  const terrainItems = [
    ...all.filter((i) => i.type !== 'franja' && i.imageUrl),
    ...archiveItems.filter((i) => i.imageUrl),
  ]
  const franjas = all.filter((i) => i.type === 'franja')

  const key = datasetKey(terrainItems, nowMs)
  let cached = layoutCache.get(key)
  if (!cached) {
    const layout = placeItems(terrainItems, now, { syntheticHl: SYNTHETIC_HL })
    cached = { layout, clusters: franjaClusters(layout, franjas) }
    layoutCache.set(key, cached)
    while (layoutCache.size > LAYOUT_CACHE_MAX) {
      const oldest = layoutCache.keys().next().value
      if (oldest === undefined) break
      layoutCache.delete(oldest)
    }
  }

  return (
    <MapaCanvas
      layout={cached.layout}
      clusters={cached.clusters}
      franjas={franjas}
      initialFocusSlug={searchParams.focus ?? null}
    />
  )
}
