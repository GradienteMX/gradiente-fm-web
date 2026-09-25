'use client'

/**
 * CÁPSULA — the collapsed deck, floating bottom-left.
 *
 *   cue    nothing loaded: a quiet paper chip offering the head of the field's
 *          queue (metadata only — nothing plays without a press)
 *   plena  the deck: disc, title in its energy, artist, an honest status,
 *          transport, clock, the needle along its lower edge
 *   puck   a reading is open: it shrinks to disc + play so it doesn't sit on
 *          the text; hover or focus opens it back up
 *   hidden the open reading IS this mix's Sesión (the deck docks into it),
 *          the sala is open, or the route has its own chrome
 */

import { useRef } from 'react'
import { usePlayer, sameSlot } from '@/lib/store/player'
import { useUI } from '@/lib/store/ui'
import { useItemBySlug } from '@/lib/store/world'
import { energyVariation } from '@/lib/vibe'
import { FormatGlyph, Mark } from '@/components/kit/Glyph'
import { Disco } from './Disco'
import { Aguja, Reloj } from './Aguja'
import { energiaVar, modoDe, useEstado } from './estado'
import { usePosicion, useReducedMotion } from './hooks'
import styles from './Consola.module.css'

/** Where the capsule's disc was when the sala opened (the sala grows from it). */
export const origen: { disc: DOMRect | null } = { disc: null }

export function Capsula({ bpm, hidden: routeHidden }: { bpm: number | null; hidden: boolean }) {
  const track = usePlayer((s) => s.track)
  const playing = usePlayer((s) => s.playing)
  const expanded = usePlayer((s) => s.expanded)
  const capture = usePlayer((s) => s.capture)
  const cue = usePlayer((s) => s.ambient[0] ?? null)
  const hasNext = usePlayer((s) => {
    if (!s.track || !s.queue.length) return false
    const i = s.queue.findIndex((q) => sameSlot(q, s.track!))
    return i < s.queue.length - 1
  })
  // «Anterior» on a deck first returns to the top of the current track.
  const canBack = usePlayer((s) => {
    if (!s.track) return false
    return s.time > 5 || s.queue.findIndex((q) => sameSlot(q, s.track!)) > 0
  })
  const lectura = useUI((s) => s.lectura)
  const openLectura = useUI((s) => s.openLectura)
  const open = useItemBySlug(lectura?.slug)
  const estado = useEstado()
  const reduced = useReducedMotion()
  const discRef = useRef<HTMLButtonElement>(null)

  const docked = Boolean(track && open && open.type === 'mix' && open.id === track.itemId && track.entry === undefined)
  const mode: 'cue' | 'plena' | 'puck' = !track ? 'cue' : lectura ? 'puck' : 'plena'
  const hidden = routeHidden || expanded || docked || (mode === 'cue' && Boolean(lectura))

  const energy = track?.energy ?? cue?.energy ?? 5
  const vars = { ['--e' as string]: energiaVar(energy) }

  const openPiece = () => {
    const t = usePlayer.getState().track
    if (!t) return
    const r = discRef.current?.getBoundingClientRect()
    openLectura(t.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
  }

  if (mode === 'cue') {
    return (
      <section className={styles.capsula} data-mode="cue" data-hidden={hidden || undefined} inert={hidden} aria-label="Consola" style={vars}>
        <button
          type="button"
          className={styles.cueOpen}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            origen.disc = new DOMRect(r.left, r.top, r.height, r.height)
            usePlayer.getState().setExpanded(true)
          }}
          aria-label="Abrir la consola"
          title="Abrir la consola"
        >
          <span className={styles.cueMark} aria-hidden="true">
            <FormatGlyph type="mix" size={15} />
          </span>
          <span className={styles.cueLabel}>Consola</span>
        </button>
        {cue ? (
          <>
            <span className={styles.cueSep} aria-hidden="true" />
            <span className={styles.cueWhat}>
              <span className={styles.cueTag}>En cola</span>
              <button
                type="button"
                className={styles.cueTitle}
                style={{ fontVariationSettings: energyVariation(cue.energy) }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  openLectura(cue.slug, { x: r.left, y: r.top, width: r.width, height: r.height })
                }}
                title={`Abrir «${cue.title}»`}
              >
                {cue.title}
              </button>
            </span>
            <button
              type="button"
              className={styles.cuePlay}
              onClick={() => {
                const s = usePlayer.getState()
                s.play(cue, s.ambient)
              }}
              aria-label={`Reproducir «${cue.title}»${cue.artist ? ` de ${cue.artist}` : ''}`}
            >
              <Mark name="play" size={12} />
            </button>
          </>
        ) : (
          <span className={styles.cueNone}>sin fuentes que sonar</span>
        )}
      </section>
    )
  }

  const t = track!
  const modo = modoDe(capture, bpm, reduced)

  return (
    <section
      className={styles.capsula}
      data-mode={mode}
      data-hidden={hidden || undefined}
      data-tone={estado.tone}
      inert={hidden}
      aria-label="Consola"
      style={vars}
    >
      <button ref={discRef} type="button" className={styles.disc} onClick={openPiece} tabIndex={-1} aria-hidden="true">
        <Disco src={t.imageUrl} spinning={playing} label={0.6} sizes="64px" />
        {mode === 'puck' ? <Arco /> : null}
      </button>

      <div className={styles.body}>
        <button type="button" className={styles.title} style={{ fontVariationSettings: energyVariation(t.energy) }} onClick={openPiece} title={`Abrir «${t.title}»`}>
          {t.title}
        </button>
        <p className={styles.line}>
          {t.artist ? <span className={styles.artist}>{t.artist}</span> : null}
          <span className={styles.status} data-tone={estado.tone} aria-live="polite">
            {estado.word}
          </span>
          {estado.tone === 'vivo' ? <span className={styles.modo}>{modo}</span> : null}
        </p>
      </div>

      <div className={styles.transport}>
        <button
          type="button"
          className={`${styles.tbtn} ${styles.side}`}
          onClick={() => {
            const s = usePlayer.getState()
            if (s.time > 5 && !s.loading) s.seek(0)
            else s.prev()
          }}
          disabled={!canBack}
          aria-label="Anterior"
        >
          <Mark name="prev" size={14} />
        </button>
        <button type="button" className={styles.play} onClick={() => usePlayer.getState().toggle()} aria-label={playing ? 'Pausar' : 'Reproducir'} data-on={playing || undefined}>
          <Mark name={playing ? 'pause' : 'play'} size={15} />
        </button>
        <button type="button" className={`${styles.tbtn} ${styles.side}`} onClick={() => usePlayer.getState().next()} disabled={!hasNext} aria-label="Siguiente">
          <Mark name="next" size={14} />
        </button>
      </div>

      <Reloj className={styles.clock} />

      <button
        type="button"
        className={`${styles.tbtn} ${styles.expand}`}
        onClick={() => {
          origen.disc = discRef.current?.getBoundingClientRect() ?? null
          usePlayer.getState().setExpanded(true)
        }}
        aria-label="Abrir la consola completa"
        title="Abrir la consola"
      >
        <Mark name="expand" size={14} />
      </button>

      <Aguja variant="capsula" className={styles.seek} />
    </section>
  )
}

/** Progress as an arc around the puck's disc. */
function Arco() {
  const ref = useRef<SVGCircleElement>(null)
  const C = 2 * Math.PI * 23
  usePosicion((t, d) => {
    const el = ref.current
    if (el) el.style.strokeDashoffset = String(C * (1 - (d > 0 ? t / d : 0)))
  })
  return (
    <svg className={styles.arco} viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r="23" className={styles.arcoRail} />
      <circle ref={ref} cx="25" cy="25" r="23" className={styles.arcoLit} strokeDasharray={C} strokeDashoffset={C} />
    </svg>
  )
}
