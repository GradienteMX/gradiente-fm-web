'use client'

import { useSearchParams } from 'next/navigation'
import { LatchBar, type Latch } from '@/components/admin/kit'
import {
  ADMIN_TABS,
  ADMIN_TAB_LABELS,
  adminTabHref,
  resolveAdminTab,
} from '@/lib/admin/tabs'

// Tab strip for /admin — now seven latches, driven by the shared LatchBar so
// the ink-fill grammar has one implementation instead of the two that existed
// (this file and DashTabBar, which is hard-bound to EspacioId).
//
// The active tab is resolved through resolveAdminTab(), the SAME function the
// server page uses. They used to disagree: the page fell back to 'invites' for
// an unknown ?tab= while this component cast the raw param to its union, so
// `?tab=bogus` rendered content with no tab latched at all.
//
// Counts are real or absent. A latch showing «MODERACIÓN · 3» must mean three
// open reports; there is no placeholder number here and none should be added.

export function AdminTabNav({
  counts,
}: {
  /** Live counts per tab. Omit a key entirely rather than passing 0. */
  counts?: Partial<Record<string, number>>
}) {
  const searchParams = useSearchParams()
  const active = resolveAdminTab(searchParams?.get('tab'))

  const tabs: Latch[] = ADMIN_TABS.map((id) => ({
    id,
    label: ADMIN_TAB_LABELS[id],
    href: adminTabHref(id),
    count: counts?.[id],
    // The acid dot is spent on one thing only: work that is waiting for a
    // person. Open reports qualify; a content count does not.
    dot: id === 'moderacion' && (counts?.moderacion ?? 0) > 0,
  }))

  return <LatchBar tabs={tabs} active={active} ariaLabel="Secciones del panel de administración" />
}
