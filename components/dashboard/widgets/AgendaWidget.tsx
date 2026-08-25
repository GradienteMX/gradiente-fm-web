'use client'

// ── AGENDA — próximos as a LIST + ASISTIDOS (revision-2 point 14) ───────────
//
// The photo-card lead is retired: PRÓXIMOS renders as a plain date list so
// MORE than one event is visible at the default size. The foot carries two
// affordances side by side: ASISTIDOS (toggles to the past saved events —
// the honest attendance proxy until real attendance markers exist) and VER
// AGENDA ↗. Rows are the user's SAVED eventos date-asc; with zero saved the
// global upcoming pool fills the list under an honest label (never empty
// while any event exists — No-Algorithm-safe: global data, date order).
//
// Row click = event overlay in place via useOpenItem. Saved ★ renders
// through the per-key itemSavesCache subscription.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { isItemSavedSync, subscribeSavedItem } from '@/lib/itemSavesCache'
import type { ContentItem } from '@/lib/types'

const MONTHS_ES = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
] as const

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysUntil(iso: string): number {
  const event = new Date(iso)
  event.setHours(0, 0, 0, 0)
  return Math.round((event.getTime() - startOfToday().getTime()) / 86_400_000)
}

function urgencyLabel(iso: string): string {
  const days = daysUntil(iso)
  if (days <= 0) return 'HOY'
  if (days === 1) return 'MAÑANA'
  return `EN ${days} DÍAS`
}

type DatedEvent = ContentItem & { date: string }

function hasDate(item: ContentItem): item is DatedEvent {
  return item.type === 'evento' && typeof item.date === 'string' && item.date.length > 0
}

function SavedStar({ itemId }: { itemId: string }) {
  const subscribe = useCallback(
    (fn: () => void) => subscribeSavedItem(itemId, fn),
    [itemId],
  )
  const saved = useSyncExternalStore(
    subscribe,
    () => isItemSavedSync(itemId),
    () => false,
  )
  if (!saved) return null
  return (
    <span aria-label="Guardado" title="GUARDADO" className="font-mono text-d13 text-ink">
      ★
    </span>
  )
}

// One list row: date block · title · urgency/stamp · ★.
function EventRow({
  item,
  dead,
  past,
  onOpen,
}: {
  item: DatedEvent
  dead: boolean
  past?: boolean
  onOpen: () => void
}) {
  const date = new Date(item.date)
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cue="tick"
      className={`group flex min-h-11 w-full items-center gap-3 border-b border-ink text-left last:border-b-0 md:min-h-10 ${FOCUS_RING}`}
    >
      <span
        className={`w-14 shrink-0 font-mono text-d13 font-bold tabular-nums ${
          past ? 'text-ink-faint' : 'text-ink'
        }`}
      >
        {date.getDate()} {MONTHS_ES[date.getMonth()]}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-d15 font-medium group-hover:underline ${
          past ? 'text-ink-faint' : 'text-ink'
        }`}
      >
        {item.title}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {dead ? (
          <span className="font-mono text-d13 font-bold text-ink">NO DISPONIBLE</span>
        ) : past ? (
          <span className="border border-ink-faint px-1.5 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink-soft">
            ASISTIDO
          </span>
        ) : (
          <span className="font-mono text-d13 font-bold tabular-nums text-ink">
            {urgencyLabel(item.date)}
          </span>
        )}
        <SavedStar itemId={item.id} />
      </span>
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function AgendaWidget({ size, compact }: DashboardWidgetProps) {
  const ctx = useDashboardData()
  const router = useRouter()
  const openItem = useOpenItem()
  const [showPast, setShowPast] = useState(false)
  const [deadSlug, setDeadSlug] = useState<string | null>(null)

  const loading = !ctx.loaded.events && !ctx.errors.events
  const failed = ctx.errors.events === true

  const { upcomingSaved, pastSaved } = useMemo(() => {
    const today = startOfToday().getTime()
    const saved = ctx.saves.filter(hasDate)
    const upcoming = saved
      .filter((e) => new Date(e.date).getTime() >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const past = saved
      .filter((e) => new Date(e.date).getTime() < today)
      .sort((a, b) => b.date.localeCompare(a.date))
    return { upcomingSaved: upcoming, pastSaved: past }
  }, [ctx.saves])

  const globalUpcoming = useMemo(
    () => ctx.events.filter(hasDate),
    [ctx.events],
  )

  const handleOpen = useCallback(
    async (slug: string) => {
      const ok = await openItem(slug)
      if (!ok) setDeadSlug(slug)
    },
    [openItem],
  )
  const retry = useCallback(() => void ctx.afterMutation(), [ctx])

  if (compact) {
    return (
      <div id={dashWidgetDomId('agenda')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="AGENDA"
          compact
          loading={loading}
          action={{
            label: 'VER AGENDA ↗',
            onClick: () => router.push('/agenda'),
            cue: 'tick',
          }}
        >
          {failed ? (
            <ErrorLine onRetry={retry} />
          ) : (
            <p className="min-w-0 text-d15 text-ink">
              Guarda eventos con ★ y aparecen aquí.
            </p>
          )}
        </WidgetFrame>
      </div>
    )
  }

  const showGlobalFallback = upcomingSaved.length === 0
  const pool = showGlobalFallback ? globalUpcoming : upcomingSaved

  // Fixed list portion by stored height (44/40px rows against the frame
  // budgets, minus the teaching line and the 44px foot).
  const rowCap = size.h >= 4 ? 7 : size.h >= 3 ? 4 : 2
  const rows = pool.slice(0, showGlobalFallback && size.h >= 3 ? rowCap - 1 : rowCap)

  return (
    <div id={dashWidgetDomId('agenda')} className="h-full scroll-mt-14">
      <WidgetFrame
        title="AGENDA"
        count={upcomingSaved.length > 0 ? upcomingSaved.length : undefined}
        loading={loading}
      >
        {failed ? (
          <ErrorLine onRetry={retry} />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {showPast ? (
              // ── ASISTIDOS — past saved events (explicit depth choice). ──
              <div className="min-h-0 flex-1 overflow-y-auto">
                {pastSaved.length === 0 ? (
                  <p className="font-mono text-d13 text-ink-soft">
                    SIN ASISTIDOS TODAVÍA — los eventos guardados que ya pasaron
                    aparecen aquí.
                  </p>
                ) : (
                  pastSaved.map((item) => (
                    <EventRow
                      key={item.id}
                      item={item}
                      past
                      dead={deadSlug === item.slug}
                      onOpen={() => void handleOpen(item.slug)}
                    />
                  ))
                )}
              </div>
            ) : (
              <>
                {showGlobalFallback && (
                  <p className="mb-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                    PRÓXIMOS EN LA AGENDA (GLOBAL) — guarda con ★
                  </p>
                )}
                <div className="min-h-0 shrink-0">
                  {rows.map((item) => (
                    <EventRow
                      key={item.id}
                      item={item}
                      dead={deadSlug === item.slug}
                      onOpen={() => void handleOpen(item.slug)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Foot — ASISTIDOS toggle + VER AGENDA ↗ side by side. */}
            <div className="mt-auto flex shrink-0 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPast((open) => !open)}
                aria-pressed={showPast}
                data-cue="latch"
                className={`flex min-h-11 flex-1 items-center justify-between gap-2 border border-ink px-3 font-mono text-d13 uppercase tracking-widest ${
                  showPast ? 'bg-ink text-paper' : 'text-ink hover:bg-ink hover:text-paper'
                } ${FOCUS_RING}`}
              >
                <span>{showPast ? 'PRÓXIMOS' : 'ASISTIDOS'}</span>
                <span className="tabular-nums">
                  {showPast ? upcomingSaved.length : pastSaved.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/agenda')}
                data-cue="tick"
                className={`flex min-h-11 flex-1 items-center justify-between gap-2 border border-ink px-3 font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                <span>VER AGENDA</span>
                <span aria-hidden>↗</span>
              </button>
            </div>
          </div>
        )}
      </WidgetFrame>
    </div>
  )
}

function ErrorLine({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <p className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
        SEÑAL INTERRUMPIDA
      </p>
      <button
        type="button"
        onClick={onRetry}
        data-cue="tick"
        className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
      >
        REINTENTAR
      </button>
    </div>
  )
}
