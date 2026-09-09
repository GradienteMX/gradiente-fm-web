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
// Exposed rows become seen individually after 2s. Explicit mark-all retains
// the legacy watermark. StatusStrip uses the same combined unread rule.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  markActivityRowSeen,
  readSeenActivity,
  advanceLastSeenActivity,
  readLastSeenActivity,
  subscribeLastSeenActivity,
} from '@/lib/dashboard/localState'
import { isActivityUnread, type SeenActivity } from '@/lib/dashboard/activityRead'
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

// Read only the row actually exposed, including clipping inside the list.
function ActivityExposure({ row, uid, unread, children }: { row: ActivityRow; uid: string | null; unread: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!uid || !unread || !ref.current) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let visible = false
    const update = () => {
      clearTimeout(timer)
      if (visible && document.visibilityState === 'visible') timer = setTimeout(() => markActivityRowSeen(uid, row.key, row.createdAt), DWELL_MS)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.75; update() }, { threshold: [0, 0.75, 1] })
    observer.observe(ref.current)
    document.addEventListener('visibilitychange', update)
    return () => { observer.disconnect(); clearTimeout(timer); document.removeEventListener('visibilitychange', update) }
  }, [uid, unread, row.key, row.createdAt])
  return <div ref={ref} className="flex items-center gap-2 border-b border-ink/15 last:border-b-0">
    <span aria-label={unread ? 'Sin leer' : 'Leído'} className={`h-1.5 w-1.5 shrink-0 ${unread ? 'border border-ink bg-acid' : 'bg-transparent'}`} />
    <div className="min-w-0 flex-1">{children}</div>
  </div>
}

// ── The widget ──────────────────────────────────────────────────────────────

export function ActividadWidget({ size, compact }: DashboardWidgetProps) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { activity, loaded, errors, afterMutation } = useDashboardData()
  const uid = currentUser?.id ?? null

  const [seen, setSeen] = useState<SeenActivity>({})
  const [watermark, setWatermark] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) {
      setWatermark(null)
      setSeen({})
      return
    }
    const sync = () => { setWatermark(readLastSeenActivity(uid)); setSeen(readSeenActivity(uid)) }
    sync()
    return subscribeLastSeenActivity(sync)
  }, [uid])

  const unread = useMemo(
    () => countUnreadActivity(activity, watermark, seen),
    [activity, watermark, seen],
  )
  const latestTs = useMemo(() => latestActivityTimestamp(activity), [activity])

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
  const isLoading = loaded.activity !== true && !errors.activity && activity.length === 0
  const isError = !!errors.activity && activity.length === 0
  const isEmpty = loaded.activity === true && !errors.activity && activity.length === 0

  const markSeenAction =
    !compact && unread > 0 && uid && latestTs
      ? {
          label: 'MARCAR TODO VISTO',
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
    <div id={dashWidgetDomId('actividad')} className="h-full scroll-mt-14">
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
                {visibleRows.map((row) => (
                  <ActivityExposure key={row.key} row={row} uid={uid} unread={isActivityUnread(row, watermark, seen)}>
                    <ActivityRowView row={row} onUnavailable={() => setNotice('unavailable')} />
                  </ActivityExposure>
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
