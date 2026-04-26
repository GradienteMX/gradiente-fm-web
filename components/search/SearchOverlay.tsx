'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MOCK_ITEMS } from '@/lib/mockData'
import { useDraftItems } from '@/lib/drafts'
import { useOverlay } from '@/components/overlay/useOverlay'
import { categoryColor } from '@/lib/utils'
import type { ContentItem, ContentType } from '@/lib/types'
import { useSearch } from './useSearch'

const TYPE_LABEL: Partial<Record<ContentType, string>> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
}

// Cap on visible matches — keeps the panel scannable for very generic terms
// like "techno". Refine-the-query is the right escape hatch, not infinite scroll.
const RESULT_CAP = 30

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useSearch()
  const { open: openContent } = useOverlay()
  const drafts = useDraftItems()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Drafts override mocked items by slug (an editor's working copy beats the
  // seeded version). Partners are sponsor-rail content — never surfaced.
  const corpus = useMemo<ContentItem[]>(() => {
    const bySlug = new Map<string, ContentItem>()
    for (const item of MOCK_ITEMS) {
      if (item.type === 'partner') continue
      bySlug.set(item.slug, item)
    }
    for (const d of drafts) {
      if (d.type === 'partner') continue
      bySlug.set(d.slug, d)
    }
    return Array.from(bySlug.values())
  }, [drafts])

  // Pure substring match. No ranking, no engagement weighting — order = corpus
  // order. See Next Session brief: "discovery-vs-search reconciliation".
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as ContentItem[]
    const hits: ContentItem[] = []
    for (const item of corpus) {
      const haystack = [
        item.title,
        item.subtitle,
        item.excerpt,
        item.author,
        item.venue,
        item.artists?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q)) hits.push(item)
      if (hits.length >= RESULT_CAP) break
    }
    return hits
  }, [corpus, query])

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
        setSelectedIdx((i) => (results.length === 0 ? 0 : Math.min(results.length - 1, i + 1)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        const target = results[selectedIdx]
        if (target) {
          e.preventDefault()
          openResult(target)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, results, selectedIdx])

  // Keep the selected row in view when arrow-navigating long lists.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-result-idx="${selectedIdx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!searchOpen) return null

  function openResult(item: ContentItem, fromClick?: HTMLElement) {
    const el =
      fromClick ??
      listRef.current?.querySelector<HTMLElement>(
        `[data-result-idx="${results.indexOf(item)}"]`,
      )
    const rect = el?.getBoundingClientRect()
    closeSearch()
    openContent(
      item.slug,
      rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  const trimmed = query.trim()

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[60] flex items-start justify-center p-4 pt-20"
      onClick={closeSearch}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines overlay-panel-in relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden bg-base"
        style={{ transformOrigin: 'top center' }}
        role="dialog"
        aria-label="Búsqueda"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 font-mono text-[10px] tracking-widest"
              style={{ color: '#F97316' }}
            >
              //BÚSQUEDA
            </span>
            <span className="sys-label hidden truncate uppercase text-muted sm:inline">
              query·terminal
            </span>
          </div>
          <button
            onClick={closeSearch}
            aria-label="Cerrar búsqueda"
            className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Input row */}
        <div className="border-b border-border px-4 py-3">
          <label className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-widest text-sys-orange">
              {'>'}
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="busca por título, artista, venue, autor…"
              className="flex-1 bg-transparent font-mono text-sm text-primary outline-none placeholder:text-muted"
              autoComplete="off"
              spellCheck={false}
            />
            {trimmed && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
              >
                [×] LIMPIAR
              </button>
            )}
          </label>
        </div>

        {/* Subsystem status line — same idiom as FeedHeader's filter strip */}
        <div className="border-b border-border px-4 py-2">
          {trimmed ? (
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-orange"
                aria-hidden
              />
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: '#F97316' }}
              >
                //SUBSISTEMA · BÚSQUEDA · &apos;{trimmed}&apos; // {results.length}{' '}
                {results.length === 1 ? 'RESULTADO' : 'RESULTADOS'}
              </span>
            </div>
          ) : (
            <p className="sys-label">
              ESCRIBE PARA BUSCAR · ↑↓ NAVEGAR · ↵ ABRIR · ESC SALIR
            </p>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {trimmed && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-mono text-[11px] tracking-widest text-muted">
                SIN COINCIDENCIAS · INTENTA OTRO TÉRMINO
              </p>
            </div>
          )}
          {results.map((item, idx) => {
            const color = categoryColor(item.type)
            const label = TYPE_LABEL[item.type] ?? item.type.toUpperCase()
            const meta = secondaryLine(item)
            const selected = idx === selectedIdx
            return (
              <button
                key={item.id}
                type="button"
                data-result-idx={idx}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={(e) => openResult(item, e.currentTarget)}
                className="block w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-surface focus:outline-none"
                style={selected ? { backgroundColor: `${color}10` } : undefined}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="shrink-0 border px-1.5 py-0.5 font-mono text-[9px] tracking-widest"
                    style={{ borderColor: color, color }}
                  >
                    //{label}
                  </span>
                  <span className="flex-1 truncate font-mono text-[13px] text-primary">
                    {item.title}
                  </span>
                  {selected && (
                    <span
                      className="shrink-0 font-mono text-[9px] tracking-widest"
                      style={{ color: '#F97316' }}
                    >
                      [↵]
                    </span>
                  )}
                </div>
                {meta && (
                  <p className="mt-1 truncate font-mono text-[10px] text-muted">
                    {meta}
                  </p>
                )}
              </button>
            )
          })}
          {trimmed && results.length === RESULT_CAP && (
            <div className="px-4 py-3 text-center">
              <p className="font-mono text-[10px] tracking-widest text-muted">
                · MOSTRANDO PRIMEROS {RESULT_CAP} · REFINA EL TÉRMINO ·
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// One-line secondary string per type. Author for editorial, venue for events,
// etc. — the second fact most useful for recognition. Falls back to subtitle.
function secondaryLine(item: ContentItem): string | null {
  switch (item.type) {
    case 'evento': {
      const parts = [item.venue, item.artists?.slice(0, 3).join(' · ')].filter(
        Boolean,
      )
      return parts.length ? parts.join(' — ') : null
    }
    case 'mix':
      return item.artists?.slice(0, 3).join(' · ') ?? null
    case 'editorial':
    case 'opinion':
    case 'articulo':
    case 'review':
    case 'noticia':
      return item.author ?? item.subtitle ?? item.excerpt ?? null
    default:
      return item.subtitle ?? item.excerpt ?? null
  }
}
