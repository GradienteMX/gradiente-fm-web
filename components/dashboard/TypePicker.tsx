'use client'

import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

const TYPE_META: Record<string, { label: string; blurb: string }> = {
  mix: {
    label: 'MIX',
    blurb: 'DJ set, radio show o mixtape. Multi-source, tracklist, contexto.',
  },
  listicle: {
    label: 'LISTA',
    blurb: 'Recuento editorial ranked. Top-N tracks con comentario por pista.',
  },
  evento: {
    label: 'EVENTO',
    blurb: 'Fecha en CDMX. Venue, line-up, boletos, rango horario.',
  },
  review: {
    label: 'REVIEW',
    blurb: 'Crítica de disco o evento. Cuerpo corto, vibe, calificación implícita.',
  },
  editorial: {
    label: 'EDITORIAL',
    blurb: 'Texto curatorial largo. Posición, escena, firma.',
  },
  noticia: {
    label: 'NOTICIA',
    blurb: 'Nota corta. Decae rápido. Lo que está pasando ahora.',
  },
  opinion: {
    label: 'OPINIÓN',
    blurb: 'Columna firmada. Postura individual sobre la escena.',
  },
  articulo: {
    label: 'ARTÍCULO',
    blurb: 'Longform reportado. Bloques estructurados, citas, footnotes.',
  },
}

interface Props {
  supported: ContentType[]
  onPick: (type: ContentType) => void
}

export function TypePicker({ supported, onPick }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-syne text-3xl font-black leading-tight text-primary md:text-4xl">
          NUEVO CONTENIDO
        </h1>
        <p className="font-mono text-[11px] leading-relaxed text-secondary">
          Elige el tipo. El formulario se adapta según cómo se renderiza esa carta en el feed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {supported.map((t) => {
          const meta = TYPE_META[t]
          const color = categoryColor(t)
          return (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="group relative flex flex-col gap-3 border border-border bg-surface p-5 text-left transition-colors hover:bg-elevated"
              style={{ minHeight: 180 }}
            >
              {/* Top accent */}
              <div
                className="absolute left-0 right-0 top-0 h-[2px]"
                style={{ backgroundColor: color }}
              />

              {/* Eyebrow */}
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[10px] tracking-widest"
                  style={{ color }}
                >
                  //{meta.label}
                </span>
                <span className="font-mono text-[10px] tracking-widest text-muted">
                  UPLOAD·READY
                </span>
              </div>

              {/* Title */}
              <h2
                className="font-syne text-2xl font-black leading-tight text-primary"
                style={{ color }}
              >
                {meta.label}
              </h2>

              {/* Blurb */}
              <p className="font-mono text-[11px] leading-relaxed text-secondary">
                {meta.blurb}
              </p>

              {/* Footer affordance */}
              <div className="mt-auto flex items-center justify-between border-t border-dashed border-border pt-2 font-mono text-[10px] tracking-widest text-muted transition-colors group-hover:text-primary">
                <span>▶ COMPONER</span>
                <span className="group-hover:text-primary">→</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-2 border-t border-dashed border-border pt-3">
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          <span className="text-secondary">[PROTOTIPO VISUAL]</span> los seis
          formularios están activos. Submit escribe a sessionStorage — no hay
          backend todavía. El draft se autoguarda mientras editas.
        </p>
      </div>
    </div>
  )
}
