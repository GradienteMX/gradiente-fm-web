'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { ReportOverlay, type ReportTargetType } from './ReportOverlay'

// ── ReportButton ───────────────────────────────────────────────────────────
//
// The safety valve. Deliberately the quietest control in any row it joins:
// a hairline chip in ink-faint that only comes up to full ink on hover. It is
// used a handful of times a year and should never compete with CITAR, GUARDAR
// or the reaction chips for attention.
//
// Logged out it renders NOTHING. /api/reports 401s without a session (RLS ties
// reporter_id to auth.uid()), so a visible REPORTAR for an anonymous reader
// would be an affordance that cannot work — the one thing this design language
// forbids outright. Sending them to the login sheet instead was considered and
// dropped: "report this" is not a reason to demand an account, and the gesture
// would be lost across the redirect anyway.
//
// Tap target: the chip paints at ~20px so it sits inside dense post chrome
// without distorting it, and the ::before pad extends the hit box to ~44px
// without touching layout — the same trick WidgetFrame's header action uses.
// Hosts with a taller row (the foro post header, where BORRAR is already
// min-h-11) pass `className="min-h-11 px-2"` and get a full-height chip.
//
// NOT wired to `item` or `listing` in this pass, even though the API accepts
// both target types. That is a decision, not an oversight: the overlay reader
// and the marketplace card are dense, high-traffic surfaces where a report
// control needs its own placement study. The types stay in the union so the
// day that study happens, only the host changes.

// Objects this browser session has already reported. Module-level, so the
// latch survives the button unmounting — comment rows remount on every
// reaction, and a re-offered REPORTAR would imply the first press did nothing.
// Not persisted: a page reload re-offers the control, and the API answers a
// second press with { ok: true, duplicate: true }, which lands in the same
// place. Persisting it would mean trusting localStorage over the database.
const filed = new Set<string>()

const key = (t: ReportTargetType, id: string) => `${t}:${id}`

export interface ReportButtonProps {
  targetType: ReportTargetType
  targetId: string
  className?: string
}

export function ReportButton({ targetType, targetId, className = '' }: ReportButtonProps) {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(() => filed.has(key(targetType, targetId)))
  // The acknowledgement is a distinct, short-lived label — it tells the user
  // the write landed. After it lapses the chip settles into its permanent
  // latched state, which says the same thing in the past tense.
  const [ack, setAck] = useState(false)
  const ackTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (ackTimer.current) window.clearTimeout(ackTimer.current)
    }
  }, [])

  if (!currentUser) return null

  const onFiled = () => {
    filed.add(key(targetType, targetId))
    setOpen(false)
    setDone(true)
    setAck(true)
    ackTimer.current = window.setTimeout(() => setAck(false), 4000)
  }

  const base =
    "relative inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-widest transition-colors before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']"

  if (done) {
    return (
      <span
        role="status"
        className={`${base} border-ink bg-paper-raised text-ink-faint ${className}`}
        title="Ya enviaste un reporte de este contenido"
      >
        <Flag size={10} strokeWidth={1.5} aria-hidden />
        <span>{ack ? 'REPORTE ENVIADO' : 'REPORTADO'}</span>
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar este contenido"
        title="Reportar"
        className={`${base} border-ink/15 text-ink-faint hover:border-ink hover:bg-ink hover:text-paper ${FOCUS_RING} ${className}`}
      >
        <Flag size={10} strokeWidth={1.5} aria-hidden />
        <span>REPORTAR</span>
      </button>
      {open && (
        <ReportOverlay
          targetType={targetType}
          targetId={targetId}
          onClose={() => setOpen(false)}
          onFiled={onFiled}
        />
      )}
    </>
  )
}
