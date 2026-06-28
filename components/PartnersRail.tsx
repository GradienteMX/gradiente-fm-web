'use client'

import { useEffect, useMemo, useRef } from 'react'
import { parseISO } from 'date-fns'
import type { ContentItem, PartnerKind } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useOverlay } from '@/components/overlay/useOverlay'
import { recordItems } from '@/lib/itemsCache'
import { SmartImage } from '@/components/SmartImage'

const PARTNER_LABEL: Record<PartnerKind, string> = {
  promo: 'PROMO',
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'VENUE',
  sponsored: 'PATROCINIO',
  dealer: 'DEALER',
  colectivo: 'COLECTIVO',
  festival: 'FESTIVAL',
  club: 'CLUB',
  medios: 'MEDIO',
  'mix-series': 'MIX SERIES',
}

function partnerTime(item: ContentItem): number {
  return parseISO(item.partnerLastUpdated ?? item.publishedAt).getTime()
}

function PartnerCard({ item }: { item: ContentItem }) {
  const kind = item.partnerKind ?? 'promo'
  const { open } = useOverlay()
  const ref = useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    open(
      item.slug,
      rect
        ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleOpen}
      className="block w-full text-left"
      aria-label={`Abrir ${item.title}`}
    >
      <article className="group relative overflow-hidden border border-border bg-elevated transition-colors hover:border-white/30">
        <div className="relative aspect-[4/3] overflow-hidden">
          {item.imageUrl ? (
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              sizes="(max-width: 768px) 45vw, 240px"
              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-base" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <span
            className="absolute left-2 top-2 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
            style={{ color: categoryColor('partner') }}
          >
            //{PARTNER_LABEL[kind]}
          </span>
        </div>
        <div className="p-2.5">
          <h3 className="font-syne text-xs font-black leading-tight text-white line-clamp-2">
            {item.title}
          </h3>
          {item.subtitle && (
            <p className="mt-1 font-mono text-[9px] tracking-wide text-muted line-clamp-1">
              {item.subtitle}
            </p>
          )}
        </div>
      </article>
    </button>
  )
}

interface PartnersRailProps {
  items: ContentItem[]
  // 'rail' = the desktop right-column aside (default). 'drawer' = a bare 2-col
  // grid of cards for the mobile PartnersDrawer (no aside chrome / fixed width /
  // md gate — the drawer provides its own frame).
  variant?: 'rail' | 'drawer'
}

export function PartnersRail({ items, variant = 'rail' }: PartnersRailProps) {
  const partners = useMemo(
    () =>
      items
        .filter((i) => i.type === 'partner')
        .sort((a, b) => partnerTime(b) - partnerTime(a)),
    [items],
  )

  // Partners must be in the slug-keyed cache so OverlayRouter can resolve
  // `?item=<slug>` against them. ContentGrid handles non-partner items; this
  // rail is the only surface that streams partners, so it owns the push.
  useEffect(() => {
    if (partners.length > 0) recordItems(partners)
  }, [partners])

  if (partners.length === 0) return null

  // Drawer variant — bare responsive grid; the PartnersDrawer owns the chrome.
  if (variant === 'drawer') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {partners.map((item) => (
          <PartnerCard key={item.id} item={item} />
        ))}
      </div>
    )
  }

  return (
    <aside
      className="hidden w-[260px] shrink-0 md:block"
      aria-label="Partners y venues"
    >
      <div>
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">PARTNERS</span>
        </div>
        <p className="sys-label mb-3">
          {partners.length} · SELLOS · VENUES · PROMO
        </p>

        <div className="flex flex-col gap-3">
          {partners.map((item) => (
            <PartnerCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </aside>
  )
}
