'use client'

// ── CULTIVAR Zone B — CONTINUAR (FINAL_SPEC §3.1 + SCALE PASS S1/S2/S4) ─────
//
// Drafts sorted `_updatedAt` desc: type dot, title, honest relative
// timestamp, CONTINUAR affordance. Row click = 1 click, 0 confirms —
// `/dashboard?type=<t>&edit=<id>` (the compose deep-link contract; the form
// reads `?edit=` itself via useSearchParams and hydrates the draft).
//
// SCALE PASS portions (S1): the DEFAULT portion is exactly 2 WHOLE two-line
// rows — computed by design, never by overflow — and NO internal scroll
// exists here at any size. Overflow is declared by ONE VerRow (S4):
// «TODOS LOS BORRADORES · N» toggles the in-zone expansion (the only
// sanctioned in-widget list expansion; the parent column/root scrolls ONLY
// after that explicit choice — CultivarWidget owns the scroll container and
// the expanded flag).
//
// Two layouts, chosen by CultivarWidget from its size state:
//   'band'    h4 sizes — the zone is a full-width foot band: 2 bordered
//             two-line rows side by side + the VerRow inline at the right.
//             Row arithmetic: border 2 + py-1.5 12 + d15 line 22 + gap 2 +
//             d11 line 18 = 56px ≥ the S2 52px list-row floor.
//   'stacked' h3 sizes — the legacy vertical list under CREAR (hairline-
//             separated rows, py-1.5 12 + 22 + 2 + 18 + border-b 1 = 55px);
//             the left column scrolls as one (sanctioned at h3 only).
//
// Data comes from the provider slice only (§3.10); this file never calls
// useDraftItems. The «N BORRADORES» count here is the same number the
// StatusStrip rolls up (same slice).

import { useMemo } from 'react'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { FOCUS_RING, VerRow } from '@/components/dashboard/grid/WidgetFrame'
import type { DraftItem } from '@/lib/drafts'
import { TypeDot, isComposeType, useComposeNav } from './CrearZone'

// Short honest relative time in the mono register («HACE 2 H»).
export function relTimeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'AHORA'
  if (min < 60) return `HACE ${min} MIN`
  const h = Math.floor(min / 60)
  if (h < 24) return `HACE ${h} H`
  return `HACE ${Math.floor(h / 24)} D`
}

// S1 fixed portion — 2 whole rows at default, everything else behind the
// VerRow expansion.
const DEFAULT_PORTION = 2

export interface DraftRowsProps {
  // 'band' = h4 foot band (rows abreast); 'stacked' = h3 left-column list.
  layout: 'band' | 'stacked'
  // In-zone expansion state — OWNED BY CultivarWidget (it must switch its
  // scroll container on when the user chooses depth).
  expanded: boolean
  onToggleExpanded: () => void
}

function ZoneEyebrow() {
  return (
    <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink-soft">
      {'// CONTINUAR'}
    </span>
  )
}

function ZoneCount({ count }: { count: number }) {
  return (
    <span className="font-mono text-d13 tabular-nums text-ink">
      {count} {count === 1 ? 'BORRADOR' : 'BORRADORES'}
    </span>
  )
}

// One two-line draft row (S2 ≥52px). Line 1: dot + whole title. Line 2:
// «BORRADOR · HACE N» + the CONTINUAR affordance — the row self-labels so
// the collapsed band needs no separate eyebrow line (its 24px would push the
// garden below its 160px floor at {12,4} — see CultivarWidget arithmetic).
function DraftRowButton({
  draft,
  boxed,
  onResume,
}: {
  draft: DraftItem
  boxed?: boolean
  onResume: (d: DraftItem) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onResume(draft)}
      data-cue="tick"
      className={`group flex w-full min-w-0 flex-col justify-center gap-0.5 py-1.5 text-left ${
        boxed ? 'border border-ink px-3' : ''
      } ${FOCUS_RING}`}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <TypeDot type={draft.type} />
        <span className="min-w-0 flex-1 truncate font-grotesk text-d15 text-ink">
          {draft.title || 'Sin título'}
        </span>
      </span>
      <span className="flex w-full items-baseline justify-between gap-2 pl-4">
        <span className="truncate font-mono text-d11 tabular-nums text-ink-faint">
          BORRADOR · {relTimeShort(draft._updatedAt)}
        </span>
        <span className="shrink-0 font-mono text-d13 tracking-widest text-ink underline-offset-4 group-hover:underline">
          CONTINUAR
        </span>
      </span>
    </button>
  )
}

export function DraftRows({ layout, expanded, onToggleExpanded }: DraftRowsProps) {
  const { drafts } = useDashboardData()
  const composeNav = useComposeNav()

  // Real DB drafts only (the slice also carries legacy session-published
  // rows); resumable = the 8 composable types.
  const rows = useMemo(
    () =>
      drafts
        .filter((d) => d._draftState === 'draft' && isComposeType(d.type))
        .sort((a, b) => b._updatedAt.localeCompare(a._updatedAt)),
    [drafts],
  )

  // Current-surface navigation (lab never ejects to prod — judge r2 fix 2).
  const resume = (d: DraftItem) => {
    if (isComposeType(d.type)) composeNav(d.type, d.id)
  }

  const shown = expanded ? rows : rows.slice(0, DEFAULT_PORTION)
  const overflows = rows.length > DEFAULT_PORTION

  if (rows.length === 0) {
    // Honest empty state — one line in the band, eyebrow-over-copy stacked.
    return (
      <div
        className={
          layout === 'band'
            ? 'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'
            : 'flex min-w-0 flex-col gap-2'
        }
      >
        <ZoneEyebrow />
        <p className="min-w-0 font-mono text-d13 leading-snug text-ink-soft">
          {'// SIN BORRADORES — lo que escribas se guarda solo.'}
        </p>
      </div>
    )
  }

  if (layout === 'band') {
    if (!expanded) {
      // Collapsed band: exactly 2 whole rows abreast (md+) + the VerRow.
      // Band height = border-t 1 (parent) + pt-3 12 (parent) + row 56 = 69px.
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <ul className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row">
            {shown.map((d) => (
              <li key={d.id} className="flex min-w-0 md:flex-1">
                <DraftRowButton draft={d} boxed onResume={resume} />
              </li>
            ))}
          </ul>
          {overflows && (
            <div className="flex shrink-0 md:w-72">
              <VerRow
                label="TODOS LOS BORRADORES"
                count={rows.length}
                onClick={onToggleExpanded}
              />
            </div>
          )}
        </div>
      )
    }
    // Expanded band: the user chose depth — ALL rows render in a 2-up grid
    // and CultivarWidget's content column scrolls (the ONLY sanctioned
    // in-widget expansion). The eyebrow + true count return as the header.
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <ZoneEyebrow />
          <ZoneCount count={rows.length} />
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {rows.map((d) => (
            <li key={d.id} className="flex min-w-0">
              <DraftRowButton draft={d} boxed onResume={resume} />
            </li>
          ))}
        </ul>
        <VerRow label="MOSTRAR MENOS" onClick={onToggleExpanded} />
      </div>
    )
  }

  // 'stacked' — h3 left-column list: eyebrow + 2 rows (or all when expanded)
  // + the VerRow toggle. No internal scroll here EVER; at h3 the whole left
  // column is the sanctioned scroll container (CultivarWidget).
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <ZoneEyebrow />
        <ZoneCount count={rows.length} />
      </div>
      <ul className="flex flex-col">
        {shown.map((d) => (
          <li key={d.id} className="border-b border-ink last:border-b-0">
            <DraftRowButton draft={d} onResume={resume} />
          </li>
        ))}
      </ul>
      {overflows && (
        <VerRow
          label={expanded ? 'MOSTRAR MENOS' : 'TODOS LOS BORRADORES'}
          count={expanded ? undefined : rows.length}
          onClick={onToggleExpanded}
        />
      )}
    </div>
  )
}
