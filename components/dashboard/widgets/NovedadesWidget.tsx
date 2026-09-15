'use client'

// Clean franja logos on the panel; the popup contains explicit follow controls
// and the chronological feed from those follows. No recommendation ranking.

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { DashPopup } from '@/components/dashboard/DashPopup'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { useOpenItem } from '@/lib/dashboard/openItem'
import {
  filterByFollows,
  type FranjaOption,
} from '@/lib/dashboard/novedades'
import {
  addFollow,
  removeFollow,
  type DashboardFollow,
} from '@/lib/dashboard/localState'
import { categoryColorOnLight, typeCode } from '@/lib/dashboard/palette'
import { getRootGenres } from '@/lib/genres'
import { SmartImage } from '@/components/SmartImage'
import type { ContentItem } from '@/lib/types'

// ── Honest short timestamps (mono system voice) ─────────────────────────────

function timeAgoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'AHORA'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'AHORA'
  if (min < 60) return `HACE ${min} MIN`
  const h = Math.floor(min / 60)
  if (h < 24) return `HACE ${h} H`
  const d = Math.floor(h / 24)
  if (d < 30) return `HACE ${d} D`
  const m = Math.floor(d / 30)
  return `HACE ${m} ${m === 1 ? 'MES' : 'MESES'}`
}

// ── Follow chips (the picker's atoms — CUE/STAMP on toggle) ─────────────────

function FollowChip({
  label,
  active,
  imageUrl,
  onToggle,
}: {
  label: string
  active: boolean
  imageUrl?: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      data-cue="stamp"
      className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink px-3 font-mono text-d13 uppercase tracking-wide ${
        active ? 'bg-ink text-paper' : 'bg-paper text-ink hover:underline'
      } ${FOCUS_RING}`}
    >
      {imageUrl && (
        <span
          aria-hidden
          className="relative h-5 w-5 shrink-0 overflow-hidden border border-ink"
        >
          <SmartImage src={imageUrl} alt="" sizes="20px" className="object-cover" />
        </span>
      )}
      <span className="max-w-40 truncate">{label}</span>
      {active && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid"
        />
      )}
    </button>
  )
}

// The picker — real franja catalogue + real genre roots, nothing invented.
// `rail` = one horizontal scroll strip (the compact teaching row);
// `panel` = wrapped sections inside the full widget body.
function FollowPicker({
  layout,
  uid,
  follows,
  franjaOptions,
}: {
  layout: 'rail' | 'panel'
  uid: string | null
  follows: readonly DashboardFollow[]
  franjaOptions: readonly FranjaOption[]
}) {
  const roots = getRootGenres()
  const isActive = useCallback(
    (f: DashboardFollow) =>
      follows.some((x) => x.kind === f.kind && x.key === f.key),
    [follows],
  )
  const toggle = useCallback(
    (f: DashboardFollow) => {
      // Follows are per-uid localStorage; without a session (lab fixtures)
      // there is no store to write.
      if (!uid) return
      if (follows.some((x) => x.kind === f.kind && x.key === f.key)) {
        removeFollow(uid, f)
      } else {
        addFollow(uid, f)
      }
    },
    [uid, follows],
  )

  const franjaChips = franjaOptions.map((p) => (
    <FollowChip
      key={`franja:${p.id}`}
      label={p.title}
      imageUrl={p.imageUrl}
      active={isActive({ kind: 'franja', key: p.id })}
      onToggle={() => toggle({ kind: 'franja', key: p.id })}
    />
  ))
  const genreChips = roots.map((g) => (
    <FollowChip
      key={`genre:${g.id}`}
      label={g.name}
      active={isActive({ kind: 'genre', key: g.id })}
      onToggle={() => toggle({ kind: 'genre', key: g.id })}
    />
  ))

  if (layout === 'rail') {
    return (
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
        {franjaChips}
        {genreChips}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {franjaOptions.length > 0 && (
        <section>
          <h4 className="mb-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
            COLECTIVOS Y ESPACIOS
          </h4>
          <div className="flex flex-wrap gap-2">{franjaChips}</div>
        </section>
      )}
      <section>
        <h4 className="mb-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          GÉNEROS
        </h4>
        <div className="flex flex-wrap gap-2">{genreChips}</div>
      </section>
    </div>
  )
}

// ── Feed row ────────────────────────────────────────────────────────────────
// S3 imagery-first: 48px artwork thumb (ink border) or an honest typographic
// type-code block when the item has no artwork — never an empty grey square.
// 52px fixed box (border-b drawn inside — box-border); two-line register:
// title d15 over swatch + type code + honest timestamp (hue is never the sole
// type signal — the 2-letter code rides beside every swatch).

function NovedadRow({
  item,
  isNew,
  dead,
  onOpen,
}: {
  item: ContentItem
  isNew: boolean
  dead: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-cue="tick"
      className={`group flex h-[52px] w-full items-center gap-3 border-b border-ink text-left last:border-b-0 ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className="relative h-12 w-12 shrink-0 overflow-hidden border border-ink"
      >
        {item.imageUrl ? (
          <SmartImage src={item.imageUrl} alt="" sizes="48px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-paper font-mono text-d11 uppercase tracking-widest text-ink-soft">
            {typeCode(item.type)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-d15 text-ink group-hover:underline">
          {item.title}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 border border-ink"
            style={{ backgroundColor: categoryColorOnLight(item.type) }}
          />
          <span className="shrink-0 font-mono text-d11 uppercase tracking-widest text-ink-soft">
            {typeCode(item.type)}
          </span>
          {dead ? (
            <span className="truncate font-mono text-d13 font-bold text-ink">
              NO DISPONIBLE
            </span>
          ) : (
            <span className="truncate font-mono text-d13 tabular-nums text-ink-faint">
              {timeAgoShort(item.publishedAt)}
            </span>
          )}
        </span>
      </span>
      {isNew && (
        <span
          aria-label="Nuevo desde tu última visita"
          className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid"
        />
      )}
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function NovedadesWidget({ size }: DashboardWidgetProps) {
  const { currentUser } = useAuth()
  const uid = currentUser?.id ?? null
  const ctx = useDashboardData()
  const router = useRouter()
  const openItem = useOpenItem()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  const keys = new Set(ctx.follows.filter((follow) => follow.kind === 'franja').map((follow) => follow.key))
  const followed = ctx.franjaOptions.filter((franja) => keys.has(franja.id))
  const franjas = followed.length ? followed : ctx.franjaOptions
  const feed = filterByFollows(ctx.novedades, ctx.follows)
  return <section id={dashWidgetDomId('novedades')} className="flex h-full scroll-mt-14 flex-col gap-3 border-t border-ink/25 pt-3">
    <header className="flex shrink-0 items-center justify-between gap-3">
      <h2 className="font-syne text-d18 font-extrabold">FRANJAS</h2>
      <button type="button" onClick={() => setOpen(true)} className={`min-h-9 font-mono text-d11 hover:underline ${FOCUS_RING}`}>EXPLORAR / SEGUIR →</button>
    </header>
    {ctx.errors.novedades ? <ErrorLine onRetry={() => void ctx.afterMutation()}/> : !ctx.loaded.novedades ? <p role="status" className="font-mono text-d13">Cargando franjas…</p> : !franjas.length ? <p className="font-grotesk text-d15 text-ink-soft">Todavía no hay franjas disponibles.</p> : <div className="flex min-h-0 flex-1 items-stretch gap-6 overflow-x-auto pb-2">
      {franjas.map((franja) => <button key={franja.id} type="button" onClick={() => router.push(`/f/${franja.slug}`)} aria-label={`Ver franja ${franja.title}`} className={`flex w-36 shrink-0 flex-col items-center justify-center gap-2 ${FOCUS_RING}`}>
        <span className={`relative block w-full ${size.h >= 3 ? 'h-40' : 'h-20'}`}>{franja.imageUrl ? <SmartImage src={franja.imageUrl} alt="" sizes="160px" className="object-contain"/> : <span className="font-syne text-xl font-bold">{franja.title}</span>}</span>
        <span className="max-w-full truncate font-mono text-d11">{franja.title}</span>
      </button>)}
    </div>}
    {open && <DashPopup title="FRANJAS" onClose={() => setOpen(false)} width="lg">
      <div className="flex flex-col gap-6">
        <FollowPicker layout="panel" uid={uid} follows={ctx.follows} franjaOptions={ctx.franjaOptions}/>
        {notice && <p role="status">No se pudo abrir esta publicación.</p>}
        {feed.length > 0 && <section><h3 className="mb-3 font-syne text-d18 font-bold">PUBLICACIONES RECIENTES</h3>{feed.map((item) => <NovedadRow key={item.id} item={item} isNew={false} dead={false} onOpen={() => { void openItem(item.slug).then((ok) => { if (ok) setOpen(false); else setNotice(true) }) }}/>)}</section>}
      </div>
    </DashPopup>}
  </section>
}

function ErrorLine({ onRetry }: { onRetry: () => void }) {
  return <div className="flex items-center gap-3"><p className="font-mono text-d13">No se pudieron cargar las franjas.</p><button type="button" onClick={onRetry} className={`min-h-11 font-mono text-d11 underline ${FOCUS_RING}`}>REINTENTAR</button></div>
}
