'use client'

import type { ReactNode } from 'react'
import { ExplorerSidebar } from './ExplorerSidebar'
import { ExplorerDetails } from './ExplorerDetails'
import { ExplorerStorage } from './ExplorerStorage'
import { ExplorerBreadcrumb, type Crumb } from './ExplorerBreadcrumb'
import type { ExplorerSection, SelectionMeta } from './types'

interface Props {
  active: ExplorerSection
  onPick: (section: ExplorerSection) => void
  draftCount: number
  publishedCount: number
  savedCount: number
  lastEditedAt: string | null

  breadcrumbs: Crumb[]

  selection?: SelectionMeta | null
  detailsCta?: { label: string; onClick: () => void; color?: string }
  /** Hide the right-hand details panel for sections that don't need it. */
  hideDetails?: boolean
  /** Bottom info bar — used in some sections to mirror the mockup. */
  bottomBar?: ReactNode

  children: ReactNode
}

export function ExplorerShell({
  active,
  onPick,
  draftCount,
  publishedCount,
  savedCount,
  lastEditedAt,
  breadcrumbs,
  selection = null,
  detailsCta,
  hideDetails = false,
  bottomBar,
  children,
}: Props) {
  const quotaUsed = draftCount + publishedCount
  return (
    // Fills the available viewport height (minus nav + footer + main padding)
    // so short sections like Profile don't leave a gap above the footer.
    <div className="flex min-h-[calc(100vh-200px)] flex-col gap-3">
      {/* Breadcrumb strip */}
      <div className="border-y border-border px-3 py-2">
        <ExplorerBreadcrumb crumbs={breadcrumbs} />
      </div>

      {/* Main 3-column layout — flex-1 takes the remaining vertical space. */}
      <div className="flex flex-1 flex-col gap-3 md:flex-row">
        {/* LEFT: sidebar + storage stacked */}
        <div className="flex flex-col gap-3 md:w-[240px] md:flex-shrink-0">
          <ExplorerSidebar
            active={active}
            onPick={onPick}
            draftCount={draftCount}
            publishedCount={publishedCount}
          />
          <ExplorerStorage
            draftCount={draftCount}
            publishedCount={publishedCount}
            savedCount={savedCount}
            lastEditedAt={lastEditedAt}
            quotaUsed={quotaUsed}
            quotaTotal={50}
          />
        </div>

        {/* CENTER: window */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>

        {/* RIGHT: details */}
        {!hideDetails && (
          <ExplorerDetails selection={selection} cta={detailsCta} />
        )}
      </div>

      {bottomBar}
    </div>
  )
}
