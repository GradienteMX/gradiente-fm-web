'use client'

// ── Frontend-only partner-override store ───────────────────────────────────
//
// Mirror of [[userOverrides]] for partner ContentItems. Lets the admin
// approve a partner for marketplace + lets the partner team edit their card
// (description / location / currency / listings) without touching the
// immutable MOCK_ITEMS seed.
//
// Storage shape (`gradiente:partner-overrides`):
//
//   { [partnerId]: PartnerOverride }
//
// Listener pattern is identical to userOverrides — `setPartnerOverride` and
// the convenience listing writers fire `notify()`, which re-runs every
// subscribed hook.
//
// When the real backend (see [[Supabase Migration]]) lands, swap the
// writers for Supabase RPCs against `content_items` rows. RLS gates writes
// to admins (for `marketplaceEnabled`) or partner-team members (for the
// rest of the marketplace fields).

import { useEffect, useState } from 'react'
import type { ContentItem, MarketplaceListing } from './types'
import { MOCK_ITEMS } from './mockData'

const STORAGE_KEY = 'gradiente:partner-overrides'

export interface PartnerOverride {
  marketplaceEnabled?: boolean
  marketplaceDescription?: string
  marketplaceLocation?: string
  marketplaceCurrency?: string
  marketplaceListings?: MarketplaceListing[]
}

type OverrideMap = Record<string, PartnerOverride>

function emptyMap(): OverrideMap {
  return {}
}

function readMap(): OverrideMap {
  if (typeof window === 'undefined') return emptyMap()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyMap()
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as OverrideMap) : emptyMap()
  } catch {
    return emptyMap()
  }
}

function writeMap(m: OverrideMap) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {}
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// ── Seed lookup ────────────────────────────────────────────────────────────

// Direct lookup against the immutable MOCK_ITEMS partner records. Returns
// undefined for non-partners and unknown ids.
function getSeedPartnerById(id: string): ContentItem | undefined {
  const item = MOCK_ITEMS.find((i) => i.id === id)
  if (!item || item.type !== 'partner') return undefined
  return item
}

// ── Read API ───────────────────────────────────────────────────────────────

export function getPartnerOverride(id: string): PartnerOverride | undefined {
  return readMap()[id]
}

// Migration-safe normalizer for stored listings. Sessions persist across
// type-shape changes, so a v1 listing (with `imageUrl?: string`, no `images`)
// can land here. Coerce to the v2 shape on read so consumers never see an
// undefined `images` field. Cheap and defensive.
function normalizeListing(raw: unknown): MarketplaceListing {
  const l = (raw ?? {}) as Partial<MarketplaceListing> & { imageUrl?: string }
  const images = Array.isArray(l.images)
    ? l.images
    : typeof l.imageUrl === 'string' && l.imageUrl
      ? [l.imageUrl]
      : []
  return { ...(l as MarketplaceListing), images }
}

function applyOverride(seed: ContentItem, ov: PartnerOverride): ContentItem {
  const next: ContentItem = { ...seed }
  if (ov.marketplaceEnabled !== undefined)
    next.marketplaceEnabled = ov.marketplaceEnabled
  if (ov.marketplaceDescription !== undefined)
    next.marketplaceDescription = ov.marketplaceDescription
  if (ov.marketplaceLocation !== undefined)
    next.marketplaceLocation = ov.marketplaceLocation
  if (ov.marketplaceCurrency !== undefined)
    next.marketplaceCurrency = ov.marketplaceCurrency
  if (ov.marketplaceListings !== undefined)
    next.marketplaceListings = ov.marketplaceListings.map(normalizeListing)
  return next
}

export function getResolvedPartnerById(id: string): ContentItem | undefined {
  const seed = getSeedPartnerById(id)
  if (!seed) return undefined
  const ov = readMap()[id]
  if (!ov) return seed
  return applyOverride(seed, ov)
}

// All partners (resolved). Use this when listing partners — it's the live
// view including session edits.
export function listResolvedPartners(): ContentItem[] {
  const ov = readMap()
  return MOCK_ITEMS.filter((i) => i.type === 'partner').map((p) =>
    ov[p.id] ? applyOverride(p, ov[p.id]) : p,
  )
}

// All partners that currently have marketplace enabled (after override
// resolution). Drives the public `/marketplace` route + home rail.
export function listMarketplaceEnabledPartners(): ContentItem[] {
  return listResolvedPartners().filter((p) => p.marketplaceEnabled)
}

// ── Write API ──────────────────────────────────────────────────────────────

// Generic patch-merge writer. For the convenience writers below, prefer
// those — they handle listings array edits in a single call.
export function setPartnerOverride(id: string, patch: PartnerOverride) {
  if (!getSeedPartnerById(id)) return
  const m = readMap()
  const prev = m[id] ?? {}
  const next: PartnerOverride = { ...prev }
  if (patch.marketplaceEnabled !== undefined)
    next.marketplaceEnabled = patch.marketplaceEnabled
  if (patch.marketplaceDescription !== undefined)
    next.marketplaceDescription = patch.marketplaceDescription
  if (patch.marketplaceLocation !== undefined)
    next.marketplaceLocation = patch.marketplaceLocation
  if (patch.marketplaceCurrency !== undefined)
    next.marketplaceCurrency = patch.marketplaceCurrency
  if (patch.marketplaceListings !== undefined)
    next.marketplaceListings = patch.marketplaceListings
  // Noop-collapse against seed — keeps storage tidy.
  const seed = getSeedPartnerById(id)!
  const isNoop =
    (next.marketplaceEnabled === undefined ||
      (next.marketplaceEnabled ?? false) === (seed.marketplaceEnabled ?? false)) &&
    (next.marketplaceDescription === undefined ||
      next.marketplaceDescription === (seed.marketplaceDescription ?? undefined)) &&
    (next.marketplaceLocation === undefined ||
      next.marketplaceLocation === (seed.marketplaceLocation ?? undefined)) &&
    (next.marketplaceCurrency === undefined ||
      next.marketplaceCurrency === (seed.marketplaceCurrency ?? undefined)) &&
    next.marketplaceListings === undefined
  if (isNoop) {
    delete m[id]
  } else {
    m[id] = next
  }
  writeMap(m)
  notify()
}

export function clearPartnerOverride(id: string) {
  const m = readMap()
  if (!(id in m)) return
  delete m[id]
  writeMap(m)
  notify()
}

// ── Convenience writers — listing CRUD ─────────────────────────────────────
//
// All operate on the resolved `marketplaceListings` array (seed + override
// merged), then write the full new array back through setPartnerOverride.

function getCurrentListings(id: string): MarketplaceListing[] {
  const partner = getResolvedPartnerById(id)
  return partner?.marketplaceListings ?? []
}

export function setMarketplaceEnabled(id: string, enabled: boolean) {
  setPartnerOverride(id, { marketplaceEnabled: enabled })
}

export function addMarketplaceListing(id: string, listing: MarketplaceListing) {
  const next = [...getCurrentListings(id), listing]
  setPartnerOverride(id, { marketplaceListings: next })
}

export function updateMarketplaceListing(
  id: string,
  listingId: string,
  patch: Partial<MarketplaceListing>,
) {
  const next = getCurrentListings(id).map((l) =>
    l.id === listingId ? { ...l, ...patch } : l,
  )
  setPartnerOverride(id, { marketplaceListings: next })
}

export function removeMarketplaceListing(id: string, listingId: string) {
  const next = getCurrentListings(id).filter((l) => l.id !== listingId)
  setPartnerOverride(id, { marketplaceListings: next })
}

// New listing id — session-prefixed so it never collides with seed ids.
export function newListingId(partnerId: string): string {
  return `mkl-session-${partnerId.replace(/^pa-/, '')}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

// ── React hooks ────────────────────────────────────────────────────────────
//
// SSR-safe derivation: first render returns the *seed* view (no storage
// access — matches what the server emits), then the post-mount effect flips
// `mounted` and the next render returns the override-resolved view. Without
// this gate, a session with overrides would diverge from the server-rendered
// HTML and trip a Next.js hydration mismatch. Listener bumps a tick to force
// re-render on later override changes.

function seedPartners(): ContentItem[] {
  return MOCK_ITEMS.filter((i) => i.type === 'partner')
}

function seedPartnerById(id: string): ContentItem | undefined {
  return getSeedPartnerById(id)
}

export function useResolvedPartner(
  id: string | null | undefined,
): ContentItem | undefined {
  const [mounted, setMounted] = useState(false)
  const [, forceTick] = useState(0)
  useEffect(() => {
    setMounted(true)
    const refresh = () => forceTick((t) => t + 1)
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  if (!id) return undefined
  if (!mounted) return seedPartnerById(id)
  return getResolvedPartnerById(id)
}

export function useResolvedPartners(): ContentItem[] {
  const [mounted, setMounted] = useState(false)
  const [, forceTick] = useState(0)
  useEffect(() => {
    setMounted(true)
    const refresh = () => forceTick((t) => t + 1)
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  if (!mounted) return seedPartners()
  return listResolvedPartners()
}

export function useMarketplaceEnabledPartners(): ContentItem[] {
  const [mounted, setMounted] = useState(false)
  const [, forceTick] = useState(0)
  useEffect(() => {
    setMounted(true)
    const refresh = () => forceTick((t) => t + 1)
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  if (!mounted) return seedPartners().filter((p) => p.marketplaceEnabled)
  return listMarketplaceEnabledPartners()
}
