'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { useVibe } from '@/context/VibeContext'
import { FORO_THREAD_CAP, useThreads } from '@/lib/foro'
import { genresIntersectVibeRange, getGenreById, getTagById } from '@/lib/genres'
import type { ForoThread } from '@/lib/types'
import { ThreadTile } from './ThreadTile'
import { ThreadOverlay } from './ThreadOverlay'
import { NewThreadOverlay } from './NewThreadOverlay'

// ── ForoCatalog ────────────────────────────────────────────────────────────
//
// The /foro page body. Renders:
//   - Header strip with thread count and the "NUEVO HILO" trigger
//   - Catalog grid of ThreadTile (sorted by bumpedAt desc, capped at 30)
//   - ThreadOverlay when ?thread=<id> is in the URL
//   - NewThreadOverlay when ?compose=1 is in the URL (or local state)
//
// URL-driven so threads + composer are deep-linkable. Closing either modal
// strips its param via router.replace.

// Build the lowercased search haystack for a thread: subject + genre and
// tag names *and* ids, so a query matches whether the user types the
// display name ("techno") or the raw id.
function threadHaystack(t: ForoThread): string {
  return [
    t.subject,
    ...t.genres,
    ...t.genres.map((id) => getGenreById(id)?.name ?? ''),
    ...t.tags,
    ...t.tags.map((id) => getTagById(id)?.name ?? ''),
  ]
    .join(' ')
    .toLowerCase()
}

export function ForoCatalog() {
  const threads = useThreads()
  const { vibeRange } = useVibe()
  const { isAuthed, openLogin } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')

  // Filter threads by the slider's vibe range — a thread passes if any of
  // its tagged genres falls in [min, max]. Untagged genres (not in
  // GENRE_VIBE) are ignored. See genresIntersectVibeRange in lib/genres.
  const vibeThreads = useMemo(() => {
    const [min, max] = vibeRange
    if (min === 0 && max === 10) return threads
    return threads.filter((t) => genresIntersectVibeRange(t.genres, min, max))
  }, [threads, vibeRange])

  // Then narrow by the search query over subject/genres/tags. Empty query is
  // a pass-through. Search composes on top of the vibe filter.
  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vibeThreads
    return vibeThreads.filter((t) => threadHaystack(t).includes(q))
  }, [vibeThreads, query])

  const openThreadId = searchParams?.get('thread') ?? null
  const composeOpen = searchParams?.get('compose') === '1'

  const replaceParams = useCallback(
    (mutate: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? '')
      mutate(sp)
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const closeThread = useCallback(() => {
    replaceParams((sp) => sp.delete('thread'))
  }, [replaceParams])

  const closeCompose = useCallback(() => {
    replaceParams((sp) => sp.delete('compose'))
  }, [replaceParams])

  const openCompose = useCallback(() => {
    if (!isAuthed) {
      openLogin()
      return
    }
    replaceParams((sp) => sp.set('compose', '1'))
  }, [isAuthed, openLogin, replaceParams])

  const onPosted = useCallback(
    (threadId: string) => {
      replaceParams((sp) => {
        sp.delete('compose')
        sp.set('thread', threadId)
      })
    },
    [replaceParams],
  )

  const totalCount = threads.length
  const visibleCount = visibleThreads.length
  const atCap = totalCount >= FORO_THREAD_CAP
  const isFiltered = visibleCount !== totalCount

  return (
    <>
      {/* Header strip */}
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">FORO</span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="sys-label">
            HILOS · {isFiltered
              ? `${String(visibleCount).padStart(2, '0')}/${String(totalCount).padStart(2, '0')} ${query.trim() ? 'EN BÚSQUEDA' : 'EN RANGO'}`
              : `${String(totalCount).padStart(2, '0')}/${FORO_THREAD_CAP}`}
            {' '}· ORDEN POR BUMP
          </p>
          <button
            type="button"
            onClick={openCompose}
            className="flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
            }}
          >
            <Plus size={11} /> NUEVO HILO
          </button>
        </div>

        {/* Search — narrows the (already vibe-filtered) catalog by
            subject / genre / tag, client-side over the loaded threads. */}
        <div className="relative mt-2">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar en el foro · asunto, género o tag…"
            aria-label="Buscar hilos"
            className="w-full border bg-black py-1.5 pl-8 pr-8 font-mono text-[11px] tracking-wide text-primary outline-none transition-colors focus:border-sys-orange"
            style={{ borderColor: '#242424' }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-primary"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {atCap && (
          <p className="mt-1 font-mono text-[10px] tracking-widest text-muted">
            // CATÁLOGO LLENO · LOS HILOS MÁS ANTIGUOS BAJAN AL CREAR UNO NUEVO
          </p>
        )}
      </div>

      {/* Catalog grid */}
      {totalCount === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 border border-dashed border-border/50 p-8 text-center">
          <p className="font-mono text-[11px] tracking-widest text-muted">// FORO VACÍO</p>
          <p className="font-mono text-[10px] tracking-widest text-muted/80">
            sé el primero en abrir un hilo
          </p>
        </div>
      ) : visibleCount === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 border border-dashed border-border/50 p-8 text-center">
          {query.trim() ? (
            <>
              <p className="font-mono text-[11px] tracking-widest text-muted">
                // SIN RESULTADOS PARA «{query.trim()}»
              </p>
              <p className="font-mono text-[10px] tracking-widest text-muted/80">
                prueba otro término o limpia la búsqueda
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-widest text-muted">
                // SIN HILOS EN ESTE RANGO DE VIBE
              </p>
              <p className="font-mono text-[10px] tracking-widest text-muted/80">
                ajusta el slider para ver más
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {visibleThreads.map((t) => (
            <ThreadTile key={t.id} thread={t} />
          ))}
        </div>
      )}

      {/* Overlays */}
      {openThreadId && <ThreadOverlay threadId={openThreadId} onClose={closeThread} />}
      {composeOpen && isAuthed && (
        <NewThreadOverlay onClose={closeCompose} onPosted={onPosted} />
      )}
    </>
  )
}
