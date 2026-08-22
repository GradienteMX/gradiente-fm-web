'use client'

// ── EditModeBar — the edit-mode chrome strip (§2.3) ─────────────────────────
// Cuts in under the masthead (stepped, no fades, no bounce, no exits).
//   · OCULTOS tray — hidden widgets as compact rows with their live counts
//     (real slice data even in the tray); one click restores. Renders only
//     when something is hidden — zero empty chrome.
//   · RESTABLECER DISEÑO — inline confirm chip, 2 clicks total.
//   · LISTO — exits the mode (Esc does the same, handled by the grid).
// Zero save confirms anywhere: every gesture already persisted (§2.3).

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useDashboardData, type DashboardData } from '@/components/dashboard/DashboardDataProvider'
import { filterByFollows } from '@/lib/dashboard/novedades'
import type { WidgetId } from '@/lib/dashboard/layout'
import { FOCUS_RING, WIDGET_LABELS } from './WidgetFrame'
import { CUT_IN_DURATION, stepEase } from './useGridDrag'

const CONFIRM_REVERT_MS = 4000

// Live tray counts — each one traces to a provider slice (§3.10); widgets
// with no meaningful scalar (MAPA is a static door now) render without one.
function widgetCount(id: WidgetId, data: DashboardData): number | null {
  switch (id) {
    case 'crear':
      return data.drafts.length
    case 'cultivar':
      return data.published.length
    case 'actividad':
      return data.activity.length
    case 'guardados':
      return data.saves.filter((item) => item.type !== 'mix' && item.type !== 'partner')
        .length
    case 'reproductor':
      return data.saves.filter((item) => item.type === 'mix').length
    case 'novedades':
      return filterByFollows(data.novedades, data.follows).length
    case 'agenda':
      return data.events.length
    case 'mapa':
      return null
    case 'mercado':
      return data.partner?.listings.length ?? null
  }
}

export interface EditModeBarProps {
  hidden: readonly WidgetId[]
  onRestore: (id: WidgetId) => void
  onReset: () => void
  onDone: () => void
}

export function EditModeBar({ hidden, onRestore, onReset, onDone }: EditModeBarProps) {
  const data = useDashboardData()
  const reducedMotion = useReducedMotion()
  const [confirmingReset, setConfirmingReset] = useState(false)
  const revertTimer = useRef<number | null>(null)

  // The confirm chip reverts on its own — no lingering armed destructive state.
  useEffect(() => {
    if (!confirmingReset) return
    revertTimer.current = window.setTimeout(
      () => setConfirmingReset(false),
      CONFIRM_REVERT_MS,
    )
    return () => {
      if (revertTimer.current !== null) window.clearTimeout(revertTimer.current)
    }
  }, [confirmingReset])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: CUT_IN_DURATION, ease: stepEase }}
      className="sticky top-12 z-40 border-b border-ink bg-paper"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          EDICIÓN DEL PANEL
        </span>
        <span className="font-mono text-d13 text-ink">
          Arrastra para reordenar. Cada cambio se guarda solo.
        </span>

        {hidden.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
              OCULTOS
            </span>
            {hidden.map((id) => {
              const count = widgetCount(id, data)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onRestore(id)}
                  data-cue="latch"
                  className={`min-h-11 border border-ink bg-paper-raised px-3 py-1 font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-0 ${FOCUS_RING}`}
                >
                  {WIDGET_LABELS[id]}
                  {count !== null && (
                    <span className="tabular-nums">{` · ${count}`}</span>
                  )}
                  {' — RESTAURAR'}
                </button>
              )
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {confirmingReset ? (
            // Consequence copy in full ink at ≥13px (§1.1); destructive action
            // carries the paper red.
            <span className="flex items-center gap-3">
              <span className="font-mono text-d13 text-ink">
                Restaura el diseño original y descarta tu arreglo.
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmingReset(false)
                  onReset()
                }}
                // dash-active-danger (globals.css fix 10): pressed = one-step
                // red-fill commit, not the generic ink inversion — the active
                // state carries the same destructive register as the hover.
                className={`dash-active-danger min-h-11 border border-sys-red-paper px-3 py-1 font-mono text-d13 uppercase tracking-widest text-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:min-h-0 ${FOCUS_RING}`}
              >
                CONFIRMAR
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline md:min-h-0 ${FOCUS_RING}`}
              >
                CANCELAR
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline md:min-h-0 ${FOCUS_RING}`}
            >
              RESTABLECER DISEÑO
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            data-cue="latch"
            className={`min-h-11 border border-ink bg-ink px-4 py-1 font-mono text-d13 uppercase tracking-widest text-paper hover:bg-paper hover:text-ink md:min-h-0 ${FOCUS_RING}`}
          >
            LISTO
          </button>
        </div>
      </div>
    </motion.div>
  )
}
