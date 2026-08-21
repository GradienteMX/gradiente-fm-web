'use client'

// ── GUARDADOS — the ONE faceted collection (FINAL_SPEC §3.3 · WP6) ──────────
//
// One widget owns the entire saved universe. Items come from the provider's
// `saves` slice; the COMENTARIOS facet from its `savedComments` slice — the
// widget never fetches. Facets are pure client-side lenses (chips: TODO ·
// EVENTOS · MIXES · ARTÍCULOS · NOTICIAS · RESEÑAS · COMENTARIOS — §3.3
// exactly; ARTÍCULOS folds articulo/editorial/opinion per the §7.5 legacy
// map, ahead of the planned type merge).
//
// Ordering is TRULY most-recently-saved: user_saves.saved_at through the
// upgraded itemSavesCache Map (getSavedItemEntries) — never a publishedAt
// proxy. Entries without a known saved_at sink to the end, newest-published
// first (honest fallback, not a fake timestamp).
//
// QUITAR is always visible (never hover-only) and optimistic: the ONE
// HP-emitting path is lib/saves.ts toggleSavedItem (comments:
// lib/comments.ts toggleSavedComment) — this widget never touches the HP
// event ledger itself. Instead of a confirm, a 6s «DESHECHO · RESTAURAR»
// chip holds the
// row's place; RESTAURAR re-toggles through the same single path (and no
// celebratory animation on re-save — farming hygiene).
//
// The rail is CSS scroll-snap with a half-peeking next card, wheel/trackpad
// momentum, arrow nudges, and a mono «04/12» position readout. Open = 1
// click in place via lib/dashboard/openItem. The `?guardados=<facet>` param
// (written by the §7.5 legacy dispatch in page.tsx) preselects a facet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { useOpenItem } from '@/lib/dashboard/openItem'
import {
  PANEL_SCRIM,
  PANEL_SCRIM_GRADIENT,
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'
import { getSavedItemEntries } from '@/lib/itemSavesCache'
import { toggleSavedItem } from '@/lib/saves'
import { toggleSavedComment } from '@/lib/comments'
import { categoryColor } from '@/lib/utils'
import { SmartImage } from '@/components/SmartImage'
import type { Comment, ContentItem, ContentType } from '@/lib/types'

const UNDO_MS = 6_000
const NOTICE_MS = 4_000
// Tailwind gap-3 on the rail — keep in sync with the class below.
const RAIL_GAP_PX = 12

// ── Facets (§3.3 — the exact chip set) ──────────────────────────────────────

type FacetKey =
  | 'todo'
  | 'eventos'
  | 'mixes'
  | 'articulos'
  | 'noticias'
  | 'resenas'
  | 'comentarios'

const FACETS: ReadonlyArray<{ key: FacetKey; label: string }> = [
  { key: 'todo', label: 'TODO' },
  { key: 'eventos', label: 'EVENTOS' },
  { key: 'mixes', label: 'MIXES' },
  { key: 'articulos', label: 'ARTÍCULOS' },
  { key: 'noticias', label: 'NOTICIAS' },
  { key: 'resenas', label: 'RESEÑAS' },
  { key: 'comentarios', label: 'COMENTARIOS' },
]

const FACET_TYPES: Partial<Record<FacetKey, readonly ContentType[]>> = {
  eventos: ['evento'],
  mixes: ['mix'],
  articulos: ['articulo', 'editorial', 'opinion'],
  noticias: ['noticia'],
  resenas: ['review'],
}

function itemMatchesFacet(item: ContentItem, facet: FacetKey): boolean {
  if (facet === 'todo') return true
  if (facet === 'comentarios') return false
  const types = FACET_TYPES[facet]
  return !!types && types.includes(item.type)
}

function isFacetKey(raw: string | null): raw is FacetKey {
  return !!raw && FACETS.some((f) => f.key === raw)
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true })
  } catch {
    return ''
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// ── Rail tiles ──────────────────────────────────────────────────────────────

// ── Tile vertical budget ────────────────────────────────────────────────────
// On the md+ grid, layout.ts pins GUARDADOS to h2 ({7,2}/{12,2} only):
//   2×96px rows + 24px gutter               = 216px widget
//   − frame chrome (2 border + 51 header + 32 content padding) = 131px content
//   − facet strip (24px chips + ≤17px scrollbar) − 8px gap     = ~82px rail
//   − ≤17px rail scrollbar                                     ≈ 65px viewport
// Tiles therefore fill h-full at md+ (no forced min-h) with a compact
// composition whose glyph minimum is 60px — 1-line d15 title (22) + pb 4 +
// meta row (28px QUITAR chip + 6 pb = 34). Only the transparent 28px scrim
// ramp ever clips (justify-end + overflow-hidden slice top-first), so no
// glyph is ever cut. min-h-28 survives ONLY below md — the mobile 1-col
// stack, where widget height is intrinsic (unbounded) and the roomier
// 2-line composition needs the floor.
const TILE_SIZING =
  'h-full min-h-28 md:min-h-0 w-[28%] min-w-[180px] max-w-[240px] shrink-0 snap-start'

function SavedCard({
  item,
  savedAt,
  onOpen,
  onRemove,
}: {
  item: ContentItem
  savedAt: string | null
  onOpen: () => void
  onRemove: () => void
}) {
  const hasArt = !!item.imageUrl
  return (
    // Printed photograph on cream (§1.7): dark object, 1px ink border; the
    // rail gap + widget padding are its mat.
    <article
      className={`relative flex flex-col overflow-hidden border border-ink bg-panel ${TILE_SIZING}`}
    >
      {item.imageUrl && (
        <SmartImage
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          sizes="240px"
        />
      )}
      {/* Bottom-seated ink gradient — artwork breathes above; text sits on a
          ≥0.94-alpha ink slab. The 28px fade ramp is padding-only (pt-7 =
          PANEL_SCRIM_RAMP_PX), so no glyph ever rides it: worst case
          (panel-text over pure-white art) measures 13.8:1, dark art ≈15.9:1.
          Cards without artwork keep the full panel ground. */}
      <button
        type="button"
        onClick={onOpen}
        data-cue="tick"
        className={`relative flex min-h-0 w-full flex-1 flex-col justify-end overflow-hidden text-left ${FOCUS_RING}`}
      >
        <div
          className="flex w-full flex-col items-start gap-1 px-2 pb-1 pt-7"
          style={hasArt ? { background: PANEL_SCRIM_GRADIENT } : undefined}
        >
          {/* Full type row (swatch + code + Spanish label) only where the
              mobile min-h-28 floor guarantees room; at md+ (h2-bound rail)
              the type folds into the meta row as swatch + code. */}
          <span className="flex items-center gap-1.5 md:hidden">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0"
              // Dark-ground category map — this is a black panel (§1.6a).
              style={{ backgroundColor: categoryColor(item.type) }}
            />
            {/* Swatch + 2-letter code + Spanish label: hue never the sole
                channel; never a raw enum. */}
            <span className="font-mono text-d11 uppercase tracking-widest text-panel-text">
              {typeCode(item.type)} · {typeDisplayLabel(item.type)}
            </span>
          </span>
          {/* 1-line at md: the h2 rail's 60px glyph budget (see TILE_SIZING). */}
          <span className="line-clamp-2 font-grotesk text-d15 font-medium text-panel-text md:line-clamp-1">
            {item.title}
          </span>
        </div>
      </button>
      <div
        className="relative flex shrink-0 items-center justify-between gap-2 px-2 pb-1.5"
        style={hasArt ? { background: PANEL_SCRIM } : undefined}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="hidden h-2.5 w-2.5 shrink-0 md:block"
            style={{ backgroundColor: categoryColor(item.type) }}
          />
          {/* Swatch + 2-letter code: hue never the sole channel. */}
          <span className="hidden shrink-0 font-mono text-d11 uppercase tracking-widest text-panel-text md:block">
            {typeCode(item.type)}
          </span>
          <span className="truncate font-mono text-d11 text-panel-text">
            {timeAgo(savedAt)}
          </span>
        </span>
        {/* Always visible, touch-safe — never hover-only (§3.3). A bordered
            outline chip (28px visible box); the ::before pad extends the hit
            area to ≥44px on every input. */}
        <button
          type="button"
          onClick={onRemove}
          data-cue="latch"
          className={`relative flex h-7 shrink-0 items-center border border-panel-text px-1.5 font-mono text-d13 uppercase tracking-widest text-panel-text before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:bg-panel-text hover:text-panel ${FOCUS_RING}`}
        >
          QUITAR
        </button>
      </div>
    </article>
  )
}

function UndoCard({ title, onRestore }: { title: string; onRestore: () => void }) {
  return (
    <div
      className={`flex flex-col items-start justify-between border border-ink bg-paper p-2 ${TILE_SIZING}`}
    >
      {/* 1-line at md — same h2 rail budget as SavedCard (see TILE_SIZING). */}
      <span className="line-clamp-2 font-grotesk text-d13 text-ink-faint md:line-clamp-1">
        {title}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-d13 uppercase tracking-widest text-ink">
          DESHECHO
        </span>
        <span aria-hidden className="font-mono text-d13 text-ink-faint">
          ·
        </span>
        <button
          type="button"
          onClick={onRestore}
          data-cue="stamp"
          className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline underline-offset-4 md:min-h-0 ${FOCUS_RING}`}
        >
          RESTAURAR
        </button>
      </div>
    </div>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

type RailEntry =
  | { kind: 'card'; item: ContentItem }
  | { kind: 'undo'; item: ContentItem }

type CommentEntry =
  | { kind: 'row'; comment: Comment }
  | { kind: 'undo'; comment: Comment }

export function GuardadosWidget({ compact }: DashboardWidgetProps) {
  const router = useRouter()
  const search = useSearchParams()
  const openItem = useOpenItem()
  const { saves, savedComments, loaded } = useDashboardData()

  const [facet, setFacet] = useState<FacetKey>('todo')

  // §7.5 legacy dispatch preselect: page.tsx resolves `?section=` into
  // `?guardados=<facet>`; adopt it whenever it (re)appears.
  const facetParam = search?.get('guardados') ?? null
  useEffect(() => {
    if (isFacetKey(facetParam)) setFacet(facetParam)
  }, [facetParam])

  // ── True saved_at ordering (§3.3 binding upgrade) ─────────────────────────
  // `saves` re-emits on every cache change, so reading the entries Map inside
  // this memo stays current. Unknown saved_at sinks below known, newest-
  // published first — an honest fallback, never a fabricated timestamp.
  const orderedItems = useMemo(() => {
    const entries = getSavedItemEntries()
    return [...saves].sort((a, b) => {
      const sa = entries.get(a.id) ?? null
      const sb = entries.get(b.id) ?? null
      if (sa && sb) return sb.localeCompare(sa)
      if (sa) return -1
      if (sb) return 1
      return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
    })
  }, [saves])

  // Snapshot of saved_at per rendered item — recomputed whenever the saves
  // slice re-emits (every cache change re-renders the provider slice).
  const savedAtById = useMemo(() => {
    const entries = getSavedItemEntries()
    const map = new Map<string, string | null>()
    for (const item of saves) map.set(item.id, entries.get(item.id) ?? null)
    return map
  }, [saves])

  // Most-recent first for display (the hook sorts createdAt asc).
  const commentsDesc = useMemo(
    () => [...savedComments.comments].reverse(),
    [savedComments.comments],
  )

  // ── 6s undo tombstones (in place of a confirm) ────────────────────────────
  const [removedItems, setRemovedItems] = useState<{ item: ContentItem; index: number }[]>([])
  const [removedComments, setRemovedComments] = useState<
    { comment: Comment; index: number }[]
  >([])
  const timersRef = useRef(new Map<string, number>())
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  const removeItem = useCallback((item: ContentItem, index: number) => {
    // The ONE HP-emitting path — optimistic, API-confirmed, self-rollback.
    void toggleSavedItem(item.id)
    setRemovedItems((prev) => [
      ...prev.filter((r) => r.item.id !== item.id),
      { item, index },
    ])
    const timer = window.setTimeout(() => {
      setRemovedItems((prev) => prev.filter((r) => r.item.id !== item.id))
      timersRef.current.delete(`item:${item.id}`)
    }, UNDO_MS)
    timersRef.current.set(`item:${item.id}`, timer)
  }, [])

  const restoreItem = useCallback((item: ContentItem) => {
    const key = `item:${item.id}`
    const timer = timersRef.current.get(key)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(key)
    }
    setRemovedItems((prev) => prev.filter((r) => r.item.id !== item.id))
    void toggleSavedItem(item.id)
  }, [])

  const removeComment = useCallback((comment: Comment, index: number) => {
    void toggleSavedComment(comment.id)
    setRemovedComments((prev) => [
      ...prev.filter((r) => r.comment.id !== comment.id),
      { comment, index },
    ])
    const timer = window.setTimeout(() => {
      setRemovedComments((prev) => prev.filter((r) => r.comment.id !== comment.id))
      timersRef.current.delete(`comment:${comment.id}`)
    }, UNDO_MS)
    timersRef.current.set(`comment:${comment.id}`, timer)
  }, [])

  const restoreComment = useCallback((comment: Comment) => {
    const key = `comment:${comment.id}`
    const timer = timersRef.current.get(key)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(key)
    }
    setRemovedComments((prev) => prev.filter((r) => r.comment.id !== comment.id))
    void toggleSavedComment(comment.id)
  }, [])

  // ── Facet lenses ──────────────────────────────────────────────────────────
  const railEntries = useMemo<RailEntry[]>(() => {
    const out: RailEntry[] = orderedItems
      .filter((item) => itemMatchesFacet(item, facet))
      .map((item) => ({ kind: 'card' as const, item }))
    for (const removed of removedItems) {
      if (!itemMatchesFacet(removed.item, facet)) continue
      out.splice(Math.min(removed.index, out.length), 0, {
        kind: 'undo',
        item: removed.item,
      })
    }
    return out
  }, [orderedItems, removedItems, facet])

  const commentEntries = useMemo<CommentEntry[]>(() => {
    const out: CommentEntry[] = commentsDesc.map((comment) => ({
      kind: 'row' as const,
      comment,
    }))
    for (const removed of removedComments) {
      out.splice(Math.min(removed.index, out.length), 0, {
        kind: 'undo',
        comment: removed.comment,
      })
    }
    return out
  }, [commentsDesc, removedComments])

  const facetCount = useCallback(
    (key: FacetKey): number => {
      if (key === 'comentarios') return savedComments.comments.length
      return orderedItems.filter((item) => itemMatchesFacet(item, key)).length
    },
    [orderedItems, savedComments.comments.length],
  )

  // One honest total: the entire saved universe this widget owns.
  const total = saves.length + savedComments.comments.length

  // ── Rail position readout + arrows ────────────────────────────────────────
  const railRef = useRef<HTMLDivElement | null>(null)
  const [railPos, setRailPos] = useState({ index: 1, overflow: false })

  const measureRail = useCallback(() => {
    const el = railRef.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    // offsetWidth by house rule (getBoundingClientRect breaks under the CRT
    // boot transform in overlays; one habit everywhere).
    const step = first ? first.offsetWidth + RAIL_GAP_PX : 0
    const count = el.childElementCount
    const index =
      step > 0 ? Math.min(Math.max(1, Math.round(el.scrollLeft / step) + 1), count) : 1
    setRailPos({ index, overflow: el.scrollWidth > el.clientWidth + 4 })
  }, [])

  useEffect(() => {
    measureRail()
    window.addEventListener('resize', measureRail)
    return () => window.removeEventListener('resize', measureRail)
  }, [measureRail, railEntries.length, facet])

  const nudgeRail = useCallback((dir: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + RAIL_GAP_PX : el.clientWidth / 3
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  // Transient honest-failure notice (openItem returned false).
  const [notice, setNotice] = useState(false)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(false), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const openSaved = useCallback(
    (slug: string, commentId?: string) => {
      void openItem(slug, commentId ? { commentId } : undefined).then((ok) => {
        if (!ok) setNotice(true)
      })
    },
    [openItem],
  )

  const isLoading =
    !(loaded.saves === true && loaded.savedComments === true) &&
    total === 0 &&
    removedItems.length === 0 &&
    removedComments.length === 0
  const isEmpty = !isLoading && total === 0 && removedItems.length === 0 &&
    removedComments.length === 0

  // ── Compact teaching row (§2.5) ───────────────────────────────────────────
  if (compact) {
    return (
      <div id={dashWidgetDomId('guardados')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="GUARDADOS"
          compact
          loading={isLoading}
          action={{ label: 'IR AL INICIO →', onClick: () => router.push('/') }}
        >
          {/* Short enough to never ellipsize; no `truncate` — the frame's
              copy region is whitespace-normal and wraps inside the 96px row
              at narrow widths instead of cutting mid-word. */}
          <p className="font-mono text-d13 text-ink-soft">
            {'// '}NADA GUARDADO — toca ★ para guardar.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  return (
    <div id={dashWidgetDomId('guardados')} className="h-full scroll-mt-14">
    <WidgetFrame title="GUARDADOS" count={total > 0 ? total : undefined} loading={isLoading}>
      {isEmpty ? (
        <div className="flex h-full flex-col items-start justify-center gap-2">
          <p className="font-mono text-d13 text-ink-soft">
            {'// '}NADA GUARDADO — toca ★ en cualquier overlay para guardarlo aquí.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            data-cue="tick"
            className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
          >
            IR AL INICIO →
          </button>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2">
          {/* Facet chips (CUE/LATCH fill inversion) + position readout. */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Edge-fade mask instead of a hard clip: the strip dissolves over
                its last 24px; pr-6 headroom keeps the final chip clear of the
                fade at scroll end. Static mask — reduced-motion safe. */}
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,#000_0,#000_calc(100%-24px),transparent_100%)]">
              {FACETS.map((f) => {
                const active = facet === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFacet(f.key)}
                    data-cue="latch"
                    aria-pressed={active}
                    className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border border-ink px-1.5 py-0.5 font-mono text-d13 uppercase tracking-widest tabular-nums md:min-h-0 ${
                      active ? 'bg-ink text-paper' : 'text-ink hover:bg-paper'
                    } ${FOCUS_RING}`}
                  >
                    {/* The frame already prints the one honest total
                        («GUARDADOS 12») — TODO carries no second count. */}
                    {f.key === 'todo' ? f.label : `${f.label} ${facetCount(f.key)}`}
                  </button>
                )
              })}
            </div>
            {facet !== 'comentarios' && railEntries.length > 0 && (
              <div className="flex shrink-0 items-center gap-1.5">
                {railPos.overflow && (
                  <>
                    {/* 44px touch squares on mobile; desktop keeps the 24px
                        glyph (pointer input — meets the 24px AA minimum; a
                        hit-pad here would overlap the sibling arrow). */}
                    <button
                      type="button"
                      onClick={() => nudgeRail(-1)}
                      aria-label="Anterior"
                      data-cue="tick"
                      className={`flex h-11 w-11 items-center justify-center border border-ink font-mono text-d13 text-ink hover:bg-ink hover:text-paper md:h-6 md:w-6 ${FOCUS_RING}`}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeRail(1)}
                      aria-label="Siguiente"
                      data-cue="tick"
                      className={`flex h-11 w-11 items-center justify-center border border-ink font-mono text-d13 text-ink hover:bg-ink hover:text-paper md:h-6 md:w-6 ${FOCUS_RING}`}
                    >
                      ›
                    </button>
                  </>
                )}
                <span className="font-mono text-d13 tabular-nums text-ink-soft">
                  {pad2(railPos.index)}/{pad2(railEntries.length)}
                </span>
              </div>
            )}
          </div>

          {notice && (
            <p className="shrink-0 font-grotesk text-d13 text-ink">
              {'// '}NO DISPONIBLE — ese contenido ya no está publicado.
            </p>
          )}

          {/* ── Facet body ─────────────────────────────────────────────── */}
          {facet === 'comentarios' ? (
            commentEntries.length === 0 ? (
              <p className="font-mono text-d13 text-ink-soft">
                {'// '}SIN COMENTARIOS GUARDADOS — guárdalos desde cualquier hilo.
              </p>
            ) : (
              <div className="min-h-0 max-h-96 flex-1 overflow-y-auto md:max-h-none">
                {commentEntries.map((entry, index) => {
                  if (entry.kind === 'undo') {
                    return (
                      <div
                        key={`undo:${entry.comment.id}`}
                        className="flex min-h-11 items-center gap-2 border border-ink bg-paper px-2 py-1"
                      >
                        <span className="min-w-0 flex-1 truncate font-grotesk text-d13 text-ink-faint">
                          {entry.comment.body}
                        </span>
                        <span className="shrink-0 font-mono text-d13 uppercase tracking-widest text-ink">
                          DESHECHO
                        </span>
                        <span aria-hidden className="font-mono text-d13 text-ink-faint">
                          ·
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreComment(entry.comment)}
                          data-cue="stamp"
                          className={`min-h-11 shrink-0 font-mono text-d13 uppercase tracking-widest text-ink underline underline-offset-4 md:min-h-0 ${FOCUS_RING}`}
                        >
                          RESTAURAR
                        </button>
                      </div>
                    )
                  }
                  const comment = entry.comment
                  const parent = savedComments.itemsById.get(comment.contentItemId)
                  return (
                    <div key={comment.id} className="flex min-h-11 items-center gap-2 py-1">
                      {parent ? (
                        <button
                          type="button"
                          onClick={() => openSaved(parent.slug, comment.id)}
                          data-cue="tick"
                          className={`flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 text-left hover:bg-paper ${FOCUS_RING}`}
                        >
                          <span className="w-full truncate font-grotesk text-d15 text-ink">
                            {comment.body}
                          </span>
                          <span className="flex max-w-full items-center gap-1.5">
                            <span
                              aria-hidden
                              className="h-2.5 w-2.5 shrink-0 border border-ink"
                              style={{ backgroundColor: categoryColorOnLight(parent.type) }}
                            />
                            {/* Swatch + 2-letter code: hue never the sole
                                channel (ambers alias). */}
                            <span className="shrink-0 font-mono text-d11 uppercase tracking-widest text-ink-soft">
                              {typeCode(parent.type)}
                            </span>
                            <span className="truncate font-mono text-d13 text-ink-soft">
                              {parent.title}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="w-full truncate font-grotesk text-d15 text-ink">
                            {comment.body}
                          </span>
                          <span className="font-mono text-d13 text-ink-soft">
                            {'// '}ORIGEN NO DISPONIBLE
                          </span>
                        </div>
                      )}
                      <span className="shrink-0 font-mono text-d11 text-ink-soft">
                        {timeAgo(comment.createdAt)}
                      </span>
                      {/* Same bordered-chip voice as the rail cards — ink
                          outline on paper; ::before pad lifts the hit area
                          to ≥44px. */}
                      <button
                        type="button"
                        onClick={() => removeComment(comment, index)}
                        data-cue="latch"
                        className={`relative flex h-7 shrink-0 items-center border border-ink px-1.5 font-mono text-d13 uppercase tracking-widest text-ink before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                      >
                        QUITAR
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          ) : railEntries.length === 0 ? (
            <p className="font-mono text-d13 text-ink-soft">
              {'// '}SIN GUARDADOS DE ESTE TIPO TODAVÍA.
            </p>
          ) : (
            <div
              ref={railRef}
              onScroll={measureRail}
              className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain"
            >
              {railEntries.map((entry, index) =>
                entry.kind === 'undo' ? (
                  <UndoCard
                    key={`undo:${entry.item.id}`}
                    title={entry.item.title}
                    onRestore={() => restoreItem(entry.item)}
                  />
                ) : (
                  <SavedCard
                    key={entry.item.id}
                    item={entry.item}
                    savedAt={savedAtById.get(entry.item.id) ?? null}
                    onOpen={() => openSaved(entry.item.slug)}
                    onRemove={() => removeItem(entry.item, index)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
    </WidgetFrame>
    </div>
  )
}
