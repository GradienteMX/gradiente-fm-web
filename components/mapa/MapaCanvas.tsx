'use client'

// Spatial Identity Canvas — the pannable/zoomable honeycomb viewport.
// One continuous surface: the global terrain and the partner focus state are
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
  type PartnerCluster,
} from '@/lib/mapa/layout'
import {
  computeFocusArrangement,
  rankRelatedPartners,
  type FocusArrangement,
} from '@/lib/mapa/focus'
import { recordItems } from '@/lib/itemsCache'
import { useOverlay } from '@/components/overlay/useOverlay'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'
import { MapaCell } from './MapaCell'
import { MapaFilterColumn } from './MapaFilterColumn'
import { MapaListingCell } from './MapaListingCell'
import { PartnerObi } from './PartnerObi'

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
  clusters: PartnerCluster[]
  /** EVERY partner identity row — feeds the selector; most have no cluster. */
  partners: ContentItem[]
  initialFocusSlug: string | null
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function MapaCanvas({
  layout,
  clusters,
  partners,
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
    () => clusters.find((c) => c.partner.slug === focusSlug) ?? null,
    [clusters, focusSlug],
  )
  const focusMemberIds = useMemo(
    () => (focusedCluster ? new Set(focusedCluster.itemIds) : null),
    [focusedCluster],
  )

  // Focus reflow arrangements are deterministic per (layout, cluster) —
  // computed once per partner and cached so re-focusing is instant and the
  // delta objects keep a stable identity for cell memoization.
  const arrangementCache = useRef(new Map<string, FocusArrangement>())
  const getArrangement = useCallback(
    (cluster: PartnerCluster): FocusArrangement => {
      const hit = arrangementCache.current.get(cluster.partner.slug)
      if (hit) return hit
      const arr = computeFocusArrangement(
        layout,
        cluster,
        cluster.partner.marketplaceEnabled
          ? cluster.partner.marketplaceListings ?? []
          : [],
      )
      arrangementCache.current.set(cluster.partner.slug, arr)
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

  // Positional restructuring: with categories hidden, the visible terrain
  // re-tessellates through the same placement rules — the map as if those
  // categories never existed. Cached per hidden-combination; suspended while
  // a partner focus is up (focus already owns the geometry).
  const compactCache = useRef(new Map<string, CompactArrangement | null>())
  const compactArrangement = useMemo(() => {
    if (!hiddenItemIds || focusArrangement) return null
    const key = [...hidden].sort().join(',')
    if (compactCache.current.has(key)) {
      return compactCache.current.get(key) ?? null
    }
    const arr = compactLayout(layout, hiddenItemIds)
    compactCache.current.set(key, arr)
    return arr
  }, [focusArrangement, hidden, hiddenItemIds, layout])

  // One geometry driver at a time: focus reflow > filter compaction > global.
  const moveDeltas = focusArrangement?.deltas ?? compactArrangement?.deltas
  // Keyboard traversal follows whichever geometry is live.
  const navLayout =
    focusArrangement?.derived ?? compactArrangement?.derived ?? layout
  // The relevance belt: full-color exterior during focus.
  const relatedIds = useMemo(
    () => (focusArrangement ? new Set(focusArrangement.relatedIds) : null),
    [focusArrangement],
  )
  // Affine partners, most resonant first — the obi carousel order.
  const rankedPartners = useMemo(
    () =>
      focusedCluster
        ? rankRelatedPartners(layout, clusters, focusedCluster)
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

  // Partner selector panel + the identities that have no cluster yet.
  const [partnersOpen, setPartnersOpen] = useState(false)
  const inertPartners = useMemo(() => {
    const clustered = new Set(clusters.map((c) => c.partner.id))
    return [...partners]
      .filter((p) => !clustered.has(p.id))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [clusters, partners])

  // Marketplace listing detail — one INDIVIDUAL listing's canonical detail
  // surface (?partner=&listing=), mounted directly over the map. Closing it
  // returns straight to the focus state, never to a marketplace grid.
  const [openListingId, setOpenListingId] = useState<string | null>(null)
  const openListing = useCallback(
    (listing: MarketplaceListing) => {
      if (!focusedCluster) return
      const url = new URL(window.location.href)
      url.searchParams.set('partner', focusedCluster.partner.slug)
      url.searchParams.set('listing', listing.id)
      window.history.pushState(window.history.state, '', url.toString())
      setOpenListingId(listing.id)
    },
    [focusedCluster],
  )
  const closeListing = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('partner')
    url.searchParams.delete('listing')
    window.history.replaceState(window.history.state, '', url.toString())
    setOpenListingId(null)
  }, [])
  // Resolve the open listing + its 1-based index (publishedAt-desc, the same
  // ordering every marketplace surface uses for its grid badges).
  const openListingEntry = useMemo(() => {
    if (!openListingId || !focusedCluster) return null
    const sorted = [...(focusedCluster.partner.marketplaceListings ?? [])].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    const idx = sorted.findIndex((l) => l.id === openListingId)
    if (idx < 0) return null
    return { listing: sorted[idx], index: idx + 1 }
  }, [focusedCluster, openListingId])

  // Warm the overlay slug cache with every map item + ALL partner identity
  // rows, so cell clicks and ?item= deep links resolve through OverlayRouter
  // (same bridge ContentGrid provides on grid pages).
  useEffect(() => {
    recordItems([...layout.placed.map((p) => p.item), ...partners])
  }, [layout, partners])

  // ── Camera core ────────────────────────────────────────────────────────────

  const clampCamera = useCallback(
    (cam: Camera): Camera => {
      const b = layout.bounds
      const insetX = Math.min(b.width * 0.12, 320)
      const insetY = Math.min(b.height * 0.12, 320)
      return {
        cx: Math.min(Math.max(cam.cx, b.x + insetX), b.x + b.width - insetX),
        cy: Math.min(Math.max(cam.cy, b.y + insetY), b.y + b.height - insetY),
        z: Math.min(Math.max(cam.z, ZMIN), ZMAX),
      }
    },
    [layout.bounds],
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
    const b = layout.bounds
    const { w, h } = viewportRef.current
    const z = Math.min(
      Math.max(Math.min(w / b.width, h / b.height) * 1.15, ZMIN),
      0.7,
    )
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, z }
  }, [layout.bounds])

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


  const focusPartner = useCallback(
    (slug: string, opts?: { push?: boolean; animate?: boolean }) => {
      const cluster = clusters.find((c) => c.partner.slug === slug)
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

  // Browser Back/Forward restores the previous scale + camera (spec).
  useEffect(() => {
    const onPop = () => {
      const slug = new URL(window.location.href).searchParams.get('focus')
      if (slug) focusPartner(slug, { push: false })
      else zoomGlobal({ push: false })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [focusPartner, zoomGlobal])

  // ── Boot: measure, initial camera, resize ─────────────────────────────────

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    // Deep link straight into a listing detail: /mapa?focus=X&partner=X&listing=Y
    {
      const params = new URL(window.location.href).searchParams
      const listingParam = params.get('listing')
      if (
        initialFocusSlug &&
        listingParam &&
        params.get('partner') === initialFocusSlug
      ) {
        setOpenListingId(listingParam)
      }
      // Visibility deep link: ?ocultar=evento,era:archivo — categories the
      // viewer has toggled off.
      const ocultar = params.get('ocultar')
      if (ocultar) {
        const keys = ocultar
          .split(',')
          .filter(
            (k) =>
              k in LENS_TYPE_LABEL || k === 'era:ahora' || k === 'era:archivo',
          )
        if (keys.length > 0) setHidden(new Set(keys))
      }
    }

    const measure = () => {
      const rect = container.getBoundingClientRect()
      viewportRef.current = { w: rect.width, h: rect.height }
    }
    measure()

    const initialCluster = initialFocusSlug
      ? clusters.find((c) => c.partner.slug === initialFocusSlug) ?? null
      : null
    cameraRef.current = clampCamera(
      initialCluster
        ? focusCameraFor(getArrangement(initialCluster).bbox)
        : globalFitCamera(),
    )
    applyCamera()
    setViewCam({ ...cameraRef.current })
    setReady(true)

    const ro = new ResizeObserver(() => {
      measure()
      applyCamera()
    })
    ro.observe(container)
    return () => ro.disconnect()
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
      setPartnersOpen(false) // terrain interaction dismisses the selector
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
      className="mapa-root fixed inset-0 z-40 touch-none select-none overflow-hidden bg-base"
      role="region"
      aria-label="Mapa global de Gradiente — terreno hexagonal navegable"
      aria-describedby="mapa-instructions"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-mapa-ui]')) return
        zoomStep(1.5)
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
            onOpen={handleOpen}
            onArrow={onArrow}
            onFocusItem={setFocusedItemId}
          />
        ))}

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

        {/* Focus state: identity nucleus + marketplace listing nodes. The
            nucleus is the mockup's central partner hex — identity chrome
            materialized in terrain only while focused; links to the dossier. */}
        {focusArrangement && focusedCluster && (
          <>
            {focusArrangement.listings.map((lp) => (
              <MapaListingCell
                key={lp.listing.id}
                placement={lp}
                currency={focusedCluster.partner.marketplaceCurrency ?? 'MXN'}
                onOpen={openListing}
              />
            ))}
            <Link
              href={`/p/${focusedCluster.partner.slug}`}
              aria-label={`${focusedCluster.partner.title} — entrar al dossier del partner`}
              className="animate-fade-in absolute z-10 block no-underline"
              style={{
                left: focusArrangement.identityBox.x,
                top: focusArrangement.identityBox.y,
                width: focusArrangement.identityBox.width,
                height: focusArrangement.identityBox.height,
              }}
            >
              <div
                className="absolute inset-0 bg-[#101010]"
                style={{
                  clipPath: `path('${focusArrangement.identityOutline}')`,
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-[18%] text-center">
                  {focusedCluster.partner.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={focusedCluster.partner.imageUrl}
                      alt=""
                      draggable={false}
                      className="h-10 w-10 border border-border object-cover"
                    />
                  )}
                  <span className="font-syne text-base font-extrabold uppercase leading-none tracking-tight text-primary">
                    {focusedCluster.partner.title}
                  </span>
                  {focusedCluster.partner.subtitle && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-primary/45">
                      {focusedCluster.partner.subtitle}
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
                  strokeOpacity="0.4"
                  strokeWidth="2"
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

      {/* ── Chrome (non-terrain UI) ── */}

      {/* Top-left: exit + surface id */}
      <div
        data-mapa-ui
        className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-3"
      >
        <Link
          href="/"
          className="border border-border bg-base/80 px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-secondary backdrop-blur-sm transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          ← GRADIENTE//FM
        </Link>
        <span className="hidden font-mono text-[10px] tracking-[0.2em] text-muted sm:inline">
          MAPA·GLOBAL <span className="text-sys-orange">vE-01</span>
        </span>
      </div>

      {/* Top-right: partner selector + zoom controls. The selector scales to
          the full partner roster (78 in prod): identities WITH terrain are
          focusable with their publication count; the rest are listed inert —
          an honest index, not fake affordances. */}
      <div
        data-mapa-ui
        className="pointer-events-auto absolute right-4 top-4 z-20 flex items-start gap-2"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setPartnersOpen((o) => !o)}
            aria-expanded={partnersOpen}
            aria-haspopup="listbox"
            className={`border px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] backdrop-blur-sm transition-colors ${
              focusSlug || partnersOpen
                ? 'border-sys-orange bg-sys-orange/15 text-sys-orange'
                : 'border-border bg-base/80 text-secondary hover:border-primary/50 hover:text-primary'
            }`}
          >
            ◎ PARTNERS{focusSlug ? ` · ${focusSlug.toUpperCase()}` : ''}
          </button>
          {partnersOpen && (
            <div className="absolute right-0 top-full mt-2 max-h-[62dvh] w-72 overflow-y-auto border border-border bg-base/95 backdrop-blur-sm">
              <p className="border-b border-border/60 px-3 py-2 font-mono text-[9px] tracking-[0.18em] text-muted">
                {'//'}CON TERRENO
              </p>
              {clusters.map((c) => (
                <button
                  key={c.partner.id}
                  type="button"
                  onClick={() => {
                    setPartnersOpen(false)
                    if (focusSlug === c.partner.slug) zoomGlobal()
                    else focusPartner(c.partner.slug)
                  }}
                  aria-pressed={focusSlug === c.partner.slug}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    focusSlug === c.partner.slug
                      ? 'bg-sys-orange/10 text-sys-orange'
                      : 'text-secondary hover:bg-elevated hover:text-primary'
                  }`}
                >
                  {c.partner.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.partner.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-6 w-6 shrink-0 border border-border object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide">
                    {c.partner.title}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-muted">
                    {c.itemIds.length}
                  </span>
                </button>
              ))}
              {inertPartners.length > 0 && (
                <>
                  <p className="border-y border-border/60 px-3 py-2 font-mono text-[9px] tracking-[0.18em] text-muted">
                    {'//'}SIN CONTENIDO EN EL MAPA
                  </p>
                  {inertPartners.map((p) => (
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
                          className="h-5 w-5 shrink-0 border border-border object-cover"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] tracking-wide text-secondary">
                        {p.title}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex border border-border bg-base/80 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => zoomStep(1 / 1.35)}
            aria-label="Alejar"
            className="px-2.5 py-1.5 font-mono text-xs text-secondary transition-colors hover:text-primary"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomStep(1.35)}
            aria-label="Acercar"
            className="border-l border-border px-2.5 py-1.5 font-mono text-xs text-secondary transition-colors hover:text-primary"
          >
            +
          </button>
        </div>
      </div>

      {/* Bottom-left: keyboard legend (desktop) — the bottom-right corner
          belongs to the radial filter. */}
      <div
        data-mapa-ui
        className="pointer-events-none absolute bottom-4 left-4 z-20 hidden font-mono text-[9px] tracking-[0.14em] text-muted lg:block"
      >
        ↑↓←→ NAVEGAR · ⌥ DIAGONAL · ENTER ABRIR
        {focusSlug ? ' · ESC GLOBAL' : ''}
      </div>

      {/* Right-edge category toggles — every category visible by default;
          each hex is a kill-switch that fades its cells in place. */}
      <MapaFilterColumn
        typeOptions={typeOptions}
        eraCounts={eraCounts}
        hidden={hidden}
        onToggle={toggleHidden}
      />

      {/* Partner identity strip — contextual chrome, never terrain. */}
      {focusedCluster && (
        <PartnerObi
          cluster={focusedCluster}
          relatedPartners={rankedPartners.map((r) => ({
            slug: r.cluster.partner.slug,
            title: r.cluster.partner.title,
          }))}
          onFocusPartner={(slug) => focusPartner(slug)}
          onZoomGlobal={() => zoomGlobal()}
        />
      )}

      {/* One individual listing's canonical detail (?partner=&listing=),
          directly over the map — no marketplace grid in between. */}
      {openListingEntry && focusedCluster && (
        <MarketplaceListingDetail
          listing={openListingEntry.listing}
          partner={focusedCluster.partner}
          index={openListingEntry.index}
          onClose={closeListing}
        />
      )}
    </div>
  )
}
