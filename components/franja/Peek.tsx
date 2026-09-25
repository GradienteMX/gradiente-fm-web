'use client'

/**
 * PEEK — a compact look at one piece from inside a franja. Poster first
 * (the art is the card), title at the piece's own energy, and a click that
 * unfolds the piece's own reading from this rect. `relation` marks pieces
 * that are not the franja's own: what happens in its room, or what others
 * wrote about it — never dressed as if it had published them.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useRef } from 'react'
import type { ContentItem } from '@/lib/types'
import { useUI } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { useDispatch, useNow } from '@/lib/store/world'
import { bandGradient, effectiveBand, energyHex, energyVariation } from '@/lib/vibe'
import { eventProximity, fmt, PROXIMITY_LABEL, ago } from '@/lib/logic/time'
import { FormatGlyph, FORMAT_LABEL } from '@/components/kit/Glyph'
import type { Relation } from './catalog'
import styles from './Peek.module.css'

/** Which flat format plate a piece sits on (TRAMA). Formats are shape + plate, never hue. */
const PLATE: Record<ContentItem['type'], string> = {
  evento: 'evento',
  mix: 'mix',
  review: 'review',
  listicle: 'lista',
  noticia: 'noticia',
  editorial: 'texto',
  opinion: 'texto',
  articulo: 'texto',
  franja: 'texto',
}

export const RELATION_LABEL: Record<Relation, string> = {
  presenta: 'Presenta',
  aqui: 'En este lugar',
  sobre: 'Sobre esta franja',
}

function useOpen(item: ContentItem) {
  const openLectura = useUI((s) => s.openLectura)
  const me = useMe()
  const dispatch = useDispatch()
  return (el: HTMLElement | null) => {
    const r = el?.getBoundingClientRect()
    if (me) dispatch({ t: 'touch', userId: me.id, itemId: item.id, kind: 'click', at: new Date().toISOString() })
    openLectura(item.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
  }
}

export function Peek({ item, relation, ratio = '4 / 5', sizes = '(max-width: 860px) 45vw, 220px' }: { item: ContentItem; relation?: Relation; ratio?: string; sizes?: string }) {
  const now = useNow()
  const art = useRef<HTMLSpanElement>(null)
  const open = useOpen(item)
  const b = effectiveBand(item)
  const mid = (b.min + b.max) / 2
  const isEvent = item.type === 'evento' && Boolean(item.date)
  const prox = isEvent ? eventProximity(item, now) : null
  return (
    <button
      type="button"
      className={styles.peek}
      data-relation={relation}
      data-past={prox === 'pasado' || undefined}
      style={{ ['--e' as string]: energyHex(mid), ['--band' as string]: bandGradient(b.min, b.max) }}
      onClick={() => open(art.current)}
      aria-label={`${FORMAT_LABEL[item.type]}: ${item.title}${relation && relation !== 'presenta' ? ` (${RELATION_LABEL[relation].toLowerCase()})` : ''}`}
    >
      <span ref={art} className={styles.art} style={{ aspectRatio: ratio }}>
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes={sizes} className={styles.img} draggable={false} />
        ) : (
          <span className={styles.plate} style={{ background: bandGradient(b.min, b.max, '160deg') }} />
        )}
        {isEvent ? (
          <span className={styles.date} data-prox={prox ?? undefined}>
            <b>{fmt.dayNum(item.date!)}</b>
            <span>{fmt.month(item.date!)}</span>
          </span>
        ) : null}
        {prox && prox !== 'pasado' && prox !== 'pronto' ? <span className={styles.prox} data-prox={prox}>{PROXIMITY_LABEL[prox]}</span> : null}
        <span className={styles.energy} aria-hidden="true" />
      </span>
      <span className={styles.text}>
        {relation ? (
          <span className={styles.relation} data-relation={relation}>
            <span className={styles.mark} aria-hidden="true" />
            {RELATION_LABEL[relation]}
          </span>
        ) : (
          <span className={styles.format} data-plate={PLATE[item.type]}>
            <FormatGlyph type={item.type} size={11} />
            {FORMAT_LABEL[item.type]}
          </span>
        )}
        <span className={styles.title} style={{ fontVariationSettings: energyVariation(mid) }}>
          {item.title}
        </span>
        <span className={styles.meta}>{metaLine(item, now)}</span>
      </span>
    </button>
  )
}

/** A ledger line for the archive: date, title, place. */
export function PeekRow({ item, relation }: { item: ContentItem; relation?: Relation }) {
  const thumb = useRef<HTMLSpanElement>(null)
  const open = useOpen(item)
  const b = effectiveBand(item)
  const mid = (b.min + b.max) / 2
  const when = item.date ?? item.publishedAt
  return (
    <button
      type="button"
      className={styles.row}
      data-relation={relation}
      style={{ ['--e' as string]: energyHex(mid), ['--band' as string]: bandGradient(b.min, b.max) }}
      onClick={() => open(thumb.current)}
    >
      <span className={styles.rowDate}>
        <b>{fmt.dayNum(when)}</b>
        <span>
          {fmt.month(when)} {new Date(when).getFullYear()}
        </span>
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle} style={{ fontVariationSettings: energyVariation(mid) }}>
          {item.title}
        </span>
        <span className={styles.rowMeta}>
          {relation && relation !== 'presenta' ? <em className={styles.rowRel}>{RELATION_LABEL[relation]} · </em> : null}
          {item.type === 'evento' ? item.venue ?? '' : FORMAT_LABEL[item.type]}
        </span>
      </span>
      <span ref={thumb} className={styles.rowThumb}>
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="56px" className={styles.img} draggable={false} /> : null}
        <span className={styles.rowBand} aria-hidden="true" />
      </span>
    </button>
  )
}

export function metaLine(item: ContentItem, now: Date): string {
  switch (item.type) {
    case 'evento':
      return [item.date ? `${fmt.weekday(item.date)} ${fmt.time(item.date)}` : null, item.venue].filter(Boolean).join(' · ')
    case 'mix':
      return [item.mixSeries, item.author, item.duration ? durationShort(item.duration) : null].filter(Boolean).join(' · ') || ago(item.publishedAt, now)
    default:
      return [item.author ? `Por ${item.author}` : null, ago(item.publishedAt, now)].filter(Boolean).join(' · ')
  }
}

function durationShort(d: string): string {
  const p = d.split(':').map(Number)
  if (p.length === 3) return `${p[0]} h ${String(p[1]).padStart(2, '0')}`
  if (p.length === 2) return `${p[0]} min`
  return d
}
