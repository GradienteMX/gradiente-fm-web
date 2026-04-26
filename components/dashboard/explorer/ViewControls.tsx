'use client'

import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'grid' | 'list'

interface Props {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
  sortLabel?: string
  onSortClick?: () => void
}

export function ViewControls({ mode, onChange, sortLabel = 'Nombre', onSortClick }: Props) {
  return (
    <>
      <button
        type="button"
        onClick={onSortClick}
        className="flex items-center gap-2 border border-border bg-base px-2 py-1 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-secondary hover:text-primary"
      >
        <span className="text-muted">Ordenar:</span>
        <span>{sortLabel}</span>
        <span className="text-muted">▾</span>
      </button>

      <div className="flex items-center gap-1 border border-border bg-base px-1 py-1">
        <span className="px-1 font-mono text-[10px] tracking-widest text-muted">Vista:</span>
        <button
          type="button"
          onClick={() => onChange('grid')}
          aria-label="Vista en cuadrícula"
          className={[
            'p-1 transition-colors',
            mode === 'grid'
              ? 'bg-elevated text-sys-orange'
              : 'text-muted hover:text-primary',
          ].join(' ')}
        >
          <LayoutGrid size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => onChange('list')}
          aria-label="Vista en lista"
          className={[
            'p-1 transition-colors',
            mode === 'list'
              ? 'bg-elevated text-sys-orange'
              : 'text-muted hover:text-primary',
          ].join(' ')}
        >
          <List size={12} strokeWidth={1.5} />
        </button>
      </div>
    </>
  )
}
