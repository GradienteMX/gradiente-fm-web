'use client'

import { Folder } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  /** Title shown in the window title bar (e.g. "NUEVO CONTENIDO"). */
  title: string
  /** Optional toolbar row — usually <ExplorerToolbar/>. */
  toolbar?: ReactNode
  /** Optional info row above the file area (e.g. "8 elementos"). */
  countLabel?: string
  /** View-controls row on the right of countLabel (sort, view-mode). */
  viewControls?: ReactNode
  /** Body content — file grid, form, etc. */
  children: ReactNode
}

export function ExplorerWindow({ title, toolbar, countLabel, viewControls, children }: Props) {
  return (
    <section className="flex flex-1 flex-col border border-border bg-surface">
      {/* Title bar */}
      <header className="flex items-center justify-between border-b border-border bg-elevated px-3 py-2">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-secondary">
          <Folder size={12} strokeWidth={1.5} className="text-sys-orange" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <span>─</span>
          <span>▢</span>
          <span>×</span>
        </div>
      </header>

      {/* Toolbar */}
      {toolbar && (
        <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
          {toolbar}
        </div>
      )}

      {/* Info row */}
      {(countLabel || viewControls) && (
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 font-mono text-[10px] tracking-widest text-muted">
          <span>{countLabel ?? ''}</span>
          <div className="flex items-center gap-3">{viewControls}</div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </section>
  )
}
