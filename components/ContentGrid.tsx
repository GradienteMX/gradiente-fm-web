'use client'

import { useMemo, useRef, useEffect, type CSSProperties } from 'react'
import { isSameDay, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import type { ContentItem } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { filterByVibe } from '@/lib/utils'
import { rankItems, type CardLayout } from '@/lib/curation'
import { ContentCard } from './cards/ContentCard'

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center gap-3 border border-border"
      style={{ gridColumn: '1 / -1' }}
    >
      <div className="hazard-stripe h-1 w-20" />
      <p className="sys-label text-muted">{label}</p>
      <div className="hazard-stripe h-1 w-20" />
    </div>
  )
}

interface ContentGridProps {
  items: ContentItem[]
  mode?: 'home' | 'category'
  emptyLabel?: string
}

// Track prior layout per id to pick asymmetric growth-vs-shrink easing.
function useDirectionTracker() {
  const prev = useRef<Map<string, { colSpan: number; rowSpan: number }>>(new Map())
  return prev
}

function MosaicItem({
  id,
  layout,
  children,
  priorArea,
}: {
  id: string
  layout: CardLayout
  children: React.ReactNode
  priorArea: number | undefined
}) {
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
    transform: 'scale(calc(0.98 + var(--prominence) * 0.04))',
    transformOrigin: 'center',
  }

  return (
    <motion.div layout layoutId={id} transition={transition} style={style}>
      {children}
    </motion.div>
  )
}

export function ContentGrid({ items, mode = 'home', emptyLabel }: ContentGridProps) {
  const { vibeRange, selectedDate } = useVibe()
  const directions = useDirectionTracker()

  const ranked = useMemo(() => {
    const vibeFiltered = filterByVibe(items, vibeRange)

    if (mode === 'home') {
      const list = rankItems(vibeFiltered)
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

    return rankItems(vibeFiltered).sort(
      (a, b) =>
        parseISO(b.item.date ?? b.item.publishedAt).getTime() -
        parseISO(a.item.date ?? a.item.publishedAt).getTime(),
    )
  }, [items, vibeRange, selectedDate, mode])

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
        <EmptyState label={emptyLabel ?? '// SIN CONTENIDO EN ESTE RANGO DE VIBE'} />
      </div>
    )
  }

  return (
    <div style={gridStyle}>
      {ranked.map(({ item, layout }) => {
        const prior = priorSpans.get(item.id)
        const priorArea = prior ? prior.colSpan * prior.rowSpan : undefined
        return (
          <MosaicItem key={item.id} id={item.id} layout={layout} priorArea={priorArea}>
            <ContentCard item={item} size={layout.tier} />
          </MosaicItem>
        )
      })}
    </div>
  )
}
