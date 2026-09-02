import type { ReactNode } from 'react'

// ── Brand page chrome — «EL PLIEGO» (fase F) ────────────────────────────────
//
// Shared chrome for the static identity surfaces (`/about`, `/manifesto`,
// `/equipo`). Converted from the old terminal register (glowing sys-orange
// dot, //SUBSISTEMA stamp, border-border rules) to the house paper register:
// one reading column on `bg-paper`, 1px ink hairlines, syne display head,
// grotesk body, mono stamps. No ContentGrid, no rail, no overlays — the team
// fills copy in without touching layout code.
//
// The route still needs `/about|/manifesto|/equipo` in PAPER_ROUTES + a
// ground flip is automatic (see lib/chrome/paperRoutes + app/layout.tsx).

interface BrandPageShellProps {
  // Mono stamp shown above the headline (e.g. "ABOUT", "MANIFIESTO").
  subsystem: string
  // Display headline in font-syne.
  title: string
  // One-line dek under the headline. Plain string — keep it short.
  lead?: string
  // Page body.
  children: ReactNode
}

export function BrandPageShell({
  subsystem,
  title,
  lead,
  children,
}: BrandPageShellProps) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-10 border-b border-ink pb-6">
        <p className="mb-4 font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
          SUBSISTEMA · {subsystem.toUpperCase()}
        </p>
        <h1 className="font-syne text-display font-extrabold leading-none text-ink">
          {title}
        </h1>
        {lead && (
          <p className="mt-4 max-w-[58ch] font-grotesk text-d15 leading-relaxed text-ink-soft">
            {lead}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-6 font-grotesk text-d15 leading-relaxed text-ink-soft">
        {children}
      </div>
    </article>
  )
}

// Inline marker for copy the team hasn't written yet. Printed as an honest
// ink-outlined stamp in sys-red-paper — no pulse, no glow, no fill wash: it
// reads as an editorial correction mark on the sheet, so an unfinished page
// can't be mistaken for a finished one.
export function Redactar({ note }: { note?: string }) {
  return (
    <span className="inline-flex items-center border border-sys-red-paper px-1.5 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
      SIN REDACTAR{note ? ` · ${note}` : ''}
    </span>
  )
}

// Section heading inside a brand page. Keeps the §-numbered idiom borrowed
// from [[ArticuloOverlay]] so long-form stays consistent, now set on the
// printed rule.
export function BrandSection({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-3 border-b border-ink pb-2 font-syne text-d28 font-extrabold text-ink">
        <span className="font-mono text-d11 tracking-widest text-ink-faint">
          §{String(index).padStart(2, '0')}
        </span>
        <span>{title}</span>
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

// Sub-heading inside a section body — the printed run-in head.
export function BrandSubhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-2 font-mono text-d13 font-bold uppercase tracking-widest text-ink">
      {children}
    </h3>
  )
}

// A short mono line that sits under a section head — the motto/kicker slot.
export function BrandMotto({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
      {children}
    </p>
  )
}

// Printed table. Hairline ink rules, mono head row, grotesk cells. `alignLast`
// right-sets the final column for numeric tables (prize amounts).
export function BrandTable({
  headers,
  rows,
  alignLast = false,
  caption,
}: {
  headers: readonly string[]
  rows: readonly (readonly ReactNode[])[]
  alignLast?: boolean
  caption?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        {caption && (
          <caption className="pb-2 text-left font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {headers.map((h, i) => {
              const last = alignLast && i === headers.length - 1
              return (
                <th
                  key={h}
                  scope="col"
                  className={`border-y border-ink py-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink ${
                    last ? 'pr-0 text-right' : 'pr-4 text-left'
                  }`}
                >
                  {h}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => {
                const last = alignLast && ci === r.length - 1
                const shape =
                  ci === 0
                    ? 'whitespace-nowrap font-mono text-d11 font-bold uppercase tracking-widest text-ink'
                    : last
                      ? 'font-mono text-d13 tracking-widest text-ink'
                      : 'font-grotesk text-d13 leading-relaxed text-ink-soft'
                return (
                  <td
                    key={ci}
                    className={`border-b border-ink/25 py-2 align-top ${shape} ${
                      last ? 'pr-0 text-right' : 'pr-4'
                    }`}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
