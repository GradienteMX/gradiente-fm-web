'use client'

import { useMemo, useState } from 'react'
import { Search, ShoppingBag, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import {
  setMarketplaceEnabled,
  useResolvedPartners,
} from '@/lib/partnerOverrides'

// ── PartnerApprovalsSection ────────────────────────────────────────────────
//
// Admin-only surface — toggles `marketplaceEnabled` on a per-partner basis.
// The flag controls whether the partner shows up at `/marketplace` and on
// the home marketplace rail. Once enabled, the partner's team (users with
// `partnerId` matching) gain access to the partner-only dashboard section
// where they edit the marketplace card + listings.
//
// The list is searchable by partner title. Each row shows the partner's
// current state (chip) and a single toggle. Live — toggling fires the
// override write and the row updates without reload.

export function PartnerApprovalsSection() {
  const partners = useResolvedPartners()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return partners
    return partners.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    )
  }, [partners, query])

  const enabledCount = partners.filter((p) => p.marketplaceEnabled).length

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 font-mono text-[10px] tracking-widest text-muted">
        <span>
          //APROBACIONES · MARKETPLACE
        </span>
        <span>
          {enabledCount} / {partners.length} ACTIVOS
        </span>
      </header>

      <SearchBar value={query} onChange={setQuery} />

      <ul className="flex flex-col border border-border bg-elevated/30">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center font-mono text-[11px] text-muted">
            ningún partner coincide con &quot;{query}&quot;
          </li>
        ) : (
          filtered.map((p) => <PartnerRow key={p.id} partner={p} />)
        )}
      </ul>

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        //CAMBIOS·EN·SESIÓN — los overrides viven en sessionStorage. Al
        habilitar el marketplace de un partner, su equipo (usuarios con{' '}
        <span className="text-secondary">partnerId</span> coincidente) puede
        editar el card y las listings desde la sección del partner. El
        backend real persistirá vía Supabase.
      </p>
    </div>
  )
}

function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 border border-border bg-elevated/30 px-2 py-1.5">
      <Search size={12} strokeWidth={1.5} className="text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar partner por nombre o slug…"
        className="flex-1 bg-transparent font-mono text-[11px] text-primary placeholder:text-muted focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="font-mono text-[10px] tracking-widest text-muted hover:text-primary"
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Single row — partner identity + marketplace toggle ────────────────────

function PartnerRow({ partner }: { partner: ContentItem }) {
  const enabled = !!partner.marketplaceEnabled
  const listingCount = partner.marketplaceListings?.length ?? 0
  const onToggle = () => setMarketplaceEnabled(partner.id, !enabled)
  return (
    <li className="flex items-center gap-3 border-b border-border/50 px-3 py-2 font-mono text-[11px]">
      <ShoppingBag
        size={14}
        strokeWidth={1.5}
        className={enabled ? 'text-sys-orange' : 'text-muted'}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-primary">{partner.title}</span>
        <span className="truncate font-mono text-[9px] tracking-widest text-muted">
          /{partner.slug}
          {partner.partnerKind ? ` · ${partner.partnerKind.toUpperCase()}` : ''}
          {enabled ? ` · ${listingCount} LISTING${listingCount === 1 ? '' : 'S'}` : ''}
        </span>
      </div>
      <span
        className="shrink-0 border px-1.5 py-px text-[9px] tracking-widest"
        style={{
          borderColor: enabled ? '#4ADE80' : '#3a3a3a',
          color: enabled ? '#4ADE80' : '#9CA3AF',
        }}
      >
        {enabled ? 'MARKETPLACE ON' : 'MARKETPLACE OFF'}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={enabled ? 'Desactivar marketplace' : 'Activar marketplace'}
        className="shrink-0 transition-colors hover:text-sys-orange"
        style={{ color: enabled ? '#4ADE80' : '#9CA3AF' }}
      >
        {enabled ? (
          <ToggleRight size={20} strokeWidth={1.5} />
        ) : (
          <ToggleLeft size={20} strokeWidth={1.5} />
        )}
      </button>
    </li>
  )
}
