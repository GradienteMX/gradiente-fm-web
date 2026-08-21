'use client'

// ── NOVEDADES — explicit follows, mechanical feed (FINAL_SPEC §3.5) ─────────
//
// Follows are EXPLICIT {kind:'partner'|'genre', key} choices in localStorage
// (lib/dashboard/localState — private-class, per-uid). The widget WRITES
// follows through localState (addFollow/removeFollow); the provider's
// `follows` mirror updates through its subscription, and the feed is a pure
// mechanical lens (filterByFollows) over the provider's global `novedades`
// pool — no scoring, no weights, no «recomendado para ti», and the affinity
// table is never imported (grep gate).
//
// The empty state IS the picker: with zero follows the widget boots in the
// grid's compact teaching row, and that row carries the real chip rail
// inline — one tap = followed (CUE/STAMP), feed materializes from the
// already-fetched pool the moment a follow matches. Follow ≤2 clicks
// including discovery (the chips ARE the discovery). Once populated, the
// «SIGUIENDO: N» header chip re-opens the same picker inline.
//
// «N NUEVOS» derives from the single lastSeenActivity watermark (state, not
// a second ledger) — the same key ACTIVIDAD advances; this widget only reads.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { useOpenItem } from '@/lib/dashboard/openItem'
import {
  countNewSince,
  filterByFollows,
  type PartnerOption,
} from '@/lib/dashboard/novedades'
import {
  addFollow,
  readLastSeenActivity,
  removeFollow,
  subscribeLastSeenActivity,
  type DashboardFollow,
} from '@/lib/dashboard/localState'
import { categoryColorOnLight } from '@/lib/dashboard/palette'
import { getRootGenres } from '@/lib/genres'
import { SmartImage } from '@/components/SmartImage'
import type { ContentItem } from '@/lib/types'

// ── Watermark (read-only here — ACTIVIDAD owns advancement) ─────────────────

function useActivityWatermark(uid: string | null): string | null {
  const getSnapshot = useCallback(
    () => (uid ? readLastSeenActivity(uid) : null),
    [uid],
  )
  return useSyncExternalStore(subscribeLastSeenActivity, getSnapshot, () => null)
}

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

// The picker — real partner catalogue + real genre roots, nothing invented.
// `rail` = one horizontal scroll strip (the compact teaching row);
// `panel` = wrapped sections inside the full widget body.
function FollowPicker({
  layout,
  uid,
  follows,
  partnerOptions,
}: {
  layout: 'rail' | 'panel'
  uid: string | null
  follows: readonly DashboardFollow[]
  partnerOptions: readonly PartnerOption[]
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

  const partnerChips = partnerOptions.map((p) => (
    <FollowChip
      key={`partner:${p.id}`}
      label={p.title}
      imageUrl={p.imageUrl}
      active={isActive({ kind: 'partner', key: p.id })}
      onToggle={() => toggle({ kind: 'partner', key: p.id })}
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
        {partnerChips}
        {genreChips}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      {partnerOptions.length > 0 && (
        <section>
          <h4 className="mb-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
            {'// COLECTIVOS Y ESPACIOS'}
          </h4>
          <div className="flex flex-wrap gap-2">{partnerChips}</div>
        </section>
      )}
      <section>
        <h4 className="mb-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          {'// GÉNEROS'}
        </h4>
        <div className="flex flex-wrap gap-2">{genreChips}</div>
      </section>
    </div>
  )
}

// ── Feed row ────────────────────────────────────────────────────────────────

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
      className={`group flex min-h-11 w-full items-center gap-3 border-b border-ink py-2 text-left last:border-b-0 ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0"
        style={{ backgroundColor: categoryColorOnLight(item.type) }}
      />
      <span className="min-w-0 flex-1 truncate text-d15 text-ink group-hover:underline">
        {item.title}
      </span>
      {isNew && (
        <span
          aria-label="Nuevo desde tu última visita"
          className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid"
        />
      )}
      <span className="shrink-0 font-mono text-d13 tabular-nums text-ink-faint">
        {dead ? (
          <span className="font-bold text-ink">NO DISPONIBLE</span>
        ) : (
          timeAgoShort(item.publishedAt)
        )}
      </span>
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function NovedadesWidget({ compact }: DashboardWidgetProps) {
  const { currentUser } = useAuth()
  const uid = currentUser?.id ?? null
  const ctx = useDashboardData()
  const openItem = useOpenItem()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deadSlug, setDeadSlug] = useState<string | null>(null)
  const watermark = useActivityWatermark(uid)

  const feed = useMemo(
    () => filterByFollows(ctx.novedades, ctx.follows),
    [ctx.novedades, ctx.follows],
  )
  const newCount = useMemo(() => countNewSince(feed, watermark), [feed, watermark])

  const loading = !ctx.loaded.novedades && !ctx.errors.novedades
  const failed = ctx.errors.novedades === true

  const handleOpen = useCallback(
    async (slug: string) => {
      const ok = await openItem(slug)
      if (!ok) setDeadSlug(slug)
    },
    [openItem],
  )

  const retry = useCallback(() => void ctx.afterMutation(), [ctx])

  // ── Compact teaching row — the row IS the picker (§3.5 + §2.6) ────────────
  if (compact) {
    return (
      <WidgetFrame title="NOVEDADES" compact loading={loading}>
        {failed ? (
          <ErrorLine onRetry={retry} />
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <p className="shrink-0 text-d15 text-ink">
              {ctx.follows.length === 0
                ? 'Sigue colectivos y géneros:'
                : 'Tus señales no han publicado en 30 días.'}
            </p>
            <FollowPicker
              layout="rail"
              uid={uid}
              follows={ctx.follows}
              partnerOptions={ctx.partnerOptions}
            />
          </div>
        )}
      </WidgetFrame>
    )
  }

  // ── Full widget ───────────────────────────────────────────────────────────
  const showPicker = pickerOpen || (!loading && !failed && feed.length === 0)

  return (
    <WidgetFrame
      title="NOVEDADES"
      count={newCount > 0 ? newCount : undefined}
      accent
      loading={loading}
      action={{
        label: showPicker && pickerOpen ? 'CERRAR' : `SIGUIENDO: ${ctx.follows.length}`,
        onClick: () => setPickerOpen((open) => !open),
        cue: 'latch',
      }}
    >
      {failed ? (
        <ErrorLine onRetry={retry} />
      ) : showPicker ? (
        <FollowPicker
          layout="panel"
          uid={uid}
          follows={ctx.follows}
          partnerOptions={ctx.partnerOptions}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {feed.map((item) => (
              <NovedadRow
                key={item.id}
                item={item}
                isNew={watermark === null || item.publishedAt > watermark}
                dead={deadSlug === item.slug}
                onOpen={() => void handleOpen(item.slug)}
              />
            ))}
          </div>
          <p className="pt-2 font-mono text-d11 tracking-wide text-ink-soft">
            {'// seguimiento entre dispositivos: futuro con nombre (user_follows).'}
          </p>
        </div>
      )}
    </WidgetFrame>
  )
}

// Honest failure state — designed copy + a working retry, never fake rows.
function ErrorLine({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <p className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
        {'// SEÑAL INTERRUMPIDA'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        data-cue="tick"
        className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
      >
        REINTENTAR
      </button>
    </div>
  )
}
