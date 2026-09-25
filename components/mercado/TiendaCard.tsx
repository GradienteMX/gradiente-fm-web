'use client'

/**
 * TIENDA CARD — a store in the Mercado's index. Its identity, a strip of what
 * it has in the crate right now (up to four covers, newest first), and
 * catalog facts: how many pieces, how many still available. Nothing else.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useMemo, useRef } from 'react'
import type { ContentItem } from '@/lib/types'
import type { OriginRect } from '@/lib/store/ui'
import { KIND_LABEL } from '@/components/dial/Dial'
import { Mark } from '@/components/kit/Glyph'
import { Placa } from '@/components/franja/Placa'
import { WhiteLabel } from './Funda'
import { listingsOf, storeStats } from './datos'
import styles from './TiendaCard.module.css'

const STRIP = 4

export function TiendaCard({ franja, onOpen }: { franja: ContentItem; onOpen: (origin: OriginRect | null) => void }) {
  const card = useRef<HTMLButtonElement>(null)
  const listings = useMemo(() => listingsOf(franja), [franja])
  const stats = storeStats(listings)
  const strip = listings.filter((l) => l.status !== 'sold').slice(0, STRIP)

  return (
    <button
      ref={card}
      type="button"
      className={styles.card}
      onClick={() => {
        const r = card.current?.getBoundingClientRect()
        onOpen(r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
      }}
      aria-label={`Tienda de ${franja.title}: ${stats.total} piezas, ${stats.available} disponibles`}
    >
      <span className={styles.id}>
        <Placa franja={franja} sizes="48px" rounded="sm" className={styles.placa} />
        <span className={styles.idText}>
          <span className={styles.name}>{franja.title}</span>
          <span className={styles.kind}>
            {franja.franjaKind ? KIND_LABEL[franja.franjaKind] : 'Franja'}
            {franja.marketplaceLocation ? ` · ${franja.marketplaceLocation}` : ''}
          </span>
        </span>
        <span className={styles.go} aria-hidden="true">
          <Mark name="arrow" size={14} />
        </span>
      </span>

      <span className={styles.strip} aria-hidden="true">
        {Array.from({ length: STRIP }, (_, i) => {
          const l = strip[i]
          return (
            <span key={l?.id ?? `vacio-${i}`} className={styles.cover} data-empty={l ? undefined : ''}>
              {l ? l.images[0] ? <Image src={l.images[0]} alt="" fill sizes="120px" className={styles.coverImg} /> : <WhiteLabel listing={l} /> : null}
            </span>
          )
        })}
      </span>

      {franja.marketplaceDescription ? <span className={styles.desc}>{franja.marketplaceDescription}</span> : null}

      <span className={styles.foot}>
        <span className={styles.fact}>
          <b>{stats.total}</b> {stats.total === 1 ? 'pieza' : 'piezas'}
        </span>
        <span className={styles.fact}>
          <b>{stats.available}</b> {stats.available === 1 ? 'disponible' : 'disponibles'}
        </span>
        <span className={styles.fact}>{(franja.marketplaceCurrency ?? 'MXN').toUpperCase()}</span>
      </span>
    </button>
  )
}
