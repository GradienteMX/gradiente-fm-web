'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Bookmark } from 'lucide-react'
import { toggleSavedItem } from '@/lib/saves'
import { useSavedItems } from '@/lib/hooks/useSavedItems'
import { categoryColor } from '@/lib/utils'
import { DraggableCanvas } from '../DraggableCanvas'
import type { ContentItem, ContentType } from '@/lib/types'

// ── GuardadosSection ───────────────────────────────────────────────────────
//
// Real saved-items surface for the Guardados/* sidebar slots. Filter is
// either null (the "Feed" union view) or an array of ContentTypes — some
// slots merge editorially-related types: `editoriales` covers both
// 'editorial' and 'opinion'; `articulos` covers 'articulo' and 'listicle'.
//
// Each tile is draggable (sessionStorage-namespaced positions per filter)
// and single-click opens the article overlay. Right-click / long-press
// affordance is deferred — the QUITAR action lives in the overlay header
// via SaveItemButton.

const TILE_W = 168
const TILE_H = 196

interface Props {
  /** When null, this is the union view ("Guardados · Feed"). */
  filter: ContentType[] | null
  /** Stable label used in the empty state + DraggableCanvas namespace. */
  filterKey: string
}

export function GuardadosSection({ filter, filterKey }: Props) {
  const all = useSavedItems()
  const router = useRouter()

  const items = useMemo(() => {
    if (!filter) return all
    return all.filter((item) => filter.includes(item.type))
  }, [all, filter])

  if (items.length === 0) {
    return <EmptyState filter={filter} />
  }

  return (
    <DraggableCanvas
      namespace={`saves:${filterKey}`}
      items={items}
      getId={(it) => it.id}
      tileWidth={TILE_W}
      tileHeight={TILE_H}
      onClickItem={(it) => {
        router.push(`/?item=${encodeURIComponent(it.slug)}`)
      }}
      renderTile={({ item, selected }) => (
        <SavedItemTile item={item} selected={selected} />
      )}
    />
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: ContentType[] | null }) {
  const label = filter ? FILTER_LABEL[filter.join(',')] ?? 'contenido' : 'contenido'
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 border border-dashed border-border/60 p-8 text-center">
      <Bookmark size={32} strokeWidth={1} style={{ color: '#22D3EE' }} />
      <span
        className="font-mono text-[10px] tracking-widest"
        style={{ color: '#22D3EE' }}
      >
        // BANDEJA DE GUARDADOS · VACÍA
      </span>
      <p className="max-w-md font-mono text-[11px] leading-relaxed text-secondary">
        Cuando guardes {label} desde el overlay público con{' '}
        <span style={{ color: '#F97316' }}>★ GUARDAR</span>, aparecerán aquí.
      </p>
    </div>
  )
}

const FILTER_LABEL: Record<string, string> = {
  evento: 'eventos',
  noticia: 'noticias',
  review: 'reviews',
  mix: 'mixes',
  'editorial,opinion': 'editoriales y opiniones',
  'articulo,listicle': 'artículos y listas',
}

// ── Single tile ────────────────────────────────────────────────────────────

function SavedItemTile({
  item,
  selected,
}: {
  item: ContentItem
  selected: boolean
}) {
  const color = categoryColor(item.type)
  return (
    <div
      className="flex h-full w-full flex-col gap-2 border bg-surface p-2"
      style={{
        borderColor: selected ? color : '#3a3a3a4d',
        backgroundColor: selected ? '#0d0d0d' : undefined,
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden border bg-base"
        style={{ borderColor: '#242424' }}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="180px"
            className="object-cover opacity-90"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest text-muted">
            sin·portada
          </div>
        )}
        {/* QUITAR button — top-right of thumbnail. e.stopPropagation so the
            tile click (which opens the overlay) doesn't fire too. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleSavedItem(item.id)
          }}
          aria-label="Quitar de guardados"
          title="Quitar de guardados"
          className="absolute right-1 top-1 inline-flex items-center gap-1 border bg-base/90 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm transition-colors hover:border-white/40"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.12)',
          }}
        >
          ★ QUITAR
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <span
          className="font-mono text-[9px] tracking-widest"
          style={{ color }}
        >
          //{item.type.toUpperCase()}
        </span>
        <span className="line-clamp-2 font-syne text-[11px] font-bold leading-tight text-primary">
          {item.title}
        </span>
      </div>
    </div>
  )
}
