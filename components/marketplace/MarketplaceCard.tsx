'use client'

import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

// ── MarketplaceCard ────────────────────────────────────────────────────────
//
// Single partner tile in the [[MarketplaceCatalog]] grid. Clicking opens
// the overlay via `?partner=<slug>`. Visually leans on the [[PartnersRail]]
// idiom (image-forward, NGE chrome) with extra marketplace meta — total
// listing count + available count + currency.

interface Props {
  partner: ContentItem
}

export function MarketplaceCard({ partner }: Props) {
  const listings = partner.marketplaceListings ?? []
  const available = listings.filter((l) => l.status === 'available').length
  const partnerColor = categoryColor('partner')

  return (
    <Link
      href={`/marketplace?partner=${encodeURIComponent(partner.slug)}`}
      className="group flex flex-col overflow-hidden border border-border bg-elevated/30 transition-colors hover:border-white/30"
      aria-label={`Abrir marketplace de ${partner.title}`}
    >
      {/* Image */}
      <div className="relative aspect-[5/3] overflow-hidden bg-base">
        {partner.imageUrl ? (
          <img
            src={partner.imageUrl}
            alt={partner.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <span
          className="absolute left-2 top-2 bg-black/75 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
          style={{ color: partnerColor }}
        >
          //MARKETPLACE
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="font-syne text-base font-bold leading-tight text-primary line-clamp-2">
          {partner.title}
        </h3>
        {partner.subtitle && (
          <p className="font-mono text-[10px] tracking-wide text-muted line-clamp-1">
            {partner.subtitle}
          </p>
        )}
      </div>

      {/* Meta footer — counts + location */}
      <dl className="grid grid-cols-3 gap-2 border-t border-border/60 bg-black/20 px-3 py-2 font-mono text-[9px] tracking-widest">
        <Stat label="ITEMS" value={String(listings.length).padStart(2, '0')} />
        <Stat
          label="DISPONIBLES"
          value={String(available).padStart(2, '0')}
          valueColor="#4ADE80"
        />
        <Stat label="ZONA" value={partner.marketplaceLocation ?? '—'} />
      </dl>
    </Link>
  )
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted">{label}</dt>
      <dd
        className="truncate tabular-nums text-secondary"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}
