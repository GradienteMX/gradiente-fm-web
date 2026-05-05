'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ShoppingBag, ToggleLeft, ToggleRight } from 'lucide-react'

// ── PartnerApprovalsSection ────────────────────────────────────────────────
//
// Admin-only surface — toggles `marketplace_enabled` on a per-partner basis.
// The flag controls whether the partner shows up at `/marketplace` and on
// the home marketplace rail. Once enabled, the partner's team (users with
// `partner_id` matching) gain access to the partner-only dashboard section
// where they edit the marketplace card + listings.
//
// The list is searchable by partner title/slug. Each row shows the partner's
// current state (chip) and a single toggle. Toggling fires PATCH
// /api/admin/partners/[id] and refetches so the row reflects DB state.
//
// Same DB-backed pattern as PermisosSection / MiPartnerSection.

interface PartnerRow {
  id: string
  slug: string
  title: string
  partner_kind: string | null
  image_url: string | null
  marketplace_enabled: boolean
  // Approximate count from the jsonb column — null when nothing has been
  // listed; arrays of any length show as that length.
  marketplace_listings: unknown[] | null
}

export function PartnerApprovalsSection() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const refetch = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/admin/partners')
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'PARTNERS_FETCH_FAILED' }))
      setError((body.error ?? 'PARTNERS_FETCH_FAILED').toString().toUpperCase())
      setLoading(false)
      return
    }
    const json = await res.json()
    setPartners((json.partners as PartnerRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return partners
    return partners.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    )
  }, [partners, query])

  const enabledCount = partners.filter((p) => p.marketplace_enabled).length

  if (loading) {
    return (
      <div className="flex items-center gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] text-muted">
        <span className="tracking-widest">//CARGANDO·PARTNERS…</span>
        {error && <span className="text-sys-red">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 font-mono text-[10px] tracking-widest text-muted">
        <span>//APROBACIONES · MARKETPLACE</span>
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
          filtered.map((p) => (
            <PartnerToggleRow key={p.id} partner={p} onChanged={refetch} />
          ))
        )}
      </ul>

      {error && (
        <p className="font-mono text-[10px] text-sys-red">// {error}</p>
      )}

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        //CAMBIOS·EN·VIVO — al habilitar el marketplace de un partner, su equipo
        (usuarios con <span className="text-secondary">partner_id</span>{' '}
        coincidente) puede editar el card desde la sección{' '}
        <span className="text-secondary">Mi partner</span> del dashboard.
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

function PartnerToggleRow({
  partner,
  onChanged,
}: {
  partner: PartnerRow
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const enabled = partner.marketplace_enabled
  const listingCount = partner.marketplace_listings?.length ?? 0

  const onToggle = async () => {
    setBusy(true)
    try {
      await fetch(`/api/admin/partners/${encodeURIComponent(partner.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marketplace_enabled: !enabled }),
      })
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

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
          {partner.partner_kind ? ` · ${partner.partner_kind.toUpperCase()}` : ''}
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
        disabled={busy}
        aria-label={enabled ? 'Desactivar marketplace' : 'Activar marketplace'}
        className="shrink-0 transition-colors hover:text-sys-orange disabled:opacity-40"
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
