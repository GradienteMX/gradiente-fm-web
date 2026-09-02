'use client'

// ── MERCADO — the DOOR widget (PLIEGO fase D) ───────────────────────────────
//
// Was: a 1,152-line file holding two unrelated applications (the franja
// storefront and an admin approval queue) joined only by a role switch, which
// resized ITSELF between {6,2} and {12,2} — so merely reading a buyer's offer
// rewrote the user's saved panel layout.
//
// Now: MERCADO is a first-class SPACE (`?espacio=mercado`), and what remains
// on the panel is a door. It reports one true thing — how many buyer threads
// are waiting — and opens the space. The storefront application itself lives
// in components/dashboard/espacios/MercadoSpace.tsx.
//
// Two consequences worth stating:
//   · the self-resize depth mechanic is GONE, not ported. Reading an offer no
//     longer mutates `profile_meta.dashboard`.
//   · the admin APROBACIONES variant is GONE from the panel. Marketplace
//     activation became self-service for the franja team (MERCADO › AJUSTES);
//     site admins keep an abuse kill-switch on /admin. The provider registry
//     matches: `mercado` is franja-team-only now.
//
// The widget renders null for anyone without a franja — the registry already
// excludes it, and a widget-shaped bookmark for a space you cannot open would
// be exactly the dead affordance the project bans.

import Link from 'next/link'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { espacioHref } from '@/lib/dashboard/espacios'

export function MercadoWidget({ compact }: DashboardWidgetProps) {
  const { currentUser } = useAuth()
  const { franja, loaded, errors } = useDashboardData()

  // Not franja team: the registry already excludes 'mercado' (§3.9).
  if (!currentUser?.franjaId) return null

  const ofertas = franja?.unansweredListingIds.length ?? 0
  const listings = franja?.listings.length ?? 0
  const settled = !!loaded.franja
  const failed = !!errors.franja

  // The one true line. Waiting offers outrank catalogue size — an unanswered
  // buyer is the only thing here that decays.
  const headline = failed
    ? 'MERCADO · SIN CONEXIÓN'
    : !settled
      ? 'MERCADO'
      : ofertas > 0
        ? `MERCADO · ${ofertas} ${ofertas === 1 ? 'OFERTA SIN RESPONDER' : 'OFERTAS SIN RESPONDER'}`
        : listings > 0
          ? `MERCADO · ${listings} ${listings === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'}`
          : 'MERCADO · SIN PUBLICACIONES'

  return (
    <div id={dashWidgetDomId('mercado')} className="h-full">
      <WidgetFrame title="MERCADO" compact={compact}>
        <div className="flex h-full flex-wrap items-center gap-x-4 gap-y-3">
          {ofertas > 0 && (
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 border border-ink bg-acid" />
          )}
          <div className="flex min-w-0 flex-col">
            <span
              className={`font-mono text-d13 font-bold uppercase tracking-widest ${
                failed ? 'text-sys-red-paper' : 'text-ink'
              }`}
            >
              {headline}
            </span>
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              EL ESPACIO COMPLETO VIVE EN SU PESTAÑA
            </span>
          </div>
          <Link
            href={espacioHref('mercado')}
            data-cue="tick"
            className={`ml-auto flex min-h-[44px] shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d13 uppercase tracking-widest text-paper hover:bg-paper hover:text-ink ${FOCUS_RING}`}
          >
            ABRIR
            <span aria-hidden>→</span>
          </Link>
        </div>
      </WidgetFrame>
    </div>
  )
}
