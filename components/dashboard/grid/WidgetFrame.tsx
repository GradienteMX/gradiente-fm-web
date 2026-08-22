'use client'

// ── WidgetFrame — the widget chrome anatomy (revision-2 standard) ───────────
//
//   NOMBRE DEL WIDGET          3 ●          [una acción]
//   ─────────────────────────────────────────── (hairline)
//   content register (d15 body / d28 numerals)
//
// Revision-2 header law (Iker point 5): the title is a BIG BOLD Syne line —
// the CREAR NUEVO register — clean, no '//' prefix anywhere on the panel
// (point 1). d28's 32px line-height keeps the SCALE-PASS chrome arithmetic
// intact (header line = 32px, total chrome = 87px), so every existing
// content budget still holds.
//
// Headers carry AT MOST: title, one true count/badge, ONE working action —
// no gears, no collapse carets, no refresh buttons (the props make more
// impossible). Compact mode (§2.5 data-aware boot) collapses the frame to a
// single 1-row teaching strip. Loading is one hairline shimmer bar — never
// skeleton theater (§2.6).
//
// `tone: 'acid'` paints the WHOLE frame acid (revision-2 point 3 — the CREAR
// NUEVO widget owns the block color; §1.1 legal use #1: acid fill with ink
// on top). No inner boxes ride on it — the frame IS the block.

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { WidgetId } from '@/lib/dashboard/layout'

export const WIDGET_LABELS: Record<WidgetId, string> = {
  crear: 'CREAR NUEVO',
  cultivar: 'CULTIVAR',
  actividad: 'ACTIVIDAD',
  guardados: 'GUARDADOS',
  reproductor: 'REPRODUCTOR',
  novedades: 'FRANJAS',
  agenda: 'AGENDA',
  mapa: 'MAPA',
  mercado: 'MERCADO',
}

// §10(14): 2px ink outline + 2px offset, never border-only.
export const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export interface WidgetFrameAction {
  label: string
  onClick: () => void
  // Link-affordance rule (one rule, panel-wide): actions that LEAVE the
  // panel — route pushes, external tabs — carry the ↗ mark; in-page actions
  // (facet switches, composers, scrolls) never do. Pass `external: true` for
  // route-leaving actions; a legacy trailing '↗' baked into `label` is
  // normalized into the same glyph so the mark renders once, consistently.
  external?: boolean
  // CUE table hook (§6) — visual today, audio-bindable tomorrow.
  cue?: string
}

export interface WidgetFrameProps {
  // Eyebrow text without the leading '//' (the frame prints it).
  title: string
  // One true count. Rendered tabular; never fabricated by the frame.
  count?: number
  // Acid attention dot next to the count (≥8px, 1px ink outline — the §1.1
  // sanctioned on-paper acid use). Only meaningful while count > 0.
  accent?: boolean
  action?: WidgetFrameAction
  compact?: boolean
  loading?: boolean
  cue?: string
  // 'acid' paints the whole frame acid (CREAR NUEVO — revision-2 point 3).
  tone?: 'paper' | 'acid'
  children: ReactNode
}

// shrink-0 on every fixed header tenant (title, count, action): the copy
// region is the row's ONLY flexible tenant, so its min-w-0 flex budget is
// real — the chrome can never squeeze it into a mid-sentence ellipsis.
// leading-8 pins the header LINE to exactly 32px (SCALE PASS S5) — d28's
// native line-height — so the count and action hang off this baseline and
// every widget's header measures the same regardless of optional tenants.
// The compact teaching row uses the d18 register (a d28 title inside the
// 96px strip would crowd its single line).
function FrameTitle({ title, compact }: { title: string; compact?: boolean }) {
  return (
    <h3
      className={`shrink-0 whitespace-nowrap font-syne font-bold uppercase leading-8 text-ink ${
        compact ? 'text-d18' : 'text-d28'
      }`}
    >
      {title}
    </h3>
  )
}

function CountBadge({ count, accent }: { count: number; accent?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-d13 tabular-nums text-ink">
      {count}
      {accent && count > 0 && (
        <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
      )}
    </span>
  )
}

function ActionButton({ action }: { action: WidgetFrameAction }) {
  const label = action.label.replace(/\s*↗\s*$/u, '')
  const external = action.external || label !== action.label
  return (
    <button
      type="button"
      onClick={action.onClick}
      data-cue={action.cue ?? 'tick'}
      // Judge r5 fix 4: the desktop header action renders as an 18px text
      // line — the relative + ::before pad extends its hit box to ~42px
      // inside the 44px header band without shifting the baseline (the
      // horizontal pad stays modest so it never overlaps the count).
      className={`relative min-h-11 shrink-0 whitespace-nowrap font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:underline md:min-h-0 ${FOCUS_RING}`}
    >
      {label}
      {external && (
        <span aria-hidden className="ml-1.5">
          ↗
        </span>
      )}
    </button>
  )
}

// §2.6 loading — a single hairline shimmer bar, stepped opacity (the tailwind
// `blink` keyframe is step-end), stilled under prefers-reduced-motion.
function ShimmerBar() {
  return (
    <div aria-hidden className="flex h-full items-center">
      <div className="h-0.5 w-1/2 animate-blink bg-ink motion-reduce:animate-none" />
    </div>
  )
}

export function WidgetFrame({
  title,
  count,
  accent,
  action,
  compact,
  loading,
  cue,
  tone,
  children,
}: WidgetFrameProps) {
  const ground = tone === 'acid' ? 'bg-acid' : 'bg-paper-raised'
  if (compact) {
    // Single teaching row: eyebrow + one sentence + one working action inline.
    // The copy region is the only flexible tenant (min-w-0 flex-1 against
    // shrink-0 chrome) and its context is whitespace-normal: at ≥4-col widths
    // the sentence WRAPS to a second line inside the 96px row instead of
    // ellipsis-truncating mid-sentence.
    return (
      <section
        data-cue={cue}
        className={`flex h-full min-h-11 items-center gap-4 border border-ink px-5 ${ground}`}
      >
        <FrameTitle title={title} compact />
        {typeof count === 'number' && <CountBadge count={count} accent={accent} />}
        <div className="min-w-0 flex-1 whitespace-normal leading-snug">
          {loading ? <ShimmerBar /> : children}
        </div>
        {action && <ActionButton action={action} />}
      </section>
    )
  }

  // SCALE PASS chrome arithmetic (S5) — desktop, single header line:
  //   1 (border-t) + 6 (header pt) + 32 (header line) + 6 (header pb)
  //   + 1 (hairline) + 20 (content pt) + CONTENT + 20 (content pb) + 1 (border-b)
  //   = 87px of chrome.  Widget CONTENT budgets (ROW_UNIT 96, GUTTER 24):
  //     h2 → 2×96 + 1×24 − 87 = 129px
  //     h3 → 3×96 + 2×24 − 87 = 249px
  //     h4 → 4×96 + 3×24 − 87 = 369px
  //   Design fixed portions (S1) to these numbers; never to overflow.
  return (
    <section data-cue={cue} className={`flex h-full flex-col border border-ink ${ground}`}>
      {/* ONE standardized header line: eyebrow · count · action on a shared
          baseline inside a 32px line (S5). flex-wrap: when the frame is
          narrow the action drops to its own line — never overlaps and never
          crushes the eyebrow. */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink px-5 py-1.5">
        <FrameTitle title={title} />
        {typeof count === 'number' && <CountBadge count={count} accent={accent} />}
        <div className="flex-1" />
        {action && <ActionButton action={action} />}
      </header>
      {/* content register padding 20px on every side (S5); stack gaps inside
          the widget are the 12/16px rhythm, owned by the widget itself */}
      <div className="min-h-0 flex-1 overflow-hidden p-5">
        {loading ? <ShimmerBar /> : children}
      </div>
    </section>
  )
}

// ── VerRow — the S4 overflow/portal affordance ──────────────────────────────

export interface VerRowProps {
  // Mono uppercase label, e.g. 'VER TODO' / 'TODOS LOS BORRADORES'.
  label: string
  // One true count, rendered tabular, right-aligned before the arrow.
  count?: number
  // In-surface action (facet commit, in-place expansion, scroll). Ignored for
  // navigation when `href` is present.
  onClick?: () => void
  // Route target when the affordance LEAVES the dashboard ('/agenda' etc.).
  href?: string
  // Surface-leaving mark: renders ↗ instead of → (same rule as the frame's
  // header action — ↗ ONLY when leaving the surface).
  external?: boolean
  // CUE table hook (§6) — same plumbing as the frame's action chips.
  cue?: string
}

/**
 * VerRow — GLOBAL LAW S4 (SCALE PASS, reference ACCESOS RÁPIDOS pattern).
 *
 * The ONE sanctioned widget-foot overflow affordance. Every widget that holds
 * more items than its fixed default portion MUST declare the remainder with
 * this row — «VER TODO · N», «VER AGENDA ↗», «MOSTRAR ANTERIORES · N» — never
 * with an internal scroll rail, snap arrows, or a position readout at default
 * size. Full-width bordered row, mono d13 tracking-widest, count tabular
 * right-aligned before the arrow, min-h-11 (44px touch), hover fill
 * inversion, FOCUS_RING. `href` renders a Link (pair with `external` for the
 * ↗ mark); `onClick` renders a button for in-surface commits/expansions.
 */
export function VerRow({ label, count, onClick, href, external, cue }: VerRowProps) {
  const rowClass = `flex min-h-11 w-full items-center gap-3 border border-ink px-4 text-left font-mono text-d13 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' && (
        <span className="shrink-0 tabular-nums">{count}</span>
      )}
      <span aria-hidden className="shrink-0">
        {external ? '↗' : '→'}
      </span>
    </>
  )
  if (href) {
    return (
      <Link href={href} data-cue={cue ?? 'tick'} className={rowClass}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} data-cue={cue ?? 'tick'} className={rowClass}>
      {body}
    </button>
  )
}

// Stage-2 scaffold: renders for any WidgetId the page has not registered a
// component for yet. Honest copy — it names the module and its arrival, no
// fake data, no dead controls.
export function WidgetPlaceholder({ id, compact }: { id: WidgetId; compact?: boolean }) {
  return (
    <WidgetFrame title={WIDGET_LABELS[id]} compact={compact}>
      <p className="font-mono text-d13 text-ink-soft">
        MÓDULO SIN REGISTRAR — {WIDGET_LABELS[id]} se conecta en la fase de widgets.
      </p>
    </WidgetFrame>
  )
}
