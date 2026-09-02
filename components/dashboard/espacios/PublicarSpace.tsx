'use client'

// ── PUBLICAR — the authoring hub (PLIEGO fase D) ────────────────────────────
//
// The second of the four ESPACIOS. PANEL is a widget grid you arrange;
// PUBLICAR is a printed sheet you work on: everything you have written, in
// one reverse-chronological column, plus the one acid block that starts a
// new piece and the CULTIVAR strip that lets you cash a piece in.
//
// This space AUTHORS NOTHING ITSELF. Every chip and every EDITAR ejects to
// the existing compose pliego through `useComposeNav` (`?type=&edit=` on the
// current surface) — there is no second editor to learn, and no second
// editor to keep in sync. Every VER opens the item overlay in place via the
// `?item=<slug>` URL contract; the reader never leaves /dashboard, and the
// href carries `?espacio=publicar` so closing the overlay lands you back on
// THIS sheet rather than dumping you on PANEL.
//
// Laws this sheet honours, in the order it would be tempting to break them:
//   · TWO STATES, EXACTLY. BORRADOR and PUBLICADO. There is no scheduler, no
//     visibility selector and no archive in this system, so none of them are
//     drawn here — the MarginNote at the foot says so out loud.
//   · NO ENGAGEMENT ANYWHERE. No views, no plays, no popularity, no numeric
//     vibe. The only number on the sheet is the owner's own HP scalar.
//   · HP IS PRIVATE AND OWN-ONLY. It appears once, in `text-hp`, on the
//     author's own publication, exactly as CULTIVAR prints it on the panel.
//   · HONEST STATES. EmptyLine says what is absent, ErrorLine says what
//     failed, ShimmerLine is the only load motion — never a spinner.
//   · ACID IS A FILL. One AcidBlock, ink on top, and nowhere else.
//
// THE HARVEST RECIPE IS PORTED VERBATIM from CultivarWidget (which itself
// ported it from PublishedRail): the same HarvestConfirmModal component, the
// same SYNCHRONOUS broken-seal re-upsert inside the modal's success call
// stack (so no frame renders without the row), the same read-only 409
// reconcile on a close-without-success, the same 0.4 echo factor and 1.7
// decay multiplier that mirror harvest_item() in SQL (migration 0022).
// COSECHAR moves real user HP — if this drifts from CultivarWidget or from
// the modal, it corrupts balances. Change all three in lockstep.

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { HarvestConfirmModal } from '@/components/dashboard/HarvestConfirmModal'
import {
  COMPOSE_TYPES,
  TypeChip,
  TypeDot,
  isComposeType,
  useComposeNav,
} from '@/components/dashboard/widgets/cultivar/CrearZone'
import {
  AcidBlock,
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Row,
  Sheet,
  SheetTable,
  ShimmerLine,
  SpaceHead,
  Td,
} from '@/components/dashboard/espacios/kit'
import { SmartImage } from '@/components/SmartImage'
import { currentHp } from '@/lib/curation'
import { ESPACIO_PARAM } from '@/lib/dashboard/espacios'
import { hlBracket } from '@/lib/dashboard/hl'
import { ITEM_ROW_SELECT, mapItemRowToContentItem } from '@/lib/dashboard/openItem'
import { categoryColorOnLight, typeCode, typeDisplayLabel } from '@/lib/dashboard/palette'
import { canCreateContent } from '@/lib/permissions'
import { getPublishedItemSync, setPublishedItemLocal } from '@/lib/publishedItemsCache'
import { createClient } from '@/lib/supabase/client'
// The 409/staleness reconcile is HP-critical, so it has exactly ONE copy:
// CultivarWidget owns it and both harvest surfaces import it.
import { reconcileHarvestState } from '@/components/dashboard/widgets/CultivarWidget'
import type { DraftItem } from '@/lib/drafts'
import type { ContentItem, ContentType } from '@/lib/types'

// Mirrors HarvestConfirmModal's ECHO_FACTOR (0.4) and CultivarWidget's copy
// of it — the modal recomputes the real echo server-side; this is the same
// preview it shows.
const ECHO_FACTOR = 0.4
const FRESH_HARVEST_WINDOW_MS = 5 * 60_000

const OBRA_HEAD = ['TÍTULO', 'TIPO', 'ESTADO', 'FECHA', 'ACCIONES'] as const

// ── Small honest helpers ────────────────────────────────────────────────────

/** Epoch ms, 0 when the stamp is missing or unparseable (never NaN in a sort). */
function tsOf(iso: string | undefined | null): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** Drafts read as a live thing: «HACE 2 H». */
function agoLabel(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return `HACE ${formatDistanceToNowStrict(parseISO(iso), { locale: es }).toUpperCase()}`
  } catch {
    return '—'
  }
}

/** Publications read as a record: an absolute short date. */
function dateLabel(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: es }).toUpperCase()
  } catch {
    return '—'
  }
}

/**
 * The item overlay contract. `?item=<slug>` is resolved in place by
 * OverlayRouter (warm cache — the provider recordItems()-primes every slice)
 * and by DashOverlayHost on a cold deep link. `?espacio=publicar` rides along
 * so the sheet under the overlay is still this one.
 */
function itemHref(slug: string): string {
  return `/dashboard?${ESPACIO_PARAM}=publicar&item=${encodeURIComponent(slug)}`
}

// ── Row model — the merged «En curso» column ────────────────────────────────

type ObraState = 'draft' | 'published'

interface ObraRow {
  key: string
  id: string
  slug?: string
  title: string
  type: ContentType
  state: ObraState
  at: number
  atIso: string
}

// ── The space ───────────────────────────────────────────────────────────────

export function PublicarSpace() {
  const { currentUser } = useAuth()
  const { drafts, published, loaded, errors, afterMutation, lastTickAt } =
    useDashboardData()
  const composeNav = useComposeNav()

  // ── Gate layer 1: which types this account may compose at all. (Layer 2
  // stays the `?type=` URL guard in app/dashboard/page.tsx.)
  const allowed = COMPOSE_TYPES.filter((t) => canCreateContent(currentUser, t))

  // Real DB drafts only — the same filter CrearWidget applies, newest edit
  // first (the session-published legacy store never appears here).
  const draftRows = useMemo<DraftItem[]>(
    () =>
      drafts
        .filter((d) => d._draftState === 'draft')
        .sort((a, b) => tsOf(b._updatedAt) - tsOf(a._updatedAt)),
    [drafts],
  )

  const obra = useMemo<ObraRow[]>(() => {
    const rows: ObraRow[] = [
      ...draftRows.map((d) => ({
        key: `d:${d.id}`,
        id: d.id,
        title: d.title || 'Sin título',
        type: d.type,
        state: 'draft' as const,
        at: tsOf(d._updatedAt),
        atIso: d._updatedAt,
      })),
      ...published.map((p) => ({
        key: `p:${p.id}`,
        id: p.id,
        slug: p.slug,
        title: p.title || 'Sin título',
        type: p.type,
        state: 'published' as const,
        at: tsOf(p.publishedAt),
        atIso: p.publishedAt,
      })),
    ]
    return rows.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key))
  }, [draftRows, published])

  const draftsFailed = !!errors.drafts
  const publishedFailed = !!errors.published
  const bothFailed = draftsFailed && publishedFailed
  const settling = (!loaded.drafts || !loaded.published) && obra.length === 0

  // ── CULTIVAR ranking — the CultivarWidget recipe, unchanged: display
  // objects prefer the per-id cache version (the harvest patch lands there),
  // the sort rides the provider slice so a fresh harvest flips the card in
  // place instead of reshuffling mid-gesture, re-ranked on the 60s heartbeat.
  const pubRows = useMemo(() => {
    void lastTickAt
    const now = new Date()
    return published
      .map((slice) => {
        const item = getPublishedItemSync(slice.id) ?? slice
        return { item, hp: currentHp(item, now), sortHp: currentHp(slice, now) }
      })
      .sort((a, b) => b.sortHp - a.sortHp || a.item.id.localeCompare(b.item.id))
      .map(({ item, hp }) => ({ item, hp }))
  }, [published, lastTickAt])

  const [index, setIndex] = useState(0)
  const clamped = pubRows.length === 0 ? 0 : Math.min(index, pubRows.length - 1)
  const currentPub = pubRows[clamped] ?? null
  const step = useCallback(
    (dir: 1 | -1) => {
      setIndex((prev) => {
        if (pubRows.length === 0) return 0
        return (prev + dir + pubRows.length) % pubRows.length
      })
    },
    [pubRows.length],
  )

  // ── R1 harvest recipe — ported verbatim from CultivarWidget ───────────────
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

  const resume = (row: { id: string; type: ContentType }) => {
    if (isComposeType(row.type)) composeNav(row.type, row.id)
  }

  return (
    <div className="flex flex-col gap-6">
      <SpaceHead
        title="Publicar"
        eyebrow="LO QUE ESCRIBES Y LO QUE YA SALIÓ"
        chips={
          <>
            <Chip>BORRADORES · {draftRows.length}</Chip>
            <Chip filled>PUBLICADAS · {published.length}</Chip>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1 · CREAR NUEVO — the space's ONE acid block, ink on top. */}
          {allowed.length > 0 ? (
            <AcidBlock title="Crear nuevo" note="UNA PIEZA, UN CLIC · SE GUARDA SOLO">
              {allowed.map((t) => (
                <TypeChip key={t} type={t} onPick={composeNav} />
              ))}
            </AcidBlock>
          ) : (
            // No acid celebration for a surface the role cannot use — the
            // honest permissions copy instead (one voice with CREAR NUEVO).
            <Sheet title="Crear nuevo" note="TU ROL NO COMPONE">
              <p className="font-grotesk text-d15 leading-snug text-ink">
                Tu rol no compone contenido publicable. Los lectores leen, comentan y
                participan en el foro; la composición editorial está reservada a
                redacción. Un admin puede ajustar tu rol.
              </p>
            </Sheet>
          )}

          {/* 2 · EN CURSO — drafts and publications, one column, no fictions. */}
          <Sheet
            title="En curso"
            note="BORRADOR Y PUBLICADO — SIN ESTADOS INVENTADOS"
            padded={false}
          >
            {bothFailed ? (
              <ErrorLine>NO SE PUDO LEER TU OBRA — NI BORRADORES NI PUBLICADAS.</ErrorLine>
            ) : (
              <>
                {settling ? (
                  <ShimmerLine />
                ) : obra.length === 0 ? (
                  <EmptyLine>SIN PIEZAS — NI UN BORRADOR, NI UNA PUBLICACIÓN.</EmptyLine>
                ) : (
                  <SheetTable head={OBRA_HEAD}>
                    {obra.map((row) => (
                      <tr key={row.key}>
                        <Td mono={false}>
                          <span className="line-clamp-2 font-medium">{row.title}</span>
                        </Td>
                        <Td>
                          <Chip swatch={categoryColorOnLight(row.type)}>
                            {typeDisplayLabel(row.type)}
                          </Chip>
                        </Td>
                        <Td>
                          {row.state === 'draft' ? (
                            <Chip>BORRADOR</Chip>
                          ) : (
                            <Chip filled>PUBLICADO</Chip>
                          )}
                        </Td>
                        <Td>
                          <span className="tabular-nums text-ink-faint">
                            {row.state === 'draft'
                              ? agoLabel(row.atIso)
                              : dateLabel(row.atIso)}
                          </span>
                        </Td>
                        <Td right>
                          <span className="flex justify-end">
                            {row.state === 'draft' ? (
                              isComposeType(row.type) ? (
                                <InkButton onClick={() => resume(row)}>EDITAR</InkButton>
                              ) : (
                                // A draft of a type this build cannot compose:
                                // say so, never a dead button.
                                <span className="font-mono text-d13 text-ink-faint">
                                  SIN EDITOR
                                </span>
                              )
                            ) : row.slug ? (
                              <InkButton href={itemHref(row.slug)}>VER</InkButton>
                            ) : (
                              <span className="font-mono text-d13 text-ink-faint">—</span>
                            )}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </SheetTable>
                )}
                {draftsFailed && !bothFailed && (
                  <ErrorLine>FALTAN TUS BORRADORES — NO SE PUDIERON LEER.</ErrorLine>
                )}
                {publishedFailed && !bothFailed && (
                  <ErrorLine>FALTAN TUS PUBLICADAS — NO SE PUDIERON LEER.</ErrorLine>
                )}
              </>
            )}
          </Sheet>

          {/* 3 · CULTIVAR — the same gesture as the panel's widget, verbatim. */}
          <Sheet title="Cultivar" note="LA VIDA DE UNA PIEZA · Y CUÁNDO COBRARLA">
            {publishedFailed ? (
              <ErrorLine>NO SE PUDIERON LEER TUS PUBLICACIONES.</ErrorLine>
            ) : !loaded.published && published.length === 0 ? (
              <ShimmerLine />
            ) : !currentPub ? (
              <EmptyLine>SIN PUBLICACIONES — TODAVÍA NO HAY NADA QUE COSECHAR.</EmptyLine>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={itemHref(currentPub.item.slug)}
                    data-cue="tick"
                    aria-label={`Abrir ${currentPub.item.title}`}
                    className={`relative h-40 w-full shrink-0 overflow-hidden border border-ink bg-panel sm:h-32 sm:w-32 ${FOCUS_RING}`}
                  >
                    {currentPub.item.imageUrl ? (
                      <SmartImage
                        src={currentPub.item.imageUrl}
                        alt=""
                        className="object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-mono text-d13 uppercase tracking-widest text-panel-text">
                        {typeCode(currentPub.item.type)}
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip swatch={categoryColorOnLight(currentPub.item.type)}>
                        {typeDisplayLabel(currentPub.item.type)}
                      </Chip>
                    </span>

                    <Link
                      href={itemHref(currentPub.item.slug)}
                      data-cue="tick"
                      className={`line-clamp-2 font-syne text-d18 font-extrabold leading-tight text-ink hover:underline ${FOCUS_RING}`}
                    >
                      {currentPub.item.title}
                    </Link>

                    {/* The explanation, in the honest register: what the
                        gesture takes, what it gives, and what it costs. */}
                    <p className="font-grotesk text-d15 leading-snug text-ink-soft">
                      Cosechar convierte parte de la vida que le queda a esta pieza en
                      eco para ti. Se hace una sola vez, y desde ese momento la pieza se
                      apaga más rápido.
                    </p>

                    {/* The owner's own scalar — the sheet's only number. */}
                    <span className="flex flex-wrap items-baseline gap-3">
                      <span className="font-grotesk text-d28 font-bold tabular-nums text-hp">
                        {currentPub.hp.toFixed(1)}
                        <span className="ml-1.5 font-mono text-d13 font-bold tracking-widest">
                          HP
                        </span>
                      </span>
                      <span className="font-mono text-d13 font-bold tracking-widest text-ink">
                        ◇ {hlBracket(currentPub.hp)}
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-2 pt-1">
                      {currentPub.item.harvestedAt ? (
                        <span
                          data-cue="seal-break"
                          title={
                            Date.now() -
                              new Date(currentPub.item.harvestedAt).getTime() <
                            FRESH_HARVEST_WINDOW_MS
                              ? 'COSECHADO · LLEGA CON EL PRÓXIMO CICLO (≤5 MIN)'
                              : undefined
                          }
                          className="font-mono text-d13 tabular-nums text-ink"
                        >
                          ◈ COSECHADO · ECO +
                          {(currentPub.item.harvestedAmount ?? 0).toFixed(1)}
                        </span>
                      ) : (
                        <InkButton
                          onClick={() => openHarvest(currentPub.item)}
                          cue="seal-break"
                        >
                          COSECHAR
                          <span className="tabular-nums">
                            +{(currentPub.hp * ECHO_FACTOR).toFixed(1)}
                          </span>
                        </InkButton>
                      )}
                    </span>
                  </div>
                </div>

                {/* Transport — every publication is reachable from here, so
                    the strip never hides a harvestable piece. */}
                {pubRows.length > 1 && (
                  <div className="flex items-center gap-2 border-t border-ink pt-3">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      aria-label="Publicación anterior"
                      data-cue="tick"
                      className={`flex h-11 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      aria-label="Publicación siguiente"
                      data-cue="tick"
                      className={`flex h-11 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                    >
                      ›
                    </button>
                    <span className="font-mono text-d13 tabular-nums text-ink-soft">
                      {clamped + 1}/{pubRows.length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Sheet>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          <Sheet title={`BORRADORES · ${draftRows.length}`} note="LO QUE SIGUE ABIERTO">
            {draftsFailed ? (
              <ErrorLine>NO SE PUDIERON LEER TUS BORRADORES.</ErrorLine>
            ) : !loaded.drafts && draftRows.length === 0 ? (
              <ShimmerLine />
            ) : draftRows.length === 0 ? (
              <EmptyLine>SIN BORRADORES.</EmptyLine>
            ) : (
              <div className="flex flex-col">
                {draftRows.map((d, i) => (
                  <Row key={d.id} last={i === draftRows.length - 1}>
                    <button
                      type="button"
                      onClick={() => resume(d)}
                      disabled={!isComposeType(d.type)}
                      data-cue="tick"
                      className={`group flex min-h-11 w-full min-w-0 flex-col justify-center gap-0.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <span className="flex w-full min-w-0 items-center gap-2">
                        <TypeDot type={d.type} />
                        <span className="min-w-0 flex-1 truncate font-grotesk text-d15 text-ink">
                          {d.title || 'Sin título'}
                        </span>
                      </span>
                      <span className="flex w-full items-baseline justify-between gap-2 pl-4">
                        <span className="truncate font-mono text-d11 tabular-nums text-ink-faint">
                          {agoLabel(d._updatedAt)}
                        </span>
                        <span className="shrink-0 font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 group-hover:underline">
                          {isComposeType(d.type) ? 'CONTINUAR' : 'SIN EDITOR'}
                        </span>
                      </span>
                    </button>
                  </Row>
                ))}
              </div>
            )}
          </Sheet>

          <Sheet title="El editor no cambia" note="MISMO PLIEGO DE SIEMPRE">
            <p className="font-grotesk text-d15 leading-snug text-ink">
              Las fichas de arriba abren el pliego de composición que ya conoces:
              secciones numeradas, una lista de completitud que te dice exactamente qué
              falta, guardado automático que solo dice «guardado» cuando de verdad
              guardó, y una sola confirmación al publicar. Este espacio ordena tu obra;
              no reemplaza el editor.
            </p>
          </Sheet>

          <MarginNote>
            SIN «PROGRAMAR» NI «VISIBILIDAD» — NO EXISTEN EN EL SISTEMA. LA HOJA SOLO
            PROMETE LO QUE HACE.
          </MarginNote>
        </div>
      </div>

      {/* R1: the modal is imported byte-untouched — ONE confirm, the friction
          IS the design. Mounted only while a seal is mid-gesture. */}
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

export default PublicarSpace
