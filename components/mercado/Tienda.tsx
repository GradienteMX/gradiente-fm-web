'use client'

/**
 * TIENDA — one franja's store. Who sells, where, in what currency, and a
 * ledger of what's there (catalog facts: totals by status, nothing about
 * visits or demand). The listings stand in their crate, newest first.
 * Gradiente doesn't process payments — the page says so where you'd look
 * for a checkout. Below the crate, the franja's stickers (CALCOS): a demo
 * shelf that never charges, and says so.
 */

import { useMemo, useState } from 'react'
import type { ContentItem, MarketplaceListing, MarketplaceListingCategory } from '@/lib/types'
import type { OriginRect } from '@/lib/store/ui'
import { KIND_LABEL } from '@/components/dial/Dial'
import { Mark } from '@/components/kit/Glyph'
import { Placa } from '@/components/franja/Placa'
import { hostOf } from '@/components/franja/catalog'
import { Estante } from '@/components/stickers/Estante'
import { Panel, PanelBody, PanelHead, usePanel } from './Panel'
import { Funda } from './Funda'
import { CopyLink } from './CopyLink'
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_PLURAL, listingsOf, mercadoHref, storeStats } from './datos'
import chrome from './Chrome.module.css'
import styles from './Tienda.module.css'

interface Props {
  franja: ContentItem
  onClose: () => void
  onOpenPieza: (listing: MarketplaceListing, origin: OriginRect | null) => void
  onOpenEstacion: () => void
  origin?: OriginRect | null
  leaving?: boolean
  stacked?: boolean
}

export function Tienda({ franja, onClose, onOpenPieza, onOpenEstacion, origin, leaving, stacked }: Props) {
  return (
    <Panel label={`Tienda de ${franja.title}`} onClose={onClose} z={62} width={1180} origin={origin} leaving={leaving} stacked={stacked}>
      <TiendaBody franja={franja} onOpenPieza={onOpenPieza} onOpenEstacion={onOpenEstacion} />
    </Panel>
  )
}

function TiendaBody({ franja, onOpenPieza, onOpenEstacion }: Pick<Props, 'franja' | 'onOpenPieza' | 'onOpenEstacion'>) {
  const { close } = usePanel()
  const listings = useMemo(() => listingsOf(franja), [franja])
  const stats = useMemo(() => storeStats(listings), [listings])
  const [cat, setCat] = useState<MarketplaceListingCategory | null>(null)
  const present = useMemo(() => {
    const counts = new Map<MarketplaceListingCategory, number>()
    for (const l of listings) counts.set(l.category, (counts.get(l.category) ?? 0) + 1)
    return CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({ c, n: counts.get(c)! }))
  }, [listings])
  const shown = cat ? listings.filter((l) => l.category === cat) : listings
  const kind = franja.franjaKind ? KIND_LABEL[franja.franjaKind] : 'Franja'

  return (
    <>
      <PanelHead>
        <div className={chrome.left}>
          <span className={chrome.kind}>
            <span className={chrome.bandMark} />
            Tienda
          </span>
          <span className={chrome.crumb}>{franja.title}</span>
        </div>
        <div className={chrome.actions}>
          <button type="button" className={chrome.action} onClick={onOpenEstacion}>
            <Mark name="arrow" size={14} />
            <span>Estación de {franja.title}</span>
          </button>
          <CopyLink path={mercadoHref(franja.slug)} />
          <button type="button" className={chrome.close} onClick={close} aria-label="Cerrar la tienda (Esc)">
            <Mark name="close" size={16} />
            <kbd>Esc</kbd>
          </button>
        </div>
      </PanelHead>

      <PanelBody>
        <div className={styles.tienda}>
          <aside className={styles.id}>
            <div className={styles.idHead} data-rise="">
              <Placa franja={franja} sizes="96px" rounded="md" className={styles.placa} />
              <div className={styles.idText}>
                <span className={styles.kind}>{kind}</span>
                <h2 className={styles.name}>{franja.title}</h2>
                {franja.subtitle ? <span className={styles.sub}>{franja.subtitle}</span> : null}
              </div>
            </div>

            {franja.marketplaceDescription ? (
              <p className={styles.desc} data-rise="">
                {franja.marketplaceDescription}
              </p>
            ) : null}

            <dl className={styles.ledger} data-rise="" aria-label="Libro de la tienda">
              <div>
                <dt>Total</dt>
                <dd>{stats.total}</dd>
              </div>
              <div>
                <dt>Disponibles</dt>
                <dd>{stats.available}</dd>
              </div>
              <div>
                <dt>Reservados</dt>
                <dd>{stats.reserved}</dd>
              </div>
              <div>
                <dt>Vendidos</dt>
                <dd>{stats.sold}</dd>
              </div>
            </dl>

            <dl className={styles.facts} data-rise="">
              {franja.marketplaceLocation ? (
                <div>
                  <dt>Ubicación</dt>
                  <dd>{franja.marketplaceLocation}</dd>
                </div>
              ) : null}
              <div>
                <dt>Moneda</dt>
                <dd>{(franja.marketplaceCurrency ?? 'MXN').toUpperCase()}</dd>
              </div>
              {franja.franjaUrl ? (
                <div>
                  <dt>Web</dt>
                  <dd>
                    <a href={franja.franjaUrl} target="_blank" rel="noopener noreferrer" className={styles.web}>
                      {hostOf(franja.franjaUrl)} <Mark name="external" size={11} />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className={styles.note} data-rise="">
              <b>Gradiente no procesa pagos · trato directo con el vendedor.</b> Precio, pago y entrega se acuerdan con {franja.title}. La disponibilidad la actualiza su equipo.
            </p>
          </aside>

          <section className={styles.shelf} aria-label="Piezas de la tienda">
            <header className={styles.shelfHead}>
              <span className="label">Piezas</span>
              <span className={styles.count}>{shown.length === listings.length ? `${listings.length} en la caja · recientes primero` : `${shown.length} de ${listings.length}`}</span>
            </header>
            {present.length > 1 ? (
              <div className={styles.chips} role="group" aria-label="Filtrar por categoría">
                <button type="button" className={styles.chip} data-on={cat === null || undefined} aria-pressed={cat === null} onClick={() => setCat(null)}>
                  Todo <i>{listings.length}</i>
                </button>
                {present.map(({ c, n }) => (
                  <button key={c} type="button" className={styles.chip} data-on={cat === c || undefined} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
                    {n === 1 ? CATEGORY_LABEL[c] : CATEGORY_PLURAL[c]} <i>{n}</i>
                  </button>
                ))}
              </div>
            ) : null}
            {shown.length ? (
              <div className={styles.crate}>
                {shown.map((l, i) => (
                  <Funda key={l.id} listing={l} franja={franja} showStore={false} onOpen={onOpenPieza} priority={i < 4} sizes="(max-width: 860px) 50vw, 220px" />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>Esta tienda no tiene piezas ahora mismo. Vuelve cuando {franja.title} suba algo.</p>
            )}
            <Estante franja={franja} variant="tienda" />
          </section>
        </div>
      </PanelBody>
    </>
  )
}
