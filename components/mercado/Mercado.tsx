'use client'

/**
 * MERCADO — the franjas' crate.
 *
 * Piezas first: every listing from every open store, newest first — no
 * popularity, no "trending", listing views never read. You flip through it
 * like a crate: sleeves stand in rows, reaching for one pulls it up. Then the
 * Tiendas, ordered by how much they have in the crate. Commerce never touches
 * HL and Gradiente never touches the money: each store deals directly.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { MarketplaceListingCategory, MarketplaceListingStatus } from '@/lib/types'
import { useItems } from '@/lib/store/world'
import { Mark } from '@/components/kit/Glyph'
import { Funda } from './Funda'
import { TiendaCard } from './TiendaCard'
import { MercadoUrlHost, useMercadoNav } from './Pila'
import { CATEGORY_ORDER, CATEGORY_PLURAL, listingsOf, marketFeed, STATUS_LABEL, storeStats } from './datos'
import styles from './Mercado.module.css'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'

type EstadoFiltro = 'todo' | MarketplaceListingStatus
const ESTADOS: EstadoFiltro[] = ['todo', 'available', 'reserved', 'sold']

export function Mercado() {
  return (
    <Suspense fallback={null}>
      <MercadoBody />
      <MercadoUrlHost />
    </Suspense>
  )
}

function MercadoBody() {
  const items = useItems()
  const params = useSearchParams()
  const pathname = usePathname() ?? '/mercado'
  const { openTienda, openPieza } = useMercadoNav()

  const stores = useMemo(() => items.filter((i) => i.type === 'franja' && i.marketplaceEnabled), [items])
  const feed = useMemo(() => marketFeed(stores), [stores])
  const tiendas = useMemo(
    () => [...stores].sort((a, b) => listingsOf(b).length - listingsOf(a).length || a.title.localeCompare(b.title, 'es')),
    [stores],
  )
  const all = useMemo(() => storeStats(feed.map((e) => e.listing)), [feed])

  const urlCat = params.get('categoria') as MarketplaceListingCategory | null
  const urlEstado = params.get('estado') as EstadoFiltro | null
  const [cat, setCat] = useState<MarketplaceListingCategory | null>(urlCat && CATEGORY_ORDER.includes(urlCat) ? urlCat : null)
  const [estado, setEstado] = useState<EstadoFiltro>(urlEstado && ESTADOS.includes(urlEstado) ? urlEstado : 'todo')

  // Filters live in the URL too, so a crate view can be shared.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (cat) q.set('categoria', cat)
    else q.delete('categoria')
    if (estado !== 'todo') q.set('estado', estado)
    else q.delete('estado')
    const s = q.toString()
    const next = s ? `${pathname}?${s}` : pathname
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next)
  }, [cat, estado, pathname])

  const byCat = useMemo(() => {
    const m = new Map<MarketplaceListingCategory, number>()
    for (const e of feed) if (estado === 'todo' || e.listing.status === estado) m.set(e.listing.category, (m.get(e.listing.category) ?? 0) + 1)
    return m
  }, [feed, estado])
  const shown = feed.filter((e) => (!cat || e.listing.category === cat) && (estado === 'todo' || e.listing.status === estado))

  return (
    <div className={styles.mercado}>
      <Cabecera
        librea={LIBREA_SECCION.mercado}
        lema="Discos, cintas, equipo, merch y stickers de las franjas del dial. Cada tienda vende directo: Gradiente no procesa pagos."
        datos={[
          { k: stores.length === 1 ? 'tienda' : 'tiendas', v: String(stores.length).padStart(2, '0') },
          { k: all.total === 1 ? 'pieza' : 'piezas', v: String(all.total).padStart(2, '0') },
          { k: all.available === 1 ? 'disponible' : 'disponibles', v: String(all.available).padStart(2, '0') },
        ]}
      />

      <section className={styles.section} aria-label="Piezas">
        <header className={styles.sectionHead}>
          <span className={styles.sectionIdx}>01 /</span>
          <h2 className={styles.sectionTitle}>Piezas</h2>
          <span className={styles.sectionNote}>de todas las tiendas · las más recientes primero</span>
        </header>

        <div className={styles.filters}>
          <div className={styles.chips} role="group" aria-label="Categoría">
            <button type="button" className={styles.chip} data-on={cat === null || undefined} aria-pressed={cat === null} onClick={() => setCat(null)}>
              Todo <i>{[...byCat.values()].reduce((s, n) => s + n, 0)}</i>
            </button>
            {CATEGORY_ORDER.map((c) => {
              const n = byCat.get(c) ?? 0
              return (
                <button key={c} type="button" className={styles.chip} data-on={cat === c || undefined} aria-pressed={cat === c} disabled={!n && cat !== c} onClick={() => setCat(cat === c ? null : c)} title={n ? undefined : `Sin ${CATEGORY_PLURAL[c].toLowerCase()} en la caja ahora`}>
                  {CATEGORY_PLURAL[c]} <i>{n}</i>
                </button>
              )
            })}
          </div>
          <div className={styles.estados} role="radiogroup" aria-label="Estado">
            {ESTADOS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={estado === s} className={styles.estado} data-on={estado === s || undefined} onClick={() => setEstado(s)}>
                {s !== 'todo' ? <span className={styles.dot} data-status={s} aria-hidden="true" /> : null}
                {s === 'todo' ? 'Todo' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {shown.length ? (
          <div className={styles.crate}>
            {shown.map((e, i) => (
              <Funda key={e.listing.id} listing={e.listing} franja={e.franja} onOpen={(l, o) => openPieza(e.franja.slug, l.id, o)} priority={i < 6} sizes="(max-width: 700px) 50vw, (max-width: 1200px) 25vw, 240px" />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>
              {feed.length ? 'No hay piezas con estos filtros ahora mismo.' : 'La caja está vacía: ninguna tienda tiene piezas ahora mismo.'}
            </p>
            {cat || estado !== 'todo' ? (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  setCat(null)
                  setEstado('todo')
                }}
              >
                Soltar los filtros <Mark name="close" size={12} />
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className={styles.section} aria-label="Tiendas">
        <header className={styles.sectionHead}>
          <span className={styles.sectionIdx}>02 /</span>
          <h2 className={styles.sectionTitle}>Tiendas</h2>
          <span className={styles.sectionNote}>por lo que tienen en la caja</span>
        </header>
        {tiendas.length ? (
          <div className={styles.stores}>
            {tiendas.map((f) => (
              <TiendaCard key={f.id} franja={f} onOpen={(o) => openTienda(f.slug, o)} />
            ))}
          </div>
        ) : (
          <p className={styles.honest}>Ninguna franja tiene su tienda abierta todavía.</p>
        )}
        <p className={styles.how}>Las tiendas son de franjas del dial: sus equipos suben las piezas y las marcan como reservadas o vendidas. Pago, envío y entrega se acuerdan directo con quien vende — Gradiente solo es el lugar donde se encuentran.</p>
      </section>
    </div>
  )
}
