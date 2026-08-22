'use client'

// ── ACTIVIDAD — the sole inbox (FINAL_SPEC §3.2 · WP6) ──────────────────────
//
// One merged reverse-chron list from the provider's `activity` slice
// (lib/dashboard/activity.ts — four prod-validated derived queries + LOGRO,
// which VALIDATED and ships per R3, + the partner-team OFERTA fold-in the
// provider merges on the ≥5-min partner cadence). The widget only renders;
// it never fetches, never opens channels.
//
// Read-state is the ONE localStorage watermark (lib/dashboard/localState):
//   · unread = rows newer than the watermark — computed with the SAME
//     countUnreadActivity the StatusStrip uses, so the spine number and this
//     badge can never diverge (§3.0/§3.2).
//   · the watermark advances only after the widget has been ≥50% in-viewport
//     for 2s (IntersectionObserver + dwell timer) — an offscreen mount NEVER
//     clears the badge — or through the single MARCAR VISTO header action.
//   · NO per-row read state, NO inner tabs — sources are distinguished by
//     the d13 mono chip only.
//
// SCALE PASS (S1/S2/S3/S4): exactly 5 whole 52px rows at the {4,4} default —
// computed by design, never by overflow — each led by a 28px identity block
// (actor avatar / initial-letter / trophy sigil). NO internal scroll region
// exists at default size; overflow is declared by ONE VerRow
// «MOSTRAR ANTERIORES · N» that expands the list in place, and only that
// explicit depth choice makes the list scrollable.
//
// Row clicks open the target IN PLACE via lib/dashboard/openItem (1 click,
// cold-cache safe). Foro rows deep-link /foro?thread= — the sanctioned page
// exception. LOGRO rows are informational (no destination exists → no
// control, zero dead chrome).
//
// Footnotes are mono text, not controls: the R8 cadence label
// («SONDEO CADA 60S») and the DM named-future line.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
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

// §3.2 watermark semantics: ≥50% visible for 2s before the badge clears.
const DWELL_MS = 2_000
const NOTICE_MS = 4_000

// SCALE PASS S1 — the fixed default portion. Exactly this many whole rows
// render at the {4,4} default; the remainder lives behind the VerRow.
const VISIBLE_ROWS = 5

// Display names for the source chips (activity.ts ships accent-free enum
// values; the chip is UI copy).
const SOURCE_LABEL: Record<ActivityRow['source'], string> = {
  COMENTARIO: 'COMENTARIO',
  FORO: 'FORO',
  REACCION: 'REACCIÓN',
  LOGRO: 'LOGRO',
  OFERTA: 'OFERTA',
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true })
  } catch {
    return ''
  }
}

// ── Row copy («actor · verbo · objetivo», §3.2) ─────────────────────────────

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

// ── S3 identity block ───────────────────────────────────────────────────────
//
// The 28px block leading every row: actor avatar (SmartImage, object-cover,
// 1px ink border) when the profile carries one; an honest initial-letter
// block (ink plate, paper letter) when it does not; LOGRO rows carry the
// trophy sigil stamp instead. Never an empty grey square (S3).

function RowIdentityBlock({ row, actor }: { row: ActivityRow; actor: User | undefined }) {
  if (row.kind === 'logro') {
    const sigil = trophyByKey(row.trophyKey ?? '')?.sigil ?? '◇'
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center border border-ink bg-paper font-mono text-d13 text-ink"
      >
        {sigil}
      </span>
    )
  }
  if (actor?.avatarUrl) {
    return (
      <span aria-hidden className="relative block h-7 w-7 shrink-0 overflow-hidden border border-ink">
        <SmartImage src={actor.avatarUrl} alt="" sizes="28px" className="object-cover" />
      </span>
    )
  }
  // No avatar (or no resolvable actor, e.g. collapsed REACCIÓN rows) →
  // typographic block: the actor's initial, or a neutral middot.
  const initial = (actor?.displayName || actor?.username || '·').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center border border-ink bg-ink font-mono text-d13 uppercase text-paper"
    >
      {initial}
    </span>
  )
}

// ── Single row ──────────────────────────────────────────────────────────────

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

  // Destination resolution (§3.2): item overlay in place · foro page ·
  // MERCADO (OFERTA) · none (LOGRO / unresolved targets → informational row).
  const target: 'item' | 'foro' | 'mercado' | null = row.itemSlug
    ? 'item'
    : row.threadId
      ? 'foro'
      : row.kind === 'oferta'
        ? 'mercado'
        : null

  // SCALE PASS S2 row anatomy — min-h 52px, identity block 28px, single-line
  // sentence + excerpt (truncate keeps the row height deterministic for the
  // S1 portion arithmetic).
  const body = (
    <>
      <RowIdentityBlock row={row} actor={actor} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-grotesk text-d15 text-ink">{sentence}</p>
        {row.excerpt && (
          <p className="truncate font-grotesk text-d13 text-ink-faint">{row.excerpt}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="border border-ink px-1.5 font-mono text-d13 uppercase tracking-widest text-ink-soft">
          {SOURCE_LABEL[row.source]}
        </span>
        <span className="font-mono text-d11 text-ink-soft">{timeAgo(row.createdAt)}</span>
      </div>
    </>
  )

  if (!target) {
    // Informational row — no destination exists, so no control (zero dead
    // chrome; a non-working button would be worse than none).
    return <div className="flex min-h-[52px] items-center gap-3 py-1">{body}</div>
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
      className={`flex min-h-[52px] w-full items-center gap-3 py-1 text-left hover:bg-paper ${FOCUS_RING}`}
    >
      {body}
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function ActividadWidget({ compact }: DashboardWidgetProps) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { activity, loaded, errors, afterMutation } = useDashboardData()
  const uid = currentUser?.id ?? null

  // The ONE watermark — same key, same subscription the StatusStrip uses.
  const [watermark, setWatermark] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) {
      setWatermark(null)
      return
    }
    setWatermark(readLastSeenActivity(uid))
    return subscribeLastSeenActivity(() => setWatermark(readLastSeenActivity(uid)))
  }, [uid])

  // Unread — the IDENTICAL derivation the spine renders (shared function,
  // shared watermark: one number, one source).
  const unread = useMemo(
    () => countUnreadActivity(activity, watermark),
    [activity, watermark],
  )
  const latestTs = useMemo(() => latestActivityTimestamp(activity), [activity])

  // ── In-viewport watermark advance (≥50% for 2s; never on mount) ───────────
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
      // advance-only + no-op when already ≥ latestTs → exactly one
      // localStorage write per real advancement.
      () => advanceLastSeenActivity(uid, latestTs),
      DWELL_MS,
    )
    return () => window.clearTimeout(timer)
  }, [inView, uid, latestTs, unread])

  // Transient honest-failure notice (openItem returned false).
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const goCrear = () => router.push('/dashboard?section=nuevo')

  // SCALE PASS S1 — in-place depth expansion. Default renders exactly
  // VISIBLE_ROWS whole rows; the VerRow toggles the full list, and ONLY that
  // explicit choice makes the list a scroll region.
  const [wantsExpanded, setWantsExpanded] = useState(false)
  const overflowCount = Math.max(0, activity.length - VISIBLE_ROWS)
  // Derived, not stored: if the list shrinks back under the portion there is
  // nothing to expand — the widget returns to the fixed-portion state instead
  // of idling in a scroll state with no toggle.
  const expanded = wantsExpanded && overflowCount > 0

  // Split the visible slice at the watermark: rows since the last visit
  // render above the rule line. `activity` is reverse-chron and the watermark
  // partitions by createdAt, so slicing first preserves the merged order.
  const visibleRows = useMemo(
    () => (expanded ? activity : activity.slice(0, VISIBLE_ROWS)),
    [activity, expanded],
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

  // ── Compact teaching row (§2.5 data-aware boot) ───────────────────────────
  if (compact) {
    return (
      <div id={dashWidgetDomId('actividad')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="ACTIVIDAD"
          compact
          loading={isLoading}
          action={{ label: 'CREAR', onClick: goCrear }}
        >
          {/* Copy budgeted to the narrowest stored width — wraps, never clamps. */}
          <p className="min-w-0 font-mono text-d13 text-ink-soft">
            {'// '}SIN SEÑALES — las respuestas llegan aquí.
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
              {'// '}NO DISPONIBLE — ese contenido ya no está publicado.
            </p>
          )}

          {isError ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-2">
              <p className="font-grotesk text-d13 text-ink">
                {'// '}SEÑAL INTERRUMPIDA
              </p>
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
                {'// '}SIN SEÑALES AÚN — publica o comenta; las respuestas aparecen
                aquí.
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
              {/* SCALE PASS portion arithmetic (S1, {4,4} default) — content
                  budget 369px (WidgetFrame chrome arithmetic: 4×96 + 3×24 −
                  87). Fixed portion: 5 rows × 52px = 260 · watermark rule
                  20 (16 line + 4 py) · VerRow 4 (mt) + 44 = 48 · footnotes
                  39 (1 border + 6 pt + 2×16 lines) → worst case 367 ≤ 369.
                  NO internal scroll at default — overflow-y-auto exists ONLY
                  in the expanded state the user chose. */}
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
                      {'// '}DESDE TU ÚLTIMA VISITA
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
              {/* S4 overflow declaration — the ONE affordance for the rows
                  beyond the fixed portion. Expands in place (explicit depth
                  choice) and toggles back. */}
              {overflowCount > 0 && (
                <div className="mt-1 shrink-0">
                  <VerRow
                    label={expanded ? 'MOSTRAR MENOS' : 'MOSTRAR ANTERIORES'}
                    count={expanded ? undefined : overflowCount}
                    onClick={() => setWantsExpanded(!expanded)}
                  />
                </div>
              )}
              {/* The ledger (judge r2 fix 9a): on sparse days the room between
                  the last row and the footnotes is ruled like an empty printed
                  ledger — hairline baseline rules on the 24px grid
                  (.dash-ledger, globals.css) — «room reserved for signals»,
                  not breakage. flex-1 with basis 0 means it consumes ONLY free
                  space: a full portion collapses it to nothing. Zero fake
                  rows; one mono line, only while the list is sparse. In the
                  expanded state the scrolling list owns the flex budget, so
                  the ledger stands down. */}
              {!expanded && (
                <div aria-hidden className="dash-ledger min-h-0 flex-1 overflow-hidden">
                  {activity.length <= 3 && (
                    <p className="font-mono text-d11 leading-6 text-ink-soft">
                      {'// '}espacio reservado para señales.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Mono footnotes — system voice, not controls (§3.2, R8). Pinned to
              the widget bottom (mt-auto) so they read as the sheet's colophon
              regardless of how sparse the day is (fix 9a). */}
          <div className="mt-auto shrink-0 border-t border-ink pt-1.5">
            <p className="font-mono text-d11 uppercase tracking-widest text-ink-soft">
              {'// '}SONDEO CADA 60S
            </p>
            <p className="font-mono text-d11 text-ink-soft">
              {'// '}mensajes directos: futuro con nombre, sin fecha.
            </p>
          </div>
        </div>
      </WidgetFrame>
    </div>
  )
}
