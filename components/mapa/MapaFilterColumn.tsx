'use client'

// Spatial Identity Canvas — right-edge category toggles.
// The inverse of a filter picker: every category is VISIBLE by default and
// each hex is a kill-switch. Clicking deactivates that category — its cells
// fade out in place (nothing moves, nothing regroups; the geography stays
// learnable, rule 11). Active hexes wear their category color; deactivated
// ones go hollow. Types on top, the two eras below.
//
// Below the eras sits the one OPT-IN toggle of the column: AFINIDAD. Unlike
// the kill-switches it hides nothing — activating it lets the terrain's
// affinity structure breathe: high-affinity regions ring up as continents
// and ocean opens between the masses (see lib/mapa/continents.ts).
//
// Fase F — chrome only. Geometry, every toggle behaviour and every URL param
// (?ocultar= / ?afinidad=1) are untouched; the hardcoded charcoal hex cores
// and the EVA-orange AFINIDAD accent moved onto the house bezel tokens:
// panel-dark cores, acid latch for ON, ink-faint for OFF, and the ONE focus
// grammar (outline-2/offset-2) in its panel-text variant for dark ground.

import { memo } from 'react'
import type { ContentType } from '@/lib/types'
import { categoryColor, clsx } from '@/lib/utils'
import {
  DASH_ACID,
  DASH_INK_FAINT,
  DASH_PANEL_TEXT,
} from '@/lib/dashboard/palette'

const ARCHIVE_COLOR = '#9C8F7F'
const HEX_CLIP = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'

// Bezel cores — panel (#111111) at two opacities. Hex strings rather than
// classes because the clip-path fill can't take a Tailwind background.
const BEZEL_CORE = '#111111D6'
const BEZEL_CORE_OFF = '#111111F0'

// One focus grammar, panel variant: the column sits on the map's dark void,
// where an ink outline would be invisible.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

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
  /** Kill-switches strike the label when off; opt-in toggles don't. */
  strike?: boolean
}

function ToggleHex({
  label,
  sub,
  color,
  visible,
  onToggle,
  ariaLabel,
  strike = true,
}: ToggleHexProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={visible}
      className={`group/hextg relative block h-[50px] w-[56px] transition-opacity ${FOCUS_RING}`}
      style={{ opacity: visible ? 1 : 0.38 }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          clipPath: HEX_CLIP,
          backgroundColor: visible ? color : DASH_INK_FAINT,
          opacity: visible ? 0.9 : 0.5,
        }}
      />
      <span
        aria-hidden
        className="absolute"
        style={{
          inset: 1.5,
          clipPath: HEX_CLIP,
          backgroundColor: visible ? BEZEL_CORE : BEZEL_CORE_OFF,
        }}
      />
      <span
        className="relative z-10 flex h-full w-full flex-col items-center justify-center font-mono leading-none tracking-[0.06em]"
        style={{ color: visible ? color : DASH_INK_FAINT, fontSize: 8.5 }}
      >
        <span
          className={clsx(
            'max-w-[86%] truncate',
            strike && !visible && 'line-through',
          )}
        >
          {label}
        </span>
        {sub && <span className="mt-0.5 text-[7px] opacity-60">{sub}</span>}
      </span>
    </button>
  )
}

export interface MapaFilterColumnProps {
  /** [type, count] — content types present on the terrain. */
  typeOptions: [string, number][]
  /** [contemporary count, archive count]. */
  eraCounts: [number, number]
  /**
   * Marketplace listings that can materialize on the map (focus-state
   * MERCADO nodes). 0 → the hex doesn't render (honest chips).
   */
  mercadoCount: number
  /** Deactivated keys: content types, 'mercado', 'era:ahora'/'era:archivo'. */
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
  /** AFINIDAD continent mode — number of detected continents while active. */
  affinityOn: boolean
  affinityCount: number | null
  onToggleAffinity: () => void
}

export const MapaFilterColumn = memo(function MapaFilterColumn({
  typeOptions,
  eraCounts,
  mercadoCount,
  hidden,
  onToggle,
  affinityOn,
  affinityCount,
  onToggleAffinity,
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
      {mercadoCount > 0 && (
        <ToggleHex
          label="MERCADO"
          sub={String(mercadoCount)}
          color="#D6B37A"
          visible={!hidden.has('mercado')}
          onToggle={() => onToggle('mercado')}
          ariaLabel={`${
            hidden.has('mercado') ? 'Mostrar' : 'Ocultar'
          } artículos de mercado (${mercadoCount})`}
        />
      )}
      <div aria-hidden className="my-1 h-px w-8 bg-panel-text/25" />
      {(
        [
          ['era:ahora', 'AHORA', DASH_PANEL_TEXT, eraCounts[0]],
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
      <div aria-hidden className="my-1 h-px w-8 bg-panel-text/25" />
      {/* AFINIDAD — the column's one opt-in. Acid latch when engaged (a
          fill-block on dark, never acid text on paper), ink-faint at rest. */}
      <ToggleHex
        label="AFINIDAD"
        sub={affinityOn && affinityCount !== null ? String(affinityCount) : '◈'}
        color={affinityOn ? DASH_ACID : DASH_INK_FAINT}
        visible={affinityOn}
        strike={false}
        onToggle={onToggleAffinity}
        ariaLabel={
          affinityOn
            ? 'Desactivar continentes de afinidad — volver al terreno global'
            : 'Activar continentes de afinidad — separar las zonas de mayor afinidad'
        }
      />
    </div>
  )
})
