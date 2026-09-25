'use client'

/**
 * CARTEL — one thread pasted on the wall.
 *
 * A printed poster: the cover on top carrying its codes (the slot it holds,
 * its reply count), a flat caption block beneath with the subject set at the
 * thread's energy and when it last moved. Hover or focus lifts it a little
 * and slides up a strip with its genres and author. Its bottom edge is the
 * energy line — hue is the band of its genres; its strength is how recently
 * it moved (time, never attention).
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { memo } from 'react'
import type { ForoThread } from '@/lib/types'
import { energyVariation } from '@/lib/vibe'
import { fitTitle } from '@/lib/typeset'
import { ago } from '@/lib/logic/time'
import { bandVar, bumpWarmth, eVar, genreEnergy, genreShort, onEnergy, pad2, threadBand } from './foro'
import styles from './Cartel.module.css'

export interface CartelProps {
  thread: ForoThread
  slot: number
  replies: number
  now: Date
  author?: string
  /** Out of the Horizonte's range or the search: cooled in place. */
  cool?: boolean
  mine?: boolean
  /** The wall is full and this is the thirtieth slot. */
  edge?: boolean
  /** Not a link: the composer preview, the falling poster. */
  still?: boolean
  priority?: boolean
  onOpen?: (id: string, rect: DOMRect) => void
}

function CartelImpl({ thread, slot, replies, now, author, cool, mine, edge, still, priority, onOpen }: CartelProps) {
  const band = threadBand(thread.genres)
  const warmth = bumpWarmth(thread.bumpedAt, now.getTime())
  const extra = Math.max(0, thread.genres.length - 2)
  const cover = thread.imageUrls?.[0] ?? thread.imageUrl

  const inner = (
    <div className={styles.paper} data-flip-paper="">
      <div className={styles.art}>
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 560px) 50vw, (max-width: 960px) 33vw, 240px"
            className={styles.img}
            priority={priority}
            draggable={false}
          />
        ) : (
          <div className={styles.plate} style={{ background: bandVar(band.min, band.max, '160deg') }} />
        )}
        <header className={styles.top}>
          <span className={styles.code} data-edge={edge || undefined}>
            {pad2(slot)}
            {edge ? <span className={styles.edgeNote}>sale con el próximo</span> : null}
          </span>
          <span className={styles.code} title={`${replies} ${replies === 1 ? 'respuesta' : 'respuestas'}`}>
            R·{pad2(replies)}
          </span>
        </header>
        <div className={styles.peek}>
          <div className={styles.chips}>
            {thread.genres.slice(0, 2).map((g) => {
              const e = genreEnergy(g)
              return (
                <span key={g} className={styles.chip}>
                  <span className={styles.dot} style={{ background: e === null ? 'var(--ink-3)' : eVar(e) }} />
                  {genreShort(g)}
                </span>
              )
            })}
            {extra ? <span className={styles.more}>+{extra}</span> : null}
          </div>
          {author ? <p className={styles.by}>@{author}</p> : null}
        </div>
      </div>

      <div className={styles.caption}>
        <h3
          className={styles.subject}
          style={{ fontVariationSettings: energyVariation(band.mid), fontSize: fitTitle(thread.subject, band.mid, 20, 12, 0.94) }}
        >
          {thread.subject}
        </h3>
        <p className={styles.when}>
          {ago(thread.bumpedAt, now)}
          {mine ? <span className={styles.mine}> · tuyo</span> : null}
        </p>
      </div>
      <span className={styles.energy} aria-hidden="true" />
    </div>
  )

  const style = {
    '--e': eVar(band.mid),
    '--on-e': onEnergy(band.mid),
    '--band': bandVar(band.min, band.max),
    '--warm': warmth.toFixed(3),
  } as React.CSSProperties

  if (still) {
    return (
      <div className={styles.cartel} data-still="" style={style} aria-hidden="true">
        {inner}
      </div>
    )
  }

  return (
    <a
      href={`/foro?hilo=${thread.id}`}
      className={styles.cartel}
      data-cool={cool || undefined}
      style={style}
      inert={cool || undefined}
      aria-label={`Hilo en el lugar ${slot}: ${thread.subject}. ${replies} ${replies === 1 ? 'respuesta' : 'respuestas'}, movido ${ago(thread.bumpedAt, now)}.`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        const paper = e.currentTarget.querySelector<HTMLElement>('[data-flip-paper]')
        onOpen?.(thread.id, (paper ?? e.currentTarget).getBoundingClientRect())
      }}
      draggable={false}
    >
      {inner}
    </a>
  )
}

export const Cartel = memo(CartelImpl)

/** An empty slot: a quiet outline, so the cap is felt. */
export function Hueco({ slot, first, onOpen }: { slot: number; first: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.hueco}
      data-last={slot === 30 || undefined}
      onClick={onOpen}
      tabIndex={first ? 0 : -1}
      aria-hidden={first ? undefined : true}
      aria-label={first ? 'Espacio libre en el muro: abrir un hilo' : undefined}
    >
      <span className={styles.huecoNum}>{pad2(slot)}</span>
      <span className={styles.free}>espacio libre</span>
      <span className={styles.freeOn}>abrir hilo</span>
      {slot === 30 ? <span className={styles.lastNote}>último lugar</span> : null}
    </button>
  )
}
