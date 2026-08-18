'use client'

// Spatial Identity Canvas — one content polyhex.
// The spatial sibling of ContentCard: full-color imagery, boxed type chip,
// title, minimal type-appropriate metadata, and a thin type-colored rim on
// the EXTERIOR boundary only. Clicking opens the item's canonical overlay.
//
// Rendering notes (2026-08-18 perf/behavior pass):
// - The image is a plain HTML <img> clipped with CSS `clip-path: path(...)`,
//   NOT an SVG <image>: HTML images animate GIFs (SVG images never do) and
//   are GPU-composited bitmaps, so pan/zoom scales them without the per-frame
//   re-raster that made SVG cells lag.
// - A multi-unit item is ONE unbroken slab — no interior seam lines.
// - Hover/focus lift is an overlay tint (compositor-cheap), not a filter.

import { memo, useCallback, useRef, type KeyboardEvent } from 'react'
import type { ContentItem, ContentType } from '@/lib/types'
import type { PlacedItem } from '@/lib/mapa/layout'
import { categoryColor, clsx, fmtDateShort } from '@/lib/utils'

// Spanish type labels — intentionally a local copy (project convention:
// per-component TYPE_LABEL maps, type-specific over unified).
const TYPE_LABEL: Record<ContentType, string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  partner: 'PARTNER',
}

// Archivo Vivo era treatment: aged-paper rim + //ARCHIVO chip. Era reads at
// a glance without touching the imagery (era ≠ type; the type still routes
// the overlay). See living-archive MANUAL.md § visible credit.
const ARCHIVE_RIM = '#9C8F7F'

// Minimal type-appropriate metadata line (spec § Content-cell anatomy).
function metaLine(item: ContentItem): string {
  // Archive posts: the visible credit IS the metadata — author blog + year.
  if (item.source === 'archive:wayback') {
    const year = item.publishedAt.slice(0, 4)
    return [item.author, year].filter(Boolean).join(' · ')
  }
  switch (item.type) {
    case 'evento': {
      const date = item.date ? fmtDateShort(item.date) : null
      return [date, item.venue].filter(Boolean).join(' · ')
    }
    case 'mix':
      return [item.mixSeries ?? item.recordedIn, item.duration]
        .filter(Boolean)
        .join(' · ')
    case 'noticia':
      return fmtDateShort(item.publishedAt)
    case 'review':
    case 'editorial':
    case 'opinion':
    case 'articulo':
      return item.author ?? fmtDateShort(item.publishedAt)
    case 'listicle':
      return item.author ?? 'LISTA'
    case 'partner':
      return ''
  }
}

export interface MapaCellProps {
  placed: PlacedItem
  /** Roving tabindex — exactly one cell is tabbable at a time. */
  tabbable: boolean
  /** Partner focus: this cell is NOT attributed to the focused identity. */
  dimmed: boolean
  /** Partner focus: this cell IS attributed to the focused identity. */
  emphasized: boolean
  /** Category deactivated via the visibility column — fade out in place. */
  hidden: boolean
  /**
   * Focus-reflow translation (plane px) from the global position. Members
   * gather into the focus cluster; colliding neighbors glide outward. The
   * transform transition animates both directions.
   */
  delta: { dx: number; dy: number } | null
  onOpen: (item: ContentItem, rect: DOMRect | null) => void
  onArrow: (itemId: string, key: string, altKey: boolean) => void
  onFocusItem: (itemId: string) => void
}

export const MapaCell = memo(function MapaCell({
  placed,
  tabbable,
  dimmed,
  emphasized,
  hidden,
  delta,
  onOpen,
  onArrow,
  onFocusItem,
}: MapaCellProps) {
  const { item, bbox, outline, size } = placed
  const ref = useRef<HTMLDivElement>(null)
  const isArchive = item.source === 'archive:wayback'
  const rim = isArchive ? ARCHIVE_RIM : categoryColor(item.type)

  const handleOpen = useCallback(() => {
    onOpen(item, ref.current?.getBoundingClientRect() ?? null)
  }, [item, onOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleOpen()
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        onArrow(item.id, e.key, e.altKey)
      }
    },
    [handleOpen, item.id, onArrow],
  )

  const label = isArchive ? 'ARCHIVO' : TYPE_LABEL[item.type]
  const meta = metaLine(item)

  return (
    <div
      ref={ref}
      data-item-id={item.id}
      data-size={size}
      role="button"
      tabIndex={tabbable && !hidden ? 0 : -1}
      aria-label={`${label}: ${item.title}${meta ? `. ${meta}` : ''}`}
      aria-hidden={hidden || undefined}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      onFocus={() => onFocusItem(item.id)}
      className={clsx(
        'group/cell absolute cursor-pointer outline-none [contain:layout_style]',
        'transition-[transform,opacity] duration-700 ease-in-out motion-reduce:transition-none',
        dimmed && 'mapa-cell--dim',
        emphasized && 'mapa-cell--emph',
        hidden && 'mapa-cell--off',
      )}
      style={{
        left: bbox.x,
        top: bbox.y,
        width: bbox.width,
        height: bbox.height,
        transform: delta
          ? `translate3d(${delta.dx}px, ${delta.dy}px, 0)`
          : undefined,
      }}
    >
      {/* Media stack — image + legibility shade + hover lift share one
          hex-shaped clip. Plain <img> so GIFs animate and the compositor
          scales a cached bitmap during pan/zoom. */}
      <div
        className="mapa-cell-media absolute inset-0"
        style={{ clipPath: `path('${outline}')` }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        {/* Natural full-color image; the gradient only guards text zones. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/75" />
        <div className="absolute inset-0 bg-white/0 transition-colors duration-150 group-hover/cell:bg-white/10 group-focus-visible/cell:bg-white/10" />
      </div>

      {/* Type-colored rim — EXTERIOR boundary only, stroke-only SVG. */}
      <svg
        width={bbox.width}
        height={bbox.height}
        viewBox={`0 0 ${bbox.width} ${bbox.height}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <path
          d={outline}
          fill="none"
          stroke={rim}
          strokeOpacity={emphasized ? 1 : 0.85}
          strokeWidth={emphasized ? 3.5 : 2.5}
          strokeLinejoin="round"
        />
      </svg>

      {/* Text block — hidden/revealed by semantic zoom band (globals.css). */}
      <div className="mapa-cell-text pointer-events-none absolute inset-0 flex flex-col justify-between px-[16%] pb-[11%] pt-[9%]">
        {/* Boxed type chip (mockup treatment) — category color as chrome,
            never washing the image. */}
        <span
          className="mapa-cell-label inline-flex w-fit items-center border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]"
          style={{
            color: rim,
            borderColor: `${rim}99`,
            backgroundColor: '#0D0D0DB8',
          }}
        >
          {'//'}
          {label}
        </span>
        <div className="min-w-0">
          <h3
            className={`mapa-cell-title font-syne font-bold leading-[1.05] text-primary ${
              size >= 7 ? 'text-3xl' : size >= 3 ? 'text-xl' : 'text-[15px]'
            }`}
          >
            <span className={size >= 3 ? 'line-clamp-3' : 'line-clamp-2'}>
              {item.title}
            </span>
          </h3>
          {meta && (
            <p className="mapa-cell-meta mt-1 truncate font-mono text-[10px] tracking-wide text-primary/60">
              {meta}
            </p>
          )}
        </div>
      </div>

      {/* Focus ring — visible independently of rim color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 hidden border-2 border-primary group-focus-visible/cell:block"
      />
    </div>
  )
})
