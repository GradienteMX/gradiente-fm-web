'use client'

// ── SearchOverlay — invoked-mode search, in «EL PLIEGO» chrome ──────────────
//
// The EVA query-terminal skin is retired: paper sheet over an ink scrim,
// Syne title + CERRAR chip (the LoginOverlay anatomy), mono d11 status
// register, hard-cut mount (no panel/backdrop entrance, no scanlines).
//
// Data is REAL now: the MOCK_ITEMS substring scan is replaced by
//   (a) the user's session drafts (useDraftItems), filtered client-side with
//       the same haystack match as before, prepended, and
//   (b) a debounced (250ms) AbortController fetch to GET /api/search, which
//       ilike-matches title / venue / city over published items (franjas
//       included — their overlays resolve).
// A draft that shadows a published row (same slug — an edit in progress)
// wins; the server hit is deduped out.
//
// Contracts kept from the terminal version: opens via SearchProvider (the
// `/` shortcut + BUSCAR button live in useSearch), window-level Esc/↑/↓/↵,
// body scroll lock, query reset on close, hover sets selection, Enter/click
// closes then openContent(slug, originRect from the row element), 30-result
// cap note, × LIMPIAR.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDraftItems } from '@/lib/drafts'
import { useOverlay } from '@/components/overlay/useOverlay'
import {
  categoryColorOnLight,
  TYPE_CODES,
  TYPE_DISPLAY_LABELS,
} from '@/lib/dashboard/palette'
import type { ContentType } from '@/lib/types'
import type { SearchHit } from '@/app/api/search/route'
import { useSearch } from './useSearch'

// Cap on visible matches — keeps the panel scannable for very generic terms
// like "techno". Refine-the-query is the right escape hatch, not infinite
// scroll. Keep in lockstep with RESULT_CAP in app/api/search/route.ts.
const RESULT_CAP = 30

// Debounce before the fetch fires — keystrokes inside the window abort the
// pending request via AbortController.
const DEBOUNCE_MS = 250

// The page-wide focus grammar — 2px ink outline on paper, panel-text on ink.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const FOCUS_RING_ON_INK =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

// One row model for both sources — drafts and server hits render identically
// except for the BORRADOR chip.
interface ResultRow {
  key: string
  slug: string
  title: string
  type: ContentType
  venue?: string
  venueCity?: string
  isDraft: boolean
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; hits: SearchHit[] }
  | { status: 'error' }

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useSearch()
  const { open: openContent } = useOverlay()
  const drafts = useDraftItems()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  // Bumped by REINTENTAR to refire the exact same query after an error.
  const [retryTick, setRetryTick] = useState(0)

  const trimmed = query.trim()

  // (a) Session drafts — same haystack substring match as the mock era.
  // Franja drafts stay skipped (admin-managed org rows, not search targets);
  // published franjas come back from the server instead.
  const draftRows = useMemo<ResultRow[]>(() => {
    const q = trimmed.toLowerCase()
    if (!q) return []
    const hits: ResultRow[] = []
    for (const d of drafts) {
      if (d.type === 'franja') continue
      const haystack = [
        d.title,
        d.subtitle,
        d.excerpt,
        d.author,
        d.venue,
        d.artists?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q)) {
        hits.push({
          key: `draft-${d.id}`,
          slug: d.slug,
          title: d.title,
          type: d.type,
          venue: d.venue,
          venueCity: d.venueCity,
          isDraft: true,
        })
      }
    }
    return hits
  }, [drafts, trimmed])

  // (b) Debounced server fetch. Queries under 2 chars never hit the API
  // (the route returns [] for them anyway).
  useEffect(() => {
    if (!searchOpen || trimmed.length < 2) {
      setFetchState({ status: 'idle' })
      return
    }
    setFetchState({ status: 'loading' })
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as { items?: SearchHit[] }
        setFetchState({
          status: 'done',
          hits: Array.isArray(body.items) ? body.items : [],
        })
      } catch {
        // An abort means a newer keystroke owns the state — say nothing.
        if (!ctrl.signal.aborted) setFetchState({ status: 'error' })
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [searchOpen, trimmed, retryTick])

  // Drafts prepended; server hits deduped by slug (a draft edit of a
  // published item beats the stale published row, same rule as before).
  const rows = useMemo<ResultRow[]>(() => {
    const draftSlugs = new Set(draftRows.map((r) => r.slug))
    const serverRows: ResultRow[] =
      fetchState.status === 'done'
        ? fetchState.hits
            .filter((h) => !draftSlugs.has(h.slug))
            .map((h) => ({
              key: `item-${h.id}`,
              slug: h.slug,
              title: h.title,
              type: h.type,
              venue: h.venue,
              venueCity: h.venueCity,
              isDraft: false,
            }))
        : []
    return [...draftRows, ...serverRows]
  }, [draftRows, fetchState])

  // Reset selection when query changes — old indices may not exist anymore.
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  // Auto-focus input on open; reset state on close.
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQuery('')
    setSelectedIdx(0)
  }, [searchOpen])

  // Lock body scroll while open.
  useEffect(() => {
    if (!searchOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [searchOpen])

  // Close-then-open so the content overlay springs from the row's rect.
  // getBoundingClientRect is safe here: this panel mounts hard-cut with no
  // transform (the offsetWidth-in-OverlayShell trap doesn't apply).
  const openResult = useCallback(
    (idx: number, fromClick?: HTMLElement) => {
      const row = rows[idx]
      if (!row) return
      const el =
        fromClick ??
        listRef.current?.querySelector<HTMLElement>(`[data-result-idx="${idx}"]`)
      const rect = el?.getBoundingClientRect()
      closeSearch()
      openContent(
        row.slug,
        rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : undefined,
      )
    },
    [rows, closeSearch, openContent],
  )

  // ESC + arrow nav + Enter at the window level — input doesn't have to be
  // focused for keyboard navigation to work (e.g., after a mouse hover).
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSearch()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => (rows.length === 0 ? 0 : Math.min(rows.length - 1, i + 1)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        // A focused action chip (CERRAR / LIMPIAR / REINTENTAR) owns its own
        // Enter — don't ALSO open the selected result underneath it.
        const t = e.target as HTMLElement | null
        if (t && t.closest('button') && !t.closest('[data-result-idx]')) return
        if (rows[selectedIdx]) {
          e.preventDefault()
          openResult(selectedIdx)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, rows, selectedIdx, closeSearch, openResult])

  // Keep the selected row in view when arrow-navigating long lists.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-result-idx="${selectedIdx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!searchOpen) return null

  const loading = fetchState.status === 'loading'
  const failed = fetchState.status === 'error'
  const settledEmpty =
    fetchState.status === 'done' && rows.length === 0 && trimmed.length >= 2
  const capReached =
    fetchState.status === 'done' && fetchState.hits.length === RESULT_CAP

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-20"
      onClick={closeSearch}
    >
      {/* Ink scrim — hard cut, no blur, no entrance. */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden border border-ink bg-paper text-ink"
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda"
      >
        {/* ── Head — Syne title + CERRAR chip ─────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-b border-ink px-5 py-2">
          <h2 className="min-w-0 truncate font-syne text-d28 font-bold uppercase leading-8">
            Buscar
          </h2>
          <button
            onClick={closeSearch}
            aria-label="Cerrar búsqueda"
            className={`min-h-11 shrink-0 border border-ink px-3 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR
          </button>
        </div>

        {/* ── Input + status ──────────────────────────────────────────────── */}
        <div className="border-b border-ink px-5 pb-2.5 pt-3">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="busca por título, venue o ciudad…"
              className={`min-h-11 w-full min-w-0 flex-1 border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className={`min-h-11 shrink-0 border border-ink px-3 font-mono text-d11 tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                × LIMPIAR
              </button>
            )}
          </div>

          {/* Loading — one hairline, stepped blink, stilled under
              prefers-reduced-motion. Fixed 1px slot so nothing jumps. */}
          <div className="mt-2 h-px" aria-hidden>
            {loading && (
              <div className="h-px w-full bg-ink motion-safe:animate-blink" />
            )}
          </div>

          <p className="mt-1.5 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {rows.length > 0
              ? `${rows.length} ${rows.length === 1 ? 'RESULTADO' : 'RESULTADOS'}`
              : 'ESCRIBE PARA BUSCAR · ↑↓ NAVEGAR · ↵ ABRIR · ESC SALIR'}
          </p>
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {rows.map((row, idx) => {
            const selected = idx === selectedIdx
            const meta = [row.venue, row.venueCity].filter(Boolean).join(' · ')
            return (
              <button
                key={row.key}
                type="button"
                data-result-idx={idx}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={(e) => openResult(idx, e.currentTarget)}
                aria-label={`${TYPE_DISPLAY_LABELS[row.type]} — ${row.title}`}
                className={`flex min-h-[52px] w-full items-center gap-3 border-b border-ink px-5 py-2 text-left transition-colors ${
                  selected
                    ? `bg-ink text-paper ${FOCUS_RING_ON_INK}`
                    : `text-ink ${FOCUS_RING}`
                }`}
              >
                {/* 10px category swatch + 2-letter code — hue is never the
                    sole signal. */}
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ backgroundColor: categoryColorOnLight(row.type) }}
                />
                <span
                  aria-hidden
                  className="w-6 shrink-0 font-mono text-d11 font-bold tracking-widest"
                >
                  {TYPE_CODES[row.type]}
                </span>
                <span className="min-w-0 flex-1 truncate font-grotesk text-d15">
                  {row.title}
                </span>
                {row.isDraft && (
                  <span className="shrink-0 border border-current px-1.5 py-0.5 font-mono text-d11 tracking-widest">
                    BORRADOR
                  </span>
                )}
                {meta && (
                  <span
                    className={`hidden max-w-[40%] shrink-0 truncate font-mono text-d11 tracking-widest sm:inline ${
                      selected ? 'text-paper' : 'text-ink-faint'
                    }`}
                  >
                    {meta}
                  </span>
                )}
                {selected && (
                  <span aria-hidden className="shrink-0 font-mono text-d11">
                    [↵]
                  </span>
                )}
              </button>
            )
          })}

          {failed && (
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <p className="font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
                SEÑAL INTERRUMPIDA
              </p>
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className={`min-h-11 border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                REINTENTAR
              </button>
            </div>
          )}

          {settledEmpty && (
            <div className="px-5 py-8 text-center">
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                SIN RESULTADOS PARA &apos;{trimmed}&apos;
              </p>
            </div>
          )}

          {capReached && (
            <div className="px-5 py-3 text-center">
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                MOSTRANDO PRIMEROS {RESULT_CAP} · REFINA EL TÉRMINO
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
