'use client'

/**
 * TERRITORIO — /mapa. The whole archive as land: affinity is geography, HL
 * is area, energy is the rim. One WebGL window over the page (the stage's
 * single context), a DOM of hairlines around it.
 *
 * Data flow (all deterministic, global, identical for every viewer):
 *   items → terrain (non-franja, with art) → placeItems (10-min bucket,
 *   synthetic HL on, as production) → clusters / satellites → model
 *   view = focus reflow > afinidad continents > filter compaction > global
 * The controller animates between views; React re-renders only when the
 * view, the caption set or the chrome changes — never per frame.
 */

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { ContentItem, ContentType } from '@/lib/types'
import { useDispatch, useItems, useNow, useNowMs } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { getStage } from '@/components/stage/engine'
import { useStageWindow } from '@/components/stage/api'
import { compactLayout, franjaClusters, neighborItemId, placeItems, type CompactArrangement, type FranjaCluster, type MapaLayout } from '@/lib/mapa/layout'
import { computeFocusArrangement, placeGlobalListings, rankRelatedFranjas, type FocusArrangement } from '@/lib/mapa/focus'
import { computeContinentArrangement, type ContinentArrangement } from '@/lib/mapa/continents'
import { insetLoop, outlineLoops } from '@/lib/mapa/polyhex'
import { DIR_N, DIR_NE, DIR_NW, DIR_S, DIR_SE, DIR_SW } from '@/lib/mapa/hex'
import { FILTER_TYPES, GAP, R, buildModel, computeView, datasetKey, filteredOut, isArchive, isTerrain, type FocusExtra, type TerrainModel } from './model'
import { TerrainController, type Insets, type RibbonGroup, type ScreenRect } from './controller'
import { cell } from './store'
import { Ayuda, Barra, Capas, Dock, FranjaPicker, useStatus, type FranjaOption } from './Chrome'
import { Tira } from './Tira'
import { Ficha, Rotulos } from './Rotulos'
import { Indice, Lista } from './Lista'
import styles from './Territorio.module.css'

const BUCKET = 600_000
const VALID_HIDDEN = new Set<string>([...FILTER_TYPES, 'mercado', 'era:ahora', 'era:archivo'])

function parseOcultar(s: string | null): Set<string> {
  if (!s) return new Set()
  return new Set(s.split(',').filter((k) => VALID_HIDDEN.has(k)))
}

// Client-only facts, read without setState-in-effect: false / a desktop
// guess during SSR and hydration, the real values right after.
const noop = () => () => {}
const onResize = (fn: () => void) => {
  window.addEventListener('resize', fn)
  return () => window.removeEventListener('resize', fn)
}
const viewportKey = () => `${window.innerWidth}x${window.innerHeight}`

function editUrl(fn: (sp: URLSearchParams) => void, mode: 'push' | 'replace') {
  const url = new URL(window.location.href)
  fn(url.searchParams)
  const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`
  if (mode === 'push') window.history.pushState({ ...(window.history.state ?? {}), territorio: true }, '', next)
  else window.history.replaceState(window.history.state, '', next)
}

export interface TerritorioProps {
  initialFoco: string | null
  initialAfinidad: boolean
  initialOcultar: string | null
}

export function Territorio({ initialFoco, initialAfinidad, initialOcultar }: TerritorioProps) {
  const items = useItems()
  const nowMs = useNowMs()
  const now = useNow()
  const me = useMe()
  const dispatch = useDispatch()
  const router = useRouter()
  const openLectura = useUI((s) => s.openLectura)
  const notify = useUI((s) => s.notify)

  const rootRef = useRef<HTMLDivElement>(null)
  const landRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLOutputElement>(null)
  const chipEl = useRef<HTMLDivElement | null>(null)
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const vpKey = useSyncExternalStore(onResize, viewportKey, () => '1440x900')
  const vp = useMemo(() => {
    const [w, h] = vpKey.split('x').map(Number)
    return { w, h }
  }, [vpKey])
  const [glOk, setGlOk] = useState<boolean | null>(null)
  const [ctl, setCtl] = useState<TerrainController | null>(null)
  const ctlRef = useRef<TerrainController | null>(null)

  const [foco, setFoco] = useState<string | null>(initialFoco)
  const [afinidad, setAfinidad] = useState(initialAfinidad)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => parseOcultar(initialOcultar))
  const [franjasOpen, setFranjasOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [capasOpen, setCapasOpen] = useState(false)
  const [captionKeys, setCaptionKeys] = useState<string[]>([])

  const chipCell = useMemo(() => cell<string | null>(null), [])
  const kbCell = useMemo(() => cell(false), [])

  // ── data ──────────────────────────────────────────────────────────────────

  const bucket = Math.floor(nowMs / BUCKET) * BUCKET
  const terrain = useMemo(() => items.filter(isTerrain), [items])
  const franjas = useMemo(() => items.filter((i) => i.type === 'franja'), [items])
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const key = useMemo(() => datasetKey(terrain, bucket), [terrain, bucket])
  const terrainRef = useRef(terrain)
  terrainRef.current = terrain

  // Placement is the expensive step (~0.1 s): once per dataset × bucket.
  const layout = useMemo<MapaLayout | null>(
    () => (mounted ? placeItems(terrainRef.current, new Date(bucket), { syntheticHl: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, key],
  )
  const clusters = useMemo<FranjaCluster[]>(() => (layout ? franjaClusters(layout, franjas) : []), [layout, franjas])
  const clusterBySlug = useMemo(() => new Map(clusters.map((c) => [c.franja.slug, c])), [clusters])
  const globalListings = useMemo(() => (layout ? placeGlobalListings(layout, clusters) : []), [layout, clusters])

  const focusCache = useRef<{ layout: MapaLayout | null; map: Map<string, FocusArrangement> }>({ layout: null, map: new Map() })
  const getFocus = useCallback(
    (cl: FranjaCluster): FocusArrangement => {
      const c = focusCache.current
      if (c.layout !== layout) {
        c.layout = layout
        c.map = new Map()
      }
      const listings = cl.franja.marketplaceEnabled ? (cl.franja.marketplaceListings ?? []) : []
      const k = `${cl.franja.slug}|${listings.map((l) => l.id).join(',')}`
      let arr = c.map.get(k)
      if (!arr) {
        arr = computeFocusArrangement(layout!, cl, listings)
        c.map.set(k, arr)
      }
      return arr
    },
    [layout],
  )

  const focusCluster = foco ? (clusterBySlug.get(foco) ?? null) : null
  const focusArr = useMemo(() => (focusCluster ? getFocus(focusCluster) : null), [focusCluster, getFocus])

  // Every franja focused this session stays in the model, so leaving (or
  // stepping to an affine franja) fades its rosette out instead of cutting.
  const visited = useRef<Set<string>>(new Set())
  if (focusCluster) visited.current.add(focusCluster.franja.slug)
  const visitedKey = [...visited.current].sort().join(',')
  const extras = useMemo<FocusExtra[]>(() => {
    const out: FocusExtra[] = []
    for (const slug of visitedKey ? visitedKey.split(',') : []) {
      const cl = clusterBySlug.get(slug)
      if (cl) out.push({ slug, franja: cl.franja, arr: getFocus(cl) })
    }
    return out
  }, [visitedKey, clusterBySlug, getFocus])

  const model = useMemo<TerrainModel | null>(
    () => (layout ? buildModel({ layout, itemsById, nowMs: bucket, clusters, globalListings, focus: extras }) : null),
    [layout, itemsById, bucket, clusters, globalListings, extras],
  )
  const modelRef = useRef(model)
  modelRef.current = model

  const contCache = useRef<{ layout: MapaLayout | null; arr: ContinentArrangement | null }>({ layout: null, arr: null })
  const continents = useMemo(() => {
    if (!afinidad || !layout || focusCluster) return null
    if (contCache.current.layout !== layout) contCache.current = { layout, arr: computeContinentArrangement(layout) }
    return contCache.current.arr
  }, [afinidad, layout, focusCluster])

  const hiddenIds = useMemo(() => {
    if (!model || !hidden.size) return null
    const s = new Set<string>()
    for (const n of model.nodes) if (n.kind === 'pieza' && filteredOut(n, hidden)) s.add(n.key)
    return s
  }, [model, hidden])

  const compactCache = useRef<{ layout: MapaLayout | null; map: Map<string, CompactArrangement | null> }>({ layout: null, map: new Map() })
  const compact = useMemo(() => {
    if (!layout || !hiddenIds || !hiddenIds.size || focusCluster || continents) return null
    const c = compactCache.current
    if (c.layout !== layout) {
      c.layout = layout
      c.map = new Map()
    }
    const k = [...hidden].sort().join(',')
    if (!c.map.has(k)) c.map.set(k, compactLayout(layout, hiddenIds))
    return c.map.get(k) ?? null
  }, [layout, hiddenIds, hidden, focusCluster, continents])

  const members = useMemo(() => (focusCluster ? new Set(focusCluster.itemIds) : null), [focusCluster])
  const related = useMemo(() => (focusArr ? new Set(focusArr.relatedIds) : null), [focusArr])
  const view = useMemo(
    () =>
      model
        ? computeView(model, {
            focus: focusCluster && focusArr && members && related ? { slug: focusCluster.franja.slug, arr: focusArr, members, related } : null,
            continents,
            compact,
            hidden,
          })
        : null,
    [model, focusCluster, focusArr, members, related, continents, compact, hidden],
  )
  const navLayout = focusArr?.derived ?? continents?.derived ?? compact?.derived ?? layout

  // ── chrome data (catalog facts, never metrics) ────────────────────────────

  const counts = useMemo(() => {
    const m = new Map<ContentType, number>()
    for (const it of terrain) m.set(it.type, (m.get(it.type) ?? 0) + 1)
    return FILTER_TYPES.filter((t) => m.has(t)).map((t) => ({ type: t, n: m.get(t)! }))
  }, [terrain])
  const era = useMemo(() => {
    let archivo = 0
    for (const it of terrain) if (isArchive(it, bucket)) archivo++
    return { ahora: terrain.length - archivo, archivo }
  }, [terrain, bucket])
  const mercadoCount = globalListings.length
  const landed = useMemo<FranjaOption[]>(
    () => [...clusters].sort((a, b) => a.franja.title.localeCompare(b.franja.title, 'es')).map((c) => ({ franja: c.franja, pieces: c.itemIds.length })),
    [clusters],
  )
  const dormant = useMemo(() => {
    const on = new Set(clusters.map((c) => c.franja.id))
    return franjas.filter((f) => !on.has(f.id)).sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [clusters, franjas])
  const relatedFranjas = useMemo(
    () => (layout && focusCluster ? rankRelatedFranjas(layout, clusters, focusCluster).map((r) => ({ slug: r.cluster.franja.slug, title: r.cluster.franja.title })) : []),
    [layout, clusters, focusCluster],
  )
  const focusMembers = useMemo(
    () => (focusCluster ? focusCluster.itemIds.map((id) => itemsById.get(id)).filter((x): x is ContentItem => Boolean(x)) : []),
    [focusCluster, itemsById],
  )
  const hiddenCount = hiddenIds?.size ?? 0
  const st = useStatus({
    focusTitle: focusCluster?.franja.title ?? null,
    afinidad: Boolean(continents),
    continents: continents?.continents.length ?? null,
    pieces: terrain.length,
    hiddenCount,
  })
  const status = model ? st.status : 'Levantando el terreno…'
  const orderedPieces = useMemo(() => (layout ? layout.placed.map((p) => itemsById.get(p.item.id) ?? p.item) : terrain), [layout, itemsById, terrain])

  // ── actions ───────────────────────────────────────────────────────────────

  const activate = useCallback(
    (key: string, rect: ScreenRect | null) => {
      const m = modelRef.current
      const i = m?.byKey.get(key)
      if (!m || i === undefined) return
      const node = m.nodes[i]
      if (node.kind === 'pieza' && node.item) {
        if (me) dispatch({ t: 'touch', userId: me.id, itemId: node.item.id, kind: 'click', at: new Date().toISOString() })
        openLectura(node.item.slug, rect)
      } else if (node.kind === 'mercado' && node.listing && node.franja) {
        router.push(`/mercado?franja=${encodeURIComponent(node.franja.slug)}&pieza=${encodeURIComponent(node.listing.id)}`)
      } else if (node.kind === 'franja' && node.franja) {
        router.push(`/f/${node.franja.slug}`)
      }
    },
    [dispatch, me, openLectura, router],
  )

  const openPiece = useCallback(
    (item: ContentItem, rect: ScreenRect | null) => {
      if (me) dispatch({ t: 'touch', userId: me.id, itemId: item.id, kind: 'click', at: new Date().toISOString() })
      openLectura(item.slug, rect)
    },
    [dispatch, me, openLectura],
  )

  const focusFranja = useCallback((slug: string | null) => {
    setFoco(slug)
    setFranjasOpen(false)
    editUrl((sp) => {
      if (slug) sp.set('foco', slug)
      else sp.delete('foco')
      sp.delete('focus')
    }, 'push')
  }, [])

  const toggleAfinidad = useCallback(() => {
    const next = !afinidad
    setAfinidad(next)
    editUrl((sp) => (next ? sp.set('afinidad', '1') : sp.delete('afinidad')), 'replace')
  }, [afinidad])

  const writeHidden = (next: Set<string>) => {
    setHidden(next)
    editUrl((sp) => (next.size ? sp.set('ocultar', [...next].sort().join(',')) : sp.delete('ocultar')), 'replace')
  }
  const toggleHidden = (k: string) => {
    const next = new Set(hidden)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    writeHidden(next)
  }

  // Back / Forward walk the focus history; view settings stay as they are.
  const settingsRef = useRef({ afinidad, hidden })
  settingsRef.current = { afinidad, hidden }
  useEffect(() => {
    const onPop = () => {
      const sp = new URL(window.location.href).searchParams
      setFoco(sp.get('foco') ?? sp.get('focus'))
      const { afinidad: a, hidden: h } = settingsRef.current
      editUrl((p) => {
        if (a) p.set('afinidad', '1')
        else p.delete('afinidad')
        if (h.size) p.set('ocultar', [...h].sort().join(','))
        else p.delete('ocultar')
      }, 'replace')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // A ?foco= that names a franja with no land yet: say so once, stay global
  // (it resolves to no cluster), and drop it from the address.
  const told = useRef<string | null>(null)
  useEffect(() => {
    if (!layout || !foco || clusterBySlug.has(foco) || told.current === foco) return
    told.current = foco
    const f = franjas.find((x) => x.slug === foco)
    notify(f ? `${f.title} aún no firma piezas en el territorio. Su dossier sí existe.` : 'Esa franja no está en el territorio.')
    editUrl((sp) => {
      sp.delete('foco')
      sp.delete('focus')
    }, 'replace')
  }, [layout, foco, clusterBySlug, franjas, notify])

  // ── the GL window ─────────────────────────────────────────────────────────

  const hooks = useRef({ activate })
  hooks.current = { activate }

  useStageWindow(rootRef, (el) => {
    if (!getStage().renderer) {
      setGlOk(false)
      return null
    }
    setGlOk(true)
    const c = new TerrainController(el, {
      onChip: (k, keyboard) => {
        kbCell.set(keyboard)
        chipCell.set(k)
      },
      onActivate: (k, rect) => hooks.current.activate(k, rect),
      onZoom: (z) => {
        const el = readoutRef.current
        if (el) el.textContent = `${Math.round(z * 100)}%`
      },
      onCaptions: (keys) => startTransition(() => setCaptionKeys(keys)),
      onInteract: () => {
        setFranjasOpen(false)
        setHelpOpen(false)
      },
    })
    ctlRef.current = c
    setCtl(c)
    // Development handle for inspection and headless verification.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __territorio?: TerrainController }).__territorio = c
    return {
      order: -10,
      render: (ctx) => c.render(ctx),
      dispose: () => {
        c.dispose()
        if (ctlRef.current === c) ctlRef.current = null
        setCtl((cur) => (cur === c ? null : cur))
      },
    }
  })

  useEffect(() => {
    ctl?.registerChip(chipEl.current)
  }, [ctl])

  const registerCaption = useCallback((k: string, el: HTMLElement | null) => ctlRef.current?.registerCaption(k, el), [])

  const narrow = vp.w <= 760
  const insets = useMemo<Insets>(
    () =>
      narrow
        ? { top: 112, right: 10, bottom: 136 + (focusCluster ? Math.min(vp.h * 0.4, 260) : 0), left: 10 }
        : { top: 74, right: 244, bottom: vp.w <= 900 ? 136 : 90, left: 22 + (focusCluster ? 266 : 0) },
    [narrow, vp.w, vp.h, focusCluster],
  )

  // Model + view → controller. The first camera is framed on the first frame.
  const appliedModel = useRef<TerrainModel | null>(null)
  const booted = useRef(false)
  useEffect(() => {
    if (!ctl || !model || !view) return
    ctl.setInsets(insets)
    if (appliedModel.current !== model) {
      ctl.setModel(model)
      appliedModel.current = model
    }
    ctl.setView(view, booted.current)
    if (!booted.current) {
      booted.current = true
      const box = focusArr ? focusArr.bbox : view.bounds
      const focused = Boolean(focusArr)
      // On a phone the whole land would print as flat energy: start closer.
      const minZ = narrow ? 0.12 : undefined
      ctl.arrive(() => (focused ? ctl.frameFor(box, { maxZ: 1.1 }) : ctl.frameFor(box, { maxZ: 0.7, pad: 8, minZ })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl, model, view, insets, focusArr])

  // Mode changes carry the camera with the land.
  const mode = focusCluster ? `f:${focusCluster.franja.slug}` : continents ? 'a' : 'g'
  const prevMode = useRef<string | null>(null)
  useEffect(() => {
    if (!ctl || !view || !booted.current) return
    if (prevMode.current === null) {
      prevMode.current = mode
      return
    }
    if (prevMode.current === mode) return
    prevMode.current = mode
    if (focusArr) ctl.flyTo(ctl.frameFor(focusArr.bbox, { maxZ: 1.1 }), 0.95)
    else ctl.flyTo(ctl.frameFor(view.bounds, { maxZ: 0.7, pad: 8 }), 0.9)
  }, [ctl, view, mode, focusArr])

  // Coastlines ride their continents; the focus ring waits for the gather.
  useEffect(() => {
    if (!ctl || !model) return
    if (!continents) {
      ctl.setRibbons('coast', [], false)
      return
    }
    const groups: RibbonGroup[] = continents.continents.map((c) => {
      const mover = c.itemIds.find((id) => continents.deltas[id])
      const d = mover ? continents.deltas[mover] : { dx: 0, dy: 0 }
      const loops = outlineLoops(c.cells, R).map((l) => insetLoop(l, -GAP * 1.9).map((p) => ({ x: p.x - d.dx, y: p.y - d.dy })))
      return { loops, rider: mover ? (model.byKey.get(mover) ?? -1) : -1 }
    })
    ctl.setRibbons('coast', groups, true, 0.15, continents.continents.map((c) => c.itemIds[0]).join('|'))
  }, [ctl, model, continents])

  useEffect(() => {
    if (!ctl) return
    if (!focusArr || !members) {
      ctl.setRibbons('ring', [], false)
      return
    }
    const cells = [
      ...focusArr.identityCells,
      ...focusArr.derived.placed.filter((p) => members.has(p.item.id)).flatMap((p) => p.cells),
      ...focusArr.listings.map((l) => l.cell),
    ]
    const loops = outlineLoops(cells, R).map((l) => insetLoop(l, -GAP * 2.6))
    ctl.setRibbons('ring', [{ loops, rider: -1 }], true, 0.95, `ring:${focusCluster?.franja.slug}:${cells.length}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctl, focusArr, members])

  // ── keyboard ──────────────────────────────────────────────────────────────

  const walk = (k: string, alt: boolean) => {
    const c = ctlRef.current
    if (!c || !navLayout) return
    const dir = k === 'ArrowUp' ? DIR_N : k === 'ArrowDown' ? DIR_S : k === 'ArrowRight' ? (alt ? DIR_NE : DIR_SE) : alt ? DIR_SW : DIR_NW
    const from = c.cursorKey
    if (!from || !navLayout.placed.some((p) => p.item.id === from) || hiddenIds?.has(from)) {
      const start = c.centralKey()
      if (start) {
        c.setCursor(start, true)
        c.ensureVisible(start)
      }
      return
    }
    let cur = from
    for (let hop = 0; hop < 10; hop++) {
      const next = neighborItemId(navLayout, cur, dir)
      if (!next) return
      if (!hiddenIds?.has(next)) {
        c.setCursor(next, true)
        c.ensureVisible(next)
        return
      }
      cur = next
    }
  }

  // Escape, from anywhere on the surface: help → franjas → capas → focus.
  const onEscape = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    if (helpOpen) setHelpOpen(false)
    else if (franjasOpen) setFranjasOpen(false)
    else if (capasOpen) setCapasOpen(false)
    else if (focusCluster) focusFranja(null)
    else return
    e.preventDefault()
  }

  // The terrain itself: arrows walk neighbours, Enter opens, ± zoom, 0 frames.
  const onTerrainKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const c = ctlRef.current
    if (!c) return
    if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      walk(e.key, e.altKey)
    } else if (e.key === 'Enter' || e.key === ' ') {
      const k = c.cursorKey
      if (k) {
        e.preventDefault()
        activate(k, c.nodeRect(k))
      }
    } else if (e.key === '+' || e.key === '=') {
      c.zoomBy(1.4)
    } else if (e.key === '-' || e.key === '_') {
      c.zoomBy(1 / 1.4)
    } else if (e.key === '0') {
      fit()
    }
  }

  const fit = () => {
    const c = ctlRef.current
    if (!c || !view) return
    if (focusArr) c.flyTo(c.frameFor(focusArr.bbox, { maxZ: 1.1 }), 0.7)
    else c.flyTo(c.frameFor(view.bounds, { maxZ: 0.7, pad: 8 }), 0.7)
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (glOk === false) {
    return (
      <div className={styles.root} data-fallback="">
        <Barra status="Vista de lista" detail={`${terrain.length} piezas`} minimal />
        <Lista items={orderedPieces} archive={(it) => isArchive(it, bucket)} onOpen={openPiece} />
      </div>
    )
  }

  return (
    <div ref={rootRef} className={styles.root} onKeyDown={onEscape}>
      <div
        ref={landRef}
        className={styles.terrain}
        tabIndex={0}
        role="application"
        aria-roledescription="territorio"
        aria-label="Territorio: el archivo de Gradiente como terreno hexagonal"
        aria-describedby="territorio-instrucciones"
        onKeyDown={onTerrainKey}
        onFocus={(e) => {
          if (!e.currentTarget.matches(':focus-visible')) return
          const c = ctlRef.current
          if (c && !c.cursorKey) {
            const start = c.centralKey()
            if (start) c.setCursor(start, true)
          }
        }}
      />
      <p id="territorio-instrucciones" className="sr-only">
        Flechas para recorrer piezas vecinas (con Alt, las otras diagonales), Enter para abrir, más y menos para acercar, cero para encuadrar,
        Escape para salir del enfoque. El índice de piezas está al final.
      </p>

      {model ? <Rotulos keys={captionKeys} model={model} register={registerCaption} /> : null}
      <Ficha
        focus={chipCell}
        keyboard={kbCell}
        model={model}
        itemsById={itemsById}
        now={now}
        chipRef={(el) => {
          chipEl.current = el
        }}
      />

      <Barra
        status={status}
        detail={model ? st.detail : ''}
        franjasOpen={franjasOpen}
        onFranjas={() => {
          setFranjasOpen((o) => !o)
          setHelpOpen(false)
        }}
        capasOpen={capasOpen}
        onCapas={() => setCapasOpen((o) => !o)}
        helpOpen={helpOpen}
        onHelp={() => {
          setHelpOpen((o) => !o)
          setFranjasOpen(false)
        }}
        focusActive={Boolean(focusCluster)}
        picker={
          franjasOpen ? (
            <FranjaPicker
              landed={landed}
              dormant={dormant}
              current={focusCluster?.franja.slug ?? null}
              onPick={(slug) => focusFranja(slug === focusCluster?.franja.slug ? null : slug)}
              onClose={() => setFranjasOpen(false)}
            />
          ) : null
        }
        help={helpOpen ? <Ayuda onClose={() => setHelpOpen(false)} /> : null}
      />

      <Capas
        counts={counts}
        mercado={mercadoCount}
        era={era}
        hidden={hidden}
        onToggle={toggleHidden}
        onShowAll={() => writeHidden(new Set())}
        afinidad={afinidad}
        continents={continents?.continents.length ?? null}
        focusActive={Boolean(focusCluster)}
        onAfinidad={toggleAfinidad}
        open={capasOpen}
        onClose={() => setCapasOpen(false)}
      />

      {focusCluster ? (
        <Tira
          key={focusCluster.franja.slug}
          franja={focusCluster.franja}
          members={focusMembers}
          listings={focusArr?.listings.length ?? 0}
          related={relatedFranjas}
          now={now}
          onFocus={(slug) => focusFranja(slug)}
          onExit={() => focusFranja(null)}
        />
      ) : null}

      <Dock readout={readoutRef} onZoom={(f) => ctlRef.current?.zoomBy(f)} onFit={fit} fitLabel={focusCluster ? 'Encuadrar la franja' : 'Encuadrar todo el territorio'} />

      <Indice items={orderedPieces} onOpen={openPiece} />
    </div>
  )
}
