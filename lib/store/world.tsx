'use client'

/**
 * React binding for the world core. One store per provider (never a module
 * singleton — the server renders many requests).
 *
 * The world arrives with the page: the root layout reads the server snapshot
 * (the public world every member shares, plus the viewer's private rows) and
 * hands it here, so the first paint — server and client alike — already
 * holds the real world. What the person does is applied on top at once
 * (`dispatch`) and handed to the write seam (effects.ts). When the server
 * sends a newer snapshot (router.refresh() — see refresh.ts —, a sign-in),
 * the world is rebuilt on it and the actions the server doesn't have yet are
 * replayed over it. /central lays Central's ledgers in while it is open
 * (`attachAdmin`).
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { ContentItem } from '@/lib/types'
import { initWorld, reduce, type Action, type ActionType, type World } from './world-core'
import type { AdminWorld, PrivateWorld, PublicWorld } from './snapshot'
import { EffectError, effectFor, effectOptions } from './effects'
import { knownIds, remapIds, rememberIds } from './ids'
import { refreshOnVisible, requestRefresh, setRefresher } from './refresh'
import { readSeenWatermark } from './device'
// The backend calls for each action type register themselves on import.
import './efectos'
import { useUI } from './ui'

export { newUuid } from './ids'

export interface WorldState {
  world: World
  /**
   * This session's actions that a server snapshot doesn't contain yet, oldest
   * first: in flight, confirmed after the snapshot was read, device-local
   * (kept for the session), or without a backend (those last until a reload).
   * Nothing is persisted.
   */
  log: Action[]
  /** Always true: the world comes with the page. Kept for the surfaces that used to wait for a replay. */
  hydrated: boolean
  dispatch: (a: Action) => void
  /** Rebuild on a newer server snapshot and replay what it doesn't contain yet. */
  rebase: (pub: PublicWorld, priv: PrivateWorld | null) => void
  /** Lay Central's ledgers in (an admin on /central), or take them out (null). */
  attachAdmin: (admin: AdminWorld | null) => void
}

type Settle = { s: 'local' | 'pending' | 'confirmed'; at: number }

/**
 * Which snapshot holds an action's row once the server has it — a confirmed
 * action leaves the log when THAT snapshot is read after its confirmation.
 * Everything not listed lands in the public world.
 */
const PRIVATE_ROWS = new Set<ActionType>(['save', 'save-comment', 'draft-save', 'draft-delete', 'follow', 'profile', 'report', 'report-resolve'])
const ADMIN_ROWS = new Set<ActionType>(['invite', 'waitlist-status', 'waitlist-delete'])

/** An earlier action this one makes redundant (only ever dropped when it never reached a backend, or lives on this device only). */
function supersedes(next: Action, prev: Action): boolean {
  if (prev.t === 'seen') return next.t === 'seen' && next.userId === prev.userId
  if (prev.t !== 'draft-save') return false
  const id = prev.draft.id
  return (next.t === 'draft-save' && next.draft.id === id) || (next.t === 'draft-delete' && next.id === id) || (next.t === 'publish' && next.draftId === id)
}

/** The store behind WorldProvider (exported for tests; components use the provider). */
export function createWorldStore(pub: PublicWorld, priv: PrivateWorld | null): StoreApi<WorldState> {
  let snapPub = pub
  let snapPriv = priv
  let snapAdmin: AdminWorld | null = null
  let base = initWorld(pub, priv)
  const settled = new WeakMap<Action, Settle>()

  // Under the server's names for rows it named itself (a report's id):
  // an action logged before the name was known replays with it.
  const replay = (log: Action[]): World => {
    const ids = knownIds()
    return log.reduce((w, a) => {
      try {
        return reduce(w, remapIds(a, ids))
      } catch (err) {
        console.error(`[world] «${a.t}» no se pudo reaplicar sobre la instantánea nueva:`, err)
        return w
      }
    }, base)
  }

  /** Confirmed, and the snapshot that holds its row was read after that (a cached snapshot carries the instant it was read, not the instant it was served). */
  const inSnapshot = (a: Action, reads: { pub?: number; priv?: number; admin?: number }): boolean => {
    const st = settled.get(a)
    if (!st || st.s !== 'confirmed') return false
    const read = ADMIN_ROWS.has(a.t) ? reads.admin : PRIVATE_ROWS.has(a.t) ? reads.priv : reads.pub
    return read !== undefined && st.at <= read
  }

  return createStore<WorldState>((set, get) => ({
    world: base,
    log: [],
    hydrated: true,

    dispatch: (raw) => {
      // A row the server has renamed is referred to by its server name from now on.
      const a = remapIds(raw, knownIds())
      const before = get().world
      const after = reduce(before, a)
      const log = get().log.filter((x) => settled.get(x)?.s !== 'local' || !supersedes(a, x))
      set({ world: after, log: [...log, a] })

      const fx = effectFor(a.t)
      if (!fx) {
        settled.set(a, { s: 'local', at: Date.now() })
        if (process.env.NODE_ENV === 'development') console.warn('[world] sin backend todavía:', a.t)
        return
      }
      const local = Boolean(effectOptions(a.t).local)
      settled.set(a, { s: local ? 'local' : 'pending', at: Date.now() })
      let run: Promise<unknown>
      try {
        run = Promise.resolve(fx(a, { before, after }))
      } catch (err) {
        run = Promise.reject(err)
      }
      run.then(
        (result) => {
          if (local) return
          settled.set(a, { s: 'confirmed', at: Date.now() })
          const ids = result && typeof result === 'object' ? (result as { ids?: Record<string, string> }).ids : undefined
          if (ids && Object.keys(ids).length) {
            rememberIds(ids)
            set({ world: replay(get().log) })
          }
        },
        (err) => {
          if (local) {
            console.warn(`[world] «${a.t}» no se guardó en este dispositivo:`, err)
            return
          }
          console.error(`[world] «${a.t}» no llegó al servidor; se deshace:`, err)
          const rest = get().log.filter((x) => x !== a)
          set({ log: rest, world: replay(rest) })
          useUI.getState().notify(err instanceof EffectError ? err.userMessage : 'No se pudo guardar. El cambio se deshizo.', { tone: 'error' })
        },
      )
    },

    rebase: (nextPub, nextPriv) => {
      if (nextPub === snapPub && nextPriv === snapPriv) return
      const sameViewer = (nextPriv?.me.id ?? null) === (snapPriv?.me.id ?? null)
      snapPub = nextPub
      snapPriv = nextPriv
      // Central's ledgers belong to the person who opened /central.
      if (!sameViewer || !nextPriv) snapAdmin = null
      base = initWorld(nextPub, nextPriv, snapAdmin)
      // A different person: nothing carries over.
      const log = sameViewer ? get().log.filter((a) => !inSnapshot(a, { pub: nextPub.at, priv: nextPriv?.at })) : []
      set({ log, world: replay(log) })
    },

    attachAdmin: (admin) => {
      if (admin === snapAdmin) return
      if (admin && !snapPriv) return
      snapAdmin = admin
      base = initWorld(snapPub, snapPriv, snapAdmin)
      const log = admin ? get().log.filter((a) => !inSnapshot(a, { admin: admin.at })) : get().log
      set({ log, world: replay(log) })
    },
  }))
}

const WorldContext = createContext<StoreApi<WorldState> | null>(null)
const NowContext = createContext<number>(0)

/** A world older than the public cache's window (lib/data/world.ts WORLD_REVALIDATE_S) is read again when the tab is looked at. */
const STALE_AFTER_MS = 300_000

export function WorldProvider({
  now,
  publicWorld,
  privateWorld,
  children,
}: {
  now: number
  /** The shared snapshot (empty for anonymous visitors). */
  publicWorld: PublicWorld
  /** The viewer's own rows, `me` included; null when nobody is signed in. */
  privateWorld: PrivateWorld | null
  children: ReactNode
}) {
  const ref = useRef<StoreApi<WorldState> | null>(null)
  if (!ref.current) ref.current = createWorldStore(publicWorld, privateWorld)
  const router = useRouter()

  // A newer snapshot from the server (the layout re-rendered: router.refresh,
  // a sign-in). Before paint, so nothing flashes the old world.
  useLayoutEffect(() => {
    ref.current?.getState().rebase(publicWorld, privateWorld)
  }, [publicWorld, privateWorld])

  // Effects ask for the server's truth through refresh.ts; this is what answers.
  useEffect(() => {
    setRefresher(() => router.refresh())
    return () => setRefresher(null)
  }, [router])

  // Coming back to the tab: a refresh held back while it was hidden goes now,
  // and a world older than the public cache's window is read again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refreshOnVisible()
      const seed = ref.current?.getState().world.seedNow ?? Date.now()
      if (Date.now() - seed > STALE_AFTER_MS) requestRefresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // The activity watermark lives on this device (device.ts): once the viewer
  // is known, the world takes it from there.
  const viewer = privateWorld?.me.id ?? null
  useEffect(() => {
    const store = ref.current
    if (!viewer || !store) return
    const stored = readSeenWatermark(viewer)
    if (stored && stored > (store.getState().world.activitySeen[viewer] ?? '')) store.getState().dispatch({ t: 'seen', userId: viewer, at: stored })
  }, [viewer])

  // The clock: starts at the server's instant, then walks with real time.
  // HL decay is lazy math over this value — the organism ages while you look.
  const [clock, setClock] = useState(now)
  useEffect(() => {
    const tick = () => setClock(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])

  return (
    <WorldContext.Provider value={ref.current}>
      <NowContext.Provider value={clock}>{children}</NowContext.Provider>
    </WorldContext.Provider>
  )
}

export function useWorldStore(): StoreApi<WorldState> {
  const s = useContext(WorldContext)
  if (!s) throw new Error('WorldProvider missing')
  return s
}

export function useWorld<T>(selector: (s: WorldState) => T): T {
  return useStore(useWorldStore(), selector)
}

export function useDispatch() {
  return useWorld((s) => s.dispatch)
}

/** Milliseconds; ticks every 30 s after hydration. */
export function useNowMs(): number {
  return useContext(NowContext)
}

export function useNow(): Date {
  const ms = useNowMs()
  const ref = useRef<{ ms: number; d: Date } | null>(null)
  if (!ref.current || ref.current.ms !== ms) ref.current = { ms, d: new Date(ms) }
  return ref.current.d
}

// ── derived: the items, in order ────────────────────────────────────────────
//
// Each item already carries its crowd aggregate (the server's, moved by the
// viewer's own reading in the reducer), so this is just the ordered list.

let memo: { items: World['items']; order: string[]; out: ContentItem[] } | null = null

export function itemsWithCrowd(w: World): ContentItem[] {
  if (memo && memo.items === w.items && memo.order === w.order) return memo.out
  const out: ContentItem[] = []
  for (const id of w.order) {
    const it = w.items[id]
    if (it) out.push(it)
  }
  memo = { items: w.items, order: w.order, out }
  return out
}

/** Memoized on (items, order) — unrelated world changes don't re-render. */
export function useItems(): ContentItem[] {
  return useWorld((s) => itemsWithCrowd(s.world))
}

export function useItemBySlug(slug: string | null | undefined): ContentItem | null {
  const items = useItems()
  if (!slug) return null
  return items.find((i) => i.slug === slug) ?? null
}

export function useItemById(id: string | null | undefined): ContentItem | null {
  const items = useItems()
  if (!id) return null
  return items.find((i) => i.id === id) ?? null
}

export function useUser(id: string | null | undefined) {
  return useWorld((s) => (id ? s.world.users[id] ?? null : null))
}

/**
 * A readable id for client-created records whose table keeps a text id the
 * client proposes (marketplace listings `mkl-…`) or that the server renames
 * (reports). Rows in uuid columns (comments, foro posts, listing questions,
 * polls) use `newUuid()` instead — see ids.ts.
 */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
