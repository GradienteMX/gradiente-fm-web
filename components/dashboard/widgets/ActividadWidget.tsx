'use client'

// ── ACTIVIDAD — the sole inbox (revision-2 point 11) ────────────────────────
//
// One merged reverse-chron list from the provider's `activity` slice. The
// widget only renders; it never fetches, never opens channels.
//
// Revision-2: the register is SMALLER (d13 sentence / 24px identity block /
// 40px rows) so MORE of what happened is visible per size; rows carry the
// actor's NAME but NO date (Iker: «con nombres sin fecha»); the SONDEO and
// DM-futuro footnotes are gone. A row click opens the target content as the
// in-place overlay popup — comment rows land with the comments column
// addressed (`?comment=`), so the reply happens right there.
//
// Read-state is still the ONE localStorage watermark: unread computed with
// the same countUnreadActivity the StatusStrip uses; the watermark advances
// after ≥50%-in-viewport for 2s or via MARCAR VISTO. No per-row read state.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { SmartImage } from '@/components/SmartImage'
import { FOCUS_RING, VerRow, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import {
  countUnreadActivity,
  scrollToDashWidget,
} from '@/components/dashboard/shell/StatusStrip'
import {
  advanceLastSeenActivity,
  readLastSeenActivity,
  subscribeLastSeenActivity,
} from '@/lib/dashboard/localState'
import { latestActivityTimestamp, type ActivityRow } from '@/lib/dashboard/activity'
import { useOpenItem } from '@/lib/dashboard/openItem'
import type { User } from '@/lib/types'
import { useResolvedUser } from '@/lib/userOverrides'
import { trophyByKey } from '@/lib/trophies'

const DWELL_MS = 2_000
const NOTICE_MS = 4_000

const SOURCE_LABEL: Record<ActivityRow['source'], string> = {
  COMENTARIO: 'COMENTARIO',
  FORO: 'FORO',
  REACCION: 'REACCIÓN',
  LOGRO: 'LOGRO',
  OFERTA: 'OFERTA',
}

// ── Row copy («actor · verbo · objetivo») — names, no dates ─────────────────

function rowSentence(row: ActivityRow, actorName: string): string {
  const t = row.targetTitle ? `«${row.targetTitle}»` : ''
  switch (row.kind) {
    case 'comment_on_item':
      return t ? `${actorName} comentó en ${t}` : `${actorName} comentó en tu publicación`
    case 'reply_to_comment':
      return t
        ? `${actorName} respondió a tu comentario en ${t}`
        : `${actorName} respondió a tu comentario`
    case 'reaction': {
      const n = row.count ?? 1
      const noun = n === 1 ? '1 reacción' : `${n} reacciones`
      return t ? `${noun} a tu comentario en ${t}` : `${noun} a tu comentario`
    }
    case 'foro_reply':
      return t ? `${actorName} respondió en tu hilo ${t}` : `${actorName} respondió en tu hilo`
    case 'foro_quote':
      return t
        ? `${actorName} citó tu respuesta en ${t}`
        : `${actorName} citó tu respuesta`
    case 'logro':
      return `Trofeo desbloqueado — ${row.targetTitle}`
    case 'oferta':
      return t ? `${actorName} dejó una oferta en ${t}` : `${actorName} dejó una oferta`
  }
}

// ── Identity block — 24px (the smaller revision-2 register) ─────────────────

function RowIdentityBlock({ row, actor }: { row: ActivityRow; actor: User | undefined }) {
  if (row.kind === 'logro') {
    const sigil = trophyByKey(row.trophyKey ?? '')?.sigil ?? '◇'
    return (
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-paper font-mono text-d11 text-ink"
      >
        {sigil}
      </span>
    )
  }
  if (actor?.avatarUrl) {
    return (
      <span aria-hidden className="relative block h-6 w-6 shrink-0 overflow-hidden border border-ink">
        <SmartImage src={actor.avatarUrl} alt="" sizes="24px" className="object-cover" />
      </span>
    )
  }
  const initial = (actor?.displayName || actor?.username || '·').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-d11 uppercase text-paper"
    >
      {initial}
    </span>
  )
}

// ── Single row — 40px, d13, no timestamp ────────────────────────────────────

function ActivityRowView({
  row,
  onUnavailable,
}: {
  row: ActivityRow
  onUnavailable: () => void
}) {
  const router = useRouter()
  const openItem = useOpenItem()
  const actor = useResolvedUser(row.actorId ?? undefined)
  const actorName = actor ? actor.displayName || `@${actor.username}` : 'Alguien'
  const sentence = rowSentence(row, actorName)

  const target: 'item' | 'foro' | 'mercado' | null = row.itemSlug
    ? 'item'
    : row.threadId
      ? 'foro'
      : row.kind === 'oferta'
        ? 'mercado'
        : null

  const body = (
    <>
      <RowIdentityBlock row={row} actor={actor} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-grotesk text-d13 text-ink">{sentence}</p>
        {row.excerpt && (
          <p className="truncate font-grotesk text-d11 text-ink-faint">{row.excerpt}</p>
        )}
      </div>
      <span className="shrink-0 border border-ink px-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">
        {SOURCE_LABEL[row.source]}
      </span>
    </>
  )

  if (!target) {
    // Informational row — no destination exists, so no control.
    return <div className="flex min-h-10 items-center gap-2.5 py-0.5">{body}</div>
  }

  const onClick = () => {
    if (target === 'foro' && row.threadId) {
      router.push(`/foro?thread=${encodeURIComponent(row.threadId)}`)
      return
    }
    if (target === 'mercado') {
      scrollToDashWidget('mercado')
      return
    }
    if (row.itemSlug) {
      // The popup: the content overlay opens in place, comments column
      // addressed — responding happens right there (point 11).
      void openItem(row.itemSlug, { commentId: row.commentId }).then((ok) => {
        if (!ok) onUnavailable()
      })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-cue="tick"
      className={`flex min-h-10 w-full items-center gap-2.5 py-0.5 text-left hover:bg-paper ${FOCUS_RING}`}
    >
      {body}
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function ActividadWidget({ size, compact }: DashboardWidgetProps) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { activity, loaded, errors, afterMutation } = useDashboardData()
  const uid = currentUser?.id ?? null

  const [watermark, setWatermark] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) {
      setWatermark(null)
      return
    }
    setWatermark(readLastSeenActivity(uid))
    return subscribeLastSeenActivity(() => setWatermark(readLastSeenActivity(uid)))
  }, [uid])

  const unread = useMemo(
    () => countUnreadActivity(activity, watermark),
    [activity, watermark],
  )
  const latestTs = useMemo(() => latestActivityTimestamp(activity), [activity])

  // In-viewport watermark advance (≥50% for 2s; never on mount).
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setInView(entry.intersectionRatio >= 0.5)
      },
      { threshold: [0, 0.5, 1] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!inView || !uid || !latestTs || unread === 0) return
    const timer = window.setTimeout(
      () => advanceLastSeenActivity(uid, latestTs),
      DWELL_MS,
    )
    return () => window.clearTimeout(timer)
  }, [inView, uid, latestTs, unread])

  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const goCrear = () => router.push('/dashboard?section=nuevo')

  // Fixed portion from the stored height — 40px rows against the frame
  // budgets (h2 129 / h3 249 / h4 369, minus the 44px VerRow when needed).
  const visibleCap = size.h >= 4 ? 8 : size.h >= 3 ? 5 : 2
  const [wantsExpanded, setWantsExpanded] = useState(false)
  const overflowCount = Math.max(0, activity.length - visibleCap)
  const expanded = wantsExpanded && overflowCount > 0

  const visibleRows = useMemo(
    () => (expanded ? activity : activity.slice(0, visibleCap)),
    [activity, expanded, visibleCap],
  )
  const newRows = useMemo(
    () => visibleRows.filter((row) => !watermark || row.createdAt > watermark),
    [visibleRows, watermark],
  )
  const seenRows = useMemo(
    () => visibleRows.filter((row) => !!watermark && row.createdAt <= watermark),
    [visibleRows, watermark],
  )

  const isLoading = loaded.activity !== true && !errors.activity && activity.length === 0
  const isError = !!errors.activity && activity.length === 0
  const isEmpty = loaded.activity === true && !errors.activity && activity.length === 0

  const markSeenAction =
    !compact && unread > 0 && uid && latestTs
      ? {
          label: 'MARCAR VISTO',
          cue: 'stamp',
          onClick: () => advanceLastSeenActivity(uid, latestTs),
        }
      : undefined

  if (compact) {
    return (
      <div id={dashWidgetDomId('actividad')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="ACTIVIDAD"
          compact
          loading={isLoading}
          action={{ label: 'CREAR', onClick: goCrear }}
        >
          <p className="min-w-0 font-mono text-d13 text-ink-soft">
            SIN SEÑALES — las respuestas llegan aquí.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  return (
    <div ref={rootRef} id={dashWidgetDomId('actividad')} className="h-full scroll-mt-14">
      <WidgetFrame
        title="ACTIVIDAD"
        count={unread > 0 ? unread : undefined}
        accent
        action={markSeenAction}
        loading={isLoading}
      >
        <div className="flex h-full min-h-0 flex-col">
          {notice && (
            <p className="pb-1 font-grotesk text-d13 text-ink">
              NO DISPONIBLE — ese contenido ya no está publicado.
            </p>
          )}

          {isError ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-2">
              <p className="font-grotesk text-d13 text-ink">SEÑAL INTERRUMPIDA</p>
              <button
                type="button"
                onClick={() => void afterMutation()}
                data-cue="tick"
                className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
              >
                REINTENTAR
              </button>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-2">
              <p className="font-mono text-d13 text-ink-soft">
                SIN SEÑALES AÚN — publica o comenta; las respuestas aparecen aquí.
              </p>
              <button
                type="button"
                onClick={goCrear}
                data-cue="tick"
                className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
              >
                CREAR
              </button>
            </div>
          ) : (
            <>
              <div className={expanded ? 'min-h-0 flex-1 overflow-y-auto' : 'shrink-0'}>
                {newRows.map((row) => (
                  <ActivityRowView
                    key={row.key}
                    row={row}
                    onUnavailable={() => setNotice('unavailable')}
                  />
                ))}
                {newRows.length > 0 && seenRows.length > 0 && (
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="whitespace-nowrap font-mono text-d11 tracking-widest text-ink-soft">
                      DESDE TU ÚLTIMA VISITA
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-ink" />
                  </div>
                )}
                {seenRows.map((row) => (
                  <ActivityRowView
                    key={row.key}
                    row={row}
                    onUnavailable={() => setNotice('unavailable')}
                  />
                ))}
              </div>
              {overflowCount > 0 && (
                <div className="mt-1 shrink-0">
                  <VerRow
                    label={expanded ? 'MOSTRAR MENOS' : 'MOSTRAR ANTERIORES'}
                    count={expanded ? undefined : overflowCount}
                    onClick={() => setWantsExpanded(!expanded)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </WidgetFrame>
    </div>
  )
}
