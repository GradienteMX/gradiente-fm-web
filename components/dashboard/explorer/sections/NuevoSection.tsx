'use client'

import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { FileIcon } from '../FileIcon'
import type { SelectionMeta } from '../types'

interface TypeMeta {
  label: string
  blurb: string
  size: string
  ext: string
}

export const TYPE_META: Record<string, TypeMeta> = {
  mix: {
    label: 'MIX',
    blurb: 'DJ set, radio show o mixtape. Multi-source, tracklist, contexto.',
    size: '2.1 KB',
    ext: '.MIXTPL',
  },
  listicle: {
    label: 'LISTA',
    blurb: 'Recuento editorial ranked. Top-N tracks con comentario por pista.',
    size: '1.6 KB',
    ext: '.LSTTPL',
  },
  articulo: {
    label: 'ARTÍCULO',
    blurb: 'Longform reportado. Bloques estructurados, citas, footnotes.',
    size: '2.4 KB',
    ext: '.ARTTPL',
  },
  evento: {
    label: 'EVENTO',
    blurb: 'Fecha en CDMX. Venue, line-up, boletos, rango horario.',
    size: '1.8 KB',
    ext: '.EVTTPL',
  },
  review: {
    label: 'REVIEW',
    blurb: 'Crítica de disco o evento. Cuerpo corto, vibe, calificación implícita.',
    size: '2.0 KB',
    ext: '.REVTPL',
  },
  editorial: {
    label: 'EDITORIAL',
    blurb: 'Texto curatorial largo. Posición, escena, firma.',
    size: '2.2 KB',
    ext: '.EDITPL',
  },
  opinion: {
    label: 'OPINIÓN',
    blurb: 'Columna firmada. Postura individual sobre la escena.',
    size: '1.7 KB',
    ext: '.OPITPL',
  },
  noticia: {
    label: 'NOTICIA',
    blurb: 'Nota corta. Dato rápido. Lo que está pasando ahora.',
    size: '1.5 KB',
    ext: '.NOTTPL',
  },
}

interface Props {
  supported: ContentType[]
  selectedType: ContentType | null
  onSelect: (type: ContentType) => void
  onOpen: (type: ContentType) => void
}

export function NuevoSection({ supported, selectedType, onSelect, onOpen }: Props) {
  if (supported.length === 0) {
    // Reached when the current role has no creation rights for any type —
    // see lib/permissions.ts canCreateContent. Reads as a permissions
    // explanation, not a "coming soon" tease.
    return (
      <div
        className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 px-4 py-8 font-mono text-[11px] leading-relaxed text-muted"
      >
        <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
          //SIN·PLANTILLAS·DISPONIBLES
        </span>
        <p>
          Tu rol no tiene permisos para componer contenido publicable. Los
          lectores leen, comentan y participan en el foro; la composición
          editorial está reservada a redacción (curador / guía / insider).
        </p>
        <p>
          Si crees que deberías tener acceso, pídele a un admin que ajuste tu
          rol desde <span className="text-secondary">/admin</span>.
        </p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {supported.map((t) => {
        const meta = TYPE_META[t]
        const color = categoryColor(t)
        const selected = selectedType === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onSelect(t)}
            onDoubleClick={() => onOpen(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(t)
            }}
            className={[
              'group relative flex flex-col gap-2 border bg-surface p-3 text-left transition-colors',
              selected
                ? 'bg-elevated'
                : 'border-border/40 hover:border-border hover:bg-elevated',
            ].join(' ')}
            style={selected ? { borderColor: color } : undefined}
          >
            {/* corner brackets when selected */}
            {selected && <CornerBrackets color={color} />}

            <div className="flex items-start justify-center pt-1">
              <FileIcon color={color} size={64} type={t} />
            </div>

            <div className="flex flex-col gap-1">
              <span
                className="font-syne text-base font-black leading-tight"
                style={{ color }}
              >
                {meta.label}
              </span>
              <p className="font-mono text-[10px] leading-snug text-secondary">
                {meta.blurb}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-dashed border-border/60 pt-1.5 font-mono text-[9px] tracking-widest text-muted">
              <span>PLANTILLA{meta.ext.replace('TPL', '')}</span>
              <span>{meta.size}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CornerBrackets({ color }: { color: string }) {
  const c: React.CSSProperties = { borderColor: color }
  return (
    <>
      <span className="pointer-events-none absolute -top-px -left-px h-2 w-2 border-t border-l" style={c} />
      <span className="pointer-events-none absolute -top-px -right-px h-2 w-2 border-t border-r" style={c} />
      <span className="pointer-events-none absolute -bottom-px -left-px h-2 w-2 border-b border-l" style={c} />
      <span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b border-r" style={c} />
    </>
  )
}

export function selectionForType(t: ContentType): SelectionMeta {
  const meta = TYPE_META[t]
  const color = categoryColor(t)
  return {
    id: `template-${t}`,
    label: meta.label,
    kind: `Plantilla de ${meta.label[0] + meta.label.slice(1).toLowerCase()}`,
    color,
    size: meta.size,
    description: meta.blurb,
    extra: [
      { key: 'CATEGORÍA', value: 'Contenido' },
      { key: 'EXTENSIÓN', value: meta.ext },
      { key: 'ESTADO', value: 'Listo para usar', valueColor: '#4ADE80' },
    ],
  }
}
