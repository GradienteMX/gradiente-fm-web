'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { FOCUS_RING, InkButton, MarginNote } from '@/components/admin/kit'
import { hlBracket } from '@/lib/dashboard/hl'
import { round } from '@/lib/dashboard/scale'

// ── HlLever — the audited beta-calibration lever ────────────────────────────
//
// Forked from HarvestConfirmModal's anatomy rather than inventing a second
// dialog language: paper sheet over an ink/60 scrim, ink hairlines, lift
// shadow, HL scalars in HP blue, the consequence block and the final commit in
// sys-red-paper. Same shape of gesture — an irreversible scalar mutation with
// a stated side effect — so it gets the same shape of confirm.
//
// The three constants below MIRROR the server and must move with it:
// admin_adjust_item_hp() (migration 0049 §5) raises on |delta| > 1000, the
// route (app/api/admin/items/[id]/hp/route.ts) rejects a motivo shorter than 3
// or longer than 280. Mirrored client-side so the operator is told BEFORE
// committing instead of discovering the rule as a 400 on an already-typed
// adjustment.
//
// The lever deliberately does NOT auto-commit anything. Even the REVERTIR path
// in ContenidoTab arrives here as a prefill and still passes through the same
// confirm: an inverse adjustment is exactly as irreversible as the adjustment
// it undoes, and it writes its own audit row.

/** The server's own numbers. `applied` differs from delta when the floor bites. */
export interface HlAdjustResult {
  before: number
  after: number
  applied: number
}

/** Fat-finger guard in admin_adjust_item_hp(). Not a policy ceiling. */
const MAX_DELTA = 1000
const MIN_REASON = 3
const MAX_REASON = 280

/** The chips exist so the common calibration nudges need no typing at all. */
const QUICK: number[] = [5, 25, -5, -25]

const INPUT_CLS = `min-h-11 w-full border border-ink bg-paper-raised px-3 py-2 font-mono text-d13 text-ink transition-colors placeholder:text-ink-faint focus:bg-white ${FOCUS_RING}`

type Status = 'idle' | 'submitting' | 'done' | 'error'

export function HlLever({
  itemId,
  title,
  currentHp,
  bracket,
  onApplied,
  prefill,
}: {
  itemId: string
  title: string
  /** Live decayed HL as of the dossier fetch — a projection base, not the truth. */
  currentHp: number
  bracket: string
  onApplied: (result: HlAdjustResult) => void
  /**
   * Load an adjustment into the form without committing it. The REVERTIR
   * action on an audit row uses this so reversal rides the ONE POST path that
   * writes an audit row, instead of growing a second, quieter one. `nonce`
   * makes two identical reversals distinguishable — without it, clicking
   * REVERTIR twice on the same row would not re-fill a form the operator had
   * since cleared.
   */
  prefill?: { delta: number; reason: string; nonce: number } | null
}) {
  const [amount, setAmount] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HlAdjustResult | null>(null)

  const amountId = useId()
  const reasonId = useId()
  const dialogTitleId = useId()

  // Adopt a prefill exactly once per nonce. Comparing against the last one
  // consumed keeps the operator's own edits from being stomped on every
  // parent re-render (the dossier re-renders whenever the list refreshes).
  const lastNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!prefill || prefill.nonce === lastNonce.current) return
    lastNonce.current = prefill.nonce
    setAmount(String(Math.abs(prefill.delta)))
    setSign(prefill.delta < 0 ? -1 : 1)
    setReason(prefill.reason.slice(0, MAX_REASON))
    setStatus('idle')
    setError(null)
    setResult(null)
    setConfirming(false)
  }, [prefill])

  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'submitting') setConfirming(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming, status])

  const magnitude = Number(amount)
  const valid = Number.isFinite(magnitude) && magnitude > 0
  const delta = round(sign * (valid ? magnitude : 0), 2)
  const trimmed = reason.trim()

  // The floor is the server's (`greatest(0, before + delta)`), mirrored so the
  // projection cannot promise a negative HL the RPC would never write.
  const projected = Math.max(0, round(currentHp + delta, 2))
  const projectedBracket = hlBracket(projected)
  const crosses = valid && projectedBracket !== bracket

  // One always-visible line stating what is still missing. An operator should
  // never have to press a disabled button to find out why it is disabled.
  const blocker = !valid
    ? 'INDICA UNA CANTIDAD MAYOR QUE CERO'
    : magnitude > MAX_DELTA
      ? `EL SERVIDOR RECHAZA AJUSTES MAYORES A ${MAX_DELTA} HL`
      : trimmed.length < MIN_REASON
        ? `EL MOTIVO ES OBLIGATORIO — MÍNIMO ${MIN_REASON} CARACTERES`
        : trimmed.length > MAX_REASON
          ? `EL MOTIVO EXCEDE ${MAX_REASON} CARACTERES`
          : null

  const submit = async () => {
    // Guard the double-submit at the top rather than trusting `disabled`: a
    // keyboard repeat can fire twice before React re-renders the button, and
    // two adjustments is two audit rows and twice the HL.
    if (status === 'submitting' || blocker) return
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(`/api/admin/items/${encodeURIComponent(itemId)}/hp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason: trimmed }),
      })
      const body = (await res.json()) as Partial<HlAdjustResult> & { error?: string }
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`)
        setStatus('error')
        return
      }
      const applied: HlAdjustResult = {
        before: Number(body.before ?? 0),
        after: Number(body.after ?? 0),
        applied: Number(body.applied ?? 0),
      }
      setResult(applied)
      setStatus('done')
      // Clear the form on success. Leaving the amount armed behind a success
      // readout is how the same injection gets applied twice.
      setAmount('')
      setReason('')
      onApplied(applied)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LA PETICIÓN NO LLEGÓ')
      setStatus('error')
    }
  }

  const closeDialog = () => {
    if (status === 'submitting') return
    setConfirming(false)
    setStatus('idle')
    setError(null)
    setResult(null)
  }

  return (
    <section className="flex flex-col gap-3 border border-ink bg-paper-raised p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink pb-2">
        <h3 className="font-syne text-d18 font-extrabold uppercase text-ink">Palanca de HL</h3>
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          AJUSTE AUDITADO · REGISTRO PÚBLICO EN LA FICHA
        </span>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[9rem] flex-col gap-1">
          <span
            id={amountId}
            className="font-mono text-d11 uppercase tracking-widest text-ink-faint"
          >
            CANTIDAD (HL)
          </span>
          <input
            type="number"
            step="0.5"
            min="0"
            max={MAX_DELTA}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-labelledby={amountId}
            placeholder="0.0"
            className={INPUT_CLS}
          />
        </label>

        {/* Direction is state, not two rival commit buttons: the projection
            below has to describe the adjustment that will actually commit, and
            it cannot do that if two buttons carry two opposite signs. Tone is
            paired to meaning — ink adds, sys-red subtracts. */}
        <div
          role="group"
          aria-label="Dirección del ajuste"
          className="flex items-stretch"
        >
          <button
            type="button"
            onClick={() => setSign(1)}
            aria-pressed={sign === 1}
            data-cue="latch"
            className={`min-h-11 border px-4 font-mono text-d13 uppercase tracking-widest ${FOCUS_RING} ${
              sign === 1
                ? 'border-ink bg-ink font-bold text-paper'
                : 'border-ink text-ink hover:bg-ink hover:text-paper'
            }`}
          >
            INYECTAR
          </button>
          <button
            type="button"
            onClick={() => setSign(-1)}
            aria-pressed={sign === -1}
            data-cue="latch"
            className={`-ml-px min-h-11 border px-4 font-mono text-d13 uppercase tracking-widest ${FOCUS_RING} ${
              sign === -1
                ? 'border-sys-red-paper bg-sys-red-paper font-bold text-paper'
                : 'border-sys-red-paper text-sys-red-paper hover:bg-sys-red-paper hover:text-paper'
            }`}
          >
            RESTAR
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setAmount(String(Math.abs(q)))
                setSign(q < 0 ? -1 : 1)
              }}
              className={`min-h-11 border border-ink px-3 font-mono text-d11 uppercase tabular-nums tracking-widest text-ink-soft hover:bg-ink hover:text-paper ${FOCUS_RING}`}
            >
              {q > 0 ? '+' : '−'}
              {Math.abs(q)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span
          id={reasonId}
          className="font-mono text-d11 uppercase tracking-widest text-ink-faint"
        >
          MOTIVO — OBLIGATORIO, QUEDA EN LA BITÁCORA
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={MAX_REASON}
          aria-labelledby={reasonId}
          aria-describedby={blocker ? `${reasonId}-blocker` : undefined}
          placeholder="Prueba de la rejilla con un mix por encima del evento de esta noche…"
          className={`${INPUT_CLS} resize-y`}
        />
      </label>

      {/* PROYECCIÓN — bracket word on both sides so a nudge that crosses a band
          boundary is visible before it is committed, not after. */}
      <div className="grid grid-cols-1 gap-px border border-ink bg-ink/15 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5 bg-paper px-3 py-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            HL ACTUAL
          </span>
          <span className="font-syne text-d18 font-extrabold uppercase text-ink">{bracket}</span>
          <span className="font-grotesk text-d13 tabular-nums text-hp">
            {currentHp.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-paper px-3 py-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            AJUSTE
          </span>
          <span
            className={`font-grotesk text-d18 font-bold tabular-nums ${
              sign < 0 ? 'text-sys-red-paper' : 'text-ink'
            }`}
          >
            {valid ? `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}` : '—'}
          </span>
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {sign < 0 ? 'RESTA' : 'INYECCIÓN'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-paper px-3 py-2">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            HL RESULTANTE
          </span>
          <span className="font-syne text-d18 font-extrabold uppercase text-ink">
            {valid ? projectedBracket : '—'}
          </span>
          <span className="font-grotesk text-d13 tabular-nums text-hp">
            {valid ? projected.toFixed(2) : '—'}
          </span>
        </div>
      </div>

      {crosses && (
        <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink">
          ESTE AJUSTE CRUZA DE {bracket} A {projectedBracket}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <InkButton
          onClick={() => {
            setStatus('idle')
            setError(null)
            setResult(null)
            setConfirming(true)
          }}
          disabled={Boolean(blocker)}
          tone={sign < 0 ? 'red' : 'ink'}
        >
          {sign < 0 ? 'RESTAR' : 'INYECTAR'} {valid ? Math.abs(delta).toFixed(1) : '—'} HL
        </InkButton>
        {blocker && (
          <span
            id={`${reasonId}-blocker`}
            className="font-mono text-d11 uppercase tracking-widest text-ink-faint"
          >
            {blocker}
          </span>
        )}
      </div>

      <MarginNote>
        INSTRUMENTO DE CALIBRACIÓN DE BETA: SIRVE PARA VER LA REJILLA EN ESTADOS QUE 61 CUENTAS NO
        PRODUCEN EN MESES. NO ES UNA PALANCA DE PROMOCIÓN — PARA ESO ESTÁN EDITORIAL, DESTACADO Y
        FIJADO, QUE SON DECLARATIVOS Y NO FINGEN INTERACCIÓN.
      </MarginNote>

      {confirming && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative max-h-full w-full max-w-lg overflow-y-auto border border-ink bg-paper p-5 text-ink shadow-lift selection:bg-acid selection:text-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDialog}
              disabled={status === 'submitting'}
              aria-label="Cerrar"
              className={`absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-ink-faint hover:text-ink disabled:opacity-40 ${FOCUS_RING}`}
            >
              <X size={14} strokeWidth={1.5} />
            </button>

            <header
              id={dialogTitleId}
              className="mb-3 flex items-baseline gap-2 border-b border-ink pb-2 pr-10 font-mono text-d11 tracking-widest"
            >
              <span className="font-bold">AJUSTE DE HL</span>
              <span className="min-w-0 truncate text-ink-faint">— {title.toUpperCase()}</span>
            </header>

            {status === 'done' && result ? (
              <div className="flex flex-col gap-3">
                {/* Server numbers only. The projection above was computed
                    against a `before` measured at dossier-fetch time; the RPC
                    re-decays to the instant of the write and floors at 0, so
                    the two legitimately differ. */}
                <p className="font-syne text-d28 font-extrabold tabular-nums text-hp">
                  {result.applied >= 0 ? '+' : '−'}
                  {Math.abs(result.applied).toFixed(2)} HL
                </p>
                <div className="grid grid-cols-2 gap-3 border border-ink bg-paper-raised p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      ANTES (SERVIDOR)
                    </span>
                    <span className="font-grotesk text-d18 font-bold tabular-nums text-ink">
                      {result.before.toFixed(2)}
                    </span>
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      {hlBracket(result.before)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      DESPUÉS (SERVIDOR)
                    </span>
                    <span className="font-grotesk text-d18 font-bold tabular-nums text-hp">
                      {result.after.toFixed(2)}
                    </span>
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      {hlBracket(result.after)}
                    </span>
                  </div>
                </div>
                {Math.abs(result.applied - delta) > 0.01 && (
                  <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-soft">
                    LO APLICADO DIFIERE DE LO PEDIDO: EL SERVIDOR RECALCULÓ EL DECAIMIENTO AL
                    INSTANTE DE LA ESCRITURA Y APLICA UN PISO EN 0.
                  </p>
                )}
                <InkButton onClick={closeDialog}>CERRAR</InkButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 border border-ink bg-paper-raised p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      HL ACTUAL
                    </span>
                    <span className="font-syne text-d18 font-extrabold uppercase text-ink">
                      {bracket}
                    </span>
                    <span className="font-grotesk text-d13 tabular-nums text-hp">
                      {currentHp.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      HL RESULTANTE
                    </span>
                    <span className="font-syne text-d18 font-extrabold uppercase text-ink">
                      {projectedBracket}
                    </span>
                    <span className="font-grotesk text-d13 tabular-nums text-hp">
                      {projected.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="border border-sys-red-paper bg-sys-red-paper/5 p-2.5">
                  <p className="flex items-start gap-2 font-mono text-d11 leading-relaxed text-sys-red-paper">
                    <AlertTriangle size={12} strokeWidth={1.5} className="mt-px shrink-0" />
                    <span>
                      El puntaje de la rejilla se normaliza contra el <strong>máximo por tipo</strong>{' '}
                      de cada página. Subir la HL de esta pieza sube el pico de su tipo y por lo
                      tanto <strong>baja de posición a todas las demás piezas del mismo tipo</strong>{' '}
                      en la misma página. Es inherente al modelo de curaduría, no un efecto de esta
                      pantalla.
                    </span>
                  </p>
                </div>

                <p className="font-mono text-d11 leading-relaxed text-ink-soft">
                  El ajuste queda en la bitácora de auditoría con tu nombre y tu motivo, y aparece en
                  el historial de la pieza como <strong>AJUSTE ADMIN</strong>, separado de la
                  interacción orgánica. No es una escritura silenciosa. Revertirlo requiere un
                  ajuste inverso, que también se registra.
                </p>

                <div className="border border-ink bg-paper-raised p-2.5">
                  <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                    MOTIVO
                  </span>
                  <p className="mt-1 font-grotesk text-d13 leading-snug text-ink">{trimmed}</p>
                </div>

                {error && (
                  <p className="flex items-center gap-1.5 border border-sys-red-paper bg-sys-red-paper/10 px-2 py-1 font-mono text-d11 uppercase tracking-widest text-sys-red-paper">
                    <AlertTriangle size={11} strokeWidth={1.5} className="shrink-0" />
                    {error.toUpperCase()}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={status === 'submitting'}
                    className={`min-h-11 border border-ink px-4 font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    CANCELAR
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={status === 'submitting' || Boolean(blocker)}
                    className={`flex min-h-11 items-center gap-1.5 border border-sys-red-paper bg-sys-red-paper px-4 font-mono text-d13 font-bold uppercase tracking-widest text-paper hover:bg-paper hover:text-sys-red-paper disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    {status === 'submitting' ? (
                      <>
                        <span
                          aria-hidden
                          className="h-3.5 w-px bg-current motion-safe:animate-blink"
                        />
                        APLICANDO…
                      </>
                    ) : (
                      <>
                        CONFIRMAR {delta > 0 ? '+' : '−'}
                        {Math.abs(delta).toFixed(2)} HL
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
