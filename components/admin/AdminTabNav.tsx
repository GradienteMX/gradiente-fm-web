'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type AdminTab = 'invites' | 'espera' | 'users' | 'franjas' | 'events'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'invites', label: 'INVITACIONES' },
  { id: 'espera', label: 'ESPERA' },
  { id: 'users', label: 'USUARIOS' },
  { id: 'franjas', label: 'FRANJAS' },
  { id: 'events', label: 'EVENTOS' },
]

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Tab strip for /admin. Driven by ?tab= search param so navigation is
// browser-back-friendly + bookmarkable, mirroring the dashboard's
// ?section= pattern. The page (server component) reads searchParams to
// decide which section to render.
//
// «EL PLIEGO» chrome (fase F): ink-filled latch tabs — the LoginOverlay
// mode-switch register. The active tab is a solid ink fill (bg-ink
// text-paper), the rest are ink hairline cells that invert on hover. The
// per-tab accent colours of the terminal version are gone: on paper a latch
// is a fill, never a hue. Hrefs and ?tab= values are untouched.
export function AdminTabNav() {
  const searchParams = useSearchParams()
  const active: AdminTab =
    (searchParams?.get('tab') as AdminTab | null) ?? 'invites'

  return (
    <nav
      aria-label="Secciones del panel de administración"
      className="flex flex-wrap items-stretch border border-ink bg-paper-raised"
    >
      {TABS.map((t) => {
        const isActive = t.id === active
        return (
          <Link
            key={t.id}
            href={t.id === 'invites' ? '/admin' : `/admin?tab=${t.id}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            data-cue="latch"
            className={`flex min-h-11 flex-1 items-center justify-center whitespace-nowrap border-l border-ink px-4 font-mono text-d13 uppercase tracking-widest transition-colors first:border-l-0 ${FOCUS_RING} ${
              isActive
                ? 'bg-ink font-bold text-paper'
                : 'text-ink-soft hover:bg-ink hover:text-paper'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
