'use client'

// Spatial Identity Canvas — right-edge category toggles.
// The inverse of a filter picker: every category is VISIBLE by default and
// each hex is a kill-switch. Clicking deactivates that category — its cells
// fade out in place (nothing moves, nothing regroups; the geography stays
// learnable, rule 11). Active hexes wear their category color; deactivated
// ones go hollow. Types on top, the two eras below.

import { memo } from 'react'
import type { ContentType } from '@/lib/types'
import { categoryColor, clsx } from '@/lib/utils'

const ARCHIVE_COLOR = '#9C8F7F'
const HEX_CLIP = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'

const TYPE_SHORT: Record<string, string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTIC',
  review: 'REVIEW',
  editorial: 'EDIT',
  opinion: 'OPIN',
  articulo: 'ARTÍC',
  listicle: 'LISTA',
}

interface ToggleHexProps {
  label: string
  sub?: string
  color: string
  visible: boolean
  onToggle: () => void
  ariaLabel: string
}

function ToggleHex({
  label,
  sub,
  color,
  visible,
  onToggle,
  ariaLabel,
}: ToggleHexProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={visible}
      className="group/hextg relative block h-[50px] w-[56px] outline-none transition-opacity"
      style={{ opacity: visible ? 1 : 0.38 }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: HEX_CLIP,
          backgroundColor: visible ? color : '#5A5A5A',
          opacity: visible ? 0.9 : 0.5,
        }}
      />
      <span
        aria-hidden
        className="absolute"
        style={{
          inset: 1.5,
          clipPath: HEX_CLIP,
          backgroundColor: visible ? '#0D0D0DD6' : '#0D0D0DF0',
        }}
      />
      <span
        className="relative z-10 flex h-full w-full flex-col items-center justify-center font-mono leading-none tracking-[0.06em]"
        style={{ color: visible ? color : '#6A6A6A', fontSize: 8.5 }}
      >
        <span className={clsx('max-w-[86%] truncate', !visible && 'line-through')}>
          {label}
        </span>
        {sub && <span className="mt-0.5 text-[7px] opacity-60">{sub}</span>}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-0.5 hidden border border-primary group-focus-visible/hextg:block"
      />
    </button>
  )
}

export interface MapaFilterColumnProps {
  /** [type, count] — content types present on the terrain. */
  typeOptions: [string, number][]
  /** [contemporary count, archive count]. */
  eraCounts: [number, number]
  /** Deactivated keys: content types and 'era:ahora' / 'era:archivo'. */
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
}

export const MapaFilterColumn = memo(function MapaFilterColumn({
  typeOptions,
  eraCounts,
  hidden,
  onToggle,
}: MapaFilterColumnProps) {
  return (
    <div
      data-mapa-ui
      className="pointer-events-auto absolute right-3 top-1/2 z-20 flex max-h-[86dvh] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto py-1 [scrollbar-width:none]"
      role="group"
      aria-label="Categorías visibles en el mapa — toca para ocultar o mostrar"
    >
      {typeOptions.map(([t, n]) => {
        const visible = !hidden.has(t)
        return (
          <ToggleHex
            key={t}
            label={TYPE_SHORT[t] ?? t.toUpperCase()}
            sub={String(n)}
            color={categoryColor(t as ContentType)}
            visible={visible}
            onToggle={() => onToggle(t)}
            ariaLabel={`${visible ? 'Ocultar' : 'Mostrar'} ${TYPE_SHORT[t] ?? t} (${n})`}
          />
        )
      })}
      <div aria-hidden className="my-1 h-px w-8 bg-border" />
      {(
        [
          ['era:ahora', 'AHORA', '#F0F0F0', eraCounts[0]],
          ['era:archivo', 'ARCHIVO', ARCHIVE_COLOR, eraCounts[1]],
        ] as const
      ).map(([key, label, color, n]) => {
        const visible = !hidden.has(key)
        return (
          <ToggleHex
            key={key}
            label={label}
            sub={String(n)}
            color={color}
            visible={visible}
            onToggle={() => onToggle(key)}
            ariaLabel={`${visible ? 'Ocultar' : 'Mostrar'} era ${label} (${n})`}
          />
        )
      })}
    </div>
  )
})
