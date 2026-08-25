'use client'

// ── GUARDADOS — the saved collection, no facets (revision-2 point 12) ───────
//
// Iker: «sin categorías — que salga todo lo que no son [mixes] y ya». One
// gallery of EVERYTHING saved except mixes (those live in REPRODUCTOR now)
// — no facet chips, no saved-comments lens. Ordering stays truly
// most-recently-saved (user_saves.saved_at via the upgraded itemSavesCache
// Map; unknown timestamps sink to the end, newest-published first).
//
// QUITAR is always visible (never hover-only) and optimistic through the ONE
// HP-emitting path (lib/saves.ts toggleSavedItem); a 6s «DESHECHO ·
// RESTAURAR» tombstone holds the slot instead of a confirm.
//
// Sizes: default = fixed WHOLE-cover grid (2/4/6 across by stored width);
// «VER TODO» commits the widget to its {12,3} large state through
// ctx.commitLayout (the single layout write path) where the snap rail
// returns. Open = 1 click in place via lib/dashboard/openItem.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { FOCUS_RING, VerRow, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import type { WidgetSize } from '@/lib/dashboard/layout'
import { useOpenItem } from '@/lib/dashboard/openItem'
import {
  PANEL_SCRIM,
  PANEL_SCRIM_GRADIENT,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'
import { getSavedItemEntries } from '@/lib/itemSavesCache'
import { toggleSavedItem } from '@/lib/saves'
import { categoryColor } from '@/lib/utils'
import { SmartImage } from '@/components/SmartImage'
import type { ContentItem } from '@/lib/types'

const UNDO_MS = 6_000
const NOTICE_MS = 4_000

// GUARDADOS shows everything that is not a mix (REPRODUCTOR's material) —
// partner rows never enter collections.
function belongsHere(item: ContentItem): boolean {
  return item.type !== 'mix' && item.type !== 'partner'
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true })
  } catch {
    return ''
  }
}

// Grid columns by stored width; the portion is one whole row of covers.
function galleryColumns(size: WidgetSize): number {
  if (size.w >= 12) return 6
  if (size.w >= 7) return 4
  return 2
}

function isLargeState(size: WidgetSize): boolean {
  return size.w >= 12 && size.h >= 3
}

const CELL_SIZING = 'h-full min-h-36 md:min-h-0 w-full'
const RAIL_TILE_SIZING =
  'h-full min-h-36 md:min-h-0 w-[28%] min-w-[180px] max-w-[240px] shrink-0 snap-start'

// ── Cover card ──────────────────────────────────────────────────────────────

function SavedCard({
  item,
  savedAt,
  dense,
  sizing,
  onOpen,
  onRemove,
}: {
  item: ContentItem
  savedAt: string | null
  dense: boolean
  sizing: string
  onOpen: () => void
  onRemove: () => void
}) {
  const hasArt = !!item.imageUrl
  return (
    <article
      className={`relative flex flex-col overflow-hidden border border-ink bg-panel ${sizing}`}
    >
      {item.imageUrl && (
        <SmartImage
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          sizes="240px"
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        data-cue="tick"
        className={`relative flex min-h-0 w-full flex-1 flex-col justify-end overflow-hidden text-left ${FOCUS_RING}`}
      >
        <div
          className="flex w-full flex-col items-start gap-1 px-2 pb-1 pt-7"
          style={hasArt ? { background: PANEL_SCRIM_GRADIENT } : undefined}
        >
          <span className={`flex items-center gap-1.5${dense ? ' md:hidden' : ''}`}>
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0"
              style={{ backgroundColor: categoryColor(item.type) }}
            />
            <span className="font-mono text-d11 uppercase tracking-widest text-panel-text">
              {typeCode(item.type)} · {typeDisplayLabel(item.type)}
            </span>
          </span>
          <span
            className={`font-grotesk text-d15 font-medium text-panel-text ${
              dense ? 'line-clamp-2 md:line-clamp-1' : 'line-clamp-2'
            }`}
          >
            {item.title}
          </span>
        </div>
      </button>
      <div
        className="relative flex shrink-0 items-center justify-between gap-2 px-2 pb-1.5"
        style={hasArt ? { background: PANEL_SCRIM } : undefined}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {dense && (
            <>
              <span
                aria-hidden
                className="hidden h-2.5 w-2.5 shrink-0 md:block"
                style={{ backgroundColor: categoryColor(item.type) }}
              />
              <span className="hidden shrink-0 font-mono text-d11 uppercase tracking-widest text-panel-text md:block">
                {typeCode(item.type)}
              </span>
            </>
          )}
          <span className="truncate font-mono text-d11 text-panel-text">
            {timeAgo(savedAt)}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          data-cue="latch"
          className={`relative flex shrink-0 items-center border border-panel-text px-2 font-mono text-d13 uppercase tracking-widest text-panel-text before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] hover:bg-panel-text hover:text-panel ${
            dense ? 'h-7' : 'h-8'
          } ${FOCUS_RING}`}
        >
          QUITAR
        </button>
      </div>
    </article>
  )
}

function UndoCard({
  title,
  sizing,
  onRestore,
}: {
  title: string
  sizing: string
  onRestore: () => void
}) {
  return (
    <div
      className={`flex flex-col items-start justify-between border border-ink bg-paper p-2 ${sizing}`}
    >
      <span className="line-clamp-2 font-grotesk text-d13 text-ink-faint">{title}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-d13 uppercase tracking-widest text-ink">
          DESHECHO
        </span>
        <span aria-hidden className="font-mono text-d13 text-ink-faint">
          ·
        </span>
        <button
          type="button"
          onClick={onRestore}
          data-cue="stamp"
          className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline underline-offset-4 md:min-h-0 ${FOCUS_RING}`}
        >
          RESTAURAR
        </button>
      </div>
    </div>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

type RailEntry =
  | { kind: 'card'; item: ContentItem }
  | { kind: 'undo'; item: ContentItem }

export function GuardadosWidget({ size, compact }: DashboardWidgetProps) {
  const router = useRouter()
  const openItem = useOpenItem()
  const ctx = useDashboardData()
  const { saves, loaded } = ctx

  // True saved_at ordering; the non-mix lens (revision-2).
  const orderedItems = useMemo(() => {
    const entries = getSavedItemEntries()
    return saves
      .filter(belongsHere)
      .sort((a, b) => {
        const sa = entries.get(a.id) ?? null
        const sb = entries.get(b.id) ?? null
        if (sa && sb) return sb.localeCompare(sa)
        if (sa) return -1
        if (sb) return 1
        return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
      })
  }, [saves])

  const savedAtById = useMemo(() => {
    const entries = getSavedItemEntries()
    const map = new Map<string, string | null>()
    for (const item of orderedItems) map.set(item.id, entries.get(item.id) ?? null)
    return map
  }, [orderedItems])

  // 6s undo tombstones (in place of a confirm).
  const [removedItems, setRemovedItems] = useState<{ item: ContentItem; index: number }[]>([])
  const timersRef = useRef(new Map<string, number>())
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  const removeItem = useCallback((item: ContentItem, index: number) => {
    void toggleSavedItem(item.id)
    setRemovedItems((prev) => [
      ...prev.filter((r) => r.item.id !== item.id),
      { item, index },
    ])
    const timer = window.setTimeout(() => {
      setRemovedItems((prev) => prev.filter((r) => r.item.id !== item.id))
      timersRef.current.delete(item.id)
    }, UNDO_MS)
    timersRef.current.set(item.id, timer)
  }, [])

  const restoreItem = useCallback((item: ContentItem) => {
    const timer = timersRef.current.get(item.id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(item.id)
    }
    setRemovedItems((prev) => prev.filter((r) => r.item.id !== item.id))
    void toggleSavedItem(item.id)
  }, [])

  const railEntries = useMemo<RailEntry[]>(() => {
    const out: RailEntry[] = orderedItems.map((item) => ({ kind: 'card' as const, item }))
    for (const removed of removedItems) {
      if (!belongsHere(removed.item)) continue
      out.splice(Math.min(removed.index, out.length), 0, {
        kind: 'undo',
        item: removed.item,
      })
    }
    return out
  }, [orderedItems, removedItems])

  const total = orderedItems.length

  const large = isLargeState(size)
  const cols = galleryColumns(size)

  // «VER TODO» = an honest in-place expansion to the {12,3} large state
  // through the provider's single layout write path.
  const commitToLarge = useCallback(() => {
    const current = ctx.layoutMeta
    ctx.commitLayout({
      ...current,
      layout: current.layout.map((entry) =>
        entry.id === 'guardados' ? { ...entry, w: 12, h: 3 } : entry,
      ),
    })
  }, [ctx])

  const activeOverflow = railEntries.length > cols

  const [notice, setNotice] = useState(false)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(false), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const openSaved = useCallback(
    (slug: string) => {
      void openItem(slug).then((ok) => {
        if (!ok) setNotice(true)
      })
    },
    [openItem],
  )

  const isLoading = loaded.saves !== true && total === 0 && removedItems.length === 0
  const isEmpty = !isLoading && total === 0 && removedItems.length === 0

  if (compact) {
    return (
      <div id={dashWidgetDomId('guardados')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="GUARDADOS"
          compact
          loading={isLoading}
          action={{ label: 'IR AL INICIO →', onClick: () => router.push('/') }}
        >
          <p className="font-mono text-d13 text-ink-soft">
            NADA GUARDADO — toca ★ para guardar.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  const headerAction =
    !isEmpty && !large && size.h <= 2 && activeOverflow
      ? { label: 'VER TODO', onClick: commitToLarge }
      : undefined

  return (
    <div id={dashWidgetDomId('guardados')} className="h-full scroll-mt-14">
      <WidgetFrame
        title="GUARDADOS"
        count={total > 0 ? total : undefined}
        loading={isLoading}
        action={headerAction}
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-start justify-center gap-2">
            <p className="font-mono text-d13 text-ink-soft">
              NADA GUARDADO — toca ★ en cualquier overlay para guardarlo aquí.
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              data-cue="tick"
              className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
            >
              IR AL INICIO →
            </button>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3">
            {notice && (
              <p className="shrink-0 font-grotesk text-d13 text-ink">
                NO DISPONIBLE — ese contenido ya no está publicado.
              </p>
            )}

            {large ? (
              // {12,3} LARGE state — the snap rail (chosen depth).
              <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain">
                {railEntries.map((entry, index) =>
                  entry.kind === 'undo' ? (
                    <UndoCard
                      key={`undo:${entry.item.id}`}
                      title={entry.item.title}
                      sizing={RAIL_TILE_SIZING}
                      onRestore={() => restoreItem(entry.item)}
                    />
                  ) : (
                    <SavedCard
                      key={entry.item.id}
                      item={entry.item}
                      savedAt={savedAtById.get(entry.item.id) ?? null}
                      dense={false}
                      sizing={RAIL_TILE_SIZING}
                      onOpen={() => openSaved(entry.item.slug)}
                      onRemove={() => removeItem(entry.item, index)}
                    />
                  ),
                )}
              </div>
            ) : (
              <>
                <div
                  className={`grid min-h-0 flex-1 grid-cols-2 gap-3 ${
                    cols === 6 ? 'md:grid-cols-6' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-2'
                  }`}
                >
                  {railEntries.slice(0, cols).map((entry, index) =>
                    entry.kind === 'undo' ? (
                      <UndoCard
                        key={`undo:${entry.item.id}`}
                        title={entry.item.title}
                        sizing={CELL_SIZING}
                        onRestore={() => restoreItem(entry.item)}
                      />
                    ) : (
                      <SavedCard
                        key={entry.item.id}
                        item={entry.item}
                        savedAt={savedAtById.get(entry.item.id) ?? null}
                        dense={size.h <= 2}
                        sizing={CELL_SIZING}
                        onOpen={() => openSaved(entry.item.slug)}
                        onRemove={() => removeItem(entry.item, index)}
                      />
                    ),
                  )}
                </div>
                {size.h >= 3 && activeOverflow && (
                  <VerRow label="VER TODO" count={total} onClick={commitToLarge} />
                )}
              </>
            )}
          </div>
        )}
      </WidgetFrame>
    </div>
  )
}
