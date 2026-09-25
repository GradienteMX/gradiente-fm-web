'use client'

/**
 * ENERGÍA — the author's band, set on an instrument modeled on the Horizonte.
 *
 *   · unset: press and paint across the tape (from where you press to where
 *     you let go), tap a station for a point, or type a digit
 *   · set: drag a cap; drag inside the lit band to move it whole; press the
 *     tape elsewhere and the nearer cap travels there
 *   · release: the band settles into the nearest detents (spring)
 *   · keys on a cap: ←/→ ±1 · Shift ±2 · Home/End
 *
 * Deliberate by design: a new piece has no band until the author places it,
 * and the composer prior is only ever a suggestion with an «Aplicar».
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { VIBE_NAMES, bandLabel, energyVariation } from '@/lib/vibe'
import { Mark } from '@/components/kit/Glyph'
import { eVar, energySet, type Prior } from '../model'
import s from './Energia.module.css'

type Band = [number, number]
type Kind = 'paint' | 'lo' | 'hi' | 'band'

const clamp = (v: number, a = 0, b = 10) => Math.min(b, Math.max(a, v))
const snap = (v: number) => (v <= 0.6 ? 0 : v >= 9.4 ? 10 : Math.round(v))

interface Props {
  min: number
  max: number
  onChange: (min: number, max: number) => void
  /** Continuous band while the hand is on the instrument (null on release). */
  onLive?: (band: Band | null) => void
  prior: Prior | null
  id?: string
}

export function Energia({ min, max, onChange, onLive, prior, id }: Props) {
  const set = energySet({ vibeMin: min, vibeMax: max })
  const trackRef = useRef<HTMLDivElement>(null)
  const grab = useRef<{ kind: Kind; x0: number; start: Band; anchor: number } | null>(null)
  const liveRef = useRef<Band | null>(null)
  const [live, setLiveState] = useState<Band | null>(null)
  const [active, setActive] = useState<Kind | null>(null)
  const [hot, setHot] = useState(false)
  const tween = useRef<gsap.core.Tween | null>(null)
  const loCap = useRef<HTMLDivElement>(null)
  const focusCap = useRef(false)

  const setLive = useCallback(
    (b: Band | null) => {
      liveRef.current = b
      setLiveState(b)
      onLive?.(b)
    },
    [onLive],
  )

  useEffect(() => () => void tween.current?.kill(), [])

  // After a keyboard placement, hand focus to the cap that now exists.
  useEffect(() => {
    if (set && focusCap.current) {
      focusCap.current = false
      loCap.current?.focus()
    }
  }, [set])

  const shown: Band | null = live ?? (set ? [min, max] : null)

  const toValue = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    return clamp(((clientX - r.left) / r.width) * 10)
  }

  /** Commit integers now; let the visual band spring from where it was. */
  const commit = (to: Band, from: Band | null) => {
    const a = clamp(Math.round(Math.min(to[0], to[1])))
    const b = clamp(Math.round(Math.max(to[0], to[1])))
    onChange(a, b)
    tween.current?.kill()
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!from || reduced) {
      setLive(null)
      return
    }
    const o = { lo: from[0], hi: from[1] }
    tween.current = gsap.to(o, {
      lo: a,
      hi: b,
      duration: 0.42,
      ease: 'back.out(2.2)',
      onUpdate: () => {
        liveRef.current = [clamp(o.lo), clamp(o.hi)]
        setLiveState(liveRef.current)
      },
      onComplete: () => setLive(null),
    })
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    tween.current?.kill()
    const v = toValue(e.clientX)
    const cur = liveRef.current ?? (set ? ([min, max] as Band) : null)
    const capEl = (e.target as HTMLElement).closest('[data-cap]') as HTMLElement | null
    let kind: Kind
    let start: Band
    if (!cur) {
      kind = 'paint'
      start = [v, v]
      setLive(start)
    } else if (capEl) {
      kind = capEl.dataset.cap as 'lo' | 'hi'
      start = cur
    } else if (v > cur[0] + 0.25 && v < cur[1] - 0.25 && cur[1] - cur[0] > 0.9) {
      kind = 'band'
      start = cur
    } else {
      kind = Math.abs(v - cur[0]) <= Math.abs(v - cur[1]) ? 'lo' : 'hi'
      start = kind === 'lo' ? [Math.min(v, cur[1]), cur[1]] : [cur[0], Math.max(v, cur[0])]
      setLive(start)
    }
    grab.current = { kind, x0: e.clientX, start, anchor: v }
    setActive(kind)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (!g) return
    const v = toValue(e.clientX)
    let next: Band
    if (g.kind === 'paint') next = [Math.min(g.anchor, v), Math.max(g.anchor, v)]
    else if (g.kind === 'band') {
      const r = trackRef.current!.getBoundingClientRect()
      const w = g.start[1] - g.start[0]
      const lo = clamp(g.start[0] + ((e.clientX - g.x0) / r.width) * 10, 0, 10 - w)
      next = [lo, lo + w]
    } else {
      const cur = liveRef.current ?? g.start
      // From a single point, the direction of the drag decides which cap moves.
      if (Math.abs(cur[1] - cur[0]) < 0.001) {
        if (v < cur[0] && g.kind === 'hi') g.kind = 'lo'
        else if (v > cur[1] && g.kind === 'lo') g.kind = 'hi'
        setActive(g.kind)
      }
      next = g.kind === 'lo' ? [Math.min(v, cur[1]), cur[1]] : [cur[0], Math.max(v, cur[0])]
    }
    setLive(next)
  }

  const onUp = () => {
    const g = grab.current
    grab.current = null
    setActive(null)
    const cur = liveRef.current
    if (!g || !cur) return
    let a = snap(cur[0])
    let b = snap(cur[1])
    if (g.kind === 'band') {
      const w = Math.round(g.start[1] - g.start[0])
      a = clamp(Math.round(cur[0]), 0, 10 - w)
      b = a + w
    }
    commit([a, b], cur)
  }

  const onCapKey = (cap: 'lo' | 'hi') => (e: React.KeyboardEvent) => {
    const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 2 : 1
    const v = cap === 'lo' ? min : max
    let next: Band | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') next = cap === 'lo' ? [clamp(v - step), max] : [min, Math.max(min, v - step)]
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') next = cap === 'lo' ? [Math.min(max, v + step), max] : [min, clamp(v + step)]
    if (e.key === 'Home') next = cap === 'lo' ? [0, max] : [min, min]
    if (e.key === 'End') next = cap === 'lo' ? [max, max] : [min, 10]
    if (next) {
      e.preventDefault()
      commit(next, [min, max])
    }
  }

  const onTrackKey = (e: React.KeyboardEvent) => {
    if (set) return
    let v: number | null = null
    if (/^[0-9]$/.test(e.key)) v = Number(e.key)
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) v = 5
    else if (e.key === 'Home') v = 0
    else if (e.key === 'End') v = 10
    if (v === null) return
    e.preventDefault()
    focusCap.current = true
    commit([v, v], null)
  }

  const station = (i: number, shift: boolean) => {
    const cur: Band | null = set ? [min, max] : null
    if (!cur || !shift) return commit([i, i], cur ?? [i, i])
    if (Math.abs(i - cur[0]) <= Math.abs(i - cur[1])) commit([Math.min(i, cur[1]), cur[1]], cur)
    else commit([cur[0], Math.max(i, cur[0])], cur)
  }

  const applied = !!prior && set && prior.min === min && prior.max === max
  const lo = shown?.[0] ?? 0
  const hi = shown?.[1] ?? 0
  const mid = (lo + hi) / 2
  const bandW = Math.max(0.0001, hi - lo)

  return (
    <div className={s.energia} data-unset={!shown || undefined}>
      <div className={s.readout}>
        <span className={s.readLine}>
          <span className={s.code} aria-hidden="true">
            {shown ? `${String(Math.round(lo)).padStart(2, '0')}–${String(Math.round(hi)).padStart(2, '0')}` : '––'}
          </span>
          <span className={s.reading} data-unset={!shown || undefined} style={shown ? { fontVariationSettings: energyVariation(mid) } : undefined} aria-live="polite">
            {shown ? bandLabel(Math.round(lo), Math.round(hi)) : 'Sin fijar'}
          </span>
        </span>
        <span className={s.kind}>
          {!shown
            ? 'Obligatoria. Presiona y arrastra sobre la cinta, toca una estación o escribe un dígito.'
            : Math.round(lo) === Math.round(hi)
              ? 'Un punto en el horizonte.'
              : 'Un rango: la pieza se mueve entre dos temperaturas.'}
        </span>
      </div>

      <div className={s.instrument}>
        <div className={s.names}>
          {VIBE_NAMES.map((n, i) => (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              className={s.name}
              data-odd={i % 2 === 1 || undefined}
              data-in={(shown && i >= Math.round(lo) && i <= Math.round(hi)) || undefined}
              style={{ left: `${i * 10}%`, fontVariationSettings: energyVariation(i) }}
              onClick={(e) => station(i, e.shiftKey)}
              title={shown ? 'Clic: un punto · Mayús + clic: ampliar' : 'Fijar aquí'}
            >
              {n}
            </button>
          ))}
        </div>

        <div
          ref={trackRef}
          id={set ? undefined : id}
          className={s.track}
          data-set={set || undefined}
          data-grab={active ?? undefined}
          role={set ? undefined : 'slider'}
          tabIndex={set ? -1 : 0}
          aria-label={set ? undefined : 'Energía de la pieza: sin fijar. Escribe un dígito o usa las flechas para fijarla.'}
          aria-valuemin={set ? undefined : 0}
          aria-valuemax={set ? undefined : 10}
          aria-valuetext={set ? undefined : 'Sin fijar'}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onTrackKey}
        >
          <div className={s.rail} style={{ backgroundImage: 'var(--spectrum)' }} />
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className={s.tick} style={{ left: `${i * 10}%` }} data-in={(shown && i >= lo - 0.01 && i <= hi + 0.01) || undefined} />
          ))}

          {prior && !applied ? (
            <span
              className={s.ghost}
              data-hot={hot || undefined}
              style={{ left: `calc(${prior.min * 10}% - 5px)`, width: `calc(${(prior.max - prior.min) * 10}% + 10px)` }}
              aria-hidden="true"
            >
              <span className={s.ghostTag}>sugerencia</span>
            </span>
          ) : null}

          {shown ? (
            <div
              className={s.band}
              style={{
                left: `${lo * 10}%`,
                width: `${(hi - lo) * 10}%`,
                backgroundImage: 'var(--spectrum)',
                backgroundColor: eVar(mid),
                backgroundSize: `${(10 / bandW) * 100}% 100%`,
                backgroundPosition: `${bandW >= 10 ? 0 : (lo / (10 - bandW)) * 100}% 0`,
                ['--pt' as string]: hi - lo < 0.05 ? '-3px' : '0px',
              }}
            />
          ) : null}

          {shown
            ? (['lo', 'hi'] as const).map((cap) => {
                const v = cap === 'lo' ? lo : hi
                return (
                  <div
                    key={cap}
                    ref={cap === 'lo' ? loCap : undefined}
                    id={cap === 'lo' && set ? id : undefined}
                    data-cap={cap}
                    role="slider"
                    tabIndex={set ? 0 : -1}
                    aria-label={cap === 'lo' ? 'Energía mínima de la pieza' : 'Energía máxima de la pieza'}
                    aria-valuemin={0}
                    aria-valuemax={10}
                    aria-valuenow={Math.round(v)}
                    aria-valuetext={VIBE_NAMES[Math.round(v)]}
                    onKeyDown={onCapKey(cap)}
                    className={s.cap}
                    data-active={active === cap || undefined}
                    style={{ left: `${v * 10}%`, ['--cap' as string]: eVar(v) }}
                  >
                    <span className={s.capBody} />
                    <span className={s.capTag} style={{ fontVariationSettings: energyVariation(v) }}>
                      {VIBE_NAMES[Math.round(v)]}
                    </span>
                  </div>
                )
              })
            : null}
        </div>
      </div>

      <div className={s.foot}>
        {prior ? (
          <div className={s.prior}>
            <span className={s.priorLabel}>Sugerencia</span>
            <span className={s.priorBand} style={{ fontVariationSettings: energyVariation((prior.min + prior.max) / 2) }}>
              {bandLabel(prior.min, prior.max)}
            </span>
            <span className={s.priorBasis}>{prior.basis}</span>
            {applied ? (
              <span className={s.applied}>
                <Mark name="check" size={13} /> Aplicada
              </span>
            ) : (
              <button
                type="button"
                className={s.apply}
                onMouseEnter={() => setHot(true)}
                onMouseLeave={() => setHot(false)}
                onFocus={() => setHot(true)}
                onBlur={() => setHot(false)}
                onClick={() => {
                  setHot(false)
                  commit([prior.min, prior.max], set ? [min, max] : [(prior.min + prior.max) / 2, (prior.min + prior.max) / 2])
                }}
              >
                Aplicar
              </button>
            )}
          </div>
        ) : (
          <span className={s.priorBasis}>Elige géneros y la mesa propondrá una banda; nunca la aplica sola.</span>
        )}
        <span className={s.law}>La comunidad la calibrará: con cinco lecturas manda su mediana.</span>
      </div>
    </div>
  )
}
