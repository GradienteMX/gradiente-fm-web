'use client'

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Crumb {
  label: ReactNode
  onClick?: () => void
  /** Visual emphasis — used for the user badge on the left. */
  variant?: 'badge-green' | 'plain' | 'accent'
}

interface Props {
  crumbs: Crumb[]
}

export function ExplorerBreadcrumb({ crumbs }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            <CrumbLabel crumb={c} active={isLast} />
            {!isLast && <ChevronRight size={11} strokeWidth={1.5} className="text-muted/60" />}
          </span>
        )
      })}
    </nav>
  )
}

function CrumbLabel({ crumb, active }: { crumb: Crumb; active: boolean }) {
  const { label, onClick, variant = 'plain' } = crumb
  if (variant === 'badge-green') {
    return (
      <span
        className="inline-flex items-center gap-1.5 border px-2 py-0.5"
        style={{ borderColor: '#4ADE8055', color: '#4ADE80' }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
        {label}
      </span>
    )
  }
  if (onClick && !active) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-secondary transition-colors hover:text-primary"
      >
        {label}
      </button>
    )
  }
  return (
    <span className={active ? 'text-sys-orange' : variant === 'accent' ? 'text-secondary' : 'text-muted'}>
      {label}
    </span>
  )
}
