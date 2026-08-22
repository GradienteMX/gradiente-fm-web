'use client'

// ── PliegoSection — the numbered cream section card of «EL PLIEGO DE
// COMPOSICIÓN v2» ────────────────────────────────────────────────────────────
//
//   ┌──────────────────────────────────────────┐
//   │ [01] IDENTIDAD                        ●  │   header: acid-on-ink number
//   │  …fields grid…                           │   chip (legal: on-panel) +
//   └──────────────────────────────────────────┘   mono d13 bold label +
//                                                  optional required-dot
//                                                  (legal: dot-badge).
//
// `id` is the checklist scroll anchor — the rail's pending rows call
// document.getElementById(anchorId)?.scrollIntoView(); scroll-mt keeps the
// header clear of the sticky masthead.

import type { ReactNode } from 'react'

export function PliegoSection({
  number,
  label,
  id,
  required,
  children,
}: {
  /** Printed verbatim in the number chip — '01'…'0N'. */
  number: string
  /** Section label, rendered mono d13 bold uppercase — 'IDENTIDAD', 'COPY'… */
  label: string
  /** Checklist scroll anchor id (rail rows scroll to it). */
  id?: string
  /** Acid required-dot in the header — section contains required fields. */
  required?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border border-ink bg-paper-raised p-5">
      <header className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className="bg-ink px-1.5 py-1 font-mono text-d13 font-bold leading-none text-acid"
        >
          {number}
        </span>
        <h3 className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
          {label}
        </h3>
        {required && (
          <span
            aria-hidden
            title="Contiene campos obligatorios"
            className="h-2 w-2 rounded-full border border-ink bg-acid"
          />
        )}
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}
