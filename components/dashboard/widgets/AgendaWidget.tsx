'use client'

// ── AGENDA — saved events, Dice date-block grammar (FINAL_SPEC §3.6) ────────
//
// Rows are the user's SAVED eventos (GUARDADOS owns membership; this widget
// is a lens), sorted event-date ascending, day numeral d28 + mono month
// eyebrow, honest urgency copy from real dates. Past saved events auto-demote
// into a collapsed «// PASADOS (n)» group — stamped, ink-faint, never
// intermixed as live.
//
// Empty-saves state (Judge graft): the next 3 GLOBAL upcoming events render
// under the honest eyebrow «// PRÓXIMOS EN LA AGENDA (GLOBAL)» with the
// teaching line — a fresh account's AGENDA is ALWAYS populated while any
// event exists on the platform. No-Algorithm-safe: global data, date order,
// zero personalization.
//
// Saved ★ renders through the per-key itemSavesCache subscription (one
// toggle re-renders one star, the home grid's ~140-badge discipline).
// Row click = event overlay in place via useOpenItem. Footer links out
// to /agenda.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { isItemSavedSync, subscribeSavedItem } from '@/lib/itemSavesCache'
import type { ContentItem } from '@/lib/types'

// ── Date helpers (honest urgency — computed, never styled as fake alarm) ────

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

// ── Saved ★ (per-key subscription — §3.6) ──────────────────────────────────

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

// ── Rows ────────────────────────────────────────────────────────────────────

function EventRow({
  item,
  dead,
  onOpen,
}: {
  item: DatedEvent
  dead: boolean
  onOpen: () => void
}) {
  const date = new Date(item.date)
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cue="tick"
      className={`group flex min-h-11 w-full items-center gap-4 border-b border-ink py-2 text-left last:border-b-0 ${FOCUS_RING}`}
    >
      <span className="w-10 shrink-0 text-center">
        <span className="block font-grotesk text-d28 font-bold tabular-nums leading-none text-ink">
          {date.getDate()}
        </span>
        <span className="block font-mono text-d11 font-bold tracking-widest text-ink-soft">
          {MONTHS_ES[date.getMonth()]}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-d15 font-medium text-ink group-hover:underline">
          {item.title}
        </span>
        <span className="block truncate font-mono text-d13 text-ink-faint">
          {item.venue && item.venue.trim() !== '' ? item.venue : 'LUGAR POR ANUNCIAR'}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {dead ? (
          <span className="block font-mono text-d13 font-bold text-ink">
            NO DISPONIBLE
          </span>
        ) : (
          <span className="block font-mono text-d13 font-bold tabular-nums text-ink">
            {urgencyLabel(item.date)}
          </span>
        )}
        <SavedStar itemId={item.id} />
      </span>
    </button>
  )
}

// PASADOS rows — demoted register: ink-faint, PASADO stamp, no urgency.
function PastEventRow({
  item,
  dead,
  onOpen,
}: {
  item: DatedEvent
  dead: boolean
  onOpen: () => void
}) {
  const date = new Date(item.date)
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cue="tick"
      className={`group flex min-h-11 w-full items-center gap-3 border-b border-ink py-1.5 text-left last:border-b-0 ${FOCUS_RING}`}
    >
      <span className="shrink-0 font-mono text-d13 tabular-nums text-ink-faint">
        {date.getDate()} {MONTHS_ES[date.getMonth()]}
      </span>
      <span className="min-w-0 flex-1 truncate text-d15 text-ink-faint group-hover:underline">
        {item.title}
      </span>
      {dead ? (
        <span className="shrink-0 font-mono text-d13 font-bold text-ink">
          NO DISPONIBLE
        </span>
      ) : (
        <span className="shrink-0 border border-ink-faint px-1.5 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink-soft">
          PASADO
        </span>
      )}
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function AgendaWidget({ compact }: DashboardWidgetProps) {
  const ctx = useDashboardData()
  const router = useRouter()
  const openItem = useOpenItem()
  const [pastOpen, setPastOpen] = useState(false)
  const [deadSlug, setDeadSlug] = useState<string | null>(null)

  const loading = !ctx.loaded.events && !ctx.errors.events
  const failed = ctx.errors.events === true

  // Saved eventos split into live (date-asc) and past (most recent first).
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

  // Global fallback pool — provider's events query is already date-asc.
  const globalUpcoming = useMemo(
    () => ctx.events.filter(hasDate).slice(0, 3),
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

  // ── Compact teaching row (zero events exist platform-wide) ────────────────
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
            // Copy budgeted to the narrowest stored width — wraps, never clamps.
            <p className="min-w-0 text-d15 text-ink">
              Guarda eventos con ★ y aparecen aquí.
            </p>
          )}
        </WidgetFrame>
      </div>
    )
  }

  const showGlobalFallback = upcomingSaved.length === 0

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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {showGlobalFallback ? (
              <>
                <p className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  {'// PRÓXIMOS EN LA AGENDA (GLOBAL)'}
                </p>
                <p className="mb-1 font-mono text-d13 text-ink-soft">
                  GUARDA CON ★ Y APARECEN AQUÍ CON AVISO DE FECHA.
                </p>
                {globalUpcoming.map((item) => (
                  <EventRow
                    key={item.id}
                    item={item}
                    dead={deadSlug === item.slug}
                    onOpen={() => void handleOpen(item.slug)}
                  />
                ))}
              </>
            ) : (
              upcomingSaved.map((item) => (
                <EventRow
                  key={item.id}
                  item={item}
                  dead={deadSlug === item.slug}
                  onOpen={() => void handleOpen(item.slug)}
                />
              ))
            )}

            {pastSaved.length > 0 && (
              <div className="mt-2 border-t border-ink pt-1">
                <button
                  type="button"
                  onClick={() => setPastOpen((open) => !open)}
                  aria-expanded={pastOpen}
                  data-cue="latch"
                  className={`flex min-h-11 w-full items-center justify-between font-mono text-d13 uppercase tracking-widest text-ink-soft hover:underline ${FOCUS_RING}`}
                >
                  <span>{`// PASADOS (${pastSaved.length})`}</span>
                  <span aria-hidden>{pastOpen ? '▴' : '▾'}</span>
                </button>
                {pastOpen &&
                  pastSaved.map((item) => (
                    <PastEventRow
                      key={item.id}
                      item={item}
                      dead={deadSlug === item.slug}
                      onOpen={() => void handleOpen(item.slug)}
                    />
                  ))}
              </div>
            )}
          </div>

          <p className="pt-1">
            {/* 44px hit area via padding — the visual mark stays d13 text. */}
            <Link
              href="/agenda"
              data-cue="tick"
              className={`inline-flex min-h-11 items-center font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
            >
              VER AGENDA ↗
            </Link>
          </p>
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
        {'// SEÑAL INTERRUMPIDA'}
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
