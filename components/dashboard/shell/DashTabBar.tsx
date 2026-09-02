'use client'

// ── DashTabBar — the ESPACIOS row (PLIEGO fase D) ───────────────────────────
//
// Sits between StatusStrip and the grid mount point: PANEL · PUBLICAR ·
// FRANJA · MERCADO, with VER PERFIL PÚBLICO ↗ pushed to the right edge.
//
// Latch grammar, deliberately two-level: the SPACE tab is an ink FILL
// (`bg-ink text-paper`) because it swaps the whole document; a space's
// internal SubTabs are an ink BASELINE. One glance tells you which level of
// the hierarchy you just moved.
//
// Tabs are real links to `?espacio=`, not buttons, so they middle-click,
// bookmark and restore. onSelect intercepts the plain click to swap in place
// (router.replace, no scroll jump) — the space never remounts the provider.
//
// Ungranted spaces are ABSENT, never disabled: `visibleEspacios` is the one
// source of truth, so a non-franja account cannot see a tab whose body would
// be empty.

import Link from 'next/link'
import {
  ESPACIO_LABELS,
  espacioHref,
  type EspacioId,
} from '@/lib/dashboard/espacios'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function DashTabBar({
  espacios,
  active,
  onSelect,
  franjaName,
  ofertas = 0,
  profileHref,
}: {
  espacios: readonly EspacioId[]
  active: EspacioId
  onSelect: (id: EspacioId) => void
  /** Franja title, printed under the FRANJA tab so the team knows whose desk this is. */
  franjaName?: string | null
  /** Unanswered buyer threads — the acid dot on MERCADO. Real count, never decorative. */
  ofertas?: number
  /** /u/[username] — omitted (and the link hidden) until the username resolves. */
  profileHref?: string | null
}) {
  // A one-tab bar is chrome that teaches nothing: an account with no franja
  // sees PANEL + PUBLICAR, which is still a real choice, so the bar renders.
  if (espacios.length < 2) return null

  return (
    <nav
      aria-label="Espacios del panel"
      className="flex flex-wrap items-stretch gap-x-1 border-b-2 border-ink bg-paper-raised"
    >
      {espacios.map((id) => {
        const on = id === active
        return (
          <Link
            key={id}
            href={espacioHref(id)}
            aria-current={on ? 'page' : undefined}
            onClick={(event) => {
              // Let modified clicks (new tab / new window) behave natively.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onSelect(id)
            }}
            data-cue="latch"
            className={`flex min-h-[44px] items-center gap-2 px-4 font-mono text-d13 uppercase tracking-widest ${FOCUS_RING} ${
              on ? 'bg-ink font-bold text-paper' : 'text-ink hover:bg-ink/5'
            }`}
          >
            {ESPACIO_LABELS[id]}
            {id === 'franja' && franjaName && (
              <span
                className={`hidden max-w-[16ch] truncate text-d11 sm:inline ${
                  on ? 'text-paper/70' : 'text-ink-faint'
                }`}
              >
                · {franjaName}
              </span>
            )}
            {id === 'mercado' && ofertas > 0 && (
              <span
                aria-label={`${ofertas} sin responder`}
                className={`h-2 w-2 border bg-acid ${on ? 'border-paper' : 'border-ink'}`}
              />
            )}
          </Link>
        )
      })}

      {profileHref && (
        <Link
          href={profileHref}
          className={`ml-auto flex min-h-[44px] items-center gap-2 px-4 font-mono text-d13 font-bold uppercase tracking-widest text-ink hover:underline hover:underline-offset-4 ${FOCUS_RING}`}
          data-cue="tick"
        >
          VER PERFIL PÚBLICO
          <span aria-hidden>↗</span>
        </Link>
      )}
    </nav>
  )
}
