'use client'

/**
 * HORIZONTE — the energy range, as the horizon of the world.
 *
 * Gestures
 *   · drag a cap                → continuous; the field heats/cools live
 *   · release                   → settles into the nearest detent (spring)
 *   · drag inside the lit band  → moves the whole window, width preserved
 *   · press the track elsewhere → the nearer cap travels there
 *   · double-press              → full range
 *   · keys (on a cap)           → ←/→ ±1 · Home/End · Shift ±2
 * The feed only re-filters when an integer boundary is crossed (bands are
 * integers), so the field follows the hand at 60 fps without reflowing the
 * mosaic on every pixel.
 *
 * Two bodies, one state: the full instrument lives in the page; when it
 * scrolls away a slim dock slides in under the nav. No layout ever jumps.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useCampo } from '@/lib/store/campo'
import {
  VIBE_NAMES,
  VIBE_FEEL,
  SPECTRUM_HEX,
  bandLabel,
  energySlotHex,
  energyVariation,
  isFullRange,
  type VibeRange,
} from '@/lib/vibe'
import { shortGenreName } from '@/lib/logic/genres'
import { useClientValue } from '@/lib/useMedia'
import { Formatos } from './Formatos'
import styles from './Horizonte.module.css'

type Grab = { kind: 'lo' | 'hi' | 'band'; startX: number; startRange: VibeRange } | null

const clamp = (v: number, a = 0, b = 10) => Math.min(b, Math.max(a, v))
const two = (n: number) => String(n).padStart(2, '0')
const snap = (v: number) => {
  if (v <= 0.65) return 0
  if (v >= 9.35) return 10
  return Math.round(v)
}

let settleTween: gsap.core.Tween | null = null

/** Animate the range into place with a detent spring (shared by both bodies). */
function settleTo(to: VibeRange) {
  settleTween?.kill()
  const s = useCampo.getState()
  const from = { lo: s.range[0], hi: s.range[1] }
  settleTween = gsap.to(from, {
    lo: to[0],
    hi: to[1],
    duration: 0.42,
    ease: 'back.out(2.2)',
    onUpdate: () => useCampo.getState().setRange([clamp(from.lo), clamp(from.hi)]),
    onComplete: () => useCampo.getState().setRange(to),
  })
}

export function Horizonte({ showFormats = true, showGenres = true }: { showFormats?: boolean; showGenres?: boolean }) {
  const range = useCampo((s) => s.range)
  const fullRef = useRef<HTMLElement>(null)
  const [docked, setDocked] = useState(false)

  // Tempo follows temperature: cold is patient, hot is urgent.
  useEffect(() => {
    const mid = (range[0] + range[1]) / 2
    gsap.globalTimeline.timeScale(0.85 + (mid / 10) * 0.35)
  }, [range])

  useEffect(() => {
    const el = fullRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => setDocked(!e.isIntersecting && e.boundingClientRect.top < 0),
      { rootMargin: '-60px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <section ref={fullRef} className={styles.horizonte} aria-label="Horizonte de energía">
        <div className={styles.inner}>
          <Head showFormats={showFormats} compact={false} />
          <Instrument compact={false} />
          <Pista />
          {showGenres ? <Particulas /> : null}
        </div>
      </section>
      <div className={styles.dock} data-on={docked || undefined} aria-hidden={!docked}>
        <div className={styles.dockInner}>
          <Head showFormats={showFormats} compact />
          <Instrument compact />
        </div>
      </div>
    </>
  )
}

function Head({ showFormats, compact }: { showFormats: boolean; compact: boolean }) {
  const range = useCampo((s) => s.range)
  const full = isFullRange(range)
  return (
    <div className={styles.head} data-compact={compact || undefined}>
      <div className={styles.readout}>
        <span className={styles.label}>Energía</span>
        <span className={styles.code}>
          {two(Math.round(range[0]))}–{two(Math.round(range[1]))}
        </span>
        <span className={styles.reading} aria-live={compact ? undefined : 'polite'}>
          {full ? 'Todo el espectro' : bandLabel(Math.round(range[0]), Math.round(range[1]))}
        </span>
        {!full ? (
          <button type="button" className={styles.reset} onClick={() => settleTo([0, 10])} tabIndex={compact ? -1 : 0}>
            Todo
          </button>
        ) : null}
      </div>
      {showFormats ? <Formatos compact={compact} /> : null}
    </div>
  )
}

function Instrument({ compact }: { compact: boolean }) {
  const range = useCampo((s) => s.range)
  const setRange = useCampo((s) => s.setRange)
  const trackRef = useRef<HTMLDivElement>(null)
  const grab = useRef<Grab>(null)
  const [active, setActive] = useState<'lo' | 'hi' | 'band' | null>(null)

  const toValue = useCallback((clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    return clamp(((clientX - r.left) / r.width) * 10)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    settleTween?.kill()
    const v = toValue(e.clientX)
    const [lo, hi] = useCampo.getState().range
    const target = (e.target as HTMLElement).closest('[data-cap]') as HTMLElement | null
    let kind: 'lo' | 'hi' | 'band'
    if (target) kind = target.dataset.cap as 'lo' | 'hi'
    else if (v > lo + 0.25 && v < hi - 0.25 && hi - lo > 0.9) kind = 'band'
    else {
      kind = Math.abs(v - lo) <= Math.abs(v - hi) ? 'lo' : 'hi'
      if (kind === 'lo') setRange([Math.min(v, hi), hi])
      else setRange([lo, Math.max(v, lo)])
    }
    grab.current = { kind, startX: e.clientX, startRange: useCampo.getState().range }
    setActive(kind)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (!g) return
    const r = trackRef.current!.getBoundingClientRect()
    const [lo0, hi0] = g.startRange
    if (g.kind === 'band') {
      const w = hi0 - lo0
      const lo = clamp(lo0 + ((e.clientX - g.startX) / r.width) * 10, 0, 10 - w)
      setRange([lo, lo + w])
      return
    }
    const v = toValue(e.clientX)
    const cur = useCampo.getState().range
    if (g.kind === 'lo') setRange([Math.min(v, cur[1]), cur[1]])
    else setRange([cur[0], Math.max(v, cur[0])])
  }

  const onPointerUp = () => {
    const g = grab.current
    grab.current = null
    setActive(null)
    if (!g) return
    const [lo, hi] = useCampo.getState().range
    let a = snap(lo)
    let b = snap(hi)
    if (g.kind === 'band') {
      const w = Math.round(g.startRange[1] - g.startRange[0])
      a = clamp(Math.round(lo), 0, 10 - w)
      b = a + w
    }
    settleTo([Math.min(a, b), Math.max(a, b)])
  }

  const onKey = (cap: 'lo' | 'hi') => (e: React.KeyboardEvent) => {
    const [lo, hi] = useCampo.getState().range
    const step = e.shiftKey ? 2 : 1
    const v = Math.round(cap === 'lo' ? lo : hi)
    let next: VibeRange | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cap === 'lo' ? [clamp(v - step), hi] : [lo, clamp(Math.max(lo, v - step))]
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cap === 'lo' ? [clamp(Math.min(hi, v + step)), hi] : [lo, clamp(v + step)]
    if (e.key === 'Home') next = cap === 'lo' ? [0, hi] : [lo, lo]
    if (e.key === 'End') next = cap === 'lo' ? [hi, hi] : [lo, 10]
    if (next) {
      e.preventDefault()
      settleTo(next)
    }
  }

  const [lo, hi] = range
  const bandW = Math.max(0.0001, hi - lo)

  return (
    <div className={styles.instrument} data-compact={compact || undefined}>
      {!compact ? (
        <div className={styles.names}>
          {VIBE_NAMES.map((n, i) => {
            const inRange = i >= Math.round(lo) && i <= Math.round(hi)
            return (
              <button
                key={n}
                type="button"
                tabIndex={-1}
                className={styles.name}
                data-in={inRange || undefined}
                style={{ left: `${i * 10}%`, fontVariationSettings: energyVariation(i) }}
                title={`${VIBE_FEEL[i]} — clic: sintonizar · Shift+clic: extender`}
                onClick={(e) => {
                  const [a, b] = useCampo.getState().range
                  if (e.shiftKey) settleTo([Math.min(Math.round(a), i), Math.max(Math.round(b), i)])
                  else settleTo([i, i])
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => settleTo([0, 10])}
        data-grab={active ?? undefined}
      >
        {/* The ramp printed as eleven swatches; slots outside the band go pale. */}
        <div className={styles.swatches} aria-hidden="true">
          {SPECTRUM_HEX.map((c, i) => (
            <span key={i} style={{ ['--s' as string]: c }} data-in={(i >= Math.round(lo) && i <= Math.round(hi)) || undefined} />
          ))}
        </div>
        <div className={styles.band} style={{ left: `${lo * 10}%`, width: `${bandW * 10}%` }} />
        {(['lo', 'hi'] as const).map((cap) => {
          const v = cap === 'lo' ? lo : hi
          return (
            <div
              key={cap}
              data-cap={cap}
              role="slider"
              tabIndex={compact ? -1 : 0}
              aria-label={cap === 'lo' ? 'Energía mínima' : 'Energía máxima'}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={Math.round(v)}
              aria-valuetext={VIBE_NAMES[Math.round(v)]}
              onKeyDown={onKey(cap)}
              className={styles.cap}
              data-active={active === cap || undefined}
              style={{ left: `${v * 10}%`, ['--cap' as string]: energySlotHex(v) }}
            >
              <span className={styles.capBody} />
              <span className={styles.capTag}>
                {two(Math.round(v))} · {VIBE_NAMES[Math.round(v)]}
              </span>
            </div>
          )
        })}
      </div>
      {!compact ? (
        <div className={styles.numbers} aria-hidden="true">
          {VIBE_NAMES.map((_, i) => (
            <span key={i} style={{ left: `${i * 10}%` }} data-in={(i >= Math.round(lo) && i <= Math.round(hi)) || undefined}>
              {two(i)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const HINT_KEY = 'gradiente-v2:pista-horizonte'

/**
 * First visit only: one line that explains the instrument, gone the moment
 * the horizon moves (or when dismissed). Understanding through the gesture.
 */
function Pista() {
  // Seen before (stored) — read in the browser only; the server never shows it.
  const seen = useClientValue(() => {
    try {
      return localStorage.getItem(HINT_KEY) === '1'
    } catch {
      return true // private mode: no hint
    }
  }, true)
  const [dismissed, setDismissed] = useState(false)
  useEffect(
    () =>
      useCampo.subscribe((s, prev) => {
        if (s.range !== prev.range) {
          setDismissed(true)
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            /* ignore */
          }
        }
      }),
    [],
  )
  const setShow = (v: boolean) => setDismissed(!v)
  if (seen || dismissed) return null
  return (
    <p className={styles.pista}>
      <span className={styles.pistaDot} />
      Navegas por energía, no por género: arrastra las tapas y el campo toma esa temperatura.
      <button
        type="button"
        onClick={() => {
          setShow(false)
          try {
            localStorage.setItem(HINT_KEY, '1')
          } catch {
            /* ignore */
          }
        }}
      >
        Entendido
      </button>
    </p>
  )
}

/**
 * Genres present in the filtered feed, floating at the energy where they
 * actually are (not where the stereotype says). Click toggles a filter.
 */
function Particulas() {
  const present = useCampo((s) => s.present)
  const active = useCampo((s) => s.genres)
  const toggle = useCampo((s) => s.toggleGenre)
  const range = useCampo((s) => s.range)

  const placed = useMemo(() => {
    // Most present genres claim space first; active filters always show.
    const byCount = [...present].sort((a, b) => b.count - a.count)
    const wanted = [
      ...active.map((id) => present.find((p) => p.id === id) ?? { id, energy: 5, count: 0 }),
      ...byCount.filter((p) => !active.includes(p.id)),
    ].slice(0, 18)
    // Three lanes of occupied intervals (units: % of width). A label keeps
    // its true energy when it can; otherwise it may slide a little (≤ 7 %)
    // into the nearest free gap; if nothing fits nearby, it waits its turn
    // (it will appear when the horizon narrows).
    const lanes: Array<Array<[number, number]>> = [[], [], []]
    const fits = (lane: number, a: number, b: number) => lanes[lane].every(([s, e]) => b + 0.6 <= s || a - 0.6 >= e)
    const out: Array<(typeof wanted)[number] & { x: number; lane: number }> = []
    for (const g of wanted) {
      const w = Math.max(5, shortGenreName(g.id).length * 0.66 + 2.4)
      const ideal = Math.min(100 - w / 2, Math.max(w / 2, g.energy * 10))
      let best: { x: number; lane: number; d: number } | null = null
      for (let lane = 0; lane < lanes.length; lane++) {
        for (const shift of [0, 1.5, -1.5, 3, -3, 5, -5, 7, -7]) {
          const x = Math.min(100 - w / 2, Math.max(w / 2, ideal + shift))
          if (fits(lane, x - w / 2, x + w / 2)) {
            const d = Math.abs(shift) + lane * 0.4
            if (!best || d < best.d) best = { x, lane, d }
            break
          }
        }
      }
      if (!best) continue
      lanes[best.lane].push([best.x - w / 2, best.x + w / 2])
      out.push({ ...g, x: best.x, lane: best.lane })
    }
    return out
  }, [present, active])

  return (
    <div className={styles.particles} role="group" aria-label="Géneros presentes en esta temperatura">
      {placed.map((g) => {
        const on = active.includes(g.id)
        const near = g.energy >= range[0] - 0.5 && g.energy <= range[1] + 0.5
        return (
          <button
            key={g.id}
            type="button"
            className={styles.particle}
            data-on={on || undefined}
            data-near={near || undefined}
            aria-pressed={on}
            style={{ left: `${g.x}%`, top: g.lane * 22, ['--p' as string]: energySlotHex(g.energy) }}
            onClick={() => toggle(g.id)}
          >
            <span className={styles.dot} />
            {shortGenreName(g.id)}
          </button>
        )
      })}
    </div>
  )
}
