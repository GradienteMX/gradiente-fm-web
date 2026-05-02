'use client'

import { forwardRef, useMemo, useRef, useEffect, type CSSProperties } from 'react'
import { isSameDay, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import type { ContentItem } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { filterByVibe } from '@/lib/utils'
import { rankItems, type CardLayout } from '@/lib/curation'
import { ContentCard } from './cards/ContentCard'

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

// Track prior layout per id to pick asymmetric growth-vs-shrink easing.
function useDirectionTracker() {
  const prev = useRef<Map<string, { colSpan: number; rowSpan: number }>>(new Map())
  return prev
}

// `forwardRef` so a parent (e.g. a future AnimatePresence wrapper, scroll
// observer, etc.) can attach a ref to measure the rendered grid cell.
const MosaicItem = forwardRef<
  HTMLDivElement,
  {
    id: string
    layout: CardLayout
    children: React.ReactNode
    priorArea: number | undefined
    isPast?: boolean
  }
>(function MosaicItem({ id, layout, children, priorArea, isPast }, ref) {
  const area = layout.colSpan * layout.rowSpan
  // Growth: fast/confident. Shrink: slow/quiet. First mount: neutral fade-in.
  const transition =
    priorArea === undefined
      ? { duration: 0.4, ease: 'easeOut' as const }
      : area > priorArea
        ? { duration: 0.4, ease: 'easeOut' as const }
        : area < priorArea
          ? { duration: 0.7, ease: 'easeIn' as const }
          : { duration: 0.6, ease: 'easeInOut' as const }

  const style: CSSProperties = {
    gridColumn: `span ${layout.colSpan} / span ${layout.colSpan}`,
    gridRow: `span ${layout.rowSpan} / span ${layout.rowSpan}`,
    ['--prominence' as any]: layout.intensity.toFixed(3),
    padding: 'calc(var(--prominence) * 0.25rem)',
    transformOrigin: 'center',
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
      layout
      transition={transition}
      style={style}
      // Initial mount expands from a slightly recessed scale; standing scale
      // comes from `--prominence` so prominent items breathe a touch more.
      initial={{
        opacity: 0,
        scale: 0.92,
      }}
      animate={{
        opacity: 1,
        scale: 0.98 + layout.intensity * 0.04,
      }}
    >
      {children}
    </motion.div>
  )
})

export function ContentGrid({ items, mode = 'home', emptyLabel }: ContentGridProps) {
  const { vibeRange, selectedDate, categoryFilter, genreFilter } = useVibe()
  const directions = useDirectionTracker()

  const ranked = useMemo(() => {
    const vibeFiltered = filterByVibe(items, vibeRange)
    // Category + genre filters only apply on the home feed — type-specific
    // pages already filter at the route level.
    const categoryFiltered =
      mode === 'home' && categoryFilter
        ? vibeFiltered.filter((i) => i.type === categoryFilter)
        : vibeFiltered
    const genreFiltered =
      mode === 'home' && genreFilter
        ? categoryFiltered.filter((i) => i.genres.includes(genreFilter))
        : categoryFiltered

    if (mode === 'home') {
      const list = rankItems(genreFiltered)
      if (selectedDate) {
        const onDate = list.filter(({ item }) =>
          isSameDay(parseISO(item.date ?? item.publishedAt), selectedDate),
        )
        const rest = list.filter(
          ({ item }) => !isSameDay(parseISO(item.date ?? item.publishedAt), selectedDate),
        )
        return [...onDate, ...rest]
      }
      return list
    }

    if (mode === 'agenda') {
      const ranked = rankItems(genreFiltered)
      const nowMs = Date.now()
      return ranked.sort((a, b) => {
        const ta = parseISO(a.item.date ?? a.item.publishedAt).getTime()
        const tb = parseISO(b.item.date ?? b.item.publishedAt).getTime()
        const aPast = ta < nowMs ? 1 : 0
        const bPast = tb < nowMs ? 1 : 0
        // Future block first; within future, soonest at top.
        // Past block at bottom; within past, most-recent at top.
        if (aPast !== bPast) return aPast - bPast
        if (aPast) return tb - ta
        if (ta !== tb) return ta - tb
        // Same-day tiebreak: prominence (HP + freshness + imminenceBonus)
        return b.prominence - a.prominence
      })
    }

    return rankItems(genreFiltered).sort(
      (a, b) =>
        parseISO(b.item.date ?? b.item.publishedAt).getTime() -
        parseISO(a.item.date ?? a.item.publishedAt).getTime(),
    )
  }, [items, vibeRange, selectedDate, categoryFilter, genreFilter, mode])

  // Snapshot prior spans before rendering new ones — used to choose easing.
  const priorSpans = useMemo(() => {
    const snapshot = new Map<string, { colSpan: number; rowSpan: number }>()
    directions.current.forEach((v, k) => snapshot.set(k, v))
    return snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked])

  useEffect(() => {
    const next = new Map<string, { colSpan: number; rowSpan: number }>()
    ranked.forEach(({ item, layout }) =>
      next.set(item.id, { colSpan: layout.colSpan, rowSpan: layout.rowSpan }),
    )
    directions.current = next
  }, [ranked, directions])

  const gridStyle: CSSProperties = {
    containerType: 'inline-size',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gridAutoRows: 'minmax(220px, auto)',
    gridAutoFlow: 'dense',
    gap: 'clamp(8px, 1vw, 16px)',
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
      {/* AnimatePresence intentionally NOT used here. With `mode="popLayout"`
          + `layoutId` Framer was failing to unmount filtered-out cards
          (children stayed in the DOM at full opacity even after their exit
          animation should have fired), which broke the in-page category +
          genre filters — `ranked` would shrink but the DOM would not. The
          motion.div's own `layout` + `initial`/`animate` still gives a smooth
          mount + reflow; we just lose the exit fade, which the filter UX
          can live without. See [[Genre Filter Plumbing]] in the wiki log. */}
      {ranked.map(({ item, layout }) => {
        const prior = priorSpans.get(item.id)
        const priorArea = prior ? prior.colSpan * prior.rowSpan : undefined
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
            priorArea={priorArea}
            isPast={isPast}
          >
            <ContentCard item={item} size={layout.tier} />
          </MosaicItem>
        )
      })}
    </div>
  )
}
