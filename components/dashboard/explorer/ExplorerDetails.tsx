'use client'

import { FileIcon } from './FileIcon'
import type { SelectionMeta } from './types'

interface Props {
  selection: SelectionMeta | null
  /** Optional CTA button shown at the bottom of the panel. */
  cta?: { label: string; onClick: () => void; color?: string }
}

export function ExplorerDetails({ selection, cta }: Props) {
  return (
    <aside className="flex w-full flex-col border border-border bg-surface md:w-[280px] md:flex-shrink-0">
      <div className="flex items-center justify-between border-b border-border bg-elevated px-3 py-2 font-mono text-[10px] tracking-widest text-secondary">
        <span>DETALLES</span>
        <div className="flex items-center gap-2 text-muted">
          <span>─</span>
          <span>▢</span>
          <span>×</span>
        </div>
      </div>

      {!selection ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center font-mono text-[11px] text-muted">
          <span>// SIN SELECCIÓN</span>
          <p className="max-w-[200px] text-[10px] leading-relaxed">
            Selecciona un archivo para ver sus propiedades.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Big icon preview */}
          <div className="flex flex-col items-center gap-2 border border-dashed border-border/60 py-4">
            <FileIcon color={selection.color} size={48} />
            <span
              className="font-syne text-base font-black tracking-tight"
              style={{ color: selection.color }}
            >
              {selection.label}
            </span>
          </div>

          {/* Property table */}
          <dl className="flex flex-col gap-1.5 font-mono text-[10px]">
            <Row label="TIPO" value={selection.kind} />
            <Row label="NOMBRE" value={selection.label} />
            {selection.size && <Row label="TAMAÑO" value={selection.size} />}
            {selection.extra?.map((row) => (
              <Row
                key={row.key}
                label={row.key}
                value={row.value}
                valueColor={row.valueColor}
              />
            ))}
          </dl>

          {/* Description */}
          {selection.description && (
            <div className="flex flex-col gap-1 border-t border-dashed border-border/60 pt-3">
              <span className="font-mono text-[9px] tracking-widest text-muted">
                DESCRIPCIÓN
              </span>
              <p className="font-mono text-[11px] leading-relaxed text-secondary">
                {selection.description}
              </p>
            </div>
          )}

          <div className="flex-1" />

          {cta && (
            <button
              type="button"
              onClick={cta.onClick}
              className="flex w-full items-center justify-between border px-3 py-2 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: cta.color ?? '#F97316',
                color: cta.color ?? '#F97316',
                backgroundColor: `${cta.color ?? '#F97316'}10`,
              }}
            >
              <span>{cta.label}</span>
              <span>›</span>
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-2">
      <dt className="tracking-widest text-muted">{label}</dt>
      <dd className="truncate text-secondary" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </dd>
    </div>
  )
}
