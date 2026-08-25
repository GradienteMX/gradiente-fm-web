'use client'

// ── CULTIVAR — the publications carousel (revision-2 point 8) ───────────────
//
// The JARDÍN DE SEÑAL (three.js garden) is retired: this widget now shows the
// user's ACTUAL publications, one at a time, as a clean carousel — cover,
// title, type, HL bracket, the CURRENT HP number (the scalar is legal here:
// this is the owner's own panel), and the COSECHAR seal carrying the live
// echo estimate. ‹ › walk the set; EXPANDIR opens a popup overlay with every
// publication as a row. Trophies moved to the identity spine (point 9).
//
// THE R1 HARVEST RECIPE is ported VERBATIM from the retired PublishedRail:
// HarvestConfirmModal imported byte-untouched; on success the broken-seal
// item is re-upserted SYNCHRONOUSLY in the modal's call stack
// (setPublishedItemLocal) so no frame renders without the row; a close
// without success runs the one read-only 409 reconcile. The 0.4 echo factor
// and 1.7 decay multiplier mirror harvest_item() in SQL (migration 0022) and
// HarvestConfirmModal — change all three in lockstep.
//
// Ranking: currentHp desc off the provider slice, re-ranked on the 60s
// heartbeat (lastTickAt) — no timers of our own. Display objects prefer the
// per-id cache version (the R1 patch lands there).

import { useCallback, useMemo, useRef, useState } from 'react'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { HarvestConfirmModal } from '@/components/dashboard/HarvestConfirmModal'
import { DashPopup } from '@/components/dashboard/DashPopup'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { dashWidgetDomId, scrollToDashWidget } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { getPublishedItemSync, setPublishedItemLocal } from '@/lib/publishedItemsCache'
import { ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import { createClient } from '@/lib/supabase/client'
import { currentHp } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import { typeCode, typeDisplayLabel } from '@/lib/dashboard/palette'
import type { ContentItem } from '@/lib/types'
import { TypeDot } from './cultivar/CrearZone'

// Mirrors HarvestConfirmModal's ECHO_FACTOR (0.4) — the modal recomputes the
// real echo server-side; this is the same preview it shows.
const ECHO_FACTOR = 0.4
const FRESH_HARVEST_WINDOW_MS = 5 * 60_000

interface PubRow {
  item: ContentItem
  hp: number
}

// ── Harvest affordance (shared by the carousel card + popup rows) ───────────

function HarvestControl({
  item,
  hp,
  onHarvest,
}: {
  item: ContentItem
  hp: number
  onHarvest: (item: ContentItem) => void
}) {
  const harvested = !!item.harvestedAt
  if (harvested) {
    const fresh =
      Date.now() - new Date(item.harvestedAt as string).getTime() <
      FRESH_HARVEST_WINDOW_MS
    return (
      <span
        data-cue="seal-break"
        title={fresh ? 'COSECHADO · LLEGA CON EL PRÓXIMO CICLO (≤5 MIN)' : undefined}
        className="font-mono text-d13 tabular-nums text-ink"
      >
        ◈ COSECHADO · ECO +{(item.harvestedAmount ?? 0).toFixed(1)}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onHarvest(item)}
      data-cue="seal-break"
      className={`flex min-h-11 shrink-0 items-center justify-center gap-2 border border-ink px-3 font-mono text-d13 font-bold tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
    >
      COSECHAR
      <span className="tabular-nums">+{(hp * ECHO_FACTOR).toFixed(1)}</span>
    </button>
  )
}

// ── The widget ──────────────────────────────────────────────────────────────

export function CultivarWidget({ size, compact }: DashboardWidgetProps) {
  const { published, afterMutation, lastTickAt, loaded } = useDashboardData()
  const openItem = useOpenItem()

  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)

  // Ranked rows — cache-patched display objects, slice-HP sort (a fresh
  // harvest flips the card in place instead of reshuffling mid-gesture).
  const rows = useMemo<PubRow[]>(() => {
    void lastTickAt // re-rank on the provider heartbeat
    const now = new Date()
    return published
      .map((slice) => {
        const item = getPublishedItemSync(slice.id) ?? slice
        return { item, hp: currentHp(item, now), sortHp: currentHp(slice, now) }
      })
      .sort((a, b) => b.sortHp - a.sortHp || a.item.id.localeCompare(b.item.id))
      .map(({ item, hp }) => ({ item, hp }))
  }, [published, lastTickAt])

  const clamped = rows.length === 0 ? 0 : Math.min(index, rows.length - 1)
  const current = rows[clamped] ?? null
  const step = useCallback(
    (dir: 1 | -1) => {
      setIndex((prev) => {
        if (rows.length === 0) return 0
        return (prev + dir + rows.length) % rows.length
      })
    },
    [rows.length],
  )

  // ── R1 harvest recipe (ported verbatim from PublishedRail) ────────────────
  const [harvestTarget, setHarvestTarget] = useState<ContentItem | null>(null)
  const harvestTargetRef = useRef<ContentItem | null>(null)
  const harvestedRef = useRef(false)

  const openHarvest = useCallback((item: ContentItem) => {
    harvestedRef.current = false
    harvestTargetRef.current = item
    setHarvestTarget(item)
  }, [])

  // SYNCHRONOUS in the modal's success call stack — re-inserts the
  // broken-seal item before React flushes (no flicker, no vanishing row).
  const onHarvested = useCallback((echo: number) => {
    const item = harvestTargetRef.current
    if (!item) return
    const nowIso = new Date().toISOString()
    setPublishedItemLocal({
      ...item,
      harvestedAt: nowIso,
      harvestedAmount: echo,
      hp: Math.max(0, currentHp(item) - echo),
      hpDecayMultiplier: 1.7,
      hpLastUpdatedAt: nowIso,
    })
    harvestedRef.current = true
  }, [])

  const onModalClose = useCallback(() => {
    const item = harvestTargetRef.current
    harvestTargetRef.current = null
    setHarvestTarget(null)
    if (harvestedRef.current) {
      harvestedRef.current = false
      void afterMutation()
      return
    }
    if (item) void reconcileHarvestState(item.id)
  }, [afterMutation])

  const goCrear = () => scrollToDashWidget('crear')

  // ── Compact teaching row ──────────────────────────────────────────────────
  if (compact) {
    return (
      <div id={dashWidgetDomId('cultivar')} className="h-full scroll-mt-14">
        <WidgetFrame
          title="CULTIVAR"
          compact
          loading={!loaded.published && published.length === 0}
          action={{ label: 'CREAR', onClick: goCrear }}
        >
          <p className="min-w-0 font-mono text-d13 text-ink-soft">
            Publica tu primera pieza y cultívala aquí.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  const tall = size.h >= 3

  return (
    <div id={dashWidgetDomId('cultivar')} className="h-full scroll-mt-14">
      <WidgetFrame
        title="CULTIVAR"
        count={rows.length > 0 ? rows.length : undefined}
        loading={!loaded.published && published.length === 0}
        action={
          rows.length > 0
            ? { label: 'EXPANDIR', onClick: () => setExpanded(true), cue: 'latch' }
            : undefined
        }
      >
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-start justify-center gap-2">
            <p className="font-mono text-d13 text-ink-soft">
              SIN PUBLICACIONES — publica tu primera pieza.
            </p>
            <button
              type="button"
              onClick={goCrear}
              data-cue="tick"
              className={`min-h-11 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
            >
              CREAR
            </button>
          </div>
        ) : (
          current && (
            <div className="flex h-full min-h-0 flex-col gap-3">
              {/* ── The card — one publication, whole. ──────────────────── */}
              <div className="flex min-h-0 flex-1 gap-4">
                {/* Cover — a printed photograph on cream; click = open. */}
                <button
                  type="button"
                  onClick={() => void openItem(current.item.slug)}
                  data-cue="tick"
                  aria-label={`Abrir ${current.item.title}`}
                  className={`relative h-full ${
                    tall ? 'w-40 md:w-52' : 'w-24'
                  } shrink-0 overflow-hidden border border-ink bg-panel ${FOCUS_RING}`}
                >
                  {current.item.imageUrl ? (
                    <SmartImage
                      src={current.item.imageUrl}
                      alt=""
                      className="object-cover"
                      sizes="208px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-mono text-d13 uppercase tracking-widest text-panel-text">
                      {typeCode(current.item.type)}
                    </span>
                  )}
                </button>

                {/* Dossier column */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                    <TypeDot type={current.item.type} />
                    {typeDisplayLabel(current.item.type)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void openItem(current.item.slug)}
                    data-cue="tick"
                    className={`line-clamp-2 text-left font-syne text-d18 font-bold leading-tight text-ink hover:underline ${FOCUS_RING}`}
                  >
                    {current.item.title}
                  </button>
                  {/* The owner's scalar — HP blue, tabular; bracket words beside. */}
                  <span className="flex items-baseline gap-3">
                    <span className="font-grotesk text-d28 font-bold tabular-nums text-hp">
                      {current.hp.toFixed(1)}
                      <span className="ml-1.5 font-mono text-d13 font-bold tracking-widest">
                        HP
                      </span>
                    </span>
                    <span className="font-mono text-d13 font-bold tracking-widest text-ink">
                      ◇ {hlBracket(current.hp)}
                    </span>
                  </span>
                  <div className="mt-auto flex items-center pt-1">
                    <HarvestControl
                      item={current.item}
                      hp={current.hp}
                      onHarvest={openHarvest}
                    />
                  </div>
                </div>
              </div>

              {/* ── Carousel transport — ‹ › + honest position readout. ─── */}
              <div className="flex shrink-0 items-center gap-2 border-t border-ink pt-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Anterior"
                  data-cue="tick"
                  className={`flex h-9 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Siguiente"
                  data-cue="tick"
                  className={`flex h-9 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  ›
                </button>
                <span className="font-mono text-d13 tabular-nums text-ink-soft">
                  {clamped + 1}/{rows.length}
                </span>
              </div>
            </div>
          )
        )}
      </WidgetFrame>

      {/* ── EXPANDIR — every publication as a row (popup overlay). ────────── */}
      {expanded && (
        <DashPopup
          title="MIS PUBLICACIONES"
          count={rows.length}
          width="lg"
          onClose={() => setExpanded(false)}
        >
          <div className="flex flex-col">
            {rows.map(({ item, hp }, i) => (
              <div
                key={item.id}
                className="flex min-h-14 items-center gap-3 border-b border-ink py-2 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i)
                    setExpanded(false)
                    void openItem(item.slug)
                  }}
                  data-cue="tick"
                  aria-label={`Abrir ${item.title}`}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden border border-ink bg-panel ${FOCUS_RING}`}
                >
                  {item.imageUrl ? (
                    <SmartImage src={item.imageUrl} alt="" sizes="48px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-panel-text">
                      {typeCode(item.type)}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <TypeDot type={item.type} />
                    <span className="min-w-0 flex-1 truncate font-grotesk text-d15 font-medium text-ink">
                      {item.title}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-2 pl-4 font-mono text-d11 tracking-widest">
                    <span className="font-bold tabular-nums text-hp">{hp.toFixed(1)} HP</span>
                    <span className="text-ink">◇ {hlBracket(hp)}</span>
                  </span>
                </div>
                <HarvestControl item={item} hp={hp} onHarvest={openHarvest} />
              </div>
            ))}
          </div>
        </DashPopup>
      )}

      {/* R1: imported byte-untouched — ONE confirm, the friction IS the
          design. Mounted only while a seal is mid-gesture. */}
      {harvestTarget && (
        <HarvestConfirmModal
          item={harvestTarget}
          open
          onClose={onModalClose}
          onHarvested={onHarvested}
        />
      )}
    </div>
  )
}

// ── 409/staleness reconcile (read-only; see onModalClose) ───────────────────

async function reconcileHarvestState(itemId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_ROW_SELECT)
      .eq('id', itemId)
      .maybeSingle()
    if (error || !data) return
    setPublishedItemLocal(mapItemRowToContentItem(data))
  } catch {
    // Reconcile is best-effort — the next full published fetch is truth.
  }
}
