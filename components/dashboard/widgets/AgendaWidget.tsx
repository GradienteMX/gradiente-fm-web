'use client'

// ── AGENDA — saved events, reference EVENTOS-PARA-TI treatment (SCALE PASS) ─
//
// Rows are the user's SAVED eventos (GUARDADOS owns membership; this widget
// is a lens), sorted event-date ascending. At the {4,3} default the FIRST
// upcoming event renders as a PHOTO CARD — SmartImage ~110px on the panel
// with the bottom ink gradient, category chip, d18 title, venue line, and
// the reference «22 AGO» date block (d28 day numeral + mono month). When the
// event has no art the card is an honest typographic date-poster on the
// black panel — same composition, no fake image. Below the card: a FIXED
// portion of compact date rows (S1 — computed by design, never by overflow),
// then the S4 VerRow «VER AGENDA ↗» foot.
//
// PORTION ARITHMETIC (desktop, border-box; h3 content budget = 249px):
//   card 112 (h-28) + rows-block mt-2 8 + 2 rows (40+1+40 = 81)
//   + foot pt-1 4 + VerRow 44  →  249 EXACT. Each teaching/PASADOS tenant
//   costs one row slot: fallback header (16+18+4 = 38) or the PASADOS toggle
//   (40) each displace one compact row, so the column NEVER scrolls at
//   default size. h2 (129px budget) drops the card: 2 rows 81 + 4 + 44 = 129.
//   Rows are min-h-11 (44px touch) on mobile, md:min-h-10 on desktop — the
//   WidgetFrame ActionButton precedent for pointer targets.
//
// Past saved events auto-demote into the collapsed «// PASADOS (n)» group —
// stamped, ink-faint, never intermixed as live. Opening PASADOS is an
// explicit depth choice, so the list region may scroll ONLY then (S1).
//
// Empty-saves state: the global upcoming events render under the honest
// eyebrow «// PRÓXIMOS EN LA AGENDA (GLOBAL)» with the teaching line — a
// fresh account's AGENDA is ALWAYS populated while any event exists on the
// platform. No-Algorithm-safe: global data, date order, zero personalization.
//
// Saved ★ renders through the per-key itemSavesCache subscription (one
// toggle re-renders one star). Card/row click = event overlay in place via
// useOpenItem. The VerRow foot links out to /agenda.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, VerRow, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { useOpenItem } from '@/lib/dashboard/openItem'
import {
  PANEL_SCRIM,
  PANEL_SCRIM_GRADIENT,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'
import { isItemSavedSync, subscribeSavedItem } from '@/lib/itemSavesCache'
import { categoryColor } from '@/lib/utils'
import { SmartImage } from '@/components/SmartImage'
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

function venueLine(item: DatedEvent): string {
  return item.venue && item.venue.trim() !== '' ? item.venue : 'LUGAR POR ANUNCIAR'
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

// ── Lead photo card (reference EVENTOS-PARA-TI — the «22 AGO» energy) ───────
// A printed photograph on cream (§1.7): 1px ink border, black panel ground.
// With art: SmartImage fills the 112px card; the chip rides a top-left ink
// slab, the date block a top-right one, and title + venue seat on the bottom
// gradient ramp (panel-text over ≥0.94-alpha ink — ≥13:1 worst case). Without
// art the same composition stands on the bare panel — a typographic
// date-poster, honest and designed, never an empty grey square (S3).

function LeadEventCard({
  item,
  dead,
  onOpen,
}: {
  item: DatedEvent
  dead: boolean
  onOpen: () => void
}) {
  const date = new Date(item.date)
  const hasArt = !!item.imageUrl
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cue="tick"
      className={`group relative block h-28 w-full shrink-0 overflow-hidden border border-ink bg-panel text-left ${FOCUS_RING}`}
    >
      {item.imageUrl && (
        <SmartImage
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          sizes="400px"
        />
      )}
      {/* Category chip — top-left, swatch + Spanish label (hue never alone).
          Dark-ground category map: this is a black panel (§1.6a). */}
      <span
        className="absolute left-0 top-0 flex items-center gap-1.5 px-2 py-1"
        style={hasArt ? { background: PANEL_SCRIM } : undefined}
      >
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0"
          style={{ backgroundColor: categoryColor(item.type) }}
        />
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-panel-text">
          {typeDisplayLabel(item.type)}
        </span>
      </span>
      {/* LARGE date block — top-right, day numeral d28 + mono month. */}
      <span
        className="absolute right-0 top-0 flex flex-col items-center px-2.5 py-1 text-center"
        style={hasArt ? { background: PANEL_SCRIM } : undefined}
      >
        <span className="block font-grotesk text-d28 font-bold tabular-nums leading-none text-panel-text">
          {date.getDate()}
        </span>
        <span className="block font-mono text-d11 font-bold tracking-widest text-panel-text">
          {MONTHS_ES[date.getMonth()]}
        </span>
      </span>
      {/* Seated title + venue line over the bottom ramp (pt-7 = the 28px
          transparent ramp — no glyph ever rides it). */}
      <span
        className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-0.5 px-3 pb-1.5 pt-7"
        style={hasArt ? { background: PANEL_SCRIM_GRADIENT } : undefined}
      >
        <span className="line-clamp-1 w-full font-grotesk text-d18 font-semibold text-panel-text group-hover:underline">
          {item.title}
        </span>
        <span className="block w-full truncate font-mono text-d13 text-panel-text">
          {venueLine(item)}
          {' · '}
          {dead ? 'NO DISPONIBLE' : urgencyLabel(item.date)}
        </span>
      </span>
    </button>
  )
}

// ── Compact date rows (the fixed portion below the card) ────────────────────

function EventRowCompact({
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
      className={`group flex min-h-11 w-full items-center gap-3 border-b border-ink text-left last:border-b-0 md:min-h-10 ${FOCUS_RING}`}
    >
      <span className="w-14 shrink-0 font-mono text-d13 font-bold tabular-nums text-ink">
        {date.getDate()} {MONTHS_ES[date.getMonth()]}
      </span>
      <span className="min-w-0 flex-1 truncate text-d15 font-medium text-ink group-hover:underline">
        {item.title}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {dead ? (
          <span className="font-mono text-d13 font-bold text-ink">NO DISPONIBLE</span>
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

export function AgendaWidget({ size, compact }: DashboardWidgetProps) {
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
  const pool = showGlobalFallback ? globalUpcoming : upcomingSaved
  const hasPast = pastSaved.length > 0

  // FIXED PORTIONS (S1 — see the arithmetic in the header comment). The photo
  // card exists only at h≥3 (the {4,3} default); h2 is the user's tighter
  // option and runs rows-only. Each extra tenant (fallback teaching header,
  // PASADOS toggle) displaces exactly one compact row slot, so the column
  // never scrolls at default size.
  const showCard = size.h >= 3 && pool.length > 0
  const lead = showCard ? pool[0] : null
  const deductions = (showGlobalFallback ? 1 : 0) + (hasPast ? 1 : 0)
  const rowBudget = Math.max(0, 2 - deductions)
  const rows = showCard ? pool.slice(1, 1 + rowBudget) : pool.slice(0, rowBudget)

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
          {showGlobalFallback && (
            <>
              <p className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                {'// PRÓXIMOS EN LA AGENDA (GLOBAL)'}
              </p>
              <p className="mb-1 font-mono text-d13 text-ink-soft">
                GUARDA CON ★ Y APARECEN AQUÍ CON AVISO DE FECHA.
              </p>
            </>
          )}

          {lead && (
            <LeadEventCard
              item={lead}
              dead={deadSlug === lead.slug}
              onOpen={() => void handleOpen(lead.slug)}
            />
          )}

          {/* Scroll is legal ONLY after the explicit PASADOS depth choice
              (S1) — at default the portion above fits by construction. */}
          <div
            className={`min-h-0 ${lead ? 'mt-2' : ''} ${
              pastOpen ? 'flex-1 overflow-y-auto' : ''
            }`}
          >
            {rows.map((item) => (
              <EventRowCompact
                key={item.id}
                item={item}
                dead={deadSlug === item.slug}
                onOpen={() => void handleOpen(item.slug)}
              />
            ))}

            {hasPast && (
              <div className={rows.length > 0 || lead ? 'border-t border-ink' : ''}>
                <button
                  type="button"
                  onClick={() => setPastOpen((open) => !open)}
                  aria-expanded={pastOpen}
                  data-cue="latch"
                  className={`flex min-h-11 w-full items-center justify-between font-mono text-d13 uppercase tracking-widest text-ink-soft hover:underline md:min-h-10 ${FOCUS_RING}`}
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

          {/* S4 foot — the ONE overflow/portal affordance; ↗ = leaves the
              surface. Remainder beyond the fixed portion lives at /agenda. */}
          <div className="mt-auto pt-1">
            <VerRow label="VER AGENDA" href="/agenda" external cue="tick" />
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
