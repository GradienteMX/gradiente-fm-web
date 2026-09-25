'use client'

/**
 * CALIBRADOR — the vibe check. «Calibración analógica».
 *
 * Press the scale to arm it; drag to paint your reading from where you
 * pressed to where you are; release to seal it. A plain click stays armed
 * and saves nothing — the drag is the commitment (Vibe Philosophy, idea 4).
 * Keys: ←/→ move, Shift widens, Enter seals, Esc disarms.
 *
 * Printed in the Horizonte's grammar — the scale is eleven swatches — with
 * every layer legible at once:
 *   · the lit swatches — what the system believes (the author's band until
 *     5 readings, then the crowd's median; it changes feed eligibility).
 *     They chase it like a VU meter: quick to open, slow to close. While you
 *     paint, they show your draft instead.
 *   · the author's band — a dimension line over its slots; it stays even
 *     when the crowd takes over, so the gap is never hidden
 *   · the crowd's median — a hatched band with end ticks under the scale
 *   · your reading — two ink bars bracketing its slots (outlined while it's
 *     a proof, solid once sealed)
 */

import { useEffect, useId, useRef, useState } from 'react'
import gsap from 'gsap'
import type { ContentItem } from '@/lib/types'
import { useDispatch, useWorld } from '@/lib/store/world'
import { useMe } from '@/lib/store/session'
import { useUI } from '@/lib/store/ui'
import { flare } from '@/components/stage/api'
import { VIBE_CHECK_THRESHOLD, VIBE_NAMES, bandLabel, effectiveBand, energyVariation } from '@/lib/vibe'
import styles from './Calibrador.module.css'

const clamp = (v: number) => Math.max(0, Math.min(10, v))
const two = (n: number) => String(Math.round(n)).padStart(2, '0')
/** `07` or `07–08`. */
const code = (a: number, b: number) => (Math.round(a) === Math.round(b) ? two(a) : `${two(a)}–${two(b)}`)
/** A band covers whole swatches, edge to edge (the scale runs between swatch centres). */
const slots = (a: number, b: number) => {
  const lo = Math.round(Math.min(a, b))
  const hi = Math.round(Math.max(a, b))
  return { left: `${(lo - 0.5) * 10}%`, width: `${(hi - lo + 1) * 10}%` }
}

export function Calibrador({ item, compact, n }: { item: ContentItem; compact?: boolean; n?: string }) {
  const me = useMe()
  const dispatch = useDispatch()
  const openAccess = useUI((s) => s.openAccess)
  const mine = useWorld((s) => (me ? s.world.readings[item.id]?.[me.id] ?? null : null))
  const band = effectiveBand(item)
  const count = item.vibeCheckCount ?? 0
  const crowd = band.source === 'comunidad'
  const statusId = useId()

  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const lit = useRef({ lo: band.min, hi: band.max })
  const [shown, setShown] = useState<[number, number]>([band.min, band.max])
  const [armed, setArmed] = useState(false)
  const [draft, setDraft] = useState<[number, number] | null>(null)
  const [dragging, setDragging] = useState(false)
  /** How the draft was made: painted with the pointer, or stepped with keys. */
  const [via, setVia] = useState<'pointer' | 'keys'>('pointer')
  const [sealed, setSealed] = useState(false)
  const drag = useRef<{ start: number; x0: number; moved: boolean } | null>(null)

  // The lit swatches chase the effective band like a VU meter: quick to
  // open, slow to close.
  useEffect(() => {
    const widening = band.max - band.min > lit.current.hi - lit.current.lo
    gsap.to(lit.current, {
      lo: band.min,
      hi: band.max,
      duration: widening ? 0.35 : 1.1,
      ease: widening ? 'power3.out' : 'power2.inOut',
      overwrite: true,
      onUpdate: () => setShown([lit.current.lo, lit.current.hi]),
    })
  }, [band.min, band.max])

  const valueAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return clamp(((clientX - r.left) / r.width) * 10)
  }

  const commit = (b: [number, number]) => {
    if (!me) return
    const lo = Math.round(Math.min(b[0], b[1]))
    const hi = Math.round(Math.max(b[0], b[1]))
    dispatch({ t: 'reading', userId: me.id, itemId: item.id, band: [lo, hi], at: new Date().toISOString() })
    setArmed(false)
    setDraft(null)
    setSealed(true)
    window.setTimeout(() => setSealed(false), 900)
    // The commit lands where the reading sealed: the centre of its slots.
    const r = track.current?.getBoundingClientRect()
    if (r) flare({ x: r.left + (((lo + hi) / 2) / 10) * r.width, y: r.top + r.height / 2 }, (lo + hi) / 2)
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (!me) {
      openAccess('Calibra la energía de las piezas')
      return
    }
    const v = valueAt(e.clientX)
    drag.current = { start: v, x0: e.clientX, moved: false }
    setArmed(true)
    setVia('pointer')
    setDraft([v, v])
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(e.clientX - d.x0) > 3) {
      d.moved = true
      setDragging(true)
    }
    const v = valueAt(e.clientX)
    setDraft([Math.min(d.start, v), Math.max(d.start, v)])
  }

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (!d.moved) return // a click only arms — the drag is the commitment
    const v = valueAt(e.clientX)
    commit([Math.min(d.start, v), Math.max(d.start, v)])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!me) {
      if (e.key === 'Enter' || e.key === ' ') openAccess('Calibra la energía de las piezas')
      return
    }
    const cur = draft ?? (mine ? [mine[0], mine[1]] : [band.min, band.max])
    let next: [number, number] | null = null
    if (e.key === 'ArrowLeft') next = e.shiftKey ? [clamp(cur[0] - 1), cur[1]] : [clamp(cur[0] - 1), clamp(cur[1] - 1)]
    if (e.key === 'ArrowRight') next = e.shiftKey ? [cur[0], clamp(cur[1] + 1)] : [clamp(cur[0] + 1), clamp(cur[1] + 1)]
    if (next) {
      e.preventDefault()
      if (next[0] > next[1]) next = [next[1], next[1]]
      setArmed(true)
      setVia('keys')
      setDraft(next)
    }
    if ((e.key === 'Enter' || e.key === ' ') && draft) {
      e.preventDefault()
      commit(draft)
    }
    if (e.key === 'Escape' && armed) {
      e.stopPropagation()
      setArmed(false)
      setDraft(null)
    }
  }

  // Pressing anywhere outside the instrument disarms it.
  useEffect(() => {
    if (!armed) return
    const onDoc = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setArmed(false)
        setDraft(null)
      }
    }
    window.addEventListener('pointerdown', onDoc)
    return () => window.removeEventListener('pointerdown', onDoc)
  }, [armed])

  const status = (() => {
    if (armed) {
      // A press alone only arms: the reading is painted by dragging (or stepped with keys).
      if (!draft || (via === 'pointer' && !dragging)) return 'Armado · arrastra sobre la escala para pintar tu lectura'
      const label = bandLabel(Math.round(draft[0]), Math.round(draft[1]))
      return via === 'keys' ? `Tu lectura: ${label} — Enter sella · Esc suelta` : `Tu lectura: ${label} — suelta para sellar`
    }
    if (crowd) return 'La comunidad decide esta energía'
    const missing = Math.max(0, VIBE_CHECK_THRESHOLD - count)
    return missing === VIBE_CHECK_THRESHOLD
      ? 'Energía del autor · nadie la ha calibrado aún'
      : `Energía del autor · ${missing === 1 ? 'falta 1 lectura' : `faltan ${missing} lecturas`} para que decida la comunidad`
  })()

  const mid = (band.min + band.max) / 2
  // What the swatches print: your draft while you paint, else the effective band (chasing).
  const [litLo, litHi] = draft
    ? [Math.round(Math.min(draft[0], draft[1])), Math.round(Math.max(draft[0], draft[1]))]
    : [Math.round(shown[0]), Math.round(shown[1])]
  const inBand = (i: number) => i >= Math.round(band.min) && i <= Math.round(band.max)
  const reading: [number, number] | null = draft ?? (mine ? [mine[0], mine[1]] : null)
  const hasMedian = count > 0 && item.vibeCheckMedianMin !== undefined && item.vibeCheckMedianMax !== undefined
  const crowdText = count === 0 ? 'sin checks' : `${count} ${count === 1 ? 'check' : 'checks'}`

  return (
    <section
      ref={root}
      className={styles.cal}
      data-armed={armed || undefined}
      data-sealed={sealed || undefined}
      data-compact={compact || undefined}
      aria-label="Calibración de energía"
    >
      <header className={styles.head}>
        <span className={styles.title}>
          {n ? (
            <>
              <span className={styles.idx}>{n}</span>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
            </>
          ) : null}
          <span className={styles.name}>Calibración</span>
        </span>
        <span className={styles.readout}>
          <span className={styles.code}>{code(band.min, band.max)}</span>
          <span className={styles.reading} style={{ fontVariationSettings: energyVariation(mid) }}>
            {bandLabel(band.min, band.max)}
          </span>
        </span>
        <span className={styles.source} data-crowd={crowd || undefined}>
          {crowd ? 'Comunidad' : 'Autor'}
        </span>
      </header>

      <div className={styles.instrument}>
        {!compact ? (
          <div className={styles.names} aria-hidden="true">
            {VIBE_NAMES.map((name, i) => (
              <span key={name} style={{ left: `${i * 10}%`, fontVariationSettings: energyVariation(i) }} data-in={inBand(i) || undefined}>
                {name}
              </span>
            ))}
          </div>
        ) : null}

        <div
          ref={track}
          className={styles.track}
          role="slider"
          tabIndex={0}
          aria-label="Tu lectura de energía (arrastra para calibrar)"
          aria-describedby={statusId}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={Math.round(mine ? (mine[0] + mine[1]) / 2 : mid)}
          aria-valuetext={mine ? `Tu lectura ${bandLabel(mine[0], mine[1])}` : `Sin lectura tuya. Energía actual ${bandLabel(band.min, band.max)}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = null
            setDragging(false)
          }}
          onKeyDown={onKey}
        >
          {/* the author's original band — always printed */}
          <span className={styles.author} style={slots(item.vibeMin, item.vibeMax)} title={`Autor · ${code(item.vibeMin, item.vibeMax)}`} />

          {/* the scale: eleven swatches */}
          <div className={styles.swatches} aria-hidden="true">
            {VIBE_NAMES.map((name, i) => (
              <span key={name} style={{ ['--s' as string]: `var(--e${i})` }} data-in={(i >= litLo && i <= litHi) || undefined} />
            ))}
          </div>

          {/* the crowd's median band */}
          {hasMedian ? (
            <span
              className={styles.crowd}
              data-live={crowd || undefined}
              style={slots(item.vibeCheckMedianMin!, item.vibeCheckMedianMax!)}
              title={`Consenso · ${code(item.vibeCheckMedianMin!, item.vibeCheckMedianMax!)}`}
            />
          ) : null}

          {/* your reading: two ink bars bracketing its slots */}
          {reading ? (
            <>
              <span className={styles.bar} data-proof={draft ? '' : undefined} style={{ left: `${(Math.round(Math.min(reading[0], reading[1])) - 0.5) * 10}%` }} />
              <span className={styles.bar} data-proof={draft ? '' : undefined} style={{ left: `${(Math.round(Math.max(reading[0], reading[1])) + 0.5) * 10}%` }} />
            </>
          ) : null}
          {draft ? (
            <span className={styles.tag} style={{ left: `clamp(72px, ${((Math.round(draft[0]) + Math.round(draft[1])) / 2) * 10}%, calc(100% - 72px))` }} aria-hidden="true">
              {code(draft[0], draft[1])} · {bandLabel(Math.round(draft[0]), Math.round(draft[1]))}
            </span>
          ) : null}
        </div>

        <div className={styles.numbers} aria-hidden="true">
          {VIBE_NAMES.map((name, i) => (
            <span key={name} style={{ left: `${i * 10}%` }} data-in={inBand(i) || undefined}>
              {two(i)}
            </span>
          ))}
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.key}>
          <span className={styles.keyItem} data-live={crowd || undefined}>
            <span className={styles.kCrowd} aria-hidden="true" />
            Consenso · {crowdText}
            {hasMedian ? <b>{code(item.vibeCheckMedianMin!, item.vibeCheckMedianMax!)}</b> : null}
          </span>
          <span className={styles.keyItem}>
            <span className={styles.kAuthor} aria-hidden="true" />
            Autor <b>{code(item.vibeMin, item.vibeMax)}</b>
          </span>
          {me ? (
            <span className={styles.keyItem} data-mine="" data-on={sealed || undefined}>
              <span className={styles.kMine} aria-hidden="true" />
              Tu señal <b>{mine ? code(mine[0], mine[1]) : '—'}</b>
            </span>
          ) : (
            <button type="button" className={styles.enter} onClick={() => openAccess('Calibra la energía de las piezas')}>
              <span className={styles.kMine} aria-hidden="true" />
              Tu señal — entra para darla
            </button>
          )}
        </div>
        <p className={styles.status} id={statusId}>
          {status}
        </p>
        {mine && me ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => dispatch({ t: 'reading', userId: me.id, itemId: item.id, band: null, at: new Date().toISOString() })}
          >
            Quitar mi lectura
          </button>
        ) : null}
      </footer>
    </section>
  )
}
