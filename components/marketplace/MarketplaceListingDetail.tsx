'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Package,
  Truck,
  X,
} from 'lucide-react'
import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingStatus,
  MarketplaceShippingMode,
} from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'
import { PLATFORM_LABELS } from '@/components/embed/platforms'
import { ListingComments } from './ListingComments'

// ── MarketplaceListingDetail ───────────────────────────────────────────────
//
// One listing's canonical sheet. Opened from [[MarketplaceOverlay]] when the
// URL has both `?franja=<slug>&listing=<id>`; also floated directly by
// [[FranjaOverlay]], [[FranjaProfile]] and [[MapaCanvas]]. Stacks above the
// franja overlay (z-[60] vs z-50). ESC / CERRAR strips `listing` only —
// `franja` stays so the closer drops back into the franja card overlay, not
// the catalog grid.
//
// «EL PLIEGO» fase F. Two grounds, one anatomy (precedent:
// components/overlay/ShareButton.tsx):
//
//   paper (default) — the house sheet over an ink scrim, per OverlayShell.
//   dark            — the same sheet inverted onto an ink panel, for a host
//                     whose ground is deliberately dark: /mapa floats this
//                     detail straight over the terrain void, and that void
//                     is design. NOT the retired EVA chrome — same hairlines,
//                     same closed type scale, no scanlines, no glow.
//
// Layout:
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ [PIEZA] naafi/01  ID·XXXXXXXX          [← VOLVER]   [CERRAR ESC]     │
//   ├──────────────────────────────┬───────────────────────────────────────┤
//   │ IMAGE GALLERY                │ DETAIL META                            │
//   │ ┌────────────────────────┐   │ [MERCADO · NAAFI]                      │
//   │ │     MAIN IMG           │   │ TITLE                                  │
//   │ │                        │   │ CATEGORY · SUBCAT                      │
//   │ └────────────────────────┘   │ $450 MXN                               │
//   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │ ┌────────────────────────────────────┐ │
//   │ │t1│ │t2│ │t3│ │t4│         │ │ CONDICIÓN NM │ DISPONIBLE          │ │
//   │ └──┘ └──┘ └──┘ └──┘         │ └────────────────────────────────────┘ │
//   │                              │ ESCUCHA / CONTACTO / FUENTES           │
//   │                              │ DESCRIPCIÓN · ETIQUETAS · ENTREGA      │
//   │                              │ VENDEDOR · PREGUNTAS                   │
//   └──────────────────────────────┴───────────────────────────────────────┘

const CATEGORY_LABEL: Record<string, string> = {
  vinyl: 'VINYL',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTH',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TURNTABLE',
  mixer: 'MIXER',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

// The DB enum is exactly available | reserved | sold — nothing else exists.
const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'ENVÍO DIRECTO',
  local: 'RECOGIDA LOCAL',
  both: 'ENVÍO O RECOGIDA',
}

const SHIPPING_ICON: Record<MarketplaceShippingMode, typeof Truck> = {
  shipping: Truck,
  local: MapPin,
  both: Package,
}

// Gallery pane is md:w-[55%] of a max-w-5xl sheet → ~540px at its widest.
const MAIN_ART_SIZES = '(max-width: 768px) 100vw, 540px'
const THUMB_SIZES = '64px'

type SkinName = 'paper' | 'dark'

interface Skin {
  scrim: string
  panel: string
  headerBar: string
  stamp: string
  rule: string
  pane: string
  artFrame: string
  title: string
  strong: string
  label: string
  body: string
  box: string
  chip: string
  cta: string
  tag: string
  // Bare text link (the franja's own URL) — literal classes, never composed
  // at runtime: Tailwind only emits what it can see spelled out in source.
  textLink: string
  focus: string
  statusChip: Record<MarketplaceListingStatus, string>
  thumbActive: string
  thumbIdle: string
}

const SKINS: Record<SkinName, Skin> = {
  paper: {
    scrim: 'bg-ink/60',
    panel: 'border border-ink bg-paper text-ink',
    headerBar: 'border-b border-ink bg-paper-raised',
    stamp: 'bg-ink text-paper',
    rule: 'border-ink',
    pane: 'border-b border-ink bg-paper-raised md:border-b-0 md:border-r',
    artFrame: 'border border-ink bg-panel',
    title: 'text-ink',
    strong: 'text-ink',
    label: 'text-ink-faint',
    body: 'text-ink-soft',
    box: 'border border-ink bg-paper',
    chip:
      'border border-ink text-ink hover:bg-ink hover:text-paper',
    cta:
      'border border-ink bg-ink text-paper hover:bg-paper hover:text-ink',
    tag: 'border border-ink bg-paper text-ink-soft',
    textLink: 'text-ink-faint hover:text-ink',
    focus: 'focus-visible:outline-ink',
    statusChip: {
      available: 'text-ink',
      reserved: 'text-ink-soft',
      sold: 'bg-sys-red-paper px-1.5 text-paper',
    },
    thumbActive: 'border-ink opacity-100',
    thumbIdle: 'border-ink/30 opacity-70 hover:opacity-100',
  },
  dark: {
    scrim: 'bg-ink/80',
    panel: 'border border-panel-text/50 bg-panel text-panel-text',
    headerBar: 'border-b border-panel-text/40 bg-ink',
    stamp: 'bg-panel-text text-ink',
    rule: 'border-panel-text/40',
    pane: 'border-b border-panel-text/40 bg-ink md:border-b-0 md:border-r',
    artFrame: 'border border-panel-text/40 bg-ink',
    title: 'text-panel-text',
    strong: 'text-panel-text',
    label: 'text-panel-text/60',
    body: 'text-panel-text/80',
    box: 'border border-panel-text/40 bg-ink',
    chip:
      'border border-panel-text/50 text-panel-text hover:bg-panel-text hover:text-ink',
    cta:
      'border border-panel-text bg-panel-text text-ink hover:bg-panel hover:text-panel-text',
    tag: 'border border-panel-text/40 bg-ink text-panel-text/80',
    textLink: 'text-panel-text/60 hover:text-panel-text',
    focus: 'focus-visible:outline-panel-text',
    statusChip: {
      available: 'text-panel-text',
      reserved: 'text-panel-text/60',
      sold: 'bg-sys-red-paper px-1.5 text-paper',
    },
    thumbActive: 'border-panel-text opacity-100',
    thumbIdle: 'border-panel-text/30 opacity-70 hover:opacity-100',
  },
}

const FOCUS_BASE =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

// Extract an 11-char YouTube video id from the common URL shapes so the embed
// can play inline (watch?v= / youtu.be/ / embed/ / shorts/).
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

// Build a WhatsApp deep link. Accepts a full wa.me/api link verbatim or a bare
// number (strips non-digits) and attaches a prefilled message.
function waHref(raw: string, text: string): string {
  if (/^https?:\/\//i.test(raw)) return raw
  const digits = raw.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

interface Props {
  listing: MarketplaceListing
  franja: ContentItem
  // 1-based numbered position inside the franja's listings (matches the card
  // grid badge). Used in the chrome strip header.
  index: number
  onClose: () => void
  // Ground the sheet sits on. Defaults to the house paper sheet; /mapa passes
  // 'dark' because its terrain void stays dark by design.
  variant?: SkinName
}

export function MarketplaceListingDetail({
  listing,
  franja,
  index,
  onClose,
  variant = 'paper',
}: Props) {
  const skin = SKINS[variant]
  const [activeImage, setActiveImage] = useState(0)

  // ESC closes (strips ?listing= via the parent's onClose).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Reset gallery selection when the listing changes (deep-link revisit).
  useEffect(() => {
    setActiveImage(0)
  }, [listing.id])

  // Bump the view counter on open — best-effort, feeds invisible feed order.
  useEffect(() => {
    void fetch(`/api/listings/${encodeURIComponent(listing.id)}/view`, {
      method: 'POST',
    }).catch(() => {})
  }, [listing.id])

  // Clamp activeImage if the franja team trimmed the gallery while open.
  const safeActive = Math.min(activeImage, Math.max(0, listing.images.length - 1))

  const status = listing.status
  const currency = franja.marketplaceCurrency ?? ''
  const Tag = listing.shippingMode ? SHIPPING_ICON[listing.shippingMode] : null

  // First YouTube embed → inline player. Other embeds stay as link-out chips.
  const ytId =
    listing.embeds?.map((e) => youtubeId(e.url)).find((id): id is string => !!id) ??
    null
  const contactMsg = `Hola, me interesa "${listing.title}" en Gradiente.`
  const hasContact = !!(listing.saleUrl || listing.whatsapp || listing.email)

  return (
    <div
      // z-60 stacks above MarketplaceOverlay (z-50) so the franja overlay
      // stays visible under the scrim — closing this returns there.
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-detail-title"
    >
      <div className={`absolute inset-0 ${skin.scrim}`} aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex w-full max-w-5xl flex-col overflow-hidden overlay-panel-in ${skin.panel}`}
        style={{ maxHeight: 'min(94vh, 920px)' }}
      >
        <Chrome
          franja={franja}
          listing={listing}
          index={index}
          onClose={onClose}
          skin={skin}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
          {/* LEFT — gallery */}
          <section
            className={`flex w-full shrink-0 flex-col gap-3 p-4 md:w-[55%] md:p-5 ${skin.pane}`}
          >
            <ImageGallery
              listing={listing}
              activeIndex={safeActive}
              onSelect={setActiveImage}
              skin={skin}
            />
          </section>

          {/* RIGHT — detail meta */}
          <section className="flex flex-1 flex-col gap-4 p-4 md:p-5">
            <span
              className={`self-start px-2 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest ${skin.stamp}`}
            >
              MERCADO · {franja.title.toUpperCase()}
            </span>

            <div className="flex flex-col gap-1">
              <h1
                id="listing-detail-title"
                className={`font-syne text-d28 font-extrabold leading-tight ${skin.title}`}
              >
                {listing.title || '[sin título]'}
              </h1>
              <span
                className={`font-mono text-d11 uppercase tracking-widest ${skin.label}`}
              >
                {CATEGORY_LABEL[listing.category] ??
                  listing.category.toUpperCase()}
                {listing.subcategory ? ` · ${listing.subcategory}` : ''}
              </span>
            </div>

            <span
              className={`font-syne text-d28 font-extrabold tabular-nums ${skin.title}`}
            >
              ${listing.price.toLocaleString('es-MX')} {currency}
            </span>

            {/* Condition + status — the word carries the state; the dot is the
                second channel (solid = settled, hollow = held). */}
            <div
              className={`flex items-center justify-between gap-3 px-3 py-2 font-mono text-d11 uppercase tracking-widest ${skin.box}`}
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className={skin.label}>CONDICIÓN</span>
                <span className={`truncate font-bold ${skin.strong}`}>
                  {listing.condition}
                </span>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 py-0.5 font-bold ${skin.statusChip[status]}`}
              >
                {STATUS_LABEL[status]}
                <span
                  className={`h-2 w-2 shrink-0 border border-current ${
                    status === 'reserved' ? '' : 'bg-current'
                  }`}
                  aria-hidden
                />
              </span>
            </div>

            {/* Inline YouTube player — buyer hears the record before anything
                else, Amazon-style media-first. */}
            {ytId && (
              <div className="flex flex-col gap-2">
                <SectionLabel skin={skin}>ESCUCHA</SectionLabel>
                <div
                  className={`relative aspect-video w-full overflow-hidden ${skin.artFrame}`}
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title={listing.title}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Contact / buy routing — external sale link, WhatsApp, email.
                One filled primary, the rest outlined; all ≥44px. */}
            {hasContact && (
              <div className="flex flex-col gap-2">
                <SectionLabel skin={skin}>CONTACTO</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {listing.saleUrl && (
                    <a
                      href={listing.saleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-11 items-center gap-2 px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.cta} ${FOCUS_BASE} ${skin.focus}`}
                    >
                      COMPRAR / VER <ExternalLink size={12} />
                    </a>
                  )}
                  {listing.whatsapp && (
                    <a
                      href={waHref(listing.whatsapp, contactMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-11 items-center gap-2 px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
                    >
                      WHATSAPP <ExternalLink size={12} />
                    </a>
                  )}
                  {listing.email && (
                    <a
                      href={`mailto:${listing.email}?subject=${encodeURIComponent(
                        `Gradiente · ${listing.title}`,
                      )}&body=${encodeURIComponent(contactMsg)}`}
                      className={`inline-flex min-h-11 items-center gap-2 px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
                    >
                      CORREO
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Embeds — link-out chips, mirrors the [[Embed Primitive]]
                idiom used in [[ArticuloOverlay]]. Sits above description so
                a buyer sees the SoundCloud preview first when present. */}
            {listing.embeds && listing.embeds.length > 0 && (
              <div className="flex flex-col gap-2">
                <SectionLabel skin={skin}>FUENTES</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {listing.embeds.map((e) => (
                    <a
                      key={`${e.platform}-${e.url}`}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-11 items-center gap-1.5 px-2.5 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
                    >
                      {PLATFORM_LABELS[e.platform]}
                      <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {listing.description && (
              <div className="flex flex-col gap-1.5">
                <SectionLabel skin={skin}>DESCRIPCIÓN</SectionLabel>
                <p
                  className={`font-grotesk text-d15 leading-relaxed ${skin.body}`}
                >
                  {listing.description}
                </p>
              </div>
            )}

            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <SectionLabel skin={skin}>ETIQUETAS</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {listing.tags.map((t) => (
                    <span
                      key={t}
                      className={`px-1.5 py-0.5 font-mono text-d11 tracking-widest ${skin.tag}`}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {listing.shippingMode && Tag && (
              <div className="flex flex-col gap-1.5">
                <SectionLabel skin={skin}>ENTREGA</SectionLabel>
                <div
                  className={`inline-flex w-fit items-center gap-2 px-2 py-1 font-mono text-d11 uppercase tracking-widest ${skin.tag}`}
                >
                  <Tag size={12} strokeWidth={1.5} />
                  {SHIPPING_LABEL[listing.shippingMode]}
                </div>
              </div>
            )}

            {/* Related Gradiente content — editorials / lists / articles that
                touch this record. The marketplace↔content cross-link. */}
            {listing.relatedLinks && listing.relatedLinks.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <SectionLabel skin={skin}>RELACIONADO EN GRADIENTE</SectionLabel>
                <div className="flex flex-col items-start gap-1">
                  {listing.relatedLinks.map((l) => {
                    const internal = l.url.startsWith('/')
                    return (
                      <a
                        key={l.url}
                        href={l.url}
                        target={internal ? undefined : '_blank'}
                        rel={internal ? undefined : 'noopener noreferrer'}
                        className={`inline-flex min-h-11 w-fit items-center gap-1.5 px-2 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
                      >
                        → {l.label || l.url}
                        {!internal && <ExternalLink size={9} />}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col items-start gap-1.5">
              <SectionLabel skin={skin}>VENDEDOR</SectionLabel>
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex min-h-11 w-fit items-center gap-2 px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
              >
                <ArrowLeft size={11} strokeWidth={1.5} />
                {franja.title.toUpperCase()}
              </button>
              {franja.franjaUrl && (
                <a
                  href={franja.franjaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 w-fit items-center gap-1.5 font-mono text-d11 tracking-widest underline underline-offset-2 transition-colors ${skin.textLink} ${FOCUS_BASE} ${skin.focus}`}
                >
                  {franja.franjaUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>

            <p
              className={`border-t pt-3 font-grotesk text-d13 leading-relaxed ${skin.rule} ${skin.label}`}
            >
              Los mensajes privados llegan pronto — por ahora contacta al
              vendedor con los botones de arriba. Toda tu data está encriptada y
              es privada. Gradiente no procesa pagos ni envíos.
            </p>

            <ListingComments listingId={listing.id} variant={variant} />
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Section kicker — one mono label grammar for the whole sheet ────────────

function SectionLabel({
  skin,
  children,
}: {
  skin: Skin
  children: React.ReactNode
}) {
  return (
    <span
      className={`font-mono text-d11 font-bold uppercase tracking-widest ${skin.label}`}
    >
      {children}
    </span>
  )
}

// ── Chrome (top band) ──────────────────────────────────────────────────────

function Chrome({
  franja,
  listing,
  index,
  onClose,
  skin,
}: {
  franja: ContentItem
  listing: MarketplaceListing
  index: number
  onClose: () => void
  skin: Skin
}) {
  return (
    <header
      className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2 ${skin.headerBar}`}
    >
      <div className="flex min-w-0 items-center gap-3 font-mono text-d11 font-bold uppercase tracking-widest">
        <span className={`shrink-0 px-1.5 py-0.5 ${skin.stamp}`}>PIEZA</span>
        <span className={`hidden truncate sm:inline ${skin.label}`}>
          {franja.slug.toUpperCase()}/{String(index).padStart(2, '0')}
        </span>
        <span className={`shrink-0 tabular-nums ${skin.label}`}>
          ID·{listing.id.slice(-8).toUpperCase()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`hidden min-h-11 items-center gap-1.5 px-2.5 font-mono text-d11 font-bold uppercase tracking-widest transition-colors sm:flex ${skin.chip} ${FOCUS_BASE} ${skin.focus}`}
          aria-label={`Volver a ${franja.title}`}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          VOLVER
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className={`flex min-h-11 items-center gap-2 px-3 font-mono text-d11 font-bold uppercase tracking-widest transition-colors ${skin.cta} ${FOCUS_BASE} ${skin.focus}`}
        >
          <X size={12} className="sm:hidden" />
          <span>CERRAR</span>
          <span className="hidden sm:inline">ESC</span>
        </button>
      </div>
    </header>
  )
}

// ── ImageGallery (large main + thumbnail strip) ───────────────────────────

function ImageGallery({
  listing,
  activeIndex,
  onSelect,
  skin,
}: {
  listing: MarketplaceListing
  activeIndex: number
  onSelect: (i: number) => void
  skin: Skin
}) {
  const hasImages = listing.images.length > 0

  return (
    <>
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden ${skin.artFrame}`}
      >
        {hasImages ? (
          <SmartImage
            src={listing.images[activeIndex]}
            alt={listing.title}
            sizes={MAIN_ART_SIZES}
            className="object-cover"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center px-3 text-center font-mono text-d13 uppercase tracking-widest ${skin.label}`}
          >
            {CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
          </span>
        )}
      </div>

      {listing.images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {listing.images.map((src, i) => {
            const active = i === activeIndex
            return (
              <button
                key={`${i}-${src.slice(0, 16)}`}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Ver imagen ${i + 1} de ${listing.images.length}`}
                aria-pressed={active}
                className={`relative h-16 w-16 shrink-0 overflow-hidden border transition-opacity ${
                  active ? skin.thumbActive : skin.thumbIdle
                } ${FOCUS_BASE} ${skin.focus}`}
              >
                <SmartImage
                  src={src}
                  alt=""
                  sizes={THUMB_SIZES}
                  className="object-cover"
                />
                {/* Portada marker — the first image is the card thumbnail by
                    convention. No tracking here: the word has to fit 64px. */}
                {i === 0 && (
                  <span
                    className={`absolute left-0 top-0 z-10 px-0.5 font-mono text-d11 font-bold uppercase ${skin.stamp}`}
                  >
                    PORTADA
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
