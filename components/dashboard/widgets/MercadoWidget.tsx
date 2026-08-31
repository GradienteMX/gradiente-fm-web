'use client'

// ── MERCADO — conditional widget (FINAL_SPEC §3.9, w6×h2 / w12×2) ───────────
//
// Exists only in the registries of franja-team users (currentUser.franjaId)
// and admins (canAssignRoles) — the provider enforces that (§3.9); this
// component additionally renders null for anyone else, so a non-franja user
// never sees a widget-shaped bookmark.
//
// SCALE PASS (S1/S2/S4): {6,2} is a FIXED portion — two whole 48px-thumb
// listing cells side-by-side + VerRow «VER TODO · N» + the sondeo footnote,
// zero internal scroll (129px h2 budget; the arithmetic lives at the default
// branch). {12,2} is the depth state: full-width 52px rows, inline threads,
// the composer, and legal internal scroll. Every depth gesture (row click,
// NUEVA PIEZA, VER TODO) grows the widget first via ctx.commitLayout.
//
// FRANJA VARIANT — reads the provider's `franja` slice (GET /api/franjas/
// [id] + /inbox on the ≥5-min floor; the widget itself never polls):
//   · listings with portada, estado and price; OFERTA badge = acid dot on
//     listings the inbox route reports unanswered (real buyer computation).
//   · row click expands the listing's comment thread INLINE with a reply
//     composer on the existing GET/POST /api/listings/[lid]/comments routes —
//     someone offering money is answered in ≤2 clicks without leaving
//     /dashboard. The reply targets the newest OPEN buyer thread (the inbox
//     rule is per-thread: a seller reply inside the thread clears it).
//   · «NUEVA PIEZA» opens a one-line composer strip (POST /api/franjas/[id]/
//     listings) — the empty state's working action, ported from the
//     MiFranjaSection creation flow (same hand-rolled `mkl-…` ids).
//   · freshness is declared, never implied: «SONDEO CADA 5 MIN» (R8).
//   · listing_comments stay their own system — never merged into the
//     editorial comments model; `views` is never surfaced (no counts, no
//     trends, no popularity chrome).
//
// ADMIN VARIANT — APROBACIONES: the FranjaApprovalsSection logic ported
// (GET /api/admin/franjas + PATCH marketplace_enabled per row, refetch after
// every toggle — every control live). Admin data is outside the provider
// contract by design (WP2 note), so this variant owns its fetch.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, VerRow, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import type { WidgetSize } from '@/lib/dashboard/layout'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { compressAndUploadImage } from '@/lib/imageUpload'
import { canAssignRoles } from '@/lib/permissions'
import type {
  ListingComment,
  MarketplaceListing,
  MarketplaceListingCategory,
  MarketplaceListingCondition,
  MarketplaceListingStatus,
} from '@/lib/types'

// ── Vocabulary ──────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<MarketplaceListingCategory, string> = {
  vinyl: 'VINILO',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTH',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TORNAMESA',
  mixer: 'MEZCLADORA',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

const CONDITIONS: readonly MarketplaceListingCondition[] = [
  'NEW',
  'NM',
  'VG+',
  'VG',
  'G+',
  'G',
  'F',
]

// Mirrors the MiFranjaSection convention (`mkl-<short>-<rand>`) so listing
// ids stay readable; a 409 means collision — the composer surfaces it.
function newListingId(franjaId: string): string {
  const slug = franjaId.replace(/^pa-/, '').slice(0, 12)
  const rand = Math.random().toString(36).slice(2, 8)
  return `mkl-${slug}-${rand}`
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: false })
  } catch {
    return '—'
  }
}

function formatPrice(price: number, currency: string | null): string {
  const amount = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
  return `$${amount} ${currency ?? 'MXN'}`
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export function MercadoWidget({ size, compact }: DashboardWidgetProps) {
  const { currentUser } = useAuth()
  if (currentUser?.franjaId) {
    return <FranjaMercado size={size} compact={compact} />
  }
  if (canAssignRoles(currentUser)) {
    return <AdminAprobaciones compact={compact} />
  }
  // Not franja-team, not admin: the registry already excludes 'mercado' —
  // render nothing rather than a widget-shaped bookmark (§3.9).
  return null
}

// ── FRANJA VARIANT ─────────────────────────────────────────────────────────

function FranjaMercado({ size, compact }: { size: WidgetSize; compact: boolean }) {
  const { currentUser } = useAuth()
  const ctx = useDashboardData()
  const { franja, loaded, errors, afterMutation } = ctx
  const [composing, setComposing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // §2.5 stored vocabulary: {6,2} = fixed default portion, {12,2} = the
  // widget's largest state — the ONLY state where internal scroll is legal
  // (SCALE PASS S1).
  const large = size.w >= 12

  // Size snap through the provider's ONE layout write path (the MAPA/PERFIL
  // precedent).
  const setMercadoSize = useCallback(
    (w: number, h: number) => {
      const current = ctx.layoutMeta
      ctx.commitLayout({
        ...current,
        layout: current.layout.map((entry) =>
          entry.id === 'mercado' ? { ...entry, w, h } : entry,
        ),
      })
    },
    [ctx],
  )
  const expandDepth = useCallback(() => setMercadoSize(12, 2), [setMercadoSize])
  const collapseDepth = useCallback(() => {
    setExpandedId(null)
    setComposing(false)
    setMercadoSize(6, 2)
  }, [setMercadoSize])

  // The composer and thread expansion only render at {12,2}; if the widget
  // returns to the fixed portion by any path (grid editing included), clear
  // them so the header never shows a dangling CERRAR.
  useEffect(() => {
    if (!compact && !large) {
      setComposing(false)
      setExpandedId(null)
    }
  }, [compact, large])

  const unanswered = useMemo(
    () => new Set(franja?.unansweredListingIds ?? []),
    [franja?.unansweredListingIds],
  )

  // OFERTAS first (money waits for no sort), then newest listings.
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

  const ofertas = unanswered.size
  const currency = franja?.marketplaceCurrency ?? null
  const uid = currentUser?.id ?? null

  const onCreated = useCallback(async () => {
    setComposing(false)
    await afterMutation('franja')
  }, [afterMutation])

  // Depth-first composing (S1): the composer strip needs room the {6,2}
  // fixed portion does not have, so at default size NUEVA PIEZA grows the
  // widget to {12,2} before opening the strip. Compact keeps its own inline
  // strip (single teaching row — no grid portion to protect).
  const composerAction = franja
    ? {
        label: composing ? 'CERRAR' : compact ? 'PUBLICAR PIEZA' : 'NUEVA PIEZA',
        onClick: () => {
          if (composing) {
            setComposing(false)
            return
          }
          if (!compact && !large) expandDepth()
          setComposing(true)
        },
        cue: 'latch',
      }
    : undefined

  // Compact (0 listings): the teaching row's action flips it into a one-line
  // composer strip — the §3.9 empty state's working affordance.
  if (compact) {
    return (
      <div id={dashWidgetDomId('mercado')} className="h-full">
        <WidgetFrame title="MERCADO" compact action={composerAction}>
          {composing && franja && uid ? (
            <ComposerStrip
              franjaId={franja.id}
              uid={uid}
              currency={currency}
              inline
              onCreated={onCreated}
            />
          ) : (
            // Copy budgeted to the stored width — wraps, never clamps.
            <p className="min-w-0 font-grotesk text-d15 text-ink">
              Publica tu primera pieza; las ofertas llegan aquí.
            </p>
          )}
        </WidgetFrame>
      </div>
    )
  }

  // ── {12,2} depth state — the widget's largest size: internal scroll is
  // legal here (S1), the inline thread expansion and the composer live here.
  if (large) {
    return (
      <div id={dashWidgetDomId('mercado')} className="h-full">
        <WidgetFrame
          title="MERCADO"
          count={ofertas > 0 ? ofertas : undefined}
          accent={ofertas > 0}
          action={composerAction}
        >
          <div className="flex h-full min-h-0 flex-col gap-3">
            {composing && franja && uid && (
              <ComposerStrip
                franjaId={franja.id}
                uid={uid}
                currency={currency}
                onCreated={onCreated}
              />
            )}

            {!franja && errors.franja ? (
              <p className="font-mono text-d13 text-ink">
                SEÑAL INTERRUMPIDA — el mercado se reintenta con el próximo
                sondeo.
              </p>
            ) : !franja && !loaded.franja ? (
              <div aria-hidden className="h-0.5 w-1/2 bg-ink motion-safe:animate-blink" />
            ) : listings.length === 0 ? (
              // §3.9 empty state — the copy IS the working affordance: it opens
              // the same composer strip as the header action.
              // In-place action (opens the composer strip) — no arrow (§ the ↗
              // rule marks route-leaving links only).
              <button
                type="button"
                onClick={() => setComposing(true)}
                data-cue="latch"
                className={`min-h-11 w-fit text-left font-grotesk text-d15 font-medium text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
              >
                PUBLICA TU PRIMER ITEM
              </button>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {listings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    currency={currency}
                    oferta={unanswered.has(listing.id)}
                    expanded={expandedId === listing.id}
                    onToggle={() =>
                      setExpandedId((cur) => (cur === listing.id ? null : listing.id))
                    }
                    franjaSlug={franja?.slug ?? null}
                    onReplied={() => void afterMutation('franja')}
                  />
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-mono text-d11 tracking-widest text-ink-soft">
                {'OFERTAS · SONDEO CADA 5 MIN'}
              </p>
              {/* Return snap (PERFIL «VISTA BREVE» precedent) — visual d13
                  mark, ::before pads the hit area to ≥44px. */}
              <button
                type="button"
                onClick={collapseDepth}
                data-cue="latch"
                className={`relative font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-[''] hover:underline ${FOCUS_RING}`}
              >
                VISTA BREVE
              </button>
            </div>
          </div>
        </WidgetFrame>
      </div>
    )
  }

  // ── {6,2} default — FIXED portion, zero internal scroll (S1) ─────────────
  // Content budget at h2 (WidgetFrame chrome arithmetic): 2×96 + 24 − 87 =
  // 129px. Three stacked 52px rows + a 44px VerRow (the prescribed portion)
  // measure 3×52 + 44 = 200px — they cannot exist inside 129px, so the
  // honest maximum holding S1 (whole items) + S2 (≥52px rows, 48px thumbs)
  // + S4 (VerRow) is TWO whole reference-scale cells SIDE-BY-SIDE:
  //   cells 54 (2 border + 4 pad + 48 thumb) + VerRow 44 + footnote 16
  //   = 114px ≤ 129px  (justify-between breathes the ~15px remainder).
  // OFERTAS sort first, so the two most urgent listings are always the two
  // visible; the header count + acid dot and the VerRow's N declare the rest.
  // Opening a listing (or the composer) is a depth gesture: it grows the
  // widget to {12,2} first, where the inline thread has room and scroll is
  // legal — the ≤2-clicks reply flow is preserved (click row → reply).
  return (
    <div id={dashWidgetDomId('mercado')} className="h-full">
      <WidgetFrame
        title="MERCADO"
        count={ofertas > 0 ? ofertas : undefined}
        accent={ofertas > 0}
        action={composerAction}
      >
        <div className="flex h-full min-h-0 flex-col justify-between">
          {!franja && errors.franja ? (
            <p className="font-mono text-d13 text-ink">
              SEÑAL INTERRUMPIDA — el mercado se reintenta con el próximo
              sondeo.
            </p>
          ) : !franja && !loaded.franja ? (
            <div aria-hidden className="h-0.5 w-1/2 bg-ink motion-safe:animate-blink" />
          ) : listings.length === 0 ? (
            // §3.9 empty state — the copy IS the working affordance; it grows
            // to {12,2} and opens the composer (depth-first, no arrow: the ↗
            // rule marks route-leaving links only).
            <button
              type="button"
              onClick={() => {
                expandDepth()
                setComposing(true)
              }}
              data-cue="latch"
              className={`min-h-11 w-fit text-left font-grotesk text-d15 font-medium text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
            >
              PUBLICA TU PRIMER ITEM
            </button>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {listings.slice(0, 2).map((listing) => (
                <ListingCell
                  key={listing.id}
                  listing={listing}
                  currency={currency}
                  oferta={unanswered.has(listing.id)}
                  onOpen={() => {
                    setExpandedId(listing.id)
                    expandDepth()
                  }}
                />
              ))}
            </ul>
          )}

          {listings.length > 2 && (
            <VerRow
              label="VER TODO"
              count={listings.length}
              onClick={expandDepth}
              cue="latch"
            />
          )}

          <p className="font-mono text-d11 tracking-widest text-ink-soft">
            {'OFERTAS · SONDEO CADA 5 MIN'}
          </p>
        </div>
      </WidgetFrame>
    </div>
  )
}

// ── Listing cell — the {6,2} fixed-portion tile ─────────────────────────────
// One whole reference-scale listing: 48px portada thumb (S3), d15 title, d11
// meta, price + OFERTA badge right-aligned. 54px tall (2 border + 4 pad + 48
// thumb ≥ the 52px row floor). Clicking is the depth gesture wired by the
// parent (grow to {12,2} + expand this listing's thread).
function ListingCell({
  listing,
  currency,
  oferta,
  onOpen,
}: {
  listing: MarketplaceListing
  currency: string | null
  oferta: boolean
  onOpen: () => void
}) {
  const portada = listing.images[0]
  const sold = listing.status === 'sold'
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        data-cue="tick"
        className={`flex min-h-[52px] w-full items-center gap-3 border border-ink bg-paper px-2 py-0.5 text-left ${FOCUS_RING}`}
      >
        <span className="relative block h-12 w-12 shrink-0 overflow-hidden border border-ink bg-paper">
          {portada ? (
            <SmartImage
              src={portada}
              alt={listing.title}
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold text-ink-soft">
              {CATEGORY_LABEL[listing.category]?.slice(0, 2) ?? '··'}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-grotesk text-d15 font-medium ${
              sold ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {listing.title}
          </span>
          <span className="block truncate font-mono text-d11 tracking-widest text-ink-soft">
            {CATEGORY_LABEL[listing.category] ?? listing.category}
            {' · '}
            {listing.condition}
            {' · '}
            {STATUS_LABEL[listing.status] ?? listing.status}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={`font-mono text-d13 tabular-nums ${
              sold ? 'text-ink-faint' : 'text-ink'
            }`}
          >
            {formatPrice(listing.price, currency)}
          </span>
          {oferta && (
            <span className="flex items-center gap-1.5 font-mono text-d11 font-bold tracking-widest text-ink">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full border border-ink bg-acid"
              />
              OFERTA
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

// ── Listing row + inline thread ─────────────────────────────────────────────

function ListingRow({
  listing,
  currency,
  oferta,
  expanded,
  onToggle,
  franjaSlug,
  onReplied,
}: {
  listing: MarketplaceListing
  currency: string | null
  oferta: boolean
  expanded: boolean
  onToggle: () => void
  franjaSlug: string | null
  onReplied: () => void
}) {
  const portada = listing.images[0]
  const sold = listing.status === 'sold'
  return (
    <li className="border-b border-ink last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        data-cue="tick"
        className={`flex min-h-[52px] w-full items-center gap-3 py-2 text-left ${FOCUS_RING}`}
      >
        <span className="relative block h-12 w-12 shrink-0 overflow-hidden border border-ink bg-paper">
          {portada ? (
            <SmartImage
              src={portada}
              alt={listing.title}
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-d11 font-bold text-ink-soft">
              {CATEGORY_LABEL[listing.category]?.slice(0, 2) ?? '··'}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-grotesk text-d15 font-medium ${
              sold ? 'text-ink-faint line-through' : 'text-ink'
            }`}
          >
            {listing.title}
          </span>
          <span className="block truncate font-mono text-d11 tracking-widest text-ink-soft">
            {CATEGORY_LABEL[listing.category] ?? listing.category}
            {' · '}
            {listing.condition}
            {' · '}
            {STATUS_LABEL[listing.status] ?? listing.status}
          </span>
        </span>

        {oferta && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-d13 font-bold tracking-widest text-ink">
            <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
            OFERTA
          </span>
        )}

        <span
          className={`shrink-0 font-mono text-d13 tabular-nums ${
            sold ? 'text-ink-faint' : 'text-ink'
          }`}
        >
          {formatPrice(listing.price, currency)}
        </span>
      </button>

      {expanded && (
        <ListingThread
          listing={listing}
          franjaSlug={franjaSlug}
          onReplied={onReplied}
        />
      )}
    </li>
  )
}

type ThreadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; comments: ListingComment[] }

// Newest OPEN buyer thread (inbox rule: per-thread, latest author non-seller).
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
  franjaSlug: string | null
  onReplied: () => void
}) {
  const [state, setState] = useState<ThreadState>({ phase: 'loading' })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const res = await fetch(
        `/api/listings/${encodeURIComponent(listing.id)}/comments`,
      )
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

  const comments = state.phase === 'ready' ? state.comments : []
  const openThread = useMemo(() => findOpenThread(comments), [comments])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(
        `/api/listings/${encodeURIComponent(listing.id)}/comments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            openThread ? { body, parentId: openThread.rootId } : { body },
          ),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setSendError(data.error ?? 'NO SE PUDO ENVIAR')
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
      setDraft('')
      // The inbox route stays the authority on OFERTA state — revalidate the
      // franja slice (floor bypassed: explicit action, not a poll).
      onReplied()
    } catch {
      setSendError('NO SE PUDO ENVIAR')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-2 flex flex-col gap-2 border border-ink bg-paper p-3">
      {state.phase === 'loading' ? (
        <div aria-hidden className="h-0.5 w-1/2 bg-ink motion-safe:animate-blink" />
      ) : state.phase === 'error' ? (
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-d13 text-ink">
            SEÑAL INTERRUMPIDA — el hilo no cargó.
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className={`min-h-11 font-mono text-d13 tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
          >
            REINTENTAR
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="font-mono text-d13 text-ink-soft">
          {'SIN COMENTARIOS EN ESTA PIEZA TODAVÍA.'}
        </p>
      ) : (
        <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className={c.parentId ? 'pl-4' : ''}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-d13 font-bold text-ink">
                  @{c.author.username}
                </span>
                {c.isSeller && (
                  <span className="border border-ink px-1 font-mono text-d11 tracking-widest text-ink">
                    VENDEDOR
                  </span>
                )}
                <span className="font-mono text-d11 text-ink-faint">
                  HACE {timeAgo(c.createdAt).toUpperCase()}
                </span>
              </div>
              <p className="whitespace-pre-wrap font-grotesk text-d15 text-ink">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {state.phase === 'ready' && (
        <form onSubmit={(e) => void send(e)} className="flex items-end gap-2">
          {/* The label is the ≥44px hit target; the underline mark stays. */}
          <label className="flex min-h-11 min-w-0 flex-1 flex-col justify-end">
            <span className="sr-only">
              {openThread
                ? `Responder a @${openThread.username}`
                : 'Comentar esta pieza'}
            </span>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              maxLength={1500}
              placeholder={
                openThread
                  ? `Responder a @${openThread.username}…`
                  : 'Comentar esta pieza…'
              }
              className={`w-full resize-none border-b border-ink bg-transparent pb-0.5 font-grotesk text-d15 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
            />
          </label>
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            data-cue="stamp"
            className={`min-h-11 shrink-0 border border-ink bg-ink px-3 font-mono text-d13 font-bold tracking-widest text-paper disabled:opacity-50 ${FOCUS_RING}`}
          >
            {sending ? 'ENVIANDO…' : 'RESPONDER'}
          </button>
        </form>
      )}

      {sendError && (
        <p className="font-mono text-d13 font-bold text-sys-red-paper">⚠ {sendError}</p>
      )}

      {franjaSlug && (
        <a
          href={`/marketplace?franja=${encodeURIComponent(franjaSlug)}&listing=${encodeURIComponent(listing.id)}`}
          className={`inline-flex min-h-11 w-fit items-center font-mono text-d13 tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
        >
          VER EN MARKETPLACE ↗
        </a>
      )}
    </div>
  )
}

// ── One-line listing composer (POST /api/franjas/[id]/listings) ────────────

function ComposerStrip({
  franjaId,
  uid,
  currency,
  inline,
  onCreated,
}: {
  franjaId: string
  uid: string
  currency: string | null
  inline?: boolean
  onCreated: () => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<MarketplaceListingCategory>('vinyl')
  const [condition, setCondition] = useState<MarketplaceListingCondition>('VG+')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const result = await compressAndUploadImage(file, uid)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setImageUrl(result.url)
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const parsed = Number.parseFloat(price)
      const res = await fetch(
        `/api/franjas/${encodeURIComponent(franjaId)}/listings`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: newListingId(franjaId),
            title: trimmed,
            category,
            condition,
            price: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            status: 'available',
            images: imageUrl ? [imageUrl] : [],
          }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError((data.error ?? 'NO SE PUDO PUBLICAR').toUpperCase())
        return
      }
      setTitle('')
      setPrice('')
      setImageUrl(null)
      await onCreated()
    } catch {
      setError('NO SE PUDO PUBLICAR')
    } finally {
      setBusy(false)
    }
  }

  // min-h-11 keeps every composer control at the 44px touch floor.
  const control = `min-h-11 border border-ink bg-paper px-2 py-1.5 font-mono text-d13 text-ink ${FOCUS_RING}`

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={`flex flex-wrap items-center gap-2 ${
        inline ? '' : 'border border-ink bg-paper p-2'
      }`}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la pieza…"
        maxLength={140}
        className={`min-w-32 flex-1 ${control} placeholder:text-ink-faint`}
      />
      <label className="flex items-center gap-1">
        <span className="sr-only">Categoría</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as MarketplaceListingCategory)}
          className={control}
        >
          {(Object.keys(CATEGORY_LABEL) as MarketplaceListingCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="sr-only">Condición</span>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as MarketplaceListingCondition)}
          className={control}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="sr-only">Precio</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder={`$ ${currency ?? 'MXN'}`}
          className={`w-24 tabular-nums ${control} placeholder:text-ink-faint`}
        />
      </label>
      {!inline && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`${control} tracking-widest disabled:opacity-50`}
          >
            {uploading ? 'SUBIENDO…' : imageUrl ? '◉ PORTADA' : 'PORTADA'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
        </>
      )}
      <button
        type="submit"
        disabled={busy || title.trim().length === 0}
        data-cue="stamp"
        className={`min-h-11 border border-ink bg-ink px-3 py-1.5 font-mono text-d13 font-bold tracking-widest text-paper disabled:opacity-50 ${FOCUS_RING}`}
      >
        {busy ? 'PUBLICANDO…' : 'PUBLICAR'}
      </button>
      {error && (
        <span className="font-mono text-d13 font-bold text-sys-red-paper">⚠ {error}</span>
      )}
    </form>
  )
}

// ── ADMIN VARIANT — APROBACIONES ────────────────────────────────────────────

interface AdminFranjaRow {
  id: string
  slug: string
  title: string
  franja_kind: string | null
  marketplace_enabled: boolean
  marketplace_listings: unknown[] | null
}

function AdminAprobaciones({ compact }: { compact: boolean }) {
  const [franjas, setFranjas] = useState<AdminFranjaRow[]>([])
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const [query, setQuery] = useState('')

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/franjas')
      if (!res.ok) throw new Error(String(res.status))
      const json = (await res.json()) as { franjas?: AdminFranjaRow[] }
      setFranjas(json.franjas ?? [])
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return franjas
    return franjas.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    )
  }, [franjas, query])

  const enabledCount = franjas.filter((p) => p.marketplace_enabled).length

  if (compact) {
    return (
      <div id={dashWidgetDomId('mercado')} className="h-full">
        <WidgetFrame title="MERCADO · APROBACIONES" compact>
          <p className="truncate font-grotesk text-d15 text-ink">
            {enabledCount} de {franjas.length} franjas con marketplace activo.
          </p>
        </WidgetFrame>
      </div>
    )
  }

  return (
    <div id={dashWidgetDomId('mercado')} className="h-full">
      <WidgetFrame title="MERCADO · APROBACIONES">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            {/* The label is the ≥44px hit target; the underline mark stays. */}
            <label className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
              <span className="sr-only">Buscar franja</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar franja por nombre o slug…"
                className={`w-full border-b border-ink bg-transparent pb-0.5 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
              />
            </label>
            <span className="shrink-0 font-mono text-d13 tracking-widest text-ink tabular-nums">
              {enabledCount}/{franjas.length} ACTIVOS
            </span>
          </div>

          {phase === 'loading' ? (
            <div aria-hidden className="h-0.5 w-1/2 bg-ink motion-safe:animate-blink" />
          ) : phase === 'error' ? (
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-d13 text-ink">
                SEÑAL INTERRUMPIDA — la lista no cargó.
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhase('loading')
                  void refetch()
                }}
                className={`min-h-11 font-mono text-d13 tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
              >
                REINTENTAR
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="font-mono text-d13 text-ink-soft">
              {'NINGÚN FRANJA COINCIDE CON LA BÚSQUEDA.'}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {filtered.map((p) => (
                <ApprovalRow key={p.id} franja={p} onChanged={refetch} />
              ))}
            </ul>
          )}

          <p className="font-mono text-d11 tracking-widest text-ink-soft">
            {'AL ACTIVAR, EL EQUIPO DEL FRANJA EDITA SU MERCADO DESDE ESTE PANEL.'}
          </p>
        </div>
      </WidgetFrame>
    </div>
  )
}

function ApprovalRow({
  franja,
  onChanged,
}: {
  franja: AdminFranjaRow
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  // Optimistic chip state: non-null while a PATCH is in flight (or just
  // failed). Falls back to the server truth from the last refetch.
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const enabled = optimistic ?? franja.marketplace_enabled
  const listingCount = franja.marketplace_listings?.length ?? 0

  // The failure notice self-clears after a few seconds; effect cleanup
  // also clears the timer on unmount / re-toggle.
  useEffect(() => {
    if (!failed) return
    const t = setTimeout(() => setFailed(false), 4000)
    return () => clearTimeout(t)
  }, [failed])

  const toggle = async () => {
    const next = !enabled
    setBusy(true)
    setFailed(false)
    setOptimistic(next)
    let ok = false
    try {
      const res = await fetch(
        `/api/admin/franjas/${encodeURIComponent(franja.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ marketplace_enabled: next }),
        },
      )
      ok = res.ok
    } catch {
      ok = false
    } finally {
      setBusy(false)
    }
    if (ok) await onChanged()
    // Back to server truth either way: on success the refetched row now
    // carries the new value; on failure the chip snaps back.
    setOptimistic(null)
    if (!ok) setFailed(true)
  }

  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-ink py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-grotesk text-d15 font-medium text-ink">
          {franja.title}
        </span>
        <span className="truncate font-mono text-d11 tracking-widest text-ink-soft">
          /{franja.slug}
          {franja.franja_kind ? ` · ${franja.franja_kind.toUpperCase()}` : ''}
          {enabled ? ` · ${listingCount} ${listingCount === 1 ? 'PIEZA' : 'PIEZAS'}` : ''}
        </span>
      </div>
      {failed && (
        <span
          role="status"
          className="shrink-0 font-mono text-d11 tracking-widest text-ink"
        >
          SEÑAL INTERRUMPIDA
        </span>
      )}
      {/* CUE/LATCH — the state chip IS the toggle: ink fill when active.
          ::before pads the hit area to ≥44px without inflating the chip. */}
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={enabled}
        data-cue="latch"
        className={`relative shrink-0 border border-ink px-2 py-1 font-mono text-d13 font-bold tracking-widest before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] disabled:opacity-50 ${
          enabled ? 'bg-ink text-paper' : 'bg-paper text-ink'
        } ${FOCUS_RING}`}
      >
        {enabled ? 'MARKETPLACE ON' : 'MARKETPLACE OFF'}
      </button>
    </li>
  )
}
