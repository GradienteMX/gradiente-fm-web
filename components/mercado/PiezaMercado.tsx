'use client'

/**
 * PIEZA DE MERCADO — one listing, read closely. The photos lead (arrow keys
 * walk the gallery, the first one is the portada); then what it is, what it
 * costs in the store's currency, the state it's in — graded in words anyone
 * can read — and every route to the seller. None of those routes pass
 * through Gradiente: we don't process payments, and we say so at the point
 * you'd expect a checkout. Views are never shown; nothing here touches HL.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useEffect, useId, useMemo, useState } from 'react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import type { OriginRect } from '@/lib/store/ui'
import { useUI } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { useNow } from '@/lib/store/world'
import { ago } from '@/lib/logic/time'
import { PLATFORM_LABEL } from '@/lib/store/player'
import { KIND_LABEL } from '@/components/dial/Dial'
import { Mark } from '@/components/kit/Glyph'
import { Placa } from '@/components/franja/Placa'
import { hostOf } from '@/components/franja/catalog'
import { Panel, PanelBody, PanelHead, usePanel } from './Panel'
import { WhiteLabel } from './Funda'
import { Estado } from './Estado'
import { CopyLink } from './CopyLink'
import { Preguntas } from './Preguntas'
import { CATEGORY_LABEL, CONDITION, contactLine, formatPrice, mercadoHref, SHIPPING_LABEL, SHIPPING_MEANING, subLabel, waHref, youtubeId } from './datos'
import chrome from './Chrome.module.css'
import styles from './PiezaMercado.module.css'

interface Props {
  franja: ContentItem
  listing: MarketplaceListing
  index: number
  total: number
  /** One level back (Esc, backdrop, ← Volver). */
  onBack: () => void
  backLabel: string
  /** ✕ — the whole stack. */
  onCloseAll: () => void
  onOpenEstacion: () => void
  /** Open a Gradiente piece (related links). */
  onOpenItem: (slug: string) => void
  origin?: OriginRect | null
  leaving?: boolean
}

export function PiezaMercado(props: Props) {
  const { listing, onBack, origin, leaving } = props
  return (
    <Panel label={`Pieza de mercado: ${listing.title}`} onClose={onBack} z={70} width={1160} origin={origin} leaving={leaving} stacked>
      <PiezaBody {...props} />
    </Panel>
  )
}

function PiezaBody({ franja, listing, index, total, backLabel, onCloseAll, onOpenEstacion, onOpenItem }: Props) {
  const { close } = usePanel()
  const me = useMe()
  const now = useNow()
  const openReport = useUI((s) => s.openReport)
  const price = formatPrice(listing.price, franja.marketplaceCurrency)
  const sub = subLabel(listing.subcategory)
  const yt = useMemo(() => (listing.embeds ?? []).map((e) => (e.platform === 'youtube' ? youtubeId(e.url) : null)).find((x): x is string => Boolean(x)) ?? null, [listing.embeds])
  const msg = contactLine(listing.title)
  const hasRoute = Boolean(listing.saleUrl || listing.whatsapp || listing.email)

  return (
    <>
      <PanelHead>
        <div className={chrome.left}>
          <button type="button" className={chrome.back} onClick={close}>
            <Mark name="arrow" size={14} />
            {backLabel}
          </button>
          <span className={chrome.kind}>
            <span className={chrome.bandMark} />
            Pieza
          </span>
          <span className={chrome.crumb}>
            {franja.title} · {String(index).padStart(2, '0')} de {String(total).padStart(2, '0')}
          </span>
        </div>
        <div className={chrome.actions}>
          {me ? (
            <button type="button" className={chrome.action} onClick={() => openReport({ type: 'listing', id: listing.id, label: listing.title })} title="Reportar esta pieza" aria-label="Reportar esta pieza">
              <Mark name="flag" size={15} />
            </button>
          ) : null}
          <CopyLink path={mercadoHref(franja.slug, listing.id)} />
          <button type="button" className={chrome.close} onClick={onCloseAll} aria-label="Cerrar el mercado">
            <Mark name="close" size={16} />
            <kbd>Esc</kbd>
          </button>
        </div>
      </PanelHead>

      <PanelBody>
        <div className={styles.pieza}>
          <div className={styles.galleryCol}>
            <Galeria listing={listing} />
          </div>

          <div className={styles.info}>
            <header className={styles.head} data-rise="">
              <span className={styles.kicker}>
                Mercado · {franja.title}
              </span>
              <h1 className={styles.title}>{listing.title || 'Sin título'}</h1>
              <span className={styles.cat}>
                {CATEGORY_LABEL[listing.category]}
                {sub ? ` · ${sub}` : ''}
                <span className={styles.dim}> · subida {ago(listing.publishedAt, now)}</span>
              </span>
            </header>

            <div className={styles.priceRow} data-rise="">
              <span className={styles.price}>
                {price.amount}
                <small>{price.code}</small>
              </span>
              <div className={styles.state}>
                <Condicion code={listing.condition} />
                <Estado status={listing.status} size="md" />
              </div>
            </div>

            <section className={styles.block} data-rise="" aria-label="Contacto">
              <p className="label">Contacto</p>
              {hasRoute ? (
                <div className={styles.routes}>
                  {listing.saleUrl ? (
                    <a href={listing.saleUrl} target="_blank" rel="noopener noreferrer" className={styles.buy}>
                      {listing.status === 'sold' ? 'Ver' : 'Comprar / ver'}
                      <span className={styles.via}>en {hostOf(listing.saleUrl).split('/')[0]}</span>
                      <Mark name="external" size={13} />
                    </a>
                  ) : null}
                  {listing.whatsapp ? (
                    <a href={waHref(listing.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className={styles.route}>
                      <WaGlyph />
                      WhatsApp
                    </a>
                  ) : null}
                  {listing.email ? (
                    <a href={`mailto:${listing.email}?subject=${encodeURIComponent(`Gradiente · ${listing.title}`)}&body=${encodeURIComponent(msg)}`} className={styles.route}>
                      <MailGlyph />
                      Correo
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className={styles.fallback}>
                  Esta pieza no trae un enlace de venta propio.{' '}
                  {franja.franjaUrl ? (
                    <>
                      Escríbele a {franja.title} por su canal —{' '}
                      <a href={franja.franjaUrl} target="_blank" rel="noopener noreferrer" className={styles.inline}>
                        {hostOf(franja.franjaUrl)} <Mark name="external" size={11} />
                      </a>{' '}
                      — o pregunta aquí abajo.
                    </>
                  ) : (
                    <>Pregunta aquí abajo: responde {franja.title}.</>
                  )}
                </p>
              )}
              <p className={styles.nopay}>Gradiente no procesa pagos · el trato es directo con el vendedor.</p>
            </section>

            {listing.embeds?.length ? (
              <section className={styles.block} aria-label="Escucha">
                <p className="label">Escucha</p>
                {yt ? (
                  <div className={styles.video}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
                      title={`${listing.title} — YouTube`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                ) : null}
                <div className={styles.sources}>
                  {listing.embeds.map((e) => (
                    <a key={`${e.platform}:${e.url}`} href={e.url} target="_blank" rel="noopener noreferrer" className={styles.source}>
                      {PLATFORM_LABEL[e.platform]}
                      <Mark name="external" size={11} />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {listing.description ? (
              <section className={styles.block} aria-label="Descripción">
                <p className="label">Descripción</p>
                <p className={styles.desc}>{listing.description}</p>
              </section>
            ) : null}

            {listing.tags?.length ? (
              <section className={styles.block} aria-label="Etiquetas">
                <p className="label">Etiquetas</p>
                <div className={styles.tags}>
                  {listing.tags.map((t) => (
                    <span key={t} className={styles.tag}>
                      #{t}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {listing.shippingMode ? (
              <section className={styles.block} aria-label="Entrega">
                <p className="label">Entrega</p>
                <p className={styles.ship}>
                  <b>{SHIPPING_LABEL[listing.shippingMode]}</b>
                  <span>
                    {SHIPPING_MEANING[listing.shippingMode]}
                    {franja.marketplaceLocation && listing.shippingMode !== 'shipping' ? ` Sale de ${franja.marketplaceLocation}.` : ''}
                  </span>
                </p>
              </section>
            ) : null}

            {listing.relatedLinks?.length ? (
              <section className={styles.block} aria-label="Relacionado en Gradiente">
                <p className="label">Relacionado en Gradiente</p>
                <div className={styles.related}>
                  {listing.relatedLinks.map((l) => (
                    <Relacionado key={l.url} label={l.label} url={l.url} onOpenItem={onOpenItem} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.block} aria-label="Vendedor">
              <p className="label">Vendedor</p>
              <button type="button" className={styles.seller} onClick={onOpenEstacion}>
                <Placa franja={franja} sizes="48px" rounded="sm" className={styles.sellerPlaca} />
                <span className={styles.sellerText}>
                  <span className={styles.sellerKind}>{franja.franjaKind ? KIND_LABEL[franja.franjaKind] : 'Franja'}{franja.marketplaceLocation ? ` · ${franja.marketplaceLocation}` : ''}</span>
                  <span className={styles.sellerName}>{franja.title}</span>
                </span>
                <span className={styles.sellerGo}>
                  Estación <Mark name="arrow" size={13} />
                </span>
              </button>
            </section>

            <p className={styles.disclaimer}>
              Gradiente no procesa pagos ni envíos y no guarda tus datos de compra. Precio, pago y entrega se acuerdan directamente con {franja.title}. Si algo no cuadra, repórtalo.
            </p>

            <Preguntas listing={listing} franja={franja} />
          </div>
        </div>
      </PanelBody>
    </>
  )
}

// ── gallery ─────────────────────────────────────────────────────────────────

function Galeria({ listing }: { listing: MarketplaceListing }) {
  const { isTop } = usePanel()
  const images = listing.images
  const n = images.length
  const [i, setI] = useState(0)
  const at = Math.min(i, Math.max(0, n - 1))

  useEffect(() => {
    if (n < 2) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (!isTop()) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setI((x) => (Math.min(x, n - 1) + 1) % n)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setI((x) => (Math.min(x, n - 1) - 1 + n) % n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, isTop])

  return (
    <div className={styles.gallery} data-rise="">
      <div className={styles.main} data-empty={!n || undefined}>
        {n ? (
          <>
            <Image key={`fg-${at}`} src={images[at]} alt={`${listing.title} — foto ${at + 1} de ${n}`} fill sizes="(max-width: 860px) 100vw, 560px" className={styles.mainImg} priority />
            {n > 1 ? (
              <>
                <button type="button" className={styles.nav} data-dir="prev" onClick={() => setI((at - 1 + n) % n)} aria-label="Foto anterior (←)">
                  <Mark name="arrow" size={16} />
                </button>
                <button type="button" className={styles.nav} data-dir="next" onClick={() => setI((at + 1) % n)} aria-label="Foto siguiente (→)">
                  <Mark name="arrow" size={16} />
                </button>
                <span className={styles.counter}>
                  {at + 1} / {n}
                </span>
              </>
            ) : null}
          </>
        ) : (
          <WhiteLabel listing={listing} size="lg" />
        )}
      </div>
      {n > 1 ? (
        <div className={styles.thumbs} role="group" aria-label="Fotos">
          {images.map((src, k) => (
            <button key={`${k}:${src}`} type="button" className={styles.thumb} data-on={k === at || undefined} aria-pressed={k === at} aria-label={`Foto ${k + 1}${k === 0 ? ' (portada)' : ''}`} onClick={() => setI(k)}>
              <Image src={src} alt="" fill sizes="72px" className={styles.thumbImg} />
              {k === 0 ? <span className={styles.portada}>Portada</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {!n ? <p className={styles.noPhoto}>Sin fotos todavía: pídelas en las preguntas.</p> : null}
    </div>
  )
}

// ── condition, graded in words ──────────────────────────────────────────────

function Condicion({ code }: { code: MarketplaceListing['condition'] }) {
  const id = useId()
  const c = CONDITION[code]
  return (
    <span className={styles.cond}>
      <button type="button" className={styles.condChip} aria-describedby={id}>
        <b>{code}</b>
        <span>{c.label}</span>
        <i aria-hidden="true">?</i>
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {c.meaning}
      </span>
    </span>
  )
}

// ── related Gradiente links ─────────────────────────────────────────────────

function Relacionado({ label, url, onOpenItem }: { label: string; url: string; onOpenItem: (slug: string) => void }) {
  const internal = url.startsWith('/')
  const item = internal ? new URLSearchParams(url.split('?')[1] ?? '').get('item') : null
  if (item)
    return (
      <button type="button" className={styles.rel} onClick={() => onOpenItem(item)}>
        {label || 'Leer'} <Mark name="arrow" size={12} />
      </button>
    )
  if (internal)
    return (
      <Link href={url} className={styles.rel}>
        {label || url} <Mark name="arrow" size={12} />
      </Link>
    )
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.rel}>
      {label || hostOf(url)} <Mark name="external" size={11} />
    </a>
  )
}

function WaGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.2 15.8 5 12.9a6.6 6.6 0 1 1 2.4 2.3z" />
      <path d="M8 7.6c.2 1.9 1.6 3.6 3.9 4.3l.9-1-1.3-.8-.6.6c-.8-.4-1.4-1-1.8-1.8l.6-.6-.8-1.3z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function MailGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10.5" rx="1.2" />
      <path d="m3.5 6 6.5 5 6.5-5" />
    </svg>
  )
}
