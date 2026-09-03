'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import {
  readLastSeenActivity,
  subscribeLastSeenActivity,
} from '@/lib/dashboard/localState'
import type { ActivityRow } from '@/lib/dashboard/activity'
import type { WidgetId } from '@/lib/dashboard/layout'
import {
  DEFAULT_ESPACIO,
  ESPACIO_PARAM,
  espacioHref,
  isEspacioId,
  type EspacioId,
} from '@/lib/dashboard/espacios'

// ── StatusStrip — aggregated true counts, first viewport (FINAL_SPEC §3.0) ──
//
// One line under the identity spine: `3 NUEVAS SEÑALES · 1 OFERTA ·
// PRÓXIMO: VIE 23 AGO · 2 BORRADORES`. Every segment is a real count from a
// provider slice; each is a button that smooth-scrolls to its widget, so
// below-fold badges are impossible to miss regardless of rearrangement.
// Segments render only at count > 0 and the strip collapses entirely at
// zero — no empty chrome.

// ── Scroll-to-widget contract (shared with the §7.5 legacy dispatch) ────────
// WidgetFrame (WP3) MUST render `id={dashWidgetDomId(widget.id)}` on each
// widget's root element — this is the anchor the strip, the masthead avatar,
// and the legacy `?section=` resolver all scroll to. The grid mounts async
// (authResolved + layoutReady), so the scroll retries on rAF for a bounded
// window instead of failing on a not-yet-mounted target.

export function dashWidgetDomId(id: WidgetId): string {
  return `dash-widget-${id}`
}

const SCROLL_RETRY_MS = 4000

export function scrollToDashWidget(id: WidgetId): void {
  if (typeof window === 'undefined') return
  const behavior: ScrollBehavior = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? 'auto'
    : 'smooth'
  const deadline = Date.now() + SCROLL_RETRY_MS
  const attempt = () => {
    const el = document.getElementById(dashWidgetDomId(id))
    if (el) {
      el.scrollIntoView({ behavior, block: 'start' })
      return
    }
    if (Date.now() < deadline) window.requestAnimationFrame(attempt)
  }
  attempt()
}

// The ONE unread derivation — rows newer than the single localStorage
// watermark. ACTIVIDAD's badge (WP6) computes the identical expression, so
// the spine number and the widget number can never diverge.
export function countUnreadActivity(
  rows: readonly ActivityRow[],
  watermark: string | null,
): number {
  return rows.filter((row) => !watermark || row.createdAt > watermark).length
}

// Link-affordance rule (panel-wide, shared with WidgetFrame's action chips):
// only actions that LEAVE the panel — route pushes, external tabs — carry the
// ↗ mark. Every strip segment scrolls in-page to its widget, so segments
// NEVER render ↗; if a future segment navigates away, it must.
// FASE D: a segment now names the SPACE it lives in as well as its widget.
//
// Both are kept, deliberately. /lab/dashboard mounts the real grid WITHOUT the
// space router, and the lab's standing rule is that it never ejects to prod —
// so off /dashboard a segment falls back to scrolling its widget in the grid
// instead of navigating. `widget` is the in-grid anchor; `espacio` is where
// the segment's material actually lives on the real panel.
// The panel is several spaces, so a below-fold badge can be behind a tab
// rather than merely below the fold — the click switches the tab first, then
// scrolls. `widget` is optional because only PANEL is a grid; every other
// space is a bespoke sheet with no widget anchor to scroll to.
interface Segment {
  key: string
  label: string
  espacio: EspacioId
  widget?: WidgetId
  withAcidDot?: boolean
}

export function StatusStrip() {
  const { currentUser } = useAuth()
  const { activity, drafts, franja, saves } = useDashboardData()
  const router = useRouter()
  const search = useSearchParams()
  const uid = currentUser?.id ?? null

  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard'
  const rawEspacio = search?.get(ESPACIO_PARAM) ?? null
  const currentEspacio: EspacioId = isEspacioId(rawEspacio) ? rawEspacio : DEFAULT_ESPACIO

  // On the real panel: switch space first (if needed), then scroll.
  // scrollToDashWidget already retries on rAF for 4s, which covers the space's
  // render, so the two steps need no coordination beyond ordering.
  // On /lab/dashboard there is no space router and ejecting to prod is
  // forbidden, so the segment just scrolls its widget in the grid.
  const goTo = (segment: Segment) => {
    if (onDashboard && segment.espacio !== currentEspacio) {
      router.push(espacioHref(segment.espacio))
    }
    if (segment.widget) scrollToDashWidget(segment.widget)
    else if (onDashboard) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
  const ofertas = franja?.unansweredListingIds.length ?? 0
  const borradores = drafts.length

  // Next SAVED upcoming event (AGENDA's material — saves lens, date asc).
  const nextEventLabel = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const upcoming = saves
      .filter(
        (item) =>
          item.type === 'evento' &&
          !!item.date &&
          new Date(item.date).getTime() >= startOfToday.getTime(),
      )
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    const next = upcoming[0]
    if (!next?.date) return null
    return format(new Date(next.date), 'EEE d MMM', { locale: es })
      .replace(/\./g, '')
      .toUpperCase()
  }, [saves])

  const segments: Segment[] = []
  if (unread > 0) {
    segments.push({
      key: 'senales',
      label: `${unread} ${unread === 1 ? 'NUEVA SEÑAL' : 'NUEVAS SEÑALES'}`,
      espacio: 'panel',
      widget: 'actividad',
      withAcidDot: true,
    })
  }
  if (ofertas > 0) {
    // Offers live in the MERCADO space now; the panel keeps only the door.
    segments.push({
      key: 'ofertas',
      label: `${ofertas} ${ofertas === 1 ? 'OFERTA' : 'OFERTAS'}`,
      espacio: 'mercado',
      widget: 'mercado',
    })
  }
  if (nextEventLabel) {
    segments.push({
      key: 'proximo',
      label: `PRÓXIMO: ${nextEventLabel}`,
      espacio: 'panel',
      widget: 'agenda',
    })
  }
  if (borradores > 0) {
    // Drafts are the PUBLICAR space's material — the EN CURSO table.
    segments.push({
      key: 'borradores',
      label: `${borradores} ${borradores === 1 ? 'BORRADOR' : 'BORRADORES'}`,
      espacio: 'publicar',
      widget: 'crear',
    })
  }

  // Collapse entirely at zero — no empty chrome (§3.0).
  if (segments.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 border-y border-ink py-0.5">
      {segments.map((segment, index) => (
        <span key={segment.key} className="flex items-center gap-x-3">
          {index > 0 && (
            <span aria-hidden className="font-mono text-d13 text-ink-faint">
              ·
            </span>
          )}
          {/* 44px min-height — interactive element floor (§1.4/§10.13). */}
          <button
            type="button"
            onClick={() => goTo(segment)}
            className="flex min-h-[44px] items-center gap-1.5 font-mono text-d13 tracking-widest text-ink tabular-nums hover:underline hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            data-cue="tick"
          >
            {segment.withAcidDot && (
              <span aria-hidden className="h-2 w-2 border border-ink bg-acid" />
            )}
            {segment.label}
          </button>
        </span>
      ))}
    </div>
  )
}
