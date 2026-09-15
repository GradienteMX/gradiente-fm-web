'use client'

// The Franja catalog and buyer conversations. Existing mutation routes and
// availability states remain unchanged; no payment or order processing.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type FormEvent,
} from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { useSearchParams } from 'next/navigation'
import { ActivityRowView } from '@/components/dashboard/widgets/ActividadWidget'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { SmartImage } from '@/components/SmartImage'
import {
  Chip,
  EmptyLine,
  ErrorLine,
  FOCUS_RING,
  InkButton,
  MarginNote,
  Sheet,
  ShimmerLine,
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
  const search = useSearchParams()
  const { currentUser } = useAuth()
  const { franja, activity, loaded, errors, afterMutation } = useDashboardData()

  const tab: MercadoTab = search.get('tab') === 'ofertas' ? 'ofertas' : search.get('tab') === 'ajustes' ? 'ajustes' : 'catalogo'
  const statusFilter = search.get('marketStatus') ?? 'all'
  const editorHeading = useRef<HTMLHeadingElement>(null)
  const editorTrigger = useRef<HTMLElement | null>(null)
  const navigate = (tab: MercadoTab, listing?: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    if (listing) params.set('listing', listing)
    else params.delete('listing')
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }
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
  const missingRequired = useMemo(() => listingMissingRequired(checklist), [checklist])

  const patchDraft = useCallback((patch: Partial<ListingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = useCallback(() => {
    editorTrigger.current = document.activeElement as HTMLElement | null
    setEditor({ mode: 'create' })
    setDraft(emptyListingDraft())
    setFormError(null)
    setConfirmDeleteId(null)
  }, [])

  const openEdit = useCallback((listing: MarketplaceListing) => {
    editorTrigger.current = document.activeElement as HTMLElement | null
    setEditor({ mode: 'edit', id: listing.id })
    setDraft(draftFromListing(listing))
    setFormError(null)
    setConfirmDeleteId(null)
  }, [])

  const closeEditor = useCallback(() => {
    setEditor(null)
    setFormError(null)
    editorTrigger.current?.focus()
  }, [])

  useEffect(() => {
    if (editor) { editorHeading.current?.focus(); editorHeading.current?.scrollIntoView({ block: 'start' }) }
  }, [editor])

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

  const visible = listings.filter((listing) => statusFilter === 'all' || listing.status === statusFilter)
  const offers = activity.filter((row) => row.kind === 'oferta')
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [statusFilter, franjaId])

  return <section className="flex min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-syne text-[clamp(1.75rem,8vw,3rem)] font-extrabold md:text-5xl">MERCADO</h2>
        {franja && <p className="mt-1 font-grotesk text-xl font-bold">{franja.title}</p>}</div>
      {franja && <button type="button" onClick={() => navigate('ajustes')}
        className={`min-h-11 font-mono text-d13 text-ink-soft ${FOCUS_RING}`}>{franja.marketplaceEnabled ? 'TIENDA VISIBLE' : 'TIENDA OCULTA'} ↗</button>}
    </header>
    {!franja ? <div>{errors.franja ? <><ErrorLine>No se pudo cargar el mercado.</ErrorLine><InkButton onClick={() => void afterMutation('franja')}>REINTENTAR</InkButton></>
      : !loaded.franja ? <ShimmerLine /> : <EmptyLine>No tienes una franja con catálogo.</EmptyLine>}</div>
    : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/30 pb-2">
        <nav aria-label="Secciones de mercado" className="flex flex-wrap">
          {([['catalogo', 'CATÁLOGO'], ['ofertas', 'OFERTAS'], ['ajustes', 'AJUSTES']] as const).map(([key, label]) =>
            <button key={key} type="button" onClick={() => navigate(key)} aria-pressed={tab === key}
              className={`min-h-11 border border-ink/25 px-4 font-mono text-d13 sm:px-8 ${tab === key ? 'bg-ink text-paper' : 'bg-paper-raised text-ink hover:bg-ink/5'} ${FOCUS_RING}`}>{label}</button>)}
        </nav>
        {tab === 'catalogo' && <label><span className="sr-only">Filtrar por disponibilidad</span>
          <select value={statusFilter} onChange={(event) => {
            const params = new URLSearchParams(window.location.search)
            params.set('marketStatus', event.target.value)
            window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
          }} className={`min-h-11 max-w-full border border-ink/30 bg-paper-raised px-3 font-mono text-d13 ${FOCUS_RING}`}>
            <option value="all">Todos los estados</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </select></label>}
      </div>
      {errors.franja && <div className="flex flex-wrap items-center gap-3"><p role="status">No se pudo actualizar el catálogo.</p><InkButton onClick={() => void afterMutation('franja')}>REINTENTAR</InkButton></div>}
      {tab === 'catalogo' && <>
        {editor && <section className="scroll-mt-5 border border-ink/30 bg-paper-raised p-4 md:p-6" aria-label="Editor de publicación">
          <h3 ref={editorHeading} tabIndex={-1} className="mb-5 font-syne text-d28 font-extrabold outline-none">{editor.mode === 'create' ? 'NUEVA PUBLICACIÓN' : 'EDITAR PUBLICACIÓN'}</h3>
          <ListingForm mode={editor.mode} draft={draft} onChange={patchDraft} currency={currency} uid={uid} busy={formBusy}
            error={formError} canSubmit={missingRequired.length === 0} missing={missingRequired}
            onSubmit={() => void submitListing()} onCancel={closeEditor} />
        </section>}
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={openCreate} disabled={formBusy} aria-label="Nueva publicación en el mercado"
            className={`flex min-h-64 flex-col items-center justify-center gap-5 border border-ink/15 bg-publication-news px-6 py-10 transition-colors hover:border-ink sm:min-h-96 ${FOCUS_RING}`}>
            <span aria-hidden className="font-grotesk text-8xl leading-none">+</span>
            <span className="max-w-full font-syne text-d18 font-extrabold leading-tight sm:text-xl">NUEVA<br />PUBLICACIÓN</span>
          </button>
          {visible.slice(0, page * 12).map((listing) => <article key={listing.id} className="flex min-w-0 flex-col border border-ink/25 bg-paper-raised">
            <a href={`/marketplace?franja=${encodeURIComponent(franja.slug)}&listing=${encodeURIComponent(listing.id)}`}
              className={`relative block aspect-square overflow-hidden bg-publication-news/30 ${FOCUS_RING}`} aria-label={`Ver ${listing.title}`}>
              {listing.images[0] ? <SmartImage src={listing.images[0]} alt={listing.title} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 480px" className="object-cover" />
                : <span className="flex h-full items-center justify-center font-syne text-d28 font-bold">{CATEGORY_LABEL[listing.category]}</span>}
            </a>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-grotesk text-d18 font-bold leading-snug">{listing.title}</h3>
                <span className="font-mono text-d11 text-ink-soft">{listing.subcategory || CATEGORY_LABEL[listing.category]}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-d18 tabular-nums">{formatPrice(listing.price, currency)}</p>
                <StatusPicker listing={listing} busy={rowBusyId !== null} onChange={(status) => void changeStatus(listing, status)} />
              </div>
              {unanswered.has(listing.id) && <button type="button" onClick={() => navigate('ofertas', listing.id)} className={`min-h-11 text-left font-mono text-d11 underline ${FOCUS_RING}`}>OFERTA SIN RESPONDER ↗</button>}
              <div className="mt-auto flex items-center gap-5 border-t border-ink/20 pt-1">
                <a href={`/marketplace?franja=${encodeURIComponent(franja.slug)}&listing=${encodeURIComponent(listing.id)}`}
                  className={`flex min-h-11 items-center font-mono text-d13 ${FOCUS_RING}`}>VER ↗</a>
                <button type="button" onClick={() => openEdit(listing)} disabled={formBusy} className={`min-h-11 font-mono text-d13 ${FOCUS_RING}`}>EDITAR</button>
                <details className="group relative ml-auto">
                  <summary aria-label={`Más opciones para ${listing.title}`} className={`flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-xl [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}>⋮</summary>
                  <div className="absolute bottom-full right-0 z-10 mb-1 w-48 border border-ink bg-paper-raised p-2">
                    <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); navigate('ofertas', listing.id) }}
                      className={`min-h-11 w-full px-3 text-left font-mono text-d13 ${FOCUS_RING}`}>VER OFERTAS</button>
                    <button type="button" disabled={rowBusyId !== null} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setConfirmDeleteId(listing.id) }}
                      className={`min-h-11 w-full px-3 text-left font-mono text-d13 text-sys-red-paper ${FOCUS_RING}`}>ELIMINAR</button>
                  </div>
                </details>
              </div>
              {rowError?.id === listing.id && <p role="status" className="font-grotesk text-d13 text-sys-red-paper">{rowError.message}</p>}
              {confirmDeleteId === listing.id && <DeleteConfirm listing={listing} busy={rowBusyId === listing.id}
                onCancel={() => setConfirmDeleteId(null)} onConfirm={() => void deleteListing(listing)} />}
            </div>
          </article>)}
          {!visible.length && <div className="flex items-center justify-center border-y border-ink/15 px-6 py-10 sm:min-h-64 xl:col-span-3">
            <p role="status" className="max-w-sm text-center font-grotesk text-d18 text-ink-soft">{!listings.length ? 'Tu catálogo empieza con una publicación.' : 'No hay publicaciones con este estado.'}</p>
          </div>}
        </div>
        {visible.length > page * 12 && <div><InkButton onClick={() => setPage((value) => value + 1)}>VER MÁS</InkButton></div>}
        {offers.length > 0 && <section className="border-t border-ink/30 pt-4" aria-label="Ofertas recientes">
          <h3 className="mb-3 font-syne text-d28 font-extrabold">OFERTAS</h3>
          {offers.slice(0, 3).map((row) => <ActivityRowView key={row.key} row={row} large onUnavailable={() => navigate('ofertas', row.listingId)} />)}
        </section>}
        <p className="font-grotesk text-d13 text-ink-soft">Acuerda la compra directamente con la otra persona.</p>
      </>}
      {tab === 'ofertas' && <OfertasTab key={search.get('listing') ?? 'inbox'} initialListingId={search.get('listing')} listings={listings}
        unanswered={unanswered} currency={currency} franjaSlug={franja.slug} onReplied={() => void afterMutation('franja')} />}
      {tab === 'ajustes' && <AjustesTab franjaId={franja.id} franjaSlug={franja.slug} enabled={franja.marketplaceEnabled}
        currency={currency} listings={listings} afterMutation={afterMutation} />}
    </>}
  </section>
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
        className={`min-h-[44px] max-w-full cursor-pointer border border-ink/25 px-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink disabled:cursor-not-allowed disabled:opacity-40 ${listing.status === 'available' ? 'bg-publication-news/50' : listing.status === 'reserved' ? 'bg-publication-review/50' : 'bg-publication-event/50'} ${FOCUS_RING}`}
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
        {'ELIMINAR PUBLICACIÓN'}
      </p>
      <p className="font-grotesk text-d15 text-ink">
        {'Se elimina «'}
        {listing.title}
        {'» y sus conversaciones. Esta acción es permanente.'}
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

// ── OFERTAS — the buyer-thread inbox ───────────────────────────────────────

function OfertasTab({
  initialListingId,
  listings,
  unanswered,
  currency,
  franjaSlug,
  onReplied,
}: {
  initialListingId?: string | null
  listings: MarketplaceListing[]
  unanswered: ReadonlySet<string>
  currency: string | null
  franjaSlug: string
  onReplied: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(initialListingId ?? null)
  const [showAll, setShowAll] = useState(!!initialListingId)

  const waiting = listings.filter((l) => unanswered.has(l.id))
  const rows = showAll ? listings : waiting

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="font-grotesk text-d13 text-ink-soft">Acuerda la compra directamente con la otra persona.</p>

      <Sheet
        title={showAll ? 'TODOS LOS HILOS' : 'ESPERAN RESPUESTA'}
        action={
          listings.length > 0 ? (
            <InkButton cue="latch" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? 'SIN RESPONDER'
                : 'TODAS LAS CONVERSACIONES'}
            </InkButton>
          ) : undefined
        }
        padded={false}
      >
        {listings.length === 0 ? (
          <EmptyLine>
            {'Publica un objeto para recibir consultas y ofertas.'}
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
                    className={`flex min-h-28 w-full flex-wrap items-center gap-4 px-4 py-4 text-left ${FOCUS_RING}`}
                  >
                    <span className="relative block h-20 w-20 shrink-0 overflow-hidden bg-paper sm:h-28 sm:w-28">
                      {listing.images[0] ? (
                        <SmartImage
                          src={listing.images[0]}
                          alt={listing.title}
                          className="object-cover"
                          sizes="112px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold text-ink-faint">
                          {CATEGORY_LABEL[listing.category]?.slice(0, 2) ?? '··'}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-grotesk text-d18 font-bold text-ink">
                        {listing.title}
                      </span>
                      <span className="block truncate font-mono text-d11 uppercase tracking-widest text-ink-faint">
                        {STATUS_LABEL[listing.status] ?? listing.status}
                        {' · '}
                        {formatPrice(listing.price, currency)}
                      </span>
                    </span>
                    <span className="font-mono text-d13">{open ? 'CERRAR' : 'VER'} ↗</span>
                    {unanswered.has(listing.id) && (
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
                        <span aria-hidden className="h-2 w-2 border border-ink bg-acid" />
                        SIN RESPONDER
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
          <ErrorLine>{'No se pudo cargar la conversación.'}</ErrorLine>
          <InkButton onClick={() => void load()}>REINTENTAR</InkButton>
        </div>
      ) : comments.length === 0 ? (
        <EmptyLine>{'Todavía no hay mensajes sobre esta publicación.'}</EmptyLine>
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
              {openThread ? `Responder a @${openThread.username}` : 'Comentar esta publicación'}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={1500}
              placeholder={
                openThread
                  ? `Responder a @${openThread.username}…`
                  : 'Escribir un mensaje…'
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
    <div className="grid items-start gap-5 pt-2 lg:grid-cols-2">
      <TiendaSwitch
        enabled={enabled}
        patchFranja={patchFranja}
      />
      <MonedaSheet currency={currency} patchFranja={patchFranja} />
      <div className="lg:col-span-2"><ContactoSheet
        franjaId={franjaId}
        listings={listings}
        afterMutation={afterMutation}
      /></div>
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
  patchFranja,
}: {
  enabled: boolean
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
    <Sheet title="VISIBILIDAD">
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
              {busy ? 'GUARDANDO…' : on ? 'TIENDA VISIBLE' : 'TIENDA OCULTA'}
            </span>
          </button>
        </div>

        <p className="font-grotesk text-d15 text-ink">
          {on
            ? 'Tu catálogo aparece en Mercado y en la portada.'
            : 'Solo tu equipo puede ver el catálogo.'}
        </p>

        <p className="font-grotesk text-d13 text-ink-soft">Ocultar la tienda conserva tus publicaciones y conversaciones.</p>

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
    <Sheet title="MONEDA">
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
          {'La moneda aparece junto al precio. Si la dejas vacía, se usa MXN.'}
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
      setResult(`APLICADO A ${ok} DE ${targets.length} ${targets.length === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'}`)
      if (ok < targets.length) setError('ALGUNAS PUBLICACIONES NO SE PUDIERON ESCRIBIR')
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
    <Sheet title="CONTACTO DE VENTA">
      <div className="flex flex-col gap-4">
        <p className="font-grotesk text-d15 text-ink-soft">Aplica tus datos a las publicaciones sin contacto. Los campos vacíos conservan su valor.</p>

        {listings.length === 0 ? (
          <EmptyLine>{'AÚN NO HAY PUBLICACIONES A LAS QUE APLICAR UN CONTACTO.'}</EmptyLine>
        ) : (
          <>
            <p className="font-mono text-d13 uppercase tracking-widest text-ink">
              {without.length === 0
                ? 'TODAS LAS PUBLICACIONES TIENEN AL MENOS UNA VÍA DE CONTACTO.'
                : `${without.length} DE ${listings.length} ${listings.length === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'} SIN NINGUNA VÍA DE CONTACTO.`}
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
                {'TAMBIÉN SOBRESCRIBIR LAS PUBLICACIONES QUE YA TIENEN CONTACTO'}
              </span>
            </label>

            {confirming && (
              <div className="flex flex-col gap-3 border border-sys-red-paper p-4">
                <p className="font-grotesk text-d15 text-ink">
                  {`Vas a sobrescribir el contacto de ${targets.length} ${targets.length === 1 ? 'publicación' : 'publicaciones'}, incluidas las que ya tenían uno. El valor anterior se pierde.`}
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
                    : `APLICAR A ${targets.length} ${targets.length === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'}`}
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
