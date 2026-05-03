'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type AdminTab = 'invites' | 'users'

const TABS: { id: AdminTab; label: string; color: string }[] = [
  { id: 'invites', label: 'INVITACIONES', color: '#F97316' },
  { id: 'users', label: 'USUARIOS', color: '#A78BFA' },
]

// Tab strip for /admin. Driven by ?tab= search param so navigation is
// browser-back-friendly + bookmarkable, mirroring the dashboard's
// ?section= pattern. The page (server component) reads searchParams to
// decide which section to render.
export function AdminTabNav() {
  const searchParams = useSearchParams()
  const active: AdminTab =
    (searchParams?.get('tab') as AdminTab | null) ?? 'invites'

  return (
    <nav
      aria-label="Secciones del panel de administración"
      className="flex border-b border-border"
    >
      {TABS.map((t) => {
        const isActive = t.id === active
        return (
          <Link
            key={t.id}
            href={t.id === 'invites' ? '/admin' : `/admin?tab=${t.id}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className="-mb-px border-b-2 px-4 py-2 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: isActive ? t.color : 'transparent',
              color: isActive ? t.color : '#888888',
            }}
          >
            //{t.label}
          </Link>
        )
      })}
    </nav>
  )
}
