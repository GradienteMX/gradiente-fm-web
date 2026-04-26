'use client'

import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'

export function PlaceholderForm({ type }: { type: ContentType }) {
  const color = categoryColor(type)
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 border border-dashed border-border bg-surface/40 p-12 text-center">
      <span
        className="inline-flex items-center gap-2 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
        style={{ borderColor: color, color }}
      >
        //{type.toUpperCase()}
      </span>
      <h2 className="font-syne text-2xl font-black text-primary">
        FORMULARIO PENDIENTE
      </h2>
      <p className="max-w-md font-mono text-[11px] leading-relaxed text-secondary">
        El flujo de carga para <span style={{ color }}>{type}</span> aún no está
        implementado en el prototipo. Por ahora el único tipo con su formulario
        completo es <span style={{ color: '#22D3EE' }}>MIX</span> — sirve como
        referencia del patrón.
      </p>
    </div>
  )
}
