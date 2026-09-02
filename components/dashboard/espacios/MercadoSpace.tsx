'use client'

// ── MERCADO — el escritorio de tienda de la franja (PLIEGO fase D) ─────────
//
// The fourth space. Its whole reason to exist: the listing-management
// backend has been complete and UNREACHABLE. PATCH and DELETE on
// /api/franjas/[id]/listings/[lid] had zero consumers — a seller could
// publish a piece and then never change its price, never mark it sold,
// never take it down. This space is the missing hand on those routes.
//
// THREE SUB-TABS
//   CATÁLOGO  the storefront desk: create, edit, re-price, re-state and
//             delete. ESTADO is an inline select, so «marcar vendido» is
//             one gesture — the single most common thing a seller does.
//   OFERTAS   the buyer threads over /api/listings/[lid]/comments, with the
//             widget's exact reply semantics (a seller reply inside a
//             thread clears its unanswered flag; the inbox route stays the
//             authority, so every reply ends in afterMutation('franja')).
//   AJUSTES   the self-service storefront switch, the currency label, and
//             the sale-contact fields.
//
// GOVERNANCE — marketplace_enabled is SELF-SERVICE. The franja team turns
// its own storefront on and off here (the PATCH /api/franjas/[id] whitelist
// already allowed it; only the UI was missing). The old admin approval
// queue retires from the dashboard; site admins keep an abuse kill-switch
// on /admin. The switch says exactly what it does — hides the storefront on
// /marketplace and the home rail — and states out loud that nothing is
// deleted by turning it off.
//
// HONESTY LAWS HELD HERE
//   · No orders, no checkout, no payments, no revenue: Gradiente processes
//     no money and an offer is a conversation. OFERTAS says so in its head.
//   · `views` is never surfaced — no counts, no trends, no popularity.
//   · Listing comments stay their own system, never merged into the
//     editorial comments model.
//   · Empty → EmptyLine, failure → ErrorLine, loading → ShimmerLine. Never
//     a spinner, never a fabricated row.
//   · Acid appears only as the AcidBlock fill and the completitud bar.
//     Destructive is sys-red-paper.
//   · Freshness is declared: the provider polls the franja slice on a
//     ≥5-min floor, so the sheet prints «SONDEO CADA 5 MIN».
//
// DIVERGENCE FROM THE MOCKUP (deliberate, schema-checked):
//   · NO inventory column and NO «alerta de inventario» panel —
//     marketplace_listings (0010 + 0032 + 0033) has no stock/quantity
//     column of any kind. The mockup invented it.
//   · NO «PUBLICADO / AGOTADO / BORRADOR» states — status is exactly
//     available | reserved | sold → DISPONIBLE · RESERVADO · VENDIDO.
//
// Every mutation in this file ends with `await afterMutation('franja')` —
// the project's one post-mutation recipe. No hand-rolled cache updates.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { SmartImage } from '@/components/SmartImage'
import {
  AcidBlock,
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Sheet,
  SheetTable,
  ShimmerLine,
  SpaceHead,
  SubTabs,
  Td,
  type SubTab,
} from '@/components/dashboard/espacios/kit'
import {
  CATEGORY_LABEL,
  ListingForm,
  STATUSES,
  STATUS_LABEL,
  draftFromListing,
  emptyListingDraft,
  formatPrice,
  listingChecklist,
  listingCompleteness,
  listingMissingRequired,
  newListingId,
  parsePrice,
  parseTags,
  type ListingDraft,
} from '@/components/dashboard/espacios/listingForm'
import type {
  ListingComment,
  MarketplaceListing,
  MarketplaceListingStatus,
} from '@/lib/types'

type MercadoTab = 'catalogo' | 'ofertas' | 'ajustes'

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string } | null

// The listing body the routes accept — built once, shared by POST and PATCH.
// Fields with no editor here (embeds, related_links) are simply not sent, so
// a PATCH leaves them untouched.
function listingPayload(draft: ListingDraft) {
  return {
    title: draft.title.trim(),
    category: draft.category,
    subcategory: draft.subcategory.trim() || null,
    price: parsePrice(draft.price),
    condition: draft.condition,
    status: draft.status,
    description: draft.description.trim() || null,
    tags: parseTags(draft.tags),
    shipping_mode: draft.shippingMode || null,
    images: draft.images,
    sale_url: draft.saleUrl.trim() || null,
    whatsapp: draft.whatsapp.trim() || null,
    contact_email: draft.contactEmail.trim() || null,
  }
}

function hasContactRoute(listing: MarketplaceListing): boolean {
  return Boolean(listing.whatsapp || listing.email || listing.saleUrl)
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: false })
  } catch {
    return '—'
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return (data.error ?? fallback).toUpperCase()
}

// ── The space ───────────────────────────────────────────────────────────────

export function MercadoSpace() {
  const { currentUser } = useAuth()
  const { franja, loaded, errors, afterMutation } = useDashboardData()

  const [tab, setTab] = useState<MercadoTab>('catalogo')
  const [editor, setEditor] = useState<EditorState>(null)
  const [draft, setDraft] = useState<ListingDraft>(emptyListingDraft())
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const uid = currentUser?.id ?? null
  const franjaId = franja?.id ?? null
  const currency = franja?.marketplaceCurrency ?? null

  const unanswered = useMemo(
    () => new Set(franja?.unansweredListingIds ?? []),
    [franja?.unansweredListingIds],
  )

  // OFERTAS first (a waiting buyer outranks recency), then newest.
  const listings = useMemo(() => {
    const rows = [...(franja?.listings ?? [])]
    rows.sort((a, b) => {
      const aOpen = unanswered.has(a.id) ? 1 : 0
      const bOpen = unanswered.has(b.id) ? 1 : 0
      if (aOpen !== bOpen) return bOpen - aOpen
      return (b.publishedAt || '').localeCompare(a.publishedAt || '')
    })
    return rows
  }, [franja?.listings, unanswered])

  const editingId = editor?.mode === 'edit' ? editor.id : null

  // A listing edited here can vanish under us (deleted in another tab, or
  // the slice refetched without it). Close rather than keep a phantom draft.
  useEffect(() => {
    if (!editingId) return
    if (!listings.some((l) => l.id === editingId)) setEditor(null)
  }, [editingId, listings])

  const checklist = useMemo(() => listingChecklist(draft), [draft])
  const completeness = useMemo(() => listingCompleteness(checklist), [checklist])
  const missingRequired = useMemo(() => listingMissingRequired(checklist), [checklist])

  const patchDraft = useCallback((patch: Partial<ListingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = useCallback(() => {
    setEditor({ mode: 'create' })
    setDraft(emptyListingDraft())
    setFormError(null)
    setConfirmDeleteId(null)
  }, [])

  const openEdit = useCallback((listing: MarketplaceListing) => {
    setEditor({ mode: 'edit', id: listing.id })
    setDraft(draftFromListing(listing))
    setFormError(null)
    setConfirmDeleteId(null)
  }, [])

  const closeEditor = useCallback(() => {
    setEditor(null)
    setFormError(null)
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const submitListing = useCallback(async () => {
    if (!franjaId || !editor || formBusy) return
    setFormBusy(true)
    setFormError(null)
    try {
      const body = listingPayload(draft)
      const res =
        editor.mode === 'create'
          ? await fetch(`/api/franjas/${encodeURIComponent(franjaId)}/listings`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: newListingId(franjaId), ...body }),
            })
          : await fetch(
              `/api/franjas/${encodeURIComponent(franjaId)}/listings/${encodeURIComponent(editor.id)}`,
              {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
              },
            )
      if (!res.ok) {
        // 409 = the hand-rolled mkl-<slug>-<rand> id collided. Surfaced, not
        // swallowed: the next attempt draws a new random tail.
        if (res.status === 409) {
          setFormError('ID DUPLICADO — VUELVE A PUBLICAR, SE GENERA OTRO')
          return
        }
        setFormError(await readError(res, 'NO SE PUDO GUARDAR'))
        return
      }
      setEditor(null)
      await afterMutation('franja')
    } catch {
      setFormError('NO SE PUDO GUARDAR')
    } finally {
      setFormBusy(false)
    }
  }, [afterMutation, draft, editor, formBusy, franjaId])

  const changeStatus = useCallback(
    async (listing: MarketplaceListing, status: MarketplaceListingStatus) => {
      if (!franjaId) return
      setRowBusyId(listing.id)
      setRowError(null)
      try {
        const res = await fetch(
          `/api/franjas/${encodeURIComponent(franjaId)}/listings/${encodeURIComponent(listing.id)}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status }),
          },
        )
        if (!res.ok) {
          setRowError({ id: listing.id, message: await readError(res, 'NO SE PUDO CAMBIAR') })
          return
        }
        await afterMutation('franja')
      } catch {
        setRowError({ id: listing.id, message: 'NO SE PUDO CAMBIAR' })
      } finally {
        setRowBusyId(null)
      }
    },
    [afterMutation, franjaId],
  )

  const deleteListing = useCallback(
    async (listing: MarketplaceListing) => {
      if (!franjaId) return
      setRowBusyId(listing.id)
      setRowError(null)
      try {
        const res = await fetch(
          `/api/franjas/${encodeURIComponent(franjaId)}/listings/${encodeURIComponent(listing.id)}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          setRowError({ id: listing.id, message: await readError(res, 'NO SE PUDO BORRAR') })
          return
        }
        setConfirmDeleteId(null)
        if (editingId === listing.id) setEditor(null)
        await afterMutation('franja')
      } catch {
        setRowError({ id: listing.id, message: 'NO SE PUDO BORRAR' })
      } finally {
        setRowBusyId(null)
      }
    },
    [afterMutation, editingId, franjaId],
  )

  // ── Head ──────────────────────────────────────────────────────────────────

  const head = (
    <SpaceHead
      eyebrow="ESPACIO"
      title={
        franja ? (
          <>
            MERCADO <span className="text-ink-faint">/</span> {franja.title}
          </>
        ) : (
          'MERCADO'
        )
      }
      chips={<Chip>CATÁLOGO DE FRANJA</Chip>}
      right={
        <span className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
          {'VENTA DE PRODUCTOS OFICIALES · GRADIENTE NO PROCESA PAGOS'}
        </span>
      }
    />
  )

  const foot = (
    <p className="pt-4 font-mono text-d11 uppercase tracking-widest text-ink-faint">
      {'CATÁLOGO Y OFERTAS · SONDEO CADA 5 MIN'}
    </p>
  )

  // ── Slice states — honest before anything else renders ───────────────────

  if (!franja) {
    return (
      <div className="flex w-full flex-col">
        {head}
        <div className="pt-4">
          {errors.franja ? (
            <div className="flex flex-col items-center gap-2">
              <ErrorLine>{'SEÑAL INTERRUMPIDA — EL MERCADO NO CARGÓ.'}</ErrorLine>
              <InkButton onClick={() => void afterMutation('franja')}>REINTENTAR</InkButton>
            </div>
          ) : !loaded.franja ? (
            <ShimmerLine />
          ) : (
            <EmptyLine>{'NO ADMINISTRAS NINGUNA FRANJA: NO HAY CATÁLOGO QUE ABRIR.'}</EmptyLine>
          )}
        </div>
        {foot}
      </div>
    )
  }

  const tabs: readonly SubTab<MercadoTab>[] = [
    { id: 'catalogo', label: 'CATÁLOGO', count: listings.length },
    {
      id: 'ofertas',
      label: 'OFERTAS',
      // The only true number the provider carries: listings whose newest
      // buyer thread is still waiting on the seller (the inbox route's own
      // computation). Never a fabricated «offers received» total.
      count: unanswered.size,
      dot: unanswered.size > 0,
    },
    { id: 'ajustes', label: 'AJUSTES' },
  ]

  return (
    <div className="flex w-full flex-col">
      {head}
      <SubTabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        ariaLabel="Secciones de mercado"
      />

      {tab === 'catalogo' && (
        <div className="flex flex-col gap-4 pt-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <AcidBlock
              title="Nueva publicación"
              note="UNA PIEZA A LA VENTA EN TU FRANJA"
            >
              <InkButton
                onClick={() => (editor?.mode === 'create' ? closeEditor() : openCreate())}
                cue="latch"
              >
                {editor?.mode === 'create' ? 'CERRAR' : 'PUBLICAR PIEZA'}
              </InkButton>
            </AcidBlock>

            {editor?.mode === 'create' && (
              <Sheet title="NUEVA PIEZA" note="SE PUBLICA AL GUARDAR">
                <ListingForm
                  mode="create"
                  draft={draft}
                  onChange={patchDraft}
                  currency={currency}
                  uid={uid}
                  busy={formBusy}
                  error={formError}
                  canSubmit={missingRequired.length === 0}
                  missing={missingRequired}
                  onSubmit={() => void submitListing()}
                  onCancel={closeEditor}
                />
              </Sheet>
            )}

            <Sheet
              title="CATÁLOGO"
              note={`${listings.length} ${listings.length === 1 ? 'PIEZA' : 'PIEZAS'}`}
              padded={false}
            >
              {listings.length === 0 ? (
                <EmptyLine>{'AÚN NO HAY PIEZAS PUBLICADAS EN ESTA FRANJA.'}</EmptyLine>
              ) : (
                <SheetTable
                  head={['PRODUCTO', 'CATEGORÍA', 'PRECIO', 'ESTADO', 'ACCIONES']}
                >
                  {listings.map((listing) => (
                    <Fragment key={listing.id}>
                      <tr>
                        <Td mono={false}>
                          <div className="flex items-center gap-3">
                            <span className="relative block h-11 w-11 shrink-0 overflow-hidden border border-ink bg-paper">
                              {listing.images[0] ? (
                                <SmartImage
                                  src={listing.images[0]}
                                  alt={listing.title}
                                  className="object-cover"
                                  sizes="44px"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold text-ink-faint">
                                  {CATEGORY_LABEL[listing.category]?.slice(0, 2) ?? '··'}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-grotesk text-d15 font-medium text-ink">
                                {listing.title}
                              </span>
                              <span className="block font-mono text-d11 uppercase tracking-widest text-ink-faint">
                                {listing.condition}
                                {listing.subcategory ? ` · ${listing.subcategory}` : ''}
                                {unanswered.has(listing.id) ? ' · OFERTA SIN RESPONDER' : ''}
                              </span>
                            </span>
                          </div>
                        </Td>
                        <Td>{CATEGORY_LABEL[listing.category] ?? listing.category}</Td>
                        <Td>
                          <span className="tabular-nums">
                            {formatPrice(listing.price, currency)}
                          </span>
                        </Td>
                        <Td>
                          <StatusPicker
                            listing={listing}
                            busy={rowBusyId === listing.id}
                            onChange={(status) => void changeStatus(listing, status)}
                          />
                        </Td>
                        <Td right>
                          <div className="flex flex-wrap justify-end gap-2">
                            <InkButton
                              cue="latch"
                              onClick={() =>
                                editingId === listing.id ? closeEditor() : openEdit(listing)
                              }
                            >
                              {editingId === listing.id ? 'CERRAR' : 'EDITAR'}
                            </InkButton>
                            <InkButton
                              tone="red"
                              onClick={() =>
                                setConfirmDeleteId((cur) =>
                                  cur === listing.id ? null : listing.id,
                                )
                              }
                            >
                              BORRAR
                            </InkButton>
                          </div>
                        </Td>
                      </tr>

                      {rowError?.id === listing.id && (
                        <tr>
                          <td
                            colSpan={5}
                            className="border-b border-ink/15 px-4 pb-3 text-right"
                          >
                            <span
                              role="status"
                              className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
                            >
                              ⚠ {rowError.message}
                            </span>
                          </td>
                        </tr>
                      )}

                      {confirmDeleteId === listing.id && (
                        <tr>
                          <td colSpan={5} className="border-b border-ink bg-paper px-4 py-4">
                            <DeleteConfirm
                              listing={listing}
                              busy={rowBusyId === listing.id}
                              onCancel={() => setConfirmDeleteId(null)}
                              onConfirm={() => void deleteListing(listing)}
                            />
                          </td>
                        </tr>
                      )}

                      {editingId === listing.id && (
                        <tr>
                          <td colSpan={5} className="border-b border-ink px-4 py-4">
                            <ListingForm
                              mode="edit"
                              draft={draft}
                              onChange={patchDraft}
                              currency={currency}
                              uid={uid}
                              busy={formBusy}
                              error={formError}
                              canSubmit={missingRequired.length === 0}
                              missing={missingRequired}
                              onSubmit={() => void submitListing()}
                              onCancel={closeEditor}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </SheetTable>
              )}
            </Sheet>
          </div>

          {/* Right rail — the completitud of the announcement being edited. */}
          <div className="lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
            <CompletitudRail
              open={editor !== null}
              checklist={checklist}
              completeness={completeness}
            />
          </div>
        </div>
      )}

      {tab === 'ofertas' && (
        <OfertasTab
          listings={listings}
          unanswered={unanswered}
          currency={currency}
          franjaSlug={franja.slug}
          onReplied={() => void afterMutation('franja')}
        />
      )}

      {tab === 'ajustes' && (
        <AjustesTab
          franjaId={franja.id}
          franjaSlug={franja.slug}
          enabled={franja.marketplaceEnabled}
          currency={currency}
          listings={listings}
          afterMutation={afterMutation}
        />
      )}

      {foot}
    </div>
  )
}

// ── ESTADO — the inline state picker (the one-gesture «marcar vendido») ────

function StatusPicker({
  listing,
  busy,
  onChange,
}: {
  listing: MarketplaceListing
  busy: boolean
  onChange: (status: MarketplaceListingStatus) => void
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">Estado de {listing.title}</span>
      <select
        value={listing.status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as MarketplaceListingStatus)}
        className={`min-h-[44px] cursor-pointer border border-ink bg-paper px-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── BORRAR — the confirmation says what the route actually does ────────────
//
// DELETE hard-deletes the row, and listing_comments.listing_id is
// `on delete cascade` (migration 0033), so the buyer threads go with it.
// Nothing about this is archiving, so the control is not called ARCHIVAR.

function DeleteConfirm({
  listing,
  busy,
  onCancel,
  onConfirm,
}: {
  listing: MarketplaceListing
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border border-sys-red-paper p-4">
      <p className="font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
        {'BORRAR NO ES ARCHIVAR'}
      </p>
      <p className="font-grotesk text-d15 text-ink">
        {'Se elimina «'}
        {listing.title}
        {'» de la base de datos, junto con los hilos de compradores de esa pieza. No hay papelera ni deshacer.'}
      </p>
      <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
        {'SI SOLO QUIERES DEJAR DE VENDERLA, MÁRCALA COMO VENDIDA O APAGA LA TIENDA EN AJUSTES: ESO NO BORRA NADA.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <InkButton tone="red" cue="stamp" onClick={onConfirm} disabled={busy}>
          {busy ? 'BORRANDO…' : 'BORRAR DEFINITIVAMENTE'}
        </InkButton>
        <InkButton onClick={onCancel} disabled={busy}>
          CANCELAR
        </InkButton>
      </div>
    </div>
  )
}

// ── Rail — «// COMPLETITUD DEL ANUNCIO» ────────────────────────────────────
//
// The compose pliego's rail pattern: ✓/○ rows that scroll to their field, an
// acid-on-ink progress bar, and an honest «FALTAN n CAMPOS». What it does
// NOT do is lie about the gate — only TÍTULO is required by the API, and the
// note says so instead of dressing the rest as obligations.

function CompletitudRail({
  open,
  checklist,
  completeness,
}: {
  open: boolean
  checklist: ReturnType<typeof listingChecklist>
  completeness: { done: number; total: number }
}) {
  const pending = completeness.total - completeness.done
  const pct =
    completeness.total === 0
      ? 0
      : Math.round((completeness.done / completeness.total) * 100)

  return (
    <section className="border border-ink bg-paper-raised">
      <h3 className="border-b border-ink px-4 py-1.5 font-mono text-d11 font-bold uppercase leading-8 tracking-widest text-ink-soft">
        {'// COMPLETITUD DEL ANUNCIO'}
      </h3>
      <div className="flex flex-col gap-3 p-4">
        {!open ? (
          <EmptyLine>{'NINGÚN ANUNCIO ABIERTO.'}</EmptyLine>
        ) : (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  {pending === 0 ? 'ANUNCIO COMPLETO' : `FALTAN ${pending} ${pending === 1 ? 'CAMPO' : 'CAMPOS'}`}
                </span>
                <span className="font-mono text-d13 tabular-nums tracking-widest text-ink">
                  {completeness.done}/{completeness.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Campos completos del anuncio"
                aria-valuemin={0}
                aria-valuemax={completeness.total}
                aria-valuenow={completeness.done}
                className="mt-1.5 h-2 w-full border border-ink bg-ink"
              >
                <div className="h-full bg-acid" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ul className="flex flex-col">
              {checklist.map((field) => (
                <li key={field.key}>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById(field.anchorId)?.scrollIntoView({ block: 'start' })
                    }
                    data-cue="tick"
                    aria-label={`Ir a ${field.label} — ${field.done ? 'completo' : 'pendiente'}`}
                    className={`flex min-h-11 w-full items-center gap-2.5 text-left font-mono text-d13 uppercase tracking-widest underline-offset-4 hover:underline lg:min-h-9 ${
                      field.done ? 'text-ink' : 'text-ink-soft'
                    } ${FOCUS_RING}`}
                  >
                    <span aria-hidden className="w-4 shrink-0 text-center">
                      {field.done ? '✓' : '○'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{field.label}</span>
                    {field.required && !field.done && (
                      <span className="shrink-0 font-bold text-sys-red-paper">FALTA</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <MarginNote>
              {'SOLO EL TÍTULO ES OBLIGATORIO. EL RESTO COMPLETA EL ANUNCIO: SIN PRECIO SE PUBLICA EN $0 Y SIN VÍA DE CONTACTO EL COMPRADOR SOLO PUEDE ESCRIBIR EN EL HILO.'}
            </MarginNote>
          </>
        )}
      </div>
    </section>
  )
}

// ── OFERTAS — the buyer-thread inbox ───────────────────────────────────────

function OfertasTab({
  listings,
  unanswered,
  currency,
  franjaSlug,
  onReplied,
}: {
  listings: MarketplaceListing[]
  unanswered: ReadonlySet<string>
  currency: string | null
  franjaSlug: string
  onReplied: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const waiting = listings.filter((l) => unanswered.has(l.id))
  const rows = showAll ? listings : waiting

  return (
    <div className="flex flex-col gap-4 pt-4">
      <MarginNote>
        {'HILOS DE COMPRADORES — NO «PEDIDOS»: AQUÍ NADIE COBRA TODAVÍA. LO QUE SE ACUERDE SE CIERRA FUERA DE GRADIENTE.'}
      </MarginNote>

      <Sheet
        title={showAll ? 'TODOS LOS HILOS' : 'ESPERAN RESPUESTA'}
        note={`${rows.length} ${rows.length === 1 ? 'PIEZA' : 'PIEZAS'}`}
        action={
          listings.length > 0 ? (
            <InkButton cue="latch" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? `SOLO SIN RESPONDER · ${waiting.length}`
                : `VER TODAS LAS PIEZAS · ${listings.length}`}
            </InkButton>
          ) : undefined
        }
        padded={false}
      >
        {listings.length === 0 ? (
          <EmptyLine>
            {'NO HAY PIEZAS PUBLICADAS: NADIE PUEDE ESCRIBIRTE TODAVÍA.'}
          </EmptyLine>
        ) : rows.length === 0 ? (
          <EmptyLine>{'NINGÚN COMPRADOR ESPERA RESPUESTA.'}</EmptyLine>
        ) : (
          <ul>
            {rows.map((listing) => {
              const open = openId === listing.id
              return (
                <li key={listing.id} className="border-b border-ink/15 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenId((cur) => (cur === listing.id ? null : listing.id))}
                    aria-expanded={open}
                    data-cue="tick"
                    className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left ${FOCUS_RING}`}
                  >
                    <span className="relative block h-11 w-11 shrink-0 overflow-hidden border border-ink bg-paper">
                      {listing.images[0] ? (
                        <SmartImage
                          src={listing.images[0]}
                          alt={listing.title}
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold text-ink-faint">
                          {CATEGORY_LABEL[listing.category]?.slice(0, 2) ?? '··'}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-grotesk text-d15 font-medium text-ink">
                        {listing.title}
                      </span>
                      <span className="block truncate font-mono text-d11 uppercase tracking-widest text-ink-faint">
                        {STATUS_LABEL[listing.status] ?? listing.status}
                        {' · '}
                        {formatPrice(listing.price, currency)}
                      </span>
                    </span>
                    {unanswered.has(listing.id) && (
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
                        <span aria-hidden className="h-2 w-2 border border-ink bg-acid" />
                        ESPERA RESPUESTA
                      </span>
                    )}
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <ListingThread
                        listing={listing}
                        franjaSlug={franjaSlug}
                        onReplied={onReplied}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </div>
  )
}

type ThreadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; comments: ListingComment[] }

// Newest OPEN buyer thread — the inbox rule, per thread: a root whose latest
// comment is NOT the seller. Replying inside it is what clears the flag.
function findOpenThread(
  comments: ListingComment[],
): { rootId: string; username: string } | null {
  const latestByRoot = new Map<string, ListingComment>()
  for (const c of comments) {
    const root = c.parentId ?? c.id
    const cur = latestByRoot.get(root)
    if (!cur || c.createdAt > cur.createdAt) latestByRoot.set(root, c)
  }
  let open: { rootId: string; latest: ListingComment } | null = null
  for (const [rootId, latest] of latestByRoot) {
    if (latest.isSeller) continue
    if (!open || latest.createdAt > open.latest.createdAt) open = { rootId, latest }
  }
  return open ? { rootId: open.rootId, username: open.latest.author.username } : null
}

function ListingThread({
  listing,
  franjaSlug,
  onReplied,
}: {
  listing: MarketplaceListing
  franjaSlug: string
  onReplied: () => void
}) {
  const [state, setState] = useState<ThreadState>({ phase: 'loading' })
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listing.id)}/comments`)
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { comments?: ListingComment[] }
      setState({ phase: 'ready', comments: json.comments ?? [] })
    } catch {
      setState({ phase: 'error' })
    }
  }, [listing.id])

  useEffect(() => {
    void load()
  }, [load])

  const comments = useMemo(
    () => (state.phase === 'ready' ? state.comments : []),
    [state],
  )
  const openThread = useMemo(() => findOpenThread(comments), [comments])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/listings/${encodeURIComponent(listing.id)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          openThread ? { body: text, parentId: openThread.rootId } : { body: text },
        ),
      })
      if (!res.ok) {
        setSendError(await readError(res, 'NO SE PUDO ENVIAR'))
        return
      }
      const json = (await res.json()) as { comment?: ListingComment }
      if (json.comment) {
        const posted = json.comment
        setState((prev) =>
          prev.phase === 'ready'
            ? { phase: 'ready', comments: [...prev.comments, posted] }
            : prev,
        )
      }
      setBody('')
      // The inbox route stays the authority on the OFERTA flag — revalidate
      // the franja slice (an explicit action, not a poll).
      onReplied()
    } catch {
      setSendError('NO SE PUDO ENVIAR')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-ink bg-paper p-4">
      {state.phase === 'loading' ? (
        <ShimmerLine />
      ) : state.phase === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <ErrorLine>{'SEÑAL INTERRUMPIDA — EL HILO NO CARGÓ.'}</ErrorLine>
          <InkButton onClick={() => void load()}>REINTENTAR</InkButton>
        </div>
      ) : comments.length === 0 ? (
        <EmptyLine>{'NADIE HA ESCRITO EN ESTA PIEZA TODAVÍA.'}</EmptyLine>
      ) : (
        <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className={c.parentId ? 'pl-4' : ''}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-d13 font-bold text-ink">
                  @{c.author.username}
                </span>
                {c.isSeller && <Chip filled>VENDEDOR</Chip>}
                <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  HACE {timeAgo(c.createdAt).toUpperCase()}
                </span>
              </div>
              <p className="whitespace-pre-wrap font-grotesk text-d15 text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {state.phase === 'ready' && (
        <form onSubmit={(e) => void send(e)} className="flex items-end gap-2">
          <label className="flex min-h-11 min-w-0 flex-1 flex-col justify-end">
            <span className="sr-only">
              {openThread ? `Responder a @${openThread.username}` : 'Comentar esta pieza'}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={1500}
              placeholder={
                openThread
                  ? `Responder a @${openThread.username}…`
                  : 'Escribir en el hilo de esta pieza…'
              }
              className={`w-full resize-none border border-ink bg-paper-raised p-2 font-grotesk text-d15 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
            />
          </label>
          <InkButton
            type="submit"
            tone="filled"
            cue="stamp"
            disabled={sending || body.trim().length === 0}
          >
            {sending ? 'ENVIANDO…' : 'RESPONDER'}
          </InkButton>
        </form>
      )}

      {sendError && (
        <p
          role="status"
          className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
        >
          ⚠ {sendError}
        </p>
      )}

      <InkButton
        href={`/marketplace?franja=${encodeURIComponent(franjaSlug)}&listing=${encodeURIComponent(listing.id)}`}
        external
      >
        VER EN MARKETPLACE
      </InkButton>
    </div>
  )
}

// ── AJUSTES ─────────────────────────────────────────────────────────────────

function AjustesTab({
  franjaId,
  franjaSlug,
  enabled,
  currency,
  listings,
  afterMutation,
}: {
  franjaId: string
  franjaSlug: string
  enabled: boolean
  currency: string | null
  listings: MarketplaceListing[]
  afterMutation: (scope?: 'all' | 'franja') => Promise<void>
}) {
  const patchFranja = useCallback(
    async (body: Record<string, unknown>): Promise<string | null> => {
      try {
        const res = await fetch(`/api/franjas/${encodeURIComponent(franjaId)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return await readError(res, 'NO SE PUDO GUARDAR')
        await afterMutation('franja')
        return null
      } catch {
        return 'NO SE PUDO GUARDAR'
      }
    },
    [afterMutation, franjaId],
  )

  return (
    <div className="flex flex-col gap-4 pt-4">
      <TiendaSwitch
        enabled={enabled}
        franjaSlug={franjaSlug}
        listingCount={listings.length}
        patchFranja={patchFranja}
      />
      <MonedaSheet currency={currency} patchFranja={patchFranja} />
      <ContactoSheet
        franjaId={franjaId}
        listings={listings}
        afterMutation={afterMutation}
      />
    </div>
  )
}

// ── The self-service storefront switch ─────────────────────────────────────
//
// GOVERNANCE: marketplace_enabled belongs to the franja team, here. It is
// the visibility of the storefront on /marketplace and the home rail —
// nothing more. Turning it off deletes nothing, and the copy says so, so
// nobody reaches for BORRAR when they meant «pausar».

function TiendaSwitch({
  enabled,
  franjaSlug,
  listingCount,
  patchFranja,
}: {
  enabled: boolean
  franjaSlug: string
  listingCount: number
  patchFranja: (body: Record<string, unknown>) => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Optimistic while the PATCH flies; falls back to server truth after the
  // refetch (or on failure).
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const on = optimistic ?? enabled

  const toggle = async () => {
    const next = !on
    setBusy(true)
    setError(null)
    setOptimistic(next)
    const message = await patchFranja({ marketplace_enabled: next })
    setBusy(false)
    setOptimistic(null)
    if (message) setError(message)
  }

  return (
    <Sheet title="TIENDA PÚBLICA" note="LO DECIDE TU EQUIPO, NO GRADIENTE">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => void toggle()}
            disabled={busy}
            data-cue="latch"
            className={`flex min-h-11 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            <span
              aria-hidden
              className={`relative h-6 w-11 shrink-0 border border-ink ${
                on ? 'bg-ink' : 'bg-paper'
              }`}
            >
              <span
                className={`absolute top-[3px] h-4 w-4 ${
                  on ? 'left-[23px] bg-acid' : 'left-[3px] bg-ink-faint'
                }`}
              />
            </span>
            <span className="font-mono text-d13 font-bold uppercase tracking-widest text-ink">
              {busy ? 'GUARDANDO…' : on ? 'TIENDA ENCENDIDA' : 'TIENDA APAGADA'}
            </span>
          </button>
          <Chip filled={on}>{on ? 'VISIBLE EN /MARKETPLACE' : 'OCULTA'}</Chip>
        </div>

        <p className="font-grotesk text-d15 text-ink">
          {on
            ? `Tu catálogo aparece en /marketplace y en el riel de la portada, bajo /${franjaSlug}.`
            : 'Tu catálogo no aparece en /marketplace ni en el riel de la portada.'}
        </p>

        <MarginNote>
          {`APAGAR LA TIENDA OCULTA ${listingCount} ${listingCount === 1 ? 'PIEZA' : 'PIEZAS'}: NO BORRA NADA. LAS PIEZAS, SUS IMÁGENES Y SUS HILOS SIGUEN AQUÍ Y VUELVEN A VERSE AL ENCENDERLA. BORRAR UNA PIEZA ES OTRA COSA, Y VIVE EN CATÁLOGO.`}
        </MarginNote>

        {error && (
          <p
            role="status"
            className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
          >
            ⚠ {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}

// ── Moneda ──────────────────────────────────────────────────────────────────

function MonedaSheet({
  currency,
  patchFranja,
}: {
  currency: string | null
  patchFranja: (body: Record<string, unknown>) => Promise<string | null>
}) {
  const [value, setValue] = useState(currency ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(currency ?? '')
  }, [currency])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(timer)
  }, [saved])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const message = await patchFranja({
      marketplace_currency: value.trim().toUpperCase() || null,
    })
    setBusy(false)
    if (message) setError(message)
    else setSaved(true)
  }

  const dirty = value.trim().toUpperCase() !== (currency ?? '')

  return (
    <Sheet title="MONEDA" note="ETIQUETA, NO CONVERSIÓN">
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
              MONEDA DEL CATÁLOGO
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={8}
              placeholder="MXN"
              className={`min-h-11 w-40 border border-ink bg-paper-raised px-3 font-mono text-d13 uppercase tracking-widest text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
            />
          </label>
          <InkButton type="submit" tone="filled" cue="stamp" disabled={busy || !dirty}>
            {busy ? 'GUARDANDO…' : 'GUARDAR MONEDA'}
          </InkButton>
          {saved && (
            <span
              role="status"
              className="font-mono text-d11 font-bold uppercase tracking-widest text-ink"
            >
              ◉ GUARDADA
            </span>
          )}
        </div>
        <p className="font-mono text-d11 uppercase leading-relaxed tracking-widest text-ink-faint">
          {'SE IMPRIME JUNTO A CADA PRECIO. VACÍA, EL CATÁLOGO DICE MXN. GRADIENTE NO CONVIERTE NI COBRA.'}
        </p>
        {error && (
          <p
            role="status"
            className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
          >
            ⚠ {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}

// ── Contacto de venta ──────────────────────────────────────────────────────
//
// WhatsApp / e-mail / enlace externo are LISTING columns (migration 0032) —
// there is no franja-level contact anywhere in the schema, and inventing one
// would be a field that saves nowhere. So this sheet is honest about it: it
// writes the same value into the pieces you choose, and says so.

function ContactoSheet({
  franjaId,
  listings,
  afterMutation,
}: {
  franjaId: string
  listings: MarketplaceListing[]
  afterMutation: (scope?: 'all' | 'franja') => Promise<void>
}) {
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [saleUrl, setSaleUrl] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const without = listings.filter((l) => !hasContactRoute(l))
  const targets = overwrite ? listings : without
  const filled = Boolean(whatsapp.trim() || email.trim() || saleUrl.trim())

  const apply = async () => {
    if (!filled || targets.length === 0 || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    const patch: Record<string, string> = {}
    if (whatsapp.trim()) patch.whatsapp = whatsapp.trim()
    if (email.trim()) patch.contact_email = email.trim()
    if (saleUrl.trim()) patch.sale_url = saleUrl.trim()
    try {
      const settled = await Promise.allSettled(
        targets.map((listing) =>
          fetch(
            `/api/franjas/${encodeURIComponent(franjaId)}/listings/${encodeURIComponent(listing.id)}`,
            {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(patch),
            },
          ).then((res) => {
            if (!res.ok) throw new Error(String(res.status))
            return true
          }),
        ),
      )
      const ok = settled.filter((s) => s.status === 'fulfilled').length
      setResult(`APLICADO A ${ok} DE ${targets.length} ${targets.length === 1 ? 'PIEZA' : 'PIEZAS'}`)
      if (ok < targets.length) setError('ALGUNAS PIEZAS NO SE PUDIERON ESCRIBIR')
      setConfirming(false)
      await afterMutation('franja')
    } catch {
      setError('NO SE PUDO APLICAR')
    } finally {
      setBusy(false)
    }
  }

  const control = `min-h-11 w-full border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`

  return (
    <Sheet title="CONTACTO DE VENTA" note="VIVE EN CADA PIEZA">
      <div className="flex flex-col gap-4">
        <MarginNote>
          {'EL ESQUEMA NO GUARDA UN CONTACTO POR FRANJA: WHATSAPP, E-MAIL Y ENLACE SON CAMPOS DE CADA PIEZA. LO QUE ESCRIBAS AQUÍ SE COPIA A LAS PIEZAS QUE ELIJAS; LOS CAMPOS VACÍOS NO SE TOCAN.'}
        </MarginNote>

        {listings.length === 0 ? (
          <EmptyLine>{'AÚN NO HAY PIEZAS A LAS QUE APLICAR UN CONTACTO.'}</EmptyLine>
        ) : (
          <>
            <p className="font-mono text-d13 uppercase tracking-widest text-ink">
              {without.length === 0
                ? 'TODAS LAS PIEZAS TIENEN AL MENOS UNA VÍA DE CONTACTO.'
                : `${without.length} DE ${listings.length} ${listings.length === 1 ? 'PIEZA' : 'PIEZAS'} SIN NINGUNA VÍA DE CONTACTO.`}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  WHATSAPP
                </span>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+52 55 … o wa.me/…"
                  className={control}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  E-MAIL
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ventas@…"
                  className={control}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  ENLACE EXTERNO
                </span>
                <input
                  value={saleUrl}
                  onChange={(e) => setSaleUrl(e.target.value)}
                  placeholder="https://… (Discogs, Bandcamp, tienda…)"
                  className={control}
                />
              </label>
            </div>

            <label className={`flex min-h-11 w-fit items-center gap-2.5 ${FOCUS_RING}`}>
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => {
                  setOverwrite(e.target.checked)
                  setConfirming(false)
                }}
                className="h-4 w-4 shrink-0 accent-black"
              />
              <span className="font-mono text-d11 uppercase tracking-widest text-ink">
                {'TAMBIÉN SOBRESCRIBIR LAS PIEZAS QUE YA TIENEN CONTACTO'}
              </span>
            </label>

            {confirming && (
              <div className="flex flex-col gap-3 border border-sys-red-paper p-4">
                <p className="font-grotesk text-d15 text-ink">
                  {`Vas a sobrescribir el contacto de ${targets.length} ${targets.length === 1 ? 'pieza' : 'piezas'}, incluidas las que ya tenían uno. El valor anterior se pierde.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <InkButton tone="red" cue="stamp" onClick={() => void apply()} disabled={busy}>
                    {busy ? 'APLICANDO…' : 'SOBRESCRIBIR'}
                  </InkButton>
                  <InkButton onClick={() => setConfirming(false)} disabled={busy}>
                    CANCELAR
                  </InkButton>
                </div>
              </div>
            )}

            {!confirming && (
              <div className="flex flex-wrap items-center gap-3">
                <InkButton
                  tone="filled"
                  cue="stamp"
                  disabled={busy || !filled || targets.length === 0}
                  onClick={() => {
                    if (overwrite) setConfirming(true)
                    else void apply()
                  }}
                >
                  {busy
                    ? 'APLICANDO…'
                    : `APLICAR A ${targets.length} ${targets.length === 1 ? 'PIEZA' : 'PIEZAS'}`}
                </InkButton>
                {!filled && (
                  <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                    {'ESCRIBE AL MENOS UNA VÍA'}
                  </span>
                )}
                {result && (
                  <span
                    role="status"
                    className="font-mono text-d11 font-bold uppercase tracking-widest text-ink"
                  >
                    ◉ {result}
                  </span>
                )}
              </div>
            )}

            {error && (
              <p
                role="status"
                className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper"
              >
                ⚠ {error}
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
