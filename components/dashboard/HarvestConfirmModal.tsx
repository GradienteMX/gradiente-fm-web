'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { currentHp } from '@/lib/curation'
import { removePublishedItemLocal } from '@/lib/publishedItemsCache'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import type { ContentItem } from '@/lib/types'

// ── HarvestConfirmModal ────────────────────────────────────────────────────
//
// The gamified confirm step for the COSECHAR gesture. Shows the simulation
// readout (echo preview, decay-multiplier warning, one-shot warning) and
// fires the POST. Per the original plan: this is the moment the publisher
// decides "now or later" — the friction here is the design.
//
// Native «EL PLIEGO» register: paper sheet over an ink/60 scrim, ink
// hairlines, lift shadow, HP scalars in HP blue, destructive confirm in
// sys-red-paper. Every style is local — this component needs NO help from
// globals.css (the old html.dash-route .z-\[100\].backdrop-blur-sm reskin
// block is obsolete). Selection color is set locally so the legacy global
// ::selection never flashes inside the sheet.
//
// The 40% echo factor and 1.7x decay multiplier are mirrored from the
// harvest_item() SQL function. If those constants ever change in the DB,
// they need to change here too — they only show as projections to the
// user, but the displayed number should match what the server actually
// gives.

const ECHO_FACTOR = 0.4
const HARVEST_MULTIPLIER = 1.7

interface HarvestConfirmModalProps {
  item: ContentItem
  open: boolean
  onClose: () => void
  onHarvested?: (echo: number) => void
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

// Same bracket logic as the publisher-only HL chip on cards — keeps the
// user's mental model consistent.
function hlBracket(hp: number): string {
  if (hp < 5) return 'DÉBIL'
  if (hp < 15) return 'MODESTO'
  if (hp < 30) return 'NOTABLE'
  if (hp < 60) return 'FUERTE'
  return 'PLENO'
}

export function HarvestConfirmModal({
  item,
  open,
  onClose,
  onHarvested,
}: HarvestConfirmModalProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [actualEcho, setActualEcho] = useState<number | null>(null)

  // Reset state when the modal opens against a fresh item.
  useEffect(() => {
    if (open) {
      setStatus('idle')
      setError(null)
      setActualEcho(null)
    }
  }, [open, item.id])

  if (!open) return null

  const projectedCurrentHp = currentHp(item, new Date())
  const projectedEcho = projectedCurrentHp * ECHO_FACTOR
  const projectedRemainder = projectedCurrentHp - projectedEcho
  const bracket = hlBracket(projectedCurrentHp)

  const confirm = async () => {
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/items/${item.id}/harvest`, {
        method: 'POST',
      })
      const body = (await res.json()) as { ok?: boolean; echo?: number; error?: string }
      if (!res.ok || !body.ok) {
        setError(body.error ?? `HTTP ${res.status}`)
        setStatus('error')
        return
      }
      setActualEcho(body.echo ?? projectedEcho)
      setStatus('success')
      // Force the published-items cache to re-query so other surfaces reflect
      // the new harvested_at + decay multiplier.
      removePublishedItemLocal(item.id)
      onHarvested?.(body.echo ?? projectedEcho)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4"
      onClick={status === 'submitting' ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md border border-ink bg-paper p-5 text-ink shadow-lift selection:bg-acid selection:text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          disabled={status === 'submitting'}
          className={`absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-ink-faint transition-colors hover:text-ink disabled:opacity-40 ${FOCUS_RING}`}
          aria-label="Cerrar"
        >
          <X size={14} strokeWidth={1.5} />
        </button>

        <header className="mb-3 flex items-baseline gap-2 border-b border-ink pb-2 pr-10 font-mono text-d11 tracking-widest">
          <span className="font-bold">COSECHAR</span>
          <span className="min-w-0 truncate text-ink-faint">
            — {item.title?.toUpperCase() ?? 'SIN TÍTULO'}
          </span>
        </header>

        {status === 'success' ? (
          <div className="flex flex-col gap-3">
            <p className="font-syne text-d28 font-black text-hp">
              ◇ +{(actualEcho ?? 0).toFixed(2)}
            </p>
            <p className="font-grotesk text-d13 leading-snug text-ink-soft">
              Has cosechado tu publicación. Los puntos llegan a tu presencia en la próxima sincronización (≤ 5 min).
            </p>
            <p className="font-mono text-d11 leading-relaxed text-ink-faint">
              El sello se ha roto. El post decaerá ahora a 1.7× su velocidad normal.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`min-h-11 self-end border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text ${FOCUS_RING}`}
            >
              CERRAR
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 border border-ink bg-paper-raised p-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-d11 tracking-widest text-ink-faint">HL ACTUAL</span>
                <span className="font-syne text-d18 font-black text-ink">
                  {bracket}
                </span>
                <span className="font-mono text-d11 tabular-nums text-hp">{projectedCurrentHp.toFixed(2)} ◇</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-d11 tracking-widest text-ink-faint">RECIBIRÁS</span>
                <span className="font-syne text-d18 font-black tabular-nums text-hp">
                  ◇ +{projectedEcho.toFixed(2)}
                </span>
                <span className="font-mono text-d11 text-ink-faint">40% del HL</span>
              </div>
            </div>

            <div className="border border-sys-red-paper bg-sys-red-paper/5 p-2.5">
              <p className="flex items-start gap-2 font-mono text-d11 leading-relaxed text-sys-red-paper">
                <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0" />
                <span>
                  Esta acción es <strong>permanente</strong>. Sólo puedes cosechar cada publicación una vez.
                  Tras cosechar, el post conservará {projectedRemainder.toFixed(2)} ◇ pero decaerá a <strong>{HARVEST_MULTIPLIER}×</strong> la velocidad normal.
                </span>
              </p>
            </div>

            <p className="font-mono text-d11 leading-relaxed text-ink-faint">
              Cosechar temprano = ganancia pequeña pero cierras la puerta a HL futuro.
              Cosechar tarde = más HL acumulado pero el post ya empezó a decaer.
              No cosechar es también una opción válida — el post hace su trabajo democrático.
            </p>

            {error && (
              <p className="flex items-center gap-1.5 border border-sys-red-paper bg-sys-red-paper/10 px-2 py-1 font-mono text-d11 text-sys-red-paper">
                <AlertTriangle size={11} strokeWidth={1.5} className="shrink-0" />
                {error.toUpperCase()}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'submitting'}
                className={`min-h-11 border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text disabled:opacity-40 ${FOCUS_RING}`}
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={status === 'submitting'}
                className={`flex min-h-11 items-center gap-1.5 border border-sys-red-paper bg-sys-red-paper px-4 font-mono text-d13 font-bold tracking-widest text-panel-text transition-colors hover:bg-paper hover:text-sys-red-paper disabled:opacity-40 ${FOCUS_RING}`}
              >
                {status === 'submitting' ? (
                  <>
                    <span
                      aria-hidden
                      className="h-3.5 w-px bg-current motion-safe:animate-blink"
                    />
                    COSECHANDO…
                  </>
                ) : (
                  <>▶ COSECHAR ◇ +{projectedEcho.toFixed(2)}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
