'use client'

import { DashPopup } from '@/components/dashboard/DashPopup'
import { FOCUS_RING, WIDGET_LABELS } from '@/components/dashboard/grid/WidgetFrame'
import { WIDGET_DEFS, type WidgetId, type WidgetSize } from '@/lib/dashboard/layout'

export function WidgetSizePicker({ id, current, onSelect, onClose }: {
  id: WidgetId
  current: WidgetSize
  onSelect: (size: WidgetSize) => void
  onClose: () => void
}) {
  return <DashPopup title={`TAMAÑO · ${WIDGET_LABELS[id]}`} onClose={onClose}>
    <p className="mb-4 text-d15 text-ink-soft">Elige el espacio que ocupa este módulo. Los demás se acomodan al confirmar tu elección.</p>
    <div className="grid grid-cols-2 gap-3">
      {WIDGET_DEFS[id].allowedSizes.map((size, index) => {
        const selected = size.w === current.w && size.h === current.h
        const name = index === 0 ? 'ORIGINAL' : size.w === 12 ? 'ANCHO COMPLETO' : size.h >= 4 ? 'ALTO' : size.h === 2 ? 'BAJO' : size.w >= 6 ? 'AMPLIO' : 'COMPACTO'
        return <button key={`${size.w}-${size.h}`} type="button" aria-pressed={selected} aria-label={`${name} ${size.w} por ${size.h}`} onClick={() => onSelect(size)} className={`border border-ink p-3 text-left ${selected ? 'bg-ink text-paper' : 'bg-paper hover:bg-acid text-ink'} ${FOCUS_RING}`}>
          <svg aria-hidden viewBox="0 0 120 40" className="mb-3 h-12 w-full" fill="none">
            {Array.from({ length: 12 }, (_, col) => <path key={col} d={`M${col * 10} 0V40`} stroke="currentColor" strokeOpacity="0.2" />)}
            <rect x="1" y="1" width={size.w * 10 - 2} height={size.h * 10 - 2} stroke="currentColor" fill="currentColor" fillOpacity="0.25" />
          </svg>
          <span className="block font-mono text-d11 font-bold tracking-widest">{name} {selected ? '· ACTUAL' : ''}</span>
          <span className="font-mono text-d13">{size.w} × {size.h}</span>
        </button>
      })}
    </div>
  </DashPopup>
}
