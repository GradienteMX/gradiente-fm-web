import type { ReactNode } from 'react'

interface BrandPageShellProps {
  // Mono terminal label shown above the headline (e.g. "ABOUT", "MANIFIESTO").
  subsystem: string
  // Display headline in font-syne.
  title: string
  // One-line dek under the headline. Plain string — keep it short.
  lead?: string
  // Page body.
  children: ReactNode
}

// Shared chrome for static identity surfaces (`/about`, `/manifesto`, `/equipo`).
// Mirrors the terminal-aesthetic header strip used elsewhere on type-specific
// route pages, but stripped down to a single reading column — no ContentGrid,
// no rail, no overlays. Built so the team can fill in copy later without
// touching layout code.
export function BrandPageShell({
  subsystem,
  title,
  lead,
  children,
}: BrandPageShellProps) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-10 border-b border-border pb-6">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-sys-orange"
            style={{ boxShadow: '0 0 6px #F97316, 0 0 12px #F9731666' }}
            aria-hidden
          />
          <span className="font-mono text-[10px] tracking-widest text-sys-orange">
            //SUBSISTEMA · {subsystem.toUpperCase()}
          </span>
        </div>
        <h1 className="font-syne text-4xl font-black leading-tight text-primary md:text-5xl">
          {title}
        </h1>
        {lead && (
          <p className="mt-3 font-mono text-sm leading-relaxed text-secondary md:text-base">
            {lead}
          </p>
        )}
      </header>

      <div className="brand-prose flex flex-col gap-6 font-grotesk text-base leading-relaxed text-secondary">
        {children}
      </div>
    </article>
  )
}

// Small inline marker used inside brand-page bodies to call out unwritten
// copy. The team replaces these with finished prose; until then, the page
// renders a visible "this needs to be written" chip in red so it can't be
// shipped accidentally.
export function Redactar({ note }: { note?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[10px] tracking-widest"
      style={{
        borderColor: '#E63329',
        color: '#E63329',
        backgroundColor: '#E6332910',
      }}
    >
      <span className="h-1 w-1 animate-pulse rounded-full bg-sys-red" aria-hidden />
      [REDACTAR{note ? ` · ${note}` : ''}]
    </span>
  )
}

// Section heading inside a brand page. Borrowed §-numbered idiom from
// [[ArticuloOverlay]] so the visual language stays consistent across long-form.
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
      <h2 className="flex items-baseline gap-3 font-syne text-xl font-black text-primary">
        <span className="font-mono text-xs tracking-widest text-muted">
          §{String(index).padStart(2, '0')}
        </span>
        <span>{title}</span>
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
