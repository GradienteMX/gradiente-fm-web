'use client'

// Spatial Identity Canvas — the pannable/zoomable honeycomb viewport.
// One continuous surface: the global terrain and the franja focus state are
// two camera positions over the SAME plane (spec § One continuous surface).
// The camera transform is applied imperatively (ref → style) so pan/zoom
// stays off the React render path; React state receives a throttled mirror
// that drives virtualization and the semantic-zoom band.
//
// Interaction reference: the "screen interface" glass-grid video — an endless
// drifting field of thick slabs, cropped at every edge. Momentum is
// restrained: editorial browsing, not a physics toy.

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import {
  DIR_N,
  DIR_NE,
  DIR_NW,
  DIR_S,
  DIR_SE,
  DIR_SW,
} from '@/lib/mapa/hex'
import {
  compactLayout,
  neighborItemId,
  type CompactArrangement,
  type MapaLayout,
  type FranjaCluster,
} from '@/lib/mapa/layout'
import {
  computeFocusArrangement,
  placeGlobalListings,
  rankRelatedFranjas,
  type FocusArrangement,
} from '@/lib/mapa/focus'
import {
  computeContinentArrangement,
  type ContinentArrangement,
} from '@/lib/mapa/continents'
import { DASH_ACID } from '@/lib/dashboard/palette'
import { recordItems } from '@/lib/itemsCache'
import { useOverlay } from '@/components/overlay/useOverlay'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'
import { SmartImage } from '@/components/SmartImage'
import { KIND_LABEL } from '@/components/overlay/FranjaOverlay'
import { MapaCell } from './MapaCell'
import { MapaFilterColumn } from './MapaFilterColumn'
import { MapaListingCell } from './MapaListingCell'
import { FranjaObi } from './FranjaObi'

// ONE focus grammar, panel variant (fase F). The map's chrome floats on the
// dark void, where an ink outline would be invisible — same 2px/offset-2 ring
// as everywhere else on paper, drawn in panel-text instead.
const FOCUS_ON_PANEL =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

const ZMIN = 0.22
const ZMAX = 1.6
const OBI_WIDTH = 300 // lg+ left strip, px
const OBI_SHEET_RATIO = 0.42 // mobile bottom sheet height fraction

interface Camera {
  cx: number // plane point at viewport center
  cy: number
  z: number
}

// Content types the visibility column manages (per-component map convention).
const LENS_TYPE_LABEL: Record<string, string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
}

interface MapaCanvasProps {
  layout: MapaLayout
  clusters: FranjaCluster[]
  /** EVERY franja identity row — feeds the selector; most have no cluster. */
  franjas: ContentItem[]
  initialFocusSlug: string | null
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function MapaCanvas({
  layout,
  clusters,
  franjas,
  initialFocusSlug,
}: MapaCanvasProps) {
  const { open } = useOverlay()

  const containerRef = useRef<HTMLDivElement>(null)
  const planeRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<Camera>({ cx: 0, cy: 0, z: 0.5 })
  const viewportRef = useRef({ w: 1280, h: 800 })
  const reducedMotionRef = useRef(false)
  const animRef = useRef<number | null>(null)
  const momentumRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const viewSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{
    x: number
    y: number
    vx: number
    vy: number
    t: number
    moved: boolean
  } | null>(null)
  const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(
    null,
  )
  const pendingKeyFocusRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [viewCam, setViewCam] = useState<Camera | null>(null)
  const [focusSlug, setFocusSlug] = useState<string | null>(initialFocusSlug)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(
    layout.placed[0]?.item.id ?? null,
  )
  const zoomingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAppliedZ = useRef<number | null>(null)

  const focusedCluster = useMemo(
    () => clusters.find((c) => c.franja.slug === focusSlug) ?? null,
    [clusters, focusSlug],
  )
  const focusMemberIds = useMemo(
    () => (focusedCluster ? new Set(focusedCluster.itemIds) : null),
    [focusedCluster],
  )

  // Focus reflow arrangements are deterministic per (layout, cluster) —
  // computed once per franja and cached so re-focusing is instant and the
  // delta objects keep a stable identity for cell memoization.
  const arrangementCache = useRef(new Map<string, FocusArrangement>())
  const getArrangement = useCallback(
    (cluster: FranjaCluster): FocusArrangement => {
      const hit = arrangementCache.current.get(cluster.franja.slug)
      if (hit) return hit
      const arr = computeFocusArrangement(
        layout,
        cluster,
        cluster.franja.marketplaceEnabled
          ? cluster.franja.marketplaceListings ?? []
          : [],
      )
      arrangementCache.current.set(cluster.franja.slug, arr)
      return arr
    },
    [layout],
  )
  const focusArrangement = focusedCluster ? getArrangement(focusedCluster) : null

  // ── Category visibility toggles (rule 11 — exclusion model) ───────────────
  // Every category is visible by default; the right-edge hex column
  // deactivates types/eras. Hidden cells fade in place — nothing moves.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const hiddenItemIds = useMemo(() => {
    if (hidden.size === 0) return null
    const out = new Set<string>()
    for (const p of layout.placed) {
      const isArchive = p.item.source === 'archive:wayback'
      if (
        hidden.has(p.item.type) ||
        (isArchive && hidden.has('era:archivo')) ||
        (!isArchive && hidden.has('era:ahora'))
      ) {
        out.add(p.item.id)
      }
    }
    return out
  }, [hidden, layout])
  const toggleHidden = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      const url = new URL(window.location.href)
      if (next.size > 0) {
        url.searchParams.set('ocultar', [...next].sort().join(','))
      } else {
        url.searchParams.delete('ocultar')
      }
      window.history.replaceState(window.history.state, '', url.toString())
      return next
    })
  }, [])

  // AFINIDAD continent mode (opt-in): the terrain's affinity structure
  // breathes — high-affinity regions ring up as continents and ocean opens
  // between the masses. Nothing hides; everything drifts rigidly. Computed
  // once per layout (deterministic) and cached; suspended while a franja
  // focus owns the geometry.
  const [affinityOn, setAffinityOn] = useState(false)
  const continentCache = useRef<{
    layout: MapaLayout
    arr: ContinentArrangement | null
  } | null>(null)
  const continentArrangement = useMemo(() => {
    if (!affinityOn || focusArrangement) return null
    if (continentCache.current?.layout !== layout) {
      continentCache.current = {
        layout,
        arr: computeContinentArrangement(layout),
      }
    }
    return continentCache.current.arr
  }, [affinityOn, focusArrangement, layout])

  // Positional restructuring: with categories hidden, the visible terrain
  // re-tessellates through the same placement rules — the map as if those
  // categories never existed. Cached per hidden-combination; suspended while
  // a franja focus or the continent drift owns the geometry (hidden cells
  // then fade in place inside their continents).
  const compactCache = useRef(new Map<string, CompactArrangement | null>())
  const compactArrangement = useMemo(() => {
    if (!hiddenItemIds || focusArrangement || continentArrangement) return null
    const key = [...hidden].sort().join(',')
    if (compactCache.current.has(key)) {
      return compactCache.current.get(key) ?? null
    }
    const arr = compactLayout(layout, hiddenItemIds)
    compactCache.current.set(key, arr)
    return arr
  }, [continentArrangement, focusArrangement, hidden, hiddenItemIds, layout])

  // One geometry driver at a time:
  // focus reflow > affinity continents > filter compaction > global.
  const moveDeltas =
    focusArrangement?.deltas ??
    continentArrangement?.deltas ??
    compactArrangement?.deltas
  // Keyboard traversal follows whichever geometry is live.
  const navLayout =
    focusArrangement?.derived ??
    continentArrangement?.derived ??
    compactArrangement?.derived ??
    layout
  // The relevance belt: full-color exterior during focus.
  const relatedIds = useMemo(
    () => (focusArrangement ? new Set(focusArrangement.relatedIds) : null),
    [focusArrangement],
  )
  // Affine franjas, most resonant first — the obi carousel order.
  const rankedFranjas = useMemo(
    () =>
      focusedCluster
        ? rankRelatedFranjas(layout, clusters, focusedCluster)
        : [],
    [clusters, focusedCluster, layout],
  )

  // Filter chrome options — types and genre roots actually present on the
  // terrain, with counts (honest chips: nothing listed that matches nothing).
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of layout.placed) {
      counts.set(p.item.type, (counts.get(p.item.type) ?? 0) + 1)
    }
    return [...counts.entries()]
      .filter(([t]) => t in LENS_TYPE_LABEL)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  }, [layout])
  const eraCounts = useMemo<[number, number]>(() => {
    let ahora = 0
    let archivo = 0
    for (const p of layout.placed) {
      if (p.item.source === 'archive:wayback') archivo++
      else ahora++
    }
    return [ahora, archivo]
  }, [layout])
  // Marketplace listings that can materialize on this map (they render as
  // MERCADO nodes inside their franja's focus cluster). Drives the MERCADO
  // kill-switch — honest chip: absent when no clustered franja sells.
  const mercadoCount = useMemo(() => {
    let n = 0
    for (const c of clusters) {
      if (c.franja.marketplaceEnabled) {
        n += c.franja.marketplaceListings?.length ?? 0
      }
    }
    return n
  }, [clusters])
  // The focused franja's member items — the obi derives its contextual
  // per-kind lines (próxima fecha, mercado count…) from the real cluster.
  const focusMemberItems = useMemo(
    () =>
      focusMemberIds
        ? layout.placed
            .filter((p) => focusMemberIds.has(p.item.id))
            .map((p) => p.item)
        : [],
    [focusMemberIds, layout.placed],
  )

  // Franja selector panel + the identities that have no cluster yet.
  const [franjasOpen, setFranjasOpen] = useState(false)
  const inertFranjas = useMemo(() => {
    const clustered = new Set(clusters.map((c) => c.franja.id))
    return [...franjas]
      .filter((p) => !clustered.has(p.id))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [clusters, franjas])

  // Global MERCADO satellites — every marketplace franja's listings placed
  // at the free cells nearest its cluster (see placeGlobalListings). They
  // exist at EVERY view; the focused franja's satellites hand over to the
  // focus arrangement's own listing arc.
  const globalListings = useMemo(
    () => placeGlobalListings(layout, clusters),
    [clusters, layout],
  )

  // Marketplace listing detail — one INDIVIDUAL listing's canonical detail
  // surface (?franja=&listing=), mounted directly over the map (openable
  // from the global satellites too, not only from focus). Closing it
  // returns straight to the map state underneath, never to a grid.
  const [openListingRef, setOpenListingRef] = useState<{
    franjaSlug: string
    listingId: string
  } | null>(null)
  const openListing = useCallback(
    (listing: MarketplaceListing, franjaSlug: string) => {
      const url = new URL(window.location.href)
      url.searchParams.set('franja', franjaSlug)
      url.searchParams.set('listing', listing.id)
      window.history.pushState(window.history.state, '', url.toString())
      setOpenListingRef({ franjaSlug, listingId: listing.id })
    },
    [],
  )
  const closeListing = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('franja')
    url.searchParams.delete('listing')
    window.history.replaceState(window.history.state, '', url.toString())
    setOpenListingRef(null)
  }, [])
  // Resolve the open listing + its 1-based index (publishedAt-desc, the same
  // ordering every marketplace surface uses for its grid badges).
  const openListingEntry = useMemo(() => {
    if (!openListingRef) return null
    const cluster = clusters.find(
      (c) => c.franja.slug === openListingRef.franjaSlug,
    )
    if (!cluster) return null
    const sorted = [...(cluster.franja.marketplaceListings ?? [])].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    const idx = sorted.findIndex((l) => l.id === openListingRef.listingId)
    if (idx < 0) return null
    return { listing: sorted[idx], index: idx + 1, franja: cluster.franja }
  }, [clusters, openListingRef])

  // Warm the overlay slug cache with every map item + ALL franja identity
  // rows, so cell clicks and ?item= deep links resolve through OverlayRouter
  // (same bridge ContentGrid provides on grid pages).
  useEffect(() => {
    recordItems([...layout.placed.map((p) => p.item), ...franjas])
  }, [layout, franjas])

  // Boot ripple delays — center-out, plane-space distance to terrain center,
  // ms-quantized so cell memo props stay stable primitives.
  const enterDelays = useMemo(() => {
    const b = layout.bounds
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const maxR = Math.max(1, Math.hypot(b.width, b.height) / 2)
    const out = new Map<string, number>()
    for (const p of layout.placed) {
      const d = Math.hypot(
        p.bbox.x + p.bbox.width / 2 - cx,
        p.bbox.y + p.bbox.height / 2 - cy,
      )
      out.set(p.item.id, Math.round((d / maxR) * 550) / 1000)
    }
    return out
  }, [layout])

  // ── Camera core ────────────────────────────────────────────────────────────

  // The continent drift expands the terrain — camera clamp and global fit
  // follow whichever bounds are live.
  const activeBounds = continentArrangement?.bounds ?? layout.bounds

  const clampCamera = useCallback(
    (cam: Camera): Camera => {
      const b = activeBounds
      const insetX = Math.min(b.width * 0.12, 320)
      const insetY = Math.min(b.height * 0.12, 320)
      return {
        cx: Math.min(Math.max(cam.cx, b.x + insetX), b.x + b.width - insetX),
        cy: Math.min(Math.max(cam.cy, b.y + insetY), b.y + b.height - insetY),
        z: Math.min(Math.max(cam.z, ZMIN), ZMAX),
      }
    },
    [activeBounds],
  )

  const applyCamera = useCallback(() => {
    const { cx, cy, z } = cameraRef.current
    const { w, h } = viewportRef.current
    const tx = w / 2 - cx * z
    const ty = h / 2 - cy * z
    const plane = planeRef.current
    const container = containerRef.current
    if (plane) {
      plane.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${z.toFixed(4)})`
    }
    if (container) {
      container.dataset.band = z < 0.45 ? 'far' : z < 0.95 ? 'mid' : 'near'
      // Zoom bursts: suspend cell-text transitions while the scale is moving
      // so band flips don't trigger a mass opacity-transition repaint.
      if (lastAppliedZ.current !== null && lastAppliedZ.current !== z) {
        container.classList.add('mapa-zooming')
        if (zoomingTimer.current) clearTimeout(zoomingTimer.current)
        zoomingTimer.current = setTimeout(() => {
          zoomingTimer.current = null
          container.classList.remove('mapa-zooming')
        }, 200)
      }
      lastAppliedZ.current = z
    }
    // Trailing mirror into React state — virtualization + chrome react to the
    // settled camera, not to every pointermove frame.
    if (viewSyncTimer.current === null) {
      viewSyncTimer.current = setTimeout(() => {
        viewSyncTimer.current = null
        setViewCam({ ...cameraRef.current })
      }, 120)
    }
  }, [])

  const setCamera = useCallback(
    (cam: Camera) => {
      cameraRef.current = clampCamera(cam)
      applyCamera()
    },
    [applyCamera, clampCamera],
  )

  const stopMotion = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    if (momentumRef.current !== null) cancelAnimationFrame(momentumRef.current)
    animRef.current = null
    momentumRef.current = null
  }, [])

  const animateTo = useCallback(
    (target: Camera, duration = 700) => {
      stopMotion()
      const from = { ...cameraRef.current }
      const to = clampCamera(target)
      if (reducedMotionRef.current || duration <= 0) {
        setCamera(to)
        return
      }
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / duration)
        const e = easeInOutCubic(k)
        setCamera({
          cx: from.cx + (to.cx - from.cx) * e,
          cy: from.cy + (to.cy - from.cy) * e,
          z: from.z + (to.z - from.z) * e,
        })
        if (k < 1) animRef.current = requestAnimationFrame(step)
        else animRef.current = null
      }
      animRef.current = requestAnimationFrame(step)
    },
    [clampCamera, setCamera, stopMotion],
  )

  const globalFitCamera = useCallback((): Camera => {
    const b = activeBounds
    const { w, h } = viewportRef.current
    const z = Math.min(
      Math.max(Math.min(w / b.width, h / b.height) * 1.15, ZMIN),
      0.7,
    )
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, z }
  }, [activeBounds])

  const focusCameraFor = useCallback(
    (
      b: { x: number; y: number; width: number; height: number },
      reserveObi = true,
    ): Camera => {
      const { w, h } = viewportRef.current
      const desktop = w >= 1024
      // Lens fits don't reserve obi space — there's no identity strip.
      const availX = reserveObi && desktop ? OBI_WIDTH : 0
      const availW = w - availX
      const availH = reserveObi && !desktop ? h * (1 - OBI_SHEET_RATIO) : h
      const pad = 90
      const z = Math.min(
        Math.max(
          Math.min((availW - pad * 2) / b.width, (availH - pad * 2) / b.height),
          0.5,
        ),
        1.15,
      )
      // Place the cluster center at the center of the AVAILABLE region (right
      // of the obi / above the sheet) rather than the raw viewport center.
      const availCx = availX + availW / 2
      const availCy = availH / 2
      return {
        cx: b.x + b.width / 2 - (availCx - w / 2) / z,
        cy: b.y + b.height / 2 - (availCy - h / 2) / z,
        z,
      }
    },
    [],
  )

  // ── Focus state ↔ URL ─────────────────────────────────────────────────────

  const writeFocusToUrl = useCallback((slug: string | null) => {
    const url = new URL(window.location.href)
    if (slug) {
      url.searchParams.set('focus', slug)
    } else {
      url.searchParams.delete('focus')
    }
    window.history.pushState({ mapaFocus: slug }, '', url.toString())
  }, [])


  const focusFranja = useCallback(
    (slug: string, opts?: { push?: boolean; animate?: boolean }) => {
      const cluster = clusters.find((c) => c.franja.slug === slug)
      if (!cluster) return
      setFocusSlug(slug)
      if (opts?.push !== false) writeFocusToUrl(slug)
      // Camera targets the REFLOWED cluster — the reflow and the camera
      // travel together, one continuous gesture.
      const target = focusCameraFor(getArrangement(cluster).bbox)
      if (opts?.animate === false) setCamera(target)
      else animateTo(target, 800)
    },
    [animateTo, clusters, focusCameraFor, getArrangement, setCamera, writeFocusToUrl],
  )

  const zoomGlobal = useCallback(
    (opts?: { push?: boolean }) => {
      setFocusSlug(null)
      if (opts?.push !== false) writeFocusToUrl(null)
      animateTo(globalFitCamera(), 800)
    },
    [animateTo, globalFitCamera, writeFocusToUrl],
  )

  // AFINIDAD toggle — URL via replaceState (like ?ocultar: a view setting,
  // not a navigation step; Back is reserved for the focus contract).
  const toggleAffinity = useCallback(() => {
    setAffinityOn((prev) => {
      const next = !prev
      const url = new URL(window.location.href)
      if (next) url.searchParams.set('afinidad', '1')
      else url.searchParams.delete('afinidad')
      window.history.replaceState(window.history.state, '', url.toString())
      return next
    })
  }, [])

  // Camera refit when the mode flips: the drift and the zoom-out travel
  // together. While a franja focus is up the focus camera owns the view —
  // unfocusing refits through zoomGlobal (which already reads activeBounds).
  const prevAffinityRef = useRef(false)
  useEffect(() => {
    if (prevAffinityRef.current === affinityOn) return
    prevAffinityRef.current = affinityOn
    if (focusSlug) return
    animateTo(globalFitCamera(), 800)
  }, [affinityOn, animateTo, focusSlug, globalFitCamera])

  // Browser Back/Forward restores the previous scale + camera (spec).
  useEffect(() => {
    const onPop = () => {
      const slug = new URL(window.location.href).searchParams.get('focus')
      if (slug) focusFranja(slug, { push: false })
      else zoomGlobal({ push: false })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [focusFranja, zoomGlobal])

  // ── Boot: measure, initial camera, resize ─────────────────────────────────

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    // Deep link straight into a listing detail: /mapa?focus=X&franja=X&listing=Y
    {
      const params = new URL(window.location.href).searchParams
      const listingParam = params.get('listing')
      const franjaParam = params.get('franja')
      if (listingParam && franjaParam) {
        setOpenListingRef({
          franjaSlug: franjaParam,
          listingId: listingParam,
        })
      }
      // Visibility deep link: ?ocultar=evento,era:archivo — categories the
      // viewer has toggled off.
      const ocultar = params.get('ocultar')
      if (ocultar) {
        const keys = ocultar
          .split(',')
          .filter(
            (k) =>
              k in LENS_TYPE_LABEL ||
              k === 'era:ahora' ||
              k === 'era:archivo' ||
              k === 'mercado',
          )
        if (keys.length > 0) setHidden(new Set(keys))
      }
      // Continent-mode deep link: ?afinidad=1. Cells mount at their global
      // spots and glide into the drift — the refit effect follows.
      if (params.get('afinidad') === '1') setAffinityOn(true)
    }

    const measure = () => {
      const rect = container.getBoundingClientRect()
      viewportRef.current = { w: rect.width, h: rect.height }
    }
    measure()

    const initialCluster = initialFocusSlug
      ? clusters.find((c) => c.franja.slug === initialFocusSlug) ?? null
      : null
    cameraRef.current = clampCamera(
      initialCluster
        ? focusCameraFor(getArrangement(initialCluster).bbox)
        : globalFitCamera(),
    )
    applyCamera()
    setViewCam({ ...cameraRef.current })
    setReady(true)
    // Boot entrance — while .mapa-booting is on the root, cells run their
    // center-out ripple (CSS, one-time; later virtualization mounts never
    // animate because the class is gone). Imperative classList like
    // .mapa-zooming/.mapa-dragging — the root's React className is a
    // constant string, so React never rewrites the attribute and imperative
    // classes can't be wiped mid-gesture. Window: max stagger (0.55s) +
    // animation (0.5s) + margin.
    let bootTimer: ReturnType<typeof setTimeout> | null = null
    if (!reducedMotionRef.current) {
      container.classList.add('mapa-booting')
      bootTimer = setTimeout(() => {
        container.classList.remove('mapa-booting')
      }, 1200)
    }

    const ro = new ResizeObserver(() => {
      measure()
      applyCamera()
    })
    ro.observe(container)
    return () => {
      ro.disconnect()
      if (bootTimer !== null) clearTimeout(bootTimer)
    }
    // Boot only — subsequent camera moves go through the callbacks above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Wheel: pan by default, zoom with ctrl/cmd (trackpad pinch) ────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-mapa-ui]')) return
      e.preventDefault()
      // First interaction ends the boot ripple — cells mounted by the
      // ensuing pan must not enter delayed/invisible.
      container.classList.remove('mapa-booting')
      stopMotion()
      const cam = cameraRef.current
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0024)
        const rect = container.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const { w, h } = viewportRef.current
        const planeX = cam.cx + (sx - w / 2) / cam.z
        const planeY = cam.cy + (sy - h / 2) / cam.z
        const z = Math.min(Math.max(cam.z * factor, ZMIN), ZMAX)
        setCamera({
          cx: planeX - (sx - w / 2) / z,
          cy: planeY - (sy - h / 2) / z,
          z,
        })
      } else {
        setCamera({
          cx: cam.cx + e.deltaX / cam.z,
          cy: cam.cy + e.deltaY / cam.z,
          z: cam.z,
        })
      }
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [setCamera, stopMotion])

  // ── Pointer: drag pan + two-finger pinch ──────────────────────────────────

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-mapa-ui]')) return
      setFranjasOpen(false) // terrain interaction dismisses the selector
      // First interaction ends the boot ripple (see onWheel).
      containerRef.current?.classList.remove('mapa-booting')
      stopMotion()
      suppressClickRef.current = false
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointersRef.current.size === 1) {
        dragRef.current = {
          x: e.clientX,
          y: e.clientY,
          vx: 0,
          vy: 0,
          t: performance.now(),
          moved: false,
        }
      } else if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()]
        pinchRef.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        }
        dragRef.current = null
      }
    },
    [stopMotion],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const tracked = pointersRef.current.get(e.pointerId)
      if (!tracked) return
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const cam = cameraRef.current

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = [...pointersRef.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const prev = pinchRef.current
        const factor = prev.dist > 0 ? dist / prev.dist : 1
        const z = Math.min(Math.max(cam.z * factor, ZMIN), ZMAX)
        const rect = containerRef.current!.getBoundingClientRect()
        const { w, h } = viewportRef.current
        const sx = mid.x - rect.left
        const sy = mid.y - rect.top
        const planeX = cam.cx + (sx - w / 2) / cam.z
        const planeY = cam.cy + (sy - h / 2) / cam.z
        setCamera({
          cx: planeX - (sx - w / 2) / z - (mid.x - prev.mid.x) / z,
          cy: planeY - (sy - h / 2) / z - (mid.y - prev.mid.y) / z,
          z,
        })
        pinchRef.current = { dist, mid }
        suppressClickRef.current = true
        return
      }

      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) < 5) return
      if (!drag.moved) {
        // Capture only once an actual drag starts — capturing on pointerdown
        // would retarget the ensuing `click` to the container and kill cell
        // opens (click dispatches to the capture target, not the cell).
        containerRef.current?.setPointerCapture(e.pointerId)
        // Grabbing cursor + cell hover suspension while the terrain pans —
        // class toggle, not state: pointermove must stay off the render path.
        containerRef.current?.classList.add('mapa-dragging')
      }
      drag.moved = true
      suppressClickRef.current = true
      const now = performance.now()
      const dt = Math.max(1, now - drag.t)
      drag.vx = (dx / dt) * 16
      drag.vy = (dy / dt) * 16
      drag.x = e.clientX
      drag.y = e.clientY
      drag.t = now
      setCamera({ cx: cam.cx - dx / cam.z, cy: cam.cy - dy / cam.z, z: cam.z })
    },
    [setCamera],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(e.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null
      if (pointersRef.current.size === 0) {
        containerRef.current?.classList.remove('mapa-dragging')
      }
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || !drag.moved || reducedMotionRef.current) return
      // Restrained momentum: strong friction, early cutoff.
      let { vx, vy } = drag
      if (Math.hypot(vx, vy) < 2) return
      const glide = () => {
        vx *= 0.9
        vy *= 0.9
        const cam = cameraRef.current
        setCamera({
          cx: cam.cx - vx / cam.z,
          cy: cam.cy - vy / cam.z,
          z: cam.z,
        })
        if (Math.hypot(vx, vy) > 0.4) {
          momentumRef.current = requestAnimationFrame(glide)
        } else {
          momentumRef.current = null
        }
      }
      momentumRef.current = requestAnimationFrame(glide)
    },
    [setCamera],
  )

  const zoomStepTarget = useRef<number | null>(null)
  const zoomStep = useCallback(
    (factor: number) => {
      const cam = cameraRef.current
      // Compound from the in-flight target so rapid +/- presses stack
      // instead of re-reading the mid-animation zoom.
      const base =
        animRef.current !== null && zoomStepTarget.current !== null
          ? zoomStepTarget.current
          : cam.z
      const z = Math.min(Math.max(base * factor, ZMIN), ZMAX)
      zoomStepTarget.current = z
      animateTo({ cx: cam.cx, cy: cam.cy, z }, reducedMotionRef.current ? 0 : 220)
    },
    [animateTo],
  )

  // Double-click: zoom TOWARD the pointer (the clicked spot holds its screen
  // position), not the viewport center — same anchor math as ctrl-wheel.
  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const container = containerRef.current
      if (!container) return
      const cam = cameraRef.current
      const rect = container.getBoundingClientRect()
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      const { w, h } = viewportRef.current
      const planeX = cam.cx + (sx - w / 2) / cam.z
      const planeY = cam.cy + (sy - h / 2) / cam.z
      const z = Math.min(Math.max(cam.z * factor, ZMIN), ZMAX)
      // Keep the +/- compound base in sync — a zoomStep pressed during this
      // animation must stack from THIS target, not a stale earlier one.
      zoomStepTarget.current = z
      animateTo(
        {
          cx: planeX - (sx - w / 2) / z,
          cy: planeY - (sy - h / 2) / z,
          z,
        },
        reducedMotionRef.current ? 0 : 320,
      )
    },
    [animateTo],
  )

  // ── Keyboard: six-neighbor navigation ─────────────────────────────────────

  const ensureItemVisible = useCallback(
    (itemId: string) => {
      const placed = layout.placed.find((p) => p.item.id === itemId)
      if (!placed) return
      const cam = cameraRef.current
      const { w, h } = viewportRef.current
      const d = moveDeltas?.[itemId]
      const cx = placed.bbox.x + (d?.dx ?? 0) + placed.bbox.width / 2
      const cy = placed.bbox.y + (d?.dy ?? 0) + placed.bbox.height / 2
      const sx = w / 2 + (cx - cam.cx) * cam.z
      const sy = h / 2 + (cy - cam.cy) * cam.z
      const margin = 90
      if (
        sx < margin ||
        sx > w - margin ||
        sy < margin ||
        sy > h - margin
      ) {
        animateTo({ cx, cy, z: cam.z }, 260)
      }
    },
    [animateTo, moveDeltas, layout.placed],
  )

  const onArrow = useCallback(
    (itemId: string, key: string, altKey: boolean) => {
      let dir: number | null = null
      if (key === 'ArrowUp') dir = DIR_N
      else if (key === 'ArrowDown') dir = DIR_S
      else if (key === 'ArrowRight') dir = altKey ? DIR_NE : DIR_SE
      else if (key === 'ArrowLeft') dir = altKey ? DIR_SW : DIR_NW
      if (dir === null) return
      // Walk past deactivated categories so focus never lands on an
      // invisible cell (bounded scan).
      let cursor = itemId
      for (let hop = 0; hop < 8; hop++) {
        const nextId = neighborItemId(navLayout, cursor, dir)
        if (!nextId) return
        if (!hiddenItemIds?.has(nextId)) {
          pendingKeyFocusRef.current = nextId
          setFocusedItemId(nextId)
          return
        }
        cursor = nextId
      }
    },
    [hiddenItemIds, navLayout],
  )

  useEffect(() => {
    if (!focusedItemId || pendingKeyFocusRef.current !== focusedItemId) return
    pendingKeyFocusRef.current = null
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-item-id="${focusedItemId}"]`,
    )
    el?.focus({ preventScroll: true })
    ensureItemVisible(focusedItemId)
  }, [ensureItemVisible, focusedItemId])

  // ── Open content: canonical overlay, origin = polyhex screen bounds ──────

  const handleOpen = useCallback(
    (item: ContentItem, rect: DOMRect | null) => {
      if (suppressClickRef.current) return
      open(
        item.slug,
        rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : undefined,
      )
    },
    [open],
  )

  // ── Virtualization ────────────────────────────────────────────────────────

  const visiblePlaced = useMemo(() => {
    if (!ready || !viewCam) return layout.placed
    const { w, h } = viewportRef.current
    // 0.55 → roughly a 10% margin band beyond each edge; fewer mounted cells
    // is the cheapest perf lever this surface has.
    const halfW = (w / viewCam.z) * 0.55
    const halfH = (h / viewCam.z) * 0.55
    const x0 = viewCam.cx - halfW
    const x1 = viewCam.cx + halfW
    const y0 = viewCam.cy - halfH
    const y1 = viewCam.cy + halfH
    const deltas = moveDeltas
    return layout.placed.filter((p) => {
      const d = deltas?.[p.item.id]
      const bx = p.bbox.x + (d?.dx ?? 0)
      const by = p.bbox.y + (d?.dy ?? 0)
      return bx < x1 && bx + p.bbox.width > x0 && by < y1 && by + p.bbox.height > y0
    })
  }, [moveDeltas, layout.placed, ready, viewCam])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      data-band="mid"
      className="mapa-root fixed inset-0 z-40 cursor-grab touch-none select-none overflow-hidden bg-base"
      role="region"
      aria-label="Mapa global de Gradiente — terreno hexagonal navegable"
      aria-describedby="mapa-instructions"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('[data-mapa-ui]')) return
        // Cells own their clicks (first click already opened the overlay /
        // listing / dossier) — double-click zoom belongs to the grout and
        // empty terrain only. data-mapa-node covers the non-item nodes
        // (listing hexes, identity nucleus).
        if (t.closest('[data-item-id],[data-mapa-node]')) return
        zoomAtPoint(e.clientX, e.clientY, 1.5)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && focusSlug) zoomGlobal()
      }}
    >
      <p id="mapa-instructions" className="sr-only">
        Terreno de contenido en panal. Usa las flechas para moverte entre
        celdas vecinas (con Alt para las diagonales opuestas), Enter para
        abrir un contenido y Escape para volver a la vista global.
      </p>

      {/* The plane — all cells live in one transformed coordinate space. */}
      <div
        ref={planeRef}
        className={`absolute left-0 top-0 h-0 w-0 [transform-origin:0_0] [will-change:transform] ${
          ready ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300 motion-reduce:transition-none`}
      >
        {visiblePlaced.map((p) => (
          <MapaCell
            key={p.item.id}
            placed={p}
            tabbable={p.item.id === focusedItemId}
            dimmed={
              focusMemberIds
                ? !focusMemberIds.has(p.item.id) &&
                  !(relatedIds?.has(p.item.id) ?? false)
                : false
            }
            emphasized={focusMemberIds ? focusMemberIds.has(p.item.id) : false}
            hidden={hiddenItemIds?.has(p.item.id) ?? false}
            delta={moveDeltas?.[p.item.id] ?? null}
            enterDelay={enterDelays.get(p.item.id) ?? 0}
            onOpen={handleOpen}
            onArrow={onArrow}
            onFocusItem={setFocusedItemId}
          />
        ))}

        {/* Continent rings — the identified major affinity areas. They fade
            in behind the 700ms drift so the water opens first. Fase F: the
            ring is the terrain half of the AFINIDAD latch, so it carries the
            same acid the toggle does (was EVA orange). Geometry untouched. */}
        {continentArrangement && (
          <svg
            aria-hidden
            className="animate-fade-in pointer-events-none absolute left-0 top-0 overflow-visible"
            style={{ animationDelay: '0.55s', animationFillMode: 'backwards' }}
            width="0"
            height="0"
          >
            {continentArrangement.continents.map((c) => (
              <path
                key={c.itemIds[0]}
                d={c.perimeter}
                fill="none"
                stroke={DASH_ACID}
                strokeOpacity="0.35"
                strokeWidth="2"
                strokeDasharray="4 10"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}

        {/* Perimeter ring around the focused cluster. */}
        {focusArrangement && (
          <svg
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width="0"
            height="0"
          >
            <path
              d={focusArrangement.perimeter}
              fill="none"
              stroke="#F0F0F0"
              strokeOpacity="0.5"
              strokeWidth="2.5"
              strokeDasharray="10 8"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Focus state: identity rosette + marketplace listing nodes. The
            identity is a full 7-cell rosette carrying the franja image at
            dominant-slab scale (2026-08-20, Iker's call — the single-hex
            nucleus was too small to read or hit); links to the dossier. */}
        {/* Global MERCADO satellites — at every view except their own
            franja's focus (the focus arrangement re-places those). They
            ride their anchor member's delta, dim like non-member terrain
            while another identity is focused, and fade during compaction
            (the repack can claim their coast). */}
        {globalListings
          .filter((g) => g.franjaSlug !== focusSlug)
          .map((g) => (
            <MapaListingCell
              key={g.placement.listing.id}
              placement={g.placement}
              currency={g.currency}
              hidden={hidden.has('mercado') || compactArrangement != null}
              dimmed={focusArrangement != null}
              delta={moveDeltas?.[g.anchorItemId] ?? null}
              onOpen={(l) => openListing(l, g.franjaSlug)}
            />
          ))}

        {focusArrangement && focusedCluster && (
          <>
            {focusArrangement.listings.map((lp) => (
              <MapaListingCell
                key={lp.listing.id}
                placement={lp}
                currency={focusedCluster.franja.marketplaceCurrency ?? 'MXN'}
                hidden={hidden.has('mercado')}
                onOpen={(l) => openListing(l, focusedCluster.franja.slug)}
              />
            ))}
            <Link
              href={`/f/${focusedCluster.franja.slug}`}
              data-mapa-node
              aria-label={`${focusedCluster.franja.title} — entrar al dossier del franja`}
              className="animate-fade-in absolute z-10 block no-underline"
              style={{
                left: focusArrangement.identityBox.x,
                top: focusArrangement.identityBox.y,
                width: focusArrangement.identityBox.width,
                height: focusArrangement.identityBox.height,
              }}
            >
              {/* Media stack — the franja image FILLS the rosette (same
                  treatment as a dominant content slab). */}
              <div
                className="absolute inset-0 bg-[#101010]"
                style={{
                  clipPath: `path('${focusArrangement.identityOutline}')`,
                }}
              >
                {focusedCluster.franja.imageUrl && (
                  <div className="absolute inset-0">
                    <SmartImage
                      src={focusedCluster.franja.imageUrl}
                      alt=""
                      sizes="640px"
                      draggable={false}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/70" />
                {/* Prominent identity type — the cell must read as THE
                    franja, not as one more content slab. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[14%] text-center">
                  <span className="inline-flex w-fit items-center border border-primary/70 bg-[#0D0D0DCC] px-2 py-0.5 font-mono text-[11px] tracking-[0.2em] text-primary">
                    {'//'}FRANJA
                    {focusedCluster.franja.franjaKind
                      ? ` · ${KIND_LABEL[focusedCluster.franja.franjaKind]}`
                      : ''}
                  </span>
                  <span className="font-syne text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-primary [text-shadow:0_2px_18px_rgba(0,0,0,0.85)]">
                    {focusedCluster.franja.title}
                  </span>
                  {focusedCluster.franja.subtitle && (
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/75">
                      {focusedCluster.franja.subtitle}
                    </span>
                  )}
                </div>
              </div>
              <svg
                width={focusArrangement.identityBox.width}
                height={focusArrangement.identityBox.height}
                viewBox={`0 0 ${focusArrangement.identityBox.width} ${focusArrangement.identityBox.height}`}
                className="pointer-events-none absolute inset-0"
                aria-hidden
              >
                <path
                  d={focusArrangement.identityOutline}
                  fill="none"
                  stroke="#F0F0F0"
                  strokeOpacity="0.75"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </>
        )}
      </div>

      {/* Edge vignette — the surface reads as continuing past every edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.55)_100%)]"
      />

      {/* ── Chrome (non-terrain UI) ────────────────────────────────────────
          Fase F: the TERRAIN stays dark on purpose — /mapa is an instrument,
          and instruments are dark hardware. Only the chrome ON it was
          converted: out of EVA orange, into the house bezel register — panel
          plates with panel-text hairlines, flat (no blur, no glow), acid
          reserved for the one latched own-action, ONE focus grammar in its
          panel variant, ≥44px targets. */}

      {/* Top-left: exit + surface id */}
      <div
        data-mapa-ui
        className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-3"
      >
        <Link
          href="/"
          className={`flex min-h-11 items-center border border-panel-text/40 bg-panel/90 px-3 font-mono text-d11 font-bold uppercase tracking-widest text-panel-text transition-colors hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`}
        >
          ← GRADIENTE//FM
        </Link>
        <span className="hidden border border-panel-text/25 px-2 py-1 font-mono text-d11 uppercase tracking-widest text-panel-text/55 sm:inline">
          MAPA · GLOBAL
        </span>
      </div>

      {/* Top-right: franja selector + zoom controls. The selector scales to
          the full franja roster (78 in prod): identities WITH terrain are
          focusable with their publication count; the rest are listed inert —
          an honest index, not fake affordances. */}
      <div
        data-mapa-ui
        className="pointer-events-auto absolute right-4 top-4 z-20 flex items-start gap-2"
      >
        <div className="relative">
          {/* Latched on a focused franja: an acid fill-block with panel-ink
              text — the whitelisted acid use, and the only acid on the map.
              Merely open (no focus yet) brightens the bezel instead. */}
          <button
            type="button"
            onClick={() => setFranjasOpen((o) => !o)}
            aria-expanded={franjasOpen}
            aria-haspopup="listbox"
            className={`flex min-h-11 items-center border px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${FOCUS_ON_PANEL} ${
              focusSlug
                ? 'border-acid bg-acid text-panel'
                : franjasOpen
                  ? 'border-panel-text bg-panel text-panel-text'
                  : 'border-panel-text/40 bg-panel/90 text-panel-text hover:bg-panel-text hover:text-panel'
            }`}
          >
            ◎ FRANJAS{focusSlug ? ` · ${focusSlug.toUpperCase()}` : ''}
          </button>
          {franjasOpen && (
            <div className="absolute right-0 top-full mt-2 max-h-[62dvh] w-72 overflow-y-auto border border-panel-text/40 bg-panel">
              <p className="border-b border-panel-text/25 px-3 py-2 font-mono text-d11 uppercase tracking-widest text-panel-text/55">
                CON TERRENO
              </p>
              {clusters.map((c) => (
                <button
                  key={c.franja.id}
                  type="button"
                  onClick={() => {
                    setFranjasOpen(false)
                    if (focusSlug === c.franja.slug) zoomGlobal()
                    else focusFranja(c.franja.slug)
                  }}
                  aria-pressed={focusSlug === c.franja.slug}
                  className={`flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${FOCUS_ON_PANEL} ${
                    focusSlug === c.franja.slug
                      ? 'bg-panel-text text-panel'
                      : 'text-panel-text/75 hover:bg-panel-text hover:text-panel'
                  }`}
                >
                  {c.franja.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.franja.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-6 w-6 shrink-0 border border-panel-text/40 object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-d11 tracking-widest">
                    {c.franja.title}
                  </span>
                  <span className="shrink-0 font-mono text-d11 tabular-nums opacity-60">
                    {c.itemIds.length}
                  </span>
                </button>
              ))}
              {inertFranjas.length > 0 && (
                <>
                  <p className="border-y border-panel-text/25 px-3 py-2 font-mono text-d11 uppercase tracking-widest text-panel-text/55">
                    SIN CONTENIDO EN EL MAPA
                  </p>
                  {inertFranjas.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 px-3 py-1.5 opacity-45"
                    >
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-5 w-5 shrink-0 border border-panel-text/40 object-cover"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-d11 tracking-widest text-panel-text">
                        {p.title}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex border border-panel-text/40 bg-panel/90">
          <button
            type="button"
            onClick={() => zoomStep(1 / 1.35)}
            aria-label="Alejar"
            className={`flex min-h-11 min-w-11 items-center justify-center font-mono text-d13 text-panel-text transition-colors hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomStep(1.35)}
            aria-label="Acercar"
            className={`flex min-h-11 min-w-11 items-center justify-center border-l border-panel-text/40 font-mono text-d13 text-panel-text transition-colors hover:bg-panel-text hover:text-panel ${FOCUS_ON_PANEL}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Bottom-left: keyboard legend (desktop) — the bottom-right corner
          belongs to the radial filter. */}
      <div
        data-mapa-ui
        className="pointer-events-none absolute bottom-4 left-4 z-20 hidden font-mono text-d11 uppercase tracking-widest text-panel-text/55 lg:block"
      >
        ↑↓←→ NAVEGAR · ⌥ DIAGONAL · ENTER ABRIR
        {focusSlug ? ' · ESC GLOBAL' : ''}
      </div>

      {/* Right-edge category toggles — every category visible by default;
          each hex is a kill-switch that fades its cells in place. */}
      <MapaFilterColumn
        typeOptions={typeOptions}
        eraCounts={eraCounts}
        mercadoCount={mercadoCount}
        hidden={hidden}
        onToggle={toggleHidden}
        affinityOn={affinityOn}
        affinityCount={
          continentArrangement ? continentArrangement.continents.length : null
        }
        onToggleAffinity={toggleAffinity}
      />

      {/* Franja identity strip — contextual chrome, never terrain. */}
      {focusedCluster && (
        <FranjaObi
          cluster={focusedCluster}
          items={focusMemberItems}
          relatedFranjas={rankedFranjas.map((r) => ({
            slug: r.cluster.franja.slug,
            title: r.cluster.franja.title,
          }))}
          onFocusFranja={(slug) => focusFranja(slug)}
          onZoomGlobal={() => zoomGlobal()}
        />
      )}

      {/* One individual listing's canonical detail (?franja=&listing=),
          directly over the map — no marketplace grid in between. Opens from
          the global satellites and from the focus arc alike. */}
      {openListingEntry && (
        <MarketplaceListingDetail
          listing={openListingEntry.listing}
          franja={openListingEntry.franja}
          index={openListingEntry.index}
          onClose={closeListing}
          // The ONE dark call site: every other host of this sheet is a paper
          // surface, but here it floats over the terrain void, which is design
          // rather than un-converted chrome. 'dark' is the pliego sheet in
          // negative, not the retired EVA skin.
          variant="dark"
        />
      )}
    </div>
  )
}
