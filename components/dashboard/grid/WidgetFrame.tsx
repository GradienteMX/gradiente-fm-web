'use client'

// ── WidgetFrame — the §1.3 widget chrome anatomy ────────────────────────────
//
//   // NOMBRE DEL WIDGET          3 ●          [una acción]
//   ─────────────────────────────────────────── (hairline)
//   content register (d15 body / d28 numerals)
//
// Headers carry AT MOST: eyebrow-title, one true count/badge, ONE working
// action — no gears, no collapse carets, no refresh buttons (the props make
// more impossible). Compact mode (§2.5 data-aware boot) collapses the frame
// to a single 1-row teaching strip. Loading is one hairline shimmer bar —
// never skeleton theater (§2.6).

import type { ReactNode } from 'react'
import type { WidgetId } from '@/lib/dashboard/layout'

export const WIDGET_LABELS: Record<WidgetId, string> = {
  cultivar: 'CULTIVAR',
  actividad: 'ACTIVIDAD',
  guardados: 'GUARDADOS',
  reproductor: 'REPRODUCTOR',
  novedades: 'NOVEDADES',
  agenda: 'AGENDA',
  mapa: 'MAPA',
  perfil: 'PERFIL',
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
  children: ReactNode
}

// shrink-0 on every fixed header tenant (eyebrow, count, action): the copy
// region is the row's ONLY flexible tenant, so its min-w-0 flex budget is
// real — the chrome can never squeeze it into a mid-sentence ellipsis.
function EyebrowTitle({ title }: { title: string }) {
  return (
    <h3 className="shrink-0 whitespace-nowrap font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
      {'// '}
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
      className={`min-h-11 shrink-0 whitespace-nowrap font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline md:min-h-0 ${FOCUS_RING}`}
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
  children,
}: WidgetFrameProps) {
  if (compact) {
    // Single teaching row: eyebrow + one sentence + one working action inline.
    // The copy region is the only flexible tenant (min-w-0 flex-1 against
    // shrink-0 chrome) and its context is whitespace-normal: at ≥4-col widths
    // the sentence WRAPS to a second line inside the 96px row instead of
    // ellipsis-truncating mid-sentence.
    return (
      <section
        data-cue={cue}
        className="flex h-full min-h-11 items-center gap-4 border border-ink bg-paper-raised px-5"
      >
        <EyebrowTitle title={title} />
        {typeof count === 'number' && <CountBadge count={count} accent={accent} />}
        <div className="min-w-0 flex-1 whitespace-normal leading-snug">
          {loading ? <ShimmerBar /> : children}
        </div>
        {action && <ActionButton action={action} />}
      </section>
    )
  }

  return (
    <section data-cue={cue} className="flex h-full flex-col border border-ink bg-paper-raised">
      {/* flex-wrap: when the frame is narrow the action drops to its own
          header line — never overlaps and never crushes the eyebrow. */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink px-5 pb-3 pt-5">
        <EyebrowTitle title={title} />
        {typeof count === 'number' && <CountBadge count={count} accent={accent} />}
        <div className="flex-1" />
        {action && <ActionButton action={action} />}
      </header>
      {/* eyebrow→content gap 12px (§1.4); internal padding 20px, one value */}
      <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-3">
        {loading ? <ShimmerBar /> : children}
      </div>
    </section>
  )
}

// Stage-2 scaffold: renders for any WidgetId the page has not registered a
// component for yet. Honest copy — it names the module and its arrival, no
// fake data, no dead controls.
export function WidgetPlaceholder({ id, compact }: { id: WidgetId; compact?: boolean }) {
  return (
    <WidgetFrame title={WIDGET_LABELS[id]} compact={compact}>
      <p className="font-mono text-d13 text-ink-soft">
        {'// '}MÓDULO SIN REGISTRAR — {WIDGET_LABELS[id]} se conecta en la fase de
        widgets.
      </p>
    </WidgetFrame>
  )
}
