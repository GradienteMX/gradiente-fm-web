'use client'

/**
 * ESTACIÓN — a franja, tuned in.
 *
 * Franjas are bands on the dial, so their peek behaves like a receiver: the
 * needle sweeps to the station's frequency and the static clears into its
 * identity (see Sintonia). Left, who it is — logo plate, name set in its own
 * energy, what kind of band, when it last gave signal, its way out to the
 * web. Right, what it has put its name on: catalog facts, a slot that leads
 * with what its kind is about (a venue's next nights, a label's releases, a
 * dealer's inventory…), its archive of past nights and, if it has one, its
 * crate in the Mercado.
 *
 * Never inside the mosaic, deaf to the Horizonte, ordered by last signal —
 * and no followers or visits anywhere. Following is private.
 */

import Link from 'next/link'
import { useRef } from 'react'
import { useNow } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { effectiveBand, energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { KIND_LABEL } from '@/components/dial/Dial'
import { Mark } from '@/components/kit/Glyph'
import { Button } from '@/components/kit/Button'
import { ARCHIVE_LABEL, hostOf, KIND_SLOT, lastSignal, type ArchiveKey } from '@/components/franja/catalog'
import { useFranjaCatalog, useFrequency } from '@/components/franja/useFranja'
import { Escala, useSintonia } from '@/components/franja/Sintonia'
import { Placa } from '@/components/franja/Placa'
import { Banda, Ficha } from '@/components/franja/Ficha'
import { Peek, PeekRow } from '@/components/franja/Peek'
import { Seguir } from '@/components/franja/Seguir'
import { Funda } from '@/components/mercado/Funda'
import { Pila, useLocalPila } from '@/components/mercado/Pila'
import { listingsOf, storeStats } from '@/components/mercado/datos'
import type { ReaderProps } from './parts'
import styles from './Estacion.module.css'

const SLOT_MAX = 8
const LATEST_MAX = 4
const ARCHIVE_MAX = 6
const SHELF_MAX = 6

export function Estacion({ item: franja }: ReaderProps) {
  const now = useNow()
  const root = useRef<HTMLElement>(null)
  const cat = useFranjaCatalog(franja)
  const { freq } = useFrequency(franja.id)
  const pila = useLocalPila()
  const openLectura = useUI((s) => s.openLectura)

  const kind = franja.franjaKind ?? 'colectivo'
  const slot = KIND_SLOT[kind]
  const listings = listingsOf(franja)
  const stats = storeStats(listings)
  const b = effectiveBand(franja)
  const mid = (b.min + b.max) / 2
  useSintonia(root, freq, mid)
  const dossier = `/f/${franja.slug}`
  const archivoHref = (key: ArchiveKey) => `${dossier}?archivo=${key}#archivo`
  const links = (franja.links ?? []).filter((l) => l.url !== franja.franjaUrl)

  const mixedUpcoming = cat.upcoming.some((e) => e.relation !== 'presenta')
  const mixedPast = cat.past.some((e) => e.relation !== 'presenta')
  const openTienda = () => pila.onState({ tienda: true, pieza: null })
  let k = 0
  const n = () => String(++k).padStart(2, '0')
  const shelf = listings.slice(0, slot.mode === 'inventario' ? SLOT_MAX : SHELF_MAX)

  return (
    <article ref={root} className={styles.estacion} aria-label={`Estación: ${franja.title}`}>
      {/* ── identity ─────────────────────────────────────────────────── */}
      <aside className={styles.id}>
        <Escala freq={freq} />

        <div className={styles.plate} data-sint-plate="">
          <Placa franja={franja} sizes="(max-width: 860px) 80vw, 340px" priority rounded="md" imprimir />
        </div>

        <div className={styles.chips}>
          <span className={styles.kind}>
            <span className={styles.bandMark} aria-hidden="true" />
            {KIND_LABEL[kind]}
          </span>
          {franja.verified ? (
            <span className={styles.verified} title="Franja verificada por Gradiente">
              <Mark name="check" size={11} />
              Verificada
            </span>
          ) : null}
          {franja.sponsored ? (
            <span className={styles.sponsored} title="Gradiente tiene un acuerdo comercial con esta franja. Su lugar en el dial no cambia por eso.">
              Acuerdo comercial
            </span>
          ) : null}
        </div>

        <div className={styles.nameBox}>
          <h2 data-sint-name="" data-trama="pendiente" className={styles.name} style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(franja.title, mid, 54, 26, 0.96) }}>
            {franja.title}
          </h2>
        </div>
        {franja.subtitle ? <p className={styles.subtitle}>{franja.subtitle}</p> : null}

        <p className={styles.signal}>
          <span className={styles.signalDot} aria-hidden="true" />
          <span>
            Señal {ago(lastSignal(franja), now)}
            {franja.marketplaceLocation ? <span className={styles.dim}> · {franja.marketplaceLocation}</span> : null}
          </span>
        </p>

        {franja.excerpt ? <p className={styles.bio}>{franja.excerpt}</p> : null}

        <div className={styles.actions}>
          <Button variant="ink" size="lg" href={dossier} iconRight={<Mark name="arrow" size={15} />} full>
            Entrar al dossier
          </Button>
          <div className={styles.actionRow}>
            <Seguir franja={franja} />
            {franja.franjaUrl ? (
              <Button variant="ghost" href={franja.franjaUrl} icon={<Mark name="external" size={13} />} aria-label={`Visitar sitio (sale de Gradiente): ${hostOf(franja.franjaUrl)}`}>
                Visitar sitio
              </Button>
            ) : null}
          </div>
          {franja.franjaUrl || links.length ? (
            <p className={styles.out}>
              {franja.franjaUrl ? <span>{hostOf(franja.franjaUrl)}</span> : null}
              {links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.label} <Mark name="external" size={10} />
                </a>
              ))}
            </p>
          ) : null}
        </div>
      </aside>

      {/* ── catalog ──────────────────────────────────────────────────── */}
      <div className={styles.content}>
        <section className={styles.block} aria-label="Catálogo" data-rise="">
          <Head n={n()} label="Catálogo" note="lo que lleva su nombre" />
          <Ficha facts={cat.facts} hrefFor={archivoHref} onProductos={listings.length ? openTienda : undefined} />
          <Banda spectrum={cat.spectrum} />
          {cat.presenta.length === 0 ? (
            <p className={styles.honest}>
              {franja.title} todavía no publica en Gradiente. Cuando su equipo publique desde el Taller — eventos, mixes, noticias, listas —, cada pieza llevará su nombre y aparecerá aquí{listings.length ? '. Mientras, su tienda está abierta.' : '.'}
            </p>
          ) : null}
        </section>

        {slot.mode === 'eventos' && (cat.upcoming.length || cat.presenta.length) ? (
          <section className={styles.block} aria-label={slot.label} data-rise="">
            <Head n={n()} label={slot.label} note={cat.upcoming.length ? `${cat.upcoming.length} en agenda` : undefined} more={cat.upcoming.length > SLOT_MAX ? { href: `${dossier}#proximos`, label: 'Todas en el dossier' } : undefined} />
            {cat.upcoming.length ? (
              <div className={styles.posters}>
                {cat.upcoming.slice(0, SLOT_MAX).map((e) => (
                  <Peek key={e.item.id} item={e.item} relation={mixedUpcoming ? e.relation : undefined} ratio={slot.ratio} />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>{slot.empty}</p>
            )}
          </section>
        ) : null}

        {slot.mode === 'piezas' && cat.presenta.length ? (
          <section className={styles.block} aria-label={slot.label} data-rise="">
            <Head n={n()} label={slot.label} note={cat.slotPieces.length ? `${cat.slotPieces.length} en el archivo` : undefined} more={cat.slotPieces.length > SLOT_MAX ? { href: archivoHref(kind === 'label' || kind === 'mix-series' ? 'lanzamientos' : 'todo'), label: 'Todo en el dossier' } : undefined} />
            {cat.slotPieces.length ? (
              <div className={styles.posters} data-square={slot.ratio === '1 / 1' || undefined}>
                {cat.slotPieces.slice(0, SLOT_MAX).map((i) => (
                  <Peek key={i.id} item={i} ratio={slot.ratio} />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>{slot.empty}</p>
            )}
          </section>
        ) : null}

        {slot.mode === 'inventario' ? (
          <section className={styles.block} aria-label={slot.label} data-rise="">
            <Head n={n()} label={slot.label} note={listings.length ? `${stats.available} de ${stats.total} disponibles` : undefined} />
            {shelf.length ? (
              <>
                <div className={styles.shelf}>
                  {shelf.map((l) => (
                    <Funda key={l.id} listing={l} franja={franja} showStore={false} onOpen={(x, o) => pila.onState({ tienda: false, pieza: x.id }, o)} sizes="180px" />
                  ))}
                </div>
                <Button variant="ghost" onClick={openTienda} iconRight={<Mark name="arrow" size={13} />}>
                  Abrir la tienda
                </Button>
              </>
            ) : (
              <p className={styles.empty}>{slot.empty}</p>
            )}
          </section>
        ) : null}

        {slot.mode !== 'piezas' && cat.latest.length ? (
          <section className={styles.block} aria-label={`Lo último de ${franja.title}`} data-rise="">
            <Head n={n()} label={`Lo último de ${franja.title}`} more={cat.latest.length > LATEST_MAX ? { href: archivoHref('todo'), label: 'Todo el archivo' } : undefined} />
            <div className={styles.posters} data-few="">
              {cat.latest.slice(0, LATEST_MAX).map((i) => (
                <Peek key={i.id} item={i} ratio={i.type === 'mix' ? '1 / 1' : '4 / 5'} />
              ))}
            </div>
          </section>
        ) : null}

        {cat.past.length ? (
          <section className={styles.block} aria-label="Archivo" data-rise="">
            <Head n={n()} label={`Archivo · ${ARCHIVE_LABEL[kind].toLowerCase()}`} note={`${cat.past.length}`} more={{ href: archivoHref('eventos'), label: 'El archivo completo' }} />
            <div className={styles.rows}>
              {cat.past.slice(0, ARCHIVE_MAX).map((e) => (
                <PeekRow key={e.item.id} item={e.item} relation={mixedPast ? e.relation : undefined} />
              ))}
            </div>
          </section>
        ) : null}

        {slot.mode !== 'inventario' && listings.length ? (
          <section className={styles.block} aria-label="Mercado" data-rise="">
            <Head
              n={n()}
              label="Mercado"
              note={`${stats.total} ${stats.total === 1 ? 'pieza' : 'piezas'} · ${stats.available} ${stats.available === 1 ? 'disponible' : 'disponibles'}`}
              action={{ label: 'Abrir la tienda', onClick: openTienda }}
            />
            <div className={styles.shelf}>
              {shelf.map((l) => (
                <Funda key={l.id} listing={l} franja={franja} showStore={false} onOpen={(x, o) => pila.onState({ tienda: false, pieza: x.id }, o)} sizes="180px" />
              ))}
            </div>
            <p className={styles.nopay}>Gradiente no procesa pagos · el trato es directo con {franja.title}.</p>
          </section>
        ) : null}
      </div>

      <Pila
        franja={franja}
        state={pila.state}
        origin={pila.origin}
        leaving={pila.leaving}
        baseLabel="Volver a la estación"
        onState={pila.onState}
        onCloseAll={pila.closeAll}
        onOpenEstacion={pila.closeAll}
        onOpenItem={(slug) => {
          pila.closeAll()
          openLectura(slug)
        }}
        stacked
      />
    </article>
  )
}

function Head({
  n,
  label,
  note,
  more,
  action,
}: {
  n: string
  label: string
  note?: string
  more?: { href: string; label: string }
  action?: { label: string; onClick: () => void }
}) {
  return (
    <header className={styles.head}>
      <span className={styles.idx}>
        {n} / {label}
      </span>
      {note ? <span className={styles.note}>{note}</span> : null}
      {more ? (
        <Link href={more.href} className={styles.more}>
          {more.label} <Mark name="arrow" size={12} />
        </Link>
      ) : null}
      {action ? (
        <button type="button" className={styles.more} onClick={action.onClick}>
          {action.label} <Mark name="arrow" size={12} />
        </button>
      ) : null}
    </header>
  )
}
