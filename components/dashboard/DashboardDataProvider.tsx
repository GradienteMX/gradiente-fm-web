'use client'

// ── DashboardDataProvider — the single hoisted data layer (FINAL_SPEC §3.10) ─
//
// EVERYTHING the dashboard renders flows through this provider. Widgets
// consume context slices only — no widget fetches, subscribes to Supabase,
// or opens a channel itself (reviewers reject any widget calling
// useSavedItems/useSavedComments/useComments/useForo or opening a realtime
// channel of its own).
//
// Slice/cadence contract (§3.10, verbatim):
//   saves          ONE useSavedItems (itemSavesCache-reactive)
//   savedComments  ONE useSavedComments (lib/hooks)
//   drafts         useDraftItems (cache-reactive)
//   published      useMyPublishedItems(uid) — keeps publishedItemsCache primed
//   engagement     GET /api/users/me/engagement — ONE 60s interval + focus
//   trophies       useMyTrophies (module cache)
//   activity       lib/dashboard/activity.ts — 60s poll + focus
//   novedades      one browser query (fetchNovedadesPool) — shares the 60s tick
//   events         one browser query (published eventos, date ≥ today) — mount + focus
//   vibeSelf       own vibe_checks rows — mount (RLS probe VALIDATED, WP0-C)
//   franja        GET /api/franjas/[id] + /inbox — mount + focus, ≥5-MIN FLOOR
//
// Realtime: NONE in v1 — polling is the honest register (the colophon prints
// the true lastTickAt). A single optional `dashboard:activity` channel
// (foro:all-style bus) is documented as v1.1; per-widget channels never.
//
// Every fetched ContentItem is recordItems()-primed into lib/itemsCache so
// overlays resolve in place (§3.11). Widgets finish mutations with
// `afterMutation()` — revalidate + router.refresh(), the one recipe.
//
// Layout boot (§2.4): localStorage mirror paints instantly; the server's
// profile_meta.dashboard reconciles on top (server wins) unless the user
// already touched the layout this session. `commitLayout` is the ONE write
// path: state → mirror → updateDashboardMeta (serialized queue).
//
// Lab boundary: the optional `initialSlices` prop is consumed ONLY by
// the lab harness — fixture mode disables every network cadence and this
// module never imports from the lab tree or the mock seed (grep gate).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { createClient } from '@/lib/supabase/client'
import { recordItems } from '@/lib/itemsCache'
import { getSavedItemEntries } from '@/lib/itemSavesCache'
import { useSavedItems } from '@/lib/hooks/useSavedItems'
import { useSavedComments, type UseSavedCommentsResult } from '@/lib/hooks/useSavedComments'
import { useMyPublishedItems } from '@/lib/hooks/useMyPublishedItems'
import { useMyTrophies } from '@/lib/hooks/useMyTrophies'
import { useDraftItems, type DraftItem } from '@/lib/drafts'
import {
  fetchActivity,
  fetchOfertaActivity,
  mergeActivityRows,
  type ActivityRow,
} from '@/lib/dashboard/activity'
import {
  fetchNovedadesPool,
  fetchFranjaOptions,
  filterByFollows,
  type FranjaOption,
} from '@/lib/dashboard/novedades'
import { ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import { readFollows, subscribeFollows, type DashboardFollow } from '@/lib/dashboard/localState'
import {
  readLocalDashboardLayout,
  updateDashboardMeta,
  writeLocalDashboardLayout,
} from '@/lib/dashboard/profileMeta'
import {
  ALL_WIDGET_IDS,
  defaultLayoutMeta,
  normalizeLayoutMeta,
  type DashboardLayoutMeta,
  type WidgetId,
} from '@/lib/dashboard/layout'
import { resolveVenueGeo } from '@/lib/dashboard/venueGeo'
import { canAssignRoles } from '@/lib/permissions'
import type { ContentItem, MarketplaceListing } from '@/lib/types'

// ── Cadence constants ───────────────────────────────────────────────────────

const HEARTBEAT_MS = 60_000
const EMPTY_ERRORS: Readonly<Partial<Record<DashboardSliceKey, true>>> = Object.freeze({})
// Focus revalidation dedupe — rapid alt-tabbing never storms the backend.
const FOCUS_FLOOR_MS = 10_000
// The inbox route loads every comment per call — hard ≥5-min floor (§3.9).
const FRANJA_FLOOR_MS = 5 * 60_000
const EVENTS_LIMIT = 60

// ── Slice types ─────────────────────────────────────────────────────────────

export type SavedCommentsSlice = UseSavedCommentsResult

export interface EngagementSlice {
  hp: number
  lastUpdatedAt: string | null
}

// One own `vibe_checks` row (§3.8 VIBE PERSONAL — ships per WP0-C probe).
export interface VibeSelfCheck {
  itemId: string
  vibeMin: number
  vibeMax: number
  createdAt: string
  updatedAt: string
}

// GET /api/franjas/[id] (+ /inbox) mapped to camelCase. Mirrors the
// MiFranjaSection mappers — keep in sync with lib/data/items.ts
// rowToMarketplaceListing (server twin).
export interface FranjaSlice {
  id: string
  slug: string
  title: string
  franjaKind: string | null
  franjaUrl: string | null
  imageUrl: string
  marketplaceEnabled: boolean
  marketplaceDescription: string | null
  marketplaceLocation: string | null
  marketplaceCurrency: string | null
  listings: MarketplaceListing[]
  // The inbox route's real unanswered-buyer computation — the OFERTA badges.
  unansweredListingIds: readonly string[]
}

export type DashboardSliceKey =
  | 'saves'
  | 'savedComments'
  | 'drafts'
  | 'published'
  | 'engagement'
  | 'trophies'
  | 'activity'
  | 'novedades'
  | 'events'
  | 'vibeSelf'
  | 'franja'

// afterMutation scopes: 'all' re-runs heartbeat + events + vibeSelf (+franja,
// floor bypassed — an explicit user action is not a poll); 'franja' re-runs
// only the franja slice + its OFERTA fold-in.
export type DashboardMutationScope = 'all' | 'franja'

// ── Lab boundary (fixtures inject HERE and only here) ───────────────────────

export interface DashboardInitialSlices {
  saves?: ContentItem[]
  savedComments?: SavedCommentsSlice
  drafts?: DraftItem[]
  published?: ContentItem[]
  engagement?: EngagementSlice | null
  trophies?: readonly string[]
  activity?: ActivityRow[]
  novedades?: ContentItem[]
  franjaOptions?: FranjaOption[]
  events?: ContentItem[]
  vibeSelf?: VibeSelfCheck[]
  franja?: FranjaSlice | null
  follows?: DashboardFollow[]
  // Registry override (e.g. franja/admin scenarios include 'mercado').
  registry?: readonly WidgetId[]
  // Failed-slice scenario: flagged slices report error and never load.
  errors?: Partial<Record<DashboardSliceKey, true>>
  lastTickAt?: string | null
}

// ── Context shape ───────────────────────────────────────────────────────────

export interface DashboardData {
  // Slices (§3.10 table order)
  saves: ContentItem[]
  savedComments: SavedCommentsSlice
  drafts: DraftItem[]
  published: ContentItem[]
  engagement: EngagementSlice | null
  trophies: ReadonlySet<string>
  // Merged reverse-chron inbox incl. the franja-team OFERTA fold-in.
  activity: ActivityRow[]
  // The global pool — widgets apply filterByFollows (mechanical lens only).
  novedades: ContentItem[]
  franjaOptions: FranjaOption[]
  events: ContentItem[]
  vibeSelf: VibeSelfCheck[]
  franja: FranjaSlice | null

  // Follows, provider-hosted so lab fixtures flow through the one boundary.
  // Widgets WRITE via lib/dashboard/localState (addFollow/removeFollow);
  // this mirror updates through its subscription.
  follows: DashboardFollow[]

  // User-scoped widget registry (§3.9: no 'mercado' for non-franja,
  // non-admin users — the widget does not exist in their registry).
  registry: readonly WidgetId[]

  // Layout (§2.4): mirror-first boot, server reconcile, single write path.
  layoutMeta: DashboardLayoutMeta
  layoutReady: boolean
  commitLayout: (next: DashboardLayoutMeta) => void

  // Data-aware boot (§2.5): feed to applyCompactModes. false = loaded and
  // empty (→ compact); true = has data; undefined = not yet known.
  dataPresence: Partial<Record<WidgetId, boolean>>
  // Per-slice fetch settlement (loading shimmer vs honest empty state).
  loaded: Readonly<Partial<Record<DashboardSliceKey, boolean>>>
  // Per-slice failure flags — widgets render honest errors, never fake data.
  errors: Readonly<Partial<Record<DashboardSliceKey, true>>>

  // ISO of the last fully-successful heartbeat — the colophon's
  // «ÚLTIMA ACTUALIZACIÓN» value. Never fabricated.
  lastTickAt: string | null

  // §3.7: MAPA may auto-expand only when ≥4 geocodable upcoming events exist.
  mapaAutoExpandEligible: boolean

  // The one post-mutation recipe: revalidate affected slices, then
  // router.refresh(). Every widget mutation ends with this (§3.10).
  afterMutation: (scope?: DashboardMutationScope) => Promise<void>
}

const DashboardDataContext = createContext<DashboardData | null>(null)

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error('useDashboardData must be used inside <DashboardDataProvider>')
  }
  return ctx
}

// ── Fetchers (provider-owned; lib queries live in lib/dashboard/*) ──────────

async function fetchEngagement(): Promise<EngagementSlice> {
  const res = await fetch('/api/users/me/engagement')
  if (!res.ok) throw new Error(`engagement ${res.status}`)
  const body = (await res.json()) as {
    engagement_hp?: number
    engagement_hp_last_updated_at?: string | null
  }
  return {
    hp: Number(body.engagement_hp ?? 0),
    lastUpdatedAt: body.engagement_hp_last_updated_at ?? null,
  }
}

// Upcoming events — the provider's ONE browser query for AGENDA + MAPA.
// Never getAllItemsSync (cold cache on direct /dashboard loads).
async function fetchUpcomingEvents(): Promise<ContentItem[]> {
  const supabase = createClient()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_ROW_SELECT)
    .eq('published', true)
    .eq('type', 'evento')
    .gte('date', startOfToday.toISOString())
    .order('date', { ascending: true })
    .limit(EVENTS_LIMIT)
  if (error) throw error
  return ((data ?? []) as any[]).map(mapItemRowToContentItem)
}

async function fetchVibeSelf(uid: string): Promise<VibeSelfCheck[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vibe_checks')
    .select('item_id, vibe_min, vibe_max, created_at, updated_at')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
  if (error) throw error
  type Row = {
    item_id: string
    vibe_min: number
    vibe_max: number
    created_at: string
    updated_at: string
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    itemId: r.item_id,
    vibeMin: r.vibe_min,
    vibeMax: r.vibe_max,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

// Browser twin of MiFranjaSection's mapListingRow (which is file-private).
// Keep in sync with lib/data/items.ts rowToMarketplaceListing.
function mapListingRow(row: Record<string, unknown>): MarketplaceListing {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    category: row.category as MarketplaceListing['category'],
    subcategory: (row.subcategory as string | null) ?? undefined,
    price: Number(row.price ?? 0),
    condition: row.condition as MarketplaceListing['condition'],
    status: row.status as MarketplaceListing['status'],
    description: (row.description as string | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    shippingMode: (row.shipping_mode as MarketplaceListing['shippingMode']) ?? undefined,
    images: (row.images as string[] | null) ?? [],
    embeds: (row.embeds as MarketplaceListing['embeds']) ?? undefined,
    saleUrl: (row.sale_url as string | null) ?? undefined,
    whatsapp: (row.whatsapp as string | null) ?? undefined,
    email: (row.contact_email as string | null) ?? undefined,
    relatedLinks: Array.isArray(row.related_links)
      ? (row.related_links as MarketplaceListing['relatedLinks'])
      : undefined,
    views: typeof row.views === 'number' ? row.views : 0,
    publishedAt: String(row.published_at ?? ''),
  }
}

async function fetchFranjaSlice(franjaId: string): Promise<FranjaSlice> {
  const encoded = encodeURIComponent(franjaId)
  const [pRes, iRes] = await Promise.all([
    fetch(`/api/franjas/${encoded}`),
    fetch(`/api/franjas/${encoded}/inbox`),
  ])
  if (!pRes.ok) throw new Error(`franja ${pRes.status}`)
  const pJson = (await pRes.json()) as { franja: Record<string, unknown> }
  const row = pJson.franja
  // Inbox failure degrades to zero badges (honest absence, not a dead slice).
  let unanswered: string[] = []
  if (iRes.ok) {
    const iJson = (await iRes.json()) as { unanswered?: string[] }
    unanswered = Array.isArray(iJson.unanswered) ? iJson.unanswered : []
  }
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    franjaKind: (row.franja_kind as string | null) ?? null,
    franjaUrl: (row.franja_url as string | null) ?? null,
    imageUrl: String(row.image_url ?? ''),
    marketplaceEnabled: !!row.marketplace_enabled,
    marketplaceDescription: (row.marketplace_description as string | null) ?? null,
    marketplaceLocation: (row.marketplace_location as string | null) ?? null,
    marketplaceCurrency: (row.marketplace_currency as string | null) ?? null,
    listings: Array.isArray(row.marketplace_listings)
      ? (row.marketplace_listings as Record<string, unknown>[]).map(mapListingRow)
      : [],
    unansweredListingIds: unanswered,
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

export function DashboardDataProvider({
  children,
  initialSlices,
}: {
  children: ReactNode
  // LAB ONLY (app/lab/dashboard/**). When present the provider is inert:
  // zero network cadences, slices come verbatim from the fixture.
  initialSlices?: DashboardInitialSlices
}) {
  const router = useRouter()
  const { currentUser, authResolved } = useAuth()
  const fixtureMode = initialSlices !== undefined
  const uid = fixtureMode ? null : currentUser?.id ?? null
  const franjaId = fixtureMode ? null : currentUser?.franjaId ?? null

  // Single consumers of the cache-reactive hooks (§3.10). Called
  // unconditionally (hooks rule); ignored in fixture mode — with no auth in
  // the lab the caches are empty and none of them issues a request.
  const savesHook = useSavedItems()
  const savedCommentsHook = useSavedComments()
  const draftsHook = useDraftItems()
  const publishedHook = useMyPublishedItems(uid)
  const trophiesHook = useMyTrophies()

  // Polled / mount-cadence slices.
  const [engagement, setEngagement] = useState<EngagementSlice | null>(null)
  const [activityBase, setActivityBase] = useState<ActivityRow[]>([])
  const [ofertaRows, setOfertaRows] = useState<ActivityRow[]>([])
  const [novedadesPool, setNovedadesPool] = useState<ContentItem[]>([])
  const [franjaOptions, setFranjaOptions] = useState<FranjaOption[]>([])
  const [events, setEvents] = useState<ContentItem[]>([])
  const [vibeSelf, setVibeSelf] = useState<VibeSelfCheck[]>([])
  const [franja, setFranja] = useState<FranjaSlice | null>(null)
  const [lastTickAt, setLastTickAt] = useState<string | null>(null)
  const [fetchLoaded, setFetchLoaded] = useState<Partial<Record<DashboardSliceKey, boolean>>>({})
  const [fetchErrors, setFetchErrors] = useState<Partial<Record<DashboardSliceKey, true>>>({})

  // Follows mirror (localStorage-backed; fixture-injected in the lab).
  const [localFollows, setLocalFollows] = useState<DashboardFollow[]>([])
  useEffect(() => {
    if (fixtureMode || !uid) {
      setLocalFollows([])
      return
    }
    setLocalFollows(readFollows(uid))
    return subscribeFollows(() => setLocalFollows(readFollows(uid)))
  }, [fixtureMode, uid])

  const markSlice = useCallback((key: DashboardSliceKey, ok: boolean) => {
    if (ok) {
      setFetchLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
      setFetchErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      setFetchErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    }
  }, [])

  // ── Registry (§3.9) ───────────────────────────────────────────────────────
  const isMercadoUser = !!currentUser?.franjaId || canAssignRoles(currentUser)
  const registry = useMemo<readonly WidgetId[]>(() => {
    if (fixtureMode) {
      return (
        initialSlices?.registry ??
        ALL_WIDGET_IDS.filter((id) => id !== 'mercado' || initialSlices?.franja != null)
      )
    }
    return ALL_WIDGET_IDS.filter((id) => id !== 'mercado' || isMercadoUser)
  }, [fixtureMode, initialSlices, isMercadoUser])

  // ── Layout boot + single write path (§2.4) ────────────────────────────────
  const [layoutMeta, setLayoutMeta] = useState<DashboardLayoutMeta>(() =>
    defaultLayoutMeta(registry),
  )
  const [layoutReady, setLayoutReady] = useState(false)
  // Once the user commits a layout this session, the boot reconcile must not
  // clobber the fresher gesture with a stale server read.
  const layoutTouchedRef = useRef(false)

  useEffect(() => {
    if (fixtureMode) {
      setLayoutMeta(defaultLayoutMeta(registry))
      setLayoutReady(true)
      return
    }
    if (!authResolved) return
    if (!uid) {
      setLayoutMeta(defaultLayoutMeta(registry))
      setLayoutReady(true)
      return
    }
    let cancelled = false
    // 1. Mirror paints instantly (normalize handles unknown/garbage → defaults).
    setLayoutMeta(normalizeLayoutMeta(readLocalDashboardLayout(uid), registry))
    setLayoutReady(true)
    // 2. Server reconcile — profile_meta is the source of truth across
    //    devices; when it carries a dashboard namespace it wins (and refreshes
    //    the mirror), unless a gesture already happened this session.
    const supabase = createClient()
    void supabase
      .from('users')
      .select('profile_meta')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || layoutTouchedRef.current) return
        const meta = (data as { profile_meta?: Record<string, unknown> | null } | null)
          ?.profile_meta
        const remote = meta && typeof meta === 'object' ? meta.dashboard : undefined
        if (remote === undefined || remote === null) return
        const normalized = normalizeLayoutMeta(remote, registry)
        setLayoutMeta(normalized)
        writeLocalDashboardLayout(uid, normalized)
      })
    return () => {
      cancelled = true
    }
  }, [fixtureMode, authResolved, uid, registry])

  const commitLayout = useCallback(
    (next: DashboardLayoutMeta) => {
      const normalized = normalizeLayoutMeta(next, registry)
      layoutTouchedRef.current = true
      setLayoutMeta(normalized)
      if (fixtureMode || !uid) return
      // Mirror first (§2.4), then the serialized PATCH queue. One call per
      // completed gesture — profileMeta coalesces bursts into ≤2 requests.
      writeLocalDashboardLayout(uid, normalized)
      void updateDashboardMeta({
        v: normalized.v,
        layout: normalized.layout,
        hidden: normalized.hidden,
        mobileOrder: normalized.mobileOrder,
      })
    },
    [fixtureMode, uid, registry],
  )

  // ── The one boot sequence + ONE 60s heartbeat + focus revalidate ──────────
  const revalidateRef = useRef<((scope: DashboardMutationScope) => Promise<void>) | null>(null)

  useEffect(() => {
    if (fixtureMode || !authResolved || !uid) return
    let cancelled = false
    let heartbeatInFlight = false
    let lastHeartbeatMs = 0
    let lastFranjaMs = 0

    // engagement + activity + novedades share the single 60s tick.
    async function runHeartbeat(): Promise<void> {
      if (cancelled || heartbeatInFlight) return
      heartbeatInFlight = true
      lastHeartbeatMs = Date.now()
      const [engRes, actRes, novRes] = await Promise.allSettled([
        fetchEngagement(),
        fetchActivity(uid as string),
        fetchNovedadesPool(),
      ])
      heartbeatInFlight = false
      if (cancelled) return
      if (engRes.status === 'fulfilled') setEngagement(engRes.value)
      markSlice('engagement', engRes.status === 'fulfilled')
      if (actRes.status === 'fulfilled') setActivityBase(actRes.value)
      markSlice('activity', actRes.status === 'fulfilled')
      // fetchNovedadesPool swallows query errors into [] by contract.
      if (novRes.status === 'fulfilled') setNovedadesPool(novRes.value)
      markSlice('novedades', novRes.status === 'fulfilled')
      if (
        engRes.status === 'fulfilled' &&
        actRes.status === 'fulfilled' &&
        novRes.status === 'fulfilled'
      ) {
        setLastTickAt(new Date().toISOString())
      }
    }

    async function runEvents(): Promise<void> {
      try {
        const rows = await fetchUpcomingEvents()
        if (cancelled) return
        setEvents(rows)
        markSlice('events', true)
      } catch {
        if (!cancelled) markSlice('events', false)
      }
    }

    async function runVibeSelf(): Promise<void> {
      try {
        const rows = await fetchVibeSelf(uid as string)
        if (cancelled) return
        setVibeSelf(rows)
        markSlice('vibeSelf', true)
      } catch {
        if (!cancelled) markSlice('vibeSelf', false)
      }
    }

    async function runFranjaOptions(): Promise<void> {
      const options = await fetchFranjaOptions()
      if (!cancelled) setFranjaOptions(options)
    }

    // Franja + its OFERTA activity fold-in, on the same ≥5-min-floored
    // cadence (the inbox route loads every comment per call).
    async function runFranja(force: boolean): Promise<void> {
      if (!franjaId) return
      const now = Date.now()
      if (!force && now - lastFranjaMs < FRANJA_FLOOR_MS) return
      lastFranjaMs = now
      try {
        const slice = await fetchFranjaSlice(franjaId)
        if (cancelled) return
        setFranja(slice)
        markSlice('franja', true)
        const titleById = new Map(slice.listings.map((l) => [l.id, l.title]))
        const rows = await fetchOfertaActivity(slice.unansweredListingIds, titleById)
        if (!cancelled) setOfertaRows(rows)
      } catch {
        if (!cancelled) markSlice('franja', false)
      }
    }

    // Boot — exactly one sequence (DevTools-auditable).
    void runHeartbeat()
    void runEvents()
    void runVibeSelf()
    void runFranjaOptions()
    void runFranja(true)

    const interval = window.setInterval(() => void runHeartbeat(), HEARTBEAT_MS)

    const onFocus = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      if (Date.now() - lastHeartbeatMs < FOCUS_FLOOR_MS) return
      void runHeartbeat()
      void runEvents()
      void runFranja(false) // own 5-min floor
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    revalidateRef.current = async (scope) => {
      if (scope === 'franja') {
        await runFranja(true)
        return
      }
      await Promise.all([runHeartbeat(), runEvents(), runVibeSelf(), runFranja(true)])
    }

    return () => {
      cancelled = true
      revalidateRef.current = null
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fixtureMode, authResolved, uid, franjaId, markSlice])

  const afterMutation = useCallback(
    async (scope: DashboardMutationScope = 'all') => {
      const revalidate = revalidateRef.current
      if (revalidate) await revalidate(scope)
      router.refresh()
    },
    [router],
  )

  // ── Resolve slices (fixture values win at the lab boundary) ───────────────
  const fx = initialSlices
  const saves = fx ? fx.saves ?? [] : savesHook
  const savedComments: SavedCommentsSlice = fx
    ? fx.savedComments ?? { comments: [], itemsById: new Map(), loading: false }
    : savedCommentsHook
  const drafts = fx ? fx.drafts ?? [] : draftsHook
  const published = fx ? fx.published ?? [] : publishedHook
  const trophies: ReadonlySet<string> = useMemo(
    () => (fx ? new Set(fx.trophies ?? []) : trophiesHook),
    [fx, trophiesHook],
  )
  const engagementSlice = fx ? fx.engagement ?? null : engagement
  const activity = useMemo(
    () => (fx ? fx.activity ?? [] : mergeActivityRows(activityBase, ofertaRows)),
    [fx, activityBase, ofertaRows],
  )
  const novedades = fx ? fx.novedades ?? [] : novedadesPool
  const franjaOptionsSlice = fx ? fx.franjaOptions ?? [] : franjaOptions
  const eventsSlice = fx ? fx.events ?? [] : events
  const vibeSelfSlice = fx ? fx.vibeSelf ?? [] : vibeSelf
  const franjaSlice = fx ? fx.franja ?? null : franja
  const follows = fx ? fx.follows ?? [] : localFollows
  const bootIsoRef = useRef(new Date().toISOString())
  const lastTick = fx ? fx.lastTickAt ?? bootIsoRef.current : lastTickAt

  // ── recordItems() priming (§3.10/§3.11 — overlays resolve in place) ───────
  useEffect(() => recordItems(saves), [saves])
  useEffect(() => recordItems(published), [published])
  useEffect(() => recordItems(novedades), [novedades])
  useEffect(() => recordItems(eventsSlice), [eventsSlice])
  useEffect(
    () => recordItems(Array.from(savedComments.itemsById.values())),
    [savedComments.itemsById],
  )

  // ── loaded flags ──────────────────────────────────────────────────────────
  // Hook-backed slices piggyback on the authResolved caches (AuthProvider
  // seeds itemSavesCache/draftsCache before authResolved flips); fetch-backed
  // slices settle through markSlice.
  const savedIdCount = getSavedItemEntries().size
  const loaded: Partial<Record<DashboardSliceKey, boolean>> = useMemo(() => {
    if (fx) {
      const all: Partial<Record<DashboardSliceKey, boolean>> = {}
      const keys: DashboardSliceKey[] = [
        'saves',
        'savedComments',
        'drafts',
        'published',
        'engagement',
        'trophies',
        'activity',
        'novedades',
        'events',
        'vibeSelf',
        'franja',
      ]
      for (const key of keys) all[key] = fx.errors?.[key] ? false : true
      return all
    }
    return {
      ...fetchLoaded,
      saves: authResolved && (savedIdCount === 0 || saves.length > 0),
      savedComments: authResolved && !savedComments.loading,
      drafts: authResolved,
      published: authResolved,
      trophies: authResolved,
    }
  }, [fx, fetchLoaded, authResolved, savedIdCount, saves.length, savedComments.loading])

  const errors = fx ? fx.errors ?? EMPTY_ERRORS : fetchErrors

  // ── dataPresence (§2.5 data-aware boot → applyCompactModes) ───────────────
  const dataPresence: Partial<Record<WidgetId, boolean>> = useMemo(() => {
    const present = (isLoaded: boolean | undefined, has: boolean): boolean | undefined =>
      isLoaded ? has : has ? true : undefined
    const followedNow = filterByFollows(novedades, follows)
    return {
      // CREAR is neverCompact (chips are unconditional content); CULTIVAR is
      // the publications carousel — drafts moved to CREAR's popup.
      cultivar: present(loaded.published, published.length > 0),
      actividad: present(loaded.activity, activity.length > 0),
      guardados: present(
        loaded.saves && loaded.savedComments,
        saves.length > 0 || savedComments.comments.length > 0,
      ),
      reproductor: present(
        loaded.saves,
        saves.some((item) => item.type === 'mix'),
      ),
      novedades: present(loaded.novedades, followedNow.length > 0),
      agenda: present(loaded.events, eventsSlice.length > 0),
      mapa: present(loaded.events, eventsSlice.length > 0),
      mercado: franjaSlice ? franjaSlice.listings.length > 0 : undefined,
    }
  }, [
    loaded,
    published,
    activity,
    saves,
    savedComments.comments,
    novedades,
    follows,
    eventsSlice,
    franjaSlice,
  ])

  const mapaAutoExpandEligible = useMemo(
    () =>
      eventsSlice.filter((e) => e.venue && resolveVenueGeo(e.venue) !== null).length >= 4,
    [eventsSlice],
  )

  const value: DashboardData = useMemo(
    () => ({
      saves,
      savedComments,
      drafts,
      published,
      engagement: engagementSlice,
      trophies,
      activity,
      novedades,
      franjaOptions: franjaOptionsSlice,
      events: eventsSlice,
      vibeSelf: vibeSelfSlice,
      franja: franjaSlice,
      follows,
      registry,
      layoutMeta,
      layoutReady,
      commitLayout,
      dataPresence,
      loaded,
      errors,
      lastTickAt: lastTick,
      mapaAutoExpandEligible,
      afterMutation,
    }),
    [
      saves,
      savedComments,
      drafts,
      published,
      engagementSlice,
      trophies,
      activity,
      novedades,
      franjaOptionsSlice,
      eventsSlice,
      vibeSelfSlice,
      franjaSlice,
      follows,
      registry,
      layoutMeta,
      layoutReady,
      commitLayout,
      dataPresence,
      loaded,
      errors,
      lastTick,
      mapaAutoExpandEligible,
      afterMutation,
    ],
  )

  return (
    <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
  )
}
