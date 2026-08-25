'use client'

// ── CREAR NUEVO — its own acid widget (revision-2 points 3, 4, 10) ──────────
//
// Split out of CULTIVAR: the WHOLE frame is the acid block (WidgetFrame
// tone='acid'), title in the big Syne register, no '//' anywhere, and the
// «una pieza nueva, un clic» line is gone. Content = the role-gated type
// chips (1 click → compose sheet) + ONE filled BORRADORES button (ink fill —
// the "otro color" against the acid ground) that opens a popup listing the
// drafts exactly as the old CONTINUAR rows drew them: type dot · title ·
// «BORRADOR · HACE N» · CONTINUAR. No CONTINUAR zone anywhere else (point
// 10), and no teaching copy when empty — the popup just says SIN BORRADORES.
//
// Gates unchanged: chips filter through canCreateContent (layer 1); the
// `?type=` URL guard in app/dashboard/page.tsx stays layer 2. Draft resume
// keeps the exact compose deep-link contract (`?type=<t>&edit=<id>` on the
// CURRENT surface — the lab never ejects to prod).

import { useMemo, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { canCreateContent } from '@/lib/permissions'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { DashPopup } from '@/components/dashboard/DashPopup'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import type { DraftItem } from '@/lib/drafts'
import {
  COMPOSE_TYPES,
  TypeChip,
  TypeDot,
  isComposeType,
  useComposeNav,
} from './cultivar/CrearZone'

// Short honest relative time in the mono register («HACE 2 H») — the old
// DraftRows helper, now living with its only consumer.
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

// One draft row — the old-version composition (dot · title / BORRADOR · HACE
// N · CONTINUAR), hairline-separated inside the popup.
function DraftRow({ draft, onResume }: { draft: DraftItem; onResume: (d: DraftItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onResume(draft)}
      data-cue="tick"
      className={`group flex w-full min-w-0 flex-col justify-center gap-0.5 border-b border-ink py-2 text-left last:border-b-0 ${FOCUS_RING}`}
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

export function CrearWidget({ compact }: DashboardWidgetProps) {
  const { currentUser } = useAuth()
  const { drafts } = useDashboardData()
  const composeNav = useComposeNav()
  const [draftsOpen, setDraftsOpen] = useState(false)

  const allowed = COMPOSE_TYPES.filter((t) => canCreateContent(currentUser, t))

  // Real DB drafts only, newest edit first (the old DraftRows filter).
  const rows = useMemo(
    () =>
      drafts
        .filter((d) => d._draftState === 'draft' && isComposeType(d.type))
        .sort((a, b) => b._updatedAt.localeCompare(a._updatedAt)),
    [drafts],
  )

  const resume = (d: DraftItem) => {
    if (isComposeType(d.type)) {
      setDraftsOpen(false)
      composeNav(d.type, d.id)
    }
  }

  // The filled button — ink on acid (the "otro color, relleno" of point 4).
  const borradoresButton = (
    <button
      type="button"
      onClick={() => setDraftsOpen(true)}
      data-cue="latch"
      className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d13 font-bold tracking-widest text-paper hover:bg-paper hover:text-ink md:min-h-9 ${FOCUS_RING}`}
    >
      BORRADORES
      <span className="tabular-nums">{rows.length}</span>
    </button>
  )

  const popup = draftsOpen && (
    <DashPopup title="BORRADORES" count={rows.length} onClose={() => setDraftsOpen(false)}>
      {rows.length === 0 ? (
        <p className="font-mono text-d13 text-ink-soft">SIN BORRADORES.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((d) => (
            <DraftRow key={d.id} draft={d} onResume={resume} />
          ))}
        </div>
      )}
    </DashPopup>
  )

  if (allowed.length === 0) {
    // Honest permissions state — paper tone: no acid celebration for a
    // surface the role cannot use.
    return (
      <div id={dashWidgetDomId('crear')} className="h-full scroll-mt-14">
        <WidgetFrame title="CREAR NUEVO" compact={compact}>
          <p className="font-grotesk text-d13 leading-snug text-ink">
            Tu rol no compone contenido publicable. Los lectores leen, comentan y
            participan en el foro; la composición editorial está reservada a
            redacción. Un admin puede ajustar tu rol.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  if (compact) {
    return (
      <div id={dashWidgetDomId('crear')} className="h-full scroll-mt-14">
        <WidgetFrame title="CREAR NUEVO" tone="acid" compact>
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            {allowed.map((t) => (
              <TypeChip key={t} type={t} onPick={(picked) => composeNav(picked)} />
            ))}
            {borradoresButton}
          </div>
        </WidgetFrame>
        {popup}
      </div>
    )
  }

  return (
    <div id={dashWidgetDomId('crear')} className="h-full scroll-mt-14">
      <WidgetFrame title="CREAR NUEVO" tone="acid">
        <div className="flex h-full min-h-0 flex-col gap-3">
          {/* Chips — law-visible, 1 click to the compose sheet. */}
          <div className="flex flex-wrap content-start gap-2">
            {allowed.map((t) => (
              <TypeChip key={t} type={t} onPick={(picked) => composeNav(picked)} />
            ))}
          </div>
          {/* BORRADORES — the one other affordance in this space (point 4). */}
          <div className="mt-auto flex shrink-0">{borradoresButton}</div>
        </div>
      </WidgetFrame>
      {popup}
    </div>
  )
}
