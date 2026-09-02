'use client'

// ── ESPACIOS kit — the shared anatomy of a bespoke space (PLIEGO fase D) ────
//
// PANEL is a widget grid; PUBLICAR/FRANJA/MERCADO are printed sheets. These
// primitives give the three sheets ONE anatomy so they read as the same
// document, without inventing a second design system: every register here is
// lifted from WidgetFrame/VerRow (the panel) and the compose pliego (the
// editor), so a user moving between spaces never re-learns the page.
//
// Registers, fixed:
//   · sheet title      Syne d28 extrabold      (WidgetFrame's FrameTitle)
//   · sub-head         Syne d18 extrabold
//   · label / chrome   mono d11–d13 uppercase tracking-widest
//   · body             grotesk d15
//   · rules            1px border-ink hairlines; NO radius, shadow or glow
//   · acid             fill-block with ink on top, own-actions ONLY
//   · focus            the one FOCUS_RING grammar, re-exported from the panel

import Link from 'next/link'
import type { ReactNode } from 'react'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export { FOCUS_RING }

// ── Space head ──────────────────────────────────────────────────────────────

/** The banner line of a space: Syne title, optional chips, right-hand slot. */
export function SpaceHead({
  title,
  eyebrow,
  chips,
  right,
  as: Heading = 'h1',
}: {
  title: ReactNode
  eyebrow?: string
  chips?: ReactNode
  right?: ReactNode
  /**
   * Heading level. In a dashboard space this banner IS the page heading, so
   * h1 is the default and the three existing spaces are unaffected. /admin is
   * different: the route already prints «CENTRAL DE ADMINISTRACIÓN» as its h1
   * and a tab's SpaceHead sits underneath it, so those pass 'h2'. Two h1s on
   * one document give a screen-reader user two competing titles for the page.
   */
  as?: 'h1' | 'h2'
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink py-4">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            {eyebrow}
          </span>
        )}
        <Heading className="font-syne text-d28 font-extrabold uppercase text-ink">
          {title}
        </Heading>
      </div>
      {chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

// ── Sub-tabs ────────────────────────────────────────────────────────────────

export interface SubTab<T extends string> {
  id: T
  label: string
  count?: number
  /** Acid dot = something of the user's own is waiting (an unanswered offer). */
  dot?: boolean
}

/**
 * The in-space tab strip. Active tab is an ink baseline (2px) — NOT a fill,
 * so it never competes with the space tab bar above it, which IS a fill.
 * Two levels of latch, two different marks: the hierarchy stays readable.
 */
export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly SubTab<T>[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap items-stretch border-b border-ink"
    >
      {tabs.map((tab) => {
        const on = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            data-cue="latch"
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 font-mono text-d13 uppercase tracking-widest ${FOCUS_RING} ${
              on
                ? 'border-ink font-bold text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="tabular-nums text-ink-faint">· {tab.count}</span>
            )}
            {tab.dot && <span aria-hidden className="h-2 w-2 border border-ink bg-acid" />}
          </button>
        )
      })}
    </div>
  )
}

// ── Sheet ───────────────────────────────────────────────────────────────────

/** A bordered paper panel: Syne sub-head, optional note + action, body. */
export function Sheet({
  title,
  note,
  action,
  children,
  padded = true,
}: {
  title?: ReactNode
  note?: ReactNode
  action?: ReactNode
  children: ReactNode
  /** false when the body is a full-bleed table that owns its own padding. */
  padded?: boolean
}) {
  return (
    <section className="border border-ink bg-paper-raised">
      {(title || note || action) && (
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink px-4 py-3">
          {title && (
            <h2 className="font-syne text-d18 font-extrabold uppercase text-ink">{title}</h2>
          )}
          {note && (
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              {note}
            </span>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

// ── Acid block — the space's ONE primary own-action ─────────────────────────

/**
 * Acid fill with ink on top. Legal because it is always the user's own
 * creative action (CREAR / PUBLICAR COMO FRANJA / NUEVA PUBLICACIÓN) — the
 * same whitelist the panel's CREAR widget rides. Never more than one per
 * space, and never for a destructive or third-party action.
 */
export function AcidBlock({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-ink bg-acid p-5">
      <div className="min-w-0">
        <h2 className="font-syne text-d28 font-extrabold uppercase text-ink">{title}</h2>
        {note && (
          <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-soft">
            {note}
          </p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap justify-end gap-2">{children}</div>
    </section>
  )
}

// ── Chips + buttons ─────────────────────────────────────────────────────────

/** Ink hairline chip. `filled` inverts it (the PUBLICADO / active register). */
export function Chip({
  children,
  filled,
  tone = 'ink',
  swatch,
}: {
  children: ReactNode
  filled?: boolean
  tone?: 'ink' | 'red'
  /** Data-driven category hue, rendered as a swatch — never as the text colour. */
  swatch?: string
}) {
  const red = tone === 'red'
  const cls = filled
    ? red
      ? 'border-sys-red-paper bg-sys-red-paper text-paper'
      : 'border-ink bg-ink text-paper'
    : red
      ? 'border-sys-red-paper text-sys-red-paper'
      : 'border-ink text-ink'
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest ${cls}`}
    >
      {swatch && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </span>
  )
}

/** Hairline action button: mono d13, ink-fill inversion on hover, ≥44px. */
export function InkButton({
  children,
  onClick,
  href,
  external,
  type = 'button',
  disabled,
  tone = 'ink',
  cue = 'tick',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  external?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  tone?: 'ink' | 'red' | 'filled'
  cue?: string
  title?: string
}) {
  const tones: Record<string, string> = {
    ink: 'border-ink text-ink hover:bg-ink hover:text-paper',
    red: 'border-sys-red-paper text-sys-red-paper hover:bg-sys-red-paper hover:text-paper',
    filled: 'border-ink bg-ink text-paper hover:bg-paper hover:text-ink',
  }
  const cls = `inline-flex min-h-[44px] items-center gap-2 border px-3 font-mono text-d13 uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${FOCUS_RING}`
  if (href) {
    return (
      <Link href={href} data-cue={cue} className={cls} title={title}>
        {children}
        {external && <span aria-hidden>↗</span>}
      </Link>
    )
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-cue={cue}
      className={cls}
      title={title}
    >
      {children}
    </button>
  )
}

// ── Rows + tables ───────────────────────────────────────────────────────────

/** A hairline-ruled list row. The last row drops its rule via `last`. */
export function Row({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${
        last ? '' : 'border-b border-ink/15'
      }`}
    >
      {children}
    </div>
  )
}

/** Table shell: mono uppercase head, ink hairline rules, tabular numerics. */
export function SheetTable({
  head,
  children,
}: {
  head: readonly string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-faint ${
                  i === head.length - 1 ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Td({
  children,
  right,
  mono = true,
}: {
  children: ReactNode
  right?: boolean
  mono?: boolean
}) {
  return (
    <td
      className={`border-b border-ink/15 px-4 py-3 align-middle text-d13 text-ink ${
        mono ? 'font-mono' : 'font-grotesk'
      } ${right ? 'text-right' : ''}`}
    >
      {children}
    </td>
  )
}

// ── Honest states ───────────────────────────────────────────────────────────

/** Empty state. Says what is absent — never a fake row, never a spinner. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center font-mono text-d13 uppercase tracking-widest text-ink-faint">
      {children}
    </p>
  )
}

/** Load state: one hairline shimmer, the panel's only loading motion. */
export function ShimmerLine() {
  return <div aria-hidden className="h-px w-full bg-ink motion-safe:animate-blink" />
}

/** Failure state — honest, never silently empty. */
export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center font-mono text-d13 uppercase tracking-widest text-sys-red-paper">
      {children}
    </p>
  )
}

/**
 * The dashed marginal note — used ONLY to declare a real limit of the system
 * (no scheduling exists; Gradiente does not process payments). Never
 * decoration.
 */
export function MarginNote({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-ink/45 p-4 font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
      {children}
    </p>
  )
}
