'use client'

/**
 * Text on the land. Two DOM layers over the GL, both positioned by the
 * controller inside the same frame as the terrain (no swimming):
 *
 *   Rótulos — near zoom: every slab large enough carries a printed label —
 *             its code and pictogram, its date, and its title set in Anybody
 *             at its own energy — in the slab's lower band.
 *   Ficha   — the hover / keyboard card: format code, energy as a code, the
 *             title, the minimal facts, attribution. Never a count.
 */

import { memo, useCallback } from 'react'
import type { ContentItem, MarketplaceListingStatus } from '@/lib/types'
import { FormatGlyph, FORMAT_LABEL } from '@/components/kit/Glyph'
import { KIND_LABEL } from '@/components/dial/Dial'
import { energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago, eventProximity, fmt, PROXIMITY_LABEL } from '@/lib/logic/time'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import type { TerrainNode, TerrainModel } from './model'
import { CODE, PLATE, bandSteps, energyCode, eVar, onE } from './codes'
import { useCell, type Cell } from './store'
import styles from './Rotulos.module.css'

const STATUS: Record<MarketplaceListingStatus, string> = {
  available: 'Disponible',
  reserved: 'Apartado',
  sold: 'Vendido',
}

function price(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `$${n} ${currency}`
  }
}

function dateOf(item: ContentItem, archive: boolean): string {
  const iso = item.date ?? item.publishedAt
  return archive ? fmt.monthYear(iso) : fmt.short(iso).toUpperCase()
}

// ── captions ─────────────────────────────────────────────────────────────────

const Caption = memo(function Caption({ node, register }: { node: TerrainNode; register: (key: string, el: HTMLElement | null) => void }) {
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      register(node.key, el)
    },
    [node.key, register],
  )
  const mid = (node.band[0] + node.band[1]) / 2
  const big = node.size === 7
  let meta: React.ReactNode = null
  let title = ''
  if (node.kind === 'pieza' && node.item) {
    const it = node.item
    title = it.title
    meta = (
      <>
        <FormatGlyph type={it.type} size={big ? 14 : 11} />
        <span>{node.archive ? 'AR' : CODE[it.type]}</span>
        <span className={styles.dot}>·</span>
        <span>{dateOf(it, node.archive)}</span>
      </>
    )
  } else if (node.kind === 'mercado' && node.listing) {
    title = node.listing.title
    meta = (
      <>
        <span>{CODE.mercado}</span>
        <span className={styles.dot}>·</span>
        <span>{price(node.listing.price, node.franja?.marketplaceCurrency ?? 'MXN')}</span>
      </>
    )
  } else if (node.franja) {
    title = node.franja.title
    meta = (
      <>
        <span className={styles.band} aria-hidden="true" />
        <span>{node.franja.franjaKind ? KIND_LABEL[node.franja.franjaKind] : 'Franja'}</span>
      </>
    )
  }
  const e = node.kind === 'pieza' ? mid : 5
  return (
    <div ref={ref} className={styles.caption} data-size={node.size} data-kind={node.kind} aria-hidden="true">
      <div className={styles.plate}>
        {node.kind === 'pieza' ? <span className={styles.energy} style={{ background: bandSteps(node.band[0], node.band[1]) }} /> : null}
        <div className={styles.meta}>{meta}</div>
        <h3
          className={styles.title}
          style={{
            fontVariationSettings: node.kind === 'pieza' ? energyVariation(e) : '"wdth" 70, "wght" 800',
            fontSize: fitTitle(title, e, big ? 32 : 18, big ? 18 : 11, 0.86),
          }}
        >
          {title}
        </h3>
      </div>
    </div>
  )
})

export function Rotulos({ keys, model, register }: { keys: string[]; model: TerrainModel; register: (key: string, el: HTMLElement | null) => void }) {
  return (
    <div className={styles.layer} aria-hidden="true">
      {keys.map((k) => {
        const i = model.byKey.get(k)
        if (i === undefined) return null
        return <Caption key={k} node={model.nodes[i]} register={register} />
      })}
    </div>
  )
}

// ── chip ─────────────────────────────────────────────────────────────────────

export function Ficha({
  focus,
  model,
  itemsById,
  now,
  chipRef,
  keyboard,
}: {
  focus: Cell<string | null>
  model: TerrainModel | null
  itemsById: ReadonlyMap<string, ContentItem>
  now: Date
  chipRef: (el: HTMLDivElement | null) => void
  keyboard: Cell<boolean>
}) {
  const key = useCell(focus)
  const kb = useCell(keyboard)
  const i = key && model ? model.byKey.get(key) : undefined
  const node = i !== undefined && model ? model.nodes[i] : null
  return (
    <div ref={chipRef} className={styles.chip} role="status" aria-live={kb ? 'polite' : 'off'}>
      {node ? <FichaBody node={node} itemsById={itemsById} now={now} keyboard={kb} /> : null}
    </div>
  )
}

function FichaBody({ node, itemsById, now, keyboard }: { node: TerrainNode; itemsById: ReadonlyMap<string, ContentItem>; now: Date; keyboard: boolean }) {
  const open = keyboard ? 'Enter abre' : 'Clic abre'
  if (node.kind === 'pieza' && node.item) {
    const it = node.item
    const mid = (node.band[0] + node.band[1]) / 2
    const franja = it.franjaId ? itemsById.get(it.franjaId) : undefined
    const live = it.type === 'evento' && it.date ? eventProximity(it, now) : null
    let facts = ''
    if (it.type === 'evento' && it.date) {
      facts = [fmt.full(it.date), it.venue].filter(Boolean).join(' · ')
    } else if (it.type === 'mix') {
      facts = [it.mixSeries ?? it.author, it.duration].filter(Boolean).join(' · ')
    } else {
      facts = [it.author, node.archive ? fmt.monthYear(it.publishedAt) : ago(it.publishedAt, now)].filter(Boolean).join(' · ')
    }
    return (
      <>
        <div className={styles.chipTop}>
          <span className={styles.plateSwatch} style={{ background: PLATE[it.type] }} aria-hidden="true" />
          <FormatGlyph type={it.type} size={12} />
          <span>
            {CODE[it.type]} · {FORMAT_LABEL[it.type]}
          </span>
          {live === 'en-vivo' ? <span className={styles.live}>{PROXIMITY_LABEL[live]}</span> : null}
          {node.archive ? <span className={styles.tag}>Archivo</span> : null}
        </div>
        <p className={styles.chipTitle} style={{ fontVariationSettings: energyVariation(mid) }}>
          {it.title}
        </p>
        {facts ? <p className={styles.chipFacts}>{facts}</p> : null}
        <p className={styles.eCode} style={{ background: eVar(mid), color: onE(mid) }}>
          {energyCode(node.band[0], node.band[1])}
        </p>
        <div className={styles.chipFoot}>
          {franja?.franjaKind ? (
            <span className={styles.attrib}>
              <span className={styles.band} aria-hidden="true" />
              {franjaAttributionPrefix(franja.franjaKind)} · {franja.title}
            </span>
          ) : (
            <span />
          )}
          <span className={styles.hint}>{open}</span>
        </div>
      </>
    )
  }
  if (node.kind === 'mercado' && node.listing) {
    const l = node.listing
    return (
      <>
        <div className={styles.chipTop}>
          <span className={styles.plateSwatch} style={{ background: PLATE.mercado }} aria-hidden="true" />
          <span>
            {CODE.mercado} · Mercado{node.franja ? ` — ${node.franja.title}` : ''}
          </span>
        </div>
        <p className={styles.chipTitle} style={{ fontVariationSettings: '"wdth" 92, "wght" 640' }}>
          {l.title}
        </p>
        <p className={styles.chipFacts}>
          {price(l.price, node.franja?.marketplaceCurrency ?? 'MXN')} · {STATUS[l.status]} · {l.condition}
        </p>
        <div className={styles.chipFoot}>
          <span />
          <span className={styles.hint}>{keyboard ? 'Enter: ver en el mercado' : 'Clic: ver en el mercado'}</span>
        </div>
      </>
    )
  }
  const f = node.franja
  if (!f) return null
  return (
    <>
      <div className={styles.chipTop}>
        <span className={styles.band} aria-hidden="true" />
        <span>
          {CODE.franja} · {f.franjaKind ? KIND_LABEL[f.franjaKind] : 'Franja'}
        </span>
      </div>
      <p className={styles.chipTitle} style={{ fontVariationSettings: '"wdth" 70, "wght" 800' }}>
        {f.title}
      </p>
      <div className={styles.chipFoot}>
        <span />
        <span className={styles.hint}>{keyboard ? 'Enter: entrar al dossier' : 'Clic: entrar al dossier'}</span>
      </div>
    </>
  )
}
