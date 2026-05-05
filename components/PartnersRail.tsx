'use client'

import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import type { ContentItem, PartnerKind } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

const PARTNER_LABEL: Record<PartnerKind, string> = {
  promo: 'PROMO',
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'VENUE',
  sponsored: 'PATROCINIO',
  dealer: 'DEALER',
}

function partnerTime(item: ContentItem): number {
  return parseISO(item.partnerLastUpdated ?? item.publishedAt).getTime()
}

function PartnerCard({ item }: { item: ContentItem }) {
  const kind = item.partnerKind ?? 'promo'

  const body = (
    <article className="group relative overflow-hidden border border-border bg-elevated transition-colors hover:border-white/30">
      <div className="relative aspect-[4/3] overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
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
  )

  if (item.partnerUrl) {
    return (
      <a href={item.partnerUrl} target="_blank" rel="noopener noreferrer" className="block">
        {body}
      </a>
    )
  }
  return body
}

interface PartnersRailProps {
  items: ContentItem[]
}

export function PartnersRail({ items }: PartnersRailProps) {
  const partners = useMemo(
    () =>
      items
        .filter((i) => i.type === 'partner')
        .sort((a, b) => partnerTime(b) - partnerTime(a)),
    [items],
  )

  if (partners.length === 0) return null

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
