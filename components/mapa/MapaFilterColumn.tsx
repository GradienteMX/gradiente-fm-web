'use client'

import { memo } from 'react'
import { Layers, Hexagon } from 'lucide-react'
import type { ContentType } from '@/lib/types'
import { categoryColor, clsx } from '@/lib/utils'

const LABELS: Record<string, string> = {
  evento: 'EVENTOS', mix: 'MIXES', noticia: 'NOTICIAS', review: 'RESEÑAS',
  editorial: 'EDITORIAL', opinion: 'OPINIÓN', articulo: 'ARTÍCULOS', listicle: 'LISTAS',
}
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

function ToggleHex({ label, color, visible, onToggle, count }: {
  label: string; color: string; visible: boolean; onToggle: () => void; count: number
}) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={visible}
      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label} (${count})`}
      title={`${label}: ${count} · ${visible ? 'Clic para ocultar' : 'Clic para mostrar'}`}
      className="group relative flex h-14 w-16 shrink-0 items-center justify-center [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)] focus-visible:outline-none">
      <svg aria-hidden viewBox="0 0 64 56" className="absolute inset-0 h-full w-full overflow-visible">
        <path d="M16.5 1.1532 H47.5 L63 28 L47.5 54.8468 H16.5 L1 28 Z" fill={visible ? color : '#EDEBE3'} fillOpacity={visible ? 0.65 : 1} stroke="#111111" strokeWidth="1.4" className="transition-[fill-opacity] group-hover:[fill-opacity:1] group-focus-visible:[fill-opacity:1] group-focus-visible:stroke-[3px]" />
        {!visible && <path d="M17 42 L47 14" stroke="#111111" strokeOpacity="0.25" />}
      </svg>
      <span className={clsx('relative font-mono text-[9px] font-bold tracking-tight text-ink', !visible && 'line-through')}>{label}</span>
    </button>
  )
}

export interface MapaFilterColumnProps {
  typeOptions: [string, number][]
  eraCounts: [number, number]
  mercadoCount: number
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
  affinityOn: boolean
  affinityCount: number | null
  onToggleAffinity: () => void
  focusActive?: boolean
}

export const MapaFilterColumn = memo(function MapaFilterColumn({
  typeOptions, eraCounts, mercadoCount, hidden, onToggle, affinityOn, onToggleAffinity, focusActive,
}: MapaFilterColumnProps) {
  return (
    <aside data-mapa-ui className="pointer-events-auto absolute bottom-[76px] right-4 top-[70px] z-20 flex w-[144px] cursor-auto flex-col border-l border-ink/25 bg-paper/95 px-2 text-ink" aria-label="Capas del mapa">
      <p className="shrink-0 py-2 text-center font-mono text-[11px] font-bold tracking-widest">MOSTRAR</p>
      <div role="group" aria-label="Tipos de contenido visibles" className="min-h-0 flex-1 overflow-y-auto px-1 pb-8 pt-1">
        <div className="grid auto-rows-[56px] grid-cols-[48px_64px] content-start [&>button:nth-child(even)]:translate-y-7">
          {typeOptions.map(([t, n]) => <ToggleHex key={t} label={LABELS[t] ?? t.toUpperCase()} count={n} color={categoryColor(t as ContentType)} visible={!hidden.has(t)} onToggle={() => onToggle(t)} />)}
          {mercadoCount > 0 && <ToggleHex label="MERCADO" count={mercadoCount} color="#D6B37A" visible={!hidden.has('mercado')} onToggle={() => onToggle('mercado')} />}
        </div>
      </div>
      <div className="shrink-0 border-t border-ink/30 py-2">
        {(['AHORA', 'ARCHIVO'] as const).map((label, i) => {
          const key = `era:${label.toLowerCase()}`
          return <button key={key} type="button" aria-label={`${hidden.has(key) ? 'Mostrar' : 'Ocultar'} era ${label} (${eraCounts[i]})`} aria-pressed={!hidden.has(key)} onClick={() => onToggle(key)} className={`flex min-h-8 w-full items-center gap-2 px-1 font-mono text-[10px] hover:bg-ink/10 ${FOCUS}`}>
            <Hexagon aria-hidden size={17} className={hidden.has(key) ? 'text-ink/40' : 'fill-ink text-ink'} /><span className={hidden.has(key) ? 'line-through' : ''}>{label}</span>
          </button>
        })}
        <button type="button" aria-pressed={affinityOn} onClick={onToggleAffinity} aria-label={affinityOn ? 'Desactivar afinidad' : 'Activar afinidad'} className={clsx(`mt-1 flex min-h-11 w-full items-center gap-2 border border-ink px-1 font-mono text-[10px] ${FOCUS}`, affinityOn ? 'bg-acid font-bold' : 'hover:bg-ink/10')}>
          <Layers aria-hidden size={17} /><span>AFINIDAD</span>
        </button>
        {focusActive && affinityOn && <p className="mt-1 font-mono text-[9px] leading-tight">Al salir del enfoque</p>}
      </div>
    </aside>
  )
})
