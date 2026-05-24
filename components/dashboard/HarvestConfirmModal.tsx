'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { currentHp } from '@/lib/curation'
import { removePublishedItemLocal } from '@/lib/publishedItemsCache'
import type { ContentItem } from '@/lib/types'

// ── HarvestConfirmModal ────────────────────────────────────────────────────
//
// The gamified confirm step for the COSECHAR gesture. Shows the simulation
// readout (echo preview, decay-multiplier warning, one-shot warning) and
// fires the POST. Per the original plan: this is the moment the publisher
// decides "now or later" — the friction here is the design.
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={status === 'submitting' ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md border border-sys-orange bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          disabled={status === 'submitting'}
          className="absolute right-3 top-3 text-muted transition-colors hover:text-primary disabled:opacity-40"
          aria-label="Cerrar"
        >
          <X size={14} strokeWidth={1.5} />
        </button>

        <header className="mb-3 flex items-baseline gap-2 border-b border-dashed border-border/60 pb-2 font-mono text-[10px] tracking-widest text-sys-orange">
          <span>// COSECHAR</span>
          <span className="text-muted">— {item.title?.toUpperCase() ?? '[SIN TÍTULO]'}</span>
        </header>

        {status === 'success' ? (
          <div className="flex flex-col gap-3">
            <p className="font-syne text-2xl font-black text-sys-orange">
              ◇ +{(actualEcho ?? 0).toFixed(2)}
            </p>
            <p className="font-mono text-[11px] leading-relaxed text-secondary">
              Has cosechado tu publicación. Los puntos llegan a tu presencia en la próxima sincronización (≤ 5 min).
            </p>
            <p className="font-mono text-[10px] leading-relaxed text-muted">
              El sello se ha roto. El post decaerá ahora a 1.7× su velocidad normal.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="self-end border border-sys-orange px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:bg-sys-orange/10"
            >
              CERRAR
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 border border-border bg-base/40 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] tracking-widest text-muted">HL ACTUAL</span>
                <span className="font-syne text-xl font-black text-secondary">
                  {bracket}
                </span>
                <span className="font-mono text-[9px] text-muted">{projectedCurrentHp.toFixed(2)} ◇</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[9px] tracking-widest text-muted">RECIBIRÁS</span>
                <span className="font-syne text-xl font-black text-sys-orange">
                  ◇ +{projectedEcho.toFixed(2)}
                </span>
                <span className="font-mono text-[9px] text-muted">40% del HL</span>
              </div>
            </div>

            <div className="border border-sys-red/40 bg-sys-red/5 p-2.5">
              <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-sys-red">
                <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0" />
                <span>
                  Esta acción es <strong>permanente</strong>. Sólo puedes cosechar cada publicación una vez.
                  Tras cosechar, el post conservará {projectedRemainder.toFixed(2)} ◇ pero decaerá a <strong>{HARVEST_MULTIPLIER}×</strong> la velocidad normal.
                </span>
              </p>
            </div>

            <p className="font-mono text-[10px] leading-relaxed text-muted">
              Cosechar temprano = ganancia pequeña pero cierras la puerta a HL futuro.
              Cosechar tarde = más HL acumulado pero el post ya empezó a decaer.
              No cosechar es también una opción válida — el post hace su trabajo democrático.
            </p>

            {error && (
              <p className="border border-sys-red/60 bg-sys-red/10 px-2 py-1 font-mono text-[10px] text-sys-red">
                ⚠ {error.toUpperCase()}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'submitting'}
                className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-secondary hover:text-secondary disabled:opacity-40"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={status === 'submitting'}
                className="flex items-center gap-1.5 border border-sys-orange bg-sys-orange/10 px-3 py-1.5 font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:bg-sys-orange/20 disabled:opacity-40"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
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
