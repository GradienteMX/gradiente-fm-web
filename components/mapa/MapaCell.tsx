'use client'

// Spatial Identity Canvas — one content polyhex.
// The spatial sibling of ContentCard: full-color imagery, boxed type chip,
// title, minimal type-appropriate metadata, and a thin type-colored rim on
// the EXTERIOR boundary only. Clicking opens the item's canonical overlay.
//
// Rendering notes (2026-08-18 perf/behavior pass):
// - Imagery goes through SmartImage: allow-listed hosts (Supabase, RA,
//   Wayback…) hit the Next optimizer — resized WebP variants, 1-year server
//   cache — which is what makes the Wayback archive band paint acceptably;
//   GIFs and unknown hosts stay raw <img> so flyer GIFs keep animating.
//   Either way the DOM is an HTML <img>: GPU-composited bitmap, so pan/zoom
//   scales it without the per-frame re-raster that made SVG cells lag.
// - A multi-unit item is ONE unbroken slab — no interior seam lines.
// - Hover/focus lift is an overlay tint + a slight image press INSIDE the
//   clip (compositor-cheap transform), not a filter.
// - Everything visual sits in one `.mapa-cell-anim` wrapper so the boot
//   entrance ripple animates it without touching the root's transform (the
//   root transform belongs to focus/compaction deltas).

import { memo, useCallback, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import type { ContentItem, ContentType } from '@/lib/types'
import type { PlacedItem } from '@/lib/mapa/layout'
import { SmartImage } from '@/components/SmartImage'
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
  /**
   * Boot entrance stagger (seconds) — center-out ripple delay, computed from
   * the cell's distance to the terrain center. Only consumed while the root
   * carries `.mapa-booting`; cells mounted later (virtualization) never
   * animate in.
   */
  enterDelay: number
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
  enterDelay,
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
  // Optimizer variant hint — plane-space widths (hex ≈ 220px at zoom 1);
  // the browser multiplies by devicePixelRatio when picking from the srcset.
  const sizesHint = size >= 7 ? '560px' : size >= 3 ? '440px' : '240px'

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
      {/* Entrance-ripple wrapper — see rendering notes. */}
      <div
        className="mapa-cell-anim absolute inset-0"
        style={{ '--mapa-enter-delay': `${enterDelay}s` } as CSSProperties}
      >
        {/* Media stack — image + legibility shade + hover lift share one
            hex-shaped clip. */}
        <div
          className="mapa-cell-media absolute inset-0"
          style={{ clipPath: `path('${outline}')` }}
        >
          {item.imageUrl ? (
            <div className="mapa-cell-img absolute inset-0">
              <SmartImage
                src={item.imageUrl}
                alt=""
                sizes={sizesHint}
                draggable={false}
                className="object-cover"
              />
            </div>
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
            className="mapa-cell-rim"
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
    </div>
  )
})
