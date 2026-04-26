'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Send, Disc3 } from 'lucide-react'
import type { ContentType } from '@/lib/types'
import type { DraftItem } from '@/lib/drafts'
import { removeItem } from '@/lib/drafts'
import { categoryColor } from '@/lib/utils'
import { useVibe } from '@/context/VibeContext'

const TYPE_LABEL: Partial<Record<ContentType, string>> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
}

type StateFilter = 'all' | 'draft' | 'published'

function timeAgo(iso: string | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  const ageSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (ageSec < 60) return `hace ${ageSec}s`
  if (ageSec < 3600) return `hace ${Math.floor(ageSec / 60)}m`
  if (ageSec < 86400) return `hace ${Math.floor(ageSec / 3600)}h`
  return `hace ${Math.floor(ageSec / 86400)}d`
}

export function DraftsList({ items }: { items: DraftItem[] }) {
  const router = useRouter()
  const { setCategoryFilter } = useVibe()
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')

  // Counts per type, used for the filter chips.
  const counts = useMemo(() => {
    const map = new Map<ContentType, number>()
    for (const i of items) {
      map.set(i.type, (map.get(i.type) ?? 0) + 1)
    }
    return map
  }, [items])

  const visible = useMemo(() => {
    let next = items
    if (typeFilter !== 'all') next = next.filter((i) => i.type === typeFilter)
    if (stateFilter !== 'all')
      next = next.filter((i) => i._draftState === stateFilter)
    // Newest updated first.
    return [...next].sort(
      (a, b) =>
        new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime(),
    )
  }, [items, typeFilter, stateFilter])

  // Type chips: TODOS + each type that has at least one item.
  const typeChips: (ContentType | 'all')[] = useMemo(() => {
    const present = Array.from(counts.keys()).sort()
    return ['all', ...present]
  }, [counts])

  const handlePublish = (id: string) => {
    setCategoryFilter(null)
    router.push(`/?pending=${id}`)
  }
  const handleEdit = (item: DraftItem) => {
    router.push(`/dashboard?type=${item.type}&edit=${encodeURIComponent(item.id)}`)
  }
  const handleDelete = (id: string) => {
    removeItem(id)
  }

  if (items.length === 0) {
    return (
      <EmptyShell>
        <div className="hazard-stripe h-1 w-20" />
        <span
          className="font-mono text-xs tracking-widest"
          style={{ color: '#F97316' }}
        >
          // BANDEJA VACÍA
        </span>
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
          Cuando guardes un draft o publiques desde el dashboard, aparecerá
          aquí. Empieza con{' '}
          <Link
            href="/dashboard"
            className="text-secondary underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
          >
            componer nuevo
          </Link>
          .
        </p>
        <div className="hazard-stripe h-1 w-20" />
      </EmptyShell>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips — type */}
      <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-border pb-3">
        <span className="sys-label text-muted">FILTRAR TIPO</span>
        {typeChips.map((t) => {
          const isActive = typeFilter === t
          const color = t === 'all' ? '#F97316' : categoryColor(t as ContentType)
          const label =
            t === 'all' ? 'TODOS' : (TYPE_LABEL[t as ContentType] ?? t.toString().toUpperCase())
          const count =
            t === 'all' ? items.length : (counts.get(t as ContentType) ?? 0)
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: isActive ? color : '#242424',
                color: isActive ? color : '#888888',
                backgroundColor: isActive ? `${color}14` : 'transparent',
              }}
            >
              //{label}
              <span style={{ color: isActive ? color : '#444444' }}>· {count}</span>
            </button>
          )
        })}
      </div>

      {/* Filter chips — state */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="sys-label text-muted">FILTRAR ESTADO</span>
        {(['all', 'draft', 'published'] as StateFilter[]).map((s) => {
          const isActive = stateFilter === s
          const color =
            s === 'all' ? '#888888' : s === 'draft' ? '#F97316' : '#4ADE80'
          const label =
            s === 'all' ? 'TODOS' : s === 'draft' ? 'DRAFTS' : 'PUBLICADAS'
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStateFilter(s)}
              className="border px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: isActive ? color : '#242424',
                color: isActive ? color : '#888888',
                backgroundColor: isActive ? `${color}14` : 'transparent',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="flex flex-col">
        {/* Header row — desktop only */}
        <div className="hidden grid-cols-[100px_110px_minmax(0,1fr)_90px_220px] items-center gap-3 border-b border-border pb-2 font-mono text-[9px] tracking-widest text-muted md:grid">
          <span>TIPO</span>
          <span>ESTADO</span>
          <span>TÍTULO</span>
          <span>ACTUALIZADO</span>
          <span className="text-right">ACCIONES</span>
        </div>

        {visible.length === 0 ? (
          <EmptyShell>
            <span
              className="font-mono text-xs tracking-widest"
              style={{ color: '#888888' }}
            >
              // SIN COINCIDENCIAS
            </span>
            <p className="font-mono text-[11px] text-muted">
              Cambia los filtros o limpia la selección.
            </p>
          </EmptyShell>
        ) : (
          visible.map((item) => (
            <DraftRow
              key={item.id}
              item={item}
              onEdit={() => handleEdit(item)}
              onPublish={() => handlePublish(item.id)}
              onDelete={() => handleDelete(item.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function DraftRow({
  item,
  onEdit,
  onPublish,
  onDelete,
}: {
  item: DraftItem
  onEdit: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  const color = categoryColor(item.type)
  const isDraft = item._draftState === 'draft'
  const stateColor = isDraft ? '#F97316' : '#4ADE80'
  const stateLabel = isDraft ? 'DRAFT' : 'PUBLICADO'

  return (
    <div className="grid grid-cols-[1fr] items-start gap-2 border-b border-border/40 py-3 transition-colors hover:bg-surface/40 md:grid-cols-[100px_110px_minmax(0,1fr)_90px_220px] md:items-center md:gap-3">
      {/* Type */}
      <span
        className="inline-flex w-fit items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
        style={{ borderColor: color, color, backgroundColor: `${color}10` }}
      >
        //{(TYPE_LABEL[item.type] ?? item.type.toUpperCase()).toString()}
      </span>

      {/* State */}
      <span
        className="inline-flex w-fit items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
        style={{
          borderColor: stateColor,
          color: stateColor,
          backgroundColor: `${stateColor}10`,
        }}
      >
        <span
          className={isDraft ? 'h-1 w-1 animate-pulse rounded-full' : 'h-1 w-1 rounded-full'}
          style={{ backgroundColor: stateColor }}
        />
        {stateLabel}
      </span>

      {/* Title + slug */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="truncate font-syne text-base font-black text-primary">
          {item.title || (
            <span className="font-mono text-sm text-muted">[sin título]</span>
          )}
        </span>
        <span className="truncate font-mono text-[10px] text-muted">
          {item.slug || '[sin slug]'}
        </span>
      </div>

      {/* Updated */}
      <span className="font-mono text-[10px] text-muted md:text-right md:tabular-nums">
        {timeAgo(item._updatedAt)}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar"
          title="Editar en el dashboard"
          className="flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/60 hover:text-primary"
        >
          <Pencil size={10} />
          EDITAR
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={onPublish}
            aria-label="Publicar"
            title="Pasar a confirmación de publicación"
            className="flex items-center gap-1 border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.12)',
            }}
          >
            <Send size={10} />
            PUBLICAR
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Eliminar"
          title="Eliminar definitivamente"
          className="flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-red hover:text-sys-red"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ── Empty shell ─────────────────────────────────────────────────────────────

function EmptyShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border border-border px-6 py-8 text-center"
      style={{ gridColumn: '1 / -1' }}
    >
      {children}
    </div>
  )
}
