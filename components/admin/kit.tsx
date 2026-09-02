'use client'

// ── ADMIN kit — the instrument primitives ───────────────────────────────────
//
// /admin adopts the espacios kit wholesale rather than forking a third design
// system: Sheet, SheetTable, Td, Row, Chip, InkButton, SubTabs, AcidBlock,
// EmptyLine, ErrorLine, MarginNote and FOCUS_RING are re-exported below
// untouched. Before this file, all six admin components declared their own
// FOCUS_RING (six byte-identical copies) and three of them their own Th/Td.
//
// What is NEW here is only what the espacios kit genuinely lacks, because
// /admin is the first surface in the project that draws computed geometry:
// a KPI tile, a contribution meter, a sparkline, a multi-series line chart, a
// disclosure row and a generic level-1 latch bar.
//
// LAWS THESE PRIMITIVES KEEP (they are enforced by review, and by
// tests/dashboard/contrast.test.ts for the colour half):
//   · hue is NEVER the only channel — every swatch travels with its 2-letter
//     code, every series with its label
//   · acid is fill-block only. It is never a stroke, never text, never an axis
//     — 1.2:1 on cream. There is no legal acid line on paper.
//   · zero radius, zero shadow, hairline rules — borderRadius.DEFAULT is '0px'
//     so `rounded` is a silent no-op; don't reach for it
//   · no fake data, ever: an empty series renders as an empty plot with a
//     stated reason, never as a flat line at zero pretending to be a reading

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  clamp,
  niceTicks,
  project,
  round,
  shares,
  toPath,
  type PlotBox,
} from '@/lib/dashboard/scale'

export {
  FOCUS_RING,
  SpaceHead,
  SubTabs,
  Sheet,
  AcidBlock,
  Chip,
  InkButton,
  Row,
  SheetTable,
  Td,
  EmptyLine,
  ShimmerLine,
  ErrorLine,
  MarginNote,
} from '@/components/dashboard/espacios/kit'

import { FOCUS_RING } from '@/components/dashboard/espacios/kit'

// ── StatBlock — the RESUMEN tile ────────────────────────────────────────────

/**
 * Label over a big number. The numeric register is grotesk + tabular-nums,
 * matching every other scalar in the dashboard; `tone='hp'` paints it HP blue,
 * which is the reserved Human-Presence register and must not be spent on
 * anything else.
 *
 * `note` is where a tile states its own limit ("desde el 2 sep"), which is how
 * a number that only covers part of the beta stays honest.
 */
export function StatBlock({
  label,
  value,
  delta,
  note,
  tone = 'ink',
}: {
  label: string
  value: ReactNode
  /** Signed change over the window. Rendered with an explicit + or −. */
  delta?: number
  note?: string
  tone?: 'ink' | 'hp'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
      <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
        {label}
      </span>
      <span
        className={`font-grotesk text-d28 font-bold tabular-nums ${
          tone === 'hp' ? 'text-hp' : 'text-ink'
        }`}
      >
        {value}
      </span>
      {typeof delta === 'number' && (
        <span className="font-mono text-d11 tabular-nums tracking-widest text-ink-soft">
          {delta >= 0 ? '+' : '−'}
          {Math.abs(round(delta, 1))}
        </span>
      )}
      {note && (
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {note}
        </span>
      )}
    </div>
  )
}

/** The tile strip: hairline-divided, wraps on narrow viewports. */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-ink/15 border border-ink bg-paper-raised sm:grid-cols-2 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
      {children}
    </div>
  )
}

// ── BarMeter — proportional contribution ────────────────────────────────────

/**
 * The horizontal meter that already exists inline in three places
 * (ComposeRail, MercadoSpace, IdentitySpine), extracted so the fourth use does
 * not become a fourth copy. Ink trough, hued fill, `role="progressbar"` with a
 * words-only accessible name.
 */
export function BarMeter({
  pct,
  color,
  label,
}: {
  pct: number
  color: string
  /** Full sentence for AT — the visual percentage is not readable on its own. */
  label: string
}) {
  const v = clamp(pct, 0, 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className="h-2 w-full border border-ink bg-paper"
    >
      <div className="h-full" style={{ width: `${v}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Breakdown — HL by interaction kind ──────────────────────────────────────

export interface BreakdownRow {
  key: string
  label: string
  /** 2-letter redundancy channel beside the swatch. */
  code: string
  color: string
  /** Weighted HL contributed. */
  weight: number
  /** Event count. `null` when unknowable (rows written before 0049). */
  count: number | null
  /** Nominal per-event weight, for the "N × 0.5" reading. */
  nominal?: number
}

/**
 * The INTERACCIONES → HL table, and the same block inside an expanded item.
 *
 * Deliberately shows weight and count as SEPARATE columns rather than deriving
 * one from the other: hp_events.weight is the nominal weight times a
 * per-caller novelty multiplier, so `weight / nominal` is not the count and
 * would be wrong by up to 50%. Counts come from base_weight. When count is
 * null (pre-ledger rows) the cell prints «—», never a computed guess.
 */
export function KindBreakdown({ rows, total }: { rows: BreakdownRow[]; total?: number }) {
  const pcts = shares(rows.map((r) => r.weight))
  const sum = total ?? rows.reduce((a, r) => a + r.weight, 0)

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-ink">
          {['INTERACCIÓN', 'PESO HL', 'EVENTOS', 'CONTRIBUCIÓN HL'].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`px-3 py-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-faint ${
                i === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key}>
            <td className="border-b border-ink/15 px-3 py-2 font-mono text-d13 uppercase tracking-widest text-ink">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 border border-ink"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-ink-faint">{r.code}</span>
                {r.label}
              </span>
            </td>
            <td className="border-b border-ink/15 px-3 py-2 text-right font-mono text-d13 tabular-nums text-ink-soft">
              {r.nominal !== undefined ? `× ${r.nominal}` : '—'}
            </td>
            <td className="border-b border-ink/15 px-3 py-2 text-right font-mono text-d13 tabular-nums text-ink">
              {r.count === null ? '—' : r.count.toLocaleString('es-MX')}
            </td>
            <td className="border-b border-ink/15 px-3 py-2">
              <div className="flex items-center justify-end gap-3">
                <span className="w-24 shrink-0">
                  <BarMeter
                    pct={pcts[i]}
                    color={r.color}
                    label={`${r.label}: ${pcts[i]}% de la HL ganada`}
                  />
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-d13 tabular-nums text-ink">
                  {pcts[i]}%
                </span>
              </div>
            </td>
          </tr>
        ))}
        <tr>
          <td className="px-3 py-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
            HL GANADA
          </td>
          <td />
          <td />
          <td className="px-3 py-2 text-right font-grotesk text-d15 font-bold tabular-nums text-hp">
            +{round(sum, 1)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ── Sparkline ───────────────────────────────────────────────────────────────

/**
 * A 7-day trajectory in a table cell. `currentColor` so it inherits the row's
 * ink and inverts for free under the pressed register. Hairline stroke,
 * square caps — round caps read as foreign in a zero-radius system.
 *
 * Renders nothing but a baseline rule when every value is zero: a flat line
 * mid-box would imply a steady reading where there is no reading at all.
 */
export function Sparkline({
  values,
  label,
  width = 84,
  height = 24,
}: {
  values: readonly number[]
  label: string
  width?: number
  height?: number
}) {
  const box: PlotBox = { width, height, pad: [3, 2, 3, 2] }
  const allZero = values.every((v) => v === 0)

  if (values.length === 0 || allZero) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: sin actividad`}
        className="text-ink-faint"
      >
        <line
          x1={2}
          y1={height - 3}
          x2={width - 2}
          y2={height - 3}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    )
  }

  const { min, max } = niceTicks(Math.min(...values), Math.max(...values), 2)
  const pts = project(values, { min, max }, box)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="text-ink"
    >
      <path
        d={toPath(pts)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {pts.map((p, i) => (
        <rect key={i} x={p.x - 1} y={p.y - 1} width={2} height={2} fill="currentColor" />
      ))}
    </svg>
  )
}

// ── LineChart — FLUJO DE VIDA ───────────────────────────────────────────────

export interface ChartSeries {
  key: string
  label: string
  color: string
  values: number[]
  /** Dashed when the series is a derived/negative quantity (decay). */
  dashed?: boolean
}

/**
 * Multi-series line over a dense day axis.
 *
 * Accessibility: the plot is `role="img"` with a summary label, and the same
 * numbers are ALSO rendered as a real table for screen readers (sr-only) —
 * a chart is an image and the honest fallback is the data, not a longer
 * alt string.
 *
 * Gridlines come from `.dash-ledger` on the wrapper where possible; the
 * horizontal value rules are drawn here because they must land on the nice
 * ticks, which the CSS gradient cannot know about.
 */
export function LineChart({
  series,
  days,
  height = 200,
  markers = [],
}: {
  series: ChartSeries[]
  /** Day keys, same length as every series' values. */
  days: string[]
  height?: number
  /** Vertical rules at day indices — real events, never decoration. */
  markers?: { index: number; label: string }[]
}) {
  const titleId = useId()
  const width = 640
  const box: PlotBox = { width, height, pad: [10, 8, 22, 44] }

  const all = series.flatMap((s) => s.values)
  const hasData = all.length > 0 && all.some((v) => v !== 0)
  const { ticks, min, max } = niceTicks(
    Math.min(0, ...all),
    Math.max(0, ...all),
    4,
  )

  const [pt, pr, pb, pl] = box.pad
  const plotW = width - pl - pr
  const plotH = height - pt - pb
  const yOf = (v: number) =>
    round(pt + plotH - ((clamp(v, min, max) - min) / (max - min || 1)) * plotH)

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-labelledby={titleId}
          className="min-w-[520px]"
        >
          <title id={titleId}>
            {hasData
              ? `Flujo de vida: ${series.map((s) => s.label).join(', ')} sobre ${days.length} días`
              : 'Flujo de vida: sin datos en la ventana seleccionada'}
          </title>

          {/* Value rules + labels, on the nice ticks. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pl}
                y1={yOf(t)}
                x2={width - pr}
                y2={yOf(t)}
                stroke="currentColor"
                strokeWidth={t === 0 ? 1 : 0.5}
                className="text-ink"
                opacity={t === 0 ? 0.45 : 0.18}
              />
              <text
                x={pl - 6}
                y={yOf(t) + 3}
                textAnchor="end"
                className="fill-ink-faint font-mono"
                style={{ fontSize: 9 }}
              >
                {round(t, 1)}
              </text>
            </g>
          ))}

          {/* Event markers — dotted verticals with a hollow cap. */}
          {markers.map((m) => {
            const x = round(pl + (m.index / Math.max(1, days.length - 1)) * plotW)
            return (
              <g key={`${m.index}-${m.label}`}>
                <line
                  x1={x}
                  y1={pt}
                  x2={x}
                  y2={pt + plotH}
                  stroke="currentColor"
                  strokeWidth={0.75}
                  strokeDasharray="2 3"
                  className="text-ink"
                  opacity={0.5}
                />
                <circle
                  cx={x}
                  cy={pt}
                  r={3}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  className="text-ink"
                />
              </g>
            )
          })}

          {hasData &&
            series.map((s) => (
              <path
                key={s.key}
                d={toPath(project(s.values, { min, max }, box))}
                fill="none"
                stroke={s.color}
                strokeWidth={1.4}
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeDasharray={s.dashed ? '4 3' : undefined}
              />
            ))}

          {/* Day axis: first, middle and last only — a 30-tick axis on a
              640px plot collides with itself. */}
          {[0, Math.floor(days.length / 2), days.length - 1]
            .filter((i, idx, arr) => days[i] && arr.indexOf(i) === idx)
            .map((i) => (
              <text
                key={i}
                x={round(pl + (i / Math.max(1, days.length - 1)) * plotW)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
                className="fill-ink-faint font-mono"
                style={{ fontSize: 9 }}
              >
                {days[i]?.slice(5)}
              </text>
            ))}
        </svg>
      </div>

      {/* Legend — swatch + label, never colour alone. */}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink-soft"
          >
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 shrink-0"
              style={{
                backgroundColor: s.dashed ? 'transparent' : s.color,
                borderTop: s.dashed ? `2px dashed ${s.color}` : undefined,
              }}
            />
            {s.label}
          </span>
        ))}
        {markers.length > 0 && (
          <span className="inline-flex items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full border border-ink" />
            EVENTO
          </span>
        )}
      </figcaption>

      {/* The honest fallback: the numbers themselves. */}
      <table className="sr-only">
        <caption>Flujo de vida, valores diarios</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              {series.map((s) => (
                <td key={s.key}>{round(s.values[i] ?? 0, 2)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// ── ExpandableRow — the disclosure pattern ──────────────────────────────────

/**
 * A table row that opens a full-width detail row beneath it. The pattern was
 * inlined once in MercadoSpace and nowhere else; CONTENIDO and MODERACIÓN both
 * need it, so it lives here with the aria wiring done once.
 *
 * The toggle is a real button inside the first cell, not a click handler on
 * the <tr>: a row-level onClick is unreachable by keyboard and swallows text
 * selection inside the row.
 */
export function ExpandableRow({
  cols,
  open,
  onToggle,
  summary,
  detail,
  label,
}: {
  cols: number
  open: boolean
  onToggle: () => void
  summary: ReactNode
  detail: ReactNode
  /** Names the disclosure for AT, e.g. the item title. */
  label: string
}) {
  const panelId = useId()
  return (
    <>
      <tr className={open ? 'bg-paper' : undefined}>
        {summary}
        <td className="border-b border-ink/15 px-4 py-3 text-right align-middle">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            data-cue="latch"
            className={`inline-flex min-h-11 items-center gap-2 border border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            {open ? 'CERRAR' : 'ABRIR'}
            <span aria-hidden>{open ? '▴' : '▾'}</span>
            <span className="sr-only">{label}</span>
          </button>
        </td>
      </tr>
      {open && (
        <tr id={panelId}>
          <td colSpan={cols} className="border-b border-ink bg-paper px-4 py-5">
            {detail}
          </td>
        </tr>
      )}
    </>
  )
}

// ── LatchBar — the generic level-1 tab strip ────────────────────────────────

export interface Latch {
  id: string
  label: string
  href: string
  /** Real count, printed beside the label. Never a placeholder. */
  count?: number
  /** Acid dot: something needs a person. ≥8px with a 1px ink outline. */
  dot?: boolean
}

/**
 * The ink-FILL latch — level 1. Its counterpart inside a tab is SubTabs, an
 * ink BASELINE. Two levels, two marks, so a glance tells you which axis you
 * just moved along. This is the same grammar as DashTabBar, which is hard-
 * bound to EspacioId and could not be reused; that binding is why this exists
 * rather than a third hand-rolled copy.
 *
 * Tabs are real <Link>s, so they middle-click and bookmark. `flex-wrap` and no
 * flex-1: at seven tabs a stretched strip pushes labels to two lines on a
 * laptop, and a wrapped second row of natural-width latches reads better than
 * a squeezed single row.
 */
export function LatchBar({
  tabs,
  active,
  ariaLabel,
}: {
  tabs: readonly Latch[]
  active: string
  ariaLabel: string
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-stretch border border-ink bg-paper-raised"
    >
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <Link
            key={t.id}
            href={t.href}
            scroll={false}
            aria-current={on ? 'page' : undefined}
            data-cue="latch"
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap border-l border-ink px-4 font-mono text-d13 uppercase tracking-widest transition-colors first:border-l-0 ${FOCUS_RING} ${
              on ? 'bg-ink font-bold text-paper' : 'text-ink-soft hover:bg-ink hover:text-paper'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className={`tabular-nums ${on ? 'text-paper/70' : 'text-ink-faint'}`}>
                · {t.count}
              </span>
            )}
            {t.dot && (
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 border bg-acid ${on ? 'border-paper' : 'border-ink'}`}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// ── Disclosure hook for tables ──────────────────────────────────────────────

/** Single-open disclosure state — two expanded dossiers never fit on screen. */
export function useSingleOpen(): [string | null, (id: string) => void] {
  const [open, setOpen] = useState<string | null>(null)
  return [open, (id: string) => setOpen((cur) => (cur === id ? null : id))]
}
