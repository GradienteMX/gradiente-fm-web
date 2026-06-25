'use client'

import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { parseISO } from 'date-fns'
import { motion, useReducedMotion } from 'framer-motion'
import type { ContentItem } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { filterByVibe, vibeMid, vibeToColor } from '@/lib/utils'
import { itemMatchesGenreFilter } from '@/lib/genres'
import { rankItems, rankAgenda, type CardLayout } from '@/lib/curation'
import { recordItems } from '@/lib/itemsCache'
import { ContentCard } from './cards/ContentCard'
import { RecurationSweep } from './grid/RecurationSweep'

// ── Empty state ───────────────────────────────────────────────────────────────
//
// Per-type voice when the grid is empty under an active filter — feels more
// "us" than a single generic line. Uses the active categoryFilter (when set)
// to pick copy. Falls back to the vibe-range message when no category is
// pinned.

import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

const EMPTY_BY_TYPE: Partial<Record<ContentType, { line: string; sub: string }>> = {
  evento: {
    line: '// AGENDA · CALMA TEMPORAL',
    sub: 'Sin eventos en este rango. La escena respira; vuelve en unos días.',
  },
  mix: {
    line: '// CABINA · BOOTH VACÍO',
    sub: 'Ningún mix coincide con el filtro activo. Sube el rango de vibe o limpia el foco.',
  },
  noticia: {
    line: '// SIN NOTICIAS · TRANSMISIÓN ESTABLE',
    sub: 'No hay nada nuevo que reportar. Buena señal — o malas frecuencias.',
  },
  review: {
    line: '// SIN RESEÑAS · ARCHIVO ABIERTO',
    sub: 'Aún no hay críticas en este corte. Está cocinándose una, prometido.',
  },
  editorial: {
    line: '// PRENSA · PAUSA EDITORIAL',
    sub: 'No hay editoriales en este rango. Estamos pensando antes de escribir.',
  },
  opinion: {
    line: '// COLUMNA · MICRÓFONO ABIERTO',
    sub: 'Sin opiniones en este rango. Pronto alguien dirá algo incómodo.',
  },
  articulo: {
    line: '// ARCHIVO LARGO · SILENCIO',
    sub: 'Sin artículos largos en este corte. Investigación en curso.',
  },
  listicle: {
    line: '// LISTAS · CURADURÍA EN PAUSA',
    sub: 'Sin listas que coincidan. La próxima entrega está siendo seleccionada.',
  },
}

function EmptyState({
  label,
  category,
}: {
  label?: string
  category?: ContentType | null
}) {
  const copy = category ? EMPTY_BY_TYPE[category] : null
  const headline = copy?.line ?? label ?? '// SIN CONTENIDO EN ESTE RANGO DE VIBE'
  const sub = copy?.sub
  const accent = category ? categoryColor(category) : '#888888'

  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center gap-3 border border-border px-6 py-8 text-center"
      style={{ gridColumn: '1 / -1' }}
    >
      <div className="hazard-stripe h-1 w-20" />
      <p
        className="font-mono text-xs tracking-widest"
        style={{ color: accent }}
      >
        {headline}
      </p>
      {sub && (
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
          {sub}
        </p>
      )}
      <div className="hazard-stripe h-1 w-20" />
    </div>
  )
}

interface ContentGridProps {
  items: ContentItem[]
  mode?: 'home' | 'category' | 'agenda'
  emptyLabel?: string
}

// Entrant reveal — opacity lands on 4 hard steps (0 → ⅓ → ⅔ → 1): signal
// acquisition, not a soft fade.
const stepEase = (t: number) => Math.min(1, Math.floor(t * 4) / 3)

// `forwardRef` so a parent (e.g. a future AnimatePresence wrapper, scroll
// observer, etc.) can attach a ref to measure the rendered grid cell.
const MosaicItem = forwardRef<
  HTMLDivElement,
  {
    id: string
    layout: CardLayout
    children: React.ReactNode
    index: number
    isPast?: boolean
  }
>(function MosaicItem({ id, layout, children, index, isPast }, ref) {
  const reducedMotion = useReducedMotion()

  const style: CSSProperties = {
    gridColumn: layout.colStart
      ? `${layout.colStart} / span ${layout.colSpan}`
      : `span ${layout.colSpan} / span ${layout.colSpan}`,
    gridRow: `span ${layout.rowSpan} / span ${layout.rowSpan}`,
    // No visual consumer today — kept as a hook for future shader/treatment
    // work; do not remove without checking ContentCard + CSS.
    ['--prominence' as any]: layout.intensity.toFixed(3),
    // Past events on /agenda: desaturate + soften so the archive reads as
    // archive without losing the discussion record. Hover restores full color
    // so users can re-engage without ambiguity.
    ...(isPast && {
      filter: 'saturate(0.4) brightness(0.85)',
      opacity: 0.7,
      transition: 'filter 0.3s ease, opacity 0.3s ease',
    }),
  }

  return (
    <motion.div
      ref={ref}
      // Position interpolates, size quantizes: span changes snap (an HP tier
      // is a state, not a momentum) and the field slides to absorb them. Also
      // avoids text squish during span changes. Under prefers-reduced-motion
      // the slide is disabled; the reveal below is opacity-only, so it stays.
      layout={reducedMotion ? false : 'position'}
      style={style}
      // Mount cuts in stepped — no scale-in: cards CUT in, they do not grow.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        layout: { duration: 0.25, ease: 'easeOut' },
        opacity: {
          duration: 0.28,
          ease: stepEase,
          delay: Math.min(index, 8) * 0.04,
        },
      }}
    >
      {children}
    </motion.div>
  )
})

export function ContentGrid({ items, mode = 'home', emptyLabel }: ContentGridProps) {
  const { vibeRange, categoryFilter, genreFilter, setVisibleGenres } = useVibe()

  // Coalesce the feed re-rank to ONE update per animation frame. The vibe
  // slider fires setVibeRange on every pointermove; without this, filterByVibe
  // + rankItems (O(n log n), with parseISO/Math.exp per item) + the Framer
  // reflow would run per dragged pixel across the ~140-card grid. The needle
  // still tracks 1:1 (VibeSlider reads vibeRange directly, unthrottled); only
  // this downstream re-rank is throttled. The settled result is identical for
  // every viewer — this changes render cadence, not what's ranked (No-Algorithm
  // holds: same vibeRange → same filterByVibe → same rankItems for all).
  const [rankVibeRange, setRankVibeRange] = useState(vibeRange)
  const latestVibeRef = useRef(vibeRange)
  const rankRafRef = useRef(0)
  useEffect(() => {
    latestVibeRef.current = vibeRange
    if (rankRafRef.current === 0) {
      rankRafRef.current = requestAnimationFrame(() => {
        rankRafRef.current = 0
        setRankVibeRange(latestVibeRef.current)
      })
    }
  }, [vibeRange])
  useEffect(
    () => () => {
      if (rankRafRef.current) cancelAnimationFrame(rankRafRef.current)
    },
    [],
  )

  // Bridge server-rendered items into the slug-keyed client cache so the
  // OverlayRouter can resolve `?item=<slug>` for real DB rows (it used to
  // only know about MOCK_ITEMS + drafts).
  useEffect(() => {
    recordItems(items)
  }, [items])

  // Genre union of items passing the vibe filter (and category, when on
  // home). Pushed up to VibeContext so the slider's chip strip reflects
  // the actual feed contents — see Vibe Philosophy idea 2: a "techno" item
  // can be curator-set to vibe 2, which means a `techno` chip should
  // appear when the slider is at 2 even though GENRE_VIBE['techno'] = 6.
  // Computed off the same effective band that filterByVibe uses.
  const feedGenres = useMemo(() => {
    const vibeFiltered = filterByVibe(items, rankVibeRange)
    const scoped =
      mode === 'home' && categoryFilter
        ? vibeFiltered.filter((i) => i.type === categoryFilter)
        : vibeFiltered
    const set = new Set<string>()
    for (const item of scoped) {
      for (const g of item.genres) set.add(g)
    }
    return Array.from(set).sort()
  }, [items, rankVibeRange, categoryFilter, mode])

  useEffect(() => {
    setVisibleGenres(feedGenres)
  }, [feedGenres, setVisibleGenres])

  // On unmount, drop the slider's view back to its GENRE_VIBE fallback so
  // pages without a ContentGrid (e.g. /about, /equipo) don't see stale
  // genre data from whichever page the user just left.
  useEffect(() => {
    return () => setVisibleGenres(null)
  }, [setVisibleGenres])

  const ranked = useMemo(() => {
    const vibeFiltered = filterByVibe(items, rankVibeRange)
    // Category + genre filters only apply on the home feed — type-specific
    // pages already filter at the route level.
    const categoryFiltered =
      mode === 'home' && categoryFilter
        ? vibeFiltered.filter((i) => i.type === categoryFilter)
        : vibeFiltered
    // Use rollup matching: filtering by a parent genre ("techno") matches
    // every leaf under it. See lib/genres.ts::itemMatchesGenreFilter.
    const genreFiltered =
      mode === 'home' && genreFilter.length > 0
        ? categoryFiltered.filter((i) =>
            itemMatchesGenreFilter(i.genres, genreFilter),
          )
        : categoryFiltered

    if (mode === 'home') {
      return rankItems(genreFiltered)
    }

    if (mode === 'agenda') {
      // Democratic, fully-packed chronological mosaic — its own ranker, not the
      // HP-prominence one. See lib/curation.ts::rankAgenda.
      return rankAgenda(genreFiltered)
    }

    return rankItems(genreFiltered).sort(
      (a, b) =>
        parseISO(b.item.date ?? b.item.publishedAt).getTime() -
        parseISO(a.item.date ?? a.item.publishedAt).getTime(),
    )
  }, [items, rankVibeRange, categoryFilter, genreFilter, mode])

  // Re-curation sweep signature — the identity+order of the visible set plus
  // the active filter signature. Changes ONLY on a genuine re-rank/filter
  // change (not on incidental re-renders), which is exactly when the broadcast
  // monitor should "retune". Cheap string join; `ranked` is already memoized.
  const sweepSignature = useMemo(
    () =>
      `${rankVibeRange[0]}-${rankVibeRange[1]}|${categoryFilter ?? '*'}|${genreFilter.join(',')}|${mode}|` +
      ranked.map((r) => r.item.id).join(','),
    [ranked, rankVibeRange, categoryFilter, genreFilter, mode],
  )

  // A hint of the active vibe to tint the sweep band — midpoint of the active
  // filter range, mapped through the canonical thermal ramp. Carries true
  // filter state (not decoration).
  const sweepColor = vibeToColor(vibeMid({ vibeMin: rankVibeRange[0], vibeMax: rankVibeRange[1] }))

  const gridStyle: CSSProperties = {
    containerType: 'inline-size',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gridAutoRows: 'minmax(220px, auto)',
    gridAutoFlow: 'dense',
    gap: 'clamp(8px, 1vw, 16px)',
    // Positioning context so RecurationSweep's transient canvas (absolute,
    // inset-0) clips to the mosaic. Does not affect the grid layout itself.
    position: 'relative',
  } as CSSProperties

  if (ranked.length === 0) {
    return (
      <div style={gridStyle}>
        <EmptyState label={emptyLabel} category={categoryFilter ?? null} />
      </div>
    )
  }

  return (
    <div style={gridStyle}>
      {/* Re-curation sweep — a transient teletext/scanline band that retunes the
          mosaic whenever the ranked set's identity/order changes (filter change
          or realtime re-curation). Pure visual layer above the cards
          (pointer-events-none); the card DOM, click-to-open, focus, selection,
          screen-reader, the layout="position" reflow + stepped entrants below
          are all untouched. Skips first mount and reduced-motion. */}
      <RecurationSweep signature={sweepSignature} vibeColor={sweepColor} />
      {/* AnimatePresence intentionally NOT used here. With `mode="popLayout"`
          + `layoutId` Framer was failing to unmount filtered-out cards
          (children stayed in the DOM at full opacity even after their exit
          animation should have fired), which broke the in-page category +
          genre filters — `ranked` would shrink but the DOM would not. The
          motion.div's own `layout` + `initial`/`animate` still gives a smooth
          mount + reflow; we just lose the exit fade, which the filter UX
          can live without. See [[Genre Filter Plumbing]] in the wiki log. */}
      {ranked.map(({ item, layout }, index) => {
        const isPast =
          mode === 'agenda' &&
          item.type === 'evento' &&
          !!item.date &&
          parseISO(item.date).getTime() < Date.now()
        return (
          <MosaicItem
            key={item.id}
            id={item.id}
            layout={layout}
            index={index}
            isPast={isPast}
          >
            <ContentCard item={item} size={layout.tier === 'xl' ? 'lg' : layout.tier} />
          </MosaicItem>
        )
      })}
    </div>
  )
}
